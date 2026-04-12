# 110 - Data Sources Access Matrix Integrated

Status: Complete.

## Scope

- Add a non-secret Data Sources access matrix grouped by access method.
- Include review, token/OAuth, password/session, certificate, and SSH key signal counts.
- Expose copy actions in the Sources toolbar and command palette.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-api.js`
- `node --check .\ui\dashboard-views.js`
- `node --check .\ui\dashboard-actions.js`
- `node --check .\app.js`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`

## Live Check

- Relaunched app on port `3042` with PID `215924`.
- Live access matrix reported 2 sources and 2 access methods.
- Live access matrix reported methods `git-https` and `local-filesystem`.
- Live access matrix reported 1 review-required source and 1 token-likely source.
- Live access matrix markdown includes `Data Sources Access Matrix`.
