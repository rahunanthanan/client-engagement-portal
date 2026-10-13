# Architecture

This sample is a single-page React 19 application built with Vite. The backend is simulated by MSW,
but every call goes through typed contracts (`src/api/contracts.ts`), so the UI cannot tell the
simulation from a real server.

```
Browser
├─ React app (src/app, src/features, src/forms)
│   ├─ Redux Toolkit store ─ client state: auth, forms (per formId), workspace tabs, UI
│   ├─ TanStack Query cache ─ server state: clients, schemas, lookups, requests, tasks, definitions
│   └─ apiRequest() ─ correlation ID, auth headers, safe retries, idempotency keys, ApiError
└─ MSW service worker (src/mocks) ─ in-memory DB, revision checks, decisions, workflow, failures
```

## 1. State ownership

The most important architectural rule is that **each piece of state has exactly one owner**.

| State | Owner | Why |
| --- | --- | --- |
| Data that lives on the server (requests, schemas, lookups, tasks) | TanStack Query | Caching, deduplication, background refetch, invalidation after mutations |
| Form values, errors, touched, validation mode, per form | Redux `forms` slice, keyed by `formId` | Many components read single fields; needs fine-grained selectors and must survive tab switches |
| Workspace tabs: order, active tab, edit sequence, server revision, save status, conflicts | Redux `workspace` slice, keyed by request ID | Shared by the tab strip, header, guards and the autosave listener |
| Session and role | Redux `auth` slice | Read everywhere (guards, nav, API client hook) |
| Snackbars, simulation toggles, render counters | Redux `ui` slice | Cross-cutting UI |
| Local widget state (an open dialog, an input being typed) | `useState` | Not shared |

Server data is **not copied** into Redux. A request record is read through `useQuery`. When a form is
opened, its stored values are copied once into the `forms` slice. From then on they are a *draft*
owned by the client until they are saved.

## 2. Dynamic form engine

The schema is data (`src/forms/schema/types.ts`). Rendering is a separate layer.

```
FormSchema (JSON, versioned)
  └─ validateSchema()        duplicate IDs, unknown references, cycles, unsupported types, missing hidden policy
  └─ engine/ (pure TS)       rules.ts, dependencies.ts, formModel.ts, validation.ts, validators.ts
  └─ formsSlice + useFormStateManager   typed FormApi: getValues/getValue/setValue/validate/reset/...
  └─ components/             DynamicForm → FormSection (accordion) → FieldRenderer → registry → field component
```

- **Discriminated unions.** `FieldSchema` is a union on `type` (text, textarea, number, date, dropdown, checkbox,
  toggle, search, readonly, alert, divider, attachment and repeatable). TypeScript narrows each field's props, and the
  registry (`fieldRegistry.ts`) is typed `{ [K in FieldType]: Component<Extract<FieldSchema, { type: K }>> }`,
  so adding a type without a component is a compile error. Unknown types from the server render an
  `UnsupportedField` and are reported by `validateSchema`.
- **Rules.** `visibleWhen` and `requiredWhen` use a small condition language (`equals`, `in`, `isTrue`, `all`, `any`, ...).
  Row fields can reference their own row (`row.isController`).
- **Hidden values.** Every conditional field must declare `whenHidden: 'clear' | 'retain'`. `validateSchema` reports a
  missing policy, so it is never implicit. `applyHiddenPolicies` runs after every change, and `visibleValuesOnly`
  strips hidden values before submission.
- **Dependencies.** `dependencies.ts` builds a graph from rules and `dependsOn`. `findCycle` blocks a schema with a
  cycle and `topologicalOrder` drives hydration order. Changing a parent clears its dependants (`applyFieldChange`).
- **Hydration** (`hydrateFormWithDependencies.ts`). This step merges defaults with stored values and loads dependent
  dropdown options parent-first through TanStack Query's `fetchQuery`, so the cache is warm. It also drops values that
  are no longer valid options, with a warning. A reopened draft shows *Canada / Ontario* at once instead of empty dropdowns.
- **Validation levels.** *Field* format rules run always. *Required* runs only in `submit` mode, so incomplete drafts
  save. *Section* validators are cross-field rules, and *submission* validators are rules that need a complete
  request. The server repeats the checks and can return 422 field errors, which the form maps onto fields.
- **Isolated subscriptions.** Each `FieldRenderer` selects only its own value, error and rule result, so typing in one
  field re-renders that field only (turn on "Show field render counts" in the Simulation panel to see this).

### Custom renderer versus form-js (two alternatives with a clear boundary)

