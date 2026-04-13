# Workspace Audit Master TODO

## Discovery

- [x] Confirm target applications for the `AI / agent platform` and `Platform / control center` families.
- [x] Create a profile markdown for each target application.
- [x] Record source paths, tech stack, architecture shape, scripts, and notable UI patterns for each profile.
- [x] Identify the strongest modules, modals, and scripts worth reusing.

## Ingestion Planning

- [x] Create `to_ingest.md` as the authoritative ingest index.
- [x] Create `product_parts.md` with reusable parts grouped by domain and implementation cost.
- [x] Create a `parts` folder with collected viable modules, modals, and scripts or precise extraction notes.

## Product Blueprint

- [x] Write the future-intent definition for the merged product.
- [x] Produce the new project schematic.
- [x] Produce the blueprint and integration flow.
- [x] Produce the flowchart.
- [x] Define levels, layers, targets, and phased build strategy.

## Implementation

- [x] Choose the first integration slice with the highest value / lowest coupling.
- [x] Implement the first slice in `workspace-audit`.
- [x] Run tests and validate the slice.
- [x] Record the milestone and mark the completed tasks.

## Next Cycle

- [x] Add a global settings modal based on the strongest `master-control` donor.
- [x] Add a durable persistence layer for sources, findings, tasks, and workflows.
- [x] Replace the current app modal with a project workbench / launchpad detail panel.

## Next Wave

- [x] Add durable project memory for notes, decisions, and milestones inside the workbench.
- [x] Persist scan runs as first-class records instead of summary-only history files.
- [x] Add a workflow engine surface with explicit phase progression and approval states.

## Next Horizon

- [x] Promote `workspace-state.json` persistence to SQLite while keeping the current JSON store as a compatibility export.
- [x] Add scan diffing so trends can show what changed between runs, not only totals.
- [x] Add a dedicated governance view for decisions, milestones, and recent workflow activity across all projects.

## Next Runway

- [x] Add persisted project governance profiles with owner, lifecycle, tier, and target state.
- [x] Add cross-project filtering and sorting inside the Governance view.
- [x] Add governance exports and review summaries for milestone / decision reporting.

## Next Acceleration

- [x] Add governance gap detection so unprofiled projects are visible from the portfolio view.
- [x] Add one-click profile and task creation from governance gap entries.
- [x] Add governance history snapshots so ownership and lifecycle changes can be tracked over time.

## Next Operations

- [x] Add bulk bootstrap actions for the currently visible governance gaps.
- [x] Add starter-pack creation so governance onboarding can seed profiles, tasks, and workflows together.
- [x] Surface project-level governance history inside the workbench overview.

## Next Control Loop

- [x] Add a governance action queue derived from gaps and incomplete portfolio state.
- [x] Add one-click remediation for queue items from the Governance view.
- [x] Add portfolio action-queue reporting to governance summaries and exports.

## Phase Consolidation

- [x] Lock donor scope to app management, app development, and app building products only.
- [x] Consolidate the current implementation phase and mark it complete in the master planning docs.
- [x] Re-verify the live app after consolidation.

## Next Queue Operations

- [x] Add bulk execution for automatically resolvable Governance queue items.
- [x] Add persisted suppression for intentionally deferred Governance queue entries.
- [x] Surface queue execution and suppression in the Governance toolbar and command palette.

## Next Queue Review

- [x] Surface suppressed Governance queue items in the portfolio view.
- [x] Add one-click restore for suppressed Governance queue entries.
- [x] Add server-side restore support and test coverage for the suppression lifecycle.

## Next Audit Loop

- [x] Persist Governance operation records for bootstrap, queue execution, suppression, and restore actions.
- [x] Surface the Governance operation log in the portfolio control-center view.
- [x] Add operation-log coverage to reporting, parser checks, and lifecycle tests.

## Next Agent Runbook

- [x] Derive supervised workflow runbook items from active project workflows.
- [x] Surface readiness, blockers, and next steps in the Governance control-center view.
- [x] Add runbook coverage to reporting, parser checks, and lifecycle tests.

## Next Execution History

- [x] Persist launchpad script run metadata from the live `/api/run` stream.
- [x] Add project-level script run history to the workbench launchpad.
- [x] Add script-run history coverage to API tests, parser checks, docs, and diagnostics.

## Next Agent Handoff

- [x] Generate a project-level Agent Handoff Pack from workbench context.
- [x] Add a Launchpad action to copy the handoff pack for supervised AI/agent work.
- [x] Add handoff-pack coverage to parser checks, docs, and milestone tracking.

## Next Agent Session Log

- [x] Persist Agent Handoff Pack creation as project-level Agent Session records.
- [x] Surface recent Agent Sessions in the project workbench Launchpad.
- [x] Add Agent Session coverage to API tests, parser checks, docs, and diagnostics.

## Next Agent Portfolio

- [x] Surface Agent Sessions in the Governance control-center view.
- [x] Add Agent Session filtering and reporting to the Governance portfolio layer.
- [x] Add Agent Session governance coverage to tests, parser checks, docs, and validation.

## Next Agent Readiness

- [x] Derive an Agent Readiness Matrix from profiles, workflows, tasks, findings, and Agent Sessions.
- [x] Surface readiness scores, blockers, and next steps in the Governance control-center view.
- [x] Add readiness filtering, reporting, parser checks, API tests, docs, and validation.

