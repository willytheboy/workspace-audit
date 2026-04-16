# Milestone 365: Agent Execution Profile Target Baseline Capture

## Status

- Complete

## Objective

Persist the Governance profile target task ledger baseline state onto Agent Work Order run records when they are queued. This makes queued, running, and completed work auditable against the target-task baseline state present at execution start.

## Completed Work

- Added a shared profile target baseline capture helper for Agent Work Order runs.
- Added captured baseline health, freshness, drift severity, drift score, snapshot ID, and uncheckpointed drift counts to direct run creation.
- Added the same captured baseline fields to snapshot batch queueing, CLI bridge follow-up runs, convergence assimilation runs, and launch-stack remediation runs.
- Surfaced captured target baseline state in Agent Execution Queue cards.
- Added parser and server coverage for the new run-level baseline capture.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-types.js`
- `node --check test-parse.js`
- `node --check tests\server.test.mjs`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

- Relaunched local app server on PID `248192`.
- Smoke check: `http://localhost:3042/` returned `200`.
- Governance smoke check: `trackedProjects: 44`, app-development scope coverage `100%`, target task baseline `healthy/fresh`.
