# Milestone 461 - Governance Regression Alert Remediation Task Snapshot Drift

Status: Completed
Date: 2026-04-18

## Summary

Added live-vs-snapshot drift reporting for Regression Alert remediation task ledgers so unattended build cycles can verify whether the saved alert remediation baseline still matches the current Governance task state.

## Changes

- Added a guarded `/api/governance/regression-alert-task-ledger-snapshots/diff` endpoint that returns the latest or selected snapshot drift report.
- Added no-snapshot handling with a copyable Markdown drift brief so operators know when the baseline must be created.
- Added drift scoring for visible task count, total tasks, open tasks, project task count, portfolio task count, and ledger Markdown movement.
- Added Governance UI loading, filtering, item-count accounting, copy actions, a visible snapshot drift card, and per-snapshot Copy Drift controls.
- Added parser coverage for the new endpoint, UI action wiring, component card, and type surface.

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
- Local relaunch on port 3042 with smoke checks for root, mutation scope, and regression alert task ledger snapshot drift.

## Next

- Continue hardening Governance baselines by adding refresh and checkpoint workflows for Regression Alert remediation task drift.
