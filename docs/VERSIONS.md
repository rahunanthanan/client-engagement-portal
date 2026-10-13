# Package versions

Every dependency is pinned to an exact version in `package.json` and locked in `pnpm-lock.yaml`.
They were checked against the npm registry on 2026-10-13 and verified together: install, typecheck, lint, 78 Jest tests,
production build and 7 Playwright tests.

| Package | Version | Note |
| --- | --- | --- |
| react, react-dom | 19.3.0 | |
| typescript | 5.9.3 | **Not 7.x.** typescript-eslint 8 declares a peer range of `<6.1`, so TypeScript 7 fails peer checks |
| vite | 7.3.7 | A newer major (8) exists. This sample stays on the widely adopted 7.x line (see policy below) |
| @vitejs/plugin-react | 5.2.0 | Matches Vite 7 |
| @reduxjs/toolkit / react-redux | 2.13.0 / 9.3.0 | |
| @tanstack/react-query | 5.104.2 | |
| react-router | 7.18.4 | Data router (`createBrowserRouter`, `useBlocker`). A newer major exists |
| @mui/material, @mui/icons-material | 7.3.11 | A newer major exists. 7.x supports React 19 |
| @emotion/react / styled | 11.14.0 / 11.14.1 | MUI peer dependencies |
| bpmn-js | 18.31.0 | |
| dmn-js | 17.12.3 | |
| @bpmn-io/form-js | 2.1.1 | |
| preact | 10.29.8 | 10.x is the established line |
| jest, jest-environment-jsdom | 30.5.2 | |
| jest-fixed-jsdom | 0.0.11 | Makes `fetch` and streams behave in jsdom for MSW |
| @swc/jest, @swc/core | 0.2.39, 1.16.18 | Fast TS/TSX transform for Jest |
| @testing-library/react / dom / jest-dom / user-event | 16.3.3 / 10.4.2 / 6.10.0 / 14.6.8 | |
| msw | 2.15.0 | A newer major exists. 2.x is the established line |
| @playwright/test | 1.64.0 | |
| eslint / @eslint/js | 9.39.5 | Flat config |
| typescript-eslint | 8.71.2 | |
| eslint-plugin-react-hooks / react-refresh | 7.1.1 / 0.5.7 | |
| sass | 1.105.1 | |
| jest-junit | 16.0.0 | JUnit output for Jenkins |
| pnpm | 10.28.0 | `packageManager` field (corepack) |
| Node | 22.12 or later (tested on 22.22) | |

Why not every latest major: in a sample that must build reliably, a major released only weeks earlier adds risk (plugins and peer ranges catch up later) without adding anything the requirements need.

Upgrade policy: one major at a time, on a branch, with the full `pnpm ci && pnpm test:e2e` run. Renovate or Dependabot
would raise these updates automatically.
