# Milestone 154 - Deployment Smoke Check Ledger

Status: Completed
Completed at: 2026-04-12

## Scope

- Persist deployment smoke-check results in `deploymentSmokeChecks` as a bounded non-secret ledger.
- Add `GET /api/deployments/smoke-checks` with markdown export for external deployment-health handoffs.
- Enrich `GET /api/deployments/health` with latest target smoke state and recent smoke-check results.
- Feed deployment smoke-check counts into diagnostics, Governance, Agent Control Plane handoffs, snapshots, and snapshot drift metrics.
- Add a Sources toolbar and command-palette action for copying the deployment smoke-check ledger.

## Secret Policy

- Smoke checks store URL, provider, host, HTTP status, content type, latency, timeout, checked timestamp, and error class.
- Smoke checks do not store response bodies, passwords, tokens, private keys, certificates, cookies, or browser-session data.
- Local/private smoke-check URLs remain guarded by explicit `allowLocal=true`.

## Validation

- `node --check .\lib\workspace-audit-store.mjs`
- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-api.js`
- `node --check .\ui\dashboard-types.js`
- `node --check .\ui\dashboard-views.js`
- `node --check .\ui\dashboard-actions.js`
- `node --check .\app.js`
- `node --check .\test-parse.js`
- `node .\test-parse.js`
- `npm test`
- `node .\generate-audit.mjs`
- `npm run build:vercel`
- `git diff --check`

## Notes

- `node .\test-parse.js` reports deployment health smoke checks and deployment health Sources deck as present.
- `npm test` passes all five test suites, including the server smoke-check ledger route, Governance integration, and Agent Control Plane snapshot drift assertions.
- Generated `index.html`, `inventory.json`, and the Vercel static preview were refreshed after the UI template change.