## Next Readiness Actions

- [x] Map readiness blockers to existing Governance quick actions.
- [x] Add action buttons to Agent Readiness Matrix cards.
- [x] Add readiness-action parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Work Orders

- [x] Generate markdown Agent Work Orders from the filtered Agent Readiness Matrix.
- [x] Add a Governance toolbar action and command-palette action for copying work orders.
- [x] Add work-order parser checks, docs, milestone tracking, validation, and relaunch.

## Next Work Orders API

- [x] Add a `/api/agent-work-orders` endpoint for readiness-derived JSON and markdown work orders.
- [x] Add a typed dashboard API client method for external work-order consumers.
- [x] Add work-order API coverage, docs, parser checks, validation, and relaunch.

## Next Work Order Snapshots

- [x] Persist Agent Work Order snapshots created from Governance work-order copy actions.
- [x] Surface Work Order Snapshots in the Governance control-center view and reports.
- [x] Add snapshot API coverage, diagnostics, parser checks, docs, validation, and relaunch.

## Next Snapshot Control

- [x] Add a direct Save Work Orders control to Governance.
- [x] Add command-palette support for saving Agent Work Order snapshots.
- [x] Add parser checks, docs, milestone tracking, validation, and relaunch.

## Next Snapshot Reuse

- [x] Add Copy Snapshot actions to persisted Work Order Snapshot cards.
- [x] Bind snapshot-copy controls to the persisted markdown payload.
- [x] Add parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Execution Queue

- [x] Persist Agent Work Order execution queue records.
- [x] Add queue, start, block, pass, and fail controls in Governance.
- [x] Add Agent Work Order run API coverage, parser checks, docs, validation, and relaunch.

## Next Snapshot Batch Queue

- [x] Add a batch queue endpoint that creates Agent Work Order runs from a saved snapshot.
- [x] Add Queue Snapshot controls with duplicate-run protection.
- [x] Add batch queue API tests, parser checks, docs, validation, and relaunch.

## Next Execution Event Log

- [x] Add event history to Agent Work Order run creation, batch queueing, and status transitions.
- [x] Surface latest execution events and event counts in Governance.
- [x] Add event-log tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution Metrics

- [x] Add Agent Execution Metrics to Governance with status split, stale active runs, completion rate, failure rate, and latest event metadata.
- [x] Surface execution metrics in Governance KPI cards, deck sections, summaries, and reports.
- [x] Add metrics API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution Timeline

- [x] Render per-run Agent Execution timelines from persisted event history.
- [x] Include execution event timelines in Governance reports.
- [x] Add timeline parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution Validation

- [x] Surface per-run validation checklists in Agent Execution Queue cards.
- [x] Include validation commands in Governance reports.
- [x] Add validation-checklist parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution Briefs

- [x] Add a Copy Brief action to Agent Execution Queue cards.
- [x] Generate single-run execution briefs with objective, blockers, validation commands, event timeline, and notes.
- [x] Add brief-copy parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution Cancellation

- [x] Add a Cancel control for queued, running, and blocked Agent Execution runs.
- [x] Verify cancelled status transitions retain event history.
- [x] Add cancellation parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution Recovery

- [x] Add Resume controls for blocked Agent Execution runs.
- [x] Add Retry controls for failed and cancelled Agent Execution runs.
- [x] Add recovery-transition API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution Filtering

- [x] Add an execution-status filter to the Governance toolbar.
- [x] Filter Agent Execution Queue cards by active, queued, running, blocked, passed, failed, or cancelled status.
- [x] Add filter parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution Operation Log

- [x] Record Governance operation-log entries for Agent Execution run creation.
- [x] Record Governance operation-log entries for snapshot batch queueing and status transitions.
- [x] Add operation-log API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Stale Execution Indicators

- [x] Add stale-active warning tags to Agent Execution Queue cards.
- [x] Include stale-active markers in Governance reports.
- [x] Add stale indicator parser checks, docs, milestone tracking, validation, and relaunch.

## Next Stale Execution Action

- [x] Add a Block Stale Runs toolbar action for visible stale Agent Execution runs.
- [x] Add command-palette support for blocking visible stale Agent Execution runs.
- [x] Add stale-action parser checks, docs, milestone tracking, validation, and relaunch.

## Next Terminal Execution Retry

- [x] Add a Retry Terminal Runs toolbar action for visible failed or cancelled Agent Execution runs.
- [x] Add command-palette support for retrying visible failed or cancelled Agent Execution runs.
- [x] Add terminal-retry parser checks, docs, milestone tracking, validation, and relaunch.

## Next Queued Execution Start

- [x] Add a Start Queued Runs toolbar action for visible queued Agent Execution runs.
- [x] Add command-palette support for starting visible queued Agent Execution runs.
- [x] Add queued-start parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution Brief Pack

- [x] Add a Copy Run Briefs toolbar action for visible Agent Execution runs.
- [x] Add command-palette support for copying filtered Agent Execution brief packs.
- [x] Add brief-pack parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution Run Archive Layer

- [x] Add durable archive metadata for Agent Execution runs without deleting event history.
- [x] Hide archived runs from the default Governance execution view and add a Show Archived Runs control.
- [x] Add per-run Archive/Restore controls plus a bulk Archive Completed Runs action.
- [x] Add archive-layer API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution Run Retention Controls

