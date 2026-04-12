# 130 - Data Sources Access Task Ledger Snapshot Drift API Integrated

Status: Complete.

## Scope

- Add a Data Sources access task ledger snapshot drift payload and markdown builder.
- Add `GET /api/sources/access-task-ledger-snapshots/diff` with latest and specific snapshot support.
- Compare total/open/closed counts and per-task status, priority, and access method drift.
- Keep drift responses non-secret and bounded to task metadata.

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

- Relaunched dev server on `http://localhost:3042` with shell PID `140596`.
- Live smoke check returned HTTP `200`.
- `GET /api/sources/access-task-ledger-snapshots/diff?snapshotId=latest` returned `missing-snapshot` because the current live store has no saved ledger snapshots.
- Response markdown includes `# Data Sources Access Task Ledger Snapshot Drift`.
