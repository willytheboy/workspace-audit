# Vibe Coder Operating Guide

## Purpose

Workspace Audit Pro should teach and guide the user through safe app debugging, implementation, validation, and agent-supervised build cycles.

This guide is a product objective and future in-app workflow target. It should become the operator-facing process once the current checkpoint and control-plane milestones are consolidated.

## Core Cycle

1. Capture intent.
   Define the app, feature, bug, or milestone in plain language. Convert the request into a scoped objective, success criteria, and non-goals.

2. Check source readiness.
   Use Data Sources to confirm the repo path, Git access method, source health, missing evidence, and any password, certificate, token, SSH, VPN, or browser-session requirements that must stay outside the app.

3. Read the control plane.
   Use Governance and Agent Control Plane to decide whether the work is `ready`, `review`, or `hold`. Do not start external agent execution while access, tests, or release gates are blocked.

4. Generate a work order.
   Create a bounded work order with target repo, files or modules in scope, expected changes, validation commands, acceptance criteria, and rollback plan.

5. Assign the execution engine.
   Use Codex CLI for repository-aware coding and testing tasks. Use Claude CLI for complementary planning, large-context review, documentation, or alternate-agent verification when appropriate.

6. Execute in small slices.
   Run one implementation slice at a time. Capture non-secret status, changed files, validation output summaries, and unresolved blockers. Do not store credentials or raw secret-bearing logs.

7. Debug systematically.
   Reproduce the issue, isolate the failing layer, inspect logs and tests, make the smallest viable fix, rerun validation, then record what changed.

8. Validate before moving on.
   Run syntax checks, unit tests, build checks, smoke checks, and any app-specific validation commands listed in the work order.

9. Relaunch and inspect.
   Relaunch the local app after each completed build cycle so the user can monitor the visible state. Record the URL, PID, and smoke-check result in the milestone.

10. Commit and checkpoint.
   Commit only validated milestone changes. Push to GitHub when the build is clean so rollback remains possible.

11. Review and teach.
   Explain what was done, why it matters, what passed, what remains risky, and what the next milestone unlocks.

## Debugging Ladder

1. Confirm the app starts.
2. Confirm the relevant route or API endpoint returns a healthy response.
3. Confirm the UI contains the expected controls or state.
4. Confirm the data payload has the expected shape.
5. Confirm the user action invokes the correct handler.
6. Confirm persisted state changes only non-secret metadata.
7. Confirm tests cover the changed behavior.
8. Confirm the build works in local and deployment preview modes.

## Agent Supervision Rules

- Agents should receive bounded work orders, not vague global commands.
- Agents should operate on app-development repositories only.
- Agents should run validation before claiming completion.
- Agents should summarize failures and blockers instead of silently skipping them.
- Agents should never request or store secrets inside Workspace Audit Pro.
- The app should show what agent ran, what it changed, what evidence was captured, and what gate remains blocked.

## Teaching Requirements

- Use plain-language explanations next to readiness gates and failed checks.
- Show the next safe action, not just the raw error.
- Preserve milestone history so the user can understand how the app evolved.
- Prefer checklists and small cycles over large opaque automation.
- Mark the Claude CLI / Codex CLI prototype as ready only after source access, work-order, execution result, validation, and release-control ledgers can supervise the loop.
