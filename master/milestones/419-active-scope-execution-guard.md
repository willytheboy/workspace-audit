# Milestone 419: Active Scope Execution Guard

Status: Completed

## Objective

Prevent high-impact execution controls from running without an explicit active project or portfolio-mode decision.

## Scope

- Disable execution buttons while scope is missing.
- Keep runtime guards inside direct action handlers so command-palette routes cannot bypass the UI disabled state.
- Cover governance queue execution, queued agent starts, stale run blocking, SLA action/resolution, retry/archive flows, and retention application.
- Add parser coverage for the guarded controls.

## Validation

- `node --check app.js`
- `node --check test-parse.js`
- `node test-parse.js`
- `npm test`
- `npm run build:vercel`
- `git diff --check`

## Outcome

- Added a guarded execution control registry for governance queue execution, queued agent run start, stale-run blocking, SLA action/resolution, retry/archive flows, and retention application.
- Buttons are disabled with explicit scope guidance until a project is selected or portfolio mode is enabled.
- Action handlers now call the same active-project guard, so command-palette and direct handler routes cannot bypass the UI disabled state.
- Parser coverage now verifies the guarded control set.
