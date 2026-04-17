# Milestone 435 - Server-Side Governance Queue Scope Guard

## Objective

Protect Governance queue and task-seeding checkpoint writes from accidental unscope persistence by requiring an explicit active project scope or portfolio scope before queue execution, suppression, restoration, or checkpoint records are saved.

## Completed

- Added server-side scope validation to Governance queue execute writes.
- Added server-side scope validation to Governance queue suppress and restore writes.
- Added server-side scope validation to task-seeding checkpoint writes.
- Propagated dashboard scope metadata into queue execution, queue suppression, queue restore, and generated task checkpoint actions.
- Added parser coverage for the Governance queue scope guard.
- Added server coverage for unscoped direct Governance queue and task checkpoint API writes.

## Validation

- Passed: `node --check lib\workspace-audit-server.mjs`
- Passed: `node --check ui\dashboard-api.js`
- Passed: `node --check ui\dashboard-views.js`
- Passed: `node --check tests\server.test.mjs`
- Passed: `node --check tests\governance-bootstrap.test.mjs`
- Passed: `node --check test-parse.js`
- Passed: `node test-parse.js`
- Passed: `npm test`
- Passed: `npm run build:vercel`
- Passed: `git diff --check`
- Passed: local relaunch and smoke test on port `3042` with PID `263480`

## Result

Governance queue and task-seeding checkpoint writes now require deliberate active project or portfolio scope before queue execution, suppression, restoration, or checkpoint records are persisted.
