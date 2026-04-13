# Operator Review Checkpoints

Purpose: keep AI-generated control-center classifications useful without treating them as final authority. Any automated classification that can affect project grouping, access work, release readiness, or agent execution should expose a non-secret operator checkpoint before it becomes a durable action.

## Confirmed Pattern

- Convergence pairs: allow `confirmed-overlap`, `not-related`, `needs-review`, and `merge-candidate`.
- Store the review as non-secret state with pair IDs, names, score, reasons, status, note, reviewer, source, timestamps, and secret policy.
- Treat `not-related` as a suppression rule for future generated overlap findings for the same pair.
- Keep the original AI score and reasons visible so the operator can judge whether the recommendation is valid.
- Data Sources access methods: Sources registry cards now allow the operator to confirm the inferred method, flag it for review, or mark it blocked through the non-secret access validation evidence ledger.
- Governance action queue: generated remediation items now expose a per-item `Not Actionable` checkpoint that persists to the suppression ledger and can be restored later.
- Release Build Gate actions: each generated gate action now exposes `Track Task` and `Accept Risk` controls so a blocker can become a deduplicated task or a non-secret release checkpoint that records operator acceptance without hiding the original gate evidence.

## Next Checkpoint Candidates

- Agent Control Plane drift: confirm whether snapshot drift is expected, harmful, or approved before converting drift into agent work orders.
- Task auto-seeding: confirm whether generated task batches should be created, deferred, or dismissed when they derive from inferred state.

## Implementation Standard

- Use explicit operator statuses rather than free-form boolean flags.
- Keep every checkpoint non-secret; do not store passwords, tokens, private keys, certificates, cookies, or browser sessions.
- Persist the operator decision separately from the generated signal so the generated signal can be regenerated without losing review history.
- Surface the checkpoint in the same UI where the AI-generated recommendation is shown.
- Add parser checks, tests where server behavior changes, and milestone docs for each checkpoint family.