- [x] Add a Completed execution-status filter for passed, failed, and cancelled runs.
- [x] Add a configurable completed-run retention selector to Governance.
- [x] Add an Apply Retention action that archives older visible completed runs without deleting history.
- [x] Add retention API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution Queue Saved Views

- [x] Add persisted Governance execution saved views for reusable queue filters.
- [x] Capture search, scope, sort, execution status, retention, and archived-run visibility in each saved view.
- [x] Add a Saved Execution View selector plus Save Exec View toolbar and command-palette action.
- [x] Add saved-view API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution SLA Policy Config

- [x] Add a persisted Agent Execution SLA policy with configurable stale threshold hours.
- [x] Route Governance stale-active metrics, reports, and stale-run actions through the saved policy.
- [x] Add a Save SLA Policy toolbar and command-palette action.
- [x] Add SLA policy API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution SLA Breach Actions

- [x] Add durable SLA breach metadata to Agent Execution runs.
- [x] Add a bulk Action SLA Breaches control and command-palette action for visible stale runs.
- [x] Surface SLA breach counts and tags in Governance metrics, cards, and reports.
- [x] Add SLA breach API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution SLA Breach Review Filter

- [x] Add an SLA Breached execution-status filter to the Governance toolbar.
- [x] Route the SLA Breached filter through saved execution views and search matching.
- [x] Add saved-view API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution SLA Breach Resolution

- [x] Add durable SLA breach resolution metadata to Agent Execution runs.
- [x] Add a bulk Resolve SLA Breaches control and command-palette action for visible unresolved breaches.
- [x] Update unresolved-breach metrics, tags, reports, parser checks, docs, API tests, validation, and relaunch.

## Next Execution SLA Resolved Review Filter

- [x] Add an SLA Resolved execution-status filter to the Governance toolbar.
- [x] Route the SLA Resolved filter through saved execution views.
- [x] Add saved-view API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution SLA Resolution Metrics

- [x] Add resolved SLA breach count and average resolution time to Agent Execution metrics.
- [x] Surface SLA resolution throughput in Governance metric cards, summaries, and reports.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution SLA Breach Ledger

- [x] Add a Governance SLA Breach Ledger derived from Agent Execution run breach metadata.
- [x] Surface open and resolved breach lifecycle records with duration, escalation, and resolution evidence.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution SLA Ledger Scope

- [x] Add an SLA Breach Ledger scope to Governance controls.
- [x] Route SLA ledger records through Governance search, sort, and saved execution views.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution SLA Ledger Export

- [x] Add a Copy SLA Ledger toolbar action.
- [x] Add command-palette support for copying the filtered SLA Breach Ledger.
- [x] Add parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution SLA Ledger API

- [x] Add a direct SLA ledger API with JSON and markdown output.
- [x] Support state filtering and result limits for external agent-control consumers.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Execution SLA Ledger Snapshots

- [x] Add persisted SLA ledger snapshots with JSON and markdown payloads.
- [x] Surface SLA ledger snapshots in Governance with copy actions and command-palette save support.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane API

- [x] Add a consolidated agent control-plane endpoint for external platform consumers.
- [x] Include readiness, work orders, execution runs, SLA ledger state, snapshots, metrics, policy, and markdown.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Export

- [x] Add a toolbar action for copying the consolidated Agent Control Plane handoff.
- [x] Add command-palette support backed by the live Agent Control Plane API markdown payload.
- [x] Add parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Snapshots

- [x] Add persisted Agent Control Plane snapshots with full markdown handoffs.
- [x] Surface Control Plane snapshots in Governance with copy actions and command-palette save support.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Snapshot Drift

- [x] Add a read-only Agent Control Plane snapshot drift API.
- [x] Surface snapshot drift copy actions in Governance snapshot cards.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Latest Agent Control Plane Drift Shortcut

- [x] Add `snapshotId=latest` support to the Control Plane drift API.
- [x] Add toolbar and command-palette actions for copying latest Control Plane drift.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Baseline Drift

- [x] Add persisted Agent Control Plane baseline snapshot tracking.
- [x] Add baseline drift API support and Governance baseline actions.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Baseline Snapshot Save

- [x] Add baseline creation support to Agent Control Plane snapshot saves.
- [x] Add toolbar and command-palette actions for saving a baseline Control Plane snapshot.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Baseline Visibility

- [x] Add baseline title and created-at metadata to Governance summaries.
- [x] Surface baseline status in Governance KPI cards and markdown reports.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Baseline Status

- [x] Add a direct baseline status API with markdown output.
- [x] Add toolbar and command-palette actions for copying baseline status.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Baseline Status Deck

- [x] Add a visible Governance deck section for Control Plane baseline status.
- [x] Route baseline status through Governance search, scope, and item counts.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Missing Baseline Drift

- [x] Return a copyable missing-baseline drift report for `snapshotId=baseline`.
- [x] Keep explicit missing snapshot and latest-snapshot failures strict.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Clear Baseline

- [x] Add an API route to clear the active Control Plane baseline without deleting snapshots.
- [x] Add toolbar, command-palette, and deck actions for clearing the baseline.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Baseline Freshness

