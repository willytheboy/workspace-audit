# Master Control (Active)

## Identity

- Source path: `D:\Development\active\15_master-control`
- Product intent: portfolio command cockpit that combines project management, workflow execution, agent orchestration, MCP integrations, and operational tooling.
- Maturity: strongest overall donor in the control-center family.

## Architecture

- Frontend: Vite + TypeScript React app with advanced workspace panels
- Backend: Express + SQLite + Drizzle + service-oriented route layer
- Tooling: Monaco, xterm, charting, MCP SDK, Supabase integration

## Strongest Features

- `src/components/CommandPalette.tsx`
- `src/components/CreateProjectModal.tsx`
- `src/components/SettingsModal.tsx`
- `src/components/LaunchpadDetailPanel.tsx`
- `src/components/WorkflowEngine.tsx`
- `server/services/agentOrchestratorService.ts`
- `server/routes/tasks.ts`

## Best Reusable Parts

- Command palette with action-registry pattern
- Workflow engine UI with explicit approve / build / review pipeline
- Strong project creation and settings experiences
- Agent orchestrator candidate fan-out + winner selection model
- Task route surface with queue projection

## Best Concepts

- Separate action definitions from command surface rendering.
- Make workflows human-supervised rather than fully autonomous.
- Keep the UI cockpit project-aware at all times.

## Integration Value

- Direct UI donor: very high
- Backend-service donor: very high
- Overall architectural donor: very high

## Risks

- The app is broader and heavier than `workspace-audit`; importing too much at once would destabilize the current product.
- Adopt slices, not the whole shell.
