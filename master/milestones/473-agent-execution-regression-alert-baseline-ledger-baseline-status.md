# Milestone 473 - Agent Execution Regression Alert Baseline Ledger Baseline Status

## Goal

Promote the latest Regression Alert baseline ledger snapshot into a visible baseline status gate with freshness, drift health, checkpoint coverage, and non-secret copyable evidence.

## Scope

- [x] Add computed server-side baseline status for Regression Alert baseline ledger snapshots.
- [x] Include freshness, drift score, drift severity, checkpoint coverage, health, and recommended action.
- [x] Expose a baseline-status API helper and command palette action.
- [x] Surface the status card and copy control in Governance and copied Governance Markdown.
- [x] Add parser and server-test coverage for the status endpoint and Governance wiring.
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
- Local smoke: root `200`, Regression Alert baseline status `healthy/fresh/0`, Governance summary `healthy`, mutation scope `0/109`.

## Status

Completed.
