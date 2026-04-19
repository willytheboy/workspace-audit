# Milestone 479 - Regression Alert Baseline Snapshot Drift Tasks

## Goal

Close the workflow gap between copying/checkpointing Regression Alert baseline snapshot drift and creating actionable Governance tasks from that drift.

## Scope

- [x] Add Track Drift controls to Agent Execution Regression Alert baseline ledger snapshot cards.
- [x] Add UI binding and command-palette action for latest alert-baseline drift task creation.
- [x] Create non-secret Governance tasks from Regression Alert baseline snapshot drift details.
- [x] Add parser coverage for the new UI, view handler, command action, and app handler.

## Validation

- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-actions.js`
- `node --check app.js`
- `node --check test-parse.js`
- `node test-parse.js`
- `git diff --check`
- `npm test`
- `npm run build:vercel`
- Local smoke: `root=200`, `trackDrift=True`, `commandAction=True`, `decision=hold`, `mutation=0/110`

## Status

Completed.
