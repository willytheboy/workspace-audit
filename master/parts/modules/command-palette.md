# Command Palette

- Source: `D:\Development\active\15_master-control\src\components\CommandPalette.tsx`
- Classification: highest-priority direct adaptation
- Target in `workspace-audit`: universal action layer

## Why It Matters

- Gives the current app a control-center operating surface immediately.
- Enables keyboard-first navigation and action dispatch.
- Provides a scalable place to add future actions without bloating the dashboard.

## Core Pattern

- Action registry
- Action availability per context
- Search + keyboard navigation
- Project-scoped and portfolio-scoped actions

## Initial Actions For `workspace-audit`

- Navigate to Cards / List / Graph / Trends / Sources
- Refresh audit
- Refresh trends
- Refresh sources
- Toggle archived projects
- Focus search
- Open top project details

## Follow-On Actions

- Open setup modal
- Open settings
- Launch local project
- Start workflow
