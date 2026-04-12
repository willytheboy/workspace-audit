# 097 - Agent Control Plane Decision Snapshots Integrated

## Status

Completed.

## Summary

Persist Agent Control Plane ready/review/hold decisions as auditable snapshots so supervised build gates can be saved, copied, and reviewed over time.

## Scope

- Add `agentControlPlaneDecisionSnapshots` to the persistent store and Governance rollup.
- Add `GET` and `POST` APIs for decision snapshot history.
- Surface decision snapshot history in Governance with save and copy actions.
- Include decision snapshot counts in Governance summaries and Agent Control Plane handoffs.
- Add tests, parser checks, README/TODO tracking, validation, and relaunch.

## Validation

- `node --check .\lib\workspace-audit-store.mjs`
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
- Relaunched app on port `3042` with PID `192736`.
- Live verified `/` dashboard shell with `save-agent-control-plane-decision-snapshot-btn` and `copy-agent-control-plane-decision-btn`, `/api/inventory` with 75 projects, `/api/governance` with `agentControlPlaneDecisionSnapshotCount`, and `/api/agent-control-plane/decision-snapshots`.
