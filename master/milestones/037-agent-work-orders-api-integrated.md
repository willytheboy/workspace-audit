# Milestone 037: Agent Work Orders API Integrated

Status: Completed

## Completed Scope

- Added `/api/agent-work-orders` to expose readiness-derived work orders as JSON plus markdown.
- Added a typed dashboard API client method for work-order retrieval.
- Added server, parser, README, and TODO coverage for the work-order API.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-api.js`
- `node --check .\ui\dashboard-types.js`
- `node --check .\test-parse.js`
- `node --check .\tests\server.test.mjs`
- `npm test`
- `node .\generate-audit.mjs`
- `node .\test-parse.js`
