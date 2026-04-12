# 012 Scan Diffing Integrated

Date: 2026-04-10

## Outcome

- Promoted persisted scan runs from summary-only records to records that also carry compact per-project snapshots.
- Added server-side scan diffing so the Trends view can compare the latest two runs and surface added, removed, and materially changed projects.
- Backfilled the immediately previous inventory snapshot during audit generation so diffing works on the first run after the upgrade instead of requiring an extra warm-up cycle.

## Delivered

- `lib/audit-core.mjs`
  - Added compact project snapshot capture for persisted scan runs.
  - Backfills the previous `inventory.json` into the matching persisted scan run when that older run lacks project snapshots.
- `lib/workspace-audit-server.mjs`
  - Added `GET /api/scans/diff`.
  - Normalized `/api/history` to oldest-to-latest ordering for the Trends view.
- `ui/dashboard-api.js`
  - Added `fetchScanDiff()`.
- `ui/dashboard-components.js`
  - Added diff KPI and diff breakdown builders.
- `ui/dashboard-views.js`
  - Trends now renders summary movement plus latest-run diff breakdown.

## Validation

- `npm test`
- `node .\generate-audit.mjs`
- `node .\test-parse.js`
