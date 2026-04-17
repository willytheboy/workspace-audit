# Milestone 421 - Server-Side Agent Execution Scope Guard

Date: 2026-04-17

## Objective

Close the direct-API bypass risk for Agent Execution work-order mutations by enforcing the same active project / explicit portfolio mode contract on the server.

## Completed

- Added a shared `createAgentExecutionScopeGuard` helper and failure response for Agent Execution mutation endpoints.
- Guarded work-order create, snapshot batch queue, status patch, target-baseline refresh, target-baseline audit refresh, retention, SLA action, and SLA resolution routes.
- Rejected missing scope with `agent-execution-scope-required`.
- Rejected active-project mismatches with `agent-execution-scope-mismatch`.
- Passed current dashboard scope metadata through all Agent Execution mutation calls.
- Added negative server tests for missing scope and mismatched project scope.
- Added parser coverage for the server-side guard.

## Validation

- `node --check lib/workspace-audit-server.mjs`
- `node --check ui/dashboard-api.js`
- `node --check ui/dashboard-views.js`
- `node --check tests/server.test.mjs`
- `node --check test-parse.js`
- `node test-parse.js`
- `npm test`

## Result

Agent Execution controls now have a defense-in-depth scope lock: the UI disables and guards high-impact actions, while the server rejects direct mutations unless the request is scoped to the active project or intentionally marked as portfolio mode.
