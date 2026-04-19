# Milestone 484 - CLI Bridge Runner Alert Baseline Drift Task Gate UI

## Goal

Make the alert-baseline drift task gate visible anywhere operators review or copy CLI bridge runner dry-run snapshots.

## Scope

- [x] Add alert-drift gate tags and task counts to saved dry-run snapshot cards.
- [x] Include alert-drift gate decisions in Governance markdown exports and lifecycle item task descriptions.
- [x] Extend the server lifecycle ledger so saved dry-run lifecycle records carry alert-drift gate decisions.
- [x] Add parser and server-test coverage for the new UI and markdown surfaces.
- [x] Validate, relaunch, commit, and push.

## Validation

- [x] `node --check lib\workspace-audit-server.mjs`
- [x] `node --check ui\dashboard-components.js`
- [x] `node --check ui\dashboard-views.js`
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
