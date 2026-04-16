# Milestone 361 - Governance Profile Target Task Ledger Baseline Status

## Status

Completed.

## Goal

Give Workspace Audit Pro a clear readiness signal for the accepted Governance profile target task ledger baseline before autonomous build cycles depend on it.

## Delivered

- Added `GET /api/governance/profile-target-task-ledger-baseline-status`.
- Added freshness, health, age, drift severity, drift score, checkpoint coverage, and recommended action fields.
- Added Markdown export for the baseline status handoff.
- Added Governance summary fields for baseline health, freshness, age, and uncheckpointed drift.
- Added a Governance deck card for profile target task baseline status.
- Added dashboard toolbar and command-palette copy actions.
- Extended parser checks and bootstrap test coverage for healthy, drift-review-required, and checkpoint-aware baseline states.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-types.js`
- `node --check app.js`
- `node --check test-parse.js`
- `node --check tests\governance-bootstrap.test.mjs`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`
- Relaunched local app on port `3042` with PID `249536`.
- Smoked `/` with HTTP `200`.
- Smoked `/api/governance/profile-target-task-ledger-baseline-status` with `healthy`, `fresh`, drift score `0`, and `0` uncheckpointed drift items.
- Smoked `/api/governance` with profile target task ledger baseline status present in summary and payload.

## Secret Policy

The baseline status only exports non-secret Governance metadata. Credentials, tokens, passwords, keys, certificates, cookies, browser sessions, and raw command output stay outside the app.
