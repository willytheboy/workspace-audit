# Milestone 364: CLI Bridge Run Trace Profile Target Baseline

## Status

- Complete

## Objective

Make CLI bridge run traces auditable against the Governance profile target task ledger baseline so every CLI-linked run can show the target-task baseline state present during trace capture and snapshotting.

## Completed Work

- Added profile target task baseline health, freshness, drift severity, and uncheckpointed drift counts to CLI bridge run trace payloads.
- Added a Profile Target Task Baseline section to CLI bridge run trace Markdown.
- Persisted target baseline state on CLI bridge run trace snapshots.
- Added target baseline tags to CLI bridge run trace snapshot cards.
- Added parser and server coverage for the run trace baseline fields.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-types.js`
- `node --check test-parse.js`
- `node --check tests\server.test.mjs`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

- Relaunched local app on `http://localhost:3042` with PID `91840`.
- Smoke checked `/`, `/api/governance`, and `/api/cli-bridge/runs/nonexistent-trace-smoke/trace`.
- Runtime trace payload reports profile target baseline `healthy`, `fresh`, with run-trace Markdown baseline evidence present.
