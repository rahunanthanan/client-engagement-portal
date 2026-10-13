# Interview walkthrough

Two parts: a **five-minute live demo** script, then a **topic-by-topic explanation** covering the 8 topics.
Each topic covers its files, data flow, design decisions, the link to established experience, and what is new learning.

Experience labels used below:

- **Established**: React and TypeScript enterprise apps, schema-driven forms by category and type, conditional fields,
  dependent dropdowns, validation, smart search, reusable MUI components, case-management UIs and APIs, form state,
  caching, unsaved-change protection, app shells, routing, sessions, Jest, React Testing Library, Webpack and Jenkins.
- **New learning**: React 19 APIs, Vite, Preact islands, bpmn-js, dmn-js and form-js modellers, resilient autosave
  (sequence numbers, revisions, conflicts), MSW, Playwright, OpenShift manifests and the BFF auth pattern.

---

## Part 1: five-minute demo

| Time | Show | Say |
| --- | --- | --- |
| 0:00 | Sign-in page, demo banner | "Fictional staff portal. The backend is simulated with MSW and sign-in is a labelled demo adapter behind the same interface a real OIDC/ADFS adapter would implement." |
| 0:20 | Advisor dashboard, search "Bluefin" | "Search is debounced, paginated and protected against stale responses. The summary tiles are a Preact widget." |
| 0:45 | Create request, Onboarding, Corporate entity | "Category and type select a versioned schema (v3). The request gets a stable server ID and opens as a workspace tab." |
| 1:15 | Choose Canada, then Region. Entity type Trust. Add an owner and tick controlling | "Visibility, required rules and dependent dropdowns all come from the schema. Changing the parent clears the child. Hidden values follow an explicit clear-or-retain policy." |
| 1:50 | Open REQ-2026-000091 (v2) and REQ-2026-000093 | "An older draft keeps its schema version. Hydration loads the dependent options parent-first. Each tab has its own values, sequence numbers and save status." |
| 2:30 | Simulation: delay the next save, type, press Save, keep typing | "The older response can't mark newer edits as saved, because saves carry the edit sequence they covered." |
| 3:00 | Simulation: colleague edits (409) | "Revision check. Autosave pauses and I choose keep mine or take theirs. Nothing is overwritten silently." |
| 3:20 | Submit an incomplete draft | "Draft saves skip required rules. Submit validates fields, sections and the whole request, then shows an accessible error summary that links to each field." |
| 3:45 | Sign in as Reviewer, open TASK-0007 | "The server decided the risk tier and created this task. bpmn-js highlights the current activity and dmn-js shows which rule fired. A senior review needs a comment." |
| 4:20 | Sign in as Admin, open BPMN, DMN and form-js | "The modellers are lazy-loaded chunks. form-js is the alternative form technology, with a documented boundary." |
| 4:40 | Terminal: `pnpm test`, `pnpm test:e2e`, Jenkinsfile, `deploy/` | "Unit, component, journey and Playwright tests. The pipeline runs lint, typecheck, tests, Sonar, Veracode, image build and an OpenShift rollout, all labelled as needing real infrastructure." |

---

## Part 2: the 8 topics

### 1. Business requirement and user journey

**Requirement.** Staff create and manage client requests: onboarding and service changes. Advisors capture data,
often across several sittings and several clients at once. Operations review them, and administrators govern the definitions.

**Files.** `src/app/routes.tsx`, `src/features/dashboard/*`, `src/features/requests/CreateRequest.tsx`,
`src/features/workspace/WorkspacePage.tsx`, `src/features/tasks/*`, `src/features/admin/*`, `src/auth/permissions.ts`.

**Flow.** Dashboard → `ClientSearch` → `CreateRequest` (catalog query, then category and type, then `POST /requests` with an
idempotency key) → `/workspace/:requestId` → `RequestDetails` (edit, save, submit) → server creates a review task →
`TaskInbox` → `TaskDetail` (approve, return or reject) → the request shows as approved or returned.

**Decisions.** Request IDs are server-assigned and stable, so tabs, URLs and drafts all key on them. Roles map to
permissions (`permissions.ts`) rather than being checked by name in components.

**Experience link (established).** Case-management interfaces, schema-driven request forms, app shell and routing.

**New.** Modelling the reviewer and admin journeys around BPMN and DMN definitions.

### 2. Schema rendering and dependencies

**Files.** `src/forms/schema/types.ts`, `validateSchema.ts`, `src/forms/engine/{rules,dependencies,formModel,validation,validators}.ts`,
`hydrateFormWithDependencies.ts`, `src/forms/components/{DynamicForm,FormSection,FieldRenderer,fieldRegistry}.ts(x)`,
`components/fields/*`, `src/mocks/schemas/*`.

