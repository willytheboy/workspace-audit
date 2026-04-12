// @ts-check

import {
  createAppCard,
  createAppTableRow,
  createDataSourcesSummarySnapshotItem,
  createEmptyCard,
  createFindingItem,
  createGovernanceDeck,
  createGovernanceSummaryGrid,
  createKpiCard,
  createPanelNotice,
  createScanDiffBreakdown,
  createStatusPill,
  createSourceItem,
  createTrendDiffSummary,
  createTrendHistory,
  createTrendSummaryGrid,
  populateSelect
} from "./dashboard-components.js";
import { createGraphRenderer } from "./dashboard-graph.js";
import { bindAppLaunchers, getColor } from "./dashboard-utils.js";

/**
 * @typedef {import("./dashboard-types.js").AuditPayload} AuditPayload
 * @typedef {import("./dashboard-types.js").DashboardState} DashboardState
 * @typedef {import("./dashboard-types.js").DashboardRuntimeState} DashboardRuntimeState
 * @typedef {import("./dashboard-types.js").PanelRuntimeState} PanelRuntimeState
 * @typedef {import("./dashboard-types.js").AuditProject} AuditProject
 */

/**
 * @param {unknown} error
 */
function getErrorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}

/**
 * @param {import("./dashboard-types.js").PersistedAgentWorkOrderRun} run
 * @param {number} staleThresholdHours
 * @param {string[]} staleStatuses
 */
function isStaleAgentWorkOrderRun(run, staleThresholdHours = 24, staleStatuses = ["queued", "running", "blocked"]) {
  if (!staleStatuses.includes(run.status)) return false;
  const timestamp = new Date(run.updatedAt || run.createdAt).getTime();
  return Number.isFinite(timestamp) && timestamp < Date.now() - (staleThresholdHours * 60 * 60 * 1000);
}

/**
 * @param {string} message
 */
function createEmptyTableRow(message) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 6;
  cell.style.padding = "1.5rem";
  cell.style.color = "var(--text-muted)";
  cell.textContent = message;
  row.append(cell);
  return row;
}

/**
 * @param {{
 *   getData: () => AuditPayload,
 *   getState: () => DashboardState,
 *   getRuntime: () => DashboardRuntimeState,
 *   api: {
 *     fetchFindings: () => Promise<import("./dashboard-types.js").PersistedFinding[]>,
 *     refreshFindings: () => Promise<{ success: true, findings: import("./dashboard-types.js").PersistedFinding[] }>,
 *     fetchHistory: () => Promise<Array<{ date: string, summary: import("./dashboard-types.js").AuditSummary }>>,
 *     fetchScanDiff: () => Promise<import("./dashboard-types.js").ScanDiffPayload>,
 *     fetchSources: () => Promise<Array<{ type: string, url?: string, path?: string, addedAt?: string }>>,
 *     fetchSourcesSummary: () => Promise<import("./dashboard-types.js").DataSourcesSummaryPayload>,
 *     fetchSourcesAccessRequirements: () => Promise<import("./dashboard-types.js").DataSourcesAccessRequirementsPayload>,
 *     fetchSourcesAccessChecklist: () => Promise<import("./dashboard-types.js").DataSourcesAccessChecklistPayload>,
 *     fetchSourcesAccessValidationRunbook: () => Promise<import("./dashboard-types.js").DataSourcesAccessValidationRunbookPayload>,
 *     fetchSourcesAccessValidationEvidence: (options?: { status?: "all" | "validated" | "review" | "blocked", sourceId?: string, accessMethod?: string, limit?: number }) => Promise<import("./dashboard-types.js").DataSourcesAccessValidationEvidencePayload>,
 *     fetchSourcesAccessValidationEvidenceCoverage: () => Promise<import("./dashboard-types.js").DataSourcesAccessValidationEvidenceCoveragePayload>,
 *     fetchDeploymentHealth: () => Promise<import("./dashboard-types.js").DeploymentHealthPayload>,
 *     fetchDeploymentSmokeChecks: () => Promise<import("./dashboard-types.js").DeploymentSmokeChecksPayload>,
 *     runDeploymentSmokeCheck: (payload: { url?: string, targetId?: string, label?: string, allowLocal?: boolean, timeoutMs?: number }) => Promise<{ success: true, smokeCheck: import("./dashboard-types.js").DeploymentSmokeCheckRecord, deploymentSmokeCheckCount: number, governanceOperationCount: number }>,
 *     fetchReleaseSummary: () => Promise<import("./dashboard-types.js").ReleaseSummaryPayload>,
 *     fetchReleaseCheckpointDrift: (checkpointId?: string) => Promise<import("./dashboard-types.js").ReleaseCheckpointDriftPayload>,
 *     fetchReleaseBuildGate: () => Promise<import("./dashboard-types.js").ReleaseBuildGatePayload>,
 *     bootstrapReleaseBuildGateLocalEvidence: (payload?: { url?: string, label?: string, title?: string, notes?: string, status?: "ready" | "review" | "hold", runSmokeCheck?: boolean, saveCheckpoint?: boolean, timeoutMs?: number }) => Promise<{ success: true, smokeCheck: import("./dashboard-types.js").DeploymentSmokeCheckRecord | null, checkpoint: import("./dashboard-types.js").ReleaseCheckpointRecord | null, releaseBuildGate: import("./dashboard-types.js").ReleaseBuildGatePayload }>,
 *     createReleaseBuildGateActionTasks: (payload?: { actions?: import("./dashboard-types.js").ReleaseBuildGateAction[] }) => Promise<{ success: true, requested: number, createdTasks: import("./dashboard-types.js").PersistedTask[], skipped: Array<{ id: string, label: string, reason: string }>, totals: { requested: number, created: number, skipped: number }, tasks: import("./dashboard-types.js").PersistedTask[] }>,
 *     createReleaseCheckpoint: (payload?: { title?: string, status?: "ready" | "review" | "hold", notes?: string }) => Promise<{ success: true, checkpoint: import("./dashboard-types.js").ReleaseCheckpointRecord, releaseCheckpointCount: number, governanceOperationCount: number }>,
 *     createSourcesAccessValidationEvidenceSnapshot: (payload?: { title?: string, status?: "all" | "validated" | "review" | "blocked", sourceId?: string, accessMethod?: string, limit?: number }) => Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedDataSourcesAccessValidationEvidenceSnapshot, dataSourceAccessValidationEvidenceSnapshots: import("./dashboard-types.js").PersistedDataSourcesAccessValidationEvidenceSnapshot[] }>,
 *     fetchSourcesAccessValidationEvidenceSnapshotDiff: (snapshotId?: string) => Promise<import("./dashboard-types.js").DataSourcesAccessValidationEvidenceSnapshotDiffPayload>,
 *     fetchSourcesAccessMatrix: () => Promise<import("./dashboard-types.js").DataSourcesAccessMatrixPayload>,
 *     fetchSourcesAccessReviewQueue: () => Promise<import("./dashboard-types.js").DataSourcesAccessReviewQueuePayload>,
 *     createSourcesAccessReviewTasks: (payload?: { items?: import("./dashboard-types.js").DataSourcesAccessReviewQueueItem[] }) => Promise<{ success: true, requested: number, createdTasks: import("./dashboard-types.js").PersistedTask[], skipped: Array<{ id: string, label: string, reason: string }>, totals: { requested: number, created: number, skipped: number }, tasks: import("./dashboard-types.js").PersistedTask[] }>,
 *     createSourcesAccessTaskLedgerSnapshot: (payload?: { title?: string, status?: "all" | "open" | "closed", limit?: number }) => Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedDataSourcesAccessTaskLedgerSnapshot, dataSourceAccessTaskLedgerSnapshots: import("./dashboard-types.js").PersistedDataSourcesAccessTaskLedgerSnapshot[] }>,
 *     fetchSourcesAccessTaskLedgerSnapshotDiff: (snapshotId?: string) => Promise<import("./dashboard-types.js").DataSourcesAccessTaskLedgerSnapshotDiffPayload>,
 *     fetchSourcesAccessGate: () => Promise<import("./dashboard-types.js").DataSourcesAccessGatePayload>,
 *     fetchSourcesSummarySnapshots: () => Promise<import("./dashboard-types.js").PersistedDataSourcesSummarySnapshot[]>,
 *     createSourcesSummarySnapshot: (payload?: { title?: string }) => Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedDataSourcesSummarySnapshot, dataSourceHealthSnapshots: import("./dashboard-types.js").PersistedDataSourcesSummarySnapshot[] }>,
 *     fetchSourcesSummarySnapshotDiff: (snapshotId?: string) => Promise<import("./dashboard-types.js").DataSourcesSummarySnapshotDiffPayload>,
 *     deleteSource: (sourceId: string) => Promise<unknown>,
 *     fetchGovernance: () => Promise<import("./dashboard-types.js").GovernancePayload>,
 *     fetchGovernanceExecutionViews: () => Promise<import("./dashboard-types.js").PersistedGovernanceExecutionView[]>,
 *     saveGovernanceExecutionView: (payload: { title: string, search: string, scope: string, sort: string, executionStatus: string, executionRetention: number, showArchivedExecution: boolean }) => Promise<{ success: true, view: import("./dashboard-types.js").PersistedGovernanceExecutionView, governanceExecutionViews: import("./dashboard-types.js").PersistedGovernanceExecutionView[] }>,
 *     fetchGovernanceExecutionPolicy: () => Promise<import("./dashboard-types.js").GovernanceAgentExecutionPolicy>,
 *     saveGovernanceExecutionPolicy: (payload: { staleThresholdHours: number }) => Promise<{ success: true, policy: import("./dashboard-types.js").GovernanceAgentExecutionPolicy }>,
 *     bootstrapGovernance: (payload: { mode: "profiles" | "starter-pack", projectIds: string[] }) => Promise<unknown>,
 *     executeGovernanceQueue: (payload: { items: Array<Pick<import("./dashboard-types.js").GovernanceQueueItem, "id" | "projectId" | "projectName" | "kind" | "actionType">> }) => Promise<unknown>,
 *     suppressGovernanceQueue: (payload: { items: Array<Pick<import("./dashboard-types.js").GovernanceQueueItem, "id" | "projectId" | "projectName" | "kind" | "title">>, reason?: string }) => Promise<unknown>,
 *     restoreGovernanceQueue: (payload: { ids: string[] }) => Promise<unknown>,
 *     saveProjectProfile: (payload: { projectId: string, projectName: string, owner?: string, status?: string, lifecycle?: string, tier?: string, targetState?: string, summary?: string }) => Promise<unknown>,
 *     createTask: (payload: { title: string, description?: string, priority?: string, status?: string, projectId?: string, projectName?: string }) => Promise<unknown>,
 *     createWorkflow: (payload: { title: string, brief?: string, status?: string, phase?: string, projectId?: string, projectName?: string }) => Promise<unknown>,
 *     createNote: (payload: { title: string, body?: string, kind?: string, projectId?: string, projectName?: string }) => Promise<unknown>,
 *     updateAgentWorkOrderRun: (runId: string, payload: { status?: string, notes?: string, archived?: boolean }) => Promise<unknown>,
 *     applyAgentWorkOrderRunRetention: (payload: { retainCompleted: number, runIds?: string[] }) => Promise<unknown>,
 *     actionAgentWorkOrderRunSlaBreaches: (payload: { runIds?: string[], action?: string }) => Promise<unknown>,
 *     resolveAgentWorkOrderRunSlaBreaches: (payload: { runIds?: string[] }) => Promise<unknown>
 *   },
 *   openModal: (id: string) => void
 * }} options
 */
