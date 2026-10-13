# Client Engagement Portal (sample application)

A staff portal for client onboarding, service requests and operational workflows, built to practise
explaining frontend architecture end to end: dynamic forms, state management, API integration,
security, performance, testing and deployment.

> **Everything here is fictional.** Clients, staff, schemas, decisions and IDs are invented.
> The backend is **simulated in the browser by Mock Service Worker (MSW)** and sign-in uses a
> **demo identity adapter**. Nothing connects to a real identity provider, API, scanner or cluster.
> See [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

## Quick start

Requirements: Node 22.12 or later and pnpm 10 (`corepack enable` provides the pinned pnpm).

```bash
pnpm install --frozen-lockfile   # pinned versions from pnpm-lock.yaml
pnpm dev                         # http://localhost:5173 (simulated backend runs in the browser)
```

pnpm may print *Ignored build scripts* for a few packages. That is intentional: only esbuild, @swc/core and msw
are allowed to run install scripts (`pnpm.onlyBuiltDependencies`).

Choose a role on the sign-in page. Use the **Simulation** button in the header to inject failures
(save errors, slow or out-of-order responses, conflicts, session expiry, denied actions).

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server with fast refresh |
| `pnpm build` | Type-check, then production build to `dist/` |
| `pnpm preview` | Serve the production build on http://localhost:4173 |
| `pnpm lint` | ESLint (strict typescript-eslint, React hooks rules), zero warnings allowed |
| `pnpm typecheck` | `tsc --noEmit` in strict mode |
| `pnpm test` | Jest + React Testing Library + MSW (unit, component and journey tests) |
| `pnpm test:coverage` | The same with coverage (`coverage/lcov.info` feeds SonarQube) |
| `pnpm test:e2e` | Playwright against the production build (run `pnpm build` first) |
| `pnpm analyze` | Build with full source maps and print a raw/gzip size table per chunk |
| `pnpm ci` | Lint, typecheck, coverage and build, as the pipeline does |

Playwright: if your machine already has Chromium, `PW_CHROMIUM_PATH=/path/to/chrome pnpm test:e2e`
skips the browser download. `PW_BASE_URL=http://localhost:8080 pnpm test:e2e` runs the suite against
an already running server such as the nginx container.

## Roles (fictional)

| Role | Demo user | Can |
| --- | --- | --- |
| Client Advisor | Alex Rivera | Search clients, create requests, edit and save drafts, submit |
| Operations Reviewer | Sam Patel | Work the task inbox, approve, return or reject requests |
| Administrator | Jordan Lee | View and edit form, process (BPMN) and decision (DMN) definitions |

The backend checks the role on every call. The UI only hides what a role cannot do.

## Five-minute demo script

1. **Advisor:** sign in as Client Advisor. Search "Bluefin" on the dashboard and choose **Create request**.
   Pick *Client onboarding* and then *Corporate entity onboarding*. Schema v3 loads and the request opens in a workspace tab.
2. Choose Canada as the country of incorporation and the Region dropdown appears with options loaded from the API.
   Set *Entity type* to Trust and watch the conditional fields appear. Add a beneficial owner and tick *controlling*.
3. Open the existing draft **REQ-2026-000091** (v2 schema, Region pre-hydrated) and the returned request
   **REQ-2026-000093** in a second tab. Edits in one tab never appear in the other.
4. In the **Simulation** panel, turn on *Delay next save response (out-of-order)*, type and press **Save draft**, then keep typing.
   The slow, older response can't mark the newer edits as saved. Turn on *Colleague edits before next save (409)* to see the conflict banner.
5. Press **Submit** on an incomplete draft to see the accessible error summary. Each link jumps to its field.
6. **Reviewer:** sign out and sign in as Operations Reviewer. Open TASK-0007, look at the BPMN diagram with the current task
   highlighted and the DMN rule that fired, then try to approve without a comment (senior review requires one).
7. **Administrator:** open Definitions and edit the BPMN process or the DMN table. Then open the form-js
   questionnaire, which uses the *alternative* form technology.

The full narrated version is in [docs/WALKTHROUGH.md](docs/WALKTHROUGH.md).

## Folder structure

```
src/
  app/            store, providers, routes, shell, simulation panel, env (only file reading import.meta.env)
  api/            typed contracts, HTTP client (correlation IDs, retries, idempotency), RPC adapter, endpoints
  auth/           identity adapter interface, DEMO adapter, OIDC/ADFS example, permissions, guards, session expiry
  forms/
    schema/       discriminated-union schema types, schema validator, converter to form-js
    engine/       pure rules, dependency graph, validation, formsSlice, useFormStateManager, hydration
    components/   DynamicForm, FormSection, FieldRenderer, field registry and field components
  features/
    dashboard/    dashboard, client search, request list, Preact summary island
    requests/     CreateRequest, RequestDetails (edit), RequestViewer (read-only), workflow and audit panels
    workspace/    tabs, autosave listener, save ordering, conflicts, unsaved-change guard, persistence
    tasks/        reviewer inbox and task actions
    workflow/     bpmn-js, dmn-js and form-js wrappers (all lazy-loaded) and fictional definitions
    admin/        definition list and editors
  widgets/        the isolated Preact widget and its React bridge
  shared/         logger (redacting), safe text, attachments, latest-only guard, hooks, components
  styles/         design tokens, MUI theme, global SCSS
  mocks/          MSW handlers, in-memory DB, fictional data and schemas, failure scenarios
  test/           Jest setup and helpers
e2e/              Playwright specs
scripts/          bundle size report
ci/veracode/      Veracode config and packaging script (illustrative)
deploy/           nginx config, OpenShift manifests, kustomization (illustrative)
docs/             architecture, walkthrough, security, testing, deployment, versions, limitations
Jenkinsfile       illustrative pipeline
Dockerfile        multi-stage build to an unprivileged nginx static server
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md): state ownership, form engine, workspace, APIs, decisions,
  Webpack comparison, Zustand alternative.
- [Interview walkthrough](docs/WALKTHROUGH.md): the 8 topics with files, data flow, decisions, links to existing experience
  and what is new.
- [Security](docs/SECURITY.md) · [Testing](docs/TESTING.md) · [Deployment](docs/DEPLOYMENT.md) ·
  [Versions](docs/VERSIONS.md) · [Limitations](docs/LIMITATIONS.md)

## What needs credentials or infrastructure (not included)

| Item | Needs |
| --- | --- |
| `Jenkinsfile` | Jenkins agents, SonarQube server, Veracode account, image registry, OpenShift project, credentials by ID |
| `sonar-project.properties` | A SonarQube server and token (from CI) |
| `ci/veracode/*` | A Veracode account, application profile and API credentials (from CI) |
| `deploy/openshift/*` | An OpenShift cluster, a namespace and a registry. Hosts are `example.internal` placeholders |
| `src/auth/OidcIdentityAdapter.example.ts` | An OIDC-capable IdP (for example ADFS) and a backend-for-frontend. Not wired in |
| `VITE_API_MODE=http` | A real backend implementing `src/api/contracts.ts` |
