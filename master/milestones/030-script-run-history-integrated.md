# Milestone 030 - Script Run History Integrated

## Completed

- Added bounded persistence for launchpad script run metadata.
- Added `GET /api/script-runs` for project-level and portfolio-level run history retrieval.
- Updated the project workbench launchpad with an execution-history card showing recent runs.
- Added diagnostics, documentation, parser checks, and API coverage for script run history.

## Validation

- `node --check` passed for changed server, store, API, workbench, settings, type, and parser modules.
- `npm test` passed. The script-run stream test accepts sandbox-blocked child process spawning as a failed persisted run.
- `node .\generate-audit.mjs` passed.
- `node .\test-parse.js` passed.
