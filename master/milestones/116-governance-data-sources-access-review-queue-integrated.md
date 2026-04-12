# 116 - Governance Data Sources Access Review Queue Integrated

Status: Complete.

## Scope

- Add Data Sources Access Review Queue evidence to the Governance payload and summary metrics.
- Surface queue count, blocked items, and priority split in Governance KPIs and reports.
- Render source-access review items as a searchable Governance deck section with access method, validation action, and non-secret credential hints.
- Add a dedicated Governance `data-sources` scope for focused source-access review.

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

## Live Check

- Relaunched app on port `3042` with PID `212012`.
- Live Governance queue total is `1`.
- Live Governance queue review count is `1`.
- Live Governance queue blocked count is `0`.
- Live Governance queue medium-priority count is `1`.
- Live Agent Control Plane decision queue count is `1`.
- Live Governance summary queue count is `1`.
- Served UI bundle contains `Data Sources Access Review Queue`.
