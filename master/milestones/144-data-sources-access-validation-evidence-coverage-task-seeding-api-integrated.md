# 144 - Data Sources Access Validation Evidence Coverage Task Seeding API Integrated

Status: Complete.

## Scope

- Add task creation for missing, review, and blocked Data Sources access validation evidence coverage gaps.
- Persist coverage-gap tasks with non-secret metadata and duplicate skipping.
- Add tests, parser checks, documentation, validation, and live relaunch tracking.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-api.js`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`

## Live Check

- Relaunched dev server on `http://localhost:3042` with shell PID `118684`.
- Home page returned HTTP `200`.
- `/api/sources/access-validation-evidence-coverage` returned `2` coverage items and `2` missing evidence gaps.
- `POST /api/sources/access-validation-evidence-coverage/tasks` with the default live coverage payload created `2` real Data Sources evidence coverage tasks and skipped `0`.
- First live task title: `Source evidence coverage: GITHUB Source`.
