# Milestone 275 - Convergence Candidate Due Diligence Pack

Status: Complete
Date: 2026-04-15

## Objective

Give each Convergence Review candidate a copyable due diligence pack that explains why the pair exists, what the operator or AI knows, what tasks are linked, and what the next action should be.

## Scope

- Add `/api/convergence/due-diligence-pack?pairId=...` for single-candidate evidence packs.
- Include generated reasons, AI insight, operator note, review status, project snapshots, related Convergence Review tasks, related drift checkpoints, and a recommended next action.
- Add a Governance `Copy Pack` control on convergence candidate cards.
- Preserve the no-secrets policy for credentials, provider tokens, repository tokens, cookies, certificates, private keys, browser sessions, and command output.

## Validation

- Passed `node --check lib\workspace-audit-server.mjs`
- Passed `node --check ui\dashboard-api.js`
- Passed `node --check ui\dashboard-components.js`
- Passed `node --check ui\dashboard-views.js`
- Passed `node --check ui\dashboard-types.js`
- Passed `node --check tests\server.test.mjs`
- Passed `node --check test-parse.js`
- Passed `node test-parse.js`
- Passed `npm test`
- Passed `npm run build:vercel`
- Passed `git diff --check`
- Relaunched local app on port 3042 with current backend PID 157176.
- Smoke check passed for `/`, `/api/convergence/candidates`, `/api/convergence/due-diligence-pack`, and UI/API bundle markers.
