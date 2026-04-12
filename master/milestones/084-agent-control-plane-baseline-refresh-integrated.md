# 084 - Agent Control Plane Baseline Refresh Integrated

## Status

Completed.

## Summary

Added a refresh workflow for Agent Control Plane baselines so operators can replace stale or missing baselines with the current live control-plane state without manually saving and re-marking a snapshot.

## Scope

- Added `POST /api/agent-control-plane-snapshots/baseline/refresh`.
- Added distinct Governance operation logging for baseline refreshes.
- Added toolbar, command-palette, and Baseline Status deck controls for refreshing the baseline.
- Added API assertions, parser checks, README documentation, and TODO tracking.

## Validation

- `node --check` passed for the updated server, app shell, dashboard API, dashboard actions, dashboard components, dashboard views, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed, including the Agent control plane baseline refresh parser check.
- Relaunched `npm run dev` on port `3042` with PID `54044`.
- Live verification passed: the GUI shell served successfully, the toolbar `Refresh Baseline` control survived regeneration from `template.html`, the deck refresh marker and API client marker are present, `/api/inventory` reports 75 app profiles, `/api/agent-control-plane/baseline-status` reports a fresh baseline, and Governance contains an `agent-control-plane-baseline-refreshed` operation.
