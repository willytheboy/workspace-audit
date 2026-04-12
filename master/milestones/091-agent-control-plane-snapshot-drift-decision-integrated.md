# 091 - Agent Control Plane Snapshot Drift Decision Integrated

## Status

Completed.

## Summary

Add decision guidance to Control Plane snapshot drift reports so external consumers can distinguish clean, low, medium, high, and missing-baseline drift states without inventing their own thresholds.

## Scope

- Add `driftSeverity` to snapshot drift JSON payloads.
- Add recommended action guidance to snapshot drift JSON and markdown reports.
- Add API assertions, parser checks, README documentation, and TODO tracking.

## Validation

- `node --check` passed for the updated server, UI types, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed, including the Agent control plane snapshot drift decision parser check.
- Relaunched `npm run dev` on port `3042` with PID `211888`.
- Live verification passed: the GUI shell served successfully, `/api/inventory` reports 75 app profiles, `/api/agent-control-plane-snapshots/diff?snapshotId=baseline` returns drift severity plus recommended action, and `/api/agent-control-plane/baseline-status` carries the same nested diff decision fields.
