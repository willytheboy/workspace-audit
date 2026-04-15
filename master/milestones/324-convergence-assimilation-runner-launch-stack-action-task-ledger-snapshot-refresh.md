# Milestone 324: Convergence Assimilation Runner Launch Stack Action Task Ledger Snapshot Refresh

## Completed

- Added a refresh endpoint for launch stack action task ledger snapshots.
- Added a Governance `Accept Drift` control that saves the current live action task ledger as the newest baseline.
- Preserved previous snapshot ids in the refresh response and operation log for audit continuity.

## Product Value

Operators can now intentionally accept action-task ledger drift after review. The app keeps the older baseline for audit history, while the latest snapshot reflects the current remediation task state used for Codex and Claude handoffs.

## Validation Targets

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check tests\server.test.mjs`
- `node --check test-parse.js`
- `node test-parse.js`
- `npm test`
- `npm run build:vercel`
- `git diff --check`
