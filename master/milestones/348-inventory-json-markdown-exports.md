# Milestone 348 - Inventory JSON And Markdown Exports

## Status

Completed.

## Summary

The portfolio export layer now supports CSV, JSON, and Markdown for different consumption paths: spreadsheets, structured automation, and readable executive or agent summaries.

## Implemented

- Added JSON and Markdown export buttons to the main toolbar.
- Added command palette actions for JSON and Markdown inventory exports.
- Exported the current filtered project set with filters, summary metrics, runtime surfaces, launch commands, warnings, stack metadata, and similarity signals.
- Reused the download helper for governance Markdown export to avoid duplicated browser download code.

## Validation

- `node --check app.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-actions.js`
- `node test-parse.js`
- `npm test`
- `npm run build:vercel`
- `git diff --check`

## Next

- Add source access review checkpoint escalation for GitHub sources marked as pending review.
- Add governance profile onboarding status in the dashboard header so low profile coverage is visible without opening Governance.
