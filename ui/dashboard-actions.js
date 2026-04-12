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
 *     copySourcesAccessChecklist: () => Promise<void>,
 *     copySourcesAccessValidationRunbook: () => Promise<void>,
 *     copySourcesAccessValidationEvidence: () => Promise<void>,
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
 *     exportGovernanceReport: () => Promise<void>,
 *     copyGovernanceSummary: () => Promise<void>,
 *     copyGovernanceDataSourcesAccessGate: () => Promise<void>,
 *     copyGovernanceDataSourcesAccessReviewQueue: () => Promise<void>,
 *     copyGovernanceDataSourcesAccessValidationEvidence: () => Promise<void>,
 *     seedGovernanceDataSourcesAccessReviewTasks: () => Promise<void>,
 *     seedGovernanceDataSourcesAccessValidationEvidenceCoverageTasks: () => Promise<void>,
 *     copyGovernanceDataSourcesAccessTaskLedger: () => Promise<void>,
 *     saveDataSourcesAccessTaskLedgerSnapshot: () => Promise<void>,
 *     copyLatestDataSourcesAccessTaskLedgerSnapshotDrift: () => Promise<void>,
 *     saveDataSourcesAccessValidationEvidenceSnapshot: () => Promise<void>,
 *     copyLatestDataSourcesAccessValidationEvidenceSnapshotDrift: () => Promise<void>,
 *     copyAgentWorkOrders: () => Promise<void>,
 *     copyAgentExecutionBriefs: () => Promise<void>,
 *     copyAgentControlPlane: () => Promise<void>,
 *     copyLatestAgentControlPlaneSnapshotDrift: () => Promise<void>,
 *     copyBaselineAgentControlPlaneSnapshotDrift: () => Promise<void>,
 *     copyAgentControlPlaneBaselineStatus: () => Promise<void>,
 *     copyAgentControlPlaneDecision: () => Promise<void>,
 *     clearAgentControlPlaneBaselineSnapshot: () => Promise<void>,
 *     refreshAgentControlPlaneBaselineSnapshot: () => Promise<void>,
 *     copySlaBreachLedger: () => Promise<void>,
 *     saveAgentControlPlaneSnapshot: () => Promise<void>,
 *     saveAgentControlPlaneDecisionSnapshot: () => Promise<void>,
 *     saveAgentControlPlaneBaselineSnapshot: () => Promise<void>,
 *     saveAgentWorkOrderSnapshot: () => Promise<void>,
 *     saveSlaLedgerSnapshot: () => Promise<void>,
 *     seedGovernanceProfiles: () => Promise<void>,
 *     seedGovernanceStarterPacks: () => Promise<void>,
 *     executeGovernanceQueue: () => Promise<void>,
 *     suppressGovernanceQueue: () => Promise<void>,
 *     startQueuedAgentWorkOrderRuns: () => Promise<void>,
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
        id: "seed-governance-data-sources-access-review-tasks",
        label: "Seed source access tasks",
        description: "Create deduplicated Governance tasks from the visible Data Sources access review queue.",
        category: "Actions",
        keywords: ["governance", "sources", "data sources", "access", "review", "queue", "tasks", "seed"],
        run: () => handlers.seedGovernanceDataSourcesAccessReviewTasks()
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
        id: "save-sla-ledger-snapshot",
        label: "Save SLA ledger snapshot",
        description: "Persist the current SLA Breach Ledger state as an auditable markdown snapshot.",
        category: "Actions",
        keywords: ["governance", "agent", "execution", "sla", "breach", "ledger", "snapshot", "save"],
        run: () => handlers.saveSlaLedgerSnapshot()
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
      .sort((left, right) => right.qualityScore - left.qualityScore)
      .slice(0, 12)
      .map((project) => ({
        id: `project-${project.id}`,
        label: `Inspect ${project.name}`,
        description: `${project.category} • ${project.relPath}`,
        category: "Projects",
        keywords: [project.zone, project.category, ...project.frameworks],
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
