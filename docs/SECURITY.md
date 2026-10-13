# Security

> The sample uses a **DEMO identity adapter** and a **simulated backend**. It does not connect to any identity
> provider and must not be deployed with real data. This document explains what the demo does and what production would do.

## Identity: demo versus production

| | Demo (`DemoIdentityAdapter.ts`) | Production (documented in `OidcIdentityAdapter.example.ts`, not wired in) |
| --- | --- | --- |
| Sign-in | Pick a fictional role. A session record goes in `sessionStorage` | OIDC Authorization Code + PKCE against ADFS (or another IdP), handled by a backend-for-frontend (BFF) |
| Tokens in the browser | None. Only a fictional user ID header (`X-Demo-User`) that the mock server reads | None. The BFF keeps tokens server-side and sets an `HttpOnly; Secure; SameSite` `__Host-` cookie |
| API identity | Demo header | Same-origin cookie plus an anti-CSRF header on state-changing calls |
| Expiry | Configurable lifetime. The Simulation panel can expire it | IdP and BFF session lifetime. The BFF returns 401 |
| Logout | Clears the demo session and app state | `POST /auth/logout` on the BFF, then the IdP end-session endpoint |

The app depends only on `IdentityAdapter`. Swapping the demo for the BFF adapter changes `src/main.tsx` and nothing else.

**Approved token handling.** Access and refresh tokens are never put in `localStorage`, `sessionStorage`, Redux, logs or
URLs. If an architecture *required* browser-held tokens (no BFF), they would stay in memory only, use short lifetimes and
rotating refresh tokens, and follow the organisation's approved pattern. That is a decision for the security team, not the frontend.

## Session expiry, redirects and logout

- `SessionManager.tsx` warns two minutes before expiry and offers to extend.
- When the session ends locally or the server returns **401** (`configureAuth({ onUnauthorized })` in `httpClient.ts`), a
  dialog explains what happened and offers sign-in again, keeping the current location as `returnTo`.
- `safeReturnTo()` accepts only same-origin relative paths (it rejects `//evil`, `https://...`, `/\\...` and `javascript:`), which
  prevents open redirects.
- Drafts already saved on the server are safe. Unsaved edits stay in the tab (demo persistence) and the user is told so.
  If a *different* user signs in after expiry, the previous user's open forms are discarded.
- Sign out asks for confirmation when there are unsaved changes, then clears auth, forms, workspace and the query cache.

## Authorization

- Permissions come from the role (`permissions.ts`). Components ask `usePermission('request:submit')` rather than
  checking role names. Navigation, buttons and routes (`RequirePermission`) hide what the role cannot do.
- **The backend enforces everything.** The mock server checks the role and ownership on every handler, and the UI handling
  is only a convenience. Simulated failures cover a 403 on a task action (shown as a clear message, with the optimistic state rolled back)
  and a direct call to an admin API by a non-admin (403, which a test covers).

## Rendering untrusted text

- Reviewer comments, client names and other user-entered text are rendered as React text (`UserText.tsx`). A test checks that
  a comment containing `<img onerror>` stays text.
- ESLint forbids `dangerouslySetInnerHTML` everywhere (a `no-restricted-syntax` rule in `eslint.config.js`).
- nginx sends a strict Content Security Policy (`script-src 'self'`, no inline scripts, `object-src 'none'`,
  `frame-ancestors 'none'`). `style-src` allows inline styles because Emotion (MUI) and bpmn-js inject styles at runtime.
  Playwright runs the whole suite against this CSP in the container image without console errors.

## Attachments

- The schema declares accepted MIME types, maximum size (5 MB in the sample) and maximum file count.
- `shared/attachments.ts` checks MIME type and extension together, rejects empty files, and sanitises the file name
  for display. The mock server re-checks type (415) and size (413).
- Production would add server-side malware scanning, content sniffing, storage outside the web root, and download by
  short-lived signed reference. None of these are simulated.

## Logging and privacy

- `shared/logger.ts` is the only logger (ESLint bans `console`). It redacts keys that look sensitive (tokens,
  passwords, tax IDs, dates of birth, contact details and **form values**), and logs correlation IDs instead of payloads.
- Server 5xx messages are not shown to users. They see a generic message plus the correlation ID.
- Demo persistence stores **fictional** data in `localStorage` only because it is a demo. Production keeps drafts on the
  server, and any client-side cache would use approved storage, scoped per user and cleared on sign-out.

## Accessible errors

- The error summary receives focus, is announced (`role="alert"`), and links each message to its field.
- Fields set `aria-invalid` and `aria-describedby` for their error and helper text, and required fields are marked in the label.
- Save failures, conflicts and session expiry are announced, and none relies on colour alone.

## Pipeline security (illustrative)

SonarQube (quality gate), Veracode SAST and SCA (policy gate), `pnpm install --frozen-lockfile`, a pinned dependency list with
`onlyBuiltDependencies` (install scripts allowed only for esbuild, @swc/core and msw), and hidden source maps (not served).
