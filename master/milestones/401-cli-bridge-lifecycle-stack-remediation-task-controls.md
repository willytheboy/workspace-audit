# Milestone 401: CLI Bridge Lifecycle Stack Remediation Task Controls

Date: 2026-04-16

## Objective

Make CLI bridge lifecycle remediation actionable inside Governance by turning the remediation pack and individual non-ready lifecycle stages into persisted tasks.

## Delivered

- Added a `Track Pack` control to create one Governance task from the full remediation pack.
- Added per-item `Track Item` controls for individual remediation work items.
- Generated non-secret task descriptions from remediation details, stage IDs, recommended actions, runner hints, and stack decision state.
- Reused the existing Governance task API so no new secret-bearing storage or schema was required.
- Added parser and milestone coverage.

## Validation

- Passed `node --check` for the changed dashboard modules and parser.
- Passed `npm test`.
- Passed `node test-parse.js`.
- Passed `npm run build:vercel`.
- Passed `git diff --check`.
- Relaunched the local app on port `3042` and smoke-tested the root route plus served dashboard task-control bundles.
