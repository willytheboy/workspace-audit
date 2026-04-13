# Milestone 184: Convergence Review Persistence API

Status: Completed

## Scope

- Add durable non-secret Convergence review records to the workspace store.
- Add `GET /api/convergence/candidates` for overlap candidates enriched with review status.
- Add `GET` and `POST /api/convergence/reviews` for persisted human review decisions.
- Support `confirmed-overlap`, `not-related`, `needs-review`, and `merge-candidate` review states.
- Suppress future generated convergence findings when a pair is marked `not-related`.
- Add parser checks, server tests, docs, validation, relaunch, commit, push, and release-gate evidence.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check lib\workspace-audit-store.mjs`
- `node --check ui\dashboard-api.js`
- `node --check ui\dashboard-types.js`
- `node --check test-parse.js`
- `node --check tests\server.test.mjs`
- `node .\test-parse.js`
- `npm test`
- `node .\generate-audit.mjs`
- `npm run build:vercel`
- Local app relaunched at `http://127.0.0.1:3042/` on PID `109468`; dashboard root, Convergence candidates API, and Convergence reviews API returned HTTP 200.
- Saved local release checkpoint `Milestone 184 local checkpoint` with status `review` and dirty-worktree evidence.
