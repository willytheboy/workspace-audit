# Milestone 436 - Server-Side Generic Task Scope Guard

## Objective

Protect direct generic task writes from accidental unscoped persistence by requiring explicit active project scope or portfolio scope before tasks are created or updated.

## Completed

- Added server-side scope validation to direct task creation.
- Added server-side scope validation to direct task updates using the persisted task project plus any requested project change.
- Prevented task update scope metadata from being persisted onto task records.
- Propagated dashboard scope metadata into all generic task creation and update actions.
- Added project-scoped workbench task mutation payloads for project modal actions.
- Added parser coverage for the generic task scope guard.
- Added server coverage for unscoped direct task create and patch requests.

## Validation

- Passed: `node --check lib\workspace-audit-server.mjs`
- Passed: `node --check ui\dashboard-api.js`
- Passed: `node --check ui\dashboard-views.js`
- Passed: `node --check ui\dashboard-modal.js`
- Passed: `node --check tests\server.test.mjs`
- Passed: `node --check tests\governance-bootstrap.test.mjs`
- Passed: `node --check test-parse.js`
- Passed: `node test-parse.js`
- Passed: `npm test`
- Passed: `npm run build:vercel`
- Passed: `git diff --check`
- Passed: local relaunch and smoke test on port `3042` with PID `298136`

## Result

Direct task creation and task lifecycle updates now require deliberate active project or portfolio scope, closing the largest remaining generic task mutation gap before the platform moves deeper into autonomous agent workflow execution.
