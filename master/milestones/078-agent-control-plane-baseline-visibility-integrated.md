# 078 - Agent Control Plane Baseline Visibility Integrated

## Status

Completed.

## Summary

Added explicit Governance visibility for the selected Agent Control Plane baseline so operators can see whether baseline drift actions have a valid comparison point.

## Scope

- Added baseline title and created-at metadata to Governance summary payloads.
- Added a Control Plane Baseline KPI card in Governance.
- Added baseline status to Governance summary text.
- Added baseline markers to Governance markdown reports.
- Added API tests, parser checks, README documentation, and TODO tracking.

## Validation

- `node --check` passed for the updated server, UI types, UI components, UI views, server tests, and parser check.
- `npm test` passed all 4 server test groups.
- `node .\generate-audit.mjs` regenerated the workspace audit with 75 app profiles.
- `node .\test-parse.js` passed, including the Agent control plane baseline summary parser check.
- Relaunched `npm run dev` on port `3042` with PID `193156`.
- Live verification passed: the loaded dashboard component bundle contains the `Control Plane Baseline` KPI card, the Governance views bundle contains baseline report text, inventory reported 75 apps, and Governance summary baseline metadata was empty as expected because no live baseline has been selected.
