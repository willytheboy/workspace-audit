# 074 - Agent Control Plane Snapshot Drift Integrated

## Status

Completed.

## Summary

Added a read-only drift layer for saved Agent Control Plane snapshots so each snapshot can be compared against the live control-plane payload and copied as a markdown change report.

## Scope

- Added `GET /api/agent-control-plane-snapshots/diff?snapshotId=...`.
- Added structured metric deltas and collection drift for readiness, execution runs, SLA ledger records, work-order snapshots, and SLA ledger snapshots.
- Added markdown drift report generation for external agent handoffs.
- Added Governance snapshot card `Copy Drift` actions backed by the live diff API.
- Added dashboard API/type coverage, README route documentation, parser checks, server tests, and TODO tracking.

## Validation

- `node --check` passed for the updated server, UI modules, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed, including the Agent control plane snapshot drift parser check.
- Relaunched `npm run dev` on port `3042` with PID `168204`.
- Live verification passed: dashboard shell returned 200, the Agent Control Plane snapshot save control and `Copy Drift` component marker were present, inventory reported 75 apps, live Control Plane snapshots remained at 0, and the drift route returned `400` with `snapshotId is required` for missing snapshot IDs.
