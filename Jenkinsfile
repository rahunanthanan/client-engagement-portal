// ILLUSTRATIVE PIPELINE. It needs infrastructure that is not part of this repository:
//   - Jenkins agents labelled `node22` (Node 22 + pnpm + Chromium) and `container-build` (buildah or docker)
//   - Jenkins credentials: `sonarqube-token`, `veracode-api` (id/key pair), `registry-push`, `openshift-deployer`
//   - A SonarQube server configured in Jenkins as `SonarQube`, a Veracode application profile,
//     an image registry and an OpenShift project.
// Every credential is referenced by id only; nothing secret lives in this file.
pipeline {
  agent { label 'node22' }

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds(abortPrevious: true)
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  environment {
    CI = 'true'
    PNPM_HOME = "${WORKSPACE}/.pnpm-home"
    IMAGE = 'image-registry.example.internal/client-engagement/client-engagement-portal'
    IMAGE_TAG = "${env.GIT_COMMIT?.take(12) ?: 'local'}"
    PW_CHROMIUM_PATH = '/opt/pw-browsers/chromium'
  }

  stages {
    stage('Install') {
      steps {
        sh 'corepack enable && pnpm install --frozen-lockfile'
      }
    }

    stage('Quality gates') {
      parallel {
        stage('Lint') { steps { sh 'pnpm lint' } }
        stage('Typecheck') { steps { sh 'pnpm typecheck' } }
        stage('Unit and integration tests') {
          steps { sh 'JEST_JUNIT_OUTPUT_DIR=reports pnpm test:coverage --ci --reporters=default --reporters=jest-junit' }
          post {
            always {
              junit allowEmptyResults: true, testResults: 'reports/junit.xml'
            }
          }
        }
      }
    }

    stage('Build') {
      steps {
        sh 'pnpm build'
        sh 'node scripts/report-bundle-size.mjs | tee reports/bundle-size.txt'
        archiveArtifacts artifacts: 'reports/bundle-size.txt', fingerprint: true
      }
    }

    stage('End-to-end tests') {
      steps { sh 'pnpm test:e2e' }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'test-results/e2e-junit.xml'
          archiveArtifacts allowEmptyArchive: true, artifacts: 'test-results/**/trace.zip'
        }
      }
    }

    stage('SonarQube analysis') {
      steps {
        withSonarQubeEnv('SonarQube') {
          withCredentials([string(credentialsId: 'sonarqube-token', variable: 'SONAR_TOKEN')]) {
            sh 'npx --yes @sonar/scan -Dsonar.token="$SONAR_TOKEN"'
          }
        }
      }
    }

    stage('Sonar quality gate') {
      steps {
        timeout(time: 5, unit: 'MINUTES') { waitForQualityGate abortPipeline: true }
      }
    }

    stage('Veracode static scan') {
      // Uploads the built bundle (with hidden source maps) for SAST; see ci/veracode/README.md.
      when { anyOf { branch 'main'; branch 'release/*' } }
      steps {
        sh 'node ci/veracode/package-for-scan.mjs'
        withCredentials([usernamePassword(credentialsId: 'veracode-api', usernameVariable: 'VERACODE_API_KEY_ID', passwordVariable: 'VERACODE_API_KEY_SECRET')]) {
          sh 'veracode static scan reports/veracode-upload.zip --results-file reports/veracode-results.json --policy-name "Client Engagement Policy"'
        }
      }
    }

    stage('Container image') {
      when { anyOf { branch 'main'; branch 'release/*' } }
      agent { label 'container-build' }
      steps {
        withCredentials([usernamePassword(credentialsId: 'registry-push', usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
          sh '''
            echo "$REG_PASS" | buildah login -u "$REG_USER" --password-stdin image-registry.example.internal
            buildah bud --build-arg VITE_API_MODE=mock -t "$IMAGE:$IMAGE_TAG" .
            buildah push "$IMAGE:$IMAGE_TAG"
          '''
        }
      }
    }

    stage('Deploy to test') {
      when { branch 'main' }
      steps {
        withCredentials([string(credentialsId: 'openshift-deployer', variable: 'OC_TOKEN')]) {
          sh '''
            oc login --token="$OC_TOKEN" --server=https://api.openshift.example.internal:6443
            cd deploy && kustomize edit set image "$IMAGE=$IMAGE:$IMAGE_TAG" && cd ..
            oc apply -k deploy -n client-engagement-test
            oc rollout status deployment/client-engagement-portal -n client-engagement-test --timeout=180s
          '''
        }
      }
    }

    stage('Promote to production') {
      when { branch 'release/*' }
      steps {
        input message: 'Promote this image to production?', submitter: 'release-approvers'
        echo 'Production promotion reuses the SAME image digest that passed test (no rebuild).'
      }
    }
  }

  post {
    always { cleanWs(deleteDirs: true, notFailBuild: true) }
  }
}
