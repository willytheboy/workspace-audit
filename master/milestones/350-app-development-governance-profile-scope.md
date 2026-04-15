# Milestone 350 - App-Development Governance Profile Scope

## Status

Completed.

## Goal

Keep Governance onboarding aligned with the product mission: Workspace Audit Pro should manage app-development, app-building, AI-agent, control-plane, tooling, and integration projects, not every unrelated business or demo app in the development folders.

## Delivered

- Added an explicit app-development scope classifier for Governance profile gaps.
- Scoped profile gaps to AI/agent, control-plane, app-management, app-builder, automation, tooling, and integration signals.
- Excluded non-target business operating apps, content sites, media/music/photo tools, trading apps, POS, CRM, recipe, and hospitality apps from starter-pack promotion.
- Added scoped profile coverage counts, gap totals, excluded project totals, and scope evidence to Governance summaries and cards.
- Updated parser and server coverage for the scoped onboarding behavior.

## Validation

- `node --check lib\workspace-audit-server.mjs`
- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check ui\dashboard-types.js`
- `node --check test-parse.js`
- `npm test`
- `node test-parse.js`
- `npm run build:vercel`
