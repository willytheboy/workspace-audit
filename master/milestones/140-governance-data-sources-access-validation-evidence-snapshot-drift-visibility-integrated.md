# 140 - Governance Data Sources Access Validation Evidence Snapshot Drift Visibility Integrated

Status: Complete.

## Scope

- Add latest Data Sources access validation evidence snapshot drift to Governance payloads.
- Surface the drift state in Governance KPI cards, deck sections, summaries, and reports.
- Add tests, parser checks, documentation, validation, and live relaunch notes.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-views.js`
- `node --check .\ui\dashboard-components.js`
- `node --check .\ui\dashboard-types.js`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`

## Live Check

- Relaunched dev server on `http://localhost:3042` with shell PID `188260`.
- Home page returned HTTP `200`.
- `/api/governance` returned `dataSourceAccessValidationEvidenceSnapshotDiff`.
- Live persisted workspace reported `dataSourceAccessValidationEvidenceSnapshotDriftSeverity: missing-snapshot`, `dataSourceAccessValidationEvidenceSnapshotDriftScore: 0`, and `dataSourceAccessValidationEvidenceSnapshotHasDrift: false`.
- Template includes the evidence drift toolbar action.
