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
- Task-seeding checkpoint ledger: Governance now filters and groups task-batch decisions by lifecycle status so approved, deferred, dismissed, and needs-review checkpoints can be audited independently.
- Source-access checkpoint summaries: Data Sources and Agent Control Plane now surface source-access checkpoint totals, unresolved counts, and source grouping so deferred or needs-review source-access decisions remain visible before ingestion or automated task seeding.
- Source-specific checkpoint drilldowns: individual Data Source cards now show matched checkpoint counts and recent items when source-specific task-seeding checkpoints reference the source ID, path, URL, or label.
- Source-specific checkpoint filters: Data Sources access review and evidence coverage decks now expose unresolved-checkpoint filters using each item's matched source checkpoint drilldown so operators can isolate risky inferred blockers in the currently visible source deck.
- Managed agent and skill policies: generated role, runtime, isolation, skill-bundle, and hook recommendations now require a persisted non-secret policy checkpoint before they become executable agent work orders.
- Convergence active list behavior: pairs marked `not-related` are hidden from the default active Convergence candidates API and active project workbench Convergence list while remaining available through the persisted review ledger and explicit audit filters.
- Convergence workbench removal guard: after a successful `Not Related` review save, the active workbench removes the matching pair from local state before the API reload returns and filters the reloaded payload by pair to prevent stale UI re-adds.
- Agent execution results: failed, cancelled, terminal, stale, and SLA-breached Agent Work Order runs now expose non-secret result checkpoints for retry, archive, retention, SLA resolution, and Control Plane baseline-refresh actions before those actions are finalized.
- Deferred execution-result gates: deferred Agent Execution result checkpoints now create a deduplicated non-secret Governance follow-up task per run/action pair so unresolved retry, archive, SLA, retention, or baseline-refresh decisions remain actionable.
- Execution-result task ledger snapshots: deferred execution-result follow-up tasks can now be exported, snapshotted, and compared for drift without storing credentials, tokens, private keys, certificates, browser sessions, cookies, or command output.
- Execution-result task ledger drift checkpoints: saved ledger snapshots now expose `Track Drift` and `Accept Drift` controls so task-ledger drift can become a non-secret Governance task or be approved by saving a refreshed ledger snapshot.

## Next Checkpoint Candidates

- Add Release Control task ledger drift checkpoint controls so deployment-gate task drift can become a non-secret Governance task or be accepted through a refreshed ledger snapshot.

## Implementation Standard

- Use explicit operator statuses rather than free-form boolean flags.
- Keep every checkpoint non-secret; do not store passwords, tokens, private keys, certificates, cookies, or browser sessions.
- Persist the operator decision separately from the generated signal so the generated signal can be regenerated without losing review history.
- Surface the checkpoint in the same UI where the AI-generated recommendation is shown.
- Add parser checks, tests where server behavior changes, and milestone docs for each checkpoint family.
