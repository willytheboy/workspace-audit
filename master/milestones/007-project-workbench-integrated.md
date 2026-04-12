# 007 Project Workbench Integrated

Date: 2026-04-10

## Scope

- Replaced the old project detail popup with a tabbed project workbench / launchpad
- Linked the workbench to persisted findings, tasks, and workflows
- Added project-scoped task and workflow persistence behaviors
- Added live launchpad actions and script execution inside the new workbench shell

## Delivered

- `ui/dashboard-modal.js` now orchestrates a multi-tab workbench:
  - overview
  - findings
  - tasks
  - workflow
  - launchpad
- `template.html` now provides a structured workbench shell instead of a large inline-style detail popup
- `styles.css` now includes dedicated workbench layout and form styles
- `lib/workspace-audit-server.mjs` now supports project-filtered:
  - `GET /api/findings?projectId=...`
  - `GET /api/tasks?projectId=...`
  - `GET /api/workflows?projectId=...`
  - `PATCH /api/workflows/:id`
- Project-linked tasks and workflows now persist `projectId` and `projectName`

## Result

- The master TODO for the current integration track is fully complete.
- The app now has:
  - control-center actions
  - source onboarding
  - settings / diagnostics
  - durable persistence
  - a project workbench / launchpad
