# Milestone 237 - Convergence Operator-Contributed Overlaps

## Intent

Allow the operator to contribute known project overlaps from the project workbench, then have the app run non-secret due diligence, persist AI-assisted insight, and surface an assimilation recommendation in the Convergence review ledger.

## Changes

- Added `POST /api/convergence/proposals` for operator-contributed overlap nominations.
- Added deterministic non-secret due-diligence scoring using existing generated convergence evidence, shared frameworks, languages, workspace zone, category, and domain tokens.
- Persisted operator context, generated insight, and assimilation recommendation on Convergence review records.
- Included review-only Convergence candidates so operator-contributed overlaps are visible even when the scanner did not originally generate the pair.
- Added a project workbench `Contribute known overlap` form with project selection, operator context, and a `Run Due Diligence` action.
- Added UI rendering for operator-contributed overlap tags and AI-assisted insight.
- Added parser and server regression coverage for the new proposal flow.

## Validation

- Passed: `node --check lib\workspace-audit-server.mjs`.
- Passed: `node --check ui\dashboard-api.js`.
- Passed: `node --check ui\dashboard-modal-components.js`.
- Passed: `node --check ui\dashboard-modal.js`.
- Passed: `node --check ui\dashboard-types.js`.
- Passed: `node --check test-parse.js`.
- Passed: parser checkpoint scan with `Convergence operator-contributed overlaps: Present`.
- Passed: `git diff --check`.
- Passed: `npm test`.
- Passed: `npm run build:vercel`.
- Passed: relaunched the local app on PID `238024` at `http://127.0.0.1:3042/`.
- Passed: homepage smoke returned HTTP 200.
- Passed: `/api/convergence/candidates` returned HTTP 200 with 24 visible candidates in the live store.
- Passed: served dashboard JS contains the proposal form, handler, API route, and AI insight rendering guard.

## Next

Promote the vibe-coder operating guide into the app UI after the Convergence contribution milestone is committed and pushed.
