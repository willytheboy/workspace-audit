# Milestone 177: Data Sources Access Validation Workflow Task Seeding

Status: Completed

## Scope

- Add API support for converting pending or blocked access validation workflow items into deduplicated non-secret Data Sources tasks.
- Surface Sources toolbar and command-palette actions for creating workflow tasks.
- Feed workflow task references into the Data Sources access task ledger and preserve non-secret evidence sync metadata.
- Add parser checks, server tests, docs, validation, relaunch, commit, push, and release-gate evidence.

## Validation

- `node --check` passed for the changed server, app, dashboard API, dashboard actions, dashboard views, dashboard types, parser, server tests, and test runner modules.
- `npm test` passed all 7 tests, including `sourceAccessValidationWorkflowTaskSeedingTest`.
- `node .\generate-audit.mjs` regenerated audit data across 75 detected projects.
- `node .\test-parse.js` reported Data sources access validation workflow tasks as present after regeneration.
- `npm run build:vercel` completed the local static preview build without deploying to Vercel.
- Local app relaunched on `http://127.0.0.1:3042/` as PID `203376`; the page returned HTTP 200 and included the `seed-sources-access-validation-workflow-tasks-btn` control.