| | Custom renderer (`src/forms`) | `@bpmn-io/form-js` (`src/features/workflow/FormJs*`) |
| --- | --- | --- |
| Used for | Main request forms: onboarding, service requests | A supplementary questionnaire, plus admin editing and preview |
| Schema | `FormSchema` (our types, versioned by `schemaId` + `version`) | form-js JSON (`schemaVersion`) |
| Strengths | Repeatable rows, API-driven dependent dropdowns, hidden-value policy, autosave and workspace integration, MUI look | Visual editor that non-developers can use, standard format, FEEL expressions |
| Boundary | `toFormJsSchema.ts` converts the *subset* that maps cleanly and reports unsupported parts. There is no reverse conversion | |

The rule: request forms that need the workspace and drafts use the custom engine, and simple, admin-authored
forms can use form-js. Neither engine depends on the other.

## 3. Workspace, drafts and save ordering

Each open request is a tab keyed by its **stable request ID**, which the server assigns on creation, so URLs such as
`/workspace/REQ-2026-000091` survive reloads. Per tab, the store tracks the following:

```
editSeq        incremented on every local edit
savedSeq       highest editSeq confirmed by the server   (only ever increases)
serverRevision server's revision number                  (only ever increases)
inFlightSaves, lastSavedAt, lastError, conflict, status, submitKey, submitting
```

The status is *derived*: `editSeq > savedSeq` means unsaved, or error if the last save failed. A response for a
save that started at `seq = 5` can only move `savedSeq` up to 5, so a slow, older response arriving
after a newer one never marks newer edits as saved (`saveSucceeded` uses `max`).

**Autosave lives in RTK listener middleware** (`autosaveListener.ts`), with one debounce timer per request ID, rather than in a
component effect. This means a background tab still saves after the user switches away, and edits in tab A never reset tab B's timer.

**Revision checks.** Each save sends `baseRevision`, `editorSessionId` and `clientSeq`. The server accepts a save when the base
matches, or when the same editor session fast-forwards with a higher `clientSeq` (overlapping saves from one tab). A
different editor gets **409** with the server's values. The tab enters `conflict`, autosave pauses, and
`ConflictBanner` lists the differing fields with *keep mine* or *take theirs*.

**Unsaved-change protection.** `beforeunload` plus React Router's `useBlocker` (`UnsavedChangesGuard.tsx`) cover
navigation, and closing a dirty tab offers *save and close*, *discard* or *cancel*.

**Local persistence (demo only).** Open tabs and unsaved values for **fictional data** are mirrored to
`localStorage` so a reload keeps the demo state. In production this would be off. Drafts would live
**server-side** (already the case for saved drafts), and anything kept client-side would use storage
approved by the security team, would be scoped per user, and would be cleared on sign-out.

## 4. API layer

- `contracts.ts` defines typed request and response shapes for client search, catalog, schema, lookups, requests,
  drafts, submission, attachments, decisions, tasks, audit and definitions.
- `httpClient.ts` (`apiRequest`):
  - It sends an `X-Correlation-ID` per logical call, reused across retries and shown in error messages for support.
  - It retries 502, 503, 504 and network errors only when that is safe: GET, HEAD and OPTIONS, or a call with an `Idempotency-Key`.
  - Draft saves use the key `requestId:editorSession:clientSeq`, and submissions keep one key per submission intent
    in the store, so a double click or a retry cannot submit twice.
  - It turns failures into an `ApiError` and hides 5xx server messages from users.
  - A 401 calls a hook that marks the session expired.
- `rpcAdapter.ts` is an illustrative JSON-RPC-over-HTTP transport behind a typed method map. Audit history uses it,
  to show that the UI API stays the same whatever the transport.
- **The backend is authoritative.** The browser never decides workflow transitions or risk outcomes. On submit, the
  server evaluates the DMN-equivalent rules, sets the risk tier and review level, and creates a review task. bpmn-js then
  *displays* `request.workflow.currentActivityId`, and dmn-js highlights the rule IDs the server reports.

## 5. Routing, shell and code splitting

React Router's data router (`createBrowserRouter`) runs inside a shell with the demo banner, permission-aware navigation,
the session manager and the unsaved-change guard. Pages are `lazy()` routes, and bpmn-js, dmn-js and form-js load only when a
diagram or editor is shown (`features/workflow/lazy.ts`). `vite.config.ts` puts each in its own vendor chunk, so the main
journey never downloads about 2 MB of modeller code. Measure with `pnpm analyze` before optimising further.

## 6. React 19 features used (new learning)

