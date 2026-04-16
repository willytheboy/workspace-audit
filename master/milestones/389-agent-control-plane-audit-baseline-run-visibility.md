# Milestone 389 - Agent Control Plane Audit Baseline Run Visibility

## Status

- Completed

## Objective

Expose audit-baseline run readiness directly in the Agent Control Plane decision card so operator review does not require reading expanded reason text.

## Changes

- Added an `AUDIT RUNS` decision tag showing review-required audit-baseline run count.
- Added captured, missing, healthy, and review-required audit-baseline run counts to the Agent Control Plane decision detail line.
- Added parser coverage for the dashboard visibility wiring.

## Validation

- `node --check ui\dashboard-components.js`
- `node --check test-parse.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Relaunch

- Relaunched local app on `http://localhost:3042/`.
- Smoke checks passed: app shell returned `200`, and the live Agent Control Plane decision returned audit-baseline review/healthy counts that back the new dashboard tag and detail line.
