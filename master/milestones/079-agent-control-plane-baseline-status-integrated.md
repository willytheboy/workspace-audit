# 079 - Agent Control Plane Baseline Status Integrated

## Status

Completed.

## Summary

Added a direct Agent Control Plane baseline status endpoint and copy action so operators and agent consumers can inspect baseline availability and drift score without calling the lower-level diff API.

## Scope

- Added `GET /api/agent-control-plane/baseline-status`.
- Added markdown status output for missing and selected baselines.
- Added dashboard API/type support for baseline status payloads.
- Added toolbar and command-palette actions for copying baseline status.
- Added API tests, parser checks, README route documentation, and TODO tracking.

## Validation

- `node --check` passed for the updated server, UI modules, app entrypoint, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed, including the Agent control plane baseline status parser check.
- Relaunched `npm run dev` on port `3042` with PID `148832`.
- Live verification passed: dashboard shell returned 200 with `Copy Baseline Status` and `Save Baseline` controls present, inventory reported 75 apps, and `/api/agent-control-plane/baseline-status` returned markdown with `hasBaseline: false` and drift score `0` for the current live store.