- [x] Add baseline age and freshness metadata to server payloads.
- [x] Surface baseline freshness in Governance KPI cards, deck status, summary text, and reports.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Baseline Refresh

- [x] Add a direct baseline refresh API that saves the live Control Plane as the new baseline snapshot.
- [x] Add toolbar, command-palette, and Baseline Status deck controls for refreshing the baseline.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Baseline Drift Visibility

- [x] Add Governance summary drift metadata for the active Control Plane baseline.
- [x] Surface baseline drift score in KPI cards, Baseline Status deck, summaries, and reports.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Baseline Drift Fields

- [x] Add field-level baseline drift delta metadata to Governance payloads.
- [x] Surface baseline drift fields in the Baseline Status deck, summaries, and reports.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Baseline Health

- [x] Add baseline health and recommended action metadata to Governance payloads.
- [x] Surface baseline health in KPI cards, Baseline Status deck, summaries, and reports.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Baseline Status Health API

- [x] Add baseline health and recommended action metadata to the direct baseline status API.
- [x] Add compact drift field deltas to baseline status API markdown and JSON.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Baseline Health Handoff

- [x] Add baseline status to the consolidated Agent Control Plane payload.
- [x] Add baseline health/action/drift fields to consolidated markdown handoffs.
- [x] Add saved Agent Handoff sessions to consolidated payloads so baseline drift accounts for handoff changes.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Snapshot Drift Fields

- [x] Add compact drift item deltas to Control Plane snapshot drift JSON payloads.
- [x] Add a Drift Fields section to Control Plane snapshot drift markdown, including missing-baseline drift reports.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Snapshot Drift Decision

- [x] Add drift severity to Control Plane snapshot drift JSON payloads.
- [x] Add recommended action guidance to snapshot drift markdown and JSON.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Snapshot Drift Severity Feedback

- [x] Show copied drift severity in Governance snapshot card and toolbar drift action feedback.
- [x] Add parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Baseline Status Drift Decision

- [x] Promote drift severity to the direct baseline status API JSON and markdown.
- [x] Promote drift recommended action to the direct baseline status API JSON and markdown.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Baseline Decision Handoff

- [x] Add baseline drift severity and drift action to Governance baseline status payloads.
- [x] Surface baseline drift severity and drift action in consolidated Agent Control Plane markdown and Governance reports.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Decision API

- [x] Add a direct Agent Control Plane decision endpoint for external supervised-agent gates.
- [x] Classify the control plane as ready, review, or hold using baseline, drift, SLA, stale-run, and readiness evidence.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Decision Deck

- [x] Add the Agent Control Plane decision payload to the Governance rollup.
- [x] Surface the ready/review/hold gate as a Governance KPI, deck card, toolbar copy action, and command-palette action.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Decision Snapshots

- [x] Add persisted Agent Control Plane decision snapshots with copyable markdown.
- [x] Surface decision snapshot history in Governance with save and copy actions.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Health Summary

- [x] Add a normalized Data Sources summary API with ready/review/blocked health and markdown output.
- [x] Upgrade the Sources view to render health-aware source cards from the summary payload.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Summary Handoff

- [x] Add a Sources toolbar action for copying the live Data Sources health summary.
- [x] Add command-palette support for copying the Data Sources markdown handoff.
- [x] Add parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Health Snapshots

- [x] Add persisted Data Sources health summary snapshots to the local store and API.
- [x] Add Sources toolbar and command-palette actions for saving health snapshots.
- [x] Surface saved source-health snapshots in the Sources view with copy actions.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Snapshot Drift

- [x] Add a latest Data Sources snapshot-vs-live drift API with severity, score, and markdown output.
- [x] Add Sources toolbar and command-palette actions for copying latest source snapshot drift.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Registry Removal

- [x] Add a safe source registry removal API that does not delete local files or remote resources.
- [x] Add per-source Remove controls to the Sources view with confirmation and refresh behavior.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Access Requirements

- [x] Add non-secret access requirement classification for local folders, GitHub repos, Vercel, Supabase, AI workspaces, and generic remote sources.
- [x] Add a copyable Data Sources access requirements API and Sources toolbar / command-palette action.
- [x] Surface access method, review status, credential hints, and no-secrets policy on source cards.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Access Checklist

- [x] Add an actionable Data Sources access checklist API with ready/review/blocked checklist status.
- [x] Convert access methods into concrete validation actions without storing secrets.
- [x] Add Sources toolbar and command-palette actions for copying the checklist.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Access Gate

- [x] Add a Data Sources ready/review/hold access gate API for ingestion and automated agent work.
- [x] Promote checklist and access-requirement evidence into gate reasons and recommended action.
- [x] Add Sources toolbar and command-palette actions for copying the gate handoff.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Data Sources Access Gate

- [x] Add Data Sources access gate evidence to the consolidated Agent Control Plane payload.
- [x] Add Data Sources access gate evidence to Agent Control Plane markdown handoffs.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Decision Data Sources Gate

- [x] Add Data Sources access gate evidence to the direct Agent Control Plane decision API.
- [x] Add source-access review/hold reasons to decision payloads and decision snapshots.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Snapshot Data Sources Gate

