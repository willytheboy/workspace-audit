# 152 - Deployment Health Smoke Check API

Status: Complete.

## Scope

- Added a deployment-health target payload derived from registered Data Sources.
- Added non-secret deployment smoke checks that capture only URL, provider, HTTP status, latency, content type, and error class.
- Added local/private URL guardrails so localhost and private network checks require explicit `allowLocal=true`.
- Persisted smoke-check operations in Governance history without storing response bodies, cookies, tokens, credentials, private keys, or certificates.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-api.js`
- `node --check .\ui\dashboard-types.js`
- `node --check .\test-parse.js`
- `node .\test-parse.js`
- `npm test`
- `node .\generate-audit.mjs`
- `npm run build:vercel`

## Notes

- New route: `GET /api/deployments/health`
- New route: `POST /api/deployments/smoke-check`
- The UI wiring is intentionally left for the next milestone after the API surface is stable.

## Live Check

- Relaunched with `npm run dev` on `http://localhost:3042`.
- Dev server shell PID: `197636`.
- Home page returned HTTP 200.
- `GET /api/deployments/health` returned HTTP 200 and deployment-health markdown.
- `POST /api/deployments/smoke-check` against the local dev URL returned HTTP 200 with `status: pass`.
