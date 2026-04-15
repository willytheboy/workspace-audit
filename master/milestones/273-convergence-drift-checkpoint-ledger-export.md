# Milestone 273 - Convergence Drift Checkpoint Ledger Export

Status: Complete
Date: 2026-04-15

## Objective

Provide a copyable, non-secret Convergence Review task-ledger drift checkpoint ledger for operator review, CLI runner handoff, and future autonomous assimilation planning.

## Scope

- Add a GET ledger export to `/api/convergence/task-ledger-drift-checkpoints`.
- Include checkpoint decision counts, open/closed split, unique snapshot count, unique drift field count, priority split, and item metadata.
- Add a Governance copy action beside the latest Convergence task-ledger drift controls.
- Preserve the no-secrets policy for credentials, provider tokens, repository tokens, cookies, certificates, private keys, browser sessions, and command output.

## Validation

- Passed: `node --check lib\workspace-audit-server.mjs`
- Passed: `node --check ui\dashboard-api.js`
- Passed: `node --check ui\dashboard-components.js`
- Passed: `node --check ui\dashboard-views.js`
- Passed: `node --check ui\dashboard-types.js`
- Passed: `node --check tests\server.test.mjs`
- Passed: `node --check test-parse.js`
- Passed: `node test-parse.js`
- Passed: `npm test`
- Passed: `npm run build:vercel`
- Passed: `git diff --check`
- Relaunched local app on port 3042 and smoke-tested the root page, Convergence Review task-ledger drift checkpoint ledger endpoint, dashboard API bundle marker, and dashboard component copy-control marker.
