# Milestone 483 - CLI Bridge Runner Alert Baseline Drift Task Gate

## Goal

Make unresolved Agent Execution Regression Alert baseline drift tasks a first-class gate in Codex/Claude runner dry-run contracts.

## Scope

- [x] Add `createCliBridgeAlertBaselineDriftTaskGate` to compute ready/review state from Control Plane drift tasks.
- [x] Surface the gate in runner dry-run markdown and command envelopes.
- [x] Persist gate state in dry-run snapshots and include it in snapshot drift comparisons.
- [x] Add tests for clean and open-task gate states.

## Validation

- [x] `node --check lib\workspace-audit-server.mjs`
- [x] `node --check ui\dashboard-types.js`
- [x] `node --check test-parse.js`
- [x] `node --check tests\server.test.mjs`
- [x] `node test-parse.js`
- [x] `git diff --check`
- [x] `npm test`
- [x] `npm run build:vercel`
- [x] Local smoke after relaunch: `root=200`, `dryRun=hold`, `alertGate=ready`, `alertTasks=0/1`, `prompt=True`, `markdown=True`, `mutation=0/110`

## Status

Completed.
