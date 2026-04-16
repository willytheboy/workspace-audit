# Milestone 382 - CLI Bridge Run Trace Audit Baseline

## Objective

Carry target-baseline audit snapshot status into CLI bridge run traces so Codex/Claude review packets and saved trace baselines show both profile-target readiness and audit-snapshot readiness.

## Implementation

- Added target-baseline audit snapshot health, freshness, drift severity, uncheckpointed drift count, and baseline status payload to CLI bridge run traces.
- Added a `Target Baseline Audit Snapshot` section to CLI bridge run trace Markdown.
- Persisted audit-baseline fields on CLI bridge run trace snapshots.
- Added audit-baseline fields to run trace summary comparison so trace snapshot drift can flag audit-baseline changes.
- Added audit-baseline tags to CLI trace snapshot cards.
- Extended type documentation, parser checks, and server tests.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-components.js`
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
- Smoke check: `/api/cli-bridge/runs/:runId/trace` returned `cli-bridge-run-trace.v1` with audit-baseline fields and `Target Baseline Audit Snapshot` Markdown.
