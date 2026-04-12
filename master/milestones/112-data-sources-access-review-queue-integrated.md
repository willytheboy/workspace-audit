# 112 - Data Sources Access Review Queue Integrated

Status: Complete.

## Scope

- Add a non-secret Data Sources access review queue derived from checklist and matrix evidence.
- Render blocked/review source access items in the Sources view.
- Add Sources toolbar and command-palette copy actions for review queue markdown.

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

- Relaunched app on port `3042` with PID `22004`.
- Live app HTML includes `copy-sources-access-review-queue-btn`.
- Live access review queue reported 1 review item and 0 blocked items.
- First live review item uses access method `git-https`.
- Live queue markdown includes `Data Sources Access Review Queue`.
- Served `ui/dashboard-views.js` includes `createDataSourcesAccessReviewQueueSection`.
