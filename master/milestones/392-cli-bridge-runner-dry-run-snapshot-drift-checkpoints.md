# Milestone 392 - CLI Bridge Runner Dry-Run Snapshot Drift Checkpoints

## Status

- Completed

## Objective

Make runner dry-run snapshot drift actionable from Governance so changed Codex or Claude dry-run contracts can be tracked, accepted as a new baseline, or converted into specific checkpoint tasks before reuse.

## Changes

- Added Track Drift and Accept Drift actions to the CLI Bridge runner dry-run snapshot drift card.
- Added per-field Confirm, Defer, and Escalate controls for runner dry-run drift items.
- Converted dry-run drift review and per-field checkpoint decisions into non-secret Governance tasks.
- Scoped checkpoint tasks to the selected work-order project when the live or saved dry-run contract identifies one.
- Added acceptance flow that saves the current live runner dry-run contract as the refreshed baseline.
- Added parser coverage for the checkpoint wiring.

## Validation

- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check test-parse.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

- Relaunch required after validation.
- Smoke checks planned: app shell, dry-run snapshot drift endpoint, and parser checkpoint marker.
