# Milestone 359 - Governance Profile Target Task Ledger Drift Checkpoint Ledger

## Status

Completed.

## Goal

Make profile target task ledger drift decisions auditable after the operator confirms, defers, or escalates drift items.

## Delivered

- Added `GET /api/governance/profile-target-task-ledger-drift-checkpoints` with `all`, `open`, and `closed` status filters.
- Added a copyable Markdown ledger for non-secret Governance profile target task drift checkpoint metadata.
- Added Governance summary fields for total, open, and escalated profile target task drift checkpoint counts.
- Surfaced the checkpoint ledger in the Governance panel with copy actions for all, open, and closed checkpoint views.
- Added Governance report lines for checkpoint decisions, fields, snapshot references, and before/current drift values.
- Extended parser and bootstrap coverage for the new endpoint, payload type, UI controls, and summary fields.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-types.js`
- `node --check test-parse.js`
- `node --check tests\governance-bootstrap.test.mjs`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`
- Relaunched local app on port `3042` with PID `59000`.
- Smoked `/` with HTTP `200`.
- Smoked `/api/governance/profile-target-task-ledger-drift-checkpoints?status=all` with HTTP `200`, status `all`, and live visible checkpoint count `0`.
- Smoked `/api/governance` profile target task drift checkpoint summary fields with drift severity `none`.

## Secret Policy

Only non-secret checkpoint metadata is persisted or exported. Repository credentials, provider tokens, passwords, private keys, certificates, cookies, browser sessions, and raw command output stay outside the app.
