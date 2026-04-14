# Milestone 265: Convergence Review Task Seeding

## Outcome

Added a non-secret task-seeding path for Convergence review pairs so reviewed overlap decisions can become tracked work without auto-merging or executing any project changes.

## Completed

- Added `POST /api/convergence/tasks` for creating tasks from selected convergence pair IDs or taskable review statuses.
- Added duplicate protection that skips existing open convergence tasks for the same pair.
- Added convergence task metadata to Governance summary, baseline drift fields, and the Governance payload.
- Added Governance `Track Task` controls on Convergence Review Ledger cards and a Convergence Review Tasks section.
- Added parser and server regression coverage for the new task-seeding path.

## Validation

- Passed: `node --check lib\workspace-audit-server.mjs`
- Passed: `node --check ui\dashboard-api.js`
- Passed: `node --check ui\dashboard-views.js`
- Passed: `node --check ui\dashboard-components.js`
- Passed: `node --check ui\dashboard-types.js`
- Passed: `node --check test-parse.js`
- Passed: `node test-parse.js | Select-String -Pattern "Convergence|Missing"`
- Passed: `npm test`
- Passed: `npm run build:vercel`
- Passed: `git diff --check`
- Passed: local relaunch and smoke (`pid=232084`, root HTTP 200, dashboard component asset exposed Convergence Review Tasks controls, Governance payload HTTP 200, convergence candidates HTTP 200 with 211 candidates and 6 Not Related records, empty task-seeding request returned the expected HTTP 400 validation guard)
