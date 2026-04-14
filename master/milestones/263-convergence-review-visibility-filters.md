# Milestone 263: Convergence Review Visibility Filters

## Outcome

Added a review visibility layer to the Convergence workbench so active auto-detected overlaps stay focused while hidden Not Related decisions remain auditable and restorable.

## Completed

- Added an Active, Needs Review, Not Related, and All filter card to the project Convergence workbench.
- Kept Not Related candidates hidden from the default Active view while allowing operators to inspect and restore them from the Not Related view.
- Preserved the existing Confirm, Not Related, Needs Review, and Merge actions across every filtered view.
- Refreshed convergence-dependent findings after every convergence review state change, not only after Not Related removals.

## Validation

- Passed: `node --check`
- Passed: `node test-parse.js`
- Passed: `git diff --check`
- Passed: `npm test`
- Passed: `npm run build:vercel`
- Passed: local relaunch and smoke on port `3042`
