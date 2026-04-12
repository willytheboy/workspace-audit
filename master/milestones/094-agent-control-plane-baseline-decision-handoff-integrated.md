# 094 - Agent Control Plane Baseline Decision Handoff Integrated

## Status

Completed.

## Summary

Carry Control Plane baseline drift severity and drift action through Governance baseline status payloads, visible Governance reporting, and consolidated Agent Control Plane markdown handoffs.

## Scope

- Add baseline drift severity and drift action to Governance baseline summary and status payloads.
- Surface the drift decision in consolidated Agent Control Plane markdown and Governance report text.
- Add API assertions, parser checks, README documentation, and TODO tracking.

## Validation

- `node --check` passed for the updated server, UI types, UI components, UI views, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed, including the Agent control plane baseline decision handoff parser check.
- Relaunched `npm run dev` on port `3042` with PID `209108`.
- Live verification passed: the GUI shell served successfully, `/api/inventory` reports 75 app profiles, `/api/governance` returns baseline drift severity/action, and `/api/agent-control-plane` includes the same baseline decision fields in JSON and markdown.
