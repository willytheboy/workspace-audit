# Milestone 438 - Server-Side Launchpad Run Scope Guard

## Objective

Protect project launchpad script execution from accidental or out-of-scope runs by requiring active project scope before `/api/run` starts a child process or records script-run history.

## Completed

- Added server-side scope validation to the `/api/run` SSE endpoint.
- Blocked launchpad runs when the requested path does not resolve to an inventory project.
- Blocked unscoped launchpad runs before child process creation and before script-run history persistence.
- Added project scope parameters to workbench launchpad EventSource URLs.
- Added parser coverage for the launchpad run scope guard.
- Added server coverage proving unscoped launch attempts return a scope error and do not create script-run history.

## Validation

- Passed: `node --check lib\workspace-audit-server.mjs`
- Passed: `node --check ui\dashboard-modal.js`
- Passed: `node --check tests\server.test.mjs`
- Passed: `node --check test-parse.js`
- Passed: `node test-parse.js`
- Passed: `npm test`
- Passed: `npm run build:vercel`
- Passed: `git diff --check`
- Passed: local relaunch and smoke test on port `3042` with PID `261212`

## Result

The app no longer starts local launchpad scripts or writes script-run records unless the request carries an explicit project scope that matches the launched project, closing an important execution-control gap before CLI runner orchestration work continues.
