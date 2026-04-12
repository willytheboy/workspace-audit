# 121 - Governance Data Sources Access Task Ledger Integrated

Status: Complete.

## Scope

- Add Data Sources access task metrics to the Governance summary.
- Add a filtered Data Sources access task ledger to the Governance payload.
- Render source-access tasks in the Governance control-center deck, text summary, and markdown report.

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

- Relaunched app on port `3042` from dev shell PID `214080`.
- Live app smoke check:
  - Home page status: `200`
  - Data Sources access tasks: `0`
  - Data Sources open access tasks: `0`
  - Ledger payload count: `0`
  - Governance deck ledger present: `true`
  - Governance report ledger present: `true`
