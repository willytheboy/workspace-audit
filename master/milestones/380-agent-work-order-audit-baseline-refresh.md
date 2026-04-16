# Milestone 380 - Agent Work Order Audit Baseline Refresh

## Objective

Allow existing Agent Work Order runs to recapture the current target-baseline audit snapshot baseline without creating duplicate runs or losing execution history.

## Implementation

- Added `POST /api/agent-work-order-runs/:runId/target-baseline-audit-refresh`.
- Reused the run-level audit-baseline capture helper so refreshed runs store the latest audit health, freshness, drift, snapshot id, and uncheckpointed drift count.
- Added Governance operation evidence with previous and refreshed audit-baseline health.
- Added a `Refresh Audit` button on Agent Execution Queue cards whenever audit-baseline capture is missing, stale, drifted, or uncheckpointed.
- Wired the dashboard API and event handler for the new refresh action.
- Added parser and server test coverage for the audit refresh endpoint and UI wiring.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check tests\server.test.mjs`
- `node --check test-parse.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

- Relaunched local app on port `3042`.
- Smoke check: `/` returned `200`.
- Smoke check: `/api/governance` returned successfully with `2` Agent Work Order run(s).
- Smoke check: `/api/agent-work-order-runs/nonexistent-run/target-baseline-audit-refresh` returned a controlled `400` with `Agent Work Order run not found`, confirming the route is active without mutating live data.
