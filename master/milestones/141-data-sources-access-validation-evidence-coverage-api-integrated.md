# 141 - Data Sources Access Validation Evidence Coverage API Integrated

Status: Complete.

## Scope

- Add a derived non-secret coverage payload that compares configured Data Sources against the latest source-access validation evidence.
- Expose covered, review, blocked, and missing evidence counts through `/api/sources/access-validation-evidence-coverage`.
- Add dashboard API, type, parser, test, documentation, validation, and live relaunch tracking.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-api.js`
- `node --check .\ui\dashboard-types.js`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`

## Live Check

- Relaunched dev server on `http://localhost:3042` with shell PID `209924`.
- Home page returned HTTP `200`.
- `/api/sources/access-validation-evidence-coverage` returned `2` sources, `0` covered, `0` review, `0` blocked, `2` missing, and `0%` coverage for the live persisted workspace.
- Coverage markdown includes `# Data Sources Access Validation Evidence Coverage`.
