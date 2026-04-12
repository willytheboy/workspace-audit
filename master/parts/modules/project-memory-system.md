# Project Memory System

- Source: `D:\Development\archive\experiments\AI_project_creator\core\ai_integration\project_memory_system.py`
- Classification: extract domain model only
- Target in `workspace-audit`: durable project memory layer

## Why It Matters

- It models the right durable objects:
  - todos
  - project briefs
  - detailed briefs
  - meeting notes
  - decision log
  - sprint plan
  - conversation context
  - execution history

## Recommended Adaptation

- Port the data model into SQLite-backed tables
- Keep JSON export and summary generation as utility features
- Do not copy the file directly as runtime code
