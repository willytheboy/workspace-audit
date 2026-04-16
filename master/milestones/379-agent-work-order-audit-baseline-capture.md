# Milestone 379 - Agent Work Order Audit Baseline Capture

## Objective

Capture the current target-baseline audit snapshot health directly on every newly queued Agent Work Order run so execution records carry both profile-target baseline state and audit-baseline state at queue time.

## Implementation

- Added `createAgentWorkOrderRunTargetBaselineAuditFields` to derive audit-baseline health, freshness, drift severity, drift score, snapshot id, capture timestamp, uncheckpointed drift count, and recommended action from the latest Agent Execution target-baseline audit snapshot.
- Applied the capture to manually queued Agent Work Order runs, snapshot batch queueing, CLI bridge follow-up runs, convergence assimilation runs, and launch-stack remediation runs.
- Split the Agent Execution Queue card text into `Profile target baseline` and `Target baseline audit snapshot` lines.
- Added an `audit health/freshness` queue tag beside the existing profile-target tag.
- Extended run type documentation, parser checks, and server tests for audit-baseline capture.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-types.js`
- `node --check tests\server.test.mjs`
- `node --check test-parse.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

- Relaunched local app on port `3042`.
- Smoke check: `/` returned `200`.
- Smoke check: `/api/governance` returned successfully with `2` Agent Work Order run(s).
- Smoke check: `/api/cli-bridge/runner-dry-run?runner=codex&limit=5` returned audit gate `review/missing`.
