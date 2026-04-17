# Milestone 431 - Server-Side Release Control Task Scope Guard

## Objective

Protect Release Control task-write surfaces from accidental cross-project mutation by requiring an explicit active project scope or portfolio scope.

## Completed

- Added server-side scope validation to Release Control task-ledger snapshot creation.
- Added server-side scope validation to Release Build Gate action task seeding, including snapshot auto-capture.
- Propagated dashboard scope metadata into Release Control task snapshot and build-gate task actions.
- Added server coverage for unscoped direct Release Control task writes.
- Added a parser sentinel for the Release Control task scope guard.

## Validation

- Passed: `node --check lib\workspace-audit-server.mjs`
- Passed: `node --check ui\dashboard-api.js`
- Passed: `node --check ui\dashboard-views.js`
- Passed: `node --check tests\server.test.mjs`
- Passed: `node --check test-parse.js`
- Passed: `node test-parse.js`
- Passed: `npm test`
- Passed: `npm run build:vercel`
- Passed: `git diff --check`
- Passed: local relaunch and smoke test on port `3042` with PID `259048`

## Result

Release Control task writes now require a deliberate active project or portfolio scope. Direct unscoped API writes are rejected before task or snapshot persistence.
