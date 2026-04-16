# Milestone 390 - CLI Bridge Runner Dry-Run Snapshots

## Status

- Completed

## Objective

Persist the exact non-secret Codex or Claude CLI dry-run contract before any supervised runner execution so the app can audit, replay, and compare what was handed off.

## Changes

- Added `cliBridgeRunnerDryRunSnapshots` to the normalized persistent store.
- Added list and save endpoints for CLI Bridge runner dry-run snapshots.
- Saved selected work-order identity, runner, dry-run decision, reason codes, target-baseline audit gate, audit-baseline run gate, Markdown, and the full dry-run payload.
- Added Governance summary counts, snapshot cards, copy controls, and Codex/Claude save controls.
- Added parser and server coverage for the new contract.

## Validation

- `node --check lib\workspace-audit-store.mjs`
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
- Smoke checks planned: app shell, Governance payload summary, and CLI Bridge runner dry-run snapshot list endpoint.
