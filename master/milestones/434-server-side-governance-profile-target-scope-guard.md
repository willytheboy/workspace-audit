# Milestone 434 - Server-Side Governance Profile Target Scope Guard

## Objective

Protect Governance profile and profile-target writes from accidental unscope persistence by requiring an explicit active project scope or portfolio scope before profiles, bootstrap records, target tasks, snapshots, baseline refreshes, or drift checkpoints are saved.

## Completed

- Added server-side scope validation to project profile upserts.
- Added server-side scope validation to governance bootstrap profile and starter-pack writes.
- Added server-side scope validation to Governance profile target refresh and target task seeding.
- Added server-side scope validation to Governance profile target task-ledger snapshots, baseline refreshes, and drift checkpoint writes.
- Propagated dashboard scope metadata into profile, bootstrap, target, snapshot, baseline, and drift checkpoint actions.
- Added parser coverage for the Governance profile target scope guard.
- Added server coverage for unscoped direct Governance profile target API writes.

## Validation

- Passed: `node --check lib\workspace-audit-server.mjs`
- Passed: `node --check ui\dashboard-api.js`
- Passed: `node --check ui\dashboard-views.js`
- Passed: `node --check tests\server.test.mjs`
- Passed: `node --check tests\governance-bootstrap.test.mjs`
- Passed: `node --check test-parse.js`
- Passed: `node test-parse.js`
- Passed: `npm test`
- Passed: `npm run build:vercel`
- Passed: `git diff --check`
- Passed: local relaunch and smoke test on port `3042` with PID `187192`

## Result

Governance profile target writes now require deliberate active project or portfolio scope before profile, bootstrap, target-task, baseline, or drift checkpoint records are persisted.
