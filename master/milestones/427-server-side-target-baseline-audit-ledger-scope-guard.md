# Milestone 427 - Server-Side Target Baseline Audit Ledger Scope Guard

## Objective

Require active project or explicit portfolio scope before Agent Execution target-baseline audit ledger snapshots, refreshes, or drift checkpoints can mutate persisted state.

## Completed

- Guarded `POST /api/agent-work-order-runs/target-baseline-audit-ledger-snapshots`.
- Guarded `POST /api/agent-work-order-runs/target-baseline-audit-ledger-snapshots/refresh`.
- Guarded `POST /api/agent-work-order-runs/target-baseline-audit-ledger-snapshot-drift-checkpoints`.
- Passed dashboard scope metadata through target-baseline audit snapshot, refresh, and checkpoint actions.
- Added server coverage for unscoped snapshot creation, refresh, and drift checkpoint attempts returning `agent-execution-scope-required`.
- Added parser coverage for the guarded server, dashboard, and test paths.

## Validation

- Passed: `node --check lib\workspace-audit-server.mjs`
- Passed: `node --check ui\dashboard-api.js`
- Passed: `node --check ui\dashboard-views.js`
- Passed: `node --check tests\server.test.mjs`
- Passed: `node --check test-parse.js`
- Passed: `node test-parse.js`
- Passed: `npm test`
- Passed: `npm run build:vercel`
- Passed: `git diff --check`
- Passed: local app relaunched on `http://localhost:3042` with PID `284024`.
- Passed: root smoke check returned `200`.
- Passed: unscoped target-baseline audit ledger snapshot smoke check returned `409` with `agent-execution-scope-required`.

## Result

Target-baseline audit ledger writes now honor the same scope contract as Agent Execution, CLI bridge, and control-plane mutation paths.
