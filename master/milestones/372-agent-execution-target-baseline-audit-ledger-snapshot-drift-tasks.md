# Milestone 372 - Agent Execution Target Baseline Audit Ledger Snapshot Drift Tasks

## Objective

Turn target-baseline audit snapshot drift into trackable Governance tasks so drift does not remain a passive copied handoff.

## Completed

- Added `Track Drift` controls to target-baseline audit ledger snapshot cards.
- Added a task description builder that records snapshot ID, state filter, drift severity, score, changed-run counts, and no-secret policy.
- Added `createAgentExecutionTargetBaselineAuditLedgerSnapshotDriftTask` for per-snapshot task creation.
- Added command-palette support for creating a task from the latest target-baseline audit snapshot drift.
- Added parser coverage for the new drift task controls.

## Validation

- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-actions.js`
- `node --check app.js`
- `node --check test-parse.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

- Relaunched local app on PID `255640`.
- Smoke checked `/` with HTTP `200`.
- Smoke checked `/api/agent-work-order-runs/target-baseline-audit-ledger?state=review&limit=5` with `state=review`, `total=2`, and `review=2`.
- Smoke checked `/api/agent-work-order-runs/target-baseline-audit-ledger-snapshots` with an initial `count=0`.
