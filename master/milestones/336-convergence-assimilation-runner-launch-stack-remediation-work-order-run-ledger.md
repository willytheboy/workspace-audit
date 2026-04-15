# Milestone 336 - Convergence Assimilation Runner Launch Stack Remediation Work-Order Run Ledger

## Status
Completed

## Summary
Added a dedicated launch stack remediation work-order run ledger so queued Codex and Claude remediation handoffs can be reviewed, filtered, and copied from Governance.

## Changes
- Added `GET /api/convergence/assimilation-runner-launch-stack-remediation-work-order-run-ledger`.
- Filtered remediation work-order runs by status and runner while excluding unrelated agent work-order runs.
- Summarized total, visible, open, closed, active, archived, Codex, Claude, and work-item counts.
- Added Governance ledger cards plus Copy All/Open/Closed controls.
- Added parser and server coverage for ledger generation and Markdown export.

## Validation
- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-types.js`
- `node --check tests\server.test.mjs`
- `node --check test-parse.js`
- `node test-parse.js`
- `npm test`
- `npm run build:vercel`
- `git diff --check`

## App Relaunch
Relaunch local server on port `3042` and smoke-check `/` plus the remediation work-order run ledger API.
