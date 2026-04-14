# Milestone 266: Convergence Review Task Lifecycle Controls

## Outcome

Added Governance lifecycle controls for Convergence Review Tasks so overlap follow-up tasks can be confirmed, deferred, or escalated without leaving the Convergence scope.

## Completed

- Added Confirm, Defer, and Escalate controls to Convergence Review Task cards.
- Added a Governance handler that updates tasks through the existing task PATCH endpoint.
- Stored non-secret convergence task checkpoint status, timestamp, and note metadata.
- Kept behavior aligned with other task ledgers: Confirm resolves, Defer defers, and Escalate blocks with high priority.
- Added parser coverage for the task lifecycle controls.

## Validation

- Passed: `node --check ui\dashboard-views.js`
- Passed: `node --check ui\dashboard-components.js`
- Passed: `node --check ui\dashboard-types.js`
- Passed: `node --check test-parse.js`
- Passed: `node test-parse.js`
- Passed: `npm test`
- Passed: `npm run build:vercel`
- Passed: `git diff --check`
- Passed: local relaunch and smoke (`pid=195340`, root HTTP 200, dashboard component asset exposed Convergence task lifecycle buttons, dashboard view asset exposed the lifecycle handler, Governance payload HTTP 200)
