# Milestone 170 - Agent Control Plane Decision Task Lifecycle

## Status

Completed.

## Objective

Make Control Plane decision-remediation tasks actionable inside the Governance deck so operators can resolve, reopen, or block decision tasks without leaving the control center.

## Delivered

- Added Resolve, Reopen, and Block controls to Agent Control Plane decision task cards.
- Reused the shared task update API for Control Plane decision task status changes.
- Kept decision task lifecycle state aligned with the existing open/closed ledger filtering semantics.
- Added parser checks, server regression assertions, README notes, and TODO completion tracking.

## Validation

- `node --check` passed for the changed UI, parser, and test modules.
- `node .\test-parse.js` reported Agent Control Plane decision task lifecycle as present.
- `npm test` passed all 6 tests, including Control Plane decision task resolve/reopen/block ledger assertions.
- `node .\generate-audit.mjs` regenerated audit data across 75 detected projects.
- `npm run build:vercel` completed the local static preview build without deploying to Vercel.
- Local app relaunched on `http://127.0.0.1:3042/` and returned HTTP 200.
