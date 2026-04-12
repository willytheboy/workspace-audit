# 082 - Agent Control Plane Clear Baseline Integrated

## Status

Completed.

## Summary

Added a clear-baseline workflow so operators can unset the active Agent Control Plane baseline without deleting any saved Control Plane snapshots.

## Scope

- Added `POST /api/agent-control-plane-snapshots/baseline/clear`.
- Added operation logging for baseline clears.
- Added a Governance toolbar action for clearing the baseline.
- Added a command-palette action for clearing the baseline.
- Added a Control Plane Baseline Status deck action for clearing the baseline.
- Added API tests, parser checks, README route documentation, and TODO tracking.

## Validation

- `node --check` passed for the updated server, UI modules, app entrypoint, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed, including the Agent control plane clear baseline parser check.
- Relaunched `npm run dev` on port `3042` with PID `30128`.
- Live verification passed: dashboard shell returned 200 with the toolbar clear-baseline control, the loaded component bundle included the deck clear-baseline action, inventory reported 75 apps, and the clear-baseline endpoint returned `success: true` with no active baseline.
