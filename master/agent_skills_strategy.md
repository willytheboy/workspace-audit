# Agent / Skills Strategy

Updated: 2026-04-13

## Research Baseline

- Claude Agent Skills package reusable procedural knowledge as folders with a `SKILL.md` file plus optional scripts and reference resources. The important design pattern is progressive disclosure: keep metadata lightweight, then load detailed guidance and scripts only when a task needs them.
- Claude Code subagents are role definitions with scoped instructions, tool permissions, model selection, optional skills, MCP servers, hooks, memory scope, background execution, and optional worktree isolation.
- Managed subagent definitions can be distributed through the managed settings scope and take precedence over project and user subagents with the same name. That makes enterprise-level agent policy possible.
- Claude Code agent teams use a lead session, independent teammate sessions, a shared task list, and a mailbox. Task claiming uses file locking, and hooks can enforce quality gates when tasks are created, completed, or a teammate becomes idle.
- Claude Code skills expose safety controls such as `disable-model-invocation`, `user-invocable`, `allowed-tools`, scoped hooks, path scoping, and optional forked subagent context.

Primary source links:

- https://claude.com/blog/equipping-agents-for-the-real-world-with-agent-skills
- https://code.claude.com/docs/en/skills
- https://code.claude.com/docs/en/sub-agents
- https://code.claude.com/docs/en/agent-teams
- https://code.claude.com/docs/en/plugins
- https://agentskills.io/home

## Fit For This Project

This app should become the control center above agent runtimes, not a clone of one runtime. Claude, Codex, OpenAI agents, MCP servers, Vercel, GitHub, and local app repositories become supervised execution surfaces. Our app provides the cross-runtime inventory, evidence, checkpoints, work orders, source-access gate, release gate, and operator override layer.

The best concepts to adopt are:

- Agent role registry: store non-secret role definitions such as architect, researcher, implementer, test-runner, release-gate reviewer, source-access reviewer, and module librarian.
- Skill catalog: inventory reusable project skills as portable folders with instructions, scripts, resources, trust level, allowed tools, and target app types.
- Team orchestration model: represent a lead plus teammates as an execution plan with task dependencies, ownership, inbox events, status, and handoff evidence.
- Quality hooks: model task-created, task-completed, idle, release, source-access, and drift hooks as policy checkpoints before durable action.
- Isolation policy: classify whether an agent run can use the current workspace, a forked context, or a separate worktree/sandbox.
- Managed policy layer: support organization-level default agent/skill rules that override weaker project or user-level rules.

## Product Implication

The app should treat skills and agents as governed assets:

- A skill is not only a prompt. It is a reusable, versionable capability with scripts, reference files, permissions, and evaluation evidence.
- A subagent is not only a persona. It is a constrained worker with scope, tools, memory policy, execution mode, and acceptance criteria.
- An agent team is not only parallel chat. It is a workflow runtime with task dependencies, mailbox events, quality gates, and cleanup lifecycle.
- User/developer interaction is not a binary approval prompt. It is a policy-driven checkpoint layer that decides when AI can proceed, when it should defer, and when it must ask for operator review.

## Roadmap Integration

- Milestone 200 should promote the current work-order queue into an Agent Build Queue that can assign role, skill bundle, target source, expected evidence, and acceptance checks.
- Milestone 201 should define Agent Execution Policy with safe command classes, blocked actions, source-access constraints, isolated workspace/worktree decisions, and required evidence.
- Milestone 204 should become the Skill Registry milestone: index project-level skills, portable skill packages, scripts, references, owner, trust level, and activation policy.
- Milestone 208 should become the Multi-Agent Control Room milestone: lead session, teammate roles, mailbox events, task dependencies, ownership, and cleanup state.
- A later managed-policy milestone should add override precedence across organization, project, user, and runtime scopes.

## Guardrails

- Do not store passwords, tokens, private keys, certificates, cookies, or browser sessions.
- Treat generated agent/skill matches as recommendations until confirmed or policy-approved.
- Require checkpoint state for any generated classification that changes source access, release readiness, app grouping, or agent execution.
- Prefer reusable skill packages for repeated procedures, but keep destructive or deployment skills manual-invocation only unless policy explicitly allows automation.
- Keep runtime-specific concepts portable: store Claude-specific fields as adapter metadata, but model the platform core as provider-neutral agents, skills, tools, policies, tasks, and evidence.
