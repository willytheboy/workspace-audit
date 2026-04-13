# Milestone 182: Governance Data Sources Access Validation Workflow Task Seeding

Status: Completed

## Scope

- Add a Governance toolbar control for creating deduplicated non-secret Data Sources tasks from pending or blocked validation workflow items.
- Add command-palette parity for Governance workflow task seeding.
- Reuse the existing workflow task seeding API so seeded work keeps the automatic Data Sources access task-ledger snapshot capture.
- Keep Sources workflow task seeding behavior unchanged while allowing Governance seeding to refresh the Governance deck.
- Add parser checks, docs, milestone tracking, validation, relaunch, commit, push, and release-gate evidence.

## Validation

- `node --check app.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-actions.js`
- `node --check test-parse.js`
- `node .\test-parse.js`
- `npm test`
- `node .\generate-audit.mjs`
- `npm run build:vercel`
- Local app relaunched at `http://127.0.0.1:3042/` on PID `173408`; dashboard root and Governance API returned HTTP 200.
- Saved local release checkpoint `Milestone 182 local checkpoint` with status `review` and dirty-worktree evidence.
