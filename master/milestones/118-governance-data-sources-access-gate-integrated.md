# 118 - Governance Data Sources Access Gate Integrated

Status: Complete.

## Scope

- Add Data Sources access gate evidence to the Governance payload and summary metrics.
- Surface source gate decision/rank and ready/review/blocked counts in Governance baseline drift fields.
- Render the Data Sources access gate as a KPI and searchable Governance deck section under the `data-sources` scope.
- Add Data Sources access gate details to Governance summaries and reports.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-components.js`
- `node --check .\ui\dashboard-views.js`
- `node --check .\ui\dashboard-types.js`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`
- Fixed Agent Control Plane route sequencing so Governance snapshots include source-access gate summary before baselines/diffs are created.

## Live Check

- Relaunched app on port `3042` with PID `164684`.
- Live Governance API check:
  - Gate decision: `review`
  - Gate rank: `2`
  - Gate ready/review/blocked: `1 / 1 / 0`
  - Access review queue total: `1`
  - UI gate deck present: `true`
  - Governance report gate section present: `true`
