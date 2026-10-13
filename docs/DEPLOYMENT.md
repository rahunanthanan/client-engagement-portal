# Build and deployment

> **Illustrative.** The Jenkinsfile, SonarQube and Veracode configuration and the OpenShift manifests need infrastructure and
> credentials that are not part of this sample (see the table in the README). The **runtime stage** was verified
> locally: nginx serving the built `dist/` as an arbitrary UID with a read-only root filesystem, and the full Playwright suite passed
> against it under the production CSP. The build stage runs the same `pnpm install` and `pnpm build` commands that were
> verified outside Docker (the sandbox used to produce this sample blocks network access from inside image builds).

## Container image

`Dockerfile` (multi-stage):

1. **build** (`node:22.22-alpine`): `pnpm install --frozen-lockfile`, then `pnpm build`. `VITE_*` build arguments are
   compiled into the bundle.
2. **runtime** (`nginxinc/nginx-unprivileged:1.29-alpine`): only `dist/` plus `deploy/nginx/*`. Runs as a non-root user and
   listens on 8080, with a `/healthz` endpoint.

```bash
docker build -t client-engagement-portal:local .
docker run --rm -p 8080:8080 --read-only --tmpfs /tmp client-engagement-portal:local
PW_BASE_URL=http://localhost:8080 pnpm test:e2e     # run the e2e suite against the container
```

`deploy/nginx/default.conf` sets up the following:

- SPA fallback to `index.html`.
- `Cache-Control: immutable` for hashed `/assets/`, and `no-cache` for `index.html` and `mockServiceWorker.js`.
- Security headers (`security-headers.inc`: CSP, nosniff, referrer and permissions policy, COOP).
- HSTS is set at the TLS edge (the Route).

## Build-time versus run-time configuration

Vite inlines `VITE_*` at build time. Two options for multiple environments:

- **Build once per environment** (simple, as in the Jenkinsfile).
- **Build once and promote** (preferred for regulated pipelines). Serve a small `/config.json` from a ConfigMap and read it at
  start-up in `src/app/env.ts`. Only that file would change, because nothing else reads configuration.

## OpenShift

Apply with `oc apply -k deploy`. `deploy/kustomization.yaml` creates:

| File | Purpose |
| --- | --- |
| `openshift/deployment.yaml` | 2 replicas, rolling update with no unavailability, probes, resource limits, read-only root filesystem, all capabilities dropped, no service-account token |
| `openshift/service.yaml` | ClusterIP on 8080 |
| `openshift/route.yaml` | Edge TLS, HTTP→HTTPS redirect, HSTS annotation. The host is an `example.internal` placeholder |
| `openshift/hpa.yaml` | 2–4 replicas on CPU |
| `openshift/networkpolicy.yaml` | Ingress only from the router namespace, no egress |
| `openshift/poddisruptionbudget.yaml` | Keeps one pod available during node drains |
| ConfigMap (generated) | The same nginx config as the image, so headers can change without a rebuild |

OpenShift runs containers with an arbitrary UID in group 0. The image writes only to `/tmp`, an `emptyDir`, so it
works under the restricted SCC. This was checked locally with `docker run -u 12345:0 --read-only`.

## Pipeline (Jenkinsfile)

Install → lint, typecheck and tests with coverage (parallel, JUnit published) → build plus bundle size report → Playwright → SonarQube and
quality gate → Veracode static scan (main and release branches) → image build and push (buildah) → deploy to test
(`oc apply -k`, rollout status) → manual approval to promote the **same image** to production. Credentials are
referenced by ID only.

## SonarQube and Veracode

- `sonar-project.properties`: sources, tests, exclusions (mocks, fixtures, definitions) and LCOV from `pnpm test:coverage`.
- `ci/veracode/veracode.yml` and `package-for-scan.mjs`: SAST package (source and manifests, no tests or mocks) and SCA on the lockfile,
  failing on policy violations.
