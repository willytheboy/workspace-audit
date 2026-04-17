# Milestone 416: CLI Bridge Lifecycle Handoff Packet Baseline Refresh Controls

Status: Completed

## Objective

Allow Workspace Audit Pro to promote the current live CLI bridge lifecycle handoff packet into a refreshed reusable baseline after drift review. This extends the handoff packet baseline from read-only status into an operator-controlled acceptance workflow.

## Scope

- Add a non-secret refresh endpoint for lifecycle handoff packet snapshots.
- Preserve previous snapshot linkage in the operation log.
- Add refresh gate fields to baseline status so the UI can distinguish safe refreshes from drift that still needs checkpoint review.
- Surface Save Baseline, Refresh Baseline, and Accept Drift controls in Governance.
- Extend parser checks and server tests for the refresh workflow.

## Validation

- `node --check lib/workspace-audit-server.mjs`
- `node --check ui/dashboard-api.js`
- `node --check ui/dashboard-components.js`
- `node --check ui/dashboard-views.js`
- `node --check tests/server.test.mjs`
- `node --check test-parse.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`
