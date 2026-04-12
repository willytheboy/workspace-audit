# 095 - Agent Control Plane Decision API Integrated

## Status

Completed.

## Summary

Add a compact Agent Control Plane decision endpoint that external app-management and supervised-agent runners can use as a ready/review/hold gate before starting the next build pass.

## Scope

- Add `GET /api/agent-control-plane/decision`.
- Classify control-plane state using baseline selection, baseline drift severity, stale baseline state, SLA breaches, stale active runs, and readiness coverage.
- Return JSON and markdown with decision, recommended action, reasons, and compact evidence.
- Add API assertions, parser checks, README documentation, and TODO tracking.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-types.js`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `npm test`
- `node .\generate-audit.mjs`
- `node .\test-parse.js`
- Relaunched app on port `3042` with PID `186608`.
- Live verified `/` dashboard shell, `/api/inventory` with 75 projects, and `/api/agent-control-plane/decision` returning `decision: review`, `baselineDriftSeverity: low`, and markdown decision output.
