# Milestone 207 - Agent Control Plane Decision Per-Reason Task Snapshot

Status: Completed
Completed: 2026-04-13

## Outcome

- Added per-reason `Track + Snapshot` controls to Agent Control Plane decision reason cards.
- Reused the Control Plane decision task ledger auto-capture API for individual decision reasons.
- Added a per-reason handler that creates a deduplicated Control Plane decision task and immediately saves a non-secret decision task ledger snapshot baseline.

## Non-Secret Policy

- Per-reason snapshots store only Control Plane decision task metadata and decision task-ledger summary counts.
- Credentials, provider tokens, private keys, certificates, cookies, browser sessions, deployment secrets, and command output remain outside this app.

## Validation

- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check test-parse.js`
- `node test-parse.js | Select-String -Pattern "Agent control plane decision reason task snapshot checkpoints|: Missing"` returned `Present` and no missing checks.
- `npm test` passed all 8 suites.
- `npm run build:vercel` completed and wrote the static preview to `public`.
- `git diff --check` passed.
- Relaunched the local app on `http://127.0.0.1:3042/` with PID `53164`.
- Smoke-checked `/` returned `200`.
- Smoke-checked `/api/governance` returned `decisionTaskLedgerSnapshotCount=0` and `decisionTaskCount=0`.
- Smoke-checked served `ui/dashboard-components.js` contains `control-plane-decision-reason-task-snapshot-btn` and `controlPlaneDecisionReasonTaskSnapshot`.
- Smoke-checked served `ui/dashboard-views.js` contains `createAgentControlPlaneDecisionReasonTaskWithSnapshot` and `Agent Control Plane Decision Task Ledger Auto Capture:`.

## Next Candidate

- Add per-item Data Sources access review `Track Task + Snapshot` controls so individual source-access blockers can be converted to tasks with an immediate source-access task-ledger baseline.
