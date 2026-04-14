# Milestone 262: Convergence Auto-Detect Restore

## Outcome

Restored auto-detected convergence as a first-class workbench source while keeping user-contributed overlap proposals available for operator knowledge and AI-assisted due diligence.

## Completed

- Added server-side convergence candidate reconstruction from both `crossChecks` and per-project `similarApps`.
- Updated the project workbench to merge fetched convergence ledger candidates with auto-detected `similarApps`.
- Preserved `not-related` reviews as suppression tombstones so removed candidates stay hidden even if the auto detector still sees similarity.
- Added an `Auto detected` source tag beside operator-contributed overlap tags.
- Added regression coverage for a partial inventory where `crossChecks` is empty but `similarApps` still contains the generated overlap.

## Validation

- Passed: `node --check`
- Passed: `node test-parse.js`
- Passed: `git diff --check`
- Passed: `npm test`
- Passed: `npm run build:vercel`
- Passed: local relaunch and smoke on port `3042`
