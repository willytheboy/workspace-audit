# 150 - Data Sources Access Validation Evidence Coverage Deck Integrated

Status: Complete.

## Scope

- Render Data Sources access validation evidence coverage directly in the Sources view.
- Show covered, missing, high-priority, access-method, and latest-evidence status on coverage cards.
- Add Sources toolbar and command-palette support for copying coverage markdown.
- Keep the Vercel deployment scope as static preview only; local server remains the live control plane.

## Validation

- `node --check .\app.js`
- `node --check .\ui\dashboard-views.js`
- `node --check .\ui\dashboard-actions.js`
- `node --check .\test-parse.js`
- `node .\test-parse.js`
- `npm test`
- `node .\generate-audit.mjs`
- `npm run build:vercel`

## Live Check

- Pending relaunch after commit.
