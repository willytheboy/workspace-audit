# 114 - Agent Control Plane Decision Access Review Queue Integrated

Status: Complete.

## Scope

- Add Data Sources Access Review Queue evidence to the direct Agent Control Plane decision payload.
- Include queue evidence in decision markdown handoffs.
- Preserve queue evidence in Agent Control Plane decision snapshots without storing secrets.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\ui\dashboard-types.js`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`

## Live Check

- Relaunched app on port `3042` with PID `208784`.
- Live Agent Control Plane decision reported `review`.
- Live decision payload reported 1 Data Sources access review queue item.
- First live queue item uses access method `git-https`.
- Live decision markdown includes `Data Sources Access Review Queue`.
- Saved live decision snapshot preserved queue count `1`.
