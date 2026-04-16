# Milestone 367: Agent Execution Target Baseline Refresh

## Status

- Complete

## Objective

Let operators remediate Agent Work Order runs that were queued before the current profile target task baseline existed or before it became healthy. The refresh must be explicit, auditable, and non-secret.

## Completed Work

- Added `POST /api/agent-work-order-runs/:runId/target-baseline-refresh` to recapture current profile target task baseline fields on an existing run.
- Added run history and Governance operation evidence for target baseline refresh actions.
- Added dashboard API support and a `Refresh Target` button on Agent Execution Queue cards that need target baseline review.
- Added parser and server coverage for the new refresh workflow.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check test-parse.js`
- `node --check tests\server.test.mjs`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

- Relaunched local app server on PID `221980`.
- Smoke check: `http://localhost:3042/` returned `200`.
- Served dashboard component smoke check: `http://localhost:3042/ui/dashboard-components.js` contains `agent-work-order-run-target-baseline-refresh-btn`.
- Governance smoke check: `trackedProjects: 44`, run baseline audit `2 review / 2 missing`.
