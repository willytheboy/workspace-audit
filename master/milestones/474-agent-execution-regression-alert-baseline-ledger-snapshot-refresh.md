# Milestone 474 - Agent Execution Regression Alert Baseline Ledger Snapshot Refresh

## Goal

Allow reviewed Regression Alert baseline ledger state to be accepted as a fresh snapshot after checkpointing or confirming drift.

## Scope

- [x] Add a scope-guarded server endpoint for refreshing Regression Alert baseline ledger snapshots.
- [x] Persist refreshed snapshots and record the refresh in the Governance operation log.
- [x] Add dashboard API, per-snapshot UI, and command palette refresh controls.
- [x] Add parser and server-test coverage for scoped and unscoped refresh paths.
- [x] Validate syntax, parser sentinels, full tests, Vercel build, and local relaunch.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-actions.js`
- `node --check app.js`
- `node --check test-parse.js`
- `node --check tests\server.test.mjs`
- `node test-parse.js`
- `git diff --check`
- `npm test`
- `npm run build:vercel`
- Local smoke: root `200`, refresh `true/2`, baseline status `healthy/fresh`, mutation scope `0/110`.

## Status

Completed.
