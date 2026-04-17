# Milestone 430 - Server-Side Agent Policy Checkpoint Scope Guard

## Objective

Require active project or explicit portfolio scope before managed-agent policy checkpoints can be recorded, and enforce project-scope target matching.

## Completed

- Guarded `POST /api/agent-policy-checkpoints`.
- Rejected project-scoped policy checkpoint writes when the checkpoint project differs from the active project.
- Passed dashboard scope metadata through Agent Policy Checkpoint actions.
- Added server coverage for unscoped and mismatched policy checkpoint writes.
- Added parser coverage for the guarded server, dashboard, and test paths.

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
- Passed: local app relaunched on `http://localhost:3042` with PID `266252`.
- Passed: root smoke check returned `200`.
- Passed: unscoped policy checkpoint smoke check returned `409` with `agent-execution-scope-required`.

## Result

Managed-agent policy checkpoint writes now require an intentional scope and cannot accidentally approve policies for a non-active project.
