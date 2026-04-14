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
- Release Control task ledger snapshots: deployment-gate tasks can now be exported, snapshotted, and compared for drift without storing credentials, provider tokens, private keys, certificates, cookies, browser sessions, or command output.
- Release Control task ledger drift checkpoints: saved ledger snapshots now expose `Track Drift` and `Accept Drift` controls so deployment-gate task drift can become a non-secret Governance task or be approved by saving a refreshed Release Control task ledger snapshot.
- Release Build Gate task auto-capture: batch task seeding can now persist a Release Control task ledger snapshot in the same non-secret operation so newly generated deployment-gate tasks have a durable baseline immediately.
- Release Build Gate per-action task snapshots: individual generated gate actions now expose `Track + Snapshot` so one blocker can become a task and ledger baseline without seeding the whole batch.
- Agent Control Plane decision per-reason task snapshots: individual control-plane decision reasons now expose `Track + Snapshot` so one blocker can become a decision task and decision task-ledger baseline without seeding the whole batch.
- Data Sources access review per-item task snapshots: individual source-access review blockers now expose `Track + Snapshot` so one source item can become a task and source-access task-ledger baseline without seeding the whole queue.
- Data Sources evidence coverage per-item task snapshots: individual source-access evidence coverage blockers now expose `Track + Snapshot` so one coverage gap can become a task and source-access task-ledger baseline without seeding the whole batch.
- Data Sources validation workflow per-item task snapshots: individual validation workflow blockers now expose `Track + Snapshot` in Sources and Governance so one workflow item can become a task and source-access task-ledger baseline without seeding the whole batch.
- Data Sources access task-ledger drift checkpoints: saved source-access task ledger snapshots now expose `Copy Drift`, `Track Drift`, and `Accept Drift` controls so source-access task drift can become a non-secret Governance task or be accepted by saving a refreshed baseline.
- Data Sources validation evidence drift checkpoints: saved source-access validation evidence snapshots now expose `Copy Drift`, `Track Drift`, and `Accept Drift` controls so evidence drift can become a non-secret Governance task or be accepted by saving a refreshed baseline.
- Data Sources validation workflow drift checkpoints: saved source-access validation workflow snapshots now expose `Copy Drift`, `Track Drift`, and `Accept Drift` controls so workflow drift can become a non-secret Governance task or be accepted by saving a refreshed baseline.
- Data Sources summary drift checkpoints: saved source-health summary snapshots now expose `Copy Drift`, `Track Drift`, and `Accept Drift` controls so source-health drift can become a non-secret Data Sources task or be accepted by saving a refreshed baseline.
- Data Sources access matrix checkpoints: access-method matrix rows now expose `Confirm`, `Defer`, and `Track Tasks` controls so inferred source-access readiness can be operator-reviewed or converted into source-access review tasks without storing secrets.
- Data Sources access method registry checkpoints: method registry rows now expose `Confirm`, `Defer`, and `Record Evidence` controls so method-level source access classifications can be reviewed or converted into non-secret validation evidence without storing secrets.
- Data Sources access validation runbook checkpoints: generated runbook method cards now expose `Confirm`, `Defer`, and `Track Evidence Tasks` controls so validation guidance can be reviewed or converted into source-access evidence follow-up tasks without storing secrets.
- Data Sources access checklist checkpoints: source checklist items now expose `Confirm`, `Defer`, and `Track Workflow Task` controls so checklist classifications can be operator-reviewed or converted into validation workflow tasks without storing secrets.
- Data Sources deployment health checkpoints: deployment target cards now expose `Confirm`, `Defer`, and `Track Release Task` controls so deployment smoke status can be operator-reviewed or converted into Release Control tasks without storing secrets.
- Data Sources deployment smoke-check ledger checkpoints: recent smoke-check rows now expose `Confirm`, `Defer`, and `Track Release Task` controls so individual smoke outcomes can be reviewed or converted into Release Control tasks without storing response bodies or secrets.
- Release Build Gate local evidence checkpoints: Governance Release Control now exposes `Confirm Local Evidence`, `Defer Local Evidence`, and `Track Evidence Task` controls so local smoke/bootstrap evidence can be reviewed or converted into Release Control tasks without storing response bodies or secrets.
- Release Control saved checkpoint ledger checkpoints: saved release checkpoint rows now expose `Confirm`, `Defer`, and `Track Task` controls so checkpoint history can be reviewed or converted into Release Control tasks without storing response bodies or secrets.
- Release Control checkpoint drift field checkpoints: individual release checkpoint drift fields now expose `Confirm`, `Defer`, and `Track Task` controls so drift can be reviewed or converted into Release Control tasks without storing response bodies or secrets.

## Next Checkpoint Candidates

- Add Release Control task ledger item checkpoints so individual release-control tasks can be confirmed, deferred, or escalated without storing response bodies or secrets.

## Implementation Standard

- Use explicit operator statuses rather than free-form boolean flags.
- Keep every checkpoint non-secret; do not store passwords, tokens, private keys, certificates, cookies, or browser sessions.
- Persist the operator decision separately from the generated signal so the generated signal can be regenerated without losing review history.
- Surface the checkpoint in the same UI where the AI-generated recommendation is shown.
- Add parser checks, tests where server behavior changes, and milestone docs for each checkpoint family.
