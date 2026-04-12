# 145 - Governance Data Sources Access Validation Evidence Coverage Task Seeding UI Integrated

Status: Complete.

## Scope

- Add Governance toolbar support for seeding Data Sources evidence coverage tasks.
- Add command-palette support and app wrappers for evidence coverage task seeding.
- Add parser checks, documentation, validation, and live relaunch tracking.

## Validation

- `node --check .\app.js`
- `node --check .\ui\dashboard-views.js`
- `node --check .\ui\dashboard-actions.js`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`

## Live Check

- Relaunched with `npm run dev` on `http://localhost:3042`.
- Dev server shell PID: `39172`.
- Home page returned HTTP 200.
- Served shell includes `seed-governance-source-evidence-coverage-tasks-btn`.
- Governance payload reports 2 Data Sources access validation evidence coverage items and 2 missing coverage gaps.
