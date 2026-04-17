# Milestone 417: Active Project Scope Lock

Status: Completed

## Objective

Adapt the supplied active-project lock directive into Workspace Audit Pro so future AI, Codex CLI, and Claude CLI workflows can clearly distinguish project-scoped work from portfolio-wide work.

## Scope

- Add a visible active-project selector to the app header.
- Persist `activeProjectId` and `scopeMode` in localStorage.
- Add a project/portfolio mode badge with explicit portfolio-mode warning.
- Add command-palette actions for scope control and direct project scoping.
- Include scope metadata in runtime status and inventory exports.

## Source Directive

- `C:\Users\user\Desktop\BUILD_HANDOFF_2026-03-26_directive-010-active-project-lock.md`

## Validation

- `node --check app.js`
- `node --check ui/dashboard-actions.js`
- `node --check ui/dashboard-views.js`
- `node --check ui/dashboard-types.js`
- `node --check test-parse.js`
- `node test-parse.js`
- `npm test`
- `npm run build:vercel`
- `git diff --check`

## Outcome

- Added a reload-safe active project selector and project/portfolio scope badge to the dashboard header.
- Added scope commands to the command palette for direct project scoping, clearing scope, and portfolio-mode transitions.
- Exposed current scope in runtime status and inventory exports so future AI/CLI work orders can inherit explicit scope metadata.
