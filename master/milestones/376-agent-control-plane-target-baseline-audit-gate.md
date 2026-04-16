# Milestone 376 - Agent Control Plane Target Baseline Audit Gate

## Objective

Make the Agent Control Plane and CLI bridge aware of the accepted Agent Execution target-baseline audit snapshot state before supervised Codex or Claude build work proceeds.

## Completed

- Added target-baseline audit baseline health, freshness, drift severity, drift score, and uncheckpointed drift counts to Agent Control Plane decisions.
- Added review reasons for missing, stale, drift-review-required, and drifted target-baseline audit baselines.
- Added target-baseline audit baseline evidence to Agent Control Plane Markdown.
- Added target-baseline audit baseline tags/details to the Governance Control Plane decision card.
- Added target-baseline audit baseline evidence to CLI bridge context Markdown and dry-run prompts.
- Added parser and server test coverage.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check tests\server.test.mjs`
- `node --check test-parse.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`

## Relaunch

- Relaunched local app on PID `223136`.
- Root smoke check returned `200`.
- Governance smoke returned Agent Control Plane decision `hold`, audit baseline health `missing`, freshness `missing`, and the audit-baseline review reason present.
- Agent Control Plane smoke confirmed target-baseline audit baseline Markdown and status payload are present.
- CLI bridge context smoke returned decision `hold`, audit baseline health `missing`, and target-baseline audit baseline Markdown present.
