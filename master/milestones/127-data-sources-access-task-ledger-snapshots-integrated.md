# 127 - Data Sources Access Task Ledger Snapshots Integrated

Status: Complete.

## Scope

- Add persisted store support for Data Sources access task ledger snapshots.
- Add `GET` and `POST /api/sources/access-task-ledger-snapshots`.
- Preserve bounded non-secret markdown handoffs after live source-access task state changes.
- Record Governance operation-log evidence when snapshots are created.

## Validation

- `node --check .\lib\workspace-audit-store.mjs`
- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-api.js`
- `node --check .\ui\dashboard-types.js`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`

## Live Check

- Relaunched dev server on `http://localhost:3042` with shell PID `118016`.
- Live smoke check returned HTTP `200`.
- `GET /api/sources/access-task-ledger-snapshots` returned an array.
- Live snapshot count was `0`.
