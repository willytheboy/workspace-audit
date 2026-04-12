# 115 - Agent Control Plane Snapshot Drift Access Review Queue Integrated

Status: Complete.

## Scope

- Add Data Sources Access Review Queue metrics to Agent Control Plane snapshot drift.
- Compare queue total, blocked queue items, and priority split between saved snapshots and live control-plane state.
- Feed live queue evidence into direct snapshot drift and baseline-status comparisons.

## Validation

- `node --check .\lib\workspace-audit-server.mjs`
- `node --check .\tests\server.test.mjs`
- `node --check .\test-parse.js`
- `node .\generate-audit.mjs`
- `npm test`
- `node .\test-parse.js`

## Live Check

- Relaunched app on port `3042` with PID `141896`.
- Created live snapshot `Live Access Review Queue Drift Baseline`.
- Live snapshot stored Access Review Queue count `1`.
- Live snapshot drift reported queue count `1 -> 1`.
- Live snapshot drift reported medium-priority queue count `1 -> 1`.
- Live snapshot drift score remained `0`, confirming no false drift when queue state is unchanged.
- Live snapshot drift markdown includes `Data Sources access review queue`.
