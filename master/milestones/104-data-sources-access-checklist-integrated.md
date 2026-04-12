# 104 - Data Sources Access Checklist Integrated

Status: Completed.

## Scope

- Add `GET /api/sources/access-checklist`.
- Convert source access requirements into actionable validation steps per source.
- Keep the checklist non-secret: it references OS credential manager, SSH agent, provider OAuth, provider vaults, VPN, database SSL, and manual export workflows without storing credentials.
- Add Sources toolbar and command-palette actions for copying the checklist markdown.

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
- Relaunched the dev server on port `3042` with PID `206488`.
- Live checked `GET /api/sources/access-checklist`: 2 checklist items, 1 ready, 1 review, 0 blocked, markdown available.
- Live checked first local source checklist action: confirms current OS account read access to the local folder.
- Live checked `/`: `copy-sources-access-checklist-btn` present, checklist API wiring present, checklist command action present.
- Live checked `GET /api/sources/access-requirements`: 2 sources, 1 access review required, 1 token-likely source.
- Live checked `GET /api/inventory`: 75 projects, generated `2026-04-11T16:03:24.759Z`.
