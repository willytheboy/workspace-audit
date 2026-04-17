# Milestone 428 - Server-Side SLA Ledger Snapshot Scope Guard

## Objective

Require active project or explicit portfolio scope before Agent Execution SLA ledger snapshots can be saved to persistent governance state.

## Completed

- Guarded `POST /api/agent-work-order-runs/sla-ledger-snapshots`.
- Passed dashboard scope metadata through SLA ledger snapshot saves.
- Added server coverage for unscoped SLA ledger snapshot writes returning `agent-execution-scope-required`.
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
- Passed: local app relaunched on `http://localhost:3042` with PID `282900`.
- Passed: root smoke check returned `200`.
- Passed: unscoped SLA ledger snapshot smoke check returned `409` with `agent-execution-scope-required`.

## Result

SLA breach ledger snapshot writes now honor the same explicit-scope safety boundary as other Agent Execution ledger artifacts.
