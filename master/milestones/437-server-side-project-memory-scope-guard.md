# Milestone 437 - Server-Side Project Memory Scope Guard

## Objective

Protect direct project-memory writes from accidental unscoped persistence by requiring explicit active project scope or portfolio scope before workflows, notes, milestones, or agent handoff sessions are saved.

## Completed

- Added server-side scope validation to workflow creation and updates.
- Added server-side scope validation to note creation and updates.
- Added server-side scope validation to milestone creation and updates.
- Added server-side scope validation to agent-session creation.
- Prevented workflow, note, and milestone patch scope metadata from being persisted onto records.
- Propagated dashboard scope metadata into Governance queue workflow and decision-note actions.
- Propagated project-scoped workbench metadata into workflow, note, milestone, and agent-handoff session actions.
- Added parser coverage for the project-memory scope guard.
- Added server coverage for unscoped direct workflow, note, milestone, and agent-session API writes.

## Validation

- Passed: `node --check lib\workspace-audit-server.mjs`
- Passed: `node --check ui\dashboard-api.js`
- Passed: `node --check ui\dashboard-views.js`
- Passed: `node --check ui\dashboard-modal.js`
- Passed: `node --check tests\server.test.mjs`
- Passed: `node --check test-parse.js`
- Passed: `node test-parse.js`
- Passed: `npm test`
- Passed: `npm run build:vercel`
- Passed: `git diff --check`
- Passed: local relaunch and smoke test on port `3042` with PID `300880`

## Result

Direct project-memory mutation now requires deliberate active project or portfolio scope, closing workflow, note, milestone, and agent handoff session write gaps before the platform advances toward supervised CLI runner orchestration.
