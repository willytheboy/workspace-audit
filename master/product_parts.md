# Product Parts Analysis

## Product Intent

The merged product should become a local-first workspace intelligence and control-center platform. It should combine:

- `workspace-audit` strengths: inventory, similarity, history, health, source tracking
- `master-control` strengths: command surface, project actions, workflow shell, settings discipline
- `MasterControl` strengths: onboarding, connection flow, project-ready completion state
- `AI_project_creator` strengths: durable project memory, task/workflow domain models
- `database-integration` strengths: governed ingestion, lineage, auditability

## Scope Boundary

This product is for software-development operations only:

- app management
- app development
- app building
- workflow supervision
- source / portfolio governance

It is not intended to ingest or model non-development business apps, vertical products, or customer-facing domain applications as donor sources.

## Highest-Value Reusable Parts

| Priority | Part | Source | Type | Reuse Mode | Why it matters |
| --- | --- | --- | --- | --- | --- |
| 1 | Command Palette | `active\\15_master-control\\src\\components\\CommandPalette.tsx` | module | adapt directly | Fastest path to making `workspace-audit` feel like a control center |
| 1 | Setup Modal | `MasterControl\\frontend\\src\\components\\SetupModal.jsx` | modal | adapt directly | Converts source tracking into an onboarding workflow |
| 1 | Workflow Engine | `active\\15_master-control\\src\\components\\WorkflowEngine.tsx` | module | adapt in phases | Gives the product a supervised build/plan pipeline |
| 1 | Project Memory System | `AI_project_creator\\core\\ai_integration\\project_memory_system.py` | module | extract model only | Durable memory, todo, decision, brief, and execution-history structure |
| 1 | Task Manager + Workflow Model | `patterns-from-project-creator` | module | extract model only | Strong domain schema for later durable task/workflow persistence |
| 2 | Launchpad Detail Panel | `active\\15_master-control\\src\\components\\LaunchpadDetailPanel.tsx` | panel | adapt | Strong project context layout |
| 2 | Settings Modal | `active\\15_master-control\\src\\components\\SettingsModal.tsx` | modal | adapt | Mature provider + workspace settings shell |
| 2 | Create Project Modal | `active\\15_master-control\\src\\components\\CreateProjectModal.tsx` | modal | adapt | Good project-creation UX once projects become mutable objects |
| 2 | Agent Orchestrator Service | `active\\15_master-control\\server\\services\\agentOrchestratorService.ts` | service | adapt conceptually | Strong multi-provider candidate evaluation model |
| 2 | Project Launcher Routes | `active\\02_ai-agent-studio\\backend\\project_launcher_routes.py` | service | adapt | Good route surface for launching local projects |
| 3 | Merger Analysis | `MasterControl\\backend\\merger.py` | script/service | adapt later | Useful expert capability, not core path |
| 3 | Schema Discovery Scripts | `active\\12_database-integration\\scripts\\*.py` | scripts | adapt | Useful once source-ingestion expands beyond local scan |

## Best Concepts By Domain

## UI / Control Center

- Command palette as the primary action surface
- Project detail / launchpad panel instead of modal-only drilldown
- Onboarding modal that converts a source into a usable project
- Continue-work callout for active sessions

## Workflow / Agent Layer

- Human-supervised workflow progression
- Explicit phase model: brief, planning, approval, implementation, review
- Candidate fan-out to providers with scoring and winner selection

## Knowledge / Memory Layer

- Persistent project briefs
- Todo, milestone, decision, and execution-history memory
- Recent file-operation history as context

## Ingestion / Source Layer

- Source connection as a first-class concept
- Lineage, audit trail, and discovery scripts
- Health/insight generation immediately after connection

## Adoption Decisions

## Copy Or Adapt Directly

- Command palette pattern
- Setup modal flow
- Launchpad detail panel layout
- Settings IA

## Extract Models Only

- Workflow engine backend model
- Task manager model
- Project memory system
- Agent delegation heuristics

## Use As Direction Only

- Control Plane route taxonomy
- Database Integration compliance/orchestrator framing
- Legacy DOM modal and state systems from `AI_project_creator`

## First Implementation Slice

The first slice should be the `command palette`:

- highest user-facing value
- low coupling to current dashboard architecture
- direct donor from the strongest source app
- creates a foundation for later launch, setup, and workflow commands

The second slice should be the `setup / source connection` modal.
