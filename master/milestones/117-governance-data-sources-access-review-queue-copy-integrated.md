# 117 - Governance Data Sources Access Review Queue Copy Integrated

Status: Complete.

## Scope

- Add a Governance toolbar action for copying the current filtered Data Sources Access Review Queue.
- Add a command-palette action for the same non-secret source-access handoff.
- Export visible queue items with current Governance search/scope filters, access method, source status, validation action, and credential hints.

## Validation

- `node --check .\app.js`
- `node --check .\ui\dashboard-actions.js`
- `node --check .\ui\dashboard-views.js`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`

## Live Check

- Relaunched app on port `3042` with PID `214408`.
- Served HTML contains `copy-governance-source-access-queue-btn`.
- Served command registry contains `copy-governance-data-sources-access-review-queue`.
- Served Governance view module contains `Governance Data Sources Access Review Queue`.
- Live Governance Data Sources queue items: `1`.
- Live Governance Data Sources queue total: `1`.
