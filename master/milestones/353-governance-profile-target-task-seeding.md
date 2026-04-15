# Milestone 353 - Governance Profile Target Task Seeding

## Status

Completed.

## Goal

Convert scan-derived Governance profile target gaps into concrete, deduplicated tasks so missing tests and runtime launch gaps become actionable execution work.

## Delivered

- Added `createGovernanceProfileTargetTask` and task-key generation for profile test coverage and runtime surface gaps.
- Added `/api/governance/profile-targets/tasks` to seed deduplicated target tasks for all or visible scoped profile targets.
- Added task linkage back into Governance profile target records, including task status, task IDs, and missing task counts.
- Added Governance summary counts for profile target tasks and missing task coverage.
- Added a `Seed Target Tasks` toolbar action and command-palette command.
- Updated Governance cards, status summaries, and Markdown reports to show target task status.
- Updated bootstrap milestone target math so test targets are achievable and match profile target calculation.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check app.js`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-actions.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-types.js`
- `node --check test-parse.js`
- `node --check tests\governance-bootstrap.test.mjs`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`
- Relaunched local app on port `3042` with PID `247044`
- Live smoke: `/` returned `200`
- Live task seeding: `/api/governance/profile-targets/tasks` created `7` target tasks and skipped `9` already-satisfied or already-detected target items.
- Live governance summary: `8` scoped profile targets, `7` open target tasks, `0` missing target tasks, and `61` target test files outstanding.
