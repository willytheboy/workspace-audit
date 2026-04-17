# Milestone 451 - Server-Side Convergence Review Task Seeding Scope Guard

## Status

Completed.

## Summary

Convergence Review task seeding now requires explicit execution scope before overlap candidates can be converted into follow-up tasks.

## Changes

- Guarded `POST /api/convergence/tasks`.
- Allowed project scope when the active project matches either side of the requested convergence pair.
- Passed dashboard scope metadata through Convergence Review task creation controls.
- Added server regression coverage for direct unscoped task seeding.
- Added parser coverage for the Convergence Review task seeding scope guard.

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

Continue the server-side mutation sweep with lower-level findings refresh and convergence lifecycle mutations.
