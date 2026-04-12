# 089 - Agent Control Plane Baseline Health Handoff Integrated

## Status

Completed.

## Summary

Extend the consolidated Agent Control Plane API handoff so external platform consumers can read baseline health, recommended action, and compact drift-field evidence without making a separate Governance or baseline-status request.

## Scope

- Add `baselineStatus` to the consolidated `/api/agent-control-plane` JSON payload.
- Add baseline selected state, health, recommended action, drift score, and drift fields to the Agent Control Plane markdown handoff.
- Add saved Agent Handoff sessions to the consolidated payload and markdown so baseline drift can account for handoff changes.
- Add API assertions, parser checks, README documentation, and TODO tracking.

## Validation

- `node --check` passed for the updated server, UI types, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed, including the Agent control plane baseline health handoff and saved handoff parser checks.
- Relaunched `npm run dev` on port `3042` with PID `211272`.
- Live verification passed: the GUI shell served successfully, `/api/inventory` reports 75 app profiles, `/api/agent-control-plane` includes saved Agent Handoff sessions and baseline health/drift markdown, and `/api/agent-control-plane/baseline-status` now matches the consolidated baseline health and drift item count.
