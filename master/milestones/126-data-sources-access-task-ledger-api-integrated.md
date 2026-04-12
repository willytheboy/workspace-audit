# 126 - Data Sources Access Task Ledger API Integrated

Status: Complete.

## Scope

- Add a server-side non-secret Data Sources access task ledger payload and markdown builder.
- Add `GET /api/sources/access-task-ledger` for external app-management and agent-control consumers.
- Support `all`, `open`, and `closed` status filters with bounded result limits.
- Keep descriptions and credential material out of the response shape.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-api.js`
- `node --check .\ui\dashboard-types.js`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`

## Live Check

- Relaunched dev server on `http://localhost:3042` with shell PID `167700`.
- Live smoke check returned HTTP `200`.
- `GET /api/sources/access-task-ledger?status=all` returned status `all`.
- Live Data Sources access task counts were `0` total, `0` open, and `0` closed.
- Response markdown includes `# Data Sources Access Task Ledger`.
- Response secret policy includes `Non-secret metadata only`.
