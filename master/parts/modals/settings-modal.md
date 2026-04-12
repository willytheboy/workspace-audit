# Settings Modal

- Sources:
  - `D:\Development\active\15_master-control\src\components\SettingsModal.tsx`
  - `D:\Development\active\02_ai-agent-studio\frontend\src\components\workspace\SettingsModal.tsx`
- Classification: direct adaptation
- Target in `workspace-audit`: global settings, provider config, workspace roots, diagnostics

## Why It Matters

- Both donor apps converged on a tabbed settings shell.
- The active `master-control` version is the most complete.

## Preferred Donor

- Use `active\15_master-control` as the base.
- Use `ai-agent-studio` only for lineage comparison or lighter sub-flows.

## Tabs To Keep

- Workspace
- AI Providers
- Integrations
- Debug / Diagnostics

## Adaptation Notes

- Move provider config behind future persistence layer
- Add scan roots, source defaults, and audit diagnostics
