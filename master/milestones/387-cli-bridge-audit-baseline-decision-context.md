# Milestone 387 - CLI Bridge Audit Baseline Decision Context

## Status

- Completed

## Objective

Carry Agent Control Plane audit-baseline execution evidence into CLI Bridge context packs and bounded runner prompts for Codex CLI and Claude CLI.

## Changes

- Added audit-baseline captured, missing, healthy, review-required, and uncheckpointed drift counts to CLI Bridge control-plane decision context.
- Added audit-baseline execution count lines to CLI Bridge context Markdown.
- Added audit-baseline execution count lines to runner dry-run prompts.
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
- Smoke checks passed: app shell returned `200`, CLI Bridge context included `Execution audit snapshot baseline runs`, and Codex dry-run prompts included the same audit-baseline decision line.
