# Milestone 278 - Convergence Assimilation Work-Order Drafts

Status: Complete
Date: 2026-04-15

## Objective

Turn convergence assimilation blueprints into runner-specific, non-executing work-order drafts that can be copied into Codex CLI, Claude CLI, or a future supervised adapter.

## Scope

- Add `/api/convergence/assimilation-work-order-draft?pairId=...&runner=codex|claude`.
- Include draft decision, readiness reason, blueprint context, validation commands, acceptance criteria, risks, and structured runner prompt.
- Add Governance `Copy Codex Draft` and `Copy Claude Draft` controls on convergence queue and ledger cards.
- Preserve the app-owned broker model: the CLIs do not communicate directly and no secrets are stored.

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
- Relaunched local app on port 3042 with current backend PID 217744.
- Smoke check passed for `/`, `/api/convergence/assimilation-work-order-draft`, and UI/API bundle markers.
