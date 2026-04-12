# Milestone 166 - Agent Control Plane Decision Task Ledger

## Status

Completed.

## Objective

Expose Agent Control Plane decision remediation tasks as a first-class non-secret ledger that external app-management and supervised-build consumers can ingest without scraping Governance UI state.

## Delivered

- Added `GET /api/agent-control-plane/decision/task-ledger` with `all`, `open`, and `closed` filters plus bounded result limits.
- Added a markdown handoff with task totals, priority split, unique decision reason count, recommended actions, command hints, and non-secret handling policy.
- Added dashboard API/types, Governance copy support, decision-gate deck button, command-palette action, parser coverage, server regression coverage, README notes, and TODO completion tracking.

## Validation

- `node --check` passed for the changed server, UI, app, and test modules.
- `node .\test-parse.js` reported Agent Control Plane decision task ledger as present.
- `npm test` passed all 6 tests, including the extended `releaseBuildGateTaskSeedingTest`.
- `node .\generate-audit.mjs` regenerated audit data across 75 detected projects.
- `npm run build:vercel` completed the local static preview build without deploying to Vercel.
