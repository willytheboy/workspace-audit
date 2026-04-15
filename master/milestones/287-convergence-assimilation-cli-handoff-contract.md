# Milestone 287 - Convergence Assimilation CLI Handoff Contract

Status: Completed
Date: 2026-04-15

## Outcome

- Added `/api/convergence/assimilation-cli-handoff-contract` for Codex and Claude runner contracts.
- Included the current convergence assimilation readiness gate, execution mode, no-secrets policy, expected result schema, and recommended handoff action.
- Added Governance copy buttons for Codex and Claude contracts beside the readiness gate.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-types.js`
- `node --check tests\server.test.mjs`
- `node --check test-parse.js`
- `node test-parse.js`
- `npm test`
- `npm run build:vercel`
- `git diff --check`

## Notes

- This contract is the bridge between the control center and external Codex CLI / Claude CLI execution. It is deliberately non-executing and metadata-only until a supervised adapter is implemented.
