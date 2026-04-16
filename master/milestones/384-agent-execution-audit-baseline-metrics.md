# Milestone 384 - Agent Execution Audit Baseline Metrics

## Objective

Promote run-level target-baseline audit snapshot capture from per-run evidence into portfolio-level Governance metrics.

## Implementation

- Added active Agent Work Order metrics for audit-baseline capture, missing, healthy, stale, drifted, drift-review-required, review-required, and uncheckpointed drift states.
- Added matching Governance summary counters under `agentExecutionTargetBaselineAuditBaseline*`.
- Added an `Audit Snapshot Baseline` metric card in Agent Execution Metrics.
- Added audit-baseline capture counts to Governance report Markdown.
- Added type documentation, parser checks, and server test assertions.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-types.js`
- `node --check tests\server.test.mjs`
- `node --check test-parse.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

- Relaunched local app on port `3042`.
- Smoke check: `/` returned `200`.
- Smoke check: `/api/governance` returned successfully with `2` Agent Work Order run(s).
- Smoke check: `/api/governance` returned audit-baseline metrics `review/missing = 2/2` and summary audit review count `2`.
