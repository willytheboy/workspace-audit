# MasterControl (Legacy COMMAND CORE)

## Identity

- Source path: `D:\Development\MasterControl`
- Product intent: local-first project control system that scans workspaces, recommends action, documents projects, and supports AI-assisted merger/analysis workflows.
- Maturity: strong product-direction donor with some older implementation choices.

## Architecture

- Frontend pages: Dashboard, Workspace, Analysis, Ask, Advisor, Merger
- Frontend components: setup, settings, layout, folder picker, project card
- Backend: FastAPI services including merge-analysis logic

## Strongest Features

- `frontend/src/components/SetupModal.jsx`
- `frontend/src/pages/Merger.jsx`
- `backend/merger.py`
- Product framing in `PRODUCT_BRIEF.md`

## Best Reusable Parts

- Setup/onboarding modal for connecting local, GitHub, and Vercel sources
- Merge-analysis service concept
- “Project ready” completion state after connection + scan + analysis

## Best Concepts

- Connect a project, scan it, analyze it, and route the user into action quickly.
- Make onboarding operational, not decorative.
- Merger analysis belongs as an expert tool, not a homepage feature.

## Integration Value

- Onboarding donor: very high
- Analysis-tool donor: high
- Direct settings donor: medium

## Risks

- Frontend code is older and less composable than the active `master-control` branch.
- Use it for onboarding and merger concepts, not as the base UI system.
