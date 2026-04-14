# Milestone 251 - CLI Bridge Follow-up Work-Order Run Queue

Status: completed
Date: 2026-04-14

## Objective

Allow reviewed CLI bridge handoffs to seed persistent Agent Work Order Runs without executing Codex CLI or Claude CLI from Workspace Audit Pro.

## Implementation

- Added `POST /api/cli-bridge/handoffs/:handoffId/work-order-run` to queue a normal Agent Work Order Run from the sanitized follow-up draft.
- Added duplicate protection so one open CLI bridge follow-up run is queued per handoff.
- Added CLI bridge metadata to queued runs: handoff id, target runner, draft decision, and source summary.
- Added Governance `Queue Work-Order Run` controls on CLI bridge handoff cards.
- Added dashboard API and view bindings for queueing follow-up work-order runs.

## Safety Boundary

- The endpoint only queues work inside Workspace Audit Pro.
- It does not launch Codex CLI or Claude CLI.
- The run keeps the non-secret broker policy and must still pass the normal validation, relaunch, and result-intake cycle.

## Validation

- Added server coverage for queueing a follow-up run from an accepted CLI bridge handoff.
- Added parser coverage for the queue API, UI control, view binding, operation log, and run metadata typing.
- Run syntax, parser, test, build, relaunch, commit, and push as part of milestone closure.
