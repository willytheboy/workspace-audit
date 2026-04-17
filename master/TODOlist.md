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

## Next Data Sources Access Method Registry Checkpoints

- [x] Add per-source operator checkpoint controls to the Sources access method registry.
- [x] Reuse the non-secret access validation evidence ledger for confirmed, review, and blocked access-method decisions.
- [x] Reuse the same evidence handler across Sources and Governance so both views refresh their own surface after a decision.
- [x] Add parser checks, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Governance Queue Item Checkpoints

- [x] Add a per-item `Not Actionable` checkpoint to Governance action queue cards.
- [x] Persist the decision through the existing Governance queue suppression ledger with restore support.
- [x] Add parser checks, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Release Build Gate Action Checkpoints

- [x] Add per-action `Track Task` controls to Release Build Gate action cards.
- [x] Add per-action `Accept Risk` controls that save non-secret release checkpoints for operator-reviewed generated blockers.
- [x] Keep the generated Release Build Gate evidence visible while adding explicit operator review state.
- [x] Add parser checks, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Agent Control Plane Snapshot Drift Checkpoints

- [x] Add per-snapshot `Track Drift` controls to create non-secret Governance review tasks from Agent Control Plane drift reports.
- [x] Add per-snapshot `Accept Drift` controls that refresh the live Agent Control Plane as the approved baseline.
- [x] Keep the generated drift report copy/export path visible while adding explicit operator review choices.
- [x] Add parser checks, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Task Seeding Checkpoints

- [x] Add a persisted non-secret task-seeding checkpoint ledger for generated task batches.
- [x] Add `Defer Batch` and `Dismiss Batch` controls to Release Build Gate and Agent Control Plane decision task seeding controls.
- [x] Surface saved task-seeding checkpoints in the Governance deck and operation log.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Task Seeding Checkpoint Action Expansion

- [x] Add Sources toolbar defer/dismiss checkpoint actions for validation workflow task batches.
- [x] Add Governance toolbar defer/dismiss checkpoint actions for source validation workflow, source-access review, and evidence-coverage task batches.
- [x] Add command-palette defer/dismiss entries for the same source-access generated task batches.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Data Sources Item Checkpoint Controls

- [x] Add Sources per-item confirm/defer/dismiss checkpoints for Data Sources access review queue items.
- [x] Add Sources per-item confirm/defer/dismiss checkpoints for Data Sources evidence coverage items.
- [x] Add Governance deck per-item confirm/defer/dismiss checkpoints for the same inferred source-access blockers.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Task Seeding Checkpoint Lifecycle Filtering

- [x] Add a Governance lifecycle status filter for task-seeding checkpoints.
- [x] Group the Task Seeding Checkpoints Governance ledger by approved, deferred, dismissed, and needs-review status.
- [x] Persist the lifecycle filter in saved Governance execution views.
- [x] Add parser checks, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Source Access Checkpoint Summary Counts

- [x] Add a reusable source-access checkpoint classifier and summary counts for approved, deferred, dismissed, needs-review, unresolved, and grouped source totals.
- [x] Surface unresolved source-access checkpoint counts in Data Sources summaries, access review queue, evidence coverage, Governance KPIs, and Agent Control Plane handoffs.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Source Card Checkpoint Drilldowns

- [x] Add source-specific checkpoint matching for Data Source records using non-secret checkpoint metadata.
- [x] Surface per-source checkpoint totals and unresolved counts inside individual Source cards.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Source Checkpoint Deck Filters

- [x] Add source-specific checkpoint drilldowns to Data Sources access review and evidence coverage queue items.
- [x] Add unresolved-checkpoint filters to the Data Sources access review and evidence coverage decks.
- [x] Record the Claude-style agents/skills strategy and update persistent app direction memory.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Managed Agent Skill Policy Checkpoints

- [x] Add a persisted non-secret managed-agent policy checkpoint ledger for generated role, runtime, skill, hook, and isolation recommendations.
- [x] Require approved policy checkpoints before generated agent work orders can be queued from readiness items or snapshots.
- [x] Suppress reviewed `Not Related` convergence candidates from the active project workbench list while keeping the persisted review ledger auditable.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Convergence Not Related Active Suppression Fix

- [x] Exclude `not-related` pairs from the default active `/api/convergence/candidates` overlap list.
- [x] Preserve audit retrieval for suppressed pairs through `status=not-related`, `status=all`, or explicit `includeNotRelated=true`.
- [x] Add an end-to-end regression test that marks an overlap `Not Related` and confirms it disappears from the active list.
- [x] Add parser checks, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Agent Execution Result Checkpoints

- [x] Add a persisted non-secret execution-result checkpoint ledger for retry, archive, retention, SLA resolution, and baseline-refresh decisions.
- [x] Require approved result checkpoints before terminal retries, archives, retention archival, SLA breach resolution, and baseline refresh finalization.
- [x] Surface result checkpoint controls and summary gates in Governance Agent Execution Queue and Control Plane decision state.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Agent Execution Result Follow-up Tasks

- [x] Create a deduplicated non-secret Governance task when an execution-result gate checkpoint is deferred.
- [x] Surface execution-result follow-up task counts, task cards, and lifecycle controls in Governance.
- [x] Feed execution-result follow-up tasks into Agent Control Plane decision and handoff markdown.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Convergence Not Related Workbench Removal Guard

- [x] Remove a Convergence pair from the active project workbench immediately after a successful `Not Related` save.
- [x] Defensively filter the reloaded Convergence payload by the reviewed pair before rendering so stale payloads cannot re-add the card.
- [x] Add a parser guard for the optimistic removal path.
- [x] Add parser checks, server tests, build validation, docs, milestone tracking, relaunch, commit, and push.

## Next Agent Execution Result Task Ledger Snapshots

- [x] Add a persisted non-secret execution-result follow-up task ledger snapshot store.
- [x] Add execution-result task ledger, snapshot, and drift API endpoints.
- [x] Surface Governance controls to copy the task ledger, save a snapshot, copy drift, and copy saved snapshots.
- [x] Feed execution-result task ledger snapshot counts into Agent Control Plane summaries and snapshots.
- [x] Add parser checks, server tests, docs, milestone tracking, validation, relaunch, commit, and push.

## Next Agent Execution Result Task Ledger Drift Checkpoints

- [x] Add per-snapshot `Copy Drift`, `Track Drift`, and `Accept Drift` controls to execution-result task ledger snapshot cards.
- [x] Convert execution-result task ledger drift reports into non-secret Governance review tasks with severity, score, summary deltas, and bounded drift fields.
- [x] Accept intentional execution-result task ledger drift by saving a refreshed ledger snapshot as the current operator-approved baseline.
- [x] Add command-palette parity for copy, save, and latest drift execution-result task ledger actions.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Release Control Task Ledger Snapshots And Drift Checkpoints

- [x] Add a persisted non-secret Release Control task ledger snapshot store and diff API.
- [x] Surface Governance controls to save Release Control task snapshots, copy snapshots, copy drift, track drift, and accept drift.
- [x] Feed Release Control task ledger snapshot counts into Governance and Agent Control Plane evidence.
- [x] Add command-palette parity for save and latest drift Release Control task ledger actions.
- [x] Add parser checks, server tests, docs, validation, relaunch, commit, and push.

## Next Release Build Gate Task Auto Capture

- [x] Add optional snapshot capture to `POST /api/releases/build-gate/actions/tasks`.
- [x] Auto-capture a non-secret Release Control task ledger snapshot after Release Build Gate task seeding.
- [x] Add Governance and command-palette controls for seed-and-snapshot release-gate task workflows.
- [x] Add parser checks, server tests, docs, validation, relaunch, commit, and push.

## Next Release Build Gate Per-Action Task Snapshot

- [x] Add per-action `Track + Snapshot` controls to Release Build Gate action cards.
- [x] Reuse the Release Control task ledger auto-capture API for individual generated gate actions.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Agent Control Plane Decision Per-Reason Task Snapshot

- [x] Add per-reason `Track + Snapshot` controls to Agent Control Plane decision reason cards.
- [x] Reuse the Control Plane decision task ledger auto-capture API for individual decision reasons.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Data Sources Access Review Per-Item Task Snapshot

- [x] Add optional snapshot capture to `POST /api/sources/access-review-queue/tasks`.
- [x] Add per-item `Track + Snapshot` controls to Sources and Governance Data Sources access review cards.
- [x] Auto-capture a non-secret Data Sources access task ledger snapshot after source-access review task seeding.
- [x] Add parser checks, server tests, docs, validation, relaunch, commit, and push.

## Next Data Sources Evidence Coverage Per-Item Task Snapshot

- [x] Add optional snapshot capture to `POST /api/sources/access-validation-evidence-coverage/tasks`.
- [x] Add per-item `Track + Snapshot` controls to Sources and Governance Data Sources evidence coverage cards.
- [x] Auto-capture a non-secret Data Sources access task ledger snapshot after evidence coverage task seeding.
- [x] Add parser checks, server tests, docs, validation, relaunch, commit, and push.

## Next Data Sources Validation Workflow Per-Item Task Snapshot

- [x] Add per-item `Track + Snapshot` controls to Sources Data Sources validation workflow cards.
- [x] Add a Governance Data Sources validation workflow item section with per-item `Track + Snapshot` controls.
- [x] Reuse the existing validation workflow task auto-capture API for individual workflow blockers.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Data Sources Access Task Ledger Drift Checkpoints

- [x] Add per-snapshot `Copy Drift`, `Track Drift`, and `Accept Drift` controls to Data Sources access task ledger snapshot cards.
- [x] Convert source-access task ledger drift reports into non-secret Governance review tasks with severity, score, summary deltas, and bounded drift fields.
- [x] Accept intentional source-access task ledger drift by saving a refreshed ledger snapshot as the current operator-approved baseline.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Data Sources Validation Evidence Drift Checkpoints

- [x] Add per-snapshot `Copy Drift`, `Track Drift`, and `Accept Drift` controls to Data Sources validation evidence snapshot cards.
- [x] Convert source-access validation evidence drift reports into non-secret Governance review tasks with severity, score, summary deltas, and bounded drift fields.
- [x] Accept intentional source-access validation evidence drift by saving a refreshed evidence snapshot as the current operator-approved baseline.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Data Sources Validation Workflow Drift Checkpoints

- [x] Add per-snapshot `Copy Drift`, `Track Drift`, and `Accept Drift` controls to Data Sources validation workflow snapshot cards.
- [x] Convert source-access validation workflow drift reports into non-secret Governance review tasks with severity, score, summary deltas, and bounded drift fields.
- [x] Accept intentional source-access validation workflow drift by saving a refreshed workflow snapshot as the current operator-approved baseline.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Data Sources Summary Drift Checkpoints

