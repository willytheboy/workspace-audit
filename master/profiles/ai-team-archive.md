# AI Team Archive

## Identity

- Source path: `D:\Development\archive\experiments\AI_team`
- Product intent: earlier version of `AI Agent Studio`, centered on multi-agent software delivery.
- Maturity: archived lineage branch with still-useful backend ideas.

## Architecture

- Backend: FastAPI + orchestration / project tooling modules
- Frontend: React/Vite-era UI with dashboard/admin components
- Shared orientation: project launcher, scaffolding, task execution, project memory

## Strongest Features

- `backend/development_orchestrator.py`
- `backend/project_context_manager.py`
- `backend/project_launcher.py`
- `backend/project_launcher_routes.py`
- `backend/team_task_executor.py`
- `backend/task_intent_detector.py`
- `backend/workflow_graph.py`

## Best Reusable Parts

- Project context and launcher abstractions
- Task-intent detection patterns
- Project-scaffolding and execution-history concepts

## Best Concepts

- A project should carry operational context, not just metadata.
- Launcher, context, and workflow graph belong together.
- The archive confirms which ideas survived into `AI Agent Studio`.

## Integration Value

- Lineage reference: high
- Direct donor: medium

## Risks

- Archived branch quality is uneven.
- Use it mainly to validate which abstractions proved durable enough to survive into the active successor.
