# Milestone 396 - CLI Bridge Runner Dry-Run Lifecycle Ledger Review Controls

Status: Completed

## Objective

Turn the CLI bridge runner dry-run lifecycle ledger from a passive audit surface into an actionable Governance workflow surface.

## Changes

- Added Track All, Track Codex, and Track Claude controls to generate non-secret lifecycle-ledger review tasks.
- Added per-item Track Item controls for individual saved dry-run baseline lifecycle entries.
- Scoped item tasks to the selected work-order project when present, with CLI Bridge fallback.
- Added task descriptions with lifecycle action, runner, decisions, gates, reason codes, operation linkage, and explicit no-secret policy.
- Added parser and milestone coverage for the review-control wiring.

## Validation

- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check test-parse.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

Local app relaunch and smoke checks are part of the milestone closeout.
