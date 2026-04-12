# Milestone 164 - Release Control Task Ledger

## Status

Completed.

## Objective

Expose Release Build Gate task work as a first-class Release Control task ledger so unattended build blockers are visible to Governance, Agent Control Plane handoffs, and external app-management consumers.

## Delivered

- Added `GET /api/releases/task-ledger` with `all`, `open`, and `closed` status filters plus non-secret markdown output.
- Surfaced Release Control tasks in Governance KPI cards, release deck actions, a dedicated ledger section, summaries, reports, and command-palette copy flow.
- Fed Release Control task counts and visible task records into Agent Control Plane payloads, decisions, snapshots, markdown handoffs, and baseline drift metrics.
- Added parser coverage, server regression coverage, README notes, TODO completion tracking, and regenerated audit/static preview data.

## Validation

- `node --check` passed for the changed server, UI, app, and test modules.
- `node .\test-parse.js` reported Release Control task ledger and Agent Control Plane release-control task checks as present.
- `npm test` passed all 6 tests, including `releaseBuildGateTaskSeedingTest`.
- `node .\generate-audit.mjs` regenerated audit data across 75 detected projects.
- `npm run build:vercel` completed the local static preview build without deploying to Vercel.
