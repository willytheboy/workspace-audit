# 090 - Agent Control Plane Snapshot Drift Fields Integrated

## Status

Completed.

## Summary

Expose compact drift field deltas directly from Control Plane snapshot drift reports so external app-management and supervised-agent consumers can read changed areas without parsing metric and collection sections.

## Scope

- Add `driftItems` to `/api/agent-control-plane-snapshots/diff` JSON payloads for specific, latest, and baseline snapshot comparisons.
- Add a Drift Fields section to snapshot drift markdown, including missing-baseline reports.
- Add API assertions, parser checks, README documentation, and TODO tracking.

## Validation

- `node --check` passed for the updated server, UI types, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed, including the Agent control plane snapshot drift fields parser check.
- Relaunched `npm run dev` on port `3042` with PID `189204`.
- Live verification passed: the GUI shell served successfully, `/api/inventory` reports 75 app profiles, `/api/agent-control-plane-snapshots/diff?snapshotId=baseline` returns compact `driftItems` and Drift Fields markdown, and `/api/agent-control-plane/baseline-status` carries the same nested diff items.
