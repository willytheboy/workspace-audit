# Milestone 470 - Agent Execution Regression Alert Baseline Ledger Snapshots

## Goal

Persist Regression Alert baseline ledger snapshots so alert-baseline execution evidence can be saved, copied, and reused as audit handoff material across build cycles.

## Scope

- [x] Add a scope-guarded API for saving and listing Regression Alert baseline ledger snapshots.
- [x] Persist run-level alert-baseline health, drift, refresh-gate, and escalated-checkpoint counts in snapshot records.
- [x] Surface snapshot save and copy controls in Governance.
- [x] Include saved snapshots in Governance focus, summary, recent activity, and copied Governance Markdown.
- [x] Add parser and server-test coverage for the snapshot flow.
- [x] Validate syntax, parser sentinels, full tests, Vercel build, and local relaunch.

## Validation

- `node --check lib\workspace-audit-store.mjs`
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
- Local smoke: root `200`, mutation scope `0/108`, created Regression Alert baseline ledger snapshot `2 review`, Governance snapshot count `1`.

## Status

Completed.
