# Milestone 245 - CLI Bridge Runner Dry-Run Contract

Status: completed
Date: 2026-04-14

## Objective

Create the first safe runner-facing contract for Codex CLI and Claude CLI without letting Workspace Audit Pro execute external agents yet.

## Implementation

- Added `GET /api/cli-bridge/runner-dry-run`.
- Added runner normalization for Codex and Claude dry-run contracts.
- Added sanitized selected-work-order contracts from queued Agent Work Order runs, with fallback to readiness work orders when no run is selected.
- Added non-executing command envelopes for `codex exec` and `claude -p --output-format json`.
- Added expected output schema guidance for status, summary, changed files, validation results, blockers, next action, and handoff recommendation.
- Added Markdown output for copy/paste dry-run use.
- Added dashboard API and typedef coverage.
- Added Governance `Copy Codex Dry Run` and `Copy Claude Dry Run` controls.
- Added parser and server test coverage.

## Safety Boundary

The endpoint is a dry-run contract generator only. It does not launch Codex CLI, does not launch Claude CLI, does not write prompt files, does not execute shell commands, and does not store secrets. The app still acts as the work-order broker and requires non-secret handoff recording before follow-up runner work.

## Validation

- [x] `node --check lib\workspace-audit-server.mjs`
- [x] `node --check ui\dashboard-api.js`
- [x] `node --check ui\dashboard-components.js`
- [x] `node --check ui\dashboard-views.js`
- [x] `node --check ui\dashboard-types.js`
- [x] `node --check tests\server.test.mjs`
- [x] `node --check test-parse.js`
- [x] Parser checkpoint scan with `CLI bridge runner dry-run contract: Present`
- [x] `git diff --check`
- [x] `npm test`
- [x] `npm run build:vercel`
- [x] Relaunch/local smoke on `http://127.0.0.1:3042/`
- [x] Commit and push
