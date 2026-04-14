# Milestone 248 - CLI Bridge Manual Result Capture

Status: completed
Date: 2026-04-14

## Objective

Let the operator capture Codex CLI and Claude CLI dry-run summaries from the Governance UI without manually calling the runner-result API.

## Implementation

- Added `Record Codex Result` and `Record Claude Result` controls to the CLI bridge handoff mailbox.
- Added browser-side summary capture with an explicit non-secret prompt.
- Routed captured summaries through `createCliBridgeRunnerResult`.
- Defaulted captured results to `needs-review` and `workspace-audit` follow-up so the operator must review before acceptance or escalation.
- Added dashboard API JSDoc coverage for CLI bridge result capture.
- Added parser coverage for the manual capture controls.

## Safety Boundary

The UI captures only a non-secret summary provided by the operator. It does not paste or store raw credential-bearing command output, does not execute Codex CLI or Claude CLI, and does not auto-accept captured runner results.

## Validation

- [x] `node --check ui\dashboard-components.js`
- [x] `node --check ui\dashboard-views.js`
- [x] `node --check test-parse.js`
- [x] Parser checkpoint scan with `CLI bridge manual result capture: Present`
- [x] `git diff --check`
- [x] `npm test`
- [x] `npm run build:vercel`
- [x] Relaunch/local smoke on `http://127.0.0.1:3042/`
- [x] Commit and push