export function createDashboardViews({ getData, getState, getRuntime, api, openModal }) {
  const graphRenderer = createGraphRenderer({ openModal });
  /** @type {import("./dashboard-types.js").GovernancePayload | null} */
  let governanceCache = null;
  /** @type {import("./dashboard-types.js").PersistedGovernanceExecutionView[]} */
  let governanceExecutionViews = [];
  /** @type {import("./dashboard-types.js").GovernanceAgentExecutionPolicy} */
  let governanceExecutionPolicy = {
    staleThresholdHours: 24,
    staleStatuses: ["queued", "running", "blocked"],
    terminalStatuses: ["passed", "failed", "cancelled"],
    updatedAt: ""
  };
  let governanceControlsBound = false;

  /**
   * @param {string | undefined} value
   */
  function formatTimestamp(value) {
    if (!value) return "Unknown";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleString();
  }

  /**
   * @param {string | undefined} value
   */
  function formatDriftSeverityLabel(value) {
    return value
      ? value.split("-").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ")
      : "Drift";
  }

  function renderRuntimeStatus() {
    const runtime = getRuntime();
    const container = document.getElementById("runtime-status");
    const sourceLabels = {
      api: { text: "Live API", color: "var(--success)" },
      file: { text: "Local File", color: "var(--warning)" },
      embedded: { text: "Embedded Snapshot", color: "var(--warning)" },
      unavailable: { text: "Unavailable", color: "var(--danger)" }
    };
    const sourceInfo = sourceLabels[runtime.inventorySource];
    const fragment = document.createDocumentFragment();

    fragment.append(createStatusPill("Data", sourceInfo.text, sourceInfo.color));

    if (runtime.snapshotGeneratedAt) {
      fragment.append(createStatusPill("Snapshot", formatTimestamp(runtime.snapshotGeneratedAt), "var(--text)"));
    }

    if (runtime.lastLoadedAt) {
      fragment.append(createStatusPill("Loaded", formatTimestamp(runtime.lastLoadedAt), "var(--text-muted)"));
    }

    if (runtime.loadError) {
      fragment.append(createStatusPill("Fallback", runtime.loadError, "var(--danger)"));
    }

    container.replaceChildren(fragment);
  }

  /**
   * @param {"findings" | "trends" | "sources" | "governance"} panelName
   * @returns {PanelRuntimeState}
   */
  function getPanelState(panelName) {
    return getRuntime().panels[panelName];
  }

  /**
   * @param {"findings" | "trends" | "sources" | "governance"} panelName
   * @param {Partial<PanelRuntimeState>} patch
   */
  function updatePanelState(panelName, patch) {
    Object.assign(getPanelState(panelName), patch);
  }

  /**
   * @param {"findings" | "trends" | "sources" | "governance"} panelName
   */
  function renderPanelStatus(panelName) {
    const panelState = getPanelState(panelName);
    const panelStatusIdMap = {
      findings: "findings-status",
      trends: "trends-status",
      sources: "sources-status",
      governance: "governance-status"
    };
    const container = document.getElementById(panelStatusIdMap[panelName]);
    if (!container) return;
    const statusLabels = {
      idle: { text: "Idle", color: "var(--text-muted)" },
      loading: { text: "Loading", color: "var(--primary)" },
      ready: { text: "Ready", color: "var(--success)" },
      empty: { text: "Empty", color: "var(--warning)" },
      error: { text: "Error", color: "var(--danger)" }
    };
    const statusInfo = statusLabels[panelState.status];
    const fragment = document.createDocumentFragment();

    fragment.append(createStatusPill("State", statusInfo.text, statusInfo.color));

    if (typeof panelState.itemCount === "number") {
      fragment.append(createStatusPill("Items", String(panelState.itemCount), "var(--text)"));
    }

    if (panelState.lastLoadedAt) {
      fragment.append(createStatusPill("Updated", formatTimestamp(panelState.lastLoadedAt), "var(--text-muted)"));
    }

    if (panelState.message && panelState.status === "error") {
      fragment.append(createStatusPill("Issue", panelState.message, "var(--danger)"));
    }

    container.replaceChildren(fragment);
  }

  function getGovernanceFilterState() {
    return {
      search: /** @type {HTMLInputElement | null} */ (document.getElementById("governance-search"))?.value.trim().toLowerCase() || "",
      scope: /** @type {HTMLSelectElement | null} */ (document.getElementById("governance-scope"))?.value || "all",
      sort: /** @type {HTMLSelectElement | null} */ (document.getElementById("governance-sort"))?.value || "recent",
      executionStatus: /** @type {HTMLSelectElement | null} */ (document.getElementById("governance-execution-status"))?.value || "all",
      executionRetention: Number(/** @type {HTMLSelectElement | null} */ (document.getElementById("governance-execution-retention"))?.value || 25),
      staleThresholdHours: Number(/** @type {HTMLSelectElement | null} */ (document.getElementById("governance-execution-stale-threshold"))?.value || governanceExecutionPolicy.staleThresholdHours || 24),
      showArchivedExecution: /** @type {HTMLInputElement | null} */ (document.getElementById("governance-show-archived-execution"))?.checked || false
    };
  }

  function renderGovernanceExecutionViewOptions() {
    const select = /** @type {HTMLSelectElement | null} */ (document.getElementById("governance-execution-saved-view"));
    if (!select) return;
    const selectedValue = select.value;
    const fragment = document.createDocumentFragment();
    fragment.append(new Option("Saved View: Current filters", ""));
    for (const view of governanceExecutionViews) {
      const label = `${view.title} | ${view.executionStatus} | keep ${view.executionRetention}`;
      fragment.append(new Option(label, view.id));
    }
    select.replaceChildren(fragment);
    if (governanceExecutionViews.some((view) => view.id === selectedValue)) {
      select.value = selectedValue;
    }
  }

  /**
   * @param {import("./dashboard-types.js").GovernanceAgentExecutionPolicy} policy
   */
  function applyGovernanceExecutionPolicyToControls(policy) {
    governanceExecutionPolicy = policy;
    setSelectControlValue("governance-execution-stale-threshold", String(policy.staleThresholdHours || 24));
  }

  /**
   * @param {string} id
   * @param {string} value
   */
  function setSelectControlValue(id, value) {
    const select = /** @type {HTMLSelectElement | null} */ (document.getElementById(id));
    if (!select) return;
    select.value = [...select.options].some((option) => option.value === value) ? value : select.options[0]?.value || "";
  }

  /**
   * @param {import("./dashboard-types.js").PersistedGovernanceExecutionView} view
   */
  function applyGovernanceExecutionView(view) {
    const searchInput = /** @type {HTMLInputElement | null} */ (document.getElementById("governance-search"));
    const showArchivedCheckbox = /** @type {HTMLInputElement | null} */ (document.getElementById("governance-show-archived-execution"));
    if (searchInput) searchInput.value = view.search || "";
    setSelectControlValue("governance-scope", view.scope || "execution");
    setSelectControlValue("governance-sort", view.sort || "recent");
    setSelectControlValue("governance-execution-status", view.executionStatus || "all");
    setSelectControlValue("governance-execution-retention", String(view.executionRetention || 25));
    if (showArchivedCheckbox) showArchivedCheckbox.checked = Boolean(view.showArchivedExecution);
    renderGovernanceFromCache();
  }

  /**
   * @param {ReturnType<typeof getGovernanceFilterState>} filters
   */
  function buildGovernanceExecutionViewTitle(filters) {
    const scope = filters.scope === "execution" ? "Execution" : `Governance ${filters.scope}`;
    const archiveLabel = filters.showArchivedExecution ? "with archived" : "active only";
    const searchLabel = filters.search ? ` | ${filters.search.slice(0, 32)}` : "";
    return `${scope}: ${filters.executionStatus} | keep ${filters.executionRetention} | ${archiveLabel}${searchLabel}`;
  }

  /**
   * @param {import("./dashboard-types.js").GovernancePayload} governance
   */
  function applyGovernanceFilters(governance) {
    const filters = getGovernanceFilterState();
    const sortMode = filters.sort;
    const search = filters.search;
    const executionStatus = filters.executionStatus;

    /**
     * @param {string[]} values
     */
    function matchesSearch(values) {
      if (!search) return true;
      return values.some((value) => value.toLowerCase().includes(search));
    }

    /**
     * @template T
     * @param {T[]} items
     * @param {(item: T) => string[]} projector
     * @param {(left: T, right: T) => number} [fallbackSort]
     */
    function filterAndSort(items, projector, fallbackSort = () => 0) {
      const filtered = items.filter((item) => matchesSearch(projector(item)));
      filtered.sort((left, right) => {
        if (sortMode === "project") {
          return projector(left)[0].localeCompare(projector(right)[0]);
        }
        if (sortMode === "owner") {
          return (projector(left)[1] || "").localeCompare(projector(right)[1] || "") || projector(left)[0].localeCompare(projector(right)[0]);
        }
        if (sortMode === "status") {
          return (projector(left)[2] || "").localeCompare(projector(right)[2] || "") || projector(left)[0].localeCompare(projector(right)[0]);
        }
        return fallbackSort(left, right);
      });
      return filtered;
    }

    /**
     * @param {import("./dashboard-types.js").PersistedAgentWorkOrderRun} run
     */
    function matchesExecutionStatus(run) {
      if (executionStatus === "all") return true;
      if (executionStatus === "active") return ["queued", "running", "blocked"].includes(run.status);
      if (executionStatus === "completed") return ["passed", "failed", "cancelled"].includes(run.status);
      if (executionStatus === "sla-breached") return Boolean(run.slaBreachedAt && !run.slaResolvedAt);
      if (executionStatus === "sla-resolved") return Boolean(run.slaResolvedAt);
      return run.status === executionStatus;
    }

    /**
     * @param {import("./dashboard-types.js").PersistedAgentWorkOrderRun} run
     */
    function matchesExecutionArchive(run) {
      return filters.showArchivedExecution || !run.archivedAt;
    }

    const filtered = {
      ...governance,
      recentActivity: filterAndSort(
        governance.recentActivity,
        (item) => [item.projectName || "", item.title || "", item.status || "", item.kind || "", item.detail || ""],
        (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
      ),
      profiles: filterAndSort(
        governance.profiles,
        (profile) => [profile.projectName || "", profile.owner || "", profile.status || "", profile.lifecycle || "", profile.tier || "", profile.summary || ""],
        (left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime()
      ),
      decisions: filterAndSort(
        governance.decisions,
        (note) => [note.projectName || "", note.title || "", note.kind || "", note.body || ""],
        (left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime()
      ),
      profileHistory: filterAndSort(
        governance.profileHistory,
        (entry) => [entry.projectName || "", entry.next.owner || "", entry.next.status || "", entry.changedFields.join(" "), entry.changeType || ""],
        (left, right) => new Date(right.changedAt).getTime() - new Date(left.changedAt).getTime()
      ),
      milestoneFocus: filterAndSort(
        governance.milestoneFocus,
        (milestone) => [milestone.projectName || "", milestone.title || "", milestone.status || "", milestone.detail || "", milestone.targetDate || ""],
        (left, right) => new Date(right.updatedAt || right.createdAt || right.targetDate || "").getTime() - new Date(left.updatedAt || left.createdAt || left.targetDate || "").getTime()
      ),
      workflowFocus: filterAndSort(
        governance.workflowFocus,
        (workflow) => [workflow.projectName || "", workflow.title || "", workflow.status || "", workflow.phase || "", workflow.brief || ""],
        (left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime()
      ),
      actionQueue: filterAndSort(
        governance.actionQueue,
        (item) => [item.projectName || "", item.priority || "", item.kind || "", item.title || "", item.detail || ""],
        (left, right) => {
          const priorityRank = { high: 0, medium: 1, low: 2 };
          const priorityDelta = priorityRank[left.priority] - priorityRank[right.priority];
          if (priorityDelta) return priorityDelta;
          return left.projectName.localeCompare(right.projectName) || left.title.localeCompare(right.title);
        }
      ),
      queueSuppressions: filterAndSort(
        governance.queueSuppressions,
        (item) => [item.projectName || "", item.kind || "", item.title || "", item.reason || ""],
        (left, right) => new Date(right.suppressedAt).getTime() - new Date(left.suppressedAt).getTime()
      ),
      operationLog: filterAndSort(
        governance.operationLog,
        (operation) => [operation.summary || "", operation.type || "", operation.actor || "", JSON.stringify(operation.details || {})],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      workflowRunbook: filterAndSort(
        governance.workflowRunbook,
        (item) => [item.projectName || "", item.title || "", item.phase || "", item.status || "", item.readiness || "", item.nextStep || "", item.blockers.join(" ")],
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      ),
      agentSessions: filterAndSort(
        governance.agentSessions,
        (session) => [session.projectName || "", session.title || "", session.status || "", session.summary || "", session.handoffPack || ""],
        (left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime()
      ),
      agentControlPlaneBaselineStatus: governance.agentControlPlaneBaselineStatus && matchesSearch([
        "control plane baseline",
        governance.agentControlPlaneBaselineStatus.hasBaseline ? "set" : "missing",
        governance.agentControlPlaneBaselineStatus.freshness || "",
        String(governance.agentControlPlaneBaselineStatus.ageHours || 0),
        String(governance.agentControlPlaneBaselineStatus.driftScore || 0),
        governance.agentControlPlaneBaselineStatus.driftSeverity || "",
        governance.agentControlPlaneBaselineStatus.driftRecommendedAction || "",
        governance.agentControlPlaneBaselineStatus.hasDrift ? "drift" : "no drift",
        governance.agentControlPlaneBaselineStatus.health || "",
        governance.agentControlPlaneBaselineStatus.recommendedAction || "",
        ...(governance.agentControlPlaneBaselineStatus.driftItems || []).map((item) => `${item.label} ${item.before} ${item.current} ${item.delta}`),
        governance.agentControlPlaneBaselineStatus.title || "",
        governance.agentControlPlaneBaselineStatus.snapshotId || "",
        String(governance.agentControlPlaneBaselineStatus.snapshotCount || 0)
      ])
        ? governance.agentControlPlaneBaselineStatus
        : null,
      agentControlPlaneDecision: governance.agentControlPlaneDecision && matchesSearch([
        "control plane decision",
        governance.agentControlPlaneDecision.decision || "",
        governance.agentControlPlaneDecision.recommendedAction || "",
        governance.agentControlPlaneDecision.baselineHealth || "",
        governance.agentControlPlaneDecision.baselineDriftSeverity || "",
        String(governance.agentControlPlaneDecision.activeRuns || 0),
        String(governance.agentControlPlaneDecision.staleActiveRuns || 0),
        String(governance.agentControlPlaneDecision.slaBreachedRuns || 0),
        String(governance.agentControlPlaneDecision.agentReadyProjects || 0),
        String(governance.agentControlPlaneDecision.agentReadinessItems || 0),
        String(governance.agentControlPlaneDecision.dataSourcesAccessValidationMethodCount || 0),
        String(governance.agentControlPlaneDecision.dataSourcesAccessValidationSourceCount || 0),
        String(governance.agentControlPlaneDecision.dataSourcesAccessValidationEvidenceCount || 0),
        String(governance.agentControlPlaneDecision.dataSourcesAccessValidationEvidenceValidatedCount || 0),
        governance.agentControlPlaneDecision.dataSourcesAccessValidationRunbook?.markdown || "",
        ...(governance.agentControlPlaneDecision.dataSourceAccessValidationEvidence || []).map((evidence) => `${evidence.sourceLabel || ""} ${evidence.status || ""} ${evidence.accessMethod || ""} ${evidence.evidence || ""}`),
        ...(governance.agentControlPlaneDecision.reasons || []).map((reason) => `${reason.severity} ${reason.code} ${reason.message}`)
      ])
        ? governance.agentControlPlaneDecision
        : null,
      releaseSummary: governance.releaseSummary && matchesSearch([
        "release control",
        governance.releaseSummary.summary?.status || "",
        governance.releaseSummary.git?.branch || "",
        governance.releaseSummary.git?.commitShort || "",
        governance.releaseSummary.git?.commitMessage || "",
        governance.releaseSummary.git?.dirty ? "dirty" : "clean",
        governance.releaseSummary.latestSmokeCheck?.status || "",
        governance.releaseSummary.latestSmokeCheck?.url || "",
        governance.releaseSummary.summary?.validationStatus || "",
        ...(governance.releaseSummary.checkpoints || []).map((checkpoint) => `${checkpoint.title || ""} ${checkpoint.status || ""} ${checkpoint.commitShort || ""} ${checkpoint.notes || ""}`)
      ])
        ? {
            ...governance.releaseSummary,
            checkpoints: filterAndSort(
              governance.releaseSummary.checkpoints || [],
              (checkpoint) => [checkpoint.title || "", checkpoint.status || "", checkpoint.branch || "", checkpoint.commitShort || "", checkpoint.commitMessage || "", checkpoint.validationStatus || "", checkpoint.notes || ""],
              (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
            )
          }
        : null,
      releaseCheckpointDrift: governance.releaseCheckpointDrift && matchesSearch([
        "release checkpoint drift",
        governance.releaseCheckpointDrift.snapshotTitle || "",
        governance.releaseCheckpointDrift.driftSeverity || "",
        governance.releaseCheckpointDrift.recommendedAction || "",
        governance.releaseCheckpointDrift.hasDrift ? "drift" : "no drift",
        ...(governance.releaseCheckpointDrift.driftItems || []).map((item) => `${item.label || ""} ${item.before || ""} ${item.current || ""} ${item.severity || ""}`)
      ])
        ? governance.releaseCheckpointDrift
        : null,
      releaseBuildGate: governance.releaseBuildGate && matchesSearch([
        "release build gate",
        governance.releaseBuildGate.decision || "",
        governance.releaseBuildGate.recommendedAction || "",
        String(governance.releaseBuildGate.riskScore || 0),
        ...(governance.releaseBuildGate.reasons || []).map((reason) => `${reason.code || ""} ${reason.label || ""} ${reason.message || ""} ${reason.severity || ""}`),
        ...(governance.releaseBuildGate.actions || []).map((action) => `${action.id || ""} ${action.label || ""} ${action.priority || ""} ${action.status || ""} ${action.description || ""} ${action.commandHint || ""}`)
      ])
        ? governance.releaseBuildGate
        : null,
      dataSourcesAccessGate: governance.dataSourcesAccessGate && matchesSearch([
        "data sources access gate",
        governance.dataSourcesAccessGate.decision || "",
        governance.dataSourcesAccessGate.recommendedAction || "",
        String(governance.dataSourcesAccessGate.ready || 0),
        String(governance.dataSourcesAccessGate.review || 0),
        String(governance.dataSourcesAccessGate.blocked || 0),
        String(governance.dataSourcesAccessGate.tokenLikely || 0),
        String(governance.dataSourcesAccessGate.certificateLikely || 0),
        ...(governance.dataSourcesAccessGate.reasons || []).map((reason) => `${reason.severity} ${reason.code} ${reason.message}`)
      ])
        ? governance.dataSourcesAccessGate
        : null,
      dataSourcesAccessReviewQueue: governance.dataSourcesAccessReviewQueue
        ? {
            ...governance.dataSourcesAccessReviewQueue,
            items: filterAndSort(
              governance.dataSourcesAccessReviewQueue.items || [],
              (item) => [item.label || "", item.priority || "", item.status || "", item.type || "", item.accessMethod || "", item.action || "", item.validation || "", item.credentialHint || ""],
              (left, right) => {
                const priorityRank = { high: 0, medium: 1, normal: 2 };
                const priorityDelta = (priorityRank[left.priority] ?? 99) - (priorityRank[right.priority] ?? 99);
                if (priorityDelta) return priorityDelta;
                return left.label.localeCompare(right.label);
              }
            )
          }
        : null,
      dataSourcesAccessValidationRunbook: governance.dataSourcesAccessValidationRunbook
        ? {
            ...governance.dataSourcesAccessValidationRunbook,
            methods: filterAndSort(
              governance.dataSourcesAccessValidationRunbook.methods || [],
              (method) => [
                method.title || "",
                method.accessMethod || "",
                method.evidence || "",
                ...(method.steps || []),
                ...(method.commandHints || []),
                ...(method.sources || []).map((source) => `${source.label || ""} ${source.type || ""} ${source.status || ""} ${source.credentialHint || ""}`)
              ],
              (left, right) => (right.sources || []).length - (left.sources || []).length || (left.title || "").localeCompare(right.title || "")
            )
          }
        : null,
      dataSourcesAccessValidationEvidenceCoverage: governance.dataSourcesAccessValidationEvidenceCoverage
        ? {
            ...governance.dataSourcesAccessValidationEvidenceCoverage,
            items: filterAndSort(
              governance.dataSourcesAccessValidationEvidenceCoverage.items || [],
              (item) => [item.label || "", item.sourceId || "", item.coverageStatus || "", item.priority || "", item.accessMethod || "", item.action || "", item.latestEvidenceStatus || "", item.latestEvidenceSummary || ""],
              (left, right) => {
                const priorityRank = { high: 0, medium: 1, low: 2 };
                const statusRank = { blocked: 0, missing: 1, review: 2, covered: 3 };
                return (priorityRank[left.priority] ?? 99) - (priorityRank[right.priority] ?? 99)
                  || (statusRank[left.coverageStatus] ?? 99) - (statusRank[right.coverageStatus] ?? 99)
                  || left.label.localeCompare(right.label);
              }
            )
          }
        : null,
      dataSourceAccessValidationEvidence: filterAndSort(
        governance.dataSourceAccessValidationEvidence || [],
        (evidence) => [evidence.sourceLabel || "", evidence.sourceId || "", evidence.status || "", evidence.accessMethod || "", evidence.evidence || "", evidence.commandHint || ""],
        (left, right) => new Date(right.checkedAt || right.createdAt).getTime() - new Date(left.checkedAt || left.createdAt).getTime()
      ),
      dataSourceAccessValidationEvidenceSnapshots: filterAndSort(
        governance.dataSourceAccessValidationEvidenceSnapshots || [],
        (snapshot) => [snapshot.title || "", snapshot.statusFilter || "", snapshot.sourceId || "", snapshot.accessMethod || "", String(snapshot.total), String(snapshot.validatedCount), String(snapshot.reviewCount), String(snapshot.blockedCount), snapshot.markdown || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      dataSourceAccessValidationEvidenceSnapshotDiff: governance.dataSourceAccessValidationEvidenceSnapshotDiff && matchesSearch([
        "data sources access validation evidence snapshot drift",
        governance.dataSourceAccessValidationEvidenceSnapshotDiff.snapshotTitle || "",
        governance.dataSourceAccessValidationEvidenceSnapshotDiff.driftSeverity || "",
        governance.dataSourceAccessValidationEvidenceSnapshotDiff.recommendedAction || "",
        governance.dataSourceAccessValidationEvidenceSnapshotDiff.hasDrift ? "drift" : "no drift",
        ...(governance.dataSourceAccessValidationEvidenceSnapshotDiff.driftItems || []).map((item) => `${item.label} ${item.before} ${item.current} ${item.delta}`)
      ])
        ? governance.dataSourceAccessValidationEvidenceSnapshotDiff
        : null,
      dataSourcesAccessTasks: filterAndSort(
        governance.dataSourcesAccessTasks || [],
        (task) => [task.projectName || "", task.title || "", task.status || "", task.priority || "", task.sourceLabel || "", task.sourceType || "", task.accessMethod || "", task.description || ""],
        (left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime()
      ),
      dataSourceAccessTaskLedgerSnapshots: filterAndSort(
        governance.dataSourceAccessTaskLedgerSnapshots || [],
        (snapshot) => [snapshot.title || "", snapshot.statusFilter || "", String(snapshot.total), String(snapshot.openCount), String(snapshot.closedCount), snapshot.markdown || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      agentControlPlaneDecisionSnapshots: filterAndSort(
        governance.agentControlPlaneDecisionSnapshots || [],
        (snapshot) => [snapshot.title || "", snapshot.decision || "", snapshot.recommendedAction || "", snapshot.baselineHealth || "", snapshot.baselineDriftSeverity || "", (snapshot.reasonCodes || []).join(" "), snapshot.markdown || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      agentControlPlaneSnapshots: filterAndSort(
        governance.agentControlPlaneSnapshots || [],
        (snapshot) => [snapshot.title || "", snapshot.isBaseline ? "baseline" : "", String(snapshot.totalWorkOrders), String(snapshot.totalExecutionRuns), String(snapshot.totalSlaLedgerRecords), snapshot.markdown || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      agentReadinessMatrix: filterAndSort(
        governance.agentReadinessMatrix,
        (item) => [item.projectName || "", item.owner || "", item.status || "", item.lifecycle || "", item.targetState || "", item.nextStep || "", item.blockers.join(" ")],
        (left, right) => left.score - right.score || right.openFindingCount - left.openFindingCount || left.projectName.localeCompare(right.projectName)
      ),
      agentWorkOrderSnapshots: filterAndSort(
        governance.agentWorkOrderSnapshots,
        (snapshot) => [snapshot.title || "", snapshot.statusFilter || "", String(snapshot.total), snapshot.markdown || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      agentExecutionSlaLedgerSnapshots: filterAndSort(
        governance.agentExecutionSlaLedgerSnapshots || [],
        (snapshot) => [snapshot.title || "", snapshot.stateFilter || "", String(snapshot.total), String(snapshot.openCount), String(snapshot.resolvedCount), snapshot.markdown || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      agentWorkOrderRuns: filterAndSort(
        governance.agentWorkOrderRuns,
        (run) => [run.projectName || "", run.title || "", run.status || "", run.archivedAt ? "archived" : "active", run.slaBreachedAt && !run.slaResolvedAt ? "sla breached" : "", run.slaResolvedAt ? "sla resolved" : "", run.slaAction || "", String(run.slaEscalationCount || ""), run.readinessStatus || "", run.objective || "", run.blockers.join(" "), run.notes || "", run.history.map((event) => event.note).join(" ")],
        (left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime()
      ).filter(matchesExecutionArchive).filter(matchesExecutionStatus),
      agentExecutionSlaLedger: filterAndSort(
        governance.agentExecutionSlaLedger || [],
        (item) => [item.projectName || "", item.title || "", item.breachState || "", item.status || "", item.action || "", String(item.escalationCount || ""), String(item.resolutionCount || ""), String(item.durationHours || "")],
        (left, right) => new Date(right.updatedAt || right.breachedAt).getTime() - new Date(left.updatedAt || left.breachedAt).getTime()
      ),
      unprofiledProjects: filterAndSort(
        governance.unprofiledProjects,
        (project) => [project.name || "", project.category || "", project.zone || "", project.relPath || "", String(project.qualityScore), String(project.findingCount)],
        (left, right) => {
          const findingDelta = right.findingCount - left.findingCount;
          if (findingDelta) return findingDelta;
          return right.qualityScore - left.qualityScore;
        }
      )
    };

    const scope = filters.scope;
    if (scope !== "all") {
      if (scope !== "activity") filtered.recentActivity = [];
      if (scope !== "registry") filtered.profiles = [];
      if (scope !== "registry") filtered.unprofiledProjects = [];
      if (scope !== "history") filtered.profileHistory = [];
      if (scope !== "queue") filtered.actionQueue = [];
      if (scope !== "queue") filtered.queueSuppressions = [];
      if (scope !== "operations") filtered.operationLog = [];
      if (scope !== "runbook") filtered.workflowRunbook = [];
      if (scope !== "agents") filtered.agentSessions = [];
      if (scope !== "agents") filtered.agentControlPlaneBaselineStatus = null;
      if (scope !== "agents") filtered.agentControlPlaneDecision = null;
      if (scope !== "agents") filtered.agentControlPlaneDecisionSnapshots = [];
      if (scope !== "agents") filtered.agentControlPlaneSnapshots = [];
      if (scope !== "release") filtered.releaseSummary = null;
      if (scope !== "release") filtered.releaseCheckpointDrift = null;
      if (scope !== "release") filtered.releaseBuildGate = null;
      if (scope !== "data-sources") filtered.dataSourcesAccessGate = null;
      if (scope !== "data-sources") filtered.dataSourcesAccessReviewQueue = null;
      if (scope !== "data-sources") filtered.dataSourcesAccessValidationRunbook = null;
      if (scope !== "data-sources") filtered.dataSourcesAccessValidationEvidenceCoverage = null;
      if (scope !== "data-sources") filtered.dataSourceAccessValidationEvidence = [];
      if (scope !== "data-sources") filtered.dataSourceAccessValidationEvidenceSnapshots = [];
      if (scope !== "data-sources") filtered.dataSourceAccessValidationEvidenceSnapshotDiff = null;
      if (scope !== "data-sources") filtered.dataSourcesAccessTasks = [];
      if (scope !== "data-sources") filtered.dataSourceAccessTaskLedgerSnapshots = [];
      if (scope !== "readiness") filtered.agentReadinessMatrix = [];
      if (scope !== "work-orders") filtered.agentWorkOrderSnapshots = [];
      if (scope !== "execution") filtered.agentWorkOrderRuns = [];
      if (scope !== "sla-ledger") filtered.agentExecutionSlaLedger = [];
      if (scope !== "sla-ledger") filtered.agentExecutionSlaLedgerSnapshots = [];
      if (scope !== "decisions") filtered.decisions = [];
      if (scope !== "milestones") filtered.milestoneFocus = [];
      if (scope !== "workflows") filtered.workflowFocus = [];
    }

    return filtered;
  }

  /**
   * @param {HTMLElement} container
   */
  function bindGovernanceQuickActions(container) {
    container.querySelectorAll("[data-governance-action]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const projectId = decodeURIComponent(element.dataset.projectId ?? "");
        const projectName = element.dataset.projectName ?? "";
        if (!projectId || !projectName) return;

        const originalLabel = element.textContent || "";

        try {
          element.disabled = true;
          if (element.dataset.governanceAction === "restore-suppressed") {
            const queueItemId = element.dataset.queueItemId ?? "";
            if (!queueItemId) return;
            await api.restoreGovernanceQueue({ ids: [queueItemId] });
            await renderGovernance();
            return;
          }

          if (element.dataset.governanceAction === "create-profile") {
            await api.saveProjectProfile({
              projectId,
              projectName,
              status: "active",
              lifecycle: "active",
              tier: "supporting",
              targetState: "stabilize",
              summary: "Created from the governance gap registry."
            });
          }

          if (element.dataset.governanceAction === "create-task") {
            await api.createTask({
              title: `Close governance gap for ${projectName}`,
              description: "Create and review the governance profile, assign ownership, and set the target state.",
              priority: "medium",
              status: "open",
              projectId,
              projectName
            });
          }

          if (element.dataset.governanceAction === "create-workflow") {
            await api.createWorkflow({
              title: `Drive governance follow-through for ${projectName}`,
              brief: "Advance the governance profile into an explicit execution stream with ownership, next steps, and review checkpoints.",
              status: "active",
              phase: "planning",
              projectId,
              projectName
            });
          }

          if (element.dataset.governanceAction === "create-starter-pack") {
            await api.bootstrapGovernance({
              mode: "starter-pack",
              projectIds: [projectId]
            });
          }

          if (element.dataset.governanceAction === "create-decision-note") {
            await api.createNote({
              title: `Decision required for ${projectName}`,
              body: "Confirm the target state, rationale, owner, and execution path for this project.",
              kind: "decision",
              projectId,
              projectName
            });
          }

          if (element.dataset.governanceAction === "open-project") {
            openModal(projectId);
            return;
          }

          await renderGovernance();
        } catch (error) {
          element.disabled = false;
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        }
      };
    });

    container.querySelectorAll("[data-source-access-task-action]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const taskId = element.dataset.taskId || "";
        const action = element.dataset.sourceAccessTaskAction || "";
        if (!taskId || !action) return;

        const statusByAction = {
          resolve: "resolved",
          reopen: "open",
          block: "blocked"
        };
        const nextStatus = statusByAction[action];
        if (!nextStatus) return;

        const originalLabel = element.textContent || "";

        try {
          element.disabled = true;
          element.textContent = "Updating";
          await api.updateTask(taskId, { status: nextStatus });
          await renderGovernance();
        } catch (error) {
          element.disabled = false;
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        }
      };
    });

    container.querySelectorAll("[data-source-access-evidence-action]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const sourceId = element.dataset.sourceId || "";
        const status = element.dataset.sourceAccessEvidenceAction || "";
        const sourceLabel = element.dataset.sourceLabel || sourceId || "source";
        const accessMethod = element.dataset.accessMethod || "review-required";
        if (!sourceId || !["validated", "review", "blocked"].includes(status)) return;

        const evidence = window.prompt(
          `Enter non-secret access validation evidence for ${sourceLabel}.\n\nDo not paste passwords, tokens, certificates, private keys, cookies, or browser sessions.`,
          status === "validated"
            ? `Validated ${accessMethod} access outside this app.`
            : status === "blocked"
              ? `Access blocked for ${accessMethod}; credentials or operator access must be resolved outside this app.`
              : `Access review required for ${accessMethod}; non-secret evidence captured for follow-up.`
        );
        if (evidence == null) return;
        const trimmedEvidence = evidence.trim();
        if (!trimmedEvidence) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Recording";
          const result = await api.createSourcesAccessValidationEvidence({
            sourceId,
            status,
            accessMethod,
            evidence: trimmedEvidence,
            checkedAt: new Date().toISOString()
          });
          element.textContent = result.taskSync?.updated ? `Synced ${result.taskSync.updated}` : "Recorded";
          await renderGovernance();
        } catch (error) {
          element.disabled = false;
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        }
      };
    });
  }

  /**
   * @param {string} value
   */
  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  /**
   * @param {import("./dashboard-types.js").PersistedAgentWorkOrderRun} run
   */
  function buildAgentWorkOrderRunBrief(run) {
    const lines = [
      `# ${run.title}`,
      "",
      `Project: ${run.projectName}`,
      `Path: ${run.relPath || "unknown"}`,
      `Status: ${run.status}`,
      `Archived: ${run.archivedAt ? `yes (${new Date(run.archivedAt).toLocaleString()})` : "no"}`,
      `SLA breach: ${run.slaBreachedAt ? `${run.slaResolvedAt ? "resolved" : "open"} (${new Date(run.slaBreachedAt).toLocaleString()}${run.slaResolvedAt ? `, resolved ${new Date(run.slaResolvedAt).toLocaleString()}` : ""})` : "no"}`,
      `Readiness: ${run.readinessStatus || "unset"} (${run.readinessScore}/100)`,
      "",
      "## Objective",
      "",
      run.objective || "No objective recorded.",
      "",
      "## Blockers",
      "",
      ...(run.blockers.length ? run.blockers.map((blocker) => `- ${blocker}`) : ["- none"]),
      "",
      "## Validation Checklist",
      "",
      ...(run.validationCommands.length ? run.validationCommands.map((command) => `- \`${command}\``) : ["- No validation commands recorded."]),
      "",
      "## Execution Timeline",
      ""
    ];

    if (run.history.length) {
      for (const event of run.history) {
        const transition = event.previousStatus ? ` from ${event.previousStatus}` : "";
        lines.push(`- ${new Date(event.createdAt).toLocaleString()} | ${event.status}${transition} | ${event.note}`);
      }
    } else {
      lines.push("- No execution events recorded.");
    }

    lines.push("", "## Notes", "", run.notes || "No notes recorded.");
    return lines.join("\n");
  }

  function buildAgentExecutionBriefPack() {
    const runs = getFilteredGovernance()?.agentWorkOrderRuns || [];
    const lines = [
      "# Agent Execution Brief Pack",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Visible runs: ${runs.length}`,
      ""
    ];

    if (!runs.length) {
      lines.push("No visible Agent Execution runs matched the current Governance filters.");
      return lines.join("\n");
    }

    runs.forEach((run, index) => {
      if (index) lines.push("", "---", "");
      lines.push(buildAgentWorkOrderRunBrief(run));
    });
    return lines.join("\n");
  }

  function buildSlaBreachLedgerMarkdown() {
    const ledger = getFilteredGovernance()?.agentExecutionSlaLedger || [];
    const lines = [
      "# SLA Breach Ledger",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Visible ledger records: ${ledger.length}`,
      ""
    ];

    if (!ledger.length) {
      lines.push("No SLA breach ledger records matched the current Governance filters.");
      return lines.join("\n");
    }

    for (const item of ledger) {
      lines.push(`## ${item.projectName}`);
      lines.push("");
      lines.push(`- Run: ${item.title}`);
      lines.push(`- State: ${item.breachState}`);
      lines.push(`- Status: ${item.status}`);
      lines.push(`- Action: ${item.action || "breached"}`);
      lines.push(`- Breached: ${item.breachedAt ? new Date(item.breachedAt).toLocaleString() : "unknown"}`);
      lines.push(`- Resolved: ${item.resolvedAt ? new Date(item.resolvedAt).toLocaleString() : "not resolved"}`);
      lines.push(`- Duration: ${item.durationHours || 0} hour(s)`);
      lines.push(`- Escalations: ${item.escalationCount || 0}`);
      lines.push(`- Resolutions: ${item.resolutionCount || 0}`);
      lines.push("");
    }

    return lines.join("\n");
  }

  function buildGovernanceDataSourcesAccessReviewQueueMarkdown() {
    const governance = getFilteredGovernance();
    const queue = governance?.dataSourcesAccessReviewQueue || null;
    const items = Array.isArray(queue?.items) ? queue.items : [];
    const filters = getGovernanceFilterState();
    const sourceSummary = governanceCache?.dataSourcesAccessReviewQueue?.summary || queue?.summary || {};
    const lines = [
      "# Governance Data Sources Access Review Queue",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Visible queue items: ${items.length}`,
      `Source queue total: ${sourceSummary.total || 0}`,
      `Review: ${sourceSummary.review || 0}`,
      `Blocked: ${sourceSummary.blocked || 0}`,
      `High priority: ${sourceSummary.high || 0}`,
      `Medium priority: ${sourceSummary.medium || 0}`,
      `Scope filter: ${filters.scope}`,
      `Search filter: ${filters.search || "none"}`,
      "",
      "Secret policy: Resolve credentials, private keys, certificates, and browser sessions outside this app. This handoff stores only non-secret access metadata.",
      "",
      "## Visible Queue"
    ];

    if (!items.length) {
      lines.push("- No visible Data Sources access review queue items matched the current Governance filters.");
      return lines.join("\n");
    }

    for (const item of items) {
      lines.push(`- ${item.label}: ${item.title || "Source access review"} [${item.priority || "normal"} / ${item.status || "review"}]`);
      lines.push(`  Access method: ${item.accessMethod || "review-required"}`);
      lines.push(`  Source status: ${item.sourceHealth || "unknown"} / ${item.sourceStatus || "unknown"}`);
      lines.push(`  Action: ${item.action || "Review source access outside this app."}`);
      lines.push(`  Validation: ${item.validation || "Confirm access outside this app."}`);
      if (item.credentialHint) {
        lines.push(`  Credential hint: ${item.credentialHint}`);
      }
    }

    return lines.join("\n");
  }

  function buildGovernanceDataSourcesAccessGateMarkdown() {
    const governance = getFilteredGovernance();
    const gate = governance?.dataSourcesAccessGate || null;
    const filters = getGovernanceFilterState();
    const sourceGate = governanceCache?.dataSourcesAccessGate || gate || {};
    const reasons = Array.isArray(gate?.reasons) ? gate.reasons : [];
    const lines = [
      "# Governance Data Sources Access Gate",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Visible gate: ${gate ? "yes" : "no"}`,
      `Decision: ${gate?.decision || sourceGate.decision || "unknown"}`,
      `Recommended action: ${gate?.recommendedAction || sourceGate.recommendedAction || "Review source access before ingestion."}`,
      `Ready: ${gate?.ready ?? sourceGate.ready ?? 0}`,
      `Review: ${gate?.review ?? sourceGate.review ?? 0}`,
      `Blocked: ${gate?.blocked ?? sourceGate.blocked ?? 0}`,
      `Token likely: ${gate?.tokenLikely ?? sourceGate.tokenLikely ?? 0}`,
      `Certificate likely: ${gate?.certificateLikely ?? sourceGate.certificateLikely ?? 0}`,
      `Scope filter: ${filters.scope}`,
      `Search filter: ${filters.search || "none"}`,
      "",
      "Secret policy: Resolve credentials, private keys, certificates, and browser sessions outside this app. This handoff stores only non-secret access metadata.",
      "",
      "## Visible Gate Reasons"
    ];

    if (!gate) {
      lines.push("- No visible Data Sources access gate matched the current Governance filters.");
      return lines.join("\n");
    }

    if (!reasons.length) {
      lines.push("- No gate reasons were reported.");
      return lines.join("\n");
    }

    for (const reason of reasons) {
      lines.push(`- ${reason.severity || "info"} / ${reason.code || "source-access"}: ${reason.message || "Review source access."}`);
    }

    return lines.join("\n");
  }

  function buildGovernanceDataSourcesAccessTaskLedgerMarkdown() {
    const governance = getFilteredGovernance();
    const tasks = governance?.dataSourcesAccessTasks || [];
    const filters = getGovernanceFilterState();
    const lines = [
      "# Governance Data Sources Access Task Ledger",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Visible tasks: ${tasks.length}`,
      `Open tasks: ${governanceCache?.summary.dataSourcesAccessOpenTaskCount ?? 0}`,
      `Total tasks: ${governanceCache?.summary.dataSourcesAccessTaskCount ?? 0}`,
      `Scope filter: ${filters.scope}`,
      `Search filter: ${filters.search || "none"}`,
      "",
      "Secret policy: Resolve credentials, private keys, certificates, and browser sessions outside this app. This handoff stores only non-secret access task metadata.",
      "",
      "## Visible Tasks"
    ];

    if (!tasks.length) {
      lines.push("- No visible Data Sources access tasks matched the current Governance filters.");
      return lines.join("\n");
    }

    for (const task of tasks) {
      lines.push(`- ${task.title || "Source access review task"} [${task.priority || "low"} / ${task.status || "open"}]`);
      lines.push(`  Source: ${task.sourceLabel || "Source"} (${task.sourceType || "source"})`);
      lines.push(`  Access method: ${task.accessMethod || "review-required"}`);
      lines.push(`  Review id: ${task.sourceAccessReviewId || "source-access-task"}`);
      if (task.description) {
        lines.push(`  Detail: ${String(task.description).split("\n")[0]}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * @param {HTMLElement} container
   */
  function bindWorkOrderSnapshotActions(container) {
    container.querySelectorAll("[data-work-order-snapshot-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.workOrderSnapshotId || "";
        const snapshot = governanceCache?.agentWorkOrderSnapshots.find((item) => item.id === snapshotId);
        if (!snapshot) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copied";
          await copyText(snapshot.markdown);
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-work-order-snapshot-queue-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.workOrderSnapshotQueueId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Queueing";
          await api.createAgentWorkOrderRunsFromSnapshot({ snapshotId });
          await renderGovernance();
        } catch (error) {
          element.disabled = false;
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        }
      };
    });
  }

  /**
   * @param {HTMLElement} container
   */
  function bindSlaLedgerSnapshotActions(container) {
    container.querySelectorAll("[data-sla-ledger-snapshot-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.slaLedgerSnapshotId || "";
        const snapshot = governanceCache?.agentExecutionSlaLedgerSnapshots?.find((item) => item.id === snapshotId);
        if (!snapshot) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copied";
          await copyText(snapshot.markdown);
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });
  }

  /**
   * @param {HTMLElement} container
   */
  function bindDataSourcesAccessTaskLedgerSnapshotActions(container) {
    container.querySelectorAll("[data-source-access-task-ledger-snapshot-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.sourceAccessTaskLedgerSnapshotId || "";
        const snapshot = governanceCache?.dataSourceAccessTaskLedgerSnapshots?.find((item) => item.id === snapshotId);
        if (!snapshot) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copied";
          await copyText(snapshot.markdown);
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });
  }

  /**
   * @param {HTMLElement} container
   */
  function bindDataSourcesAccessValidationEvidenceSnapshotActions(container) {
    container.querySelectorAll("[data-source-access-validation-evidence-snapshot-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.sourceAccessValidationEvidenceSnapshotId || "";
        const snapshot = governanceCache?.dataSourceAccessValidationEvidenceSnapshots?.find((item) => item.id === snapshotId);
        if (!snapshot) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copied";
          await copyText(snapshot.markdown);
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });
  }

  /**
   * @param {HTMLElement} container
   */
  function bindReleaseControlActions(container) {
    container.querySelectorAll("[data-release-control-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          await copyReleaseControl();
          element.textContent = "Copied";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-release-checkpoint-save]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          await saveReleaseCheckpoint();
          element.textContent = "Saved";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-release-checkpoint-drift-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          await copyReleaseCheckpointDrift();
          element.textContent = "Copied";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-release-build-gate-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          await copyReleaseBuildGate();
          element.textContent = "Copied";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-release-build-gate-bootstrap]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Bootstrapping";
          await bootstrapReleaseBuildGateLocalEvidence();
          element.textContent = "Bootstrapped";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-release-build-gate-tasks]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          await seedReleaseBuildGateActionTasks();
          element.textContent = "Created";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });
  }

  /**
   * @param {HTMLElement} container
   */
  function bindControlPlaneSnapshotActions(container) {
    container.querySelectorAll("[data-control-plane-decision-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const decision = await api.fetchAgentControlPlaneDecision();
          await copyText(decision.markdown);
          element.textContent = `Copied ${(decision.decision || "review").toUpperCase()}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-control-plane-decision-snapshot-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.controlPlaneDecisionSnapshotId || "";
        const snapshot = governanceCache?.agentControlPlaneDecisionSnapshots?.find((item) => item.id === snapshotId);
        if (!snapshot) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copied";
          await copyText(snapshot.markdown);
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-control-plane-snapshot-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.controlPlaneSnapshotId || "";
        const snapshot = governanceCache?.agentControlPlaneSnapshots?.find((item) => item.id === snapshotId);
        if (!snapshot) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copied";
          await copyText(snapshot.markdown);
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-control-plane-snapshot-drift-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.controlPlaneSnapshotDriftId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Diffing";
          const diff = await api.fetchAgentControlPlaneSnapshotDiff(snapshotId);
          await copyText(diff.markdown);
          const severityLabel = formatDriftSeverityLabel(diff.driftSeverity);
          element.textContent = diff.hasDrift ? `Copied ${severityLabel}` : "No Drift";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-control-plane-snapshot-baseline-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.controlPlaneSnapshotBaselineId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          await api.setAgentControlPlaneBaselineSnapshot({ snapshotId });
          await renderGovernance();
        } catch (error) {
          element.disabled = false;
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        }
      };
    });

    container.querySelectorAll("[data-control-plane-baseline-clear]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Clearing";
          await api.clearAgentControlPlaneBaselineSnapshot();
          await renderGovernance();
        } catch (error) {
          element.disabled = false;
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        }
      };
    });

    container.querySelectorAll("[data-control-plane-baseline-refresh]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Refreshing";
          await api.refreshAgentControlPlaneBaselineSnapshot({
            title: "Agent Control Plane Baseline Refresh",
            limit: 24
          });
          await renderGovernance();
        } catch (error) {
          element.disabled = false;
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        }
      };
    });
  }

  /**
   * @param {HTMLElement} container
   */
  function bindAgentWorkOrderRunActions(container) {
    container.querySelectorAll("[data-agent-work-order-run-copy-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runId = element.dataset.agentWorkOrderRunCopyId || "";
        const run = governanceCache?.agentWorkOrderRuns.find((item) => item.id === runId);
        if (!run) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copied";
          await copyText(buildAgentWorkOrderRunBrief(run));
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-agent-work-order-run-archive]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runId = element.dataset.agentWorkOrderRunId || "";
        const archive = element.dataset.agentWorkOrderRunArchive === "true";
        if (!runId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          await api.updateAgentWorkOrderRun(runId, {
            archived: archive,
            notes: archive
              ? "Archived completed run from Governance."
              : "Restored archived run from Governance."
          });
          await renderGovernance();
        } catch (error) {
          element.disabled = false;
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        }
      };
    });

    container.querySelectorAll("[data-agent-work-order-run-project-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const projectId = decodeURIComponent(element.dataset.agentWorkOrderRunProjectId || "");
        const item = governanceCache?.agentReadinessMatrix.find((entry) => entry.projectId === projectId);
        if (!item) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Queued";
          await api.createAgentWorkOrderRun({
            projectId: item.projectId,
            projectName: item.projectName,
            relPath: item.relPath,
            title: `Agent work order for ${item.projectName}`,
            objective: item.nextStep,
            status: "queued",
            readinessScore: item.score,
            readinessStatus: item.status,
            blockers: item.blockers,
            validationCommands: ["Run project-specific validation from the workbench Launchpad"],
            notes: "Queued from the Governance Agent Readiness Matrix."
          });
          await renderGovernance();
        } catch (error) {
          element.disabled = false;
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        }
      };
    });

    container.querySelectorAll("[data-agent-work-order-run-action]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runId = element.dataset.agentWorkOrderRunId || "";
        const status = element.dataset.agentWorkOrderRunAction || "";
        if (!runId || !status) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          await api.updateAgentWorkOrderRun(runId, {
            status,
            notes: `Marked ${status} from Governance.`
          });
          await renderGovernance();
        } catch (error) {
          element.disabled = false;
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        }
      };
    });
  }

  function bindGovernanceControls() {
    if (governanceControlsBound) return;
    const searchInput = document.getElementById("governance-search");
    const scopeSelect = document.getElementById("governance-scope");
    const sortSelect = document.getElementById("governance-sort");
    const executionStatusSelect = document.getElementById("governance-execution-status");
    const executionRetentionSelect = document.getElementById("governance-execution-retention");
    const executionStaleThresholdSelect = document.getElementById("governance-execution-stale-threshold");
    const executionSavedViewSelect = document.getElementById("governance-execution-saved-view");
    const showArchivedExecutionCheckbox = document.getElementById("governance-show-archived-execution");
    const handler = () => {
      if (getState().view === "governance" && governanceCache) {
        renderGovernanceFromCache();
      }
    };
    searchInput?.addEventListener("input", handler);
    scopeSelect?.addEventListener("change", handler);
    sortSelect?.addEventListener("change", handler);
    executionStatusSelect?.addEventListener("change", handler);
    executionRetentionSelect?.addEventListener("change", handler);
    executionStaleThresholdSelect?.addEventListener("change", handler);
    showArchivedExecutionCheckbox?.addEventListener("change", handler);
    executionSavedViewSelect?.addEventListener("change", (event) => {
      const viewId = event.currentTarget instanceof HTMLSelectElement ? event.currentTarget.value : "";
      const view = governanceExecutionViews.find((item) => item.id === viewId);
      if (view) {
        applyGovernanceExecutionView(view);
      }
    });
    governanceControlsBound = true;
  }

  function renderGovernanceFromCache() {
    if (!governanceCache) return;
    const container = document.getElementById("governance-panels");
    if (!container) return;
    const governance = applyGovernanceFilters(governanceCache);
    container.replaceChildren(
      createGovernanceSummaryGrid(governanceCache),
      createGovernanceDeck(governance)
    );
    bindAppLaunchers(container, openModal);
    bindGovernanceQuickActions(container);
    bindWorkOrderSnapshotActions(container);
    bindSlaLedgerSnapshotActions(container);
    bindDataSourcesAccessTaskLedgerSnapshotActions(container);
    bindDataSourcesAccessValidationEvidenceSnapshotActions(container);
    bindReleaseControlActions(container);
    bindControlPlaneSnapshotActions(container);
    bindAgentWorkOrderRunActions(container);
  }

  function getFilteredGovernance() {
    return governanceCache ? applyGovernanceFilters(governanceCache) : null;
  }

  /**
   * @returns {import("./dashboard-types.js").GovernanceQueueItem[]}
   */
  function getVisibleGovernanceQueue() {
    return getFilteredGovernance()?.actionQueue || [];
  }

  function buildGovernanceSummaryText() {
    const governance = getFilteredGovernance();
    if (!governance) {
      return "Governance data is not loaded.";
    }

    const executionMetrics = governanceCache?.agentExecutionMetrics || governance.agentExecutionMetrics;
    const executionStatusCounts = executionMetrics?.statusCounts || {};
    const executionStatusFilter = getGovernanceFilterState().executionStatus;
    const executionRetention = getGovernanceFilterState().executionRetention;
    const staleThresholdHours = getGovernanceFilterState().staleThresholdHours || governanceExecutionPolicy.staleThresholdHours;
    const showArchivedExecution = getGovernanceFilterState().showArchivedExecution;
    const baselineDriftItems = Array.isArray(governanceCache?.summary.agentControlPlaneBaselineDriftItems)
      ? governanceCache.summary.agentControlPlaneBaselineDriftItems
      : [];
    const lines = [
      `Governance summary`,
      `Open findings: ${governanceCache?.summary.openFindings ?? 0}`,
      `Open tasks: ${governanceCache?.summary.openTasks ?? 0}`,
      `Active workflows: ${governanceCache?.summary.activeWorkflows ?? 0}`,
      `Pending milestones: ${governanceCache?.summary.pendingMilestones ?? 0}`,
      `Decision notes: ${governanceCache?.summary.decisionNotes ?? 0}`,
      `Project profiles: ${governanceCache?.summary.profileCount ?? 0}`,
      `Action queue items: ${governanceCache?.summary.actionQueueItems ?? 0}`,
      `Suppressed queue items: ${governanceCache?.summary.suppressedQueueItems ?? 0}`,
      `Governance operation log entries: ${governanceCache?.summary.governanceOperationCount ?? 0}`,
      `Workflow runbook items: ${governanceCache?.summary.workflowRunbookItems ?? 0}`,
      `Agent sessions: ${governanceCache?.summary.agentSessionCount ?? 0}`,
      `Control plane snapshots: ${governanceCache?.summary.agentControlPlaneSnapshotCount ?? 0}`,
      `Control plane decision snapshots: ${governanceCache?.summary.agentControlPlaneDecisionSnapshotCount ?? 0}`,
      `Control plane baseline: ${governanceCache?.summary.agentControlPlaneBaselineSnapshotId ? `${governanceCache.summary.agentControlPlaneBaselineSnapshotTitle || "Agent Control Plane"} (${governanceCache.summary.agentControlPlaneBaselineSnapshotId})` : "not set"}`,
      `Control plane baseline freshness: ${governanceCache?.summary.agentControlPlaneBaselineFreshness || "missing"} (${governanceCache?.summary.agentControlPlaneBaselineAgeHours ?? 0}h old, threshold ${governanceCache?.summary.agentControlPlaneBaselineFreshnessThresholdHours ?? 24}h)`,
      `Control plane baseline drift score: ${governanceCache?.summary.agentControlPlaneBaselineDriftScore ?? 0}`,
      `Control plane baseline drift severity: ${governanceCache?.summary.agentControlPlaneBaselineDriftSeverity || "missing-baseline"}`,
      `Control plane baseline drift fields: ${baselineDriftItems.length ? baselineDriftItems.slice(0, 5).map((item) => `${item.label} ${item.before}->${item.current}`).join("; ") : "none"}`,
      `Control plane baseline health: ${governanceCache?.summary.agentControlPlaneBaselineHealth || "missing"}`,
      `Control plane baseline action: ${governanceCache?.summary.agentControlPlaneBaselineRecommendedAction || "Save or mark an Agent Control Plane snapshot as baseline."}`,
      `Control plane decision: ${governanceCache?.agentControlPlaneDecision?.decision || "review"}`,
      `Control plane release gate: ${governanceCache?.agentControlPlaneDecision?.releaseBuildGateDecision || governanceCache?.releaseBuildGate?.decision || "not-evaluated"} (risk ${governanceCache?.agentControlPlaneDecision?.releaseBuildGateRiskScore ?? governanceCache?.releaseBuildGate?.riskScore ?? 0})`,
      `Control plane decision action: ${governanceCache?.agentControlPlaneDecision?.recommendedAction || "Review the Agent Control Plane before the next supervised build."}`,
      `Control plane decision reasons: ${governanceCache?.agentControlPlaneDecision?.reasons?.length ? governanceCache.agentControlPlaneDecision.reasons.map((reason) => reason.code || reason.message).join(", ") : "none"}`,
      `Data Sources access gate: ${governanceCache?.dataSourcesAccessGate?.decision || governanceCache?.summary.dataSourcesAccessGateDecision || "not-evaluated"}`,
      `Data Sources access gate action: ${governanceCache?.dataSourcesAccessGate?.recommendedAction || "Evaluate Data Sources access before ingestion."}`,
      `Data Sources access ready/review/blocked: ${governanceCache?.dataSourcesAccessGate?.ready ?? governanceCache?.summary.dataSourcesAccessReadyCount ?? 0}/${governanceCache?.dataSourcesAccessGate?.review ?? governanceCache?.summary.dataSourcesAccessReviewCount ?? 0}/${governanceCache?.dataSourcesAccessGate?.blocked ?? governanceCache?.summary.dataSourcesAccessBlockedCount ?? 0}`,
      `Data Sources access review queue: ${governanceCache?.dataSourcesAccessReviewQueue?.summary?.total ?? governanceCache?.summary.dataSourcesAccessReviewQueueCount ?? 0}`,
      `Data Sources access review priority: ${governanceCache?.dataSourcesAccessReviewQueue?.summary?.high ?? 0} high | ${governanceCache?.dataSourcesAccessReviewQueue?.summary?.medium ?? 0} medium | ${governanceCache?.dataSourcesAccessReviewQueue?.summary?.blocked ?? 0} blocked`,
      `Data Sources access validation runbook: ${governanceCache?.summary.dataSourcesAccessValidationMethodCount ?? 0} method(s) across ${governanceCache?.summary.dataSourcesAccessValidationSourceCount ?? 0} source(s)`,
      `Data Sources access validation review/blocked: ${governanceCache?.summary.dataSourcesAccessValidationReviewCount ?? 0}/${governanceCache?.summary.dataSourcesAccessValidationBlockedCount ?? 0}`,
      `Data Sources access validation evidence: ${governanceCache?.summary.dataSourcesAccessValidationEvidenceValidatedCount ?? 0} validated / ${governanceCache?.summary.dataSourcesAccessValidationEvidenceCount ?? 0} total`,
      `Data Sources access validation evidence review/blocked: ${governanceCache?.summary.dataSourcesAccessValidationEvidenceReviewCount ?? 0}/${governanceCache?.summary.dataSourcesAccessValidationEvidenceBlockedCount ?? 0}`,
      `Data Sources access validation evidence coverage: ${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoverageCoveredCount ?? 0}/${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoverageCount ?? 0} covered (${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoveragePercent ?? 0}%)`,
      `Data Sources access validation evidence coverage gaps: ${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoverageMissingCount ?? 0} missing | ${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoverageHighPriorityCount ?? 0} high priority`,
      `Data Sources access validation evidence snapshots: ${governanceCache?.summary.dataSourceAccessValidationEvidenceSnapshotCount ?? 0}`,
      `Data Sources access validation evidence snapshot drift: ${governanceCache?.summary.dataSourceAccessValidationEvidenceSnapshotDriftSeverity || "missing-snapshot"} / score ${governanceCache?.summary.dataSourceAccessValidationEvidenceSnapshotDriftScore ?? 0}`,
      `Data Sources access tasks: ${governanceCache?.summary.dataSourcesAccessOpenTaskCount ?? 0} open / ${governanceCache?.summary.dataSourcesAccessTaskCount ?? 0} total`,
      `Data Sources access task ledger snapshots: ${governanceCache?.summary.dataSourceAccessTaskLedgerSnapshotCount ?? 0}`,
      `Agent-ready projects: ${governanceCache?.summary.agentReadyProjects ?? 0}/${governanceCache?.summary.agentReadinessItems ?? 0}`,
      `Work order snapshots: ${governanceCache?.summary.agentWorkOrderSnapshotCount ?? 0}`,
      `SLA ledger snapshots: ${governanceCache?.summary.agentExecutionSlaLedgerSnapshotCount ?? 0}`,
      `Agent execution runs: ${governanceCache?.summary.activeAgentWorkOrderRunCount ?? 0}/${governanceCache?.summary.agentWorkOrderRunCount ?? 0}`,
      `Agent execution SLA ledger records: ${governanceCache?.summary.agentExecutionSlaLedgerCount ?? 0}`,
      `Agent execution health: ${executionMetrics?.completionRate ?? 0}% complete | ${executionMetrics?.staleActive ?? 0} stale active after ${staleThresholdHours}h | ${executionMetrics?.slaBreached ?? 0} SLA breached | ${executionMetrics?.slaResolved ?? 0} SLA resolved | ${executionMetrics?.slaAverageResolutionHours ?? 0}h avg SLA resolution | ${executionMetrics?.failureRate ?? 0}% failure rate | ${executionMetrics?.archived ?? 0} archived`,
      `Agent execution status split: ${executionStatusCounts.queued ?? 0} queued | ${executionStatusCounts.running ?? 0} running | ${executionStatusCounts.blocked ?? 0} blocked | ${executionStatusCounts.passed ?? 0} passed | ${executionStatusCounts.failed ?? 0} failed`,
      `Agent execution status filter: ${executionStatusFilter}`,
      `Agent execution retention: keep ${executionRetention} completed run(s) before archiving`,
      `Agent execution SLA: stale after ${staleThresholdHours} hour(s) for ${governanceExecutionPolicy.staleStatuses.join(", ")}`,
      `Show archived execution runs: ${showArchivedExecution ? "yes" : "no"}`,
      `Profile history snapshots: ${governance.profileHistory.length}`,
      `Visible governance gaps: ${governance.unprofiledProjects.length}`,
      `Visible action queue items: ${governance.actionQueue.length}`,
      `Visible suppressed queue items: ${governance.queueSuppressions.length}`,
      `Visible operation log entries: ${governance.operationLog.length}`,
      `Visible workflow runbook items: ${governance.workflowRunbook.length}`,
      `Visible agent sessions: ${governance.agentSessions.length}`,
      `Visible control plane baseline status: ${governance.agentControlPlaneBaselineStatus ? "yes" : "no"}`,
      `Visible control plane decision: ${governance.agentControlPlaneDecision ? "yes" : "no"}`,
      `Visible Data Sources access gate: ${governance.dataSourcesAccessGate ? "yes" : "no"}`,
      `Visible Data Sources access review queue items: ${governance.dataSourcesAccessReviewQueue?.items?.length || 0}`,
      `Visible Data Sources access validation runbook methods: ${governance.dataSourcesAccessValidationRunbook?.methods?.length || 0}`,
      `Visible Data Sources access validation evidence coverage items: ${governance.dataSourcesAccessValidationEvidenceCoverage?.items?.length || 0}`,
      `Visible Data Sources access validation evidence records: ${governance.dataSourceAccessValidationEvidence?.length || 0}`,
      `Visible Data Sources access validation evidence snapshots: ${(governance.dataSourceAccessValidationEvidenceSnapshots || []).length}`,
      `Visible Data Sources access validation evidence snapshot drift: ${governance.dataSourceAccessValidationEvidenceSnapshotDiff ? "yes" : "no"}`,
      `Visible Data Sources access tasks: ${governance.dataSourcesAccessTasks?.length || 0}`,
      `Visible Data Sources access task ledger snapshots: ${(governance.dataSourceAccessTaskLedgerSnapshots || []).length}`,
      `Visible control plane decision snapshots: ${(governance.agentControlPlaneDecisionSnapshots || []).length}`,
      `Visible control plane snapshots: ${(governance.agentControlPlaneSnapshots || []).length}`,
      `Visible readiness items: ${governance.agentReadinessMatrix.length}`,
      `Visible work order snapshots: ${governance.agentWorkOrderSnapshots.length}`,
      `Visible SLA ledger snapshots: ${(governance.agentExecutionSlaLedgerSnapshots || []).length}`,
      `Visible agent execution runs: ${governance.agentWorkOrderRuns.length}`,
      `Visible activity items: ${governance.recentActivity.length}`,
      `Visible registry entries: ${governance.profiles.length}`,
      `Visible history entries: ${governance.profileHistory.length}`,
      `Visible decisions: ${governance.decisions.length}`,
      `Visible milestones: ${governance.milestoneFocus.length}`,
      `Visible workflows: ${governance.workflowFocus.length}`
    ];

    return lines.join("\n");
  }

  function buildGovernanceReportMarkdown() {
    const governance = getFilteredGovernance();
    if (!governance) {
      return "# Governance Report\n\nGovernance data is not loaded.\n";
    }

    /**
     * @param {string} value
     */
    function bullet(value) {
      return value ? `- ${value}` : "";
    }

    const executionMetrics = governanceCache?.agentExecutionMetrics || governance.agentExecutionMetrics;
    const executionStatusCounts = executionMetrics?.statusCounts || {};
    const executionStatusFilter = getGovernanceFilterState().executionStatus;
    const executionRetention = getGovernanceFilterState().executionRetention;
    const staleThresholdHours = getGovernanceFilterState().staleThresholdHours || governanceExecutionPolicy.staleThresholdHours;
    const showArchivedExecution = getGovernanceFilterState().showArchivedExecution;
    const baselineDriftItems = Array.isArray(governanceCache?.summary.agentControlPlaneBaselineDriftItems)
      ? governanceCache.summary.agentControlPlaneBaselineDriftItems
      : [];
    const lines = [
      "# Governance Report",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "## Summary",
      `- Open findings: ${governanceCache?.summary.openFindings ?? 0}`,
      `- Open tasks: ${governanceCache?.summary.openTasks ?? 0}`,
      `- Active workflows: ${governanceCache?.summary.activeWorkflows ?? 0}`,
      `- Pending milestones: ${governanceCache?.summary.pendingMilestones ?? 0}`,
      `- Decision notes: ${governanceCache?.summary.decisionNotes ?? 0}`,
      `- Project profiles: ${governanceCache?.summary.profileCount ?? 0}`,
      `- Action queue items: ${governanceCache?.summary.actionQueueItems ?? 0}`,
      `- Suppressed queue items: ${governanceCache?.summary.suppressedQueueItems ?? 0}`,
      `- Governance operation log entries: ${governanceCache?.summary.governanceOperationCount ?? 0}`,
      `- Workflow runbook items: ${governanceCache?.summary.workflowRunbookItems ?? 0}`,
      `- Agent sessions: ${governanceCache?.summary.agentSessionCount ?? 0}`,
      `- Control plane snapshots: ${governanceCache?.summary.agentControlPlaneSnapshotCount ?? 0}`,
      `- Control plane decision snapshots: ${governanceCache?.summary.agentControlPlaneDecisionSnapshotCount ?? 0}`,
      `- Control plane baseline: ${governanceCache?.summary.agentControlPlaneBaselineSnapshotId ? `${governanceCache.summary.agentControlPlaneBaselineSnapshotTitle || "Agent Control Plane"} (${governanceCache.summary.agentControlPlaneBaselineSnapshotId})` : "not set"}`,
      `- Control plane baseline freshness: ${governanceCache?.summary.agentControlPlaneBaselineFreshness || "missing"} (${governanceCache?.summary.agentControlPlaneBaselineAgeHours ?? 0}h old, threshold ${governanceCache?.summary.agentControlPlaneBaselineFreshnessThresholdHours ?? 24}h)`,
      `- Control plane baseline drift score: ${governanceCache?.summary.agentControlPlaneBaselineDriftScore ?? 0}`,
      `- Control plane baseline drift severity: ${governanceCache?.summary.agentControlPlaneBaselineDriftSeverity || "missing-baseline"}`,
      `- Control plane baseline drift fields: ${baselineDriftItems.length ? baselineDriftItems.slice(0, 5).map((item) => `${item.label} ${item.before}->${item.current}`).join("; ") : "none"}`,
      `- Control plane baseline health: ${governanceCache?.summary.agentControlPlaneBaselineHealth || "missing"}`,
      `- Control plane baseline action: ${governanceCache?.summary.agentControlPlaneBaselineRecommendedAction || "Save or mark an Agent Control Plane snapshot as baseline."}`,
      `- Control plane decision: ${governanceCache?.agentControlPlaneDecision?.decision || "review"}`,
      `- Control plane release gate: ${governanceCache?.agentControlPlaneDecision?.releaseBuildGateDecision || governanceCache?.releaseBuildGate?.decision || "not-evaluated"} (risk ${governanceCache?.agentControlPlaneDecision?.releaseBuildGateRiskScore ?? governanceCache?.releaseBuildGate?.riskScore ?? 0})`,
      `- Control plane decision action: ${governanceCache?.agentControlPlaneDecision?.recommendedAction || "Review the Agent Control Plane before the next supervised build."}`,
      `- Control plane decision reasons: ${governanceCache?.agentControlPlaneDecision?.reasons?.length ? governanceCache.agentControlPlaneDecision.reasons.map((reason) => reason.code || reason.message).join(", ") : "none"}`,
      `- Data Sources access gate: ${governanceCache?.dataSourcesAccessGate?.decision || governanceCache?.summary.dataSourcesAccessGateDecision || "not-evaluated"}`,
      `- Data Sources access gate action: ${governanceCache?.dataSourcesAccessGate?.recommendedAction || "Evaluate Data Sources access before ingestion."}`,
      `- Data Sources access ready/review/blocked: ${governanceCache?.dataSourcesAccessGate?.ready ?? governanceCache?.summary.dataSourcesAccessReadyCount ?? 0}/${governanceCache?.dataSourcesAccessGate?.review ?? governanceCache?.summary.dataSourcesAccessReviewCount ?? 0}/${governanceCache?.dataSourcesAccessGate?.blocked ?? governanceCache?.summary.dataSourcesAccessBlockedCount ?? 0}`,
      `- Data Sources access review queue: ${governanceCache?.dataSourcesAccessReviewQueue?.summary?.total ?? governanceCache?.summary.dataSourcesAccessReviewQueueCount ?? 0}`,
      `- Data Sources access review priority: ${governanceCache?.dataSourcesAccessReviewQueue?.summary?.high ?? 0} high | ${governanceCache?.dataSourcesAccessReviewQueue?.summary?.medium ?? 0} medium | ${governanceCache?.dataSourcesAccessReviewQueue?.summary?.blocked ?? 0} blocked`,
      `- Data Sources access validation runbook: ${governanceCache?.summary.dataSourcesAccessValidationMethodCount ?? 0} method(s) across ${governanceCache?.summary.dataSourcesAccessValidationSourceCount ?? 0} source(s)`,
      `- Data Sources access validation review/blocked: ${governanceCache?.summary.dataSourcesAccessValidationReviewCount ?? 0}/${governanceCache?.summary.dataSourcesAccessValidationBlockedCount ?? 0}`,
      `- Data Sources access validation evidence: ${governanceCache?.summary.dataSourcesAccessValidationEvidenceValidatedCount ?? 0} validated / ${governanceCache?.summary.dataSourcesAccessValidationEvidenceCount ?? 0} total`,
      `- Data Sources access validation evidence review/blocked: ${governanceCache?.summary.dataSourcesAccessValidationEvidenceReviewCount ?? 0}/${governanceCache?.summary.dataSourcesAccessValidationEvidenceBlockedCount ?? 0}`,
      `- Data Sources access validation evidence coverage: ${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoverageCoveredCount ?? 0}/${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoverageCount ?? 0} covered (${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoveragePercent ?? 0}%)`,
      `- Data Sources access validation evidence coverage gaps: ${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoverageMissingCount ?? 0} missing | ${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoverageHighPriorityCount ?? 0} high priority`,
      `- Data Sources access tasks: ${governanceCache?.summary.dataSourcesAccessOpenTaskCount ?? 0} open / ${governanceCache?.summary.dataSourcesAccessTaskCount ?? 0} total`,
      `- Agent-ready projects: ${governanceCache?.summary.agentReadyProjects ?? 0}/${governanceCache?.summary.agentReadinessItems ?? 0}`,
      `- Work order snapshots: ${governanceCache?.summary.agentWorkOrderSnapshotCount ?? 0}`,
      `- SLA ledger snapshots: ${governanceCache?.summary.agentExecutionSlaLedgerSnapshotCount ?? 0}`,
      `- Agent execution runs: ${governanceCache?.summary.activeAgentWorkOrderRunCount ?? 0}/${governanceCache?.summary.agentWorkOrderRunCount ?? 0}`,
      `- Agent execution SLA ledger records: ${governanceCache?.summary.agentExecutionSlaLedgerCount ?? 0}`,
      `- Agent execution health: ${executionMetrics?.completionRate ?? 0}% complete | ${executionMetrics?.staleActive ?? 0} stale active after ${staleThresholdHours}h | ${executionMetrics?.slaBreached ?? 0} SLA breached | ${executionMetrics?.slaResolved ?? 0} SLA resolved | ${executionMetrics?.slaAverageResolutionHours ?? 0}h avg SLA resolution | ${executionMetrics?.failureRate ?? 0}% failure rate | ${executionMetrics?.archived ?? 0} archived`,
      `- Agent execution status filter: ${executionStatusFilter}`,
      `- Agent execution retention: keep ${executionRetention} completed run(s) before archiving`,
      `- Agent execution SLA: stale after ${staleThresholdHours} hour(s) for ${governanceExecutionPolicy.staleStatuses.join(", ")}`,
      `- Show archived execution runs: ${showArchivedExecution ? "yes" : "no"}`,
      `- Profile history snapshots: ${governance.profileHistory.length}`,
      "",
      "## Project Registry"
    ];

    if (governance.profiles.length) {
      for (const profile of governance.profiles) {
        lines.push(`- ${profile.projectName}: ${profile.owner || "Owner not set"} | ${profile.status} | ${profile.lifecycle} | ${profile.tier} | target ${profile.targetState}`);
        if (profile.summary) {
          lines.push(`  Summary: ${profile.summary}`);
        }
      }
    } else {
      lines.push("- No visible project profiles.");
    }

    lines.push("", "## Action Queue");
    if (governance.actionQueue.length) {
      for (const item of governance.actionQueue) {
        lines.push(`- ${item.projectName}: ${item.title} [${item.priority}]`);
        lines.push(`  Action: ${item.actionLabel} | Kind: ${item.kind}`);
        lines.push(`  Detail: ${item.detail}`);
      }
    } else {
      lines.push("- No visible action queue items.");
    }

    lines.push("", "## Suppressed Queue");
    if (governance.queueSuppressions.length) {
      for (const item of governance.queueSuppressions) {
        lines.push(`- ${item.projectName}: ${item.title} (${item.kind})`);
        lines.push(`  Reason: ${item.reason}`);
        lines.push(`  Suppressed at: ${new Date(item.suppressedAt).toLocaleString()}`);
      }
    } else {
      lines.push("- No visible suppressed queue items.");
    }

    lines.push("", "## Operation Log");
    if (governance.operationLog.length) {
      for (const operation of governance.operationLog) {
        lines.push(`- ${operation.summary} (${operation.type})`);
        lines.push(`  Actor: ${operation.actor || "workspace-audit"} | Created: ${new Date(operation.createdAt).toLocaleString()}`);
        if (operation.details && typeof operation.details === "object" && "totals" in operation.details) {
          lines.push(`  Totals: ${JSON.stringify(operation.details.totals)}`);
        }
      }
    } else {
      lines.push("- No visible operation log entries.");
    }

    lines.push("", "## Workflow Runbook");
    if (governance.workflowRunbook.length) {
      for (const item of governance.workflowRunbook) {
        lines.push(`- ${item.projectName}: ${item.title} (${item.phase} / ${item.status})`);
        lines.push(`  Readiness: ${item.readiness} | Priority: ${item.priority}`);
        lines.push(`  Next step: ${item.nextStep}`);
        lines.push(`  Blockers: ${item.blockers.length ? item.blockers.join(", ") : "none"}`);
      }
    } else {
      lines.push("- No visible workflow runbook items.");
    }

    lines.push("", "## Agent Sessions");
    if (governance.agentSessions.length) {
      for (const session of governance.agentSessions) {
        lines.push(`- ${session.projectName || "Portfolio"}: ${session.title} (${session.status || "prepared"})`);
        lines.push(`  Updated: ${new Date(session.updatedAt || session.createdAt).toLocaleString()}`);
        if (session.summary) {
          lines.push(`  Summary: ${session.summary}`);
        }
      }
    } else {
      lines.push("- No visible agent sessions.");
    }

    lines.push("", "## Control Plane Decision");
    if (governance.agentControlPlaneDecision) {
      lines.push(`- Decision: ${governance.agentControlPlaneDecision.decision || "review"}`);
      lines.push(`- Recommended action: ${governance.agentControlPlaneDecision.recommendedAction || "Review the Agent Control Plane before the next supervised build."}`);
      lines.push(`- Baseline health: ${governance.agentControlPlaneDecision.baselineHealth || "missing"}`);
      lines.push(`- Baseline drift severity: ${governance.agentControlPlaneDecision.baselineDriftSeverity || "missing-baseline"}`);
      lines.push(`- Agent-ready projects: ${governance.agentControlPlaneDecision.agentReadyProjects || 0}/${governance.agentControlPlaneDecision.agentReadinessItems || 0}`);
      lines.push(`- Release build gate: ${governance.agentControlPlaneDecision.releaseBuildGateDecision || governance.releaseBuildGate?.decision || "not-evaluated"} (risk ${governance.agentControlPlaneDecision.releaseBuildGateRiskScore ?? governance.releaseBuildGate?.riskScore ?? 0})`);
      lines.push(`- Active runs: ${governance.agentControlPlaneDecision.activeRuns || 0}, stale active: ${governance.agentControlPlaneDecision.staleActiveRuns || 0}, SLA breached: ${governance.agentControlPlaneDecision.slaBreachedRuns || 0}`);
      lines.push(`- Data Sources access tasks: ${governance.agentControlPlaneDecision.dataSourcesAccessOpenTaskCount || 0} open / ${governance.agentControlPlaneDecision.dataSourcesAccessTaskCount || 0} total`);
      const reasons = Array.isArray(governance.agentControlPlaneDecision.reasons) ? governance.agentControlPlaneDecision.reasons : [];
      if (reasons.length) {
        for (const reason of reasons.slice(0, 8)) {
          lines.push(`- Reason: ${(reason.severity || "review").toUpperCase()} ${reason.code || ""} ${reason.message || ""}`.trim());
        }
      }
    } else {
      lines.push("- No visible control plane decision.");
    }

    lines.push("", "## Data Sources Access Gate");
    if (governance.dataSourcesAccessGate) {
      lines.push(`- Decision: ${governance.dataSourcesAccessGate.decision || "not-evaluated"}`);
      lines.push(`- Recommended action: ${governance.dataSourcesAccessGate.recommendedAction || "Evaluate Data Sources access before ingestion."}`);
      lines.push(`- Ready/review/blocked: ${governance.dataSourcesAccessGate.ready || 0}/${governance.dataSourcesAccessGate.review || 0}/${governance.dataSourcesAccessGate.blocked || 0}`);
      lines.push(`- Token/OAuth likely: ${governance.dataSourcesAccessGate.tokenLikely || 0}`);
      lines.push(`- Certificate likely: ${governance.dataSourcesAccessGate.certificateLikely || 0}`);
      lines.push(`- Password/session likely: ${governance.dataSourcesAccessGate.passwordLikely || 0}`);
      const reasons = Array.isArray(governance.dataSourcesAccessGate.reasons) ? governance.dataSourcesAccessGate.reasons : [];
      if (reasons.length) {
        for (const reason of reasons.slice(0, 8)) {
          lines.push(`- Reason: ${(reason.severity || "review").toUpperCase()} ${reason.code || ""} ${reason.message || ""}`.trim());
        }
      }
    } else {
      lines.push("- No visible Data Sources access gate.");
    }

    lines.push("", "## Data Sources Access Review Queue");
    if (governance.dataSourcesAccessReviewQueue?.items?.length) {
      for (const item of governance.dataSourcesAccessReviewQueue.items) {
        lines.push(`- ${item.label}: ${item.title || "Source access review"} [${item.priority || "normal"} / ${item.status || "review"}]`);
        lines.push(`  Access method: ${item.accessMethod || "review-required"}`);
        lines.push(`  Action: ${item.action || "Review source access outside this app."}`);
        lines.push(`  Validation: ${item.validation || "Confirm access outside this app."}`);
        if (item.credentialHint) {
          lines.push(`  Credential hint: ${item.credentialHint}`);
        }
      }
    } else {
      lines.push("- No visible Data Sources access review queue items.");
    }

    lines.push("", "## Data Sources Access Validation Runbook");
    if (governance.dataSourcesAccessValidationRunbook?.methods?.length) {
      for (const method of governance.dataSourcesAccessValidationRunbook.methods) {
        lines.push(`- ${method.title || method.accessMethod || "Access validation method"}: ${(method.sources || []).length} source(s)`);
        if (method.commandHints?.length) {
          lines.push(`  Command hints: ${method.commandHints.join("; ")}`);
        }
        lines.push(`  Evidence: ${method.evidence || "Record non-secret validation evidence."}`);
      }
    } else {
      lines.push("- No visible Data Sources access validation runbook methods.");
    }

    lines.push("", "## Data Sources Access Validation Evidence Coverage");
    if (governance.dataSourcesAccessValidationEvidenceCoverage?.items?.length) {
      for (const item of governance.dataSourcesAccessValidationEvidenceCoverage.items) {
        lines.push(`- ${item.label || item.sourceId || "Source"}: ${item.coverageStatus || "missing"} [${item.priority || "medium"}]`);
        lines.push(`  Access method: ${item.accessMethod || "review-required"}`);
        lines.push(`  Latest evidence: ${item.latestEvidenceStatus || "missing"}`);
        lines.push(`  Action: ${item.action || "Record non-secret validation evidence after confirming access outside this app."}`);
      }
    } else {
      lines.push("- No visible Data Sources access validation evidence coverage items.");
    }

    lines.push("", "## Data Sources Access Validation Evidence");
    if (governance.dataSourceAccessValidationEvidence?.length) {
      for (const evidence of governance.dataSourceAccessValidationEvidence) {
        lines.push(`- ${evidence.sourceLabel || evidence.sourceId || "Source"}: ${evidence.status || "review"} (${evidence.accessMethod || "review-required"})`);
        lines.push(`  Evidence: ${evidence.evidence || "Non-secret evidence not provided."}`);
        if (evidence.commandHint) {
          lines.push(`  Command hint: ${evidence.commandHint}`);
        }
      }
    } else {
      lines.push("- No visible Data Sources access validation evidence records.");
    }

    lines.push("", "## Data Sources Access Validation Evidence Snapshots");
    if ((governance.dataSourceAccessValidationEvidenceSnapshots || []).length) {
      for (const snapshot of governance.dataSourceAccessValidationEvidenceSnapshots) {
        lines.push(`- ${snapshot.title}: ${snapshot.validatedCount || 0} validated / ${snapshot.total || 0} total (${snapshot.statusFilter || "all"})`);
        lines.push(`  Created: ${new Date(snapshot.createdAt).toLocaleString()}`);
      }
    } else {
      lines.push("- No visible Data Sources access validation evidence snapshots.");
    }

    lines.push("", "## Data Sources Access Validation Evidence Snapshot Drift");
    if (governance.dataSourceAccessValidationEvidenceSnapshotDiff) {
      const diff = governance.dataSourceAccessValidationEvidenceSnapshotDiff;
      lines.push(`- Snapshot: ${diff.snapshotTitle || "missing"}`);
      lines.push(`- Drift severity: ${diff.driftSeverity || "missing-snapshot"}`);
      lines.push(`- Drift score: ${diff.driftScore || 0}`);
      lines.push(`- Recommended action: ${diff.recommendedAction || "Save a source-access validation evidence snapshot before comparing drift."}`);
    } else {
      lines.push("- No visible Data Sources access validation evidence snapshot drift.");
    }

    lines.push("", "## Data Sources Access Task Ledger");
    if (governance.dataSourcesAccessTasks?.length) {
      for (const task of governance.dataSourcesAccessTasks) {
        lines.push(`- ${task.title}: ${task.status || "open"} / ${task.priority || "low"}`);
        lines.push(`  Source: ${task.sourceLabel || "Source"} (${task.sourceType || "source"})`);
        lines.push(`  Access method: ${task.accessMethod || "review-required"}`);
        if (task.description) {
          lines.push(`  Detail: ${String(task.description).split("\n")[0]}`);
        }
      }
    } else {
      lines.push("- No visible Data Sources access tasks.");
    }

    lines.push("", "## Data Sources Access Task Ledger Snapshots");
    if ((governance.dataSourceAccessTaskLedgerSnapshots || []).length) {
      for (const snapshot of governance.dataSourceAccessTaskLedgerSnapshots) {
        lines.push(`- ${snapshot.title}: ${snapshot.openCount || 0} open / ${snapshot.total || 0} total (${snapshot.statusFilter || "all"})`);
        lines.push(`  Created: ${new Date(snapshot.createdAt).toLocaleString()}`);
      }
    } else {
      lines.push("- No visible Data Sources access task ledger snapshots.");
    }

    lines.push("", "## Control Plane Decision Snapshots");
    if ((governance.agentControlPlaneDecisionSnapshots || []).length) {
      for (const snapshot of governance.agentControlPlaneDecisionSnapshots) {
        lines.push(`- ${snapshot.title}: ${snapshot.decision} (${snapshot.reasonCount} reason(s), drift ${snapshot.baselineDriftSeverity})`);
        lines.push(`  Created: ${new Date(snapshot.createdAt).toLocaleString()}`);
      }
    } else {
      lines.push("- No visible control plane decision snapshots.");
    }

    lines.push("", "## Control Plane Snapshots");
    if (governance.agentControlPlaneBaselineStatus) {
      lines.push(`- Baseline status: ${governance.agentControlPlaneBaselineStatus.hasBaseline ? "set" : "missing"}`);
      lines.push(`- Baseline freshness: ${governance.agentControlPlaneBaselineStatus.freshness} (${governance.agentControlPlaneBaselineStatus.ageHours}h old, threshold ${governance.agentControlPlaneBaselineStatus.freshnessThresholdHours}h)`);
      lines.push(`- Baseline drift score: ${governance.agentControlPlaneBaselineStatus.driftScore || 0}`);
      lines.push(`- Baseline drift severity: ${governance.agentControlPlaneBaselineStatus.driftSeverity || "missing-baseline"}`);
      lines.push(`- Baseline drift action: ${governance.agentControlPlaneBaselineStatus.driftRecommendedAction || "Save or mark an Agent Control Plane snapshot as baseline before using baseline-vs-live drift."}`);
      lines.push(`- Baseline health: ${governance.agentControlPlaneBaselineStatus.health || "missing"}`);
      lines.push(`- Baseline action: ${governance.agentControlPlaneBaselineStatus.recommendedAction || "Save or mark an Agent Control Plane snapshot as baseline."}`);
      const driftItems = Array.isArray(governance.agentControlPlaneBaselineStatus.driftItems) ? governance.agentControlPlaneBaselineStatus.driftItems : [];
      if (driftItems.length) {
        for (const item of driftItems.slice(0, 8)) {
          lines.push(`- Baseline drift field: ${item.label} ${item.before} -> ${item.current} (${item.delta > 0 ? "+" : ""}${item.delta})`);
        }
      }
    }
    if ((governance.agentControlPlaneSnapshots || []).length) {
      for (const snapshot of governance.agentControlPlaneSnapshots) {
        lines.push(`- ${snapshot.title}${snapshot.isBaseline ? " [baseline]" : ""}: ${snapshot.totalWorkOrders} work order(s), ${snapshot.totalExecutionRuns} execution run(s), ${snapshot.totalSlaLedgerRecords} SLA record(s)`);
        lines.push(`  Created: ${new Date(snapshot.createdAt).toLocaleString()}`);
      }
    } else {
      lines.push("- No visible control plane snapshots.");
    }

    lines.push("", "## Agent Readiness Matrix");
    if (governance.agentReadinessMatrix.length) {
      for (const item of governance.agentReadinessMatrix) {
        lines.push(`- ${item.projectName}: ${item.status} (${item.score}/100)`);
        lines.push(`  Evidence: ${item.openFindingCount} findings | ${item.openTaskCount} tasks | ${item.activeWorkflowCount} workflows | ${item.agentSessionCount} handoffs`);
        lines.push(`  Next step: ${item.nextStep}`);
        lines.push(`  Blockers: ${item.blockers.length ? item.blockers.join(", ") : "none"}`);
      }
    } else {
      lines.push("- No visible readiness items.");
    }

    lines.push("", "## Work Order Snapshots");
    if (governance.agentWorkOrderSnapshots.length) {
      for (const snapshot of governance.agentWorkOrderSnapshots) {
        lines.push(`- ${snapshot.title}: ${snapshot.total} order(s) (${snapshot.statusFilter})`);
        lines.push(`  Created: ${new Date(snapshot.createdAt).toLocaleString()}`);
        lines.push(`  Readiness split: ${snapshot.readyCount} ready | ${snapshot.needsPrepCount} needs prep | ${snapshot.blockedCount} blocked`);
      }
    } else {
      lines.push("- No visible work order snapshots.");
    }

    lines.push("", "## Agent Execution Metrics");
    lines.push(`- Status split: ${executionStatusCounts.queued ?? 0} queued | ${executionStatusCounts.running ?? 0} running | ${executionStatusCounts.blocked ?? 0} blocked | ${executionStatusCounts.passed ?? 0} passed | ${executionStatusCounts.failed ?? 0} failed | ${executionStatusCounts.cancelled ?? 0} cancelled`);
    lines.push(`- Active health: ${executionMetrics?.active ?? 0} active | ${executionMetrics?.staleActive ?? 0} stale active after ${staleThresholdHours}h | ${executionMetrics?.slaBreached ?? 0} SLA breached | ${executionMetrics?.slaResolved ?? 0} SLA resolved | ${executionMetrics?.slaAverageResolutionHours ?? 0}h avg SLA resolution | ${executionMetrics?.completionRate ?? 0}% complete | ${executionMetrics?.failureRate ?? 0}% failure rate | ${executionMetrics?.archived ?? 0} archived`);
    lines.push(`- SLA policy: stale after ${staleThresholdHours} hour(s) for ${governanceExecutionPolicy.staleStatuses.join(", ")}`);
    lines.push(`- Retention policy: keep ${executionRetention} completed run(s) before archiving older visible completed runs`);
    if (executionMetrics?.latestEventAt) {
      lines.push(`- Latest event: ${executionMetrics.latestEventProjectName}: ${executionMetrics.latestEventNote} (${new Date(executionMetrics.latestEventAt).toLocaleString()})`);
    } else {
      lines.push("- Latest event: none captured yet.");
    }

    lines.push("", "## Agent Execution Queue");
    if (governance.agentWorkOrderRuns.length) {
      for (const run of governance.agentWorkOrderRuns) {
        lines.push(`- ${run.projectName}: ${run.title} (${run.status})`);
        lines.push(`  Readiness: ${run.readinessStatus || "unset"} (${run.readinessScore}/100)`);
        lines.push(`  Archived: ${run.archivedAt ? `yes (${new Date(run.archivedAt).toLocaleString()})` : "no"}`);
        lines.push(`  SLA breached: ${run.slaBreachedAt ? `${run.slaResolvedAt ? "resolved" : "open"} (${new Date(run.slaBreachedAt).toLocaleString()}, ${run.slaAction || "actioned"}, count ${run.slaEscalationCount || 1}${run.slaResolvedAt ? `, resolved ${new Date(run.slaResolvedAt).toLocaleString()}` : ""})` : "no"}`);
        lines.push(`  Stale active: ${isStaleAgentWorkOrderRun(run, staleThresholdHours, governanceExecutionPolicy.staleStatuses) ? "yes" : "no"}`);
        lines.push(`  Objective: ${run.objective}`);
        lines.push(`  Validation: ${run.validationCommands.length ? run.validationCommands.join(" | ") : "none recorded"}`);
        lines.push(`  Blockers: ${run.blockers.length ? run.blockers.join(", ") : "none"}`);
        lines.push(`  Events: ${run.history.length}`);
        if (run.history.length) {
          lines.push(`  Latest event: ${run.history[0].note}`);
          lines.push("  Event timeline:");
          for (const event of run.history.slice(0, 5)) {
            lines.push(`  Event: ${event.status}${event.previousStatus ? ` from ${event.previousStatus}` : ""} | ${event.note} | ${new Date(event.createdAt).toLocaleString()}`);
          }
        }
      }
    } else {
      lines.push("- No visible agent execution runs.");
    }

    lines.push("", "## SLA Breach Ledger");
    if (governance.agentExecutionSlaLedger.length) {
      for (const item of governance.agentExecutionSlaLedger) {
        lines.push(`- ${item.projectName}: ${item.breachState} ${item.action || "breach"} on ${item.title} (${item.durationHours || 0}h)`);
      }
    } else {
      lines.push("- No SLA breach ledger entries.");
    }

    lines.push("", "## SLA Ledger Snapshots");
    if ((governance.agentExecutionSlaLedgerSnapshots || []).length) {
      for (const snapshot of governance.agentExecutionSlaLedgerSnapshots) {
        lines.push(`- ${snapshot.title}: ${snapshot.total} ledger record(s) (${snapshot.stateFilter})`);
        lines.push(`  Created: ${new Date(snapshot.createdAt).toLocaleString()}`);
        lines.push(`  State split: ${snapshot.openCount} open | ${snapshot.resolvedCount} resolved | ${snapshot.available} available`);
      }
    } else {
      lines.push("- No visible SLA ledger snapshots.");
    }

    lines.push("", "## Profile History");
    if (governance.profileHistory.length) {
      for (const entry of governance.profileHistory) {
        lines.push(`- ${entry.projectName}: ${entry.changeType} (${entry.changedFields.join(", ") || "snapshot"})`);
        lines.push(`  Changed at: ${new Date(entry.changedAt).toLocaleString()}`);
      }
    } else {
      lines.push("- No visible profile history.");
    }

    lines.push("", "## Governance Gaps");
    if (governance.unprofiledProjects.length) {
      for (const project of governance.unprofiledProjects) {
        lines.push(`- ${project.name}: ${project.category} | ${project.zone} | health ${project.qualityScore} | open findings ${project.findingCount}`);
        lines.push(`  Path: ${project.relPath}`);
      }
    } else {
      lines.push("- No visible unprofiled projects.");
    }

    lines.push("", "## Recent Activity");
    if (governance.recentActivity.length) {
      for (const item of governance.recentActivity) {
        lines.push(`- [${item.kind}] ${item.projectName}: ${item.title} (${item.status})`);
        if (item.detail) {
          lines.push(`  Detail: ${item.detail}`);
        }
      }
    } else {
      lines.push("- No visible recent activity.");
    }

    lines.push("", "## Decisions");
    if (governance.decisions.length) {
      for (const note of governance.decisions) {
        lines.push(`- ${note.projectName || "Portfolio"}: ${note.title}`);
        if (note.body) {
          lines.push(`  ${note.body}`);
        }
      }
    } else {
      lines.push("- No visible decision notes.");
    }

    lines.push("", "## Milestones");
    if (governance.milestoneFocus.length) {
      for (const milestone of governance.milestoneFocus) {
        lines.push(`- ${milestone.projectName || "Portfolio"}: ${milestone.title} (${milestone.status})${milestone.targetDate ? ` target ${milestone.targetDate}` : ""}`);
        if (milestone.detail) {
          lines.push(`  ${milestone.detail}`);
        }
      }
    } else {
      lines.push("- No visible milestones.");
    }

    lines.push("", "## Workflows");
    if (governance.workflowFocus.length) {
      for (const workflow of governance.workflowFocus) {
        lines.push(`- ${workflow.projectName || "Portfolio"}: ${workflow.title} (${workflow.phase} / ${workflow.status})`);
        if (workflow.brief) {
          lines.push(`  ${workflow.brief}`);
        }
      }
    } else {
      lines.push("- No visible workflows.");
    }

    return lines.filter(Boolean).join("\n");
  }

  function buildAgentWorkOrdersMarkdown() {
    const governance = getFilteredGovernance();
    if (!governance) {
      return "# Agent Work Orders\n\nGovernance data is not loaded.\n";
    }

    const lines = [
      "# Agent Work Orders",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Visible readiness items: ${governance.agentReadinessMatrix.length}`,
      "",
      "Use these work orders as supervised agent build instructions. Each order is derived from the current Governance readiness filters.",
      ""
    ];

    if (!governance.agentReadinessMatrix.length) {
      lines.push("No visible readiness items.");
      return lines.join("\n");
    }

    for (const item of governance.agentReadinessMatrix) {
      lines.push(`## ${item.projectName}`);
      lines.push("");
      lines.push(`- Project ID: ${item.projectId}`);
      lines.push(`- Relative path: ${item.relPath || "unknown"}`);
      lines.push(`- Readiness: ${item.status} (${item.score}/100)`);
      lines.push(`- Owner: ${item.owner || "Owner not set"}`);
      lines.push(`- Target state: ${item.targetState || "unset"}`);
      lines.push(`- Primary objective: ${item.nextStep}`);
      lines.push(`- Evidence: ${item.openFindingCount} findings | ${item.openTaskCount} tasks | ${item.activeWorkflowCount} workflows | ${item.agentSessionCount} handoffs`);
      lines.push(`- Blockers: ${item.blockers.length ? item.blockers.join(", ") : "none"}`);
      if (item.latestWorkflowTitle) {
        lines.push(`- Latest workflow: ${item.latestWorkflowTitle}`);
      }
      if (item.latestAgentSessionAt) {
        lines.push(`- Latest handoff: ${new Date(item.latestAgentSessionAt).toLocaleString()}`);
      }
      lines.push(`- Required next action: ${item.status === "ready" ? "Run a supervised build pass, validate, and record the outcome." : item.nextStep}`);
      lines.push("");
    }

    return lines.join("\n");
  }

  async function renderFindings() {
    const container = document.getElementById("findings-list");
    updatePanelState("findings", {
      status: "loading",
      itemCount: undefined,
      message: ""
    });
    renderPanelStatus("findings");
    container.replaceChildren(createPanelNotice({
      title: "Loading findings",
      message: "Fetching persisted findings and portfolio risks from the live server."
    }));

    try {
      const findings = await api.fetchFindings();
      if (!findings.length) {
        const refreshed = await api.refreshFindings();
        const generatedFindings = refreshed.findings;

        if (!generatedFindings.length) {
          updatePanelState("findings", {
            status: "empty",
            itemCount: 0,
            lastLoadedAt: new Date().toISOString(),
            message: "No findings generated."
          });
          renderPanelStatus("findings");
          container.replaceChildren(createPanelNotice({
            title: "No findings generated",
            message: "The current inventory did not produce persisted findings. Run another audit after broader workspace changes to refresh the risk model.",
            tone: "var(--warning)"
          }));
          return;
        }

        updatePanelState("findings", {
          status: "ready",
          itemCount: generatedFindings.length,
          lastLoadedAt: new Date().toISOString(),
          message: ""
        });
        renderPanelStatus("findings");
        const fragment = document.createDocumentFragment();
        for (const finding of generatedFindings) {
          fragment.append(createFindingItem(finding));
        }
        container.replaceChildren(fragment);
        return;
      }

      updatePanelState("findings", {
        status: "ready",
        itemCount: findings.length,
        lastLoadedAt: new Date().toISOString(),
        message: ""
      });
      renderPanelStatus("findings");
      const fragment = document.createDocumentFragment();
      for (const finding of findings) {
        fragment.append(createFindingItem(finding));
      }
      container.replaceChildren(fragment);
    } catch (error) {
      updatePanelState("findings", {
        status: "error",
        itemCount: undefined,
        lastLoadedAt: new Date().toISOString(),
        message: getErrorMessage(error)
      });
      renderPanelStatus("findings");
      container.replaceChildren(createPanelNotice({
        title: "Findings unavailable",
        message: getErrorMessage(error),
        tone: "var(--danger)"
      }));
    }
  }

  function syncMetaInfo() {
    const data = getData();
    const rootDir = data.rootDir || "workspace";
    const totalApps = data.summary?.totalApps ?? 0;
    document.getElementById("meta-info").textContent = `Analyzing ${rootDir} • ${totalApps} Microservices/Apps detected`;
  }

  function renderKPIs() {
    const data = getData();
    const summary = data.summary || {};
    const activeCount = summary.zoneCounts?.active || 0;
    const archivedCount = summary.zoneCounts?.archived || 0;
    const strongestTitle = summary.strongest ? `${summary.strongest.leftName} & ${summary.strongest.rightName}` : "";
    const strongestName = summary.strongest ? summary.strongest.leftName : "No data";
    const container = document.getElementById("kpi-container");

    const fragment = document.createDocumentFragment();
    fragment.append(
      createKpiCard({
        accentColor: "var(--primary)",
        label: "Active Deployments",
        value: String(activeCount),
        detail: `+ ${archivedCount} deep-archived apps`
      }),
      createKpiCard({
        accentColor: getColor(summary.avgQuality || 0),
        label: "Ecosystem Health",
        value: `${summary.avgQuality || 0}/100`,
        detail: `Heuristic score across ${summary.totalApps || 0} projects`,
        valueColor: getColor(summary.avgQuality || 0)
      }),
      createKpiCard({
        accentColor: "#8B5CF6",
        label: "Complexity Volume",
        value: `${(((summary.totalSource || 0) / 1000)).toFixed(1)}k`,
        detail: "Total source code files mapped"
      }),
      createKpiCard({
        accentColor: "var(--accent)",
        label: "Highest Convergence",
        value: summary.strongest ? `${summary.strongest.score}%` : "N/A",
        detail: strongestName,
        detailTitle: strongestTitle
      })
    );

    container.replaceChildren(fragment);
  }

  function renderFilters() {
    const data = getData();
    const state = getState();
    const zoneFilter = /** @type {HTMLSelectElement} */ (document.getElementById("zone-filter"));
    const categoryFilter = /** @type {HTMLSelectElement} */ (document.getElementById("cat-filter"));

    populateSelect(zoneFilter, {
      allLabel: "All Zones",
      options: data.meta?.zoneOptions || [],
      formatLabel: (zone) => zone.toUpperCase()
    });
    populateSelect(categoryFilter, {
      allLabel: "All Categories",
      options: data.meta?.categoryOptions || []
    });

    zoneFilter.value = (data.meta?.zoneOptions || []).includes(state.zone) ? state.zone : "all";
    categoryFilter.value = (data.meta?.categoryOptions || []).includes(state.category) ? state.category : "all";
    state.zone = zoneFilter.value;
    state.category = categoryFilter.value;
  }

  /**
   * @returns {AuditProject[]}
   */
  function filterAndSort() {
    const data = getData();
    const state = getState();
    return data.projects.filter((project) => {
      if (!state.showArchived && project.zone === "archived") return false;
      if (state.zone !== "all" && project.zone !== state.zone) return false;
      if (state.category !== "all" && project.category !== state.category) return false;

      if (!state.search) return true;

      const query = state.search.toLowerCase();
      return project.name.toLowerCase().includes(query)
        || project.description.toLowerCase().includes(query)
        || project.frameworks.join(" ").toLowerCase().includes(query)
        || project.relPath.toLowerCase().includes(query);
    }).sort((left, right) => {
      const leftValue = left[state.sortKey];
      const rightValue = right[state.sortKey];
      const modifier = state.sortDir === "asc" ? 1 : -1;
      if (typeof leftValue === "string" && typeof rightValue === "string") {
        return leftValue.localeCompare(rightValue) * modifier;
      }
      return (Number(leftValue) - Number(rightValue)) * modifier;
    });
  }

  /**
   * @param {import("./dashboard-types.js").PersistedDataSourcesSummarySnapshot[]} snapshots
   */
  function createDataSourcesSummarySnapshotSection(snapshots) {
    if (!snapshots.length) return null;
    const section = document.createElement("section");
    section.style.display = "flex";
    section.style.flexDirection = "column";
    section.style.gap = "0.75rem";
    section.style.marginTop = "1rem";

    const heading = document.createElement("div");
    heading.style.display = "flex";
    heading.style.justifyContent = "space-between";
    heading.style.alignItems = "center";
    heading.style.gap = "1rem";

    const title = document.createElement("div");
    title.textContent = "Data Sources Snapshot History";
    title.style.fontWeight = "800";
    title.style.color = "var(--text)";

    const count = document.createElement("div");
    count.textContent = `${snapshots.length} saved`;
    count.style.color = "var(--text-muted)";
    count.style.fontSize = "0.84rem";

    heading.append(title, count);
    section.append(heading);
    for (const snapshot of snapshots.slice(0, 8)) {
      section.append(createDataSourcesSummarySnapshotItem(snapshot));
    }
    return section;
  }

  /**
   * @param {import("./dashboard-types.js").DataSourcesAccessMatrixPayload} matrix
   */
  function createDataSourcesAccessMatrixSection(matrix) {
    const section = document.createElement("section");
    section.style.display = "flex";
    section.style.flexDirection = "column";
    section.style.gap = "0.75rem";
    section.style.marginTop = "1rem";

    const heading = document.createElement("div");
    heading.style.display = "flex";
    heading.style.justifyContent = "space-between";
    heading.style.alignItems = "center";
    heading.style.gap = "1rem";

    const title = document.createElement("div");
    title.textContent = "Data Sources Access Matrix";
    title.style.fontWeight = "800";
    title.style.color = "var(--text)";

    const summary = document.createElement("div");
    summary.textContent = `${matrix.summary.methodCount} method(s) | ${matrix.summary.reviewRequired} review | ${matrix.summary.tokenLikely} token/OAuth likely`;
    summary.style.color = "var(--text-muted)";
    summary.style.fontSize = "0.84rem";

    heading.append(title, summary);
    section.append(heading);

    for (const method of matrix.methods.slice(0, 8)) {
      const card = document.createElement("div");
      card.className = "source-access-matrix-card";
      card.style.display = "flex";
      card.style.justifyContent = "space-between";
      card.style.gap = "1rem";
      card.style.padding = "1rem";
      card.style.border = "1px solid var(--border)";
      card.style.borderRadius = "0.65rem";
      card.style.background = "var(--surface)";

      const body = document.createElement("div");
      const methodTitle = document.createElement("div");
      methodTitle.textContent = method.accessMethod;
      methodTitle.style.fontWeight = "800";
      methodTitle.style.color = "var(--text)";
      methodTitle.style.marginBottom = "0.25rem";

      const sourceList = document.createElement("div");
      sourceList.textContent = method.sources.slice(0, 4).map((source) => source.label).join(" | ") || "No sources";
      sourceList.style.color = "var(--text-muted)";
      sourceList.style.fontSize = "0.84rem";

      body.append(methodTitle, sourceList);

      const stats = document.createElement("div");
      stats.style.display = "flex";
      stats.style.flexDirection = "column";
      stats.style.alignItems = "flex-end";
      stats.style.gap = "0.25rem";
      stats.style.color = "var(--text-muted)";
      stats.style.fontSize = "0.82rem";
      for (const line of [
        `${method.total} source(s)`,
        `${method.reviewRequired} review`,
        `${method.tokenLikely} token | ${method.certificateLikely} cert | ${method.sshKeyLikely} SSH`
      ]) {
        const statLine = document.createElement("span");
        statLine.textContent = line;
        stats.append(statLine);
      }

      card.append(body, stats);
      section.append(card);
    }

    return section;
  }

  /**
   * @param {import("./dashboard-types.js").DataSourcesAccessReviewQueuePayload} queue
   */
  function createDataSourcesAccessReviewQueueSection(queue) {
    const section = document.createElement("section");
    section.className = "source-access-review-queue";
    section.style.display = "flex";
    section.style.flexDirection = "column";
    section.style.gap = "0.75rem";
    section.style.marginTop = "1rem";

    const heading = document.createElement("div");
    heading.style.display = "flex";
    heading.style.justifyContent = "space-between";
    heading.style.alignItems = "center";
    heading.style.gap = "1rem";

    const title = document.createElement("div");
    title.textContent = "Data Sources Access Review Queue";
    title.style.fontWeight = "800";
    title.style.color = "var(--text)";

    const summary = document.createElement("div");
    summary.textContent = `${queue.summary.total} item(s) | ${queue.summary.blocked} blocked | ${queue.summary.review} review`;
    summary.style.color = queue.summary.blocked ? "var(--danger)" : queue.summary.review ? "var(--warning)" : "var(--success)";
    summary.style.fontSize = "0.84rem";

    heading.append(title, summary);
    section.append(heading);

    if (!queue.items.length) {
      const empty = document.createElement("div");
      empty.textContent = "No source access review items. Continue monitoring before automated ingestion.";
      empty.style.padding = "1rem";
      empty.style.border = "1px solid var(--border)";
      empty.style.borderRadius = "0.65rem";
      empty.style.background = "var(--surface)";
      empty.style.color = "var(--text-muted)";
      section.append(empty);
      return section;
    }

    for (const item of queue.items.slice(0, 8)) {
      const card = document.createElement("div");
      card.className = "source-access-review-card";
      card.style.display = "flex";
      card.style.justifyContent = "space-between";
      card.style.gap = "1rem";
      card.style.padding = "1rem";
      card.style.border = "1px solid var(--border)";
      card.style.borderRadius = "0.65rem";
      card.style.background = "var(--surface)";
      card.style.borderLeft = `4px solid ${item.status === "blocked" ? "var(--danger)" : "var(--warning)"}`;

      const body = document.createElement("div");
      const itemTitle = document.createElement("div");
      itemTitle.textContent = item.title;
      itemTitle.style.fontWeight = "800";
      itemTitle.style.color = "var(--text)";
      itemTitle.style.marginBottom = "0.25rem";

      const action = document.createElement("div");
      action.textContent = item.action;
      action.style.color = "var(--text-muted)";
      action.style.fontSize = "0.84rem";

      const validation = document.createElement("div");
      validation.textContent = `Validate: ${item.validation}`;
      validation.style.color = "var(--text-muted)";
      validation.style.fontSize = "0.78rem";
      validation.style.marginTop = "0.25rem";

      body.append(itemTitle, action, validation);

      const meta = document.createElement("div");
      meta.style.display = "flex";
      meta.style.flexDirection = "column";
      meta.style.alignItems = "flex-end";
      meta.style.gap = "0.25rem";
      meta.style.color = "var(--text-muted)";
      meta.style.fontSize = "0.82rem";
      for (const line of [
        item.status.toUpperCase(),
        item.priority.toUpperCase(),
        item.accessMethod
      ]) {
        const metaLine = document.createElement("span");
        metaLine.textContent = line;
        meta.append(metaLine);
      }

      card.append(body, meta);
      section.append(card);
    }

    return section;
  }

  /**
   * @param {import("./dashboard-types.js").DataSourcesAccessValidationEvidenceCoveragePayload} coverage
   */
  function createDataSourcesAccessValidationEvidenceCoverageSection(coverage) {
    const section = document.createElement("section");
    section.className = "source-evidence-coverage-deck";
    section.style.display = "flex";
    section.style.flexDirection = "column";
    section.style.gap = "0.75rem";
    section.style.marginTop = "1rem";

    const heading = document.createElement("div");
    heading.style.display = "flex";
    heading.style.justifyContent = "space-between";
    heading.style.alignItems = "center";
    heading.style.gap = "1rem";

    const title = document.createElement("div");
    title.textContent = "Data Sources Evidence Coverage";
    title.style.fontWeight = "800";
    title.style.color = "var(--text)";

    const summary = document.createElement("div");
    summary.textContent = `${coverage.summary.covered}/${coverage.summary.sourceCount} covered | ${coverage.summary.missing} missing | ${coverage.summary.highPriority} high priority`;
    summary.style.color = coverage.summary.blocked || coverage.summary.highPriority
      ? "var(--danger)"
      : coverage.summary.missing || coverage.summary.review
        ? "var(--warning)"
        : "var(--success)";
    summary.style.fontSize = "0.84rem";

    heading.append(title, summary);
    section.append(heading);

    if (!coverage.items.length) {
      const empty = document.createElement("div");
      empty.textContent = "No source evidence coverage items found.";
      empty.style.padding = "1rem";
      empty.style.border = "1px solid var(--border)";
      empty.style.borderRadius = "0.65rem";
      empty.style.background = "var(--surface)";
      empty.style.color = "var(--text-muted)";
      section.append(empty);
      return section;
    }

    for (const item of coverage.items.slice(0, 10)) {
      const card = document.createElement("div");
      card.className = "source-evidence-coverage-card";
      card.style.display = "flex";
      card.style.justifyContent = "space-between";
      card.style.gap = "1rem";
      card.style.padding = "1rem";
      card.style.border = "1px solid var(--border)";
      card.style.borderRadius = "0.65rem";
      card.style.background = "var(--surface)";
      card.style.borderLeft = `4px solid ${item.coverageStatus === "blocked" || item.priority === "high" ? "var(--danger)" : item.coverageStatus === "covered" ? "var(--success)" : "var(--warning)"}`;

      const body = document.createElement("div");
      body.style.display = "flex";
      body.style.flexDirection = "column";
      body.style.gap = "0.35rem";

      const cardTitle = document.createElement("div");
      cardTitle.textContent = item.label || item.sourceId || "Source evidence coverage";
      cardTitle.style.fontWeight = "800";
      cardTitle.style.color = "var(--text)";

      const action = document.createElement("div");
      action.textContent = item.action || "Record non-secret validation evidence after confirming access outside this app.";
      action.style.color = "var(--text-muted)";
      action.style.fontSize = "0.84rem";
      action.style.lineHeight = "1.45";

      const evidence = document.createElement("div");
      evidence.textContent = item.latestEvidenceSummary
        ? `Latest evidence: ${item.latestEvidenceSummary}`
        : `Latest evidence: ${item.latestEvidenceStatus || "missing"}`;
      evidence.style.color = "var(--text-muted)";
      evidence.style.fontSize = "0.78rem";
      evidence.style.lineHeight = "1.4";

      body.append(cardTitle, action, evidence);

      const meta = document.createElement("div");
      meta.style.display = "flex";
      meta.style.flexDirection = "column";
      meta.style.alignItems = "flex-end";
      meta.style.gap = "0.25rem";
      meta.style.color = "var(--text-muted)";
      meta.style.fontSize = "0.82rem";
      for (const line of [
        (item.coverageStatus || "missing").toUpperCase(),
        (item.priority || "medium").toUpperCase(),
        item.accessMethod || "review-required"
      ]) {
        const metaLine = document.createElement("span");
        metaLine.textContent = line;
        meta.append(metaLine);
      }

      card.append(body, meta);
      section.append(card);
    }

    return section;
  }

  /**
   * @param {import("./dashboard-types.js").DeploymentHealthPayload} deploymentHealth
   */
  function createDeploymentHealthSection(deploymentHealth) {
    const section = document.createElement("section");
    section.className = "deployment-health-deck";
    section.style.display = "flex";
    section.style.flexDirection = "column";
    section.style.gap = "0.75rem";
    section.style.marginTop = "1rem";

    const heading = document.createElement("div");
    heading.style.display = "flex";
    heading.style.justifyContent = "space-between";
    heading.style.alignItems = "center";
    heading.style.gap = "1rem";

    const title = document.createElement("div");
    title.textContent = "Deployment Health";
    title.style.fontWeight = "800";
    title.style.color = "var(--text)";

    const providerSummary = Object.entries(deploymentHealth.summary.providerCounts || {})
      .map(([provider, count]) => `${provider}: ${count}`)
      .join(" | ") || "no deployment providers";
    const smokeSummary = `${deploymentHealth.summary.pass || 0} pass / ${deploymentHealth.summary.fail || 0} fail / ${deploymentHealth.summary.checked || 0} checked`;
    const summary = document.createElement("div");
    summary.textContent = `${deploymentHealth.summary.total} target(s) | ${deploymentHealth.summary.protectedLikely} protected/review likely | ${smokeSummary} | ${providerSummary}`;
    summary.style.color = deploymentHealth.summary.fail ? "var(--danger)" : deploymentHealth.summary.protectedLikely ? "var(--warning)" : "var(--text-muted)";
    summary.style.fontSize = "0.84rem";

    heading.append(title, summary);
    section.append(heading);

    const policy = document.createElement("div");
    policy.textContent = "Smoke checks capture URL, HTTP status, content type, latency, and error class only. Do not paste passwords, tokens, private keys, certificates, cookies, browser sessions, or response bodies.";
    policy.style.padding = "0.85rem 1rem";
    policy.style.border = "1px solid var(--border)";
    policy.style.borderRadius = "0.65rem";
    policy.style.background = "var(--surface)";
    policy.style.color = "var(--text-muted)";
    policy.style.fontSize = "0.82rem";
    policy.style.lineHeight = "1.45";
    section.append(policy);

    if (!deploymentHealth.targets.length) {
      const empty = document.createElement("div");
      empty.textContent = "No deployment targets detected in Data Sources yet. Add public app deployment URLs to track smoke-checkable app endpoints.";
      empty.style.padding = "1rem";
      empty.style.border = "1px solid var(--border)";
      empty.style.borderRadius = "0.65rem";
      empty.style.background = "var(--surface)";
      empty.style.color = "var(--text-muted)";
      section.append(empty);
    }

    for (const target of deploymentHealth.targets.slice(0, 10)) {
      const targetColor = target.sourceHealth === "blocked"
        ? "var(--danger)"
        : target.protectedLikely
          ? "var(--warning)"
          : "var(--success)";
      const card = document.createElement("div");
      card.className = "deployment-health-card";
      card.style.display = "flex";
      card.style.justifyContent = "space-between";
      card.style.gap = "1rem";
      card.style.padding = "1rem";
      card.style.border = "1px solid var(--border)";
      card.style.borderRadius = "0.65rem";
      card.style.background = "var(--surface)";
      card.style.borderLeft = `4px solid ${targetColor}`;

      const body = document.createElement("div");
      body.style.display = "flex";
      body.style.flexDirection = "column";
      body.style.gap = "0.35rem";
      body.style.minWidth = "0";

      const cardTitle = document.createElement("div");
      cardTitle.textContent = target.label || target.host || "Deployment target";
      cardTitle.style.fontWeight = "800";
      cardTitle.style.color = "var(--text)";

      const link = document.createElement("a");
      link.textContent = target.url;
      link.href = target.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.style.color = "var(--primary)";
      link.style.fontFamily = "var(--font-mono)";
      link.style.fontSize = "0.82rem";
      link.style.overflowWrap = "anywhere";

      const meta = document.createElement("div");
      meta.textContent = `${target.provider || "deployment"} | ${target.sourceHealth || "review"} / ${target.sourceStatus || "registered"} | ${target.accessMethod || "url-review"}${target.protectedLikely ? " | protected/review likely" : ""}`;
      meta.style.color = "var(--text-muted)";
      meta.style.fontSize = "0.82rem";

      const latestSmokeCheck = target.latestSmokeCheck || null;
      const latest = document.createElement("div");
      latest.textContent = latestSmokeCheck
        ? `Latest smoke: ${(latestSmokeCheck.status || "fail").toUpperCase()} HTTP ${latestSmokeCheck.httpStatus || "unreachable"} | ${latestSmokeCheck.latencyMs || 0}ms | ${latestSmokeCheck.checkedAt || "not recorded"}`
        : "Latest smoke: not checked";
      latest.style.color = latestSmokeCheck?.status === "pass" ? "var(--success)" : latestSmokeCheck ? "var(--danger)" : "var(--text-muted)";
      latest.style.fontSize = "0.82rem";

      body.append(cardTitle, link, meta, latest);

      const action = document.createElement("div");
      action.style.display = "flex";
      action.style.flexDirection = "column";
      action.style.alignItems = "flex-end";
      action.style.gap = "0.4rem";

      const provider = document.createElement("span");
      provider.textContent = (target.provider || "deployment").toUpperCase();
      provider.style.color = targetColor;
      provider.style.fontWeight = "800";
      provider.style.fontSize = "0.78rem";

      const button = document.createElement("button");
      button.className = "btn governance-action-btn deployment-smoke-check-btn";
      button.type = "button";
      button.textContent = "Smoke Check";
      button.dataset.deploymentSmokeTargetId = target.id;
      button.dataset.deploymentSmokeTargetLabel = target.label || target.host || target.url;

      action.append(provider, button);
      card.append(body, action);
      section.append(card);
    }

    const recentSmokeChecks = deploymentHealth.recentSmokeChecks || [];
    const recent = document.createElement("div");
    recent.className = "deployment-smoke-check-ledger";
    recent.style.display = "flex";
    recent.style.flexDirection = "column";
    recent.style.gap = "0.5rem";
    recent.style.padding = "1rem";
    recent.style.border = "1px solid var(--border)";
    recent.style.borderRadius = "0.65rem";
    recent.style.background = "var(--surface)";

    const recentTitle = document.createElement("div");
    recentTitle.textContent = "Recent Smoke Checks";
    recentTitle.style.fontWeight = "800";
    recentTitle.style.color = "var(--text)";
    recent.append(recentTitle);

    if (!recentSmokeChecks.length) {
      const emptyRecent = document.createElement("div");
      emptyRecent.textContent = "No deployment smoke checks recorded yet.";
      emptyRecent.style.color = "var(--text-muted)";
      emptyRecent.style.fontSize = "0.82rem";
      recent.append(emptyRecent);
    } else {
      for (const smokeCheck of recentSmokeChecks.slice(0, 6)) {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.gap = "1rem";
        row.style.fontSize = "0.82rem";

        const label = document.createElement("span");
        label.textContent = `${smokeCheck.label || smokeCheck.host || "Deployment"} | HTTP ${smokeCheck.httpStatus || "unreachable"} | ${smokeCheck.latencyMs || 0}ms`;
        label.style.color = "var(--text-muted)";
        label.style.overflowWrap = "anywhere";

        const status = document.createElement("span");
        status.textContent = (smokeCheck.status || "fail").toUpperCase();
        status.style.color = smokeCheck.status === "pass" ? "var(--success)" : "var(--danger)";
        status.style.fontWeight = "800";

        row.append(label, status);
        recent.append(row);
      }
    }
    section.append(recent);

    return section;
  }

  /**
   * @param {HTMLElement} container
   * @param {import("./dashboard-types.js").PersistedDataSourcesSummarySnapshot[]} snapshots
   */
  function bindDataSourcesSummarySnapshotActions(container, snapshots) {
    container.querySelectorAll("[data-source-summary-snapshot-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.sourceSummarySnapshotId || "";
        const snapshot = snapshots.find((item) => item.id === snapshotId);
        if (!snapshot) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copied";
          await copyText(snapshot.markdown);
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });
  }

  /**
   * @param {HTMLElement} container
   * @param {import("./dashboard-types.js").DataSourceHealthRecord[]} sources
   */
  function bindSourceRegistryActions(container, sources) {
    container.querySelectorAll("[data-source-remove-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const sourceId = element.dataset.sourceRemoveId || "";
        const source = sources.find((item) => item.id === sourceId);
        if (!sourceId || !source) return;

        const shouldRemove = window.confirm(`Remove ${source.label || sourceId} from the registry? This does not delete local files or remote resources.`);
        if (!shouldRemove) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Removing";
          await api.deleteSource(sourceId);
          await renderSources();
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });
  }

  /**
   * @param {HTMLElement} container
   */
  function bindDeploymentHealthActions(container) {
    container.querySelectorAll("[data-deployment-smoke-target-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const targetId = element.dataset.deploymentSmokeTargetId || "";
        if (!targetId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Checking";
          const result = await api.runDeploymentSmokeCheck({ targetId });
          element.textContent = result.smokeCheck.ok
            ? `Pass ${result.smokeCheck.httpStatus}`
            : result.smokeCheck.httpStatus
              ? `Fail ${result.smokeCheck.httpStatus}`
              : "Fail";
          await renderSources();
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });
  }

  async function renderSources() {
    const container = document.getElementById("sources-list");
    updatePanelState("sources", {
      status: "loading",
      itemCount: undefined,
      message: ""
    });
    renderPanelStatus("sources");
    container.replaceChildren(createPanelNotice({
      title: "Loading sources",
      message: "Fetching tracked source locations from the live server."
    }));
    try {
      const [sourcesPayload, accessMatrix, accessReviewQueue, accessValidationEvidenceCoverage, deploymentHealth, snapshots] = await Promise.all([
        api.fetchSourcesSummary(),
        api.fetchSourcesAccessMatrix(),
        api.fetchSourcesAccessReviewQueue(),
        api.fetchSourcesAccessValidationEvidenceCoverage(),
        api.fetchDeploymentHealth(),
        api.fetchSourcesSummarySnapshots()
      ]);
      const sources = sourcesPayload.sources || [];
      if (!sources.length) {
        updatePanelState("sources", {
          status: "empty",
          itemCount: 0,
          lastLoadedAt: new Date().toISOString(),
          message: "No sources configured."
        });
        renderPanelStatus("sources");
        const emptyFragment = document.createDocumentFragment();
        emptyFragment.append(createPanelNotice({
          title: "No sources configured",
          message: "Add a local folder or remote workspace source to start tracking it in the dashboard.",
          tone: "var(--warning)"
        }));
        emptyFragment.append(createDeploymentHealthSection(deploymentHealth));
        container.replaceChildren(emptyFragment);
        bindDeploymentHealthActions(container);
        return;
      }

      updatePanelState("sources", {
        status: sourcesPayload.summary.blocked ? "error" : "ready",
        itemCount: sources.length,
        lastLoadedAt: new Date().toISOString(),
        message: sourcesPayload.summary.blocked
          ? `${sourcesPayload.summary.blocked} blocked source(s) need attention.`
          : `${sourcesPayload.summary.ready} ready, ${sourcesPayload.summary.review} review.`
      });
      renderPanelStatus("sources");
      const fragment = document.createDocumentFragment();
      for (const source of sources) {
        fragment.append(createSourceItem(source));
      }
      fragment.append(createDeploymentHealthSection(deploymentHealth));
      fragment.append(createDataSourcesAccessValidationEvidenceCoverageSection(accessValidationEvidenceCoverage));
      fragment.append(createDataSourcesAccessReviewQueueSection(accessReviewQueue));
      fragment.append(createDataSourcesAccessMatrixSection(accessMatrix));
      const snapshotSection = createDataSourcesSummarySnapshotSection(snapshots || []);
      if (snapshotSection) {
        fragment.append(snapshotSection);
      }
      container.replaceChildren(fragment);
      bindSourceRegistryActions(container, sources);
      bindDeploymentHealthActions(container);
      bindDataSourcesSummarySnapshotActions(container, snapshots || []);
    } catch (error) {
      updatePanelState("sources", {
        status: "error",
        itemCount: undefined,
        lastLoadedAt: new Date().toISOString(),
        message: getErrorMessage(error)
      });
      renderPanelStatus("sources");
      container.replaceChildren(createPanelNotice({
        title: "Sources unavailable",
        message: getErrorMessage(error),
        tone: "var(--danger)"
      }));
    }
  }

  async function renderTrends() {
    const container = document.getElementById("trends-charts");
    updatePanelState("trends", {
      status: "loading",
      itemCount: undefined,
      message: ""
    });
    renderPanelStatus("trends");
    container.replaceChildren(createPanelNotice({
      title: "Loading historical trends",
      message: "Fetching saved snapshot history from the live server."
    }));

    try {
      const [historyData, scanDiff] = await Promise.all([
        api.fetchHistory(),
        api.fetchScanDiff()
      ]);
      if (!historyData?.length) {
        updatePanelState("trends", {
          status: "empty",
          itemCount: 0,
          lastLoadedAt: new Date().toISOString(),
          message: "No historical snapshots found."
        });
        renderPanelStatus("trends");
        container.replaceChildren(createPanelNotice({
          title: "No historical data found",
          message: "Run the audit again to create snapshot history for the trends view.",
          tone: "var(--warning)"
        }));
        return;
      }

      const earliest = historyData[0].summary;
      const latest = historyData[historyData.length - 1].summary;
      updatePanelState("trends", {
        status: "ready",
        itemCount: historyData.length,
        lastLoadedAt: new Date().toISOString(),
        message: ""
      });
      renderPanelStatus("trends");
      container.replaceChildren(
        createTrendDiffSummary(scanDiff),
        createScanDiffBreakdown(scanDiff),
        createTrendSummaryGrid(earliest, latest),
        createTrendHistory(historyData)
      );
    } catch (error) {
      updatePanelState("trends", {
        status: "error",
        itemCount: undefined,
        lastLoadedAt: new Date().toISOString(),
        message: getErrorMessage(error)
      });
      renderPanelStatus("trends");
      container.replaceChildren(createPanelNotice({
        title: "Trend data unavailable",
        message: `${getErrorMessage(error)}. This view requires the live server.`,
        tone: "var(--danger)"
      }));
    }
  }

  async function renderGovernance() {
    const container = document.getElementById("governance-panels");
    if (!container) return;
    bindGovernanceControls();
    updatePanelState("governance", {
      status: "loading",
      itemCount: undefined,
      message: ""
    });
    renderPanelStatus("governance");
    container.replaceChildren(createPanelNotice({
      title: "Loading governance state",
      message: "Rolling up persisted decisions, milestones, workflows, tasks, and findings from the live store."
    }));

    try {
      const [governance, executionViews, executionPolicy, releaseSummary, releaseCheckpointDrift, releaseBuildGate] = await Promise.all([
        api.fetchGovernance(),
        api.fetchGovernanceExecutionViews(),
        api.fetchGovernanceExecutionPolicy(),
        api.fetchReleaseSummary(),
        api.fetchReleaseCheckpointDrift("latest"),
        api.fetchReleaseBuildGate()
      ]);
      governanceCache = {
        ...governance,
        releaseSummary,
        releaseCheckpointDrift,
        releaseBuildGate
      };
      governanceExecutionViews = executionViews;
      renderGovernanceExecutionViewOptions();
      applyGovernanceExecutionPolicyToControls(executionPolicy || governance.agentExecutionPolicy || governanceExecutionPolicy);
      const itemCount = governance.recentActivity.length
        + governance.workflowFocus.length
        + governance.milestoneFocus.length
        + governance.decisions.length
        + governance.profiles.length
        + governance.profileHistory.length
        + governance.actionQueue.length
        + governance.queueSuppressions.length
        + governance.operationLog.length
        + governance.workflowRunbook.length
        + governance.agentSessions.length
        + (governance.agentControlPlaneBaselineStatus ? 1 : 0)
        + (governance.agentControlPlaneDecision ? 1 : 0)
        + (governance.dataSourcesAccessGate ? 1 : 0)
        + (governance.dataSourcesAccessReviewQueue?.items || []).length
        + (governance.dataSourcesAccessValidationRunbook?.methods || []).length
        + (governance.dataSourceAccessValidationEvidence || []).length
        + (governance.dataSourceAccessValidationEvidenceSnapshots || []).length
        + (governance.dataSourceAccessValidationEvidenceSnapshotDiff ? 1 : 0)
        + (governance.dataSourcesAccessTasks || []).length
        + (governance.dataSourceAccessTaskLedgerSnapshots || []).length
        + (governance.agentControlPlaneDecisionSnapshots || []).length
        + (governance.agentControlPlaneSnapshots || []).length
        + governance.agentReadinessMatrix.length
        + governance.agentWorkOrderSnapshots.length
        + (governance.agentExecutionSlaLedgerSnapshots || []).length
        + governance.agentWorkOrderRuns.length
        + governance.unprofiledProjects.length
        + (releaseSummary ? 1 : 0)
        + (releaseSummary?.checkpoints || []).length
        + (releaseCheckpointDrift ? 1 : 0)
        + (releaseCheckpointDrift?.driftItems || []).length
        + (releaseBuildGate ? 1 : 0)
        + (releaseBuildGate?.reasons || []).length
        + (releaseBuildGate?.actions || []).length;

      if (!itemCount) {
        updatePanelState("governance", {
          status: "empty",
          itemCount: 0,
          lastLoadedAt: new Date().toISOString(),
          message: "No governance records found."
        });
        renderPanelStatus("governance");
        container.replaceChildren(createPanelNotice({
          title: "No governance records",
          message: "Persist notes, milestones, tasks, workflows, or agent handoff sessions from the project workbench to populate this portfolio governance layer.",
          tone: "var(--warning)"
        }));
        return;
      }

      updatePanelState("governance", {
        status: "ready",
        itemCount,
        lastLoadedAt: new Date().toISOString(),
        message: ""
      });
      renderPanelStatus("governance");
      renderGovernanceFromCache();
    } catch (error) {
      governanceCache = null;
      updatePanelState("governance", {
        status: "error",
        itemCount: undefined,
        lastLoadedAt: new Date().toISOString(),
        message: getErrorMessage(error)
      });
      renderPanelStatus("governance");
      container.replaceChildren(createPanelNotice({
        title: "Governance data unavailable",
        message: `${getErrorMessage(error)}. This view requires the live server.`,
        tone: "var(--danger)"
      }));
    }
  }

  /**
   * @param {"profiles" | "starter-pack"} mode
   */
  async function bootstrapGovernance(mode) {
    const governance = getFilteredGovernance();
    const projectIds = governance?.unprofiledProjects.map((project) => project.id) || [];
    if (!projectIds.length) {
      throw new Error("No visible governance gaps are available for bootstrapping.");
    }

    await api.bootstrapGovernance({ mode, projectIds });
    await renderGovernance();
  }

  async function executeVisibleGovernanceQueue() {
    const items = getVisibleGovernanceQueue()
      .filter((item) => item.actionType !== "open-project")
      .map((item) => ({
        id: item.id,
        projectId: item.projectId,
        projectName: item.projectName,
        kind: item.kind,
        actionType: item.actionType
      }));

    if (!items.length) {
      throw new Error("No executable visible queue items are available. Ownership items require opening the workbench manually.");
    }

    await api.executeGovernanceQueue({ items });
    await renderGovernance();
  }

  async function suppressVisibleGovernanceQueue() {
    const items = getVisibleGovernanceQueue().map((item) => ({
      id: item.id,
      projectId: item.projectId,
      projectName: item.projectName,
      kind: item.kind,
      title: item.title
    }));

    if (!items.length) {
      throw new Error("No visible queue items are available for suppression.");
    }

    await api.suppressGovernanceQueue({
      items,
      reason: "Suppressed from the Governance view"
    });
    await renderGovernance();
  }

  async function startVisibleQueuedAgentWorkOrderRuns() {
    const queuedRuns = (getFilteredGovernance()?.agentWorkOrderRuns || [])
      .filter((run) => run.status === "queued");
    if (!queuedRuns.length) {
      throw new Error("No visible queued Agent Execution runs are available to start.");
    }

    for (const run of queuedRuns) {
      await api.updateAgentWorkOrderRun(run.id, {
        status: "running",
        notes: "Started queued run from Governance toolbar."
      });
    }
    await renderGovernance();
  }

  async function blockVisibleStaleAgentWorkOrderRuns() {
    const staleThresholdHours = getGovernanceFilterState().staleThresholdHours || governanceExecutionPolicy.staleThresholdHours;
    const staleRuns = (getFilteredGovernance()?.agentWorkOrderRuns || [])
      .filter((run) => isStaleAgentWorkOrderRun(run, staleThresholdHours, governanceExecutionPolicy.staleStatuses));
    if (!staleRuns.length) {
      throw new Error("No visible stale Agent Execution runs are available to block.");
    }

    for (const run of staleRuns) {
      await api.updateAgentWorkOrderRun(run.id, {
        status: "blocked",
        notes: "Blocked stale active run from Governance toolbar."
      });
    }
    await renderGovernance();
  }

  async function saveAgentExecutionPolicy() {
    const filters = getGovernanceFilterState();
    const result = await api.saveGovernanceExecutionPolicy({
      staleThresholdHours: Number.isFinite(filters.staleThresholdHours) ? filters.staleThresholdHours : governanceExecutionPolicy.staleThresholdHours
    });
    applyGovernanceExecutionPolicyToControls(result.policy);
    await renderGovernance();
  }

  async function actionVisibleSlaBreaches() {
    const staleThresholdHours = getGovernanceFilterState().staleThresholdHours || governanceExecutionPolicy.staleThresholdHours;
    const staleRuns = (getFilteredGovernance()?.agentWorkOrderRuns || [])
      .filter((run) => isStaleAgentWorkOrderRun(run, staleThresholdHours, governanceExecutionPolicy.staleStatuses));
    if (!staleRuns.length) {
      throw new Error("No visible Agent Execution SLA breaches are available to action.");
    }

    await api.actionAgentWorkOrderRunSlaBreaches({
      action: "escalated",
      runIds: staleRuns.map((run) => run.id)
    });
    await renderGovernance();
  }

  async function resolveVisibleSlaBreaches() {
    const breachedRuns = (getFilteredGovernance()?.agentWorkOrderRuns || [])
      .filter((run) => run.slaBreachedAt && !run.slaResolvedAt && !run.archivedAt);
    if (!breachedRuns.length) {
      throw new Error("No visible unresolved Agent Execution SLA breaches are available to resolve.");
    }

    await api.resolveAgentWorkOrderRunSlaBreaches({
      runIds: breachedRuns.map((run) => run.id)
    });
    await renderGovernance();
  }

  async function retryVisibleTerminalAgentWorkOrderRuns() {
    const terminalRuns = (getFilteredGovernance()?.agentWorkOrderRuns || [])
      .filter((run) => ["failed", "cancelled"].includes(run.status) && !run.archivedAt);
    if (!terminalRuns.length) {
      throw new Error("No visible failed or cancelled Agent Execution runs are available to retry.");
    }

    for (const run of terminalRuns) {
      await api.updateAgentWorkOrderRun(run.id, {
        status: "queued",
        notes: "Retried terminal run from Governance toolbar."
      });
    }
    await renderGovernance();
  }

  async function archiveVisibleCompletedAgentWorkOrderRuns() {
    const completedRuns = (getFilteredGovernance()?.agentWorkOrderRuns || [])
      .filter((run) => ["passed", "failed", "cancelled"].includes(run.status) && !run.archivedAt);
    if (!completedRuns.length) {
      throw new Error("No visible completed Agent Execution runs are available to archive.");
    }

    for (const run of completedRuns) {
      await api.updateAgentWorkOrderRun(run.id, {
        archived: true,
        notes: "Archived completed run from Governance toolbar."
      });
    }
    await renderGovernance();
  }

  async function applyVisibleAgentExecutionRetention() {
    const filters = getGovernanceFilterState();
    const retainCompleted = Number.isFinite(filters.executionRetention) ? filters.executionRetention : 25;
    const completedRuns = (getFilteredGovernance()?.agentWorkOrderRuns || [])
      .filter((run) => ["passed", "failed", "cancelled"].includes(run.status) && !run.archivedAt);
    if (!completedRuns.length) {
      throw new Error("No visible completed Agent Execution runs are available for retention.");
    }
    if (completedRuns.length <= retainCompleted) {
      throw new Error(`Visible completed Agent Execution runs do not exceed the retention limit of ${retainCompleted}.`);
    }

    await api.applyAgentWorkOrderRunRetention({
      retainCompleted,
      runIds: completedRuns.map((run) => run.id)
    });
    await renderGovernance();
  }

  async function saveGovernanceExecutionView() {
    const filters = getGovernanceFilterState();
    const result = await api.saveGovernanceExecutionView({
      title: buildGovernanceExecutionViewTitle(filters),
      search: filters.search,
      scope: filters.scope,
      sort: filters.sort,
      executionStatus: filters.executionStatus,
      executionRetention: Number.isFinite(filters.executionRetention) ? filters.executionRetention : 25,
      showArchivedExecution: filters.showArchivedExecution
    });
    governanceExecutionViews = result.governanceExecutionViews;
    renderGovernanceExecutionViewOptions();
    const select = /** @type {HTMLSelectElement | null} */ (document.getElementById("governance-execution-saved-view"));
    if (select) select.value = result.view.id;
    await renderGovernance();
  }

  function hideContentViews() {
    document.getElementById("app-grid").style.display = "none";
    document.getElementById("app-table-wrapper").style.display = "none";
    document.getElementById("app-graph-wrapper").style.display = "none";
    document.getElementById("app-findings-wrapper").style.display = "none";
    document.getElementById("app-trends-wrapper").style.display = "none";
    document.getElementById("app-sources-wrapper").style.display = "none";
    document.getElementById("app-governance-wrapper").style.display = "none";
  }

  function renderApps() {
    const apps = filterAndSort();
    const state = getState();
    const grid = document.getElementById("app-grid");
    const tableWrapper = document.getElementById("app-table-wrapper");
    const tableBody = document.getElementById("app-table-body");

    hideContentViews();

    if (state.view === "grid") {
      grid.style.display = "grid";
      if (!apps.length) {
        grid.replaceChildren(createEmptyCard("No apps matched", "Adjust the current filters or include archived projects to broaden the inventory view."));
        return;
      }

      const fragment = document.createDocumentFragment();
      for (const project of apps) {
        fragment.append(createAppCard(project));
      }
      grid.replaceChildren(fragment);
      bindAppLaunchers(grid, openModal);
      return;
    }

    if (state.view === "table") {
      tableWrapper.style.display = "block";
      if (!apps.length) {
        tableBody.replaceChildren(createEmptyTableRow("No apps matched the current filters."));
        return;
      }

      const fragment = document.createDocumentFragment();
      for (const project of apps) {
        fragment.append(createAppTableRow(project));
      }
      tableBody.replaceChildren(fragment);
      bindAppLaunchers(tableBody, openModal);
      return;
    }

    if (state.view === "graph") {
      document.getElementById("app-graph-wrapper").style.display = "block";
      graphRenderer.renderGraph(apps);
      return;
    }

    if (state.view === "findings") {
      document.getElementById("app-findings-wrapper").style.display = "block";
      void renderFindings();
      return;
    }

    if (state.view === "trends") {
      document.getElementById("app-trends-wrapper").style.display = "block";
      void renderTrends();
      return;
    }

    if (state.view === "sources") {
      document.getElementById("app-sources-wrapper").style.display = "block";
      void renderSources();
      return;
    }

    if (state.view === "governance") {
      document.getElementById("app-governance-wrapper").style.display = "block";
      void renderGovernance();
    }
  }

  function renderDashboard() {
    syncMetaInfo();
    renderRuntimeStatus();
    renderPanelStatus("findings");
    renderPanelStatus("trends");
    renderPanelStatus("sources");
    renderPanelStatus("governance");
    renderKPIs();
    renderFilters();
    renderApps();
  }

  function exportCsv() {
    const apps = filterAndSort();
    let csv = "App Name,Description,Path,Zone,Category,Health Score,Files,Lines of Code,Stack\n";
    for (const project of apps) {
      csv += `"${(project.name || "").replace(/"/g, '""')}","${(project.description || "").replace(/"/g, '""')}","${project.relPath}","${project.zone}","${project.category}",${project.qualityScore},${project.sourceFiles},${project.sourceLines},"${project.frameworks.join(", ")}"\n`;
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "workspace-pro-export.csv";
    anchor.click();
  }

  function exportGovernanceReport() {
    const markdown = buildGovernanceReportMarkdown();
    const blob = new Blob([markdown], { type: "text/markdown" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "workspace-governance-report.md";
    anchor.click();
  }

  async function copyGovernanceSummary() {
    const summary = buildGovernanceSummaryText();
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(summary);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = summary;
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  async function copySourcesSummary() {
    const payload = await api.fetchSourcesSummary();
    await copyText(payload.markdown);
    return `Copied ${payload.summary.total} source${payload.summary.total === 1 ? "" : "s"}`;
  }

  async function copySourcesAccessRequirements() {
    const payload = await api.fetchSourcesAccessRequirements();
    await copyText(payload.markdown);
    return `Copied ${payload.summary.reviewRequired} review`;
  }

  async function copySourcesAccessChecklist() {
    const payload = await api.fetchSourcesAccessChecklist();
    await copyText(payload.markdown);
    return `Copied ${payload.summary.review} review`;
  }

  async function copySourcesAccessValidationRunbook() {
    const payload = await api.fetchSourcesAccessValidationRunbook();
    await copyText(payload.markdown);
    return `Copied ${payload.summary.methodCount} validation method${payload.summary.methodCount === 1 ? "" : "s"}`;
  }

  async function copySourcesAccessValidationEvidence() {
    const payload = await api.fetchSourcesAccessValidationEvidence({ status: "all", limit: 100 });
    await copyText(payload.markdown);
    return `Copied ${payload.summary.total} evidence record${payload.summary.total === 1 ? "" : "s"}`;
  }

  async function copySourcesAccessValidationEvidenceCoverage() {
    const payload = await api.fetchSourcesAccessValidationEvidenceCoverage();
    await copyText(payload.markdown);
    return `Copied ${payload.summary.covered}/${payload.summary.sourceCount} covered`;
  }

  async function copySourcesDeploymentHealth() {
    const payload = await api.fetchDeploymentHealth();
    await copyText(payload.markdown);
    return `Copied ${payload.summary.total} deployment target${payload.summary.total === 1 ? "" : "s"}`;
  }

  async function copySourcesDeploymentSmokeChecks() {
    const payload = await api.fetchDeploymentSmokeChecks();
    await copyText(payload.markdown);
    return `Copied ${payload.summary.total} smoke check${payload.summary.total === 1 ? "" : "s"}`;
  }

  async function copySourcesAccessMatrix() {
    const payload = await api.fetchSourcesAccessMatrix();
    await copyText(payload.markdown);
    return `Copied ${payload.summary.methodCount} access method${payload.summary.methodCount === 1 ? "" : "s"}`;
  }

  async function copySourcesAccessReviewQueue() {
    const payload = await api.fetchSourcesAccessReviewQueue();
    await copyText(payload.markdown);
    return `Copied ${payload.summary.total} review item${payload.summary.total === 1 ? "" : "s"}`;
  }

  async function copySourcesAccessGate() {
    const payload = await api.fetchSourcesAccessGate();
    await copyText(payload.markdown);
    return `Copied ${payload.decision.toUpperCase()}`;
  }

  async function saveSourcesSummarySnapshot() {
    const created = await api.createSourcesSummarySnapshot({
      title: "Data Sources Health Summary"
    });
    await renderSources();
    return `Saved ${created.snapshot.total} source${created.snapshot.total === 1 ? "" : "s"}`;
  }

  async function copyLatestSourcesSummarySnapshotDrift() {
    const diff = await api.fetchSourcesSummarySnapshotDiff("latest");
    await copyText(diff.markdown);
    return diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : "No Drift";
  }

  async function copyAgentWorkOrders() {
    const markdown = buildAgentWorkOrdersMarkdown();
    const created = await api.createAgentWorkOrderSnapshot({
      title: "Agent Work Orders",
      status: "all",
      limit: 24
    });
    const snapshotMarkdown = created.snapshot.markdown || markdown;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(snapshotMarkdown);
      await renderGovernance();
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = snapshotMarkdown;
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    await renderGovernance();
  }

  async function copyAgentExecutionBriefs() {
    const markdown = buildAgentExecutionBriefPack();
    await copyText(markdown);
  }

  async function copyAgentControlPlane() {
    const payload = await api.fetchAgentControlPlane({ limit: 24 });
    await copyText(payload.markdown);
  }

  async function copyReleaseControl() {
    const payload = await api.fetchReleaseSummary();
    await copyText(payload.markdown);
    return `Copied ${payload.summary.releaseCheckpointCount} release checkpoint${payload.summary.releaseCheckpointCount === 1 ? "" : "s"}`;
  }

  async function copyReleaseCheckpointDrift() {
    const payload = await api.fetchReleaseCheckpointDrift("latest");
    await copyText(payload.markdown);
    return payload.hasSnapshot ? `Copied ${formatDriftSeverityLabel(payload.driftSeverity)}` : "No Release Checkpoint";
  }

  async function copyReleaseBuildGate() {
    const payload = await api.fetchReleaseBuildGate();
    await copyText(payload.markdown);
    return `Copied ${payload.decision || "review"} release build gate`;
  }

  async function bootstrapReleaseBuildGateLocalEvidence() {
    const payload = await api.bootstrapReleaseBuildGateLocalEvidence({
      label: "Local Workspace Audit app",
      title: "Local release gate checkpoint",
      notes: "Bootstrap local non-secret release gate evidence from Governance."
    });
    await renderGovernance();
    const smokeStatus = payload.smokeCheck?.status || "not-run";
    return `Bootstrapped release gate evidence: smoke ${smokeStatus}`;
  }

  async function seedReleaseBuildGateActionTasks() {
    const actions = (getFilteredGovernance()?.releaseBuildGate?.actions || [])
      .filter((action) => action.status !== "ready");
    if (!actions.length) return "No Gate Tasks";
    const payload = await api.createReleaseBuildGateActionTasks({ actions });
    await renderGovernance();
    return `Created ${payload.totals.created} Release Task${payload.totals.created === 1 ? "" : "s"}`;
  }

  async function saveReleaseCheckpoint() {
    const payload = await api.fetchReleaseSummary();
    const created = await api.createReleaseCheckpoint({
      title: `Release checkpoint ${payload.git.commitShort || new Date().toISOString()}`,
      status: payload.summary.status
    });
    await renderGovernance();
    return `Saved ${created.checkpoint.status.toUpperCase()} release`;
  }

  async function copyLatestAgentControlPlaneSnapshotDrift() {
    const diff = await api.fetchAgentControlPlaneSnapshotDiff("latest");
    await copyText(diff.markdown);
    return diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : "No Drift";
  }

  async function copyBaselineAgentControlPlaneSnapshotDrift() {
    const diff = await api.fetchAgentControlPlaneSnapshotDiff("baseline");
    await copyText(diff.markdown);
    return diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : "No Drift";
  }

  async function copyAgentControlPlaneBaselineStatus() {
    const status = await api.fetchAgentControlPlaneBaselineStatus();
    await copyText(status.markdown);
  }

  async function copyAgentControlPlaneDecision() {
    const decision = await api.fetchAgentControlPlaneDecision();
    await copyText(decision.markdown);
    return `Copied ${(decision.decision || "review").toUpperCase()}`;
  }

  async function clearAgentControlPlaneBaselineSnapshot() {
    await api.clearAgentControlPlaneBaselineSnapshot();
    await renderGovernance();
  }

  async function refreshAgentControlPlaneBaselineSnapshot() {
    await api.refreshAgentControlPlaneBaselineSnapshot({
      title: "Agent Control Plane Baseline Refresh",
      limit: 24
    });
    await renderGovernance();
  }

  async function copySlaBreachLedger() {
    const markdown = buildSlaBreachLedgerMarkdown();
    await copyText(markdown);
  }

  async function copyGovernanceDataSourcesAccessReviewQueue() {
    const markdown = buildGovernanceDataSourcesAccessReviewQueueMarkdown();
    await copyText(markdown);
    return `Copied ${getFilteredGovernance()?.dataSourcesAccessReviewQueue?.items?.length || 0} source access item${(getFilteredGovernance()?.dataSourcesAccessReviewQueue?.items?.length || 0) === 1 ? "" : "s"}`;
  }

  async function copyGovernanceDataSourcesAccessGate() {
    const markdown = buildGovernanceDataSourcesAccessGateMarkdown();
    await copyText(markdown);
    return `Copied ${(getFilteredGovernance()?.dataSourcesAccessGate?.decision || "hidden").toUpperCase()}`;
  }

  async function seedGovernanceDataSourcesAccessReviewTasks() {
    const items = getFilteredGovernance()?.dataSourcesAccessReviewQueue?.items || [];
    if (!items.length) return "No Source Tasks";
    const result = await api.createSourcesAccessReviewTasks({ items });
    await renderGovernance();
    return `Created ${result.totals.created} Task${result.totals.created === 1 ? "" : "s"}`;
  }

  async function seedGovernanceDataSourcesAccessValidationEvidenceCoverageTasks() {
    const items = (getFilteredGovernance()?.dataSourcesAccessValidationEvidenceCoverage?.items || [])
      .filter((item) => item.coverageStatus !== "covered");
    if (!items.length) return "No Evidence Tasks";
    const result = await api.createSourcesAccessValidationEvidenceCoverageTasks({ items });
    await renderGovernance();
    return `Created ${result.totals.created} Evidence Task${result.totals.created === 1 ? "" : "s"}`;
  }

  async function copyGovernanceDataSourcesAccessTaskLedger() {
    const markdown = buildGovernanceDataSourcesAccessTaskLedgerMarkdown();
    await copyText(markdown);
    return `Copied ${getFilteredGovernance()?.dataSourcesAccessTasks?.length || 0} Task${(getFilteredGovernance()?.dataSourcesAccessTasks?.length || 0) === 1 ? "" : "s"}`;
  }

  async function copyLatestDataSourcesAccessTaskLedgerSnapshotDrift() {
    const diff = await api.fetchSourcesAccessTaskLedgerSnapshotDiff("latest");
    await copyText(diff.markdown);
    return diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : diff.hasSnapshot ? "No Drift" : "No Snapshot";
  }

  async function copyLatestDataSourcesAccessValidationEvidenceSnapshotDrift() {
    const diff = await api.fetchSourcesAccessValidationEvidenceSnapshotDiff("latest");
    await copyText(diff.markdown);
    return diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : diff.hasSnapshot ? "No Drift" : "No Snapshot";
  }

  async function saveAgentWorkOrderSnapshot() {
    await api.createAgentWorkOrderSnapshot({
      title: "Agent Work Orders",
      status: "all",
      limit: 24
    });
    await renderGovernance();
  }

  async function saveSlaLedgerSnapshot() {
    const executionStatus = getGovernanceFilterState().executionStatus;
    const state = executionStatus === "sla-breached" ? "open" : executionStatus === "sla-resolved" ? "resolved" : "all";
    await api.createAgentExecutionSlaLedgerSnapshot({
      title: "SLA Breach Ledger",
      state,
      limit: 24
    });
    await renderGovernance();
  }

  async function saveDataSourcesAccessTaskLedgerSnapshot() {
    await api.createSourcesAccessTaskLedgerSnapshot({
      title: "Data Sources Access Task Ledger",
      status: "all",
      limit: 24
    });
    await renderGovernance();
  }

  async function saveDataSourcesAccessValidationEvidenceSnapshot() {
    await api.createSourcesAccessValidationEvidenceSnapshot({
      title: "Data Sources Access Validation Evidence",
      status: "all",
      limit: 24
    });
    await renderGovernance();
  }

  async function saveAgentControlPlaneSnapshot() {
    await api.createAgentControlPlaneSnapshot({
      title: "Agent Control Plane",
      limit: 24
    });
    await renderGovernance();
  }

  async function saveAgentControlPlaneDecisionSnapshot() {
    await api.createAgentControlPlaneDecisionSnapshot({
      title: "Agent Control Plane Decision"
    });
    await renderGovernance();
  }

  async function saveAgentControlPlaneBaselineSnapshot() {
    await api.createAgentControlPlaneSnapshot({
      title: "Agent Control Plane Baseline",
      limit: 24,
      baseline: true
    });
    await renderGovernance();
  }

  return {
    blockVisibleStaleAgentWorkOrderRuns,
    archiveVisibleCompletedAgentWorkOrderRuns,
    actionVisibleSlaBreaches,
    resolveVisibleSlaBreaches,
    applyVisibleAgentExecutionRetention,
    copyAgentControlPlane,
    copyReleaseControl,
    copyReleaseCheckpointDrift,
    copyReleaseBuildGate,
    bootstrapReleaseBuildGateLocalEvidence,
    seedReleaseBuildGateActionTasks,
    saveReleaseCheckpoint,
    copyLatestAgentControlPlaneSnapshotDrift,
    copyBaselineAgentControlPlaneSnapshotDrift,
    copyAgentControlPlaneBaselineStatus,
    copyAgentControlPlaneDecision,
    clearAgentControlPlaneBaselineSnapshot,
    refreshAgentControlPlaneBaselineSnapshot,
    copyAgentExecutionBriefs,
    copyAgentWorkOrders,
    copySourcesSummary,
    copySourcesAccessRequirements,
    copySourcesAccessChecklist,
    copySourcesAccessValidationRunbook,
    copySourcesAccessValidationEvidence,
    copySourcesAccessValidationEvidenceCoverage,
    copySourcesDeploymentHealth,
    copySourcesDeploymentSmokeChecks,
    copySourcesAccessMatrix,
    copySourcesAccessReviewQueue,
    copySourcesAccessGate,
    copyGovernanceDataSourcesAccessGate,
    copyGovernanceDataSourcesAccessReviewQueue,
    seedGovernanceDataSourcesAccessReviewTasks,
    seedGovernanceDataSourcesAccessValidationEvidenceCoverageTasks,
    copyGovernanceDataSourcesAccessTaskLedger,
    saveDataSourcesAccessTaskLedgerSnapshot,
    copyLatestDataSourcesAccessTaskLedgerSnapshotDrift,
    saveDataSourcesAccessValidationEvidenceSnapshot,
    copyLatestDataSourcesAccessValidationEvidenceSnapshotDrift,
    saveSourcesSummarySnapshot,
    copyLatestSourcesSummarySnapshotDrift,
    copySlaBreachLedger,
    copyGovernanceSummary,
    exportCsv,
    bootstrapGovernance,
    executeVisibleGovernanceQueue,
    exportGovernanceReport,
    renderApps,
    renderDashboard,
    renderFindings,
    renderGovernance,
    renderRuntimeStatus,
    retryVisibleTerminalAgentWorkOrderRuns,
    saveAgentWorkOrderSnapshot,
    saveAgentControlPlaneSnapshot,
    saveAgentControlPlaneDecisionSnapshot,
    saveAgentControlPlaneBaselineSnapshot,
    saveSlaLedgerSnapshot,
    saveAgentExecutionPolicy,
    saveGovernanceExecutionView,
    startVisibleQueuedAgentWorkOrderRuns,
    renderTrends,
    renderSources,
    suppressVisibleGovernanceQueue
  };
}
