# 093 - Agent Control Plane Baseline Status Drift Decision Integrated

## Status

Completed.

## Summary

Promote Control Plane drift severity and drift action into the direct baseline status API so external consumers can make a baseline-vs-live decision without parsing nested snapshot diff data.

## Scope

- Add top-level `driftSeverity` to `/api/agent-control-plane/baseline-status` JSON and markdown.
- Add top-level `driftRecommendedAction` to `/api/agent-control-plane/baseline-status` JSON and markdown.
- Add API assertions, parser checks, README documentation, and TODO tracking.

## Validation

- `node --check` passed for the updated server, UI types, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed, including the Agent control plane baseline status drift decision parser check.
- Relaunched `npm run dev` on port `3042` with PID `198356`.
- Live verification passed: the GUI shell served successfully, `/api/inventory` reports 75 app profiles, and `/api/agent-control-plane/baseline-status` returns top-level drift severity, drift recommended action, compact drift items, and markdown decision lines.
