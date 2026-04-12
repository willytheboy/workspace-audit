# 148 - Data Sources Access Validation Evidence Task Sync Visibility Integrated

Status: Complete.

## Scope

- Surface evidence-sync status in Data Sources access task ledger markdown.
- Preserve coverage task identifiers and evidence sync metadata in the ledger API projection.
- Render evidence-sync status in Governance task cards so resolved evidence tasks explain why they changed.
- Extend the isolated server test to assert ledger visibility.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-components.js`
- `node --check .\ui\dashboard-types.js`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `node .\test-parse.js`
- `npm test`
- `node .\generate-audit.mjs`

## Live Check

- Relaunched with `npm run dev` on `http://localhost:3042`.
- Dev server shell PID: `220420`.
- Home page returned HTTP 200.
- Served `ui/dashboard-components.js` includes `Evidence sync:`.
- Data Sources access task ledger API reports 2 live task records.
