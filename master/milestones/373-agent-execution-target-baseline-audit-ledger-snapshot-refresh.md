# Milestone 373 - Agent Execution Target Baseline Audit Ledger Snapshot Refresh

## Objective

Allow operators to accept live Agent Execution target-baseline audit state as a refreshed snapshot after drift review, preserving no-secret operation evidence.

## Completed

- Added `createAgentExecutionTargetBaselineAuditLedgerSnapshotRecord` to share snapshot creation logic.
- Added `POST /api/agent-work-order-runs/target-baseline-audit-ledger-snapshots/refresh`.
- Reuses the selected snapshot's `stateFilter` and `limit` by default.
- Records `agent-execution-target-baseline-audit-ledger-snapshot-refreshed` Governance operations.
- Added dashboard API, per-snapshot `Refresh Snapshot` controls, and command-palette action support.
- Added parser and server test coverage.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-actions.js`
- `node --check app.js`
- `node --check tests\server.test.mjs`
- `node --check test-parse.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

- Relaunched local app on PID `258388`.
- Root smoke check returned `200`.
- Target-baseline audit ledger smoke returned `state=review`, `total=2`, and `review=2`.
- Snapshot list smoke returned `count=1`.
