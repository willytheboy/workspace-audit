# Milestone 482 - CLI Bridge Alert Baseline Drift Task Context

## Goal

Ensure Codex CLI and Claude CLI handoff context includes the same Agent Execution Regression Alert baseline drift-task gate that the Control Plane uses.

## Scope

- [x] Add alert-baseline drift task counts and task excerpts to CLI bridge context payloads.
- [x] Add alert-baseline drift task status to CLI bridge context markdown.
- [x] Add alert-baseline drift task status to runner dry-run prompts.
- [x] Add parser and server-test coverage for context and prompt visibility.

## Validation

- [x] `node --check lib\workspace-audit-server.mjs`
- [x] `node --check ui\dashboard-types.js`
- [x] `node --check test-parse.js`
- [x] `node --check tests\server.test.mjs`
- [x] `node test-parse.js`
- [x] `git diff --check`
- [x] `npm test`
- [x] `npm run build:vercel`
- [x] Local smoke after relaunch: `root=200`, `cliBridge=hold`, `alertDriftTasks=0/1`, `markdown=True`, `dryRun=hold`, `prompt=True`, `mutation=0/110`

## Status

Completed.
