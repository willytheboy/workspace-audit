# Milestone 463 - Governance Regression Alert Remediation Task Baseline Refresh

Status: Completed
Date: 2026-04-18

## Summary

Added baseline status and refresh controls for Regression Alert remediation task ledgers so the operator can accept a live alert remediation task ledger as the new baseline only when checkpoint gates allow it.

## Changes

- Added a `REGRESSION_ALERT_TASK_LEDGER_BASELINE_STALE_HOURS` freshness threshold.
- Added baseline status reporting for snapshot presence, freshness, health, drift score, drift severity, checkpoint coverage, and refresh gate state.
- Added a guarded `/api/governance/regression-alert-task-ledger-snapshots/refresh` endpoint.
- Added `/api/governance/regression-alert-task-ledger-baseline-status` for copyable baseline handoffs.
- Blocked refresh when open escalated or uncheckpointed drift items remain.
- Added Governance UI cards and controls for Copy Baseline Status, Save Baseline, Refresh Baseline, and Gate Hold.
- Added parser coverage for the refresh and baseline status flow.

## Validation

- `node --check lib\workspace-audit-store.mjs`
- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-types.js`
- `node --check test-parse.js`
- `node test-parse.js`
- `npm test`
- `npm run build:vercel`
- `git diff --check`
- Local relaunch on port 3042 with smoke checks for root, mutation scope, baseline status, and guarded refresh behavior.

## Next

- Use the refreshed Regression Alert baseline state inside higher-level Governance readiness gates.
