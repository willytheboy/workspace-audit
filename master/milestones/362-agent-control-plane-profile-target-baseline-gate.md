# Milestone 362: Agent Control Plane Profile Target Baseline Gate

## Status

- Complete

## Objective

Make the Agent Control Plane aware of the Governance profile target task ledger baseline so autonomous build readiness is not based only on the control-plane baseline. Missing, stale, drifted, or uncheckpointed profile target task baselines must appear as explicit review gates before supervised app-building work proceeds.

## Completed Work

- Added profile target task ledger baseline health, freshness, drift severity, drift score, and uncheckpointed drift counts to the Agent Control Plane decision payload.
- Added review reasons for missing, stale, drift-review-required, and drifted profile target task baselines.
- Added profile target task baseline evidence to Agent Control Plane decision Markdown.
- Preserved target baseline state in Agent Control Plane decision snapshots.
- Surfaced target baseline health in the Governance Control Plane Decision card and Governance report.
- Added parser and bootstrap-test coverage for the new decision gate.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-types.js`
- `node --check test-parse.js`
- `node --check tests\governance-bootstrap.test.mjs`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

- Relaunched local app on `http://localhost:3042` with PID `240768`.
- Smoke checked `/`, `/api/agent-control-plane/decision`, `/api/governance`, and `/api/governance/profile-target-task-ledger-baseline-status`.
- Runtime target baseline status: `healthy`, `fresh`, `0` uncheckpointed drift items.
