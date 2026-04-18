# Milestone 467 - Agent Work Order Regression Alert Baseline Refresh

## Goal

Add a guarded run-level refresh path so Agent Execution runs can recapture the current Regression Alert remediation task baseline after the baseline changes.

## Scope

- [x] Add a scoped `/regression-alert-baseline-refresh` endpoint for Agent Work Order runs.
- [x] Expose a dashboard API helper for run-level Regression Alert baseline refresh.
- [x] Add per-run and bulk Governance controls for runs that need alert-baseline review.
- [x] Add command palette and parser coverage.
- [x] Add server tests for blocked unscoped refresh and successful scoped refresh.
- [x] Validate syntax, parser sentinels, full tests, Vercel build, and local relaunch.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-actions.js`
- `node --check app.js`
- `node --check test-parse.js`
- `node --check tests\server.test.mjs`
- `node test-parse.js`
- `git diff --check`
- `npm test`
- `npm run build:vercel`
- Local smoke: root `200`, mutation scope `0/107`, Governance run alert baseline loaded.

## Status

Completed.
