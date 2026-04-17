# Milestone 426 - Server-Side Agent Control Plane Decision Task Ledger Snapshot Scope Guard

## Objective

Close the remaining direct-write gap around Agent Control Plane decision task-ledger snapshot persistence so snapshot baselines require an intentional active project or portfolio scope.

## Completed

- Guarded `POST /api/agent-control-plane/decision/task-ledger-snapshots` with the shared Agent Execution scope guard.
- Passed dashboard active-scope metadata through decision task-ledger snapshot saves.
- Added server regression coverage for unscoped decision task-ledger snapshot writes returning `agent-execution-scope-required`.
- Added parser coverage for the server, dashboard, and test guard path.

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
- Passed: local app relaunched on `http://localhost:3042` with PID `285268`.
- Passed: root smoke check returned `200`.
- Passed: unscoped decision task-ledger snapshot smoke check returned `409` with `agent-execution-scope-required`.

## Result

Agent Control Plane decision task-ledger snapshots now use the same scope boundary as decision snapshots, task seeding, and control-plane baselines.
