# Milestone 360 - Governance Profile Target Task Ledger Drift Checkpoint Review Controls

## Status

Completed.

## Goal

Make Governance profile target task ledger drift review behave like the mature convergence checkpoint flow: visible decisions, filterable review state, and direct baseline acceptance after operator confirmation.

## Delivered

- Added checkpoint-state matching between the latest profile target task drift payload and the drift checkpoint ledger.
- Added all, uncheckpointed, confirmed, deferred, and escalated filters to the profile target task drift card.
- Added checkpoint status badges to drift rows so previous Confirm, Defer, and Escalate decisions are visible.
- Updated drift row buttons to show `Update Confirm`, `Update Defer`, and `Update Escalate` when a checkpoint already exists.
- Added an `Accept Live Baseline` action inside the drift card to refresh the latest profile target task ledger snapshot after review.
- Extended parser coverage for the new review controls and baseline refresh action.

## Validation

- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-types.js`
- `node --check test-parse.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`
- Relaunched local app on port `3042` with PID `250288`.
- Smoked `/` with HTTP `200`.
- Smoked `/api/governance` with profile target task drift checkpoint ledger present and drift severity `none`.

## Secret Policy

The controls only display and refresh non-secret Governance metadata. Credentials, tokens, passwords, keys, certificates, cookies, browser sessions, and raw command output remain outside the app.
