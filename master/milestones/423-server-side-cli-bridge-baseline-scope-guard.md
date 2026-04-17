# Milestone 423 - Server-Side CLI Bridge Baseline Scope Guard

Date: 2026-04-17

## Objective

Extend the active-project / explicit-portfolio server guard from CLI bridge evidence intake into CLI bridge baseline and snapshot mutations, so direct API calls cannot save or refresh runner baselines outside the current execution scope.

## Completed

- Guarded CLI bridge runner dry-run snapshot creation against the selected work-order project.
- Guarded lifecycle handoff packet snapshot creation by the requested project or explicit portfolio scope.
- Guarded lifecycle handoff packet baseline refresh against the saved snapshot project when a previous snapshot exists.
- Guarded lifecycle handoff packet drift checkpoint creation against the saved snapshot project.
- Guarded lifecycle remediation task-ledger snapshot, drift checkpoint, and baseline refresh actions behind explicit project or portfolio scope.
- Passed dashboard scope metadata through the newly guarded remediation task-ledger baseline actions.
- Added server regression coverage for unscoped dry-run snapshots, invalid-scope dry-run snapshots, unscoped handoff packet snapshots, unscoped handoff packet drift checkpoints, invalid-scope handoff packet refresh, unscoped remediation ledger snapshots, unscoped remediation drift checkpoints, and unscoped remediation refresh.
- Added parser coverage for the server-side CLI bridge baseline scope guard.

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
- Local smoke: unscoped CLI bridge dry-run snapshot returned 409 `agent-execution-scope-required`.

## Result

CLI bridge baseline controls now follow the same scope model as Agent Execution and CLI bridge evidence intake: reads can describe current state, but baseline-producing writes require a valid active project or explicit portfolio mode.
