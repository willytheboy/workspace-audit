# Milestone 238 - Vibe Coder Operating Guide UI

## Intent

Promote the vibe-coder operating guide from persistent Markdown into the Workspace Audit Pro UI so the user can follow the safe app-building cycle directly from Governance.

## Changes

- Added a `Vibe Coder Operating Guide` Governance section.
- Added a `Safe app-building cycle` guide card with intent capture, source readiness, control-plane gating, work orders, small-slice execution, validation, relaunch, commit, and review steps.
- Added a `Copy Guide` action that copies a Markdown operating guide with the no-secrets policy.
- Added a parser checkpoint guard for the in-app guide card and copy handler.
- Updated the TODO ledger to mark the guide promotion objective complete.

## Validation

- Passed: `node --check ui\dashboard-components.js`.
- Passed: `node --check ui\dashboard-views.js`.
- Passed: `node --check test-parse.js`.
- Passed: parser checkpoint scan with `Governance vibe coder operating guide: Present`.
- Passed: `git diff --check`.
- Passed: `npm test`.
- Passed: `npm run build:vercel`.
- Passed: relaunched the local app on PID `217084` at `http://127.0.0.1:3042/`.
- Passed: homepage smoke returned HTTP 200.
- Passed: served dashboard JS contains the guide section, copy button, Markdown builder, and binding handler.

## Next

Add Codex CLI and Claude CLI work-order runner guidance once the first supervised CLI prototype is ready.
