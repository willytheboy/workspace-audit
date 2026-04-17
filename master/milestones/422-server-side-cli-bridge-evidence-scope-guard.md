# Milestone 422 - Server-Side CLI Bridge Evidence Scope Guard

Date: 2026-04-17

## Objective

Extend active-project / explicit-portfolio enforcement from Agent Execution work-order mutations into CLI bridge evidence flows, so direct API calls cannot attach runner output, approve execution-result gates, or queue follow-up work outside the selected scope.

## Completed

- Guarded CLI bridge run-trace snapshot creation by the selected run project.
- Guarded CLI bridge follow-up work-order queueing by the draft project.
- Guarded CLI bridge runner result intake by linked work-order run or supplied project.
- Guarded CLI bridge handoff review by linked run or handoff project.
- Guarded manual CLI bridge handoff creation by linked run or supplied project.
- Guarded execution-result checkpoint creation by the selected work-order run project.
- Passed dashboard scope metadata through CLI bridge result capture, handoff review, follow-up queueing, run-trace snapshots, and execution-result checkpoint controls.
- Added server tests for unscoped checkpoint rejection, unscoped CLI handoff rejection, and mismatched CLI handoff rejection.
- Added parser coverage for the server-side CLI bridge evidence scope guard.

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
- Local smoke: unscoped CLI bridge handoff returned 409 `agent-execution-scope-required`.

## Result

The CLI bridge now matches the Agent Execution guard model: planning and read-only context can remain visible, but evidence-producing and run-mutating bridge actions require either a valid active project match or explicit portfolio mode.
