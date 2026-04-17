# Milestone 433 - Server-Side Data Sources Write Scope Guard

## Objective

Protect Data Sources writes from accidental unscope persistence by requiring an explicit active project scope or portfolio scope before source registry, access validation, evidence, snapshot, and task-ledger writes are saved.

## Completed

- Added server-side scope validation to Data Sources registry add and remove writes.
- Added server-side scope validation to Data Sources access validation workflow snapshots and task seeding.
- Added server-side scope validation to Data Sources access validation evidence, evidence snapshots, evidence coverage task seeding, access review task seeding, access task-ledger snapshots, and health summary snapshots.
- Propagated dashboard scope metadata into source setup, delete source, access evidence, snapshot, drift baseline, and task-seeding actions.
- Added parser coverage for the Data Sources write-scope guard.
- Added server coverage for unscoped direct Data Sources write attempts.

## Validation

- Passed: `node --check app.js`
- Passed: `node --check ui\dashboard-source-setup.js`
- Passed: `node --check ui\dashboard-api.js`
- Passed: `node --check ui\dashboard-views.js`
- Passed: `node --check lib\workspace-audit-server.mjs`
- Passed: `node --check tests\server.test.mjs`
- Passed: `node --check test-parse.js`
- Passed: `node test-parse.js`
- Passed: `npm test`
- Passed: `npm run build:vercel`
- Passed: `git diff --check`
- Passed: local relaunch and smoke test on port `3042` with PID `270360`

## Result

Data Sources write paths now require deliberate active project or portfolio scope before registry, validation, evidence, task-seeding, task-ledger, or health snapshot records are persisted.
