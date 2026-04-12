# 011 SQLite Persistence Promoted

Date: 2026-04-10

## Scope

- Promote the durable store from JSON-primary to SQLite-primary
- Preserve `workspace-state.json` as a compatibility mirror
- Surface the SQLite store through diagnostics and tests

## Delivered

- `lib/workspace-audit-store.mjs` now writes to `workspace-state.db`
- `workspace-state.json` is still emitted as a mirrored compatibility export
- Existing server and UI code continue to use the same store API
- Diagnostics now expose:
  - `databaseFile`
  - `hasDatabaseFile`
  - `storeFile`
  - `hasStoreFile`

## Result

- Persistence is now database-backed without destabilizing the app surface.
- The next remaining horizon items are scan diffing and a cross-project governance view.
