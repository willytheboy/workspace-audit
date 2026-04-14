# Milestone 267 - Convergence Review Task Ledger Export

Status: Complete
Date: 2026-04-14

## Objective

Create a copyable, non-secret Convergence Review Task ledger so operator-confirmed overlaps and follow-up tasks can be handed to future CLI runner workflows without scraping Governance UI cards.

## Scope

- Add `/api/convergence/task-ledger` with `all`, `open`, and `closed` status filtering.
- Include convergence pair metadata, review status, recommendation, score, priority, checkpoint status, and no-secrets policy.
- Add Dashboard API typing and Governance copy controls for open, closed, and all task ledgers.
- Add parser and server regression coverage.

## Validation

- Passed syntax checks for the server, dashboard API, dashboard components, dashboard views, dashboard types, and parser.
- Passed `node test-parse.js`.
- Passed `npm test`.
- Passed `npm run build:vercel`.
- Passed `git diff --check`.
- Relaunched local app on port 3042 and smoke-tested the root page, `/api/convergence/task-ledger`, and dashboard bundle.
- Pending: commit and push.