**Flow.** Schema (from the API by `schemaId` and `version`) → `validateSchema` (blocks cycles, duplicate IDs, unknown references
and missing hidden policies, and reports unsupported types) → hydration (defaults + stored values, dependent options
loaded in topological order) → `formInitialized` → `DynamicForm` → `FormSection` (accordion) → `FieldRenderer` (subscribes to
one field) → registry component. Each change goes through `setValue` → `applyFieldChange` (clears dependants) →
`applyHiddenPolicies` → re-validate touched fields.

**Decisions.**
- Discriminated unions with a mapped-type registry, so a missing component is a compile error.
- Rules are data (`visibleWhen`, `requiredWhen`), not functions, so schemas stay JSON and can be served by an API.
- Required rules apply only on submit, so drafts can always be saved.
- `whenHidden` is mandatory for conditional fields.
- The custom engine and form-js are alternatives, and `toFormJsSchema.ts` defines the boundary.

**Experience link (established).** Schema-driven forms selected by category and type, conditional fields, dependent dropdowns,
validation, smart search, reusable MUI field components. `DynamicForm`, `useFormStateManager`, `FieldRenderer`, `FormSection`
and `hydrateFormWithDependencies` follow familiar names.

**New.** Graph-based cycle detection and topological hydration, the typed `FormApi` exposed through React 19 `ref` as a
prop, and form-js as a second engine.

### 3. State ownership and tab isolation

**Files.** `src/app/store.ts`, `src/forms/engine/formsSlice.ts`, `formSelectors.ts`, `useFormStateManager.ts`,
`src/features/workspace/{workspaceSlice,selectors,WorkspaceTabs}.ts(x)`, `src/app/queryClient.ts`, `src/api/endpoints.ts` (`queryKeys`).

**Flow.** Server data → TanStack Query (keyed by `queryKeys`). Copied once into `forms[requestId]` on hydration. Edits update
only `forms[requestId]` and `workspace.tabs[requestId].editSeq`. Each `FieldRenderer` selects `forms[formId].values[fieldId]`.

**Decisions.** One owner per piece of state (see ARCHITECTURE §1). Form state is keyed by form ID, so two tabs can never share
values. The read-only viewer uses a separate form ID (`view:...`) so it can't disturb an editing tab. Field-level selectors keep
re-renders local, which you can show with the render-count toggle.

**Experience link (established).** Form state management and caching. Redux in enterprise apps.

**New.** Using RTK and Query side by side with a strict split, and React 19's `ref` prop.

### 4. Draft saving and conflict handling

**Files.** `src/features/workspace/{draftSave,autosaveListener,workspaceSlice,ConflictBanner,UnsavedChangesGuard,SaveStatusIndicator,workspacePersistence,editorSession}.ts(x)`,
the draft handler in `src/mocks/handlers.ts`, `src/features/workspace/__tests__/*`.

**Flow.** An edit dispatches `formValuesChanged` (`editSeq++`). The listener restarts that request's 1.5-second timer and then calls
`saveDraft(requestId, 'autosave')`. The thunk snapshots `seq = editSeq` and sends `PUT /requests/:id/draft` with
`{ baseRevision, clientSeq, editorSessionId, values }` and `Idempotency-Key`. On 200, `savedSeq = max(savedSeq, seq)` and
`serverRevision = max(...)`. On 409, the tab goes to `conflict` and autosave pauses. On other errors, the status is error, the values are kept,
and Retry is offered.

**Decisions.**
- The listener handles autosave, so background tabs still save.
- Sequence numbers make out-of-order responses harmless.
- The server accepts fast-forward saves from the same editor session, which handles overlapping saves from one tab, but rejects other editors with 409.
- Idempotent retries for 503 on saves.
- Close-tab and navigation guards.
- Local persistence is for fictional demo data only. Production would use server-side drafts and approved storage.

**Experience link (established).** Unsaved-change protection, drafts and multiple open cases.

**New (resilient autosave).** Edit-sequence and revision tracking, conflict resolution UI, idempotency keys, and simulating race
conditions on purpose with MSW scenarios.

### 5. APIs and workflow boundaries

**Files.** `src/api/{contracts,httpClient,endpoints,rpcAdapter}.ts`, `src/mocks/{handlers,db,scenarios,riskDecision}.ts`,
`src/features/requests/{WorkflowPanel,AuditHistory}.tsx`, `src/features/workflow/*`.

**Flow.** Component → `api.*` (typed) → `apiRequest` (correlation ID, auth headers, retry policy, `ApiError`) → MSW handler →
in-memory DB. On submit, the server validates (and can return 422), evaluates the risk decision, sets
`workflow.currentActivityId` and creates a task. The UI renders that state: bpmn-js adds a `cep-current` marker, and dmn-js
highlights `matchedRuleIds`.

**Decisions.**
- Typed contracts are the seam between UI and backend, so a real backend replaces MSW without UI changes.
- The backend is authoritative for transitions and decisions, and the UI never recomputes them.
- Retries happen only when they are safe.
- Duplicate-submission protection uses one idempotency key per submit intent.
- An RPC adapter shows that the transport is swappable.

