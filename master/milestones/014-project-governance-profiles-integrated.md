# 014 Project Governance Profiles Integrated

Date: 2026-04-10

## Outcome

- Added persisted governance profiles for individual projects so the control-center layer can track ownership, lifecycle, tier, and target state directly.
- Extended the workbench overview with a saveable governance profile form and summary card.
- Promoted the Governance view into a real project registry by surfacing the saved profile metadata across the portfolio.

## Delivered

- `lib/workspace-audit-store.mjs`
  - Added `projectProfiles` to the persisted store schema.
- `lib/workspace-audit-server.mjs`
  - Added `GET /api/project-profiles`.
  - Added `POST /api/project-profiles` as an upsert endpoint keyed by `projectId`.
  - Extended diagnostics and governance rollups with profile counts and profile activity.
- `ui/dashboard-api.js`
  - Added `fetchProjectProfiles()` and `saveProjectProfile()`.
- `template.html`
  - Added the Governance Profile section to the project workbench overview.
- `ui/dashboard-modal.js`
  - Loads and saves governance profiles per project.
  - Renders governance profile state into the workbench header and overview.
- `ui/dashboard-components.js`
  - Governance deck now includes a Project Registry section.
- `tests/server.test.mjs`
  - Covers project profile persistence and governance rollup updates.

## Validation

- `npm test`
- `node .\generate-audit.mjs`
- `node .\test-parse.js`
