# Milestone 173 - Governance Task Update Audit Ledger Snapshots

## Status

Completed.

## Objective

Persist Governance task update audit ledger snapshots and make task-lifecycle audit drift copyable for external app-management and agent handoff workflows.

## Delivered

- Restored the generated Governance toolbar `Copy Task Audit` action in `template.html` so audit regeneration preserves the visible control.
- Added `GET` and `POST /api/governance/task-update-ledger-snapshots` for bounded non-secret task update audit handoff snapshots.
- Added `GET /api/governance/task-update-ledger-snapshots/diff?snapshotId=latest` with count and item-level drift evidence.
- Added Governance deck, toolbar, and command-palette actions for saving task audit snapshots and copying latest snapshot drift.
- Added parser checks, server regression assertions, README notes, and TODO completion tracking.

## Validation

- `node --check` passed for the changed store, server, UI API, UI types, UI views, UI actions, UI components, app, parser, and test modules.
- `node .\test-parse.js` reported Governance task update audit ledger snapshots as present after regenerating `index.html` from `template.html`.
- `npm test` passed all 6 tests, including task update audit ledger snapshot and drift assertions.
- `node .\generate-audit.mjs` regenerated audit data across 75 detected projects.
- `npm run build:vercel` completed the local static preview build without deploying to Vercel.
- Local app relaunched on `http://127.0.0.1:3042/` and returned HTTP 200.
