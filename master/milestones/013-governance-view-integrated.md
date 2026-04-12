# 013 Governance View Integrated

Date: 2026-04-10

## Outcome

- Added a dedicated portfolio governance surface above the per-project workbench.
- Rolled up persisted notes, milestones, workflows, tasks, findings, and recent activity into a cross-project control view.
- Wired governance into the same runtime panel model, top-level navigation, command palette, settings actions, and live refresh flow as the other control-center views.

## Delivered

- `lib/workspace-audit-server.mjs`
  - Added `GET /api/governance`.
  - Added governance aggregation for decisions, milestone focus, workflow focus, and recent portfolio activity.
- `ui/dashboard-api.js`
  - Added `fetchGovernance()`.
- `ui/dashboard-components.js`
  - Added governance summary and deck renderers.
- `ui/dashboard-views.js`
  - Added `renderGovernance()` and governance panel runtime handling.
- `app.js`
  - Added governance refresh flow and button binding.
- `ui/dashboard-actions.js`
  - Added governance navigation and refresh actions.
- `ui/dashboard-settings.js`
  - Added governance refresh action and diagnostics display for the governance panel state.
- `template.html`
  - Added the Governance top-level view and panel shell.

## Validation

- `npm test`
- `node .\generate-audit.mjs`
- `node .\test-parse.js`
