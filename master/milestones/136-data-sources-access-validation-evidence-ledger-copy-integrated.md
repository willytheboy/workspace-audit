# 136 - Data Sources Access Validation Evidence Ledger Copy Integrated

Status: Complete.

## Scope

- Add Sources and Governance toolbar actions for copying the non-secret Data Sources access validation evidence ledger.
- Add command-palette actions for copying the same evidence handoff from Sources and Governance.
- Add parser checks, documentation, validation, and live relaunch notes.

## Validation

- `node --check .\ui\dashboard-actions.js`
- `node --check .\ui\dashboard-views.js`
- `node --check .\app.js`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`

## Live Check

- Relaunched on `http://localhost:3042` with dev shell PID `206688`.
- Home page smoke check returned `200`.
- Data Sources access validation evidence API returned markdown headed `# Data Sources Access Validation Evidence Ledger`.
- Home page contained both `copy-sources-access-validation-evidence-btn` and `copy-governance-source-access-validation-evidence-btn`.
