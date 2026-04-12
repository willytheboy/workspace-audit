# 132 - Data Sources Access Validation Runbook Integrated

Status: Complete.

## Scope

- Add a non-secret access validation runbook payload and markdown builder grouped by access method.
- Add `GET /api/sources/access-validation-runbook`.
- Add Sources toolbar and command-palette copy actions.
- Include safe operator-side command hints without storing or exposing secrets.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-api.js`
- `node --check .\ui\dashboard-types.js`
- `node --check .\ui\dashboard-views.js`
- `node --check .\ui\dashboard-actions.js`
- `node --check .\app.js`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`

## Live Check

- Relaunched on `http://localhost:3042` with dev shell PID `188856`.
- Home page smoke check returned `200`.
- `GET /api/sources/access-validation-runbook` returned `2` methods across `2` sources.
- Runbook markdown and Sources toolbar button were present in the live smoke check.
