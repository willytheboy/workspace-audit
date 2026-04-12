# 016 Governance Export Actions Integrated

Date: 2026-04-10

## Outcome

- Added portable reporting actions to the Governance view so filtered governance state can leave the UI.
- The governance layer can now generate a markdown report and copy a concise review summary based on the current filter scope.

## Delivered

- `template.html`
  - Added Governance panel buttons for `Copy Summary` and `Export Report`.
- `ui/dashboard-views.js`
  - Added filtered governance summary generation.
  - Added markdown report generation from the current governance filter state.
  - Added `copyGovernanceSummary()` and `exportGovernanceReport()`.
- `app.js`
  - Wired the Governance export/copy buttons.
- `ui/dashboard-actions.js`
  - Added command-palette actions for Governance reporting.
- `test-parse.js`
  - Added shell validation for governance export actions.

## Validation

- `npm test`
- `node .\generate-audit.mjs`
- `node .\test-parse.js`
