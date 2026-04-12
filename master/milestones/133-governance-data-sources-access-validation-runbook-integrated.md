# 133 - Governance Data Sources Access Validation Runbook Integrated

Status: Complete.

## Scope

- Add Data Sources access validation runbook counts and payloads to Governance and Agent Control Plane handoffs.
- Surface runbook methods in the Governance deck, summary text, reports, and Control Plane decision gate cards.
- Track validation method and source counts in Agent Control Plane snapshot drift.
- Keep all credential, certificate, token, private key, and browser-session handling outside the app.

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

- Relaunched on `http://localhost:3042` with dev shell PID `219476`.
- Home page smoke check returned `200`.
- Governance reported `2` Data Sources access validation methods across `2` sources.
- Agent Control Plane and direct decision markdown both included `## Data Sources Access Validation Runbook`.
