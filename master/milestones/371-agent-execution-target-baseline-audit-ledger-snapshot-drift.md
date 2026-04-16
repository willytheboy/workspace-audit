# Milestone 371 - Agent Execution Target Baseline Audit Ledger Snapshot Drift

## Objective

Compare saved Agent Execution target-baseline audit ledger snapshots against the current live ledger so operators can see whether run baseline readiness changed after a saved evidence point.

## Completed

- Added a drift payload builder for target-baseline audit ledger snapshots.
- Added `GET /api/agent-work-order-runs/target-baseline-audit-ledger-snapshots/:snapshotId/drift`.
- Compared snapshot and live summary counts, added runs, removed runs, and changed run fields.
- Generated no-secret Markdown drift handoffs with severity, score, recommended action, and changed fields.
- Added per-snapshot `Copy Drift` controls in Governance.
- Added command-palette support for copying latest target-baseline audit snapshot drift.
- Added parser checks and server coverage for clean snapshot drift.

## Validation

- `node --check lib\workspace-audit-store.mjs`
- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-actions.js`
- `node --check app.js`
- `node --check ui\dashboard-types.js`
- `node --check tests\server.test.mjs`
- `node --check test-parse.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

- Relaunched local app on PID `242916`.
- Smoke checked `/` with HTTP `200`.
- Smoke checked `/api/agent-work-order-runs/target-baseline-audit-ledger?state=review&limit=5` with `state=review`, `total=2`, and `review=2`.
- Smoke checked `/api/agent-work-order-runs/target-baseline-audit-ledger-snapshots` with an initial `count=0`.
- Smoke checked `/api/agent-work-order-runs/target-baseline-audit-ledger-snapshots/not-found/drift` with HTTP `404` for a missing snapshot without mutating live data.
