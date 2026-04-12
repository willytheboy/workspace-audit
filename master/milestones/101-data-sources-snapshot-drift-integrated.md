# 101 - Data Sources Snapshot Drift Integrated

Status: Completed.

## Scope

- Add `GET /api/sources/summary-snapshots/diff?snapshotId=latest`.
- Compare latest saved Data Sources health snapshot against the live source registry.
- Return drift severity, drift score, drift items, recommended action, and markdown.
- Add Sources toolbar and command-palette actions to copy the latest source snapshot drift handoff.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\app.js`
- `node --check .\ui\dashboard-api.js`
- `node --check .\ui\dashboard-views.js`
- `node --check .\ui\dashboard-actions.js`
- `node --check .\ui\dashboard-types.js`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`
- Relaunched the dev server on port `3042` with PID `187504`.
- Live checked `GET /api/sources/summary-snapshots/diff?snapshotId=latest`: snapshot found, no drift, severity `none`, drift score `0`, markdown available.
- Live checked `/`: `copy-sources-summary-drift-btn` present, drift action wiring present, drift API wiring present.
- Live checked `GET /api/inventory`: 75 projects, generated `2026-04-11T15:37:07.721Z`.
