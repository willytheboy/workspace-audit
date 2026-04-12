# Milestone 029 - Workflow Runbook Integrated

## Completed

- Added a derived Workflow Runbook to the Governance payload for active project workflows.
- Each runbook item now exposes phase, status, readiness, blockers, priority, and a recommended next step.
- Added a Governance deck section and filter scope for the runbook.
- Extended markdown reporting, parser checks, and lifecycle tests for the runbook.

## Validation

- `node --check` passed for changed server, UI, type, parser, and store modules.
- `npm test` passed.
- `node .\generate-audit.mjs` passed.
- `node .\test-parse.js` passed.
