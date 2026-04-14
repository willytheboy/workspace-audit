# Milestone 246 - CLI Bridge Runner Result Intake

Status: completed
Date: 2026-04-14

## Objective

Add the receiving side of the CLI bridge so manual Codex CLI and Claude CLI dry-run outputs can be captured as non-secret app-owned handoffs.

## Implementation

- Added `POST /api/cli-bridge/runner-results`.
- Added runner-result status normalization for `ready`, `changed`, `blocked`, `failed`, and `needs-review`.
- Added handoff recommendation normalization for Codex, Claude, operator, and Workspace Audit follow-up routing.
- Converted runner-result payloads into `cliBridgeHandoffs` records with `runner-result:<status>` result types.
- Attached project and work-order-run metadata when a result references an existing Agent Work Order run.
- Added operation logging with `cli-bridge-runner-result-recorded`.
- Added dashboard API client support with `createCliBridgeRunnerResult`.
- Added optional result metadata fields to CLI bridge handoff typedefs.
- Added parser and server test coverage.

## Safety Boundary

The result-intake endpoint accepts only non-secret summaries. It does not execute CLI tools, does not validate raw command output automatically, does not accept credentials, and does not auto-accept runner results. Follow-up work still requires operator/control-plane review.

## Validation

- [x] `node --check lib\workspace-audit-server.mjs`
- [x] `node --check ui\dashboard-api.js`
- [x] `node --check ui\dashboard-types.js`
- [x] `node --check test-parse.js`
- [x] `node --check tests\server.test.mjs`
- [x] Parser checkpoint scan with `CLI bridge runner result intake: Present`
- [x] `git diff --check`
- [x] `npm test`
- [x] `npm run build:vercel`
- [x] Relaunch/local smoke on `http://127.0.0.1:3042/`
- [x] Commit and push
