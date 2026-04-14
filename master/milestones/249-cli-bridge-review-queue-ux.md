# Milestone 249 - CLI Bridge Review Queue UX

Status: completed
Date: 2026-04-14

## Objective

Turn the CLI bridge handoff ledger into a review queue that prioritizes unresolved runner results and gives the operator quick filtered views.

## Implementation

- Added status filtering to `GET /api/cli-bridge/handoffs`.
- Added CLI bridge handoff summary counters for proposed, accepted, rejected, needs-review, review queue, escalated, and runner-result records.
- Added Governance summary fields for CLI bridge handoff review queue state.
- Prioritized needs-review, proposed, and escalated handoffs before accepted and rejected history in Governance.
- Added review queue summary output to the copyable handoff ledger Markdown.
- Added `Copy Needs Review`, `Copy Accepted`, and `Copy Rejected` ledger controls.
- Updated dashboard API and typedef coverage for status filters and summary payloads.
- Added parser and server test coverage for review queue filtering and summary counts.

## Safety Boundary

This milestone changes ledger visibility and filtering only. It does not execute CLI tools, does not auto-accept runner output, and does not store secrets or raw credential-bearing output.

## Validation

- [x] `node --check lib\workspace-audit-server.mjs`
- [x] `node --check ui\dashboard-api.js`
- [x] `node --check ui\dashboard-components.js`
- [x] `node --check ui\dashboard-views.js`
- [x] `node --check ui\dashboard-types.js`
- [x] `node --check tests\server.test.mjs`
- [x] `node --check test-parse.js`
- [x] Parser checkpoint scan with `CLI bridge review queue UX: Present`
- [x] `git diff --check`
- [x] `npm test`
- [x] `npm run build:vercel`
- [x] Relaunch/local smoke on `http://127.0.0.1:3042/`
- [x] Commit and push
