# 131 - Governance Data Sources Access Task Ledger Snapshot Drift Copy Integrated

Status: Complete.

## Scope

- Add a Governance toolbar action for copying latest Data Sources access task ledger snapshot drift.
- Add a command-palette action for the same non-secret drift handoff.
- Reuse `GET /api/sources/access-task-ledger-snapshots/diff?snapshotId=latest`.

## Validation

- `node --check .\ui\dashboard-views.js`
- `node --check .\ui\dashboard-actions.js`
- `node --check .\app.js`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`

## Live Check

- Relaunched dev server on `http://localhost:3042` with shell PID `207952`.
- Live smoke check returned HTTP `200`.
- Served HTML includes `copy-source-access-task-ledger-drift-btn`.
- Served `app.js` includes `copyLatestDataSourcesAccessTaskLedgerSnapshotDrift`.