- [x] Add Data Sources access gate metadata to persisted Agent Control Plane snapshot records.
- [x] Compute Data Sources access gate state during snapshot creation and baseline refresh.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Snapshot Drift Data Sources Gate

- [x] Add Data Sources access gate rank, review count, blocked count, and token-likely count to snapshot drift metrics.
- [x] Surface Data Sources gate drift through existing snapshot and baseline drift reports.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Access Matrix

- [x] Add a Data Sources access matrix API grouped by access method and credential signal.
- [x] Add Sources toolbar and command-palette actions for copying the matrix.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Access Matrix Deck

- [x] Render the Data Sources access matrix inline in the Sources view.
- [x] Show access method, source count, review count, and token/certificate/SSH signal counts.
- [x] Add parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Access Review Queue

- [x] Add a Data Sources access review queue API derived from checklist and matrix evidence.
- [x] Render review queue items in the Sources view and add copy actions to the toolbar and command palette.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Data Sources Access Review Queue

- [x] Add Data Sources access review queue evidence to consolidated Agent Control Plane payloads.
- [x] Add Data Sources access review queue evidence to Agent Control Plane markdown and snapshots.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Decision Access Review Queue

- [x] Add Data Sources access review queue evidence to the direct Agent Control Plane decision payload.
- [x] Preserve Data Sources access review queue evidence in Agent Control Plane decision snapshots.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Snapshot Drift Access Review Queue

- [x] Add Data Sources access review queue count and priority split to Agent Control Plane snapshot drift metrics.
- [x] Pass live access review queue evidence into direct snapshot drift and baseline-status comparisons.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Governance Data Sources Access Review Queue

- [x] Add Data Sources access review queue evidence to Governance payloads and summary metrics.
- [x] Render Data Sources access review queue evidence in the Governance control-center deck and reports.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Governance Data Sources Access Review Queue Copy

- [x] Add a Governance toolbar action for copying the filtered Data Sources access review queue.
- [x] Add a command-palette action for copying the same non-secret source-access handoff.
- [x] Add parser checks, docs, milestone tracking, validation, and relaunch.

## Next Governance Data Sources Access Gate

- [x] Add Data Sources access gate evidence to Governance payloads and summary metrics.
- [x] Render Data Sources access gate evidence in the Governance control-center deck and reports.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Governance Data Sources Access Gate Copy

- [x] Add a Governance toolbar action for copying the filtered Data Sources access gate.
- [x] Add a command-palette action for copying the same non-secret source-access gate handoff.
- [x] Add parser checks, docs, milestone tracking, validation, and relaunch.

## Next Governance Data Sources Access Review Task Seeding

- [x] Add a deduplicated server endpoint for creating Governance tasks from Data Sources access review queue items.
- [x] Add Governance toolbar and command-palette actions for seeding visible source-access tasks.
- [x] Add parser checks, docs, milestone tracking, validation, and relaunch.

## Next Governance Data Sources Access Task Ledger

- [x] Add Data Sources access task metrics and ledger records to Governance payloads.
- [x] Render the Data Sources access task ledger in the Governance deck, summaries, and reports.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Governance Data Sources Access Task Lifecycle

- [x] Add Resolve, Reopen, and Block controls to Data Sources access task ledger cards.
- [x] Bind lifecycle controls to the existing task update API without overwriting source-access evidence.
- [x] Add parser checks, API tests, docs, milestone tracking, validation, and relaunch.

## Next Governance Data Sources Access Task Ledger Copy

- [x] Add a Governance toolbar action for copying the filtered Data Sources access task ledger.
- [x] Add a command-palette action for copying the same non-secret source-access task handoff.
- [x] Add parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Snapshot Drift Data Sources Tasks

- [x] Add Data Sources access task totals/open/closed counts to Agent Control Plane snapshot metric deltas.
- [x] Add Data Sources access task counts to consolidated Agent Control Plane markdown handoffs.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Decision Data Sources Tasks

- [x] Add Data Sources access task totals/open/closed counts to the direct Agent Control Plane decision payload.
- [x] Add a bounded non-secret Data Sources access task section and review reason for open source-access tasks.
- [x] Add dashboard display, API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Access Task Ledger API

- [x] Add a non-secret server payload and markdown builder for Data Sources access task ledger exports.
- [x] Add `GET /api/sources/access-task-ledger` with `all`, `open`, and `closed` status filters.
- [x] Add API client/types, tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Access Task Ledger Snapshots

- [x] Add persisted store support for Data Sources access task ledger snapshots.
- [x] Add `GET` and `POST /api/sources/access-task-ledger-snapshots` with non-secret markdown handoffs.
- [x] Add API client/types, tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Governance Data Sources Access Task Ledger Snapshot UI

- [x] Add Data Sources access task ledger snapshots to Governance payloads, summaries, reports, and deck sections.
- [x] Add toolbar, command-palette, save, and copy-card actions for non-secret source-access task ledger snapshots.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Snapshot Drift Data Sources Task Ledger Snapshots

- [x] Add Data Sources access task ledger snapshot count to consolidated Agent Control Plane markdown.
- [x] Add Data Sources access task ledger snapshot count to Agent Control Plane snapshot metric deltas.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Access Task Ledger Snapshot Drift API

