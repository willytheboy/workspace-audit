# Milestone 241 - CLI Bridge Context API

Status: completed
Date: 2026-04-14

## Objective

Expose a non-executing context-pack API that future Codex CLI and Claude CLI adapters can consume without bypassing Workspace Audit Pro governance gates.

## Implementation

- Added `GET /api/cli-bridge/context`.
- Added `createCliBridgeContextPayload` with protocol version `cli-bridge-context.v1`.
- Added `buildCliBridgeContextMarkdown` for copyable/supervised handoff context.
- Added runner filtering for `all`, `codex`, and `claude`.
- Returned bridge decision, recommended action, control-plane decision summary, sanitized work orders, executable work-order count, adapter guidance, handoff contract, validation loop, and no-secrets policy.
- Added dashboard API method `fetchCliBridgeContext`.
- Added `CliBridgeAdapter` and `CliBridgeContextPayload` typedefs.
- Added parser and server test coverage.

## Safety Boundary

This endpoint does not run Codex CLI or Claude CLI. It only prepares the broker-owned context required for a future supervised runner adapter. Secrets, credentials, certificate payloads, private keys, cookies, browser sessions, and raw command output containing secrets must stay outside the payload.

## Validation

- [x] `node --check lib\workspace-audit-server.mjs`
- [x] `node --check ui\dashboard-api.js`
- [x] `node --check ui\dashboard-types.js`
- [x] `node --check tests\server.test.mjs`
- [x] `node --check test-parse.js`
- [x] Parser checkpoint scan with `CLI bridge context API: Present`
- [x] `git diff --check`
- [x] `npm test`
- [x] `npm run build:vercel`
- [x] Relaunch/local smoke on `http://127.0.0.1:3042/`
- [x] Commit and push
