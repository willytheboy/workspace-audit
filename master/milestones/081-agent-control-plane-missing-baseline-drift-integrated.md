# 081 - Agent Control Plane Missing Baseline Drift Integrated

## Status

Completed.

## Summary

Changed baseline drift behavior so the baseline shortcut returns a useful markdown status report when no Agent Control Plane baseline is selected, instead of producing an operator-facing error.

## Scope

- Added a missing-baseline drift payload with markdown guidance.
- Changed `GET /api/agent-control-plane-snapshots/diff?snapshotId=baseline` to return `200` with no-baseline status when no baseline exists.
- Preserved strict `404` behavior for explicit missing snapshot IDs and the `latest` shortcut when no snapshots exist.
- Added API tests, parser checks, README documentation, and TODO tracking.

## Validation

- `node --check` passed for the updated server, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed, including the Agent control plane missing baseline drift parser check.
- Relaunched `npm run dev` on port `3042` with PID `158360`.
- Live verification passed: inventory reported 75 apps, `snapshotId=baseline` returned `200` with `hasBaseline: false`, drift score `0`, and markdown containing `Baseline selected: no`, while `snapshotId=latest` remained strict with `404` because no live snapshots exist.
