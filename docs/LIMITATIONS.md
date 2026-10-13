# Limitations and simulated parts

This is a learning and demonstration sample. Here is what is real, what is simulated, and what is missing.

## Simulated (clearly labelled in the UI)

| Area | What actually happens |
| --- | --- |
| Backend | MSW intercepts `fetch` in the browser and in Jest. Data lives in an in-memory store, mirrored to `localStorage` in the browser so a reload keeps the demo state. *Simulation → Reset demo data* restores the seed |
| Identity | `DemoIdentityAdapter`: pick a role, with no password and no IdP. The OIDC/ADFS adapter is an example file that is not wired in |
| Workflow engine | The mock server moves requests through the BPMN steps in code. Nothing executes the BPMN XML. The diagram *displays* the server's state |
| Decision engine | `src/mocks/riskDecision.ts` mirrors the DMN table (hit policy FIRST). Nothing evaluates the DMN XML. Keeping the two in step is manual, and `boundaries.test.ts` checks the rule outcomes |
| Colleague edits and conflicts | The *Colleague edits* scenario changes the record on the server just before your save |
| Attachments | The file is checked and its metadata stored. The bytes are not kept, and there is no malware scanning |
| Definitions governance | *Save draft* and *Approve* only update version numbers in the mock store. Requests in flight keep their schema version |
| Client "activation" | A labelled service task in the BPMN. Nothing happens after approval |
| CI/CD, Sonar, Veracode, OpenShift | Configuration files only. They need the infrastructure listed in the README |

## Known limitations

- **One tab per request per browser.** Two browser windows on the same request behave like two editors and get a 409
  conflict. There is no cross-window coordination (BroadcastChannel).
- **Conflict resolution is whole-form.** It offers *keep mine* or *take theirs* and lists the differing fields. There is no per-field merge.
- **Form-js conversion is one-way and partial** (`toFormJsSchema.ts`). Repeatable rows, API dropdowns and hidden-value
  policies are reported as unsupported.
- **Admin editors don't validate semantics.** BPMN and DMN are saved as XML without checking that the process still matches the
  backend, and custom form schemas are checked with `validateSchema` only.
- **Search** covers the fictional client list only, with simple substring matching.
- **Internationalisation** is not implemented. Text is in English, and date-times are formatted en-GB in UTC.
- **Accessibility** has been checked by tests (roles, labels, focus, `aria-invalid`), not by a full manual audit or screen
  reader testing. The bpmn-js and dmn-js canvases have limited keyboard access, which is upstream behaviour.
- **Bundle size.** The modeller chunks are large (dmn-js about 850 kB, form-js about 700 kB, bpmn-js about 580 kB raw). They are
  lazy-loaded and never part of the main journey. The MSW chunk (about 300 kB) is a dynamic import that loads only in mock mode. A
  production build would also drop `src/mocks` from the bundle entirely, for example with a build-time flag.
- **Configuration** is build-time (`VITE_*`). DEPLOYMENT.md describes a runtime `config.json` alternative.
- **Container build** in this repo's CI file uses public base images. A regulated environment would use its approved base
  images and an internal registry mirror.
