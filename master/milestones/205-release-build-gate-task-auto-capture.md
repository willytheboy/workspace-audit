# Milestone 205 - Release Build Gate Task Auto Capture

Status: Completed
Completed: 2026-04-13

## Outcome

- Added optional `saveSnapshot`, `captureSnapshot`, and `autoCaptureSnapshot` support to `POST /api/releases/build-gate/actions/tasks`.
- Auto-captured a Release Control task ledger snapshot after Release Build Gate task seeding when snapshot capture is requested.
- Added snapshot metadata and `release-task-ledger-snapshot-auto-captured` operation logging to the task seeding response.
- Added a Governance `Seed + Snapshot` control for Release Build Gate task batches.
- Added command-palette parity with `seed-release-build-gate-action-tasks-with-snapshot`.

## Non-Secret Policy

- Auto-captured Release Control task ledger snapshots store only deployment-gate task metadata and summary counts.
- Credentials, provider tokens, private keys, certificates, cookies, browser sessions, deployment secrets, and command output remain outside this app.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-actions.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check app.js`
- `node --check tests\server.test.mjs`
- `node --check test-parse.js`
- `node test-parse.js | Select-String -Pattern "Release build gate task auto capture|: Missing"` returned `Present` and no missing checks.
- `npm test` passed all 8 suites.
- `npm run build:vercel` completed and wrote the static preview to `public`.
- `git diff --check` passed.
- Relaunched the local app on `http://127.0.0.1:3042/` with PID `232244`.
- Smoke-checked `/` returned `200`.
- Smoke-checked `/api/governance` returned `releaseTaskLedgerSnapshotCount=0` and `releaseControlTaskCount=0`.
- Smoke-checked `/api/releases/task-ledger-snapshots/diff?snapshotId=latest` returned `hasSnapshot=false`, `driftSeverity=missing-snapshot`, and `driftScore=0`.
- Smoke-checked served `ui/dashboard-components.js` contains `release-build-gate-tasks-snapshot-btn` and `releaseBuildGateTasksSnapshot`.
- Smoke-checked served `ui/dashboard-actions.js` contains `seed-release-build-gate-action-tasks-with-snapshot`.
- Smoke-checked served `ui/dashboard-views.js` contains `seedReleaseBuildGateActionTasksWithSnapshot` and `saveSnapshot = true`.

## Next Candidate

- Add per-action Release Build Gate `Track Task + Snapshot` controls so individual generated deployment-gate actions can be converted to tasks with an immediate ledger baseline.