- [x] Add per-snapshot `Copy Drift`, `Track Drift`, and `Accept Drift` controls to Data Sources summary snapshot cards.
- [x] Convert source-health summary drift reports into non-secret Data Sources review tasks with severity, score, summary deltas, and bounded drift fields.
- [x] Accept intentional source-health summary drift by saving a refreshed Data Sources summary snapshot as the current operator-approved baseline.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Data Sources Access Matrix Checkpoints

- [x] Add method-row `Confirm` and `Defer` controls to the Data Sources access matrix deck using the non-secret task-seeding checkpoint ledger.
- [x] Add method-row `Track Tasks` controls that convert matching access-review queue items into source-access review tasks with a task-ledger auto-capture snapshot.
- [x] Preserve the non-secret access-method metadata policy for checkpoint notes and task conversion.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Data Sources Access Method Registry Checkpoints

- [x] Add method-row `Confirm` and `Defer` controls to the Data Sources access method registry deck using the non-secret task-seeding checkpoint ledger.
- [x] Add method-row `Record Evidence` controls that create non-secret access validation evidence records for sources in the selected method.
- [x] Preserve the non-secret access-method metadata policy for checkpoint notes and evidence prompts.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Data Sources Access Validation Runbook Checkpoints

- [x] Add method-card `Confirm` and `Defer` controls to the Governance Data Sources access validation runbook deck using the non-secret task-seeding checkpoint ledger.
- [x] Add method-card `Track Evidence Tasks` controls that convert matching evidence-coverage gaps into source-access evidence follow-up tasks with a task-ledger auto-capture snapshot.
- [x] Preserve the non-secret validation runbook policy for checkpoint notes and task conversion.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Data Sources Access Checklist Checkpoints

- [x] Add a visible Sources Data Sources access checklist deck.
- [x] Add item-level `Confirm` and `Defer` controls using the non-secret task-seeding checkpoint ledger.
- [x] Add item-level `Track Workflow Task` controls that convert matching validation workflow blockers into source-access workflow tasks with a task-ledger auto-capture snapshot.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Data Sources Deployment Health Checkpoints

- [x] Add target-level `Confirm` and `Defer` controls to Sources deployment health cards using the non-secret task-seeding checkpoint ledger.
- [x] Add target-level `Track Release Task` controls that convert deployment health status into Release Control tasks with a release task-ledger auto-capture snapshot.
- [x] Preserve the non-secret deployment metadata policy for checkpoint notes and task conversion.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Data Sources Deployment Smoke-Check Ledger Checkpoints

- [x] Add recent-smoke-check `Confirm` and `Defer` controls using the non-secret task-seeding checkpoint ledger.
- [x] Add recent-smoke-check `Track Release Task` controls that convert individual smoke outcomes into Release Control tasks with a release task-ledger auto-capture snapshot.
- [x] Preserve the non-secret smoke-check metadata policy for checkpoint notes and task conversion.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Release Build Gate Local Evidence Checkpoints

- [x] Add Governance Release Control `Confirm Local Evidence` and `Defer Local Evidence` controls using the release checkpoint ledger.
- [x] Add `Track Evidence Task` controls that convert local smoke/bootstrap evidence into a Release Control task with a task-ledger auto-capture snapshot.
- [x] Preserve the non-secret local evidence policy for checkpoint notes and task conversion.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Release Control Saved Checkpoint Ledger Checkpoints

- [x] Add saved-checkpoint `Confirm` and `Defer` controls using the release checkpoint ledger.
- [x] Add saved-checkpoint `Track Task` controls that convert individual checkpoint rows into Release Control tasks with a task-ledger auto-capture snapshot.
- [x] Preserve the non-secret checkpoint metadata policy for checkpoint notes and task conversion.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Release Checkpoint Drift Field Checkpoints

- [x] Add per-field `Confirm` and `Defer` controls to Release Control checkpoint drift fields using the release checkpoint ledger.
- [x] Add per-field `Track Task` controls that convert individual drift fields into Release Control tasks with a task-ledger auto-capture snapshot.
- [x] Preserve the non-secret drift metadata policy for checkpoint notes and task conversion.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Release Control Task Ledger Item Checkpoints

- [x] Add task-row `Confirm`, `Defer`, and `Escalate` controls to Release Control task ledger cards.
- [x] Persist task-row checkpoint decisions through non-secret task metadata and lifecycle updates.
- [x] Preserve the non-secret release-control task metadata policy for checkpoint notes.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Release Control Task Ledger Drift Item Checkpoints

- [x] Add latest task-ledger drift field rows to Governance Release Control task-ledger snapshot cards.
- [x] Add per-drift-item `Confirm`, `Defer`, and `Escalate` controls that persist non-secret Release Control task metadata.
- [x] Preserve the non-secret release-control task ledger drift metadata policy for checkpoint notes.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Agent Control Plane Decision Task Ledger Item Checkpoints

- [x] Add task-row `Confirm`, `Defer`, and `Escalate` controls to Agent Control Plane decision task ledger cards.
- [x] Persist task-row checkpoint decisions through non-secret decision-task metadata and lifecycle updates.
- [x] Preserve the non-secret agent control-plane decision task metadata policy for checkpoint notes.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Agent Control Plane Decision Task Ledger Drift Item Checkpoints

- [x] Add latest decision-task ledger drift field rows to Governance Control Plane decision task-ledger snapshot cards.
- [x] Add per-drift-item `Confirm`, `Defer`, and `Escalate` controls that persist non-secret Agent Control Plane task metadata.
- [x] Preserve the non-secret agent control-plane decision task ledger drift metadata policy for checkpoint notes.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Agent Execution Result Follow-up Task Ledger Item Checkpoints

- [x] Add task-row `Confirm`, `Defer`, and `Escalate` controls to Agent Execution Result follow-up task cards.
- [x] Persist task-row checkpoint decisions through non-secret execution-result task metadata and lifecycle updates.
- [x] Preserve the non-secret agent execution-result follow-up task metadata policy for checkpoint notes.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Agent Execution Result Task Ledger Drift Item Checkpoints

- [x] Add latest execution-result task ledger drift field rows to Governance execution-result task-ledger snapshot cards.
- [x] Add per-drift-item `Confirm`, `Defer`, and `Escalate` controls that persist non-secret Agent Execution Result task metadata.
- [x] Preserve the non-secret agent execution-result task ledger drift metadata policy for checkpoint notes.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Data Sources Access Task Ledger Item Checkpoints

- [x] Add task-row `Confirm`, `Defer`, and `Escalate` controls to Data Sources access task ledger cards.
- [x] Persist task-row checkpoint decisions through non-secret source-access task metadata and lifecycle updates.
- [x] Preserve the non-secret source-access task metadata policy for checkpoint notes.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Data Sources Access Task Ledger Drift Item Checkpoints

- [x] Add latest source-access task ledger drift field rows to Governance Data Sources access task-ledger snapshot cards.
- [x] Add per-drift-item `Confirm`, `Defer`, and `Escalate` controls that persist non-secret Data Sources task metadata.
- [x] Preserve the non-secret source-access task ledger drift metadata policy for checkpoint notes.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Data Sources Validation Workflow Task Item Checkpoints

- [x] Add task-row `Confirm`, `Defer`, and `Escalate` controls to Data Sources validation workflow task cards.
- [x] Persist task-row checkpoint decisions through non-secret workflow-task metadata and lifecycle updates.
- [x] Preserve the non-secret source-access validation workflow task metadata policy for checkpoint notes.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Data Sources Validation Workflow Task Ledger Drift Item Checkpoints

- [x] Add workflow-task-specific summary and row drift fields to the shared Data Sources access task ledger snapshot diff.
- [x] Add per-drift-item `Confirm`, `Defer`, and `Escalate` controls for workflow task ledger drift rows.
- [x] Persist workflow task drift checkpoint decisions as non-secret Data Sources task metadata.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Governance Task Update Audit Ledger Item Checkpoints

- [x] Load the live Governance task update audit ledger into the Governance deck.
- [x] Add task-update audit row `Confirm`, `Defer`, and `Escalate` controls.
- [x] Persist audit-row checkpoint decisions as non-secret Governance tasks.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Governance Task Update Audit Ledger Drift Item Checkpoints

- [x] Load the latest Governance task update audit ledger snapshot drift into the Governance deck.
- [x] Add per-drift-item `Confirm`, `Defer`, and `Escalate` controls for task update audit drift rows.
- [x] Persist audit drift checkpoint decisions as non-secret Governance tasks.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Agent Execution SLA Breach Ledger Item Checkpoints

- [x] Add SLA breach ledger row `Confirm`, `Defer`, and `Escalate` controls.
- [x] Persist SLA breach ledger checkpoint decisions as non-secret tasks.
- [x] Preserve the non-secret agent execution SLA breach ledger metadata policy for checkpoint notes.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Next Convergence Operator-Contributed Overlaps

- [x] Add a user-supplied overlap proposal flow for projects the operator knows overlap.
- [x] Run due-diligence scoring against the proposed overlap using existing convergence evidence.
- [x] Persist AI-generated insight, assimilation recommendation, and operator context without storing secrets.
- [x] Add parser checks, docs, validation, relaunch, commit, and push.

## Future Vibe Coder Operating Guide

- [x] Persist the vibe-coder guided operating cycle as a project objective.
- [x] Add a durable step-by-step guide for debugging, building, validation, agent supervision, commit, and release cycles.
- [x] Promote the guide into the app UI after the current checkpoint consolidation milestones are complete.
- [ ] Add Codex CLI and Claude CLI work-order runner guidance once the first supervised CLI prototype is ready.

## Next Vibe Coder Operating Guide UI

- [x] Add a Governance deck card for the safe app-building operating cycle.
- [x] Add a copyable Markdown version of the operating guide.
- [x] Preserve the no-secrets policy for agent and command-output handling.
- [x] Add parser checks, validation, relaunch, commit, and push.

## Next CLI Runner Readiness Gate

- [x] Add a Governance readiness card for future Codex CLI / Claude CLI work-order runner dry runs.
- [x] Block runner readiness when Data Sources, Agent Control Plane, Release Build Gate, stale execution, or SLA breach evidence is not clean.
- [x] Keep the gate advisory-only and non-executing until the supervised CLI prototype is explicitly ready.
- [x] Add parser checks, validation, relaunch, commit, and push.

## Next CLI Bridge Work-Order Architecture

