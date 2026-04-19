# Milestone 477 - Agent Control Plane Baseline Reason Task Hints

## Goal

Make Agent Control Plane decision tasks actionable for baseline gates by routing each reason type to the right operator workflow.

## Scope

- [x] Add specific remediation hints for profile target task, target audit, Regression Alert snapshot, and Regression Alert task baselines.
- [x] Route run-level audit and alert baseline review reasons to the corresponding Agent Execution queue filters.
- [x] Add parser and server-test coverage for Regression Alert baseline snapshot decision-task hints.
- [x] Validate syntax, parser sentinels, full tests, Vercel build, and local relaunch.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check test-parse.js`
- `node --check tests\server.test.mjs`
- `node test-parse.js`
- `git diff --check`
- `npm test`
- `npm run build:vercel`
- Local smoke: `root=200`, `decision=hold`, `mutation=0/110`

## Status

Completed.
