# 072 - Agent Control Plane Export Integrated

## Status

Completed.

## Summary

Added a UI export action for the consolidated Agent Control Plane payload so the control center can copy the same markdown handoff exposed by `GET /api/agent-control-plane`.

## Scope

- Added a Governance toolbar `Copy Control Plane` action.
- Added a command-palette `Copy agent control plane` action.
- Reused the live Agent Control Plane API markdown payload instead of duplicating browser-side formatting.
- Added parser checks, README documentation, and TODO tracking.

## Validation

- `node --check .\ui\dashboard-views.js`
- `node --check .\app.js`
- `node --check .\ui\dashboard-actions.js`
- `node --check .\test-parse.js`
- `npm test`
- `node .\generate-audit.mjs`
- `node .\test-parse.js`
- App relaunched on port `3042`; live GUI, inventory, and Agent Control Plane copy/API markers verified.
