# Milestone 481 - Agent Control Plane Alert Baseline Drift Task Gate

## Goal

Prevent unresolved Agent Execution Regression Alert baseline drift tasks from being invisible to Control Plane readiness and CLI runner guidance.

## Scope

- [x] Add alert-baseline drift task counts and task excerpts to Agent Control Plane decision payloads.
- [x] Add a Control Plane review reason when alert-baseline drift tasks remain open.
- [x] Surface alert-baseline drift task counts in decision markdown, dashboard tags, and copied Governance Markdown.
- [x] Include alert-baseline drift tasks in decision snapshots and CLI runner readiness gating.
- [x] Add parser and server-test coverage for the drift task gate.

## Validation

- [x] `node --check lib\workspace-audit-server.mjs`
- [x] `node --check ui\dashboard-components.js`
- [x] `node --check ui\dashboard-views.js`
- [x] `node --check ui\dashboard-types.js`
- [x] `node --check test-parse.js`
- [x] `node --check tests\server.test.mjs`
- [x] `node test-parse.js`
- [x] `git diff --check`
- [x] `npm test`
- [x] `npm run build:vercel`
- [x] Local smoke after relaunch: `root=200`, `alertDriftTasks=0/1`, `markdown=True`, `mutation=0/110`

## Status

Completed.
