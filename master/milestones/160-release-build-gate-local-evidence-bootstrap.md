# Milestone 160 - Release Build Gate Local Evidence Bootstrap

Status: Completed
Date: 2026-04-12

## Goal

Let the app satisfy local release build gate evidence prerequisites by running a local smoke check and saving a non-secret checkpoint without triggering Vercel updates.

## Completed

- Added `POST /api/releases/build-gate/bootstrap-local-evidence`.
- Added local app smoke-check capture with `allowLocal=true` guardrails contained inside the bootstrap action.
- Added non-secret release checkpoint capture after local smoke evidence is recorded.
- Added dashboard API support for release gate evidence bootstrap.
- Added Governance and command-palette action wiring.
- Added Release Control deck button for bootstrapping local evidence.
- Updated parser checks, server tests, README notes, and the master TODO ledger.

## Validation

- Passed: syntax checks for changed server, UI, app, test, and parser modules.
- Passed: `node .\test-parse.js`.
- Passed: `npm test`.
- Passed: `node .\generate-audit.mjs`.
- Passed: `npm run build:vercel`.
- Passed: local relaunch at `http://127.0.0.1:3042/`.
- Passed: isolated server test for mutating local smoke-check and checkpoint capture.
- Passed: live no-mutation `POST /api/releases/build-gate/bootstrap-local-evidence` route verification.
- Deferred: Vercel deployment update until a final consolidation/release checkpoint.
