# Milestone 471 - Agent Execution Regression Alert Baseline Ledger Snapshot Drift

## Goal

Compare saved Regression Alert baseline ledger snapshots with the current live Agent Execution alert-baseline ledger so operators can detect stale or changed saved evidence before reusing it.

## Scope

- [x] Add server-side live-vs-snapshot drift comparison for Regression Alert baseline ledger snapshots.
- [x] Include summary drift, added runs, removed runs, changed run fields, severity, score, and recommended action.
- [x] Expose per-snapshot drift through a dashboard API helper and command palette action.
- [x] Surface copyable drift controls on saved alert-baseline ledger snapshots.
- [x] Add parser and server-test coverage for clean drift detection.
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
- Local smoke: root `200`, mutation scope `0/108`, latest Regression Alert baseline snapshot drift `none / 0`.

## Status

Completed.
