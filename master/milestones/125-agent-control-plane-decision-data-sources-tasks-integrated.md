# 125 - Agent Control Plane Decision Data Sources Tasks Integrated

Status: Complete.

## Scope

- Add Data Sources access task totals/open/closed counts to the direct Agent Control Plane decision payload and snapshots.
- Add a bounded non-secret Data Sources access task section to decision markdown.
- Add a review decision reason when source-access Governance tasks remain open.
- Surface source-access task pressure in the Control Plane Decision deck and reports.

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

- Relaunched dev server on `http://localhost:3042` with shell PID `174232`.
- Live smoke check returned HTTP `200`.
- Direct Agent Control Plane decision returned `hold`.
- Decision markdown includes `Data Sources access tasks:` and `## Data Sources Access Tasks`.
- Live Data Sources access task counts were `0` total, `0` open, and `0` closed.
