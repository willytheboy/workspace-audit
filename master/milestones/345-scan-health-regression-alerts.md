# Milestone 345 - Scan Health Regression Alerts

## Status

Completed.

## Summary

Scan-to-scan regressions are now first-class API and dashboard data instead of being buried in raw trend deltas.

## Implemented

- Added scan health alerts for workspace health drops, stagnant or declining test coverage, project health drops, and project test regressions.
- Added alert severity summaries and recommended actions to `/api/scans/diff`.
- Added a Trends KPI for regression alert counts and a Health Regression Alerts deck with actionable triage guidance.
- Added type coverage, parser checks, and server assertions for the new alert payload.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-components.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Next

- Improve runtime surface detection heuristics for projects that have launch methods but no detected package scripts.
- Add export options beyond CSV for Markdown, JSON, and executive summaries.
