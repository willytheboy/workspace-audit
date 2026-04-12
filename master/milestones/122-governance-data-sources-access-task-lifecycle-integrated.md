# 122 - Governance Data Sources Access Task Lifecycle Integrated

Status: Complete.

## Scope

- Add Resolve, Reopen, and Block lifecycle controls to Data Sources access task ledger cards.
- Bind lifecycle controls to the existing task update API while preserving task descriptions and source-access evidence.
- Verify Governance task ledger counts update when a source-access task is resolved.

## Validation

- `node --check .\ui\dashboard-components.js`
- `node --check .\ui\dashboard-views.js`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`

## Live Check

- Relaunched app on port `3042` from dev shell PID `204688`.
- Live app smoke check:
  - Home page status: `200`
  - Live Data Sources access tasks: `0`
  - Resolve control present: `true`
  - Reopen control present: `true`
  - Block control present: `true`
  - Lifecycle binding present: `true`
