# 080 - Agent Control Plane Baseline Status Deck Integrated

## Status

Completed.

## Summary

Added a visible Governance deck section for Agent Control Plane baseline status so operators can see the baseline state directly in the dashboard, not only through copy actions or API responses.

## Scope

- Added `agentControlPlaneBaselineStatus` to the Governance payload.
- Added a Control Plane Baseline Status deck section.
- Routed baseline status through Governance search, agent scope, and item counts.
- Added baseline status assertions, parser checks, README documentation, and TODO tracking.

## Validation

- `node --check` passed for the updated server, UI types, UI components, UI views, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed, including the Agent control plane baseline status deck parser check.
- Relaunched `npm run dev` on port `3042` with PID `58960`.
- Live verification passed: the loaded component bundle contains the `Control Plane Baseline Status` deck section and `BASELINE MISSING` marker, inventory reported 75 apps, and Governance returned `agentControlPlaneBaselineStatus` with `hasBaseline: false` and `snapshotCount: 0` for the current live store.
