# Veracode (illustrative)

Requires a Veracode account, an application profile and API credentials (`VERACODE_API_KEY_ID`,
`VERACODE_API_KEY_SECRET`) injected by CI. None of these are part of this sample.

- **Static analysis (SAST):** `package-for-scan.mjs` zips `src/` (TypeScript), `package.json` and the lockfile,
  following Veracode's JavaScript packaging guidance (no `node_modules`, no tests, no mocks).
  The Jenkins `Veracode static scan` stage uploads it with the Veracode CLI.
- **Software composition analysis (SCA):** `veracode.yml` configures an agent-based scan of `pnpm-lock.yaml`.
- **Policy:** the build fails on any finding that violates the "Client Engagement Policy"
  (for example Very High or High severity). Mitigations are proposed and approved in the Veracode platform,
  not by editing this repository.
