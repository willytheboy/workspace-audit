# Milestone 274 - Convergence Drift Checkpoint Snapshot Refresh

Status: Complete
Date: 2026-04-15

## Objective

Let operators accept the live Convergence Review task ledger as the new baseline after reviewing drift and checkpoint decisions.

## Scope

- Add an `Accept Live Baseline` control to the latest Convergence task-ledger drift card.
- Reuse the existing Convergence task-ledger snapshot API to save an accepted baseline snapshot.
- Keep the action close to Copy Drift and Copy Checkpoint Ledger so the review flow remains linear.
- Preserve the no-secrets behavior of the existing snapshot export.

## Validation

- Passed: `node --check ui\dashboard-components.js`
- Passed: `node --check ui\dashboard-views.js`
- Passed: `node --check test-parse.js`
- Passed: `node test-parse.js`
- Passed: `npm test`
- Passed: `npm run build:vercel`
- Passed: `git diff --check`
- Relaunched local app on port 3042 and smoke-tested the root page, latest Convergence Review task-ledger snapshot drift endpoint, dashboard component bundle marker, and dashboard view accepted-baseline marker.
