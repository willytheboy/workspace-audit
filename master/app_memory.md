# Persistent App Memory

## North Star

`workspace-audit` is evolving into a local-first AI autonomous app-building control plane for managing, developing, and building software applications.

The target product is not only an audit dashboard. It should become the operator console for a multi-agent, multi-skill app-development platform that can discover app repositories, validate safe access, generate governance-ready work orders, coordinate supervised build agents, track execution, capture evidence, and enforce release/readiness gates.

## Strategic Direction

- Keep the product scoped to app management, app development, app building, and software-project governance.
- Treat Data Sources as the ingestion and access-trust foundation for local folders, Git repos, provider exports, AI workspace exports, and future authenticated app-development sources.
- Treat Governance as the human-readable control center where readiness, gaps, action queues, evidence, snapshots, drift, and execution health are consolidated.
- Treat Agent Control Plane as the machine-readable decision layer that turns Governance state into ready/review/hold decisions for supervised autonomous build passes.
- Treat Work Orders and execution/SLA ledgers as the operational bridge between user intent, agent tasking, validation, and milestone completion.
- Treat non-secret evidence ledgers and snapshots as safety rails. Credentials, tokens, certificates, SSH keys, browser sessions, cookies, and passwords stay outside the app.

## Future Platform Shape

- Multi-agent: planner, architect, implementation worker, reviewer, tester, release/governance checker, and data-source access analyst lanes.
- Multi-skill: local skills/plugins for framework-specific builds, code review, OpenAI integration, test generation, source ingestion, deployment handoff, and documentation.
- Multi-source: local filesystem, Git HTTPS/SSH, provider APIs, provider exports, browser-session/manual export sources, and future user-authorized connectors.
- Multi-layer control: source access coverage, governance readiness, agent decision gates, work-order execution, validation evidence, drift snapshots, and milestone logs.

## Build Guidance

- Continue building in layered milestones: Data Sources first, Governance visibility second, Agent Control Plane decision logic third, execution/work-order automation fourth.
- Prefer derived, non-secret trust signals over storing credentials or raw secrets.
- Relaunch after each milestone so the operator can monitor progress.
- When a clean checkpoint is reached, initialize Git and push to a GitHub remote so each milestone can become a commit-level rollback point.
- Treat user education as a product feature: the app should guide a vibe coder through debugging, build cycles, agent supervision, validation, commits, and release decisions step by step.
- When the current checkpoint milestones are consolidated, add an in-app process guide that explains how to run a safe app-building cycle with Workspace Audit Pro as the backbone and Claude CLI / Codex CLI as supervised execution engines.

## Persistent Direction Update: 2026-04-12

- Future intent is an AI autonomous app-building platform, not a passive workspace audit report.
- The app should grow into a supervised multi-agent, multi-skill app-development operating system with Governance as the operator cockpit, Data Sources as the trusted ingestion/access layer, Agent Control Plane as the machine decision layer, and Work Orders as the execution bridge.
- Near-term builds should keep tightening the non-secret Data Sources evidence loop, task seeding, governance visibility, and agent-gate readiness before introducing more autonomous execution.
- Long-term growth should support pluggable agent lanes, skill routing, repository access methods, evidence-backed validation, release gates, rollback-safe milestone history, and eventually a Git-backed checkpoint model.

## Agent / Skills Direction Update: 2026-04-13

- Claude-style skills, subagents, managed agent definitions, and agent teams validate the product direction: this app should become the provider-neutral control center above concrete agent runtimes.
- Model skills as governed reusable capability packages with instructions, scripts, resources, allowed tools, trust level, owner, evaluation evidence, and activation policy.
- Model subagents as constrained specialist workers with role, tool scope, model/runtime adapter metadata, memory policy, isolation mode, and acceptance criteria.
- Model agent teams as lead-plus-worker execution plans with task dependencies, mailbox events, quality gates, cleanup lifecycle, and non-secret evidence capture.
- Keep managed policies as a future precedence layer across organization, project, user, and runtime scopes so unsafe automation is controlled centrally.
- Implement generated managed-agent policy checkpoints as the first executable gate: role, runtime, isolation, skill bundle, and hook policy recommendations stay blocked until approved, deferred, or dismissed by the operator.

## Vibe Coder Enablement Update: 2026-04-14

- The app must help a non-traditional or vibe-first builder understand what is happening during app debugging, implementation, validation, and release readiness.
- Each future app-building workflow should expose clear steps: intent capture, source/access check, work-order generation, agent assignment, execution monitoring, validation evidence, human review, commit, and release gate.
- The assistant should explicitly tell the user when the Claude CLI / Codex CLI prototype is ready, then provide a step-by-step operating guide before asking the user to supervise external agent execution.
- The product should make the process teachable: explain why a gate blocks, what evidence is missing, what command or agent is being run, what passed, what failed, and what the next safe action is.
