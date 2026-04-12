# Patterns From Project Creator

## Identity

- Source path: `D:\Development\active\02_ai-agent-studio\patterns-from-project-creator`
- Product intent: extracted backend patterns from the archived `AI_project_creator` system.
- Maturity: curated pattern library rather than a runnable product.

## Architecture

- Workflow engine under `workflow/`
- Task queue under `task-queue/`
- Database models under `database/`
- Docker and cache support folders for extracted infrastructure

## Strongest Features

- `workflow/workflow_engine.py`
  Strong workflow and step model with templates, dependencies, conditions, and parallel steps.
- `task-queue/task_manager.py`
  Strong task entity model with priorities, dependencies, deliverables, and required skills/tools.
- `task-queue/dynamic_task_delegation.py`
  Rich agent-assignment and delegation strategy model.

## Best Reusable Parts

- Workflow state machine and template model
- Task entity schema
- Delegation heuristics as a scoring/reference system

## Best Concepts

- Model workflows and tasks as first-class durable entities.
- Keep templates separate from runtime state.
- Match agents to work using explicit expertise and load signals.

## Integration Value

- Domain-model donor: very high
- Direct code donor: medium

## Risks

- The delegation layer is richer than the current app needs and can become overbuilt quickly.
- Import the model concepts first; keep runtime execution simpler until the app has durable persistence.
