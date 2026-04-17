# Milestone 424 - Server-Side Agent Control Plane Baseline Scope Guard

Date: 2026-04-17

## Objective

Protect Agent Control Plane snapshot and baseline mutations with the same active-project / explicit-portfolio server guard now used by Agent Execution and CLI bridge workflows.

## Completed

- Guarded Agent Control Plane snapshot creation behind explicit project or portfolio scope.
- Guarded Agent Control Plane baseline selection behind explicit project or portfolio scope.
- Guarded Agent Control Plane baseline clear behind explicit project or portfolio scope.
- Guarded Agent Control Plane baseline refresh behind explicit project or portfolio scope before checkpoint-gate evaluation.
- Passed dashboard scope metadata through control-plane snapshot save, baseline save, clear, refresh, and drift-acceptance actions.
- Added server regression coverage for unscoped control-plane snapshot, baseline set, baseline refresh, and baseline clear calls.
- Added parser coverage for the server-side Agent Control Plane baseline scope guard.

## Validation

- `node --check lib/workspace-audit-server.mjs`
- `node --check ui/dashboard-api.js`
- `node --check ui/dashboard-views.js`
- `node --check tests/server.test.mjs`
- `node --check test-parse.js`
- `node test-parse.js`
- `npm test`
- `npm run build:vercel`
- `git diff --check`
- Local smoke: `/` returned 200 on port 3042.
- Local smoke: unscoped Agent Control Plane snapshot returned 409 `agent-execution-scope-required`.

## Result

Control-plane baseline writes can no longer be performed by direct unscoped API calls. This keeps the future autonomous app-building control plane tied to a deliberate active project or explicit portfolio mode.