- [x] Add a Data Sources access task ledger snapshot drift payload and markdown builder.
- [x] Add `GET /api/sources/access-task-ledger-snapshots/diff` with latest/specific snapshot support.
- [x] Add API client/types, tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Governance Data Sources Access Task Ledger Snapshot Drift Copy

- [x] Add a Governance toolbar action for copying latest Data Sources access task ledger snapshot drift.
- [x] Add a command-palette action for the same non-secret drift handoff.
- [x] Add parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Access Validation Runbook

- [x] Add a non-secret access validation runbook payload and markdown builder grouped by access method.
- [x] Add `GET /api/sources/access-validation-runbook` and Sources toolbar/command copy actions.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Governance Data Sources Access Validation Runbook

- [x] Add Data Sources access validation runbook counts and payloads to Governance and Agent Control Plane handoffs.
- [x] Surface access validation methods in the Governance deck, summary text, reports, and decision gate cards.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Access Validation Evidence Ledger

- [x] Add persisted non-secret Data Sources access validation evidence records.
- [x] Add `GET` and `POST /api/sources/access-validation-evidence` with secret-like evidence rejection.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Governance Data Sources Access Validation Evidence Ledger

- [x] Add Data Sources access validation evidence counts and records to Governance and Agent Control Plane handoffs.
- [x] Surface validation evidence in the Governance deck, summary text, reports, decision gate, and snapshot drift metrics.
- [x] Add API tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Access Validation Evidence Ledger Copy

- [x] Add Sources and Governance toolbar actions for copying the non-secret Data Sources access validation evidence ledger.
- [x] Add command-palette actions for the same evidence handoff.
- [x] Add parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Access Validation Evidence Snapshots

- [x] Add persisted store support for Data Sources access validation evidence snapshots.
- [x] Add `GET` and `POST /api/sources/access-validation-evidence-snapshots` plus `/diff` for non-secret evidence drift checks.
- [x] Add API client/types, tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Governance Data Sources Access Validation Evidence Snapshot UI

- [x] Add Data Sources access validation evidence snapshot counts and records to Governance.
- [x] Add Governance deck cards, toolbar actions, command-palette save/copy drift actions, and report/search visibility.
- [x] Add tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Data Sources Access Validation Evidence Snapshot Drift

- [x] Add Data Sources access validation evidence snapshot counts to Agent Control Plane payloads and markdown handoffs.
- [x] Add evidence snapshot count tracking to Agent Control Plane saved snapshots, decision snapshots, and snapshot metric deltas.
- [x] Add tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Governance Data Sources Access Validation Evidence Snapshot Drift Visibility

- [x] Add latest Data Sources access validation evidence snapshot drift payloads to Governance.
- [x] Surface evidence snapshot drift in Governance KPI cards, deck sections, summaries, and reports.
- [x] Add tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Access Validation Evidence Coverage API

- [x] Add a derived non-secret Data Sources access validation evidence coverage payload.
- [x] Expose coverage through `/api/sources/access-validation-evidence-coverage` and the dashboard API client.
- [x] Add tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Governance Data Sources Access Validation Evidence Coverage

- [x] Add Data Sources access validation evidence coverage to Governance payloads and summary metrics.
- [x] Surface evidence coverage in Governance KPI cards, deck sections, summaries, and reports.
- [x] Add tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Agent Control Plane Data Sources Access Validation Evidence Coverage

- [x] Add Data Sources access validation evidence coverage to Agent Control Plane handoffs and markdown.
- [x] Add coverage gaps to Agent Control Plane decision payloads, decision snapshots, and snapshot drift metrics.
- [x] Add tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Access Validation Evidence Coverage Task Seeding API

- [x] Add task creation for missing/review/blocked Data Sources access validation evidence coverage gaps.
- [x] Persist coverage-gap tasks with non-secret metadata and duplicate skipping.
- [x] Add tests, parser checks, docs, milestone tracking, validation, and relaunch.

## Next Governance Data Sources Access Validation Evidence Coverage Task Seeding UI

- [x] Add Governance toolbar support for seeding Data Sources evidence coverage tasks.
- [x] Add command-palette support and app wrappers for evidence coverage task seeding.
- [x] Add parser checks, docs, milestone tracking, validation, and relaunch.

## Next Governance Data Sources Access Validation Evidence Capture Actions

- [x] Add per-coverage-card actions for recording validated, review, or blocked non-secret evidence.
- [x] Bind the actions to the existing evidence ledger API and refresh Governance after capture.
- [x] Add parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Access Validation Evidence Coverage Task Sync

- [x] Sync evidence-coverage task status when non-secret validation evidence is recorded.
- [x] Add isolated server coverage for validated evidence resolving a related coverage task.
- [x] Add parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Access Validation Evidence Task Sync Visibility

- [x] Surface evidence-sync status in the Data Sources access task ledger markdown.
- [x] Surface evidence-sync status and coverage identifiers in Governance task cards.
- [x] Add parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Access Validation Evidence Task Sync Response

- [x] Return task-sync metadata from the evidence ledger POST response.
- [x] Surface sync-count feedback in the Governance evidence capture action.
- [x] Add parser checks, docs, milestone tracking, validation, and relaunch.

## Next Data Sources Access Validation Evidence Coverage Deck

- [x] Render evidence coverage directly in the Sources view.
- [x] Add Sources toolbar and command-palette support for copying evidence coverage markdown.
- [x] Add parser checks, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Vercel Static Deployment Recovery

