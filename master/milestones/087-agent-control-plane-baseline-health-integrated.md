# 087 - Agent Control Plane Baseline Health Integrated

## Status

Completed.

## Summary

Added an action-oriented baseline health layer so Governance can classify the active Agent Control Plane baseline as missing, healthy, changed, drifted, or stale and recommend the next operator action.

## Scope

- Added baseline health and recommended action metadata to Governance summary payloads.
- Added health fields to the visible Baseline Status payload.
- Surfaced baseline health in KPI cards, the Baseline Status deck, copied summaries, and Governance reports.
- Added API assertions, parser checks, README documentation, and TODO tracking.

## Validation

- `node --check` passed for the updated server, UI types, UI components, UI views, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed, including the Agent control plane baseline health parser check.
- Relaunched `npm run dev` on port `3042` with PID `196768`.
- Live verification passed: the GUI shell served successfully, UI bundles include baseline health deck and summary markers, `/api/inventory` reports 75 app profiles, and `/api/governance` returns baseline health and recommended action on both `summary` and `agentControlPlaneBaselineStatus`.
