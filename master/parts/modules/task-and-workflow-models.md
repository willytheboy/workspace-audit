# Task And Workflow Models

- Sources:
  - `D:\Development\active\02_ai-agent-studio\patterns-from-project-creator\task-queue\task_manager.py`
  - `D:\Development\active\02_ai-agent-studio\patterns-from-project-creator\workflow\workflow_engine.py`
  - `D:\Development\active\02_ai-agent-studio\patterns-from-project-creator\task-queue\dynamic_task_delegation.py`
- Classification: model extraction
- Target in `workspace-audit`: persistence schema and later orchestration rules

## Why It Matters

- Strongest task metadata model across all reviewed apps
- Clear statuses, priorities, dependencies, deliverables, and role matching

## Adaptation Rule

- Copy the concepts into a new persistence schema.
- Keep delegation heuristics lightweight until the product actually runs multi-agent workflows.
