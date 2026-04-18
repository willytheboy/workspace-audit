# Milestone 466 - Agent Work Order Regression Alert Baseline Capture

Date: 2026-04-18

## Goal

Persist Regression Alert remediation task ledger baseline state on Agent Work Order runs so each execution record shows the alert-remediation baseline condition present when it was queued.

## Changes

- Added `createAgentWorkOrderRunRegressionAlertBaselineFields` to capture non-secret Regression Alert baseline health, freshness, drift severity, drift score, refresh gate, uncheckpointed drift, and open escalated checkpoint counts.
- Applied the capture helper to manual Agent Work Order run queueing, snapshot batch queueing, CLI bridge follow-up queueing, convergence assimilation queueing, and launch-stack remediation queueing.
- Added run-level Regression Alert baseline evidence to the Agent Execution Queue card, execution Markdown export, and CLI dry-run prompt context.
- Added type coverage for the new run fields.
- Added parser and server-test coverage for the capture path.

## Validation

- `node --check` passed for the touched server, UI, parser, and server-test files.
- `node test-parse.js` reported `Agent work order regression alert baseline capture: Present`.
- `git diff --check` passed.
- `npm test` passed all 8 suites.
- `npm run build:vercel` generated the static preview.
- Local relaunch passed on `http://localhost:3042` with mutation scope `0/106`.
- Live smoke confirmed Governance run cards and CLI runner dry-run selected work orders expose `missing/ready` Regression Alert baseline capture values.

## Next

- Add a run-level Regression Alert baseline refresh or recapture action if operators need to update queued runs after baseline checkpoint review.