- [x] Add a Governance deck card that explains how Codex CLI and Claude CLI should connect through Workspace Audit Pro.
- [x] Define the app as the work-order broker and control plane instead of allowing uncontrolled agent-to-agent free chat.
- [x] Document SDK-first, MCP-context, subprocess-fallback, no-secrets, and validation-loop integration rules.
- [x] Add parser checks, validation, relaunch, commit, and push.

## Next CLI Bridge Context API

- [x] Add a non-executing `/api/cli-bridge/context` endpoint for future Codex CLI and Claude CLI adapters.
- [x] Return sanitized work orders, bridge decision, runner adapter guidance, handoff contract, validation loop, and no-secrets policy.
- [x] Add dashboard API/types and server/parser test coverage.
- [x] Add validation, relaunch, commit, and push.

## Next CLI Bridge Context Copy Controls

- [x] Add Governance card actions to copy Codex-only, Claude-only, and full CLI bridge context packs.
- [x] Bind controls to the non-executing `/api/cli-bridge/context` endpoint.
- [x] Preserve sanitized Markdown-only handoffs and no-secrets policy.
- [x] Add parser checks, validation, relaunch, commit, and push.

## Next CLI Bridge Handoff Ledger API

- [x] Add a persistent non-secret CLI bridge handoff ledger for Codex, Claude, operator, and Workspace Audit handoffs.
- [x] Add `GET` and `POST /api/cli-bridge/handoffs` with runner filtering and Markdown ledger output.
- [x] Add dashboard API/types, parser checks, and server test coverage.
- [x] Add validation, relaunch, commit, and push.

## Next CLI Bridge Handoff Ledger Deck

- [x] Surface the app-owned CLI bridge handoff mailbox in the Governance deck.
- [x] Add copyable non-secret handoff ledger Markdown for operator review.
- [x] Show recent Codex, Claude, operator, and Workspace Audit handoff records with status, project, run, and next action metadata.
- [x] Add parser checks, validation, relaunch, commit, and push.

## Next CLI Bridge Runner Dry-Run Contract

- [x] Add a non-executing runner dry-run endpoint for Codex CLI and Claude CLI command envelopes.
- [x] Generate sanitized work-order prompts, expected output schemas, runner display commands, and validation loops.
- [x] Add Governance copy controls for Codex and Claude dry-run contracts.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next CLI Bridge Runner Result Intake

- [x] Add a non-secret runner-result intake endpoint for manual Codex CLI and Claude CLI dry-run outputs.
- [x] Convert runner summaries into app-owned CLI bridge handoff ledger records.
- [x] Preserve operator review before accepting results or creating follow-up work orders.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next CLI Bridge Handoff Review Workflow

- [x] Add operator review actions for CLI bridge handoffs.
- [x] Support accepted, rejected, and escalated review states.
- [x] Create a normal open task when a CLI handoff is escalated for follow-up.
- [x] Add UI controls, parser checks, server coverage, validation, relaunch, commit, and push.

## Next CLI Bridge Manual Result Capture

- [x] Add Governance controls to manually record Codex CLI and Claude CLI dry-run summaries.
- [x] Route captured summaries through the non-secret runner-result intake endpoint.
- [x] Preserve operator review before accepting or escalating captured results.
- [x] Add parser checks, validation, relaunch, commit, and push.

## Next CLI Bridge Review Queue UX

- [x] Add CLI bridge handoff status filtering to the ledger API.
- [x] Add review queue, accepted, rejected, needs-review, and escalated counters to Governance.
- [x] Prioritize needs-review and proposed handoffs above accepted and rejected history.
- [x] Add filtered ledger copy controls, parser checks, server coverage, validation, relaunch, commit, and push.

## Next CLI Bridge Follow-up Work-Order Drafts

- [x] Add a non-executing follow-up work-order draft API for reviewed CLI bridge handoffs.
- [x] Add Governance handoff controls to copy sanitized next-runner work-order drafts.
- [x] Preserve the app-owned broker boundary, no-free-chat rule, and no-secrets policy for Codex CLI and Claude CLI drafts.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next CLI Bridge Follow-up Work-Order Run Queue

- [x] Add a non-executing queue endpoint that converts a reviewed CLI bridge handoff draft into a normal Agent Work Order Run.
- [x] Add Governance handoff controls to queue follow-up runs for Codex CLI or Claude CLI supervision without launching either CLI.
- [x] Preserve duplicate protection, app-owned broker metadata, and no-secrets policy on queued runs.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next CLI Bridge Follow-up Run Ledger Link

- [x] Link queued follow-up Agent Work Order Runs back onto their source CLI bridge handoff.
- [x] Surface follow-up run status and runner metadata in the Governance handoff ledger.
- [x] Disable duplicate queue controls when an active follow-up run already exists for the handoff.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next CLI Bridge Execution Queue Contract Copy

- [x] Surface CLI bridge provenance tags on Agent Execution Queue run cards.
- [x] Add per-run `Copy CLI Contract` controls for CLI-origin queued runs.
- [x] Bind the controls to the existing non-executing CLI runner dry-run contract endpoint with the exact run id.
- [x] Add parser checks, validation, relaunch, commit, and push.

## Next CLI Bridge Execution Queue Result Capture

- [x] Add per-run `Record CLI Result` controls for CLI-origin Agent Execution Queue cards.
- [x] Bind captured summaries to the exact Agent Work Order Run through the existing non-secret runner-result intake endpoint.
- [x] Preserve operator review before accepting results or queueing another follow-up handoff.
- [x] Add parser checks, validation, relaunch, commit, and push.

## Next CLI Bridge Runner Result Run Link

- [x] Link captured CLI runner result handoffs back onto their source Agent Work Order Run.
- [x] Surface latest CLI result status, runner, and result handoff id in the Agent Execution Queue.
- [x] Add run-history and operation-log traceability for result intake.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next CLI Bridge Handoff Review Run Link

- [x] Link accepted, rejected, escalated, and needs-review handoff decisions back onto their source Agent Work Order Run.
- [x] Surface latest CLI review action and status in the Agent Execution Queue.
- [x] Add run-history and operation-log traceability for handoff review decisions.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next CLI Bridge Run Trace Pack

- [x] Add a non-executing CLI bridge run trace API for a selected Agent Work Order Run.
- [x] Include linked run metadata, related handoffs, result intake, review decisions, and run history in copyable Markdown.
- [x] Add Agent Execution Queue `Copy CLI Trace` controls for CLI-linked runs.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next CLI Bridge Run Trace Snapshots

- [x] Add persisted non-secret CLI bridge run trace snapshots for selected Agent Work Order Runs.
- [x] Add Agent Execution Queue `Save CLI Trace` controls and a Governance snapshot list with copy actions.
- [x] Surface snapshot counts in Governance summary, diagnostics, search/report output, and recent activity.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next CLI Bridge Run Trace Snapshot Drift

- [x] Add a latest-snapshot drift API comparing saved CLI bridge run traces with live trace state.
- [x] Surface trace drift in Governance execution scope with copyable Markdown.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next CLI Bridge Run Trace Snapshot Drift Checkpoints

- [x] Add Governance controls to copy drift for specific saved CLI bridge run trace snapshots.
- [x] Add operator controls to track drift as tasks, accept live trace as the refreshed snapshot baseline, and checkpoint individual drift fields.
- [x] Add parser checks, validation, relaunch, commit, and push.

## Next CLI Bridge Run Trace Baseline Status

- [x] Add a non-secret baseline-status API for the latest saved CLI bridge run trace snapshot.
- [x] Surface freshness, health, drift severity, and recommended action in Governance execution scope.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Auto-Detect Restore

- [x] Restore auto-detected convergence candidates from both generated cross-checks and per-project similar app signals.
- [x] Keep operator-contributed overlaps in the same workbench with AI due diligence and review actions.
- [x] Preserve Not Related decisions as hidden tombstones so rejected auto-detected pairs do not reappear.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Review Visibility Filters

- [x] Add project workbench filters for Active, Needs Review, Not Related, and All convergence candidates.
- [x] Keep hidden Not Related pairs auditable and restorable from the same convergence card actions.
- [x] Refresh convergence-dependent findings after every review state change.
- [x] Add parser checks, validation, relaunch, commit, and push.

## Next Convergence Governance Review Ledger

- [x] Add a global Governance section for convergence candidates, operator proposals, and hidden Not Related decisions.
- [x] Add copy controls for active, Not Related, and full convergence review ledgers.
- [x] Add a Governance scope filter entry for Convergence Review.
- [x] Add parser checks, validation, relaunch, commit, and push.

## Next Convergence Review Task Seeding

- [x] Add a non-secret `/api/convergence/tasks` endpoint for creating tracked tasks from convergence review pairs.
- [x] Add duplicate protection so repeated task seeding skips existing open convergence tasks.
- [x] Add Governance controls to track individual convergence candidates as tasks and show the resulting task ledger cards.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Review Task Lifecycle Controls

- [x] Add Governance controls to confirm, defer, or escalate Convergence Review Tasks.
- [x] Persist non-secret convergence task checkpoint metadata through the existing task update flow.
- [x] Keep Confirm resolved, Defer deferred, and Escalate blocked/high-priority behavior aligned with other task ledgers.
- [x] Add parser checks, validation, relaunch, commit, and push.

## Next Convergence Review Task Ledger Export

- [x] Add a non-secret `/api/convergence/task-ledger` endpoint with all/open/closed filtering.
- [x] Add Governance controls to copy Convergence Review Task ledgers for operator or future CLI-runner handoff.
- [x] Include pair count, priority split, operator-proposed count, checkpoint metadata, and no-secrets policy in the ledger payload.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Review Task Ledger Snapshots

- [x] Add persisted Convergence Review Task Ledger snapshots and latest/specific snapshot drift APIs.
- [x] Surface save snapshot, copy latest drift, copy snapshot, and copy per-snapshot drift controls in Governance.
- [x] Add snapshot count and drift state to the Governance convergence scope.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Review Task Ledger Drift Item Checkpoints

- [x] Surface individual Convergence Review task-ledger drift fields in Governance.
- [x] Add Confirm, Defer, and Escalate controls for each visible drift item.
- [x] Convert drift item decisions into non-secret convergence-control tasks through the existing task API.
- [x] Add parser checks, validation, relaunch, commit, and push.

## Next Convergence Review Task Ledger Drift Checkpoint Upserts

- [x] Add a duplicate-safe Convergence Review task-ledger drift checkpoint API.
- [x] Persist non-secret snapshot, field, decision, severity, score, and delta metadata on checkpoint tasks.
- [x] Route Governance drift item Confirm, Defer, and Escalate controls through server-side upsert behavior.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Review Task Ledger Drift Checkpoint Visibility

