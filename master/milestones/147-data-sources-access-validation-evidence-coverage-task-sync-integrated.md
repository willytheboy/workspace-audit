# 147 - Data Sources Access Validation Evidence Coverage Task Sync Integrated

Status: Complete.

## Scope

- Sync related Data Sources evidence-coverage tasks when non-secret access validation evidence is recorded.
- Resolve coverage tasks on validated evidence, block them on blocked evidence, and reopen them for review evidence.
- Record a Governance operation when coverage tasks are synced from evidence capture.
- Add isolated server coverage for the sync behavior.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\tests\server.test.mjs`
- `node --check .\tests\run-tests.mjs`
- `node --check .\test-parse.js`
- `node .\test-parse.js`
- `npm test`
- `node .\generate-audit.mjs`

## Live Check

- Relaunched with `npm run dev` on `http://localhost:3042`.
- Dev server shell PID: `193712`.
- Home page returned HTTP 200.
- Server source includes `data-source-access-validation-evidence-coverage-tasks-synced`.
- Governance API reports 2 Data Sources evidence coverage items and 2 Data Sources access tasks without mutating live evidence.
