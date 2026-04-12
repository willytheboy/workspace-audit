# 128 - Governance Data Sources Access Task Ledger Snapshot UI Integrated

Status: Complete.

## Scope

- Add Data Sources access task ledger snapshots to Governance payloads, summaries, reports, and deck sections.
- Add a Governance toolbar action for saving Data Sources access task ledger snapshots.
- Add a command-palette action for the same snapshot workflow.
- Add copy controls for persisted source-access task ledger snapshot cards.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-components.js`
- `node --check .\ui\dashboard-views.js`
- `node --check .\ui\dashboard-actions.js`
- `node --check .\ui\dashboard-types.js`
- `node --check .\app.js`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`

## Live Check

- Relaunched dev server on `http://localhost:3042` with shell PID `213200`.
- Live smoke check returned HTTP `200`.
- Served HTML includes `save-source-access-task-ledger-snapshot-btn`.
- Governance API summary returned `0` Data Sources access task ledger snapshots in the current live state.
- Served `ui/dashboard-components.js` includes `Data Sources Access Task Ledger Snapshots` and `source-access-task-ledger-snapshot-copy-btn`.
