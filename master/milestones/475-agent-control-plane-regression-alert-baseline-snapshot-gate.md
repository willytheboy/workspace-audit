# Milestone 475 - Agent Control Plane Regression Alert Baseline Snapshot Gate

## Goal

Make the accepted Agent Execution Regression Alert baseline ledger snapshot a first-class readiness gate before autonomous build work continues.

## Scope

- [x] Feed Regression Alert baseline ledger snapshot status into Agent Control Plane decisions.
- [x] Add missing, stale, drift-review, and drifted decision reasons for alert snapshot baselines.
- [x] Surface alert snapshot baseline health in the Control Plane decision card, copied Markdown, and CLI bridge context.
- [x] Add parser and server-test coverage for the snapshot baseline gate.
- [x] Validate syntax, parser sentinels, full tests, Vercel build, and local relaunch.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-types.js`
- `node --check test-parse.js`
- `node --check tests\server.test.mjs`
- `node test-parse.js`
- `git diff --check`
- `npm test`
- `npm run build:vercel`
- Local smoke: root `200`, decision `hold`, alert snapshot baseline `healthy/fresh/0`, Control Plane status `healthy/fresh`, mutation scope `0/110`.

## Status

Completed.
