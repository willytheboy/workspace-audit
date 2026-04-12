# Milestone 033: Governance Agent Sessions Integrated

Status: Completed

## Completed Scope

- Promoted persisted Agent Sessions into the Governance API snapshot and summary counts.
- Added Agent Sessions to the Governance KPI grid, deck cards, scope filter, copied summary, and markdown report.
- Added API and parser coverage so the portfolio layer verifies Agent Session visibility.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-components.js`
- `node --check .\ui\dashboard-views.js`
- `node --check .\ui\dashboard-types.js`
- `node --check .\test-parse.js`
- `node --check .\tests\server.test.mjs`
- `npm test`
- `node .\generate-audit.mjs`
- `node .\test-parse.js`
