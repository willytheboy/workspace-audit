# Milestone 325: Convergence Assimilation Runner Launch Stack Action Task Ledger Checkpoint Lifecycle

## Completed

- Added direct Resolve, Reopen, and Block controls to launch stack action task ledger drift checkpoint cards.
- Added `openEscalated` counting to the action task ledger drift checkpoint ledger.
- Updated launch stack status so resolved escalated checkpoints no longer keep the action-task ledger checkpoint stage on hold.

## Product Value

The operator can now complete the drift review loop from the Governance convergence deck: create a checkpoint, accept the live baseline when appropriate, resolve the checkpoint task, and see the runner launch stack release that gate.

## Validation Targets

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-types.js`
- `node --check tests\server.test.mjs`
- `node --check test-parse.js`
- `node test-parse.js`
- `npm test`
- `npm run build:vercel`
- `git diff --check`