- [x] Diagnose Vercel `FUNCTION_INVOCATION_FAILED` caused by the project deploying as a Node serverless function.
- [x] Force the Vercel framework preset to `Other` with `framework: null` in `vercel.json`.
- [x] Rebuild, push, confirm latest production deployment, and verify production aliases return HTTP 200.

## Next Deployment Health Smoke Check API

- [x] Derive deployment-health targets from Data Sources without storing credentials or response bodies.
- [x] Add `GET /api/deployments/health` and `POST /api/deployments/smoke-check` with local/private URL guardrails.
- [x] Add API client/types, parser checks, tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Deployment Health Sources UI

- [x] Render deployment-health targets in the Sources view with provider, source health, access method, and secret-handling policy.
- [x] Add per-target smoke-check actions and a copyable deployment-health markdown handoff from toolbar and command palette.
- [x] Add parser checks, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Deployment Smoke Check Ledger

- [x] Persist deployment smoke-check results as a bounded non-secret ledger in the SQLite-backed store.
- [x] Add `GET /api/deployments/smoke-checks`, enrich deployment health, and feed Governance plus Agent Control Plane summaries and snapshot drift.
- [x] Add Sources toolbar and command-palette copy actions, parser checks, tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Release Control Ledger

- [x] Add a non-secret release summary that combines Git state, deployment smoke evidence, latest validation context, and saved checkpoints.
- [x] Add `GET /api/releases/summary`, `POST /api/releases/checkpoints`, Governance toolbar actions, and command-palette actions.
- [x] Feed release checkpoints into diagnostics, Governance, Agent Control Plane summaries, and Agent Control Plane snapshot drift.

## Next Governance Release Control Deck

- [x] Add live release summary loading to the Governance cache and filters.
- [x] Add Release Control KPI, deck section, scope filter, and inline checkpoint actions.
- [x] Add parser checks, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Release Checkpoint Drift

- [x] Add latest release checkpoint drift API and markdown handoff.
- [x] Add Governance release drift KPI/deck visibility and command-palette copy action.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Release Build Gate

- [x] Add local release build gate API and markdown handoff.
- [x] Add Governance release gate KPI/deck visibility and command-palette copy action.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Release Build Gate Action Plan

- [x] Add machine-readable release gate action plan output.
- [x] Surface release gate action plan in Governance and markdown handoff.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Release Build Gate Local Evidence Bootstrap

- [x] Add local release gate evidence bootstrap API for smoke check plus checkpoint capture.
- [x] Add Governance and command-palette action support for local release evidence bootstrap.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Release Gate Bootstrap Status Alignment

- [x] Let bootstrap checkpoints inherit computed release status instead of forcing review.
- [x] Remove the UI-forced review status from local evidence bootstrap.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Agent Control Plane Release Build Gate

- [x] Feed Release Build Gate readiness, risk, reasons, and actions into Governance and Agent Control Plane payloads.
- [x] Add release-gate context to Agent Control Plane decisions, decision snapshots, handoff markdown, snapshot records, and snapshot drift metrics.
- [x] Add dashboard visibility, parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Release Build Gate Task Seeding

- [x] Add API support for converting open Release Build Gate actions into deduplicated Governance tasks.
- [x] Add Governance deck and command-palette controls for seeding release-gate tasks.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Release Control Task Ledger

- [x] Add `GET /api/releases/task-ledger` with `all`, `open`, and `closed` status filters.
- [x] Surface Release Control tasks in Governance KPI cards, deck ledger, summaries, reports, and command-palette handoffs.
- [x] Feed Release Control task counts into Agent Control Plane decisions, handoffs, snapshots, and baseline drift metrics.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Agent Control Plane Decision Task Seeding

- [x] Add API support for converting Agent Control Plane decision reasons into deduplicated Governance tasks.
- [x] Add Governance deck and command-palette controls for seeding decision tasks.
- [x] Feed Control Plane decision task counts into Agent Control Plane decisions, handoffs, snapshots, and baseline drift metrics.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Agent Control Plane Decision Task Ledger

- [x] Add `GET /api/agent-control-plane/decision/task-ledger` with `all`, `open`, and `closed` status filters.
- [x] Add Governance and command-palette handoffs for copying Control Plane decision tasks.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Agent Control Plane Decision Task Ledger Snapshots

- [x] Add `GET` and `POST /api/agent-control-plane/decision/task-ledger-snapshots` with non-secret markdown handoffs.
- [x] Add `GET /api/agent-control-plane/decision/task-ledger-snapshots/diff` with latest/specific snapshot support.
- [x] Add Governance deck and command-palette controls for saving snapshots and copying latest drift.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Agent Control Plane Decision Task Ledger Snapshot Drift Wiring

- [x] Feed Control Plane decision task ledger snapshot counts into Agent Control Plane handoffs.
- [x] Persist decision task ledger snapshot counts/lists in Agent Control Plane snapshot records.
- [x] Add decision task ledger snapshot counts to Agent Control Plane baseline drift metric deltas.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Agent Control Plane Decision Task Auto Capture

- [x] Add optional `saveSnapshot` support to `POST /api/agent-control-plane/decision/tasks`.
- [x] Auto-capture a non-secret Control Plane decision task ledger snapshot after seeding.
- [x] Add Governance deck and command-palette controls for seed-and-snapshot.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Agent Control Plane Decision Task Lifecycle

