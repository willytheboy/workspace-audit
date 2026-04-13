import { createServer } from "node:http";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { exec, spawn } from "node:child_process";
import { extname, join, resolve } from "node:path";
import { generateAudit } from "./audit-core.mjs";
import { isWithin } from "./path-utils.mjs";
import { createWorkspaceAuditStore } from "./workspace-audit-store.mjs";

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

const DEFAULT_AGENT_EXECUTION_POLICY = {
  staleThresholdHours: 24,
  staleStatuses: ["queued", "running", "blocked"],
  terminalStatuses: ["passed", "failed", "cancelled"]
};
const AGENT_CONTROL_PLANE_BASELINE_STALE_HOURS = 24;

function readRequestBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => resolveBody(body));
    req.on("error", rejectBody);
  });
}

function openInCursor(absPath) {
  return new Promise((resolveOpen, rejectOpen) => {
    exec(`cursor "${absPath}"`, (error) => {
      if (error) {
        rejectOpen(error);
      } else {
        resolveOpen();
      }
    });
  });
}

export function createWorkspaceAuditServer({ rootDir, publicDir }) {
  if (!rootDir || !publicDir) {
    throw new Error("rootDir and publicDir are required");
  }

  const resolvedRootDir = resolve(rootDir);
  const resolvedPublicDir = resolve(publicDir);
  const sourcesFile = join(resolvedPublicDir, "audit-sources.json");
  const inventoryFile = join(resolvedPublicDir, "inventory.json");
  const store = createWorkspaceAuditStore(resolvedPublicDir);

  /**
   * @param {string} prefix
   */
  function createId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * @param {string} type
   * @param {string} summary
   * @param {Record<string, unknown>} [details]
   */
  function createGovernanceOperation(type, summary, details = {}) {
    return {
      id: createId("governance-operation"),
      type,
      summary,
      actor: "workspace-audit",
      details,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * @param {string} status
   * @param {string} note
   * @param {string | null} [previousStatus]
   */
  function createAgentWorkOrderRunEvent(status, note, previousStatus = null) {
    return {
      id: createId("agent-work-order-run-event"),
      status,
      previousStatus,
      note,
      actor: "workspace-audit",
      createdAt: new Date().toISOString()
    };
  }

  /**
   * @param {Record<string, unknown>} current
   * @param {Array<Record<string, unknown>>} operations
   */
  function appendGovernanceOperations(current, operations) {
    if (!operations.length) return current;
    const existing = Array.isArray(current.governanceOperations) ? current.governanceOperations : [];
    return {
      ...current,
      governanceOperations: [...operations, ...existing].slice(0, 200)
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildGovernanceTaskUpdateLedgerMarkdown(payload) {
    const summary = toControlPlaneRecord(payload.summary);
    const items = Array.isArray(payload.items) ? payload.items : [];
    const lines = [
      "# Governance Task Update Ledger",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Secret policy: ${toText(payload.secretPolicy) || "Non-secret task lifecycle metadata only."}`,
      "",
      "## Summary",
      `- Total task update operations: ${toNumber(summary.total)}`,
      `- Visible operations: ${toNumber(summary.visible)}`,
      `- Status changes: ${toNumber(summary.statusChanges)}`,
      `- Metadata-only updates: ${toNumber(summary.metadataUpdates)}`,
      `- Tracked tasks: ${toNumber(summary.taskCount)}`,
      `- Tracked projects: ${toNumber(summary.projectCount)}`,
      "",
      "## Updates"
    ];

    if (!items.length) {
      lines.push("- No Governance task update operations found.");
      return lines.join("\n");
    }

    for (const item of items) {
      const record = toControlPlaneRecord(item);
      lines.push(`- ${toText(record.title) || toText(record.taskId) || "Task"}: ${toText(record.previousStatus) || "unset"} -> ${toText(record.nextStatus) || "unset"}`);
      lines.push(`  Project: ${toText(record.projectName) || toText(record.projectId) || "unassigned"} | Updated: ${toText(record.createdAt) || "not recorded"}`);
      if (Array.isArray(record.updatedFields) && record.updatedFields.length) {
        lines.push(`  Changed fields: ${record.updatedFields.map(toText).filter(Boolean).join(", ")}`);
      }
      lines.push(`  Operation: ${toText(record.operationId) || "governance-task-updated"} | Secret policy: non-secret task lifecycle metadata only`);
    }

    return lines.join("\n");
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {{ limit?: number }} [options]
   */
  function createGovernanceTaskUpdateLedgerPayload(persisted, options = {}) {
    const requestedLimit = Number(options.limit || 100);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(250, Math.trunc(requestedLimit)))
      : 100;
    const operations = (Array.isArray(persisted.governanceOperations) ? persisted.governanceOperations : [])
      .map(toControlPlaneRecord)
      .filter((operation) => toText(operation.type) === "governance-task-updated")
      .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime());
    const taskIds = new Set();
    const projectIds = new Set();
    const items = operations.map((operation) => {
      const details = toControlPlaneRecord(operation.details);
      const taskId = toText(details.taskId);
      const projectId = toText(details.projectId);
      if (taskId) taskIds.add(taskId);
      if (projectId) projectIds.add(projectId);
      return {
        operationId: toText(operation.id),
        type: toText(operation.type),
        summary: toText(operation.summary),
        actor: toText(operation.actor),
        taskId,
        title: toText(details.title),
        projectId,
        projectName: toText(details.projectName),
        previousStatus: toText(details.previousStatus),
        nextStatus: toText(details.nextStatus),
        updatedFields: Array.isArray(details.updatedFields) ? details.updatedFields.map(toText).filter(Boolean) : [],
        createdAt: toText(operation.createdAt)
      };
    });
    const statusChanges = items.filter((item) => item.previousStatus !== item.nextStatus).length;
    const payload = {
      generatedAt: new Date().toISOString(),
      limit,
      secretPolicy: "Non-secret Governance task lifecycle metadata only. Do not store credentials, provider tokens, cookies, certificates, private keys, or browser-session data in task update audit entries.",
      summary: {
        total: operations.length,
        visible: Math.min(items.length, limit),
        statusChanges,
        metadataUpdates: items.length - statusChanges,
        taskCount: taskIds.size,
        projectCount: projectIds.size
      },
      items: items.slice(0, limit)
    };

    return {
      ...payload,
      markdown: buildGovernanceTaskUpdateLedgerMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {{ title?: string, limit?: number }} [options]
   */
  function createGovernanceTaskUpdateLedgerSnapshotRecord(persisted, options = {}) {
    const ledger = createGovernanceTaskUpdateLedgerPayload(persisted, {
      limit: Number(options.limit || 100)
    });

    return {
      id: createId("governance-task-update-ledger-snapshot"),
      title: toText(options.title) || "Governance Task Update Ledger",
      limit: ledger.limit,
      total: ledger.summary.total,
      visibleCount: ledger.summary.visible,
      statusChangeCount: ledger.summary.statusChanges,
      metadataUpdateCount: ledger.summary.metadataUpdates,
      taskCount: ledger.summary.taskCount,
      projectCount: ledger.summary.projectCount,
      secretPolicy: ledger.secretPolicy,
      markdown: ledger.markdown,
      items: ledger.items,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildGovernanceTaskUpdateLedgerSnapshotDiffMarkdown(payload) {
    const formatDriftValue = (value) => typeof value === "number" ? String(value) : toText(value);
    const lines = [
      "# Governance Task Update Ledger Snapshot Drift",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Snapshot: ${toText(payload.snapshotTitle) || "missing"}`,
      `Drift severity: ${toText(payload.driftSeverity) || "none"}`,
      `Drift score: ${toNumber(payload.driftScore)}`,
      `Recommended action: ${toText(payload.recommendedAction) || "No action required."}`,
      "",
      "## Drift Items"
    ];

    const driftItems = Array.isArray(payload.driftItems) ? payload.driftItems : [];
    if (!driftItems.length) {
      lines.push("- No Governance task update ledger drift detected.");
      return lines.join("\n");
    }

    for (const item of driftItems) {
      const record = toControlPlaneRecord(item);
      lines.push(`- ${toText(record.label) || toText(record.field) || "Task update audit drift"}: ${formatDriftValue(record.before)} -> ${formatDriftValue(record.current)}`);
    }

    return lines.join("\n");
  }

  function createMissingGovernanceTaskUpdateLedgerSnapshotDiffPayload() {
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: false,
      snapshotId: "",
      snapshotTitle: "",
      snapshotCreatedAt: "",
      hasDrift: false,
      driftScore: 0,
      driftSeverity: "missing-snapshot",
      recommendedAction: "Save a Governance task update ledger snapshot before comparing task-update audit drift.",
      driftItems: [],
      liveSummary: null,
      snapshotSummary: null
    };
    return {
      ...payload,
      markdown: buildGovernanceTaskUpdateLedgerSnapshotDiffMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} snapshot
   * @param {ReturnType<typeof createGovernanceTaskUpdateLedgerPayload>} live
   */
  function createGovernanceTaskUpdateLedgerSnapshotDiffPayload(snapshot, live) {
    const driftItems = [];
    const snapshotSummary = {
      total: toNumber(snapshot.total),
      visible: toNumber(snapshot.visibleCount),
      statusChanges: toNumber(snapshot.statusChangeCount),
      metadataUpdates: toNumber(snapshot.metadataUpdateCount),
      taskCount: toNumber(snapshot.taskCount),
      projectCount: toNumber(snapshot.projectCount)
    };
    const liveSummary = toControlPlaneRecord(live.summary);
    const countFields = [
      { field: "total", label: "Total task update audit operations" },
      { field: "visible", label: "Visible task update audit operations" },
      { field: "statusChanges", label: "Task status changes" },
      { field: "metadataUpdates", label: "Task metadata-only updates" },
      { field: "taskCount", label: "Tracked tasks" },
      { field: "projectCount", label: "Tracked projects" }
    ];

    for (const item of countFields) {
      const before = toNumber(snapshotSummary[item.field]);
      const current = toNumber(liveSummary[item.field]);
      if (before !== current) {
        driftItems.push({
          field: item.field,
          label: item.label,
          before,
          current,
          delta: current - before
        });
      }
    }

    const snapshotItems = Array.isArray(snapshot.items) ? snapshot.items.map(toControlPlaneRecord) : [];
    const liveItems = Array.isArray(live.items) ? live.items.map(toControlPlaneRecord) : [];
    const updateKey = (item) => toText(item.operationId) || `${toText(item.taskId)}:${toText(item.createdAt)}`;
    const snapshotByKey = new Map(snapshotItems.map((item) => [updateKey(item), item]));
    const liveByKey = new Map(liveItems.map((item) => [updateKey(item), item]));

    for (const [key, item] of liveByKey) {
      const previous = snapshotByKey.get(key);
      const label = toText(item.title) || toText(item.taskId) || key;
      const currentState = `${toText(item.previousStatus) || "unset"} -> ${toText(item.nextStatus) || "unset"} / ${toText(item.projectName) || toText(item.projectId) || "unassigned"}`;
      if (!previous) {
        driftItems.push({
          field: `task-update:${key}`,
          label: `${label} audit update added`,
          before: "missing",
          current: currentState,
          delta: 1
        });
        continue;
      }
      const beforeState = `${toText(previous.previousStatus) || "unset"} -> ${toText(previous.nextStatus) || "unset"} / ${toText(previous.projectName) || toText(previous.projectId) || "unassigned"}`;
      if (beforeState !== currentState) {
        driftItems.push({
          field: `task-update:${key}`,
          label,
          before: beforeState,
          current: currentState,
          delta: 1
        });
      }
    }

    for (const [key, item] of snapshotByKey) {
      if (!liveByKey.has(key)) {
        driftItems.push({
          field: `task-update:${key}`,
          label: `${toText(item.title) || toText(item.taskId) || key} audit update removed`,
          before: `${toText(item.previousStatus) || "unset"} -> ${toText(item.nextStatus) || "unset"} / ${toText(item.projectName) || toText(item.projectId) || "unassigned"}`,
          current: "missing",
          delta: -1
        });
      }
    }

    const driftScore = driftItems.reduce((total, item) => total + Math.max(1, Math.abs(toNumber(item.delta))), 0);
    const statusChangeDelta = toNumber(liveSummary.statusChanges) - toNumber(snapshotSummary.statusChanges);
    const driftSeverity = !driftItems.length
      ? "none"
      : statusChangeDelta > 0
        ? "high"
        : driftScore >= 5
          ? "medium"
          : "low";
    const recommendedAction = driftSeverity === "high"
      ? "Review new task status changes before treating the lifecycle audit baseline as current."
      : driftSeverity === "medium"
        ? "Review Governance task update audit drift and refresh the snapshot if changes are intentional."
        : driftSeverity === "low"
          ? "Monitor low Governance task update audit drift and refresh the snapshot after confirmation."
          : "No Governance task update ledger drift detected.";
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: true,
      snapshotId: toText(snapshot.id),
      snapshotTitle: toText(snapshot.title) || "Governance Task Update Ledger",
      snapshotCreatedAt: toText(snapshot.createdAt),
      hasDrift: driftItems.length > 0,
      driftScore,
      driftSeverity,
      recommendedAction,
      driftItems,
      liveSummary,
      snapshotSummary
    };

    return {
      ...payload,
      markdown: buildGovernanceTaskUpdateLedgerSnapshotDiffMarkdown(payload)
    };
  }

  /**
   * @param {unknown} value
   */
  function normalizeAgentExecutionPolicy(value) {
    const policy = value && typeof value === "object" ? value : {};
    const staleThresholdHoursRaw = Number(policy.staleThresholdHours ?? DEFAULT_AGENT_EXECUTION_POLICY.staleThresholdHours);
    const staleThresholdHours = Number.isFinite(staleThresholdHoursRaw)
      ? Math.max(1, Math.min(168, Math.floor(staleThresholdHoursRaw)))
      : DEFAULT_AGENT_EXECUTION_POLICY.staleThresholdHours;
    const normalizeStatuses = (items, fallback) => Array.isArray(items)
      ? items.map((item) => String(item || "").trim()).filter(Boolean)
      : fallback;

    return {
      staleThresholdHours,
      staleStatuses: normalizeStatuses(policy.staleStatuses, DEFAULT_AGENT_EXECUTION_POLICY.staleStatuses),
      terminalStatuses: normalizeStatuses(policy.terminalStatuses, DEFAULT_AGENT_EXECUTION_POLICY.terminalStatuses),
      updatedAt: String(policy.updatedAt || "")
    };
  }

  /**
   * @param {Awaited<ReturnType<typeof getInventoryPayload>>} inventory
   */
  function buildFindings(inventory) {
    const findings = [];

    for (const project of inventory.projects || []) {
      if (project.sourceFiles >= 50 && project.testFiles === 0) {
        findings.push({
          id: createId("finding"),
          projectId: project.id,
          projectName: project.name,
          severity: "high",
          category: "quality",
          title: "High complexity without tests",
          detail: `${project.name} has ${project.sourceFiles} source files and no detected tests.`,
          createdAt: new Date().toISOString(),
          status: "open"
        });
      }

      if (project.docsFiles === 0) {
        findings.push({
          id: createId("finding"),
          projectId: project.id,
          projectName: project.name,
          severity: "medium",
          category: "documentation",
          title: "Missing docs",
          detail: `${project.name} has no detected documentation files.`,
          createdAt: new Date().toISOString(),
          status: "open"
        });
      }

      if (project.zone === "archived" && project.freshnessScore >= 70) {
        findings.push({
          id: createId("finding"),
          projectId: project.id,
          projectName: project.name,
          severity: "medium",
          category: "lifecycle",
          title: "Archived project still active",
          detail: `${project.name} is archived but still appears recently updated.`,
          createdAt: new Date().toISOString(),
          status: "open"
        });
      }

      const strongestMatch = project.similarApps?.[0];
      if (strongestMatch && strongestMatch.score >= 80) {
        findings.push({
          id: createId("finding"),
          projectId: project.id,
          projectName: project.name,
          severity: "medium",
          category: "convergence",
          title: "High overlap candidate",
          detail: `${project.name} overlaps strongly with ${strongestMatch.name} (${strongestMatch.score}%).`,
          createdAt: new Date().toISOString(),
          status: "open"
        });
      }
    }

    return findings;
  }

  /**
   * @param {unknown} scanRun
   */
  function getScanProjects(scanRun) {
    return Array.isArray(scanRun?.projects) ? scanRun.projects : [];
  }

  /**
   * @param {unknown} value
   */
  function toNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }

  /**
   * @param {unknown} value
   */
  function toText(value) {
    return typeof value === "string" ? value : "";
  }

  /**
   * @param {unknown} createdAt
   */
  function getAgentControlPlaneBaselineFreshness(createdAt) {
    const createdAtText = toText(createdAt);
    const createdAtTime = new Date(createdAtText).getTime();
    if (!createdAtText || !Number.isFinite(createdAtTime)) {
      return {
        baselineAgeHours: 0,
        baselineFreshness: "missing",
        baselineFreshnessThresholdHours: AGENT_CONTROL_PLANE_BASELINE_STALE_HOURS
      };
    }
    const baselineAgeHours = Math.max(0, Math.round(((Date.now() - createdAtTime) / (60 * 60 * 1000)) * 10) / 10);
    return {
      baselineAgeHours,
      baselineFreshness: baselineAgeHours > AGENT_CONTROL_PLANE_BASELINE_STALE_HOURS ? "stale" : "fresh",
      baselineFreshnessThresholdHours: AGENT_CONTROL_PLANE_BASELINE_STALE_HOURS
    };
  }

  /**
   * @param {boolean} hasBaseline
   * @param {string} freshness
   * @param {number} driftScore
   */
  function getAgentControlPlaneBaselineHealth(hasBaseline, freshness, driftScore) {
    if (!hasBaseline) {
      return {
        health: "missing",
        recommendedAction: "Save or mark an Agent Control Plane snapshot as baseline."
      };
    }
    if (freshness === "stale") {
      return {
        health: "stale",
        recommendedAction: "Refresh the Agent Control Plane baseline before relying on drift decisions."
      };
    }
    if (driftScore >= 5) {
      return {
        health: "drifted",
        recommendedAction: "Review baseline drift fields, then refresh the baseline after accepting the live state."
      };
    }
    if (driftScore > 0) {
      return {
        health: "changed",
        recommendedAction: "Review the baseline drift fields before the next supervised agent build."
      };
    }
    return {
      health: "healthy",
      recommendedAction: "Continue monitoring baseline freshness and drift."
    };
  }

  /**
   * @param {Array<unknown>} scanRuns
   */
  function buildScanDiff(scanRuns) {
    const latest = scanRuns[0] || null;
    const previous = scanRuns[1] || null;
    if (!latest || !previous) {
      return {
        status: "insufficient_data",
        latestGeneratedAt: latest?.generatedAt || null,
        previousGeneratedAt: previous?.generatedAt || null,
        totals: {
          appDelta: 0,
          qualityDelta: 0,
          sourceDelta: 0,
          testDelta: 0,
          addedCount: 0,
          removedCount: 0,
          changedCount: 0
        },
        addedProjects: [],
        removedProjects: [],
        changedProjects: [],
        topChanges: []
      };
    }

    const latestSummary = latest.summary || {};
    const previousSummary = previous.summary || {};
    const totals = {
      appDelta: toNumber(latestSummary.totalApps) - toNumber(previousSummary.totalApps),
      qualityDelta: toNumber(latestSummary.avgQuality) - toNumber(previousSummary.avgQuality),
      sourceDelta: toNumber(latestSummary.totalSource) - toNumber(previousSummary.totalSource),
      testDelta: toNumber(latestSummary.totalTests) - toNumber(previousSummary.totalTests),
      addedCount: 0,
      removedCount: 0,
      changedCount: 0
    };

    const latestProjects = getScanProjects(latest);
    const previousProjects = getScanProjects(previous);
    if (!latestProjects.length || !previousProjects.length) {
      return {
        status: "summary_only",
        latestGeneratedAt: latest.generatedAt || null,
        previousGeneratedAt: previous.generatedAt || null,
        totals,
        addedProjects: [],
        removedProjects: [],
        changedProjects: [],
        topChanges: []
      };
    }

    const latestMap = new Map(latestProjects.map((project) => [project.id, project]));
    const previousMap = new Map(previousProjects.map((project) => [project.id, project]));
    const addedProjects = latestProjects
      .filter((project) => !previousMap.has(project.id))
      .map((project) => ({
        id: project.id,
        name: project.name,
        relPath: project.relPath,
        zone: project.zone,
        category: project.category,
        qualityScore: project.qualityScore
      }));
    const removedProjects = previousProjects
      .filter((project) => !latestMap.has(project.id))
      .map((project) => ({
        id: project.id,
        name: project.name,
        relPath: project.relPath,
        zone: project.zone,
        category: project.category,
        qualityScore: project.qualityScore
      }));
    const changedProjects = [];

    for (const [projectId, latestProject] of latestMap.entries()) {
      const previousProject = previousMap.get(projectId);
      if (!previousProject) continue;

      const qualityDelta = toNumber(latestProject.qualityScore) - toNumber(previousProject.qualityScore);
      const freshnessDelta = toNumber(latestProject.freshnessScore) - toNumber(previousProject.freshnessScore);
      const sourceDelta = toNumber(latestProject.sourceFiles) - toNumber(previousProject.sourceFiles);
      const testDelta = toNumber(latestProject.testFiles) - toNumber(previousProject.testFiles);
      const docsDelta = toNumber(latestProject.docsFiles) - toNumber(previousProject.docsFiles);
      const lineDelta = toNumber(latestProject.sourceLines) - toNumber(previousProject.sourceLines);
      const warningsDelta = toNumber(latestProject.warningsCount) - toNumber(previousProject.warningsCount);
      const zoneChanged = toText(latestProject.zone) !== toText(previousProject.zone);
      const categoryChanged = toText(latestProject.category) !== toText(previousProject.category);

      if (
        qualityDelta
        || freshnessDelta
        || sourceDelta
        || testDelta
        || docsDelta
        || lineDelta
        || warningsDelta
        || zoneChanged
        || categoryChanged
      ) {
        const changeScore = Math.round(
          Math.abs(qualityDelta)
          + Math.abs(freshnessDelta)
          + Math.abs(sourceDelta * 2)
          + Math.abs(testDelta * 3)
          + Math.abs(docsDelta * 2)
          + Math.abs(warningsDelta * 4)
          + Math.abs(lineDelta / 40)
          + (zoneChanged ? 8 : 0)
          + (categoryChanged ? 6 : 0)
        );
        changedProjects.push({
          id: latestProject.id,
          name: latestProject.name,
          relPath: latestProject.relPath,
          zone: latestProject.zone,
          category: latestProject.category,
          qualityDelta,
          freshnessDelta,
          sourceDelta,
          testDelta,
          docsDelta,
          lineDelta,
          warningsDelta,
          fromZone: previousProject.zone,
          toZone: latestProject.zone,
          fromCategory: previousProject.category,
          toCategory: latestProject.category,
          changeScore
        });
      }
    }

    changedProjects.sort((left, right) => right.changeScore - left.changeScore);
    totals.addedCount = addedProjects.length;
    totals.removedCount = removedProjects.length;
    totals.changedCount = changedProjects.length;

    return {
      status: "ready",
      latestGeneratedAt: latest.generatedAt || null,
      previousGeneratedAt: previous.generatedAt || null,
      totals,
      addedProjects: addedProjects.slice(0, 8),
      removedProjects: removedProjects.slice(0, 8),
      changedProjects,
      topChanges: changedProjects.slice(0, 8)
    };
  }

  /**
   * @param {{
   *   findings: Array<Record<string, unknown>>,
   *   tasks: Array<Record<string, unknown>>,
   *   workflows: Array<Record<string, unknown>>,
   *   notes: Array<Record<string, unknown>>,
   *   milestones: Array<Record<string, unknown>>,
   *   deploymentSmokeChecks?: Array<Record<string, unknown>>,
   *   releaseCheckpoints?: Array<Record<string, unknown>>,
   *   projectProfiles?: Array<Record<string, unknown>>,
   *   projectProfileHistory?: Array<Record<string, unknown>>,
   *   queueSuppressions?: Array<Record<string, unknown>>,
   *   governanceOperations?: Array<Record<string, unknown>>,
   *   agentSessions?: Array<Record<string, unknown>>,
   *   agentControlPlaneSnapshots?: Array<Record<string, unknown>>,
   *   agentControlPlaneBaselineSnapshotId?: string,
   *   agentControlPlaneDecisionSnapshots?: Array<Record<string, unknown>>,
   *   agentWorkOrderSnapshots?: Array<Record<string, unknown>>,
   *   governanceTaskUpdateLedgerSnapshots?: Array<Record<string, unknown>>,
   *   dataSourceAccessTaskLedgerSnapshots?: Array<Record<string, unknown>>,
   *   agentControlPlaneDecisionTaskLedgerSnapshots?: Array<Record<string, unknown>>,
   *   dataSourceAccessValidationEvidence?: Array<Record<string, unknown>>,
   *   dataSourceAccessValidationEvidenceSnapshots?: Array<Record<string, unknown>>,
   *   agentExecutionSlaLedgerSnapshots?: Array<Record<string, unknown>>,
   *   agentWorkOrderRuns?: Array<Record<string, unknown>>,
   *   governanceExecutionViews?: Array<Record<string, unknown>>,
   *   governanceExecutionPolicy?: Record<string, unknown>
   * }} persisted
   * @param {{ projects?: Array<Record<string, unknown>> }} inventory
   * @param {{ dataSourcesAccessGate?: Record<string, unknown> | null, dataSourcesAccessReviewQueue?: Record<string, unknown> | null, dataSourcesAccessValidationRunbook?: Record<string, unknown> | null, dataSourcesAccessValidationEvidenceCoverage?: Record<string, unknown> | null, releaseBuildGate?: Record<string, unknown> | null }} [options]
   */
  function buildGovernanceSnapshot(persisted, inventory, options = {}) {
    const isClosed = (status) => ["done", "resolved", "closed", "cancelled", "archived"].includes(String(status || "").toLowerCase());
    const openFindings = persisted.findings.filter((finding) => !isClosed(finding.status));
    const openTasks = persisted.tasks.filter((task) => !isClosed(task.status));
    const dataSourcesAccessTasks = persisted.tasks.filter((task) => toText(task.sourceAccessReviewId) || toText(task.projectId) === "data-sources");
    const openDataSourcesAccessTasks = dataSourcesAccessTasks.filter((task) => !isClosed(task.status));
    const dataSourcesAccessTaskFocus = [...dataSourcesAccessTasks]
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime())
      .slice(0, 24);
    const releaseControlTasks = persisted.tasks.filter((task) => toText(task.releaseBuildGateActionId) || toText(task.projectId) === "release-control");
    const openReleaseControlTasks = releaseControlTasks.filter((task) => !isClosed(task.status));
    const releaseControlTaskFocus = [...releaseControlTasks]
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime())
      .slice(0, 24);
    const agentControlPlaneDecisionTasks = persisted.tasks.filter((task) => toText(task.agentControlPlaneDecisionReasonCode) || toText(task.projectId) === "agent-control-plane");
    const openAgentControlPlaneDecisionTasks = agentControlPlaneDecisionTasks.filter((task) => !isClosed(task.status));
    const agentControlPlaneDecisionTaskFocus = [...agentControlPlaneDecisionTasks]
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime())
      .slice(0, 24);
    const activeWorkflows = persisted.workflows.filter((workflow) => !isClosed(workflow.status));
    const pendingMilestones = persisted.milestones.filter((milestone) => !isClosed(milestone.status));
    const decisionNotes = persisted.notes.filter((note) => String(note.kind || "").toLowerCase() === "decision");
    const profiles = Array.isArray(persisted.projectProfiles) ? persisted.projectProfiles : [];
    const profileHistory = Array.isArray(persisted.projectProfileHistory) ? persisted.projectProfileHistory : [];
    const queueSuppressions = Array.isArray(persisted.queueSuppressions) ? persisted.queueSuppressions : [];
    const governanceOperations = Array.isArray(persisted.governanceOperations) ? persisted.governanceOperations : [];
    const deploymentSmokeChecks = Array.isArray(persisted.deploymentSmokeChecks)
      ? normalizeDeploymentSmokeChecks(persisted.deploymentSmokeChecks)
      : [];
    const deploymentSmokeCheckPassCount = deploymentSmokeChecks.filter((item) => toText(item.status) === "pass").length;
    const deploymentSmokeCheckFailCount = deploymentSmokeChecks.filter((item) => toText(item.status) === "fail").length;
    const latestDeploymentSmokeCheck = deploymentSmokeChecks[0] || null;
    const releaseCheckpoints = normalizeReleaseCheckpoints(persisted.releaseCheckpoints);
    const latestReleaseCheckpoint = releaseCheckpoints[0] || null;
    const agentSessions = Array.isArray(persisted.agentSessions) ? persisted.agentSessions : [];
    const agentControlPlaneSnapshots = Array.isArray(persisted.agentControlPlaneSnapshots) ? persisted.agentControlPlaneSnapshots : [];
    const agentControlPlaneBaselineSnapshotId = toText(persisted.agentControlPlaneBaselineSnapshotId);
    const agentControlPlaneBaselineSnapshot = agentControlPlaneSnapshots.find((snapshot) => toText(snapshot.id) === agentControlPlaneBaselineSnapshotId) || null;
    const agentControlPlaneBaselineFreshness = getAgentControlPlaneBaselineFreshness(agentControlPlaneBaselineSnapshot?.createdAt);
    const agentControlPlaneDecisionSnapshots = Array.isArray(persisted.agentControlPlaneDecisionSnapshots) ? persisted.agentControlPlaneDecisionSnapshots : [];
    const agentWorkOrderSnapshots = Array.isArray(persisted.agentWorkOrderSnapshots) ? persisted.agentWorkOrderSnapshots : [];
    const governanceTaskUpdateLedgerSnapshots = Array.isArray(persisted.governanceTaskUpdateLedgerSnapshots) ? persisted.governanceTaskUpdateLedgerSnapshots : [];
    const dataSourceAccessTaskLedgerSnapshots = Array.isArray(persisted.dataSourceAccessTaskLedgerSnapshots) ? persisted.dataSourceAccessTaskLedgerSnapshots : [];
    const agentControlPlaneDecisionTaskLedgerSnapshots = Array.isArray(persisted.agentControlPlaneDecisionTaskLedgerSnapshots) ? persisted.agentControlPlaneDecisionTaskLedgerSnapshots : [];
    const dataSourceAccessValidationEvidence = Array.isArray(persisted.dataSourceAccessValidationEvidence) ? persisted.dataSourceAccessValidationEvidence.map(toControlPlaneRecord) : [];
    const dataSourceAccessValidationEvidenceSnapshots = Array.isArray(persisted.dataSourceAccessValidationEvidenceSnapshots) ? persisted.dataSourceAccessValidationEvidenceSnapshots : [];
    const agentExecutionSlaLedgerSnapshots = Array.isArray(persisted.agentExecutionSlaLedgerSnapshots) ? persisted.agentExecutionSlaLedgerSnapshots : [];
    const agentWorkOrderRuns = Array.isArray(persisted.agentWorkOrderRuns) ? persisted.agentWorkOrderRuns : [];
    const governanceExecutionViews = Array.isArray(persisted.governanceExecutionViews) ? persisted.governanceExecutionViews : [];
    const agentExecutionPolicy = normalizeAgentExecutionPolicy(persisted.governanceExecutionPolicy);
    const dataSourcesAccessGate = options.dataSourcesAccessGate && typeof options.dataSourcesAccessGate === "object"
      ? options.dataSourcesAccessGate
      : null;
    const dataSourcesAccessGateSummary = toControlPlaneRecord(dataSourcesAccessGate);
    const dataSourcesAccessGateDecision = toText(dataSourcesAccessGate?.decision) || "not-evaluated";
    const dataSourcesAccessGateRank = dataSourcesAccessGateDecision === "hold"
      ? 3
      : dataSourcesAccessGateDecision === "review"
        ? 2
        : dataSourcesAccessGateDecision === "ready"
          ? 1
          : 0;
    const dataSourcesAccessReviewQueue = options.dataSourcesAccessReviewQueue && typeof options.dataSourcesAccessReviewQueue === "object"
      ? options.dataSourcesAccessReviewQueue
      : null;
    const dataSourcesAccessReviewQueueSummary = toControlPlaneRecord(dataSourcesAccessReviewQueue?.summary);
    const dataSourcesAccessValidationRunbook = options.dataSourcesAccessValidationRunbook && typeof options.dataSourcesAccessValidationRunbook === "object"
      ? options.dataSourcesAccessValidationRunbook
      : null;
    const dataSourcesAccessValidationRunbookSummary = toControlPlaneRecord(dataSourcesAccessValidationRunbook?.summary);
    const dataSourcesAccessValidationEvidenceCoverage = options.dataSourcesAccessValidationEvidenceCoverage && typeof options.dataSourcesAccessValidationEvidenceCoverage === "object"
      ? options.dataSourcesAccessValidationEvidenceCoverage
      : null;
    const dataSourcesAccessValidationEvidenceCoverageSummary = toControlPlaneRecord(dataSourcesAccessValidationEvidenceCoverage?.summary);
    const releaseBuildGate = options.releaseBuildGate && typeof options.releaseBuildGate === "object"
      ? options.releaseBuildGate
      : null;
    const releaseBuildGateReasons = Array.isArray(releaseBuildGate?.reasons) ? releaseBuildGate.reasons : [];
    const releaseBuildGateActions = Array.isArray(releaseBuildGate?.actions) ? releaseBuildGate.actions : [];
    const releaseBuildGateDecision = toText(releaseBuildGate?.decision) || "not-evaluated";
    const releaseBuildGateRank = releaseBuildGateDecision === "hold"
      ? 3
      : releaseBuildGateDecision === "review"
        ? 2
        : releaseBuildGateDecision === "ready"
          ? 1
          : 0;
    const suppressedQueueIds = new Set(queueSuppressions.map((item) => toText(item.id)).filter(Boolean));
    const profiledProjectIds = new Set(profiles.map((profile) => toText(profile.projectId)).filter(Boolean));
    const profileByProjectId = new Map(profiles.map((profile) => [toText(profile.projectId), profile]));
    const findingCounts = new Map();
    for (const finding of openFindings) {
      const projectId = toText(finding.projectId);
      if (!projectId) continue;
      findingCounts.set(projectId, (findingCounts.get(projectId) || 0) + 1);
    }
    const openTaskProjectIds = new Set(openTasks.map((task) => toText(task.projectId)).filter(Boolean));
    const activeWorkflowProjectIds = new Set(activeWorkflows.map((workflow) => toText(workflow.projectId)).filter(Boolean));
    const decisionProjectIds = new Set(decisionNotes.map((note) => toText(note.projectId)).filter(Boolean));
    const openTaskCounts = new Map();
    for (const task of openTasks) {
      const projectId = toText(task.projectId);
      if (!projectId) continue;
      openTaskCounts.set(projectId, (openTaskCounts.get(projectId) || 0) + 1);
    }
    const activeWorkflowCounts = new Map();
    const latestWorkflowByProjectId = new Map();
    for (const workflow of [...activeWorkflows].sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime())) {
      const projectId = toText(workflow.projectId);
      if (!projectId) continue;
      activeWorkflowCounts.set(projectId, (activeWorkflowCounts.get(projectId) || 0) + 1);
      if (!latestWorkflowByProjectId.has(projectId)) {
        latestWorkflowByProjectId.set(projectId, workflow);
      }
    }
    const agentSessionCounts = new Map();
    const latestAgentSessionByProjectId = new Map();
    for (const session of [...agentSessions].sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime())) {
      const projectId = toText(session.projectId);
      if (!projectId) continue;
      agentSessionCounts.set(projectId, (agentSessionCounts.get(projectId) || 0) + 1);
      if (!latestAgentSessionByProjectId.has(projectId)) {
        latestAgentSessionByProjectId.set(projectId, session);
      }
    }
    const inventoryProjectById = new Map(
      Array.isArray(inventory?.projects)
        ? inventory.projects.map((project) => [toText(project.id), project]).filter(([projectId]) => projectId)
        : []
    );
    const trackedProjectIds = new Set(
      [...persisted.findings, ...persisted.tasks, ...persisted.workflows, ...persisted.notes, ...persisted.milestones, ...profiles, ...agentSessions, ...agentWorkOrderRuns]
        .map((item) => toText(item.projectId))
        .filter(Boolean)
    );

    const recentActivity = [
      ...persisted.findings.map((finding) => ({
        projectId: toText(finding.projectId),
        kind: "finding",
        title: toText(finding.title),
        projectName: toText(finding.projectName) || "Portfolio",
        status: toText(finding.status) || "open",
        timestamp: toText(finding.createdAt),
        detail: toText(finding.detail)
      })),
      ...persisted.tasks.map((task) => ({
        projectId: toText(task.projectId),
        kind: "task",
        title: toText(task.title),
        projectName: toText(task.projectName) || "Portfolio",
        status: toText(task.status) || "open",
        timestamp: toText(task.updatedAt || task.createdAt),
        detail: toText(task.description)
      })),
      ...persisted.workflows.map((workflow) => ({
        projectId: toText(workflow.projectId),
        kind: "workflow",
        title: toText(workflow.title),
        projectName: toText(workflow.projectName) || "Portfolio",
        status: toText(workflow.status) || "draft",
        timestamp: toText(workflow.updatedAt || workflow.createdAt),
        detail: toText(workflow.phase)
      })),
      ...persisted.notes.map((note) => ({
        projectId: toText(note.projectId),
        kind: String(note.kind || "").toLowerCase() === "decision" ? "decision" : "note",
        title: toText(note.title),
        projectName: toText(note.projectName) || "Portfolio",
        status: toText(note.kind) || "note",
        timestamp: toText(note.updatedAt || note.createdAt),
        detail: toText(note.body)
      })),
      ...persisted.milestones.map((milestone) => ({
        projectId: toText(milestone.projectId),
        kind: "milestone",
        title: toText(milestone.title),
        projectName: toText(milestone.projectName) || "Portfolio",
        status: toText(milestone.status) || "planned",
        timestamp: toText(milestone.updatedAt || milestone.createdAt || milestone.targetDate),
        detail: toText(milestone.detail || milestone.targetDate)
      })),
      ...profiles.map((profile) => ({
        projectId: toText(profile.projectId),
        kind: "profile",
        title: toText(profile.projectName) || "Project profile",
        projectName: toText(profile.projectName) || "Portfolio",
        status: toText(profile.status) || "unassigned",
        timestamp: toText(profile.updatedAt || profile.createdAt),
        detail: [toText(profile.owner), toText(profile.lifecycle), toText(profile.tier), toText(profile.targetState)]
          .filter(Boolean)
          .join(" • ")
      })),
      ...profileHistory.map((entry) => ({
        projectId: toText(entry.projectId),
        kind: "profile-history",
        title: toText(entry.projectName) || "Governance change",
        projectName: toText(entry.projectName) || "Portfolio",
        status: toText(entry.changeType) || "updated",
        timestamp: toText(entry.changedAt),
        detail: Array.isArray(entry.changedFields) && entry.changedFields.length
          ? `Changed: ${entry.changedFields.join(", ")}`
          : "Governance profile snapshot recorded."
      })),
      ...deploymentSmokeChecks.map((smokeCheck) => ({
        projectId: "deployments",
        kind: "deployment-smoke-check",
        title: toText(smokeCheck.label) || toText(smokeCheck.host) || "Deployment smoke check",
        projectName: "Deployment Health",
        status: toText(smokeCheck.status) || "fail",
        timestamp: toText(smokeCheck.checkedAt),
        detail: `${toText(smokeCheck.provider) || "deployment"} | HTTP ${toNumber(smokeCheck.httpStatus) || "unreachable"} | ${toNumber(smokeCheck.latencyMs)}ms`
      })),
      ...releaseCheckpoints.map((checkpoint) => ({
        projectId: "release-control",
        kind: "release-checkpoint",
        title: toText(checkpoint.title) || "Release checkpoint",
        projectName: "Release Control",
        status: toText(checkpoint.status) || "review",
        timestamp: toText(checkpoint.createdAt),
        detail: `${toText(checkpoint.commitShort) || "no-commit"} | ${toText(checkpoint.deploymentStatus) || "no-smoke"} | ${toText(checkpoint.validationStatus) || "not-validated"}`
      })),
      ...agentWorkOrderSnapshots.map((snapshot) => ({
        projectId: "",
        kind: "agent-work-order-snapshot",
        title: toText(snapshot.title) || "Agent Work Orders",
        projectName: "Portfolio",
        status: toText(snapshot.statusFilter) || "all",
        timestamp: toText(snapshot.createdAt),
        detail: `${toNumber(snapshot.total)} work order(s)`
      })),
      ...agentControlPlaneSnapshots.map((snapshot) => ({
        projectId: "",
        kind: "agent-control-plane-snapshot",
        title: toText(snapshot.title) || "Agent Control Plane",
        projectName: "Portfolio",
        status: "control-plane",
        timestamp: toText(snapshot.createdAt),
        detail: `${toNumber(snapshot.totalWorkOrders)} work order(s), ${toNumber(snapshot.totalExecutionRuns)} execution run(s)`
      })),
      ...agentControlPlaneDecisionSnapshots.map((snapshot) => ({
        projectId: "",
        kind: "agent-control-plane-decision-snapshot",
        title: toText(snapshot.title) || "Agent Control Plane Decision",
        projectName: "Portfolio",
        status: toText(snapshot.decision) || "review",
        timestamp: toText(snapshot.createdAt),
        detail: `${toNumber(snapshot.reasonCount)} decision reason(s), drift ${toText(snapshot.baselineDriftSeverity) || "missing-baseline"}`
      })),
      ...agentExecutionSlaLedgerSnapshots.map((snapshot) => ({
        projectId: "",
        kind: "agent-execution-sla-ledger-snapshot",
        title: toText(snapshot.title) || "SLA Breach Ledger",
        projectName: "Portfolio",
        status: toText(snapshot.stateFilter) || "all",
        timestamp: toText(snapshot.createdAt),
        detail: `${toNumber(snapshot.total)} SLA ledger record(s)`
      })),
      ...dataSourceAccessValidationEvidence.map((evidence) => ({
        projectId: "data-sources",
        kind: "data-source-access-validation-evidence",
        title: toText(evidence.sourceLabel) || toText(evidence.sourceId) || "Source access validation evidence",
        projectName: "Data Sources",
        status: toText(evidence.status) || "review",
        timestamp: toText(evidence.checkedAt || evidence.createdAt),
        detail: `${toText(evidence.accessMethod) || "review-required"} | ${toText(evidence.evidence)}`
      })),
      ...dataSourceAccessValidationEvidenceSnapshots.map((snapshot) => ({
        projectId: "data-sources",
        kind: "data-source-access-validation-evidence-snapshot",
        title: toText(snapshot.title) || "Data Sources Access Validation Evidence",
        projectName: "Data Sources",
        status: toText(snapshot.statusFilter) || "all",
        timestamp: toText(snapshot.createdAt),
        detail: `${toNumber(snapshot.total)} evidence record(s), ${toNumber(snapshot.blockedCount)} blocked`
      })),
      ...agentWorkOrderRuns.map((run) => ({
        projectId: toText(run.projectId),
        kind: "agent-work-order-run",
        title: toText(run.title) || "Agent Work Order Run",
        projectName: toText(run.projectName) || "Portfolio",
        status: toText(run.status) || "queued",
        timestamp: toText(run.updatedAt || run.createdAt),
        detail: toText(run.objective)
      })),
      ...agentSessions.map((session) => ({
        projectId: toText(session.projectId),
        kind: "agent-session",
        title: toText(session.title),
        projectName: toText(session.projectName) || "Portfolio",
        status: toText(session.status) || "prepared",
        timestamp: toText(session.updatedAt || session.createdAt),
        detail: toText(session.summary)
      }))
    ]
      .filter((item) => item.title && item.timestamp)
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
      .slice(0, 12);

    const workflowFocus = [...activeWorkflows]
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime())
      .slice(0, 8);
    const milestoneFocus = [...pendingMilestones]
      .sort((left, right) => {
        const leftDate = toText(left.targetDate) ? new Date(toText(left.targetDate)).getTime() : Number.MAX_SAFE_INTEGER;
        const rightDate = toText(right.targetDate) ? new Date(toText(right.targetDate)).getTime() : Number.MAX_SAFE_INTEGER;
        return leftDate - rightDate;
      })
      .slice(0, 8);
    const decisions = [...decisionNotes]
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime())
      .slice(0, 8);
    const unprofiledProjects = Array.isArray(inventory?.projects)
      ? [...inventory.projects]
          .filter((project) => !profiledProjectIds.has(toText(project.id)))
          .sort((left, right) => {
            const findingDelta = (findingCounts.get(toText(right.id)) || 0) - (findingCounts.get(toText(left.id)) || 0);
            if (findingDelta) return findingDelta;
            return toNumber(right.qualityScore) - toNumber(left.qualityScore);
          })
          .slice(0, 12)
          .map((project) => ({
            id: toText(project.id),
            name: toText(project.name),
            relPath: toText(project.relPath),
            zone: toText(project.zone),
            category: toText(project.category),
            qualityScore: toNumber(project.qualityScore),
            findingCount: findingCounts.get(toText(project.id)) || 0
          }))
      : [];
    const priorityRank = {
      high: 0,
      medium: 1,
      low: 2
    };
    const actionQueue = [
      ...unprofiledProjects.map((project) => ({
        id: `queue-profile-gap-${project.id}`,
        projectId: project.id,
        projectName: project.name,
        kind: "profile-gap",
        title: "Seed governance starter pack",
        detail: `${project.findingCount} open findings • ${project.category} • ${project.zone} • ${project.relPath}`,
        priority: project.findingCount >= 2 || project.zone === "workspace" ? "high" : "medium",
        actionType: "create-starter-pack",
        actionLabel: "Seed Starter Pack"
      })),
      ...profiles.flatMap((profile) => {
        const projectId = toText(profile.projectId);
        const projectName = toText(profile.projectName) || "Project";
        const targetState = toText(profile.targetState);
        const tier = toText(profile.tier);
        const profileFindings = findingCounts.get(projectId) || 0;
        /** @type {Array<{
         *   id: string,
         *   projectId: string,
         *   projectName: string,
         *   kind: "profile-gap" | "owner-gap" | "task-gap" | "workflow-gap" | "decision-gap",
         *   title: string,
         *   detail: string,
         *   priority: "high" | "medium" | "low",
         *   actionType: "create-profile" | "create-task" | "create-workflow" | "create-starter-pack" | "create-decision-note" | "open-project",
         *   actionLabel: string
         * }>} */
        const queueItems = [];

        if (!toText(profile.owner)) {
          queueItems.push({
            id: `queue-owner-gap-${projectId}`,
            projectId,
            projectName,
            kind: "owner-gap",
            title: "Assign a project owner",
            detail: `${profileFindings} open findings • ${tier || "tier unset"} • ${toText(profile.status) || "status unset"}`,
            priority: tier === "core" || tier === "important" ? "high" : "medium",
            actionType: "open-project",
            actionLabel: "Open Workbench"
          });
        }

        if (!openTaskProjectIds.has(projectId)) {
          queueItems.push({
            id: `queue-task-gap-${projectId}`,
            projectId,
            projectName,
            kind: "task-gap",
            title: "Create a follow-up task",
            detail: `${profileFindings} open findings • no open tasks linked to this project`,
            priority: profileFindings > 0 ? "high" : "medium",
            actionType: "create-task",
            actionLabel: "Create Task"
          });
        }

        if (!activeWorkflowProjectIds.has(projectId)) {
          queueItems.push({
            id: `queue-workflow-gap-${projectId}`,
            projectId,
            projectName,
            kind: "workflow-gap",
            title: "Create a workflow stream",
            detail: `${toText(profile.lifecycle) || "lifecycle unset"} • no active workflow is guiding this project`,
            priority: tier === "core" ? "high" : "medium",
            actionType: "create-workflow",
            actionLabel: "Create Workflow"
          });
        }

        if ((targetState === "merge" || targetState === "archive") && !decisionProjectIds.has(projectId)) {
          queueItems.push({
            id: `queue-decision-gap-${projectId}`,
            projectId,
            projectName,
            kind: "decision-gap",
            title: "Record a governance decision",
            detail: `Target state is ${targetState}, but no decision note has been captured yet`,
            priority: "high",
            actionType: "create-decision-note",
            actionLabel: "Create Decision"
          });
        }

        return queueItems;
      })
    ]
      .filter((item) => !suppressedQueueIds.has(toText(item.id)))
      .sort((left, right) => {
        const priorityDelta = priorityRank[left.priority] - priorityRank[right.priority];
        if (priorityDelta) return priorityDelta;
        const projectDelta = left.projectName.localeCompare(right.projectName);
        if (projectDelta) return projectDelta;
        return left.title.localeCompare(right.title);
      })
      .slice(0, 24);
    const operationLog = [...governanceOperations]
      .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())
      .slice(0, 24);
    const agentSessionFocus = [...agentSessions]
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime())
      .slice(0, 24);
    const agentWorkOrderSnapshotFocus = [...agentWorkOrderSnapshots]
      .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())
      .slice(0, 24);
    const agentControlPlaneSnapshotFocus = [...agentControlPlaneSnapshots]
      .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())
      .map((snapshot) => ({
        ...snapshot,
        isBaseline: toText(snapshot.id) === agentControlPlaneBaselineSnapshotId
      }))
      .slice(0, 24);
    const agentControlPlaneDecisionSnapshotFocus = [...agentControlPlaneDecisionSnapshots]
      .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())
      .slice(0, 24);
    const agentExecutionSlaLedgerSnapshotFocus = [...agentExecutionSlaLedgerSnapshots]
      .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())
      .slice(0, 24);
    const dataSourceAccessTaskLedgerSnapshotFocus = [...dataSourceAccessTaskLedgerSnapshots]
      .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())
      .slice(0, 24);
    const governanceTaskUpdateLedgerSnapshotFocus = [...governanceTaskUpdateLedgerSnapshots]
      .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())
      .slice(0, 24);
    const agentControlPlaneDecisionTaskLedgerSnapshotFocus = [...agentControlPlaneDecisionTaskLedgerSnapshots]
      .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())
      .slice(0, 24);
    const dataSourceAccessValidationEvidenceFocus = [...dataSourceAccessValidationEvidence]
      .sort((left, right) => new Date(toText(right.checkedAt || right.createdAt)).getTime() - new Date(toText(left.checkedAt || left.createdAt)).getTime())
      .slice(0, 24);
    const dataSourceAccessValidationEvidenceSnapshotFocus = [...dataSourceAccessValidationEvidenceSnapshots]
      .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())
      .slice(0, 24);
    const dataSourceAccessValidationEvidenceSnapshotDiff = dataSourceAccessValidationEvidenceSnapshotFocus[0]
      ? createSourcesAccessValidationEvidenceSnapshotDiffPayload(toControlPlaneRecord(dataSourceAccessValidationEvidenceSnapshotFocus[0]), createSourcesAccessValidationEvidencePayload(persisted, {
          status: toText(dataSourceAccessValidationEvidenceSnapshotFocus[0].statusFilter) || "all",
          sourceId: toText(dataSourceAccessValidationEvidenceSnapshotFocus[0].sourceId),
          accessMethod: toText(dataSourceAccessValidationEvidenceSnapshotFocus[0].accessMethod),
          limit: Number(dataSourceAccessValidationEvidenceSnapshotFocus[0].limit || 100)
        }))
      : createMissingSourcesAccessValidationEvidenceSnapshotDiffPayload();
    const agentWorkOrderRunFocus = [...agentWorkOrderRuns]
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime())
      .slice(0, 24);
    const archivedAgentWorkOrderRuns = agentWorkOrderRuns.filter((run) => toText(run.archivedAt));
    const activeAgentWorkOrderRunCorpus = agentWorkOrderRuns.filter((run) => !toText(run.archivedAt));
    const executionStatusCounts = {
      queued: 0,
      running: 0,
      blocked: 0,
      passed: 0,
      failed: 0,
      cancelled: 0,
      other: 0
    };
    const activeRunStatuses = new Set(agentExecutionPolicy.staleStatuses);
    const staleRunCutoff = Date.now() - (agentExecutionPolicy.staleThresholdHours * 60 * 60 * 1000);
    const activeAgentWorkOrderRuns = [];
    const staleActiveAgentWorkOrderRuns = [];
    const slaBreachedAgentWorkOrderRuns = [];
    const slaResolvedAgentWorkOrderRuns = [];
    const slaResolutionDurations = [];
    const executionEvents = [];

    for (const run of activeAgentWorkOrderRunCorpus) {
      const status = toText(run.status) || "queued";
      if (Object.hasOwn(executionStatusCounts, status)) {
        executionStatusCounts[status] += 1;
      } else {
        executionStatusCounts.other += 1;
      }

      if (activeRunStatuses.has(status)) {
        activeAgentWorkOrderRuns.push(run);
        if (toText(run.slaBreachedAt) && !toText(run.slaResolvedAt)) {
          slaBreachedAgentWorkOrderRuns.push(run);
        }
        const slaResolvedAt = toText(run.slaResolvedAt);
        if (slaResolvedAt) {
          slaResolvedAgentWorkOrderRuns.push(run);
          const breachedAtTime = new Date(toText(run.slaBreachedAt)).getTime();
          const resolvedAtTime = new Date(slaResolvedAt).getTime();
          if (Number.isFinite(breachedAtTime) && Number.isFinite(resolvedAtTime) && resolvedAtTime >= breachedAtTime) {
            slaResolutionDurations.push(resolvedAtTime - breachedAtTime);
          }
        }
        const timestamp = new Date(toText(run.updatedAt || run.createdAt)).getTime();
        if (Number.isFinite(timestamp) && timestamp < staleRunCutoff) {
          staleActiveAgentWorkOrderRuns.push(run);
        }
      }

      const history = Array.isArray(run.history) ? run.history : [];
      for (const event of history) {
        const createdAt = toText(event.createdAt);
        if (!createdAt) continue;
        executionEvents.push({
          createdAt,
          note: toText(event.note),
          status: toText(event.status) || status,
          projectName: toText(run.projectName) || "Portfolio",
          runTitle: toText(run.title) || "Agent Work Order Run"
        });
      }
    }

    executionEvents.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    const latestExecutionEvent = executionEvents[0] || null;
    const completedAgentWorkOrderRunCount = executionStatusCounts.passed + executionStatusCounts.failed + executionStatusCounts.cancelled;
    const agentExecutionSlaLedger = activeAgentWorkOrderRunCorpus
      .filter((run) => toText(run.slaBreachedAt))
      .map((run) => {
        const breachedAt = toText(run.slaBreachedAt);
        const resolvedAt = toText(run.slaResolvedAt);
        const breachedAtTime = new Date(breachedAt).getTime();
        const resolvedAtTime = new Date(resolvedAt).getTime();
        const durationMs = Number.isFinite(breachedAtTime)
          ? (Number.isFinite(resolvedAtTime) && resolvedAtTime >= breachedAtTime ? resolvedAtTime - breachedAtTime : Date.now() - breachedAtTime)
          : 0;
        return {
          id: toText(run.id),
          projectId: toText(run.projectId),
          projectName: toText(run.projectName) || "Portfolio",
          title: toText(run.title) || "Agent Work Order Run",
          status: toText(run.status) || "queued",
          breachState: resolvedAt ? "resolved" : "open",
          action: toText(run.slaAction) || (resolvedAt ? "resolved" : "breached"),
          breachedAt,
          resolvedAt,
          escalationCount: toNumber(run.slaEscalationCount),
          resolutionCount: toNumber(run.slaResolutionCount),
          durationHours: durationMs > 0 ? Math.round((durationMs / (60 * 60 * 1000)) * 10) / 10 : 0,
          updatedAt: toText(run.updatedAt || run.createdAt)
        };
      })
      .sort((left, right) => new Date(right.updatedAt || right.breachedAt).getTime() - new Date(left.updatedAt || left.breachedAt).getTime())
      .slice(0, 24);
    const agentExecutionMetrics = {
      total: activeAgentWorkOrderRunCorpus.length,
      active: activeAgentWorkOrderRuns.length,
      completed: completedAgentWorkOrderRunCount,
      archived: archivedAgentWorkOrderRuns.length,
      staleActive: staleActiveAgentWorkOrderRuns.length,
      slaBreached: slaBreachedAgentWorkOrderRuns.length,
      slaResolved: slaResolvedAgentWorkOrderRuns.length,
      slaAverageResolutionHours: slaResolutionDurations.length
        ? Math.round((slaResolutionDurations.reduce((total, duration) => total + duration, 0) / slaResolutionDurations.length) / (60 * 60 * 1000) * 10) / 10
        : 0,
      staleThresholdHours: agentExecutionPolicy.staleThresholdHours,
      staleStatuses: agentExecutionPolicy.staleStatuses,
      completionRate: activeAgentWorkOrderRunCorpus.length ? Math.round((completedAgentWorkOrderRunCount / activeAgentWorkOrderRunCorpus.length) * 100) : 0,
      failureRate: completedAgentWorkOrderRunCount ? Math.round((executionStatusCounts.failed / completedAgentWorkOrderRunCount) * 100) : 0,
      statusCounts: executionStatusCounts,
      latestEventAt: latestExecutionEvent?.createdAt || "",
      latestEventNote: latestExecutionEvent?.note || "",
      latestEventStatus: latestExecutionEvent?.status || "",
      latestEventProjectName: latestExecutionEvent?.projectName || "",
      latestEventRunTitle: latestExecutionEvent?.runTitle || ""
    };
    const workflowPhaseRank = {
      brief: 0,
      planning: 1,
      approval: 2,
      implementation: 3,
      review: 4,
      done: 5
    };
    const workflowRunbook = [...activeWorkflows]
      .map((workflow) => {
        const projectId = toText(workflow.projectId);
        const phase = toText(workflow.phase) || "brief";
        const status = toText(workflow.status) || "draft";
        const profile = profileByProjectId.get(projectId);
        const blockers = [];
        if (!toText(profile?.owner)) blockers.push("owner missing");
        if (phase === "approval" && status !== "approved") blockers.push("approval pending");
        if ((findingCounts.get(projectId) || 0) > 0) blockers.push(`${findingCounts.get(projectId)} open finding(s)`);
        if (!openTaskProjectIds.has(projectId)) blockers.push("no open execution task");

        const readiness = phase === "implementation" && !blockers.includes("approval pending")
          ? "ready-for-supervised-build"
          : phase === "review"
            ? "ready-for-review"
            : phase === "approval"
              ? "needs-human-approval"
              : "needs-planning";
        const nextStep = phase === "brief"
          ? "Expand the brief into a concrete plan and acceptance criteria."
          : phase === "planning"
            ? "Confirm the implementation path, owner, and validation checklist."
            : phase === "approval"
              ? "Approve or revise the plan before implementation work starts."
              : phase === "implementation"
                ? "Run supervised build commands from the workbench launchpad and capture results."
                : phase === "review"
                  ? "Run validation, review changes, and decide whether to mark the workflow done."
                  : "Workflow is complete; reopen only if follow-up work is required.";

        return {
          id: toText(workflow.id),
          projectId,
          projectName: toText(workflow.projectName) || "Portfolio",
          title: toText(workflow.title),
          phase,
          status,
          readiness,
          priority: blockers.length || phase === "implementation" ? "high" : "medium",
          blockers,
          nextStep,
          updatedAt: toText(workflow.updatedAt || workflow.createdAt)
        };
      })
      .sort((left, right) => {
        const phaseDelta = (workflowPhaseRank[left.phase] ?? 99) - (workflowPhaseRank[right.phase] ?? 99);
        if (phaseDelta) return phaseDelta;
        const blockerDelta = right.blockers.length - left.blockers.length;
        if (blockerDelta) return blockerDelta;
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      })
      .slice(0, 12);

    const readinessProjectIds = new Set([
      ...trackedProjectIds,
      ...unprofiledProjects.map((project) => project.id)
    ]);
    const agentReadinessMatrix = [...readinessProjectIds]
      .map((projectId) => {
        const profile = profileByProjectId.get(projectId);
        const inventoryProject = inventoryProjectById.get(projectId);
        const latestWorkflow = latestWorkflowByProjectId.get(projectId);
        const latestAgentSession = latestAgentSessionByProjectId.get(projectId);
        const projectName = toText(profile?.projectName) || toText(inventoryProject?.name) || toText(latestWorkflow?.projectName) || toText(latestAgentSession?.projectName);
        const relPath = toText(inventoryProject?.relPath) || toText(latestAgentSession?.relPath);
        const openFindingCount = findingCounts.get(projectId) || 0;
        const openTaskCount = openTaskCounts.get(projectId) || 0;
        const activeWorkflowCount = activeWorkflowCounts.get(projectId) || 0;
        const agentSessionCount = agentSessionCounts.get(projectId) || 0;
        const blockers = [];
        let score = 10;

        if (profile) {
          score += 20;
        } else {
          blockers.push("profile missing");
        }

        if (toText(profile?.owner)) {
          score += 15;
        } else {
          blockers.push("owner missing");
        }

        if (activeWorkflowCount) {
          score += 20;
        } else {
          blockers.push("active workflow missing");
        }

        if (openFindingCount) {
          score += Math.max(0, 15 - (openFindingCount * 5));
          blockers.push(`${openFindingCount} open finding(s)`);
        } else {
          score += 15;
        }

        if (openTaskCount) {
          score += 10;
        } else {
          blockers.push("open execution task missing");
        }

        if (agentSessionCount) {
          score += 20;
        } else {
          blockers.push("agent handoff missing");
        }

        score = Math.min(100, score);
        const status = score >= 80 && blockers.length <= 1
          ? "ready"
          : score >= 55
            ? "needs-prep"
            : "blocked";
        const firstBlocker = blockers[0] || "";
        const nextStep = firstBlocker === "profile missing"
          ? "Seed a governance starter pack for this project."
          : firstBlocker === "owner missing"
            ? "Assign a project owner before supervised build work starts."
            : firstBlocker === "active workflow missing"
              ? "Create or reactivate a workflow stream for supervised implementation."
              : firstBlocker.includes("open finding")
                ? "Resolve or explicitly defer open findings before the next build pass."
                : firstBlocker === "open execution task missing"
                  ? "Create a concrete execution task linked to this project."
                  : firstBlocker === "agent handoff missing"
                    ? "Create an Agent Handoff Pack from the project workbench."
                    : "Project is ready for a supervised agent build pass.";
        const updatedAt = toText(profile?.updatedAt || profile?.createdAt)
          || toText(latestWorkflow?.updatedAt || latestWorkflow?.createdAt)
          || toText(latestAgentSession?.updatedAt || latestAgentSession?.createdAt)
          || toText(inventoryProject?.lastModified)
          || new Date().toISOString();

        return {
          projectId,
          projectName,
          relPath,
          status,
          score,
          owner: toText(profile?.owner),
          lifecycle: toText(profile?.lifecycle),
          targetState: toText(profile?.targetState),
          openFindingCount,
          openTaskCount,
          activeWorkflowCount,
          agentSessionCount,
          latestWorkflowTitle: toText(latestWorkflow?.title),
          latestAgentSessionAt: toText(latestAgentSession?.updatedAt || latestAgentSession?.createdAt),
          blockers,
          nextStep,
          updatedAt
        };
      })
      .filter((item) => item.projectId && item.projectName)
      .sort((left, right) => {
        const statusRank = { blocked: 0, "needs-prep": 1, ready: 2 };
        const statusDelta = statusRank[left.status] - statusRank[right.status];
        if (statusDelta) return statusDelta;
        const scoreDelta = left.score - right.score;
        if (scoreDelta) return scoreDelta;
        const findingDelta = right.openFindingCount - left.openFindingCount;
        if (findingDelta) return findingDelta;
        return left.projectName.localeCompare(right.projectName);
      })
      .slice(0, 24);

    const summary = {
      openFindings: openFindings.length,
      openTasks: openTasks.length,
      activeWorkflows: activeWorkflows.length,
      pendingMilestones: pendingMilestones.length,
      decisionNotes: decisionNotes.length,
      trackedProjects: trackedProjectIds.size,
      profileCount: profiles.length,
      ownedProfiles: profiles.filter((profile) => toText(profile.owner)).length,
      actionQueueItems: actionQueue.length,
      suppressedQueueItems: queueSuppressions.length,
      governanceOperationCount: governanceOperations.length,
      workflowRunbookItems: workflowRunbook.length,
      agentSessionCount: agentSessions.length,
      agentControlPlaneSnapshotCount: agentControlPlaneSnapshots.length,
      agentControlPlaneDecisionSnapshotCount: agentControlPlaneDecisionSnapshots.length,
      agentControlPlaneBaselineSnapshotId,
      agentControlPlaneBaselineSnapshotTitle: toText(agentControlPlaneBaselineSnapshot?.title),
      agentControlPlaneBaselineSnapshotCreatedAt: toText(agentControlPlaneBaselineSnapshot?.createdAt),
      agentControlPlaneBaselineAgeHours: agentControlPlaneBaselineFreshness.baselineAgeHours,
      agentControlPlaneBaselineFreshness: agentControlPlaneBaselineFreshness.baselineFreshness,
      agentControlPlaneBaselineFreshnessThresholdHours: agentControlPlaneBaselineFreshness.baselineFreshnessThresholdHours,
      agentControlPlaneBaselineHasDrift: false,
      agentControlPlaneBaselineDriftScore: 0,
      agentControlPlaneBaselineDriftItems: [],
      agentControlPlaneBaselineDriftSeverity: "missing-baseline",
      agentControlPlaneBaselineDriftRecommendedAction: "Save or mark an Agent Control Plane snapshot as baseline before using baseline-vs-live drift.",
      agentControlPlaneBaselineHealth: "missing",
      agentControlPlaneBaselineRecommendedAction: "Save or mark an Agent Control Plane snapshot as baseline.",
      agentWorkOrderSnapshotCount: agentWorkOrderSnapshots.length,
      governanceTaskUpdateLedgerSnapshotCount: governanceTaskUpdateLedgerSnapshots.length,
      dataSourceAccessTaskLedgerSnapshotCount: dataSourceAccessTaskLedgerSnapshots.length,
      agentControlPlaneDecisionTaskLedgerSnapshotCount: agentControlPlaneDecisionTaskLedgerSnapshots.length,
      dataSourceAccessValidationEvidenceSnapshotCount: dataSourceAccessValidationEvidenceSnapshots.length,
      agentExecutionSlaLedgerSnapshotCount: agentExecutionSlaLedgerSnapshots.length,
      agentWorkOrderRunCount: agentWorkOrderRuns.length,
      governanceExecutionViewCount: governanceExecutionViews.length,
      deploymentSmokeCheckCount: deploymentSmokeChecks.length,
      deploymentSmokeCheckPassCount,
      deploymentSmokeCheckFailCount,
      deploymentLatestSmokeCheckStatus: toText(latestDeploymentSmokeCheck?.status),
      deploymentLatestSmokeCheckAt: toText(latestDeploymentSmokeCheck?.checkedAt),
      deploymentLatestSmokeCheckTarget: toText(latestDeploymentSmokeCheck?.label) || toText(latestDeploymentSmokeCheck?.host),
      releaseCheckpointCount: releaseCheckpoints.length,
      releaseLatestCheckpointStatus: toText(latestReleaseCheckpoint?.status),
      releaseLatestCheckpointAt: toText(latestReleaseCheckpoint?.createdAt),
      releaseLatestCheckpointTitle: toText(latestReleaseCheckpoint?.title),
      releaseBuildGateDecision,
      releaseBuildGateRank,
      releaseBuildGateRiskScore: toNumber(releaseBuildGate?.riskScore),
      releaseBuildGateReasonCount: releaseBuildGateReasons.length,
      releaseBuildGateActionCount: releaseBuildGateActions.length,
      releaseControlTaskCount: releaseControlTasks.length,
      releaseControlOpenTaskCount: openReleaseControlTasks.length,
      releaseControlClosedTaskCount: releaseControlTasks.length - openReleaseControlTasks.length,
      agentControlPlaneDecisionTaskCount: agentControlPlaneDecisionTasks.length,
      agentControlPlaneDecisionOpenTaskCount: openAgentControlPlaneDecisionTasks.length,
      agentControlPlaneDecisionClosedTaskCount: agentControlPlaneDecisionTasks.length - openAgentControlPlaneDecisionTasks.length,
      archivedAgentWorkOrderRunCount: archivedAgentWorkOrderRuns.length,
      activeAgentWorkOrderRunCount: activeAgentWorkOrderRuns.length,
      blockedAgentWorkOrderRunCount: executionStatusCounts.blocked,
      staleAgentWorkOrderRunCount: staleActiveAgentWorkOrderRuns.length,
      slaBreachedAgentWorkOrderRunCount: slaBreachedAgentWorkOrderRuns.length,
      agentExecutionSlaLedgerCount: agentExecutionSlaLedger.length,
      dataSourcesAccessGateDecision,
      dataSourcesAccessGateRank,
      dataSourcesAccessReadyCount: toNumber(dataSourcesAccessGateSummary.ready),
      dataSourcesAccessReviewCount: toNumber(dataSourcesAccessGateSummary.review),
      dataSourcesAccessBlockedCount: toNumber(dataSourcesAccessGateSummary.blocked),
      dataSourcesAccessTokenLikelyCount: toNumber(dataSourcesAccessGateSummary.tokenLikely),
      dataSourcesAccessReviewQueueCount: toNumber(dataSourcesAccessReviewQueueSummary.total),
      dataSourcesAccessReviewBlockedCount: toNumber(dataSourcesAccessReviewQueueSummary.blocked),
      dataSourcesAccessReviewHighCount: toNumber(dataSourcesAccessReviewQueueSummary.high),
      dataSourcesAccessReviewMediumCount: toNumber(dataSourcesAccessReviewQueueSummary.medium),
      dataSourcesAccessValidationMethodCount: toNumber(dataSourcesAccessValidationRunbookSummary.methodCount),
      dataSourcesAccessValidationSourceCount: toNumber(dataSourcesAccessValidationRunbookSummary.sourceCount),
      dataSourcesAccessValidationReviewCount: toNumber(dataSourcesAccessValidationRunbookSummary.review),
      dataSourcesAccessValidationBlockedCount: toNumber(dataSourcesAccessValidationRunbookSummary.blocked),
      dataSourcesAccessValidationEvidenceCount: dataSourceAccessValidationEvidence.length,
      dataSourcesAccessValidationEvidenceValidatedCount: dataSourceAccessValidationEvidence.filter((item) => toText(item.status) === "validated").length,
      dataSourcesAccessValidationEvidenceReviewCount: dataSourceAccessValidationEvidence.filter((item) => toText(item.status) === "review").length,
      dataSourcesAccessValidationEvidenceBlockedCount: dataSourceAccessValidationEvidence.filter((item) => toText(item.status) === "blocked").length,
      dataSourcesAccessValidationEvidenceCoverageCount: toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.sourceCount),
      dataSourcesAccessValidationEvidenceCoverageCoveredCount: toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.covered),
      dataSourcesAccessValidationEvidenceCoverageReviewCount: toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.review),
      dataSourcesAccessValidationEvidenceCoverageBlockedCount: toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.blocked),
      dataSourcesAccessValidationEvidenceCoverageMissingCount: toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.missing),
      dataSourcesAccessValidationEvidenceCoverageHighPriorityCount: toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.highPriority),
      dataSourcesAccessValidationEvidenceCoveragePercent: toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.coveragePercent),
      dataSourcesAccessTaskCount: dataSourcesAccessTasks.length,
      dataSourcesAccessOpenTaskCount: openDataSourcesAccessTasks.length,
      dataSourcesAccessClosedTaskCount: dataSourcesAccessTasks.length - openDataSourcesAccessTasks.length,
      dataSourceAccessValidationEvidenceSnapshotHasDrift: Boolean(dataSourceAccessValidationEvidenceSnapshotDiff.hasDrift),
      dataSourceAccessValidationEvidenceSnapshotDriftScore: toNumber(dataSourceAccessValidationEvidenceSnapshotDiff.driftScore),
      dataSourceAccessValidationEvidenceSnapshotDriftSeverity: toText(dataSourceAccessValidationEvidenceSnapshotDiff.driftSeverity) || "missing-snapshot",
      agentReadyProjects: agentReadinessMatrix.filter((item) => item.status === "ready").length,
      agentReadinessItems: agentReadinessMatrix.length
    };
    const baselineSummary = toControlPlaneRecord(agentControlPlaneBaselineSnapshot?.summary);
    const baselineDriftFields = [
      { field: "openFindings", label: "Open Findings" },
      { field: "openTasks", label: "Open Tasks" },
      { field: "activeWorkflows", label: "Active Workflows" },
      { field: "pendingMilestones", label: "Pending Milestones" },
      { field: "actionQueueItems", label: "Action Queue Items" },
      { field: "workflowRunbookItems", label: "Workflow Runbook Items" },
      { field: "agentSessionCount", label: "Agent Sessions" },
      { field: "agentWorkOrderSnapshotCount", label: "Work Order Snapshots" },
      { field: "agentControlPlaneDecisionSnapshotCount", label: "Decision Snapshots" },
      { field: "agentExecutionSlaLedgerSnapshotCount", label: "SLA Ledger Snapshots" },
      { field: "agentWorkOrderRunCount", label: "Execution Runs" },
      { field: "activeAgentWorkOrderRunCount", label: "Active Execution Runs" },
      { field: "staleAgentWorkOrderRunCount", label: "Stale Execution Runs" },
      { field: "slaBreachedAgentWorkOrderRunCount", label: "SLA Breached Runs" },
      { field: "agentExecutionSlaLedgerCount", label: "SLA Ledger Records" },
      { field: "deploymentSmokeCheckCount", label: "Deployment Smoke Checks" },
      { field: "deploymentSmokeCheckPassCount", label: "Deployment Smoke Check Passes" },
      { field: "deploymentSmokeCheckFailCount", label: "Deployment Smoke Check Fails" },
      { field: "releaseCheckpointCount", label: "Release Checkpoints" },
      { field: "releaseBuildGateRank", label: "Release Build Gate Rank" },
      { field: "releaseBuildGateRiskScore", label: "Release Build Gate Risk Score" },
      { field: "releaseBuildGateReasonCount", label: "Release Build Gate Reasons" },
      { field: "releaseBuildGateActionCount", label: "Release Build Gate Actions" },
      { field: "releaseControlTaskCount", label: "Release Control Tasks" },
      { field: "releaseControlOpenTaskCount", label: "Release Control Open Tasks" },
      { field: "agentControlPlaneDecisionTaskCount", label: "Control Plane Decision Tasks" },
      { field: "agentControlPlaneDecisionOpenTaskCount", label: "Control Plane Decision Open Tasks" },
      { field: "dataSourcesAccessGateRank", label: "Data Sources Access Gate Rank" },
      { field: "dataSourcesAccessReviewCount", label: "Data Sources Access Review Sources" },
      { field: "dataSourcesAccessBlockedCount", label: "Data Sources Access Blocked Sources" },
      { field: "dataSourcesAccessTokenLikelyCount", label: "Data Sources Access Token Likely" },
      { field: "dataSourcesAccessReviewQueueCount", label: "Data Sources Access Review Queue" },
      { field: "dataSourcesAccessReviewBlockedCount", label: "Data Sources Access Review Blocked" },
      { field: "dataSourcesAccessReviewHighCount", label: "Data Sources Access Review High" },
      { field: "dataSourcesAccessReviewMediumCount", label: "Data Sources Access Review Medium" },
      { field: "dataSourcesAccessValidationMethodCount", label: "Data Sources Access Validation Methods" },
      { field: "dataSourcesAccessValidationSourceCount", label: "Data Sources Access Validation Sources" },
      { field: "dataSourcesAccessValidationReviewCount", label: "Data Sources Access Validation Review Sources" },
      { field: "dataSourcesAccessValidationBlockedCount", label: "Data Sources Access Validation Blocked Sources" },
      { field: "dataSourcesAccessValidationEvidenceCount", label: "Data Sources Access Validation Evidence" },
      { field: "dataSourcesAccessValidationEvidenceValidatedCount", label: "Data Sources Access Validation Evidence Validated" },
      { field: "dataSourcesAccessValidationEvidenceReviewCount", label: "Data Sources Access Validation Evidence Review" },
      { field: "dataSourcesAccessValidationEvidenceBlockedCount", label: "Data Sources Access Validation Evidence Blocked" },
      { field: "dataSourcesAccessValidationEvidenceCoverageMissingCount", label: "Data Sources Access Validation Evidence Coverage Missing" },
      { field: "dataSourcesAccessValidationEvidenceCoverageHighPriorityCount", label: "Data Sources Access Validation Evidence Coverage High Priority" },
      { field: "dataSourcesAccessValidationEvidenceCoveragePercent", label: "Data Sources Access Validation Evidence Coverage Percent" },
      { field: "dataSourcesAccessTaskCount", label: "Data Sources Access Tasks" },
      { field: "dataSourcesAccessOpenTaskCount", label: "Data Sources Access Open Tasks" },
      { field: "agentReadyProjects", label: "Agent Ready Projects" },
      { field: "agentReadinessItems", label: "Agent Readiness Items" }
    ];
    const baselineDriftItems = agentControlPlaneBaselineSnapshot
      ? baselineDriftFields
          .map(({ field, label }) => {
            const before = toNumber(baselineSummary[field]);
            const current = toNumber(summary[field]);
            return {
              field,
              label,
              before,
              current,
              delta: current - before
            };
          })
          .filter((item) => item.delta !== 0)
      : [];
    summary.agentControlPlaneBaselineHasDrift = baselineDriftItems.length > 0;
    summary.agentControlPlaneBaselineDriftScore = baselineDriftItems.length;
    summary.agentControlPlaneBaselineDriftItems = baselineDriftItems;
    const baselineDriftDecision = agentControlPlaneBaselineSnapshot
      ? getAgentControlPlaneSnapshotDriftDecision(baselineDriftItems.length)
      : {
          driftSeverity: "missing-baseline",
          recommendedAction: "Save or mark an Agent Control Plane snapshot as baseline before using baseline-vs-live drift."
        };
    summary.agentControlPlaneBaselineDriftSeverity = baselineDriftDecision.driftSeverity;
    summary.agentControlPlaneBaselineDriftRecommendedAction = baselineDriftDecision.recommendedAction;
    const baselineHealth = getAgentControlPlaneBaselineHealth(
      Boolean(agentControlPlaneBaselineSnapshot),
      agentControlPlaneBaselineFreshness.baselineFreshness,
      baselineDriftItems.length
    );
    summary.agentControlPlaneBaselineHealth = baselineHealth.health;
    summary.agentControlPlaneBaselineRecommendedAction = baselineHealth.recommendedAction;

    const agentControlPlaneBaselineStatus = {
      hasBaseline: Boolean(agentControlPlaneBaselineSnapshot),
      snapshotId: agentControlPlaneBaselineSnapshotId,
      title: toText(agentControlPlaneBaselineSnapshot?.title),
      createdAt: toText(agentControlPlaneBaselineSnapshot?.createdAt),
      ageHours: agentControlPlaneBaselineFreshness.baselineAgeHours,
      freshness: agentControlPlaneBaselineFreshness.baselineFreshness,
      freshnessThresholdHours: agentControlPlaneBaselineFreshness.baselineFreshnessThresholdHours,
      hasDrift: summary.agentControlPlaneBaselineHasDrift,
      driftScore: summary.agentControlPlaneBaselineDriftScore,
      driftSeverity: summary.agentControlPlaneBaselineDriftSeverity,
      driftRecommendedAction: summary.agentControlPlaneBaselineDriftRecommendedAction,
      driftItems: summary.agentControlPlaneBaselineDriftItems,
      health: summary.agentControlPlaneBaselineHealth,
      recommendedAction: summary.agentControlPlaneBaselineRecommendedAction,
      snapshotCount: agentControlPlaneSnapshots.length
    };
    const governanceSnapshot = {
      summary,
      recentActivity,
      workflowFocus,
      milestoneFocus,
      decisions,
      profiles: [...profiles]
        .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime())
        .slice(0, 12),
      profileHistory: [...profileHistory]
        .sort((left, right) => new Date(toText(right.changedAt)).getTime() - new Date(toText(left.changedAt)).getTime())
        .slice(0, 12),
      actionQueue,
      queueSuppressions: [...queueSuppressions]
        .sort((left, right) => new Date(toText(right.suppressedAt)).getTime() - new Date(toText(left.suppressedAt)).getTime())
        .slice(0, 24),
      operationLog,
      workflowRunbook,
      agentSessions: agentSessionFocus,
      agentControlPlaneBaselineStatus,
      agentControlPlaneSnapshots: agentControlPlaneSnapshotFocus,
      agentControlPlaneBaselineSnapshotId,
      agentControlPlaneDecisionSnapshots: agentControlPlaneDecisionSnapshotFocus,
      agentWorkOrderSnapshots: agentWorkOrderSnapshotFocus,
      governanceTaskUpdateLedgerSnapshots: governanceTaskUpdateLedgerSnapshotFocus,
      dataSourceAccessTaskLedgerSnapshots: dataSourceAccessTaskLedgerSnapshotFocus,
      agentControlPlaneDecisionTaskLedgerSnapshots: agentControlPlaneDecisionTaskLedgerSnapshotFocus,
      agentExecutionSlaLedgerSnapshots: agentExecutionSlaLedgerSnapshotFocus,
      agentWorkOrderRuns: agentWorkOrderRunFocus,
      agentExecutionSlaLedger,
      agentExecutionMetrics,
      agentExecutionPolicy,
      deploymentSmokeChecks: deploymentSmokeChecks.slice(0, 50),
      releaseCheckpoints: releaseCheckpoints.slice(0, 50),
      releaseBuildGate,
      releaseControlTasks: releaseControlTaskFocus,
      agentControlPlaneDecisionTasks: agentControlPlaneDecisionTaskFocus,
      dataSourcesAccessGate,
      dataSourcesAccessReviewQueue,
      dataSourcesAccessValidationRunbook,
      dataSourcesAccessValidationEvidenceCoverage,
      dataSourceAccessValidationEvidence: dataSourceAccessValidationEvidenceFocus,
      dataSourceAccessValidationEvidenceSnapshots: dataSourceAccessValidationEvidenceSnapshotFocus,
      dataSourceAccessValidationEvidenceSnapshotDiff,
      dataSourcesAccessTasks: dataSourcesAccessTaskFocus,
      agentReadinessMatrix,
      unprofiledProjects
    };
    return {
      ...governanceSnapshot,
      agentControlPlaneDecision: createAgentControlPlaneDecisionPayload(governanceSnapshot, {
        dataSourcesAccessGate,
        dataSourcesAccessReviewQueue,
        dataSourcesAccessValidationRunbook,
        releaseBuildGate
      })
    };
  }

  /**
   * @param {Array<Record<string, unknown>>} items
   */
  function buildAgentWorkOrdersMarkdown(items) {
    const lines = [
      "# Agent Work Orders",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Work orders: ${items.length}`,
      "",
      "Use these work orders as supervised agent build instructions. Each order is derived from the current Governance readiness matrix.",
      ""
    ];

    if (!items.length) {
      lines.push("No work orders matched the current filters.");
      return lines.join("\n");
    }

    for (const item of items) {
      const blockers = Array.isArray(item.blockers) ? item.blockers.map(toText).filter(Boolean) : [];
      const status = toText(item.status) || "needs-prep";
      const nextStep = toText(item.nextStep);
      lines.push(`## ${toText(item.projectName) || "Project"}`);
      lines.push("");
      lines.push(`- Project ID: ${toText(item.projectId)}`);
      lines.push(`- Relative path: ${toText(item.relPath) || "unknown"}`);
      lines.push(`- Readiness: ${status} (${toNumber(item.score)}/100)`);
      lines.push(`- Owner: ${toText(item.owner) || "Owner not set"}`);
      lines.push(`- Target state: ${toText(item.targetState) || "unset"}`);
      lines.push(`- Primary objective: ${nextStep || "Review readiness and define the next execution step."}`);
      lines.push(`- Evidence: ${toNumber(item.openFindingCount)} findings | ${toNumber(item.openTaskCount)} tasks | ${toNumber(item.activeWorkflowCount)} workflows | ${toNumber(item.agentSessionCount)} handoffs`);
      lines.push(`- Blockers: ${blockers.length ? blockers.join(", ") : "none"}`);
      if (toText(item.latestWorkflowTitle)) {
        lines.push(`- Latest workflow: ${toText(item.latestWorkflowTitle)}`);
      }
      if (toText(item.latestAgentSessionAt)) {
        lines.push(`- Latest handoff: ${new Date(toText(item.latestAgentSessionAt)).toLocaleString()}`);
      }
      lines.push(`- Required next action: ${status === "ready" ? "Run a supervised build pass, validate, and record the outcome." : nextStep || "Resolve blockers before implementation."}`);
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * @param {ReturnType<typeof buildGovernanceSnapshot>} governance
   * @param {{ status?: string, limit?: number }} options
   */
  function createAgentWorkOrdersPayload(governance, options = {}) {
    const status = String(options.status || "all").toLowerCase();
    const requestedLimit = Number(options.limit || 24);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(100, Math.trunc(requestedLimit)))
      : 24;
    const filteredItems = status === "all"
      ? governance.agentReadinessMatrix
      : governance.agentReadinessMatrix.filter((item) => item.status === status);
    const items = filteredItems.slice(0, limit);

    return {
      generatedAt: new Date().toISOString(),
      status,
      total: items.length,
      items,
      markdown: buildAgentWorkOrdersMarkdown(items)
    };
  }

  /**
   * @param {Array<Record<string, unknown>>} items
   * @param {{ state?: string }} [options]
   */
  function buildAgentExecutionSlaLedgerMarkdown(items, options = {}) {
    const state = toText(options.state || "all") || "all";
    const lines = [
      "# Agent Execution SLA Ledger",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `State filter: ${state}`,
      `Ledger records: ${items.length}`,
      "",
      "Use this ledger as external control-center evidence for open and resolved Agent Execution SLA breaches.",
      ""
    ];

    if (!items.length) {
      lines.push("No SLA breach ledger records matched the current filters.");
      return lines.join("\n");
    }

    for (const item of items) {
      const projectName = toText(item.projectName) || "Project";
      const title = toText(item.title) || "Agent Work Order Run";
      lines.push(`## ${projectName} - ${title}`);
      lines.push("");
      lines.push(`- Run ID: ${toText(item.id) || "unknown"}`);
      lines.push(`- Project ID: ${toText(item.projectId) || "unknown"}`);
      lines.push(`- Breach state: ${toText(item.breachState) || "open"}`);
      lines.push(`- Run status: ${toText(item.status) || "queued"}`);
      lines.push(`- SLA action: ${toText(item.action) || "breached"}`);
      lines.push(`- Breached at: ${toText(item.breachedAt) || "not recorded"}`);
      lines.push(`- Resolved at: ${toText(item.resolvedAt) || "open"}`);
      lines.push(`- Duration hours: ${toNumber(item.durationHours)}`);
      lines.push(`- Escalations: ${toNumber(item.escalationCount)}`);
      lines.push(`- Resolutions: ${toNumber(item.resolutionCount)}`);
      lines.push(`- Last updated: ${toText(item.updatedAt) || "not recorded"}`);
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * @param {ReturnType<typeof buildGovernanceSnapshot>} governance
   * @param {{ state?: string, limit?: number }} options
   */
  function createAgentExecutionSlaLedgerPayload(governance, options = {}) {
    const requestedState = String(options.state || "all").toLowerCase();
    const state = ["all", "open", "resolved"].includes(requestedState) ? requestedState : "all";
    const requestedLimit = Number(options.limit || 24);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(100, Math.trunc(requestedLimit)))
      : 24;
    const ledger = Array.isArray(governance.agentExecutionSlaLedger) ? governance.agentExecutionSlaLedger : [];
    const filteredItems = state === "all"
      ? ledger
      : ledger.filter((item) => item.breachState === state);
    const items = filteredItems.slice(0, limit);

    return {
      generatedAt: new Date().toISOString(),
      state,
      limit,
      available: filteredItems.length,
      total: items.length,
      items,
      markdown: buildAgentExecutionSlaLedgerMarkdown(items, { state })
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildAgentControlPlaneMarkdown(payload) {
    const summary = payload.summary && typeof payload.summary === "object" ? payload.summary : {};
    const metrics = payload.agentExecutionMetrics && typeof payload.agentExecutionMetrics === "object" ? payload.agentExecutionMetrics : {};
    const policy = payload.agentExecutionPolicy && typeof payload.agentExecutionPolicy === "object" ? payload.agentExecutionPolicy : {};
    const workOrders = payload.workOrders && typeof payload.workOrders === "object" ? payload.workOrders : {};
    const slaLedger = payload.slaLedger && typeof payload.slaLedger === "object" ? payload.slaLedger : {};
    const baselineStatus = payload.baselineStatus && typeof payload.baselineStatus === "object" ? payload.baselineStatus : {};
    const dataSourcesAccessGate = payload.dataSourcesAccessGate && typeof payload.dataSourcesAccessGate === "object" ? payload.dataSourcesAccessGate : {};
    const dataSourcesAccessReviewQueue = payload.dataSourcesAccessReviewQueue && typeof payload.dataSourcesAccessReviewQueue === "object" ? payload.dataSourcesAccessReviewQueue : {};
    const dataSourcesAccessReviewItems = Array.isArray(dataSourcesAccessReviewQueue.items) ? dataSourcesAccessReviewQueue.items : [];
    const dataSourcesAccessValidationRunbook = payload.dataSourcesAccessValidationRunbook && typeof payload.dataSourcesAccessValidationRunbook === "object" ? payload.dataSourcesAccessValidationRunbook : {};
    const dataSourcesAccessValidationRunbookSummary = toControlPlaneRecord(dataSourcesAccessValidationRunbook.summary);
    const dataSourcesAccessValidationMethods = Array.isArray(dataSourcesAccessValidationRunbook.methods) ? dataSourcesAccessValidationRunbook.methods : [];
    const dataSourcesAccessValidationEvidenceCoverage = payload.dataSourcesAccessValidationEvidenceCoverage && typeof payload.dataSourcesAccessValidationEvidenceCoverage === "object" ? payload.dataSourcesAccessValidationEvidenceCoverage : {};
    const dataSourcesAccessValidationEvidenceCoverageSummary = toControlPlaneRecord(dataSourcesAccessValidationEvidenceCoverage.summary);
    const dataSourcesAccessValidationEvidenceCoverageItems = Array.isArray(dataSourcesAccessValidationEvidenceCoverage.items) ? dataSourcesAccessValidationEvidenceCoverage.items : [];
    const dataSourceAccessValidationEvidence = Array.isArray(payload.dataSourceAccessValidationEvidence) ? payload.dataSourceAccessValidationEvidence : [];
    const dataSourceAccessValidationEvidenceSnapshots = Array.isArray(payload.dataSourceAccessValidationEvidenceSnapshots) ? payload.dataSourceAccessValidationEvidenceSnapshots : [];
    const baselineDriftItems = Array.isArray(baselineStatus.driftItems) ? baselineStatus.driftItems : [];
    const readiness = Array.isArray(payload.readiness) ? payload.readiness : [];
    const agentSessions = Array.isArray(payload.agentSessions) ? payload.agentSessions : [];
    const executionRuns = Array.isArray(payload.executionRuns) ? payload.executionRuns : [];
    const deploymentSmokeChecks = Array.isArray(payload.deploymentSmokeChecks) ? payload.deploymentSmokeChecks : [];
    const releaseCheckpoints = Array.isArray(payload.releaseCheckpoints) ? payload.releaseCheckpoints : [];
    const releaseControlTasks = Array.isArray(payload.releaseControlTasks) ? payload.releaseControlTasks : [];
    const agentControlPlaneDecisionTasks = Array.isArray(payload.agentControlPlaneDecisionTasks) ? payload.agentControlPlaneDecisionTasks : [];
    const releaseBuildGate = payload.releaseBuildGate && typeof payload.releaseBuildGate === "object" ? payload.releaseBuildGate : {};
    const releaseBuildGateReasons = Array.isArray(releaseBuildGate.reasons) ? releaseBuildGate.reasons : [];
    const releaseBuildGateActions = Array.isArray(releaseBuildGate.actions) ? releaseBuildGate.actions : [];
    const decisionSnapshots = Array.isArray(payload.decisionSnapshots) ? payload.decisionSnapshots : [];
    const decisionTaskLedgerSnapshots = Array.isArray(payload.agentControlPlaneDecisionTaskLedgerSnapshots) ? payload.agentControlPlaneDecisionTaskLedgerSnapshots : [];
    const slaLedgerSnapshots = Array.isArray(payload.slaLedgerSnapshots) ? payload.slaLedgerSnapshots : [];
    const lines = [
      "# Agent Control Plane",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Limit: ${toNumber(payload.limit)}`,
      "",
      "## Portfolio Summary",
      `- Agent-ready projects: ${toNumber(summary.agentReadyProjects)}/${toNumber(summary.agentReadinessItems)}`,
      `- Agent handoffs: ${toNumber(summary.agentSessionCount)}`,
      `- Work order snapshots: ${toNumber(summary.agentWorkOrderSnapshotCount)}`,
      `- Decision snapshots: ${toNumber(summary.agentControlPlaneDecisionSnapshotCount)}`,
      `- Execution runs: ${toNumber(summary.activeAgentWorkOrderRunCount)}/${toNumber(summary.agentWorkOrderRunCount)} active/total`,
      `- SLA ledger records: ${toNumber(summary.agentExecutionSlaLedgerCount)}`,
      `- SLA ledger snapshots: ${toNumber(summary.agentExecutionSlaLedgerSnapshotCount)}`,
      `- Deployment smoke checks: ${toNumber(summary.deploymentSmokeCheckPassCount)} pass / ${toNumber(summary.deploymentSmokeCheckFailCount)} fail / ${toNumber(summary.deploymentSmokeCheckCount)} total`,
      `- Release checkpoints: ${toNumber(summary.releaseCheckpointCount)}`,
      `- Release build gate: ${toText(releaseBuildGate.decision) || toText(summary.releaseBuildGateDecision) || "not-evaluated"} (risk ${toNumber(releaseBuildGate.riskScore || summary.releaseBuildGateRiskScore)})`,
      `- Release build action: ${toText(releaseBuildGate.recommendedAction) || "Evaluate release build gate evidence before the next supervised build."}`,
      `- Release Control tasks: ${toNumber(summary.releaseControlOpenTaskCount)} open / ${toNumber(summary.releaseControlTaskCount)} total`,
      `- Control Plane decision tasks: ${toNumber(summary.agentControlPlaneDecisionOpenTaskCount)} open / ${toNumber(summary.agentControlPlaneDecisionTaskCount)} total`,
      `- Control Plane decision task ledger snapshots: ${toNumber(summary.agentControlPlaneDecisionTaskLedgerSnapshotCount)}`,
      `- Baseline selected: ${baselineStatus.hasBaseline ? "yes" : "no"}`,
      `- Baseline health: ${toText(baselineStatus.health) || "missing"}`,
      `- Baseline action: ${toText(baselineStatus.recommendedAction) || "Save or mark an Agent Control Plane snapshot as baseline."}`,
      `- Baseline drift score: ${toNumber(baselineStatus.driftScore)}`,
      `- Baseline drift severity: ${toText(baselineStatus.driftSeverity) || "missing-baseline"}`,
      `- Baseline drift action: ${toText(baselineStatus.driftRecommendedAction) || "Save or mark an Agent Control Plane snapshot as baseline before using baseline-vs-live drift."}`,
      `- Data Sources access gate: ${toText(dataSourcesAccessGate.decision) || "not evaluated"}`,
      `- Data Sources access action: ${toText(dataSourcesAccessGate.recommendedAction) || "Evaluate Data Sources access before ingestion."}`,
      `- Data Sources access review queue: ${toNumber(dataSourcesAccessReviewQueue.summary?.total)} item(s)`,
      `- Data Sources access validation methods: ${toNumber(dataSourcesAccessValidationRunbookSummary.methodCount)} across ${toNumber(dataSourcesAccessValidationRunbookSummary.sourceCount)} source(s)`,
      `- Data Sources access validation evidence: ${toNumber(summary.dataSourcesAccessValidationEvidenceValidatedCount)} validated / ${toNumber(summary.dataSourcesAccessValidationEvidenceCount)} total`,
      `- Data Sources access validation evidence coverage: ${toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.covered || summary.dataSourcesAccessValidationEvidenceCoverageCoveredCount)} covered / ${toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.sourceCount || summary.dataSourcesAccessValidationEvidenceCoverageCount)} source(s) (${toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.coveragePercent || summary.dataSourcesAccessValidationEvidenceCoveragePercent)}%)`,
      `- Data Sources access validation evidence coverage gaps: ${toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.missing || summary.dataSourcesAccessValidationEvidenceCoverageMissingCount)} missing / ${toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.highPriority || summary.dataSourcesAccessValidationEvidenceCoverageHighPriorityCount)} high priority`,
      `- Data Sources access validation evidence snapshots: ${toNumber(summary.dataSourceAccessValidationEvidenceSnapshotCount)}`,
      `- Data Sources access tasks: ${toNumber(summary.dataSourcesAccessOpenTaskCount)} open / ${toNumber(summary.dataSourcesAccessTaskCount)} total`,
      `- Data Sources access task ledger snapshots: ${toNumber(summary.dataSourceAccessTaskLedgerSnapshotCount)}`,
      "",
      "## Execution Health",
      `- Completion rate: ${toNumber(metrics.completionRate)}%`,
      `- Failure rate: ${toNumber(metrics.failureRate)}%`,
      `- Stale active: ${toNumber(metrics.staleActive)} after ${toNumber(metrics.staleThresholdHours)}h`,
      `- SLA breached: ${toNumber(metrics.slaBreached)}`,
      `- SLA resolved: ${toNumber(metrics.slaResolved)}`,
      `- Average SLA resolution: ${toNumber(metrics.slaAverageResolutionHours)}h`,
      `- SLA policy statuses: ${Array.isArray(policy.staleStatuses) ? policy.staleStatuses.map(toText).filter(Boolean).join(", ") : "queued, running, blocked"}`,
      "",
      "## Baseline Drift Fields"
    ];

    if (baselineDriftItems.length) {
      for (const item of baselineDriftItems) {
        const record = toControlPlaneRecord(item);
        lines.push(`- ${toText(record.label) || toText(record.field) || "Baseline field"}: ${toNumber(record.before)} -> ${toNumber(record.current)} (${toNumber(record.delta) >= 0 ? "+" : ""}${toNumber(record.delta)})`);
      }
    } else {
      lines.push("- No baseline drift fields.");
    }

    lines.push(
      "",
      "## Data Sources Access Gate",
      `- Decision: ${toText(dataSourcesAccessGate.decision) || "not evaluated"}`,
      `- Recommended action: ${toText(dataSourcesAccessGate.recommendedAction) || "Evaluate Data Sources access before ingestion."}`,
      `- Ready/review/blocked: ${toNumber(dataSourcesAccessGate.ready)}/${toNumber(dataSourcesAccessGate.review)}/${toNumber(dataSourcesAccessGate.blocked)}`,
      `- Token-likely sources: ${toNumber(dataSourcesAccessGate.tokenLikely)}`,
      `- Certificate-likely sources: ${toNumber(dataSourcesAccessGate.certificateLikely)}`,
      `- Password/session-likely sources: ${toNumber(dataSourcesAccessGate.passwordLikely)}`
    );

    lines.push("", "## Data Sources Access Review Queue");
    if (dataSourcesAccessReviewItems.length) {
      for (const item of dataSourcesAccessReviewItems.slice(0, 10)) {
        const record = toControlPlaneRecord(item);
        lines.push(`- ${toText(record.priority) || "normal"} ${toText(record.status) || "review"}: ${toText(record.title) || toText(record.label) || "Source access review"} (${toText(record.accessMethod) || "review-required"})`);
      }
    } else {
      lines.push("- No Data Sources access review queue items.");
    }

    lines.push("", "## Data Sources Access Validation Runbook");
    if (dataSourcesAccessValidationMethods.length) {
      for (const method of dataSourcesAccessValidationMethods.slice(0, 10)) {
        const record = toControlPlaneRecord(method);
        const sources = Array.isArray(record.sources) ? record.sources : [];
        const commandHints = Array.isArray(record.commandHints) ? record.commandHints.map(toText).filter(Boolean) : [];
        lines.push(`- ${toText(record.title) || toText(record.accessMethod) || "Access method"}: ${sources.length} source${sources.length === 1 ? "" : "s"}`);
        if (commandHints.length) {
          lines.push(`  Command hints: ${commandHints.join("; ")}`);
        }
        lines.push(`  Evidence: ${toText(record.evidence) || "Record non-secret validation evidence."}`);
      }
    } else {
      lines.push("- No Data Sources access validation runbook methods.");
    }

    lines.push("", "## Data Sources Access Validation Evidence Coverage");
    if (dataSourcesAccessValidationEvidenceCoverageItems.length) {
      for (const item of dataSourcesAccessValidationEvidenceCoverageItems.slice(0, 10)) {
        const record = toControlPlaneRecord(item);
        lines.push(`- ${toText(record.coverageStatus) || "missing"} ${toText(record.priority) || "medium"}: ${toText(record.label) || toText(record.sourceId) || "Source"} (${toText(record.accessMethod) || "review-required"})`);
        lines.push(`  Action: ${toText(record.action) || "Record non-secret validation evidence after confirming access outside this app."}`);
      }
    } else {
      lines.push("- No Data Sources access validation evidence coverage items.");
    }

    lines.push("", "## Data Sources Access Validation Evidence");
    if (dataSourceAccessValidationEvidence.length) {
      for (const evidence of dataSourceAccessValidationEvidence.slice(0, 10)) {
        const record = toControlPlaneRecord(evidence);
        lines.push(`- ${toText(record.sourceLabel) || toText(record.sourceId) || "Source"}: ${toText(record.status) || "review"} (${toText(record.accessMethod) || "review-required"})`);
        lines.push(`  Evidence: ${toText(record.evidence) || "Non-secret evidence not provided."}`);
      }
    } else {
      lines.push("- No Data Sources access validation evidence recorded.");
    }

    lines.push("", "## Data Sources Access Validation Evidence Snapshots");
    if (dataSourceAccessValidationEvidenceSnapshots.length) {
      for (const snapshot of dataSourceAccessValidationEvidenceSnapshots.slice(0, 10)) {
        const record = toControlPlaneRecord(snapshot);
        lines.push(`- ${toText(record.title) || "Data Sources Access Validation Evidence"}: ${toNumber(record.validatedCount)} validated / ${toNumber(record.total)} total (${toText(record.statusFilter) || "all"})`);
      }
    } else {
      lines.push("- No Data Sources access validation evidence snapshots available.");
    }

    lines.push(
      "",
      "## Ready Work Orders",
      `- Exported work orders: ${toNumber(workOrders.total)}`,
      "",
      "## Top Readiness Items"
    );

    if (readiness.length) {
      for (const item of readiness) {
        lines.push(`- ${toText(item.projectName) || "Project"}: ${toText(item.status) || "needs-prep"} (${toNumber(item.score)}/100)`);
      }
    } else {
      lines.push("- No readiness items available.");
    }

    lines.push("", "## Saved Handoffs");
    if (agentSessions.length) {
      for (const session of agentSessions) {
        lines.push(`- ${toText(session.projectName) || "Project"}: ${toText(session.title) || "Agent Handoff"} (${toText(session.status) || "prepared"})`);
      }
    } else {
      lines.push("- No saved agent handoffs available.");
    }

    lines.push("", "## Deployment Smoke Checks");
    if (deploymentSmokeChecks.length) {
      for (const smokeCheck of deploymentSmokeChecks.slice(0, 10)) {
        lines.push(`- ${toText(smokeCheck.label) || toText(smokeCheck.host) || "Deployment"}: ${toText(smokeCheck.status) || "fail"} HTTP ${toNumber(smokeCheck.httpStatus) || "unreachable"} (${toNumber(smokeCheck.latencyMs)}ms)`);
      }
    } else {
      lines.push("- No deployment smoke checks recorded.");
    }

    lines.push("", "## Release Checkpoints");
    if (releaseCheckpoints.length) {
      for (const checkpoint of releaseCheckpoints.slice(0, 10)) {
        lines.push(`- ${toText(checkpoint.title) || "Release checkpoint"}: ${toText(checkpoint.status) || "review"} (${toText(checkpoint.commitShort) || "no-commit"})`);
      }
    } else {
      lines.push("- No release checkpoints recorded.");
    }

    lines.push(
      "",
      "## Release Build Gate",
      `- Decision: ${toText(releaseBuildGate.decision) || toText(summary.releaseBuildGateDecision) || "not-evaluated"}`,
      `- Risk score: ${toNumber(releaseBuildGate.riskScore || summary.releaseBuildGateRiskScore)}`,
      `- Recommended action: ${toText(releaseBuildGate.recommendedAction) || "Evaluate release build gate evidence before the next supervised build."}`
    );
    if (releaseBuildGateReasons.length) {
      lines.push("- Gate reasons:");
      for (const reason of releaseBuildGateReasons.slice(0, 10)) {
        const record = toControlPlaneRecord(reason);
        lines.push(`  - ${toText(record.severity) || "medium"} ${toText(record.code) || "release-review"}: ${toText(record.message) || "Review release gate evidence."}`);
      }
    } else {
      lines.push("- Gate reasons: none");
    }
    if (releaseBuildGateActions.length) {
      lines.push("- Gate actions:");
      for (const action of releaseBuildGateActions.slice(0, 10)) {
        const record = toControlPlaneRecord(action);
        lines.push(`  - ${toText(record.priority) || "medium"} ${toText(record.status) || "open"}: ${toText(record.label) || toText(record.id) || "Release gate action"}`);
      }
    } else {
      lines.push("- Gate actions: none");
    }

    lines.push("", "## Release Control Tasks");
    if (releaseControlTasks.length) {
      for (const task of releaseControlTasks.slice(0, 10)) {
        const record = toControlPlaneRecord(task);
        lines.push(`- ${toText(record.priority) || "normal"} ${toText(record.status) || "open"}: ${toText(record.title) || toText(record.releaseBuildGateActionId) || "Release control task"}`);
        lines.push(`  Release action: ${toText(record.releaseBuildGateActionId) || "release-control"} | Gate decision: ${toText(record.releaseBuildGateDecision) || "review"}`);
      }
    } else {
      lines.push("- No Release Control tasks available.");
    }

    lines.push("", "## Control Plane Decision Tasks");
    if (agentControlPlaneDecisionTasks.length) {
      for (const task of agentControlPlaneDecisionTasks.slice(0, 10)) {
        const record = toControlPlaneRecord(task);
        lines.push(`- ${toText(record.priority) || "normal"} ${toText(record.status) || "open"}: ${toText(record.title) || toText(record.agentControlPlaneDecisionReasonCode) || "Control Plane decision task"}`);
        lines.push(`  Reason: ${toText(record.agentControlPlaneDecisionReasonCode) || "control-plane-decision"} | Decision: ${toText(record.agentControlPlaneDecision) || "review"}`);
      }
    } else {
      lines.push("- No Control Plane decision tasks available.");
    }

    lines.push("", "## Control Plane Decision Task Ledger Snapshots");
    if (decisionTaskLedgerSnapshots.length) {
      for (const snapshot of decisionTaskLedgerSnapshots.slice(0, 10)) {
        const record = toControlPlaneRecord(snapshot);
        lines.push(`- ${toText(record.title) || "Agent Control Plane Decision Task Ledger"}: ${toNumber(record.openCount)} open / ${toNumber(record.total)} total at ${toText(record.createdAt) || "not recorded"}`);
      }
    } else {
      lines.push("- No Control Plane decision task ledger snapshots available.");
    }

    lines.push("", "## Decision Snapshots");
    if (decisionSnapshots.length) {
      for (const snapshot of decisionSnapshots) {
        lines.push(`- ${toText(snapshot.title) || "Agent Control Plane Decision"}: ${toText(snapshot.decision) || "review"} (${toNumber(snapshot.reasonCount)} reason(s))`);
      }
    } else {
      lines.push("- No decision snapshots available.");
    }

    lines.push("", "## Execution Queue");
    if (executionRuns.length) {
      for (const run of executionRuns) {
        lines.push(`- ${toText(run.projectName) || "Project"}: ${toText(run.title) || "Agent Work Order Run"} (${toText(run.status) || "queued"})`);
      }
    } else {
      lines.push("- No execution runs available.");
    }

    lines.push("", "## SLA Ledger");
    if (Array.isArray(slaLedger.items) && slaLedger.items.length) {
      for (const item of slaLedger.items) {
        lines.push(`- ${toText(item.projectName) || "Project"}: ${toText(item.breachState) || "open"} ${toText(item.action) || "breach"} on ${toText(item.title) || "Agent Work Order Run"}`);
      }
    } else {
      lines.push("- No SLA ledger records available.");
    }

    lines.push("", "## SLA Ledger Snapshots");
    if (slaLedgerSnapshots.length) {
      for (const snapshot of slaLedgerSnapshots) {
        lines.push(`- ${toText(snapshot.title) || "SLA Breach Ledger"}: ${toNumber(snapshot.total)} record(s), state ${toText(snapshot.stateFilter) || "all"}`);
      }
    } else {
      lines.push("- No SLA ledger snapshots available.");
    }

    return lines.join("\n");
  }

  /**
   * @param {ReturnType<typeof buildGovernanceSnapshot>} governance
   * @param {{ limit?: number, dataSourcesAccessGate?: Record<string, unknown> | null, dataSourcesAccessReviewQueue?: Record<string, unknown> | null, dataSourcesAccessValidationRunbook?: Record<string, unknown> | null, releaseBuildGate?: Record<string, unknown> | null }} options
   */
  function createAgentControlPlanePayload(governance, options = {}) {
    const requestedLimit = Number(options.limit || 12);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(50, Math.trunc(requestedLimit)))
      : 12;
    const workOrders = createAgentWorkOrdersPayload(governance, { status: "all", limit });
    const slaLedger = createAgentExecutionSlaLedgerPayload(governance, { state: "all", limit });
    const releaseBuildGate = options.releaseBuildGate && typeof options.releaseBuildGate === "object"
      ? options.releaseBuildGate
      : governance.releaseBuildGate && typeof governance.releaseBuildGate === "object"
        ? governance.releaseBuildGate
        : null;
    const releaseBuildGateReasons = Array.isArray(releaseBuildGate?.reasons) ? releaseBuildGate.reasons : [];
    const releaseBuildGateActions = Array.isArray(releaseBuildGate?.actions) ? releaseBuildGate.actions : [];
    const releaseBuildGateDecision = toText(releaseBuildGate?.decision) || toText(governance.summary?.releaseBuildGateDecision) || "not-evaluated";
    const releaseBuildGateRank = releaseBuildGateDecision === "hold"
      ? 3
      : releaseBuildGateDecision === "review"
        ? 2
        : releaseBuildGateDecision === "ready"
          ? 1
          : 0;
    const summary = {
      ...toControlPlaneRecord(governance.summary),
      releaseBuildGateDecision,
      releaseBuildGateRank,
      releaseBuildGateRiskScore: toNumber(releaseBuildGate?.riskScore || governance.summary?.releaseBuildGateRiskScore),
      releaseBuildGateReasonCount: releaseBuildGateReasons.length,
      releaseBuildGateActionCount: releaseBuildGateActions.length
    };
    const payload = {
      generatedAt: new Date().toISOString(),
      limit,
      summary,
      agentExecutionMetrics: governance.agentExecutionMetrics,
      agentExecutionPolicy: governance.agentExecutionPolicy,
      baselineStatus: governance.agentControlPlaneBaselineStatus || null,
      releaseBuildGate,
      dataSourcesAccessGate: options.dataSourcesAccessGate || null,
      dataSourcesAccessReviewQueue: options.dataSourcesAccessReviewQueue || null,
      dataSourcesAccessValidationRunbook: options.dataSourcesAccessValidationRunbook || governance.dataSourcesAccessValidationRunbook || null,
      dataSourcesAccessValidationEvidenceCoverage: governance.dataSourcesAccessValidationEvidenceCoverage || null,
      dataSourceAccessValidationEvidence: (Array.isArray(governance.dataSourceAccessValidationEvidence) ? governance.dataSourceAccessValidationEvidence : []).slice(0, limit),
      dataSourceAccessValidationEvidenceSnapshots: (Array.isArray(governance.dataSourceAccessValidationEvidenceSnapshots) ? governance.dataSourceAccessValidationEvidenceSnapshots : []).slice(0, limit),
      readiness: (Array.isArray(governance.agentReadinessMatrix) ? governance.agentReadinessMatrix : []).slice(0, limit),
      agentSessions: (Array.isArray(governance.agentSessions) ? governance.agentSessions : []).slice(0, limit),
      deploymentSmokeChecks: (Array.isArray(governance.deploymentSmokeChecks) ? governance.deploymentSmokeChecks : []).slice(0, limit),
      releaseCheckpoints: (Array.isArray(governance.releaseCheckpoints) ? governance.releaseCheckpoints : []).slice(0, limit),
      releaseControlTasks: (Array.isArray(governance.releaseControlTasks) ? governance.releaseControlTasks : []).slice(0, limit),
      agentControlPlaneDecisionTasks: (Array.isArray(governance.agentControlPlaneDecisionTasks) ? governance.agentControlPlaneDecisionTasks : []).slice(0, limit),
      agentControlPlaneDecisionTaskLedgerSnapshots: (Array.isArray(governance.agentControlPlaneDecisionTaskLedgerSnapshots) ? governance.agentControlPlaneDecisionTaskLedgerSnapshots : []).slice(0, limit),
      workOrders,
      executionRuns: (Array.isArray(governance.agentWorkOrderRuns) ? governance.agentWorkOrderRuns : []).slice(0, limit),
      slaLedger,
      workOrderSnapshots: (Array.isArray(governance.agentWorkOrderSnapshots) ? governance.agentWorkOrderSnapshots : []).slice(0, limit),
      decisionSnapshots: (Array.isArray(governance.agentControlPlaneDecisionSnapshots) ? governance.agentControlPlaneDecisionSnapshots : []).slice(0, limit),
      slaLedgerSnapshots: (Array.isArray(governance.agentExecutionSlaLedgerSnapshots) ? governance.agentExecutionSlaLedgerSnapshots : []).slice(0, limit)
    };

    return {
      ...payload,
      markdown: buildAgentControlPlaneMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildAgentControlPlaneDecisionMarkdown(payload) {
    const reasons = Array.isArray(payload.reasons) ? payload.reasons : [];
    const releaseBuildGate = payload.releaseBuildGate && typeof payload.releaseBuildGate === "object" ? payload.releaseBuildGate : {};
    const releaseBuildGateReasons = Array.isArray(releaseBuildGate.reasons) ? releaseBuildGate.reasons : [];
    const releaseBuildGateActions = Array.isArray(releaseBuildGate.actions) ? releaseBuildGate.actions : [];
    const dataSourcesAccessGate = payload.dataSourcesAccessGate && typeof payload.dataSourcesAccessGate === "object" ? payload.dataSourcesAccessGate : {};
    const dataSourcesAccessReviewQueue = payload.dataSourcesAccessReviewQueue && typeof payload.dataSourcesAccessReviewQueue === "object" ? payload.dataSourcesAccessReviewQueue : {};
    const dataSourcesAccessReviewItems = Array.isArray(dataSourcesAccessReviewQueue.items) ? dataSourcesAccessReviewQueue.items : [];
    const dataSourcesAccessValidationRunbook = payload.dataSourcesAccessValidationRunbook && typeof payload.dataSourcesAccessValidationRunbook === "object" ? payload.dataSourcesAccessValidationRunbook : {};
    const dataSourcesAccessValidationMethods = Array.isArray(dataSourcesAccessValidationRunbook.methods) ? dataSourcesAccessValidationRunbook.methods : [];
    const dataSourcesAccessValidationEvidenceCoverage = payload.dataSourcesAccessValidationEvidenceCoverage && typeof payload.dataSourcesAccessValidationEvidenceCoverage === "object" ? payload.dataSourcesAccessValidationEvidenceCoverage : {};
    const dataSourcesAccessValidationEvidenceCoverageItems = Array.isArray(dataSourcesAccessValidationEvidenceCoverage.items) ? dataSourcesAccessValidationEvidenceCoverage.items : [];
    const dataSourceAccessValidationEvidence = Array.isArray(payload.dataSourceAccessValidationEvidence) ? payload.dataSourceAccessValidationEvidence : [];
    const dataSourcesAccessTasks = Array.isArray(payload.dataSourcesAccessTasks) ? payload.dataSourcesAccessTasks : [];
    const releaseControlTasks = Array.isArray(payload.releaseControlTasks) ? payload.releaseControlTasks : [];
    const agentControlPlaneDecisionTasks = Array.isArray(payload.agentControlPlaneDecisionTasks) ? payload.agentControlPlaneDecisionTasks : [];
    const lines = [
      "# Agent Control Plane Decision",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Decision: ${toText(payload.decision) || "review"}`,
      `Recommended action: ${toText(payload.recommendedAction) || "Review the Agent Control Plane before the next supervised build."}`,
      "",
      "## Reasons"
    ];

    if (reasons.length) {
      for (const reason of reasons) {
        const record = toControlPlaneRecord(reason);
        lines.push(`- ${toText(record.severity) || "review"}: ${toText(record.message) || toText(record.code) || "Review required."}`);
      }
    } else {
      lines.push("- No blocking or review reasons detected.");
    }

    lines.push("", "## Evidence");
    lines.push(`- Baseline health: ${toText(payload.baselineHealth) || "missing"}`);
    lines.push(`- Baseline drift severity: ${toText(payload.baselineDriftSeverity) || "missing-baseline"}`);
    lines.push(`- Release build gate: ${toText(payload.releaseBuildGateDecision) || toText(releaseBuildGate.decision) || "not-evaluated"}`);
    lines.push(`- Release build risk: ${toNumber(payload.releaseBuildGateRiskScore || releaseBuildGate.riskScore)}`);
    lines.push(`- Release build gate reasons: ${toNumber(payload.releaseBuildGateReasonCount || releaseBuildGateReasons.length)}`);
    lines.push(`- Release build gate actions: ${toNumber(payload.releaseBuildGateActionCount || releaseBuildGateActions.length)}`);
    lines.push(`- Release Control tasks: ${toNumber(payload.releaseControlOpenTaskCount)} open / ${toNumber(payload.releaseControlTaskCount)} total (${toNumber(payload.releaseControlClosedTaskCount)} closed)`);
    lines.push(`- Control Plane decision tasks: ${toNumber(payload.agentControlPlaneDecisionOpenTaskCount)} open / ${toNumber(payload.agentControlPlaneDecisionTaskCount)} total (${toNumber(payload.agentControlPlaneDecisionClosedTaskCount)} closed)`);
    lines.push(`- Active runs: ${toNumber(payload.activeRuns)}`);
    lines.push(`- Stale active runs: ${toNumber(payload.staleActiveRuns)}`);
    lines.push(`- SLA breached runs: ${toNumber(payload.slaBreachedRuns)}`);
    lines.push(`- Agent-ready projects: ${toNumber(payload.agentReadyProjects)}/${toNumber(payload.agentReadinessItems)}`);
    lines.push(`- Data Sources access gate: ${toText(payload.dataSourcesGateDecision) || toText(dataSourcesAccessGate.decision) || "not evaluated"}`);
    lines.push(`- Data Sources ready/review/blocked: ${toNumber(payload.dataSourcesReady)}/${toNumber(payload.dataSourcesReview)}/${toNumber(payload.dataSourcesBlocked)}`);
    lines.push(`- Data Sources token-likely sources: ${toNumber(payload.dataSourcesTokenLikely)}`);
    lines.push(`- Data Sources access review queue: ${toNumber(payload.dataSourcesAccessReviewQueueCount || dataSourcesAccessReviewQueue.summary?.total)}`);
    lines.push(`- Data Sources access validation methods: ${toNumber(payload.dataSourcesAccessValidationMethodCount)} across ${toNumber(payload.dataSourcesAccessValidationSourceCount)} source(s)`);
    lines.push(`- Data Sources access validation evidence: ${toNumber(payload.dataSourcesAccessValidationEvidenceValidatedCount)} validated / ${toNumber(payload.dataSourcesAccessValidationEvidenceCount)} total`);
    lines.push(`- Data Sources access validation evidence coverage: ${toNumber(payload.dataSourcesAccessValidationEvidenceCoverageCoveredCount)} covered / ${toNumber(payload.dataSourcesAccessValidationEvidenceCoverageCount)} source(s) (${toNumber(payload.dataSourcesAccessValidationEvidenceCoveragePercent)}%)`);
    lines.push(`- Data Sources access validation evidence coverage gaps: ${toNumber(payload.dataSourcesAccessValidationEvidenceCoverageMissingCount)} missing / ${toNumber(payload.dataSourcesAccessValidationEvidenceCoverageHighPriorityCount)} high priority`);
    lines.push(`- Data Sources access validation evidence snapshots: ${toNumber(payload.dataSourceAccessValidationEvidenceSnapshotCount)}`);
    lines.push(`- Data Sources access tasks: ${toNumber(payload.dataSourcesAccessOpenTaskCount)} open / ${toNumber(payload.dataSourcesAccessTaskCount)} total (${toNumber(payload.dataSourcesAccessClosedTaskCount)} closed)`);

    lines.push("", "## Release Build Gate");
    lines.push(`- Decision: ${toText(payload.releaseBuildGateDecision) || toText(releaseBuildGate.decision) || "not-evaluated"}`);
    lines.push(`- Risk score: ${toNumber(payload.releaseBuildGateRiskScore || releaseBuildGate.riskScore)}`);
    lines.push(`- Recommended action: ${toText(releaseBuildGate.recommendedAction) || "Evaluate release build gate evidence before the next supervised build."}`);
    if (releaseBuildGateReasons.length) {
      lines.push("- Gate reasons:");
      for (const reason of releaseBuildGateReasons.slice(0, 10)) {
        const record = toControlPlaneRecord(reason);
        lines.push(`  - ${toText(record.severity) || "medium"} ${toText(record.code) || "release-review"}: ${toText(record.message) || "Review release gate evidence."}`);
      }
    } else {
      lines.push("- Gate reasons: none");
    }
    if (releaseBuildGateActions.length) {
      lines.push("- Gate actions:");
      for (const action of releaseBuildGateActions.slice(0, 10)) {
        const record = toControlPlaneRecord(action);
        lines.push(`  - ${toText(record.priority) || "medium"} ${toText(record.status) || "open"}: ${toText(record.label) || toText(record.id) || "Release gate action"}`);
      }
    } else {
      lines.push("- Gate actions: none");
    }

    lines.push("", "## Release Control Tasks");
    if (releaseControlTasks.length) {
      for (const task of releaseControlTasks.slice(0, 10)) {
        const record = toControlPlaneRecord(task);
        lines.push(`- ${toText(record.priority) || "normal"} ${toText(record.status) || "open"}: ${toText(record.title) || toText(record.releaseBuildGateActionId) || "Release control task"}`);
        lines.push(`  Release action: ${toText(record.releaseBuildGateActionId) || "release-control"} | Gate decision: ${toText(record.releaseBuildGateDecision) || "review"}`);
      }
    } else {
      lines.push("- No Release Control tasks.");
    }

    lines.push("", "## Control Plane Decision Tasks");
    if (agentControlPlaneDecisionTasks.length) {
      for (const task of agentControlPlaneDecisionTasks.slice(0, 10)) {
        const record = toControlPlaneRecord(task);
        lines.push(`- ${toText(record.priority) || "normal"} ${toText(record.status) || "open"}: ${toText(record.title) || toText(record.agentControlPlaneDecisionReasonCode) || "Control Plane decision task"}`);
        lines.push(`  Reason: ${toText(record.agentControlPlaneDecisionReasonCode) || "control-plane-decision"} | Decision: ${toText(record.agentControlPlaneDecision) || "review"}`);
      }
    } else {
      lines.push("- No Control Plane decision tasks.");
    }

    lines.push("", "## Data Sources Access Review Queue");
    if (dataSourcesAccessReviewItems.length) {
      for (const item of dataSourcesAccessReviewItems.slice(0, 10)) {
        const record = toControlPlaneRecord(item);
        lines.push(`- ${toText(record.priority) || "normal"} ${toText(record.status) || "review"}: ${toText(record.title) || toText(record.label) || "Source access review"} (${toText(record.accessMethod) || "review-required"})`);
      }
    } else {
      lines.push("- No Data Sources access review queue items.");
    }

    lines.push("", "## Data Sources Access Validation Runbook");
    if (dataSourcesAccessValidationMethods.length) {
      for (const method of dataSourcesAccessValidationMethods.slice(0, 10)) {
        const record = toControlPlaneRecord(method);
        const sources = Array.isArray(record.sources) ? record.sources : [];
        const commandHints = Array.isArray(record.commandHints) ? record.commandHints.map(toText).filter(Boolean) : [];
        lines.push(`- ${toText(record.title) || toText(record.accessMethod) || "Access method"}: ${sources.length} source${sources.length === 1 ? "" : "s"}`);
        if (commandHints.length) {
          lines.push(`  Command hints: ${commandHints.join("; ")}`);
        }
      }
    } else {
      lines.push("- No Data Sources access validation runbook methods.");
    }

    lines.push("", "## Data Sources Access Validation Evidence Coverage");
    if (dataSourcesAccessValidationEvidenceCoverageItems.length) {
      for (const item of dataSourcesAccessValidationEvidenceCoverageItems.slice(0, 10)) {
        const record = toControlPlaneRecord(item);
        lines.push(`- ${toText(record.coverageStatus) || "missing"} ${toText(record.priority) || "medium"}: ${toText(record.label) || toText(record.sourceId) || "Source"} (${toText(record.accessMethod) || "review-required"})`);
      }
    } else {
      lines.push("- No Data Sources access validation evidence coverage items.");
    }

    lines.push("", "## Data Sources Access Validation Evidence");
    if (dataSourceAccessValidationEvidence.length) {
      for (const evidence of dataSourceAccessValidationEvidence.slice(0, 10)) {
        const record = toControlPlaneRecord(evidence);
        lines.push(`- ${toText(record.sourceLabel) || toText(record.sourceId) || "Source"}: ${toText(record.status) || "review"} (${toText(record.accessMethod) || "review-required"})`);
      }
    } else {
      lines.push("- No Data Sources access validation evidence recorded.");
    }

    lines.push("", "## Data Sources Access Tasks");
    if (dataSourcesAccessTasks.length) {
      for (const task of dataSourcesAccessTasks.slice(0, 10)) {
        const record = toControlPlaneRecord(task);
        lines.push(`- ${toText(record.priority) || "normal"} ${toText(record.status) || "open"}: ${toText(record.title) || toText(record.sourceLabel) || "Source access task"} (${toText(record.accessMethod) || toText(record.sourceAccessReviewId) || "review"})`);
      }
    } else {
      lines.push("- No Data Sources access tasks.");
    }

    return lines.join("\n");
  }

  /**
   * @param {ReturnType<typeof buildGovernanceSnapshot>} governance
   * @param {{ dataSourcesAccessGate?: Record<string, unknown> | null, dataSourcesAccessReviewQueue?: Record<string, unknown> | null, dataSourcesAccessValidationRunbook?: Record<string, unknown> | null, releaseBuildGate?: Record<string, unknown> | null }} options
   */
  function createAgentControlPlaneDecisionPayload(governance, options = {}) {
    const summary = toControlPlaneRecord(governance.summary);
    const metrics = toControlPlaneRecord(governance.agentExecutionMetrics);
    const baseline = toControlPlaneRecord(governance.agentControlPlaneBaselineStatus);
    const dataSourcesAccessGate = options.dataSourcesAccessGate && typeof options.dataSourcesAccessGate === "object"
      ? options.dataSourcesAccessGate
      : null;
    const dataSourcesAccessReviewQueue = options.dataSourcesAccessReviewQueue && typeof options.dataSourcesAccessReviewQueue === "object"
      ? options.dataSourcesAccessReviewQueue
      : null;
    const dataSourcesAccessValidationRunbook = options.dataSourcesAccessValidationRunbook && typeof options.dataSourcesAccessValidationRunbook === "object"
      ? options.dataSourcesAccessValidationRunbook
      : governance.dataSourcesAccessValidationRunbook && typeof governance.dataSourcesAccessValidationRunbook === "object"
        ? governance.dataSourcesAccessValidationRunbook
        : null;
    const dataSourcesAccessValidationSummary = toControlPlaneRecord(dataSourcesAccessValidationRunbook?.summary);
    const dataSourcesAccessValidationEvidenceCoverage = governance.dataSourcesAccessValidationEvidenceCoverage && typeof governance.dataSourcesAccessValidationEvidenceCoverage === "object"
      ? governance.dataSourcesAccessValidationEvidenceCoverage
      : null;
    const dataSourcesAccessValidationEvidenceCoverageSummary = toControlPlaneRecord(dataSourcesAccessValidationEvidenceCoverage?.summary);
    const releaseBuildGate = options.releaseBuildGate && typeof options.releaseBuildGate === "object"
      ? options.releaseBuildGate
      : governance.releaseBuildGate && typeof governance.releaseBuildGate === "object"
        ? governance.releaseBuildGate
        : null;
    const releaseBuildGateReasons = Array.isArray(releaseBuildGate?.reasons) ? releaseBuildGate.reasons : [];
    const releaseBuildGateActions = Array.isArray(releaseBuildGate?.actions) ? releaseBuildGate.actions : [];
    const releaseBuildGateDecision = toText(releaseBuildGate?.decision) || "not-evaluated";
    const dataSourcesAccessTasks = Array.isArray(governance.dataSourcesAccessTasks) ? governance.dataSourcesAccessTasks : [];
    const dataSourceAccessValidationEvidence = Array.isArray(governance.dataSourceAccessValidationEvidence) ? governance.dataSourceAccessValidationEvidence : [];
    const dataSourcesAccessOpenTaskCount = toNumber(summary.dataSourcesAccessOpenTaskCount);
    const releaseControlTasks = Array.isArray(governance.releaseControlTasks) ? governance.releaseControlTasks : [];
    const releaseControlOpenTaskCount = toNumber(summary.releaseControlOpenTaskCount);
    const agentControlPlaneDecisionTasks = Array.isArray(governance.agentControlPlaneDecisionTasks) ? governance.agentControlPlaneDecisionTasks : [];
    const agentControlPlaneDecisionOpenTaskCount = toNumber(summary.agentControlPlaneDecisionOpenTaskCount);
    const reasons = [];
    const addReason = (severity, code, message) => {
      reasons.push({ severity, code, message });
    };

    if (!baseline.hasBaseline) {
      addReason("hold", "baseline-missing", "No Agent Control Plane baseline is selected.");
    } else if (toText(baseline.freshness) === "stale") {
      addReason("hold", "baseline-stale", "The Agent Control Plane baseline is stale.");
    }

    const driftSeverity = toText(baseline.driftSeverity) || "missing-baseline";
    if (["high", "medium"].includes(driftSeverity)) {
      addReason(driftSeverity === "high" ? "hold" : "review", `baseline-drift-${driftSeverity}`, toText(baseline.driftRecommendedAction) || "Review Control Plane baseline drift.");
    } else if (baseline.hasDrift || driftSeverity === "low") {
      addReason("review", "baseline-drift-low", toText(baseline.driftRecommendedAction) || "Review the listed baseline drift fields.");
    }

    if (toNumber(metrics.slaBreached) > 0) {
      addReason("hold", "sla-breached", "Resolve or explicitly accept Agent Execution SLA breaches before the next supervised build.");
    }
    if (toNumber(metrics.staleActive) > 0) {
      addReason("review", "stale-active-runs", "Review stale active Agent Execution runs before starting new work.");
    }
    if (toNumber(summary.agentReadyProjects) === 0 && toNumber(summary.agentReadinessItems) > 0) {
      addReason("review", "no-ready-projects", "No projects are currently rated agent-ready.");
    }
    if (releaseBuildGateDecision === "hold") {
      addReason("hold", "release-build-gate-hold", toText(releaseBuildGate?.recommendedAction) || "Resolve release build gate hold reasons before supervised agent work.");
    } else if (releaseBuildGateDecision === "review") {
      addReason("review", "release-build-gate-review", toText(releaseBuildGate?.recommendedAction) || "Review release build gate reasons before supervised agent work.");
    }
    if (releaseControlOpenTaskCount > 0) {
      addReason("review", "release-control-open-tasks", `Resolve or explicitly defer ${releaseControlOpenTaskCount} open Release Control task${releaseControlOpenTaskCount === 1 ? "" : "s"} before supervised agent work.`);
    }
    if (agentControlPlaneDecisionOpenTaskCount > 0) {
      addReason("review", "control-plane-decision-open-tasks", `Resolve or explicitly defer ${agentControlPlaneDecisionOpenTaskCount} open Control Plane decision task${agentControlPlaneDecisionOpenTaskCount === 1 ? "" : "s"} before supervised agent work.`);
    }
    const dataSourcesGateDecision = toText(dataSourcesAccessGate?.decision);
    if (dataSourcesGateDecision === "hold") {
      addReason("hold", "data-sources-access-hold", toText(dataSourcesAccessGate?.recommendedAction) || "Resolve Data Sources access holds before supervised agent work.");
    } else if (dataSourcesGateDecision === "review") {
      addReason("review", "data-sources-access-review", toText(dataSourcesAccessGate?.recommendedAction) || "Review Data Sources access requirements before supervised agent work.");
    }
    if (dataSourcesAccessOpenTaskCount > 0) {
      addReason("review", "data-sources-access-open-tasks", `Resolve or explicitly defer ${dataSourcesAccessOpenTaskCount} open Data Sources access task${dataSourcesAccessOpenTaskCount === 1 ? "" : "s"} before supervised agent work.`);
    }
    const dataSourcesAccessValidationBlockedCount = toNumber(dataSourcesAccessValidationSummary.blocked);
    const dataSourcesAccessValidationReviewCount = toNumber(dataSourcesAccessValidationSummary.review);
    if (dataSourcesAccessValidationBlockedCount > 0) {
      addReason("hold", "data-sources-access-validation-blocked", `Complete the non-secret Data Sources access validation runbook for ${dataSourcesAccessValidationBlockedCount} blocked source${dataSourcesAccessValidationBlockedCount === 1 ? "" : "s"} before supervised agent work.`);
    } else if (dataSourcesAccessValidationReviewCount > 0) {
      addReason("review", "data-sources-access-validation-review", `Complete the non-secret Data Sources access validation runbook for ${dataSourcesAccessValidationReviewCount} review source${dataSourcesAccessValidationReviewCount === 1 ? "" : "s"} before supervised agent work.`);
    }
    const dataSourcesAccessValidationEvidenceBlockedCount = toNumber(summary.dataSourcesAccessValidationEvidenceBlockedCount);
    const dataSourcesAccessValidationEvidenceReviewCount = toNumber(summary.dataSourcesAccessValidationEvidenceReviewCount);
    if (dataSourcesAccessValidationEvidenceBlockedCount > 0) {
      addReason("hold", "data-sources-access-validation-evidence-blocked", `Resolve ${dataSourcesAccessValidationEvidenceBlockedCount} blocked Data Sources access validation evidence record${dataSourcesAccessValidationEvidenceBlockedCount === 1 ? "" : "s"} before supervised agent work.`);
    } else if (dataSourcesAccessValidationEvidenceReviewCount > 0) {
      addReason("review", "data-sources-access-validation-evidence-review", `Review ${dataSourcesAccessValidationEvidenceReviewCount} Data Sources access validation evidence record${dataSourcesAccessValidationEvidenceReviewCount === 1 ? "" : "s"} before supervised agent work.`);
    }
    const dataSourcesAccessValidationEvidenceCoverageBlockedCount = toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.blocked || summary.dataSourcesAccessValidationEvidenceCoverageBlockedCount);
    const dataSourcesAccessValidationEvidenceCoverageMissingCount = toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.missing || summary.dataSourcesAccessValidationEvidenceCoverageMissingCount);
    const dataSourcesAccessValidationEvidenceCoverageReviewCount = toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.review || summary.dataSourcesAccessValidationEvidenceCoverageReviewCount);
    const dataSourcesAccessValidationEvidenceCoverageHighPriorityCount = toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.highPriority || summary.dataSourcesAccessValidationEvidenceCoverageHighPriorityCount);
    if (dataSourcesAccessValidationEvidenceCoverageBlockedCount > 0) {
      addReason("hold", "data-sources-access-validation-evidence-coverage-blocked", `Resolve ${dataSourcesAccessValidationEvidenceCoverageBlockedCount} blocked Data Sources access validation evidence coverage item${dataSourcesAccessValidationEvidenceCoverageBlockedCount === 1 ? "" : "s"} before supervised agent work.`);
    } else if (dataSourcesAccessValidationEvidenceCoverageHighPriorityCount > 0) {
      addReason("hold", "data-sources-access-validation-evidence-coverage-high-priority", `Record or resolve ${dataSourcesAccessValidationEvidenceCoverageHighPriorityCount} high-priority Data Sources access validation evidence coverage gap${dataSourcesAccessValidationEvidenceCoverageHighPriorityCount === 1 ? "" : "s"} before supervised agent work.`);
    } else if (dataSourcesAccessValidationEvidenceCoverageMissingCount > 0 || dataSourcesAccessValidationEvidenceCoverageReviewCount > 0) {
      addReason("review", "data-sources-access-validation-evidence-coverage-gaps", `Review ${dataSourcesAccessValidationEvidenceCoverageMissingCount} missing and ${dataSourcesAccessValidationEvidenceCoverageReviewCount} review Data Sources access validation evidence coverage item${dataSourcesAccessValidationEvidenceCoverageMissingCount + dataSourcesAccessValidationEvidenceCoverageReviewCount === 1 ? "" : "s"} before supervised agent work.`);
    }

    const decision = reasons.some((reason) => reason.severity === "hold")
      ? "hold"
      : reasons.length
        ? "review"
        : "ready";
    const recommendedAction = decision === "hold"
      ? reasons.find((reason) => reason.severity === "hold")?.message || "Resolve hold reasons before the next supervised build."
      : decision === "review"
        ? reasons[0]?.message || "Review the Agent Control Plane before the next supervised build."
        : "Proceed with the next supervised agent build and continue monitoring baseline drift.";
    const payload = {
      generatedAt: new Date().toISOString(),
      decision,
      recommendedAction,
      reasons,
      baselineHealth: toText(baseline.health) || "missing",
      baselineDriftSeverity: driftSeverity,
      baselineDriftRecommendedAction: toText(baseline.driftRecommendedAction),
      releaseBuildGateDecision,
      releaseBuildGateRiskScore: toNumber(releaseBuildGate?.riskScore),
      releaseBuildGateReasonCount: releaseBuildGateReasons.length,
      releaseBuildGateActionCount: releaseBuildGateActions.length,
      releaseBuildGate,
      releaseControlTaskCount: toNumber(summary.releaseControlTaskCount),
      releaseControlOpenTaskCount,
      releaseControlClosedTaskCount: toNumber(summary.releaseControlClosedTaskCount),
      releaseControlTasks: releaseControlTasks.slice(0, 12),
      agentControlPlaneDecisionTaskCount: toNumber(summary.agentControlPlaneDecisionTaskCount),
      agentControlPlaneDecisionOpenTaskCount,
      agentControlPlaneDecisionClosedTaskCount: toNumber(summary.agentControlPlaneDecisionClosedTaskCount),
      agentControlPlaneDecisionTasks: agentControlPlaneDecisionTasks.slice(0, 12),
      activeRuns: toNumber(metrics.active),
      staleActiveRuns: toNumber(metrics.staleActive),
      slaBreachedRuns: toNumber(metrics.slaBreached),
      agentReadyProjects: toNumber(summary.agentReadyProjects),
      agentReadinessItems: toNumber(summary.agentReadinessItems),
      dataSourcesGateDecision: dataSourcesGateDecision || "not-evaluated",
      dataSourcesReady: toNumber(dataSourcesAccessGate?.ready),
      dataSourcesReview: toNumber(dataSourcesAccessGate?.review),
      dataSourcesBlocked: toNumber(dataSourcesAccessGate?.blocked),
      dataSourcesTokenLikely: toNumber(dataSourcesAccessGate?.tokenLikely),
      dataSourcesAccessGate,
      dataSourcesAccessReviewQueueCount: toNumber(dataSourcesAccessReviewQueue?.summary?.total),
      dataSourcesAccessReviewQueue,
      dataSourcesAccessValidationMethodCount: toNumber(dataSourcesAccessValidationSummary.methodCount),
      dataSourcesAccessValidationSourceCount: toNumber(dataSourcesAccessValidationSummary.sourceCount),
      dataSourcesAccessValidationReviewCount,
      dataSourcesAccessValidationBlockedCount,
      dataSourcesAccessValidationRunbook,
      dataSourcesAccessValidationEvidenceCount: toNumber(summary.dataSourcesAccessValidationEvidenceCount),
      dataSourcesAccessValidationEvidenceValidatedCount: toNumber(summary.dataSourcesAccessValidationEvidenceValidatedCount),
      dataSourcesAccessValidationEvidenceReviewCount,
      dataSourcesAccessValidationEvidenceBlockedCount,
      dataSourcesAccessValidationEvidenceCoverageCount: toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.sourceCount || summary.dataSourcesAccessValidationEvidenceCoverageCount),
      dataSourcesAccessValidationEvidenceCoverageCoveredCount: toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.covered || summary.dataSourcesAccessValidationEvidenceCoverageCoveredCount),
      dataSourcesAccessValidationEvidenceCoverageReviewCount,
      dataSourcesAccessValidationEvidenceCoverageBlockedCount,
      dataSourcesAccessValidationEvidenceCoverageMissingCount,
      dataSourcesAccessValidationEvidenceCoverageHighPriorityCount,
      dataSourcesAccessValidationEvidenceCoveragePercent: toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.coveragePercent || summary.dataSourcesAccessValidationEvidenceCoveragePercent),
      dataSourcesAccessValidationEvidenceCoverage,
      dataSourceAccessValidationEvidenceSnapshotCount: toNumber(summary.dataSourceAccessValidationEvidenceSnapshotCount),
      dataSourceAccessValidationEvidence: dataSourceAccessValidationEvidence.slice(0, 12),
      dataSourcesAccessTaskCount: toNumber(summary.dataSourcesAccessTaskCount),
      dataSourcesAccessOpenTaskCount,
      dataSourcesAccessClosedTaskCount: toNumber(summary.dataSourcesAccessClosedTaskCount),
      dataSourcesAccessTasks: dataSourcesAccessTasks.slice(0, 12),
      baselineStatus: baseline,
      agentExecutionMetrics: governance.agentExecutionMetrics,
      summary: governance.summary
    };

    return {
      ...payload,
      markdown: buildAgentControlPlaneDecisionMarkdown(payload)
    };
  }

  /**
   * @param {ReturnType<typeof buildGovernanceSnapshot>} governance
   * @param {Record<string, unknown>} [payload]
   * @param {{ dataSourcesAccessGate?: Record<string, unknown> | null, dataSourcesAccessReviewQueue?: Record<string, unknown> | null, dataSourcesAccessValidationRunbook?: Record<string, unknown> | null, releaseBuildGate?: Record<string, unknown> | null }} options
   */
  function createAgentControlPlaneDecisionSnapshotRecord(governance, payload = {}, options = {}) {
    const decision = createAgentControlPlaneDecisionPayload(governance, {
      dataSourcesAccessGate: options.dataSourcesAccessGate || null,
      dataSourcesAccessReviewQueue: options.dataSourcesAccessReviewQueue || null,
      dataSourcesAccessValidationRunbook: options.dataSourcesAccessValidationRunbook || null,
      releaseBuildGate: options.releaseBuildGate || null
    });
    const title = String(payload.title || `Agent Control Plane Decision - ${decision.decision.toUpperCase()}`).trim() || "Agent Control Plane Decision";
    return {
      id: createId("agent-control-plane-decision-snapshot"),
      title,
      decision: decision.decision,
      recommendedAction: decision.recommendedAction,
      reasonCount: decision.reasons.length,
      reasonCodes: decision.reasons.map((reason) => reason.code),
      reasons: decision.reasons,
      baselineHealth: decision.baselineHealth,
      baselineDriftSeverity: decision.baselineDriftSeverity,
      releaseBuildGateDecision: decision.releaseBuildGateDecision,
      releaseBuildGateRiskScore: decision.releaseBuildGateRiskScore,
      releaseBuildGateReasonCount: decision.releaseBuildGateReasonCount,
      releaseBuildGateActionCount: decision.releaseBuildGateActionCount,
      releaseBuildGate: decision.releaseBuildGate,
      releaseControlTaskCount: decision.releaseControlTaskCount,
      releaseControlOpenTaskCount: decision.releaseControlOpenTaskCount,
      releaseControlClosedTaskCount: decision.releaseControlClosedTaskCount,
      releaseControlTasks: decision.releaseControlTasks,
      agentControlPlaneDecisionTaskCount: decision.agentControlPlaneDecisionTaskCount,
      agentControlPlaneDecisionOpenTaskCount: decision.agentControlPlaneDecisionOpenTaskCount,
      agentControlPlaneDecisionClosedTaskCount: decision.agentControlPlaneDecisionClosedTaskCount,
      agentControlPlaneDecisionTasks: decision.agentControlPlaneDecisionTasks,
      activeRuns: decision.activeRuns,
      staleActiveRuns: decision.staleActiveRuns,
      slaBreachedRuns: decision.slaBreachedRuns,
      agentReadyProjects: decision.agentReadyProjects,
      agentReadinessItems: decision.agentReadinessItems,
      dataSourcesGateDecision: decision.dataSourcesGateDecision,
      dataSourcesReview: decision.dataSourcesReview,
      dataSourcesBlocked: decision.dataSourcesBlocked,
      dataSourcesAccessGate: decision.dataSourcesAccessGate,
      dataSourcesAccessReviewQueueCount: decision.dataSourcesAccessReviewQueueCount,
      dataSourcesAccessReviewQueue: decision.dataSourcesAccessReviewQueue,
      dataSourcesAccessValidationMethodCount: decision.dataSourcesAccessValidationMethodCount,
      dataSourcesAccessValidationSourceCount: decision.dataSourcesAccessValidationSourceCount,
      dataSourcesAccessValidationReviewCount: decision.dataSourcesAccessValidationReviewCount,
      dataSourcesAccessValidationBlockedCount: decision.dataSourcesAccessValidationBlockedCount,
      dataSourcesAccessValidationRunbook: decision.dataSourcesAccessValidationRunbook,
      dataSourcesAccessValidationEvidenceCount: decision.dataSourcesAccessValidationEvidenceCount,
      dataSourcesAccessValidationEvidenceValidatedCount: decision.dataSourcesAccessValidationEvidenceValidatedCount,
      dataSourcesAccessValidationEvidenceReviewCount: decision.dataSourcesAccessValidationEvidenceReviewCount,
      dataSourcesAccessValidationEvidenceBlockedCount: decision.dataSourcesAccessValidationEvidenceBlockedCount,
      dataSourcesAccessValidationEvidenceCoverageCount: decision.dataSourcesAccessValidationEvidenceCoverageCount,
      dataSourcesAccessValidationEvidenceCoverageCoveredCount: decision.dataSourcesAccessValidationEvidenceCoverageCoveredCount,
      dataSourcesAccessValidationEvidenceCoverageReviewCount: decision.dataSourcesAccessValidationEvidenceCoverageReviewCount,
      dataSourcesAccessValidationEvidenceCoverageBlockedCount: decision.dataSourcesAccessValidationEvidenceCoverageBlockedCount,
      dataSourcesAccessValidationEvidenceCoverageMissingCount: decision.dataSourcesAccessValidationEvidenceCoverageMissingCount,
      dataSourcesAccessValidationEvidenceCoverageHighPriorityCount: decision.dataSourcesAccessValidationEvidenceCoverageHighPriorityCount,
      dataSourcesAccessValidationEvidenceCoveragePercent: decision.dataSourcesAccessValidationEvidenceCoveragePercent,
      dataSourcesAccessValidationEvidenceCoverage: decision.dataSourcesAccessValidationEvidenceCoverage,
      dataSourceAccessValidationEvidenceSnapshotCount: decision.dataSourceAccessValidationEvidenceSnapshotCount,
      dataSourceAccessValidationEvidence: decision.dataSourceAccessValidationEvidence,
      dataSourcesAccessTaskCount: decision.dataSourcesAccessTaskCount,
      dataSourcesAccessOpenTaskCount: decision.dataSourcesAccessOpenTaskCount,
      dataSourcesAccessClosedTaskCount: decision.dataSourcesAccessClosedTaskCount,
      dataSourcesAccessTasks: decision.dataSourcesAccessTasks,
      markdown: decision.markdown,
      payload: decision,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * @param {unknown} value
   * @returns {Record<string, unknown>}
   */
  function toControlPlaneRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? /** @type {Record<string, unknown>} */ (value)
      : {};
  }

  /**
   * @param {Record<string, unknown>} payload
   * @param {string} key
   */
  function getControlPlaneList(payload, key) {
    const value = payload[key];
    return Array.isArray(value) ? value : [];
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function getControlPlaneSlaLedgerItems(payload) {
    const ledger = toControlPlaneRecord(payload.slaLedger);
    return Array.isArray(ledger.items) ? ledger.items : [];
  }

  /**
   * @param {unknown[]} beforeItems
   * @param {unknown[]} currentItems
   * @param {{
   *   getKey: (item: Record<string, unknown>) => string,
   *   describe: (item: Record<string, unknown>) => string,
   *   hasChanged?: (before: Record<string, unknown>, current: Record<string, unknown>) => boolean,
   *   describeChange?: (before: Record<string, unknown>, current: Record<string, unknown>) => string
   * }} options
   */
  function createAgentControlPlaneCollectionDrift(beforeItems, currentItems, options) {
    const beforeByKey = new Map();
    const currentByKey = new Map();
    for (const item of beforeItems) {
      const record = toControlPlaneRecord(item);
      const key = options.getKey(record);
      if (key && !beforeByKey.has(key)) beforeByKey.set(key, record);
    }
    for (const item of currentItems) {
      const record = toControlPlaneRecord(item);
      const key = options.getKey(record);
      if (key && !currentByKey.has(key)) currentByKey.set(key, record);
    }

    const added = [];
    const removed = [];
    const changed = [];

    for (const [key, item] of currentByKey) {
      if (!beforeByKey.has(key)) {
        added.push(options.describe(item));
      }
    }

    for (const [key, item] of beforeByKey) {
      if (!currentByKey.has(key)) {
        removed.push(options.describe(item));
      }
    }

    if (options.hasChanged) {
      for (const [key, item] of currentByKey) {
        const before = beforeByKey.get(key);
        if (before && options.hasChanged(before, item)) {
          changed.push(options.describeChange ? options.describeChange(before, item) : options.describe(item));
        }
      }
    }

    return {
      addedCount: added.length,
      removedCount: removed.length,
      changedCount: changed.length,
      added: added.slice(0, 10),
      removed: removed.slice(0, 10),
      changed: changed.slice(0, 10)
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function summarizeAgentControlPlaneNumbers(payload) {
    const summary = toControlPlaneRecord(payload.summary);
    const metrics = toControlPlaneRecord(payload.agentExecutionMetrics);
    const workOrders = toControlPlaneRecord(payload.workOrders);
    const slaLedger = toControlPlaneRecord(payload.slaLedger);
    const dataSourcesAccessGate = toControlPlaneRecord(payload.dataSourcesAccessGate);
    const dataSourcesAccessReviewQueue = toControlPlaneRecord(payload.dataSourcesAccessReviewQueue);
    const dataSourcesAccessReviewQueueSummary = toControlPlaneRecord(dataSourcesAccessReviewQueue.summary);
    const dataSourcesAccessValidationRunbook = toControlPlaneRecord(payload.dataSourcesAccessValidationRunbook);
    const dataSourcesAccessValidationRunbookSummary = toControlPlaneRecord(dataSourcesAccessValidationRunbook.summary);
    const dataSourcesAccessValidationEvidenceCoverage = toControlPlaneRecord(payload.dataSourcesAccessValidationEvidenceCoverage);
    const dataSourcesAccessValidationEvidenceCoverageSummary = toControlPlaneRecord(dataSourcesAccessValidationEvidenceCoverage.summary);
    const releaseBuildGate = toControlPlaneRecord(payload.releaseBuildGate);
    const releaseBuildGateDecision = toText(payload.releaseBuildGateDecision) || toText(releaseBuildGate.decision) || toText(summary.releaseBuildGateDecision) || "not-evaluated";
    const releaseBuildGateRank = releaseBuildGateDecision === "hold"
      ? 3
      : releaseBuildGateDecision === "review"
        ? 2
        : releaseBuildGateDecision === "ready"
          ? 1
          : 0;
    const dataSourcesGateDecision = toText(payload.dataSourcesGateDecision) || toText(dataSourcesAccessGate.decision) || "not-evaluated";
    const dataSourcesGateRank = dataSourcesGateDecision === "hold"
      ? 3
      : dataSourcesGateDecision === "review"
        ? 2
        : dataSourcesGateDecision === "ready"
          ? 1
          : 0;
    const summaryCount = (key, fallback) => Object.prototype.hasOwnProperty.call(summary, key)
      ? toNumber(summary[key])
      : fallback;

    return {
      readyProjects: summaryCount("agentReadyProjects", 0),
      readinessItems: summaryCount("agentReadinessItems", 0),
      agentSessions: summaryCount("agentSessionCount", getControlPlaneList(payload, "agentSessions").length),
      workOrders: summaryCount("agentReadinessItems", toNumber(workOrders.total)),
      executionRuns: summaryCount("agentWorkOrderRunCount", getControlPlaneList(payload, "executionRuns").length),
      slaLedgerRecords: summaryCount("agentExecutionSlaLedgerCount", toNumber(slaLedger.total)),
      slaLedgerSnapshots: summaryCount("agentExecutionSlaLedgerSnapshotCount", getControlPlaneList(payload, "slaLedgerSnapshots").length),
      deploymentSmokeChecks: summaryCount("deploymentSmokeCheckCount", getControlPlaneList(payload, "deploymentSmokeChecks").length),
      deploymentSmokeCheckPasses: summaryCount("deploymentSmokeCheckPassCount", getControlPlaneList(payload, "deploymentSmokeChecks").filter((item) => toText(toControlPlaneRecord(item).status) === "pass").length),
      deploymentSmokeCheckFails: summaryCount("deploymentSmokeCheckFailCount", getControlPlaneList(payload, "deploymentSmokeChecks").filter((item) => toText(toControlPlaneRecord(item).status) === "fail").length),
      releaseCheckpoints: summaryCount("releaseCheckpointCount", getControlPlaneList(payload, "releaseCheckpoints").length),
      releaseBuildGateRank,
      releaseBuildGateRiskScore: summaryCount("releaseBuildGateRiskScore", toNumber(payload.releaseBuildGateRiskScore || releaseBuildGate.riskScore)),
      releaseBuildGateReasons: summaryCount("releaseBuildGateReasonCount", toNumber(payload.releaseBuildGateReasonCount) || (Array.isArray(releaseBuildGate.reasons) ? releaseBuildGate.reasons.length : 0)),
      releaseBuildGateActions: summaryCount("releaseBuildGateActionCount", toNumber(payload.releaseBuildGateActionCount) || (Array.isArray(releaseBuildGate.actions) ? releaseBuildGate.actions.length : 0)),
      releaseControlTasks: summaryCount("releaseControlTaskCount", getControlPlaneList(payload, "releaseControlTasks").length),
      releaseControlOpenTasks: summaryCount("releaseControlOpenTaskCount", 0),
      releaseControlClosedTasks: summaryCount("releaseControlClosedTaskCount", 0),
      agentControlPlaneDecisionTasks: summaryCount("agentControlPlaneDecisionTaskCount", getControlPlaneList(payload, "agentControlPlaneDecisionTasks").length),
      agentControlPlaneDecisionOpenTasks: summaryCount("agentControlPlaneDecisionOpenTaskCount", 0),
      agentControlPlaneDecisionClosedTasks: summaryCount("agentControlPlaneDecisionClosedTaskCount", 0),
      agentControlPlaneDecisionTaskLedgerSnapshots: summaryCount("agentControlPlaneDecisionTaskLedgerSnapshotCount", getControlPlaneList(payload, "agentControlPlaneDecisionTaskLedgerSnapshots").length),
      staleActive: toNumber(metrics.staleActive),
      slaBreached: toNumber(metrics.slaBreached),
      slaResolved: toNumber(metrics.slaResolved),
      completionRate: toNumber(metrics.completionRate),
      failureRate: toNumber(metrics.failureRate),
      dataSourcesGateRank,
      dataSourcesReview: toNumber(payload.dataSourcesReview || dataSourcesAccessGate.review),
      dataSourcesBlocked: toNumber(payload.dataSourcesBlocked || dataSourcesAccessGate.blocked),
      dataSourcesTokenLikely: toNumber(dataSourcesAccessGate.tokenLikely),
      dataSourcesAccessReviewQueue: toNumber(payload.dataSourcesAccessReviewQueueCount || dataSourcesAccessReviewQueueSummary.total),
      dataSourcesAccessReviewQueueBlocked: toNumber(dataSourcesAccessReviewQueueSummary.blocked),
      dataSourcesAccessReviewQueueHigh: toNumber(dataSourcesAccessReviewQueueSummary.high),
      dataSourcesAccessReviewQueueMedium: toNumber(dataSourcesAccessReviewQueueSummary.medium),
      dataSourcesAccessValidationMethods: summaryCount("dataSourcesAccessValidationMethodCount", toNumber(dataSourcesAccessValidationRunbookSummary.methodCount)),
      dataSourcesAccessValidationSources: summaryCount("dataSourcesAccessValidationSourceCount", toNumber(dataSourcesAccessValidationRunbookSummary.sourceCount)),
      dataSourcesAccessValidationReview: summaryCount("dataSourcesAccessValidationReviewCount", toNumber(dataSourcesAccessValidationRunbookSummary.review)),
      dataSourcesAccessValidationBlocked: summaryCount("dataSourcesAccessValidationBlockedCount", toNumber(dataSourcesAccessValidationRunbookSummary.blocked)),
      dataSourcesAccessValidationEvidence: summaryCount("dataSourcesAccessValidationEvidenceCount", getControlPlaneList(payload, "dataSourceAccessValidationEvidence").length),
      dataSourcesAccessValidationEvidenceValidated: summaryCount("dataSourcesAccessValidationEvidenceValidatedCount", getControlPlaneList(payload, "dataSourceAccessValidationEvidence").filter((item) => toText(toControlPlaneRecord(item).status) === "validated").length),
      dataSourcesAccessValidationEvidenceReview: summaryCount("dataSourcesAccessValidationEvidenceReviewCount", getControlPlaneList(payload, "dataSourceAccessValidationEvidence").filter((item) => toText(toControlPlaneRecord(item).status) === "review").length),
      dataSourcesAccessValidationEvidenceBlocked: summaryCount("dataSourcesAccessValidationEvidenceBlockedCount", getControlPlaneList(payload, "dataSourceAccessValidationEvidence").filter((item) => toText(toControlPlaneRecord(item).status) === "blocked").length),
      dataSourcesAccessValidationEvidenceCoverage: summaryCount("dataSourcesAccessValidationEvidenceCoverageCount", toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.sourceCount)),
      dataSourcesAccessValidationEvidenceCoverageCovered: summaryCount("dataSourcesAccessValidationEvidenceCoverageCoveredCount", toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.covered)),
      dataSourcesAccessValidationEvidenceCoverageMissing: summaryCount("dataSourcesAccessValidationEvidenceCoverageMissingCount", toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.missing)),
      dataSourcesAccessValidationEvidenceCoverageHighPriority: summaryCount("dataSourcesAccessValidationEvidenceCoverageHighPriorityCount", toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.highPriority)),
      dataSourcesAccessValidationEvidenceCoveragePercent: summaryCount("dataSourcesAccessValidationEvidenceCoveragePercent", toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.coveragePercent)),
      dataSourceAccessValidationEvidenceSnapshots: summaryCount("dataSourceAccessValidationEvidenceSnapshotCount", getControlPlaneList(payload, "dataSourceAccessValidationEvidenceSnapshots").length),
      dataSourcesAccessTasks: summaryCount("dataSourcesAccessTaskCount", 0),
      dataSourcesAccessOpenTasks: summaryCount("dataSourcesAccessOpenTaskCount", 0),
      dataSourcesAccessClosedTasks: summaryCount("dataSourcesAccessClosedTaskCount", 0),
      dataSourceAccessTaskLedgerSnapshots: summaryCount("dataSourceAccessTaskLedgerSnapshotCount", 0)
    };
  }

  /**
   * @param {Record<string, unknown>} snapshotPayload
   * @param {Record<string, unknown>} currentPayload
   */
  function createAgentControlPlaneMetricDeltas(snapshotPayload, currentPayload) {
    const before = summarizeAgentControlPlaneNumbers(snapshotPayload);
    const current = summarizeAgentControlPlaneNumbers(currentPayload);
    const snapshotDataSourcesGate = toControlPlaneRecord(snapshotPayload.dataSourcesAccessGate);
    const currentDataSourcesGate = toControlPlaneRecord(currentPayload.dataSourcesAccessGate);
    const snapshotDataSourcesAccessReviewQueue = toControlPlaneRecord(snapshotPayload.dataSourcesAccessReviewQueue);
    const currentDataSourcesAccessReviewQueue = toControlPlaneRecord(currentPayload.dataSourcesAccessReviewQueue);
    const snapshotReleaseBuildGate = toControlPlaneRecord(snapshotPayload.releaseBuildGate);
    const currentReleaseBuildGate = toControlPlaneRecord(currentPayload.releaseBuildGate);
    const fields = [
      ["Agent-ready projects", "readyProjects"],
      ["Readiness items", "readinessItems"],
      ["Agent sessions", "agentSessions"],
      ["Work orders", "workOrders"],
      ["Execution runs", "executionRuns"],
      ["SLA ledger records", "slaLedgerRecords"],
      ["SLA ledger snapshots", "slaLedgerSnapshots"],
      ["Deployment smoke checks", "deploymentSmokeChecks"],
      ["Deployment smoke check passes", "deploymentSmokeCheckPasses"],
      ["Deployment smoke check failures", "deploymentSmokeCheckFails"],
      ["Release checkpoints", "releaseCheckpoints"],
      ["Stale active runs", "staleActive"],
      ["SLA breached", "slaBreached"],
      ["SLA resolved", "slaResolved"],
      ["Completion rate", "completionRate"],
      ["Failure rate", "failureRate"]
    ];
    if (toText(snapshotReleaseBuildGate.decision) && toText(currentReleaseBuildGate.decision)) {
      fields.push(
        ["Release build gate rank", "releaseBuildGateRank"],
        ["Release build gate risk", "releaseBuildGateRiskScore"],
        ["Release build gate reasons", "releaseBuildGateReasons"],
        ["Release build gate actions", "releaseBuildGateActions"],
        ["Release Control tasks", "releaseControlTasks"],
        ["Release Control open tasks", "releaseControlOpenTasks"],
        ["Release Control closed tasks", "releaseControlClosedTasks"],
        ["Control Plane decision tasks", "agentControlPlaneDecisionTasks"],
        ["Control Plane decision open tasks", "agentControlPlaneDecisionOpenTasks"],
        ["Control Plane decision closed tasks", "agentControlPlaneDecisionClosedTasks"],
        ["Control Plane decision task ledger snapshots", "agentControlPlaneDecisionTaskLedgerSnapshots"]
      );
    }
    if (toText(snapshotDataSourcesGate.decision) && toText(currentDataSourcesGate.decision)) {
      fields.push(
        ["Data Sources gate rank", "dataSourcesGateRank"],
        ["Data Sources review sources", "dataSourcesReview"],
        ["Data Sources blocked sources", "dataSourcesBlocked"],
        ["Data Sources token-likely sources", "dataSourcesTokenLikely"]
      );
    }
    if (snapshotDataSourcesAccessReviewQueue.summary && currentDataSourcesAccessReviewQueue.summary) {
      fields.push(
        ["Data Sources access review queue", "dataSourcesAccessReviewQueue"],
        ["Data Sources access review blocked", "dataSourcesAccessReviewQueueBlocked"],
        ["Data Sources access review high priority", "dataSourcesAccessReviewQueueHigh"],
        ["Data Sources access review medium priority", "dataSourcesAccessReviewQueueMedium"]
      );
    }
    fields.push(
      ["Data Sources access validation methods", "dataSourcesAccessValidationMethods"],
      ["Data Sources access validation sources", "dataSourcesAccessValidationSources"],
      ["Data Sources access validation review", "dataSourcesAccessValidationReview"],
      ["Data Sources access validation blocked", "dataSourcesAccessValidationBlocked"],
      ["Data Sources access validation evidence", "dataSourcesAccessValidationEvidence"],
      ["Data Sources access validation evidence validated", "dataSourcesAccessValidationEvidenceValidated"],
      ["Data Sources access validation evidence review", "dataSourcesAccessValidationEvidenceReview"],
      ["Data Sources access validation evidence blocked", "dataSourcesAccessValidationEvidenceBlocked"],
      ["Data Sources access validation evidence coverage", "dataSourcesAccessValidationEvidenceCoverage"],
      ["Data Sources access validation evidence coverage covered", "dataSourcesAccessValidationEvidenceCoverageCovered"],
      ["Data Sources access validation evidence coverage missing", "dataSourcesAccessValidationEvidenceCoverageMissing"],
      ["Data Sources access validation evidence coverage high priority", "dataSourcesAccessValidationEvidenceCoverageHighPriority"],
      ["Data Sources access validation evidence coverage percent", "dataSourcesAccessValidationEvidenceCoveragePercent"],
      ["Data Sources access validation evidence snapshots", "dataSourceAccessValidationEvidenceSnapshots"],
      ["Data Sources access tasks", "dataSourcesAccessTasks"],
      ["Data Sources access open tasks", "dataSourcesAccessOpenTasks"],
      ["Data Sources access closed tasks", "dataSourcesAccessClosedTasks"],
      ["Data Sources access task ledger snapshots", "dataSourceAccessTaskLedgerSnapshots"]
    );
    return fields.map(([label, key]) => ({
      label,
      before: before[key],
      current: current[key],
      delta: current[key] - before[key]
    }));
  }

  /**
   * @param {Record<string, unknown>} item
   */
  function describeControlPlaneReadinessItem(item) {
    return `${toText(item.projectName) || "Project"}: ${toText(item.status) || "needs-prep"} (${toNumber(item.score)}/100)`;
  }

  /**
   * @param {Record<string, unknown>} item
   */
  function describeControlPlaneRun(item) {
    return `${toText(item.projectName) || "Project"}: ${toText(item.title) || "Agent Work Order Run"} (${toText(item.status) || "queued"})`;
  }

  /**
   * @param {Record<string, unknown>} item
   */
  function describeControlPlaneSlaLedgerItem(item) {
    return `${toText(item.projectName) || "Project"}: ${toText(item.breachState) || "open"} ${toText(item.action) || "breach"} (${toText(item.status) || "queued"})`;
  }

  /**
   * @param {Record<string, unknown>} item
   */
  function describeControlPlaneSnapshotItem(item) {
    return `${toText(item.title) || "Snapshot"}: ${toText(item.createdAt) || "created date unavailable"}`;
  }

  /**
   * @param {Record<string, unknown>} before
   * @param {Record<string, unknown>} current
   * @param {string[]} fields
   */
  function hasControlPlaneFieldDrift(before, current, fields) {
    return fields.some((field) => String(before[field] ?? "") !== String(current[field] ?? ""));
  }

  /**
   * @param {Record<string, unknown>} diff
   */
  function buildAgentControlPlaneSnapshotDiffMarkdown(diff) {
    const metricDeltas = Array.isArray(diff.metricDeltas) ? diff.metricDeltas : [];
    const driftItems = Array.isArray(diff.driftItems) ? diff.driftItems : [];
    const sections = [
      ["Readiness Drift", toControlPlaneRecord(diff.readiness)],
      ["Execution Run Drift", toControlPlaneRecord(diff.executionRuns)],
      ["SLA Ledger Drift", toControlPlaneRecord(diff.slaLedger)],
      ["Work Order Snapshot Drift", toControlPlaneRecord(diff.workOrderSnapshots)],
      ["SLA Ledger Snapshot Drift", toControlPlaneRecord(diff.slaLedgerSnapshots)]
    ];
    const lines = [
      "# Agent Control Plane Snapshot Drift",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Snapshot: ${toText(diff.snapshotTitle) || "Agent Control Plane"} (${toText(diff.snapshotId) || "unknown"})`,
      `Snapshot created: ${toText(diff.snapshotCreatedAt) || "not recorded"}`,
      `Current generated: ${toText(diff.currentGeneratedAt) || "not recorded"}`,
      `Drift detected: ${diff.hasDrift ? "yes" : "no"}`,
      `Drift score: ${toNumber(diff.driftScore)}`,
      `Drift severity: ${toText(diff.driftSeverity) || "none"}`,
      `Recommended action: ${toText(diff.recommendedAction) || "No snapshot drift detected."}`,
      "",
      "## Metric Deltas"
    ];

    if (metricDeltas.length) {
      for (const item of metricDeltas) {
        const record = toControlPlaneRecord(item);
        lines.push(`- ${toText(record.label)}: ${toNumber(record.before)} -> ${toNumber(record.current)} (${toNumber(record.delta) >= 0 ? "+" : ""}${toNumber(record.delta)})`);
      }
    } else {
      lines.push("- No metric deltas available.");
    }

    lines.push("", "## Drift Fields");
    if (driftItems.length) {
      for (const item of driftItems) {
        const record = toControlPlaneRecord(item);
        lines.push(`- ${toText(record.label) || toText(record.field) || "Drift field"}: ${toNumber(record.before)} -> ${toNumber(record.current)} (${toNumber(record.delta) >= 0 ? "+" : ""}${toNumber(record.delta)})`);
      }
    } else {
      lines.push("- No non-zero drift fields.");
    }

    for (const [title, section] of sections) {
      lines.push("", `## ${title}`);
      lines.push(`- Added: ${toNumber(section.addedCount)}`);
      lines.push(`- Removed: ${toNumber(section.removedCount)}`);
      lines.push(`- Changed: ${toNumber(section.changedCount)}`);
      const added = Array.isArray(section.added) ? section.added : [];
      const removed = Array.isArray(section.removed) ? section.removed : [];
      const changed = Array.isArray(section.changed) ? section.changed : [];
      if (added.length) {
        lines.push("- Added items:");
        for (const item of added) lines.push(`  - ${toText(item)}`);
      }
      if (removed.length) {
        lines.push("- Removed items:");
        for (const item of removed) lines.push(`  - ${toText(item)}`);
      }
      if (changed.length) {
        lines.push("- Changed items:");
        for (const item of changed) lines.push(`  - ${toText(item)}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * @param {number} driftItemCount
   */
  function getAgentControlPlaneSnapshotDriftDecision(driftItemCount) {
    if (driftItemCount <= 0) {
      return {
        driftSeverity: "none",
        recommendedAction: "No snapshot drift detected; continue monitoring the control plane."
      };
    }
    if (driftItemCount <= 3) {
      return {
        driftSeverity: "low",
        recommendedAction: "Review the listed drift fields before the next supervised agent build."
      };
    }
    if (driftItemCount <= 8) {
      return {
        driftSeverity: "medium",
        recommendedAction: "Run a focused control-plane drift review and decide whether to refresh the baseline."
      };
    }
    return {
      driftSeverity: "high",
      recommendedAction: "Pause automated handoffs, review the full drift report, and refresh or rebaseline after approval."
    };
  }

  /**
   * @param {Record<string, unknown>} snapshot
   * @param {Record<string, unknown>} currentPayload
   */
  function createAgentControlPlaneSnapshotDiffPayload(snapshot, currentPayload) {
    const snapshotPayload = toControlPlaneRecord(snapshot.payload);
    const metricDeltas = createAgentControlPlaneMetricDeltas(snapshotPayload, currentPayload);
    const readiness = createAgentControlPlaneCollectionDrift(
      getControlPlaneList(snapshotPayload, "readiness"),
      getControlPlaneList(currentPayload, "readiness"),
      {
        getKey: (item) => toText(item.projectId) || toText(item.projectName),
        describe: describeControlPlaneReadinessItem,
        hasChanged: (before, current) => hasControlPlaneFieldDrift(before, current, ["status", "score", "nextStep"]),
        describeChange: (before, current) => `${toText(current.projectName) || toText(before.projectName) || "Project"}: ${toText(before.status) || "needs-prep"} (${toNumber(before.score)}/100) -> ${toText(current.status) || "needs-prep"} (${toNumber(current.score)}/100)`
      }
    );
    const executionRuns = createAgentControlPlaneCollectionDrift(
      getControlPlaneList(snapshotPayload, "executionRuns"),
      getControlPlaneList(currentPayload, "executionRuns"),
      {
        getKey: (item) => toText(item.id) || `${toText(item.projectId)}:${toText(item.title)}`,
        describe: describeControlPlaneRun,
        hasChanged: (before, current) => hasControlPlaneFieldDrift(before, current, ["status", "slaBreachedAt", "slaResolvedAt", "archivedAt"]),
        describeChange: (before, current) => `${toText(current.projectName) || toText(before.projectName) || "Project"}: ${toText(before.status) || "queued"} -> ${toText(current.status) || "queued"}`
      }
    );
    const slaLedger = createAgentControlPlaneCollectionDrift(
      getControlPlaneSlaLedgerItems(snapshotPayload),
      getControlPlaneSlaLedgerItems(currentPayload),
      {
        getKey: (item) => toText(item.id) || `${toText(item.projectId)}:${toText(item.title)}`,
        describe: describeControlPlaneSlaLedgerItem,
        hasChanged: (before, current) => hasControlPlaneFieldDrift(before, current, ["status", "breachState", "action", "resolutionCount", "escalationCount"]),
        describeChange: (before, current) => `${toText(current.projectName) || toText(before.projectName) || "Project"}: ${toText(before.breachState) || "open"} -> ${toText(current.breachState) || "open"}`
      }
    );
    const workOrderSnapshots = createAgentControlPlaneCollectionDrift(
      getControlPlaneList(snapshotPayload, "workOrderSnapshots"),
      getControlPlaneList(currentPayload, "workOrderSnapshots"),
      {
        getKey: (item) => toText(item.id) || toText(item.title),
        describe: describeControlPlaneSnapshotItem
      }
    );
    const slaLedgerSnapshots = createAgentControlPlaneCollectionDrift(
      getControlPlaneList(snapshotPayload, "slaLedgerSnapshots"),
      getControlPlaneList(currentPayload, "slaLedgerSnapshots"),
      {
        getKey: (item) => toText(item.id) || toText(item.title),
        describe: describeControlPlaneSnapshotItem
      }
    );
    const driftScore = metricDeltas.filter((item) => item.delta !== 0).length
      + readiness.addedCount + readiness.removedCount + readiness.changedCount
      + executionRuns.addedCount + executionRuns.removedCount + executionRuns.changedCount
      + slaLedger.addedCount + slaLedger.removedCount + slaLedger.changedCount
      + workOrderSnapshots.addedCount + workOrderSnapshots.removedCount + workOrderSnapshots.changedCount
      + slaLedgerSnapshots.addedCount + slaLedgerSnapshots.removedCount + slaLedgerSnapshots.changedCount;
    const diff = {
      generatedAt: new Date().toISOString(),
      snapshotId: toText(snapshot.id),
      snapshotTitle: toText(snapshot.title) || "Agent Control Plane",
      snapshotCreatedAt: toText(snapshot.createdAt),
      currentGeneratedAt: toText(currentPayload.generatedAt),
      hasDrift: driftScore > 0,
      driftScore,
      metricDeltas,
      readiness,
      executionRuns,
      slaLedger,
      workOrderSnapshots,
      slaLedgerSnapshots
    };
    const driftItems = createAgentControlPlaneStatusDriftItems(diff);
    const decision = getAgentControlPlaneSnapshotDriftDecision(driftItems.length);
    const payload = {
      ...diff,
      driftSeverity: decision.driftSeverity,
      recommendedAction: decision.recommendedAction,
      driftItems
    };

    return {
      ...payload,
      markdown: buildAgentControlPlaneSnapshotDiffMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} diff
   */
  function createAgentControlPlaneStatusDriftItems(diff) {
    const metricDeltas = Array.isArray(diff.metricDeltas) ? diff.metricDeltas : [];
    const metricItems = metricDeltas
      .map((item) => {
        const record = toControlPlaneRecord(item);
        const label = toText(record.label);
        return {
          field: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          label,
          before: toNumber(record.before),
          current: toNumber(record.current),
          delta: toNumber(record.delta)
        };
      })
      .filter((item) => item.label && item.delta !== 0);
    const collectionItems = [
      { field: "readiness", label: "Readiness", section: toControlPlaneRecord(diff.readiness) },
      { field: "execution-runs", label: "Execution Runs", section: toControlPlaneRecord(diff.executionRuns) },
      { field: "sla-ledger", label: "SLA Ledger", section: toControlPlaneRecord(diff.slaLedger) },
      { field: "work-order-snapshots", label: "Work Order Snapshots", section: toControlPlaneRecord(diff.workOrderSnapshots) },
      { field: "sla-ledger-snapshots", label: "SLA Ledger Snapshots", section: toControlPlaneRecord(diff.slaLedgerSnapshots) }
    ].map(({ field, label, section }) => {
      const delta = toNumber(section.addedCount) + toNumber(section.removedCount) + toNumber(section.changedCount);
      return {
        field,
        label,
        before: 0,
        current: delta,
        delta
      };
    }).filter((item) => item.delta !== 0);
    const items = [];
    const seenFields = new Set();
    for (const item of [...metricItems, ...collectionItems]) {
      if (seenFields.has(item.field)) continue;
      seenFields.add(item.field);
      items.push(item);
    }

    return items;
  }

  function createMissingAgentControlPlaneBaselineDiffPayload() {
    const diff = {
      generatedAt: new Date().toISOString(),
      snapshotId: "",
      snapshotTitle: "Agent Control Plane Baseline",
      snapshotCreatedAt: "",
      currentGeneratedAt: "",
      hasBaseline: false,
      hasDrift: false,
      driftScore: 0,
      driftSeverity: "missing-baseline",
      recommendedAction: "Save or mark an Agent Control Plane snapshot as baseline before using baseline-vs-live drift.",
      driftItems: [],
      metricDeltas: [],
      readiness: { addedCount: 0, removedCount: 0, changedCount: 0, added: [], removed: [], changed: [] },
      executionRuns: { addedCount: 0, removedCount: 0, changedCount: 0, added: [], removed: [], changed: [] },
      slaLedger: { addedCount: 0, removedCount: 0, changedCount: 0, added: [], removed: [], changed: [] },
      workOrderSnapshots: { addedCount: 0, removedCount: 0, changedCount: 0, added: [], removed: [], changed: [] },
      slaLedgerSnapshots: { addedCount: 0, removedCount: 0, changedCount: 0, added: [], removed: [], changed: [] }
    };
    const markdown = [
      "# Agent Control Plane Snapshot Drift",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      "Snapshot: Agent Control Plane Baseline (not set)",
      "Baseline selected: no",
      "Drift detected: no",
      "Drift score: 0",
      "Drift severity: missing-baseline",
      "Recommended action: Save or mark an Agent Control Plane snapshot as baseline before using baseline-vs-live drift.",
      "",
      "## Drift Fields",
      "- No non-zero drift fields.",
      "",
      "## Action Required",
      "- Save or mark an Agent Control Plane snapshot as baseline before using baseline-vs-live drift."
    ].join("\n");

    return {
      ...diff,
      markdown
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildAgentControlPlaneBaselineStatusMarkdown(payload) {
    const lines = [
      "# Agent Control Plane Baseline Status",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Baseline selected: ${payload.hasBaseline ? "yes" : "no"}`
    ];

    if (!payload.hasBaseline) {
      lines.push(`Baseline snapshot ID: ${toText(payload.baselineSnapshotId) || "not set"}`);
      lines.push(`Freshness: ${toText(payload.baselineFreshness) || "missing"}`);
      lines.push(`Health: ${toText(payload.health) || "missing"}`);
      lines.push(`Recommended action: ${toText(payload.recommendedAction) || "Save or mark an Agent Control Plane snapshot as baseline."}`);
      lines.push(`Drift severity: ${toText(payload.driftSeverity) || "missing-baseline"}`);
      lines.push(`Drift action: ${toText(payload.driftRecommendedAction) || "Save or mark an Agent Control Plane snapshot as baseline before using baseline-vs-live drift."}`);
      return lines.join("\n");
    }

    lines.push(`Snapshot: ${toText(payload.snapshotTitle) || "Agent Control Plane"} (${toText(payload.baselineSnapshotId)})`);
    lines.push(`Snapshot created: ${toText(payload.snapshotCreatedAt) || "not recorded"}`);
    lines.push(`Freshness: ${toText(payload.baselineFreshness) || "fresh"} (${toNumber(payload.baselineAgeHours)}h old, threshold ${toNumber(payload.baselineFreshnessThresholdHours)}h)`);
    lines.push(`Health: ${toText(payload.health) || "healthy"}`);
    lines.push(`Recommended action: ${toText(payload.recommendedAction) || "Continue monitoring baseline freshness and drift."}`);
    lines.push(`Drift detected: ${payload.hasDrift ? "yes" : "no"}`);
    lines.push(`Drift score: ${toNumber(payload.driftScore)}`);
    lines.push(`Drift severity: ${toText(payload.driftSeverity) || "none"}`);
    lines.push(`Drift action: ${toText(payload.driftRecommendedAction) || "No snapshot drift detected; continue monitoring the control plane."}`);
    lines.push("");
    lines.push("## Drift Summary");

    const diff = toControlPlaneRecord(payload.diff);
    const metricDeltas = Array.isArray(diff.metricDeltas) ? diff.metricDeltas : [];
    if (metricDeltas.length) {
      for (const item of metricDeltas) {
        const record = toControlPlaneRecord(item);
        lines.push(`- ${toText(record.label)}: ${toNumber(record.before)} -> ${toNumber(record.current)} (${toNumber(record.delta) >= 0 ? "+" : ""}${toNumber(record.delta)})`);
      }
    } else {
      lines.push("- No metric deltas available.");
    }

    const driftItems = Array.isArray(payload.driftItems) ? payload.driftItems : [];
    lines.push("", "## Drift Fields");
    if (driftItems.length) {
      for (const item of driftItems) {
        const record = toControlPlaneRecord(item);
        lines.push(`- ${toText(record.label)}: ${toNumber(record.before)} -> ${toNumber(record.current)} (${toNumber(record.delta) >= 0 ? "+" : ""}${toNumber(record.delta)})`);
      }
    } else {
      lines.push("- No non-zero baseline drift fields.");
    }

    return lines.join("\n");
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {ReturnType<typeof buildGovernanceSnapshot>} governance
   * @param {{ dataSourcesAccessGate?: Record<string, unknown> | null, dataSourcesAccessReviewQueue?: Record<string, unknown> | null, dataSourcesAccessValidationRunbook?: Record<string, unknown> | null, releaseBuildGate?: Record<string, unknown> | null }} options
   */
  function createAgentControlPlaneBaselineStatusPayload(persisted, governance, options = {}) {
    const baselineSnapshotId = toText(persisted.agentControlPlaneBaselineSnapshotId);
    const snapshots = Array.isArray(persisted.agentControlPlaneSnapshots) ? persisted.agentControlPlaneSnapshots.map(toControlPlaneRecord) : [];
    const snapshot = baselineSnapshotId ? snapshots.find((item) => toText(item.id) === baselineSnapshotId) : null;

    if (!snapshot) {
      const health = getAgentControlPlaneBaselineHealth(false, "missing", 0);
      const payload = {
        generatedAt: new Date().toISOString(),
        hasBaseline: false,
        baselineSnapshotId,
        snapshotTitle: "",
        snapshotCreatedAt: "",
        baselineAgeHours: 0,
        baselineFreshness: "missing",
        baselineFreshnessThresholdHours: AGENT_CONTROL_PLANE_BASELINE_STALE_HOURS,
        health: health.health,
        recommendedAction: health.recommendedAction,
        hasDrift: false,
        driftScore: 0,
        driftSeverity: "missing-baseline",
        driftRecommendedAction: "Save or mark an Agent Control Plane snapshot as baseline before using baseline-vs-live drift.",
        driftItems: [],
        diff: null
      };

      return {
        ...payload,
        markdown: buildAgentControlPlaneBaselineStatusMarkdown(payload)
      };
    }

    const currentPayload = createAgentControlPlanePayload(governance, {
      limit: Number(snapshot.limit || 24),
      dataSourcesAccessGate: options.dataSourcesAccessGate || null,
      dataSourcesAccessReviewQueue: options.dataSourcesAccessReviewQueue || null,
      dataSourcesAccessValidationRunbook: options.dataSourcesAccessValidationRunbook || null,
      releaseBuildGate: options.releaseBuildGate || null
    });
    const diff = createAgentControlPlaneSnapshotDiffPayload(snapshot, currentPayload);
    const baselineFreshness = getAgentControlPlaneBaselineFreshness(snapshot.createdAt);
    const driftItems = createAgentControlPlaneStatusDriftItems(diff);
    const health = getAgentControlPlaneBaselineHealth(true, baselineFreshness.baselineFreshness, diff.driftScore);
    const payload = {
      generatedAt: new Date().toISOString(),
      hasBaseline: true,
      baselineSnapshotId: toText(snapshot.id),
      snapshotTitle: toText(snapshot.title) || "Agent Control Plane",
      snapshotCreatedAt: toText(snapshot.createdAt),
      baselineAgeHours: baselineFreshness.baselineAgeHours,
      baselineFreshness: baselineFreshness.baselineFreshness,
      baselineFreshnessThresholdHours: baselineFreshness.baselineFreshnessThresholdHours,
      health: health.health,
      recommendedAction: health.recommendedAction,
      hasDrift: diff.hasDrift,
      driftScore: diff.driftScore,
      driftSeverity: toText(diff.driftSeverity) || "none",
      driftRecommendedAction: toText(diff.recommendedAction) || "No snapshot drift detected; continue monitoring the control plane.",
      driftItems,
      diff
    };

    return {
      ...payload,
      markdown: buildAgentControlPlaneBaselineStatusMarkdown(payload)
    };
  }

  /**
   * @param {ReturnType<typeof buildGovernanceSnapshot>} governance
   * @param {Record<string, unknown>} [payload]
   * @param {{ dataSourcesAccessGate?: Record<string, unknown> | null, dataSourcesAccessReviewQueue?: Record<string, unknown> | null, dataSourcesAccessValidationRunbook?: Record<string, unknown> | null, releaseBuildGate?: Record<string, unknown> | null }} options
   */
  function createAgentControlPlaneSnapshotRecord(governance, payload = {}, options = {}) {
    const controlPlane = createAgentControlPlanePayload(governance, {
      limit: Number(payload.limit || 24),
      dataSourcesAccessGate: options.dataSourcesAccessGate || null,
      dataSourcesAccessReviewQueue: options.dataSourcesAccessReviewQueue || null,
      dataSourcesAccessValidationRunbook: options.dataSourcesAccessValidationRunbook || null,
      releaseBuildGate: options.releaseBuildGate || null
    });

    return {
      id: createId("agent-control-plane-snapshot"),
      title: String(payload.title || "Agent Control Plane").trim() || "Agent Control Plane",
      limit: controlPlane.limit,
      totalWorkOrders: controlPlane.workOrders.total,
      totalExecutionRuns: controlPlane.executionRuns.length,
      totalSlaLedgerRecords: controlPlane.slaLedger.total,
      totalSlaLedgerSnapshots: controlPlane.slaLedgerSnapshots.length,
      deploymentSmokeCheckCount: toNumber(controlPlane.summary?.deploymentSmokeCheckCount),
      deploymentSmokeCheckPassCount: toNumber(controlPlane.summary?.deploymentSmokeCheckPassCount),
      deploymentSmokeCheckFailCount: toNumber(controlPlane.summary?.deploymentSmokeCheckFailCount),
      deploymentLatestSmokeCheckStatus: toText(controlPlane.summary?.deploymentLatestSmokeCheckStatus),
      deploymentLatestSmokeCheckAt: toText(controlPlane.summary?.deploymentLatestSmokeCheckAt),
      deploymentSmokeChecks: controlPlane.deploymentSmokeChecks,
      releaseCheckpointCount: toNumber(controlPlane.summary?.releaseCheckpointCount),
      releaseLatestCheckpointStatus: toText(controlPlane.summary?.releaseLatestCheckpointStatus),
      releaseLatestCheckpointAt: toText(controlPlane.summary?.releaseLatestCheckpointAt),
      releaseCheckpoints: controlPlane.releaseCheckpoints,
      releaseBuildGateDecision: toText(controlPlane.releaseBuildGate?.decision) || toText(controlPlane.summary?.releaseBuildGateDecision) || "not-evaluated",
      releaseBuildGateRiskScore: toNumber(controlPlane.releaseBuildGate?.riskScore || controlPlane.summary?.releaseBuildGateRiskScore),
      releaseBuildGateReasonCount: toNumber(controlPlane.summary?.releaseBuildGateReasonCount),
      releaseBuildGateActionCount: toNumber(controlPlane.summary?.releaseBuildGateActionCount),
      releaseBuildGate: controlPlane.releaseBuildGate,
      releaseControlTaskCount: toNumber(controlPlane.summary?.releaseControlTaskCount),
      releaseControlOpenTaskCount: toNumber(controlPlane.summary?.releaseControlOpenTaskCount),
      releaseControlClosedTaskCount: toNumber(controlPlane.summary?.releaseControlClosedTaskCount),
      releaseControlTasks: controlPlane.releaseControlTasks,
      agentControlPlaneDecisionTaskCount: toNumber(controlPlane.summary?.agentControlPlaneDecisionTaskCount),
      agentControlPlaneDecisionOpenTaskCount: toNumber(controlPlane.summary?.agentControlPlaneDecisionOpenTaskCount),
      agentControlPlaneDecisionClosedTaskCount: toNumber(controlPlane.summary?.agentControlPlaneDecisionClosedTaskCount),
      agentControlPlaneDecisionTasks: controlPlane.agentControlPlaneDecisionTasks,
      agentControlPlaneDecisionTaskLedgerSnapshotCount: toNumber(controlPlane.summary?.agentControlPlaneDecisionTaskLedgerSnapshotCount),
      agentControlPlaneDecisionTaskLedgerSnapshots: controlPlane.agentControlPlaneDecisionTaskLedgerSnapshots,
      dataSourcesGateDecision: toText(controlPlane.dataSourcesAccessGate?.decision) || "not-evaluated",
      dataSourcesReview: toNumber(controlPlane.dataSourcesAccessGate?.review),
      dataSourcesBlocked: toNumber(controlPlane.dataSourcesAccessGate?.blocked),
      dataSourcesAccessGate: controlPlane.dataSourcesAccessGate,
      dataSourcesAccessReviewQueueCount: toNumber(controlPlane.dataSourcesAccessReviewQueue?.summary?.total),
      dataSourcesAccessReviewQueue: controlPlane.dataSourcesAccessReviewQueue,
      dataSourcesAccessValidationMethodCount: toNumber(controlPlane.dataSourcesAccessValidationRunbook?.summary?.methodCount),
      dataSourcesAccessValidationSourceCount: toNumber(controlPlane.dataSourcesAccessValidationRunbook?.summary?.sourceCount),
      dataSourcesAccessValidationRunbook: controlPlane.dataSourcesAccessValidationRunbook,
      dataSourcesAccessValidationEvidenceCount: toNumber(controlPlane.summary?.dataSourcesAccessValidationEvidenceCount),
      dataSourcesAccessValidationEvidenceValidatedCount: toNumber(controlPlane.summary?.dataSourcesAccessValidationEvidenceValidatedCount),
      dataSourcesAccessValidationEvidenceCoverageCount: toNumber(controlPlane.summary?.dataSourcesAccessValidationEvidenceCoverageCount),
      dataSourcesAccessValidationEvidenceCoverageCoveredCount: toNumber(controlPlane.summary?.dataSourcesAccessValidationEvidenceCoverageCoveredCount),
      dataSourcesAccessValidationEvidenceCoverageMissingCount: toNumber(controlPlane.summary?.dataSourcesAccessValidationEvidenceCoverageMissingCount),
      dataSourcesAccessValidationEvidenceCoverageHighPriorityCount: toNumber(controlPlane.summary?.dataSourcesAccessValidationEvidenceCoverageHighPriorityCount),
      dataSourcesAccessValidationEvidenceCoveragePercent: toNumber(controlPlane.summary?.dataSourcesAccessValidationEvidenceCoveragePercent),
      dataSourcesAccessValidationEvidenceCoverage: controlPlane.dataSourcesAccessValidationEvidenceCoverage,
      dataSourceAccessValidationEvidenceSnapshotCount: toNumber(controlPlane.summary?.dataSourceAccessValidationEvidenceSnapshotCount),
      dataSourceAccessValidationEvidence: controlPlane.dataSourceAccessValidationEvidence,
      dataSourceAccessValidationEvidenceSnapshots: controlPlane.dataSourceAccessValidationEvidenceSnapshots,
      summary: controlPlane.summary,
      markdown: controlPlane.markdown,
      payload: controlPlane,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * @param {Record<string, unknown> | undefined} profile
   */
  function createProfileSnapshot(profile) {
    if (!profile) {
      return null;
    }

    return {
      owner: toText(profile.owner),
      status: toText(profile.status),
      lifecycle: toText(profile.lifecycle),
      tier: toText(profile.tier),
      targetState: toText(profile.targetState),
      summary: toText(profile.summary)
    };
  }

  /**
   * @param {Record<string, unknown>} project
   */
  function createBootstrapProfilePayload(project) {
    const zone = toText(project.zone);
    const qualityScore = toNumber(project.qualityScore);

    return {
      projectId: toText(project.id),
      projectName: toText(project.name),
      owner: "",
      status: zone === "archived" ? "watch" : "active",
      lifecycle: zone === "archived" ? "sunset" : qualityScore >= 70 ? "stabilizing" : "active",
      tier: zone === "workspace" ? "core" : zone === "active" ? "important" : "supporting",
      targetState: zone === "archived" ? "archive" : qualityScore >= 75 ? "scale" : "stabilize",
      summary: "Bootstrapped from the governance gap registry. Review ownership, lifecycle, and target state."
    };
  }

  /**
   * @param {{
   *   projectProfiles?: Array<Record<string, unknown>>,
   *   projectProfileHistory?: Array<Record<string, unknown>>
   * }} current
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
  function applyProjectProfileUpsert(current, payload) {
    const projectId = String(payload.projectId || "").trim();
    const projectName = String(payload.projectName || "").trim();
    const nextProfile = {
      id: `profile-${projectId}`,
      projectId,
      projectName,
      owner: String(payload.owner || "").trim(),
      status: String(payload.status || "unassigned").trim() || "unassigned",
      lifecycle: String(payload.lifecycle || "active").trim() || "active",
      tier: String(payload.tier || "supporting").trim() || "supporting",
      targetState: String(payload.targetState || "stabilize").trim() || "stabilize",
      summary: String(payload.summary || "").trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const profiles = Array.isArray(current.projectProfiles) ? current.projectProfiles : [];
    const existingProfile = profiles.find((profile) => profile.projectId === projectId);
    const previousSnapshot = createProfileSnapshot(existingProfile);
    const nextSnapshot = createProfileSnapshot(nextProfile);
    const changedFields = existingProfile
      ? Object.keys(nextSnapshot).filter((field) => previousSnapshot?.[field] !== nextSnapshot[field])
      : ["owner", "status", "lifecycle", "tier", "targetState", "summary"];

    const upsertedProfile = existingProfile
      ? {
          ...existingProfile,
          ...nextProfile,
          createdAt: existingProfile.createdAt || nextProfile.createdAt,
          updatedAt: new Date().toISOString()
        }
      : nextProfile;

    const profileHistoryEntry = changedFields.length
      ? {
          id: createId("profile-history"),
          projectId,
          projectName,
          changeType: existingProfile ? "updated" : "created",
          changedFields,
          previous: previousSnapshot,
          next: createProfileSnapshot(upsertedProfile),
          changedAt: upsertedProfile.updatedAt
        }
      : null;

    const profileHistory = Array.isArray(current.projectProfileHistory) ? current.projectProfileHistory : [];

    return {
      store: {
        ...current,
        projectProfiles: [
          upsertedProfile,
          ...profiles.filter((profile) => profile.projectId !== projectId)
        ],
        projectProfileHistory: profileHistoryEntry
          ? [profileHistoryEntry, ...profileHistory]
          : profileHistory
      },
      profile: upsertedProfile,
      historyEntry: profileHistoryEntry,
      created: !existingProfile
    };
  }

  async function getSourcesPayload() {
    const persisted = await store.readStore();
    if (persisted.sources.length) {
      return persisted.sources;
    }

    try {
      const raw = await readFile(sourcesFile, "utf8");
      const legacySources = JSON.parse(raw);
      await store.updateStore((current) => ({
        ...current,
        sources: legacySources
      }));
      return legacySources;
    } catch {
      const defaultSources = [{ type: "local", path: resolvedRootDir }];
      await store.updateStore((current) => ({
        ...current,
        sources: defaultSources
      }));
      return defaultSources;
    }
  }

  /**
   * @param {Record<string, unknown>} source
   */
  function getSourceValue(source) {
    return toText(source.path) || toText(source.url) || toText(source.value);
  }

  /**
   * @param {Record<string, unknown>} source
   * @param {number} index
   */
  function getSourceRecordId(source, index) {
    return toText(source.id) || `source-${index + 1}`;
  }

  /**
   * @param {Record<string, unknown>} source
   * @param {string} type
   * @param {string} value
   * @param {string} health
   * @param {string} status
   */
  function createSourceAccessProfile(source, type, value, health, status) {
    const normalizedValue = value.toLowerCase();
    const sourceHost = (() => {
      try {
        return new URL(value).hostname.toLowerCase();
      } catch {
        return "";
      }
    })();
    const isSsh = /^git@|^ssh:\/\//i.test(value);
    const isUncPath = /^\\\\/.test(value);
    const isLocal = type === "local" || (value && !/^https?:\/\//i.test(value) && !isSsh);
    const profile = {
      accessLevel: "unknown",
      accessMethod: "review-required",
      requiresReview: health !== "ready",
      passwordLikely: false,
      tokenLikely: false,
      certificateLikely: false,
      sshKeyLikely: false,
      credentialHints: [],
      notes: [],
      secretPolicy: "Do not store passwords, tokens, private keys, or certificates in this app. Store only access-method metadata and use the OS credential manager, SSH agent, provider OAuth, or provider vaults for secrets."
    };

    if (!value) {
      profile.accessLevel = "missing";
      profile.notes.push("No source path or URL is configured, so access cannot be evaluated.");
      return profile;
    }

    if (isLocal) {
      profile.accessLevel = health === "ready" ? "filesystem-ready" : "filesystem-review";
      profile.accessMethod = isUncPath ? "network-filesystem" : "local-filesystem";
      profile.passwordLikely = isUncPath;
      profile.requiresReview = profile.requiresReview || isUncPath;
      profile.credentialHints.push("OS user permissions");
      if (isUncPath) {
        profile.credentialHints.push("network share credentials");
        profile.credentialHints.push("VPN or domain access if the share is restricted");
        profile.notes.push("UNC/network paths may require domain credentials or VPN access before scanning.");
      } else {
        profile.notes.push("Local paths rely on the current OS account having read access.");
      }
      if (status === "unreachable") {
        profile.notes.push("The path is currently unreachable from this workspace.");
      }
      return profile;
    }

    if (type === "github" || sourceHost === "github.com" || normalizedValue.includes("github.com")) {
      profile.accessLevel = "repository-access-unknown";
      profile.accessMethod = isSsh ? "git-ssh" : "git-https";
      profile.requiresReview = true;
      profile.sshKeyLikely = isSsh;
      profile.tokenLikely = !isSsh;
      profile.credentialHints.push(isSsh ? "SSH private key loaded in ssh-agent" : "Git Credential Manager, OAuth session, or personal access token for private repositories");
      profile.notes.push("Public repositories may be readable without credentials; private repositories require GitHub authorization.");
      profile.notes.push("Do not paste GitHub tokens into the source URL.");
      return profile;
    }

    if (type === "vercel" || sourceHost.endsWith("vercel.app") || normalizedValue.includes("vercel.com")) {
      profile.accessLevel = "deployment-or-project-access";
      profile.accessMethod = "provider-token-or-oauth";
      profile.requiresReview = true;
      profile.tokenLikely = true;
      profile.passwordLikely = true;
      profile.credentialHints.push("Vercel account or team membership");
      profile.credentialHints.push("Vercel API token for project metadata");
      profile.credentialHints.push("temporary share link for protected deployments");
      profile.notes.push("Protected Vercel deployments may require provider authentication or a time-limited share link.");
      return profile;
    }

    if (type === "supabase" || sourceHost.endsWith("supabase.co")) {
      profile.accessLevel = "backend-project-access";
      profile.accessMethod = "provider-token-or-database-credentials";
      profile.requiresReview = true;
      profile.tokenLikely = true;
      profile.passwordLikely = true;
      profile.certificateLikely = true;
      profile.credentialHints.push("Supabase account or project membership");
      profile.credentialHints.push("anon/service role keys in provider vaults, not in this registry");
      profile.credentialHints.push("database password and SSL certificate settings for direct database access");
      profile.notes.push("Direct database inspection can require SSL settings or certificates depending on the project policy.");
      return profile;
    }

    if (["lovable", "claude", "gemini", "chatgpt"].includes(type)) {
      profile.accessLevel = "workspace-session-access";
      profile.accessMethod = "browser-session-or-manual-export";
      profile.requiresReview = true;
      profile.passwordLikely = true;
      profile.credentialHints.push("provider account session");
      profile.credentialHints.push("workspace membership");
      profile.credentialHints.push("manual export or stable share link when available");
      profile.notes.push("AI workspace sources usually require an authenticated browser session or manual export rather than direct API scanning.");
      return profile;
    }

    profile.accessLevel = "remote-access-unknown";
    profile.accessMethod = "url-review";
    profile.requiresReview = true;
    profile.tokenLikely = /^https?:\/\//i.test(value);
    profile.credentialHints.push("provider-specific account access");
    profile.credentialHints.push("token, OAuth, certificate, or VPN access if the source is private");
    profile.notes.push("Remote sources need provider-specific access review before automated ingestion.");
    if (source.authRequired === true) {
      profile.notes.push("This source is marked as requiring authentication.");
    }
    return profile;
  }

  /**
   * @param {Record<string, unknown>} source
   * @param {number} index
   */
  async function createSourceHealthRecord(source, index) {
    const type = toText(source.type) || "local";
    const value = getSourceValue(source);
    const isLocal = type === "local" || (value && !/^https?:\/\//i.test(value));
    let status = "registered";
    let health = "review";
    let issue = "";
    let resolvedPath = "";

    if (!value) {
      status = "missing";
      health = "blocked";
      issue = "No source path or URL is configured.";
    } else if (isLocal) {
      resolvedPath = resolve(value);
      try {
        const sourceStat = await stat(resolvedPath);
        status = sourceStat.isDirectory() ? "reachable" : "file";
        health = sourceStat.isDirectory() ? "ready" : "review";
        issue = sourceStat.isDirectory() ? "" : "Local source points to a file instead of a folder.";
      } catch {
        status = "unreachable";
        health = "blocked";
        issue = "Local source path is not reachable from this workspace.";
      }
    } else {
      try {
        const parsedUrl = new URL(value);
        status = "registered";
        health = ["http:", "https:"].includes(parsedUrl.protocol) ? "ready" : "review";
        issue = health === "ready" ? "" : "Remote source URL uses an unexpected protocol.";
      } catch {
        status = "invalid-url";
        health = "blocked";
        issue = "Remote source URL is invalid.";
      }
    }

    return {
      id: getSourceRecordId(source, index),
      type,
      label: toText(source.label) || `${type.toUpperCase()} Source`,
      value,
      path: isLocal ? value : "",
      url: isLocal ? "" : value,
      resolvedPath,
      status,
      health,
      issue,
      access: createSourceAccessProfile(source, type, value, health, status),
      addedAt: toText(source.addedAt),
      lastCheckedAt: new Date().toISOString()
    };
  }

  /**
   * @param {{ generatedAt: string, summary: Record<string, unknown>, sources: Array<Record<string, unknown>> }} payload
   */
  function buildSourcesSummaryMarkdown(payload) {
    const lines = [
      "# Data Sources Summary",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Sources: ${toNumber(payload.summary.total)}`,
      `Ready: ${toNumber(payload.summary.ready)}`,
      `Review: ${toNumber(payload.summary.review)}`,
      `Blocked: ${toNumber(payload.summary.blocked)}`,
      "",
      "## Sources"
    ];

    for (const source of payload.sources) {
      lines.push(`- ${toText(source.label) || toText(source.type) || "Source"}: ${toText(source.health) || "review"} / ${toText(source.status) || "registered"} (${toText(source.value) || "no value"})`);
      const access = toControlPlaneRecord(source.access);
      if (toText(access.accessMethod)) {
        lines.push(`  Access: ${toText(access.accessMethod)}${access.requiresReview ? " (review required)" : ""}`);
      }
      if (toText(source.issue)) {
        lines.push(`  Issue: ${toText(source.issue)}`);
      }
    }

    if (!payload.sources.length) {
      lines.push("- No sources configured.");
    }

    return lines.join("\n");
  }

  async function createSourcesSummaryPayload() {
    const sources = await getSourcesPayload();
    const records = await Promise.all(sources.map((source, index) => createSourceHealthRecord(toControlPlaneRecord(source), index)));
    const typeCounts = records.reduce((counts, source) => ({
      ...counts,
      [source.type]: (counts[source.type] || 0) + 1
    }), {});
    const summary = {
      total: records.length,
      ready: records.filter((source) => source.health === "ready").length,
      review: records.filter((source) => source.health === "review").length,
      blocked: records.filter((source) => source.health === "blocked").length,
      local: records.filter((source) => source.type === "local").length,
      remote: records.filter((source) => source.type !== "local").length,
      typeCounts
    };
    const payload = {
      generatedAt: new Date().toISOString(),
      summary,
      sources: records
    };
    return {
      ...payload,
      markdown: buildSourcesSummaryMarkdown(payload)
    };
  }

  /**
   * @param {string} host
   */
  function isLocalOrPrivateHost(host) {
    const normalized = host.toLowerCase();
    if (!normalized) return false;
    if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(normalized)) return true;
    if (normalized.startsWith("10.")) return true;
    if (normalized.startsWith("192.168.")) return true;
    const private172 = normalized.match(/^172\.(\d+)\./);
    return private172 ? Number(private172[1]) >= 16 && Number(private172[1]) <= 31 : false;
  }

  /**
   * @param {string} value
   */
  function normalizeHttpUrl(value) {
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol)) return "";
      return url.toString();
    } catch {
      return "";
    }
  }

  /**
   * @param {string} url
   * @param {string} type
   */
  function detectDeploymentProvider(url, type) {
    const normalizedType = toText(type).toLowerCase();
    const host = (() => {
      try {
        return new URL(url).hostname.toLowerCase();
      } catch {
        return "";
      }
    })();
    if (normalizedType === "vercel" || host.endsWith("vercel.app") || host === "vercel.com" || host.endsWith(".vercel.com")) return "vercel";
    if (normalizedType === "lovable" || host.includes("lovable")) return "lovable";
    if (normalizedType === "supabase" || host.endsWith("supabase.co")) return "supabase";
    if (host.endsWith("netlify.app")) return "netlify";
    if (host.endsWith("pages.dev")) return "cloudflare-pages";
    if (host.endsWith("github.io")) return "github-pages";
    return normalizedType && !["local", "github", "claude", "gemini", "chatgpt"].includes(normalizedType) ? normalizedType : "";
  }

  /**
   * @param {Record<string, unknown>} source
   */
  function createDeploymentTargetFromSource(source) {
    const record = toControlPlaneRecord(source);
    const url = normalizeHttpUrl(toText(record.url) || toText(record.value));
    if (!url) return null;
    const provider = detectDeploymentProvider(url, toText(record.type));
    if (!provider) return null;
    const host = new URL(url).hostname.toLowerCase();
    return {
      id: `deployment-target:${toText(record.id) || host}`,
      sourceId: toText(record.id),
      label: toText(record.label) || host,
      provider,
      url,
      host,
      sourceHealth: toText(record.health) || "review",
      sourceStatus: toText(record.status) || "registered",
      accessMethod: toText(toControlPlaneRecord(record.access).accessMethod) || "url-review",
      protectedLikely: Boolean(toControlPlaneRecord(record.access).requiresReview),
      secretPolicy: "Deployment smoke checks only store URL, HTTP status, latency, and error class. Do not store passwords, tokens, private keys, certificates, cookies, or response bodies."
    };
  }

  /**
   * @param {Array<unknown>} items
   */
  function normalizeDeploymentSmokeChecks(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => {
        const record = toControlPlaneRecord(item);
        const url = normalizeHttpUrl(toText(record.url));
        const host = toText(record.host) || (() => {
          try {
            return url ? new URL(url).hostname : "";
          } catch {
            return "";
          }
        })();
        const status = toText(record.status) === "pass" || record.ok === true ? "pass" : "fail";
        return {
          id: toText(record.id),
          targetId: toText(record.targetId),
          sourceId: toText(record.sourceId),
          label: toText(record.label) || host || "Deployment smoke check",
          provider: toText(record.provider) || detectDeploymentProvider(url, "") || "custom",
          url,
          host,
          status,
          ok: status === "pass",
          httpStatus: toNumber(record.httpStatus),
          statusText: toText(record.statusText),
          contentType: toText(record.contentType),
          latencyMs: toNumber(record.latencyMs),
          timeoutMs: toNumber(record.timeoutMs),
          error: toText(record.error),
          checkedAt: toText(record.checkedAt),
          secretPolicy: toText(record.secretPolicy) || "No response body, credentials, tokens, cookies, private keys, certificates, or browser-session data was captured.",
          markdown: toText(record.markdown)
        };
      })
      .filter((item) => item.id && (item.url || item.label))
      .sort((left, right) => new Date(toText(right.checkedAt)).getTime() - new Date(toText(left.checkedAt)).getTime());
  }

  /**
   * @param {Array<Record<string, unknown>>} smokeChecks
   */
  function createDeploymentSmokeCheckSummary(smokeChecks) {
    const latest = smokeChecks[0] || null;
    return {
      total: smokeChecks.length,
      pass: smokeChecks.filter((item) => toText(item.status) === "pass").length,
      fail: smokeChecks.filter((item) => toText(item.status) === "fail").length,
      latestStatus: toText(latest?.status),
      latestCheckedAt: toText(latest?.checkedAt),
      latestTarget: toText(latest?.label) || toText(latest?.host)
    };
  }

  /**
   * @param {{ generatedAt: string, summary: Record<string, unknown>, smokeChecks: Array<Record<string, unknown>> }} payload
   */
  function buildDeploymentSmokeChecksMarkdown(payload) {
    const lines = [
      "# Deployment Smoke Check Ledger",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Smoke checks: ${toNumber(payload.summary.total)}`,
      `Pass/fail: ${toNumber(payload.summary.pass)}/${toNumber(payload.summary.fail)}`,
      `Latest: ${toText(payload.summary.latestStatus) || "none"} ${toText(payload.summary.latestCheckedAt) || ""}`.trim(),
      "",
      "Secret policy: Smoke checks capture URL, HTTP status, content type, latency, and error class only. They never store passwords, tokens, private keys, certificates, cookies, browser sessions, or response bodies.",
      "",
      "## Recent Checks"
    ];

    if (!payload.smokeChecks.length) {
      lines.push("- No deployment smoke checks recorded yet.");
      return lines.join("\n");
    }

    for (const smokeCheck of payload.smokeChecks.slice(0, 50)) {
      lines.push(`- ${toText(smokeCheck.label) || toText(smokeCheck.host) || "Deployment"}: ${toText(smokeCheck.status) || "fail"} HTTP ${toNumber(smokeCheck.httpStatus) || "unreachable"} (${toNumber(smokeCheck.latencyMs)}ms)`);
      lines.push(`  URL: ${toText(smokeCheck.url) || "not recorded"}`);
      lines.push(`  Provider: ${toText(smokeCheck.provider) || "custom"}`);
      lines.push(`  Checked: ${toText(smokeCheck.checkedAt) || "not recorded"}`);
      if (toText(smokeCheck.error)) {
        lines.push(`  Error class: ${toText(smokeCheck.error)}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * @param {Record<string, unknown>} [persisted]
   * @param {{ limit?: number }} [options]
   */
  function createDeploymentSmokeChecksPayload(persisted = {}, options = {}) {
    const requestedLimit = Number(options.limit || 100);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(200, Math.floor(requestedLimit)))
      : 100;
    const smokeChecks = normalizeDeploymentSmokeChecks(persisted.deploymentSmokeChecks).slice(0, limit);
    const payload = {
      generatedAt: new Date().toISOString(),
      summary: createDeploymentSmokeCheckSummary(smokeChecks),
      smokeChecks
    };
    return {
      ...payload,
      markdown: buildDeploymentSmokeChecksMarkdown(payload)
    };
  }

  /**
   * @param {Array<unknown>} items
   */
  function normalizeReleaseCheckpoints(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => {
        const record = toControlPlaneRecord(item);
        return {
          id: toText(record.id),
          title: toText(record.title) || "Release checkpoint",
          status: toText(record.status) || "review",
          branch: toText(record.branch),
          commit: toText(record.commit),
          commitShort: toText(record.commitShort),
          commitMessage: toText(record.commitMessage),
          dirty: Boolean(record.dirty),
          changedFileCount: toNumber(record.changedFileCount),
          deploymentStatus: toText(record.deploymentStatus),
          deploymentSmokeCheckCount: toNumber(record.deploymentSmokeCheckCount),
          deploymentSmokeCheckPassCount: toNumber(record.deploymentSmokeCheckPassCount),
          deploymentSmokeCheckFailCount: toNumber(record.deploymentSmokeCheckFailCount),
          validationStatus: toText(record.validationStatus),
          latestScanAt: toText(record.latestScanAt),
          notes: toText(record.notes),
          markdown: toText(record.markdown),
          createdAt: toText(record.createdAt)
        };
      })
      .filter((item) => item.id)
      .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime());
  }

  /**
   * @param {string} command
   * @param {string} cwd
   * @returns {Promise<{ ok: boolean, stdout: string, error: string }>}
   */
  function runReleaseCommand(command, cwd) {
    return new Promise((resolveCommand) => {
      try {
        exec(command, { cwd, windowsHide: true, timeout: 5000 }, (error, stdout, stderr) => {
          resolveCommand({
            ok: !error,
            stdout: String(stdout || "").trim(),
            error: error ? String(stderr || error.message || "Command failed").trim() : ""
          });
        });
      } catch (error) {
        resolveCommand({
          ok: false,
          stdout: "",
          error: error instanceof Error ? error.message : "Command failed"
        });
      }
    });
  }

  async function getGitReleaseState() {
    const inside = await runReleaseCommand("git rev-parse --is-inside-work-tree", resolvedPublicDir);
    if (!inside.ok || inside.stdout !== "true") {
      return {
        available: false,
        branch: "",
        commit: "",
        commitShort: "",
        commitMessage: "",
        dirty: false,
        changedFileCount: 0,
        error: inside.error || "Git repository not available from the app directory."
      };
    }

    const [branch, commit, commitShort, commitMessage, status] = await Promise.all([
      runReleaseCommand("git rev-parse --abbrev-ref HEAD", resolvedPublicDir),
      runReleaseCommand("git rev-parse HEAD", resolvedPublicDir),
      runReleaseCommand("git rev-parse --short HEAD", resolvedPublicDir),
      runReleaseCommand("git log -1 --pretty=%s", resolvedPublicDir),
      runReleaseCommand("git status --short", resolvedPublicDir)
    ]);
    const changedFiles = status.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return {
      available: true,
      branch: branch.stdout,
      commit: commit.stdout,
      commitShort: commitShort.stdout,
      commitMessage: commitMessage.stdout,
      dirty: changedFiles.length > 0,
      changedFileCount: changedFiles.length,
      changedFiles: changedFiles.slice(0, 25),
      error: [branch, commit, commitShort, commitMessage, status].map((result) => result.error).filter(Boolean).join(" | ")
    };
  }

  /**
   * @param {{ generatedAt: string, summary: Record<string, unknown>, git: Record<string, unknown>, latestSmokeCheck: Record<string, unknown> | null, checkpoints: Array<Record<string, unknown>> }} payload
   */
  function buildReleaseSummaryMarkdown(payload) {
    const lines = [
      "# Release Control Ledger",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Release status: ${toText(payload.summary.status) || "review"}`,
      `Git: ${toText(payload.git.commitShort) || "unavailable"} ${toText(payload.git.branch) || ""}`.trim(),
      `Dirty files: ${toNumber(payload.git.changedFileCount)}`,
      `Deployment smoke checks: ${toNumber(payload.summary.deploymentSmokeCheckPassCount)} pass / ${toNumber(payload.summary.deploymentSmokeCheckFailCount)} fail / ${toNumber(payload.summary.deploymentSmokeCheckCount)} total`,
      `Release checkpoints: ${toNumber(payload.summary.releaseCheckpointCount)}`,
      "",
      "Secret policy: Release checkpoints store non-secret commit, status, deployment smoke-check, and validation metadata only. Do not store credentials, tokens, private keys, certificates, cookies, or response bodies.",
      "",
      "## Current Release"
    ];
    lines.push(`- Branch: ${toText(payload.git.branch) || "unavailable"}`);
    lines.push(`- Commit: ${toText(payload.git.commitShort) || "unavailable"} ${toText(payload.git.commitMessage) || ""}`.trim());
    lines.push(`- Working tree: ${payload.git.dirty ? `${toNumber(payload.git.changedFileCount)} changed file(s)` : "clean or unavailable"}`);
    const latestSmokeCheck = toControlPlaneRecord(payload.latestSmokeCheck);
    lines.push(`- Latest deployment smoke: ${toText(latestSmokeCheck.status) || "none"} HTTP ${toNumber(latestSmokeCheck.httpStatus) || "unreachable"} at ${toText(latestSmokeCheck.checkedAt) || "not recorded"}`);
    lines.push(`- Latest scan: ${toText(payload.summary.latestScanAt) || "not recorded"}`);

    lines.push("", "## Checkpoints");
    if (!payload.checkpoints.length) {
      lines.push("- No release checkpoints recorded yet.");
    } else {
      for (const checkpoint of payload.checkpoints.slice(0, 10)) {
        lines.push(`- ${toText(checkpoint.title) || "Release checkpoint"}: ${toText(checkpoint.status) || "review"} (${toText(checkpoint.commitShort) || "no-commit"})`);
      }
    }

    return lines.join("\n");
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildReleaseCheckpointDriftMarkdown(payload) {
    const lines = [
      "# Release Checkpoint Drift",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Checkpoint: ${toText(payload.snapshotTitle) || "none"}`,
      `Drift severity: ${toText(payload.driftSeverity) || "missing-checkpoint"}`,
      `Drift score: ${toNumber(payload.driftScore)}`,
      `Recommended action: ${toText(payload.recommendedAction)}`,
      "",
      "Secret policy: Release checkpoint drift stores non-secret commit, status, smoke-check, and validation metadata only. Do not store credentials, tokens, private keys, certificates, cookies, or response bodies.",
      "",
      "## Drift Fields"
    ];

    const driftItems = Array.isArray(payload.driftItems) ? payload.driftItems : [];
    if (!driftItems.length) {
      lines.push("- No release checkpoint drift detected.");
    } else {
      for (const item of driftItems.slice(0, 12)) {
        const record = toControlPlaneRecord(item);
        lines.push(`- ${toText(record.label) || toText(record.field) || "Release field"}: ${toText(record.before) || "none"} -> ${toText(record.current) || "none"} (${toText(record.severity) || "review"})`);
      }
    }

    return lines.join("\n");
  }

  function createMissingReleaseCheckpointDriftPayload() {
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: false,
      snapshotId: "",
      snapshotTitle: "",
      snapshotCreatedAt: "",
      hasDrift: false,
      driftScore: 0,
      driftSeverity: "missing-checkpoint",
      recommendedAction: "Save a release checkpoint before comparing release drift.",
      driftItems: [],
      checkpoint: null,
      live: null
    };
    return {
      ...payload,
      markdown: buildReleaseCheckpointDriftMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} checkpoint
   * @param {{ generatedAt: string, summary: Record<string, unknown>, git: Record<string, unknown>, latestSmokeCheck: Record<string, unknown> | null }} release
   */
  function createReleaseCheckpointDriftPayload(checkpoint, release) {
    const liveSmokeCheck = toControlPlaneRecord(release.latestSmokeCheck);
    const live = {
      status: toText(release.summary.status) || "review",
      branch: toText(release.git.branch),
      commit: toText(release.git.commit),
      commitShort: toText(release.git.commitShort),
      commitMessage: toText(release.git.commitMessage),
      dirty: Boolean(release.git.dirty),
      changedFileCount: toNumber(release.git.changedFileCount),
      deploymentStatus: toText(liveSmokeCheck.status) || "not-checked",
      deploymentSmokeCheckCount: toNumber(release.summary.deploymentSmokeCheckCount),
      deploymentSmokeCheckPassCount: toNumber(release.summary.deploymentSmokeCheckPassCount),
      deploymentSmokeCheckFailCount: toNumber(release.summary.deploymentSmokeCheckFailCount),
      validationStatus: toText(release.summary.validationStatus),
      latestScanAt: toText(release.summary.latestScanAt)
    };
    const fieldSpecs = [
      { field: "status", label: "Release status", before: toText(checkpoint.status) || "review", current: live.status, severity: live.status === "hold" ? "high" : "medium" },
      { field: "branch", label: "Git branch", before: toText(checkpoint.branch), current: live.branch, severity: "medium" },
      { field: "commit-short", label: "Git commit", before: toText(checkpoint.commitShort), current: live.commitShort, severity: "medium" },
      { field: "dirty", label: "Working tree", before: Boolean(checkpoint.dirty) ? "dirty" : "clean", current: live.dirty ? "dirty" : "clean", severity: live.dirty ? "high" : "medium" },
      { field: "changed-file-count", label: "Changed files", before: String(toNumber(checkpoint.changedFileCount)), current: String(live.changedFileCount), severity: live.changedFileCount > 0 ? "high" : "low" },
      { field: "deployment-status", label: "Deployment smoke status", before: toText(checkpoint.deploymentStatus) || "not-checked", current: live.deploymentStatus, severity: live.deploymentStatus === "fail" ? "high" : "medium" },
      { field: "deployment-smoke-checks", label: "Deployment smoke checks", before: String(toNumber(checkpoint.deploymentSmokeCheckCount)), current: String(live.deploymentSmokeCheckCount), severity: "low" },
      { field: "deployment-smoke-fails", label: "Deployment smoke failures", before: String(toNumber(checkpoint.deploymentSmokeCheckFailCount)), current: String(live.deploymentSmokeCheckFailCount), severity: live.deploymentSmokeCheckFailCount > 0 ? "high" : "medium" },
      { field: "validation-status", label: "Validation status", before: toText(checkpoint.validationStatus), current: live.validationStatus, severity: live.validationStatus === "scan-missing" ? "medium" : "low" },
      { field: "latest-scan-at", label: "Latest scan", before: toText(checkpoint.latestScanAt), current: live.latestScanAt, severity: "low" }
    ];
    const driftItems = fieldSpecs
      .filter((item) => toText(item.before) !== toText(item.current))
      .map((item) => ({
        ...item,
        before: toText(item.before),
        current: toText(item.current)
      }));
    const driftScore = driftItems.length;
    const hasHigh = driftItems.some((item) => item.severity === "high");
    const hasMedium = driftItems.some((item) => item.severity === "medium");
    const driftSeverity = !driftScore
      ? "none"
      : hasHigh
        ? "high"
        : hasMedium || driftScore >= 3
          ? "medium"
          : "low";
    const recommendedAction = !driftScore
      ? "No release checkpoint drift detected. Continue monitoring before the next build pass."
      : driftSeverity === "high"
        ? "Hold release until high-severity release drift fields are reviewed and resolved."
        : "Review the listed release drift fields before the next supervised build pass.";
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: true,
      snapshotId: toText(checkpoint.id),
      snapshotTitle: toText(checkpoint.title) || "Release checkpoint",
      snapshotCreatedAt: toText(checkpoint.createdAt),
      hasDrift: driftScore > 0,
      driftScore,
      driftSeverity,
      recommendedAction,
      driftItems,
      checkpoint,
      live
    };
    return {
      ...payload,
      markdown: buildReleaseCheckpointDriftMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {string} checkpointId
   */
  async function createReleaseCheckpointDriftPayloadFromPersisted(persisted, checkpointId = "latest") {
    const checkpoints = normalizeReleaseCheckpoints(persisted.releaseCheckpoints);
    const checkpoint = checkpointId === "latest"
      ? checkpoints[0]
      : checkpoints.find((item) => toText(item.id) === checkpointId);
    if (!checkpoint) {
      return createMissingReleaseCheckpointDriftPayload();
    }
    return createReleaseCheckpointDriftPayload(checkpoint, await createReleaseSummaryPayload(persisted));
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildReleaseBuildGateMarkdown(payload) {
    const lines = [
      "# Release Build Gate",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Decision: ${toText(payload.decision) || "review"}`,
      `Risk score: ${toNumber(payload.riskScore)}`,
      `Recommended action: ${toText(payload.recommendedAction)}`,
      "",
      "Secret policy: Release build gate stores non-secret Git, checkpoint, deployment smoke, and validation metadata only. Do not store credentials, tokens, private keys, certificates, cookies, or response bodies.",
      "",
      "## Gate Reasons"
    ];

    const reasons = Array.isArray(payload.reasons) ? payload.reasons : [];
    if (!reasons.length) {
      lines.push("- No release build gate blockers detected.");
    } else {
      for (const reason of reasons.slice(0, 20)) {
        const record = toControlPlaneRecord(reason);
        lines.push(`- ${toText(record.code) || "release-gate"} (${toText(record.severity) || "review"}): ${toText(record.message) || "Review release gate evidence."}`);
      }
    }

    lines.push("", "## Gate Actions");
    const actions = Array.isArray(payload.actions) ? payload.actions : [];
    if (!actions.length) {
      lines.push("- No release build gate actions required.");
    } else {
      for (const action of actions.slice(0, 20)) {
        const record = toControlPlaneRecord(action);
        lines.push(`- ${toText(record.label) || toText(record.id) || "Release gate action"} (${toText(record.priority) || "medium"}): ${toText(record.description) || "Review release gate evidence."}`);
        if (toText(record.commandHint)) {
          lines.push(`  Command hint: ${toText(record.commandHint)}`);
        }
      }
    }

    return lines.join("\n");
  }

  /**
   * @param {Array<{ code: string, label: string, message: string, severity: "low" | "medium" | "high" }>} reasons
   */
  function createReleaseBuildGateActions(reasons) {
    const hasReason = (code) => reasons.some((reason) => reason.code === code);
    const actions = [];
    if (hasReason("git-dirty")) {
      actions.push({
        id: "commit-or-stash-local-changes",
        label: "Commit or isolate local changes",
        priority: "high",
        status: "open",
        description: "Commit validated milestone changes or isolate unrelated edits before treating the release gate as ready.",
        commandHint: "git status --short"
      });
    }
    if (hasReason("deployment-smoke-failing")) {
      actions.push({
        id: "review-deployment-smoke-failures",
        label: "Review deployment smoke failures",
        priority: "high",
        status: "open",
        description: "Inspect failed deployment smoke checks and resolve the target, access, or runtime issue before continuing.",
        commandHint: "Open Data Sources deployment health and rerun the smoke check."
      });
    }
    if (hasReason("deployment-smoke-missing")) {
      actions.push({
        id: "run-deployment-smoke-check",
        label: "Run deployment smoke check",
        priority: "medium",
        status: "open",
        description: "Record at least one non-secret deployment smoke check before treating the release gate as ready.",
        commandHint: "Use the Sources deployment-health smoke-check action."
      });
    }
    if (hasReason("validation-scan-missing")) {
      actions.push({
        id: "run-workspace-audit-scan",
        label: "Run workspace audit scan",
        priority: "medium",
        status: "open",
        description: "Regenerate audit evidence so the release gate has a current validation scan.",
        commandHint: "node .\\generate-audit.mjs"
      });
    }
    if (hasReason("release-checkpoint-missing") || hasReason("release-drift-checkpoint-missing")) {
      actions.push({
        id: "save-release-checkpoint",
        label: "Save release checkpoint",
        priority: "medium",
        status: "open",
        description: "Save a non-secret release checkpoint after current validation is complete so future drift can be compared.",
        commandHint: "Use the Governance Release Control Save Checkpoint action."
      });
    }
    if (hasReason("release-drift-high") || hasReason("release-drift-medium") || hasReason("release-drift-low")) {
      actions.push({
        id: "review-release-checkpoint-drift",
        label: "Review release checkpoint drift",
        priority: hasReason("release-drift-high") ? "high" : "medium",
        status: "open",
        description: "Review release checkpoint drift fields and decide whether to save a new checkpoint or resolve the changed evidence.",
        commandHint: "Use Copy Drift from the Governance Release Control deck."
      });
    }
    if (hasReason("git-unavailable")) {
      actions.push({
        id: "verify-git-runtime-access",
        label: "Verify Git runtime access",
        priority: "medium",
        status: "open",
        description: "Confirm the live app process can inspect the repository before relying on release gate Git evidence.",
        commandHint: "git rev-parse --is-inside-work-tree"
      });
    }
    if (!actions.length) {
      actions.push({
        id: "continue-local-build-pass",
        label: "Continue local build pass",
        priority: "low",
        status: "ready",
        description: "No release gate actions are required before the next local build pass.",
        commandHint: ""
      });
    }
    return actions;
  }

  /**
   * @param {Record<string, unknown>} action
   * @param {Record<string, unknown>} releaseBuildGate
   */
  function createReleaseBuildGateActionTask(action, releaseBuildGate) {
    const actionId = toText(action.id) || createId("release-build-gate-action");
    const label = toText(action.label) || actionId;
    const commandHint = toText(action.commandHint);
    const priority = toText(action.priority) === "high" ? "high" : toText(action.priority) === "medium" ? "medium" : "low";
    const descriptionLines = [
      `Release build gate decision: ${toText(releaseBuildGate.decision) || "review"}`,
      `Release build gate risk score: ${toNumber(releaseBuildGate.riskScore)}`,
      `Action: ${label}`,
      `Action status: ${toText(action.status) || "open"}`,
      `Action priority: ${priority}`,
      `Description: ${toText(action.description) || "Review release build gate evidence before continuing."}`,
      commandHint ? `Command hint: ${commandHint}` : "",
      "Secret policy: Record only non-secret release-control evidence. Do not store credentials, provider tokens, cookies, certificates, or private keys in this task."
    ].filter(Boolean);

    return {
      id: createId("task"),
      projectId: "release-control",
      projectName: "Release Control",
      title: `Release gate action: ${label}`,
      description: descriptionLines.join("\n"),
      priority,
      status: "open",
      releaseBuildGateActionId: actionId,
      releaseBuildGateActionStatus: toText(action.status) || "open",
      releaseBuildGateActionPriority: priority,
      releaseBuildGateDecision: toText(releaseBuildGate.decision) || "review",
      releaseBuildGateRiskScore: toNumber(releaseBuildGate.riskScore),
      releaseBuildGateReasonCount: Array.isArray(releaseBuildGate.reasons) ? releaseBuildGate.reasons.length : 0,
      releaseBuildGateCommandHint: commandHint,
      secretPolicy: "non-secret-release-control-evidence-only",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function getAgentControlPlaneDecisionReasonCommandHint(code) {
    const reasonCode = toText(code);
    if (reasonCode === "baseline-missing" || reasonCode === "baseline-stale") {
      return "Use Refresh control plane baseline after validating the current Agent Control Plane.";
    }
    if (reasonCode.startsWith("baseline-drift")) {
      return "Use Copy baseline control plane drift and decide whether to refresh or remediate the changed fields.";
    }
    if (reasonCode.startsWith("release-build-gate") || reasonCode === "release-control-open-tasks") {
      return "Open Governance Release Control and resolve release-gate blockers before continuing.";
    }
    if (reasonCode.startsWith("data-sources")) {
      return "Open Data Sources Access in Governance and complete the non-secret validation or task evidence.";
    }
    if (reasonCode.includes("sla") || reasonCode.includes("stale-active")) {
      return "Open Agent Execution Queue and resolve stale or SLA-breached runs.";
    }
    return "Review the Agent Control Plane decision handoff and record non-secret remediation evidence.";
  }

  /**
   * @param {Record<string, unknown>} reason
   * @param {Record<string, unknown>} decision
   */
  function createAgentControlPlaneDecisionReasonTask(reason, decision) {
    const reasonCode = toText(reason.code) || createId("control-plane-decision-reason");
    const severity = toText(reason.severity) || "review";
    const priority = severity === "hold" || severity === "high"
      ? "high"
      : severity === "review" || severity === "medium"
        ? "medium"
        : "low";
    const message = toText(reason.message) || "Review the Agent Control Plane decision reason.";
    const commandHint = getAgentControlPlaneDecisionReasonCommandHint(reasonCode);
    const descriptionLines = [
      `Control Plane decision: ${toText(decision.decision) || "review"}`,
      `Decision recommended action: ${toText(decision.recommendedAction) || "Review the Agent Control Plane before continuing."}`,
      `Reason code: ${reasonCode}`,
      `Reason severity: ${severity}`,
      `Reason: ${message}`,
      `Command hint: ${commandHint}`,
      "Secret policy: Record only non-secret Control Plane remediation evidence. Do not store credentials, provider tokens, cookies, certificates, private keys, or browser-session data in this task."
    ];

    return {
      id: createId("task"),
      projectId: "agent-control-plane",
      projectName: "Agent Control Plane",
      title: `Control Plane decision: ${reasonCode}`,
      description: descriptionLines.join("\n"),
      priority,
      status: "open",
      agentControlPlaneDecisionReasonCode: reasonCode,
      agentControlPlaneDecisionReasonSeverity: severity,
      agentControlPlaneDecision: toText(decision.decision) || "review",
      agentControlPlaneRecommendedAction: toText(decision.recommendedAction),
      agentControlPlaneCommandHint: commandHint,
      secretPolicy: "non-secret-control-plane-remediation-evidence-only",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildAgentControlPlaneDecisionTaskLedgerMarkdown(payload) {
    const summary = toControlPlaneRecord(payload.summary);
    const items = Array.isArray(payload.items) ? payload.items : [];
    const lines = [
      "# Agent Control Plane Decision Task Ledger",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Status filter: ${toText(payload.status) || "all"}`,
      `Secret policy: ${toText(payload.secretPolicy) || "Non-secret Control Plane decision task metadata only."}`,
      "",
      "## Summary",
      `- Total tasks: ${toNumber(summary.total)}`,
      `- Open tasks: ${toNumber(summary.open)}`,
      `- Closed tasks: ${toNumber(summary.closed)}`,
      `- Visible tasks: ${toNumber(summary.visible)}`,
      `- Unique reasons: ${toNumber(summary.reasonCount)}`,
      `- Priority split: ${toNumber(summary.high)} high / ${toNumber(summary.medium)} medium / ${toNumber(summary.low)} low / ${toNumber(summary.normal)} normal`,
      "",
      "## Tasks"
    ];

    if (items.length) {
      for (const item of items) {
        const record = toControlPlaneRecord(item);
        lines.push(`- ${toText(record.priority) || "normal"} ${toText(record.status) || "open"}: ${toText(record.title) || toText(record.agentControlPlaneDecisionReasonCode) || "Control Plane decision task"}`);
        lines.push(`  Reason: ${toText(record.agentControlPlaneDecisionReasonCode) || "control-plane-decision"} | Severity: ${toText(record.agentControlPlaneDecisionReasonSeverity) || "review"} | Decision: ${toText(record.agentControlPlaneDecision) || "review"}`);
        if (toText(record.agentControlPlaneCommandHint)) {
          lines.push(`  Command hint: ${toText(record.agentControlPlaneCommandHint)}`);
        }
        if (toText(record.agentControlPlaneRecommendedAction)) {
          lines.push(`  Recommended action: ${toText(record.agentControlPlaneRecommendedAction)}`);
        }
        lines.push(`  Updated: ${toText(record.updatedAt) || toText(record.createdAt) || "not recorded"} | Secret policy: ${toText(record.secretPolicy) || "non-secret-control-plane-remediation-evidence-only"}`);
      }
    } else {
      lines.push("- No Agent Control Plane decision tasks match the current filter.");
    }

    return lines.join("\n");
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {{ status?: string, limit?: number }} [options]
   */
  function createAgentControlPlaneDecisionTaskLedgerPayload(persisted, options = {}) {
    const requestedStatus = toText(options.status) || "all";
    const status = ["all", "open", "closed"].includes(requestedStatus) ? requestedStatus : "all";
    const requestedLimit = Number(options.limit || 100);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(250, Math.trunc(requestedLimit)))
      : 100;
    const decisionTasks = (Array.isArray(persisted.tasks) ? persisted.tasks : [])
      .filter((task) => toText(task.agentControlPlaneDecisionReasonCode) || toText(task.projectId) === "agent-control-plane")
      .map((task) => {
        const record = toControlPlaneRecord(task);
        return {
          id: toText(record.id),
          title: toText(record.title) || `Control Plane decision: ${toText(record.agentControlPlaneDecisionReasonCode) || "review"}`,
          status: toText(record.status) || "open",
          priority: toText(record.priority) || "normal",
          projectId: toText(record.projectId) || "agent-control-plane",
          projectName: toText(record.projectName) || "Agent Control Plane",
          agentControlPlaneDecisionReasonCode: toText(record.agentControlPlaneDecisionReasonCode),
          agentControlPlaneDecisionReasonSeverity: toText(record.agentControlPlaneDecisionReasonSeverity) || "review",
          agentControlPlaneDecision: toText(record.agentControlPlaneDecision) || "review",
          agentControlPlaneRecommendedAction: toText(record.agentControlPlaneRecommendedAction),
          agentControlPlaneCommandHint: toText(record.agentControlPlaneCommandHint),
          description: toText(record.description),
          secretPolicy: toText(record.secretPolicy) || "non-secret-control-plane-remediation-evidence-only",
          createdAt: toText(record.createdAt),
          updatedAt: toText(record.updatedAt || record.createdAt)
        };
      })
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime());

    const openTasks = decisionTasks.filter((task) => !isGovernanceClosedStatus(task.status));
    const closedTasks = decisionTasks.filter((task) => isGovernanceClosedStatus(task.status));
    const visibleTasks = status === "open"
      ? openTasks
      : status === "closed"
        ? closedTasks
        : decisionTasks;
    const decisionCounts = {};
    const reasonCodes = new Set();
    for (const task of decisionTasks) {
      const decision = toText(task.agentControlPlaneDecision) || "review";
      decisionCounts[decision] = toNumber(decisionCounts[decision]) + 1;
      const reasonCode = toText(task.agentControlPlaneDecisionReasonCode);
      if (reasonCode) reasonCodes.add(reasonCode);
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      status,
      limit,
      secretPolicy: "Non-secret Agent Control Plane decision task metadata only. Resolve credentials, provider tokens, cookies, private keys, certificates, and browser sessions outside this app.",
      summary: {
        total: decisionTasks.length,
        open: openTasks.length,
        closed: closedTasks.length,
        visible: Math.min(visibleTasks.length, limit),
        high: decisionTasks.filter((task) => task.priority === "high").length,
        medium: decisionTasks.filter((task) => task.priority === "medium").length,
        low: decisionTasks.filter((task) => task.priority === "low").length,
        normal: decisionTasks.filter((task) => !["high", "medium", "low"].includes(task.priority)).length,
        reasonCount: reasonCodes.size,
        decisionCounts
      },
      items: visibleTasks.slice(0, limit)
    };

    return {
      ...payload,
      markdown: buildAgentControlPlaneDecisionTaskLedgerMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {{ title?: string, status?: string, limit?: number }} [options]
   */
  function createAgentControlPlaneDecisionTaskLedgerSnapshotRecord(persisted, options = {}) {
    const ledger = createAgentControlPlaneDecisionTaskLedgerPayload(persisted, {
      status: toText(options.status) || "all",
      limit: Number(options.limit || 100)
    });

    return {
      id: createId("agent-control-plane-decision-task-ledger-snapshot"),
      title: toText(options.title) || "Agent Control Plane Decision Task Ledger",
      statusFilter: ledger.status,
      limit: ledger.limit,
      total: ledger.summary.total,
      openCount: ledger.summary.open,
      closedCount: ledger.summary.closed,
      visibleCount: ledger.summary.visible,
      reasonCount: ledger.summary.reasonCount,
      secretPolicy: ledger.secretPolicy,
      markdown: ledger.markdown,
      items: ledger.items,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildAgentControlPlaneDecisionTaskLedgerSnapshotDiffMarkdown(payload) {
    const formatDriftValue = (value) => typeof value === "number" ? String(value) : toText(value);
    const lines = [
      "# Agent Control Plane Decision Task Ledger Snapshot Drift",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Snapshot: ${toText(payload.snapshotTitle) || "missing"}`,
      `Drift severity: ${toText(payload.driftSeverity) || "none"}`,
      `Drift score: ${toNumber(payload.driftScore)}`,
      `Recommended action: ${toText(payload.recommendedAction) || "No action required."}`,
      "",
      "## Drift Items"
    ];

    const driftItems = Array.isArray(payload.driftItems) ? payload.driftItems : [];
    if (!driftItems.length) {
      lines.push("- No Agent Control Plane decision task ledger drift detected.");
      return lines.join("\n");
    }

    for (const item of driftItems) {
      const record = toControlPlaneRecord(item);
      lines.push(`- ${toText(record.label) || toText(record.field) || "Control Plane decision task drift"}: ${formatDriftValue(record.before)} -> ${formatDriftValue(record.current)}`);
    }

    return lines.join("\n");
  }

  function createMissingAgentControlPlaneDecisionTaskLedgerSnapshotDiffPayload() {
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: false,
      snapshotId: "",
      snapshotTitle: "",
      snapshotCreatedAt: "",
      hasDrift: false,
      driftScore: 0,
      driftSeverity: "missing-snapshot",
      recommendedAction: "Save an Agent Control Plane decision task ledger snapshot before comparing decision-task drift.",
      driftItems: [],
      liveSummary: null,
      snapshotSummary: null
    };
    return {
      ...payload,
      markdown: buildAgentControlPlaneDecisionTaskLedgerSnapshotDiffMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} snapshot
   * @param {ReturnType<typeof createAgentControlPlaneDecisionTaskLedgerPayload>} live
   */
  function createAgentControlPlaneDecisionTaskLedgerSnapshotDiffPayload(snapshot, live) {
    const driftItems = [];
    const snapshotSummary = {
      total: toNumber(snapshot.total),
      open: toNumber(snapshot.openCount),
      closed: toNumber(snapshot.closedCount),
      visible: toNumber(snapshot.visibleCount),
      reasonCount: toNumber(snapshot.reasonCount)
    };
    const liveSummary = toControlPlaneRecord(live.summary);
    const countFields = [
      { field: "total", label: "Total Control Plane decision tasks" },
      { field: "open", label: "Open Control Plane decision tasks" },
      { field: "closed", label: "Closed Control Plane decision tasks" },
      { field: "visible", label: "Visible Control Plane decision tasks" },
      { field: "reasonCount", label: "Unique Control Plane decision reasons" }
    ];

    for (const item of countFields) {
      const before = toNumber(snapshotSummary[item.field]);
      const current = toNumber(liveSummary[item.field]);
      if (before !== current) {
        driftItems.push({
          field: item.field,
          label: item.label,
          before,
          current,
          delta: current - before
        });
      }
    }

    const snapshotTasks = Array.isArray(snapshot.items) ? snapshot.items.map(toControlPlaneRecord) : [];
    const liveTasks = Array.isArray(live.items) ? live.items.map(toControlPlaneRecord) : [];
    const taskKey = (task) => toText(task.id) || toText(task.agentControlPlaneDecisionReasonCode) || toText(task.title);
    const snapshotByKey = new Map(snapshotTasks.map((task) => [taskKey(task), task]));
    const liveByKey = new Map(liveTasks.map((task) => [taskKey(task), task]));

    for (const [key, task] of liveByKey) {
      const previous = snapshotByKey.get(key);
      const label = toText(task.title) || toText(task.agentControlPlaneDecisionReasonCode) || key;
      if (!previous) {
        driftItems.push({
          field: `control-plane-decision-task:${key}`,
          label: `${label} added`,
          before: "missing",
          current: `${toText(task.status) || "open"} / ${toText(task.priority) || "normal"} / ${toText(task.agentControlPlaneDecisionReasonCode) || "control-plane-decision"}`,
          delta: 1
        });
        continue;
      }
      const beforeState = `${toText(previous.status) || "open"} / ${toText(previous.priority) || "normal"} / ${toText(previous.agentControlPlaneDecisionReasonCode) || "control-plane-decision"}`;
      const currentState = `${toText(task.status) || "open"} / ${toText(task.priority) || "normal"} / ${toText(task.agentControlPlaneDecisionReasonCode) || "control-plane-decision"}`;
      if (beforeState !== currentState) {
        driftItems.push({
          field: `control-plane-decision-task:${key}`,
          label,
          before: beforeState,
          current: currentState,
          delta: toText(previous.status) === toText(task.status) ? 0 : 1
        });
      }
    }

    for (const [key, task] of snapshotByKey) {
      if (!liveByKey.has(key)) {
        driftItems.push({
          field: `control-plane-decision-task:${key}`,
          label: `${toText(task.title) || toText(task.agentControlPlaneDecisionReasonCode) || key} removed`,
          before: `${toText(task.status) || "open"} / ${toText(task.priority) || "normal"} / ${toText(task.agentControlPlaneDecisionReasonCode) || "control-plane-decision"}`,
          current: "missing",
          delta: -1
        });
      }
    }

    const driftScore = driftItems.reduce((total, item) => total + Math.max(1, Math.abs(toNumber(item.delta))), 0);
    const openDelta = toNumber(liveSummary.open) - toNumber(snapshotSummary.open);
    const driftSeverity = !driftItems.length
      ? "none"
      : openDelta > 0
        ? "high"
        : driftScore >= 5
          ? "medium"
          : "low";
    const recommendedAction = driftSeverity === "high"
      ? "Review new open Agent Control Plane decision tasks before supervised build work."
      : driftSeverity === "medium"
        ? "Review Control Plane decision task drift and refresh the snapshot if changes are intentional."
        : driftSeverity === "low"
          ? "Monitor low Control Plane decision task drift and refresh the snapshot after confirmation."
          : "No Agent Control Plane decision task ledger drift detected.";
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: true,
      snapshotId: toText(snapshot.id),
      snapshotTitle: toText(snapshot.title) || "Agent Control Plane Decision Task Ledger",
      snapshotCreatedAt: toText(snapshot.createdAt),
      hasDrift: driftItems.length > 0,
      driftScore,
      driftSeverity,
      recommendedAction,
      driftItems,
      liveSummary,
      snapshotSummary
    };

    return {
      ...payload,
      markdown: buildAgentControlPlaneDecisionTaskLedgerSnapshotDiffMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildReleaseTaskLedgerMarkdown(payload) {
    const summary = toControlPlaneRecord(payload.summary);
    const items = Array.isArray(payload.items) ? payload.items : [];
    const lines = [
      "# Release Control Task Ledger",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Status filter: ${toText(payload.status) || "all"}`,
      `Secret policy: ${toText(payload.secretPolicy) || "Non-secret release-control task metadata only."}`,
      "",
      "## Summary",
      `- Total tasks: ${toNumber(summary.total)}`,
      `- Open tasks: ${toNumber(summary.open)}`,
      `- Closed tasks: ${toNumber(summary.closed)}`,
      `- Visible tasks: ${toNumber(summary.visible)}`,
      `- Priority split: ${toNumber(summary.high)} high / ${toNumber(summary.medium)} medium / ${toNumber(summary.low)} low / ${toNumber(summary.normal)} normal`,
      "",
      "## Tasks"
    ];

    if (items.length) {
      for (const item of items) {
        const record = toControlPlaneRecord(item);
        lines.push(`- ${toText(record.priority) || "normal"} ${toText(record.status) || "open"}: ${toText(record.title) || toText(record.releaseBuildGateActionId) || "Release control task"}`);
        lines.push(`  Release action: ${toText(record.releaseBuildGateActionId) || "release-control"} | Gate decision: ${toText(record.releaseBuildGateDecision) || "review"} | Risk: ${toNumber(record.releaseBuildGateRiskScore)}`);
        if (toText(record.releaseBuildGateCommandHint)) {
          lines.push(`  Command hint: ${toText(record.releaseBuildGateCommandHint)}`);
        }
        lines.push(`  Updated: ${toText(record.updatedAt) || toText(record.createdAt) || "not recorded"} | Secret policy: ${toText(record.secretPolicy) || "non-secret-release-control-evidence-only"}`);
      }
    } else {
      lines.push("- No Release Control tasks match the current filter.");
    }

    return lines.join("\n");
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {{ status?: string, limit?: number }} [options]
   */
  function createReleaseTaskLedgerPayload(persisted, options = {}) {
    const requestedStatus = toText(options.status) || "all";
    const status = ["all", "open", "closed"].includes(requestedStatus) ? requestedStatus : "all";
    const requestedLimit = Number(options.limit || 100);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(250, Math.trunc(requestedLimit)))
      : 100;
    const releaseTasks = (Array.isArray(persisted.tasks) ? persisted.tasks : [])
      .filter((task) => toText(task.releaseBuildGateActionId) || toText(task.projectId) === "release-control")
      .map((task) => {
        const record = toControlPlaneRecord(task);
        return {
          id: toText(record.id),
          title: toText(record.title) || `Release gate action: ${toText(record.releaseBuildGateActionId) || "Release control"}`,
          status: toText(record.status) || "open",
          priority: toText(record.priority) || "normal",
          projectId: toText(record.projectId) || "release-control",
          projectName: toText(record.projectName) || "Release Control",
          releaseBuildGateActionId: toText(record.releaseBuildGateActionId),
          releaseBuildGateActionStatus: toText(record.releaseBuildGateActionStatus),
          releaseBuildGateActionPriority: toText(record.releaseBuildGateActionPriority),
          releaseBuildGateDecision: toText(record.releaseBuildGateDecision) || "review",
          releaseBuildGateRiskScore: toNumber(record.releaseBuildGateRiskScore),
          releaseBuildGateReasonCount: toNumber(record.releaseBuildGateReasonCount),
          releaseBuildGateCommandHint: toText(record.releaseBuildGateCommandHint),
          description: toText(record.description),
          secretPolicy: toText(record.secretPolicy) || "non-secret-release-control-evidence-only",
          createdAt: toText(record.createdAt),
          updatedAt: toText(record.updatedAt || record.createdAt)
        };
      })
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime());

    const openTasks = releaseTasks.filter((task) => !isGovernanceClosedStatus(task.status));
    const closedTasks = releaseTasks.filter((task) => isGovernanceClosedStatus(task.status));
    const visibleTasks = status === "open"
      ? openTasks
      : status === "closed"
        ? closedTasks
        : releaseTasks;
    const payload = {
      generatedAt: new Date().toISOString(),
      status,
      limit,
      secretPolicy: "Non-secret release-control task metadata only. Resolve deployment credentials, provider tokens, cookies, private keys, and certificates outside this app.",
      summary: {
        total: releaseTasks.length,
        open: openTasks.length,
        closed: closedTasks.length,
        visible: Math.min(visibleTasks.length, limit),
        high: releaseTasks.filter((task) => task.priority === "high").length,
        medium: releaseTasks.filter((task) => task.priority === "medium").length,
        low: releaseTasks.filter((task) => task.priority === "low").length,
        normal: releaseTasks.filter((task) => !["high", "medium", "low"].includes(task.priority)).length
      },
      items: visibleTasks.slice(0, limit)
    };

    return {
      ...payload,
      markdown: buildReleaseTaskLedgerMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} persisted
   */
  async function createReleaseBuildGatePayload(persisted) {
    const releaseSummary = await createReleaseSummaryPayload(persisted);
    const releaseCheckpointDrift = await createReleaseCheckpointDriftPayloadFromPersisted(persisted, "latest");
    const summary = toControlPlaneRecord(releaseSummary.summary);
    const git = toControlPlaneRecord(releaseSummary.git);
    /** @type {Array<{ code: string, label: string, message: string, severity: "low" | "medium" | "high" }>} */
    const reasons = [];
    const addReason = (code, label, message, severity = "medium") => {
      reasons.push({ code, label, message, severity });
    };

    if (!git.available) {
      addReason("git-unavailable", "Git unavailable", "Git state is unavailable from the app runtime; review the local repository before continuing.", "medium");
    }
    if (git.dirty) {
      addReason("git-dirty", "Dirty worktree", `${toNumber(git.changedFileCount)} changed file(s) are present in the local working tree.`, "high");
    }
    if (toNumber(summary.deploymentSmokeCheckFailCount) > 0) {
      addReason("deployment-smoke-failing", "Deployment smoke failing", `${toNumber(summary.deploymentSmokeCheckFailCount)} deployment smoke check failure(s) are recorded.`, "high");
    }
    if (toNumber(summary.deploymentSmokeCheckCount) === 0) {
      addReason("deployment-smoke-missing", "Deployment smoke missing", "No deployment smoke checks are recorded for this release gate.", "medium");
    }
    if (toText(summary.validationStatus) === "scan-missing") {
      addReason("validation-scan-missing", "Validation scan missing", "No latest scan evidence is recorded in the release summary.", "medium");
    }
    if (toNumber(summary.releaseCheckpointCount) === 0) {
      addReason("release-checkpoint-missing", "Release checkpoint missing", "No saved release checkpoint exists for drift comparison.", "medium");
    }
    if (releaseCheckpointDrift.driftSeverity === "missing-checkpoint") {
      addReason("release-drift-checkpoint-missing", "Release drift checkpoint missing", "Release checkpoint drift cannot be evaluated until a checkpoint is saved.", "medium");
    } else if (releaseCheckpointDrift.driftSeverity === "high") {
      addReason("release-drift-high", "High release drift", "High-severity release checkpoint drift is present.", "high");
    } else if (releaseCheckpointDrift.driftSeverity === "medium") {
      addReason("release-drift-medium", "Medium release drift", "Medium-severity release checkpoint drift should be reviewed before continuing.", "medium");
    } else if (releaseCheckpointDrift.driftSeverity === "low") {
      addReason("release-drift-low", "Low release drift", "Low-severity release checkpoint drift is present.", "low");
    }
    if (toText(summary.status) === "hold" && !reasons.some((reason) => reason.severity === "high")) {
      addReason("release-summary-hold", "Release summary hold", "Release summary reports hold status.", "high");
    }
    if (toText(summary.status) === "review" && !reasons.length) {
      addReason("release-summary-review", "Release summary review", "Release summary reports review status.", "medium");
    }

    const riskScore = reasons.reduce((total, reason) => total + (reason.severity === "high" ? 3 : reason.severity === "medium" ? 2 : 1), 0);
    const decision = reasons.some((reason) => reason.severity === "high")
      ? "hold"
      : reasons.length
        ? "review"
        : "ready";
    const actions = createReleaseBuildGateActions(reasons);
    const recommendedAction = decision === "hold"
      ? "Hold unattended build work until high-severity release gate reasons are resolved."
      : decision === "review"
        ? "Review release gate reasons before continuing unattended build work."
        : "Release build gate is ready for the next local build pass.";
    const payload = {
      generatedAt: new Date().toISOString(),
      decision,
      riskScore,
      recommendedAction,
      reasons,
      actions,
      releaseSummary,
      releaseCheckpointDrift
    };
    return {
      ...payload,
      markdown: buildReleaseBuildGateMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   * @param {URL} requestUrl
   */
  async function bootstrapReleaseBuildGateLocalEvidence(payload, requestUrl) {
    const appUrl = normalizeHttpUrl(toText(payload.url) || `${requestUrl.protocol}//${requestUrl.host}/`);
    if (!appUrl) {
      throw new Error("A valid local app URL is required for release gate evidence bootstrap.");
    }
    const runSmokeCheck = payload.runSmokeCheck !== false;
    const saveCheckpoint = payload.saveCheckpoint !== false;
    const smokeLabel = toText(payload.label) || "Local Workspace Audit app";
    const checkpointTitle = toText(payload.title) || `Local release gate checkpoint ${new Date().toISOString()}`;
    const checkpointNotes = toText(payload.notes) || "Bootstrap local non-secret release gate evidence.";
    let current = await store.readStore();
    let smokeCheck = null;
    let checkpoint = null;

    if (runSmokeCheck) {
      smokeCheck = await createDeploymentSmokeCheck({
        url: appUrl,
        label: smokeLabel,
        allowLocal: true,
        timeoutMs: payload.timeoutMs || 8000
      });
      current = await store.updateStore((storeState) => appendGovernanceOperations({
        ...storeState,
        deploymentSmokeChecks: [smokeCheck, ...(Array.isArray(storeState.deploymentSmokeChecks) ? storeState.deploymentSmokeChecks : [])].slice(0, 100)
      }, [
        createGovernanceOperation(
          "release-build-gate-local-smoke-check-recorded",
          `Release build gate local smoke check ${smokeCheck.status} for ${smokeCheck.label}.`,
          {
            smokeCheckId: smokeCheck.id,
            label: smokeCheck.label,
            url: smokeCheck.url,
            status: smokeCheck.status,
            httpStatus: smokeCheck.httpStatus,
            latencyMs: smokeCheck.latencyMs
          }
        )
      ]));
    }

    if (saveCheckpoint) {
      checkpoint = await createReleaseCheckpointRecord(current, {
        title: checkpointTitle,
        status: toText(payload.status),
        notes: checkpointNotes
      });
      current = await store.updateStore((storeState) => appendGovernanceOperations({
        ...storeState,
        releaseCheckpoints: [checkpoint, ...(Array.isArray(storeState.releaseCheckpoints) ? storeState.releaseCheckpoints : [])].slice(0, 100)
      }, [
        createGovernanceOperation(
          "release-build-gate-local-checkpoint-recorded",
          `Release build gate local checkpoint ${checkpoint.status} for ${checkpoint.title}.`,
          {
            checkpointId: checkpoint.id,
            title: checkpoint.title,
            status: checkpoint.status,
            branch: checkpoint.branch,
            commit: checkpoint.commit,
            dirty: checkpoint.dirty,
            deploymentStatus: checkpoint.deploymentStatus,
            deploymentSmokeCheckCount: checkpoint.deploymentSmokeCheckCount,
            validationStatus: checkpoint.validationStatus
          }
        )
      ]));
    }

    return {
      success: true,
      smokeCheck,
      checkpoint,
      releaseBuildGate: await createReleaseBuildGatePayload(current)
    };
  }

  /**
   * @param {Record<string, unknown>} persisted
   */
  async function createReleaseSummaryPayload(persisted) {
    const smokeChecks = normalizeDeploymentSmokeChecks(persisted.deploymentSmokeChecks);
    const smokeSummary = createDeploymentSmokeCheckSummary(smokeChecks);
    const releaseCheckpoints = normalizeReleaseCheckpoints(persisted.releaseCheckpoints);
    const latestScan = Array.isArray(persisted.scanRuns) ? toControlPlaneRecord(persisted.scanRuns[0]) : {};
    const git = await getGitReleaseState();
    const status = !git.available
      ? "review"
      : git.dirty
        ? "review"
        : smokeSummary.fail > 0
          ? "hold"
          : smokeSummary.pass > 0
            ? "ready"
            : "review";
    const payload = {
      generatedAt: new Date().toISOString(),
      summary: {
        status,
        releaseCheckpointCount: releaseCheckpoints.length,
        deploymentSmokeCheckCount: smokeSummary.total,
        deploymentSmokeCheckPassCount: smokeSummary.pass,
        deploymentSmokeCheckFailCount: smokeSummary.fail,
        latestScanAt: toText(latestScan.generatedAt),
        validationStatus: toText(latestScan.generatedAt) ? "scan-recorded" : "scan-missing"
      },
      git,
      latestSmokeCheck: smokeChecks[0] || null,
      checkpoints: releaseCheckpoints
    };
    return {
      ...payload,
      markdown: buildReleaseSummaryMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {Record<string, unknown>} payload
   */
  async function createReleaseCheckpointRecord(persisted, payload = {}) {
    const release = await createReleaseSummaryPayload(persisted);
    const status = ["ready", "review", "hold"].includes(toText(payload.status)) ? toText(payload.status) : toText(release.summary.status) || "review";
    const title = toText(payload.title) || `Release checkpoint ${toText(release.git.commitShort) || new Date().toISOString()}`;
    return {
      id: createId("release-checkpoint"),
      title,
      status,
      branch: toText(release.git.branch),
      commit: toText(release.git.commit),
      commitShort: toText(release.git.commitShort),
      commitMessage: toText(release.git.commitMessage),
      dirty: Boolean(release.git.dirty),
      changedFileCount: toNumber(release.git.changedFileCount),
      deploymentStatus: toText(toControlPlaneRecord(release.latestSmokeCheck).status) || "not-checked",
      deploymentSmokeCheckCount: toNumber(release.summary.deploymentSmokeCheckCount),
      deploymentSmokeCheckPassCount: toNumber(release.summary.deploymentSmokeCheckPassCount),
      deploymentSmokeCheckFailCount: toNumber(release.summary.deploymentSmokeCheckFailCount),
      validationStatus: toText(release.summary.validationStatus),
      latestScanAt: toText(release.summary.latestScanAt),
      notes: toText(payload.notes),
      markdown: release.markdown,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * @param {Record<string, unknown>} target
   * @param {Array<Record<string, unknown>>} smokeChecks
   */
  function findLatestDeploymentSmokeCheckForTarget(target, smokeChecks) {
    const keys = new Set([
      toText(target.id),
      toText(target.sourceId),
      toText(target.url),
      toText(target.host)
    ].filter(Boolean));
    return smokeChecks.find((smokeCheck) => [
      toText(smokeCheck.targetId),
      toText(smokeCheck.sourceId),
      toText(smokeCheck.url),
      toText(smokeCheck.host)
    ].some((key) => keys.has(key))) || null;
  }

  /**
   * @param {{ generatedAt: string, summary: Record<string, unknown>, targets: Array<Record<string, unknown>>, recentSmokeChecks?: Array<Record<string, unknown>> }} payload
   */
  function buildDeploymentHealthMarkdown(payload) {
    const lines = [
      "# Deployment Health Targets",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Deployment targets: ${toNumber(payload.summary.total)}`,
      `Protected/review likely: ${toNumber(payload.summary.protectedLikely)}`,
      `Smoke checks: ${toNumber(payload.summary.checked)} checked, ${toNumber(payload.summary.pass)} pass, ${toNumber(payload.summary.fail)} fail`,
      "",
      "Secret policy: Smoke checks capture URL, HTTP status, latency, and error class only. Do not paste or store passwords, tokens, private keys, certificates, cookies, or response bodies.",
      "",
      "## Targets"
    ];

    if (!payload.targets.length) {
      lines.push("- No deployment targets detected in Data Sources.");
    } else {
      for (const target of payload.targets) {
        const latestSmokeCheck = toControlPlaneRecord(target.latestSmokeCheck);
        lines.push(`- ${toText(target.label) || toText(target.host) || "Deployment"}: ${toText(target.provider) || "deployment"} (${toText(target.url)})`);
        lines.push(`  Source: ${toText(target.sourceHealth) || "review"} / ${toText(target.sourceStatus) || "registered"}`);
        lines.push(`  Access: ${toText(target.accessMethod) || "url-review"}${target.protectedLikely ? " (review likely)" : ""}`);
        if (toText(latestSmokeCheck.id)) {
          lines.push(`  Latest smoke check: ${toText(latestSmokeCheck.status) || "fail"} HTTP ${toNumber(latestSmokeCheck.httpStatus) || "unreachable"} at ${toText(latestSmokeCheck.checkedAt) || "not recorded"}`);
        } else {
          lines.push("  Latest smoke check: not checked");
        }
      }
    }

    lines.push("", "## Recent Smoke Checks");
    const recentSmokeChecks = Array.isArray(payload.recentSmokeChecks) ? payload.recentSmokeChecks : [];
    if (!recentSmokeChecks.length) {
      lines.push("- No deployment smoke checks recorded yet.");
    } else {
      for (const smokeCheck of recentSmokeChecks.slice(0, 10)) {
        lines.push(`- ${toText(smokeCheck.label) || toText(smokeCheck.host) || "Deployment"}: ${toText(smokeCheck.status) || "fail"} HTTP ${toNumber(smokeCheck.httpStatus) || "unreachable"} (${toNumber(smokeCheck.latencyMs)}ms)`);
      }
    }

    return lines.join("\n");
  }

  async function createDeploymentHealthPayload() {
    const sourcesPayload = await createSourcesSummaryPayload();
    const persisted = await store.readStore();
    const smokeChecks = normalizeDeploymentSmokeChecks(persisted.deploymentSmokeChecks);
    const targets = (Array.isArray(sourcesPayload.sources) ? sourcesPayload.sources : [])
      .map((source) => createDeploymentTargetFromSource(toControlPlaneRecord(source)))
      .filter(Boolean);
    const enrichedTargets = targets.map((target) => ({
      ...target,
      latestSmokeCheck: findLatestDeploymentSmokeCheckForTarget(target, smokeChecks)
    }));
    const providerCounts = targets.reduce((counts, target) => ({
      ...counts,
      [toText(target.provider) || "deployment"]: (counts[toText(target.provider) || "deployment"] || 0) + 1
    }), {});
    const smokeSummary = createDeploymentSmokeCheckSummary(smokeChecks);
    const payload = {
      generatedAt: new Date().toISOString(),
      summary: {
        total: enrichedTargets.length,
        protectedLikely: enrichedTargets.filter((target) => target.protectedLikely).length,
        targetChecked: enrichedTargets.filter((target) => target.latestSmokeCheck).length,
        checked: smokeSummary.total,
        pass: smokeSummary.pass,
        fail: smokeSummary.fail,
        unknown: Math.max(0, enrichedTargets.length - enrichedTargets.filter((target) => target.latestSmokeCheck).length),
        latestCheckedAt: smokeSummary.latestCheckedAt,
        latestStatus: smokeSummary.latestStatus,
        providerCounts
      },
      targets: enrichedTargets,
      recentSmokeChecks: smokeChecks.slice(0, 25)
    };

    return {
      ...payload,
      markdown: buildDeploymentHealthMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  async function createDeploymentSmokeCheck(payload) {
    const targetId = toText(payload.targetId);
    const explicitUrl = toText(payload.url);
    const allowLocal = payload.allowLocal === true;
    const deployments = await createDeploymentHealthPayload();
    const target = targetId
      ? deployments.targets.find((item) => toText(item.id) === targetId || toText(item.sourceId) === targetId) || null
      : null;
    const url = normalizeHttpUrl(explicitUrl || toText(target?.url));
    if (!url) {
      throw new Error("A valid http(s) deployment url or targetId is required");
    }
    const parsedUrl = new URL(url);
    if (isLocalOrPrivateHost(parsedUrl.hostname) && !allowLocal) {
      throw new Error("Local or private deployment URLs require allowLocal=true");
    }

    const label = toText(payload.label) || toText(target?.label) || parsedUrl.hostname;
    const provider = detectDeploymentProvider(url, toText(target?.provider)) || "custom";
    const timeoutMsRaw = Number(payload.timeoutMs || 8000);
    const timeoutMs = Number.isFinite(timeoutMsRaw) ? Math.max(1000, Math.min(15000, Math.floor(timeoutMsRaw))) : 8000;
    const checkedAt = new Date().toISOString();
    const startedAt = Date.now();
    let result;

    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "User-Agent": "workspace-audit-deployment-smoke-check/1.0"
        }
      });
      result = {
        id: createId("deployment-smoke-check"),
        targetId: targetId || toText(target?.id),
        sourceId: toText(target?.sourceId),
        label,
        provider,
        url,
        host: parsedUrl.hostname,
        status: response.ok ? "pass" : "fail",
        ok: response.ok,
        httpStatus: response.status,
        statusText: response.statusText,
        contentType: response.headers.get("content-type") || "",
        latencyMs: Date.now() - startedAt,
        timeoutMs,
        error: "",
        checkedAt,
        secretPolicy: "No response body, credentials, tokens, cookies, private keys, certificates, or browser-session data was captured."
      };
      if (response.body) {
        await response.body.cancel();
      }
    } catch (error) {
      result = {
        id: createId("deployment-smoke-check"),
        targetId: targetId || toText(target?.id),
        sourceId: toText(target?.sourceId),
        label,
        provider,
        url,
        host: parsedUrl.hostname,
        status: "fail",
        ok: false,
        httpStatus: 0,
        statusText: "",
        contentType: "",
        latencyMs: Date.now() - startedAt,
        timeoutMs,
        error: toText(error?.name) || "FetchError",
        checkedAt,
        secretPolicy: "No response body, credentials, tokens, cookies, private keys, certificates, or browser-session data was captured."
      };
    }

    const lines = [
      "# Deployment Smoke Check",
      "",
      `Checked: ${result.checkedAt}`,
      `Target: ${result.label}`,
      `URL: ${result.url}`,
      `Provider: ${result.provider}`,
      `Status: ${result.status}`,
      `HTTP status: ${result.httpStatus || "unreachable"}`,
      `Latency: ${result.latencyMs}ms`,
      `Content type: ${result.contentType || "not captured"}`,
      result.error ? `Error: ${result.error}` : "",
      "",
      `Secret policy: ${result.secretPolicy}`
    ].filter((line) => line !== "");

    return {
      ...result,
      markdown: lines.join("\n")
    };
  }

  /**
   * @param {{ generatedAt: string, summary: Record<string, unknown>, sources: Array<Record<string, unknown>> }} payload
   */
  function buildSourcesAccessRequirementsMarkdown(payload) {
    const lines = [
      "# Data Sources Access Requirements",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Sources: ${toNumber(payload.summary.total)}`,
      `Review required: ${toNumber(payload.summary.reviewRequired)}`,
      `Token likely: ${toNumber(payload.summary.tokenLikely)}`,
      `Password/session likely: ${toNumber(payload.summary.passwordLikely)}`,
      `Certificate likely: ${toNumber(payload.summary.certificateLikely)}`,
      `SSH key likely: ${toNumber(payload.summary.sshKeyLikely)}`,
      "",
      "Secret policy: Do not store passwords, tokens, private keys, or certificates in this app. Store only access-method metadata and use provider vaults, OS credential manager, SSH agent, or OAuth sessions for actual secrets.",
      "",
      "## Sources"
    ];

    if (!payload.sources.length) {
      lines.push("- No sources configured.");
      return lines.join("\n");
    }

    for (const source of payload.sources) {
      const access = toControlPlaneRecord(source.access);
      const credentialHints = Array.isArray(access.credentialHints) ? access.credentialHints.map(toText).filter(Boolean) : [];
      const notes = Array.isArray(access.notes) ? access.notes.map(toText).filter(Boolean) : [];
      lines.push(`- ${toText(source.label) || toText(source.type) || "Source"}: ${toText(access.accessMethod) || "review-required"} (${access.requiresReview ? "review required" : "ready"})`);
      lines.push(`  Type: ${toText(source.type) || "unknown"}`);
      lines.push(`  Value: ${toText(source.value) || "no value"}`);
      lines.push(`  Access level: ${toText(access.accessLevel) || "unknown"}`);
      if (credentialHints.length) {
        lines.push(`  Credential hints: ${credentialHints.join("; ")}`);
      }
      if (notes.length) {
        lines.push(`  Notes: ${notes.join(" ")}`);
      }
    }

    return lines.join("\n");
  }

  async function createSourcesAccessRequirementsPayload() {
    const sourcesPayload = await createSourcesSummaryPayload();
    const sources = sourcesPayload.sources.map((source) => {
      const record = toControlPlaneRecord(source);
      return {
        id: toText(record.id),
        type: toText(record.type),
        label: toText(record.label),
        value: toText(record.value),
        health: toText(record.health),
        status: toText(record.status),
        access: toControlPlaneRecord(record.access)
      };
    });
    const summary = {
      total: sources.length,
      reviewRequired: sources.filter((source) => source.access.requiresReview === true).length,
      tokenLikely: sources.filter((source) => source.access.tokenLikely === true).length,
      passwordLikely: sources.filter((source) => source.access.passwordLikely === true).length,
      certificateLikely: sources.filter((source) => source.access.certificateLikely === true).length,
      sshKeyLikely: sources.filter((source) => source.access.sshKeyLikely === true).length
    };
    const payload = {
      generatedAt: new Date().toISOString(),
      summary,
      sources
    };
    return {
      ...payload,
      markdown: buildSourcesAccessRequirementsMarkdown(payload)
    };
  }

  /**
   * @param {{ summary: Record<string, unknown>, methods: Array<Record<string, unknown>> }} payload
   */
  function buildSourcesAccessMatrixMarkdown(payload) {
    const methods = Array.isArray(payload.methods) ? payload.methods : [];
    const lines = [
      "# Data Sources Access Matrix",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Sources: ${toNumber(payload.summary.total)}`,
      `Access methods: ${toNumber(payload.summary.methodCount)}`,
      `Review required: ${toNumber(payload.summary.reviewRequired)}`,
      `Token/OAuth likely: ${toNumber(payload.summary.tokenLikely)}`,
      `Password/session likely: ${toNumber(payload.summary.passwordLikely)}`,
      `Certificate likely: ${toNumber(payload.summary.certificateLikely)}`,
      `SSH key likely: ${toNumber(payload.summary.sshKeyLikely)}`,
      "",
      "Secrets policy: This matrix stores access classifications only. Do not paste passwords, tokens, private keys, or certificates into this app.",
      "",
      "## Access Methods"
    ];

    if (!methods.length) {
      lines.push("- No Data Sources are configured.");
      return lines.join("\n");
    }

    for (const method of methods) {
      const record = toControlPlaneRecord(method);
      const sources = Array.isArray(record.sources) ? record.sources : [];
      lines.push("");
      lines.push(`### ${toText(record.accessMethod) || "unknown-access-method"}`);
      lines.push(`- Sources: ${toNumber(record.total)}`);
      lines.push(`- Review required: ${toNumber(record.reviewRequired)}`);
      lines.push(`- Token/OAuth likely: ${toNumber(record.tokenLikely)}`);
      lines.push(`- Password/session likely: ${toNumber(record.passwordLikely)}`);
      lines.push(`- Certificate likely: ${toNumber(record.certificateLikely)}`);
      lines.push(`- SSH key likely: ${toNumber(record.sshKeyLikely)}`);
      for (const source of sources) {
        const item = toControlPlaneRecord(source);
        const hints = Array.isArray(item.credentialHints) ? item.credentialHints.map(toText).filter(Boolean).join("; ") : "";
        lines.push(`- ${toText(item.label) || toText(item.id) || "Source"}: ${toText(item.health) || "review"} / ${toText(item.status) || "unknown"}${hints ? `; ${hints}` : ""}`);
      }
    }

    return lines.join("\n");
  }

  async function createSourcesAccessMatrixPayload() {
    const requirements = await createSourcesAccessRequirementsPayload();
    const methodMap = new Map();
    const sourceItems = Array.isArray(requirements.sources) ? requirements.sources : [];

    for (const source of sourceItems) {
      const record = toControlPlaneRecord(source);
      const access = toControlPlaneRecord(record.access);
      const accessMethod = toText(access.accessMethod) || "unknown-access-method";
      if (!methodMap.has(accessMethod)) {
        methodMap.set(accessMethod, {
          accessMethod,
          total: 0,
          reviewRequired: 0,
          tokenLikely: 0,
          passwordLikely: 0,
          certificateLikely: 0,
          sshKeyLikely: 0,
          sources: []
        });
      }
      const bucket = methodMap.get(accessMethod);
      bucket.total += 1;
      bucket.reviewRequired += access.requiresReview ? 1 : 0;
      bucket.tokenLikely += access.tokenLikely ? 1 : 0;
      bucket.passwordLikely += access.passwordLikely ? 1 : 0;
      bucket.certificateLikely += access.certificateLikely ? 1 : 0;
      bucket.sshKeyLikely += access.sshKeyLikely ? 1 : 0;
      bucket.sources.push({
        id: toText(record.id),
        label: toText(record.label) || toText(record.value) || "Source",
        type: toText(record.type) || "unknown",
        health: toText(record.health) || "review",
        status: toText(record.status) || "unknown",
        accessLevel: toText(access.accessLevel) || "unknown",
        requiresReview: Boolean(access.requiresReview),
        credentialHints: Array.isArray(access.credentialHints) ? access.credentialHints.map(toText).filter(Boolean) : [],
        notes: Array.isArray(access.notes) ? access.notes.map(toText).filter(Boolean) : []
      });
    }

    const methods = Array.from(methodMap.values()).sort((left, right) => {
      const reviewDelta = right.reviewRequired - left.reviewRequired;
      if (reviewDelta) return reviewDelta;
      return left.accessMethod.localeCompare(right.accessMethod);
    });
    const summary = {
      total: toNumber(requirements.summary.total),
      methodCount: methods.length,
      reviewRequired: toNumber(requirements.summary.reviewRequired),
      tokenLikely: toNumber(requirements.summary.tokenLikely),
      passwordLikely: toNumber(requirements.summary.passwordLikely),
      certificateLikely: toNumber(requirements.summary.certificateLikely),
      sshKeyLikely: toNumber(requirements.summary.sshKeyLikely)
    };
    const payload = {
      generatedAt: new Date().toISOString(),
      summary,
      methods,
      requirements
    };

    return {
      ...payload,
      markdown: buildSourcesAccessMatrixMarkdown(payload)
    };
  }

  /**
   * @param {{ generatedAt: string, summary: Record<string, unknown>, items: Array<Record<string, unknown>> }} payload
   */
  function buildSourcesAccessChecklistMarkdown(payload) {
    const lines = [
      "# Data Sources Access Checklist",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Checklist items: ${toNumber(payload.summary.total)}`,
      `Ready: ${toNumber(payload.summary.ready)}`,
      `Review: ${toNumber(payload.summary.review)}`,
      `Blocked: ${toNumber(payload.summary.blocked)}`,
      "",
      "Secret policy: Never paste or store passwords, tokens, private keys, or certificates in the source registry. Use OS credential manager, SSH agent, provider OAuth, or provider vaults for secrets.",
      "",
      "## Checklist"
    ];

    if (!payload.items.length) {
      lines.push("- No source access checklist items found.");
      return lines.join("\n");
    }

    for (const item of payload.items) {
      lines.push(`- ${toText(item.label) || toText(item.sourceId) || "Source"} [${toText(item.status) || "review"}]`);
      lines.push(`  Access method: ${toText(item.accessMethod) || "review-required"}`);
      lines.push(`  Action: ${toText(item.action) || "Review source access."}`);
      lines.push(`  Validation: ${toText(item.validation) || "Confirm the source can be reached without storing secrets in this app."}`);
      if (toText(item.credentialHint)) {
        lines.push(`  Credential hint: ${toText(item.credentialHint)}`);
      }
    }

    return lines.join("\n");
  }

  function createAccessValidationRunbookMethod(accessMethod) {
    const method = toText(accessMethod) || "review-required";
    const commonEvidence = "Record pass/fail and blocker notes in Governance tasks; do not paste passwords, tokens, private keys, certificates, or session cookies.";
    if (method === "local-filesystem") {
      return {
        accessMethod: method,
        title: "Local filesystem validation",
        steps: [
          "Confirm the folder is expected to be part of the app-development workspace.",
          "Use the current OS account to verify the path exists and is readable.",
          "Refresh Sources and confirm the source remains ready."
        ],
        commandHints: ["PowerShell: Test-Path <local-path>"],
        evidence: commonEvidence
      };
    }
    if (method === "network-filesystem") {
      return {
        accessMethod: method,
        title: "Network filesystem validation",
        steps: [
          "Connect required VPN/domain/network context outside this app.",
          "Open the UNC or mounted share path from the operator session.",
          "Refresh Sources and confirm the network source is reachable."
        ],
        commandHints: ["PowerShell: Test-Path <network-path>"],
        evidence: commonEvidence
      };
    }
    if (method === "git-ssh") {
      return {
        accessMethod: method,
        title: "Git SSH validation",
        steps: [
          "Load the required private key into ssh-agent outside this app.",
          "Confirm repository membership with the provider.",
          "Run a read-only Git remote operation from the operator shell."
        ],
        commandHints: ["ssh -T <git-host>", "git ls-remote <repo-ssh-url>"],
        evidence: commonEvidence
      };
    }
    if (method === "git-https") {
      return {
        accessMethod: method,
        title: "Git HTTPS validation",
        steps: [
          "Configure Git Credential Manager, OAuth, or provider token outside this app.",
          "Confirm repository membership with the provider.",
          "Run a read-only Git remote operation without embedding tokens in the URL."
        ],
        commandHints: ["git ls-remote <repo-https-url>"],
        evidence: commonEvidence
      };
    }
    if (method === "provider-token-or-oauth") {
      return {
        accessMethod: method,
        title: "Provider token or OAuth validation",
        steps: [
          "Confirm the operator account has team/project access in the provider.",
          "Authenticate with provider-approved tooling or OAuth outside this app.",
          "Open project metadata or perform a read-only provider status command."
        ],
        commandHints: ["Use provider CLI/dashboard read-only status command."],
        evidence: commonEvidence
      };
    }
    if (method === "provider-token-or-database-credentials") {
      return {
        accessMethod: method,
        title: "Provider database validation",
        steps: [
          "Confirm provider project membership and database role requirements.",
          "Resolve database password, SSL, or certificate needs in the provider vault outside this app.",
          "Perform a read-only connectivity check using provider-approved tooling."
        ],
        commandHints: ["Use provider CLI/dashboard read-only database connectivity check."],
        evidence: commonEvidence
      };
    }
    if (method === "browser-session-or-manual-export") {
      return {
        accessMethod: method,
        title: "Browser session or manual export validation",
        steps: [
          "Open the source in an authenticated browser session outside this app.",
          "Export or share the required app-development context using the provider workflow.",
          "Register the exported/shareable non-secret artifact as the ingestion source."
        ],
        commandHints: ["Manual provider export/share workflow."],
        evidence: commonEvidence
      };
    }
    return {
      accessMethod: method,
      title: "Provider-specific validation",
      steps: [
        "Identify the provider-specific access requirement.",
        "Resolve credentials, certificates, VPN, or session access outside this app.",
        "Confirm read-only access before ingestion or supervised agent work."
      ],
      commandHints: ["Use provider-approved read-only validation tooling."],
      evidence: commonEvidence
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildSourcesAccessValidationRunbookMarkdown(payload) {
    const methods = Array.isArray(payload.methods) ? payload.methods : [];
    const lines = [
      "# Data Sources Access Validation Runbook",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Access methods: ${toNumber(payload.summary.methodCount)}`,
      `Sources covered: ${toNumber(payload.summary.sourceCount)}`,
      `Review sources: ${toNumber(payload.summary.review)}`,
      `Blocked sources: ${toNumber(payload.summary.blocked)}`,
      "",
      "Secret policy: Resolve credentials, private keys, certificates, browser sessions, and provider tokens outside this app. Do not paste or store secrets in the source registry, task descriptions, or runbook evidence.",
      "",
      "## Methods"
    ];

    if (!methods.length) {
      lines.push("- No access validation runbook methods found.");
      return lines.join("\n");
    }

    for (const method of methods) {
      const record = toControlPlaneRecord(method);
      const sources = Array.isArray(record.sources) ? record.sources : [];
      const steps = Array.isArray(record.steps) ? record.steps : [];
      const commandHints = Array.isArray(record.commandHints) ? record.commandHints : [];
      lines.push(`- ${toText(record.title) || toText(record.accessMethod) || "Access method"} (${sources.length} source${sources.length === 1 ? "" : "s"})`);
      for (const step of steps) {
        lines.push(`  Step: ${toText(step)}`);
      }
      for (const command of commandHints) {
        lines.push(`  Command hint: ${toText(command)}`);
      }
      lines.push(`  Evidence: ${toText(record.evidence) || "Record non-secret validation evidence."}`);
      if (sources.length) {
        lines.push(`  Sources: ${sources.map((source) => toText(toControlPlaneRecord(source).label) || toText(toControlPlaneRecord(source).sourceId) || "Source").join(", ")}`);
      }
    }

    return lines.join("\n");
  }

  async function createSourcesAccessValidationRunbookPayload() {
    const checklist = await createSourcesAccessChecklistPayload();
    const byMethod = new Map();
    for (const item of checklist.items) {
      const method = toText(item.accessMethod) || "review-required";
      if (!byMethod.has(method)) {
        byMethod.set(method, {
          ...createAccessValidationRunbookMethod(method),
          sources: []
        });
      }
      byMethod.get(method).sources.push({
        sourceId: toText(item.sourceId),
        label: toText(item.label),
        type: toText(item.type),
        status: toText(item.status),
        sourceHealth: toText(item.sourceHealth),
        sourceStatus: toText(item.sourceStatus),
        credentialHint: toText(item.credentialHint),
        secretPolicy: toText(item.secretPolicy)
      });
    }
    const methods = [...byMethod.values()].sort((left, right) => left.accessMethod.localeCompare(right.accessMethod));
    const payload = {
      generatedAt: new Date().toISOString(),
      summary: {
        methodCount: methods.length,
        sourceCount: checklist.summary.total,
        ready: checklist.summary.ready,
        review: checklist.summary.review,
        blocked: checklist.summary.blocked
      },
      methods,
      checklist
    };

    return {
      ...payload,
      markdown: buildSourcesAccessValidationRunbookMarkdown(payload)
    };
  }

  const ACCESS_VALIDATION_EVIDENCE_STATUSES = new Set(["validated", "review", "blocked"]);

  /**
   * @param {unknown} value
   */
  function normalizeAccessValidationEvidenceStatus(value) {
    const status = String(value || "").trim().toLowerCase();
    return ACCESS_VALIDATION_EVIDENCE_STATUSES.has(status) ? status : "review";
  }

  /**
   * @param {unknown} value
   */
  function containsLikelySecret(value) {
    const text = String(value || "");
    return [
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
      /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
      /\bsk-[A-Za-z0-9_-]{20,}\b/,
      /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
      /\b(password|token|secret|api[_-]?key)\s*[:=]\s*\S{8,}/i
    ].some((pattern) => pattern.test(text));
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {{ status?: string, sourceId?: string, accessMethod?: string, limit?: number }} [options]
   */
  function createSourcesAccessValidationEvidencePayload(persisted, options = {}) {
    const status = String(options.status || "all").trim().toLowerCase();
    const sourceId = toText(options.sourceId);
    const accessMethod = toText(options.accessMethod);
    const requestedLimit = Number(options.limit || 100);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(250, Math.trunc(requestedLimit)))
      : 100;
    const evidence = Array.isArray(persisted.dataSourceAccessValidationEvidence)
      ? persisted.dataSourceAccessValidationEvidence.map(toControlPlaneRecord)
      : [];
    const filtered = evidence
      .filter((item) => status === "all" || toText(item.status) === status)
      .filter((item) => !sourceId || toText(item.sourceId) === sourceId)
      .filter((item) => !accessMethod || toText(item.accessMethod) === accessMethod)
      .sort((left, right) => new Date(toText(right.checkedAt || right.createdAt)).getTime() - new Date(toText(left.checkedAt || left.createdAt)).getTime())
      .slice(0, limit);
    const methodCount = new Set(filtered.map((item) => toText(item.accessMethod)).filter(Boolean)).size;
    const sourceCount = new Set(filtered.map((item) => toText(item.sourceId)).filter(Boolean)).size;
    const payload = {
      generatedAt: new Date().toISOString(),
      status,
      sourceId,
      accessMethod,
      limit,
      total: filtered.length,
      summary: {
        total: filtered.length,
        validated: filtered.filter((item) => toText(item.status) === "validated").length,
        review: filtered.filter((item) => toText(item.status) === "review").length,
        blocked: filtered.filter((item) => toText(item.status) === "blocked").length,
        methodCount,
        sourceCount
      },
      secretPolicy: "Non-secret validation evidence only. Do not store passwords, tokens, private keys, certificates, cookies, or browser session values.",
      items: filtered
    };
    return {
      ...payload,
      markdown: buildSourcesAccessValidationEvidenceMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildSourcesAccessValidationEvidenceMarkdown(payload) {
    const items = Array.isArray(payload.items) ? payload.items : [];
    const lines = [
      "# Data Sources Access Validation Evidence Ledger",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Evidence records: ${toNumber(payload.summary.total)}`,
      `Validated/review/blocked: ${toNumber(payload.summary.validated)}/${toNumber(payload.summary.review)}/${toNumber(payload.summary.blocked)}`,
      `Access methods: ${toNumber(payload.summary.methodCount)}`,
      `Sources: ${toNumber(payload.summary.sourceCount)}`,
      "",
      `Secret policy: ${toText(payload.secretPolicy) || "Non-secret validation evidence only."}`,
      "",
      "## Evidence"
    ];

    if (!items.length) {
      lines.push("- No Data Sources access validation evidence recorded.");
      return lines.join("\n");
    }

    for (const item of items) {
      const record = toControlPlaneRecord(item);
      lines.push(`- ${toText(record.sourceLabel) || toText(record.sourceId) || "Source"}: ${toText(record.status) || "review"} (${toText(record.accessMethod) || "review-required"})`);
      lines.push(`  Evidence: ${toText(record.evidence) || "Non-secret evidence not provided."}`);
      if (toText(record.commandHint)) {
        lines.push(`  Command hint: ${toText(record.commandHint)}`);
      }
      lines.push(`  Checked at: ${toText(record.checkedAt || record.createdAt) || "not recorded"}`);
    }

    return lines.join("\n");
  }

  /**
   * @param {Record<string, unknown>} payload
   * @param {Record<string, unknown>} source
   */
  function createSourcesAccessValidationEvidenceRecord(payload, source) {
    const evidence = String(payload.evidence || "").trim();
    if (!evidence) {
      throw new Error("Non-secret evidence is required");
    }
    if (containsLikelySecret(evidence) || containsLikelySecret(payload.commandHint)) {
      throw new Error("Evidence appears to contain a secret. Store credentials, tokens, private keys, and certificates outside this app.");
    }

    const now = new Date().toISOString();
    return {
      id: createId("data-source-access-validation-evidence"),
      sourceId: toText(source.sourceId),
      sourceLabel: toText(source.label),
      sourceType: toText(source.type),
      accessMethod: toText(payload.accessMethod) || toText(source.accessMethod) || "review-required",
      status: normalizeAccessValidationEvidenceStatus(payload.status),
      evidence: evidence.slice(0, 600),
      commandHint: String(payload.commandHint || "").trim().slice(0, 240),
      checkedAt: toText(payload.checkedAt) || now,
      createdAt: now,
      updatedAt: now,
      secretPolicy: "Non-secret validation evidence only. Secrets stay in OS credential managers, provider vaults, SSH agents, or authenticated browser sessions."
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildSourcesAccessValidationEvidenceCoverageMarkdown(payload) {
    const items = Array.isArray(payload.items) ? payload.items : [];
    const lines = [
      "# Data Sources Access Validation Evidence Coverage",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Sources: ${toNumber(payload.summary.sourceCount)}`,
      `Covered/review/blocked/missing: ${toNumber(payload.summary.covered)}/${toNumber(payload.summary.review)}/${toNumber(payload.summary.blocked)}/${toNumber(payload.summary.missing)}`,
      `Coverage: ${toNumber(payload.summary.coveragePercent)}%`,
      `Access methods: ${toNumber(payload.summary.methodCount)}`,
      "",
      `Secret policy: ${toText(payload.secretPolicy) || "Non-secret validation evidence only."}`,
      "",
      "## Coverage"
    ];

    if (!items.length) {
      lines.push("- No Data Sources access validation coverage items found.");
      return lines.join("\n");
    }

    for (const item of items) {
      const record = toControlPlaneRecord(item);
      lines.push(`- ${toText(record.coverageStatus).toUpperCase()}: ${toText(record.label) || toText(record.sourceId) || "Source"} (${toText(record.accessMethod) || "review-required"})`);
      lines.push(`  Priority: ${toText(record.priority) || "normal"}`);
      lines.push(`  Latest evidence: ${toText(record.latestEvidenceStatus) || "missing"}`);
      lines.push(`  Action: ${toText(record.action) || "Record non-secret source access validation evidence."}`);
      if (toText(record.latestEvidenceSummary)) {
        lines.push(`  Evidence summary: ${toText(record.latestEvidenceSummary)}`);
      }
      if (toText(record.latestEvidenceAt)) {
        lines.push(`  Latest evidence at: ${toText(record.latestEvidenceAt)}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {Record<string, unknown>} [runbookPayload]
   */
  async function createSourcesAccessValidationEvidenceCoveragePayload(persisted, runbookPayload = null) {
    const runbook = runbookPayload || await createSourcesAccessValidationRunbookPayload();
    const methods = Array.isArray(runbook.methods) ? runbook.methods.map(toControlPlaneRecord) : [];
    const evidence = Array.isArray(persisted.dataSourceAccessValidationEvidence)
      ? persisted.dataSourceAccessValidationEvidence.map(toControlPlaneRecord)
      : [];
    const latestEvidenceBySource = new Map();
    for (const record of [...evidence].sort((left, right) => new Date(toText(right.checkedAt || right.createdAt)).getTime() - new Date(toText(left.checkedAt || left.createdAt)).getTime())) {
      const sourceId = toText(record.sourceId);
      if (sourceId && !latestEvidenceBySource.has(sourceId)) {
        latestEvidenceBySource.set(sourceId, record);
      }
    }

    const items = [];
    for (const method of methods) {
      const accessMethod = toText(method.accessMethod) || "review-required";
      const sources = Array.isArray(method.sources) ? method.sources.map(toControlPlaneRecord) : [];
      for (const source of sources) {
        const sourceId = toText(source.sourceId);
        const latestEvidence = latestEvidenceBySource.get(sourceId) || null;
        const latestEvidenceStatus = toText(latestEvidence?.status);
        const sourceStatus = toText(source.status);
        const coverageStatus = latestEvidenceStatus === "validated"
          ? "covered"
          : latestEvidenceStatus === "blocked"
            ? "blocked"
            : latestEvidenceStatus === "review"
              ? "review"
              : "missing";
        const priority = coverageStatus === "blocked"
          ? "high"
          : coverageStatus === "review"
            ? "medium"
            : coverageStatus === "missing" && (sourceStatus === "blocked" || ["git-https", "git-ssh", "network-filesystem", "provider-token-or-database-credentials", "provider-token-or-oauth"].includes(accessMethod))
              ? "high"
              : coverageStatus === "missing"
                ? "medium"
                : "low";
        const action = coverageStatus === "covered"
          ? "Keep the non-secret evidence fresh when access changes."
          : coverageStatus === "blocked"
            ? "Resolve blocked source access outside this app, then record updated non-secret evidence."
            : coverageStatus === "review"
              ? "Review the latest source-access evidence and promote it to validated or blocked."
              : "Record non-secret validation evidence after confirming access outside this app.";
        items.push({
          id: `source-access-validation-evidence-coverage:${sourceId || toText(source.label) || accessMethod}`,
          sourceId,
          label: toText(source.label) || "Source",
          type: toText(source.type),
          status: sourceStatus,
          sourceHealth: toText(source.sourceHealth),
          sourceStatus: toText(source.sourceStatus),
          accessMethod,
          coverageStatus,
          priority,
          action,
          latestEvidenceId: toText(latestEvidence?.id),
          latestEvidenceStatus,
          latestEvidenceAt: toText(latestEvidence?.checkedAt || latestEvidence?.createdAt),
          latestEvidenceSummary: toText(latestEvidence?.evidence),
          secretPolicy: toText(source.secretPolicy) || "Non-secret validation evidence only. Resolve credentials outside this app."
        });
      }
    }

    const methodCount = new Set(items.map((item) => item.accessMethod).filter(Boolean)).size;
    const covered = items.filter((item) => item.coverageStatus === "covered").length;
    const summary = {
      sourceCount: items.length,
      covered,
      review: items.filter((item) => item.coverageStatus === "review").length,
      blocked: items.filter((item) => item.coverageStatus === "blocked").length,
      missing: items.filter((item) => item.coverageStatus === "missing").length,
      highPriority: items.filter((item) => item.priority === "high").length,
      mediumPriority: items.filter((item) => item.priority === "medium").length,
      methodCount,
      coveragePercent: items.length ? Math.round((covered / items.length) * 100) : 0
    };
    const payload = {
      generatedAt: new Date().toISOString(),
      summary,
      secretPolicy: "Non-secret validation evidence coverage only. Do not store passwords, tokens, private keys, certificates, cookies, or browser session values.",
      items: items.sort((left, right) => {
        const priorityRank = { high: 0, medium: 1, low: 2 };
        const statusRank = { blocked: 0, missing: 1, review: 2, covered: 3 };
        return (priorityRank[left.priority] ?? 9) - (priorityRank[right.priority] ?? 9)
          || (statusRank[left.coverageStatus] ?? 9) - (statusRank[right.coverageStatus] ?? 9)
          || left.label.localeCompare(right.label);
      }),
      runbook
    };

    return {
      ...payload,
      markdown: buildSourcesAccessValidationEvidenceCoverageMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildSourcesAccessValidationEvidenceSnapshotDiffMarkdown(payload) {
    const formatDriftValue = (value) => typeof value === "number" ? String(value) : toText(value);
    const lines = [
      "# Data Sources Access Validation Evidence Snapshot Drift",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Snapshot: ${toText(payload.snapshotTitle) || "missing"}`,
      `Drift severity: ${toText(payload.driftSeverity) || "none"}`,
      `Drift score: ${toNumber(payload.driftScore)}`,
      `Recommended action: ${toText(payload.recommendedAction) || "No action required."}`,
      "",
      "## Drift Items"
    ];

    const driftItems = Array.isArray(payload.driftItems) ? payload.driftItems : [];
    if (!driftItems.length) {
      lines.push("- No source-access validation evidence drift detected.");
      return lines.join("\n");
    }

    for (const item of driftItems) {
      const record = toControlPlaneRecord(item);
      lines.push(`- ${toText(record.label) || toText(record.field) || "Source validation evidence drift"}: ${formatDriftValue(record.before)} -> ${formatDriftValue(record.current)}`);
    }

    return lines.join("\n");
  }

  function createMissingSourcesAccessValidationEvidenceSnapshotDiffPayload() {
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: false,
      snapshotId: "",
      snapshotTitle: "",
      snapshotCreatedAt: "",
      hasDrift: false,
      driftScore: 0,
      driftSeverity: "missing-snapshot",
      recommendedAction: "Save a Data Sources access validation evidence snapshot before comparing evidence drift.",
      driftItems: [],
      liveSummary: null,
      snapshotSummary: null
    };
    return {
      ...payload,
      markdown: buildSourcesAccessValidationEvidenceSnapshotDiffMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} snapshot
   * @param {ReturnType<typeof createSourcesAccessValidationEvidencePayload>} live
   */
  function createSourcesAccessValidationEvidenceSnapshotDiffPayload(snapshot, live) {
    const driftItems = [];
    const snapshotSummary = {
      total: toNumber(snapshot.total),
      validated: toNumber(snapshot.validatedCount),
      review: toNumber(snapshot.reviewCount),
      blocked: toNumber(snapshot.blockedCount),
      methodCount: toNumber(snapshot.methodCount),
      sourceCount: toNumber(snapshot.sourceCount)
    };
    const liveSummary = toControlPlaneRecord(live.summary);
    const countFields = [
      { field: "total", label: "Total source-access validation evidence" },
      { field: "validated", label: "Validated source-access evidence" },
      { field: "review", label: "Review source-access evidence" },
      { field: "blocked", label: "Blocked source-access evidence" },
      { field: "methodCount", label: "Evidence access methods" },
      { field: "sourceCount", label: "Evidence sources" }
    ];

    for (const item of countFields) {
      const before = toNumber(snapshotSummary[item.field]);
      const current = toNumber(liveSummary[item.field]);
      if (before !== current) {
        driftItems.push({
          field: item.field,
          label: item.label,
          before,
          current,
          delta: current - before
        });
      }
    }

    const snapshotEvidence = Array.isArray(snapshot.items) ? snapshot.items.map(toControlPlaneRecord) : [];
    const liveEvidence = Array.isArray(live.items) ? live.items.map(toControlPlaneRecord) : [];
    const evidenceKey = (item) => toText(item.id) || `${toText(item.sourceId)}:${toText(item.accessMethod)}:${toText(item.checkedAt)}:${toText(item.status)}`;
    const snapshotByKey = new Map(snapshotEvidence.map((item) => [evidenceKey(item), item]));
    const liveByKey = new Map(liveEvidence.map((item) => [evidenceKey(item), item]));

    for (const [key, evidence] of liveByKey) {
      const previous = snapshotByKey.get(key);
      const label = toText(evidence.sourceLabel) || toText(evidence.sourceId) || key;
      if (!previous) {
        driftItems.push({
          field: `source-access-validation-evidence:${key}`,
          label: `${label} added`,
          before: "missing",
          current: `${toText(evidence.status) || "review"} / ${toText(evidence.accessMethod) || "review-required"}`,
          delta: 1
        });
        continue;
      }
      const beforeState = `${toText(previous.status) || "review"} / ${toText(previous.accessMethod) || "review-required"} / ${toText(previous.checkedAt || previous.createdAt) || "not-recorded"}`;
      const currentState = `${toText(evidence.status) || "review"} / ${toText(evidence.accessMethod) || "review-required"} / ${toText(evidence.checkedAt || evidence.createdAt) || "not-recorded"}`;
      if (beforeState !== currentState) {
        driftItems.push({
          field: `source-access-validation-evidence:${key}`,
          label,
          before: beforeState,
          current: currentState,
          delta: toText(previous.status) === toText(evidence.status) ? 0 : 1
        });
      }
    }

    for (const [key, evidence] of snapshotByKey) {
      if (!liveByKey.has(key)) {
        driftItems.push({
          field: `source-access-validation-evidence:${key}`,
          label: `${toText(evidence.sourceLabel) || toText(evidence.sourceId) || key} removed`,
          before: `${toText(evidence.status) || "review"} / ${toText(evidence.accessMethod) || "review-required"}`,
          current: "missing",
          delta: -1
        });
      }
    }

    const driftScore = driftItems.reduce((total, item) => total + Math.max(1, Math.abs(toNumber(item.delta))), 0);
    const blockedDelta = toNumber(liveSummary.blocked) - toNumber(snapshotSummary.blocked);
    const reviewDelta = toNumber(liveSummary.review) - toNumber(snapshotSummary.review);
    const driftSeverity = !driftItems.length
      ? "none"
      : blockedDelta > 0
        ? "high"
        : reviewDelta > 0 || driftScore >= 5
          ? "medium"
          : "low";
    const recommendedAction = driftSeverity === "high"
      ? "Resolve blocked Data Sources access validation evidence before supervised app-management work."
      : driftSeverity === "medium"
        ? "Review Data Sources access validation evidence drift and refresh the snapshot if changes are intentional."
        : driftSeverity === "low"
          ? "Monitor low evidence drift and refresh the snapshot after confirmation."
          : "No source-access validation evidence drift detected.";
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: true,
      snapshotId: toText(snapshot.id),
      snapshotTitle: toText(snapshot.title) || "Data Sources Access Validation Evidence",
      snapshotCreatedAt: toText(snapshot.createdAt),
      hasDrift: driftItems.length > 0,
      driftScore,
      driftSeverity,
      recommendedAction,
      driftItems,
      liveSummary,
      snapshotSummary
    };

    return {
      ...payload,
      markdown: buildSourcesAccessValidationEvidenceSnapshotDiffMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} source
   */
  function createSourceAccessChecklistItem(source) {
    const access = toControlPlaneRecord(source.access);
    const accessMethod = toText(access.accessMethod) || "review-required";
    const credentialHints = Array.isArray(access.credentialHints) ? access.credentialHints.map(toText).filter(Boolean) : [];
    const sourceHealth = toText(source.health) || "review";
    const sourceStatus = toText(source.status) || "registered";
    let status = sourceHealth === "blocked" ? "blocked" : access.requiresReview === true ? "review" : "ready";
    let action = "Confirm source access is available to the current operator context.";
    let validation = "Refresh Sources and confirm the source remains ready.";

    if (accessMethod === "local-filesystem") {
      action = "Confirm the current OS account has read access to the local folder.";
      validation = "Refresh Sources and verify the source status is reachable.";
    } else if (accessMethod === "network-filesystem") {
      status = sourceHealth === "blocked" ? "blocked" : "review";
      action = "Confirm VPN/domain access and network share credentials outside this app.";
      validation = "Open the UNC path from the current OS session, then refresh Sources.";
    } else if (accessMethod === "git-ssh") {
      action = "Load the required SSH key in ssh-agent and confirm repository membership.";
      validation = "Run a Git remote read operation outside this app, then refresh Sources.";
    } else if (accessMethod === "git-https") {
      action = "Configure Git Credential Manager, OAuth, or a provider-managed token outside this app.";
      validation = "Run a Git remote read operation outside this app without embedding tokens in the URL.";
    } else if (accessMethod === "provider-token-or-oauth") {
      action = "Confirm provider account/team access and configure OAuth or provider token in the provider tooling.";
      validation = "Open the provider dashboard or project metadata using provider tooling, then refresh Sources.";
    } else if (accessMethod === "provider-token-or-database-credentials") {
      action = "Confirm provider project access, database credentials, and SSL/certificate requirements in the provider vault.";
      validation = "Verify backend metadata or database connectivity outside this app using provider-approved tooling.";
    } else if (accessMethod === "browser-session-or-manual-export") {
      action = "Use an authenticated browser session or manual export/share workflow for this AI workspace source.";
      validation = "Confirm the exported or shared workspace context is reachable before ingestion.";
    } else {
      action = "Review provider-specific access requirements before automated ingestion.";
      validation = "Confirm the source can be reached using non-secret provider tooling.";
    }

    return {
      id: createId("data-source-access-check"),
      sourceId: toText(source.id),
      label: toText(source.label) || toText(source.type) || "Source",
      type: toText(source.type),
      value: toText(source.value),
      sourceHealth,
      sourceStatus,
      status,
      accessMethod,
      action,
      validation,
      credentialHint: credentialHints.join("; "),
      secretPolicy: toText(access.secretPolicy)
    };
  }

  async function createSourcesAccessChecklistPayload() {
    const accessRequirements = await createSourcesAccessRequirementsPayload();
    const items = accessRequirements.sources.map((source) => createSourceAccessChecklistItem(toControlPlaneRecord(source)));
    const summary = {
      total: items.length,
      ready: items.filter((item) => item.status === "ready").length,
      review: items.filter((item) => item.status === "review").length,
      blocked: items.filter((item) => item.status === "blocked").length
    };
    const payload = {
      generatedAt: new Date().toISOString(),
      summary,
      items
    };
    return {
      ...payload,
      markdown: buildSourcesAccessChecklistMarkdown(payload)
    };
  }

  /**
   * @param {{ summary: Record<string, unknown>, items: Array<Record<string, unknown>> }} payload
   */
  function buildSourcesAccessReviewQueueMarkdown(payload) {
    const items = Array.isArray(payload.items) ? payload.items : [];
    const lines = [
      "# Data Sources Access Review Queue",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Queue items: ${toNumber(payload.summary.total)}`,
      `Review: ${toNumber(payload.summary.review)}`,
      `Blocked: ${toNumber(payload.summary.blocked)}`,
      `Access methods: ${toNumber(payload.summary.methodCount)}`,
      `Token/OAuth likely: ${toNumber(payload.summary.tokenLikely)}`,
      `Certificate likely: ${toNumber(payload.summary.certificateLikely)}`,
      "",
      "Secret policy: Resolve credentials, private keys, certificates, and browser sessions outside this app. This queue stores only non-secret access metadata.",
      "",
      "## Queue"
    ];

    if (!items.length) {
      lines.push("- No Data Sources access review queue items.");
      return lines.join("\n");
    }

    for (const item of items) {
      lines.push(`- ${toText(item.priority).toUpperCase()}: ${toText(item.title) || toText(item.label) || "Source access review"}`);
      lines.push(`  Status: ${toText(item.status) || "review"}`);
      lines.push(`  Access method: ${toText(item.accessMethod) || "review-required"}`);
      lines.push(`  Action: ${toText(item.action) || "Review source access."}`);
      lines.push(`  Validation: ${toText(item.validation) || "Confirm access outside this app."}`);
      if (toText(item.credentialHint)) {
        lines.push(`  Credential hint: ${toText(item.credentialHint)}`);
      }
    }

    return lines.join("\n");
  }

  async function createSourcesAccessReviewQueuePayload() {
    const [checklist, matrix] = await Promise.all([
      createSourcesAccessChecklistPayload(),
      createSourcesAccessMatrixPayload()
    ]);
    const checklistItems = Array.isArray(checklist.items) ? checklist.items : [];
    const items = checklistItems
      .filter((item) => item.status !== "ready")
      .map((item) => {
        const record = toControlPlaneRecord(item);
        const accessMethod = toText(record.accessMethod) || "review-required";
        const status = toText(record.status) === "blocked" ? "blocked" : "review";
        const priority = status === "blocked"
          ? "high"
          : ["git-https", "git-ssh", "provider-token-or-database-credentials"].includes(accessMethod)
            ? "medium"
            : "normal";
        return {
          id: `source-access-review:${toText(record.sourceId) || toText(record.value) || toText(record.label)}`,
          sourceId: toText(record.sourceId),
          label: toText(record.label) || "Source",
          type: toText(record.type),
          value: toText(record.value),
          title: `Review ${toText(record.label) || toText(record.type) || "source"} access`,
          status,
          priority,
          accessMethod,
          sourceHealth: toText(record.sourceHealth),
          sourceStatus: toText(record.sourceStatus),
          action: toText(record.action),
          validation: toText(record.validation),
          credentialHint: toText(record.credentialHint),
          secretPolicy: toText(record.secretPolicy)
        };
      })
      .sort((left, right) => {
        const rank = { high: 0, medium: 1, normal: 2 };
        return rank[left.priority] - rank[right.priority] || left.label.localeCompare(right.label);
      });
    const summary = {
      total: items.length,
      review: items.filter((item) => item.status === "review").length,
      blocked: items.filter((item) => item.status === "blocked").length,
      high: items.filter((item) => item.priority === "high").length,
      medium: items.filter((item) => item.priority === "medium").length,
      normal: items.filter((item) => item.priority === "normal").length,
      methodCount: toNumber(matrix.summary.methodCount),
      tokenLikely: toNumber(matrix.summary.tokenLikely),
      passwordLikely: toNumber(matrix.summary.passwordLikely),
      certificateLikely: toNumber(matrix.summary.certificateLikely),
      sshKeyLikely: toNumber(matrix.summary.sshKeyLikely)
    };
    const payload = {
      generatedAt: new Date().toISOString(),
      summary,
      items,
      checklist,
      matrix
    };

    return {
      ...payload,
      markdown: buildSourcesAccessReviewQueueMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} item
   */
  function createSourceAccessReviewTask(item) {
    const sourceLabel = toText(item.label) || "Source";
    const accessMethod = toText(item.accessMethod) || "review-required";
    const credentialHint = toText(item.credentialHint);
    const action = toText(item.action) || "Review source access outside this app.";
    const validation = toText(item.validation) || "Confirm access outside this app.";
    const descriptionLines = [
      `Source: ${sourceLabel}`,
      `Type: ${toText(item.type) || "source"}`,
      `Value: ${toText(item.value) || "not recorded"}`,
      `Access method: ${accessMethod}`,
      `Source status: ${toText(item.sourceHealth) || "unknown"} / ${toText(item.sourceStatus) || "unknown"}`,
      `Action: ${action}`,
      `Validation: ${validation}`,
      credentialHint ? `Credential hint: ${credentialHint}` : "",
      "Secret policy: Resolve credentials, private keys, certificates, and browser sessions outside this app. Do not store secrets in this task."
    ].filter(Boolean);

    return {
      id: createId("task"),
      projectId: "data-sources",
      projectName: "Data Sources",
      title: `Source access review: ${sourceLabel}`,
      description: descriptionLines.join("\n"),
      priority: toText(item.priority) === "high" ? "high" : toText(item.priority) === "medium" ? "medium" : "low",
      status: "open",
      sourceAccessReviewId: toText(item.id),
      sourceId: toText(item.sourceId),
      sourceLabel,
      sourceType: toText(item.type),
      sourceValue: toText(item.value),
      accessMethod,
      secretPolicy: toText(item.secretPolicy) || "non-secret-metadata-only",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * @param {Record<string, unknown>} item
   */
  function createSourceAccessValidationEvidenceCoverageTask(item) {
    const sourceLabel = toText(item.label) || "Source";
    const accessMethod = toText(item.accessMethod) || "review-required";
    const coverageStatus = toText(item.coverageStatus) || "missing";
    const priority = toText(item.priority) || (coverageStatus === "blocked" ? "high" : coverageStatus === "covered" ? "low" : "medium");
    const descriptionLines = [
      `Source: ${sourceLabel}`,
      `Type: ${toText(item.type) || "source"}`,
      `Access method: ${accessMethod}`,
      `Coverage status: ${coverageStatus}`,
      `Latest evidence: ${toText(item.latestEvidenceStatus) || "missing"}`,
      toText(item.latestEvidenceAt) ? `Latest evidence at: ${toText(item.latestEvidenceAt)}` : "",
      toText(item.latestEvidenceSummary) ? `Latest evidence summary: ${toText(item.latestEvidenceSummary)}` : "",
      `Action: ${toText(item.action) || "Record non-secret validation evidence after confirming access outside this app."}`,
      "Secret policy: Resolve credentials, private keys, certificates, browser sessions, cookies, and provider tokens outside this app. Do not store secrets in this task."
    ].filter(Boolean);

    return {
      id: createId("task"),
      projectId: "data-sources",
      projectName: "Data Sources",
      title: `Source evidence coverage: ${sourceLabel}`,
      description: descriptionLines.join("\n"),
      priority: priority === "high" ? "high" : priority === "medium" ? "medium" : "low",
      status: "open",
      sourceAccessValidationEvidenceCoverageId: toText(item.id),
      sourceId: toText(item.sourceId),
      sourceLabel,
      sourceType: toText(item.type),
      accessMethod,
      coverageStatus,
      secretPolicy: toText(item.secretPolicy) || "non-secret-validation-evidence-only",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function isGovernanceClosedStatus(status) {
    return ["done", "resolved", "closed", "cancelled", "archived"].includes(String(status || "").toLowerCase());
  }

  /**
   * @param {Record<string, unknown>[]} tasks
   * @param {Record<string, unknown>} evidence
   */
  function syncSourceAccessValidationEvidenceCoverageTasks(tasks, evidence) {
    const sourceId = toText(evidence.sourceId);
    const coverageId = sourceId ? `source-access-validation-evidence-coverage:${sourceId}` : "";
    if (!coverageId) {
      return { tasks, updatedTaskIds: [] };
    }

    const status = normalizeAccessValidationEvidenceStatus(evidence.status);
    const nextTaskStatus = status === "validated" ? "resolved" : status === "blocked" ? "blocked" : "open";
    const nextCoverageStatus = status === "validated" ? "covered" : status;
    const updatedAt = new Date().toISOString();
    const updatedTaskIds = [];
    const nextTasks = tasks.map((task) => {
      const record = toControlPlaneRecord(task);
      if (toText(record.sourceAccessValidationEvidenceCoverageId) !== coverageId) {
        return task;
      }

      const currentEvidenceId = toText(record.lastSourceAccessValidationEvidenceId);
      const currentStatus = toText(record.status) || "open";
      if (currentEvidenceId === toText(evidence.id) && currentStatus === nextTaskStatus) {
        return task;
      }

      updatedTaskIds.push(toText(record.id));
      return {
        ...task,
        status: nextTaskStatus,
        coverageStatus: nextCoverageStatus,
        latestEvidenceStatus: status,
        latestEvidenceId: toText(evidence.id),
        latestEvidenceAt: toText(evidence.checkedAt || evidence.createdAt),
        lastSourceAccessValidationEvidenceId: toText(evidence.id),
        lastSourceAccessValidationEvidenceStatus: status,
        lastSourceAccessValidationEvidenceAt: toText(evidence.checkedAt || evidence.createdAt),
        updatedAt
      };
    });

    return { tasks: nextTasks, updatedTaskIds };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildSourcesAccessTaskLedgerMarkdown(payload) {
    const summary = toControlPlaneRecord(payload.summary);
    const items = Array.isArray(payload.items) ? payload.items : [];
    const lines = [
      "# Data Sources Access Task Ledger",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Status filter: ${toText(payload.status) || "all"}`,
      `Secret policy: ${toText(payload.secretPolicy) || "Non-secret metadata only. Resolve credentials outside this app."}`,
      "",
      "## Summary",
      `- Total tasks: ${toNumber(summary.total)}`,
      `- Open tasks: ${toNumber(summary.open)}`,
      `- Closed tasks: ${toNumber(summary.closed)}`,
      `- Visible tasks: ${toNumber(summary.visible)}`,
      `- Priority split: ${toNumber(summary.high)} high / ${toNumber(summary.medium)} medium / ${toNumber(summary.low)} low / ${toNumber(summary.normal)} normal`,
      "",
      "## Tasks"
    ];

    if (items.length) {
      for (const item of items) {
        const record = toControlPlaneRecord(item);
        lines.push(`- ${toText(record.priority) || "normal"} ${toText(record.status) || "open"}: ${toText(record.title) || toText(record.sourceLabel) || "Source access task"} (${toText(record.accessMethod) || "review-required"})`);
        lines.push(`  Source: ${toText(record.sourceLabel) || toText(record.sourceId) || "source"} | Type: ${toText(record.sourceType) || "source"} | Review id: ${toText(record.sourceAccessReviewId) || "source-access-task"}`);
        if (toText(record.lastSourceAccessValidationEvidenceStatus || record.latestEvidenceStatus)) {
          lines.push(`  Evidence sync: ${toText(record.lastSourceAccessValidationEvidenceStatus || record.latestEvidenceStatus)} | Evidence id: ${toText(record.lastSourceAccessValidationEvidenceId || record.latestEvidenceId) || "not recorded"} | Evidence at: ${toText(record.lastSourceAccessValidationEvidenceAt || record.latestEvidenceAt) || "not recorded"}`);
        }
        lines.push(`  Updated: ${toText(record.updatedAt) || toText(record.createdAt) || "not recorded"} | Secret policy: ${toText(record.secretPolicy) || "non-secret-metadata-only"}`);
      }
    } else {
      lines.push("- No Data Sources access tasks match the current filter.");
    }

    return lines.join("\n");
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {{ status?: string, limit?: number }} [options]
   */
  function createSourcesAccessTaskLedgerPayload(persisted, options = {}) {
    const requestedStatus = toText(options.status) || "all";
    const status = ["all", "open", "closed"].includes(requestedStatus) ? requestedStatus : "all";
    const requestedLimit = Number(options.limit || 100);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(250, Math.trunc(requestedLimit)))
      : 100;
    const sourceAccessTasks = (Array.isArray(persisted.tasks) ? persisted.tasks : [])
      .filter((task) => toText(task.sourceAccessReviewId) || toText(task.projectId) === "data-sources")
      .map((task) => {
        const record = toControlPlaneRecord(task);
        return {
          id: toText(record.id),
          title: toText(record.title) || `Source access review: ${toText(record.sourceLabel) || "Source"}`,
          status: toText(record.status) || "open",
          priority: toText(record.priority) || "normal",
          sourceAccessReviewId: toText(record.sourceAccessReviewId),
          sourceAccessValidationEvidenceCoverageId: toText(record.sourceAccessValidationEvidenceCoverageId),
          sourceId: toText(record.sourceId),
          sourceLabel: toText(record.sourceLabel) || toText(record.projectName) || "Data Sources",
          sourceType: toText(record.sourceType),
          sourceValue: toText(record.sourceValue),
          accessMethod: toText(record.accessMethod) || "review-required",
          coverageStatus: toText(record.coverageStatus),
          latestEvidenceStatus: toText(record.latestEvidenceStatus),
          latestEvidenceId: toText(record.latestEvidenceId),
          latestEvidenceAt: toText(record.latestEvidenceAt),
          lastSourceAccessValidationEvidenceId: toText(record.lastSourceAccessValidationEvidenceId),
          lastSourceAccessValidationEvidenceStatus: toText(record.lastSourceAccessValidationEvidenceStatus),
          lastSourceAccessValidationEvidenceAt: toText(record.lastSourceAccessValidationEvidenceAt),
          secretPolicy: toText(record.secretPolicy) || "non-secret-metadata-only",
          createdAt: toText(record.createdAt),
          updatedAt: toText(record.updatedAt || record.createdAt)
        };
      })
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime());

    const openTasks = sourceAccessTasks.filter((task) => !isGovernanceClosedStatus(task.status));
    const closedTasks = sourceAccessTasks.filter((task) => isGovernanceClosedStatus(task.status));
    const visibleTasks = status === "open"
      ? openTasks
      : status === "closed"
        ? closedTasks
        : sourceAccessTasks;
    const accessMethods = {};
    for (const task of sourceAccessTasks) {
      const method = toText(task.accessMethod) || "review-required";
      accessMethods[method] = toNumber(accessMethods[method]) + 1;
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      status,
      limit,
      secretPolicy: "Non-secret metadata only. Resolve passwords, tokens, private keys, certificates, VPN sessions, and browser/OAuth sessions outside this app.",
      summary: {
        total: sourceAccessTasks.length,
        open: openTasks.length,
        closed: closedTasks.length,
        visible: Math.min(visibleTasks.length, limit),
        high: sourceAccessTasks.filter((task) => task.priority === "high").length,
        medium: sourceAccessTasks.filter((task) => task.priority === "medium").length,
        low: sourceAccessTasks.filter((task) => task.priority === "low").length,
        normal: sourceAccessTasks.filter((task) => !["high", "medium", "low"].includes(task.priority)).length,
        methodCount: Object.keys(accessMethods).length,
        accessMethods
      },
      items: visibleTasks.slice(0, limit)
    };

    return {
      ...payload,
      markdown: buildSourcesAccessTaskLedgerMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildSourcesAccessGateMarkdown(payload) {
    const reasons = Array.isArray(payload.reasons) ? payload.reasons : [];
    const lines = [
      "# Data Sources Access Gate",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Decision: ${toText(payload.decision) || "review"}`,
      `Recommended action: ${toText(payload.recommendedAction) || "Review Data Sources access before ingestion."}`,
      "",
      "Secret policy: Do not store passwords, tokens, private keys, or certificates in this app.",
      "",
      "## Evidence",
      `- Total checklist items: ${toNumber(payload.total)}`,
      `- Ready items: ${toNumber(payload.ready)}`,
      `- Review items: ${toNumber(payload.review)}`,
      `- Blocked items: ${toNumber(payload.blocked)}`,
      `- Token-likely sources: ${toNumber(payload.tokenLikely)}`,
      `- Password/session-likely sources: ${toNumber(payload.passwordLikely)}`,
      `- Certificate-likely sources: ${toNumber(payload.certificateLikely)}`,
      `- SSH-key-likely sources: ${toNumber(payload.sshKeyLikely)}`,
      "",
      "## Reasons"
    ];

    if (!reasons.length) {
      lines.push("- No access gate reasons detected.");
    } else {
      for (const reason of reasons) {
        const record = toControlPlaneRecord(reason);
        lines.push(`- ${toText(record.severity) || "review"}: ${toText(record.message) || toText(record.code) || "Review required."}`);
      }
    }

    return lines.join("\n");
  }

  async function createSourcesAccessGatePayload() {
    const [checklist, accessRequirements] = await Promise.all([
      createSourcesAccessChecklistPayload(),
      createSourcesAccessRequirementsPayload()
    ]);
    const summary = checklist.summary;
    const accessSummary = accessRequirements.summary;
    const reasons = [];
    const addReason = (severity, code, message) => {
      reasons.push({ severity, code, message });
    };

    if (toNumber(summary.total) === 0) {
      addReason("hold", "no-sources", "No Data Sources are configured for ingestion.");
    }
    if (toNumber(summary.blocked) > 0) {
      addReason("hold", "blocked-source-access", "Resolve blocked Data Sources before ingestion or automated agent work.");
    }
    if (toNumber(summary.review) > 0) {
      addReason("review", "source-access-review", "Confirm access requirements for review-state Data Sources before automated ingestion.");
    }
    if (toNumber(accessSummary.certificateLikely) > 0) {
      addReason("review", "certificate-review", "Confirm SSL certificate or database TLS requirements outside this app.");
    }
    if (toNumber(accessSummary.passwordLikely) > 0) {
      addReason("review", "password-session-review", "Confirm password or browser-session access outside this app without storing secrets.");
    }
    if (toNumber(accessSummary.tokenLikely) > 0) {
      addReason("review", "token-oauth-review", "Confirm provider token or OAuth access outside this app without storing tokens.");
    }
    if (toNumber(accessSummary.sshKeyLikely) > 0) {
      addReason("review", "ssh-key-review", "Confirm SSH key availability through ssh-agent before repository ingestion.");
    }

    const decision = reasons.some((reason) => reason.severity === "hold")
      ? "hold"
      : reasons.length
        ? "review"
        : "ready";
    const recommendedAction = decision === "hold"
      ? reasons.find((reason) => reason.severity === "hold")?.message || "Resolve access hold reasons before ingestion."
      : decision === "review"
        ? "Review the listed access requirements, then proceed only after credentials/certificates are configured outside this app."
        : "Proceed with Data Sources ingestion; continue storing secrets outside this app.";
    const payload = {
      generatedAt: new Date().toISOString(),
      decision,
      recommendedAction,
      reasons,
      total: toNumber(summary.total),
      ready: toNumber(summary.ready),
      review: toNumber(summary.review),
      blocked: toNumber(summary.blocked),
      tokenLikely: toNumber(accessSummary.tokenLikely),
      passwordLikely: toNumber(accessSummary.passwordLikely),
      certificateLikely: toNumber(accessSummary.certificateLikely),
      sshKeyLikely: toNumber(accessSummary.sshKeyLikely),
      checklist,
      accessRequirements
    };

    return {
      ...payload,
      markdown: buildSourcesAccessGateMarkdown(payload)
    };
  }

  async function createGovernanceSnapshotWithDataSources(persisted, inventory) {
    const [dataSourcesAccessGate, dataSourcesAccessReviewQueue, dataSourcesAccessValidationRunbook, releaseBuildGate] = await Promise.all([
      createSourcesAccessGatePayload(),
      createSourcesAccessReviewQueuePayload(),
      createSourcesAccessValidationRunbookPayload(),
      createReleaseBuildGatePayload(persisted)
    ]);
    const dataSourcesAccessValidationEvidenceCoverage = await createSourcesAccessValidationEvidenceCoveragePayload(persisted, dataSourcesAccessValidationRunbook);
    return {
      governance: buildGovernanceSnapshot(persisted, inventory, {
        dataSourcesAccessGate,
        dataSourcesAccessReviewQueue,
        dataSourcesAccessValidationRunbook,
        dataSourcesAccessValidationEvidenceCoverage,
        releaseBuildGate
      }),
      dataSourcesAccessGate,
      dataSourcesAccessReviewQueue,
      dataSourcesAccessValidationRunbook,
      dataSourcesAccessValidationEvidenceCoverage,
      releaseBuildGate
    };
  }

  async function createSourcesSummarySnapshotRecord(payload = {}) {
    const summaryPayload = await createSourcesSummaryPayload();
    const title = String(payload.title || "Data Sources Health Summary").trim() || "Data Sources Health Summary";
    return {
      id: createId("data-source-health-snapshot"),
      title,
      total: toNumber(summaryPayload.summary.total),
      ready: toNumber(summaryPayload.summary.ready),
      review: toNumber(summaryPayload.summary.review),
      blocked: toNumber(summaryPayload.summary.blocked),
      local: toNumber(summaryPayload.summary.local),
      remote: toNumber(summaryPayload.summary.remote),
      typeCounts: summaryPayload.summary.typeCounts || {},
      markdown: summaryPayload.markdown,
      sources: summaryPayload.sources,
      payload: summaryPayload,
      createdAt: new Date().toISOString()
    };
  }

  function buildSourcesSummarySnapshotDiffMarkdown(payload) {
    const formatDriftValue = (value) => typeof value === "number" ? String(value) : toText(value);
    const lines = [
      "# Data Sources Snapshot Drift",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Snapshot: ${toText(payload.snapshotTitle) || "missing"}`,
      `Drift severity: ${toText(payload.driftSeverity) || "none"}`,
      `Drift score: ${toNumber(payload.driftScore)}`,
      `Recommended action: ${toText(payload.recommendedAction) || "No action required."}`,
      "",
      "## Drift Items"
    ];

    const driftItems = Array.isArray(payload.driftItems) ? payload.driftItems : [];
    if (!driftItems.length) {
      lines.push("- No source-health drift detected.");
      return lines.join("\n");
    }

    for (const item of driftItems) {
      const record = toControlPlaneRecord(item);
      lines.push(`- ${toText(record.label) || toText(record.field) || "Source drift"}: ${formatDriftValue(record.before)} -> ${formatDriftValue(record.current)}`);
    }

    return lines.join("\n");
  }

  function createMissingSourcesSummarySnapshotDiffPayload() {
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: false,
      snapshotId: "",
      snapshotTitle: "",
      snapshotCreatedAt: "",
      hasDrift: false,
      driftScore: 0,
      driftSeverity: "missing-snapshot",
      recommendedAction: "Save a Data Sources health snapshot before comparing source-health drift.",
      driftItems: [],
      liveSummary: null,
      snapshotSummary: null
    };
    return {
      ...payload,
      markdown: buildSourcesSummarySnapshotDiffMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} snapshot
   * @param {Awaited<ReturnType<typeof createSourcesSummaryPayload>>} live
   */
  function createSourcesSummarySnapshotDiffPayload(snapshot, live) {
    const driftItems = [];
    const snapshotSummary = toControlPlaneRecord(snapshot.payload).summary && typeof toControlPlaneRecord(snapshot.payload).summary === "object"
      ? toControlPlaneRecord(toControlPlaneRecord(snapshot.payload).summary)
      : {
          total: toNumber(snapshot.total),
          ready: toNumber(snapshot.ready),
          review: toNumber(snapshot.review),
          blocked: toNumber(snapshot.blocked),
          local: toNumber(snapshot.local),
          remote: toNumber(snapshot.remote)
        };
    const liveSummary = live.summary;
    const countFields = [
      { field: "total", label: "Total sources" },
      { field: "ready", label: "Ready sources" },
      { field: "review", label: "Review sources" },
      { field: "blocked", label: "Blocked sources" },
      { field: "local", label: "Local sources" },
      { field: "remote", label: "Remote sources" }
    ];

    for (const item of countFields) {
      const before = toNumber(snapshotSummary[item.field]);
      const current = toNumber(liveSummary[item.field]);
      if (before !== current) {
        driftItems.push({
          field: item.field,
          label: item.label,
          before,
          current,
          delta: current - before
        });
      }
    }

    const snapshotSources = Array.isArray(snapshot.sources) ? snapshot.sources.map(toControlPlaneRecord) : [];
    const liveSources = Array.isArray(live.sources) ? live.sources.map(toControlPlaneRecord) : [];
    const sourceKey = (source) => toText(source.id) || `${toText(source.type)}:${toText(source.value)}`;
    const snapshotByKey = new Map(snapshotSources.map((source) => [sourceKey(source), source]));
    const liveByKey = new Map(liveSources.map((source) => [sourceKey(source), source]));

    for (const [key, source] of liveByKey) {
      const previous = snapshotByKey.get(key);
      if (!previous) {
        driftItems.push({
          field: `source:${key}`,
          label: `${toText(source.label) || key} added`,
          before: "missing",
          current: `${toText(source.health) || "review"} / ${toText(source.status) || "registered"}`,
          delta: 1
        });
        continue;
      }
      const beforeHealth = toText(previous.health) || "review";
      const currentHealth = toText(source.health) || "review";
      const beforeStatus = toText(previous.status) || "registered";
      const currentStatus = toText(source.status) || "registered";
      if (beforeHealth !== currentHealth || beforeStatus !== currentStatus) {
        driftItems.push({
          field: `source:${key}`,
          label: toText(source.label) || key,
          before: `${beforeHealth} / ${beforeStatus}`,
          current: `${currentHealth} / ${currentStatus}`,
          delta: 0
        });
      }
    }

    for (const [key, source] of snapshotByKey) {
      if (!liveByKey.has(key)) {
        driftItems.push({
          field: `source:${key}`,
          label: `${toText(source.label) || key} removed`,
          before: `${toText(source.health) || "review"} / ${toText(source.status) || "registered"}`,
          current: "missing",
          delta: -1
        });
      }
    }

    const driftScore = driftItems.reduce((total, item) => total + Math.max(1, Math.abs(toNumber(item.delta))), 0);
    const blockedDelta = toNumber(liveSummary.blocked) - toNumber(snapshotSummary.blocked);
    const driftSeverity = !driftItems.length
      ? "none"
      : blockedDelta > 0
        ? "high"
        : driftScore >= 5
          ? "medium"
          : "low";
    const recommendedAction = driftSeverity === "high"
      ? "Review blocked Data Sources before trusting downstream app-management actions."
      : driftSeverity === "medium"
        ? "Review source-health drift and refresh the baseline snapshot if the changes are intentional."
        : driftSeverity === "low"
          ? "Monitor low source-health drift and refresh the snapshot after confirming it is expected."
          : "No source-health drift detected.";
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: true,
      snapshotId: toText(snapshot.id),
      snapshotTitle: toText(snapshot.title) || "Data Sources Health Summary",
      snapshotCreatedAt: toText(snapshot.createdAt),
      hasDrift: driftItems.length > 0,
      driftScore,
      driftSeverity,
      recommendedAction,
      driftItems,
      liveSummary,
      snapshotSummary
    };

    return {
      ...payload,
      markdown: buildSourcesSummarySnapshotDiffMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildSourcesAccessTaskLedgerSnapshotDiffMarkdown(payload) {
    const formatDriftValue = (value) => typeof value === "number" ? String(value) : toText(value);
    const lines = [
      "# Data Sources Access Task Ledger Snapshot Drift",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Snapshot: ${toText(payload.snapshotTitle) || "missing"}`,
      `Drift severity: ${toText(payload.driftSeverity) || "none"}`,
      `Drift score: ${toNumber(payload.driftScore)}`,
      `Recommended action: ${toText(payload.recommendedAction) || "No action required."}`,
      "",
      "## Drift Items"
    ];

    const driftItems = Array.isArray(payload.driftItems) ? payload.driftItems : [];
    if (!driftItems.length) {
      lines.push("- No source-access task ledger drift detected.");
      return lines.join("\n");
    }

    for (const item of driftItems) {
      const record = toControlPlaneRecord(item);
      lines.push(`- ${toText(record.label) || toText(record.field) || "Source access task drift"}: ${formatDriftValue(record.before)} -> ${formatDriftValue(record.current)}`);
    }

    return lines.join("\n");
  }

  function createMissingSourcesAccessTaskLedgerSnapshotDiffPayload() {
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: false,
      snapshotId: "",
      snapshotTitle: "",
      snapshotCreatedAt: "",
      hasDrift: false,
      driftScore: 0,
      driftSeverity: "missing-snapshot",
      recommendedAction: "Save a Data Sources access task ledger snapshot before comparing source-access task drift.",
      driftItems: [],
      liveSummary: null,
      snapshotSummary: null
    };
    return {
      ...payload,
      markdown: buildSourcesAccessTaskLedgerSnapshotDiffMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} snapshot
   * @param {ReturnType<typeof createSourcesAccessTaskLedgerPayload>} live
   */
  function createSourcesAccessTaskLedgerSnapshotDiffPayload(snapshot, live) {
    const driftItems = [];
    const snapshotSummary = {
      total: toNumber(snapshot.total),
      open: toNumber(snapshot.openCount),
      closed: toNumber(snapshot.closedCount),
      visible: toNumber(snapshot.visibleCount)
    };
    const liveSummary = toControlPlaneRecord(live.summary);
    const countFields = [
      { field: "total", label: "Total source-access tasks" },
      { field: "open", label: "Open source-access tasks" },
      { field: "closed", label: "Closed source-access tasks" },
      { field: "visible", label: "Visible source-access tasks" }
    ];

    for (const item of countFields) {
      const before = toNumber(snapshotSummary[item.field]);
      const current = toNumber(liveSummary[item.field]);
      if (before !== current) {
        driftItems.push({
          field: item.field,
          label: item.label,
          before,
          current,
          delta: current - before
        });
      }
    }

    const snapshotTasks = Array.isArray(snapshot.items) ? snapshot.items.map(toControlPlaneRecord) : [];
    const liveTasks = Array.isArray(live.items) ? live.items.map(toControlPlaneRecord) : [];
    const taskKey = (task) => toText(task.id) || toText(task.sourceAccessReviewId) || `${toText(task.sourceLabel)}:${toText(task.accessMethod)}`;
    const snapshotByKey = new Map(snapshotTasks.map((task) => [taskKey(task), task]));
    const liveByKey = new Map(liveTasks.map((task) => [taskKey(task), task]));

    for (const [key, task] of liveByKey) {
      const previous = snapshotByKey.get(key);
      const label = toText(task.title) || toText(task.sourceLabel) || key;
      if (!previous) {
        driftItems.push({
          field: `source-access-task:${key}`,
          label: `${label} added`,
          before: "missing",
          current: `${toText(task.status) || "open"} / ${toText(task.priority) || "normal"} / ${toText(task.accessMethod) || "review-required"}`,
          delta: 1
        });
        continue;
      }
      const beforeState = `${toText(previous.status) || "open"} / ${toText(previous.priority) || "normal"} / ${toText(previous.accessMethod) || "review-required"}`;
      const currentState = `${toText(task.status) || "open"} / ${toText(task.priority) || "normal"} / ${toText(task.accessMethod) || "review-required"}`;
      if (beforeState !== currentState) {
        driftItems.push({
          field: `source-access-task:${key}`,
          label,
          before: beforeState,
          current: currentState,
          delta: toText(previous.status) === toText(task.status) ? 0 : 1
        });
      }
    }

    for (const [key, task] of snapshotByKey) {
      if (!liveByKey.has(key)) {
        driftItems.push({
          field: `source-access-task:${key}`,
          label: `${toText(task.title) || toText(task.sourceLabel) || key} removed`,
          before: `${toText(task.status) || "open"} / ${toText(task.priority) || "normal"} / ${toText(task.accessMethod) || "review-required"}`,
          current: "missing",
          delta: -1
        });
      }
    }

    const driftScore = driftItems.reduce((total, item) => total + Math.max(1, Math.abs(toNumber(item.delta))), 0);
    const openDelta = toNumber(liveSummary.open) - toNumber(snapshotSummary.open);
    const driftSeverity = !driftItems.length
      ? "none"
      : openDelta > 0
        ? "high"
        : driftScore >= 5
          ? "medium"
          : "low";
    const recommendedAction = driftSeverity === "high"
      ? "Review new open Data Sources access tasks before supervised app-management work."
      : driftSeverity === "medium"
        ? "Review source-access task ledger drift and refresh the snapshot if changes are intentional."
        : driftSeverity === "low"
          ? "Monitor low source-access task drift and refresh the snapshot after confirmation."
          : "No source-access task ledger drift detected.";
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: true,
      snapshotId: toText(snapshot.id),
      snapshotTitle: toText(snapshot.title) || "Data Sources Access Task Ledger",
      snapshotCreatedAt: toText(snapshot.createdAt),
      hasDrift: driftItems.length > 0,
      driftScore,
      driftSeverity,
      recommendedAction,
      driftItems,
      liveSummary,
      snapshotSummary
    };

    return {
      ...payload,
      markdown: buildSourcesAccessTaskLedgerSnapshotDiffMarkdown(payload)
    };
  }

  async function getDiagnosticsPayload() {
    const sources = await getSourcesPayload();
    const persisted = await store.readStore();
    let historyEntries = [];
    try {
      historyEntries = await readdir(join(resolvedPublicDir, "history"));
    } catch {
      historyEntries = [];
    }

    const inventory = await getInventoryPayload();
    let hasStoreFile = false;
    let hasDatabaseFile = false;
    try {
      await stat(store.storeFile);
      hasStoreFile = true;
    } catch {}
    try {
      await stat(store.dbFile);
      hasDatabaseFile = true;
    } catch {}

    return {
      rootDir: resolvedRootDir,
      publicDir: resolvedPublicDir,
      inventoryGeneratedAt: inventory.generatedAt || null,
      totalProjects: inventory.summary?.totalApps ?? 0,
      historySnapshots: historyEntries.filter((entry) => entry.startsWith("inventory-") && entry.endsWith(".json")).length,
      sourceCount: sources.length,
      deploymentSmokeCheckCount: Array.isArray(persisted.deploymentSmokeChecks) ? persisted.deploymentSmokeChecks.length : 0,
      releaseCheckpointCount: Array.isArray(persisted.releaseCheckpoints) ? persisted.releaseCheckpoints.length : 0,
      dataSourceHealthSnapshotCount: Array.isArray(persisted.dataSourceHealthSnapshots) ? persisted.dataSourceHealthSnapshots.length : 0,
      dataSourceAccessValidationEvidenceCount: Array.isArray(persisted.dataSourceAccessValidationEvidence) ? persisted.dataSourceAccessValidationEvidence.length : 0,
      dataSourceAccessValidationEvidenceSnapshotCount: Array.isArray(persisted.dataSourceAccessValidationEvidenceSnapshots) ? persisted.dataSourceAccessValidationEvidenceSnapshots.length : 0,
      findingsCount: persisted.findings.length,
      taskCount: persisted.tasks.length,
      workflowCount: persisted.workflows.length,
      noteCount: persisted.notes.length,
      milestoneCount: persisted.milestones.length,
      projectProfileCount: Array.isArray(persisted.projectProfiles) ? persisted.projectProfiles.length : 0,
      projectProfileHistoryCount: Array.isArray(persisted.projectProfileHistory) ? persisted.projectProfileHistory.length : 0,
      queueSuppressionCount: Array.isArray(persisted.queueSuppressions) ? persisted.queueSuppressions.length : 0,
      governanceOperationCount: Array.isArray(persisted.governanceOperations) ? persisted.governanceOperations.length : 0,
      scriptRunCount: Array.isArray(persisted.scriptRuns) ? persisted.scriptRuns.length : 0,
      agentSessionCount: Array.isArray(persisted.agentSessions) ? persisted.agentSessions.length : 0,
      agentControlPlaneSnapshotCount: Array.isArray(persisted.agentControlPlaneSnapshots) ? persisted.agentControlPlaneSnapshots.length : 0,
      agentControlPlaneBaselineSnapshotId: toText(persisted.agentControlPlaneBaselineSnapshotId),
      agentWorkOrderSnapshotCount: Array.isArray(persisted.agentWorkOrderSnapshots) ? persisted.agentWorkOrderSnapshots.length : 0,
      agentExecutionSlaLedgerSnapshotCount: Array.isArray(persisted.agentExecutionSlaLedgerSnapshots) ? persisted.agentExecutionSlaLedgerSnapshots.length : 0,
      agentWorkOrderRunCount: Array.isArray(persisted.agentWorkOrderRuns) ? persisted.agentWorkOrderRuns.length : 0,
      governanceExecutionViewCount: Array.isArray(persisted.governanceExecutionViews) ? persisted.governanceExecutionViews.length : 0,
      governanceExecutionPolicy: normalizeAgentExecutionPolicy(persisted.governanceExecutionPolicy),
      scanRunCount: persisted.scanRuns.length,
      hasInventoryFile: true,
      hasBootstrappedShell: true,
      databaseFile: store.dbFile,
      hasDatabaseFile,
      storeFile: store.storeFile,
      hasStoreFile,
      lastFindingsRefreshAt: persisted.meta?.lastFindingsRefreshAt || null,
      latestScanAt: persisted.scanRuns[0]?.generatedAt || null
    };
  }

  async function getInventoryPayload() {
    try {
      const raw = await readFile(inventoryFile, "utf8");
      return JSON.parse(raw);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }

      const result = await generateAudit({
        rootDir: resolvedRootDir,
        outputDir: resolvedPublicDir
      });
      return result.payload;
    }
  }

  return createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const { pathname } = requestUrl;

    if (req.method === "POST" && pathname === "/api/open") {
      try {
        const body = await readRequestBody(req);
        const { path: relPath } = JSON.parse(body);
        const absPath = resolve(resolvedRootDir, relPath);

        if (!isWithin(resolvedRootDir, absPath)) {
          return sendJson(res, 403, { error: "Forbidden path" });
        }

        await openInCursor(absPath);
        return sendJson(res, 200, { success: true });
      } catch (error) {
        return sendJson(res, 500, { error: error.message || "Invalid request" });
      }
    }

    if (req.method === "GET" && pathname === "/api/history") {
      try {
        const persisted = await store.readStore();
        if (persisted.scanRuns.length) {
          return sendJson(res, 200, persisted.scanRuns.slice().reverse().map((scanRun) => ({
            date: String(scanRun.generatedAt || "").slice(0, 10),
            generatedAt: scanRun.generatedAt,
            summary: scanRun.summary
          })));
        }

        let entries = [];
        try {
          entries = await readdir(join(resolvedPublicDir, "history"));
        } catch {
          entries = [];
        }

        const historyFiles = entries
          .filter((entry) => entry.startsWith("inventory-") && entry.endsWith(".json"))
          .sort();

        const historyData = [];
        for (const file of historyFiles) {
          const raw = await readFile(join(resolvedPublicDir, "history", file), "utf8");
          historyData.push({
            date: file.replace("inventory-", "").replace(".json", ""),
            summary: JSON.parse(raw)
          });
        }

        return sendJson(res, 200, historyData);
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/scans/diff") {
      try {
        const persisted = await store.readStore();
        return sendJson(res, 200, buildScanDiff(persisted.scanRuns));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/scans") {
      try {
        const persisted = await store.readStore();
        return sendJson(res, 200, persisted.scanRuns);
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/inventory") {
      try {
        const payload = await getInventoryPayload();
        return sendJson(res, 200, payload);
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/diagnostics") {
      try {
        return sendJson(res, 200, await getDiagnosticsPayload());
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/governance") {
      try {
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        const { governance } = await createGovernanceSnapshotWithDataSources(persisted, inventory);
        return sendJson(res, 200, governance);
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/governance/task-update-ledger") {
      try {
        const persisted = await store.readStore();
        return sendJson(res, 200, createGovernanceTaskUpdateLedgerPayload(persisted, {
          limit: Number(requestUrl.searchParams.get("limit") || 100)
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/governance/task-update-ledger-snapshots/diff") {
      try {
        const snapshotId = String(requestUrl.searchParams.get("snapshotId") || "latest").trim() || "latest";
        const persisted = await store.readStore();
        const snapshots = Array.isArray(persisted.governanceTaskUpdateLedgerSnapshots)
          ? persisted.governanceTaskUpdateLedgerSnapshots.map(toControlPlaneRecord)
          : [];
        const snapshot = snapshotId === "latest"
          ? snapshots[0]
          : snapshots.find((item) => toText(item.id) === snapshotId);
        if (!snapshot) {
          return sendJson(res, 200, createMissingGovernanceTaskUpdateLedgerSnapshotDiffPayload());
        }
        return sendJson(res, 200, createGovernanceTaskUpdateLedgerSnapshotDiffPayload(snapshot, createGovernanceTaskUpdateLedgerPayload(persisted, {
          limit: Number(snapshot.limit || 100)
        })));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (pathname === "/api/governance/task-update-ledger-snapshots") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const snapshots = Array.isArray(persisted.governanceTaskUpdateLedgerSnapshots) ? persisted.governanceTaskUpdateLedgerSnapshots : [];
          return sendJson(res, 200, snapshots.slice(0, 50));
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = body ? JSON.parse(body) : {};
          const persisted = await store.readStore();
          const snapshot = createGovernanceTaskUpdateLedgerSnapshotRecord(persisted, {
            title: toText(payload.title) || "Governance Task Update Ledger",
            limit: Number(payload.limit || 100)
          });

          const updated = await store.updateStore((current) => appendGovernanceOperations({
            ...current,
            governanceTaskUpdateLedgerSnapshots: [snapshot, ...(Array.isArray(current.governanceTaskUpdateLedgerSnapshots) ? current.governanceTaskUpdateLedgerSnapshots : [])].slice(0, 100)
          }, [
            createGovernanceOperation(
              "governance-task-update-ledger-snapshot-created",
              `Saved ${snapshot.title} Governance task update ledger snapshot.`,
              {
                snapshotId: snapshot.id,
                snapshotTitle: snapshot.title,
                total: snapshot.total,
                visibleCount: snapshot.visibleCount,
                statusChangeCount: snapshot.statusChangeCount,
                metadataUpdateCount: snapshot.metadataUpdateCount,
                taskCount: snapshot.taskCount,
                projectCount: snapshot.projectCount
              }
            )
          ]));

          return sendJson(res, 200, {
            success: true,
            snapshot,
            governanceTaskUpdateLedgerSnapshots: updated.governanceTaskUpdateLedgerSnapshots
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid Governance task update ledger snapshot request" });
        }
      }
    }

    if (pathname === "/api/governance/execution-views") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const views = Array.isArray(persisted.governanceExecutionViews) ? persisted.governanceExecutionViews : [];
          return sendJson(res, 200, views.slice(0, 50));
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = body ? JSON.parse(body) : {};
          const allowedScopes = new Set(["all", "registry", "queue", "operations", "runbook", "agents", "data-sources", "readiness", "work-orders", "execution", "sla-ledger", "history", "activity", "decisions", "milestones", "workflows"]);
          const allowedSorts = new Set(["recent", "project", "owner", "status"]);
          const allowedStatuses = new Set(["all", "active", "completed", "sla-breached", "sla-resolved", "queued", "running", "blocked", "passed", "failed", "cancelled"]);
          const rawRetention = Number(payload.executionRetention ?? 25);
          const executionRetention = Number.isFinite(rawRetention) ? Math.max(0, Math.min(100, Math.floor(rawRetention))) : 25;
          const title = String(payload.title || "").trim();
          const now = new Date().toISOString();
          const view = {
            id: createId("governance-execution-view"),
            title: title || `Execution view ${now}`,
            search: String(payload.search || "").trim().slice(0, 120),
            scope: allowedScopes.has(String(payload.scope || "")) ? String(payload.scope) : "execution",
            sort: allowedSorts.has(String(payload.sort || "")) ? String(payload.sort) : "recent",
            executionStatus: allowedStatuses.has(String(payload.executionStatus || "")) ? String(payload.executionStatus) : "all",
            executionRetention,
            showArchivedExecution: Boolean(payload.showArchivedExecution),
            createdAt: now,
            updatedAt: now
          };

          const updated = await store.updateStore((current) => appendGovernanceOperations({
            ...current,
            governanceExecutionViews: [
              view,
              ...(Array.isArray(current.governanceExecutionViews) ? current.governanceExecutionViews : [])
                .filter((item) => toText(item.title).toLowerCase() !== view.title.toLowerCase())
            ].slice(0, 50)
          }, [
            createGovernanceOperation(
              "governance-execution-view-saved",
              `Saved Governance execution view "${view.title}".`,
              {
                viewId: view.id,
                title: view.title,
                executionStatus: view.executionStatus,
                executionRetention: view.executionRetention,
                showArchivedExecution: view.showArchivedExecution,
                scope: view.scope,
                sort: view.sort
              }
            )
          ]));

          return sendJson(res, 200, {
            success: true,
            view,
            governanceExecutionViews: updated.governanceExecutionViews
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    if (pathname === "/api/governance/execution-policy") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          return sendJson(res, 200, normalizeAgentExecutionPolicy(persisted.governanceExecutionPolicy));
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = body ? JSON.parse(body) : {};
          const previous = normalizeAgentExecutionPolicy((await store.readStore()).governanceExecutionPolicy);
          const now = new Date().toISOString();
          const nextPolicy = normalizeAgentExecutionPolicy({
            ...previous,
            ...payload,
            staleStatuses: DEFAULT_AGENT_EXECUTION_POLICY.staleStatuses,
            terminalStatuses: DEFAULT_AGENT_EXECUTION_POLICY.terminalStatuses,
            updatedAt: now
          });

          const updated = await store.updateStore((current) => appendGovernanceOperations({
            ...current,
            governanceExecutionPolicy: nextPolicy
          }, [
            createGovernanceOperation(
              "governance-execution-policy-saved",
              `Saved Agent Execution SLA policy with ${nextPolicy.staleThresholdHours}h stale threshold.`,
              {
                previousStaleThresholdHours: previous.staleThresholdHours,
                staleThresholdHours: nextPolicy.staleThresholdHours,
                staleStatuses: nextPolicy.staleStatuses
              }
            )
          ]));

          return sendJson(res, 200, {
            success: true,
            policy: normalizeAgentExecutionPolicy(updated.governanceExecutionPolicy)
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    if (req.method === "GET" && pathname === "/api/agent-work-orders") {
      try {
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        const governance = buildGovernanceSnapshot(persisted, inventory);
        return sendJson(res, 200, createAgentWorkOrdersPayload(governance, {
          status: requestUrl.searchParams.get("status") || "all",
          limit: Number(requestUrl.searchParams.get("limit") || 24)
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/agent-control-plane") {
      try {
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        const { governance, dataSourcesAccessGate, dataSourcesAccessReviewQueue, dataSourcesAccessValidationRunbook, releaseBuildGate } = await createGovernanceSnapshotWithDataSources(persisted, inventory);
        return sendJson(res, 200, createAgentControlPlanePayload(governance, {
          limit: Number(requestUrl.searchParams.get("limit") || 12),
          dataSourcesAccessGate,
          dataSourcesAccessReviewQueue,
          dataSourcesAccessValidationRunbook,
          releaseBuildGate
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/agent-control-plane/decision") {
      try {
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        const { governance, dataSourcesAccessGate, dataSourcesAccessReviewQueue, dataSourcesAccessValidationRunbook, releaseBuildGate } = await createGovernanceSnapshotWithDataSources(persisted, inventory);
        return sendJson(res, 200, createAgentControlPlaneDecisionPayload(governance, {
          dataSourcesAccessGate,
          dataSourcesAccessReviewQueue,
          dataSourcesAccessValidationRunbook,
          releaseBuildGate
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/agent-control-plane/decision/task-ledger") {
      try {
        const persisted = await store.readStore();
        return sendJson(res, 200, createAgentControlPlaneDecisionTaskLedgerPayload(persisted, {
          status: requestUrl.searchParams.get("status") || "all",
          limit: Number(requestUrl.searchParams.get("limit") || 100)
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/agent-control-plane/decision/task-ledger-snapshots/diff") {
      try {
        const snapshotId = String(requestUrl.searchParams.get("snapshotId") || "latest").trim() || "latest";
        const persisted = await store.readStore();
        const snapshots = Array.isArray(persisted.agentControlPlaneDecisionTaskLedgerSnapshots)
          ? persisted.agentControlPlaneDecisionTaskLedgerSnapshots.map(toControlPlaneRecord)
          : [];
        const snapshot = snapshotId === "latest"
          ? snapshots[0]
          : snapshots.find((item) => toText(item.id) === snapshotId);
        if (!snapshot) {
          return sendJson(res, 200, createMissingAgentControlPlaneDecisionTaskLedgerSnapshotDiffPayload());
        }
        return sendJson(res, 200, createAgentControlPlaneDecisionTaskLedgerSnapshotDiffPayload(snapshot, createAgentControlPlaneDecisionTaskLedgerPayload(persisted, {
          status: toText(snapshot.statusFilter) || "all",
          limit: Number(snapshot.limit || 100)
        })));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (pathname === "/api/agent-control-plane/decision/task-ledger-snapshots") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const snapshots = Array.isArray(persisted.agentControlPlaneDecisionTaskLedgerSnapshots) ? persisted.agentControlPlaneDecisionTaskLedgerSnapshots : [];
          return sendJson(res, 200, snapshots.slice(0, 50));
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = body ? JSON.parse(body) : {};
          const persisted = await store.readStore();
          const snapshot = createAgentControlPlaneDecisionTaskLedgerSnapshotRecord(persisted, {
            title: toText(payload.title) || "Agent Control Plane Decision Task Ledger",
            status: toText(payload.status) || "all",
            limit: Number(payload.limit || 100)
          });

          const updated = await store.updateStore((current) => appendGovernanceOperations({
            ...current,
            agentControlPlaneDecisionTaskLedgerSnapshots: [snapshot, ...(Array.isArray(current.agentControlPlaneDecisionTaskLedgerSnapshots) ? current.agentControlPlaneDecisionTaskLedgerSnapshots : [])].slice(0, 100)
          }, [
            createGovernanceOperation(
              "agent-control-plane-decision-task-ledger-snapshot-created",
              `Saved ${snapshot.title} Agent Control Plane decision task ledger snapshot.`,
              {
                snapshotId: snapshot.id,
                snapshotTitle: snapshot.title,
                statusFilter: snapshot.statusFilter,
                total: snapshot.total,
                openCount: snapshot.openCount,
                closedCount: snapshot.closedCount,
                reasonCount: snapshot.reasonCount
              }
            )
          ]));

          return sendJson(res, 200, {
            success: true,
            snapshot,
            agentControlPlaneDecisionTaskLedgerSnapshots: updated.agentControlPlaneDecisionTaskLedgerSnapshots
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid Agent Control Plane decision task ledger snapshot request" });
        }
      }
    }

    if (req.method === "POST" && pathname === "/api/agent-control-plane/decision/tasks") {
      try {
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        const { governance, dataSourcesAccessGate, dataSourcesAccessReviewQueue, dataSourcesAccessValidationRunbook, releaseBuildGate } = await createGovernanceSnapshotWithDataSources(persisted, inventory);
        const decision = createAgentControlPlaneDecisionPayload(governance, {
          dataSourcesAccessGate,
          dataSourcesAccessReviewQueue,
          dataSourcesAccessValidationRunbook,
          releaseBuildGate
        });
        const liveReasons = Array.isArray(decision.reasons) ? decision.reasons.map(toControlPlaneRecord) : [];
        const liveReasonsByCode = new Map(liveReasons.map((reason) => [toText(reason.code), reason]));
        const requestedReasons = (Array.isArray(payload.reasons) && payload.reasons.length ? payload.reasons : liveReasons)
          .map((reason) => {
            const record = toControlPlaneRecord(reason);
            return liveReasonsByCode.get(toText(record.code)) || record;
          })
          .filter((reason) => toText(reason.code));

        if (!requestedReasons.length) {
          return sendJson(res, 400, { error: "At least one Agent Control Plane decision reason is required" });
        }

        /** @type {Record<string, unknown>[]} */
        const createdTasks = [];
        /** @type {Array<{ code: string, reason: string }>} */
        const skipped = [];
        const shouldCaptureSnapshot = payload.saveSnapshot === true || payload.captureSnapshot === true || payload.autoCaptureSnapshot === true;
        /** @type {Record<string, unknown> | null} */
        let capturedSnapshot = null;
        const updated = await store.updateStore((current) => {
          const tasks = Array.isArray(current.tasks) ? current.tasks : [];
          let nextTasks = tasks;

          for (const reason of requestedReasons) {
            const reasonCode = toText(reason.code);
            const title = `Control Plane decision: ${reasonCode}`;
            const exists = nextTasks.some((task) => (
              toText(task.agentControlPlaneDecisionReasonCode) === reasonCode
              || (toText(task.projectId) === "agent-control-plane" && toText(task.title) === title)
            ));

            if (exists) {
              skipped.push({ code: reasonCode, reason: "Task already exists" });
              continue;
            }

            const task = createAgentControlPlaneDecisionReasonTask(reason, decision);
            createdTasks.push(task);
            nextTasks = [...nextTasks, task];
          }

          let nextState = {
            ...current,
            tasks: nextTasks
          };
          const operations = [
            createGovernanceOperation(
              "agent-control-plane-decision-tasks-created",
              `Created ${createdTasks.length} Agent Control Plane decision task(s).`,
              {
                requested: requestedReasons.length,
                created: createdTasks.length,
                skipped: skipped.length,
                reasonCodes: requestedReasons.map((reason) => toText(reason.code))
              }
            )
          ];

          if (shouldCaptureSnapshot) {
            capturedSnapshot = createAgentControlPlaneDecisionTaskLedgerSnapshotRecord(nextState, {
              title: toText(payload.snapshotTitle) || "Agent Control Plane Decision Task Ledger Auto Capture",
              status: toText(payload.snapshotStatus || payload.status) || "all",
              limit: Number(payload.snapshotLimit || payload.limit || 100)
            });
            nextState = {
              ...nextState,
              agentControlPlaneDecisionTaskLedgerSnapshots: [capturedSnapshot, ...(Array.isArray(current.agentControlPlaneDecisionTaskLedgerSnapshots) ? current.agentControlPlaneDecisionTaskLedgerSnapshots : [])].slice(0, 100)
            };
            operations.push(createGovernanceOperation(
              "agent-control-plane-decision-task-ledger-snapshot-auto-captured",
              `Auto-captured ${toText(capturedSnapshot.title) || "Agent Control Plane Decision Task Ledger"} after decision task seeding.`,
              {
                snapshotId: toText(capturedSnapshot.id),
                snapshotTitle: toText(capturedSnapshot.title),
                statusFilter: toText(capturedSnapshot.statusFilter),
                total: toNumber(capturedSnapshot.total),
                openCount: toNumber(capturedSnapshot.openCount),
                closedCount: toNumber(capturedSnapshot.closedCount),
                reasonCount: toNumber(capturedSnapshot.reasonCount),
                created: createdTasks.length,
                skipped: skipped.length
              }
            ));
          }

          return appendGovernanceOperations(nextState, operations);
        });

        return sendJson(res, 200, {
          success: true,
          requested: requestedReasons.length,
          createdTasks,
          skipped,
          snapshotCaptured: Boolean(capturedSnapshot),
          snapshot: capturedSnapshot,
          totals: {
            requested: requestedReasons.length,
            created: createdTasks.length,
            skipped: skipped.length
          },
          agentControlPlaneDecisionTaskLedgerSnapshots: Array.isArray(updated.agentControlPlaneDecisionTaskLedgerSnapshots) ? updated.agentControlPlaneDecisionTaskLedgerSnapshots : [],
          tasks: updated.tasks
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid Agent Control Plane decision task request" });
      }
    }

    if (pathname === "/api/agent-control-plane/decision-snapshots") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const snapshots = Array.isArray(persisted.agentControlPlaneDecisionSnapshots) ? persisted.agentControlPlaneDecisionSnapshots : [];
          return sendJson(res, 200, snapshots.slice(0, 50));
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = body ? JSON.parse(body) : {};
          const persisted = await store.readStore();
          const inventory = await getInventoryPayload();
          const { governance, dataSourcesAccessGate, dataSourcesAccessReviewQueue, dataSourcesAccessValidationRunbook, releaseBuildGate } = await createGovernanceSnapshotWithDataSources(persisted, inventory);
          const snapshot = createAgentControlPlaneDecisionSnapshotRecord(governance, payload, {
            dataSourcesAccessGate,
            dataSourcesAccessReviewQueue,
            dataSourcesAccessValidationRunbook,
            releaseBuildGate
          });
          const updated = await store.updateStore((current) => appendGovernanceOperations({
            ...current,
            agentControlPlaneDecisionSnapshots: [snapshot, ...(Array.isArray(current.agentControlPlaneDecisionSnapshots) ? current.agentControlPlaneDecisionSnapshots : [])].slice(0, 100)
          }, [
            createGovernanceOperation(
              "agent-control-plane-decision-snapshot-created",
              `Saved ${snapshot.title} as an Agent Control Plane decision snapshot.`,
              {
                snapshotId: snapshot.id,
                decision: snapshot.decision,
                reasonCount: snapshot.reasonCount,
                snapshotCreatedAt: snapshot.createdAt
              }
            )
          ]));

          return sendJson(res, 200, {
            success: true,
            snapshot,
            agentControlPlaneDecisionSnapshots: updated.agentControlPlaneDecisionSnapshots
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    if (req.method === "GET" && pathname === "/api/agent-control-plane/baseline-status") {
      try {
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        const { governance, dataSourcesAccessGate, dataSourcesAccessReviewQueue, dataSourcesAccessValidationRunbook, releaseBuildGate } = await createGovernanceSnapshotWithDataSources(persisted, inventory);
        return sendJson(res, 200, createAgentControlPlaneBaselineStatusPayload(persisted, governance, {
          dataSourcesAccessGate,
          dataSourcesAccessReviewQueue,
          dataSourcesAccessValidationRunbook,
          releaseBuildGate
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/agent-control-plane-snapshots/diff") {
      try {
        const snapshotId = String(requestUrl.searchParams.get("snapshotId") || "").trim();
        if (!snapshotId) {
          return sendJson(res, 400, { error: "snapshotId is required" });
        }
        const persisted = await store.readStore();
        const snapshots = Array.isArray(persisted.agentControlPlaneSnapshots) ? persisted.agentControlPlaneSnapshots : [];
        const snapshotRecords = snapshots.map(toControlPlaneRecord);
        const snapshot = snapshotId === "latest"
          ? snapshotRecords[0]
          : snapshotId === "baseline"
            ? snapshotRecords.find((item) => toText(item.id) === toText(persisted.agentControlPlaneBaselineSnapshotId))
          : snapshotRecords.find((item) => toText(item.id) === snapshotId);
        if (!snapshot) {
          if (snapshotId === "baseline") {
            return sendJson(res, 200, createMissingAgentControlPlaneBaselineDiffPayload());
          }
          return sendJson(res, 404, { error: snapshotId === "baseline" ? "Agent Control Plane baseline snapshot not found" : "Agent Control Plane snapshot not found" });
        }
        const inventory = await getInventoryPayload();
        const { governance, dataSourcesAccessGate, dataSourcesAccessReviewQueue, dataSourcesAccessValidationRunbook, releaseBuildGate } = await createGovernanceSnapshotWithDataSources(persisted, inventory);
        const currentPayload = createAgentControlPlanePayload(governance, {
          limit: Number(snapshot.limit || requestUrl.searchParams.get("limit") || 24),
          dataSourcesAccessGate,
          dataSourcesAccessReviewQueue,
          dataSourcesAccessValidationRunbook,
          releaseBuildGate
        });
        return sendJson(res, 200, createAgentControlPlaneSnapshotDiffPayload(snapshot, currentPayload));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "POST" && pathname === "/api/agent-control-plane-snapshots/baseline") {
      try {
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        const snapshotId = String(payload.snapshotId || "").trim();
        if (!snapshotId) {
          return sendJson(res, 400, { error: "snapshotId is required" });
        }

        let baselineSnapshot = null;
        const updated = await store.updateStore((current) => {
          const snapshots = Array.isArray(current.agentControlPlaneSnapshots) ? current.agentControlPlaneSnapshots.map(toControlPlaneRecord) : [];
          baselineSnapshot = snapshots.find((snapshot) => toText(snapshot.id) === snapshotId) || null;
          if (!baselineSnapshot) {
            throw new Error("Agent Control Plane snapshot not found");
          }

          return appendGovernanceOperations({
            ...current,
            agentControlPlaneBaselineSnapshotId: snapshotId
          }, [
            createGovernanceOperation(
              "agent-control-plane-baseline-set",
              `Set ${toText(baselineSnapshot.title) || "Agent Control Plane"} as the Agent Control Plane baseline snapshot.`,
              {
                snapshotId,
                snapshotTitle: toText(baselineSnapshot.title),
                snapshotCreatedAt: toText(baselineSnapshot.createdAt)
              }
            )
          ]);
        });

        return sendJson(res, 200, {
          success: true,
          baselineSnapshotId: updated.agentControlPlaneBaselineSnapshotId,
          snapshot: baselineSnapshot,
          agentControlPlaneSnapshots: updated.agentControlPlaneSnapshots
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
      }
    }

    if (req.method === "POST" && pathname === "/api/agent-control-plane-snapshots/baseline/clear") {
      try {
        const updated = await store.updateStore((current) => {
          const previousBaselineSnapshotId = toText(current.agentControlPlaneBaselineSnapshotId);
          const snapshots = Array.isArray(current.agentControlPlaneSnapshots) ? current.agentControlPlaneSnapshots.map(toControlPlaneRecord) : [];
          const previousBaselineSnapshot = snapshots.find((snapshot) => toText(snapshot.id) === previousBaselineSnapshotId) || null;
          const nextStore = {
            ...current,
            agentControlPlaneBaselineSnapshotId: ""
          };

          return previousBaselineSnapshotId
            ? appendGovernanceOperations(nextStore, [
                createGovernanceOperation(
                  "agent-control-plane-baseline-cleared",
                  `Cleared ${toText(previousBaselineSnapshot?.title) || "Agent Control Plane"} as the Agent Control Plane baseline snapshot.`,
                  {
                    previousBaselineSnapshotId,
                    previousBaselineSnapshotTitle: toText(previousBaselineSnapshot?.title),
                    previousBaselineSnapshotCreatedAt: toText(previousBaselineSnapshot?.createdAt)
                  }
                )
              ])
            : nextStore;
        });

        return sendJson(res, 200, {
          success: true,
          baselineSnapshotId: "",
          agentControlPlaneSnapshots: updated.agentControlPlaneSnapshots || []
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
      }
    }

    if (req.method === "POST" && pathname === "/api/agent-control-plane-snapshots/baseline/refresh") {
      try {
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        const previousBaselineSnapshotId = toText(persisted.agentControlPlaneBaselineSnapshotId);
        const previousBaselineSnapshot = (Array.isArray(persisted.agentControlPlaneSnapshots) ? persisted.agentControlPlaneSnapshots : [])
          .map(toControlPlaneRecord)
          .find((snapshot) => toText(snapshot.id) === previousBaselineSnapshotId) || null;
        const { governance, dataSourcesAccessGate, dataSourcesAccessReviewQueue, dataSourcesAccessValidationRunbook, releaseBuildGate } = await createGovernanceSnapshotWithDataSources(persisted, inventory);
        const snapshot = createAgentControlPlaneSnapshotRecord(governance, {
          title: payload.title || "Agent Control Plane Baseline Refresh",
          limit: payload.limit || 24
        }, {
          dataSourcesAccessGate,
          dataSourcesAccessReviewQueue,
          dataSourcesAccessValidationRunbook,
          releaseBuildGate
        });

        const updated = await store.updateStore((current) => appendGovernanceOperations({
          ...current,
          agentControlPlaneSnapshots: [snapshot, ...(Array.isArray(current.agentControlPlaneSnapshots) ? current.agentControlPlaneSnapshots : [])].slice(0, 100),
          agentControlPlaneBaselineSnapshotId: snapshot.id
        }, [
          createGovernanceOperation(
            "agent-control-plane-baseline-refreshed",
            `Refreshed the Agent Control Plane baseline with ${snapshot.title}.`,
            {
              snapshotId: snapshot.id,
              snapshotTitle: snapshot.title,
              snapshotCreatedAt: snapshot.createdAt,
              previousBaselineSnapshotId,
              previousBaselineSnapshotTitle: toText(previousBaselineSnapshot?.title),
              previousBaselineSnapshotCreatedAt: toText(previousBaselineSnapshot?.createdAt)
            }
          )
        ]));

        return sendJson(res, 200, {
          success: true,
          baselineSnapshotId: updated.agentControlPlaneBaselineSnapshotId,
          previousBaselineSnapshotId,
          snapshot: {
            ...snapshot,
            isBaseline: true
          },
          agentControlPlaneSnapshots: updated.agentControlPlaneSnapshots
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
      }
    }

    if (pathname === "/api/agent-control-plane-snapshots") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const snapshots = Array.isArray(persisted.agentControlPlaneSnapshots) ? persisted.agentControlPlaneSnapshots : [];
          return sendJson(res, 200, snapshots.slice(0, 50));
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = body ? JSON.parse(body) : {};
          const persisted = await store.readStore();
          const inventory = await getInventoryPayload();
          const makeBaseline = payload.baseline === true;
          const { governance, dataSourcesAccessGate, dataSourcesAccessReviewQueue, dataSourcesAccessValidationRunbook, releaseBuildGate } = await createGovernanceSnapshotWithDataSources(persisted, inventory);
          const snapshot = createAgentControlPlaneSnapshotRecord(governance, payload, {
            dataSourcesAccessGate,
            dataSourcesAccessReviewQueue,
            dataSourcesAccessValidationRunbook,
            releaseBuildGate
          });

          const updated = await store.updateStore((current) => {
            const nextStore = {
              ...current,
              agentControlPlaneSnapshots: [snapshot, ...(Array.isArray(current.agentControlPlaneSnapshots) ? current.agentControlPlaneSnapshots : [])].slice(0, 100),
              ...(makeBaseline ? { agentControlPlaneBaselineSnapshotId: snapshot.id } : {})
            };

            return makeBaseline
              ? appendGovernanceOperations(nextStore, [
                  createGovernanceOperation(
                    "agent-control-plane-baseline-snapshot-created",
                    `Saved ${snapshot.title} as the Agent Control Plane baseline snapshot.`,
                    {
                      snapshotId: snapshot.id,
                      snapshotTitle: snapshot.title,
                      snapshotCreatedAt: snapshot.createdAt
                    }
                  )
                ])
              : nextStore;
          });

          return sendJson(res, 200, {
            success: true,
            snapshot: {
              ...snapshot,
              isBaseline: makeBaseline
            },
            baselineSnapshotId: updated.agentControlPlaneBaselineSnapshotId || "",
            agentControlPlaneSnapshots: updated.agentControlPlaneSnapshots
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    if (req.method === "GET" && pathname === "/api/agent-work-order-runs/sla-ledger") {
      try {
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        const governance = buildGovernanceSnapshot(persisted, inventory);
        return sendJson(res, 200, createAgentExecutionSlaLedgerPayload(governance, {
          state: requestUrl.searchParams.get("state") || "all",
          limit: Number(requestUrl.searchParams.get("limit") || 24)
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (pathname === "/api/agent-work-order-runs/sla-ledger-snapshots") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const snapshots = Array.isArray(persisted.agentExecutionSlaLedgerSnapshots) ? persisted.agentExecutionSlaLedgerSnapshots : [];
          return sendJson(res, 200, snapshots.slice(0, 50));
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = body ? JSON.parse(body) : {};
          const persisted = await store.readStore();
          const inventory = await getInventoryPayload();
          const governance = buildGovernanceSnapshot(persisted, inventory);
          const ledger = createAgentExecutionSlaLedgerPayload(governance, {
            state: String(payload.state || "all"),
            limit: Number(payload.limit || 24)
          });
          const snapshot = {
            id: createId("agent-execution-sla-ledger-snapshot"),
            title: String(payload.title || "SLA Breach Ledger").trim() || "SLA Breach Ledger",
            stateFilter: ledger.state,
            limit: ledger.limit,
            available: ledger.available,
            total: ledger.total,
            openCount: ledger.items.filter((item) => item.breachState === "open").length,
            resolvedCount: ledger.items.filter((item) => item.breachState === "resolved").length,
            markdown: ledger.markdown,
            items: ledger.items,
            createdAt: new Date().toISOString()
          };

          const updated = await store.updateStore((current) => ({
            ...current,
            agentExecutionSlaLedgerSnapshots: [snapshot, ...(Array.isArray(current.agentExecutionSlaLedgerSnapshots) ? current.agentExecutionSlaLedgerSnapshots : [])].slice(0, 100)
          }));

          return sendJson(res, 200, {
            success: true,
            snapshot,
            agentExecutionSlaLedgerSnapshots: updated.agentExecutionSlaLedgerSnapshots
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    if (pathname === "/api/agent-work-order-snapshots") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const snapshots = Array.isArray(persisted.agentWorkOrderSnapshots) ? persisted.agentWorkOrderSnapshots : [];
          return sendJson(res, 200, snapshots.slice(0, 50));
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = body ? JSON.parse(body) : {};
          const persisted = await store.readStore();
          const inventory = await getInventoryPayload();
          const governance = buildGovernanceSnapshot(persisted, inventory);
          const workOrders = createAgentWorkOrdersPayload(governance, {
            status: String(payload.status || "all"),
            limit: Number(payload.limit || 24)
          });
          const snapshot = {
            id: createId("agent-work-order-snapshot"),
            title: String(payload.title || "Agent Work Orders").trim() || "Agent Work Orders",
            statusFilter: workOrders.status,
            total: workOrders.total,
            readyCount: workOrders.items.filter((item) => item.status === "ready").length,
            needsPrepCount: workOrders.items.filter((item) => item.status === "needs-prep").length,
            blockedCount: workOrders.items.filter((item) => item.status === "blocked").length,
            markdown: workOrders.markdown,
            items: workOrders.items,
            createdAt: new Date().toISOString()
          };

          const updated = await store.updateStore((current) => ({
            ...current,
            agentWorkOrderSnapshots: [snapshot, ...(Array.isArray(current.agentWorkOrderSnapshots) ? current.agentWorkOrderSnapshots : [])].slice(0, 100)
          }));

          return sendJson(res, 200, {
            success: true,
            snapshot,
            agentWorkOrderSnapshots: updated.agentWorkOrderSnapshots
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    if (pathname === "/api/agent-work-order-runs") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const runs = Array.isArray(persisted.agentWorkOrderRuns) ? persisted.agentWorkOrderRuns : [];
          const projectId = requestUrl.searchParams.get("projectId");
          const status = requestUrl.searchParams.get("status");
          const snapshotId = requestUrl.searchParams.get("snapshotId");
          const archived = requestUrl.searchParams.get("archived");
          const filteredRuns = runs.filter((run) => {
            if (projectId && run.projectId !== projectId) return false;
            if (status && run.status !== status) return false;
            if (snapshotId && run.snapshotId !== snapshotId) return false;
            if (archived === "true" && !toText(run.archivedAt)) return false;
            if (archived === "false" && toText(run.archivedAt)) return false;
            return true;
          });
          return sendJson(res, 200, filteredRuns.slice(0, 100));
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = JSON.parse(body);
          const now = new Date().toISOString();
          const requestedCreatedAt = new Date(String(payload.createdAt || "")).getTime();
          const requestedUpdatedAt = new Date(String(payload.updatedAt || "")).getTime();
          const createdAt = Number.isFinite(requestedCreatedAt) ? new Date(requestedCreatedAt).toISOString() : now;
          const updatedAt = Number.isFinite(requestedUpdatedAt) ? new Date(requestedUpdatedAt).toISOString() : createdAt;
          const run = {
            id: createId("agent-work-order-run"),
            projectId: String(payload.projectId || "").trim(),
            projectName: String(payload.projectName || "").trim(),
            relPath: String(payload.relPath || "").trim(),
            snapshotId: String(payload.snapshotId || "").trim(),
            title: String(payload.title || "").trim(),
            objective: String(payload.objective || "").trim(),
            status: String(payload.status || "queued").trim() || "queued",
            readinessScore: toNumber(payload.readinessScore),
            readinessStatus: String(payload.readinessStatus || "").trim(),
            blockers: Array.isArray(payload.blockers) ? payload.blockers.map((item) => String(item || "").trim()).filter(Boolean) : [],
            validationCommands: Array.isArray(payload.validationCommands) ? payload.validationCommands.map((item) => String(item || "").trim()).filter(Boolean) : [],
            notes: String(payload.notes || "").trim(),
            history: [createAgentWorkOrderRunEvent(String(payload.status || "queued").trim() || "queued", String(payload.notes || "Queued from Governance.").trim() || "Queued from Governance.")],
            archivedAt: "",
            archivedBy: "",
            slaBreachedAt: "",
            slaResolvedAt: "",
            slaLastActionAt: "",
            slaAction: "",
            slaEscalationCount: 0,
            slaResolutionCount: 0,
            createdAt,
            updatedAt
          };

          if (!run.projectId || !run.projectName) {
            return sendJson(res, 400, { error: "projectId and projectName are required" });
          }
          if (!run.title) {
            run.title = `Agent work order for ${run.projectName}`;
          }
          if (!run.objective) {
            return sendJson(res, 400, { error: "objective is required" });
          }

          const updated = await store.updateStore((current) => appendGovernanceOperations({
            ...current,
            agentWorkOrderRuns: [run, ...(Array.isArray(current.agentWorkOrderRuns) ? current.agentWorkOrderRuns : [])].slice(0, 200)
          }, [
            createGovernanceOperation(
              "agent-work-order-run-created",
              `Queued Agent Work Order run for ${run.projectName}.`,
              {
                runId: run.id,
                projectId: run.projectId,
                projectName: run.projectName,
                status: run.status,
                snapshotId: run.snapshotId
              }
            )
          ]));

          return sendJson(res, 200, {
            success: true,
            run,
            agentWorkOrderRuns: updated.agentWorkOrderRuns
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    if (pathname === "/api/agent-work-order-runs/batch" && req.method === "POST") {
      try {
        const body = await readRequestBody(req);
        const payload = JSON.parse(body);
        const snapshotId = String(payload.snapshotId || "").trim();
        if (!snapshotId) {
          return sendJson(res, 400, { error: "snapshotId is required" });
        }

        let queuedRuns = [];
        let skipped = 0;
        const now = new Date().toISOString();
        const updated = await store.updateStore((current) => {
          const snapshots = Array.isArray(current.agentWorkOrderSnapshots) ? current.agentWorkOrderSnapshots : [];
          const snapshot = snapshots.find((item) => item.id === snapshotId);
          if (!snapshot) {
            throw new Error("Agent Work Order snapshot not found");
          }

          const existingRuns = Array.isArray(current.agentWorkOrderRuns) ? current.agentWorkOrderRuns : [];
          const existingProjectKeys = new Set(existingRuns
            .filter((run) => run.snapshotId === snapshotId)
            .map((run) => `${run.snapshotId}:${run.projectId}`));
          queuedRuns = (Array.isArray(snapshot.items) ? snapshot.items : [])
            .filter((item) => {
              const key = `${snapshotId}:${toText(item.projectId)}`;
              if (existingProjectKeys.has(key)) {
                skipped += 1;
                return false;
              }
              existingProjectKeys.add(key);
              return true;
            })
            .map((item) => ({
              id: createId("agent-work-order-run"),
              projectId: toText(item.projectId),
              projectName: toText(item.projectName),
              relPath: toText(item.relPath),
              snapshotId,
              title: `Agent work order for ${toText(item.projectName) || "Project"}`,
              objective: toText(item.nextStep) || "Review readiness and define the next execution step.",
              status: "queued",
              readinessScore: toNumber(item.score),
              readinessStatus: toText(item.status),
              blockers: Array.isArray(item.blockers) ? item.blockers.map(toText).filter(Boolean) : [],
              validationCommands: ["Run project-specific validation from the workbench Launchpad"],
              notes: `Queued from snapshot ${toText(snapshot.title) || snapshotId}.`,
              history: [createAgentWorkOrderRunEvent("queued", `Queued from snapshot ${toText(snapshot.title) || snapshotId}.`)],
              archivedAt: "",
              archivedBy: "",
              slaBreachedAt: "",
              slaResolvedAt: "",
              slaLastActionAt: "",
              slaAction: "",
              slaEscalationCount: 0,
              slaResolutionCount: 0,
              createdAt: now,
              updatedAt: now
            }))
            .filter((run) => run.projectId && run.projectName);

          const nextStore = {
            ...current,
            agentWorkOrderRuns: [...queuedRuns, ...existingRuns].slice(0, 200)
          };

          return appendGovernanceOperations(nextStore, [
            createGovernanceOperation(
              "agent-work-order-runs-batch-queued",
              `Queued ${queuedRuns.length} Agent Work Order run(s) from ${toText(snapshot.title) || snapshotId}.`,
              {
                snapshotId,
                snapshotTitle: toText(snapshot.title),
                queued: queuedRuns.length,
                skipped
              }
            )
          ]);
        });

        return sendJson(res, 200, {
          success: true,
          queuedRuns,
          skipped,
          agentWorkOrderRuns: updated.agentWorkOrderRuns
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
      }
    }

    if (pathname === "/api/agent-work-order-runs/retention" && req.method === "POST") {
      try {
        const body = await readRequestBody(req);
        const payload = JSON.parse(body);
        const terminalStatuses = new Set(["passed", "failed", "cancelled"]);
        const rawRetainCompleted = Number(payload.retainCompleted ?? 25);
        const retainCompleted = Number.isFinite(rawRetainCompleted)
          ? Math.max(0, Math.min(100, Math.floor(rawRetainCompleted)))
          : 25;
        const requestedRunIds = Array.isArray(payload.runIds)
          ? new Set(payload.runIds.map((item) => String(item || "").trim()).filter(Boolean))
          : null;
        let archivedRuns = [];
        let retainedRuns = 0;
        const now = new Date().toISOString();

        const updated = await store.updateStore((current) => {
          const existingRuns = Array.isArray(current.agentWorkOrderRuns) ? current.agentWorkOrderRuns : [];
          const candidates = existingRuns
            .filter((run) => terminalStatuses.has(toText(run.status)))
            .filter((run) => !toText(run.archivedAt))
            .filter((run) => !requestedRunIds || requestedRunIds.has(toText(run.id)))
            .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime());
          const retainedIds = new Set(candidates.slice(0, retainCompleted).map((run) => toText(run.id)));
          const archiveIds = new Set(candidates.slice(retainCompleted).map((run) => toText(run.id)));
          retainedRuns = retainedIds.size;

          const nextRuns = existingRuns.map((run) => {
            const runId = toText(run.id);
            if (!archiveIds.has(runId)) return run;
            const status = toText(run.status) || "passed";
            const history = Array.isArray(run.history) ? run.history : [];
            const archivedRun = {
              ...run,
              notes: "Archived by Agent Execution retention policy.",
              archivedAt: now,
              archivedBy: "workspace-audit",
              history: [
                createAgentWorkOrderRunEvent(status, `Archived by retention policy after retaining ${retainCompleted} completed run(s).`, status),
                ...history
              ].slice(0, 50),
              updatedAt: now
            };
            archivedRuns.push(archivedRun);
            return archivedRun;
          });

          const nextStore = {
            ...current,
            agentWorkOrderRuns: nextRuns
          };

          return archivedRuns.length
            ? appendGovernanceOperations(nextStore, [
                createGovernanceOperation(
                  "agent-work-order-runs-retention-applied",
                  `Archived ${archivedRuns.length} completed Agent Execution run(s) by retention policy.`,
                  {
                    retainCompleted,
                    visibleRunScope: requestedRunIds ? requestedRunIds.size : "all",
                    archived: archivedRuns.length,
                    retained: retainedRuns,
                    runIds: archivedRuns.map((run) => toText(run.id))
                  }
                )
              ])
            : nextStore;
        });

        return sendJson(res, 200, {
          success: true,
          retainCompleted,
          retained: retainedRuns,
          archivedRuns,
          archived: archivedRuns.length,
          agentWorkOrderRuns: updated.agentWorkOrderRuns
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
      }
    }

    if (pathname === "/api/agent-work-order-runs/sla-breaches" && req.method === "POST") {
      try {
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        const requestedRunIds = Array.isArray(payload.runIds)
          ? new Set(payload.runIds.map((item) => String(item || "").trim()).filter(Boolean))
          : null;
        const action = String(payload.action || "escalated").trim() || "escalated";
        const now = new Date().toISOString();
        let breachedRuns = [];
        let skipped = 0;

        const updated = await store.updateStore((current) => {
          const policy = normalizeAgentExecutionPolicy(current.governanceExecutionPolicy);
          const staleStatuses = new Set(policy.staleStatuses);
          const staleCutoff = Date.now() - (policy.staleThresholdHours * 60 * 60 * 1000);
          const nextRuns = (Array.isArray(current.agentWorkOrderRuns) ? current.agentWorkOrderRuns : []).map((run) => {
            const runId = toText(run.id);
            if (requestedRunIds && !requestedRunIds.has(runId)) return run;
            if (toText(run.archivedAt)) {
              skipped += 1;
              return run;
            }
            const status = toText(run.status) || "queued";
            if (!staleStatuses.has(status)) {
              skipped += 1;
              return run;
            }
            const timestamp = new Date(toText(run.updatedAt || run.createdAt)).getTime();
            if (!Number.isFinite(timestamp) || timestamp >= staleCutoff) {
              skipped += 1;
              return run;
            }

            const history = Array.isArray(run.history) ? run.history : [];
            const nextRun = {
              ...run,
              notes: `SLA breach ${action} from Governance.`,
              slaBreachedAt: toText(run.slaBreachedAt) || now,
              slaResolvedAt: "",
              slaLastActionAt: now,
              slaAction: action,
              slaEscalationCount: toNumber(run.slaEscalationCount) + 1,
              history: [
                createAgentWorkOrderRunEvent(status, `SLA breach ${action}; stale after ${policy.staleThresholdHours}h.`, status),
                ...history
              ].slice(0, 50),
              updatedAt: now
            };
            breachedRuns.push(nextRun);
            return nextRun;
          });

          const nextStore = {
            ...current,
            agentWorkOrderRuns: nextRuns
          };

          return breachedRuns.length
            ? appendGovernanceOperations(nextStore, [
                createGovernanceOperation(
                  "agent-work-order-runs-sla-breach-actioned",
                  `Actioned ${breachedRuns.length} Agent Execution SLA breach(es).`,
                  {
                    action,
                    staleThresholdHours: policy.staleThresholdHours,
                    runIds: breachedRuns.map((run) => toText(run.id)),
                    skipped
                  }
                )
              ])
            : nextStore;
        });

        return sendJson(res, 200, {
          success: true,
          action,
          breached: breachedRuns.length,
          skipped,
          breachedRuns,
          agentWorkOrderRuns: updated.agentWorkOrderRuns
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
      }
    }

    if (pathname === "/api/agent-work-order-runs/sla-breaches/resolve" && req.method === "POST") {
      try {
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        const requestedRunIds = Array.isArray(payload.runIds)
          ? new Set(payload.runIds.map((item) => String(item || "").trim()).filter(Boolean))
          : null;
        const now = new Date().toISOString();
        let resolvedRuns = [];
        let skipped = 0;

        const updated = await store.updateStore((current) => {
          const nextRuns = (Array.isArray(current.agentWorkOrderRuns) ? current.agentWorkOrderRuns : []).map((run) => {
            const runId = toText(run.id);
            if (requestedRunIds && !requestedRunIds.has(runId)) return run;
            if (toText(run.archivedAt) || !toText(run.slaBreachedAt) || toText(run.slaResolvedAt)) {
              skipped += 1;
              return run;
            }

            const status = toText(run.status) || "queued";
            const history = Array.isArray(run.history) ? run.history : [];
            const nextRun = {
              ...run,
              notes: "SLA breach resolved from Governance.",
              slaResolvedAt: now,
              slaLastActionAt: now,
              slaAction: "resolved",
              slaResolutionCount: toNumber(run.slaResolutionCount) + 1,
              history: [
                createAgentWorkOrderRunEvent(status, "SLA breach resolved from Governance.", status),
                ...history
              ].slice(0, 50),
              updatedAt: now
            };
            resolvedRuns.push(nextRun);
            return nextRun;
          });

          const nextStore = {
            ...current,
            agentWorkOrderRuns: nextRuns
          };

          return resolvedRuns.length
            ? appendGovernanceOperations(nextStore, [
                createGovernanceOperation(
                  "agent-work-order-runs-sla-breach-resolved",
                  `Resolved ${resolvedRuns.length} Agent Execution SLA breach(es).`,
                  {
                    runIds: resolvedRuns.map((run) => toText(run.id)),
                    skipped
                  }
                )
              ])
            : nextStore;
        });

        return sendJson(res, 200, {
          success: true,
          resolved: resolvedRuns.length,
          skipped,
          resolvedRuns,
          agentWorkOrderRuns: updated.agentWorkOrderRuns
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
      }
    }

    if (pathname.startsWith("/api/agent-work-order-runs/") && req.method === "PATCH") {
      try {
        const runId = pathname.split("/").pop();
        const body = await readRequestBody(req);
        const payload = JSON.parse(body);
        let updatedRun = null;
        const updated = await store.updateStore((current) => {
          let previousStatus = null;
          let archiveChanged = false;
          let archiveOperationType = "";
          const nextRuns = (Array.isArray(current.agentWorkOrderRuns) ? current.agentWorkOrderRuns : []).map((run) => {
            if (run.id !== runId) return run;
            const now = new Date().toISOString();
            const nextStatus = payload.status ? String(payload.status).trim() : toText(run.status);
            const nextNotes = payload.notes != null ? String(payload.notes || "").trim() : toText(run.notes);
            const currentArchivedAt = toText(run.archivedAt);
            const shouldArchive = payload.archived === true;
            const shouldRestore = payload.archived === false;
            const nextArchivedAt = shouldArchive ? (currentArchivedAt || now) : shouldRestore ? "" : currentArchivedAt;
            const nextArchivedBy = shouldArchive ? "workspace-audit" : shouldRestore ? "" : toText(run.archivedBy);
            archiveChanged = (shouldArchive && !currentArchivedAt) || (shouldRestore && Boolean(currentArchivedAt));
            archiveOperationType = shouldArchive ? "agent-work-order-run-archived" : shouldRestore ? "agent-work-order-run-restored" : "";
            const history = Array.isArray(run.history) ? run.history : [];
            previousStatus = toText(run.status) || null;
            const eventNote = nextNotes
              || (shouldArchive ? "Archived execution run from Governance." : shouldRestore ? "Restored execution run from Governance." : `Marked ${nextStatus} from Governance.`);
            updatedRun = {
              ...run,
              status: nextStatus,
              notes: nextNotes,
              archivedAt: nextArchivedAt,
              archivedBy: nextArchivedBy,
              history: [
                createAgentWorkOrderRunEvent(nextStatus, eventNote, toText(run.status) || null),
                ...history
              ].slice(0, 50),
              updatedAt: now
            };
            return updatedRun;
          });
          const nextStore = {
            ...current,
            agentWorkOrderRuns: nextRuns
          };
          return updatedRun
            ? appendGovernanceOperations(nextStore, [
                createGovernanceOperation(
                  archiveChanged && archiveOperationType
                    ? archiveOperationType
                    : "agent-work-order-run-status-updated",
                  archiveChanged && archiveOperationType === "agent-work-order-run-archived"
                    ? `Archived Agent Work Order run for ${toText(updatedRun.projectName) || "Project"}.`
                    : archiveChanged && archiveOperationType === "agent-work-order-run-restored"
                      ? `Restored Agent Work Order run for ${toText(updatedRun.projectName) || "Project"}.`
                      : `Marked ${toText(updatedRun.projectName) || "Agent Work Order run"} ${toText(updatedRun.status)}.`,
                  {
                    runId: toText(updatedRun.id),
                    projectId: toText(updatedRun.projectId),
                    projectName: toText(updatedRun.projectName),
                    previousStatus,
                    status: toText(updatedRun.status),
                    archivedAt: toText(updatedRun.archivedAt)
                  }
                )
              ])
            : nextStore;
        });

        if (!updatedRun) {
          return sendJson(res, 404, { error: "Agent work order run not found" });
        }

        return sendJson(res, 200, {
          success: true,
          run: updatedRun,
          agentWorkOrderRuns: updated.agentWorkOrderRuns
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
      }
    }

    if (req.method === "POST" && pathname === "/api/audit") {
      try {
        const result = await generateAudit({
          rootDir: resolvedRootDir,
          outputDir: resolvedPublicDir
        });

        await store.updateStore((current) => ({
          ...current,
          findings: buildFindings(result.payload),
          meta: {
            ...current.meta,
            lastFindingsRefreshAt: new Date().toISOString()
          }
        }));

        return sendJson(res, 200, {
          success: true,
          generatedAt: result.generatedAt,
          totalApps: result.projectCount
        });
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (pathname === "/api/sources") {
      if (req.method === "GET") {
        try {
          return sendJson(res, 200, await getSourcesPayload());
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
        return;
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const { type, url } = JSON.parse(body);
          const currentSources = await getSourcesPayload();
          currentSources.push({ id: createId("source"), type, url, addedAt: new Date().toISOString() });
          await writeFile(sourcesFile, JSON.stringify(currentSources, null, 2));
          await store.updateStore((current) => ({
            ...current,
            sources: currentSources
          }));
          return sendJson(res, 200, { success: true, sources: currentSources });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    const sourceRegistryMatch = pathname.match(/^\/api\/sources\/([^/]+)$/);
    if (sourceRegistryMatch && req.method === "DELETE") {
      try {
        const sourceId = decodeURIComponent(sourceRegistryMatch[1] || "").trim();
        if (!sourceId) {
          return sendJson(res, 400, { error: "sourceId is required" });
        }

        const currentSources = await getSourcesPayload();
        const removedSource = currentSources.find((source, index) => getSourceRecordId(toControlPlaneRecord(source), index) === sourceId);
        if (!removedSource) {
          return sendJson(res, 404, { error: "Source not found" });
        }

        const nextSources = currentSources.filter((source, index) => getSourceRecordId(toControlPlaneRecord(source), index) !== sourceId);
        await writeFile(sourcesFile, JSON.stringify(nextSources, null, 2));
        const updated = await store.updateStore((current) => appendGovernanceOperations({
          ...current,
          sources: nextSources
        }, [
          createGovernanceOperation(
            "data-source-removed",
            `Removed ${toText(toControlPlaneRecord(removedSource).label) || toText(toControlPlaneRecord(removedSource).type) || sourceId} from the Data Sources registry.`,
            {
              sourceId,
              sourceType: toText(toControlPlaneRecord(removedSource).type),
              sourceValue: getSourceValue(toControlPlaneRecord(removedSource))
            }
          )
        ]));

        return sendJson(res, 200, {
          success: true,
          removed: true,
          sourceId,
          source: removedSource,
          sources: updated.sources
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
      }
    }

    if (req.method === "GET" && pathname === "/api/sources/summary") {
      try {
        return sendJson(res, 200, await createSourcesSummaryPayload());
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/deployments/health") {
      try {
        return sendJson(res, 200, await createDeploymentHealthPayload());
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/deployments/smoke-checks") {
      try {
        const persisted = await store.readStore();
        return sendJson(res, 200, createDeploymentSmokeChecksPayload(persisted, {
          limit: Number(requestUrl.searchParams.get("limit") || 100)
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/releases/summary") {
      try {
        const persisted = await store.readStore();
        return sendJson(res, 200, await createReleaseSummaryPayload(persisted));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/releases/checkpoints/diff") {
      try {
        const checkpointId = String(requestUrl.searchParams.get("checkpointId") || requestUrl.searchParams.get("snapshotId") || "latest").trim() || "latest";
        const persisted = await store.readStore();
        return sendJson(res, 200, await createReleaseCheckpointDriftPayloadFromPersisted(persisted, checkpointId));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/releases/build-gate") {
      try {
        const persisted = await store.readStore();
        return sendJson(res, 200, await createReleaseBuildGatePayload(persisted));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/releases/task-ledger") {
      try {
        const persisted = await store.readStore();
        return sendJson(res, 200, createReleaseTaskLedgerPayload(persisted, {
          status: requestUrl.searchParams.get("status") || "all",
          limit: Number(requestUrl.searchParams.get("limit") || 100)
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "POST" && pathname === "/api/releases/build-gate/actions/tasks") {
      try {
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        const persisted = await store.readStore();
        const releaseBuildGate = await createReleaseBuildGatePayload(persisted);
        const liveActions = Array.isArray(releaseBuildGate.actions) ? releaseBuildGate.actions.map(toControlPlaneRecord) : [];
        const actionableActions = liveActions.filter((action) => toText(action.status) !== "ready");
        const liveActionsById = new Map(liveActions.map((action) => [toText(action.id), action]));
        const requestedActions = (Array.isArray(payload.actions) && payload.actions.length ? payload.actions : actionableActions)
          .map((action) => {
            const record = toControlPlaneRecord(action);
            return liveActionsById.get(toText(record.id)) || record;
          })
          .filter((action) => toText(action.id) && toText(action.status) !== "ready");

        if (!requestedActions.length) {
          return sendJson(res, 400, { error: "At least one open release build gate action is required" });
        }

        /** @type {Record<string, unknown>[]} */
        const createdTasks = [];
        /** @type {Array<{ id: string, label: string, reason: string }>} */
        const skipped = [];
        const updated = await store.updateStore((current) => {
          const tasks = Array.isArray(current.tasks) ? current.tasks : [];
          let nextTasks = tasks;

          for (const action of requestedActions) {
            const actionId = toText(action.id);
            const label = toText(action.label) || actionId;
            const title = `Release gate action: ${label}`;
            const exists = nextTasks.some((task) => (
              toText(task.releaseBuildGateActionId) === actionId
              || (toText(task.projectId) === "release-control" && toText(task.title) === title)
            ));

            if (exists) {
              skipped.push({ id: actionId, label, reason: "Task already exists" });
              continue;
            }

            const task = createReleaseBuildGateActionTask(action, releaseBuildGate);
            createdTasks.push(task);
            nextTasks = [...nextTasks, task];
          }

          return appendGovernanceOperations({
            ...current,
            tasks: nextTasks
          }, [
            createGovernanceOperation(
              "release-build-gate-action-tasks-created",
              `Created ${createdTasks.length} Release Build Gate action task(s).`,
              {
                requested: requestedActions.length,
                created: createdTasks.length,
                skipped: skipped.length,
                actionIds: requestedActions.map((action) => toText(action.id))
              }
            )
          ]);
        });

        return sendJson(res, 200, {
          success: true,
          requested: requestedActions.length,
          createdTasks,
          skipped,
          totals: {
            requested: requestedActions.length,
            created: createdTasks.length,
            skipped: skipped.length
          },
          tasks: updated.tasks
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid release build gate action task request" });
      }
    }

    if (req.method === "POST" && pathname === "/api/releases/build-gate/bootstrap-local-evidence") {
      try {
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        return sendJson(res, 200, await bootstrapReleaseBuildGateLocalEvidence(payload, requestUrl));
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid release build gate evidence bootstrap request" });
      }
    }

    if (req.method === "POST" && pathname === "/api/releases/checkpoints") {
      try {
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        const persisted = await store.readStore();
        const checkpoint = await createReleaseCheckpointRecord(persisted, payload);
        const updated = await store.updateStore((current) => appendGovernanceOperations({
          ...current,
          releaseCheckpoints: [checkpoint, ...(Array.isArray(current.releaseCheckpoints) ? current.releaseCheckpoints : [])].slice(0, 100)
        }, [
          createGovernanceOperation(
            "release-checkpoint-recorded",
            `Release checkpoint ${checkpoint.status} for ${checkpoint.title}.`,
            {
              checkpointId: checkpoint.id,
              title: checkpoint.title,
              status: checkpoint.status,
              branch: checkpoint.branch,
              commit: checkpoint.commit,
              dirty: checkpoint.dirty,
              deploymentStatus: checkpoint.deploymentStatus,
              deploymentSmokeCheckCount: checkpoint.deploymentSmokeCheckCount,
              validationStatus: checkpoint.validationStatus
            }
          )
        ]));
        return sendJson(res, 200, {
          success: true,
          checkpoint,
          releaseCheckpointCount: Array.isArray(updated.releaseCheckpoints) ? updated.releaseCheckpoints.length : 0,
          governanceOperationCount: Array.isArray(updated.governanceOperations) ? updated.governanceOperations.length : 0
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid release checkpoint request" });
      }
    }

    if (req.method === "POST" && pathname === "/api/deployments/smoke-check") {
      try {
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        const smokeCheck = await createDeploymentSmokeCheck(payload);
        const updated = await store.updateStore((current) => appendGovernanceOperations({
          ...current,
          deploymentSmokeChecks: [smokeCheck, ...(Array.isArray(current.deploymentSmokeChecks) ? current.deploymentSmokeChecks : [])].slice(0, 100)
        }, [
          createGovernanceOperation(
            "deployment-smoke-check-recorded",
            `Deployment smoke check ${smokeCheck.status} for ${smokeCheck.label}.`,
            {
              smokeCheckId: smokeCheck.id,
              targetId: smokeCheck.targetId,
              sourceId: smokeCheck.sourceId,
              label: smokeCheck.label,
              provider: smokeCheck.provider,
              url: smokeCheck.url,
              status: smokeCheck.status,
              httpStatus: smokeCheck.httpStatus,
              latencyMs: smokeCheck.latencyMs,
              error: smokeCheck.error
            }
          )
        ]));
        return sendJson(res, 200, {
          success: true,
          smokeCheck,
          deploymentSmokeCheckCount: Array.isArray(updated.deploymentSmokeChecks) ? updated.deploymentSmokeChecks.length : 0,
          governanceOperationCount: Array.isArray(updated.governanceOperations) ? updated.governanceOperations.length : 0
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid deployment smoke check request" });
      }
    }

    if (req.method === "GET" && pathname === "/api/sources/access-requirements") {
      try {
        return sendJson(res, 200, await createSourcesAccessRequirementsPayload());
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/sources/access-checklist") {
      try {
        return sendJson(res, 200, await createSourcesAccessChecklistPayload());
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/sources/access-validation-runbook") {
      try {
        return sendJson(res, 200, await createSourcesAccessValidationRunbookPayload());
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (pathname === "/api/sources/access-validation-evidence") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          return sendJson(res, 200, createSourcesAccessValidationEvidencePayload(persisted, {
            status: requestUrl.searchParams.get("status") || "all",
            sourceId: requestUrl.searchParams.get("sourceId") || "",
            accessMethod: requestUrl.searchParams.get("accessMethod") || "",
            limit: Number(requestUrl.searchParams.get("limit") || 100)
          }));
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = body ? JSON.parse(body) : {};
          const sourceId = toText(payload.sourceId);
          if (!sourceId) {
            return sendJson(res, 400, { error: "sourceId is required" });
          }

          const checklist = await createSourcesAccessChecklistPayload();
          const source = (Array.isArray(checklist.items) ? checklist.items.map(toControlPlaneRecord) : [])
            .find((item) => toText(item.sourceId) === sourceId);
          if (!source) {
            return sendJson(res, 404, { error: "Source access checklist item not found" });
          }

          const record = createSourcesAccessValidationEvidenceRecord(payload, source);
          let taskSyncSummary = { updated: 0, taskIds: [] };
          const updated = await store.updateStore((current) => {
            const taskSync = syncSourceAccessValidationEvidenceCoverageTasks(
              Array.isArray(current.tasks) ? current.tasks : [],
              record
            );
            taskSyncSummary = {
              updated: taskSync.updatedTaskIds.length,
              taskIds: taskSync.updatedTaskIds
            };
            return appendGovernanceOperations({
              ...current,
              dataSourceAccessValidationEvidence: [
                record,
                ...(Array.isArray(current.dataSourceAccessValidationEvidence) ? current.dataSourceAccessValidationEvidence : [])
              ].slice(0, 500),
              tasks: taskSync.tasks
            }, [
              createGovernanceOperation(
                "data-source-access-validation-evidence-recorded",
                `Recorded non-secret Data Sources access validation evidence for ${record.sourceLabel || record.sourceId}.`,
                {
                  evidenceId: record.id,
                  sourceId: record.sourceId,
                  accessMethod: record.accessMethod,
                  status: record.status
                }
              ),
              ...(taskSync.updatedTaskIds.length
                ? [
                    createGovernanceOperation(
                      "data-source-access-validation-evidence-coverage-tasks-synced",
                      `Synced ${taskSync.updatedTaskIds.length} Data Sources access validation evidence coverage task(s) after recording evidence for ${record.sourceLabel || record.sourceId}.`,
                      {
                        evidenceId: record.id,
                        sourceId: record.sourceId,
                        accessMethod: record.accessMethod,
                        status: record.status,
                        taskIds: taskSync.updatedTaskIds
                      }
                    )
                  ]
                : [])
            ]);
          });

          return sendJson(res, 200, {
            success: true,
            evidence: record,
            taskSync: taskSyncSummary,
            ledger: createSourcesAccessValidationEvidencePayload(updated, {
              status: "all",
              limit: 100
            })
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    if (req.method === "GET" && pathname === "/api/sources/access-validation-evidence-coverage") {
      try {
        const persisted = await store.readStore();
        return sendJson(res, 200, await createSourcesAccessValidationEvidenceCoveragePayload(persisted));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "POST" && pathname === "/api/sources/access-validation-evidence-coverage/tasks") {
      try {
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        const persisted = await store.readStore();
        const coverage = await createSourcesAccessValidationEvidenceCoveragePayload(persisted);
        const liveItems = Array.isArray(coverage.items) ? coverage.items.map(toControlPlaneRecord) : [];
        const actionableItems = liveItems.filter((item) => toText(item.coverageStatus) !== "covered");
        const liveItemsById = new Map(liveItems.map((item) => [toText(item.id), item]));
        const requestedItems = (Array.isArray(payload.items) && payload.items.length ? payload.items : actionableItems)
          .map((item) => {
            const record = toControlPlaneRecord(item);
            return liveItemsById.get(toText(record.id)) || record;
          })
          .filter((item) => toText(item.id) && toText(item.coverageStatus) !== "covered");

        if (!requestedItems.length) {
          return sendJson(res, 400, { error: "At least one missing, review, or blocked evidence coverage item is required" });
        }

        /** @type {Record<string, unknown>[]} */
        const createdTasks = [];
        /** @type {Array<{ id: string, label: string, reason: string }>} */
        const skipped = [];
        const updated = await store.updateStore((current) => {
          const tasks = Array.isArray(current.tasks) ? current.tasks : [];
          let nextTasks = tasks;

          for (const item of requestedItems) {
            const coverageId = toText(item.id);
            const sourceLabel = toText(item.label) || "Source";
            const title = `Source evidence coverage: ${sourceLabel}`;
            const exists = nextTasks.some((task) => (
              toText(task.sourceAccessValidationEvidenceCoverageId) === coverageId
              || (toText(task.projectId) === "data-sources" && toText(task.title) === title)
            ));

            if (exists) {
              skipped.push({ id: coverageId, label: sourceLabel, reason: "Task already exists" });
              continue;
            }

            const task = createSourceAccessValidationEvidenceCoverageTask(item);
            createdTasks.push(task);
            nextTasks = [...nextTasks, task];
          }

          return appendGovernanceOperations({
            ...current,
            tasks: nextTasks
          }, [
            createGovernanceOperation(
              "data-source-access-validation-evidence-coverage-tasks-created",
              `Created ${createdTasks.length} Data Sources access validation evidence coverage task(s).`,
              {
                requested: requestedItems.length,
                created: createdTasks.length,
                skipped: skipped.length,
                coverageIds: requestedItems.map((item) => toText(item.id))
              }
            )
          ]);
        });

        return sendJson(res, 200, {
          success: true,
          requested: requestedItems.length,
          createdTasks,
          skipped,
          totals: {
            requested: requestedItems.length,
            created: createdTasks.length,
            skipped: skipped.length
          },
          tasks: updated.tasks
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
      }
    }

    if (req.method === "GET" && pathname === "/api/sources/access-validation-evidence-snapshots/diff") {
      try {
        const snapshotId = String(requestUrl.searchParams.get("snapshotId") || "latest").trim() || "latest";
        const persisted = await store.readStore();
        const snapshots = Array.isArray(persisted.dataSourceAccessValidationEvidenceSnapshots)
          ? persisted.dataSourceAccessValidationEvidenceSnapshots.map(toControlPlaneRecord)
          : [];
        const snapshot = snapshotId === "latest"
          ? snapshots[0]
          : snapshots.find((item) => toText(item.id) === snapshotId);
        if (!snapshot) {
          return sendJson(res, 200, createMissingSourcesAccessValidationEvidenceSnapshotDiffPayload());
        }
        return sendJson(res, 200, createSourcesAccessValidationEvidenceSnapshotDiffPayload(snapshot, createSourcesAccessValidationEvidencePayload(persisted, {
          status: toText(snapshot.statusFilter) || "all",
          sourceId: toText(snapshot.sourceId),
          accessMethod: toText(snapshot.accessMethod),
          limit: Number(snapshot.limit || 100)
        })));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (pathname === "/api/sources/access-validation-evidence-snapshots") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const snapshots = Array.isArray(persisted.dataSourceAccessValidationEvidenceSnapshots) ? persisted.dataSourceAccessValidationEvidenceSnapshots : [];
          return sendJson(res, 200, snapshots.slice(0, 50));
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = body ? JSON.parse(body) : {};
          const persisted = await store.readStore();
          const ledger = createSourcesAccessValidationEvidencePayload(persisted, {
            status: String(payload.status || "all"),
            sourceId: String(payload.sourceId || ""),
            accessMethod: String(payload.accessMethod || ""),
            limit: Number(payload.limit || 100)
          });
          const snapshot = {
            id: createId("data-source-access-validation-evidence-snapshot"),
            title: String(payload.title || "Data Sources Access Validation Evidence").trim() || "Data Sources Access Validation Evidence",
            statusFilter: ledger.status,
            sourceId: ledger.sourceId,
            accessMethod: ledger.accessMethod,
            limit: ledger.limit,
            total: ledger.summary.total,
            validatedCount: ledger.summary.validated,
            reviewCount: ledger.summary.review,
            blockedCount: ledger.summary.blocked,
            methodCount: ledger.summary.methodCount,
            sourceCount: ledger.summary.sourceCount,
            secretPolicy: ledger.secretPolicy,
            markdown: ledger.markdown,
            items: ledger.items,
            createdAt: new Date().toISOString()
          };

          const updated = await store.updateStore((current) => appendGovernanceOperations({
            ...current,
            dataSourceAccessValidationEvidenceSnapshots: [snapshot, ...(Array.isArray(current.dataSourceAccessValidationEvidenceSnapshots) ? current.dataSourceAccessValidationEvidenceSnapshots : [])].slice(0, 100)
          }, [
            createGovernanceOperation(
              "data-source-access-validation-evidence-snapshot-created",
              `Saved ${snapshot.title} Data Sources access validation evidence snapshot.`,
              {
                snapshotId: snapshot.id,
                snapshotTitle: snapshot.title,
                statusFilter: snapshot.statusFilter,
                sourceId: snapshot.sourceId,
                accessMethod: snapshot.accessMethod,
                total: snapshot.total,
                validatedCount: snapshot.validatedCount,
                reviewCount: snapshot.reviewCount,
                blockedCount: snapshot.blockedCount
              }
            )
          ]));

          return sendJson(res, 200, {
            success: true,
            snapshot,
            dataSourceAccessValidationEvidenceSnapshots: updated.dataSourceAccessValidationEvidenceSnapshots
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    if (req.method === "GET" && pathname === "/api/sources/access-matrix") {
      try {
        return sendJson(res, 200, await createSourcesAccessMatrixPayload());
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/sources/access-review-queue") {
      try {
        return sendJson(res, 200, await createSourcesAccessReviewQueuePayload());
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "POST" && pathname === "/api/sources/access-review-queue/tasks") {
      try {
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        const liveQueue = await createSourcesAccessReviewQueuePayload();
        const liveItems = Array.isArray(liveQueue.items) ? liveQueue.items.map(toControlPlaneRecord) : [];
        const liveItemsById = new Map(liveItems.map((item) => [toText(item.id), item]));
        const requestedItems = (Array.isArray(payload.items) && payload.items.length ? payload.items : liveItems)
          .map((item) => {
            const record = toControlPlaneRecord(item);
            return liveItemsById.get(toText(record.id)) || record;
          })
          .filter((item) => toText(item.id));

        if (!requestedItems.length) {
          return sendJson(res, 400, { error: "At least one source access review queue item is required" });
        }

        /** @type {Record<string, unknown>[]} */
        const createdTasks = [];
        /** @type {Array<{ id: string, label: string, reason: string }>} */
        const skipped = [];
        const updated = await store.updateStore((current) => {
          const tasks = Array.isArray(current.tasks) ? current.tasks : [];
          let nextTasks = tasks;

          for (const item of requestedItems) {
            const sourceAccessReviewId = toText(item.id);
            const sourceLabel = toText(item.label) || "Source";
            const title = `Source access review: ${sourceLabel}`;
            const exists = nextTasks.some((task) => (
              toText(task.sourceAccessReviewId) === sourceAccessReviewId
              || (toText(task.projectId) === "data-sources" && toText(task.title) === title)
            ));

            if (exists) {
              skipped.push({ id: sourceAccessReviewId, label: sourceLabel, reason: "Task already exists" });
              continue;
            }

            const task = createSourceAccessReviewTask(item);
            createdTasks.push(task);
            nextTasks = [...nextTasks, task];
          }

          const nextStore = {
            ...current,
            tasks: nextTasks
          };

          return appendGovernanceOperations(nextStore, [
            createGovernanceOperation(
              "data-source-access-review-tasks-created",
              `Created ${createdTasks.length} Data Sources access review task(s).`,
              {
                requested: requestedItems.length,
                created: createdTasks.length,
                skipped: skipped.length,
                sourceAccessReviewIds: requestedItems.map((item) => toText(item.id))
              }
            )
          ]);
        });

        return sendJson(res, 200, {
          success: true,
          requested: requestedItems.length,
          createdTasks,
          skipped,
          totals: {
            requested: requestedItems.length,
            created: createdTasks.length,
            skipped: skipped.length
          },
          tasks: updated.tasks
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
      }
    }

    if (req.method === "GET" && pathname === "/api/sources/access-task-ledger") {
      try {
        const persisted = await store.readStore();
        return sendJson(res, 200, createSourcesAccessTaskLedgerPayload(persisted, {
          status: requestUrl.searchParams.get("status") || "all",
          limit: Number(requestUrl.searchParams.get("limit") || 100)
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/sources/access-task-ledger-snapshots/diff") {
      try {
        const snapshotId = String(requestUrl.searchParams.get("snapshotId") || "latest").trim() || "latest";
        const persisted = await store.readStore();
        const snapshots = Array.isArray(persisted.dataSourceAccessTaskLedgerSnapshots)
          ? persisted.dataSourceAccessTaskLedgerSnapshots.map(toControlPlaneRecord)
          : [];
        const snapshot = snapshotId === "latest"
          ? snapshots[0]
          : snapshots.find((item) => toText(item.id) === snapshotId);
        if (!snapshot) {
          return sendJson(res, 200, createMissingSourcesAccessTaskLedgerSnapshotDiffPayload());
        }
        return sendJson(res, 200, createSourcesAccessTaskLedgerSnapshotDiffPayload(snapshot, createSourcesAccessTaskLedgerPayload(persisted, {
          status: toText(snapshot.statusFilter) || "all",
          limit: Number(snapshot.limit || 100)
        })));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (pathname === "/api/sources/access-task-ledger-snapshots") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const snapshots = Array.isArray(persisted.dataSourceAccessTaskLedgerSnapshots) ? persisted.dataSourceAccessTaskLedgerSnapshots : [];
          return sendJson(res, 200, snapshots.slice(0, 50));
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = body ? JSON.parse(body) : {};
          const persisted = await store.readStore();
          const ledger = createSourcesAccessTaskLedgerPayload(persisted, {
            status: String(payload.status || "all"),
            limit: Number(payload.limit || 100)
          });
          const snapshot = {
            id: createId("data-source-access-task-ledger-snapshot"),
            title: String(payload.title || "Data Sources Access Task Ledger").trim() || "Data Sources Access Task Ledger",
            statusFilter: ledger.status,
            limit: ledger.limit,
            total: ledger.summary.total,
            openCount: ledger.summary.open,
            closedCount: ledger.summary.closed,
            visibleCount: ledger.summary.visible,
            secretPolicy: ledger.secretPolicy,
            markdown: ledger.markdown,
            items: ledger.items,
            createdAt: new Date().toISOString()
          };

          const updated = await store.updateStore((current) => appendGovernanceOperations({
            ...current,
            dataSourceAccessTaskLedgerSnapshots: [snapshot, ...(Array.isArray(current.dataSourceAccessTaskLedgerSnapshots) ? current.dataSourceAccessTaskLedgerSnapshots : [])].slice(0, 100)
          }, [
            createGovernanceOperation(
              "data-source-access-task-ledger-snapshot-created",
              `Saved ${snapshot.title} Data Sources access task ledger snapshot.`,
              {
                snapshotId: snapshot.id,
                snapshotTitle: snapshot.title,
                statusFilter: snapshot.statusFilter,
                total: snapshot.total,
                openCount: snapshot.openCount,
                closedCount: snapshot.closedCount
              }
            )
          ]));

          return sendJson(res, 200, {
            success: true,
            snapshot,
            dataSourceAccessTaskLedgerSnapshots: updated.dataSourceAccessTaskLedgerSnapshots
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    if (req.method === "GET" && pathname === "/api/sources/access-gate") {
      try {
        return sendJson(res, 200, await createSourcesAccessGatePayload());
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/sources/summary-snapshots/diff") {
      try {
        const snapshotId = String(requestUrl.searchParams.get("snapshotId") || "latest").trim() || "latest";
        const persisted = await store.readStore();
        const snapshots = Array.isArray(persisted.dataSourceHealthSnapshots) ? persisted.dataSourceHealthSnapshots.map(toControlPlaneRecord) : [];
        const snapshot = snapshotId === "latest"
          ? snapshots[0]
          : snapshots.find((item) => toText(item.id) === snapshotId);
        if (!snapshot) {
          return sendJson(res, 200, createMissingSourcesSummarySnapshotDiffPayload());
        }
        return sendJson(res, 200, createSourcesSummarySnapshotDiffPayload(snapshot, await createSourcesSummaryPayload()));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (pathname === "/api/sources/summary-snapshots") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const snapshots = Array.isArray(persisted.dataSourceHealthSnapshots) ? persisted.dataSourceHealthSnapshots : [];
          return sendJson(res, 200, snapshots.slice(0, 50));
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = body ? JSON.parse(body) : {};
          const snapshot = await createSourcesSummarySnapshotRecord(payload);
          const updated = await store.updateStore((current) => appendGovernanceOperations({
            ...current,
            dataSourceHealthSnapshots: [snapshot, ...(Array.isArray(current.dataSourceHealthSnapshots) ? current.dataSourceHealthSnapshots : [])].slice(0, 100)
          }, [
            createGovernanceOperation(
              "data-source-health-snapshot-created",
              `Saved ${snapshot.title} as a Data Sources health snapshot.`,
              {
                snapshotId: snapshot.id,
                total: snapshot.total,
                ready: snapshot.ready,
                review: snapshot.review,
                blocked: snapshot.blocked,
                snapshotCreatedAt: snapshot.createdAt
              }
            )
          ]));

          return sendJson(res, 200, {
            success: true,
            snapshot,
            dataSourceHealthSnapshots: updated.dataSourceHealthSnapshots
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    if (pathname === "/api/project-profiles") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const projectId = requestUrl.searchParams.get("projectId");
          const profiles = Array.isArray(persisted.projectProfiles) ? persisted.projectProfiles : [];
          const filteredProfiles = projectId
            ? profiles.filter((profile) => profile.projectId === projectId)
            : profiles;
          return sendJson(res, 200, filteredProfiles);
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = JSON.parse(body);
          const projectId = String(payload.projectId || "").trim();
          const projectName = String(payload.projectName || "").trim();
          if (!projectId || !projectName) {
            return sendJson(res, 400, { error: "projectId and projectName are required" });
          }

          let upsertedProfile = null;
          let profileHistoryEntry = null;
          const updated = await store.updateStore((current) => {
            const result = applyProjectProfileUpsert(current, payload);
            upsertedProfile = result.profile;
            profileHistoryEntry = result.historyEntry;
            return result.store;
          });

          return sendJson(res, 200, {
            success: true,
            profile: upsertedProfile,
            profileHistoryEntry,
            profiles: updated.projectProfiles
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    if (pathname === "/api/project-profile-history" && req.method === "GET") {
      try {
        const persisted = await store.readStore();
        const projectId = requestUrl.searchParams.get("projectId");
        const history = Array.isArray(persisted.projectProfileHistory) ? persisted.projectProfileHistory : [];
        const filteredHistory = projectId
          ? history.filter((entry) => entry.projectId === projectId)
          : history;
        return sendJson(res, 200, filteredHistory);
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (pathname === "/api/governance/bootstrap" && req.method === "POST") {
      try {
        const body = await readRequestBody(req);
        const payload = JSON.parse(body);
        const mode = payload.mode === "starter-pack" ? "starter-pack" : payload.mode === "profiles" ? "profiles" : "";
        const requestedIds = Array.isArray(payload.projectIds)
          ? payload.projectIds.map((value) => String(value || "").trim()).filter(Boolean)
          : [];

        if (!mode) {
          return sendJson(res, 400, { error: "mode must be either 'profiles' or 'starter-pack'" });
        }

        if (!requestedIds.length) {
          return sendJson(res, 400, { error: "At least one projectId is required" });
        }

        const inventory = await getInventoryPayload();
        const projects = Array.isArray(inventory.projects) ? inventory.projects : [];
        const projectMap = new Map(projects.map((project) => [toText(project.id), project]));
        const selectedProjects = requestedIds
          .map((projectId) => projectMap.get(projectId))
          .filter(Boolean);

        if (!selectedProjects.length) {
          return sendJson(res, 400, { error: "None of the supplied projectIds exist in the current inventory" });
        }

        /** @type {Record<string, unknown>[]} */
        const createdProfiles = [];
        /** @type {Record<string, unknown>[]} */
        const createdTasks = [];
        /** @type {Record<string, unknown>[]} */
        const createdWorkflows = [];
        /** @type {Record<string, unknown>[]} */
        const profileHistoryEntries = [];

        const updated = await store.updateStore((current) => {
          let nextStore = current;

          for (const project of selectedProjects) {
            const projectId = toText(project.id);
            const projectName = toText(project.name);
            const existingProfile = Array.isArray(nextStore.projectProfiles)
              ? nextStore.projectProfiles.find((profile) => profile.projectId === projectId)
              : null;

            if (!existingProfile) {
              const profileResult = applyProjectProfileUpsert(nextStore, createBootstrapProfilePayload(project));
              nextStore = profileResult.store;
              createdProfiles.push(profileResult.profile);
              if (profileResult.historyEntry) {
                profileHistoryEntries.push(profileResult.historyEntry);
              }
            }

            if (mode === "starter-pack") {
              const tasks = Array.isArray(nextStore.tasks) ? nextStore.tasks : [];
              const workflows = Array.isArray(nextStore.workflows) ? nextStore.workflows : [];
              const taskTitle = `Review governance baseline for ${projectName}`;
              const workflowTitle = `Governance onboarding for ${projectName}`;

              if (!tasks.some((task) => task.projectId === projectId && task.title === taskTitle)) {
                const task = {
                  id: createId("task"),
                  projectId,
                  projectName,
                  title: taskTitle,
                  description: "Assign ownership, confirm lifecycle and tier, and validate the target state for this project.",
                  priority: "medium",
                  status: "open",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
                createdTasks.push(task);
                nextStore = {
                  ...nextStore,
                  tasks: [...tasks, task]
                };
              }

              if (!workflows.some((workflow) => workflow.projectId === projectId && workflow.title === workflowTitle)) {
                const workflow = {
                  id: createId("workflow"),
                  projectId,
                  projectName,
                  title: workflowTitle,
                  brief: "Bootstrap governance ownership, lifecycle, and next-step decision making for this project.",
                  status: "active",
                  phase: "planning",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
                createdWorkflows.push(workflow);
                nextStore = {
                  ...nextStore,
                  workflows: [...workflows, workflow]
                };
              }
            }
          }

          return appendGovernanceOperations(nextStore, [
            createGovernanceOperation(`bootstrap-${mode}`, `Ran governance ${mode} bootstrap for ${selectedProjects.length} project(s).`, {
              mode,
              requestedProjectIds: requestedIds,
              processedProjectIds: selectedProjects.map((project) => toText(project.id)),
              totals: {
                profiles: createdProfiles.length,
                tasks: createdTasks.length,
                workflows: createdWorkflows.length,
                profileHistoryEntries: profileHistoryEntries.length
              }
            })
          ]);
        });

        return sendJson(res, 200, {
          success: true,
          mode,
          requestedProjectIds: requestedIds,
          processedProjectIds: selectedProjects.map((project) => toText(project.id)),
          createdProfiles,
          createdTasks,
          createdWorkflows,
          profileHistoryEntries,
          totals: {
            profiles: createdProfiles.length,
            tasks: createdTasks.length,
            workflows: createdWorkflows.length
          },
          projectProfiles: updated.projectProfiles,
          tasks: updated.tasks,
          workflows: updated.workflows
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
      }
    }

    if (pathname === "/api/governance/queue/execute" && req.method === "POST") {
      try {
        const body = await readRequestBody(req);
        const payload = JSON.parse(body);
        const requestedItems = Array.isArray(payload.items)
          ? payload.items.map((item) => ({
              id: toText(item.id),
              projectId: toText(item.projectId),
              projectName: toText(item.projectName),
              kind: toText(item.kind),
              actionType: toText(item.actionType)
            })).filter((item) => item.projectId && item.actionType)
          : [];

        if (!requestedItems.length) {
          return sendJson(res, 400, { error: "At least one executable queue item is required" });
        }

        const inventory = await getInventoryPayload();
        const projects = Array.isArray(inventory.projects) ? inventory.projects : [];
        const projectMap = new Map(projects.map((project) => [toText(project.id), project]));
        /** @type {Record<string, unknown>[]} */
        const createdProfiles = [];
        /** @type {Record<string, unknown>[]} */
        const createdTasks = [];
        /** @type {Record<string, unknown>[]} */
        const createdWorkflows = [];
        /** @type {Record<string, unknown>[]} */
        const createdNotes = [];
        /** @type {Record<string, unknown>[]} */
        const profileHistoryEntries = [];
        /** @type {Array<{ projectId: string, actionType: string, reason: string }>} */
        const skipped = [];

        const updated = await store.updateStore((current) => {
          let nextStore = current;

          for (const item of requestedItems) {
            const project = projectMap.get(item.projectId);
            const projectName = item.projectName || toText(project?.name) || item.projectId;

            if (item.actionType === "open-project") {
              skipped.push({ projectId: item.projectId, actionType: item.actionType, reason: "Open-project actions are client-side only" });
              continue;
            }

            if (item.actionType === "create-starter-pack" || item.actionType === "create-profile") {
              if (!project) {
                skipped.push({ projectId: item.projectId, actionType: item.actionType, reason: "Project is not present in the current inventory" });
                continue;
              }

              const existingProfile = Array.isArray(nextStore.projectProfiles)
                ? nextStore.projectProfiles.find((profile) => profile.projectId === item.projectId)
                : null;

              if (!existingProfile) {
                const profileResult = applyProjectProfileUpsert(nextStore, createBootstrapProfilePayload(project));
                nextStore = profileResult.store;
                createdProfiles.push(profileResult.profile);
                if (profileResult.historyEntry) {
                  profileHistoryEntries.push(profileResult.historyEntry);
                }
              }
            }

            if (item.actionType === "create-starter-pack" || item.actionType === "create-task") {
              const tasks = Array.isArray(nextStore.tasks) ? nextStore.tasks : [];
              const title = `Review governance baseline for ${projectName}`;
              if (!tasks.some((task) => task.projectId === item.projectId && task.title === title)) {
                const task = {
                  id: createId("task"),
                  projectId: item.projectId,
                  projectName,
                  title,
                  description: "Assign ownership, confirm lifecycle and tier, and validate the target state for this project.",
                  priority: "medium",
                  status: "open",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
                createdTasks.push(task);
                nextStore = {
                  ...nextStore,
                  tasks: [...tasks, task]
                };
              }
            }

            if (item.actionType === "create-starter-pack" || item.actionType === "create-workflow") {
              const workflows = Array.isArray(nextStore.workflows) ? nextStore.workflows : [];
              const title = `Governance onboarding for ${projectName}`;
              if (!workflows.some((workflow) => workflow.projectId === item.projectId && workflow.title === title)) {
                const workflow = {
                  id: createId("workflow"),
                  projectId: item.projectId,
                  projectName,
                  title,
                  brief: "Bootstrap governance ownership, lifecycle, and next-step decision making for this project.",
                  status: "active",
                  phase: "planning",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
                createdWorkflows.push(workflow);
                nextStore = {
                  ...nextStore,
                  workflows: [...workflows, workflow]
                };
              }
            }

            if (item.actionType === "create-decision-note") {
              const notes = Array.isArray(nextStore.notes) ? nextStore.notes : [];
              const title = `Decision required for ${projectName}`;
              if (!notes.some((note) => note.projectId === item.projectId && note.title === title && note.kind === "decision")) {
                const note = {
                  id: createId("note"),
                  projectId: item.projectId,
                  projectName,
                  title,
                  body: "Confirm the target state, rationale, owner, and execution path for this project.",
                  kind: "decision",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
                createdNotes.push(note);
                nextStore = {
                  ...nextStore,
                  notes: [...notes, note]
                };
              }
            }
          }

          return appendGovernanceOperations(nextStore, [
            createGovernanceOperation("queue-execute", `Executed ${requestedItems.length} governance queue item(s).`, {
              requestedItems,
              totals: {
                profiles: createdProfiles.length,
                tasks: createdTasks.length,
                workflows: createdWorkflows.length,
                notes: createdNotes.length,
                profileHistoryEntries: profileHistoryEntries.length,
                skipped: skipped.length
              },
              skipped
            })
          ]);
        });

        return sendJson(res, 200, {
          success: true,
          requestedItems,
          createdProfiles,
          createdTasks,
          createdWorkflows,
          createdNotes,
          profileHistoryEntries,
          skipped,
          totals: {
            profiles: createdProfiles.length,
            tasks: createdTasks.length,
            workflows: createdWorkflows.length,
            notes: createdNotes.length,
            skipped: skipped.length
          },
          projectProfiles: updated.projectProfiles,
          tasks: updated.tasks,
          workflows: updated.workflows,
          notes: updated.notes
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
      }
    }

    if (pathname === "/api/governance/queue/suppress" && req.method === "POST") {
      try {
        const body = await readRequestBody(req);
        const payload = JSON.parse(body);
        const reason = String(payload.reason || "Suppressed from the Governance queue").trim();
        const requestedItems = Array.isArray(payload.items)
          ? payload.items.map((item) => ({
              id: toText(item.id),
              projectId: toText(item.projectId),
              projectName: toText(item.projectName),
              kind: toText(item.kind),
              title: toText(item.title)
            })).filter((item) => item.id && item.projectId && item.kind)
          : [];

        if (!requestedItems.length) {
          return sendJson(res, 400, { error: "At least one queue item is required" });
        }

        /** @type {Record<string, unknown>[]} */
        const suppressedItems = [];
        const updated = await store.updateStore((current) => {
          const existing = Array.isArray(current.queueSuppressions) ? current.queueSuppressions : [];
          const existingIds = new Set(existing.map((item) => toText(item.id)));
          const nextSuppressions = [...existing];

          for (const item of requestedItems) {
            if (existingIds.has(item.id)) continue;
            const suppression = {
              id: item.id,
              projectId: item.projectId,
              projectName: item.projectName,
              kind: item.kind,
              title: item.title,
              reason,
              suppressedAt: new Date().toISOString()
            };
            existingIds.add(item.id);
            suppressedItems.push(suppression);
            nextSuppressions.push(suppression);
          }

          return appendGovernanceOperations({
            ...current,
            queueSuppressions: nextSuppressions
          }, [
            createGovernanceOperation("queue-suppress", `Suppressed ${suppressedItems.length} governance queue item(s).`, {
              reason,
              requestedItemIds: requestedItems.map((item) => item.id),
              suppressedItemIds: suppressedItems.map((item) => toText(item.id)),
              totals: {
                requested: requestedItems.length,
                suppressed: suppressedItems.length
              }
            })
          ]);
        });

        return sendJson(res, 200, {
          success: true,
          suppressedItems,
          queueSuppressions: updated.queueSuppressions,
          totals: {
            suppressed: suppressedItems.length
          }
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
      }
    }

    if (pathname === "/api/governance/queue/restore" && req.method === "POST") {
      try {
        const body = await readRequestBody(req);
        const payload = JSON.parse(body);
        const requestedIds = Array.isArray(payload.ids)
          ? payload.ids.map((value) => String(value || "").trim()).filter(Boolean)
          : [];

        if (!requestedIds.length) {
          return sendJson(res, 400, { error: "At least one suppressed queue id is required" });
        }

        const requestedSet = new Set(requestedIds);
        /** @type {Record<string, unknown>[]} */
        const restoredItems = [];
        const updated = await store.updateStore((current) => {
          const existing = Array.isArray(current.queueSuppressions) ? current.queueSuppressions : [];
          const nextSuppressions = existing.filter((item) => {
            if (!requestedSet.has(toText(item.id))) return true;
            restoredItems.push(item);
            return false;
          });

          return appendGovernanceOperations({
            ...current,
            queueSuppressions: nextSuppressions
          }, [
            createGovernanceOperation("queue-restore", `Restored ${restoredItems.length} governance queue item(s).`, {
              requestedIds,
              restoredItemIds: restoredItems.map((item) => toText(item.id)),
              totals: {
                requested: requestedIds.length,
                restored: restoredItems.length
              }
            })
          ]);
        });

        return sendJson(res, 200, {
          success: true,
          restoredItems,
          queueSuppressions: updated.queueSuppressions,
          totals: {
            restored: restoredItems.length
          }
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
      }
    }

    if (req.method === "GET" && pathname === "/api/findings") {
      try {
        const persisted = await store.readStore();
        const projectId = requestUrl.searchParams.get("projectId");
        const findings = projectId
          ? persisted.findings.filter((finding) => finding.projectId === projectId)
          : persisted.findings;
        return sendJson(res, 200, findings);
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "POST" && pathname === "/api/findings/refresh") {
      try {
        const inventory = await getInventoryPayload();
        const findings = buildFindings(inventory);
        await store.updateStore((current) => ({
          ...current,
          findings,
          meta: {
            ...current.meta,
            lastFindingsRefreshAt: new Date().toISOString()
          }
        }));
        return sendJson(res, 200, {
          success: true,
          findings
        });
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (pathname === "/api/tasks") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const projectId = requestUrl.searchParams.get("projectId");
          const tasks = projectId
            ? persisted.tasks.filter((task) => task.projectId === projectId)
            : persisted.tasks;
          return sendJson(res, 200, tasks);
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = JSON.parse(body);
          const task = {
            id: createId("task"),
            projectId: payload.projectId ? String(payload.projectId) : undefined,
            projectName: payload.projectName ? String(payload.projectName) : undefined,
            title: String(payload.title || "").trim(),
            description: String(payload.description || "").trim(),
            priority: payload.priority || "medium",
            status: payload.status || "open",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          if (!task.title) {
            return sendJson(res, 400, { error: "Task title is required" });
          }
          const updated = await store.updateStore((current) => ({
            ...current,
            tasks: [...current.tasks, task]
          }));
          return sendJson(res, 200, { success: true, task, tasks: updated.tasks });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    if (pathname.startsWith("/api/tasks/") && req.method === "PATCH") {
      try {
        const taskId = pathname.split("/").pop();
        const body = await readRequestBody(req);
        const payload = JSON.parse(body);
        let updatedTask = null;
        let previousTask = null;
        const updated = await store.updateStore((current) => {
          const nextTasks = current.tasks.map((task) => {
            if (task.id !== taskId) return task;
            previousTask = task;
            updatedTask = {
              ...task,
              ...payload,
              updatedAt: new Date().toISOString()
            };
            return updatedTask;
          });
          const nextStore = {
            ...current,
            tasks: nextTasks
          };
          if (!updatedTask) return nextStore;

          const previousStatus = toText(previousTask.status);
          const nextStatus = toText(updatedTask.status);
          const title = toText(updatedTask.title) || toText(taskId) || "Task";
          const updatedFields = Object.keys(payload || {}).filter((field) => field !== "updatedAt");
          return appendGovernanceOperations(nextStore, [
            createGovernanceOperation(
              "governance-task-updated",
              previousStatus !== nextStatus
                ? `Updated ${title} task status from ${previousStatus || "unset"} to ${nextStatus || "unset"}.`
                : `Updated ${title} task metadata.`,
              {
                taskId: toText(taskId),
                title,
                projectId: toText(updatedTask.projectId),
                projectName: toText(updatedTask.projectName),
                previousStatus,
                nextStatus,
                updatedFields
              }
            )
          ]);
        });
        if (!updatedTask) {
          return sendJson(res, 404, { error: "Task not found" });
        }
        return sendJson(res, 200, { success: true, task: updatedTask, tasks: updated.tasks });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
      }
    }

    if (pathname === "/api/workflows") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const projectId = requestUrl.searchParams.get("projectId");
          const workflows = projectId
            ? persisted.workflows.filter((workflow) => workflow.projectId === projectId)
            : persisted.workflows;
          return sendJson(res, 200, workflows);
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = JSON.parse(body);
          const workflow = {
            id: createId("workflow"),
            projectId: payload.projectId ? String(payload.projectId) : undefined,
            projectName: payload.projectName ? String(payload.projectName) : undefined,
            title: String(payload.title || "").trim(),
            brief: String(payload.brief || "").trim(),
            status: payload.status || "draft",
            phase: payload.phase || "brief",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          if (!workflow.title) {
            return sendJson(res, 400, { error: "Workflow title is required" });
          }
          const updated = await store.updateStore((current) => ({
            ...current,
            workflows: [...current.workflows, workflow]
          }));
          return sendJson(res, 200, { success: true, workflow, workflows: updated.workflows });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    if (pathname.startsWith("/api/workflows/") && req.method === "PATCH") {
      try {
        const workflowId = pathname.split("/").pop();
        const body = await readRequestBody(req);
        const payload = JSON.parse(body);
        let updatedWorkflow = null;
        const updated = await store.updateStore((current) => ({
          ...current,
          workflows: current.workflows.map((workflow) => {
            if (workflow.id !== workflowId) return workflow;
            updatedWorkflow = {
              ...workflow,
              ...payload,
              updatedAt: new Date().toISOString()
            };
            return updatedWorkflow;
          })
        }));
        if (!updatedWorkflow) {
          return sendJson(res, 404, { error: "Workflow not found" });
        }
        return sendJson(res, 200, { success: true, workflow: updatedWorkflow, workflows: updated.workflows });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
      }
    }

    if (pathname === "/api/notes") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const projectId = requestUrl.searchParams.get("projectId");
          const notes = projectId
            ? persisted.notes.filter((note) => note.projectId === projectId)
            : persisted.notes;
          return sendJson(res, 200, notes);
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = JSON.parse(body);
          const note = {
            id: createId("note"),
            projectId: payload.projectId ? String(payload.projectId) : undefined,
            projectName: payload.projectName ? String(payload.projectName) : undefined,
            title: String(payload.title || "").trim(),
            body: String(payload.body || "").trim(),
            kind: payload.kind || "note",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          if (!note.title) {
            return sendJson(res, 400, { error: "Note title is required" });
          }
          const updated = await store.updateStore((current) => ({
            ...current,
            notes: [...current.notes, note]
          }));
          return sendJson(res, 200, { success: true, note, notes: updated.notes });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    if (pathname.startsWith("/api/notes/") && req.method === "PATCH") {
      try {
        const noteId = pathname.split("/").pop();
        const body = await readRequestBody(req);
        const payload = JSON.parse(body);
        let updatedNote = null;
        const updated = await store.updateStore((current) => ({
          ...current,
          notes: current.notes.map((note) => {
            if (note.id !== noteId) return note;
            updatedNote = {
              ...note,
              ...payload,
              updatedAt: new Date().toISOString()
            };
            return updatedNote;
          })
        }));
        if (!updatedNote) {
          return sendJson(res, 404, { error: "Note not found" });
        }
        return sendJson(res, 200, { success: true, note: updatedNote, notes: updated.notes });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
      }
    }

    if (pathname === "/api/milestones") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const projectId = requestUrl.searchParams.get("projectId");
          const milestones = projectId
            ? persisted.milestones.filter((milestone) => milestone.projectId === projectId)
            : persisted.milestones;
          return sendJson(res, 200, milestones);
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = JSON.parse(body);
          const milestone = {
            id: createId("milestone"),
            projectId: payload.projectId ? String(payload.projectId) : undefined,
            projectName: payload.projectName ? String(payload.projectName) : undefined,
            title: String(payload.title || "").trim(),
            detail: String(payload.detail || "").trim(),
            status: payload.status || "planned",
            targetDate: payload.targetDate ? String(payload.targetDate) : undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          if (!milestone.title) {
            return sendJson(res, 400, { error: "Milestone title is required" });
          }
          const updated = await store.updateStore((current) => ({
            ...current,
            milestones: [...current.milestones, milestone]
          }));
          return sendJson(res, 200, { success: true, milestone, milestones: updated.milestones });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    if (pathname.startsWith("/api/milestones/") && req.method === "PATCH") {
      try {
        const milestoneId = pathname.split("/").pop();
        const body = await readRequestBody(req);
        const payload = JSON.parse(body);
        let updatedMilestone = null;
        const updated = await store.updateStore((current) => ({
          ...current,
          milestones: current.milestones.map((milestone) => {
            if (milestone.id !== milestoneId) return milestone;
            updatedMilestone = {
              ...milestone,
              ...payload,
              updatedAt: new Date().toISOString()
            };
            return updatedMilestone;
          })
        }));
        if (!updatedMilestone) {
          return sendJson(res, 404, { error: "Milestone not found" });
        }
        return sendJson(res, 200, { success: true, milestone: updatedMilestone, milestones: updated.milestones });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
      }
    }

    if (req.method === "GET" && pathname === "/api/script-runs") {
      try {
        const persisted = await store.readStore();
        const projectId = requestUrl.searchParams.get("projectId");
        const scriptRuns = Array.isArray(persisted.scriptRuns) ? persisted.scriptRuns : [];
        const filteredRuns = projectId
          ? scriptRuns.filter((run) => run.projectId === projectId)
          : scriptRuns;
        return sendJson(res, 200, filteredRuns.slice(0, 50));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (pathname === "/api/agent-sessions") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const projectId = requestUrl.searchParams.get("projectId");
          const agentSessions = Array.isArray(persisted.agentSessions) ? persisted.agentSessions : [];
          const filteredSessions = projectId
            ? agentSessions.filter((session) => session.projectId === projectId)
            : agentSessions;
          return sendJson(res, 200, filteredSessions.slice(0, 50));
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = JSON.parse(body);
          const agentSession = {
            id: createId("agent-session"),
            projectId: String(payload.projectId || "").trim(),
            projectName: String(payload.projectName || "").trim(),
            relPath: String(payload.relPath || "").trim(),
            title: String(payload.title || "").trim(),
            summary: String(payload.summary || "").trim(),
            handoffPack: String(payload.handoffPack || "").trim(),
            status: String(payload.status || "prepared").trim() || "prepared",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          if (!agentSession.projectId || !agentSession.projectName || !agentSession.relPath) {
            return sendJson(res, 400, { error: "projectId, projectName, and relPath are required" });
          }
          if (!agentSession.title || !agentSession.handoffPack) {
            return sendJson(res, 400, { error: "title and handoffPack are required" });
          }

          const updated = await store.updateStore((current) => ({
            ...current,
            agentSessions: [agentSession, ...(Array.isArray(current.agentSessions) ? current.agentSessions : [])].slice(0, 200)
          }));

          return sendJson(res, 200, {
            success: true,
            agentSession,
            agentSessions: updated.agentSessions
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    if (req.method === "GET" && pathname.startsWith("/api/run")) {
      const script = requestUrl.searchParams.get("script");
      const relPath = requestUrl.searchParams.get("path");

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      });

      if (!script || !relPath) {
        res.write(`data: ${JSON.stringify({ type: "error", data: "Missing script or path" })}\n\n`);
        return res.end();
      }

      if (!/^[\w:.-]+$/.test(script)) {
        res.write(`data: ${JSON.stringify({ type: "error", data: "Invalid script name" })}\n\n`);
        return res.end();
      }

      const absPath = resolve(resolvedRootDir, relPath);
      if (!isWithin(resolvedRootDir, absPath)) {
        res.write(`data: ${JSON.stringify({ type: "error", data: "Forbidden path" })}\n\n`);
        return res.end();
      }

      const inventory = await getInventoryPayload();
      const project = Array.isArray(inventory.projects)
        ? inventory.projects.find((candidate) => toText(candidate.relPath) === relPath)
        : null;
      const runId = createId("script-run");
      const scriptRun = {
        id: runId,
        projectId: toText(project?.id),
        projectName: toText(project?.name) || relPath,
        relPath,
        script,
        status: "running",
        startedAt: new Date().toISOString(),
        endedAt: null,
        exitCode: null,
        detail: "Script started from the project workbench launchpad."
      };
      await store.updateStore((current) => ({
        ...current,
        scriptRuns: [scriptRun, ...(Array.isArray(current.scriptRuns) ? current.scriptRuns : [])].slice(0, 200)
      }));

      let runFinished = false;
      /**
       * @param {"success" | "failed" | "cancelled"} status
       * @param {{ exitCode?: number | null, detail?: string }} patch
       */
      async function finishScriptRun(status, patch = {}) {
        if (runFinished) return;
        runFinished = true;
        await store.updateStore((current) => ({
          ...current,
          scriptRuns: (Array.isArray(current.scriptRuns) ? current.scriptRuns : []).map((run) => run.id === runId
            ? {
                ...run,
                status,
                exitCode: patch.exitCode ?? null,
                detail: patch.detail || run.detail,
                endedAt: new Date().toISOString()
              }
            : run)
        }));
      }

      res.write(`data: ${JSON.stringify({ type: "start", data: `> npm run ${script} in ${relPath}`, runId })}\n\n`);

      let child;
      try {
        const isWindows = /^win/.test(process.platform);
        child = spawn(isWindows ? "cmd.exe" : "npm", isWindows ? ["/d", "/s", "/c", "npm", "run", script] : ["run", script], {
          cwd: absPath,
          shell: false
        });
      } catch (error) {
        await finishScriptRun("failed", { detail: error.message });
        res.write(`data: ${JSON.stringify({ type: "error", data: error.message })}\n\n`);
        return res.end();
      }

      child.stdout.on("data", (data) => {
        if (res.writableEnded) return;
        for (const line of data.toString().split(/\r?\n/)) {
          if (!line || res.writableEnded) continue;
          res.write(`data: ${JSON.stringify({ type: "stdout", data: line })}\n\n`);
        }
      });

      child.stderr.on("data", (data) => {
        if (res.writableEnded) return;
        for (const line of data.toString().split(/\r?\n/)) {
          if (!line || res.writableEnded) continue;
          res.write(`data: ${JSON.stringify({ type: "stderr", data: line })}\n\n`);
        }
      });

      child.on("close", async (code) => {
        if (res.writableEnded) return;
        await finishScriptRun(code === 0 ? "success" : "failed", {
          exitCode: typeof code === "number" ? code : null,
          detail: `Process exited with code ${code}`
        });
        res.write(`data: ${JSON.stringify({ type: "done", data: `Process exited with code ${code}` })}\n\n`);
        res.end();
      });

      child.on("error", async (error) => {
        if (res.writableEnded) return;
        await finishScriptRun("failed", { detail: error.message });
        res.write(`data: ${JSON.stringify({ type: "error", data: error.message })}\n\n`);
        res.end();
      });

      req.on("close", () => {
        if (!runFinished && child && !child.killed) {
          void finishScriptRun("cancelled", { detail: "Script run cancelled because the client disconnected." });
          child.kill();
        }
      });
      return;
    }

    try {
      const urlPath = pathname === "/" ? "/index.html" : pathname || "/index.html";
      const relativePath = urlPath.replace(/^\/+/, "") || "index.html";
      let filePath = resolve(resolvedPublicDir, relativePath);

      if (!isWithin(resolvedPublicDir, filePath)) {
        res.writeHead(403);
        return res.end("Forbidden");
      }

      let fileStat;
      try {
        fileStat = await stat(filePath);
      } catch (error) {
        if (error.code === "ENOENT" && relativePath === "index.html") {
          await getInventoryPayload();
          filePath = resolve(resolvedPublicDir, "index.html");
          fileStat = await stat(filePath);
        } else {
          throw error;
        }
      }

      if (!fileStat.isFile()) {
        res.writeHead(404);
        return res.end("Not Found");
      }

      const content = await readFile(filePath);
      const ext = extname(filePath).toLowerCase();
      let contentType = "text/plain";
      if (ext === ".html") contentType = "text/html";
      else if (ext === ".css") contentType = "text/css";
      else if (ext === ".json") contentType = "application/json";
      else if (ext === ".js") contentType = "application/javascript";

      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "no-store"
      });
      res.end(content);
    } catch (error) {
      if (error.code === "ENOENT") {
        res.writeHead(404);
        res.end("Not Found");
      } else {
        res.writeHead(500);
        res.end(error.message);
      }
    }
  });
}
