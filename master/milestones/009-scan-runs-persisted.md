# 009 Scan Runs Persisted

Date: 2026-04-10

## Scope

- Persist scan runs as first-class records in the durable store
- Let history/trends read from persisted scan records instead of summary files alone
- Surface scan-run counts and latest scan timestamps in diagnostics

## Delivered

- `lib/audit-core.mjs` now appends a scan-run record to `workspace-state.json` whenever an audit is generated
- `lib/workspace-audit-store.mjs` now persists `scanRuns`
- `lib/workspace-audit-server.mjs` now serves:
  - `GET /api/scans`
  - `GET /api/history` from persisted scan runs when available
- Diagnostics now expose:
  - `scanRunCount`
  - `latestScanAt`

## Result

- Scan history is now a durable application record, not only a filesystem side effect.
- The next remaining major backlog item is the explicit workflow engine / approval surface.
