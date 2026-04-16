# Milestone 378 - CLI Runner Dry-Run Audit Baseline Gate

## Objective

Make Codex CLI and Claude CLI dry-run contracts explicitly gate on the Agent Execution target-baseline audit snapshot state before a prompt is copied into any supervised runner workflow.

## Completed

- Added `createCliBridgeTargetBaselineAuditGate` to derive dry-run readiness from audit-baseline health, freshness, drift score, and uncheckpointed drift count.
- Added `targetBaselineAuditGate` to CLI runner dry-run payloads and command envelopes.
- Added a dedicated Target Baseline Audit Gate section to dry-run Markdown.
- Added the audit gate line to dry-run prompts so external runners receive the same readiness instruction.
- Added Audit health/freshness visibility to the Governance CLI runner readiness card.
- Added type, parser, and server test coverage.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-types.js`
- `node --check tests\server.test.mjs`
- `node --check test-parse.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

- Relaunched local app on PID `243176`.
- Root smoke check returned `200`.
- CLI runner dry-run smoke returned decision `hold`, audit gate `review/missing`, and prompt audit-gate line present.
- Governance smoke returned target-baseline audit baseline health `missing` and CLI bridge handoff count `0`.
