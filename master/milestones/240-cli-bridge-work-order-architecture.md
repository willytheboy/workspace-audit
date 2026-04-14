# Milestone 240 - CLI Bridge Work-Order Architecture

Status: completed
Date: 2026-04-14

## Objective

Define a safe method for connecting Workspace Audit Pro to Codex CLI and Claude CLI so they can participate in the same app-development process without uncontrolled agent-to-agent execution.

## Architecture Direction

Workspace Audit Pro should act as the work-order broker and control plane. Codex CLI and Claude CLI should not communicate directly with each other. The app should create bounded work orders, provide sanitized context, run one adapter at a time, validate outputs, and record non-secret handoffs.

Recommended integration layers:

- App-owned broker: work orders, readiness gates, queue status, validation plan, result ledger, relaunch checkpoints, and milestone state.
- Shared context pack: sanitized repo profile, source-access status, acceptance criteria, non-goals, and current blockers; no secrets, tokens, passwords, private key material, or certificate payloads.
- Runner adapters: Codex SDK or `codex exec` for Codex slices; Claude Code SDK or `claude -p` for Claude slices; subprocess fallback only when SDK control is insufficient or unavailable.
- Handoff protocol: runner output is structured JSON or a constrained Markdown result; the app validates the result before creating a follow-up work order for the other runner.
- Validation loop: after every accepted patch or plan, run checks, build, local smoke, relaunch, milestone note, git commit, and optional GitHub push.

## Official Documentation Checked

- OpenAI Codex SDK docs: Codex can be controlled programmatically for CI/CD, internal tools, custom agents, and app integration. The TypeScript SDK is positioned as more flexible than non-interactive mode and requires Node.js 18 or later.
- Anthropic Claude Code CLI docs: Claude Code supports print mode with `claude -p`, continuation and resume modes, JSON and stream JSON output options, MCP config loading, allowed/disallowed tools, max-turn limits, agents, and remote-control/server workflows.

References checked on 2026-04-14:

- https://developers.openai.com/codex/sdk
- https://developers.openai.com/codex/cli
- https://code.claude.com/docs/en/cli-usage

## Implementation

- Added a Governance `CLI Bridge Architecture` card.
- Added a `cli-bridge-architecture-card` parser target.
- Documented the recommended path as a non-executing architecture milestone.
- Kept actual CLI execution out of scope until readiness gates are clean and a supervised dry-run prototype is ready.

## Validation

- [x] `node --check ui\dashboard-components.js`
- [x] `node --check test-parse.js`
- [x] `node test-parse.js`
- [x] `git diff --check`
- [x] `npm test`
- [x] `npm run build:vercel`
- [x] Relaunch/local smoke on `http://127.0.0.1:3042/`
- [x] Commit and push
