# Milestone 450 - Server-Side Convergence Review Task Ledger Scope Guard

## Status

Completed.

## Summary

Convergence Review task ledger baseline saves and drift checkpoint decisions now require explicit execution scope before mutating persisted control-plane artifacts.

## Changes

- Guarded `POST /api/convergence/task-ledger-snapshots`.
- Guarded `POST /api/convergence/task-ledger-drift-checkpoints`.
- Passed dashboard scope metadata through Convergence Review task ledger baseline and drift checkpoint actions.
- Added server regression coverage for unscoped task ledger snapshot and drift checkpoint writes.
- Added parser coverage for the Convergence Review task ledger scope guard.

## Validation

- `node --check lib/workspace-audit-server.mjs`
- `node --check ui/dashboard-api.js`
- `node --check ui/dashboard-views.js`
- `node --check tests/server.test.mjs`
- `node --check test-parse.js`
- `node test-parse.js`
- `npm test`
- `npm run build:vercel`
- `git diff --check`

## Next

Continue the server-side mutation sweep with the remaining Convergence review task creation and checkpoint actions.
