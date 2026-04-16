// @ts-check

/**
 * @typedef {import("./dashboard-types.js").AuditPayload} AuditPayload
 * @typedef {import("./dashboard-types.js").DashboardState} DashboardState
 * @typedef {import("./dashboard-types.js").AuditProject} AuditProject
 */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   description: string,
 *   category: string,
 *   keywords?: string[],
 *   run: () => void | Promise<void>
 * }} DashboardAction
 */

/**
 * @param {{
 *   getData: () => AuditPayload,
 *   getState: () => DashboardState,
 *   handlers: {
 *     setView: (view: DashboardState["view"]) => void,
 *     runAuditRefresh: () => Promise<void>,
 *     refreshFindings: () => Promise<void>,
 *     refreshTrends: () => Promise<void>,
 *     refreshSources: () => Promise<void>,
 *     copySourcesSummary: () => Promise<void>,
 *     copySourcesAccessRequirements: () => Promise<void>,
 *     copySourcesAccessMethodRegistry: () => Promise<void>,
 *     copySourcesAccessValidationWorkflow: () => Promise<void>,
 *     saveSourcesAccessValidationWorkflowSnapshot: () => Promise<void>,
 *     copyLatestSourcesAccessValidationWorkflowSnapshotDrift: () => Promise<void>,
 *     checkpointSourcesAccessValidationWorkflowTasks: (status: "deferred" | "dismissed") => Promise<void>,
 *     seedSourcesAccessValidationWorkflowTasks: () => Promise<void>,
 *     copySourcesAccessChecklist: () => Promise<void>,
 *     copySourcesAccessValidationRunbook: () => Promise<void>,
 *     copySourcesAccessValidationEvidence: () => Promise<void>,
 *     copySourcesAccessValidationEvidenceCoverage: () => Promise<void>,
 *     copySourcesDeploymentHealth: () => Promise<void>,
 *     copySourcesDeploymentSmokeChecks: () => Promise<void>,
 *     copySourcesAccessMatrix: () => Promise<void>,
 *     copySourcesAccessReviewQueue: () => Promise<void>,
 *     copySourcesAccessGate: () => Promise<void>,
 *     saveSourcesSummarySnapshot: () => Promise<void>,
 *     copyLatestSourcesSummarySnapshotDrift: () => Promise<void>,
 *     refreshGovernance: () => Promise<void>,
 *     openSetupModal: () => void,
 *     openSettings: () => void,
 *     focusSearch: () => void,
 *     exportCsv: () => void,
 *     exportJson: () => void,
 *     exportMarkdown: () => void,
 *     exportGovernanceReport: () => Promise<void>,
 *     copyGovernanceSummary: () => Promise<void>,
 *     copyGovernanceTaskUpdateLedger: () => Promise<void>,
 *     saveGovernanceTaskUpdateLedgerSnapshot: () => Promise<void>,
 *     copyLatestGovernanceTaskUpdateLedgerSnapshotDrift: () => Promise<void>,
 *     copyGovernanceDataSourcesAccessGate: () => Promise<void>,
 *     copyGovernanceDataSourcesAccessReviewQueue: () => Promise<void>,
 *     copyGovernanceDataSourcesAccessValidationEvidence: () => Promise<void>,
 *     copyGovernanceDataSourcesAccessValidationWorkflow: () => Promise<void>,
 *     saveGovernanceDataSourcesAccessValidationWorkflowSnapshot: () => Promise<void>,
 *     copyGovernanceDataSourcesAccessValidationWorkflowSnapshotDrift: () => Promise<void>,
 *     checkpointGovernanceDataSourcesAccessValidationWorkflowTasks: (status: "deferred" | "dismissed") => Promise<void>,
 *     seedGovernanceDataSourcesAccessValidationWorkflowTasks: () => Promise<void>,
 *     checkpointGovernanceDataSourcesAccessReviewTasks: (status: "deferred" | "dismissed") => Promise<void>,
 *     seedGovernanceDataSourcesAccessReviewTasks: () => Promise<void>,
 *     checkpointGovernanceDataSourcesAccessValidationEvidenceCoverageTasks: (status: "deferred" | "dismissed") => Promise<void>,
 *     seedGovernanceDataSourcesAccessValidationEvidenceCoverageTasks: () => Promise<void>,
 *     copyGovernanceDataSourcesAccessTaskLedger: () => Promise<void>,
 *     saveDataSourcesAccessTaskLedgerSnapshot: () => Promise<void>,
 *     copyLatestDataSourcesAccessTaskLedgerSnapshotDrift: () => Promise<void>,
 *     saveDataSourcesAccessValidationEvidenceSnapshot: () => Promise<void>,
 *     copyLatestDataSourcesAccessValidationEvidenceSnapshotDrift: () => Promise<void>,
 *     copyAgentWorkOrders: () => Promise<void>,
 *     copyAgentExecutionBriefs: () => Promise<void>,
 *     copyAgentControlPlane: () => Promise<void>,
 *     copyReleaseControl: () => Promise<void>,
 *     copyReleaseCheckpointDrift: () => Promise<void>,
 *     copyReleaseBuildGate: () => Promise<void>,
 *     copyGovernanceReleaseTaskLedger: () => Promise<void>,
 *     saveReleaseTaskLedgerSnapshot: () => Promise<void>,
 *     copyLatestReleaseTaskLedgerSnapshotDrift: () => Promise<void>,
 *     bootstrapReleaseBuildGateLocalEvidence: () => Promise<void>,
 *     seedReleaseBuildGateActionTasks: () => Promise<void>,
 *     seedReleaseBuildGateActionTasksWithSnapshot: () => Promise<void>,
 *     saveReleaseCheckpoint: () => Promise<void>,
 *     copyLatestAgentControlPlaneSnapshotDrift: () => Promise<void>,
 *     copyBaselineAgentControlPlaneSnapshotDrift: () => Promise<void>,
 *     copyAgentControlPlaneBaselineStatus: () => Promise<void>,
 *     copyAgentControlPlaneDecision: () => Promise<void>,
 *     copyAgentControlPlaneDecisionTaskLedger: () => Promise<void>,
 *     saveAgentControlPlaneDecisionTaskLedgerSnapshot: () => Promise<void>,
 *     copyLatestAgentControlPlaneDecisionTaskLedgerSnapshotDrift: () => Promise<void>,
 *     copyAgentExecutionResultTaskLedger: () => Promise<void>,
 *     saveAgentExecutionResultTaskLedgerSnapshot: () => Promise<void>,
 *     copyLatestAgentExecutionResultTaskLedgerSnapshotDrift: () => Promise<void>,
 *     seedAgentControlPlaneDecisionTasks: () => Promise<void>,
 *     seedAgentControlPlaneDecisionTasksWithSnapshot: () => Promise<void>,
 *     clearAgentControlPlaneBaselineSnapshot: () => Promise<void>,
 *     refreshAgentControlPlaneBaselineSnapshot: () => Promise<void>,
 *     copySlaBreachLedger: () => Promise<void>,
 *     copyAgentExecutionTargetBaselineAuditLedger: () => Promise<void>,
 *     copyLatestAgentExecutionTargetBaselineAuditLedgerSnapshotDrift: () => Promise<void>,
 *     createLatestAgentExecutionTargetBaselineAuditLedgerSnapshotDriftTask: () => Promise<void>,
 *     saveAgentControlPlaneSnapshot: () => Promise<void>,
 *     saveAgentControlPlaneDecisionSnapshot: () => Promise<void>,
 *     saveAgentControlPlaneBaselineSnapshot: () => Promise<void>,
 *     saveAgentWorkOrderSnapshot: () => Promise<void>,
 *     saveSlaLedgerSnapshot: () => Promise<void>,
 *     saveAgentExecutionTargetBaselineAuditLedgerSnapshot: () => Promise<void>,
 *     refreshAgentExecutionTargetBaselineAuditLedgerSnapshot: () => Promise<void>,
 *     seedGovernanceProfiles: () => Promise<void>,
 *     seedGovernanceStarterPacks: () => Promise<void>,
 *     refreshGovernanceProfileTargets: () => Promise<void>,
 *     seedGovernanceProfileTargetTasks: () => Promise<void>,
 *     copyGovernanceProfileTargetTaskLedger: () => Promise<void>,
 *     saveGovernanceProfileTargetTaskLedgerSnapshot: () => Promise<void>,
 *     copyLatestGovernanceProfileTargetTaskLedgerSnapshotDrift: () => Promise<void>,
 *     refreshGovernanceProfileTargetTaskLedgerSnapshot: () => Promise<void>,
 *     executeGovernanceQueue: () => Promise<void>,
 *     suppressGovernanceQueue: () => Promise<void>,
 *     startQueuedAgentWorkOrderRuns: () => Promise<void>,
 *     refreshTargetBaselineAgentWorkOrderRuns: () => Promise<void>,
 *     blockStaleAgentWorkOrderRuns: () => Promise<void>,
 *     actionSlaBreaches: () => Promise<void>,
 *     resolveSlaBreaches: () => Promise<void>,
 *     retryTerminalAgentWorkOrderRuns: () => Promise<void>,
 *     archiveCompletedAgentWorkOrderRuns: () => Promise<void>,
 *     applyAgentExecutionRetention: () => Promise<void>,
 *     saveGovernanceExecutionView: () => Promise<void>,
 *     saveAgentExecutionPolicy: () => Promise<void>,
 *     setArchivedVisibility: (showArchived: boolean) => void,
 *     openProject: (projectId: string) => void
 *   }
 * }} options
 */
