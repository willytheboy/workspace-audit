# Milestone 198: Convergence Not Related Active Suppression Fix

Date: 2026-04-13

## Goal

Ensure an app pair marked `Not Related` is removed from the active Convergence overlaps list, not just visually hidden in one workbench surface.

## Completed

- Updated `/api/convergence/candidates` so `not-related` pairs are excluded by default from active candidate results.
- Preserved audit access to suppressed pairs through `status=not-related`, `status=all`, or `includeNotRelated=true`.
- Kept the project workbench local suppression path and button mappings intact.
- Added an end-to-end regression test that creates two overlapping fixture apps, marks the pair `not-related`, verifies the pair disappears from the active candidates response, and verifies audit retrieval still returns it.

## Validation Plan

- Parser checks should confirm active Convergence suppression is wired in the server and test suite.
- Server tests should confirm the active list removal and audit retrieval behavior.
- Full build and smoke checks should run before commit and push.

## Notes

- The persisted review ledger remains non-secret and auditable. The active overlap list now treats `not-related` as a suppression state by default.
