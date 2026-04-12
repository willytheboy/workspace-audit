# AI Agent Studio

## Identity

- Source path: `D:\Development\active\02_ai-agent-studio`
- Product intent: AI-assisted software delivery workspace with project launch, agent coordination, memory, and task execution.
- Maturity: Active successor to the archived `AI_team` branch.

## Architecture

- Frontend: React + Vite + Zustand + Supabase client patterns.
- Backend: FastAPI services with orchestration, launcher routes, model-provider integration, and memory-oriented modules.
- Pattern extraction submodule: `patterns-from-project-creator` preserves reusable workflow and task-engine ideas.

## Strongest Features

- Project launcher API in `backend/project_launcher_routes.py`
- Lightweight phase orchestrator in `backend/development_orchestrator.py`
- Workspace command surface in `frontend/src/components/workspace/CommandPalette.tsx`
- Mature settings experience in `frontend/src/components/workspace/SettingsModal.tsx`
- Strong project context drilldown in `frontend/src/components/workspace/LaunchpadDetailPanel.tsx`
- Reusable project-creation flow in `frontend/src/components/workspace/CreateProjectModal.tsx`

## Best Reusable Parts

- `backend/project_launcher_routes.py`
  Good route shape for local project start/stop/status actions.
- `frontend/src/components/workspace/CommandPalette.tsx`
  Strong navigation and action-command pattern.
- `frontend/src/components/workspace/SettingsModal.tsx`
  Good information architecture for providers, integrations, and workspace settings.
- `frontend/src/components/workspace/LaunchpadDetailPanel.tsx`
  Strong notes / CLI / sessions / milestones / todo layout.

## Best Concepts

- Treat each project as an operational unit with launcher, notes, sessions, and milestones.
- Keep provider settings and workspace settings in one controlled settings shell.
- Separate orchestration state from UI chrome.

## Integration Value

- Direct UI donor: high
- Backend route donor: medium-high
- Full architecture donor: medium

## Risks

- Some orchestration code is lightweight and in-memory, so it should not be imported as-is for durable workflow execution.
- Supabase assumptions are embedded into several frontend flows.
