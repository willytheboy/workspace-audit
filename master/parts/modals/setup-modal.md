# Setup Modal

- Source: `D:\Development\MasterControl\frontend\src\components\SetupModal.jsx`
- Classification: high-value direct adaptation
- Target in `workspace-audit`: source onboarding and project activation flow

## Why It Matters

- Converts source ingestion from a raw form into a guided setup experience.
- Includes success state after connect + scan + analyze.
- Supports local path, GitHub, and Vercel connection modes.

## What To Reuse

- Mode selection screen
- Input step per source type
- Connecting / scanning / analyzing statuses
- Project-ready completion state with next actions

## What To Change

- Replace project-specific APIs with `workspace-audit` source APIs
- Fit current design tokens and modal shell
- Route success actions into source tracking, project detail, and later workflow entrypoints
