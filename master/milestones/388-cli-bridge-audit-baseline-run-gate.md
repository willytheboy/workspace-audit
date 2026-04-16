# Milestone 388 - CLI Bridge Audit Baseline Run Gate

## Status

- Completed

## Objective

Expose per-run audit-baseline capture status as a structured CLI Bridge dry-run gate for Codex and Claude adapter automation.

## Changes

- Added `createCliBridgeAuditBaselineRunGate` for captured, missing, healthy, review-required, and uncheckpointed drift run evidence.
- Added the audit-baseline run gate to CLI Bridge dry-run payloads and command envelopes.
- Added audit-baseline run gate review reasons when run evidence is not clean.
- Added a dedicated Markdown section in CLI Bridge Runner Dry Run reports.
- Added type, parser, and server test coverage.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-types.js`
- `node --check tests\server.test.mjs`
- `node --check test-parse.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

- Relaunched local app on `http://localhost:3042/`.
- Smoke checks passed: app shell returned `200`, Codex dry-run payload returned a structured `auditBaselineRunGate`, and Claude dry-run Markdown included `## Audit Baseline Run Gate`.
