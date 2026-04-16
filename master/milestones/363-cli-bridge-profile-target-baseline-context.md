# Milestone 363: CLI Bridge Profile Target Baseline Context

## Status

- Complete

## Objective

Carry the Agent Control Plane profile target task baseline gate into CLI bridge context packs and dry-run prompts so future Codex CLI and Claude CLI workflows receive the same build-readiness constraints as the in-app control plane.

## Completed Work

- Added profile target task baseline health, freshness, drift severity, and uncheckpointed drift counts to the CLI bridge control-plane decision summary.
- Added a Control Plane Gate section to CLI bridge context Markdown.
- Added profile target task baseline status to CLI runner dry-run prompts.
- Surfaced target baseline health in the CLI runner readiness gate.
- Added parser and server coverage for the CLI bridge target baseline context.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-types.js`
- `node --check test-parse.js`
- `node --check tests\server.test.mjs`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

- Relaunched local app on `http://localhost:3042` with PID `92984`.
- Smoke checked `/`, `/api/cli-bridge/context?runner=codex`, `/api/cli-bridge/runner-dry-run?runner=codex`, and `/api/governance`.
- CLI bridge context now reports profile target baseline `healthy`, `fresh`, with target baseline Markdown present.
