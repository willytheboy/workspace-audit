# Milestone 418: Scope-Aware CLI Bridge Handoff Packets

Status: Completed

## Objective

Thread the active project scope lock into CLI bridge lifecycle handoff packets so Codex CLI and Claude CLI launch briefs cannot silently operate without either an active project or explicit portfolio mode.

## Scope

- Add a non-secret `scopeContext` object to lifecycle handoff packets.
- Force launch-packet `hold` state when project mode has no active project.
- Persist scope metadata into lifecycle handoff packet snapshots.
- Include scope fields in lifecycle handoff packet snapshot drift comparison.
- Pass dashboard scope metadata through packet copy, snapshot, drift, checkpoint, and baseline-status API calls.

## Validation

- `node --check lib/workspace-audit-server.mjs`
- `node --check ui/dashboard-views.js`
- `node --check ui/dashboard-components.js`
- `node --check ui/dashboard-api.js`
- `node --check ui/dashboard-types.js`
- `node --check test-parse.js`
- `node --check tests/server.test.mjs`
- `node test-parse.js`
- `npm test`
- `npm run build:vercel`
- `git diff --check`

## Outcome

- Lifecycle handoff packets now include a `scopeContext` section with scope mode, active project identity, guard decision, and recommended scope action.
- Packets are forced to `hold` when project mode has no active project, preventing unscoped Codex CLI or Claude CLI launch packets.
- Handoff packet snapshots persist scope fields, and snapshot drift now treats scope changes as critical drift.
- Governance UI packet actions pass the current dashboard scope into copy, snapshot, drift, checkpoint, refresh, and baseline status flows.
