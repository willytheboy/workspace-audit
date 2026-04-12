# 017 Governance Gap Registry Integrated

Date: 2026-04-10

## Outcome

- The Governance view now exposes projects that matter but still have no saved governance profile.
- Governance entries are now actionable: clicking a gap, profile, activity item, milestone, workflow, or decision-linked item can open the related project workbench directly.

## Delivered

- `lib/workspace-audit-server.mjs`
  - Governance rollups now merge persisted state with the live inventory.
  - Added `unprofiledProjects` to the governance payload.
  - Governance activity items now include project identifiers when available.
- `ui/dashboard-types.js`
  - Added `unprofiledProjects` and project-linked governance activity typing.
- `ui/dashboard-components.js`
  - Added the Governance Gaps section.
  - Made governance cards project-launch capable through `data-open-app-id`.
- `ui/dashboard-views.js`
  - Extended governance filtering and report generation to include gap entries.
  - Bound governance cards to the project workbench launcher.

## Validation

- `npm test`
- `node .\generate-audit.mjs`
- `node .\test-parse.js`
