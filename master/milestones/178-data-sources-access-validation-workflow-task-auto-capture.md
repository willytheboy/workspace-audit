# Milestone 178: Data Sources Access Validation Workflow Task Auto Capture

Status: Completed

## Scope

- Add optional snapshot auto-capture to `POST /api/sources/access-validation-workflow/tasks`.
- Reuse Data Sources access task-ledger snapshot records for seeded workflow-task baselines.
- Update the Sources task-seeding action to request snapshot capture by default.
- Add parser checks, server tests, docs, validation, relaunch, commit, push, and release-gate evidence.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-views.js`
- `node --check tests\server.test.mjs`
- `node --check test-parse.js`
- `npm test`
- `node .\generate-audit.mjs`
- `node .\test-parse.js`
- `npm run build:vercel`
- Local app relaunched at `http://127.0.0.1:3042/` on PID `229476`; HTTP 200 and the workflow task seeding control is present.
