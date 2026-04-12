# 018 Governance Gap Actions Integrated

Date: 2026-04-10

Completed:

- Added one-click `Create Profile` and `Create Task` actions directly to governance gap entries in the Governance view.
- Wired the actions to persisted project profile and task creation through the existing live API.
- Kept governance gap cards launchable into the project workbench while stopping action-button clicks from triggering unwanted modal opens.
- Updated the governance summary and report output so gap-driven actions sit inside the same portfolio review flow.

Validation:

- `npm test`
- `node .\generate-audit.mjs`
- `node .\test-parse.js`