- [x] Add Resolve, Reopen, and Block controls to Control Plane decision task cards.
- [x] Reuse the shared task update API for decision task status changes.
- [x] Verify Control Plane decision task open/closed ledger counts update after lifecycle changes.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Governance Task Update Audit Log

- [x] Add non-secret Governance operation logging to shared task updates.
- [x] Capture task id, title, project, previous status, next status, and changed field names without storing full payloads.
- [x] Verify Control Plane decision task lifecycle updates create task update audit entries.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Governance Task Update Audit Ledger

- [x] Add `GET /api/governance/task-update-ledger` with bounded non-secret task update operation output.
- [x] Add toolbar and command-palette copy actions for the task update audit ledger.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Governance Task Update Audit Ledger Snapshots

- [x] Restore the generated Governance toolbar button for copying the task update audit ledger.
- [x] Add `GET` and `POST /api/governance/task-update-ledger-snapshots` plus latest/specific snapshot drift.
- [x] Add Governance deck, toolbar, and command-palette actions for saving task audit snapshots and copying drift.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Governance Task Update Audit Snapshot Control Plane Wiring

- [x] Feed Governance task update audit ledger snapshot counts into consolidated Agent Control Plane handoffs.
- [x] Persist Governance task update audit ledger snapshot counts/lists in Agent Control Plane snapshot records.
- [x] Add Governance task update audit ledger snapshot count and list drift to Agent Control Plane baseline drift.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Data Sources Access Method Registry

- [x] Add a non-secret Data Sources access method registry covering local paths, Git remotes, GitHub/private repo signals, token/password/certificate/SSH/manual access flags, and setup guidance.
- [x] Expose the registry through `/api/sources/access-method-registry`, the dashboard API client, command palette, Sources toolbar, and Sources deck.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Data Sources Access Validation Workflow

- [x] Add a derived non-secret Data Sources access validation workflow from registry and evidence coverage.
- [x] Surface workflow stages, blocker types, and next actions through API, Sources deck, toolbar, and command palette.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Data Sources Access Validation Workflow Task Seeding

- [x] Add API support for converting pending or blocked validation workflow items into deduplicated non-secret Data Sources tasks.
- [x] Surface Sources toolbar and command-palette actions for seeding validation workflow tasks.
- [x] Feed workflow task references into the Data Sources access task ledger for tracking and evidence sync.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Data Sources Access Validation Workflow Task Auto Capture

- [x] Add optional snapshot auto-capture to validation workflow task seeding.
- [x] Reuse Data Sources access task-ledger snapshot records so workflow task creation has a review baseline.
- [x] Update Sources seeding to request snapshot capture by default.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Data Sources Access Validation Workflow Snapshots

- [x] Add saved non-secret Data Sources access validation workflow snapshots.
- [x] Add workflow snapshot drift comparison against the live validation workflow.
- [x] Surface Sources toolbar and command-palette actions for saving workflow snapshots and copying drift.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Agent Control Plane Data Sources Access Validation Workflow Snapshots

- [x] Feed Data Sources access validation workflow snapshot counts and drift into Governance summaries and reports.
- [x] Add workflow snapshot counts, lists, and latest drift to Agent Control Plane handoffs, decisions, decision snapshots, and saved snapshots.
- [x] Add workflow snapshot count and drift-score fields to Agent Control Plane baseline drift metrics.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Governance Data Sources Access Validation Workflow Snapshot Actions

- [x] Add Governance toolbar controls for copying the source validation workflow, saving workflow snapshots, and copying workflow drift.
- [x] Add command-palette actions for the same Governance workflow snapshot baseline operations.
- [x] Preserve Sources behavior while letting Governance snapshot saves refresh the Governance deck.
- [x] Add parser checks, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Governance Data Sources Access Validation Workflow Task Seeding

- [x] Add a Governance toolbar control for seeding Data Sources access validation workflow tasks.
- [x] Add command-palette parity for Governance workflow task seeding.
- [x] Preserve Sources behavior while letting Governance workflow seeding refresh the Governance deck and keep automatic task-ledger snapshot capture.
- [x] Add parser checks, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Governance Data Sources Access Validation Workflow Task Visibility

- [x] Add a Governance KPI for workflow-seeded Data Sources access validation tasks.
- [x] Add a dedicated Governance deck section for workflow-seeded source validation tasks with lifecycle controls.
- [x] Add workflow task counts and workflow identifiers to Governance source-access task ledger reports.
- [x] Add parser checks, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Convergence Review Persistence API

- [x] Add durable non-secret Convergence review records to the workspace store.
- [x] Add candidate and review API endpoints for overlap review decisions.
- [x] Suppress generated overlap findings when a pair is marked not related.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Convergence Review Workbench Controls

- [x] Add project workbench controls for confirming overlap, marking pairs not related, flagging needs-review, and identifying merge candidates.
- [x] Refresh Convergence candidate status after each operator review and refresh findings when a pair is marked not related.
- [x] Record the reusable operator checkpoint plan for other AI-generated classifications that may need human confirmation.
- [x] Add parser checks, docs, milestone tracking, validation, relaunch, commit, and push.