- [x] Show existing checkpoint decisions on each visible Convergence Review task-ledger drift field.
- [x] Display checkpoint status, task status, priority, and last update timestamp from persisted task metadata.
- [x] Switch drift field actions to update labels when a checkpoint task already exists.
- [x] Add parser checks, validation, relaunch, commit, and push.

## Next Convergence Drift Checkpoint Summary & Filters

- [x] Add confirmed, deferred, escalated, and uncheckpointed drift checkpoint counts to the Convergence Review task-ledger drift card.
- [x] Add field-level filters for all, uncheckpointed, confirmed, deferred, and escalated drift items.
- [x] Keep filters view-local so they do not mutate persisted Governance state.
- [x] Add parser checks, validation, relaunch, commit, and push.

## Next Convergence Drift Checkpoint Ledger Export

- [x] Add a non-secret Convergence Review task-ledger drift checkpoint ledger export API.
- [x] Include decision counts, status split, snapshot count, field count, and checkpoint metadata in Markdown.
- [x] Add Governance copy control for the checkpoint ledger.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Drift Checkpoint Snapshot Refresh

- [x] Add an explicit Governance action to accept the current live Convergence Review task ledger as the refreshed baseline.
- [x] Reuse the existing snapshot API with a clear accepted-baseline title, all-status filter, and standard limit.
- [x] Keep the action adjacent to drift and checkpoint ledger controls for post-review workflow continuity.
- [x] Add parser checks, validation, relaunch, commit, and push.

## Next Convergence Candidate Due Diligence Pack

- [x] Add a non-secret due diligence pack API for individual convergence candidates.
- [x] Include candidate evidence, AI insight, operator note, project snapshot, related tasks, related drift checkpoints, and recommended next action.
- [x] Add a Governance `Copy Pack` action on each convergence candidate card.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Operator Proposal Review Queue

- [x] Add a non-secret Operator Convergence Proposal Review Queue API with active/all/status filters.
- [x] Surface operator-contributed overlap proposals in Governance with due diligence, task state, and direct triage controls.
- [x] Keep Not Related actions out of the active queue while preserving suppressed proposal audit export.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Blueprint Packs

- [x] Add a non-secret Convergence Assimilation Blueprint API for individual overlap pairs.
- [x] Include review status, reuse signals, build phases, validation targets, risks, and no-secrets policy.
- [x] Add Governance `Copy Blueprint` actions beside due diligence packs for ledger and operator queue cards.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Work-Order Drafts

- [x] Add a non-executing Convergence Assimilation Work-Order Draft API for Codex and Claude runners.
- [x] Build runner-specific prompts from blueprint phases, validation targets, risks, and no-secrets policy.
- [x] Add Governance `Copy Codex Draft` and `Copy Claude Draft` actions beside convergence blueprint controls.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Work-Order Run Queue

- [x] Add a duplicate-safe API to queue convergence assimilation drafts into Agent Work Order runs.
- [x] Preserve runner, pair id, draft decision, recommended path, validation commands, and no-secrets policy on queued runs.
- [x] Add Governance `Queue Codex Run` and `Queue Claude Run` controls beside draft copy actions.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Run Ledger

- [x] Add a non-secret `/api/convergence/assimilation-run-ledger` endpoint with all/open/closed/active/archived filtering.
- [x] Surface queued Codex and Claude convergence assimilation runs in the Governance convergence scope.
- [x] Add copy controls for all, open, and closed convergence assimilation run ledgers.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Run Trace Pack

- [x] Add a non-secret run trace pack API for convergence assimilation Agent Work Order runs.
- [x] Include run, pair, blueprint, draft, validation command, related task, and trace decision metadata.
- [x] Add Governance `Copy Trace Pack` controls to queued convergence assimilation runs.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Result Intake

- [x] Add a non-secret convergence assimilation run result intake API.
- [x] Persist result status, summary, changed files, validation summary, blockers, and next action on linked runs.
- [x] Add Governance `Record Result` controls on convergence assimilation run cards.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Result Ledger

- [x] Add a non-secret convergence assimilation result ledger API with status filters.
- [x] Include result counts, runner split, pair count, summaries, validation notes, changed files, and blockers in Markdown.
- [x] Surface result ledger cards and copy controls in the Governance convergence scope.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Result Checkpoints

- [x] Add server-side Confirm, Defer, and Escalate checkpoints for convergence assimilation results.
- [x] Upsert checkpoint tasks with result id, run id, pair id, runner result status, checkpoint decision, and no-secrets policy.
- [x] Add Governance result-card checkpoint controls for operator review.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Result Checkpoint Ledger

- [x] Add a non-secret checkpoint ledger API for captured convergence assimilation result decisions.
- [x] Include open, closed, confirmed, deferred, and escalated counts in Markdown.
- [x] Surface checkpoint ledger cards and copy controls in Governance.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Readiness Gate

- [x] Add a non-secret ready/review/hold gate for convergence assimilation continuation.
- [x] Evaluate queued runs, captured results, failed or blocked outcomes, pending checkpoints, and escalations.
- [x] Surface the gate and copy control in Governance.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation CLI Handoff Contract

- [x] Add a non-secret Codex/Claude CLI handoff contract API.
- [x] Include readiness gate state, execution mode, no-secrets policy, and expected result schema.
- [x] Add Governance copy controls for Codex and Claude contracts.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Operator Playbook

- [x] Add a non-secret operator playbook API for the convergence assimilation cycle.
- [x] Encode the vibe-coder workflow from readiness gate to contract, trace pack, execution, validation, result intake, and checkpoints.
- [x] Add a Governance copy control beside the readiness gate and CLI contracts.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Session Packet

- [x] Add a non-secret session packet API for Codex and Claude convergence build sessions.
- [x] Bundle readiness gate, operator playbook, CLI contract, run ledger, result ledger, and checkpoint ledger.
- [x] Add Governance copy controls for Codex and Claude session packets.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Session Packet Snapshots

- [x] Add non-secret saved session packet snapshots for Codex and Claude.
- [x] Persist runner, readiness decision, counts, recommended action, Markdown, and full packet payload.
- [x] Add Governance save and copy controls for persisted session packet snapshots.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Session Packet Snapshot Drift

- [x] Add a non-secret drift API comparing saved session packets with live packet state.
- [x] Compare readiness decision, run/result/checkpoint counts, recommended action, and packet Markdown changes.
- [x] Add Governance copy controls and drift cards for latest/per-snapshot packet drift.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Session Packet Drift Checkpoints

- [x] Add Confirm, Defer, and Escalate checkpoints for session packet snapshot drift items.
- [x] Persist checkpoint tasks with snapshot id, runner, drift field, before/current values, decision, and no-secrets policy.
- [x] Show checkpoint state on packet drift cards and rehydrate decisions into drift payloads.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Session Packet Drift Checkpoint Ledger

- [x] Add a non-secret checkpoint ledger API for session packet drift decisions.
- [x] Include open, closed, confirmed, deferred, and escalated counts in Markdown.
- [x] Surface checkpoint ledger cards and copy controls in Governance.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Command Queue Draft

- [x] Add a non-executing Codex/Claude runner command queue draft API.
- [x] Convert the current session packet and readiness state into operator-supervised queue steps.
- [x] Add Governance copy controls for Codex and Claude queue drafts.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Result Replay Checklist

- [x] Add a non-secret runner result replay checklist API for Codex and Claude.
- [x] Guide safe conversion of CLI output into result intake, validation summaries, blockers, checkpoints, and packet snapshots.
- [x] Add Governance copy controls for Codex and Claude replay checklists.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launchpad Gate

- [x] Add a non-secret Codex/Claude runner launchpad gate API.
- [x] Combine readiness gate, latest packet drift, and packet drift checkpoint state into one launch decision.
- [x] Add Governance copy controls for Codex and Claude launch gates.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launchpad Gate Snapshots

- [x] Add non-secret saved runner launchpad gate snapshots for Codex and Claude.
- [x] Persist runner, launch decision, readiness state, packet drift, checkpoint counts, recommended action, Markdown, and full gate payload.
- [x] Add Governance save and copy controls for persisted launchpad gate snapshots.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launchpad Gate Snapshot Drift

- [x] Add a non-secret drift API comparing saved launchpad gates with live readiness, packet drift, and checkpoint state.
- [x] Compare launch decision, readiness decision, reason counts, packet drift severity/score, checkpoint counts, recommended action, and Markdown changes.
- [x] Add Governance copy controls and drift cards for latest/per-snapshot launchpad gate drift.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launchpad Gate Drift Checkpoints

- [x] Add Confirm, Defer, and Escalate checkpoints for launchpad gate snapshot drift items.
- [x] Persist checkpoint tasks with snapshot id, runner, drift field, before/current values, decision, note, and no-secrets policy.
- [x] Show checkpoint state on launchpad gate drift cards and rehydrate decisions into drift payloads.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launchpad Gate Drift Checkpoint Ledger

- [x] Add a non-secret checkpoint ledger API for launchpad gate drift decisions.
- [x] Include open, closed, confirmed, deferred, and escalated counts in Markdown.
- [x] Surface checkpoint ledger cards and copy controls in Governance.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Authorization Pack

- [x] Add a non-secret Codex/Claude launch authorization pack API.
- [x] Bundle launchpad gate, launchpad snapshot drift, launch drift checkpoint ledger, session packet, command queue, and replay checklist.
- [x] Add Governance copy controls for Codex and Claude launch authorization packs.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Authorization Pack Snapshots

- [x] Add non-secret saved launch authorization pack snapshots for Codex and Claude.
- [x] Persist authorization status, launchpad decision, readiness decision, drift state, checkpoint counts, recommended action, Markdown, and full pack payload.
- [x] Add Governance save and copy controls for persisted launch authorization pack snapshots.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Authorization Pack Snapshot Drift

- [x] Add a non-secret drift API comparing saved launch authorization packs with live authorization state.
- [x] Compare authorization decision/status, launchpad decision, readiness decision, launchpad drift severity/score, checkpoint counts, recommended action, and Markdown changes.
- [x] Add Governance copy controls and drift cards for latest/per-snapshot launch authorization pack drift.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Authorization Pack Drift Checkpoints

- [x] Add Confirm, Defer, and Escalate checkpoints for launch authorization pack snapshot drift items.
- [x] Persist checkpoint tasks with snapshot id, runner, drift field, before/current values, decision, note, and no-secrets policy.
- [x] Show checkpoint state on launch authorization pack drift cards and rehydrate decisions into drift payloads.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Authorization Pack Drift Checkpoint Ledger

