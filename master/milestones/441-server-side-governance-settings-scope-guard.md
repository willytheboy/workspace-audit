# Milestone 441 - Server-Side Governance Settings Scope Guard

## Status

Completed.

## Summary

Governance settings and audit snapshot writes now require the same explicit execution scope used by Agent Execution, CLI bridge, and control-plane mutation surfaces.

## Changes

- Guarded `POST /api/governance/task-update-ledger-snapshots`.
- Guarded `POST /api/governance/execution-views`.
- Guarded `POST /api/governance/execution-policy`.
- Passed dashboard scope metadata through task-update ledger snapshot saves, execution view saves, and SLA policy updates.
- Added regression coverage for unscoped direct writes to those endpoints.
- Added parser coverage for the Governance settings scope guard.

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

Continue auditing remaining direct mutation routes and enforce explicit scope before any persisted Governance, Agent Execution, Data Sources, or Convergence control-plane write.
