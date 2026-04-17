# Milestone 425 - Server-Side Agent Control Plane Decision Scope Guard

## Objective

Require an explicit active project or portfolio scope before Agent Control Plane decision snapshots, decision task seeding, or decision task ledger auto-capture can mutate persisted state.

## Completed

- Guarded `POST /api/agent-control-plane/decision-snapshots` with the shared Agent Execution scope guard.
- Guarded `POST /api/agent-control-plane/decision/tasks` with the same required-scope contract.
- Passed dashboard active-scope metadata through decision snapshot, decision task seeding, and reason-specific decision task auto-capture actions.
- Added server coverage for unscoped decision snapshot and unscoped decision task requests returning `agent-execution-scope-required`.
- Added parser coverage for the server, dashboard, and test scope-guard integration.

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
- Passed: local app relaunched on `http://localhost:3042` with PID `9596`.
- Passed: root smoke check returned `200`.
- Passed: unscoped decision snapshot smoke check returned `409` with `agent-execution-scope-required`.

## Result

Agent Control Plane decision writes now follow the same intentional-scope safety boundary as CLI bridge, execution, and baseline mutations.
