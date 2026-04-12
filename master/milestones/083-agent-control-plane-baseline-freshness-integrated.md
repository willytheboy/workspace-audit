# 083 - Agent Control Plane Baseline Freshness Integrated

## Status

Completed.

## Summary

Added freshness metadata for Agent Control Plane baselines so operators can tell whether a selected baseline is current enough to trust for drift decisions.

## Scope

- Added baseline age and freshness metadata with a 24-hour stale threshold.
- Added freshness metadata to Governance summary payloads and the baseline status API.
- Surfaced freshness in the Governance KPI card, Baseline Status deck section, summary text, and markdown report.
- Added API assertions, parser checks, README documentation, and TODO tracking.

## Validation

- `node --check` passed for the updated server, UI types, UI components, UI views, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed, including the Agent control plane baseline freshness parser check.
- Relaunched `npm run dev` on port `3042` with PID `187140`.
- Live verification passed: the GUI shell served successfully, `dashboard-components.js` includes the freshness UI marker, `/api/inventory` reports 75 app profiles, `/api/governance` reports baseline freshness as `missing`, and `/api/agent-control-plane/baseline-status` reports `hasBaseline: false`, `baselineFreshness: missing`, `baselineAgeHours: 0`, and a 24-hour stale threshold.
