# Milestone 264: Convergence Governance Review Ledger

## Outcome

Added a portfolio-level Convergence Review Ledger in Governance so candidate review is visible outside individual project modals.

## Completed

- Loaded the full convergence candidate payload into the Governance render cycle.
- Added a Convergence Review Ledger section with summary counts, candidate cards, source/status tags, and project open actions.
- Added copy controls for Active, Not Related, and All convergence ledger Markdown exports.
- Added a `Convergence Review` scope option to the Governance filter.

## Validation

- Passed: `node --check ui\dashboard-views.js`
- Passed: `node --check ui\dashboard-components.js`
- Passed: `node --check ui\dashboard-types.js`
- Passed: `node --check test-parse.js`
- Passed: `node test-parse.js`
- Passed: `git diff --check` (Git reported an existing CRLF normalization warning for `index.html`)
- Passed: `npm test`
- Passed: `npm run build:vercel`
- Passed: local relaunch and smoke (`pid=194212`, root HTTP 200, convergence candidate endpoint HTTP 200 with 211 candidates and 3 Not Related records)
