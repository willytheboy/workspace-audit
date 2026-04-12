# 149 - Data Sources Access Validation Evidence Task Sync Response Integrated

Status: Complete.

## Scope

- Return task-sync metadata from `POST /api/sources/access-validation-evidence`.
- Include synced coverage task IDs in the response for external clients and supervised agents.
- Use the sync count as immediate Governance evidence-capture feedback.
- Extend server tests and parser checks for the response contract.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-api.js`
- `node --check .\ui\dashboard-views.js`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `node .\test-parse.js`
- `npm test`
- `node .\generate-audit.mjs`

## Live Check

- Relaunched with `npm run dev` on `http://localhost:3042`.
- Dev server shell PID: `198256`.
- Home page returned HTTP 200.
- Served `ui/dashboard-views.js` includes `result.taskSync?.updated`.
- Served `ui/dashboard-api.js` includes the `taskSync` response contract.
