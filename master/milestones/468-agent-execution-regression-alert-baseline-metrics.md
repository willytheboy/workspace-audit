# Milestone 468 - Agent Execution Regression Alert Baseline Metrics

## Goal

Make run-level Regression Alert baseline captures first-class Governance metrics so the Agent Execution queue can be filtered, monitored, and blocked before unattended CLI build work.

## Scope

- [x] Count captured, missing, healthy, stale, drifted, review-required, refresh-hold, and escalated-checkpoint alert-baseline run states.
- [x] Surface those counts in Governance summary and Agent Execution metrics.
- [x] Add Control Plane and CLI runner readiness reasons when alert-baseline run evidence needs review.
- [x] Add execution filters for alert-baseline review, missing, stale, drift, and hold states.
- [x] Add parser and server-test coverage.
- [x] Validate syntax, parser sentinels, full tests, Vercel build, and local relaunch.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-types.js`
- `node --check test-parse.js`
- `node --check tests\server.test.mjs`
- `node test-parse.js`
- `git diff --check`
- `npm test`
- `npm run build:vercel`
- Local smoke: root `200`, mutation scope `0/107`, Governance alert-baseline metrics loaded.

## Status

Completed.
