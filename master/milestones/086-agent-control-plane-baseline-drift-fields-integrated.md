# 086 - Agent Control Plane Baseline Drift Fields Integrated

## Status

Completed.

## Summary

Added field-level baseline drift deltas so the Control Plane baseline score explains which summary counters changed since the selected baseline was saved.

## Scope

- Added baseline drift field metadata with labels, before/current values, and deltas.
- Added drift fields to the Governance summary and Baseline Status payload.
- Surfaced drift fields in the Baseline Status deck, copied summary text, and Governance markdown reports.
- Added API assertions, parser checks, README documentation, and TODO tracking.

## Validation

- `node --check` passed for the updated server, UI types, UI components, UI views, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed, including the Agent control plane baseline drift fields parser check.
- Relaunched `npm run dev` on port `3042` with PID `208636`.
- Live verification passed: the GUI shell served successfully, UI bundles include baseline drift field deck and summary markers, `/api/inventory` reports 75 app profiles, and `/api/governance` returns drift field arrays on both `summary` and `agentControlPlaneBaselineStatus`.