export function createDashboardActionRegistry({ getData, getState, handlers }) {
  /**
   * @returns {DashboardAction[]}
   */
  function createStaticActions() {
    const state = getState();

    return [
      {
        id: "view-grid",
        label: "Open cards view",
        description: "Browse the portfolio as project cards.",
        category: "Navigate",
        keywords: ["grid", "cards", "portfolio"],
        run: () => handlers.setView("grid")
      },
      {
        id: "view-table",
        label: "Open list view",
        description: "Inspect the portfolio in table form.",
        category: "Navigate",
        keywords: ["table", "list"],
        run: () => handlers.setView("table")
      },
      {
        id: "view-graph",
        label: "Open graph view",
        description: "Inspect similarity and architecture relationships.",
        category: "Navigate",
        keywords: ["graph", "similarity", "architecture"],
        run: () => handlers.setView("graph")
      },
      {
        id: "view-findings",
        label: "Open findings view",
        description: "Review persisted risks, overlap candidates, and lifecycle issues.",
        category: "Navigate",
        keywords: ["findings", "risks", "issues"],
        run: () => handlers.setView("findings")
      },
      {
        id: "view-trends",
        label: "Open trends view",
        description: "Review scan history and progress over time.",
        category: "Navigate",
        keywords: ["trends", "history"],
        run: () => handlers.setView("trends")
      },
      {
        id: "view-sources",
        label: "Open sources view",
        description: "Inspect and manage tracked sources.",
        category: "Navigate",
        keywords: ["sources", "integrations"],
        run: () => handlers.setView("sources")
      },
      {
        id: "view-governance",
        label: "Open governance view",
        description: "Review decisions, milestones, workflow activity, and portfolio execution state.",
        category: "Navigate",
        keywords: ["governance", "decisions", "milestones", "workflows"],
        run: () => handlers.setView("governance")
      },
      {
        id: "refresh-audit",
        label: "Refresh audit",
        description: "Run a new workspace scan and reload the inventory.",
        category: "Actions",
        keywords: ["scan", "audit", "refresh"],
        run: () => handlers.runAuditRefresh()
      },
      {
        id: "refresh-findings",
        label: "Refresh findings",
        description: "Regenerate persisted findings from the latest inventory.",
        category: "Actions",
        keywords: ["findings", "risks", "refresh"],
        run: () => handlers.refreshFindings()
      },
      {
        id: "refresh-trends",
        label: "Refresh trends",
        description: "Reload historical snapshots from the live server.",
        category: "Actions",
        keywords: ["trends", "history", "reload"],
        run: () => handlers.refreshTrends()
      },
      {
        id: "refresh-sources",
        label: "Refresh sources",
        description: "Reload the tracked source registry.",
        category: "Actions",
        keywords: ["sources", "reload"],
        run: () => handlers.refreshSources()
      },
      {
        id: "copy-sources-summary",
        label: "Copy sources summary",
        description: "Copy the Data Sources health summary as markdown from the live source registry.",
        category: "Actions",
        keywords: ["sources", "data sources", "copy", "summary", "markdown", "handoff"],
        run: () => handlers.copySourcesSummary()
      },
      {
        id: "copy-sources-access-requirements",
        label: "Copy sources access requirements",
        description: "Copy non-secret credential, certificate, SSH, OAuth, and filesystem access requirements for tracked sources.",
        category: "Actions",
        keywords: ["sources", "data sources", "access", "credentials", "certificates", "ssh", "tokens", "copy"],
        run: () => handlers.copySourcesAccessRequirements()
      },
      {
        id: "copy-sources-access-method-registry",
        label: "Copy sources access registry",
        description: "Copy the non-secret access method registry for local paths, Git remotes, private repositories, certificates, SSH keys, provider tokens, and manual source access.",
        category: "Actions",
        keywords: ["sources", "data sources", "access", "registry", "git", "github", "private repositories", "certificates", "ssh", "manual", "copy"],
        run: () => handlers.copySourcesAccessMethodRegistry()
      },
      {
        id: "copy-sources-access-validation-workflow",
        label: "Copy sources validation workflow",
        description: "Copy the non-secret source access validation workflow with pending evidence, external access blockers, and operator-side validation stages.",
        category: "Actions",
        keywords: ["sources", "data sources", "access", "validation", "workflow", "blockers", "credentials", "copy"],
        run: () => handlers.copySourcesAccessValidationWorkflow()
      },
      {
        id: "save-sources-access-validation-workflow-snapshot",
        label: "Save sources validation workflow snapshot",
        description: "Persist the non-secret source access validation workflow as a reload-safe baseline.",
        category: "Actions",
        keywords: ["sources", "data sources", "access", "validation", "workflow", "snapshot", "baseline", "save"],
        run: () => handlers.saveSourcesAccessValidationWorkflowSnapshot()
      },
      {
        id: "copy-latest-sources-access-validation-workflow-drift",
        label: "Copy sources validation workflow drift",
        description: "Copy markdown drift between the latest saved validation workflow snapshot and the live workflow.",
        category: "Actions",
        keywords: ["sources", "data sources", "access", "validation", "workflow", "snapshot", "drift", "diff", "copy"],
        run: () => handlers.copyLatestSourcesAccessValidationWorkflowSnapshotDrift()
      },
      {
        id: "seed-sources-access-validation-workflow-tasks",
        label: "Seed sources validation workflow tasks",
        description: "Create deduplicated non-secret Data Sources tasks from pending or blocked validation workflow items.",
        category: "Actions",
        keywords: ["sources", "data sources", "access", "validation", "workflow", "tasks", "seed", "blockers"],
        run: () => handlers.seedSourcesAccessValidationWorkflowTasks()
      },
      {
        id: "defer-sources-access-validation-workflow-tasks",
        label: "Defer sources validation workflow tasks",
        description: "Record a non-secret checkpoint that defers the generated validation workflow task batch.",
        category: "Actions",
        keywords: ["sources", "data sources", "access", "validation", "workflow", "tasks", "defer", "checkpoint"],
        run: () => handlers.checkpointSourcesAccessValidationWorkflowTasks("deferred")
      },
      {
        id: "dismiss-sources-access-validation-workflow-tasks",
        label: "Dismiss sources validation workflow tasks",
        description: "Record a non-secret checkpoint that dismisses the generated validation workflow task batch.",
        category: "Actions",
        keywords: ["sources", "data sources", "access", "validation", "workflow", "tasks", "dismiss", "checkpoint"],
        run: () => handlers.checkpointSourcesAccessValidationWorkflowTasks("dismissed")
      },
      {
        id: "copy-sources-access-checklist",
        label: "Copy sources access checklist",
        description: "Copy the actionable non-secret access checklist for tracked Data Sources.",
        category: "Actions",
        keywords: ["sources", "data sources", "access", "checklist", "credentials", "validation", "copy"],
        run: () => handlers.copySourcesAccessChecklist()
      },
      {
        id: "copy-sources-access-validation-runbook",
        label: "Copy sources access runbook",
        description: "Copy method-level source access validation steps without exposing secrets.",
        category: "Actions",
        keywords: ["sources", "data sources", "access", "runbook", "validation", "credentials", "copy"],
        run: () => handlers.copySourcesAccessValidationRunbook()
      },
      {
        id: "copy-sources-access-validation-evidence",
        label: "Copy sources access evidence",
        description: "Copy non-secret source access validation evidence records as a markdown ledger.",
        category: "Actions",
        keywords: ["sources", "data sources", "access", "evidence", "validation", "credentials", "copy"],
        run: () => handlers.copySourcesAccessValidationEvidence()
      },
      {
        id: "copy-sources-access-validation-evidence-coverage",
        label: "Copy sources evidence coverage",
        description: "Copy which tracked sources still need non-secret source access validation evidence.",
        category: "Actions",
        keywords: ["sources", "data sources", "access", "evidence", "coverage", "validation", "copy"],
        run: () => handlers.copySourcesAccessValidationEvidenceCoverage()
      },
      {
        id: "copy-sources-deployment-health",
        label: "Copy sources deployment health",
        description: "Copy detected app deployment targets and smoke-check policy as markdown.",
        category: "Actions",
        keywords: ["sources", "data sources", "deployments", "vercel", "smoke", "health", "copy"],
        run: () => handlers.copySourcesDeploymentHealth()
      },
      {
        id: "copy-sources-deployment-smoke-checks",
        label: "Copy deployment smoke ledger",
        description: "Copy recent deployment smoke-check results as a non-secret markdown ledger.",
        category: "Actions",
        keywords: ["sources", "data sources", "deployments", "vercel", "smoke", "ledger", "copy"],
        run: () => handlers.copySourcesDeploymentSmokeChecks()
      },
      {
        id: "copy-sources-access-matrix",
        label: "Copy sources access matrix",
        description: "Copy the grouped non-secret source access matrix by access method and credential signal.",
        category: "Actions",
        keywords: ["sources", "data sources", "access", "matrix", "credentials", "certificates", "methods", "copy"],
        run: () => handlers.copySourcesAccessMatrix()
      },
      {
        id: "copy-sources-access-review-queue",
        label: "Copy sources access review queue",
        description: "Copy non-secret review queue items for sources that need credential, certificate, SSH, or manual access checks.",
        category: "Actions",
        keywords: ["sources", "data sources", "access", "review", "queue", "credentials", "certificates", "copy"],
        run: () => handlers.copySourcesAccessReviewQueue()
      },
      {
        id: "copy-sources-access-gate",
        label: "Copy sources access gate",
        description: "Copy the ready/review/hold access gate for Data Sources ingestion.",
        category: "Actions",
        keywords: ["sources", "data sources", "access", "gate", "decision", "ingestion", "copy"],
        run: () => handlers.copySourcesAccessGate()
      },
      {
        id: "save-sources-summary-snapshot",
        label: "Save sources summary snapshot",
        description: "Persist the current Data Sources health summary for reload-safe audit history.",
        category: "Actions",
        keywords: ["sources", "data sources", "snapshot", "save", "history", "health"],
        run: () => handlers.saveSourcesSummarySnapshot()
      },
      {
        id: "copy-latest-sources-summary-drift",
        label: "Copy latest sources summary drift",
        description: "Copy a markdown drift report comparing the latest saved Data Sources snapshot to the live registry.",
        category: "Actions",
        keywords: ["sources", "data sources", "snapshot", "drift", "diff", "copy"],
        run: () => handlers.copyLatestSourcesSummarySnapshotDrift()
      },
      {
        id: "refresh-governance",
        label: "Refresh governance",
        description: "Reload the persisted governance rollup from the live store.",
        category: "Actions",
        keywords: ["governance", "decisions", "workflow", "milestones"],
        run: () => handlers.refreshGovernance()
      },
      {
        id: "open-source-setup",
        label: "Open source setup",
        description: "Launch the guided source onboarding flow.",
        category: "Actions",
        keywords: ["source", "setup", "onboarding", "connect"],
        run: () => handlers.openSetupModal()
      },
      {
        id: "open-settings",
        label: "Open settings",
        description: "Inspect workspace diagnostics, sources, and runtime state.",
        category: "Actions",
        keywords: ["settings", "diagnostics", "workspace"],
        run: () => handlers.openSettings()
      },
      {
        id: "focus-search",
        label: "Focus search",
        description: "Move the cursor to the main inventory search input.",
        category: "Actions",
        keywords: ["search", "filter"],
        run: () => handlers.focusSearch()
      },
      {
        id: "toggle-archived",
        label: state.showArchived ? "Hide archived projects" : "Show archived projects",
        description: state.showArchived
          ? "Filter archived projects out of the current portfolio view."
          : "Include archived projects in the current portfolio view.",
        category: "Filters",
        keywords: ["archived", "filter"],
        run: () => handlers.setArchivedVisibility(!state.showArchived)
      },
      {
        id: "export-csv",
        label: "Export inventory CSV",
        description: "Export the current filtered view as CSV.",
        category: "Actions",
        keywords: ["export", "csv", "download"],
        run: () => handlers.exportCsv()
      },
      {
        id: "export-json",
        label: "Export inventory JSON",
        description: "Export the current filtered portfolio with runtime surfaces, findings signals, and similarity metadata as JSON.",
        category: "Actions",
        keywords: ["export", "json", "download", "portfolio", "inventory"],
        run: () => handlers.exportJson()
      },
      {
        id: "export-markdown",
        label: "Export inventory Markdown",
        description: "Export the current filtered portfolio as a readable Markdown executive summary.",
        category: "Actions",
        keywords: ["export", "markdown", "md", "executive", "summary", "portfolio"],
        run: () => handlers.exportMarkdown()
      },
      {
        id: "export-governance-report",
        label: "Export governance report",
        description: "Download the current filtered governance view as markdown.",
        category: "Actions",
        keywords: ["governance", "export", "report", "markdown"],
        run: () => handlers.exportGovernanceReport()
      },
      {
        id: "copy-governance-summary",
        label: "Copy governance summary",
        description: "Copy a concise governance summary for the current filtered view.",
        category: "Actions",
        keywords: ["governance", "copy", "summary"],
        run: () => handlers.copyGovernanceSummary()
      },
      {
        id: "copy-governance-task-update-ledger",
        label: "Copy task update audit ledger",
        description: "Copy the non-secret Governance task update audit ledger for lifecycle status changes.",
        category: "Actions",
        keywords: ["governance", "tasks", "update", "audit", "ledger", "lifecycle", "copy"],
        run: () => handlers.copyGovernanceTaskUpdateLedger()
      },
      {
        id: "save-governance-task-update-ledger-snapshot",
        label: "Save task update audit snapshot",
        description: "Persist the current Governance task update audit ledger as a non-secret snapshot.",
        category: "Actions",
        keywords: ["governance", "tasks", "update", "audit", "ledger", "snapshot", "save"],
        run: () => handlers.saveGovernanceTaskUpdateLedgerSnapshot()
      },
      {
        id: "copy-latest-governance-task-update-ledger-drift",
        label: "Copy task update audit drift",
        description: "Copy the drift report comparing the latest Governance task update audit ledger snapshot to live task updates.",
        category: "Actions",
        keywords: ["governance", "tasks", "update", "audit", "ledger", "snapshot", "drift", "copy"],
        run: () => handlers.copyLatestGovernanceTaskUpdateLedgerSnapshotDrift()
      },
      {
        id: "copy-governance-data-sources-access-gate",
        label: "Copy governance source access gate",
        description: "Copy the current filtered Governance Data Sources access gate as a non-secret markdown handoff.",
        category: "Actions",
        keywords: ["governance", "sources", "data sources", "access", "gate", "decision", "handoff", "copy"],
        run: () => handlers.copyGovernanceDataSourcesAccessGate()
      },
      {
        id: "copy-governance-data-sources-access-review-queue",
        label: "Copy governance source access queue",
        description: "Copy the current filtered Governance Data Sources access review queue as a non-secret markdown handoff.",
        category: "Actions",
        keywords: ["governance", "sources", "data sources", "access", "review", "queue", "handoff", "copy"],
        run: () => handlers.copyGovernanceDataSourcesAccessReviewQueue()
      },
      {
        id: "copy-governance-data-sources-access-validation-evidence",
        label: "Copy source access evidence",
        description: "Copy the non-secret Data Sources access validation evidence ledger from Governance.",
        category: "Actions",
        keywords: ["governance", "sources", "data sources", "access", "evidence", "validation", "handoff", "copy"],
        run: () => handlers.copyGovernanceDataSourcesAccessValidationEvidence()
      },
      {
        id: "copy-governance-data-sources-access-validation-workflow",
        label: "Copy source validation workflow",
        description: "Copy the non-secret Data Sources access validation workflow from Governance.",
        category: "Actions",
        keywords: ["governance", "sources", "data sources", "access", "validation", "workflow", "handoff", "copy"],
        run: () => handlers.copyGovernanceDataSourcesAccessValidationWorkflow()
      },
      {
        id: "save-governance-data-sources-access-validation-workflow-snapshot",
        label: "Save source validation workflow snapshot",
        description: "Persist the current non-secret Data Sources access validation workflow as a Governance baseline.",
        category: "Actions",
        keywords: ["governance", "sources", "data sources", "access", "validation", "workflow", "snapshot", "baseline", "save"],
        run: () => handlers.saveGovernanceDataSourcesAccessValidationWorkflowSnapshot()
      },
      {
        id: "copy-governance-data-sources-access-validation-workflow-drift",
        label: "Copy source validation workflow drift",
        description: "Copy markdown drift between the latest saved validation workflow snapshot and the live workflow from Governance.",
        category: "Actions",
        keywords: ["governance", "sources", "data sources", "access", "validation", "workflow", "snapshot", "drift", "copy"],
        run: () => handlers.copyGovernanceDataSourcesAccessValidationWorkflowSnapshotDrift()
      },
      {
        id: "seed-governance-data-sources-access-validation-workflow-tasks",
        label: "Seed source validation workflow tasks",
        description: "Create deduplicated non-secret Data Sources tasks from pending or blocked validation workflow items without leaving Governance.",
        category: "Actions",
        keywords: ["governance", "sources", "data sources", "access", "validation", "workflow", "tasks", "seed", "snapshot"],
        run: () => handlers.seedGovernanceDataSourcesAccessValidationWorkflowTasks()
      },
      {
        id: "defer-governance-data-sources-access-validation-workflow-tasks",
        label: "Defer source validation workflow tasks",
        description: "Record a Governance checkpoint that defers the generated source validation workflow task batch.",
        category: "Actions",
        keywords: ["governance", "sources", "data sources", "access", "validation", "workflow", "tasks", "defer", "checkpoint"],
        run: () => handlers.checkpointGovernanceDataSourcesAccessValidationWorkflowTasks("deferred")
      },
      {
        id: "dismiss-governance-data-sources-access-validation-workflow-tasks",
        label: "Dismiss source validation workflow tasks",
        description: "Record a Governance checkpoint that dismisses the generated source validation workflow task batch.",
        category: "Actions",
        keywords: ["governance", "sources", "data sources", "access", "validation", "workflow", "tasks", "dismiss", "checkpoint"],
        run: () => handlers.checkpointGovernanceDataSourcesAccessValidationWorkflowTasks("dismissed")
      },
      {
        id: "seed-governance-data-sources-access-review-tasks",
        label: "Seed source access tasks",
        description: "Create deduplicated Governance tasks from the visible Data Sources access review queue.",
        category: "Actions",
        keywords: ["governance", "sources", "data sources", "access", "review", "queue", "tasks", "seed"],
        run: () => handlers.seedGovernanceDataSourcesAccessReviewTasks()
      },
      {
        id: "defer-governance-data-sources-access-review-tasks",
        label: "Defer source access tasks",
        description: "Record a Governance checkpoint that defers the generated source access review task batch.",
        category: "Actions",
        keywords: ["governance", "sources", "data sources", "access", "review", "queue", "tasks", "defer", "checkpoint"],
        run: () => handlers.checkpointGovernanceDataSourcesAccessReviewTasks("deferred")
      },
      {
        id: "dismiss-governance-data-sources-access-review-tasks",
        label: "Dismiss source access tasks",
        description: "Record a Governance checkpoint that dismisses the generated source access review task batch.",
        category: "Actions",
        keywords: ["governance", "sources", "data sources", "access", "review", "queue", "tasks", "dismiss", "checkpoint"],
        run: () => handlers.checkpointGovernanceDataSourcesAccessReviewTasks("dismissed")
      },
      {
        id: "seed-governance-data-sources-evidence-coverage-tasks",
        label: "Seed source evidence coverage tasks",
        description: "Create Data Sources tasks for missing, review, or blocked source-access evidence coverage gaps.",
        category: "Actions",
        keywords: ["governance", "sources", "data sources", "access", "evidence", "coverage", "tasks", "seed"],
        run: () => handlers.seedGovernanceDataSourcesAccessValidationEvidenceCoverageTasks()
      },
      {
        id: "defer-governance-data-sources-evidence-coverage-tasks",
        label: "Defer source evidence coverage tasks",
        description: "Record a Governance checkpoint that defers the generated source evidence coverage task batch.",
        category: "Actions",
        keywords: ["governance", "sources", "data sources", "access", "evidence", "coverage", "tasks", "defer", "checkpoint"],
        run: () => handlers.checkpointGovernanceDataSourcesAccessValidationEvidenceCoverageTasks("deferred")
      },
      {
        id: "dismiss-governance-data-sources-evidence-coverage-tasks",
        label: "Dismiss source evidence coverage tasks",
        description: "Record a Governance checkpoint that dismisses the generated source evidence coverage task batch.",
        category: "Actions",
        keywords: ["governance", "sources", "data sources", "access", "evidence", "coverage", "tasks", "dismiss", "checkpoint"],
        run: () => handlers.checkpointGovernanceDataSourcesAccessValidationEvidenceCoverageTasks("dismissed")
      },
      {
        id: "copy-governance-data-sources-access-task-ledger",
        label: "Copy source access task ledger",
        description: "Copy the current filtered Data Sources access task ledger as a non-secret markdown handoff.",
        category: "Actions",
        keywords: ["governance", "sources", "data sources", "access", "tasks", "ledger", "handoff", "copy"],
        run: () => handlers.copyGovernanceDataSourcesAccessTaskLedger()
      },
      {
        id: "copy-agent-work-orders",
        label: "Copy agent work orders",
        description: "Copy supervised agent work orders from the current readiness matrix.",
        category: "Actions",
        keywords: ["governance", "agent", "work orders", "readiness", "copy"],
        run: () => handlers.copyAgentWorkOrders()
      },
      {
        id: "copy-agent-execution-briefs",
        label: "Copy agent execution briefs",
        description: "Copy single-run execution briefs for all currently visible Agent Execution runs.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "brief", "handoff", "copy"],
        run: () => handlers.copyAgentExecutionBriefs()
      },
      {
        id: "copy-agent-control-plane",
        label: "Copy agent control plane",
        description: "Copy the consolidated agent control-plane payload as markdown from the live API.",
        category: "Actions",
        keywords: ["governance", "agent", "control plane", "platform", "handoff", "copy"],
        run: () => handlers.copyAgentControlPlane()
      },
      {
        id: "copy-release-control",
        label: "Copy release control",
        description: "Copy current Git, deployment smoke, and validation state as a release-control markdown handoff.",
        category: "Actions",
        keywords: ["governance", "release", "deployment", "git", "vercel", "smoke", "copy"],
        run: () => handlers.copyReleaseControl()
      },
      {
        id: "copy-release-checkpoint-drift",
        label: "Copy release checkpoint drift",
        description: "Copy a markdown drift report comparing the latest saved release checkpoint to live release state.",
        category: "Actions",
        keywords: ["governance", "release", "checkpoint", "deployment", "git", "smoke", "drift", "copy"],
        run: () => handlers.copyReleaseCheckpointDrift()
      },
      {
        id: "copy-release-build-gate",
        label: "Copy release build gate",
        description: "Copy the release build gate decision for the next local unattended build pass.",
        category: "Actions",
        keywords: ["governance", "release", "build", "gate", "decision", "deployment", "git", "smoke", "copy"],
        run: () => handlers.copyReleaseBuildGate()
      },
      {
        id: "copy-governance-release-task-ledger",
        label: "Copy release task ledger",
        description: "Copy the current filtered Release Control task ledger as a non-secret markdown handoff.",
        category: "Actions",
        keywords: ["governance", "release", "tasks", "ledger", "build", "gate", "handoff", "copy"],
        run: () => handlers.copyGovernanceReleaseTaskLedger()
      },
      {
        id: "save-release-task-ledger-snapshot",
        label: "Save release task ledger snapshot",
        description: "Persist the current Release Control task ledger as a non-secret handoff snapshot.",
        category: "Actions",
        keywords: ["governance", "release", "tasks", "ledger", "build", "gate", "snapshot", "save"],
        run: () => handlers.saveReleaseTaskLedgerSnapshot()
      },
      {
        id: "copy-latest-release-task-ledger-drift",
        label: "Copy release task ledger drift",
        description: "Copy the drift report comparing the latest Release Control task ledger snapshot to live tasks.",
        category: "Actions",
        keywords: ["governance", "release", "tasks", "ledger", "build", "gate", "snapshot", "drift", "copy"],
        run: () => handlers.copyLatestReleaseTaskLedgerSnapshotDrift()
      },
      {
        id: "bootstrap-release-build-gate-local-evidence",
        label: "Bootstrap release gate evidence",
        description: "Run a local app smoke check and save a non-secret release checkpoint without updating Vercel.",
        category: "Actions",
        keywords: ["governance", "release", "build", "gate", "local", "smoke", "checkpoint", "evidence"],
        run: () => handlers.bootstrapReleaseBuildGateLocalEvidence()
      },
      {
        id: "seed-release-build-gate-action-tasks",
        label: "Seed release gate tasks",
        description: "Create deduplicated Governance tasks from open Release Build Gate actions.",
        category: "Actions",
        keywords: ["governance", "release", "build", "gate", "tasks", "seed"],
        run: () => handlers.seedReleaseBuildGateActionTasks()
      },
      {
        id: "seed-release-build-gate-action-tasks-with-snapshot",
        label: "Seed release gate tasks and snapshot",
        description: "Create deduplicated Release Build Gate tasks and auto-capture the Release Control task ledger.",
        category: "Actions",
        keywords: ["governance", "release", "build", "gate", "tasks", "seed", "snapshot", "ledger"],
        run: () => handlers.seedReleaseBuildGateActionTasksWithSnapshot()
      },
      {
        id: "save-release-checkpoint",
        label: "Save release checkpoint",
        description: "Persist the current non-secret release state for later control-plane drift review.",
        category: "Actions",
        keywords: ["governance", "release", "checkpoint", "deployment", "git", "smoke", "save"],
        run: () => handlers.saveReleaseCheckpoint()
      },
      {
        id: "copy-latest-agent-control-plane-drift",
        label: "Copy latest control plane drift",
        description: "Copy a markdown drift report comparing the latest saved Agent Control Plane snapshot to the live control plane.",
        category: "Actions",
        keywords: ["governance", "agent", "control plane", "platform", "snapshot", "drift", "copy"],
        run: () => handlers.copyLatestAgentControlPlaneSnapshotDrift()
      },
      {
        id: "copy-baseline-agent-control-plane-drift",
        label: "Copy baseline control plane drift",
        description: "Copy a markdown drift report comparing the baseline Agent Control Plane snapshot to the live control plane.",
        category: "Actions",
        keywords: ["governance", "agent", "control plane", "platform", "baseline", "drift", "copy"],
        run: () => handlers.copyBaselineAgentControlPlaneSnapshotDrift()
      },
      {
        id: "copy-agent-control-plane-baseline-status",
        label: "Copy control plane baseline status",
        description: "Copy a markdown baseline status report with drift score when a baseline is selected.",
        category: "Actions",
        keywords: ["governance", "agent", "control plane", "platform", "baseline", "status", "copy"],
        run: () => handlers.copyAgentControlPlaneBaselineStatus()
      },
      {
        id: "copy-agent-control-plane-decision",
        label: "Copy control plane decision",
        description: "Copy the ready/review/hold decision gate for the next supervised app-development build.",
        category: "Actions",
        keywords: ["governance", "agent", "control plane", "platform", "decision", "gate", "copy"],
        run: () => handlers.copyAgentControlPlaneDecision()
      },
      {
        id: "copy-agent-control-plane-decision-task-ledger",
        label: "Copy control plane decision task ledger",
        description: "Copy the non-secret ledger of Governance tasks created from Agent Control Plane decision reasons.",
        category: "Actions",
        keywords: ["governance", "agent", "control plane", "platform", "decision", "tasks", "ledger", "copy"],
        run: () => handlers.copyAgentControlPlaneDecisionTaskLedger()
      },
      {
        id: "save-agent-control-plane-decision-task-ledger-snapshot",
        label: "Save control plane decision task ledger snapshot",
        description: "Persist the current Control Plane decision task ledger as a non-secret handoff snapshot.",
        category: "Actions",
        keywords: ["governance", "agent", "control plane", "platform", "decision", "tasks", "ledger", "snapshot", "save"],
        run: () => handlers.saveAgentControlPlaneDecisionTaskLedgerSnapshot()
      },
      {
        id: "copy-latest-agent-control-plane-decision-task-ledger-drift",
        label: "Copy control plane decision task ledger drift",
        description: "Copy the drift report comparing the latest Control Plane decision task ledger snapshot to live tasks.",
        category: "Actions",
        keywords: ["governance", "agent", "control plane", "platform", "decision", "tasks", "ledger", "snapshot", "drift", "copy"],
        run: () => handlers.copyLatestAgentControlPlaneDecisionTaskLedgerSnapshotDrift()
      },
      {
        id: "copy-agent-execution-result-task-ledger",
        label: "Copy execution result task ledger",
        description: "Copy the non-secret ledger of Governance tasks created from deferred Agent Execution Result checkpoints.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "result", "tasks", "ledger", "copy"],
        run: () => handlers.copyAgentExecutionResultTaskLedger()
      },
      {
        id: "save-agent-execution-result-task-ledger-snapshot",
        label: "Save execution result task ledger snapshot",
        description: "Persist the current Agent Execution Result task ledger as a non-secret handoff snapshot.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "result", "tasks", "ledger", "snapshot", "save"],
        run: () => handlers.saveAgentExecutionResultTaskLedgerSnapshot()
      },
      {
        id: "copy-latest-agent-execution-result-task-ledger-drift",
        label: "Copy execution result task ledger drift",
        description: "Copy the drift report comparing the latest Agent Execution Result task ledger snapshot to live tasks.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "result", "tasks", "ledger", "snapshot", "drift", "copy"],
        run: () => handlers.copyLatestAgentExecutionResultTaskLedgerSnapshotDrift()
      },
      {
        id: "seed-agent-control-plane-decision-tasks",
        label: "Seed control plane decision tasks",
        description: "Create deduplicated Governance tasks from current Agent Control Plane decision reasons.",
        category: "Actions",
        keywords: ["governance", "agent", "control plane", "platform", "decision", "tasks", "seed"],
        run: () => handlers.seedAgentControlPlaneDecisionTasks()
      },
      {
        id: "seed-agent-control-plane-decision-tasks-with-snapshot",
        label: "Seed control plane decision tasks with snapshot",
        description: "Create deduplicated decision tasks and immediately persist the resulting non-secret task ledger snapshot.",
        category: "Actions",
        keywords: ["governance", "agent", "control plane", "platform", "decision", "tasks", "seed", "snapshot", "capture"],
        run: () => handlers.seedAgentControlPlaneDecisionTasksWithSnapshot()
      },
      {
        id: "clear-agent-control-plane-baseline",
        label: "Clear control plane baseline",
        description: "Clear the active Agent Control Plane baseline marker without deleting saved snapshots.",
        category: "Actions",
        keywords: ["governance", "agent", "control plane", "platform", "baseline", "clear"],
        run: () => handlers.clearAgentControlPlaneBaselineSnapshot()
      },
      {
        id: "refresh-agent-control-plane-baseline",
        label: "Refresh control plane baseline",
        description: "Persist the live Agent Control Plane as a new baseline snapshot for fresh baseline-vs-live drift.",
        category: "Actions",
        keywords: ["governance", "agent", "control plane", "platform", "baseline", "refresh", "snapshot"],
        run: () => handlers.refreshAgentControlPlaneBaselineSnapshot()
      },
      {
        id: "save-agent-control-plane-snapshot",
        label: "Save agent control plane snapshot",
        description: "Persist the consolidated Agent Control Plane payload as an auditable markdown snapshot.",
        category: "Actions",
        keywords: ["governance", "agent", "control plane", "platform", "snapshot", "save"],
        run: () => handlers.saveAgentControlPlaneSnapshot()
      },
      {
        id: "save-agent-control-plane-decision-snapshot",
        label: "Save control plane decision snapshot",
        description: "Persist the current ready/review/hold Agent Control Plane decision gate.",
        category: "Actions",
        keywords: ["governance", "agent", "control plane", "platform", "decision", "snapshot", "save"],
        run: () => handlers.saveAgentControlPlaneDecisionSnapshot()
      },
      {
        id: "save-agent-control-plane-baseline-snapshot",
        label: "Save baseline control plane snapshot",
        description: "Persist the live Agent Control Plane payload and immediately mark it as the baseline snapshot.",
        category: "Actions",
        keywords: ["governance", "agent", "control plane", "platform", "baseline", "snapshot", "save"],
        run: () => handlers.saveAgentControlPlaneBaselineSnapshot()
      },
      {
        id: "copy-sla-breach-ledger",
        label: "Copy SLA breach ledger",
        description: "Copy the currently filtered SLA Breach Ledger as markdown.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "sla", "breach", "ledger", "copy"],
        run: () => handlers.copySlaBreachLedger()
      },
      {
        id: "copy-agent-execution-target-baseline-audit-ledger",
        label: "Copy target baseline audit ledger",
        description: "Copy the non-secret Agent Execution target baseline audit ledger as markdown.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "target", "baseline", "audit", "ledger", "copy"],
        run: () => handlers.copyAgentExecutionTargetBaselineAuditLedger()
      },
      {
        id: "copy-latest-agent-execution-target-baseline-audit-ledger-snapshot-drift",
        label: "Copy target baseline audit drift",
        description: "Copy latest saved target-baseline audit ledger snapshot drift as markdown.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "target", "baseline", "audit", "ledger", "snapshot", "drift", "copy"],
        run: () => handlers.copyLatestAgentExecutionTargetBaselineAuditLedgerSnapshotDrift()
      },
      {
        id: "create-latest-agent-execution-target-baseline-audit-ledger-snapshot-drift-task",
        label: "Track target baseline audit drift",
        description: "Create a Governance task from the latest target-baseline audit ledger snapshot drift.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "target", "baseline", "audit", "ledger", "snapshot", "drift", "task", "track"],
        run: () => handlers.createLatestAgentExecutionTargetBaselineAuditLedgerSnapshotDriftTask()
      },
      {
        id: "save-sla-ledger-snapshot",
        label: "Save SLA ledger snapshot",
        description: "Persist the current SLA Breach Ledger state as an auditable markdown snapshot.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "sla", "breach", "ledger", "snapshot", "save"],
        run: () => handlers.saveSlaLedgerSnapshot()
      },
      {
        id: "save-agent-execution-target-baseline-audit-ledger-snapshot",
        label: "Save target baseline audit snapshot",
        description: "Persist the Agent Execution target baseline audit ledger as a markdown snapshot.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "target", "baseline", "audit", "ledger", "snapshot", "save"],
        run: () => handlers.saveAgentExecutionTargetBaselineAuditLedgerSnapshot()
      },
      {
        id: "refresh-agent-execution-target-baseline-audit-ledger-snapshot",
        label: "Refresh target baseline audit snapshot",
        description: "Save a refreshed Agent Execution target-baseline audit ledger snapshot from the latest saved snapshot settings.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "target", "baseline", "audit", "ledger", "snapshot", "refresh"],
        run: () => handlers.refreshAgentExecutionTargetBaselineAuditLedgerSnapshot()
      },
      {
        id: "save-data-sources-access-task-ledger-snapshot",
        label: "Save source task ledger snapshot",
        description: "Persist the Data Sources access task ledger as a non-secret markdown snapshot.",
        category: "Actions",
        keywords: ["governance", "data sources", "source access", "tasks", "ledger", "snapshot", "save"],
        run: () => handlers.saveDataSourcesAccessTaskLedgerSnapshot()
      },
      {
        id: "copy-latest-data-sources-access-task-ledger-drift",
        label: "Copy source task ledger drift",
        description: "Copy latest-vs-live drift for the Data Sources access task ledger snapshot.",
        category: "Actions",
        keywords: ["governance", "data sources", "source access", "tasks", "ledger", "snapshot", "drift", "copy"],
        run: () => handlers.copyLatestDataSourcesAccessTaskLedgerSnapshotDrift()
      },
      {
        id: "save-data-sources-access-validation-evidence-snapshot",
        label: "Save source evidence snapshot",
        description: "Persist the Data Sources access validation evidence ledger as a non-secret markdown snapshot.",
        category: "Actions",
        keywords: ["governance", "data sources", "source access", "evidence", "validation", "snapshot", "save"],
        run: () => handlers.saveDataSourcesAccessValidationEvidenceSnapshot()
      },
      {
        id: "copy-latest-data-sources-access-validation-evidence-drift",
        label: "Copy source evidence drift",
        description: "Copy latest-vs-live drift for the Data Sources access validation evidence snapshot.",
        category: "Actions",
        keywords: ["governance", "data sources", "source access", "evidence", "validation", "snapshot", "drift", "copy"],
        run: () => handlers.copyLatestDataSourcesAccessValidationEvidenceSnapshotDrift()
      },
      {
        id: "save-agent-work-order-snapshot",
        label: "Save agent work order snapshot",
        description: "Persist a supervised agent work-order snapshot from the current readiness matrix.",
        category: "Actions",
        keywords: ["governance", "agent", "work orders", "snapshot", "save"],
        run: () => handlers.saveAgentWorkOrderSnapshot()
      },
      {
        id: "seed-governance-profiles",
        label: "Seed visible governance profiles",
        description: "Create default governance profiles for the currently visible governance gaps.",
        category: "Actions",
        keywords: ["governance", "profiles", "bootstrap", "seed"],
        run: () => handlers.seedGovernanceProfiles()
      },
      {
        id: "seed-governance-starter-packs",
        label: "Seed visible governance starter packs",
        description: "Create default governance profiles, onboarding tasks, and onboarding workflows for the currently visible governance gaps.",
        category: "Actions",
        keywords: ["governance", "bootstrap", "tasks", "workflows", "starter pack"],
        run: () => handlers.seedGovernanceStarterPacks()
      },
      {
        id: "refresh-governance-profile-targets",
        label: "Refresh governance profile targets",
        description: "Refresh scan-derived test coverage and runtime targets for scoped app-development profiles.",
        category: "Actions",
        keywords: ["governance", "profiles", "coverage", "tests", "runtime", "targets", "refresh"],
        run: () => handlers.refreshGovernanceProfileTargets()
      },
      {
        id: "seed-governance-profile-target-tasks",
        label: "Seed governance profile target tasks",
        description: "Create deduplicated Governance tasks for visible profile test coverage and runtime target gaps.",
        category: "Actions",
        keywords: ["governance", "profiles", "coverage", "tests", "runtime", "targets", "tasks", "seed"],
        run: () => handlers.seedGovernanceProfileTargetTasks()
      },
      {
        id: "copy-governance-profile-target-task-ledger",
        label: "Copy profile target task ledger",
        description: "Copy the non-secret ledger of Governance tasks created from profile test and runtime target gaps.",
        category: "Actions",
        keywords: ["governance", "profiles", "coverage", "tests", "runtime", "targets", "tasks", "ledger", "copy"],
        run: () => handlers.copyGovernanceProfileTargetTaskLedger()
      },
      {
        id: "save-governance-profile-target-task-ledger-snapshot",
        label: "Save profile target task ledger snapshot",
        description: "Persist the current profile target task ledger as a non-secret snapshot baseline.",
        category: "Actions",
        keywords: ["governance", "profiles", "coverage", "tests", "runtime", "targets", "tasks", "ledger", "snapshot", "save"],
        run: () => handlers.saveGovernanceProfileTargetTaskLedgerSnapshot()
      },
      {
        id: "copy-governance-profile-target-task-ledger-drift",
        label: "Copy profile target task ledger drift",
        description: "Copy the drift report comparing the latest profile target task snapshot to live Governance target tasks.",
        category: "Actions",
        keywords: ["governance", "profiles", "coverage", "tests", "runtime", "targets", "tasks", "ledger", "snapshot", "drift", "copy"],
        run: () => handlers.copyLatestGovernanceProfileTargetTaskLedgerSnapshotDrift()
      },
      {
        id: "refresh-governance-profile-target-task-ledger-snapshot",
        label: "Refresh profile target task baseline",
        description: "Accept the live profile target task ledger as a new non-secret snapshot baseline.",
        category: "Actions",
        keywords: ["governance", "profiles", "coverage", "tests", "runtime", "targets", "tasks", "ledger", "snapshot", "baseline", "refresh"],
        run: () => handlers.refreshGovernanceProfileTargetTaskLedgerSnapshot()
      },
      {
        id: "copy-governance-profile-target-task-ledger-baseline-status",
        label: "Copy profile target task baseline status",
        description: "Copy freshness, drift health, and checkpoint coverage for the accepted profile target task baseline.",
        category: "Actions",
        keywords: ["governance", "profiles", "coverage", "tests", "runtime", "targets", "tasks", "ledger", "baseline", "status", "health", "copy"],
        run: () => handlers.copyGovernanceProfileTargetTaskLedgerBaselineStatus()
      },
      {
        id: "execute-governance-queue",
        label: "Execute visible governance queue",
        description: "Execute all currently visible queue items that can be handled automatically.",
        category: "Actions",
        keywords: ["governance", "queue", "execute", "bulk"],
        run: () => handlers.executeGovernanceQueue()
      },
      {
        id: "suppress-governance-queue",
        label: "Suppress visible governance queue",
        description: "Hide the currently visible queue items when they are intentionally deferred.",
        category: "Actions",
        keywords: ["governance", "queue", "suppress", "defer"],
        run: () => handlers.suppressGovernanceQueue()
      },
      {
        id: "start-queued-agent-execution-runs",
        label: "Start queued agent execution runs",
        description: "Start visible queued Agent Execution runs.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "queued", "start", "bulk"],
        run: () => handlers.startQueuedAgentWorkOrderRuns()
      },
      {
        id: "refresh-agent-execution-target-baselines",
        label: "Refresh agent execution target baselines",
        description: "Recapture the current profile target task baseline on visible Agent Execution runs that need baseline review.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "target", "baseline", "refresh", "bulk"],
        run: () => handlers.refreshTargetBaselineAgentWorkOrderRuns()
      },
      {
        id: "block-stale-agent-execution-runs",
        label: "Block stale agent execution runs",
        description: "Mark visible stale Agent Execution runs as blocked for review.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "stale", "block"],
        run: () => handlers.blockStaleAgentWorkOrderRuns()
      },
      {
        id: "action-sla-breach-agent-execution-runs",
        label: "Action SLA breach agent execution runs",
        description: "Record SLA breach escalation metadata on visible stale Agent Execution runs.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "sla", "breach", "escalate"],
        run: () => handlers.actionSlaBreaches()
      },
      {
        id: "resolve-sla-breach-agent-execution-runs",
        label: "Resolve SLA breach agent execution runs",
        description: "Record SLA breach resolution metadata on visible unresolved Agent Execution breaches.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "sla", "breach", "resolve", "review"],
        run: () => handlers.resolveSlaBreaches()
      },
      {
        id: "retry-terminal-agent-execution-runs",
        label: "Retry terminal agent execution runs",
        description: "Requeue visible failed or cancelled Agent Execution runs.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "retry", "failed", "cancelled"],
        run: () => handlers.retryTerminalAgentWorkOrderRuns()
      },
      {
        id: "archive-completed-agent-execution-runs",
        label: "Archive completed agent execution runs",
        description: "Archive visible passed, failed, or cancelled Agent Execution runs without deleting history.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "archive", "completed", "history"],
        run: () => handlers.archiveCompletedAgentWorkOrderRuns()
      },
      {
        id: "apply-agent-execution-retention",
        label: "Apply agent execution retention",
        description: "Archive older visible completed Agent Execution runs after retaining the configured recent count.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "retention", "archive", "completed"],
        run: () => handlers.applyAgentExecutionRetention()
      },
      {
        id: "save-governance-execution-view",
        label: "Save governance execution view",
        description: "Persist the current Governance execution filter preset for reuse.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "saved view", "filter", "preset"],
        run: () => handlers.saveGovernanceExecutionView()
      },
      {
        id: "save-agent-execution-policy",
        label: "Save agent execution SLA policy",
        description: "Persist the selected stale-run threshold for Agent Execution governance.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "sla", "policy", "stale"],
        run: () => handlers.saveAgentExecutionPolicy()
      }
    ];
  }

  /**
   * @param {AuditProject[]} projects
   * @returns {DashboardAction[]}
   */
  function createProjectActions(projects) {
    return [...projects]
      .sort((left, right) => {
        const leftActive = left.zone === "active" ? 0 : 1;
        const rightActive = right.zone === "active" ? 0 : 1;
        return leftActive - rightActive || left.name.localeCompare(right.name);
      })
      .map((project) => ({
        id: `project-${project.id}`,
        label: `Inspect ${project.name}`,
        description: `${project.category} • ${project.relPath}`,
        category: "Projects",
        keywords: [
          "project",
          "workbench",
          project.id,
          project.name,
          project.relPath,
          project.zone,
          project.category,
          ...project.frameworks,
          ...project.languages
        ],
        run: () => handlers.openProject(project.id)
      }));
  }

  return {
    /**
     * @returns {DashboardAction[]}
     */
    getActions() {
      const data = getData();
      return [
        ...createStaticActions(),
        ...createProjectActions(data.projects || [])
      ];
    }
  };
}
