# AI Project Creator

## Identity

- Source path: `D:\Development\archive\experiments\AI_project_creator`
- Product intent: full-stack AI project factory with agent coordination, project memory, tasking, workflow, UI systems, and unified frontend services.
- Maturity: the richest historical concept archive in the AI-product family.

## Architecture

- Backend domains: `core/`, `agents/`, `services/`, `apps/`
- Frontend shared runtime: `frontend/shared/scripts/`
- Workflow and orchestration: `core/orchestrator/`
- Memory and context: `core/ai_integration/project_memory_system.py`

## Strongest Features

- `core/orchestrator/workflow_engine.py`
- `core/ai_integration/project_memory_system.py`
- `frontend/shared/scripts/modal-system.js`
- `frontend/shared/scripts/state-manager.js`
- `frontend/shared/scripts/ui-components.js`
- `frontend/shared/scripts/unified-integration.js`

## Best Reusable Parts

- Durable project memory model
- Workflow templates and step typing
- Shared-state shape for UI/system/agent/project/runtime domains
- Modal behavior model: backdrop, stacking, escape handling, focus management

## Best Concepts

- Project memory should outlive sessions.
- UI state, system state, and agent state should have distinct domains.
- A “unified integration” layer is worth having once the product spans many services.

## Integration Value

- Concept donor: very high
- Direct code donor: medium-low

## Risks

- Frontend implementation style is legacy DOM-script driven and should not be copied directly into the modernized app shell.
- The system is broad enough that selective extraction is essential.
