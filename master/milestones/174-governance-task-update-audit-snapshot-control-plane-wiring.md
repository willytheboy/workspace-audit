# Milestone 174 - Governance Task Update Audit Snapshot Control Plane Wiring

## Status

Completed.

## Objective

Wire persisted Governance task update audit ledger snapshots into the Agent Control Plane so supervised-build handoffs, saved snapshots, and baseline drift all carry the same task-lifecycle audit evidence.

## Delivered

- Add Governance task update audit ledger snapshot counts to Agent Control Plane markdown handoffs.
- Persist Governance task update audit ledger snapshot counts and snapshot lists in Agent Control Plane snapshot records.
- Add Governance task update audit ledger snapshot metric and list drift to Agent Control Plane snapshot and baseline drift reports.
- Update dashboard typedefs, parser checks, server regression assertions, README notes, and TODO tracking.

## Validation

- `node --check` passed for the changed server, dashboard type, parser, and server test modules.
- `node .\test-parse.js` reported Agent Control Plane snapshot drift task update audit snapshots as present before and after audit regeneration.
- `npm test` passed all 6 tests, including Agent Control Plane task update snapshot handoff and drift assertions.
- `node .\generate-audit.mjs` regenerated audit data across 75 detected projects.
- `npm run build:vercel` completed the local static preview build without deploying to Vercel.
