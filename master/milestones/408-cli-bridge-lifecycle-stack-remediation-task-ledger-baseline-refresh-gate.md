# Milestone 408: CLI Bridge Lifecycle Stack Remediation Task Ledger Baseline Refresh Gate

Date: 2026-04-16

## Objective

Add an explicit refresh gate to the CLI bridge lifecycle remediation task ledger baseline so operators can see whether accepting live drift is ready, review-only, or blocked before the next Codex CLI or Claude CLI handoff.

## Delivered

- Added refresh gate fields to the remediation task ledger baseline-status payload.
- Classified refresh readiness as `ready`, `review`, or `hold` from baseline freshness, drift score, drift severity, uncheckpointed drift, and open escalated drift checkpoints.
- Added copyable Markdown refresh gate reasons to the baseline-status report.
- Surfaced refresh gate state and reasons in Governance.
- Disabled Accept Drift and Refresh Baseline buttons when the gate is on hold.
- Added report export, parser, and server test coverage for ready, hold, and refreshed states.

## Validation

- Passed `node --check` for the touched server, dashboard, parser, and test modules.
- Passed `npm test`.
- Passed `node test-parse.js`.
- Passed `npm run build:vercel`.
- Passed `git diff --check`.
- Relaunched the local app on port `3042` and smoke-tested the root route, Governance API, remediation task ledger baseline-status refresh-gate fields, and latest remediation task ledger drift endpoint.
