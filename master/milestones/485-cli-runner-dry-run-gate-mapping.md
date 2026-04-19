# Milestone 485 - CLI Runner Dry-Run Gate Mapping

## Goal

Expose the same dry-run gate model operators receive in Codex/Claude contract markdown directly in the visible CLI Runner Readiness Gate.

## Scope

- [x] Mirror the dry-run API decision rules for target-baseline audit, audit-baseline runs, and alert-baseline drift tasks in the readiness UI.
- [x] Add visible preflight cards with gate decisions, evidence counts, and required action text.
- [x] Keep the cards non-executing and advisory so external CLI execution remains bounded to explicit work-order contracts.
- [x] Add parser coverage for the new visible gate mapping.
- [x] Validate, relaunch, commit, and push.

## Validation

- [x] `node --check ui\dashboard-components.js`
- [x] `node --check test-parse.js`
- [x] `node test-parse.js`
- [x] `git diff --check`
- [x] `npm test`
- [x] `npm run build:vercel`
- [x] Local smoke after relaunch: `root=200`, `dryRun=hold`, `alertGate=ready`, `alertTasks=0/1`, `prompt=True`, `markdown=True`, `mutation=0/110`

## Status

Completed.
