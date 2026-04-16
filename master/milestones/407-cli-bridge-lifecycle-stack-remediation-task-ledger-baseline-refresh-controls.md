# Milestone 407: CLI Bridge Lifecycle Stack Remediation Task Ledger Baseline Refresh Controls

Date: 2026-04-16

## Objective

Add an operator-controlled refresh path for the CLI bridge lifecycle remediation task ledger baseline so reviewed drift can be accepted into a new saved snapshot before the next Codex CLI or Claude CLI handoff.

## Delivered

- Added `/api/cli-bridge/lifecycle-stack-remediation-task-ledger-snapshots/refresh`.
- Created refreshed remediation task ledger snapshots from the current live ledger while preserving the prior snapshot ID in the governance operation log.
- Added dashboard API support for the refresh action.
- Added Refresh Baseline and Accept Drift controls to remediation task ledger snapshot cards, the latest drift card, and the baseline-status card.
- Wired the Governance click handler to refresh the saved baseline and rerender current health.
- Added parser coverage and server assertions that refreshed baselines clear latest drift and become the selected baseline.

## Validation

- Passed `node --check` for the touched server, dashboard, parser, and test modules.
- Passed `npm test`.
- Passed `node test-parse.js`.
- Passed `npm run build:vercel`.
- Passed `git diff --check`.
- Relaunched the local app on port `3042` and smoke-tested the root route, Governance API, remediation task ledger baseline-status endpoint, and latest remediation task ledger drift endpoint.
