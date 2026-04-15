# Milestone 308: Convergence Assimilation Runner Launch Control Board Snapshot Drift

Status: Completed
Date: 2026-04-15

## Outcome

- Added a non-secret drift API comparing saved launch control boards against the current live runner-start decision.
- Compared launch decision/status, authorization status, launch authorization pack decision, open/escalated checkpoint counts, recommended action, and Markdown changes.
- Added Governance copy controls for Codex and Claude launch control board drift.
- Added per-snapshot drift copy controls and drift cards for latest/per-snapshot review.
- Added parser checks and server coverage for no-drift and high-drift scenarios.

## Product Value

The app can now detect when a previously approved runner-start baseline is no longer valid. This keeps Codex/Claude launches aligned with current convergence state instead of relying on stale saved approvals.

## Validation

- Passed `node --check` for server, store, dashboard API/components/views/types, server tests, and parser.
- Passed `node test-parse.js`.
- Passed `npm test`.
- Passed `npm run build:vercel`.
- Passed `git diff --check`.
- Relaunched the local app at `http://127.0.0.1:3042/` using detached dev console PID `250028`; active listener PID is `204024`.
- Smoke checks returned HTTP 200 for `/` and `/api/convergence/assimilation-runner-launch-control-board-snapshots/diff?snapshotId=latest&runner=codex`.
- Live drift smoke returned `False,missing-snapshot,0` because this local store has no saved launch control board snapshot yet.
- Dashboard component smoke confirmed launch control board drift section, latest drift copy control, and per-snapshot drift dataset markers are served.
