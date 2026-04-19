# Milestone 480 - Regression Alert Baseline Drift Task Ledger Visibility

## Goal

Ensure Regression Alert baseline snapshot drift tasks are visible after they are created, instead of being hidden in the generic task store.

## Scope

- [x] Add Governance payload grouping for `agent-execution-regression-alert-baseline` drift tasks.
- [x] Add summary counts for total, open, and closed alert-baseline drift tasks.
- [x] Add a dedicated Governance section with resolve, reopen, and block controls.
- [x] Add parser coverage for the backend payload, types, and UI ledger section.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-types.js`
- `node --check test-parse.js`
- `node test-parse.js`
- `git diff --check`
- `npm test`
- `npm run build:vercel`
- Local smoke: `root=200`, `driftTaskLedger=True`, `driftTasks=0/1`, `visible=1`, `mutation=0/110`

## Status

Completed.
