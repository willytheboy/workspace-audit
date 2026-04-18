# Milestone 465 - Agent Control Plane Regression Alert Baseline Gate

Date: 2026-04-18

## Goal

Make the Agent Control Plane aware of Regression Alert remediation task ledger baseline health before unattended or supervised app-building work proceeds.

## Changes

- Added Regression Alert task ledger baseline health, freshness, drift severity, drift score, refresh gate, uncheckpointed drift, and open escalated checkpoint counts to Agent Control Plane decisions.
- Added decision reasons for missing Regression Alert baselines, stale baselines, baseline drift review, and refresh holds caused by unresolved drift checkpoints.
- Surfaced the baseline in the Control Plane decision card, copied decision Markdown, CLI bridge context Markdown, and CLI runner dry-run prompt context.
- Preserved the new baseline fields in Agent Control Plane decision snapshots.
- Added parser and server-test coverage for the new gate.

## Validation

- `node --check` passed for the touched server, UI, parser, and server-test files.
- `node test-parse.js` reported `Agent control plane regression alert baseline gate: Present`.
- `git diff --check` passed.
- `npm test` passed all 8 suites.
- `npm run build:vercel` generated the static preview.
- Local relaunch passed on `http://localhost:3042` with mutation scope `0/106`.
- Live smoke confirmed `/api/agent-control-plane/decision` and `/api/cli-bridge/context?runner=codex` both expose Regression Alert baseline health and refresh gate fields.

## Next

- Carry Regression Alert baseline health into queued Agent Work Order run context so individual execution runs capture whether they were launched against a missing or drifted alert remediation baseline.
