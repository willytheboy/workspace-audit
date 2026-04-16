# Milestone 369 - Agent Execution Target Baseline Audit Ledger

## Objective

Make Agent Work Order run target-baseline health operationally visible as a no-secret audit ledger that can be copied into Codex CLI, Claude CLI, or operator review workflows before unattended build execution.

## Completed

- Added `GET /api/agent-work-order-runs/target-baseline-audit-ledger` with `all`, `review`, `missing`, `healthy`, `stale`, and `drift` state filters.
- Built ledger rows from all active persisted Agent Work Order runs, not only the 24-card Governance focus list.
- Added Markdown output with run ID, project ID, status, readiness, baseline capture evidence, health, freshness, drift, and recommended action.
- Added dashboard API, Governance action card copy controls, command-palette action, and Governance report evidence.
- Added parser and server coverage for the new ledger.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-actions.js`
- `node --check app.js`
- `node --check ui\dashboard-types.js`
- `node --check tests\server.test.mjs`
- `node --check test-parse.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

- Relaunched local app on PID `6928`.
- Smoke checked `/` with HTTP `200`.
- Smoke checked `/api/agent-work-order-runs/target-baseline-audit-ledger?state=review&limit=5` with `state=review`, `total=2`, and `review=2`.
