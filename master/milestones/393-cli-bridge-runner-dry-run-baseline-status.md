# Milestone 393 - CLI Bridge Runner Dry-Run Baseline Status

## Status

- Completed

## Objective

Add a first-class health signal for the latest saved Codex or Claude dry-run contract so Governance can show whether the runner prompt baseline is missing, fresh, stale, changed, or drifted before future CLI handoff reuse.

## Changes

- Added `/api/cli-bridge/runner-dry-run-snapshots/baseline-status`.
- Added baseline freshness, health, drift score, drift severity, selected work-order context, recommended action, and copyable Markdown.
- Added dashboard API and typedef coverage for runner dry-run baseline status.
- Added a Governance baseline-status card with health, freshness, drift tags, and copy control.
- Added Governance search filtering, summary text, report export, and item-count wiring.
- Added server regression coverage and parser coverage.

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
- Smoke checks planned: app shell, dry-run baseline-status endpoint, and served Governance baseline-status markers.
