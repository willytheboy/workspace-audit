# CommandCore Portable

## Identity

- Source path: `D:\Development\CommandCore-Portable`
- Product intent: lightweight portable control center with dashboard, project page, launchpad, and AI bridge.
- Maturity: leaner derivative of the control-center family.

## Architecture

- Frontend: React/Vite style shell in `frontend/src`
- Backend: FastAPI + lightweight persistence in `backend`

## Strongest Features

- `frontend/src/components/ContinueWorkPanel.jsx`
- `frontend/src/components/CreateProjectModal.jsx`
- `frontend/src/components/LaunchpadDetailPanel.jsx`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/DevLaunchpadPage.jsx`

## Best Reusable Parts

- Continue-work/resume-session CTA pattern
- Lightweight launchpad and project-card patterns
- Reduced-complexity modal implementations

## Best Concepts

- Preserve a small, low-friction control-center experience.
- Not every cockpit feature needs the full `master-control` surface area.

## Integration Value

- Lightweight UI donor: medium-high
- Strategic donor: medium

## Risks

- Fewer advanced abstractions than `master-control`.
- Better as a simplification reference than a primary architecture source.
