# Milestone 058: Execution Run Retention Controls Integrated

Status: Completed

## Completed Scope

- Added a Completed execution-status filter that groups passed, failed, and cancelled Agent Execution runs.
- Added a configurable Governance retention selector for keeping the most recent completed runs.
- Added an Apply Retention toolbar and command-palette action that archives older visible completed runs without deleting history.
- Added `POST /api/agent-work-order-runs/retention` for auditable retention operations.
- Added parser, README, TODO, and API-test coverage.

## Validation

- `node --check .\app.js`
- `node --check .\ui\dashboard-actions.js`
- `node --check .\ui\dashboard-api.js`
- `node --check .\ui\dashboard-views.js`
- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `npm test`
- `node .\generate-audit.mjs`
- `node .\test-parse.js`
