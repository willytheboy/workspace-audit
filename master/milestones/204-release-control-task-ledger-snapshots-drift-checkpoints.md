# Milestone 204 - Release Control Task Ledger Snapshots And Drift Checkpoints

Status: Completed
Completed: 2026-04-13

## Outcome

- Added a persisted non-secret Release Control task ledger snapshot store.
- Added `GET` and `POST /api/releases/task-ledger-snapshots` plus `GET /api/releases/task-ledger-snapshots/diff` with latest and specific snapshot support.
- Added Governance controls for saving Release Control task ledger snapshots, copying snapshots, copying drift, tracking drift as a Governance task, and accepting drift by saving a refreshed ledger snapshot.
- Added command-palette parity for saving a Release Control task ledger snapshot and copying the latest Release Control task ledger drift.
- Fed Release Control task ledger snapshot counts and lists into Governance and Agent Control Plane evidence, handoff markdown, snapshot records, and baseline drift metrics.

## Non-Secret Policy

- Release Control task ledger snapshots and drift review tasks store only release-control task metadata and derived drift summaries.
- Credentials, provider tokens, private keys, certificates, cookies, browser sessions, deployment secrets, and command output remain outside this app.

## Validation

- `node --check lib\workspace-audit-store.mjs`
- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-actions.js`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-types.js`
- `node --check app.js`
- `node --check tests\server.test.mjs`
- `node --check test-parse.js`
- `node test-parse.js | Select-String -Pattern "Governance release task ledger snapshots|Governance release task ledger drift checkpoints|: Missing"` returned `Present` and no missing checks.
- `npm test` passed all 8 suites.
- `npm run build:vercel` completed and wrote the static preview to `public`.
- `git diff --check` passed.
- Relaunched the local app on `http://127.0.0.1:3042/` with PID `222956`.
- Smoke-checked `/` returned `200`.
- Smoke-checked `/api/governance` returned `releaseTaskLedgerSnapshotCount=0` and `releaseControlTaskCount=0`.
- Smoke-checked `/api/releases/task-ledger` returned `total=0`, `open=0`, `closed=0`, and `visible=0`.
- Smoke-checked `/api/releases/task-ledger-snapshots` returned `snapshotCount=0`.
- Smoke-checked `/api/releases/task-ledger-snapshots/diff?snapshotId=latest` returned `hasSnapshot=false`, `driftSeverity=missing-snapshot`, and `driftScore=0`.
- Smoke-checked served `ui/dashboard-components.js` contains `release-task-ledger-snapshot-drift-task-btn` and `releaseTaskLedgerSnapshotDriftAcceptId`.

## Next Candidate

- Add Release Build Gate task-seeding auto-capture so seeded deployment-gate tasks can automatically persist a Release Control task ledger snapshot.
