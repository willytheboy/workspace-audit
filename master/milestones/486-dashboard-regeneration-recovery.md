# Milestone 486 - Dashboard Regeneration Recovery

The audit generator used a template that omitted required controls. After a refresh, the dashboard could stop before loading inventory because it tried to bind listeners to missing elements.

- [x] Restore the active project selector, scope controls, JSON and Markdown exports, and Governance target toolbar in the template and local dashboard.
- [x] Generate a fixture page using the real template and assert that all 14 restored elements are present.
- [x] Pass `npm run check`, all 11 local test groups, and `npm run build:vercel`.
- [x] Relaunch on port `3042` and verify HTTP 200, 103 inventory projects, a Governance decision, and all 19 direct startup bindings.

The local API reports a Governance decision of `hold`. Browser automation was unavailable in Work settings, so the checks used the fixture generator and the live HTTP responses.
