# Milestone 157 - Release Checkpoint Drift

Status: Completed
Date: 2026-04-12

## Goal

Compare the latest saved release checkpoint against live release state before the next supervised app-development build pass.

## Completed

- Added `GET /api/releases/checkpoints/diff` for non-secret release checkpoint drift.
- Added markdown handoff output for release drift reviews.
- Added dashboard API and type coverage for release checkpoint drift payloads.
- Added Governance cache/filter integration for latest release drift.
- Added Release Control deck visibility, drift severity tags, drift field listing, and a Copy Drift action.
- Added command-palette support for copying the latest release checkpoint drift handoff.
- Updated parser checks, server tests, README notes, and the master TODO ledger.

## Validation

- Passed: syntax checks for changed server, UI, app, test, and parser modules.
- Passed: `node .\generate-audit.mjs`.
- Passed: `node .\test-parse.js`.
- Passed: `npm test`.
- Passed: `npm run build:vercel`.
- Passed: `git diff --check` with only known CRLF warnings.
- Passed: local relaunch at `http://127.0.0.1:3042/`.
- Passed: local `GET /api/releases/checkpoints/diff?snapshotId=latest` returned the expected non-secret `missing-checkpoint` payload.
- Deferred: Vercel deployment update until a final consolidation/release checkpoint.
