# Milestone 346 - Runtime Surface Detection Heuristics

## Status

Completed.

## Summary

The audit scan now detects runtime surfaces beyond root `package.json` scripts, reducing false empty Launchpad states for active multi-surface applications.

## Implemented

- Captured nested package scripts with working-directory-aware launch commands.
- Added Python requirements and Docker Compose runtime surfaces as launch hints.
- Updated the project Launchpad runtime card and agent handoff pack to show runtime surfaces and nested runnable package commands.
- Extended the script runner to execute package scripts from a validated nested working directory inside the selected project.
- Added fixture coverage for nested package runtime detection and parser coverage for the new workbench wiring.

## Validation

- `node --check lib\audit-core.mjs`
- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-modal.js`
- `node --check ui\dashboard-modal-components.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
- `git diff --check`

## Next

- Add Markdown and JSON executive exports for governance and scan summaries.
- Add fuzzy project search in the command palette so typing a project name opens its workbench directly.
