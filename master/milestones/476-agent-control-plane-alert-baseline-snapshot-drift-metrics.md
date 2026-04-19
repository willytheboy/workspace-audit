# Milestone 476 - Agent Control Plane Alert Baseline Snapshot Drift Metrics

## Goal

Make Agent Control Plane snapshot drift detect changes in the accepted Regression Alert baseline snapshot itself, not only run-level alert-baseline capture counts.

## Scope

- [x] Add accepted Regression Alert baseline snapshot drift score to Control Plane snapshot drift metrics.
- [x] Add accepted Regression Alert baseline uncheckpointed drift and snapshot count metrics.
- [x] Include parser and server-test coverage for the new snapshot drift metrics.
- [x] Validate syntax, parser sentinels, full tests, Vercel build, and local relaunch.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check test-parse.js`
- `node --check tests\server.test.mjs`
- `node test-parse.js`
- `git diff --check`
- `npm test`
- `npm run build:vercel`
- Local smoke: root `200`, latest snapshot drift `high`, alert snapshot drift score `0->0`, alert snapshot count `0->2`, mutation scope `0/110`.

## Status

Completed.
