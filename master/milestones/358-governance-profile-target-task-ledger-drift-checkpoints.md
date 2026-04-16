# Milestone 358 - Governance Profile Target Task Ledger Drift Checkpoints

## Status

Completed.

## Goal

Give the operator a controlled way to confirm, defer, or escalate individual Governance profile target task ledger drift items.

## Delivered

- Added `POST /api/governance/profile-target-task-ledger-snapshot-drift-checkpoints`.
- Added task-backed drift checkpoint records using `sourceType: governance-profile-target-task-ledger-snapshot-drift-checkpoint`.
- Stored non-secret snapshot ID, status filter, drift field, drift label, before/current values, delta, decision, and checkpoint note metadata.
- Added Confirm, Defer, and Escalate controls to each profile target task ledger drift item card.
- Added dashboard API and view bindings for checkpointing drift items.
- Added parser checks and regression coverage that creates real target-ledger drift by resolving a target task.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-types.js`
- `node --check test-parse.js`
- `node --check tests\governance-bootstrap.test.mjs`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`
- Relaunched local app on port `3042` with PID `244412`
- Live smoke: `/` returned `200`
- Live drift smoke: `/api/governance/profile-target-task-ledger-snapshots/diff?snapshotId=latest` returned `none`, score `0`, and `0` drift items for `Live Accepted Profile Target Task Ledger Baseline`.
- Live checkpoint guard smoke: `POST /api/governance/profile-target-task-ledger-snapshot-drift-checkpoints` returned HTTP `400` for a nonexistent drift item instead of crashing.

## Notes

- Confirmed checkpoint tasks resolve automatically, deferred checkpoints remain deferred, and escalated checkpoints are blocked/high priority.
- Checkpoints are non-secret and are intended to preserve operator intent before target-task baselines are refreshed.
