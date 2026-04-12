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

- Relaunched with `npm run dev` on `http://localhost:3042`.
- Dev server shell PID: `99240`.
- Home page returned HTTP 200.
- Served shell includes `copy-sources-access-validation-evidence-coverage-btn`.
- Served `ui/dashboard-views.js` includes `source-evidence-coverage-deck`.
- GitHub checkpoint pushed: `e293b87 Add static Vercel preview build`.
