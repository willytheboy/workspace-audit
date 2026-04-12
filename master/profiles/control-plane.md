# Control Plane

## Identity

- Source path: `D:\Development\active\09_control-plane`
- Product intent: desktop portfolio manager for scanning projects, indexing them, comparing similarity, and surfacing health/search/settings.
- Maturity: clean architecture seed, lighter feature depth.

## Architecture

- Monorepo / workspace shape
- Desktop route shell under `controlplane/apps/desktop/src/App.tsx`
- Shared packages for `ui`, `types`, and `shared`
- Tauri/Desktop orientation

## Strongest Features

- Clear route architecture:
  - Dashboard
  - Projects
  - Search
  - Similarity
  - Health
  - Settings
  - Index table
- Strong product framing around project portfolio operations

## Best Reusable Parts

- Information architecture
- Package separation between app shell, UI, and types
- Screen taxonomy for portfolio-level control centers

## Best Concepts

- Keep core portfolio views small and explicit.
- Search, similarity, health, and settings are top-level product pillars.
- The app shell should stay thin while domain modules do the work.

## Integration Value

- Architecture donor: high
- Direct component donor: low-medium

## Risks

- Source files are lighter than the other donor apps; value is mostly in IA and package decomposition, not literal feature import.
