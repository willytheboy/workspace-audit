# Milestone 270 - Convergence Review Task Ledger Drift Checkpoint Upserts

Status: Complete
Date: 2026-04-14

## Objective

Make Convergence Review task-ledger drift item decisions duplicate-safe so repeated operator clicks update one checkpoint task instead of creating noisy duplicate tasks.

## Scope

- Add a server-side `/api/convergence/task-ledger-drift-checkpoints` endpoint.
- Resolve latest or specific task-ledger snapshot drift on the server before creating checkpoint tasks.
- Persist non-secret drift metadata on checkpoint tasks for later ledger exports and snapshot comparisons.
- Update existing checkpoint tasks when the same snapshot and drift field are decided again.
- Preserve the no-secrets policy for credentials, provider tokens, repository tokens, cookies, certificates, private keys, browser sessions, and command output.

## Validation

- Passed: `node --check lib\workspace-audit-server.mjs`
- Passed: `node --check ui\dashboard-api.js`
- Passed: `node --check ui\dashboard-views.js`
- Passed: `node --check ui\dashboard-types.js`
- Passed: `node --check tests\server.test.mjs`
- Passed: `node --check test-parse.js`
- Passed: `node test-parse.js`
- Passed: `npm test`
- Passed: `npm run build:vercel`
- Passed: `git diff --check`
- Relaunched local app on port 3042 and smoke-tested the root page, latest Convergence Review task-ledger snapshot drift endpoint, dashboard API bundle, and dashboard views bundle.
