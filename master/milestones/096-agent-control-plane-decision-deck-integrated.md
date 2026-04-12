# 096 - Agent Control Plane Decision Deck Integrated

## Status

Completed.

## Summary

Surface the Agent Control Plane ready/review/hold decision inside the Governance control center instead of leaving it as an API-only gate.

## Scope

- Add the Agent Control Plane decision payload to the Governance rollup.
- Add a Decision Gate KPI and searchable Governance deck card.
- Add deck, toolbar, and command-palette copy actions backed by `GET /api/agent-control-plane/decision`.
- Update Governance text/markdown exports so decision state travels with handoffs.
- Add tests, parser checks, README/TODO tracking, validation, and relaunch.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-api.js`
- `node --check .\ui\dashboard-components.js`
- `node --check .\ui\dashboard-views.js`
- `node --check .\ui\dashboard-actions.js`
- `node --check .\ui\dashboard-types.js`
- `node --check .\app.js`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `npm test`
- `node .\generate-audit.mjs`
- `node .\test-parse.js`
- Relaunched app on port `3042` with PID `138816`.
- Live verified `/` dashboard shell with `copy-agent-control-plane-decision-btn`, `/api/inventory` with 75 projects, `/api/governance` with `agentControlPlaneDecision`, and `/api/agent-control-plane/decision` returning `decision: review`, `baselineDriftSeverity: low`, and markdown decision output.
