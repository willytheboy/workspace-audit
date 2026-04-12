# Milestone 156 - Governance Release Control Deck

Status: Completed
Date: 2026-04-12

## Goal

Make release readiness visible in the Governance control center instead of hiding it behind toolbar copy/save actions.

## Completed

- Added the live release summary to the Governance cache and searchable filter pipeline.
- Added a dedicated `Release Control` Governance scope.
- Added a Release Control KPI with ready/review/hold status, checkpoint count, smoke-check split, and Git dirty-state context.
- Added a Release Control deck section showing Git state, deployment smoke status, validation state, secret policy, latest saved checkpoints, and inline copy/save actions.
- Updated parser checks, README notes, and the master TODO ledger.

## Validation

- Passed: syntax checks for the changed frontend modules and parser script.
- Passed: `node .\generate-audit.mjs` regenerated the dashboard shell with 75 app-development projects.
- Passed: `node .\test-parse.js`.
- Passed: `npm test`.
- Passed: `npm run build:vercel`.
- Passed: `git diff --check` with only known CRLF normalization warnings.
- Passed: local relaunch on `http://localhost:3042` with Release Control scope, release summary API, Governance API, and Agent Control Plane release checkpoint verification.
