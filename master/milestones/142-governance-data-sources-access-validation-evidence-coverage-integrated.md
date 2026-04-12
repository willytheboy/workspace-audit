# 142 - Governance Data Sources Access Validation Evidence Coverage Integrated

Status: Complete.

## Scope

- Add Data Sources access validation evidence coverage to Governance payloads and summary metrics.
- Surface coverage gaps in Governance KPI cards, deck sections, summaries, and reports.
- Add tests, parser checks, documentation, validation, and live relaunch tracking.

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

- Relaunched dev server on `http://localhost:3042` with shell PID `159088`.
- Home page returned HTTP `200`.
- `/api/governance` returned Data Sources evidence coverage summary fields and `dataSourcesAccessValidationEvidenceCoverage.items`.
- Live persisted workspace reported `2` coverage items, `0` covered, `2` missing, `1` high-priority gap, and `0%` evidence coverage.
- Static HTML does not include the coverage deck title because Governance deck sections are client-rendered from the API payload.
