# 119 - Governance Data Sources Access Gate Copy Integrated

Status: Complete.

## Scope

- Add a Governance toolbar action for copying the filtered Data Sources access gate.
- Add command-palette support for the same non-secret source-access gate handoff.
- Include the gate decision, recommended action, ready/review/blocked counts, credential signals, filters, and visible reasons in the copied markdown.

## Validation

- `node --check .\app.js`
- `node --check .\ui\dashboard-actions.js`
- `node --check .\ui\dashboard-views.js`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`

## Live Check

- Relaunched app on port `3042` from dev shell PID `200264`.
- Live app smoke check:
  - Home page status: `200`
  - Data Sources gate decision: `review`
  - Gate ready/review/blocked: `1 / 1 / 0`
  - Governance toolbar button present: `true`
  - Command-palette action present: `true`
  - Governance gate markdown builder present: `true`
