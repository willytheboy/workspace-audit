# 075 - Latest Agent Control Plane Drift Shortcut Integrated

## Status

Completed.

## Summary

Added a shortcut for copying drift from the latest saved Agent Control Plane snapshot so operators can produce a current-vs-last-handoff report without opening an individual snapshot card.

## Scope

- Added `snapshotId=latest` support to `GET /api/agent-control-plane-snapshots/diff`.
- Added a Governance toolbar button for copying latest Control Plane drift.
- Added a command-palette action for the latest Control Plane drift report.
- Added API tests, parser checks, README route documentation, and TODO tracking.

## Validation

- `node --check` passed for the updated server, app entrypoint, UI actions, UI views, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed sequentially, including the Agent control plane latest drift parser check.
- Relaunched `npm run dev` on port `3042` with PID `195600`.
- Live verification passed: dashboard shell returned 200 with `Copy Latest Drift` and `Copy Control Plane` controls present, inventory reported 75 apps, live Control Plane snapshots remained at 0, and `snapshotId=latest` returned `404` with `Agent Control Plane snapshot not found` as expected when no live snapshots exist.
