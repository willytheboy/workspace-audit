// @ts-check

/**
 * @template T
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<T>}
 */
async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === "string" ? payload : payload?.error || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return /** @type {T} */ (payload);
}

/**
 * @param {string} url
 * @param {Record<string, string | undefined | null>} query
 */
function withQuery(url, query) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === "") continue;
    search.set(key, value);
  }
  const queryString = search.toString();
  return queryString ? `${url}?${queryString}` : url;
}

/**
 * @returns {import("./dashboard-types.js").AuditPayload | null}
 */
function readEmbeddedInventory() {
  const script = document.getElementById("workspace-audit-bootstrap");
  if (!(script instanceof HTMLScriptElement)) {
    return null;
  }

  try {
    return JSON.parse(script.textContent || "null");
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<{ payload: import("./dashboard-types.js").AuditPayload, source: import("./dashboard-types.js").InventorySource }>}
 */
async function fetchInventoryWithSource() {
  try {
    return {
      payload: await fetchJson("/api/inventory"),
      source: "api"
    };
  } catch (apiError) {
    try {
      return {
        payload: await fetchJson("./inventory.json"),
        source: "file"
      };
    } catch {
      const embedded = readEmbeddedInventory();
      if (embedded) {
        return { payload: embedded, source: "embedded" };
      }
      throw apiError;
    }
  }
}

export const dashboardApi = {
  getEmbeddedInventory() {
    return readEmbeddedInventory();
  },

  fetchInventoryWithSource,

  /**
   * @returns {Promise<import("./dashboard-types.js").AuditPayload>}
   */
  async fetchInventory() {
    return (await fetchInventoryWithSource()).payload;
  },

  runAudit() {
    return fetchJson("/api/audit", { method: "POST" });
  },

  /**
   * @returns {Promise<Array<{ date: string, summary: import("./dashboard-types.js").AuditSummary }>>}
   */
  fetchHistory() {
    return fetchJson("/api/history");
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").ScanDiffPayload>}
   */
  fetchScanDiff() {
    return fetchJson("/api/scans/diff");
  },

  /**
   * @param {string} [projectId]
   * @returns {Promise<import("./dashboard-types.js").PersistedFinding[]>}
   */
  fetchFindings(projectId) {
    return fetchJson(withQuery("/api/findings", { projectId }));
  },

  /**
   * @returns {Promise<{ success: true, findings: import("./dashboard-types.js").PersistedFinding[] }>}
   */
  refreshFindings() {
    return fetchJson("/api/findings/refresh", { method: "POST" });
  },

  /**
   * @returns {Promise<Array<{ type: string, url?: string, path?: string, addedAt?: string }>>}
   */
  fetchSources() {
    return fetchJson("/api/sources");
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").DataSourcesSummaryPayload>}
   */
  fetchSourcesSummary() {
    return fetchJson("/api/sources/summary");
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").DeploymentHealthPayload>}
   */
  fetchDeploymentHealth() {
    return fetchJson("/api/deployments/health");
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").DeploymentSmokeChecksPayload>}
   */
  fetchDeploymentSmokeChecks() {
    return fetchJson("/api/deployments/smoke-checks");
  },

  /**
   * @param {{ url?: string, targetId?: string, label?: string, allowLocal?: boolean, timeoutMs?: number }} payload
   * @returns {Promise<{ success: true, smokeCheck: import("./dashboard-types.js").DeploymentSmokeCheckRecord, deploymentSmokeCheckCount: number, governanceOperationCount: number }>}
   */
  runDeploymentSmokeCheck(payload) {
    return fetchJson("/api/deployments/smoke-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").ReleaseSummaryPayload>}
   */
  fetchReleaseSummary() {
    return fetchJson("/api/releases/summary");
  },

  /**
   * @param {{ title?: string, status?: "ready" | "review" | "hold", notes?: string }} [payload]
   * @returns {Promise<{ success: true, checkpoint: import("./dashboard-types.js").ReleaseCheckpointRecord, releaseCheckpointCount: number, governanceOperationCount: number }>}
   */
  createReleaseCheckpoint(payload = {}) {
    return fetchJson("/api/releases/checkpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").DataSourcesAccessRequirementsPayload>}
   */
  fetchSourcesAccessRequirements() {
    return fetchJson("/api/sources/access-requirements");
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").DataSourcesAccessChecklistPayload>}
   */
  fetchSourcesAccessChecklist() {
    return fetchJson("/api/sources/access-checklist");
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").DataSourcesAccessValidationRunbookPayload>}
   */
  fetchSourcesAccessValidationRunbook() {
    return fetchJson("/api/sources/access-validation-runbook");
  },

  /**
   * @param {{ status?: "all" | "validated" | "review" | "blocked", sourceId?: string, accessMethod?: string, limit?: number }} [options]
   * @returns {Promise<import("./dashboard-types.js").DataSourcesAccessValidationEvidencePayload>}
   */
  fetchSourcesAccessValidationEvidence(options = {}) {
    const params = new URLSearchParams();
    if (options.status) params.set("status", options.status);
    if (options.sourceId) params.set("sourceId", options.sourceId);
    if (options.accessMethod) params.set("accessMethod", options.accessMethod);
    if (options.limit) params.set("limit", String(options.limit));
    const query = params.toString();
    return fetchJson(`/api/sources/access-validation-evidence${query ? `?${query}` : ""}`);
  },

  /**
   * @param {{ sourceId: string, status?: "validated" | "review" | "blocked", accessMethod?: string, evidence: string, commandHint?: string, checkedAt?: string }} payload
   * @returns {Promise<{ success: true, evidence: import("./dashboard-types.js").DataSourcesAccessValidationEvidenceRecord, taskSync?: { updated: number, taskIds: string[] }, ledger: import("./dashboard-types.js").DataSourcesAccessValidationEvidencePayload }>}
   */
  createSourcesAccessValidationEvidence(payload) {
    return fetchJson("/api/sources/access-validation-evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").DataSourcesAccessValidationEvidenceCoveragePayload>}
   */
  fetchSourcesAccessValidationEvidenceCoverage() {
    return fetchJson("/api/sources/access-validation-evidence-coverage");
  },

  /**
   * @param {{ items?: import("./dashboard-types.js").DataSourcesAccessValidationEvidenceCoverageItem[] }} [payload]
   * @returns {Promise<{ success: true, requested: number, createdTasks: import("./dashboard-types.js").PersistedTask[], skipped: Array<{ id: string, label: string, reason: string }>, totals: { requested: number, created: number, skipped: number }, tasks: import("./dashboard-types.js").PersistedTask[] }>}
   */
  createSourcesAccessValidationEvidenceCoverageTasks(payload = {}) {
    return fetchJson("/api/sources/access-validation-evidence-coverage/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedDataSourcesAccessValidationEvidenceSnapshot[]>}
   */
  fetchSourcesAccessValidationEvidenceSnapshots() {
    return fetchJson("/api/sources/access-validation-evidence-snapshots");
  },

  /**
   * @param {{ title?: string, status?: "all" | "validated" | "review" | "blocked", sourceId?: string, accessMethod?: string, limit?: number }} [payload]
   * @returns {Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedDataSourcesAccessValidationEvidenceSnapshot, dataSourceAccessValidationEvidenceSnapshots: import("./dashboard-types.js").PersistedDataSourcesAccessValidationEvidenceSnapshot[] }>}
   */
  createSourcesAccessValidationEvidenceSnapshot(payload = {}) {
    return fetchJson("/api/sources/access-validation-evidence-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} [snapshotId]
   * @returns {Promise<import("./dashboard-types.js").DataSourcesAccessValidationEvidenceSnapshotDiffPayload>}
   */
  fetchSourcesAccessValidationEvidenceSnapshotDiff(snapshotId = "latest") {
    return fetchJson(withQuery("/api/sources/access-validation-evidence-snapshots/diff", { snapshotId }));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").DataSourcesAccessMatrixPayload>}
   */
  fetchSourcesAccessMatrix() {
    return fetchJson("/api/sources/access-matrix");
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").DataSourcesAccessReviewQueuePayload>}
   */
  fetchSourcesAccessReviewQueue() {
    return fetchJson("/api/sources/access-review-queue");
  },

  /**
   * @param {{ items?: import("./dashboard-types.js").DataSourcesAccessReviewQueueItem[] }} [payload]
   * @returns {Promise<{ success: true, requested: number, createdTasks: import("./dashboard-types.js").PersistedTask[], skipped: Array<{ id: string, label: string, reason: string }>, totals: { requested: number, created: number, skipped: number }, tasks: import("./dashboard-types.js").PersistedTask[] }>}
   */
  createSourcesAccessReviewTasks(payload = {}) {
    return fetchJson("/api/sources/access-review-queue/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {"all" | "open" | "closed"} [status]
   * @returns {Promise<import("./dashboard-types.js").DataSourcesAccessTaskLedgerPayload>}
   */
  fetchSourcesAccessTaskLedger(status = "all") {
    return fetchJson(withQuery("/api/sources/access-task-ledger", { status }));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedDataSourcesAccessTaskLedgerSnapshot[]>}
   */
  fetchSourcesAccessTaskLedgerSnapshots() {
    return fetchJson("/api/sources/access-task-ledger-snapshots");
  },

  /**
   * @param {{ title?: string, status?: "all" | "open" | "closed", limit?: number }} [payload]
   * @returns {Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedDataSourcesAccessTaskLedgerSnapshot, dataSourceAccessTaskLedgerSnapshots: import("./dashboard-types.js").PersistedDataSourcesAccessTaskLedgerSnapshot[] }>}
   */
  createSourcesAccessTaskLedgerSnapshot(payload = {}) {
    return fetchJson("/api/sources/access-task-ledger-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} [snapshotId]
   * @returns {Promise<import("./dashboard-types.js").DataSourcesAccessTaskLedgerSnapshotDiffPayload>}
   */
  fetchSourcesAccessTaskLedgerSnapshotDiff(snapshotId = "latest") {
    return fetchJson(withQuery("/api/sources/access-task-ledger-snapshots/diff", { snapshotId }));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").DataSourcesAccessGatePayload>}
   */
  fetchSourcesAccessGate() {
    return fetchJson("/api/sources/access-gate");
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedDataSourcesSummarySnapshot[]>}
   */
  fetchSourcesSummarySnapshots() {
    return fetchJson("/api/sources/summary-snapshots");
  },

  /**
   * @param {{ title?: string }} [payload]
   * @returns {Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedDataSourcesSummarySnapshot, dataSourceHealthSnapshots: import("./dashboard-types.js").PersistedDataSourcesSummarySnapshot[] }>}
   */
  createSourcesSummarySnapshot(payload = {}) {
    return fetchJson("/api/sources/summary-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} [snapshotId]
   * @returns {Promise<import("./dashboard-types.js").DataSourcesSummarySnapshotDiffPayload>}
   */
  fetchSourcesSummarySnapshotDiff(snapshotId = "latest") {
    return fetchJson(withQuery("/api/sources/summary-snapshots/diff", { snapshotId }));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").GovernancePayload>}
   */
  fetchGovernance() {
    return fetchJson("/api/governance");
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedGovernanceExecutionView[]>}
   */
  fetchGovernanceExecutionViews() {
    return fetchJson("/api/governance/execution-views");
  },

  /**
   * @param {{ title: string, search: string, scope: string, sort: string, executionStatus: string, executionRetention: number, showArchivedExecution: boolean }} payload
   * @returns {Promise<{ success: true, view: import("./dashboard-types.js").PersistedGovernanceExecutionView, governanceExecutionViews: import("./dashboard-types.js").PersistedGovernanceExecutionView[] }>}
   */
  saveGovernanceExecutionView(payload) {
    return fetchJson("/api/governance/execution-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").GovernanceAgentExecutionPolicy>}
   */
  fetchGovernanceExecutionPolicy() {
    return fetchJson("/api/governance/execution-policy");
  },

  /**
   * @param {{ staleThresholdHours: number }} payload
   * @returns {Promise<{ success: true, policy: import("./dashboard-types.js").GovernanceAgentExecutionPolicy }>}
   */
  saveGovernanceExecutionPolicy(payload) {
    return fetchJson("/api/governance/execution-policy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {{ status?: string, limit?: string }} [options]
   * @returns {Promise<import("./dashboard-types.js").AgentWorkOrdersPayload>}
   */
  fetchAgentWorkOrders(options = {}) {
    return fetchJson(withQuery("/api/agent-work-orders", options));
  },

  /**
   * @param {{ limit?: number }} [options]
   * @returns {Promise<import("./dashboard-types.js").AgentControlPlanePayload>}
   */
  fetchAgentControlPlane(options = {}) {
    return fetchJson(withQuery("/api/agent-control-plane", options));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").AgentControlPlaneBaselineStatusPayload>}
   */
  fetchAgentControlPlaneBaselineStatus() {
    return fetchJson("/api/agent-control-plane/baseline-status");
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").AgentControlPlaneDecisionPayload>}
   */
  fetchAgentControlPlaneDecision() {
    return fetchJson("/api/agent-control-plane/decision");
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedAgentControlPlaneDecisionSnapshot[]>}
   */
  fetchAgentControlPlaneDecisionSnapshots() {
    return fetchJson("/api/agent-control-plane/decision-snapshots");
  },

  /**
   * @param {{ title?: string }} [payload]
   * @returns {Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedAgentControlPlaneDecisionSnapshot, agentControlPlaneDecisionSnapshots: import("./dashboard-types.js").PersistedAgentControlPlaneDecisionSnapshot[] }>}
   */
  createAgentControlPlaneDecisionSnapshot(payload = {}) {
    return fetchJson("/api/agent-control-plane/decision-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedAgentControlPlaneSnapshot[]>}
   */
  fetchAgentControlPlaneSnapshots() {
    return fetchJson("/api/agent-control-plane-snapshots");
  },

  /**
   * @param {string} snapshotId
   * @param {{ limit?: string }} [options]
   * @returns {Promise<import("./dashboard-types.js").AgentControlPlaneSnapshotDiffPayload>}
   */
  fetchAgentControlPlaneSnapshotDiff(snapshotId, options = {}) {
    return fetchJson(withQuery("/api/agent-control-plane-snapshots/diff", {
      snapshotId,
      limit: options.limit
    }));
  },

  /**
   * @param {{ title?: string, limit?: number, baseline?: boolean }} [payload]
   * @returns {Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedAgentControlPlaneSnapshot, baselineSnapshotId?: string, agentControlPlaneSnapshots: import("./dashboard-types.js").PersistedAgentControlPlaneSnapshot[] }>}
   */
  createAgentControlPlaneSnapshot(payload = {}) {
    return fetchJson("/api/agent-control-plane-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {{ snapshotId: string }} payload
   * @returns {Promise<{ success: true, baselineSnapshotId: string, snapshot: import("./dashboard-types.js").PersistedAgentControlPlaneSnapshot, agentControlPlaneSnapshots: import("./dashboard-types.js").PersistedAgentControlPlaneSnapshot[] }>}
   */
  setAgentControlPlaneBaselineSnapshot(payload) {
    return fetchJson("/api/agent-control-plane-snapshots/baseline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @returns {Promise<{ success: true, baselineSnapshotId: string, agentControlPlaneSnapshots: import("./dashboard-types.js").PersistedAgentControlPlaneSnapshot[] }>}
   */
  clearAgentControlPlaneBaselineSnapshot() {
    return fetchJson("/api/agent-control-plane-snapshots/baseline/clear", {
      method: "POST"
    });
  },

  /**
   * @param {{ title?: string, limit?: number }} [payload]
   * @returns {Promise<{ success: true, baselineSnapshotId: string, previousBaselineSnapshotId: string, snapshot: import("./dashboard-types.js").PersistedAgentControlPlaneSnapshot, agentControlPlaneSnapshots: import("./dashboard-types.js").PersistedAgentControlPlaneSnapshot[] }>}
   */
  refreshAgentControlPlaneBaselineSnapshot(payload = {}) {
    return fetchJson("/api/agent-control-plane-snapshots/baseline/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedAgentWorkOrderSnapshot[]>}
   */
  fetchAgentWorkOrderSnapshots() {
    return fetchJson("/api/agent-work-order-snapshots");
  },

  /**
   * @param {{ title?: string, status?: string, limit?: number }} [payload]
   * @returns {Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedAgentWorkOrderSnapshot, agentWorkOrderSnapshots: import("./dashboard-types.js").PersistedAgentWorkOrderSnapshot[] }>}
   */
  createAgentWorkOrderSnapshot(payload = {}) {
    return fetchJson("/api/agent-work-order-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {{ projectId?: string, status?: string, snapshotId?: string, archived?: boolean }} [options]
   * @returns {Promise<import("./dashboard-types.js").PersistedAgentWorkOrderRun[]>}
   */
  fetchAgentWorkOrderRuns(options = {}) {
    return fetchJson(withQuery("/api/agent-work-order-runs", options));
  },

  /**
   * @param {{ state?: "all" | "open" | "resolved", limit?: number }} [options]
   * @returns {Promise<import("./dashboard-types.js").AgentExecutionSlaLedgerPayload>}
   */
  fetchAgentExecutionSlaLedger(options = {}) {
    return fetchJson(withQuery("/api/agent-work-order-runs/sla-ledger", options));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedAgentExecutionSlaLedgerSnapshot[]>}
   */
  fetchAgentExecutionSlaLedgerSnapshots() {
    return fetchJson("/api/agent-work-order-runs/sla-ledger-snapshots");
  },

  /**
   * @param {{ title?: string, state?: "all" | "open" | "resolved", limit?: number }} [payload]
   * @returns {Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedAgentExecutionSlaLedgerSnapshot, agentExecutionSlaLedgerSnapshots: import("./dashboard-types.js").PersistedAgentExecutionSlaLedgerSnapshot[] }>}
   */
  createAgentExecutionSlaLedgerSnapshot(payload = {}) {
    return fetchJson("/api/agent-work-order-runs/sla-ledger-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {{ projectId: string, projectName: string, relPath?: string, snapshotId?: string, title?: string, objective: string, status?: string, readinessScore?: number, readinessStatus?: string, blockers?: string[], validationCommands?: string[], notes?: string }} payload
   * @returns {Promise<{ success: true, run: import("./dashboard-types.js").PersistedAgentWorkOrderRun, agentWorkOrderRuns: import("./dashboard-types.js").PersistedAgentWorkOrderRun[] }>}
   */
  createAgentWorkOrderRun(payload) {
    return fetchJson("/api/agent-work-order-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {{ snapshotId: string }} payload
   * @returns {Promise<{ success: true, queuedRuns: import("./dashboard-types.js").PersistedAgentWorkOrderRun[], skipped: number, agentWorkOrderRuns: import("./dashboard-types.js").PersistedAgentWorkOrderRun[] }>}
   */
  createAgentWorkOrderRunsFromSnapshot(payload) {
    return fetchJson("/api/agent-work-order-runs/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} runId
   * @param {{ status?: string, notes?: string, archived?: boolean }} payload
   * @returns {Promise<{ success: true, run: import("./dashboard-types.js").PersistedAgentWorkOrderRun, agentWorkOrderRuns: import("./dashboard-types.js").PersistedAgentWorkOrderRun[] }>}
   */
  updateAgentWorkOrderRun(runId, payload) {
    return fetchJson(`/api/agent-work-order-runs/${encodeURIComponent(runId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {{ retainCompleted: number, runIds?: string[] }} payload
   * @returns {Promise<{ success: true, retainCompleted: number, retained: number, archived: number, archivedRuns: import("./dashboard-types.js").PersistedAgentWorkOrderRun[], agentWorkOrderRuns: import("./dashboard-types.js").PersistedAgentWorkOrderRun[] }>}
   */
  applyAgentWorkOrderRunRetention(payload) {
    return fetchJson("/api/agent-work-order-runs/retention", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {{ runIds?: string[], action?: string }} payload
   * @returns {Promise<{ success: true, action: string, breached: number, skipped: number, breachedRuns: import("./dashboard-types.js").PersistedAgentWorkOrderRun[], agentWorkOrderRuns: import("./dashboard-types.js").PersistedAgentWorkOrderRun[] }>}
   */
  actionAgentWorkOrderRunSlaBreaches(payload) {
    return fetchJson("/api/agent-work-order-runs/sla-breaches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {{ runIds?: string[] }} payload
   * @returns {Promise<{ success: true, resolved: number, skipped: number, resolvedRuns: import("./dashboard-types.js").PersistedAgentWorkOrderRun[], agentWorkOrderRuns: import("./dashboard-types.js").PersistedAgentWorkOrderRun[] }>}
   */
  resolveAgentWorkOrderRunSlaBreaches(payload) {
    return fetchJson("/api/agent-work-order-runs/sla-breaches/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {{ mode: "profiles" | "starter-pack", projectIds: string[] }} payload
   */
  bootstrapGovernance(payload) {
    return fetchJson("/api/governance/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {{ items: Array<Pick<import("./dashboard-types.js").GovernanceQueueItem, "id" | "projectId" | "projectName" | "kind" | "actionType">> }} payload
   */
  executeGovernanceQueue(payload) {
    return fetchJson("/api/governance/queue/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {{ items: Array<Pick<import("./dashboard-types.js").GovernanceQueueItem, "id" | "projectId" | "projectName" | "kind" | "title">>, reason?: string }} payload
   */
  suppressGovernanceQueue(payload) {
    return fetchJson("/api/governance/queue/suppress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {{ ids: string[] }} payload
   */
  restoreGovernanceQueue(payload) {
    return fetchJson("/api/governance/queue/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} [projectId]
   * @returns {Promise<import("./dashboard-types.js").PersistedProjectProfile[]>}
   */
  fetchProjectProfiles(projectId) {
    return fetchJson(withQuery("/api/project-profiles", { projectId }));
  },

  /**
   * @param {string} [projectId]
   * @returns {Promise<import("./dashboard-types.js").PersistedProjectProfileHistory[]>}
   */
  fetchProjectProfileHistory(projectId) {
    return fetchJson(withQuery("/api/project-profile-history", { projectId }));
  },

  /**
   * @param {{
   *   projectId: string,
   *   projectName: string,
   *   owner?: string,
   *   status?: string,
   *   lifecycle?: string,
   *   tier?: string,
   *   targetState?: string,
   *   summary?: string
   * }} payload
   */
  saveProjectProfile(payload) {
    return fetchJson("/api/project-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} [projectId]
   * @returns {Promise<import("./dashboard-types.js").PersistedTask[]>}
   */
  fetchTasks(projectId) {
    return fetchJson(withQuery("/api/tasks", { projectId }));
  },

  /**
   * @param {{ title: string, description?: string, priority?: string, status?: string, projectId?: string, projectName?: string }} payload
   */
  createTask(payload) {
    return fetchJson("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} taskId
   * @param {Partial<import("./dashboard-types.js").PersistedTask>} payload
   */
  updateTask(taskId, payload) {
    return fetchJson(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} [projectId]
   * @returns {Promise<import("./dashboard-types.js").PersistedWorkflow[]>}
   */
  fetchWorkflows(projectId) {
    return fetchJson(withQuery("/api/workflows", { projectId }));
  },

  /**
   * @param {{ title: string, brief?: string, status?: string, phase?: string, projectId?: string, projectName?: string }} payload
   */
  createWorkflow(payload) {
    return fetchJson("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} workflowId
   * @param {Partial<import("./dashboard-types.js").PersistedWorkflow>} payload
   */
  updateWorkflow(workflowId, payload) {
    return fetchJson(`/api/workflows/${encodeURIComponent(workflowId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} [projectId]
   * @returns {Promise<import("./dashboard-types.js").PersistedScriptRun[]>}
   */
  fetchScriptRuns(projectId) {
    return fetchJson(withQuery("/api/script-runs", { projectId }));
  },

  /**
   * @param {string} [projectId]
   * @returns {Promise<import("./dashboard-types.js").PersistedAgentSession[]>}
   */
  fetchAgentSessions(projectId) {
    return fetchJson(withQuery("/api/agent-sessions", { projectId }));
  },

  /**
   * @param {{ projectId: string, projectName: string, relPath: string, title: string, summary?: string, handoffPack: string, status?: string }} payload
   */
  createAgentSession(payload) {
    return fetchJson("/api/agent-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} [projectId]
   * @returns {Promise<import("./dashboard-types.js").PersistedNote[]>}
   */
  fetchNotes(projectId) {
    return fetchJson(withQuery("/api/notes", { projectId }));
  },

  /**
   * @param {{ title: string, body?: string, kind?: string, projectId?: string, projectName?: string }} payload
   */
  createNote(payload) {
    return fetchJson("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} noteId
   * @param {Partial<import("./dashboard-types.js").PersistedNote>} payload
   */
  updateNote(noteId, payload) {
    return fetchJson(`/api/notes/${encodeURIComponent(noteId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} [projectId]
   * @returns {Promise<import("./dashboard-types.js").PersistedMilestone[]>}
   */
  fetchMilestones(projectId) {
    return fetchJson(withQuery("/api/milestones", { projectId }));
  },

  /**
   * @param {{ title: string, detail?: string, status?: string, targetDate?: string, projectId?: string, projectName?: string }} payload
   */
  createMilestone(payload) {
    return fetchJson("/api/milestones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} milestoneId
   * @param {Partial<import("./dashboard-types.js").PersistedMilestone>} payload
   */
  updateMilestone(milestoneId, payload) {
    return fetchJson(`/api/milestones/${encodeURIComponent(milestoneId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @returns {Promise<{
   *   rootDir: string,
   *   publicDir: string,
   *   inventoryGeneratedAt?: string | null,
   *   totalProjects: number,
   *   historySnapshots: number,
   *   sourceCount: number,
   *   findingsCount: number,
   *   taskCount: number,
   *   workflowCount: number,
   *   scriptRunCount: number,
   *   agentSessionCount: number,
   *   noteCount: number,
   *   milestoneCount: number,
   *   projectProfileCount: number,
   *   scanRunCount: number,
   *   hasInventoryFile: boolean,
   *   hasBootstrappedShell: boolean,
   *   databaseFile: string,
   *   hasDatabaseFile: boolean,
   *   storeFile: string,
   *   hasStoreFile: boolean,
   *   lastFindingsRefreshAt?: string | null,
   *   latestScanAt?: string | null
   * }>}
   */
  fetchDiagnostics() {
    return fetchJson("/api/diagnostics");
  },

  /**
   * @param {{ type: string, url: string }} payload
   */
  addSource(payload) {
    return fetchJson("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} sourceId
   * @returns {Promise<{ success: true, removed: true, sourceId: string, sources: Array<{ type: string, url?: string, path?: string, addedAt?: string }> }>}
   */
  deleteSource(sourceId) {
    return fetchJson(`/api/sources/${encodeURIComponent(sourceId)}`, {
      method: "DELETE"
    });
  },

  /**
   * @param {string} relPath
   */
  openInCursor(relPath) {
    return fetchJson("/api/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: relPath })
    });
  }
};
