# Milestone 352 - Governance Profile Test And Runtime Targets

## Status

Completed.

## Goal

Turn scan findings about missing tests and runtime surfaces into concrete Governance profile targets that can guide supervised build work.

## Delivered

- Added scan-derived `scanBaseline`, `testCoverageTarget`, and `runtimeTarget` metadata to bootstrapped Governance profiles.
- Added `/api/governance/profile-targets/refresh` to refresh target metadata for scoped app-development profiles.
- Added a Governance toolbar and command palette action to refresh profile targets.
- Added Profile Target KPIs and a Governance Profile Targets deck showing current tests, target tests, missing tests, runtime status, and recommended action.
- Added parser checks and server coverage for target refresh behavior.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check app.js`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-actions.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-types.js`
- `node --check test-parse.js`
- `node --check tests\governance-bootstrap.test.mjs`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`
- Relaunched local app on port `3042` with PID `96024`
- Live smoke: `/` returned `200`
- Live target refresh: `/api/governance/profile-targets/refresh` refreshed `8` scoped app-development profiles and skipped `7` non-target profiles.
- Live governance summary: profile target coverage is `8` scoped targets, `1` met, `6` missing, `1` needs growth, `0` runtime gaps, and `61` target test files outstanding.