**Experience link (established).** Case-management backend APIs and error handling.

**New.** MSW as a realistic simulated backend, correlation IDs and idempotency, and bpmn-js and dmn-js visualisation.

### 6. Authentication and security

**Files.** `src/auth/*` (IdentityAdapter, DemoIdentityAdapter, OidcIdentityAdapter.example, authSlice, RouteGuards,
SessionManager, LoginPage, permissions, usePermission), `src/shared/{logger,attachments}.ts`, `src/shared/components/UserText.tsx`,
`eslint.config.js`, `deploy/nginx/security-headers.inc`, `docs/SECURITY.md`.

**Flow.** `IdentityAdapter.restore()` → `authSlice`. Guards check permissions. Every API call carries the identity (a demo header, or a
cookie in production). A 401 from the server marks the session expired and shows a dialog, then `/login?reason=expired&returnTo=...`
(validated by `safeReturnTo`). A 403 shows a clear message and the UI never assumes success.

**Decisions.**
- Recommended production pattern: OIDC Authorization Code + PKCE through a BFF, so tokens never reach the browser.
- The demo is labelled everywhere.
- ESLint bans `dangerouslySetInnerHTML` and `console`, and the logger redacts sensitive keys.
- Attachments are checked by type, extension and size on the client, and again on the server.
- Errors are announced to screen readers.

**Experience link (established).** Session handling, route guards, permission-aware UI.

**New.** The BFF and OIDC with ADFS design, a CSP for an SPA, and open-redirect protection.

### 7. Performance and testing

**Files.** `vite.config.ts` (`manualChunks`), `src/features/workflow/lazy.ts`, `scripts/report-bundle-size.mjs`,
`src/shared/{latestOnly.ts,hooks/useDebouncedValue.ts}`, `src/features/dashboard/ClientSearch.tsx`, the tests under `src/**/__tests__`,
`e2e/*.spec.ts`, `docs/TESTING.md`.

**Flow.**
- Measure first: `pnpm analyze` shows the modellers are about 2 MB raw, so they are lazy chunks that the main journey never loads.
- Render counts show that only the edited field re-renders.
- Client search is debounced (300 ms) and paginated, and the staff search field is debounced. Each query string has its own TanStack Query key and the superseded request is aborted, so a slow, stale response can never overwrite a newer one. Turn on *Random search latency* in the Simulation panel to see this. `shared/latestOnly.ts` provides the same guarantee for code outside TanStack Query.

**Tests.** The engine tests cover rules, cycles, hidden policies and hydration. The component tests cover `DynamicForm`. The workspace tests
cover save races and conflicts. The journey tests cover the advisor, reviewer, session and authorization flows. The API tests cover retries and the RPC
adapter. The security tests cover redirects, attachments and redaction. Playwright covers the real browser, lazy modellers and console errors
under the production CSP.

**Experience link (established).** Jest, React Testing Library, performance tuning.

**New.** MSW shared between browser and Jest, Playwright, and React 19 testing patterns.

### 8. Build and deployment

**Files.** `package.json` scripts, `vite.config.ts`, `Jenkinsfile`, `sonar-project.properties`, `ci/veracode/*`, `Dockerfile`,
`deploy/nginx/*`, `deploy/openshift/*`, `deploy/kustomization.yaml`, `docs/DEPLOYMENT.md`.

**Flow.** Jenkins: install (frozen lockfile) → lint, typecheck and tests with coverage in parallel → build plus bundle report → Playwright →
SonarQube and quality gate → Veracode SAST and SCA → image (`buildah`) → `oc apply -k deploy` → rollout status → manual promotion of
the *same* image to production.

**Decisions.**
- A static bundle is served by unprivileged nginx with a read-only root filesystem, running as an arbitrary UID (OpenShift).
- Security headers and cache rules live in nginx.
- `VITE_*` values are build-time settings.
- Hidden source maps keep debugging possible without publishing source.

**Experience link (established).** Jenkins pipelines, Webpack builds (see the Vite and Webpack comparison in ARCHITECTURE.md).

**New.** Vite, multi-stage images, OpenShift Route, NetworkPolicy and HPA, and kustomize.

---

## Likely questions and short answers

- **Why not keep everything in Redux?** Server data needs caching and freshness rules, which TanStack Query already handles. Redux keeps what only the client knows.
- **What if two tabs save the same request?** Tabs are keyed by request ID, so one request is one tab. Two browsers or users get a 409 conflict.
- **How do you stop double submission?** The button is disabled while pending, and one idempotency key per submit intent means the server replays the first result.
- **Why is autosave not a `useEffect`?** It would stop when the tab unmounts, and it would be harder to test.
- **Where would real auth go?** Replace `DemoIdentityAdapter` with the BFF adapter. Nothing else in the app depends on the demo.
- **How would you move to Webpack or Zustand?** See ARCHITECTURE.md. Each is a contained swap.
