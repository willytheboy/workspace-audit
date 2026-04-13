# Milestone 168 - Agent Control Plane Decision Task Ledger Snapshot Drift Wiring

## Status

Completed.

## Objective

Make Control Plane decision task ledger snapshots visible in Agent Control Plane handoffs, snapshot records, and baseline drift metrics so autonomous app-building workflows can detect persistence-layer changes.

## Delivered

- Added Control Plane decision task ledger snapshot counts to Agent Control Plane handoff markdown.
- Added Control Plane decision task ledger snapshot lists to Agent Control Plane payloads.
- Persisted decision task ledger snapshot counts and lists in Agent Control Plane snapshot records.
- Added decision task ledger snapshot metric deltas to Agent Control Plane snapshot drift.
- Added parser checks, server regression assertions, README notes, and TODO completion tracking.

## Validation

- `node --check` passed for the changed server, type, and test modules.
- `node .\test-parse.js` reported Agent Control Plane snapshot drift decision task ledger snapshots as present.
- `npm test` passed all 6 tests, including Agent Control Plane snapshot drift assertions.
- `node .\generate-audit.mjs` regenerated audit data across 75 detected projects.
- `npm run build:vercel` completed the local static preview build without deploying to Vercel.
