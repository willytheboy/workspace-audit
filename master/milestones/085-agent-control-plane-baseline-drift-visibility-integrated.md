# 085 - Agent Control Plane Baseline Drift Visibility Integrated

## Status

Completed.

## Summary

Added an immediate baseline drift signal to Governance so operators can see whether the selected Agent Control Plane baseline summary still matches current control-plane state before opening detailed drift reports.

## Scope

- Added Governance summary metadata for baseline drift presence and drift score.
- Added drift score fields to the visible Control Plane Baseline Status payload.
- Surfaced drift score in the Control Plane Baseline KPI, Baseline Status deck, copied summaries, and markdown reports.
- Added API assertions, parser checks, README documentation, and TODO tracking.

## Validation

- `node --check` passed for the updated server, UI types, UI components, UI views, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed, including the Agent control plane baseline drift visibility parser check.
- Relaunched `npm run dev` on port `3042` with PID `190000`.
- Live verification passed: the GUI shell served successfully, UI bundles include the baseline drift tag and summary text, `/api/inventory` reports 75 app profiles, and `/api/governance` reports baseline drift fields on both `summary` and `agentControlPlaneBaselineStatus`.