- [x] Add a non-secret checkpoint ledger API for launch authorization pack drift decisions.
- [x] Include open, closed, confirmed, deferred, and escalated counts in Markdown.
- [x] Surface checkpoint ledger cards and copy controls in Governance.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Control Board

- [x] Add a non-secret Codex/Claude launch control board API.
- [x] Combine launch authorization pack state with launch authorization pack drift checkpoint ledger state.
- [x] Surface a single launch-ready/review-required/blocked decision with reasons and operator steps.
- [x] Add Governance copy controls, parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Control Board Snapshots

- [x] Add non-secret saved launch control board snapshots for Codex and Claude.
- [x] Persist runner, launch decision/status, authorization status, checkpoint counts, recommended action, Markdown, and full board payload.
- [x] Add Governance save and copy controls for persisted launch control board snapshots.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Control Board Snapshot Drift

- [x] Add a non-secret drift API comparing saved launch control boards with live runner-start state.
- [x] Compare launch decision/status, authorization status, pack decision, checkpoint counts, recommended action, and Markdown changes.
- [x] Add Governance copy controls and drift cards for latest/per-snapshot launch control board drift.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Control Board Drift Checkpoints

- [x] Add Confirm, Defer, and Escalate checkpoints for launch control board snapshot drift items.
- [x] Persist checkpoint tasks with snapshot id, runner, drift field, before/current values, decision, note, and no-secrets policy.
- [x] Show checkpoint state on launch control board drift cards and rehydrate decisions into drift payloads.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Control Board Drift Checkpoint Ledger

- [x] Add a non-secret checkpoint ledger API for launch control board drift decisions.
- [x] Include open, closed, confirmed, deferred, and escalated counts in Markdown.
- [x] Surface checkpoint ledger cards and copy controls in Governance.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Execution Packet

- [x] Add a non-secret launch execution packet API for Codex and Claude.
- [x] Bundle launch control board, authorization pack, command queue draft, replay checklist, and drift checkpoint ledgers.
- [x] Surface Governance copy controls and preflight cards for the packet.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Execution Packet Snapshots

- [x] Add persisted launch execution packet snapshots for Codex and Claude.
- [x] Store packet decision/status, preflight count, command count, replay count, Markdown, and full packet payload.
- [x] Surface Governance save and copy controls for launch execution packet snapshots.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Execution Packet Snapshot Drift

- [x] Add a non-secret drift API comparing saved launch execution packets with the live runner-start handoff.
- [x] Compare launch decision/status, execution mode, preflight count, command count, replay count, recommended action, and Markdown changes.
- [x] Add Governance copy controls and drift cards for latest/per-snapshot launch execution packet drift.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Execution Packet Drift Checkpoints

- [x] Add Confirm, Defer, and Escalate checkpoints for launch execution packet snapshot drift items.
- [x] Persist checkpoint tasks with snapshot id, runner, drift field, before/current values, decision, note, and no-secrets policy.
- [x] Show checkpoint state on launch execution packet drift cards and rehydrate decisions into drift payloads.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Execution Packet Drift Checkpoint Ledger

- [x] Add a non-secret checkpoint ledger API for launch execution packet drift decisions.
- [x] Include open, closed, confirmed, deferred, and escalated counts in Markdown.
- [x] Surface checkpoint ledger cards and copy controls in Governance.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Execution Packet Snapshot Refresh

- [x] Add an explicit refresh API that saves the current live launch execution packet as the latest snapshot baseline.
- [x] Preserve the previous snapshot id for audit history while adding the refreshed snapshot to the snapshot list.
- [x] Surface a Governance refresh control on launch execution packet snapshot drift cards.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Status

- [x] Add a non-secret launch stack status API for Codex and Claude.
- [x] Roll up session packet drift, launchpad gate, authorization pack drift, control board state, execution packet drift, and checkpoint ledgers.
- [x] Surface a Governance launch stack board with ready/review/hold stage cards and copy controls.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Action Tasks

- [x] Add a non-secret launch stack action task API for Codex and Claude non-ready stages.
- [x] Persist runner-specific stage tasks with launch stack decision, stage status, action detail, and no-secrets policy.
- [x] Surface Governance controls to seed all non-ready stack tasks or track one stage at a time.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Action Task Ledger

- [x] Add a non-secret ledger API for launch stack action tasks with runner and status filters.
- [x] Summarize open, closed, runner, and priority counts with Markdown export.
- [x] Surface Governance ledger cards and copy controls for all/open Codex/Claude task slices.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Action Task Ledger Snapshots

- [x] Add persisted snapshots for launch stack action task ledgers.
- [x] Store runner/status filters, task counts, priority split, Markdown, and visible task payload.
- [x] Surface Governance save and copy controls for action task ledger snapshots.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Action Task Ledger Snapshot Drift

- [x] Add a non-secret drift API comparing saved launch stack action task ledger snapshots with the live ledger.
- [x] Compare task totals, open/closed counts, runner split, and priority split.
- [x] Surface Governance drift cards and copy controls for latest and per-snapshot drift.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Action Task Ledger Drift Checkpoints

- [x] Add Confirm, Defer, and Escalate checkpoints for launch stack action task ledger snapshot drift items.
- [x] Persist checkpoint tasks with snapshot id, runner/status scope, drift field, before/current values, decision, note, and no-secrets policy.
- [x] Surface checkpoint state on drift cards plus a copyable checkpoint ledger in Governance.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Task Ledger Gate

- [x] Feed launch stack action task ledger snapshot drift into the overall runner launch stack status.
- [x] Feed unresolved and escalated action-task ledger drift checkpoints into the stack-level ready/review/hold decision.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Action Task Ledger Snapshot Refresh

- [x] Add an explicit refresh API that saves the current live launch stack action task ledger as the latest baseline.
- [x] Surface an `Accept Drift` control on the Governance launch stack action task ledger drift card.
- [x] Preserve the previous snapshot id for audit history while inserting the refreshed snapshot at the top of the snapshot ledger.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Action Task Ledger Checkpoint Lifecycle

- [x] Add direct Resolve, Reopen, and Block controls to launch stack action task ledger drift checkpoint cards.
- [x] Track open escalated checkpoint counts separately from historical escalations.
- [x] Let resolved checkpoint tasks release the action-task ledger checkpoint stage from hold back to ready.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Remediation Pack

- [x] Add a non-secret Codex/Claude launch stack remediation pack API.
- [x] Bundle non-ready launch stack stages, open runner action tasks, and unresolved action-task ledger drift checkpoints.
- [x] Surface Governance copy controls and remediation stage cards for supervised CLI handoff preparation.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Remediation Pack Snapshots

- [x] Add persisted snapshots for Codex and Claude launch stack remediation packs.
- [x] Store decision, stage/task/checkpoint counts, Markdown, and full non-secret pack payload.
- [x] Surface Governance save and copy controls for remediation pack snapshots.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Remediation Pack Snapshot Drift

- [x] Add a non-secret drift API comparing saved remediation pack snapshots with the live runner pack.
- [x] Compare decision rank, stage counts, task counts, checkpoint counts, and recommended action changes.
- [x] Surface Governance copy controls and drift cards for latest/per-snapshot remediation pack drift.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Remediation Pack Drift Checkpoints

- [x] Add Confirm, Defer, and Escalate checkpoints for remediation pack snapshot drift items.
- [x] Persist checkpoint tasks with snapshot id, runner, drift field, before/current values, decision, note, and no-secrets policy.
- [x] Surface checkpoint state on remediation pack drift cards in Governance.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Remediation Pack Drift Checkpoint Ledger

- [x] Add a copyable all/open/closed ledger for remediation pack drift checkpoint decisions.
- [x] Summarize total, visible, open, closed, confirmed, deferred, escalated, and open escalated counts.
- [x] Surface Governance ledger cards with checkpoint snapshot, runner, field, before/current values, and decision state.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Remediation Pack Checkpoint Lifecycle

- [x] Add direct Resolve, Reopen, and Block controls to remediation pack drift checkpoint cards.
- [x] Reuse the task lifecycle API so checkpoint status updates remain auditable through Governance operations.
- [x] Validate open/closed ledger counts after blocked, reopened, and resolved checkpoint transitions.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Remediation Pack Snapshot Refresh

- [x] Add an explicit refresh API that accepts live remediation pack drift as the latest saved baseline.
- [x] Preserve the previous snapshot id while inserting the refreshed remediation pack snapshot at the top of the ledger.
- [x] Surface an `Accept Drift` control on the remediation pack snapshot drift card.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Remediation Stack Gate

- [x] Feed remediation pack snapshot drift into the runner launch stack ready/review/hold status.
- [x] Feed remediation pack drift checkpoint ledger state into the runner launch stack status.
- [x] Add an internal recursion guard so remediation pack generation can compute live packs without self-referencing the stack gate.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Remediation Work-Order Draft

- [x] Add a non-executing Codex/Claude remediation work-order draft API.
- [x] Convert remediation pack stages, tasks, and checkpoints into ordered work items and runner prompts.
- [x] Surface Governance copy controls for Codex and Claude remediation work-order drafts.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Remediation Work-Order Run Queue

- [x] Add a duplicate-safe queue API for non-executing Codex/Claude launch stack remediation work orders.
- [x] Persist queued remediation work orders as supervised agent work-order runs with runner, work-item, validation, and secret-policy metadata.
- [x] Surface Governance queue controls next to the remediation work-order draft copy controls.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Remediation Work-Order Run Ledger

- [x] Add a copyable ledger API for queued launch stack remediation work-order runs.
- [x] Summarize visible, open, closed, archived, Codex, Claude, and total work-item counts.
- [x] Surface Governance ledger cards and Copy All/Open/Closed controls.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Remediation Work-Order Result Intake

- [x] Add a non-secret result intake API for queued launch stack remediation work-order runs.
- [x] Update linked remediation work-order runs with result status, validation summary, changed files, blockers, and next action.
- [x] Surface Governance Record Passed and Record Blocked controls on remediation work-order run cards.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Remediation Work-Order Result Ledger

- [x] Add a copyable result ledger API for launch stack remediation work-order outcomes.
- [x] Summarize visible, passed, failed, blocked, needs-review, cancelled, Codex, Claude, and total work-item counts.
- [x] Surface Governance result ledger cards and Copy All/Passed/Blocked controls.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Remediation Work-Order Result Follow-Up Tasks

