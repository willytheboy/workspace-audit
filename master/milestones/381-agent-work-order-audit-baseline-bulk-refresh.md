# Milestone 381 - Agent Work Order Audit Baseline Bulk Refresh

## Objective

Let operators recapture target-baseline audit snapshot state across all visible Agent Execution runs that need audit-baseline review, without opening each run card individually.

## Implementation

- Added `refreshVisibleTargetBaselineAuditAgentWorkOrderRuns` to filter visible, active Agent Work Order runs with missing, stale, drifted, or uncheckpointed audit-baseline capture.
- Reused the run-level `refreshAgentWorkOrderRunTargetBaselineAudit` API for each selected run so every refresh keeps run history and Governance operation evidence.
- Added an app-level handler and command-palette action `refresh-agent-execution-target-baseline-audits`.
- Added parser coverage for the bulk audit refresh action wiring.

## Validation

- `node --check app.js`
- `node --check ui\dashboard-actions.js`
- `node --check ui\dashboard-views.js`
- `node --check test-parse.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

- Relaunched local app on port `3042`.
- Smoke check: `/` returned `200`.
- Smoke check: `/api/governance` returned successfully with `2` Agent Work Order run(s).
