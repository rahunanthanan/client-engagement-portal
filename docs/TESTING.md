# Testing

| Layer | Tool | Location | Run |
| --- | --- | --- | --- |
| Pure engine (rules, graph, validation, hydration) | Jest | `src/forms/engine/__tests__` | `pnpm test` |
| Components | Jest + React Testing Library + MSW | `src/forms/components/__tests__` | `pnpm test` |
| Workspace state and save races | Jest + MSW | `src/features/workspace/__tests__` | `pnpm test` |
| Journeys through the whole app (memory router, real store, MSW) | Jest + RTL + MSW | `src/__tests__/journeys.test.tsx` | `pnpm test` |
| HTTP client, RPC adapter, security helpers | Jest | `src/api/__tests__`, `src/shared/__tests__` | `pnpm test` |
| Real browser, production build, lazy chunks, CSP | Playwright | `e2e/` | `pnpm build && pnpm test:e2e` |

At the time of writing there are 78 Jest tests (about 82% line coverage overall) and 7 Playwright tests, all passing.
The Playwright suite also passes against the nginx container with the production Content Security Policy.

## How MSW is shared

The same handlers (`src/mocks/handlers.ts`) run in the browser (service worker, `src/mocks/browser.ts`) and in Jest
(`msw/node`, `src/mocks/server.ts`). Tests flip failure scenarios with `setScenarios(...)` exactly as the Simulation
panel does, and `resetDb()` plus `resetScenarios()` run after each test. Jest uses `jest-fixed-jsdom` so `fetch`,
`Request` and streams behave like a browser, and `onUnhandledRequest: 'error'` catches calls that have no handler.

## Requirement → test map

| Requirement | Test |
| --- | --- |
| Conditional fields | `formModel.test.ts` "shows a field only when its condition holds"; `DynamicForm.test.tsx` "shows and hides conditional fields…" |
| Hidden-value policies | `formModel.test.ts` "clears a hidden value…" / "retains a hidden value… but excludes it from submission" |
| Dependencies | `DynamicForm.test.tsx` "loads dependent dropdown options… clears the child"; `formModel.test.ts` "clears a dependent dropdown" |
| Circular dependencies and unsupported types | `validateSchema.test.ts`; `DynamicForm.test.tsx` "refuses to render…", "shows a placeholder for unsupported field types" |
| Hydration | `hydrateFormWithDependencies.test.ts` (parent-first loading, stale options dropped, defaults) |
| Tab isolation | `workspaceSlice.test.ts` "independent per tab"; `journeys.test.tsx` "keeps tabs isolated"; `draftSave.test.ts` "per tab" |
| Incomplete saves | `validation.test.ts` "draft mode skips required rules"; `draftSave.test.ts` "saves an incomplete draft"; journey "saves an incomplete draft…" |
| Autosave races | `workspaceSlice.test.ts` "save ordering" group; `draftSave.test.ts` "out-of-order responses" and "autosaves after the debounce" |
| Conflicts | `draftSave.test.ts` "surfaces a revision conflict…"; `e2e/journey.spec.ts` "revision conflict" |
| Server validation | journey "maps server-side validation errors (422) onto fields" |
| Session expiry | journey "shows the expiry dialog… returns to sign-in" |
| Denied actions | journey "backend denies a task action (403)" and "hides pages a role may not use, and the backend refuses the call anyway" |
| Successful submission | journey "submits a complete request; the backend evaluates the decision and creates a review task" |
| Safe retries and correlation IDs | `httpClient.test.ts` |
| Safe text, redirects, attachments, redaction | `security.test.ts`; journey "renders reviewer comments as text" |
| Isolated subscriptions | `DynamicForm.test.tsx` "re-renders only the field being edited" |
| Lazy modellers and highlighting | `e2e/journey.spec.ts` "reviewer sees the BPMN diagram…" |
| No runtime errors on any page | `e2e/smoke.spec.ts` (fails on any console error or uncaught exception) |

## Conventions

- Query by role and label, as a user would. `data-testid` is used only for status indicators that have no accessible role.
- Every test starts from the seeded fictional database, so tests don't depend on each other.
- Timers: autosave tests use a short debounce (`createAppStore({ autosaveDelayMs })`) instead of fake timers, because
  MSW and fetch rely on real promises.
