# Milestone 429 - Server-Side Agent Work Order Snapshot Scope Guard

## Objective

Require active project or explicit portfolio scope before Agent Work Order snapshots can be saved to persistent governance state.

## Completed

- Guarded `POST /api/agent-work-order-snapshots`.
- Passed dashboard scope metadata through Agent Work Order snapshot save and copy workflows.
- Added server coverage for unscoped work-order snapshot writes returning `agent-execution-scope-required`.
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
- Passed: local app relaunched on `http://localhost:3042` with PID `279580`.
- Passed: root smoke check returned `200`.
- Passed: unscoped Agent Work Order snapshot smoke check returned `409` with `agent-execution-scope-required`.

## Result

Agent Work Order snapshot writes now honor the same explicit-scope boundary as execution ledgers and control-plane artifacts.
