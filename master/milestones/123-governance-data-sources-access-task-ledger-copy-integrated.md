# 123 - Governance Data Sources Access Task Ledger Copy Integrated

Status: Complete.

## Scope

- Add a Governance toolbar action for copying the filtered Data Sources access task ledger.
- Add command-palette support for the same non-secret source-access task ledger handoff.
- Include task status, priority, source label, access method, source review id, and first-line task detail in the copied markdown.

## Validation

- `node --check .\ui\dashboard-views.js`
- `node --check .\ui\dashboard-actions.js`
- `node --check .\app.js`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`

## Live Check

- Relaunched app on port `3042` from dev shell PID `214944`.
- Live app smoke check:
  - Home page status: `200`
  - Governance Copy Source Task Ledger button present: `true`
  - Command-palette action present: `true`
  - Markdown builder present: `true`
  - Copy handler present: `true`
