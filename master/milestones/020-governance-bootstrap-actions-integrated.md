# 020 Governance Bootstrap Actions Integrated

Date: 2026-04-10

Completed:

- Added bulk governance bootstrap actions for the currently visible governance gaps.
- Added `POST /api/governance/bootstrap` to seed default governance profiles from the live inventory.
- Added governance-panel actions and command-palette hooks so visible gaps can be bootstrapped without leaving the portfolio surface.

Validation:

- `npm test`
- `node .\generate-audit.mjs`
- `node .\test-parse.js`
