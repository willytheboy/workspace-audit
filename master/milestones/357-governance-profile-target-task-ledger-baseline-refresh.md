# Milestone 357 - Governance Profile Target Task Ledger Baseline Refresh

## Status

Completed.

## Goal

Allow intentional Governance profile target task ledger drift to be accepted as a new non-secret baseline snapshot.

## Delivered

- Added `POST /api/governance/profile-target-task-ledger-snapshots/refresh`.
- The refresh action creates a new live snapshot while preserving `previousSnapshotId` lineage.
- Added a `governance-profile-target-task-ledger-snapshot-refreshed` operation log record.
- Added `refreshGovernanceProfileTargetTaskLedgerSnapshot` to the dashboard API and view controller.
- Added `Refresh Target Baseline` toolbar and command-palette actions.
- Added parser checks and regression coverage.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check app.js`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-actions.js`
- `node --check ui\dashboard-views.js`
- `node --check test-parse.js`
- `node --check tests\governance-bootstrap.test.mjs`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`
- Relaunched local app on port `3042` with PID `220916`
- Live smoke: `/` returned `200`
- Live refresh smoke: `/api/governance/profile-target-task-ledger-snapshots/refresh` created `Live Accepted Profile Target Task Ledger Baseline` with `7` open target tasks and `2` saved target ledger snapshots.
- Live drift smoke after refresh: `/api/governance/profile-target-task-ledger-snapshots/diff?snapshotId=latest` returned `none`, score `0`, and `0` drift items.
- Live Governance summary reports `governanceProfileTargetTaskLedgerSnapshotCount: 2`, drift severity `none`, and drift score `0`.

## Notes

- Refresh is non-destructive: it prepends a new accepted baseline snapshot instead of mutating the older snapshot.
- This keeps the drift audit trail available while giving the operator a clear way to accept intentional baseline changes.
