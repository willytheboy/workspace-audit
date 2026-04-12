# Milestone 155 - Release Control Ledger

## Completed

- Added a persisted non-secret `releaseCheckpoints` ledger to the SQLite-backed workspace store.
- Added `GET /api/releases/summary` to combine Git state, deployment smoke-check evidence, latest scan context, checkpoint count, and release readiness status.
- Added `POST /api/releases/checkpoints` to save bounded release checkpoints and write auditable Governance operation records.
- Added Governance toolbar and command-palette actions for copying the Release Control Ledger and saving a release checkpoint.
- Fed release checkpoints into diagnostics, Governance, Agent Control Plane payloads, Agent Control Plane markdown, saved snapshots, and snapshot drift metrics.

## Guardrails

- Release checkpoints store non-secret release state only: branch, commit, dirty count, deployment smoke status, scan status, notes, and generated markdown.
- The release helper treats unavailable Git execution as review-state metadata instead of failing the route, so restricted runtimes do not break the dashboard.
- Do not store credentials, tokens, private keys, certificates, cookies, browser sessions, or response bodies in release checkpoints.

## Validation

- `node --check` passes for the changed server, store, UI, app, and parser files.
- `npm test` passes after hardening Git metadata collection against restricted command execution.
- `node generate-audit.mjs`, `npm run build:vercel`, `node test-parse.js`, and `git diff --check` pass with only the expected generated-HTML CRLF warnings.
- Local relaunch on `http://localhost:3042` returns HTTP 200 for the shell, release summary, Governance, and Agent Control Plane endpoints.
