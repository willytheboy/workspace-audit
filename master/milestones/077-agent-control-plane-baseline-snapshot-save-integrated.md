# 077 - Agent Control Plane Baseline Snapshot Save Integrated

## Status

Completed.

## Summary

Added a one-action baseline save workflow so the live Agent Control Plane can be persisted and selected as the active baseline snapshot in the same operation.

## Scope

- Added `baseline: true` support to Agent Control Plane snapshot creation.
- Added a Governance toolbar action for saving the live Control Plane as baseline.
- Added a command-palette action for saving the live Control Plane as baseline.
- Added operation logging for baseline snapshot creation.
- Added API tests, parser checks, README documentation, and TODO tracking.

## Validation

- `node --check` passed for the updated server, UI modules, app entrypoint, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed, including the Agent control plane save baseline parser check.
- Relaunched `npm run dev` on port `3042` with PID `190592`.
- Live verification passed: dashboard shell returned 200 with `Save Baseline` and `Copy Baseline Drift` controls present, inventory reported 75 apps, diagnostics reported no live baseline snapshot ID, and the baseline marker API returned `400` with `snapshotId is required` for an empty request without mutating live data.
