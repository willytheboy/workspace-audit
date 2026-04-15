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
   * @param {{ projectId?: string, status?: string, includeNotRelated?: boolean }} [filters]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceCandidatesPayload>}
   */
  fetchConvergenceCandidates(filters = {}) {
    return fetchJson(withQuery("/api/convergence/candidates", {
      projectId: filters.projectId,
      status: filters.status,
      includeNotRelated: filters.includeNotRelated ? "true" : undefined
    }));
  },

  /**
   * @param {{ projectId?: string, status?: string }} [filters]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceReview[]>}
   */
  fetchConvergenceReviews(filters = {}) {
    return fetchJson(withQuery("/api/convergence/reviews", {
      projectId: filters.projectId,
      status: filters.status
    }));
  },

  /**
   * @param {string} pairId
   * @returns {Promise<import("./dashboard-types.js").ConvergenceDueDiligencePackPayload>}
   */
  fetchConvergenceDueDiligencePack(pairId) {
    return fetchJson(withQuery("/api/convergence/due-diligence-pack", { pairId }));
  },

  /**
   * @param {"all" | "active" | "review-required" | "task-ready" | "task-tracked" | "blocked" | "completed" | "suppressed"} [status]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceOperatorProposalQueuePayload>}
   */
  fetchConvergenceOperatorProposalQueue(status = "active") {
    return fetchJson(withQuery("/api/convergence/operator-proposal-queue", { status }));
  },

  /**
   * @param {string} pairId
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationBlueprintPayload>}
   */
  fetchConvergenceAssimilationBlueprint(pairId) {
    return fetchJson(withQuery("/api/convergence/assimilation-blueprint", { pairId }));
  },

  /**
   * @param {string} pairId
   * @param {{ runner?: "codex" | "claude" }} [options]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationWorkOrderDraftPayload>}
   */
  fetchConvergenceAssimilationWorkOrderDraft(pairId, options = {}) {
    return fetchJson(withQuery("/api/convergence/assimilation-work-order-draft", {
      pairId,
      runner: options.runner
    }));
  },

  /**
   * @param {{ pairId: string, runner?: "codex" | "claude", status?: string, notes?: string }} payload
   * @returns {Promise<{ success: true, run: import("./dashboard-types.js").PersistedAgentWorkOrderRun | null, skippedRun?: { id: string, title: string, reason: string } | null, draft: import("./dashboard-types.js").ConvergenceAssimilationWorkOrderDraftPayload, agentWorkOrderRuns: import("./dashboard-types.js").PersistedAgentWorkOrderRun[], governanceOperationCount: number }>}
   */
  queueConvergenceAssimilationWorkOrderRun(payload) {
    return fetchJson("/api/convergence/assimilation-work-order-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {"all" | "open" | "closed" | "active" | "archived"} [status]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationRunLedgerPayload>}
   */
  fetchConvergenceAssimilationRunLedger(status = "all") {
    return fetchJson(withQuery("/api/convergence/assimilation-run-ledger", { status }));
  },

  /**
   * @param {"all" | "passed" | "failed" | "blocked" | "needs-review" | "cancelled"} [status]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationResultLedgerPayload>}
   */
  fetchConvergenceAssimilationResultLedger(status = "all") {
    return fetchJson(withQuery("/api/convergence/assimilation-result-ledger", { status }));
  },

  /**
   * @param {"all" | "open" | "closed"} [status]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationResultCheckpointLedgerPayload>}
   */
  fetchConvergenceAssimilationResultCheckpointLedger(status = "all") {
    return fetchJson(withQuery("/api/convergence/assimilation-result-checkpoint-ledger", { status }));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationReadinessGatePayload>}
   */
  fetchConvergenceAssimilationReadinessGate() {
    return fetchJson("/api/convergence/assimilation-readiness-gate");
  },

  /**
   * @param {{ runner?: "codex" | "claude" }} [options]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationCliHandoffContractPayload>}
   */
  fetchConvergenceAssimilationCliHandoffContract(options = {}) {
    return fetchJson(withQuery("/api/convergence/assimilation-cli-handoff-contract", {
      runner: options.runner
    }));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationOperatorPlaybookPayload>}
   */
  fetchConvergenceAssimilationOperatorPlaybook() {
    return fetchJson("/api/convergence/assimilation-operator-playbook");
  },

  /**
   * @param {{ runner?: "codex" | "claude" }} [options]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationSessionPacketPayload>}
   */
  fetchConvergenceAssimilationSessionPacket(options = {}) {
    return fetchJson(withQuery("/api/convergence/assimilation-session-packet", {
      runner: options.runner
    }));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedConvergenceAssimilationSessionPacketSnapshot[]>}
   */
  fetchConvergenceAssimilationSessionPacketSnapshots() {
    return fetchJson("/api/convergence/assimilation-session-packet-snapshots");
  },

  /**
   * @param {{ title?: string, runner?: "codex" | "claude" }} [payload]
   * @returns {Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedConvergenceAssimilationSessionPacketSnapshot, convergenceAssimilationSessionPacketSnapshots: import("./dashboard-types.js").PersistedConvergenceAssimilationSessionPacketSnapshot[] }>}
   */
  createConvergenceAssimilationSessionPacketSnapshot(payload = {}) {
    return fetchJson("/api/convergence/assimilation-session-packet-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} [snapshotId]
   * @param {{ runner?: "codex" | "claude" }} [options]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationSessionPacketSnapshotDiffPayload>}
   */
  fetchConvergenceAssimilationSessionPacketSnapshotDiff(snapshotId = "latest", options = {}) {
    return fetchJson(withQuery("/api/convergence/assimilation-session-packet-snapshots/diff", {
      snapshotId,
      runner: options.runner
    }));
  },

  /**
   * @param {{ snapshotId?: string, runner?: "codex" | "claude", field: string, decision: "confirmed" | "deferred" | "escalated", note?: string }} payload
   * @returns {Promise<{ success: true, mode: "created" | "updated", decision: string, task: import("./dashboard-types.js").PersistedTask, tasks: import("./dashboard-types.js").PersistedTask[] }>}
   */
  checkpointConvergenceAssimilationSessionPacketDrift(payload) {
    return fetchJson("/api/convergence/assimilation-session-packet-snapshot-drift-checkpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {"all" | "open" | "closed"} [status]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationSessionPacketDriftCheckpointLedgerPayload>}
   */
  fetchConvergenceAssimilationSessionPacketDriftCheckpointLedger(status = "all") {
    return fetchJson(withQuery("/api/convergence/assimilation-session-packet-drift-checkpoint-ledger", { status }));
  },

  /**
   * @param {{ runner?: "codex" | "claude" }} [options]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerCommandQueueDraftPayload>}
   */
  fetchConvergenceAssimilationRunnerCommandQueueDraft(options = {}) {
    return fetchJson(withQuery("/api/convergence/assimilation-runner-command-queue-draft", {
      runner: options.runner
    }));
  },

  /**
   * @param {{ runner?: "codex" | "claude" }} [options]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerResultReplayChecklistPayload>}
   */
  fetchConvergenceAssimilationRunnerResultReplayChecklist(options = {}) {
    return fetchJson(withQuery("/api/convergence/assimilation-runner-result-replay-checklist", {
      runner: options.runner
    }));
  },

  /**
   * @param {{ runner?: "codex" | "claude" }} [options]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerLaunchpadGatePayload>}
   */
  fetchConvergenceAssimilationRunnerLaunchpadGate(options = {}) {
    return fetchJson(withQuery("/api/convergence/assimilation-runner-launchpad-gate", {
      runner: options.runner
    }));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedConvergenceAssimilationRunnerLaunchpadGateSnapshot[]>}
   */
  fetchConvergenceAssimilationRunnerLaunchpadGateSnapshots() {
    return fetchJson("/api/convergence/assimilation-runner-launchpad-gate-snapshots");
  },

  /**
   * @param {{ title?: string, runner?: "codex" | "claude" }} [payload]
   * @returns {Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedConvergenceAssimilationRunnerLaunchpadGateSnapshot, convergenceAssimilationRunnerLaunchpadGateSnapshots: import("./dashboard-types.js").PersistedConvergenceAssimilationRunnerLaunchpadGateSnapshot[] }>}
   */
  createConvergenceAssimilationRunnerLaunchpadGateSnapshot(payload = {}) {
    return fetchJson("/api/convergence/assimilation-runner-launchpad-gate-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} [snapshotId]
   * @param {{ runner?: "codex" | "claude" }} [options]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerLaunchpadGateSnapshotDiffPayload>}
   */
  fetchConvergenceAssimilationRunnerLaunchpadGateSnapshotDiff(snapshotId = "latest", options = {}) {
    return fetchJson(withQuery("/api/convergence/assimilation-runner-launchpad-gate-snapshots/diff", {
      snapshotId,
      runner: options.runner
    }));
  },

  /**
   * @param {{ snapshotId?: string, runner?: "codex" | "claude", field: string, decision: "confirmed" | "deferred" | "escalated", note?: string }} payload
   * @returns {Promise<{ success: true, mode: "created" | "updated", decision: string, task: import("./dashboard-types.js").PersistedTask, tasks: import("./dashboard-types.js").PersistedTask[] }>}
   */
  checkpointConvergenceAssimilationRunnerLaunchpadGateDrift(payload) {
    return fetchJson("/api/convergence/assimilation-runner-launchpad-gate-snapshot-drift-checkpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {"all" | "open" | "closed"} [status]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedgerPayload>}
   */
  fetchConvergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger(status = "all") {
    return fetchJson(withQuery("/api/convergence/assimilation-runner-launchpad-gate-drift-checkpoint-ledger", { status }));
  },

  /**
   * @param {{ runner?: "codex" | "claude" }} [options]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerLaunchAuthorizationPackPayload>}
   */
  fetchConvergenceAssimilationRunnerLaunchAuthorizationPack(options = {}) {
    return fetchJson(withQuery("/api/convergence/assimilation-runner-launch-authorization-pack", {
      runner: options.runner
    }));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshot[]>}
   */
  fetchConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshots() {
    return fetchJson("/api/convergence/assimilation-runner-launch-authorization-pack-snapshots");
  },

  /**
   * @param {{ title?: string, runner?: "codex" | "claude" }} [payload]
   * @returns {Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshot, convergenceAssimilationRunnerLaunchAuthorizationPackSnapshots: import("./dashboard-types.js").PersistedConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshot[] }>}
   */
  createConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshot(payload = {}) {
    return fetchJson("/api/convergence/assimilation-runner-launch-authorization-pack-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} [snapshotId]
   * @param {{ runner?: "codex" | "claude" }} [options]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiffPayload>}
   */
  fetchConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff(snapshotId = "latest", options = {}) {
    return fetchJson(withQuery("/api/convergence/assimilation-runner-launch-authorization-pack-snapshots/diff", {
      snapshotId,
      runner: options.runner
    }));
  },

  /**
   * @param {{ snapshotId?: string, runner?: "codex" | "claude", field: string, decision: "confirmed" | "deferred" | "escalated", note?: string }} payload
   * @returns {Promise<{ success: true, mode: "created" | "updated", decision: string, task: import("./dashboard-types.js").PersistedTask, tasks: import("./dashboard-types.js").PersistedTask[] }>}
   */
  checkpointConvergenceAssimilationRunnerLaunchAuthorizationPackDrift(payload) {
    return fetchJson("/api/convergence/assimilation-runner-launch-authorization-pack-snapshot-drift-checkpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {"all" | "open" | "closed"} [status]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedgerPayload>}
   */
  fetchConvergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger(status = "all") {
    return fetchJson(withQuery("/api/convergence/assimilation-runner-launch-authorization-pack-drift-checkpoint-ledger", { status }));
  },

  /**
   * @param {{ runner?: "codex" | "claude" }} [options]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerLaunchControlBoardPayload>}
   */
  fetchConvergenceAssimilationRunnerLaunchControlBoard(options = {}) {
    return fetchJson(withQuery("/api/convergence/assimilation-runner-launch-control-board", {
      runner: options.runner
    }));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedConvergenceAssimilationRunnerLaunchControlBoardSnapshot[]>}
   */
  fetchConvergenceAssimilationRunnerLaunchControlBoardSnapshots() {
    return fetchJson("/api/convergence/assimilation-runner-launch-control-board-snapshots");
  },

  /**
   * @param {{ title?: string, runner?: "codex" | "claude" }} [payload]
   * @returns {Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedConvergenceAssimilationRunnerLaunchControlBoardSnapshot, convergenceAssimilationRunnerLaunchControlBoardSnapshots: import("./dashboard-types.js").PersistedConvergenceAssimilationRunnerLaunchControlBoardSnapshot[] }>}
   */
  createConvergenceAssimilationRunnerLaunchControlBoardSnapshot(payload = {}) {
    return fetchJson("/api/convergence/assimilation-runner-launch-control-board-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} [snapshotId]
   * @param {{ runner?: "codex" | "claude" }} [options]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerLaunchControlBoardSnapshotDiffPayload>}
   */
  fetchConvergenceAssimilationRunnerLaunchControlBoardSnapshotDiff(snapshotId = "latest", options = {}) {
    return fetchJson(withQuery("/api/convergence/assimilation-runner-launch-control-board-snapshots/diff", {
      snapshotId,
      runner: options.runner
    }));
  },

  /**
   * @param {{ snapshotId?: string, runner?: "codex" | "claude", field: string, decision: "confirmed" | "deferred" | "escalated", note?: string }} payload
   * @returns {Promise<{ success: true, mode: "created" | "updated", decision: string, task: import("./dashboard-types.js").PersistedTask, tasks: import("./dashboard-types.js").PersistedTask[] }>}
   */
  checkpointConvergenceAssimilationRunnerLaunchControlBoardDrift(payload) {
    return fetchJson("/api/convergence/assimilation-runner-launch-control-board-snapshot-drift-checkpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} runId
   * @returns {Promise<import("./dashboard-types.js").ConvergenceAssimilationRunTracePackPayload>}
   */
  fetchConvergenceAssimilationRunTracePack(runId) {
    return fetchJson(`/api/convergence/assimilation-runs/${encodeURIComponent(runId)}/trace-pack`);
  },

  /**
   * @param {string} runId
   * @param {{ status?: string, summary: string, changedFiles?: string[] | string, validationSummary?: string, validationResults?: string, blockers?: string[] | string, nextAction?: string, notes?: string }} payload
   * @returns {Promise<{ success: true, result: import("./dashboard-types.js").ConvergenceAssimilationRunResultRecord, run: import("./dashboard-types.js").PersistedAgentWorkOrderRun, convergenceAssimilationRunResults: import("./dashboard-types.js").ConvergenceAssimilationRunResultRecord[], agentWorkOrderRuns: import("./dashboard-types.js").PersistedAgentWorkOrderRun[], governanceOperationCount: number }>}
   */
  recordConvergenceAssimilationRunResult(runId, payload) {
    return fetchJson(`/api/convergence/assimilation-runs/${encodeURIComponent(runId)}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} resultId
   * @param {{ decision: "confirmed" | "deferred" | "escalated", note?: string }} payload
   * @returns {Promise<{ success: true, mode: "created" | "updated", decision: string, task: import("./dashboard-types.js").PersistedTask, tasks: import("./dashboard-types.js").PersistedTask[], governanceOperationCount: number }>}
   */
  checkpointConvergenceAssimilationResult(resultId, payload) {
    return fetchJson(`/api/convergence/assimilation-results/${encodeURIComponent(resultId)}/checkpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {Partial<import("./dashboard-types.js").ConvergenceReview> & { leftId: string, rightId: string, status: string }} payload
   * @returns {Promise<{ success: true, review: import("./dashboard-types.js").ConvergenceReview, reviews: import("./dashboard-types.js").ConvergenceReview[] }>}
   */
  saveConvergenceReview(payload) {
    return fetchJson("/api/convergence/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {{ leftId: string, rightId: string, operatorContext?: string, reviewer?: string, status?: string }} payload
   * @returns {Promise<{ success: true, review: import("./dashboard-types.js").ConvergenceReview, candidates: import("./dashboard-types.js").ConvergenceCandidate[], reviews: import("./dashboard-types.js").ConvergenceReview[] }>}
   */
  proposeConvergenceOverlap(payload) {
    return fetchJson("/api/convergence/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {{ pairIds?: string[], pairId?: string, candidates?: import("./dashboard-types.js").ConvergenceCandidate[], status?: "confirmed-overlap" | "needs-review" | "merge-candidate" | "actionable" }} [payload]
   * @returns {Promise<{ success: true, requested: number, createdTasks: import("./dashboard-types.js").PersistedTask[], skipped: Array<{ pairId: string, label: string, reason: string }>, totals: { requested: number, created: number, skipped: number }, tasks: import("./dashboard-types.js").PersistedTask[] }>}
   */
  createConvergenceReviewTasks(payload = {}) {
    return fetchJson("/api/convergence/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {"all" | "open" | "closed"} [status]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceTaskLedgerPayload>}
   */
  fetchConvergenceTaskLedger(status = "all") {
    return fetchJson(withQuery("/api/convergence/task-ledger", { status }));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedConvergenceTaskLedgerSnapshot[]>}
   */
  fetchConvergenceTaskLedgerSnapshots() {
    return fetchJson("/api/convergence/task-ledger-snapshots");
  },

  /**
   * @param {{ title?: string, status?: "all" | "open" | "closed", limit?: number }} [payload]
   * @returns {Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedConvergenceTaskLedgerSnapshot, convergenceTaskLedgerSnapshots: import("./dashboard-types.js").PersistedConvergenceTaskLedgerSnapshot[] }>}
   */
  createConvergenceTaskLedgerSnapshot(payload = {}) {
    return fetchJson("/api/convergence/task-ledger-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} [snapshotId]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceTaskLedgerSnapshotDiffPayload>}
   */
  fetchConvergenceTaskLedgerSnapshotDiff(snapshotId = "latest") {
    return fetchJson(withQuery("/api/convergence/task-ledger-snapshots/diff", { snapshotId }));
  },

  /**
   * @param {"all" | "open" | "closed"} [status]
   * @returns {Promise<import("./dashboard-types.js").ConvergenceTaskLedgerDriftCheckpointLedgerPayload>}
   */
  fetchConvergenceTaskLedgerDriftCheckpointLedger(status = "all") {
    return fetchJson(withQuery("/api/convergence/task-ledger-drift-checkpoints", { status }));
  },

  /**
   * @param {{ snapshotId?: string, field: string, decision: "confirmed" | "deferred" | "escalated" }} payload
   * @returns {Promise<{ success: true, mode: "created" | "updated", decision: string, decisionLabel: string, task: import("./dashboard-types.js").PersistedTask, tasks: import("./dashboard-types.js").PersistedTask[] }>}
   */
  createConvergenceTaskLedgerDriftCheckpoint(payload) {
    return fetchJson("/api/convergence/task-ledger-drift-checkpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
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
   * @param {string} checkpointId
   * @returns {Promise<import("./dashboard-types.js").ReleaseCheckpointDriftPayload>}
   */
  fetchReleaseCheckpointDrift(checkpointId = "latest") {
    return fetchJson(withQuery("/api/releases/checkpoints/diff", { checkpointId }));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").ReleaseBuildGatePayload>}
   */
  fetchReleaseBuildGate() {
    return fetchJson("/api/releases/build-gate");
  },

  /**
   * @param {"all" | "open" | "closed"} [status]
   * @returns {Promise<import("./dashboard-types.js").ReleaseTaskLedgerPayload>}
   */
  fetchReleaseTaskLedger(status = "all") {
    return fetchJson(withQuery("/api/releases/task-ledger", { status }));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedReleaseTaskLedgerSnapshot[]>}
   */
  fetchReleaseTaskLedgerSnapshots() {
    return fetchJson("/api/releases/task-ledger-snapshots");
  },

  /**
   * @param {{ title?: string, status?: "all" | "open" | "closed", limit?: number }} [payload]
   * @returns {Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedReleaseTaskLedgerSnapshot, releaseTaskLedgerSnapshots: import("./dashboard-types.js").PersistedReleaseTaskLedgerSnapshot[] }>}
   */
  createReleaseTaskLedgerSnapshot(payload = {}) {
    return fetchJson("/api/releases/task-ledger-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} [snapshotId]
   * @returns {Promise<import("./dashboard-types.js").ReleaseTaskLedgerSnapshotDiffPayload>}
   */
  fetchReleaseTaskLedgerSnapshotDiff(snapshotId = "latest") {
    return fetchJson(withQuery("/api/releases/task-ledger-snapshots/diff", { snapshotId }));
  },

  /**
   * @param {{ url?: string, label?: string, title?: string, notes?: string, status?: "ready" | "review" | "hold", runSmokeCheck?: boolean, saveCheckpoint?: boolean, timeoutMs?: number }} [payload]
   * @returns {Promise<{ success: true, smokeCheck: import("./dashboard-types.js").DeploymentSmokeCheckRecord | null, checkpoint: import("./dashboard-types.js").ReleaseCheckpointRecord | null, releaseBuildGate: import("./dashboard-types.js").ReleaseBuildGatePayload }>}
   */
  bootstrapReleaseBuildGateLocalEvidence(payload = {}) {
    return fetchJson("/api/releases/build-gate/bootstrap-local-evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });
  },

  /**
   * @param {{ actions?: import("./dashboard-types.js").ReleaseBuildGateAction[], saveSnapshot?: boolean, captureSnapshot?: boolean, autoCaptureSnapshot?: boolean, snapshotTitle?: string, snapshotStatus?: "all" | "open" | "closed", snapshotLimit?: number }} [payload]
   * @returns {Promise<{ success: true, requested: number, createdTasks: import("./dashboard-types.js").PersistedTask[], skipped: Array<{ id: string, label: string, reason: string }>, snapshotCaptured?: boolean, snapshot?: import("./dashboard-types.js").PersistedReleaseTaskLedgerSnapshot | null, releaseTaskLedgerSnapshots?: import("./dashboard-types.js").PersistedReleaseTaskLedgerSnapshot[], totals: { requested: number, created: number, skipped: number }, tasks: import("./dashboard-types.js").PersistedTask[] }>}
   */
  createReleaseBuildGateActionTasks(payload = {}) {
    return fetchJson("/api/releases/build-gate/actions/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });
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
   * @returns {Promise<import("./dashboard-types.js").DataSourcesAccessMethodRegistryPayload>}
   */
  fetchSourcesAccessMethodRegistry() {
    return fetchJson("/api/sources/access-method-registry");
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").DataSourcesAccessValidationWorkflowPayload>}
   */
  fetchSourcesAccessValidationWorkflow() {
    return fetchJson("/api/sources/access-validation-workflow");
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedDataSourcesAccessValidationWorkflowSnapshot[]>}
   */
  fetchSourcesAccessValidationWorkflowSnapshots() {
    return fetchJson("/api/sources/access-validation-workflow-snapshots");
  },

  /**
   * @param {{ title?: string }} [payload]
   * @returns {Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedDataSourcesAccessValidationWorkflowSnapshot, dataSourceAccessValidationWorkflowSnapshots: import("./dashboard-types.js").PersistedDataSourcesAccessValidationWorkflowSnapshot[] }>}
   */
  createSourcesAccessValidationWorkflowSnapshot(payload = {}) {
    return fetchJson("/api/sources/access-validation-workflow-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} [snapshotId]
   * @returns {Promise<import("./dashboard-types.js").DataSourcesAccessValidationWorkflowSnapshotDiffPayload>}
   */
  fetchSourcesAccessValidationWorkflowSnapshotDiff(snapshotId = "latest") {
    return fetchJson(withQuery("/api/sources/access-validation-workflow-snapshots/diff", { snapshotId }));
  },

  /**
   * @param {{ items?: import("./dashboard-types.js").DataSourcesAccessValidationWorkflowItem[], saveSnapshot?: boolean, captureSnapshot?: boolean, autoCaptureSnapshot?: boolean, snapshotTitle?: string, snapshotStatus?: "all" | "open" | "closed", snapshotLimit?: number }} [payload]
   * @returns {Promise<{ success: true, requested: number, createdTasks: import("./dashboard-types.js").PersistedTask[], skipped: Array<{ id: string, label: string, reason: string }>, snapshotCaptured?: boolean, snapshot?: import("./dashboard-types.js").PersistedDataSourcesAccessTaskLedgerSnapshot | null, dataSourceAccessTaskLedgerSnapshots?: import("./dashboard-types.js").PersistedDataSourcesAccessTaskLedgerSnapshot[], totals: { requested: number, created: number, skipped: number }, tasks: import("./dashboard-types.js").PersistedTask[] }>}
   */
  createSourcesAccessValidationWorkflowTasks(payload = {}) {
    return fetchJson("/api/sources/access-validation-workflow/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
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
   * @param {{ items?: import("./dashboard-types.js").DataSourcesAccessValidationEvidenceCoverageItem[], saveSnapshot?: boolean, captureSnapshot?: boolean, autoCaptureSnapshot?: boolean, snapshotTitle?: string, snapshotStatus?: "all" | "open" | "closed", snapshotLimit?: number }} [payload]
   * @returns {Promise<{ success: true, requested: number, createdTasks: import("./dashboard-types.js").PersistedTask[], skipped: Array<{ id: string, label: string, reason: string }>, snapshotCaptured?: boolean, snapshot?: import("./dashboard-types.js").PersistedDataSourcesAccessTaskLedgerSnapshot | null, dataSourceAccessTaskLedgerSnapshots?: import("./dashboard-types.js").PersistedDataSourcesAccessTaskLedgerSnapshot[], totals: { requested: number, created: number, skipped: number }, tasks: import("./dashboard-types.js").PersistedTask[] }>}
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
   * @param {{ items?: import("./dashboard-types.js").DataSourcesAccessReviewQueueItem[], saveSnapshot?: boolean, captureSnapshot?: boolean, autoCaptureSnapshot?: boolean, snapshotTitle?: string, snapshotStatus?: "all" | "open" | "closed", snapshotLimit?: number }} [payload]
   * @returns {Promise<{ success: true, requested: number, createdTasks: import("./dashboard-types.js").PersistedTask[], skipped: Array<{ id: string, label: string, reason: string }>, snapshotCaptured?: boolean, snapshot?: import("./dashboard-types.js").PersistedDataSourcesAccessTaskLedgerSnapshot | null, dataSourceAccessTaskLedgerSnapshots?: import("./dashboard-types.js").PersistedDataSourcesAccessTaskLedgerSnapshot[], totals: { requested: number, created: number, skipped: number }, tasks: import("./dashboard-types.js").PersistedTask[] }>}
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
   * @param {{ limit?: number }} [options]
   * @returns {Promise<import("./dashboard-types.js").GovernanceTaskUpdateLedgerPayload>}
   */
  fetchGovernanceTaskUpdateLedger(options = {}) {
    return fetchJson(withQuery("/api/governance/task-update-ledger", options));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedGovernanceTaskUpdateLedgerSnapshot[]>}
   */
  fetchGovernanceTaskUpdateLedgerSnapshots() {
    return fetchJson("/api/governance/task-update-ledger-snapshots");
  },

  /**
   * @param {{ title?: string, limit?: number }} [payload]
   * @returns {Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedGovernanceTaskUpdateLedgerSnapshot, governanceTaskUpdateLedgerSnapshots: import("./dashboard-types.js").PersistedGovernanceTaskUpdateLedgerSnapshot[] }>}
   */
  createGovernanceTaskUpdateLedgerSnapshot(payload = {}) {
    return fetchJson("/api/governance/task-update-ledger-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} [snapshotId]
   * @returns {Promise<import("./dashboard-types.js").GovernanceTaskUpdateLedgerSnapshotDiffPayload>}
   */
  fetchGovernanceTaskUpdateLedgerSnapshotDiff(snapshotId = "latest") {
    return fetchJson(withQuery("/api/governance/task-update-ledger-snapshots/diff", { snapshotId }));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedGovernanceExecutionView[]>}
   */
  fetchGovernanceExecutionViews() {
    return fetchJson("/api/governance/execution-views");
  },

  /**
   * @param {{ title: string, search: string, scope: string, sort: string, taskSeedingStatus: string, executionStatus: string, executionRetention: number, showArchivedExecution: boolean }} payload
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
   * @param {{ runner?: "all" | "codex" | "claude", status?: string, limit?: number }} [options]
   * @returns {Promise<import("./dashboard-types.js").CliBridgeContextPayload>}
   */
  fetchCliBridgeContext(options = {}) {
    return fetchJson(withQuery("/api/cli-bridge/context", options));
  },

  /**
   * @param {{ runner?: "codex" | "claude", runId?: string, status?: string, limit?: number }} [options]
   * @returns {Promise<import("./dashboard-types.js").CliBridgeRunnerDryRunPayload>}
   */
  fetchCliBridgeRunnerDryRun(options = {}) {
    return fetchJson(withQuery("/api/cli-bridge/runner-dry-run", options));
  },

  /**
   * @param {string} handoffId
   * @param {{ runner?: "codex" | "claude", limit?: number }} [options]
   * @returns {Promise<import("./dashboard-types.js").CliBridgeFollowUpWorkOrderDraftPayload>}
   */
  fetchCliBridgeFollowUpWorkOrderDraft(handoffId, options = {}) {
    return fetchJson(withQuery(`/api/cli-bridge/handoffs/${encodeURIComponent(handoffId)}/work-order-draft`, options));
  },

  /**
   * @param {string} handoffId
   * @param {{ runner?: "codex" | "claude", status?: string, notes?: string, limit?: number }} [payload]
   * @returns {Promise<{ success: true, run: import("./dashboard-types.js").PersistedAgentWorkOrderRun | null, skippedRun?: { id: string, title: string, reason: string } | null, draft: import("./dashboard-types.js").CliBridgeFollowUpWorkOrderDraftPayload, agentWorkOrderRuns: import("./dashboard-types.js").PersistedAgentWorkOrderRun[], governanceOperationCount: number }>}
   */
  queueCliBridgeFollowUpWorkOrderRun(handoffId, payload = {}) {
    return fetchJson(`/api/cli-bridge/handoffs/${encodeURIComponent(handoffId)}/work-order-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} runId
   * @returns {Promise<import("./dashboard-types.js").CliBridgeRunTracePayload>}
   */
  fetchCliBridgeRunTrace(runId) {
    return fetchJson(`/api/cli-bridge/runs/${encodeURIComponent(runId)}/trace`);
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedCliBridgeRunTraceSnapshot[]>}
   */
  fetchCliBridgeRunTraceSnapshots() {
    return fetchJson("/api/cli-bridge/run-trace-snapshots");
  },

  /**
   * @param {string} [snapshotId]
   * @returns {Promise<import("./dashboard-types.js").CliBridgeRunTraceSnapshotDiffPayload>}
   */
  fetchCliBridgeRunTraceSnapshotDiff(snapshotId = "latest") {
    return fetchJson(withQuery("/api/cli-bridge/run-trace-snapshots/diff", { snapshotId }));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").CliBridgeRunTraceSnapshotBaselineStatusPayload>}
   */
  fetchCliBridgeRunTraceSnapshotBaselineStatus() {
    return fetchJson("/api/cli-bridge/run-trace-snapshots/baseline-status");
  },

  /**
   * @param {string} runId
   * @param {{ title?: string }} [payload]
   * @returns {Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedCliBridgeRunTraceSnapshot, cliBridgeRunTraceSnapshots: import("./dashboard-types.js").PersistedCliBridgeRunTraceSnapshot[], governanceOperationCount: number }>}
   */
  createCliBridgeRunTraceSnapshot(runId, payload = {}) {
    return fetchJson(`/api/cli-bridge/runs/${encodeURIComponent(runId)}/trace-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {{ runner: "codex" | "claude", workOrderRunId?: string, runId?: string, status?: string, projectId?: string, projectName?: string, title?: string, summary: string, changedFiles?: string[], validationResults?: string, validationSummary?: string, blockers?: string[], nextAction?: string, handoffRecommendation?: string, nextRunner?: string, notes?: string }} payload
   * @returns {Promise<{ success: true, handoff: import("./dashboard-types.js").PersistedCliBridgeHandoff, ledger: import("./dashboard-types.js").CliBridgeHandoffLedgerPayload }>}
   */
  createCliBridgeRunnerResult(payload) {
    return fetchJson("/api/cli-bridge/runner-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {{ runner?: "all" | "codex" | "claude", status?: "all" | "proposed" | "accepted" | "rejected" | "needs-review", limit?: number }} [options]
   * @returns {Promise<import("./dashboard-types.js").CliBridgeHandoffLedgerPayload>}
   */
  fetchCliBridgeHandoffs(options = {}) {
    return fetchJson(withQuery("/api/cli-bridge/handoffs", options));
  },

  /**
   * @param {{ sourceRunner: string, targetRunner: string, status?: string, resultType?: string, projectId?: string, projectName?: string, workOrderRunId?: string, title?: string, summary: string, changedFiles?: string[], validationSummary?: string, nextAction?: string, notes?: string }} payload
   * @returns {Promise<{ success: true, handoff: import("./dashboard-types.js").PersistedCliBridgeHandoff, ledger: import("./dashboard-types.js").CliBridgeHandoffLedgerPayload }>}
   */
  createCliBridgeHandoff(payload) {
    return fetchJson("/api/cli-bridge/handoffs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} handoffId
   * @param {{ action: "accept" | "reject" | "escalate" | "needs-review", note?: string, notes?: string, reviewer?: string, nextAction?: string, createTask?: boolean }} payload
   * @returns {Promise<{ success: true, handoff: import("./dashboard-types.js").PersistedCliBridgeHandoff, createdTask?: import("./dashboard-types.js").PersistedTask | null, skippedTask?: { id: string, title: string, reason: string } | null, ledger: import("./dashboard-types.js").CliBridgeHandoffLedgerPayload, taskCount: number, governanceOperationCount: number }>}
   */
  reviewCliBridgeHandoff(handoffId, payload) {
    return fetchJson(`/api/cli-bridge/handoffs/${encodeURIComponent(handoffId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
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
   * @param {"all" | "open" | "closed"} [status]
   * @returns {Promise<import("./dashboard-types.js").AgentControlPlaneDecisionTaskLedgerPayload>}
   */
  fetchAgentControlPlaneDecisionTaskLedger(status = "all") {
    return fetchJson(withQuery("/api/agent-control-plane/decision/task-ledger", { status }));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedAgentControlPlaneDecisionTaskLedgerSnapshot[]>}
   */
  fetchAgentControlPlaneDecisionTaskLedgerSnapshots() {
    return fetchJson("/api/agent-control-plane/decision/task-ledger-snapshots");
  },

  /**
   * @param {{ title?: string, status?: "all" | "open" | "closed", limit?: number }} [payload]
   * @returns {Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedAgentControlPlaneDecisionTaskLedgerSnapshot, agentControlPlaneDecisionTaskLedgerSnapshots: import("./dashboard-types.js").PersistedAgentControlPlaneDecisionTaskLedgerSnapshot[] }>}
   */
  createAgentControlPlaneDecisionTaskLedgerSnapshot(payload = {}) {
    return fetchJson("/api/agent-control-plane/decision/task-ledger-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} [snapshotId]
   * @returns {Promise<import("./dashboard-types.js").AgentControlPlaneDecisionTaskLedgerSnapshotDiffPayload>}
   */
  fetchAgentControlPlaneDecisionTaskLedgerSnapshotDiff(snapshotId = "latest") {
    return fetchJson(withQuery("/api/agent-control-plane/decision/task-ledger-snapshots/diff", { snapshotId }));
  },

  /**
   * @param {"all" | "open" | "closed"} [status]
   * @returns {Promise<import("./dashboard-types.js").AgentExecutionResultTaskLedgerPayload>}
   */
  fetchAgentExecutionResultTaskLedger(status = "all") {
    return fetchJson(withQuery("/api/agent-execution-result/task-ledger", { status }));
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").PersistedAgentExecutionResultTaskLedgerSnapshot[]>}
   */
  fetchAgentExecutionResultTaskLedgerSnapshots() {
    return fetchJson("/api/agent-execution-result/task-ledger-snapshots");
  },

  /**
   * @param {{ title?: string, status?: "all" | "open" | "closed", limit?: number }} [payload]
   * @returns {Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedAgentExecutionResultTaskLedgerSnapshot, agentExecutionResultTaskLedgerSnapshots: import("./dashboard-types.js").PersistedAgentExecutionResultTaskLedgerSnapshot[] }>}
   */
  createAgentExecutionResultTaskLedgerSnapshot(payload = {}) {
    return fetchJson("/api/agent-execution-result/task-ledger-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @param {string} [snapshotId]
   * @returns {Promise<import("./dashboard-types.js").AgentExecutionResultTaskLedgerSnapshotDiffPayload>}
   */
  fetchAgentExecutionResultTaskLedgerSnapshotDiff(snapshotId = "latest") {
    return fetchJson(withQuery("/api/agent-execution-result/task-ledger-snapshots/diff", { snapshotId }));
  },

  /**
   * @param {{ reasons?: Array<{ severity?: string, code?: string, message?: string }>, saveSnapshot?: boolean, captureSnapshot?: boolean, autoCaptureSnapshot?: boolean, snapshotTitle?: string, snapshotStatus?: "all" | "open" | "closed", snapshotLimit?: number }} [payload]
   * @returns {Promise<{ success: true, requested: number, createdTasks: import("./dashboard-types.js").PersistedTask[], skipped: Array<{ code: string, reason: string }>, snapshotCaptured: boolean, snapshot: import("./dashboard-types.js").PersistedAgentControlPlaneDecisionTaskLedgerSnapshot | null, totals: { requested: number, created: number, skipped: number }, agentControlPlaneDecisionTaskLedgerSnapshots: import("./dashboard-types.js").PersistedAgentControlPlaneDecisionTaskLedgerSnapshot[], tasks: import("./dashboard-types.js").PersistedTask[] }>}
   */
  createAgentControlPlaneDecisionTasks(payload = {}) {
    return fetchJson("/api/agent-control-plane/decision/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });
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
   * @returns {Promise<import("./dashboard-types.js").AgentPolicyCheckpointsPayload>}
   */
  fetchAgentPolicyCheckpoints() {
    return fetchJson("/api/agent-policy-checkpoints");
  },

  /**
   * @param {{ policyId: string, projectId: string, projectName?: string, relPath?: string, status?: "approved" | "deferred" | "dismissed" | "needs-review", role?: string, runtime?: string, isolationMode?: string, skillBundle?: string[], hookPolicy?: string[], source?: string, reason?: string, note?: string, reviewer?: string }} payload
   * @returns {Promise<{ success: true, checkpoint: import("./dashboard-types.js").AgentPolicyCheckpoint, summary: import("./dashboard-types.js").AgentPolicyCheckpointSummary, agentPolicyCheckpointCount: number, governanceOperationCount: number }>}
   */
  createAgentPolicyCheckpoint(payload) {
    return fetchJson("/api/agent-policy-checkpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  /**
   * @returns {Promise<import("./dashboard-types.js").AgentExecutionResultCheckpointsPayload>}
   */
  fetchAgentExecutionResultCheckpoints() {
    return fetchJson("/api/agent-execution-result-checkpoints");
  },

  /**
   * @param {{ runId: string, targetAction: "retry" | "archive" | "retention" | "resolve-sla" | "baseline-refresh", status?: "approved" | "deferred" | "dismissed" | "needs-review", reason?: string, note?: string, reviewer?: string, source?: string }} payload
   * @returns {Promise<{ success: true, checkpoint: import("./dashboard-types.js").AgentExecutionResultCheckpoint, createdTask?: import("./dashboard-types.js").PersistedTask | null, skippedTask?: { id: string, title: string, reason: string } | null, summary: import("./dashboard-types.js").AgentExecutionResultCheckpointSummary, agentExecutionResultCheckpointCount: number, agentExecutionResultTaskCount: number, governanceOperationCount: number }>}
   */
  createAgentExecutionResultCheckpoint(payload) {
    return fetchJson("/api/agent-execution-result-checkpoints", {
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
   * @param {{ projectId: string, projectName: string, relPath?: string, snapshotId?: string, title?: string, objective: string, status?: string, readinessScore?: number, readinessStatus?: string, blockers?: string[], agentPolicyId?: string, agentPolicyCheckpointId?: string, agentPolicyCheckpointStatus?: string, agentRole?: string, runtime?: string, isolationMode?: string, skillBundle?: string[], hookPolicy?: string[], validationCommands?: string[], notes?: string }} payload
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
   * @param {{ batchId?: string, title?: string, source?: string, status?: "approved" | "deferred" | "dismissed" | "needs-review", itemCount?: number, note?: string, reviewer?: string }} payload
   * @returns {Promise<{ success: true, checkpoint: import("./dashboard-types.js").TaskSeedingCheckpoint, taskSeedingCheckpointCount: number, governanceOperationCount: number }>}
   */
  createTaskSeedingCheckpoint(payload) {
    return fetchJson("/api/governance/task-seeding-checkpoints", {
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
   *   convergenceReviewCount: number,
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
