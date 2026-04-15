# Milestone 354 - Governance Profile Target Task Ledger

## Status

Completed.

## Goal

Make seeded Governance profile target tasks easy to review, copy, and hand off by adding a focused non-secret ledger for test coverage and runtime target remediation work.

## Delivered

- Added `createGovernanceProfileTargetTaskLedgerPayload` and Markdown generation for target task handoffs.
- Added `/api/governance/profile-target-task-ledger` with status filtering and bounded result limits.
- Added `profileTargetTasks` to the Governance snapshot and registry filtering.
- Added a Governance Profile Target Tasks deck with project, kind, status, priority, and missing test context.
- Added a `Copy Target Ledger` toolbar button and command-palette action.
- Added report and status-summary lines for visible profile target task rows.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check app.js`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-actions.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-types.js`
- `node --check test-parse.js`
- `node --check tests\governance-bootstrap.test.mjs`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`
- Relaunched local app on port `3042` with PID `132452`
- Live smoke: `/` returned `200`
- Live ledger smoke: `/api/governance/profile-target-task-ledger?status=open` returned `7` visible open target tasks, `7` test coverage tasks, `0` runtime tasks, and `61` represented missing test files across `7` projects.
- Live Governance snapshot includes `profileTargetTasks` rows with project, target kind, status, missing test files, and task keys.
