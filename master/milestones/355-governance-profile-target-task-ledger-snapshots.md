# Milestone 355 - Governance Profile Target Task Ledger Snapshots

## Status

Completed.

## Goal

Persist Governance profile target task ledger baselines so test coverage and runtime remediation queues can be audited over time.

## Delivered

- Added `createGovernanceProfileTargetTaskLedgerSnapshotRecord` for non-secret snapshot capture.
- Added `/api/governance/profile-target-task-ledger-snapshots` with GET and POST support.
- Added snapshot counts to Governance summaries and snapshot rows to the Governance payload.
- Added a `Save Target Snapshot` toolbar button and command-palette action.
- Added a Governance Profile Target Task Snapshots deck and report section.
- Added parser checks and API regression coverage.

## Validation

- `node --check lib\workspace-audit-store.mjs`
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
- Relaunched local app on port `3042` with PID `250984`
- Live smoke: `/` returned `200`
- Live snapshot smoke: `/api/governance/profile-target-task-ledger-snapshots` saved `Live Profile Target Task Ledger Baseline` with `7` open target tasks, `7` test coverage tasks, `0` runtime tasks, and `61` represented missing test files.
- Live Governance summary reports `governanceProfileTargetTaskLedgerSnapshotCount: 1`.
