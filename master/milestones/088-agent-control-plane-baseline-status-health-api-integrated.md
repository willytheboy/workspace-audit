# 088 - Agent Control Plane Baseline Status Health API Integrated

## Status

Completed.

## Summary

Aligned the direct Agent Control Plane baseline status API with the Governance baseline health layer so external agent-control consumers receive health, recommended action, and compact drift field deltas without needing to call the full Governance endpoint.

## Scope

- Added shared baseline health classification for missing, healthy, changed, drifted, and stale baselines.
- Added health and recommended action metadata to `/api/agent-control-plane/baseline-status`.
- Added compact metric drift field deltas to the baseline status JSON and markdown report.
- Added API assertions, parser checks, README documentation, and TODO tracking.

## Validation

- `node --check` passed for the updated server, UI types, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed, including the Agent control plane baseline status health API parser check.
- Relaunched `npm run dev` on port `3042` with PID `196612`.
- Live verification passed: the GUI shell served successfully, `/api/inventory` reports 75 app profiles, and `/api/agent-control-plane/baseline-status` returns baseline health, recommended action, drift item count, and markdown health/drift-field sections.
