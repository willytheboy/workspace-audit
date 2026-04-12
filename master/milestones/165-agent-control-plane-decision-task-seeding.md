# Milestone 165 - Agent Control Plane Decision Task Seeding

## Status

Completed.

## Objective

Convert live Agent Control Plane hold/review reasons into deduplicated Governance tasks so platform-level blockers become trackable remediation work before supervised build passes.

## Delivered

- Added `POST /api/agent-control-plane/decision/tasks` to seed `agent-control-plane` tasks from live decision reasons.
- Added non-secret task metadata for decision reason code, severity, decision, recommended action, and remediation command hints.
- Surfaced Control Plane decision tasks in Governance KPI cards, decision deck actions, a dedicated task ledger section, summaries, reports, and command-palette action.
- Fed Control Plane decision task counts into Agent Control Plane handoffs, decisions, decision snapshots, snapshot records, and baseline drift metrics.
- Added parser coverage, server regression coverage, README notes, TODO completion tracking, and regenerated audit/static preview data.

## Validation

- `node --check` passed for the changed server, UI, app, and test modules.
- `node .\test-parse.js` reported Agent Control Plane decision task seeding as present.
- `npm test` passed all 6 tests, including the extended `releaseBuildGateTaskSeedingTest`.
- `node .\generate-audit.mjs` regenerated audit data across 75 detected projects.
- `npm run build:vercel` completed the local static preview build without deploying to Vercel.
