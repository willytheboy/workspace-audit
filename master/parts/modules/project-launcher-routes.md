# Project Launcher Routes

- Source: `D:\Development\active\02_ai-agent-studio\backend\project_launcher_routes.py`
- Classification: direct backend reference
- Target in `workspace-audit`: local project actions

## Why It Matters

- The current app knows about projects but cannot operate them.
- Launcher routes are the cleanest path from “inventory” to “control”.

## Route Shape Worth Keeping

- list running projects
- list available launch targets
- launch project
- stop project
- get launch status
