# Milestone 332 - Convergence Assimilation Runner Launch Stack Remediation Pack Snapshot Refresh

## Objective

Add an `Accept Drift` path for remediation pack snapshots so operators can promote the current live Codex or Claude remediation pack to the newest saved baseline after review.

## Delivered

- Added `POST /api/convergence/assimilation-runner-launch-stack-remediation-pack-snapshots/refresh`.
- Preserved the previous snapshot id while inserting the refreshed remediation pack snapshot at the top of the saved snapshot ledger.
- Added dashboard API wiring through `refreshConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshot`.
- Added an `Accept Drift` button to the remediation pack snapshot drift card.
- Added Governance click handling, parser checks, and server coverage proving refreshed snapshots clear live drift.

## Validation

- Passed: `node --check lib\workspace-audit-server.mjs`.
- Passed: `node --check ui\dashboard-api.js`.
- Passed: `node --check ui\dashboard-components.js`.
- Passed: `node --check ui\dashboard-views.js`.
- Passed: `node --check tests\server.test.mjs`.
- Passed: `node --check test-parse.js`.
- Passed: `node test-parse.js`.
- Passed: `npm test`.
- Passed: `npm run build:vercel`.
- Passed: local relaunch on `http://localhost:3042` with PID `163196`.
- Passed: local smoke `/` returned `200`.
- Passed: local smoke confirmed remediation pack snapshot refresh component and view markers are served.
- Passed: local smoke refresh endpoint returned a successful Codex remediation pack snapshot.

## Notes

- The refresh operation stores the current live non-secret remediation pack only. It does not copy credentials, tokens, browser sessions, raw command output, certificates, or private repository access material.
- This mirrors the action-task-ledger refresh pattern from milestone 324, but applies it to the higher-level remediation handoff baseline.
