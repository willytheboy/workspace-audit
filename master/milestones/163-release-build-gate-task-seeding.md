# Milestone 163 - Release Build Gate Task Seeding

## Status

Completed.

## Objective

Convert open Release Build Gate actions into deduplicated Governance tasks so local release blockers become trackable work items before the next unattended build pass.

## Delivered

- Added `POST /api/releases/build-gate/actions/tasks` to seed release-control tasks from live release-gate actions while rejecting ready-only action sets.
- Added release-control task metadata, non-secret policy text, duplicate detection, and a `release-build-gate-action-tasks-created` governance operation.
- Added dashboard API support, a Governance deck button, and command-palette action for seeding release-gate tasks.
- Added parser coverage, server regression coverage, README notes, and TODO completion tracking.

## Validation

- `node --check` passed for the changed server, UI, app, and test modules.
- `node .\test-parse.js` reported Release Build Gate task seeding as present.
- `npm test` passed all 6 tests, including `releaseBuildGateTaskSeedingTest`.
- `node .\generate-audit.mjs` regenerated audit data across 75 detected projects.
- `npm run build:vercel` completed the local static preview build without deploying to Vercel.
