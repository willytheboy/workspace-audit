# Milestone 394 - CLI Bridge Runner Dry-Run Baseline Refresh Controls

## Status

- Completed

## Objective

Let the operator create or refresh Codex and Claude dry-run baselines directly from the baseline-status health card instead of hunting for the separate snapshot controls.

## Changes

- Added Refresh Codex Baseline and Refresh Claude Baseline controls to the CLI Bridge runner dry-run baseline-status card.
- Reused the existing non-secret runner dry-run snapshot save handler, so refresh actions use the same validated API path as snapshot creation.
- Added parser coverage for the baseline refresh controls.

## Validation

- `node --check ui\dashboard-components.js`
- `node --check test-parse.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

- Relaunch required after validation.
- Smoke checks planned: app shell and served baseline refresh control markers.
