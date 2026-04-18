# Milestone 458 - Governance Regression Alert Task Seeding

## Status

Completed.

## Summary

Regression Alert Center cards can now create scoped Governance remediation tasks directly from alert evidence.

## Changes

- Added `Create Task` controls to active regression alert cards.
- Wired alert task creation through the existing scope-guarded `/api/tasks` path.
- Included severity, source, detail, recommended action, and no-secret policy in the generated task description.
- Preserved active project / portfolio scope metadata during task creation.
- Added parser coverage for alert task seeding.

## Validation

- `node --check ui/dashboard-views.js`
- `node --check ui/dashboard-components.js`
- `node --check test-parse.js`
- `node test-parse.js`
- `npm test`
- `npm run build:vercel`
- `git diff --check`

## Next

Add a compact task ledger/filter for remediation tasks created from the Regression Alert Center.
