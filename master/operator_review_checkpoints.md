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
- Agent Control Plane snapshot drift: each saved snapshot now exposes `Track Drift` and `Accept Drift` controls so drift can become a non-secret Governance task or be approved by refreshing the live control plane as the current baseline.
- Generated task seeding: high-risk task batch controls now expose `Defer Batch` and `Dismiss Batch` checkpoints that persist to a non-secret task-seeding checkpoint ledger and Governance operation log before or instead of creating tasks.
- Source-access task seeding: Sources and Governance toolbar plus command-palette task-batch entry points now expose defer/dismiss checkpoints for validation workflow, review queue, and evidence-coverage task batches that derive from inferred source-access state.
- Source-access inferred blocker items: Data Sources access review queue and evidence coverage cards now expose per-item confirm/defer/dismiss checkpoints before inferred blockers are converted into tasks.

## Next Checkpoint Candidates

- Add checkpoint filtering and lifecycle status grouping to the Task Seeding Checkpoints Governance ledger so approved, deferred, and dismissed source-access decisions can be audited independently.

## Implementation Standard

- Use explicit operator statuses rather than free-form boolean flags.
- Keep every checkpoint non-secret; do not store passwords, tokens, private keys, certificates, cookies, or browser sessions.
- Persist the operator decision separately from the generated signal so the generated signal can be regenerated without losing review history.
- Surface the checkpoint in the same UI where the AI-generated recommendation is shown.
- Add parser checks, tests where server behavior changes, and milestone docs for each checkpoint family.
