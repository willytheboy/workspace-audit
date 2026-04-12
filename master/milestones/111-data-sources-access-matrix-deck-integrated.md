# 111 - Data Sources Access Matrix Deck Integrated

Status: Complete.

## Scope

- Render the Data Sources access matrix directly in the Sources view.
- Show access methods, attached sources, review counts, and token/certificate/SSH signal counts.
- Keep the deck read-only and non-secret.

## Validation

- `node --check .\ui\dashboard-views.js`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`

## Live Check

- Relaunched app on port `3042` with PID `213480`.
- Live app HTML includes `copy-sources-access-matrix-btn`.
- Live access matrix reported 2 methods, 1 review-required source, and 1 token-likely source.
- Served `ui/dashboard-views.js` includes `createDataSourcesAccessMatrixSection` and `source-access-matrix-card`.
