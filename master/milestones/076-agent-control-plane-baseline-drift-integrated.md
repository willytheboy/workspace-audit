# 076 - Agent Control Plane Baseline Drift Integrated

## Status

Completed.

## Summary

Added a persistent Agent Control Plane baseline snapshot marker so operators can compare the live control plane against a chosen baseline handoff instead of only the newest snapshot.

## Scope

- Added `agentControlPlaneBaselineSnapshotId` to the persisted store.
- Added `POST /api/agent-control-plane-snapshots/baseline`.
- Added `snapshotId=baseline` support to the Control Plane snapshot drift API.
- Added baseline tags and `Mark Baseline` actions to Governance snapshot cards.
- Added toolbar and command-palette actions for copying baseline Control Plane drift.
- Added API tests, parser checks, README route documentation, and TODO tracking.

## Validation

- `node --check` passed for the updated store, server, UI modules, app entrypoint, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed, including the Agent control plane baseline drift parser check.
- Relaunched `npm run dev` on port `3042` with PID `201960`.
- Live verification passed: dashboard shell returned 200 with `Copy Baseline Drift` present, the loaded component bundle included the baseline snapshot card action, inventory reported 75 apps, diagnostics reported no live baseline snapshot ID, and `snapshotId=baseline` returned `404` with `Agent Control Plane baseline snapshot not found` as expected before a live baseline is selected.