- [x] Add a duplicate-safe task creation API for actionable remediation work-order results.
- [x] Convert blocked, failed, and needs-review remediation outcomes into Governance follow-up tasks.
- [x] Surface Governance task creation controls from the remediation result ledger.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Remediation Work-Order Result Follow-Up Task Ledger

- [x] Add a copyable ledger API for remediation result follow-up tasks.
- [x] Summarize visible, open, closed, runner split, result status split, and priority split.
- [x] Surface Governance ledger cards and Copy All/Open Codex/Open Claude controls.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Remediation Work-Order Result Follow-Up Task Lifecycle

- [x] Add Resolve, Reopen, and Block controls to remediation result follow-up task cards.
- [x] Reuse the task lifecycle API so changes remain auditable in Governance task update history.
- [x] Validate open and closed ledger counts after resolved, reopened, and blocked transitions.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Convergence Assimilation Runner Launch Stack Remediation Work-Order Result Follow-Up Task Ledger Snapshots

- [x] Add persisted snapshots for remediation result follow-up task ledgers.
- [x] Store runner filter, status filter, counts, Markdown, and captured task items.
- [x] Surface Governance save and copy controls for result follow-up task ledger snapshots.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Governance Stability And Convergence De-Duplication

- [x] Fix the Governance panel render crash caused by an undefined `summary` reference.
- [x] De-duplicate high-overlap convergence findings so a pair emits one actionable finding.
- [x] Disambiguate same-name convergence pairs with project path labels to avoid self-reference confusion.
- [x] Add regression coverage for duplicate display names, parser checks, server validation, static preview build, relaunch, commit, and push.

## Next Governance Starter Pack Memory Seeding

- [x] Extend governance starter packs with a decision note so the Memory tab is no longer empty after onboarding.
- [x] Extend governance starter packs with scan-derived milestones that include test coverage and runtime detection targets.
- [x] Include note and milestone totals in bootstrap and queue execution responses.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Scan Health Regression Alerts

- [x] Add scan-diff health alerts for workspace health drops, stagnant tests, and project-level regressions.
- [x] Surface alert counts and severity in the Trends summary.
- [x] Add a Health Regression Alerts deck with recommended actions for scan triage.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Runtime Surface Detection Heuristics

- [x] Capture nested package scripts, Python requirements, and Docker Compose runtime surfaces during audit scans.
- [x] Add launch command metadata with working directories so nested package scripts can run from the project workbench.
- [x] Update the Launchpad and agent handoff pack to show detected runtime surfaces instead of reporting empty scripts too early.
- [x] Add parser checks, audit coverage, validation, relaunch, commit, and push.

## Next Command Palette Fuzzy Project Search

- [x] Index every project as a command palette workbench target instead of only the top quality projects.
- [x] Add fuzzy scoring across labels, descriptions, IDs, paths, stack, zone, and category metadata.
- [x] Prioritize project matches when the query resembles a project name or path.
- [x] Add parser checks, validation, relaunch, commit, and push.

## Next Inventory JSON And Markdown Exports

- [x] Add toolbar actions for JSON and Markdown portfolio exports alongside CSV.
- [x] Export the current filtered project set with runtime surfaces, launch commands, warnings, and similarity metadata in JSON.
- [x] Export a readable Markdown portfolio summary for executive review and agent handoff context.
- [x] Add command palette actions, parser checks, validation, relaunch, commit, and push.

## Next Source Access Evidence Status Clarification

- [x] Attach validation evidence coverage status to every Data Sources access review queue item.
- [x] Distinguish approved source-access checkpoints from missing non-secret validation evidence in queue summaries and markdown.
- [x] Surface evidence status in the Data Sources and Governance review queue cards.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next App-Development Governance Profile Scope

- [x] Add an explicit app-development scope classifier for AI/agent, control-plane, tooling, builder, and integration projects.
- [x] Exclude non-target business, content, media, finance, POS, CRM, recipe, and hospitality apps from Governance profile-gap onboarding.
- [x] Add scoped profile coverage counts and gap totals to Governance summaries, reports, and KPI cards.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Scoped Governance Starter Pack Seeding

- [x] Use the scoped app-development gap queue to seed starter packs for the remaining target projects.
- [x] Confirm scoped profile coverage reached 8/8 target projects.
- [x] Confirm scoped gap count dropped to 0 while non-target projects remain excluded.
- [x] Record the operational milestone and keep the app running for monitoring.

## Next Governance Profile Test And Runtime Targets

- [x] Store scan-derived test coverage and runtime launch targets on Governance profiles.
- [x] Add a refresh endpoint and UI action to update targets for scoped app-development profiles.
- [x] Surface profile target KPIs and a Governance Profile Targets deck.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Governance Profile Target Task Seeding

- [x] Create deduplicated Governance tasks from profile test coverage and runtime target gaps.
- [x] Add toolbar and command-palette actions for seeding visible profile target tasks.
- [x] Surface profile target task status and missing task counts in Governance cards, summaries, and reports.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Governance Profile Target Task Ledger

- [x] Add a copyable API ledger for Governance profile target tasks with open, closed, kind, project, and missing-test summaries.
- [x] Surface profile target task rows in Governance registry filtering and reports.
- [x] Add toolbar and command-palette copy actions for the target task ledger.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Governance Profile Target Task Ledger Snapshots

- [x] Persist Governance profile target task ledger snapshots with Markdown and task payloads.
- [x] Surface saved target task ledger snapshots in Governance registry filtering and reports.
- [x] Add toolbar and command-palette actions for saving target task ledger snapshots.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Governance Profile Target Task Ledger Snapshot Drift

- [x] Add a latest-or-specific snapshot drift API for Governance profile target task ledgers.
- [x] Compare saved target task baselines against live open/closed/task-kind/project/test-file state.
- [x] Surface the drift payload in Governance cards, summaries, reports, toolbar actions, and command palette.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Governance Profile Target Task Ledger Baseline Refresh

- [x] Add an API action to accept the live Governance profile target task ledger as a refreshed snapshot baseline.
- [x] Preserve previous snapshot lineage and record a Governance operation for every baseline refresh.
- [x] Add toolbar and command-palette actions for refreshing the target task baseline.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Governance Profile Target Task Ledger Drift Checkpoints

- [x] Add task-backed Confirm, Defer, and Escalate checkpoints for profile target task ledger drift items.
- [x] Preserve snapshot ID, drift field, before/current values, decision, and no-secrets metadata on checkpoint tasks.
- [x] Surface checkpoint actions on Governance profile target task drift rows.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Governance Profile Target Task Ledger Drift Checkpoint Ledger

- [x] Add a copyable API ledger for Governance profile target task ledger drift checkpoint tasks.
- [x] Surface checkpoint totals, decisions, and open/closed filters in Governance.
- [x] Add Governance report lines for target drift checkpoint decisions.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Governance Profile Target Task Ledger Drift Checkpoint Review Controls

- [x] Show existing checkpoint decisions directly on profile target task drift rows.
- [x] Add all, uncheckpointed, confirmed, deferred, and escalated filters to the drift card.
- [x] Add a drift-card action to accept the live profile target task ledger as the refreshed baseline.
- [x] Add parser checks, validation, relaunch, commit, and push.

## Next Governance Profile Target Task Ledger Baseline Status

- [x] Add a profile target task ledger baseline status API with freshness, health, drift, and checkpoint coverage.
- [x] Surface baseline status in Governance with copyable Markdown handoff controls.
- [x] Add toolbar and command-palette actions for copying the target task baseline status.
- [x] Add parser checks, server coverage, validation, relaunch, commit, and push.

## Next Agent Control Plane Profile Target Baseline Gate

- [x] Feed profile target task ledger baseline status into Agent Control Plane decisions.
- [x] Add review reasons for missing, stale, drifted, and uncheckpointed target task baselines.
- [x] Surface target baseline health in the decision card, report, snapshot payload, and parser checks.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Profile Target Baseline Context

- [x] Add profile target task baseline health to CLI bridge context payloads.
- [x] Include profile target task baseline evidence in CLI bridge Markdown and dry-run prompts.
- [x] Surface target baseline status in the CLI runner readiness gate.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Run Trace Profile Target Baseline

- [x] Add profile target task baseline health to CLI bridge run traces.
- [x] Persist target baseline state on CLI bridge run trace snapshots.
- [x] Include target baseline state in run trace Markdown, snapshot cards, parser checks, and tests.
- [x] Validate, relaunch, commit, and push.

## Next Agent Execution Profile Target Baseline Capture

- [x] Capture profile target task baseline health on newly queued Agent Work Order runs.
- [x] Apply the same capture to snapshot batches, CLI bridge follow-up runs, convergence runs, and launch-stack remediation runs.
- [x] Surface captured target baseline health in the Agent Execution Queue and parser checks.
- [x] Validate, relaunch, commit, and push.

## Next Agent Execution Target Baseline Audit

- [x] Add execution metrics and summary counts for run-level profile target baseline capture, health, drift, and review state.
- [x] Add Governance execution filters, queue card details, and report evidence for target baseline review cases.
- [x] Feed run-level target baseline review state into Agent Control Plane and CLI runner readiness gates.
- [x] Validate, relaunch, commit, and push.

## Next Agent Execution Target Baseline Refresh

- [x] Add an Agent Work Order run API action that recaptures the current profile target task baseline onto an existing run.
- [x] Preserve run history and Governance operation evidence for every target baseline refresh.
- [x] Add an Agent Execution Queue button for refreshing stale, missing, or drifted run target baselines.
- [x] Validate, relaunch, commit, and push.

## Next Agent Execution Target Baseline Bulk Refresh

- [x] Add a visible-run bulk action for refreshing target baseline capture on filtered Agent Execution runs.
- [x] Expose the action through the command palette/action registry for supervised batch remediation.
- [x] Add parser coverage for the bulk target baseline refresh wiring.
- [x] Validate, relaunch, commit, and push.

## Next Agent Execution Target Baseline Audit Ledger

- [x] Add a no-secret API ledger for run-level target baseline audit records across active Agent Work Order runs.
- [x] Surface copy controls in Governance and command palette for review/all baseline audit ledgers.
- [x] Add Governance report evidence, parser checks, and server coverage for the target baseline audit ledger.
- [x] Validate, relaunch, commit, and push.

## Next Agent Execution Target Baseline Audit Ledger Snapshots

- [x] Add a persisted store collection and API for target baseline audit ledger snapshots.
- [x] Surface snapshot save/copy controls in Governance and command palette.
- [x] Add Governance report evidence, parser checks, and server coverage for snapshot persistence.
- [x] Validate, relaunch, commit, and push.

