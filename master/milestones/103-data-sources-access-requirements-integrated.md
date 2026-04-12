# 103 - Data Sources Access Requirements Integrated

Status: Completed.

## Scope

- Classify likely access methods for tracked Data Sources without collecting secrets.
- Flag probable filesystem, Git credential manager, SSH key, provider token, OAuth/session, database password, SSL certificate, VPN, or manual-export requirements.
- Add `GET /api/sources/access-requirements` with JSON and markdown output.
- Add Sources toolbar and command-palette actions for copying the access requirements report.
- Surface access method, review status, credential hints, and no-secrets policy on source cards.

## Security Policy

- Do not store passwords, tokens, private keys, or certificates in the app.
- Store only non-secret access metadata and use OS credential managers, SSH agent, provider OAuth, or provider vaults for actual secrets.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\app.js`
- `node --check .\ui\dashboard-api.js`
- `node --check .\ui\dashboard-components.js`
- `node --check .\ui\dashboard-views.js`
- `node --check .\ui\dashboard-source-setup.js`
- `node --check .\ui\dashboard-actions.js`
- `node --check .\ui\dashboard-types.js`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`
- Relaunched the dev server on port `3042` with PID `162996`.
- Live checked `GET /api/sources/access-requirements`: 2 sources, 1 requiring access review, 1 token-likely source, markdown available.
- Live checked access secret policy: passwords, tokens, private keys, and certificates are not stored in the app.
- Live checked `GET /api/sources/summary`: 2 total sources, 2 ready, local source reports `local-filesystem` and no review required.
- Live checked `/`: `copy-sources-access-requirements-btn` present, access API wiring present, access command action present, and source-card access markers present.
- Live checked `GET /api/inventory`: 75 projects, generated `2026-04-11T15:54:38.127Z`.
