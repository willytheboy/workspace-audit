# Milestone 250 - CLI Bridge Follow-up Work-Order Drafts

Status: completed
Date: 2026-04-14

## Objective

Turn reviewed CLI bridge handoffs into sanitized, copyable follow-up work-order drafts without executing Codex CLI or Claude CLI from the app.

## Implementation

- Added `GET /api/cli-bridge/handoffs/:handoffId/work-order-draft` as a non-executing draft endpoint.
- Added `CliBridgeFollowUpWorkOrderDraftPayload` typing and dashboard API support.
- Added Governance `Copy Work-Order Draft` controls on CLI bridge handoff cards.
- Added a copy handler that prepares Markdown work-order drafts for the selected runner.
- Preserved Workspace Audit Pro as the broker and source of truth: no direct runner-to-runner free chat, no secrets, and no automatic CLI execution.

## Validation

- Added server coverage for accepted and escalated handoff draft payloads.
- Added parser coverage for the follow-up work-order draft API, UI control, view binding, and type payload.
- Run syntax, parser, test, build, relaunch, commit, and push as part of milestone closure.
