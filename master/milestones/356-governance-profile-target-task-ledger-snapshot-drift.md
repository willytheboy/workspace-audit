# Milestone 356 - Governance Profile Target Task Ledger Snapshot Drift

## Status

Completed.

## Goal

Detect when a saved Governance profile target task ledger baseline no longer matches the live test coverage and runtime remediation task state.

## Delivered

- Added `createGovernanceProfileTargetTaskLedgerSnapshotDiffPayload` and a missing-snapshot fallback payload.
- Added `/api/governance/profile-target-task-ledger-snapshots/diff?snapshotId=latest`.
- Compared saved and live totals, visible/open/closed counts, task kinds, represented missing test files, represented projects, and individual target task state.
- Added drift severity, drift score, recommended action, Markdown export, and Governance summary fields.
- Surfaced the latest target task drift in the Governance deck and Governance report.
- Added a `Copy Target Drift` toolbar button and command-palette action.
- Added parser checks and regression coverage.

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
- Relaunched local app on port `3042` with PID `216372`
- Live smoke: `/` returned `200`
- Live drift smoke: `/api/governance/profile-target-task-ledger-snapshots/diff?snapshotId=latest` returned `none`, score `0`, and `0` drift items for `Live Profile Target Task Ledger Baseline`.
- Live Governance summary reports `governanceProfileTargetTaskLedgerSnapshotCount: 1`, drift severity `none`, and drift score `0`.

## Notes

- This drift layer is intentionally non-secret and only stores Governance profile target task metadata.
- The high-severity path triggers when open target task count or represented missing test files increase compared with the saved baseline.
