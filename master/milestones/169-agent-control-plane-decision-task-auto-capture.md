# Milestone 169 - Agent Control Plane Decision Task Auto Capture

## Status

Completed.

## Objective

Let the Agent Control Plane seed decision-remediation tasks and persist the resulting non-secret task ledger snapshot in one operation, reducing manual handoff steps for unattended app-building cycles.

## Delivered

- Added optional `saveSnapshot`, `snapshotTitle`, `snapshotStatus`, and `snapshotLimit` support to `POST /api/agent-control-plane/decision/tasks`.
- Reused one server-side snapshot builder for standalone decision task ledger snapshots and seed-time auto-capture snapshots.
- Added an `agent-control-plane-decision-task-ledger-snapshot-auto-captured` Governance operation for auditability.
- Added a Governance decision-card `Seed + Snapshot` action and command-palette action for seed-and-snapshot workflow execution.
- Added parser checks, server regression assertions, README notes, and TODO completion tracking.

## Validation

- `node --check` passed for the changed server, UI, app, and test modules.
- `node .\test-parse.js` reported Agent Control Plane decision task auto capture as present.
- `npm test` passed all 6 tests, including seed-time decision task ledger snapshot auto-capture assertions.
- `node .\generate-audit.mjs` regenerated audit data across 75 detected projects.
- `npm run build:vercel` completed the local static preview build without deploying to Vercel.
- Local app relaunched on `http://127.0.0.1:3042/` and returned HTTP 200.