| Feature | Where | Why |
| --- | --- | --- |
| `ref` as a prop (no `forwardRef`) | `DynamicForm` exposes `FormApi` via `useImperativeHandle` | Parent pages call `validate()` and `getValues()` |
| `useActionState` + form `action` | `LoginPage` | Pending and error state without hand-written plumbing |
| `useOptimistic` + `useTransition` | `TaskDetail` | The chosen outcome ("Approve…") shows immediately and disappears if the server refuses (403) |
| Document metadata (`<title>` in components) | `PageHeader`, `LoginPage` | No helmet library needed |

## 7. Preact island

`widgets/request-summary` is a Preact component (written with `h()`, no JSX config needed) mounted into a `div` that
React owns (`PreactIsland.tsx`). React passes plain props, and Preact re-renders when they change and unmounts on
cleanup. The two runtimes don't share context or state. This keeps a small embeddable widget (the kind another
team could ship) independent of the host app's React version.

## Decision records

**ADR-1: RTK for client state and TanStack Query for server state.** Mixing server data into Redux leads to hand-written
caching and stale-data bugs. Query handles freshness, and Redux handles what the server doesn't know yet (drafts, tabs).

**ADR-2: Autosave in listener middleware, not `useEffect`.** Effects die with the component, so a background tab would
lose its pending save. A listener has one timer per request, is testable without rendering, and keeps the save logic in one thunk.

**ADR-3: Sequence numbers and revisions instead of "last response wins".** These make out-of-order responses harmless and
make real conflicts explicit.

**ADR-4: Hidden-value policy is mandatory.** Silently keeping or dropping hidden values causes data-quality incidents,
so schema validation forces the author to choose.

**ADR-5: Two form technologies with a written boundary.** The custom engine covers the hard workspace cases, and form-js gives
admins a visual editor. A converter covers the overlap, and nothing more.

## How the build would differ with Webpack

| Concern | Vite (this repo) | Webpack 5 equivalent |
| --- | --- | --- |
| Dev server | Native ES modules, esbuild pre-bundles deps, instant start | Bundles before serving. `webpack-dev-server` with `react-refresh-webpack-plugin` |
| TypeScript and JSX | esbuild/SWC transpile only, with `tsc --noEmit` for types | `swc-loader` or `babel-loader` (or `ts-loader` with `transpileOnly`) plus `fork-ts-checker-webpack-plugin` |
| SCSS | Built in (needs `sass`) | `sass-loader` → `css-loader` → `style-loader` / `MiniCssExtractPlugin` |
| Env vars | `import.meta.env.VITE_*`, read only in `src/app/env.ts` | `DefinePlugin` or `EnvironmentPlugin` with `process.env.*`. Only `env.ts` changes |
| Code splitting | `lazy(() => import())` plus `manualChunks` | The same dynamic imports plus `optimization.splitChunks.cacheGroups` |
| Assets | `public/` copied, hashed imports | `asset/resource` modules plus `copy-webpack-plugin` |
| Aliases | `resolve.alias` `@` → `src` | `resolve.alias` the same, or `tsconfig-paths-webpack-plugin` |
| Bundle analysis | `pnpm analyze` (size table) | `webpack-bundle-analyzer` |
| Jest | Unchanged: Jest never used Vite. It uses SWC through `@swc/jest` | Unchanged |

Because `import.meta.env` is read only in `src/app/env.ts` (and Jest maps that file to a stub), switching bundlers
touches the build config and one file.

## Replacing Redux Toolkit with Zustand (without installing both)

Zustand isn't installed. The swap would be a replacement, not an addition:

1. Create one store per concern (`useWorkspaceStore`, `useFormsStore`) with the same state shapes. The reducers in
   `formsSlice.ts` and `workspaceSlice.ts` are pure functions over plain objects, so they can be called from Zustand
   actions (`set((s) => workspaceReducer(s, action))`), or rewritten with `immer` middleware.
2. Replace `useAppSelector(selector)` with `useStore(selector, shallow)`. Field-level subscriptions keep working
   because Zustand also compares selector results.
3. Move autosave from listener middleware to `store.subscribe` with a per-request debounce, or keep the same
   `saveDraft` function and pass it `get` and `set` instead of `dispatch` and `getState`.
4. Remove `@reduxjs/toolkit` and `react-redux` in the same change, and update `renderApp` in tests.

Trade-off: Zustand has less boilerplate and a smaller bundle. RTK gives DevTools time travel, listener middleware and a
conventional structure for a larger team. This repo uses RTK because the requirements name it, and because cross-tab
autosave fits listener middleware well.
