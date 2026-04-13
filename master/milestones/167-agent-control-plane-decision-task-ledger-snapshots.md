# Milestone 167 - Agent Control Plane Decision Task Ledger Snapshots

## Status

Completed.

## Objective

Persist Agent Control Plane decision task ledger handoffs and compare saved snapshots with live task state so external app-management consumers can detect remediation drift without storing secrets.

## Delivered

- Added persisted `agentControlPlaneDecisionTaskLedgerSnapshots` store support.
- Added `GET` and `POST /api/agent-control-plane/decision/task-ledger-snapshots`.
- Added `GET /api/agent-control-plane/decision/task-ledger-snapshots/diff` with latest/specific snapshot support and markdown drift output.
- Surfaced snapshot cards, save controls, latest drift copy controls, command-palette actions, API clients, and types in Governance.
- Added parser coverage, server regression coverage, README notes, and TODO completion tracking.

## Validation

- `node --check` passed for the changed store, server, UI, app, and test modules.
- `node .\test-parse.js` reported Agent Control Plane decision task ledger snapshots and snapshot drift as present.
- `npm test` passed all 6 tests, including the extended `releaseBuildGateTaskSeedingTest`.
- `node .\generate-audit.mjs` regenerated audit data across 75 detected projects.
- `npm run build:vercel` completed the local static preview build without deploying to Vercel.
