# Milestone 391 - CLI Bridge Runner Dry-Run Snapshot Drift

## Status

- Completed

## Objective

Compare a saved Codex or Claude CLI dry-run contract against the current live dry-run state before reusing it, so stale runner prompts do not silently bypass new gates or selected-work-order changes.

## Changes

- Added `/api/cli-bridge/runner-dry-run-snapshots/diff`.
- Added dry-run snapshot summaries for saved and live contracts.
- Compared runner, requested run, selected work order, decisions, reason codes, target-baseline audit gate fields, and audit-baseline run gate fields.
- Added Governance drift card, copy control, search filtering, report coverage, and parser coverage.
- Added server test coverage for missing-snapshot and ready diff states.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-types.js`
- `node --check tests\server.test.mjs`
- `node --check test-parse.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

- Relaunch required after validation.
- Smoke checks planned: app shell, Governance dry-run drift visibility, and dry-run snapshot diff endpoint.
