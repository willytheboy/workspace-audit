# Milestone 185: Convergence Review Workbench Controls

Status: Completed

## Scope

- Add project workbench Convergence card controls for `confirmed-overlap`, `not-related`, `needs-review`, and `merge-candidate`.
- Render the persisted review status and note on each Convergence card.
- Save operator review decisions through the Convergence review API from the workbench surface.
- Refresh Convergence candidates after each review and refresh findings after `not-related` reviews so the suppression rule takes effect.
- Record a reusable operator review checkpoint plan for other AI-generated classifications that may need human confirmation.
- Add parser checks, docs, validation, relaunch, commit, push, and release-gate evidence.

## Validation

- `node --check ui\dashboard-modal.js`
- `node --check ui\dashboard-modal-components.js`
- `node --check test-parse.js`
- `node .\test-parse.js`
- `npm test`
- `node .\generate-audit.mjs`
- `npm run build:vercel`
- Local app relaunched at `http://127.0.0.1:3042/` on PID `203724`; dashboard root, Convergence candidates API, and Convergence reviews API returned HTTP 200.
- Saved local release checkpoint `Milestone 185 local checkpoint` with status `review` and non-secret local validation notes.
