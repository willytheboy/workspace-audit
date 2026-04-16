# Milestone 370 - Agent Execution Target Baseline Audit Ledger Snapshots

## Objective

Persist Agent Execution target-baseline audit ledgers as durable no-secret evidence so build readiness reviews can be saved, copied, and compared against later cycles.

## Completed

- Added `agentExecutionTargetBaselineAuditLedgerSnapshots` to the normalized store.
- Added `GET` and `POST` APIs at `/api/agent-work-order-runs/target-baseline-audit-ledger-snapshots`.
- Persisted snapshot metadata for source total, returned records, review, missing, healthy, stale, drift, and uncheckpointed drift counts.
- Added Governance snapshot cards with copy controls.
- Added a save-snapshot control to the target-baseline audit ledger card.
- Added command-palette support for saving target-baseline audit snapshots.
- Added Governance report evidence, parser checks, and server coverage.

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

- Relaunched local app on PID `258316`.
- Smoke checked `/` with HTTP `200`.
- Smoke checked `/api/agent-work-order-runs/target-baseline-audit-ledger?state=review&limit=5` with `state=review`, `total=2`, and `review=2`.
- Smoke checked `/api/agent-work-order-runs/target-baseline-audit-ledger-snapshots` with an initial `count=0`.
