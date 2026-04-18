# Milestone 454 - Active Project Scope Warning

## Status

Completed.

## Summary

The app now shows an explicit warning in the header when no active project is selected and portfolio mode is not enabled, making the locked guarded-action state visible before users click a control.

## Changes

- Added a persistent `scope-guard-warning` element beside the active project scope selector.
- Updated scope rendering to show the warning only when the app is unscoped.
- Added styling for the unscoped warning state.
- Added parser coverage for the visible scope warning.

## Validation

- `node --check app.js`
- `node --check test-parse.js`
- `node test-parse.js`
- `npm test`
- `npm run build:vercel`
- `git diff --check`

## Next

Continue improving action guidance by adding scoped mutation audit visibility and regression alerts.
