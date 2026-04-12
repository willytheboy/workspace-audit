# 102 - Data Sources Registry Removal Integrated

Status: Completed.

## Scope

- Add `DELETE /api/sources/:sourceId` for safe source registry removal.
- Keep the delete operation scoped to the registry record only; do not delete local files or remote resources.
- Add per-source Remove controls to the Sources view with explicit confirmation and automatic refresh.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-api.js`
- `node --check .\ui\dashboard-components.js`
- `node --check .\ui\dashboard-views.js`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`
- Relaunched the dev server on port `3042` with PID `206052`.
- Live checked registry removal by adding a temporary GitHub source and deleting it through `DELETE /api/sources/:sourceId`.
- Live checked `GET /api/sources/summary`: registry returned to 2 total sources, 2 ready, 0 blocked.
- Confirmed Sources UI removal source markers: `source-remove-btn`, `bindSourceRegistryActions`, and `deleteSource`.
- Live checked `GET /api/inventory`: 75 projects, generated `2026-04-11T15:45:40.010Z`.
