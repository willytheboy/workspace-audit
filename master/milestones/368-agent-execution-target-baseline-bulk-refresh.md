# Milestone 368: Agent Execution Target Baseline Bulk Refresh

## Status

- Complete

## Objective

Add a supervised bulk action for recapturing current profile target task baseline state on all visible Agent Execution runs that need target-baseline review. This makes the individual refresh control practical when the execution queue has multiple legacy or drifted runs.

## Completed Work

- Added `refreshVisibleTargetBaselineAgentWorkOrderRuns` to refresh all visible, non-archived runs with missing, stale, drifted, or uncheckpointed target baseline state.
- Exposed the bulk action through the app action registry as `refresh-agent-execution-target-baselines`.
- Added parser coverage for the app, action registry, and Governance view wiring.

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

- Relaunched local app server on PID `59356`.
- Smoke check: `http://localhost:3042/` returned `200`.
- Served action registry smoke check: `http://localhost:3042/ui/dashboard-actions.js` contains `refresh-agent-execution-target-baselines`.
