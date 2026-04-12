# 120 - Governance Data Sources Access Review Task Seeding Integrated

Status: Complete.

## Scope

- Add a server endpoint that creates deduplicated Governance tasks from Data Sources access review queue items.
- Preserve the no-secrets boundary by storing only source labels, access methods, actions, validation guidance, and credential hints.
- Add Governance toolbar and command-palette actions for seeding visible source-access review tasks.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-api.js`
- `node --check .\ui\dashboard-actions.js`
- `node --check .\ui\dashboard-views.js`
- `node --check .\ui\dashboard-types.js`
- `node --check .\app.js`
- `node --check .\test-parse.js`
- `node --check .\tests\server.test.mjs`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`

## Live Check

- Relaunched app on port `3042` from dev shell PID `23148`.
- Live app smoke check:
  - Home page status: `200`
  - Visible Data Sources access review queue items: `1`
  - Governance Seed Source Tasks button present: `true`
  - Command-palette seed action present: `true`
  - Dashboard API endpoint client present: `true`