## Next Agent Execution Target Baseline Audit Ledger Snapshot Drift

- [x] Add a live-vs-snapshot drift API for saved target baseline audit ledgers.
- [x] Surface per-snapshot and command-palette copy controls for drift handoffs.
- [x] Add parser checks and server coverage for clean snapshot drift.
- [x] Validate, relaunch, commit, and push.

## Next Agent Execution Target Baseline Audit Ledger Snapshot Drift Tasks

- [x] Add per-snapshot controls for creating Governance tasks from target baseline audit drift.
- [x] Add command-palette support for tracking latest target baseline audit drift.
- [x] Preserve no-secret drift summaries in created task descriptions.
- [x] Validate, relaunch, commit, and push.

## Next Agent Execution Target Baseline Audit Ledger Snapshot Refresh

- [x] Add a server refresh API that saves a fresh target-baseline audit ledger from an existing snapshot's filter and limit.
- [x] Record Governance operation evidence for every refreshed target-baseline audit snapshot.
- [x] Surface per-snapshot and command-palette refresh controls.
- [x] Validate, relaunch, commit, and push.

## Next Agent Execution Target Baseline Audit Drift Checkpoints

- [x] Add Confirm, Defer, and Escalate checkpoint handling for target-baseline audit snapshot drift.
- [x] Store checkpoint decisions as non-secret Governance tasks with ledger evidence.
- [x] Surface per-snapshot checkpoint controls and a command-palette confirm action.
- [x] Validate, relaunch, commit, and push.

## Next Agent Execution Target Baseline Audit Baseline Status

- [x] Add a baseline status API for latest target-baseline audit snapshot health, freshness, drift, and checkpoint coverage.
- [x] Surface baseline health in Governance summary, report, deck card, and command palette copy action.
- [x] Add parser and server test coverage for healthy refreshed audit baselines.
- [x] Validate, relaunch, commit, and push.

## Next Agent Control Plane Target Baseline Audit Gate

- [x] Feed target-baseline audit snapshot baseline health into Agent Control Plane decisions.
- [x] Add review reasons for missing, stale, drifted, or uncheckpointed audit baselines.
- [x] Carry audit-baseline readiness into CLI bridge context and dry-run prompts.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Target Baseline Audit Context

- [x] Capture target-baseline audit baseline health, freshness, drift, checkpoint, snapshot, and recommended action context on CLI bridge handoffs.
- [x] Apply the same audit-baseline context to CLI runner result intake handoffs.
- [x] Surface handoff audit-baseline evidence in CLI bridge ledger Markdown, Governance cards, summary text, and report export.
- [x] Add parser checks and server test coverage for handoff audit-baseline evidence.
- [x] Validate, relaunch, commit, and push.

## Next CLI Runner Dry-Run Audit Baseline Gate

- [x] Add an explicit target-baseline audit gate to CLI runner dry-run payloads.
- [x] Include the audit gate in dry-run Markdown, command envelopes, and runner prompts.
- [x] Surface the audit gate in the Governance CLI runner readiness card.
- [x] Add parser checks and server test coverage for the dry-run audit gate.
- [x] Validate, relaunch, commit, and push.

## Next Agent Work Order Audit Baseline Capture

- [x] Capture target-baseline audit baseline state on newly queued Agent Work Order runs.
- [x] Apply capture to snapshot batch, CLI bridge follow-up, convergence, and remediation queue paths.
- [x] Surface captured audit baseline state in Agent Execution Queue cards.
- [x] Add type, parser, and server test coverage.
- [x] Validate, relaunch, commit, and push.

## Next Agent Work Order Audit Baseline Refresh

- [x] Add a run-level API action to recapture the current target-baseline audit snapshot baseline.
- [x] Preserve run history and Governance operation evidence for every audit-baseline refresh.
- [x] Add an Agent Execution Queue control for refreshing stale, missing, or drifted audit-baseline capture.
- [x] Add parser and server test coverage.
- [x] Validate, relaunch, commit, and push.

## Next Agent Work Order Audit Baseline Bulk Refresh

- [x] Add a visible-run bulk action for refreshing target-baseline audit capture on filtered Agent Execution runs.
- [x] Expose the action through the command palette/action registry for supervised batch remediation.
- [x] Reuse the no-secret audit refresh API and preserve per-run history evidence.
- [x] Add parser coverage for the bulk audit-baseline refresh wiring.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Run Trace Audit Baseline

- [x] Add target-baseline audit snapshot baseline status to CLI bridge run trace payloads.
- [x] Include audit-baseline health, freshness, drift, checkpoint, snapshot, and action context in CLI trace Markdown.
- [x] Persist audit-baseline state on CLI bridge run trace snapshots and drift summaries.
- [x] Surface audit-baseline status in CLI trace snapshot cards.
- [x] Add type, parser, and server test coverage.
- [x] Validate, relaunch, commit, and push.

## Next Governance Audit Baseline Execution Filters

- [x] Add execution status filters for audit-baseline review, missing, stale, and drift states.
- [x] Keep audit-baseline filters separate from profile target-baseline filters.
- [x] Apply filters to visible Agent Execution runs in Governance.
- [x] Add parser coverage for the new filter options and matching logic.
- [x] Validate, relaunch, commit, and push.

## Next Agent Execution Audit Baseline Metrics

- [x] Add portfolio-level metrics for run-level audit-baseline capture, missing, healthy, stale, drifted, and review-required states.
- [x] Add summary counters for audit-baseline capture state in the Governance payload.
- [x] Surface audit-baseline counts in Agent Execution Metrics and Governance report exports.
- [x] Add type, parser, and server test coverage.
- [x] Validate, relaunch, commit, and push.

## Next Agent Control Plane Audit Baseline Run Gate

- [x] Feed run-level audit-baseline review-required counts into the Agent Control Plane decision API.
- [x] Add a dedicated decision reason for execution runs with missing, stale, or drifted target-baseline audit snapshot evidence.
- [x] Persist audit-baseline execution counts on Agent Control Plane decision snapshots.
- [x] Add the audit-baseline execution blocker to the CLI runner readiness gate.
- [x] Add type, parser, and server test coverage.
- [x] Validate, relaunch, commit, and push.

## Next Agent Control Plane Audit Baseline Snapshot Drift

- [x] Add audit-baseline execution counts to Agent Control Plane snapshot metric summaries.
- [x] Include captured, missing, healthy, review-required, and uncheckpointed drift item counts in snapshot drift deltas.
- [x] Add parser and server test coverage for audit-baseline snapshot drift visibility.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Audit Baseline Decision Context

- [x] Add Agent Control Plane audit-baseline execution counts to CLI Bridge context payloads.
- [x] Surface audit-baseline execution counts in CLI Bridge context Markdown.
- [x] Include audit-baseline execution counts in bounded Codex and Claude runner dry-run prompts.
- [x] Add type, parser, and server test coverage.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Audit Baseline Run Gate

- [x] Add a structured audit-baseline run gate to CLI Bridge runner dry-run payloads.
- [x] Add the gate to command envelopes for Codex and Claude adapters.
- [x] Add audit-baseline run gate Markdown and review reasons for non-ready run evidence.
- [x] Add type, parser, and server test coverage.
- [x] Validate, relaunch, commit, and push.

## Next Agent Control Plane Audit Baseline Run Visibility

- [x] Add audit-baseline run review counts to Agent Control Plane decision tags.
- [x] Add captured, missing, healthy, and review-required audit-baseline run counts to the decision detail line.
- [x] Add parser coverage for the dashboard visibility wiring.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Runner Dry-Run Snapshots

- [x] Add persistent non-secret Codex and Claude runner dry-run snapshot storage.
- [x] Add API routes for listing and saving dry-run snapshots from the current CLI Bridge dry-run contract.
- [x] Surface saved dry-run snapshots in Governance with copy controls and summary counts.
- [x] Add type, parser, and server test coverage.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Runner Dry-Run Snapshot Drift

- [x] Add a diff endpoint comparing the latest saved dry-run snapshot against the current live dry-run contract.
- [x] Compare runner, selected work order, decisions, reason codes, target-baseline audit gate, and audit-baseline run gate fields.
- [x] Surface drift severity, score, items, recommended action, and copyable Markdown in Governance.
- [x] Add type, parser, and server test coverage.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Runner Dry-Run Snapshot Drift Checkpoints

- [x] Add Track Drift and Accept Drift controls to the runner dry-run snapshot drift card.
- [x] Add per-field Confirm, Defer, and Escalate checkpoint controls for dry-run drift items.
- [x] Convert checkpoint decisions into non-secret Governance tasks scoped to the selected work order when available.
- [x] Refresh the dry-run snapshot baseline when drift is accepted.
- [x] Add parser and milestone coverage, validate, relaunch, commit, and push.

## Next CLI Bridge Runner Dry-Run Baseline Status

- [x] Add a baseline-status endpoint for the latest saved Codex or Claude dry-run snapshot.
- [x] Report baseline freshness, health, drift score, drift severity, and recommended action.
- [x] Surface the baseline-status card and copy control in Governance.
- [x] Include baseline status in Governance filtering, summary, and report exports.
- [x] Add type, parser, server test, and milestone coverage; validate, relaunch, commit, and push.

## Next CLI Bridge Runner Dry-Run Baseline Refresh Controls

- [x] Add direct Codex and Claude baseline refresh actions to the dry-run baseline-status card.
- [x] Reuse the existing non-secret runner dry-run snapshot save flow for refresh actions.
- [x] Add parser and milestone coverage.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Runner Dry-Run Baseline Lifecycle Ledger

- [x] Add a derived lifecycle ledger API for saved Codex and Claude dry-run baselines.
- [x] Join saved snapshots with governance operation metadata where available.
- [x] Surface copyable all/Codex/Claude lifecycle ledgers in Governance.
- [x] Add parser, server test, and milestone coverage.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Runner Dry-Run Lifecycle Ledger Review Controls

- [x] Add all/Codex/Claude task-generation controls to the dry-run lifecycle ledger.
- [x] Add per-lifecycle-item task-generation controls scoped to the selected work order project when available.
- [x] Generate non-secret Governance task descriptions from lifecycle metadata and decisions.
- [x] Add parser and milestone coverage.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Run Trace Lifecycle Ledger

- [x] Add a derived lifecycle ledger API for saved CLI bridge run trace snapshots.
- [x] Join saved trace snapshots with governance operation metadata where available.
- [x] Surface a copyable run-trace lifecycle ledger in Governance.
- [x] Include trace lifecycle data in Governance filtering, summaries, and reports.
- [x] Add parser, server test, and milestone coverage; validate, relaunch, commit, and push.

