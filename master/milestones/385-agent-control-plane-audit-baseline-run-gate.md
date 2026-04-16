# Milestone 385 - Agent Control Plane Audit Baseline Run Gate

## Status

- Completed

## Objective

Make run-level target-baseline audit snapshot baseline capture actionable in the Agent Control Plane, not only visible in Governance metrics.

## Changes

- Added an `execution-audit-baseline-review` Agent Control Plane decision reason when active Agent Execution runs have missing, stale, or drifted target-baseline audit snapshot baseline evidence.
- Added audit-baseline execution counts to Agent Control Plane decision payloads and decision snapshots.
- Added audit snapshot baseline evidence to Agent Control Plane decision Markdown.
- Added the same audit-baseline execution blocker to the CLI runner readiness gate.
- Added type, parser, and server test coverage for the new decision gate.

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

- Relaunched local app on `http://localhost:3042/`.
- Smoke checks passed: app shell returned `200`, Agent Control Plane decision returned `execution-audit-baseline-review`, and Governance returned audit-baseline execution metrics.
