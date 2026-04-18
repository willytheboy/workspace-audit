# Milestone 469 - Agent Execution Regression Alert Baseline Ledger

## Goal

Create a copyable, no-secret Agent Execution ledger that turns run-level Regression Alert baseline evidence into actionable review material before unattended CLI work.

## Scope

- [x] Add a server-side Regression Alert baseline ledger with review, missing, healthy, stale, drift, hold, and all-state filters.
- [x] Include capture health, freshness, drift score, refresh-gate decision, uncheckpointed drift, escalated checkpoints, and recommended action per run.
- [x] Expose the ledger through a dashboard API helper, Governance copy controls, and command palette action.
- [x] Add parser and server-test coverage for the endpoint and UI wiring.
- [x] Validate syntax, parser sentinels, full tests, Vercel build, and local relaunch.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-actions.js`
- `node --check ui\dashboard-types.js`
- `node --check app.js`
- `node --check test-parse.js`
- `node --check tests\server.test.mjs`
- `node test-parse.js`
- `git diff --check`
- `npm test`
- `npm run build:vercel`
- Local smoke: root `200`, mutation scope `0/107`, Governance alert-baseline metrics loaded, Regression Alert baseline ledger `2 review / 2 missing / 0 hold`.

## Status

Completed.
