# Milestone 432 - Server-Side Release Evidence Scope Guard

## Objective

Protect Release Evidence writes from accidental unscope persistence by requiring an explicit active project scope or portfolio scope before smoke checks, checkpoints, or local evidence bootstrap records are saved.

## Completed

- Added server-side scope validation to deployment smoke-check writes.
- Added server-side scope validation to Release Control checkpoint writes.
- Added server-side scope validation to Release Build Gate local evidence bootstrap writes.
- Propagated dashboard scope metadata into smoke-check, checkpoint, and evidence-bootstrap actions.
- Added server coverage for unscoped direct Release Evidence API writes.
- Added a parser sentinel for the Release Evidence scope guard.

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
- Passed: local relaunch and smoke test on port `3042` with PID `277944`

## Result

Release Evidence writes now require deliberate active project or portfolio scope before deployment smoke checks, release checkpoints, or local release gate evidence bootstrap records are persisted.