## Next CLI Bridge Run Trace Lifecycle Ledger Review Controls

- [x] Add task-generation controls to the run-trace lifecycle ledger.
- [x] Add per-lifecycle-item task-generation controls scoped to the traced project when available.
- [x] Generate non-secret Governance task descriptions from trace lifecycle metadata, baseline health, and handoff counts.
- [x] Add parser and milestone coverage.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Lifecycle Stack Status

- [x] Add a single ready/review/hold stack status API for dry-run and run-trace lifecycle evidence.
- [x] Include dry-run baseline, dry-run lifecycle, run-trace baseline, and run-trace lifecycle stages.
- [x] Surface the stack status in Governance with copyable Markdown.
- [x] Add parser, server test, and milestone coverage.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Lifecycle Stack Remediation Pack

- [x] Add a copyable remediation-pack API derived from non-ready lifecycle stack stages.
- [x] Convert hold/review stages into operator-guided work items with priorities and runner hints.
- [x] Surface the remediation pack in Governance with Markdown copy controls.
- [x] Add parser, server test, and milestone coverage.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Lifecycle Stack Remediation Task Controls

- [x] Add Track Pack controls for creating a Governance task from the full remediation pack.
- [x] Add per-work-item Track Item controls for non-ready lifecycle stages.
- [x] Generate non-secret task descriptions from stage details, recommended actions, and runner hints.
- [x] Add parser and milestone coverage.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Lifecycle Stack Remediation Task Ledger

- [x] Add a remediation task ledger API for CLI bridge lifecycle remediation tasks.
- [x] Include status filtering, priority summaries, stage extraction, and copyable Markdown.
- [x] Surface the task ledger in Governance with summary cards and copy controls.
- [x] Add parser, server test, and milestone coverage.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Lifecycle Stack Remediation Task Ledger Snapshots

- [x] Add persisted snapshot records for the CLI bridge lifecycle remediation task ledger.
- [x] Expose GET/POST snapshot APIs with non-secret ledger payload capture.
- [x] Surface save and copy controls in Governance with snapshot cards.
- [x] Include snapshots in Governance filtering, summaries, report exports, parser checks, and server tests.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Lifecycle Stack Remediation Task Ledger Snapshot Drift

- [x] Add a diff endpoint comparing saved remediation task ledger snapshots with the current live ledger.
- [x] Report task-count, priority-count, visibility, and latest-task drift with severity scoring.
- [x] Surface latest and per-snapshot copy controls in Governance.
- [x] Include drift in Governance filtering, summaries, report exports, parser checks, and server tests.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Lifecycle Stack Remediation Task Ledger Drift Checkpoints

- [x] Add confirm, defer, and escalate checkpoint endpoints for remediation task ledger drift items.
- [x] Persist checkpoint decisions as non-secret Governance tasks excluded from the live remediation task ledger.
- [x] Add a copyable all/open/closed checkpoint ledger with lifecycle controls.
- [x] Surface checkpoint state in drift items, Governance filtering, visible summaries, report exports, parser checks, and server tests.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Lifecycle Stack Remediation Task Ledger Baseline Status

- [x] Add a baseline-status API for the latest saved CLI bridge lifecycle remediation task ledger snapshot.
- [x] Report baseline freshness, health, drift score, drift severity, checkpoint coverage, and open escalated checkpoint count.
- [x] Surface the baseline-status card and copy control in Governance.
- [x] Include baseline status in Governance filtering, summaries, report exports, parser checks, and server tests.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Lifecycle Stack Remediation Task Ledger Baseline Refresh Controls

- [x] Add a refresh endpoint that accepts the live remediation task ledger as a new saved baseline.
- [x] Preserve previous snapshot linkage, status filters, limits, and governance operation evidence.
- [x] Surface Refresh Baseline and Accept Drift controls across snapshot, drift, and baseline-status cards.
- [x] Add parser and server test coverage for the baseline refresh flow.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Lifecycle Stack Remediation Task Ledger Baseline Refresh Gate

- [x] Add refresh gate decision fields to remediation task ledger baseline status.
- [x] Classify baseline refresh as ready, review, or hold using drift, checkpoint coverage, open escalations, and freshness.
- [x] Surface gate state, reasons, and blocked Accept Drift controls in Governance.
- [x] Include gate details in report export, parser checks, and server tests.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Lifecycle Stack Remediation Task Ledger Baseline Stage

- [x] Promote remediation task ledger baseline status into the CLI bridge lifecycle stack status payload.
- [x] Add a remediation task ledger baseline stage with ready, review, and hold decisions driven by the refresh gate.
- [x] Feed the stage into the existing lifecycle remediation pack so non-ready baseline evidence becomes actionable work.
- [x] Add parser and server test coverage for the fifth lifecycle stage.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Lifecycle Stack Handoff Gate

- [x] Add a machine-readable handoff gate to the lifecycle stack status payload.
- [x] Mark CLI runner handoff as allowed only when all lifecycle stages are ready.
- [x] Include a non-secret handoff checklist and reasons for blocked or review-only launches.
- [x] Surface handoff gate state in Governance, report export, parser checks, and server tests.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Lifecycle Handoff Packet

- [x] Add a packet API combining lifecycle gate, remediation, baseline status, and CLI bridge context.
- [x] Surface copyable all-runner, Codex, and Claude handoff packets in Governance.
- [x] Include packet state in Governance filtering, visible summaries, report exports, parser checks, and server tests.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Lifecycle Handoff Packet Snapshots

- [x] Add snapshot APIs for saving and listing non-secret CLI bridge lifecycle handoff packets.
- [x] Persist packet decision, runner, launch gate, lifecycle, remediation, baseline, and bridge-context summary fields.
- [x] Surface save/copy snapshot controls in Governance.
- [x] Include packet snapshots in Governance filtering, summaries, report exports, parser checks, and server tests.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Lifecycle Handoff Packet Snapshot Drift

- [x] Add a diff API comparing the latest saved lifecycle handoff packet against the current live packet.
- [x] Score drift across launch gate, lifecycle, remediation, baseline, bridge, and runner fields.
- [x] Surface copyable latest and per-snapshot drift controls in Governance.
- [x] Include packet snapshot drift in Governance filtering, summaries, report exports, parser checks, and server tests.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Lifecycle Handoff Packet Drift Checkpoints

- [x] Add confirm, defer, and escalate checkpoint endpoints for lifecycle handoff packet drift items.
- [x] Persist checkpoint decisions as non-secret Governance tasks excluded from live remediation ledgers.
- [x] Add a copyable all/open/closed checkpoint ledger with task lifecycle controls.
- [x] Surface checkpoint state in handoff packet drift items, Governance filtering, visible summaries, report exports, parser checks, and server tests.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Lifecycle Handoff Packet Baseline Status

- [x] Add a baseline-status API for the latest saved lifecycle handoff packet snapshot.
- [x] Report baseline freshness, health, drift score, drift severity, checkpoint coverage, and open escalated checkpoint count.
- [x] Add a ready/review/hold reuse gate for saved handoff packet baselines.
- [x] Surface the baseline-status card and copy control in Governance.
- [x] Include baseline status in Governance filtering, summaries, report exports, parser checks, and server tests.
- [x] Validate, relaunch, commit, and push.

## Next CLI Bridge Lifecycle Handoff Packet Baseline Refresh Controls

- [x] Add a refresh endpoint that accepts the current live lifecycle handoff packet as a new reusable baseline.
- [x] Add refresh gate metadata to baseline status for ready, review, and hold outcomes.
- [x] Surface Save Baseline, Refresh Baseline, and Accept Drift controls across snapshot, drift, and baseline-status cards.
- [x] Add parser and server test coverage for the handoff packet baseline refresh flow.
- [x] Validate, relaunch, commit, and push.

## Next Active Project Scope Lock

- [x] Add a persistent active-project selector and project/portfolio scope badge.
- [x] Store scope mode and selected project in localStorage for reload-safe AI/CLI planning.
- [x] Add command-palette actions to clear scope, enter or exit portfolio mode, and scope directly to a project.
- [x] Include scope metadata in runtime status and inventory exports.
- [x] Validate, relaunch, commit, and push.

## Next Scope-Aware CLI Bridge Handoff Packets

- [x] Add server-side lifecycle handoff packet scope context for active project and portfolio mode.
- [x] Block ready-to-launch packet state when no active project is selected and portfolio mode is not explicit.
- [x] Persist scope metadata into lifecycle handoff packet snapshots and drift summaries.
- [x] Pass UI scope metadata through packet copy, snapshot, drift, checkpoint, and baseline-status requests.
- [x] Validate, relaunch, commit, and push.

## Next Active Scope Execution Guard

- [x] Disable high-impact execution buttons when no active project is selected and portfolio mode is off.
- [x] Guard command-palette and direct handler routes with the same active-project requirement.
- [x] Include governance queue execution, agent run start/block/retry/archive, SLA actioning, and retention controls.
- [x] Add parser coverage for the guarded control set.
- [x] Validate, relaunch, commit, and push.

## Next Scope-Aware CLI Runner Dry-Run Contracts

- [x] Add active project and portfolio scope context to CLI runner dry-run payloads.
- [x] Hold dry-run contracts when scope is missing or the active project does not match the selected work order.
- [x] Persist scope metadata into dry-run snapshots and snapshot drift summaries.
- [x] Pass dashboard scope through dry-run copy, snapshot, drift, baseline, and run-linked contract actions.
- [x] Validate, relaunch, commit, and push.

## Next Server-Side Agent Execution Scope Guard

- [x] Add a shared server-side Agent Execution scope guard for work-order mutations.
- [x] Reject missing active scope unless portfolio mode is explicitly selected.
- [x] Reject project-scoped work-order mutations whose target project differs from the active project.
- [x] Pass dashboard scope metadata through create, batch, patch, refresh, retention, and SLA mutation calls.
- [x] Add parser and server test coverage for required-scope and mismatch failures.
- [x] Validate, relaunch, commit, and push.

## Next Server-Side CLI Bridge Evidence Scope Guard

- [x] Guard CLI bridge handoff creation, handoff review, runner result intake, follow-up work-order queueing, and run-trace snapshots.
- [x] Guard execution-result checkpoint mutations used to approve retry, archive, retention, SLA, and baseline-refresh actions.
- [x] Pass dashboard scope metadata through all guarded CLI bridge and execution-result evidence controls.
- [x] Add required-scope and mismatch coverage for direct CLI bridge evidence API calls.
- [x] Validate, relaunch, commit, and push.
