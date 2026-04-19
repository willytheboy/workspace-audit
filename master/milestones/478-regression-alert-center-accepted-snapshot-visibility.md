# Milestone 478 - Regression Alert Center Accepted Snapshot Visibility

## Goal

Make the accepted Agent Execution Regression Alert baseline snapshot visible in the Regression Alert Center, not only in the lower execution-baseline section.

## Scope

- [x] Add Regression Alert Center alerts for missing, stale, drifted, or review-required accepted alert-baseline snapshots.
- [x] Add a compact accepted snapshot status card with health, freshness, drift, checkpoint coverage, and copy controls.
- [x] Include accepted alert-baseline snapshot health in the Regression Alert Center markdown handoff pack.
- [x] Add parser coverage for the new UI and handoff strings.

## Validation

- `node --check public\ui\dashboard-components.js`
- `node --check public\ui\dashboard-views.js`
- `node --check test-parse.js`
- `node test-parse.js`
- `git diff --check`
- `npm test`
- `npm run build:vercel`
- Local smoke: `root=200`, `acceptedSnapshotCard=True`, `decision=hold`, `alertSnapshot=healthy/fresh`, `mutation=0/110`

## Status

Completed.
