# Milestone 420: Scope-Aware CLI Runner Dry-Run Contracts

Status: Completed

## Objective

Apply the active project scope lock to Codex CLI and Claude CLI dry-run contracts so lower-level runner prompts inherit the same project/portfolio guard as lifecycle handoff packets.

## Scope

- Add `scopeContext` to CLI runner dry-run payloads and Markdown.
- Hold dry-run contracts when no active project is selected and portfolio mode is not explicit.
- Hold project-scoped dry-runs when the selected work order belongs to a different project than the active project.
- Persist scope fields on dry-run snapshots and include them in drift summaries.
- Pass dashboard scope through dry-run copy, snapshot, baseline status, drift, and run-linked copy actions.

## Validation

- `node --check lib/workspace-audit-server.mjs`
- `node --check ui/dashboard-api.js`
- `node --check ui/dashboard-components.js`
- `node --check ui/dashboard-types.js`
- `node --check ui/dashboard-views.js`
- `node --check test-parse.js`
- `node --check tests/server.test.mjs`
- `node test-parse.js`
- `npm test`
- `npm run build:vercel`
- `git diff --check`

## Outcome

- CLI runner dry-run payloads now include `scopeContext` and scope details in generated Markdown and runner prompts.
- Dry-run contracts enter `hold` when scope is missing, and also hold when project-scoped work targets a project other than the active project.
- Dry-run snapshots persist scope metadata, and snapshot drift treats scope changes as high-impact drift.
- Governance UI dry-run copy, snapshot, baseline status, drift, and run-linked copy actions now pass the current dashboard scope into API calls.
