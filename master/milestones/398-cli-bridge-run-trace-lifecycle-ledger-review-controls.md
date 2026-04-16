# Milestone 398 - CLI Bridge Run Trace Lifecycle Ledger Review Controls

Status: Completed

## Objective

Turn the CLI bridge run-trace lifecycle ledger into an actionable Governance task surface, matching the dry-run lifecycle review controls.

## Changes

- Added Track Trace Ledger control to generate a non-secret review task from the full run-trace lifecycle ledger.
- Added per-item Track Item controls for individual CLI bridge run-trace lifecycle entries.
- Scoped item tasks to the traced project when available, with CLI Bridge fallback.
- Added task descriptions with trace decision, run ID, project, profile baseline health, audit baseline health, handoff counts, operation linkage, and explicit no-secret policy.
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
