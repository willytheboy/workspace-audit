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
const CLI_BRIDGE_RUN_TRACE_BASELINE_STALE_HOURS = 24;

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
   * @param {Record<string, unknown>} payload
   */
  function createTaskSeedingCheckpoint(payload) {
    const allowedStatuses = new Set(["approved", "deferred", "dismissed", "needs-review"]);
    const status = allowedStatuses.has(toText(payload.status)) ? toText(payload.status) : "needs-review";
    return {
      id: createId("task-seeding-checkpoint"),
      batchId: toText(payload.batchId) || createId("task-seeding-batch"),
      title: toText(payload.title) || "Generated task batch checkpoint",
      source: toText(payload.source) || "governance",
      status,
      itemCount: toNumber(payload.itemCount),
      note: toText(payload.note),
      reviewer: toText(payload.reviewer) || "operator",
      secretPolicy: "Non-secret generated task batch checkpoint metadata only. Do not store passwords, tokens, certificates, private keys, cookies, or browser sessions.",
      createdAt: new Date().toISOString()
    };
  }

  /**
   * @param {unknown} value
   */
  function normalizeAgentPolicyCheckpointStatus(value) {
    const status = toText(value).toLowerCase();
    return ["approved", "deferred", "dismissed", "needs-review"].includes(status) ? status : "needs-review";
  }

  /**
   * @param {unknown} value
   */
  function normalizeAgentExecutionResultCheckpointStatus(value) {
    const status = toText(value).toLowerCase();
    return ["approved", "deferred", "dismissed", "needs-review"].includes(status) ? status : "needs-review";
  }

  /**
   * @param {unknown} value
   */
  function normalizeAgentExecutionResultTargetAction(value) {
    const action = toText(value).toLowerCase();
    return ["retry", "archive", "retention", "resolve-sla", "baseline-refresh"].includes(action) ? action : "baseline-refresh";
  }

  /**
   * @param {string} runId
   * @param {string} targetAction
   */
  function createAgentExecutionResultCheckpointKey(runId, targetAction) {
    return `${toText(runId)}::${normalizeAgentExecutionResultTargetAction(targetAction)}`;
  }

  /**
   * @param {unknown} value
   */
  function toTextList(value) {
    return Array.isArray(value) ? value.map(toText).filter(Boolean) : [];
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function createAgentPolicyCheckpoint(payload) {
    const projectId = toText(payload.projectId);
    const policyId = toText(payload.policyId) || (projectId ? `agent-policy:${projectId}` : "");
    const status = normalizeAgentPolicyCheckpointStatus(payload.status);
    return {
      id: createId("agent-policy-checkpoint"),
      policyId,
      projectId,
      projectName: toText(payload.projectName),
      relPath: toText(payload.relPath),
      status,
      role: toText(payload.role) || "readiness-reviewer",
      runtime: toText(payload.runtime) || "planning-only-agent",
      isolationMode: toText(payload.isolationMode) || "read-only-planning",
      skillBundle: toTextList(payload.skillBundle),
      hookPolicy: toTextList(payload.hookPolicy),
      source: toText(payload.source) || "agent-control-plane",
      reason: toText(payload.reason) || `Operator marked generated managed-agent policy as ${status}.`,
      note: toText(payload.note),
      reviewer: toText(payload.reviewer) || "operator",
      secretPolicy: "Non-secret managed agent policy checkpoint metadata only. Do not store passwords, tokens, certificates, private keys, cookies, browser sessions, or prompt text containing secrets.",
      createdAt: new Date().toISOString()
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function createAgentExecutionResultCheckpoint(payload) {
    const runId = toText(payload.runId);
    const targetAction = normalizeAgentExecutionResultTargetAction(payload.targetAction);
    const status = normalizeAgentExecutionResultCheckpointStatus(payload.status);
    const runStatus = toText(payload.runStatus);
    return {
      id: createId("agent-execution-result-checkpoint"),
      runId,
      projectId: toText(payload.projectId),
      projectName: toText(payload.projectName),
      runTitle: toText(payload.runTitle) || "Agent Work Order Run",
      runStatus,
      resultType: toText(payload.resultType) || (runStatus === "failed" || runStatus === "cancelled" || runStatus === "passed" ? "terminal" : "execution-result"),
      targetAction,
      status,
      source: toText(payload.source) || "governance-execution-queue",
      reason: toText(payload.reason) || `Operator marked ${targetAction} handling as ${status}.`,
      note: toText(payload.note),
      reviewer: toText(payload.reviewer) || "operator",
      secretPolicy: "Non-secret execution result checkpoint metadata only. Do not store passwords, tokens, certificates, private keys, cookies, browser sessions, or command output containing secrets.",
      createdAt: new Date().toISOString()
    };
  }

  /**
   * @param {unknown} value
   */
  function isClosedTaskStatus(value) {
    return ["done", "resolved", "closed", "cancelled", "archived"].includes(toText(value).toLowerCase());
  }

  /**
   * @param {string} targetAction
   */
  function getAgentExecutionResultTargetActionLabel(targetAction) {
    const labels = {
      retry: "Retry",
      archive: "Archive",
      retention: "Retention",
      "resolve-sla": "Resolve SLA",
      "baseline-refresh": "Baseline refresh"
    };
    return labels[normalizeAgentExecutionResultTargetAction(targetAction)] || "Execution result";
  }

  /**
   * @param {Record<string, unknown>} checkpoint
   */
  function getAgentExecutionResultTaskPriority(checkpoint) {
    const targetAction = normalizeAgentExecutionResultTargetAction(checkpoint.targetAction);
    if (targetAction === "baseline-refresh" || targetAction === "resolve-sla") return "high";
    if (targetAction === "retry") return "medium";
    return "low";
  }

  /**
   * @param {Record<string, unknown>} checkpoint
   * @param {Record<string, unknown>} run
   */
  function createAgentExecutionResultCheckpointTask(checkpoint, run) {
    const targetAction = normalizeAgentExecutionResultTargetAction(checkpoint.targetAction);
    const actionLabel = getAgentExecutionResultTargetActionLabel(targetAction);
    const projectId = toText(checkpoint.projectId || run.projectId) || "agent-execution-results";
    const projectName = toText(checkpoint.projectName || run.projectName) || "Agent Execution";
    const runTitle = toText(checkpoint.runTitle || run.title) || "Agent Work Order Run";
    const runStatus = toText(checkpoint.runStatus || run.status) || "status-unset";
    const priority = getAgentExecutionResultTaskPriority(checkpoint);
    const descriptionLines = [
      `Execution result gate: ${actionLabel}`,
      `Run: ${runTitle}`,
      `Run ID: ${toText(checkpoint.runId || run.id)}`,
      `Run status: ${runStatus}`,
      `Checkpoint status: ${normalizeAgentExecutionResultCheckpointStatus(checkpoint.status)}`,
      `Checkpoint ID: ${toText(checkpoint.id)}`,
      `Reason: ${toText(checkpoint.reason) || "Operator deferred execution result handling."}`,
      toText(checkpoint.note) ? `Note: ${toText(checkpoint.note)}` : "",
      "Secret policy: Record only non-secret execution-result follow-up evidence. Do not store passwords, tokens, certificates, private keys, cookies, browser sessions, or command output containing secrets."
    ].filter(Boolean);

    return {
      id: createId("task"),
      projectId,
      projectName,
      title: `Execution result gate: ${actionLabel} for ${projectName}`,
      description: descriptionLines.join("\n"),
      priority,
      status: "open",
      agentExecutionResultCheckpointId: toText(checkpoint.id),
      agentExecutionResultRunId: toText(checkpoint.runId || run.id),
      agentExecutionResultRunTitle: runTitle,
      agentExecutionResultRunStatus: runStatus,
      agentExecutionResultTargetAction: targetAction,
      agentExecutionResultCheckpointStatus: normalizeAgentExecutionResultCheckpointStatus(checkpoint.status),
      agentExecutionResultResultType: toText(checkpoint.resultType) || "execution-result",
      secretPolicy: "non-secret-execution-result-follow-up-evidence-only",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * @param {unknown[]} tasks
   * @param {Record<string, unknown>} checkpoint
   */
  function findOpenAgentExecutionResultTask(tasks, checkpoint) {
    const runId = toText(checkpoint.runId);
    const targetAction = normalizeAgentExecutionResultTargetAction(checkpoint.targetAction);
    return (Array.isArray(tasks) ? tasks : []).map(toControlPlaneRecord).find((task) => (
      toText(task.agentExecutionResultRunId) === runId
      && normalizeAgentExecutionResultTargetAction(task.agentExecutionResultTargetAction) === targetAction
      && !isClosedTaskStatus(task.status)
    )) || null;
  }

  /**
   * @param {unknown[]} checkpoints
   */
  function createAgentPolicyCheckpointSummary(checkpoints = []) {
    const summary = {
      total: 0,
      approved: 0,
      deferred: 0,
      dismissed: 0,
      needsReview: 0,
      unresolved: 0
    };

    for (const checkpoint of (Array.isArray(checkpoints) ? checkpoints : []).map(toControlPlaneRecord)) {
      const status = normalizeAgentPolicyCheckpointStatus(checkpoint.status);
      summary.total += 1;
      if (status === "approved") {
        summary.approved += 1;
      } else if (status === "deferred") {
        summary.deferred += 1;
        summary.unresolved += 1;
      } else if (status === "dismissed") {
        summary.dismissed += 1;
      } else {
        summary.needsReview += 1;
        summary.unresolved += 1;
      }
    }

    return summary;
  }

  /**
   * @param {unknown[]} checkpoints
   */
  function createLatestAgentPolicyCheckpointMap(checkpoints = []) {
    const latest = new Map();
    const sorted = (Array.isArray(checkpoints) ? checkpoints : [])
      .map(toControlPlaneRecord)
      .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime());

    for (const checkpoint of sorted) {
      const policyId = toText(checkpoint.policyId) || (toText(checkpoint.projectId) ? `agent-policy:${toText(checkpoint.projectId)}` : "");
      if (!policyId || latest.has(policyId)) continue;
      latest.set(policyId, checkpoint);
    }

    return latest;
  }

  /**
   * @param {unknown[]} checkpoints
   */
  function createAgentExecutionResultCheckpointSummary(checkpoints = []) {
    const summary = {
      total: 0,
      approved: 0,
      deferred: 0,
      dismissed: 0,
      needsReview: 0,
      unresolved: 0
    };

    for (const checkpoint of (Array.isArray(checkpoints) ? checkpoints : []).map(toControlPlaneRecord)) {
      const status = normalizeAgentExecutionResultCheckpointStatus(checkpoint.status);
      summary.total += 1;
      if (status === "approved") {
        summary.approved += 1;
      } else if (status === "deferred") {
        summary.deferred += 1;
        summary.unresolved += 1;
      } else if (status === "dismissed") {
        summary.dismissed += 1;
      } else {
        summary.needsReview += 1;
        summary.unresolved += 1;
      }
    }

    return summary;
  }

  /**
   * @param {unknown[]} checkpoints
   */
  function createLatestAgentExecutionResultCheckpointMap(checkpoints = []) {
    const latest = new Map();
    const sorted = (Array.isArray(checkpoints) ? checkpoints : [])
      .map(toControlPlaneRecord)
      .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime());

    for (const checkpoint of sorted) {
      const runId = toText(checkpoint.runId);
      const targetAction = normalizeAgentExecutionResultTargetAction(checkpoint.targetAction);
      if (!runId) continue;
      const key = createAgentExecutionResultCheckpointKey(runId, targetAction);
      if (!latest.has(key)) latest.set(key, checkpoint);
    }

    return latest;
  }

  /**
   * @param {Map<string, Record<string, unknown>>} latestCheckpoints
   * @param {string} runId
   * @param {string} targetAction
   */
  function getLatestAgentExecutionResultCheckpoint(latestCheckpoints, runId, targetAction) {
    return latestCheckpoints.get(createAgentExecutionResultCheckpointKey(runId, targetAction)) || {};
  }

  /**
   * @param {Map<string, Record<string, unknown>>} latestCheckpoints
   * @param {string} runId
   * @param {string} targetAction
   */
  function hasApprovedAgentExecutionResultCheckpoint(latestCheckpoints, runId, targetAction) {
    return normalizeAgentExecutionResultCheckpointStatus(getLatestAgentExecutionResultCheckpoint(latestCheckpoints, runId, targetAction).status) === "approved";
  }

  /**
   * @param {Record<string, unknown>} run
   * @param {ReturnType<typeof normalizeAgentExecutionPolicy>} policy
   */
  function isStaleAgentExecutionRun(run, policy) {
    const status = toText(run.status) || "queued";
    if (!policy.staleStatuses.includes(status)) return false;
    const timestamp = new Date(toText(run.updatedAt || run.createdAt)).getTime();
    return Number.isFinite(timestamp) && timestamp < Date.now() - (policy.staleThresholdHours * 60 * 60 * 1000);
  }

  /**
   * @param {unknown[]} runs
   * @param {ReturnType<typeof normalizeAgentExecutionPolicy>} policy
   * @param {Map<string, Record<string, unknown>>} latestCheckpoints
   */
  function createAgentExecutionResultRequirementSummary(runs = [], policy, latestCheckpoints) {
    const summary = {
      retryBlocked: 0,
      archiveBlocked: 0,
      retentionBlocked: 0,
      slaResolveBlocked: 0,
      baselineBlocked: 0,
      totalBlocked: 0,
      items: []
    };
    const terminalStatuses = new Set(policy.terminalStatuses);

    for (const run of (Array.isArray(runs) ? runs : []).map(toControlPlaneRecord)) {
      const runId = toText(run.id);
      if (!runId || toText(run.archivedAt)) continue;
      const status = toText(run.status) || "queued";
      const projectName = toText(run.projectName) || "Portfolio";
      const title = toText(run.title) || "Agent Work Order Run";
      const pushRequirement = (targetAction, reason) => {
        if (hasApprovedAgentExecutionResultCheckpoint(latestCheckpoints, runId, targetAction)) return;
        const checkpoint = getLatestAgentExecutionResultCheckpoint(latestCheckpoints, runId, targetAction);
        summary.items.push({
          runId,
          projectId: toText(run.projectId),
          projectName,
          runTitle: title,
          runStatus: status,
          targetAction,
          reason,
          checkpointStatus: normalizeAgentExecutionResultCheckpointStatus(checkpoint.status),
          checkpointId: toText(checkpoint.id),
          updatedAt: toText(checkpoint.createdAt || run.updatedAt || run.createdAt)
        });
        if (targetAction === "retry") summary.retryBlocked += 1;
        if (targetAction === "archive") summary.archiveBlocked += 1;
        if (targetAction === "retention") summary.retentionBlocked += 1;
        if (targetAction === "resolve-sla") summary.slaResolveBlocked += 1;
        if (targetAction === "baseline-refresh") summary.baselineBlocked += 1;
      };

      if (["failed", "cancelled"].includes(status)) {
        pushRequirement("retry", `Retrying ${status} run requires an approved result checkpoint.`);
      }
      if (terminalStatuses.has(status)) {
        pushRequirement("archive", `Archiving ${status} run requires an approved result checkpoint.`);
        pushRequirement("retention", `Retention archival for ${status} run requires an approved result checkpoint.`);
        pushRequirement("baseline-refresh", `Refreshing the Control Plane baseline while ${status} result remains active requires an approved result checkpoint.`);
      }
      if (toText(run.slaBreachedAt) && !toText(run.slaResolvedAt)) {
        pushRequirement("resolve-sla", "Resolving an SLA breach requires an approved result checkpoint.");
        pushRequirement("baseline-refresh", "Refreshing the Control Plane baseline while an SLA breach is open requires an approved result checkpoint.");
      } else if (isStaleAgentExecutionRun(run, policy)) {
        pushRequirement("baseline-refresh", "Refreshing the Control Plane baseline while a stale active run is present requires an approved result checkpoint.");
      }
    }

    summary.totalBlocked = summary.retryBlocked
      + summary.archiveBlocked
      + summary.retentionBlocked
      + summary.slaResolveBlocked
      + summary.baselineBlocked;
    summary.items = summary.items
      .sort((left, right) => new Date(toText(right.updatedAt)).getTime() - new Date(toText(left.updatedAt)).getTime())
      .slice(0, 50);
    return summary;
  }

  /**
   * @param {Record<string, unknown>} item
   * @param {Record<string, unknown> | undefined} latestCheckpoint
   */
  function createAgentPolicyRecommendation(item, latestCheckpoint) {
    const blockers = toTextList(item.blockers).map((blocker) => blocker.toLowerCase());
    const projectId = toText(item.projectId);
    const status = toText(item.status) || "blocked";
    const skillBundle = new Set(["project-governance", "validation-runner", "handoff-pack"]);
    const hookPolicy = new Set(["policy-checkpoint-required", "preflight-status-review", "post-run-validation-log"]);
    let role = status === "ready" ? "implementation-worker" : status === "needs-prep" ? "planning-coordinator" : "readiness-reviewer";
    let runtime = status === "ready" ? "supervised-local-agent" : "planning-only-agent";
    let isolationMode = status === "ready" ? "workspace-write-with-validation" : "read-only-planning";

    if (blockers.some((blocker) => blocker.includes("profile missing"))) {
      role = "governance-profiler";
      skillBundle.add("profile-authoring");
      hookPolicy.add("profile-required");
    }
    if (blockers.some((blocker) => blocker.includes("owner missing"))) {
      role = "ownership-coordinator";
      skillBundle.add("operator-handoff");
      isolationMode = "read-only-planning";
    }
    if (blockers.some((blocker) => blocker.includes("workflow missing"))) {
      role = "workflow-architect";
      skillBundle.add("workflow-design");
      hookPolicy.add("workflow-required");
    }
    if (blockers.some((blocker) => blocker.includes("open finding"))) {
      role = "risk-reviewer";
      runtime = "review-only-agent";
      isolationMode = "read-only-review";
      skillBundle.add("code-review");
      hookPolicy.add("finding-resolution-gate");
    }
    if (blockers.some((blocker) => blocker.includes("execution task missing"))) {
      role = "task-breakdown-planner";
      skillBundle.add("task-authoring");
      hookPolicy.add("task-link-required");
    }
    if (blockers.some((blocker) => blocker.includes("agent handoff missing"))) {
      role = "handoff-author";
      skillBundle.add("agent-handoff");
      hookPolicy.add("handoff-required");
    }

    const checkpoint = latestCheckpoint ? toControlPlaneRecord(latestCheckpoint) : {};
    const checkpointStatus = checkpoint.policyId ? normalizeAgentPolicyCheckpointStatus(checkpoint.status) : "needs-review";

    return {
      policyId: projectId ? `agent-policy:${projectId}` : "",
      checkpointId: toText(checkpoint.id),
      checkpointStatus,
      executable: checkpointStatus === "approved",
      role,
      runtime,
      isolationMode,
      skillBundle: [...skillBundle],
      hookPolicy: [...hookPolicy],
      source: "agent-control-plane",
      recommendedAction: checkpointStatus === "approved"
        ? "Policy approved. This generated agent work order can be queued with the selected managed role and skills."
        : checkpointStatus === "dismissed"
          ? "Policy dismissed. Do not queue this generated agent work order until a new policy is reviewed."
          : checkpointStatus === "deferred"
            ? "Policy deferred. Resolve the deferral before queueing this generated agent work order."
            : "Review and approve, defer, or dismiss this generated managed-agent policy before queueing.",
      secretPolicy: "Non-secret managed agent policy metadata only. Resolve credentials and private repository access outside this checkpoint."
    };
  }

  /**
   * @param {Record<string, unknown>} checkpoint
   */
  function isSourceAccessTaskSeedingCheckpoint(checkpoint) {
    const text = [
      checkpoint.source,
      checkpoint.batchId,
      checkpoint.title
    ].map(toText).join(" ").toLowerCase();
    return [
      "source-access",
      "sources-access",
      "data-sources",
      "source validation",
      "source review",
      "source evidence"
    ].some((token) => text.includes(token));
  }

  /**
   * @param {unknown[]} checkpoints
   */
  function createSourceAccessCheckpointSummary(checkpoints = []) {
    const summary = {
      total: 0,
      approved: 0,
      deferred: 0,
      dismissed: 0,
      needsReview: 0,
      unresolved: 0,
      sources: 0,
      bySource: []
    };
    const bySource = new Map();
    const sourceAccessCheckpoints = (Array.isArray(checkpoints) ? checkpoints : [])
      .map(toControlPlaneRecord)
      .filter(isSourceAccessTaskSeedingCheckpoint);

    for (const checkpoint of sourceAccessCheckpoints) {
      const status = toText(checkpoint.status) || "needs-review";
      const source = toText(checkpoint.source) || "source-access";
      const sourceSummary = bySource.get(source) || {
        source,
        total: 0,
        approved: 0,
        deferred: 0,
        dismissed: 0,
        needsReview: 0,
        unresolved: 0,
        latestAt: ""
      };

      summary.total += 1;
      sourceSummary.total += 1;
      if (status === "approved") {
        summary.approved += 1;
        sourceSummary.approved += 1;
      } else if (status === "deferred") {
        summary.deferred += 1;
        summary.unresolved += 1;
        sourceSummary.deferred += 1;
        sourceSummary.unresolved += 1;
      } else if (status === "dismissed") {
        summary.dismissed += 1;
        sourceSummary.dismissed += 1;
      } else {
        summary.needsReview += 1;
        summary.unresolved += 1;
        sourceSummary.needsReview += 1;
        sourceSummary.unresolved += 1;
      }

      const createdAt = toText(checkpoint.createdAt);
      if (createdAt && (!sourceSummary.latestAt || new Date(createdAt).getTime() > new Date(sourceSummary.latestAt).getTime())) {
        sourceSummary.latestAt = createdAt;
      }
      bySource.set(source, sourceSummary);
    }

    summary.sources = bySource.size;
    summary.bySource = [...bySource.values()].sort((left, right) => {
      const unresolvedDelta = right.unresolved - left.unresolved;
      if (unresolvedDelta) return unresolvedDelta;
      const totalDelta = right.total - left.total;
      if (totalDelta) return totalDelta;
      return left.source.localeCompare(right.source);
    });
    return summary;
  }

  /**
   * @param {unknown[]} checkpoints
   * @param {Record<string, unknown>} source
   */
  function createSourceAccessCheckpointDrilldown(checkpoints = [], source = {}) {
    const sourceRecord = toControlPlaneRecord(source);
    const candidateTokens = [
      sourceRecord.id,
      sourceRecord.sourceId,
      sourceRecord.label,
      sourceRecord.value,
      sourceRecord.path,
      sourceRecord.url
    ]
      .map(toText)
      .filter((token) => token.length >= 3)
      .map((token) => token.toLowerCase());
    const uniqueTokens = [...new Set(candidateTokens)];
    const matches = (Array.isArray(checkpoints) ? checkpoints : [])
      .map(toControlPlaneRecord)
      .filter((checkpoint) => {
        if (!isSourceAccessTaskSeedingCheckpoint(checkpoint)) return false;
        const text = [
          checkpoint.source,
          checkpoint.batchId,
          checkpoint.title
        ].map(toText).join(" ").toLowerCase();
        return uniqueTokens.some((token) => text.includes(token));
      })
      .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime());
    const summary = createSourceAccessCheckpointSummary(matches);
    return {
      ...summary,
      items: matches.slice(0, 5).map((checkpoint) => ({
        id: toText(checkpoint.id),
        batchId: toText(checkpoint.batchId),
        title: toText(checkpoint.title) || "Source-access checkpoint",
        source: toText(checkpoint.source),
        status: toText(checkpoint.status) || "needs-review",
        itemCount: toNumber(checkpoint.itemCount),
        createdAt: toText(checkpoint.createdAt)
      }))
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

  function normalizeConvergenceReviewStatus(status) {
    const value = String(status || "").trim().toLowerCase();
    return ["confirmed-overlap", "not-related", "needs-review", "merge-candidate"].includes(value)
      ? value
      : "needs-review";
  }

  function createConvergencePairId(leftId, rightId) {
    const ids = [String(leftId || "").trim(), String(rightId || "").trim()].sort();
    return ids.join("__converges_with__");
  }

  function normalizeConvergenceReview(record) {
    const value = record && typeof record === "object" ? record : {};
    const leftId = String(value.leftId || "").trim();
    const rightId = String(value.rightId || "").trim();
    if (!leftId || !rightId || leftId === rightId) return null;
    const pairId = String(value.pairId || createConvergencePairId(leftId, rightId)).trim();
    return {
      id: String(value.id || pairId).trim(),
      pairId,
      leftId,
      rightId,
      leftName: String(value.leftName || leftId).trim(),
      rightName: String(value.rightName || rightId).trim(),
      score: toNumber(value.score),
      reasons: Array.isArray(value.reasons) ? value.reasons.map((reason) => String(reason || "").trim()).filter(Boolean) : [],
      status: normalizeConvergenceReviewStatus(value.status),
      note: String(value.note || "").trim(),
      reviewer: String(value.reviewer || "operator").trim(),
      source: String(value.source || "manual-review").trim(),
      operatorContext: String(value.operatorContext || "").trim(),
      generatedInsight: String(value.generatedInsight || "").trim(),
      assimilationRecommendation: normalizeConvergenceReviewStatus(value.assimilationRecommendation),
      createdAt: String(value.createdAt || new Date().toISOString()),
      updatedAt: String(value.updatedAt || value.createdAt || new Date().toISOString()),
      secretPolicy: "Non-secret convergence review metadata only."
    };
  }

  function normalizeConvergenceReviews(reviews) {
    return Array.isArray(reviews)
      ? reviews.map(normalizeConvergenceReview).filter(Boolean)
      : [];
  }

  function getConvergencePairReviewMap(reviews) {
    const map = new Map();
    for (const review of normalizeConvergenceReviews(reviews)) {
      map.set(review.pairId, review);
    }
    return map;
  }

  function normalizeGeneratedConvergenceCandidate(candidate) {
    const value = candidate && typeof candidate === "object" ? candidate : {};
    const leftId = String(value.leftId || "").trim();
    const rightId = String(value.rightId || "").trim();
    if (!leftId || !rightId || leftId === rightId) return null;
    return {
      pairId: createConvergencePairId(leftId, rightId),
      leftId,
      rightId,
      leftName: String(value.leftName || leftId).trim(),
      rightName: String(value.rightName || rightId).trim(),
      score: toNumber(value.score),
      reasons: Array.isArray(value.reasons) ? value.reasons.map((reason) => String(reason || "").trim()).filter(Boolean) : []
    };
  }

  function getGeneratedConvergenceCandidates(inventory) {
    const candidateMap = new Map();
    const addCandidate = (candidate) => {
      const normalized = normalizeGeneratedConvergenceCandidate(candidate);
      if (!normalized) return;
      if (!candidateMap.has(normalized.pairId)) {
        candidateMap.set(normalized.pairId, normalized);
      }
    };

    for (const candidate of Array.isArray(inventory?.crossChecks) ? inventory.crossChecks : []) {
      addCandidate(candidate);
    }

    for (const project of Array.isArray(inventory?.projects) ? inventory.projects : []) {
      const leftId = String(project?.id || "").trim();
      if (!leftId) continue;
      const leftName = String(project?.name || leftId).trim();
      for (const similar of Array.isArray(project?.similarApps) ? project.similarApps : []) {
        addCandidate({
          leftId,
          rightId: similar?.id,
          leftName,
          rightName: similar?.name,
          score: similar?.score,
          reasons: similar?.reasons
        });
      }
    }

    return [...candidateMap.values()].sort((left, right) =>
      right.score - left.score || left.leftName.localeCompare(right.leftName) || left.rightName.localeCompare(right.rightName)
    );
  }

  function findConvergenceCandidate(inventory, leftId, rightId) {
    const pairId = createConvergencePairId(leftId, rightId);
    return getGeneratedConvergenceCandidates(inventory)
      .find((candidate) => createConvergencePairId(candidate.leftId, candidate.rightId) === pairId) || null;
  }

  function findInventoryProject(inventory, projectId) {
    const id = String(projectId || "").trim();
    return (Array.isArray(inventory?.projects) ? inventory.projects : [])
      .find((project) => String(project.id || "").trim() === id) || null;
  }

  function createConvergenceTextTokens(project) {
    const text = [
      project?.name,
      project?.description,
      project?.relPath,
      project?.zone,
      project?.category,
      ...(Array.isArray(project?.frameworks) ? project.frameworks : []),
      ...(Array.isArray(project?.languages) ? project.languages : [])
    ].join(" ").toLowerCase();
    return new Set(text
      .split(/[^a-z0-9+#.]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !["app", "application", "project", "workspace", "src", "test"].includes(token)));
  }

  function getSharedValues(leftValues, rightValues) {
    const rightSet = new Set((Array.isArray(rightValues) ? rightValues : []).map((value) => String(value || "").trim().toLowerCase()).filter(Boolean));
    return [...new Set((Array.isArray(leftValues) ? leftValues : []).map((value) => String(value || "").trim()).filter(Boolean))]
      .filter((value) => rightSet.has(value.toLowerCase()));
  }

  function createOperatorConvergenceDueDiligence(inventory, payload) {
    const leftId = String(payload.leftId || "").trim();
    const rightId = String(payload.rightId || "").trim();
    const left = findInventoryProject(inventory, leftId);
    const right = findInventoryProject(inventory, rightId);
    if (!left || !right) {
      throw new Error("Operator convergence proposals require two known projects from the current inventory");
    }
    if (leftId === rightId) {
      throw new Error("Operator convergence proposals require two different projects");
    }

    const existingCandidate = findConvergenceCandidate(inventory, leftId, rightId);
    const sharedFrameworks = getSharedValues(left.frameworks, right.frameworks);
    const sharedLanguages = getSharedValues(left.languages, right.languages);
    const leftTokens = createConvergenceTextTokens(left);
    const rightTokens = createConvergenceTextTokens(right);
    const sharedTokens = [...leftTokens].filter((token) => rightTokens.has(token)).slice(0, 8);
    const sameZone = Boolean(left.zone && right.zone && left.zone === right.zone);
    const sameCategory = Boolean(left.category && right.category && left.category === right.category);

    const reasons = new Set(Array.isArray(existingCandidate?.reasons) ? existingCandidate.reasons : []);
    if (sharedFrameworks.length) reasons.add(`Shared frameworks: ${sharedFrameworks.slice(0, 5).join(", ")}`);
    if (sharedLanguages.length) reasons.add(`Shared languages: ${sharedLanguages.slice(0, 5).join(", ")}`);
    if (sameZone) reasons.add(`Same workspace zone: ${left.zone}`);
    if (sameCategory) reasons.add(`Same category: ${left.category}`);
    if (sharedTokens.length) reasons.add(`Shared domain tokens: ${sharedTokens.join(", ")}`);
    reasons.add("Operator supplied overlap proposal.");

    const generatedScore = existingCandidate
      ? toNumber(existingCandidate.score)
      : Math.min(95, Math.max(45,
          35
          + Math.min(sharedFrameworks.length * 8, 24)
          + Math.min(sharedLanguages.length * 5, 15)
          + Math.min(sharedTokens.length * 3, 18)
          + (sameZone ? 8 : 0)
          + (sameCategory ? 10 : 0)
          + (String(payload.operatorContext || "").trim() ? 10 : 0)
        ));
    const recommendation = generatedScore >= 82
      ? "merge-candidate"
      : generatedScore >= 60
        ? "confirmed-overlap"
        : "needs-review";
    const insight = [
      `AI-assisted due diligence scored this operator-proposed overlap at ${generatedScore}%.`,
      existingCandidate ? "The pair already exists in generated convergence candidates." : "The pair was not present in generated convergence candidates and is being added from operator knowledge.",
      sharedFrameworks.length ? `Shared framework evidence: ${sharedFrameworks.slice(0, 5).join(", ")}.` : "No shared framework evidence was detected.",
      sharedTokens.length ? `Shared domain evidence: ${sharedTokens.join(", ")}.` : "No strong shared domain-token evidence was detected.",
      `Assimilation recommendation: ${recommendation.replaceAll("-", " ")}.`
    ].join(" ");

    return {
      left,
      right,
      score: generatedScore,
      reasons: [...reasons],
      recommendation,
      insight
    };
  }

  function createConvergenceReviewRecord(payload, existing, inventory) {
    const leftId = String(payload.leftId || "").trim();
    const rightId = String(payload.rightId || "").trim();
    if (!leftId || !rightId) {
      throw new Error("leftId and rightId are required");
    }
    if (leftId === rightId) {
      throw new Error("leftId and rightId must be different projects");
    }

    const now = new Date().toISOString();
    const pairId = createConvergencePairId(leftId, rightId);
    const candidate = findConvergenceCandidate(inventory, leftId, rightId);
    const existingRecord = normalizeConvergenceReview(existing);
    const leftName = String(payload.leftName || (candidate?.leftId === leftId ? candidate.leftName : candidate?.rightId === leftId ? candidate.rightName : "") || existingRecord?.leftName || leftId).trim();
    const rightName = String(payload.rightName || (candidate?.rightId === rightId ? candidate.rightName : candidate?.leftId === rightId ? candidate.leftName : "") || existingRecord?.rightName || rightId).trim();
    const score = toNumber(payload.score ?? candidate?.score ?? existingRecord?.score);
    const reasons = Array.isArray(payload.reasons)
      ? payload.reasons.map((reason) => String(reason || "").trim()).filter(Boolean)
      : Array.isArray(candidate?.reasons)
        ? candidate.reasons.map((reason) => String(reason || "").trim()).filter(Boolean)
        : existingRecord?.reasons || [];

    return {
      id: existingRecord?.id || createId("convergence-review"),
      pairId,
      leftId,
      rightId,
      leftName,
      rightName,
      score,
      reasons,
      status: normalizeConvergenceReviewStatus(payload.status || existingRecord?.status),
      note: String(payload.note || "").trim().slice(0, 1200),
      reviewer: String(payload.reviewer || existingRecord?.reviewer || "operator").trim().slice(0, 120),
      source: String(payload.source || existingRecord?.source || "manual-review").trim().slice(0, 120) || "manual-review",
      operatorContext: String(payload.operatorContext || existingRecord?.operatorContext || "").trim().slice(0, 1200),
      generatedInsight: String(payload.generatedInsight || existingRecord?.generatedInsight || "").trim().slice(0, 1600),
      assimilationRecommendation: normalizeConvergenceReviewStatus(payload.assimilationRecommendation || existingRecord?.assimilationRecommendation),
      createdAt: existingRecord?.createdAt || now,
      updatedAt: now,
      secretPolicy: "Non-secret convergence review metadata only."
    };
  }

  function createOperatorConvergenceProposalReview(payload, existing, inventory) {
    const diligence = createOperatorConvergenceDueDiligence(inventory, payload);
    const operatorContext = String(payload.operatorContext || "").trim();
    const recommendation = normalizeConvergenceReviewStatus(payload.status || diligence.recommendation);
    const note = [
      operatorContext ? `Operator context: ${operatorContext}` : "Operator context: overlap proposed from user knowledge.",
      `AI insight: ${diligence.insight}`,
      `Recommended status: ${diligence.recommendation}.`
    ].join(" ");

    return createConvergenceReviewRecord({
      leftId: diligence.left.id,
      rightId: diligence.right.id,
      leftName: diligence.left.name,
      rightName: diligence.right.name,
      score: diligence.score,
      reasons: diligence.reasons,
      status: recommendation,
      note,
      reviewer: String(payload.reviewer || "operator").trim(),
      source: "operator-contributed-overlap",
      operatorContext,
      generatedInsight: diligence.insight,
      assimilationRecommendation: diligence.recommendation
    }, existing, inventory);
  }

  function buildConvergenceCandidatesMarkdown(payload) {
    const summary = payload.summary || {};
    const lines = [
      "# Convergence Review Candidates",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      "Secret policy: Non-secret overlap metadata only. Human review decisions correct generated similarity signals.",
      "",
      "## Summary",
      `- Total candidates: ${summary.total || 0}`,
      `- Reviewed: ${summary.reviewed || 0}`,
      `- Unreviewed: ${summary.unreviewed || 0}`,
      `- Confirmed overlap: ${summary.confirmedOverlap || 0}`,
      `- Not related: ${summary.notRelated || 0}`,
      `- Merge candidates: ${summary.mergeCandidate || 0}`,
      "",
      "## Candidates"
    ];

    if (!payload.candidates.length) {
      lines.push("- No convergence candidates matched the current filters.");
      return lines.join("\n");
    }

    for (const candidate of payload.candidates.slice(0, 50)) {
      lines.push(`- ${candidate.leftName} - ${candidate.rightName}: ${candidate.score}% (${candidate.reviewStatus})`);
      lines.push(`  Pair: ${candidate.pairId}`);
      lines.push(`  Reasons: ${candidate.reasons.length ? candidate.reasons.join(", ") : "none recorded"}`);
      if (candidate.operatorProposed) {
        lines.push(`  Source: operator-contributed overlap`);
        lines.push(`  AI recommendation: ${String(candidate.assimilationRecommendation || candidate.reviewStatus).replaceAll("-", " ")}`);
      }
      if (candidate.generatedInsight) {
        lines.push(`  AI insight: ${candidate.generatedInsight}`);
      }
      if (candidate.reviewNote) {
        lines.push(`  Review note: ${candidate.reviewNote}`);
      }
    }

    return lines.join("\n");
  }

  function createConvergenceCandidatesPayload(inventory, persisted, options = {}) {
    const projectId = String(options.projectId || "").trim();
    const statusFilter = String(options.status || "").trim().toLowerCase();
    const includeNotRelated = statusFilter === "not-related" || statusFilter === "all" || String(options.includeNotRelated || "").trim().toLowerCase() === "true";
    const reviewMap = getConvergencePairReviewMap(persisted.convergenceReviews);
    let candidates = getGeneratedConvergenceCandidates(inventory).map((candidate) => {
      const pairId = createConvergencePairId(candidate.leftId, candidate.rightId);
      const review = reviewMap.get(pairId);
      return {
        pairId,
        leftId: String(candidate.leftId || ""),
        rightId: String(candidate.rightId || ""),
        leftName: String(candidate.leftName || candidate.leftId || ""),
        rightName: String(candidate.rightName || candidate.rightId || ""),
        score: toNumber(candidate.score),
        reasons: Array.isArray(candidate.reasons) ? candidate.reasons.map((reason) => String(reason || "").trim()).filter(Boolean) : [],
        reviewStatus: review?.status || "unreviewed",
        reviewId: review?.id || "",
        reviewNote: review?.note || "",
        reviewedAt: review?.updatedAt || "",
        reviewer: review?.reviewer || "",
        reviewSource: review?.source || "",
        operatorProposed: review?.source === "operator-contributed-overlap",
        generatedInsight: review?.generatedInsight || "",
        assimilationRecommendation: review?.assimilationRecommendation || "",
        secretPolicy: "Non-secret convergence review metadata only."
      };
    });
    const candidateMap = new Map(candidates.map((candidate) => [candidate.pairId, candidate]));
    for (const review of normalizeConvergenceReviews(persisted.convergenceReviews)) {
      if (candidateMap.has(review.pairId)) continue;
      const reviewOnlyCandidate = {
        pairId: review.pairId,
        leftId: review.leftId,
        rightId: review.rightId,
        leftName: review.leftName,
        rightName: review.rightName,
        score: review.score,
        reasons: review.reasons.length ? review.reasons : ["Operator supplied overlap proposal."],
        reviewStatus: review.status,
        reviewId: review.id,
        reviewNote: review.note,
        reviewedAt: review.updatedAt,
        reviewer: review.reviewer,
        reviewSource: review.source,
        operatorProposed: review.source === "operator-contributed-overlap",
        generatedInsight: review.generatedInsight || "",
        assimilationRecommendation: review.assimilationRecommendation || "",
        secretPolicy: "Non-secret convergence review metadata only."
      };
      candidateMap.set(review.pairId, reviewOnlyCandidate);
      candidates.push(reviewOnlyCandidate);
    }

    if (projectId) {
      candidates = candidates.filter((candidate) => candidate.leftId === projectId || candidate.rightId === projectId);
    }
    if (statusFilter && statusFilter !== "all") {
      candidates = candidates.filter((candidate) => candidate.reviewStatus === statusFilter);
    } else if (!includeNotRelated) {
      candidates = candidates.filter((candidate) => candidate.reviewStatus !== "not-related");
    }

    const summary = {
      total: candidates.length,
      reviewed: candidates.filter((candidate) => candidate.reviewStatus !== "unreviewed").length,
      unreviewed: candidates.filter((candidate) => candidate.reviewStatus === "unreviewed").length,
      confirmedOverlap: candidates.filter((candidate) => candidate.reviewStatus === "confirmed-overlap").length,
      notRelated: candidates.filter((candidate) => candidate.reviewStatus === "not-related").length,
      needsReview: candidates.filter((candidate) => candidate.reviewStatus === "needs-review").length,
      mergeCandidate: candidates.filter((candidate) => candidate.reviewStatus === "merge-candidate").length
    };

    const payload = {
      generatedAt: new Date().toISOString(),
      summary,
      candidates,
      reviews: normalizeConvergenceReviews(persisted.convergenceReviews),
      secretPolicy: "Non-secret convergence review metadata only."
    };

    return {
      ...payload,
      markdown: buildConvergenceCandidatesMarkdown(payload)
    };
  }

  function getConvergenceDueDiligenceRecommendation(candidate, relatedTasks) {
    const reviewStatus = toText(candidate.reviewStatus);
    const score = toNumber(candidate.score);
    const hasBlockedTask = relatedTasks.some((task) => toText(task.status) === "blocked");
    if (reviewStatus === "not-related") {
      return "Keep this candidate suppressed unless the operator reopens it with stronger overlap evidence.";
    }
    if (hasBlockedTask) {
      return "Resolve blocked Convergence Review tasks before merge, assimilation, or CLI-runner handoff.";
    }
    if (reviewStatus === "merge-candidate" || score >= 85) {
      return "Prepare a merge strategy blueprint with reusable modules, scripts, risks, and validation targets.";
    }
    if (reviewStatus === "confirmed-overlap") {
      return "Create or update convergence tasks, then plan controlled assimilation of the strongest shared parts.";
    }
    if (reviewStatus === "needs-review") {
      return "Run operator review with this evidence pack before tasking a merge or suppression decision.";
    }
    return "Review AI similarity evidence and ask the operator to confirm overlap, mark Not Related, or escalate.";
  }

  function buildConvergenceDueDiligencePackMarkdown(payload) {
    const candidate = toControlPlaneRecord(payload.candidate);
    const relatedTasks = Array.isArray(payload.relatedTasks) ? payload.relatedTasks : [];
    const relatedDriftCheckpoints = Array.isArray(payload.relatedDriftCheckpoints) ? payload.relatedDriftCheckpoints : [];
    const leftProject = toControlPlaneRecord(payload.leftProject);
    const rightProject = toControlPlaneRecord(payload.rightProject);
    const reasons = Array.isArray(candidate.reasons) ? candidate.reasons : [];
    const lines = [
      "# Convergence Candidate Due Diligence Pack",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Pair: ${toText(candidate.pairId) || "not recorded"}`,
      `Secret policy: ${toText(payload.secretPolicy) || "Non-secret convergence due diligence metadata only."}`,
      "",
      "## Candidate",
      `- Left app: ${toText(candidate.leftName) || toText(candidate.leftId) || "left project"} (${toText(candidate.leftId) || "no id"})`,
      `- Right app: ${toText(candidate.rightName) || toText(candidate.rightId) || "right project"} (${toText(candidate.rightId) || "no id"})`,
      `- Similarity score: ${toNumber(candidate.score)}%`,
      `- Review status: ${toText(candidate.reviewStatus) || "unreviewed"}`,
      `- Recommendation: ${toText(candidate.assimilationRecommendation) || toText(candidate.reviewStatus) || "needs-review"}`,
      `- Source: ${toText(candidate.operatorProposed) === "true" || candidate.operatorProposed ? "operator-contributed overlap" : "auto-detected overlap"}`,
      "",
      "## Evidence",
    ];

    if (reasons.length) {
      for (const reason of reasons.slice(0, 12)) {
        lines.push(`- ${toText(reason)}`);
      }
    } else {
      lines.push("- No generated reasons recorded.");
    }
    if (toText(candidate.generatedInsight)) {
      lines.push(`- AI insight: ${toText(candidate.generatedInsight)}`);
    }
    if (toText(candidate.reviewNote)) {
      lines.push(`- Operator note: ${toText(candidate.reviewNote)}`);
    }
    if (toText(candidate.reviewer) || toText(candidate.reviewedAt)) {
      lines.push(`- Reviewed by: ${toText(candidate.reviewer) || "not recorded"} at ${toText(candidate.reviewedAt) || "not recorded"}`);
    }

    lines.push("", "## Project Snapshot");
    lines.push(`- Left zone: ${toText(leftProject.zone) || "unknown"} | framework: ${Array.isArray(leftProject.frameworks) && leftProject.frameworks.length ? leftProject.frameworks.join(", ") : "not detected"} | scripts: ${Array.isArray(leftProject.scripts) ? leftProject.scripts.length : 0}`);
    lines.push(`- Right zone: ${toText(rightProject.zone) || "unknown"} | framework: ${Array.isArray(rightProject.frameworks) && rightProject.frameworks.length ? rightProject.frameworks.join(", ") : "not detected"} | scripts: ${Array.isArray(rightProject.scripts) ? rightProject.scripts.length : 0}`);

    lines.push("", "## Related Tasks");
    if (relatedTasks.length) {
      for (const task of relatedTasks.slice(0, 12)) {
        const record = toControlPlaneRecord(task);
        lines.push(`- ${toText(record.priority) || "normal"} ${toText(record.status) || "open"}: ${toText(record.title) || toText(record.id) || "Convergence task"}`);
        lines.push(`  Checkpoint: ${toText(record.convergenceTaskCheckpointStatus) || "not recorded"} | Updated: ${toText(record.updatedAt) || toText(record.createdAt) || "not recorded"}`);
      }
    } else {
      lines.push("- No related Convergence Review tasks are recorded yet.");
    }

    lines.push("", "## Related Drift Checkpoints");
    if (relatedDriftCheckpoints.length) {
      for (const checkpoint of relatedDriftCheckpoints.slice(0, 12)) {
        const record = toControlPlaneRecord(checkpoint);
        lines.push(`- ${toText(record.convergenceTaskLedgerDriftCheckpointStatus) || toText(record.convergenceTaskLedgerDriftDecision) || "tracked"}: ${toText(record.convergenceTaskLedgerDriftLabel) || toText(record.convergenceTaskLedgerDriftField) || "drift field"}`);
        lines.push(`  Snapshot: ${toText(record.convergenceTaskLedgerDriftSnapshotTitle) || toText(record.convergenceTaskLedgerDriftSnapshotId) || "not recorded"} | Status: ${toText(record.status) || "open"} | Priority: ${toText(record.priority) || "normal"}`);
      }
    } else {
      lines.push("- No related Convergence Review task-ledger drift checkpoints are recorded yet.");
    }

    lines.push("", "## Recommended Next Action", `- ${toText(payload.recommendedAction)}`);
    lines.push("", "## No-Secrets Boundary", "- Store only overlap rationale, review status, task status, and checkpoint metadata. Do not store credentials, passwords, provider tokens, repository tokens, certificates, private keys, cookies, browser sessions, or command output.");

    return lines.join("\n");
  }

  function createConvergenceDueDiligencePackPayload(inventory, persisted, pairId) {
    const candidatePayload = createConvergenceCandidatesPayload(inventory, persisted, {
      status: "all",
      includeNotRelated: "true"
    });
    const candidate = candidatePayload.candidates.find((item) => toText(item.pairId) === toText(pairId));
    if (!candidate) return null;

    const relatedTasks = (Array.isArray(persisted.tasks) ? persisted.tasks : [])
      .filter((task) => toText(task.convergencePairId) === toText(candidate.pairId));
    const relatedTaskIds = new Set(relatedTasks.map((task) => toText(task.id)).filter(Boolean));
    const relatedDriftCheckpoints = (Array.isArray(persisted.tasks) ? persisted.tasks : [])
      .filter((task) => {
        const field = toText(task.convergenceTaskLedgerDriftField);
        if (!field) return false;
        if (field.includes(toText(candidate.pairId))) return true;
        return [...relatedTaskIds].some((taskId) => field.includes(taskId));
      });
    const leftProject = (inventory.projects || []).find((project) => toText(project.id) === toText(candidate.leftId)) || {};
    const rightProject = (inventory.projects || []).find((project) => toText(project.id) === toText(candidate.rightId)) || {};
    const recommendedAction = getConvergenceDueDiligenceRecommendation(candidate, relatedTasks);
    const payload = {
      generatedAt: new Date().toISOString(),
      pairId: toText(candidate.pairId),
      candidate,
      leftProject,
      rightProject,
      relatedTasks,
      relatedDriftCheckpoints,
      recommendedAction,
      secretPolicy: "Non-secret convergence due diligence metadata only. Resolve repository credentials, tokens, passwords, private keys, certificates, cookies, and browser sessions outside this app.",
      summary: {
        relatedTaskCount: relatedTasks.length,
        openTaskCount: relatedTasks.filter((task) => !isGovernanceClosedStatus(task.status)).length,
        blockedTaskCount: relatedTasks.filter((task) => toText(task.status) === "blocked").length,
        relatedDriftCheckpointCount: relatedDriftCheckpoints.length,
        score: toNumber(candidate.score),
        reviewStatus: toText(candidate.reviewStatus) || "unreviewed"
      }
    };

    return {
      ...payload,
      markdown: buildConvergenceDueDiligencePackMarkdown(payload)
    };
  }

  function getProjectScriptNames(project) {
    const scripts = Array.isArray(project?.scripts) ? project.scripts : [];
    return scripts
      .map((script) => typeof script === "string" ? script : toText(script?.name) || toText(script?.script))
      .map((script) => script.trim())
      .filter(Boolean);
  }

  function buildConvergenceAssimilationBlueprintMarkdown(payload) {
    const candidate = toControlPlaneRecord(payload.candidate);
    const leftProject = toControlPlaneRecord(payload.leftProject);
    const rightProject = toControlPlaneRecord(payload.rightProject);
    const phases = Array.isArray(payload.phases) ? payload.phases : [];
    const validationTargets = Array.isArray(payload.validationTargets) ? payload.validationTargets : [];
    const risks = Array.isArray(payload.risks) ? payload.risks : [];
    const lines = [
      "# Convergence Assimilation Blueprint",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Pair: ${toText(payload.pairId) || toText(candidate.pairId) || "not recorded"}`,
      `Secret policy: ${toText(payload.secretPolicy) || "Non-secret convergence assimilation planning metadata only."}`,
      "",
      "## Target Pair",
      `- Left app: ${toText(candidate.leftName) || toText(leftProject.name) || toText(candidate.leftId)}`,
      `- Right app: ${toText(candidate.rightName) || toText(rightProject.name) || toText(candidate.rightId)}`,
      `- Review status: ${toText(candidate.reviewStatus) || "unreviewed"}`,
      `- Similarity score: ${toNumber(candidate.score)}%`,
      `- Recommended path: ${toText(payload.recommendedPath) || "Review before assimilation."}`,
      "",
      "## Reuse Signals"
    ];

    const sharedFrameworks = Array.isArray(payload.sharedFrameworks) ? payload.sharedFrameworks : [];
    const sharedLanguages = Array.isArray(payload.sharedLanguages) ? payload.sharedLanguages : [];
    const candidateReasons = Array.isArray(candidate.reasons) ? candidate.reasons : [];
    lines.push(`- Shared frameworks: ${sharedFrameworks.length ? sharedFrameworks.join(", ") : "none detected"}`);
    lines.push(`- Shared languages: ${sharedLanguages.length ? sharedLanguages.join(", ") : "none detected"}`);
    lines.push(`- Candidate reasons: ${candidateReasons.length ? candidateReasons.slice(0, 8).join("; ") : "none recorded"}`);
    if (toText(candidate.generatedInsight)) {
      lines.push(`- AI insight: ${toText(candidate.generatedInsight)}`);
    }
    if (toText(candidate.reviewNote)) {
      lines.push(`- Operator note: ${toText(candidate.reviewNote)}`);
    }

    lines.push("", "## Build Phases");
    for (const phase of phases) {
      const record = toControlPlaneRecord(phase);
      lines.push(`- ${toText(record.title) || "Assimilation phase"}: ${toText(record.detail) || "No detail recorded."}`);
    }

    lines.push("", "## Validation Targets");
    if (validationTargets.length) {
      for (const target of validationTargets) {
        lines.push(`- ${toText(target)}`);
      }
    } else {
      lines.push("- No scripts were detected; define manual smoke checks before implementation.");
    }

    lines.push("", "## Risks");
    for (const risk of risks) {
      lines.push(`- ${toText(risk)}`);
    }
    lines.push("", "## No-Secrets Boundary", "- This blueprint stores only planning metadata. Do not paste passwords, tokens, repository credentials, certificates, private keys, cookies, browser sessions, or raw command output.");

    return lines.join("\n");
  }

  function createConvergenceAssimilationBlueprintPayload(inventory, persisted, pairId) {
    const candidatePayload = createConvergenceCandidatesPayload(inventory, persisted, {
      status: "all",
      includeNotRelated: "true"
    });
    const candidate = candidatePayload.candidates.find((item) => toText(item.pairId) === toText(pairId));
    if (!candidate) return null;

    const leftProject = (inventory.projects || []).find((project) => toText(project.id) === toText(candidate.leftId)) || {};
    const rightProject = (inventory.projects || []).find((project) => toText(project.id) === toText(candidate.rightId)) || {};
    const relatedTasks = (Array.isArray(persisted.tasks) ? persisted.tasks : [])
      .filter((task) => toText(task.convergencePairId) === toText(candidate.pairId));
    const sharedFrameworks = getSharedValues(leftProject.frameworks, rightProject.frameworks);
    const sharedLanguages = getSharedValues(leftProject.languages, rightProject.languages);
    const leftScripts = getProjectScriptNames(leftProject);
    const rightScripts = getProjectScriptNames(rightProject);
    const sharedScripts = getSharedValues(leftScripts, rightScripts);
    const validationTargets = [
      ...sharedScripts.map((script) => `Run shared script on both apps: ${script}`),
      ...leftScripts.filter((script) => ["test", "lint", "build"].includes(script)).map((script) => `Validate left app script: ${script}`),
      ...rightScripts.filter((script) => ["test", "lint", "build"].includes(script)).map((script) => `Validate right app script: ${script}`)
    ];
    const reviewStatus = toText(candidate.reviewStatus) || "unreviewed";
    const recommendedPath = reviewStatus === "not-related"
      ? "Do not assimilate; keep this pair suppressed unless reopened by the operator."
      : reviewStatus === "merge-candidate" || toNumber(candidate.score) >= 85
        ? "Prepare a supervised merge or module extraction work order."
        : reviewStatus === "confirmed-overlap"
          ? "Extract reusable patterns only after task-level acceptance criteria are recorded."
          : "Hold implementation until operator review confirms overlap.";
    const phases = [
      {
        title: "1. Freeze current behavior",
        detail: "Capture current branch, validation commands, local smoke URL, and known failures before moving code."
      },
      {
        title: "2. Compare reusable surfaces",
        detail: "Review shared frameworks, languages, scripts, routes, components, services, schemas, and CLI utilities before choosing a source of truth."
      },
      {
        title: "3. Select assimilation target",
        detail: "Decide whether to merge one app into the other, extract shared modules, or preserve both with documented boundaries."
      },
      {
        title: "4. Implement in small slices",
        detail: "Move one module or script family at a time, keep rollback points, and avoid changing unrelated behavior."
      },
      {
        title: "5. Validate and relaunch",
        detail: "Run syntax, tests, builds, local smoke checks, and record the result before any follow-on Codex or Claude CLI handoff."
      }
    ];
    const risks = [
      reviewStatus === "not-related" ? "Operator marked this pair Not Related; assimilation should be blocked by default." : "",
      relatedTasks.some((task) => toText(task.status) === "blocked") ? "A related convergence task is blocked; resolve it before implementation." : "",
      !sharedFrameworks.length ? "No shared framework signal detected; confirm overlap manually before reuse." : "",
      !validationTargets.length ? "No automated validation scripts detected; create manual smoke criteria before code movement." : "",
      "Do not copy credentials, tokens, certificates, cookies, browser sessions, or environment secrets between apps."
    ].filter(Boolean);
    const payload = {
      generatedAt: new Date().toISOString(),
      pairId: toText(candidate.pairId),
      candidate,
      leftProject,
      rightProject,
      relatedTasks,
      sharedFrameworks,
      sharedLanguages,
      sharedScripts,
      validationTargets: [...new Set(validationTargets)].slice(0, 12),
      phases,
      risks,
      recommendedPath,
      secretPolicy: "Non-secret convergence assimilation planning metadata only. Resolve credentials, tokens, passwords, certificates, private keys, cookies, and browser sessions outside this app.",
      summary: {
        score: toNumber(candidate.score),
        reviewStatus,
        relatedTaskCount: relatedTasks.length,
        sharedFrameworkCount: sharedFrameworks.length,
        sharedLanguageCount: sharedLanguages.length,
        sharedScriptCount: sharedScripts.length,
        validationTargetCount: [...new Set(validationTargets)].length,
        riskCount: risks.length
      }
    };

    return {
      ...payload,
      markdown: buildConvergenceAssimilationBlueprintMarkdown(payload)
    };
  }

  function getConvergenceAssimilationDraftDecision(blueprint) {
    const reviewStatus = toText(blueprint?.summary?.reviewStatus);
    const blockedTasks = (Array.isArray(blueprint?.relatedTasks) ? blueprint.relatedTasks : [])
      .filter((task) => toText(task.status) === "blocked");
    if (reviewStatus === "not-related") {
      return {
        draftDecision: "hold",
        reason: {
          severity: "hold",
          code: "convergence-pair-not-related",
          message: "This pair is marked Not Related; do not create an implementation work order unless the operator reopens it."
        }
      };
    }
    if (blockedTasks.length) {
      return {
        draftDecision: "hold",
        reason: {
          severity: "hold",
          code: "convergence-task-blocked",
          message: "A related convergence task is blocked; resolve the blocker before runner handoff."
        }
      };
    }
    if (reviewStatus === "confirmed-overlap" || reviewStatus === "merge-candidate") {
      return {
        draftDecision: "ready",
        reason: {
          severity: "ready",
          code: "convergence-pair-actionable",
          message: "The pair is operator-confirmed or merge-ready and can seed a supervised work-order draft."
        }
      };
    }
    return {
      draftDecision: "review",
      reason: {
        severity: "review",
        code: "convergence-pair-review-required",
        message: "Operator review is still required before implementation."
      }
    };
  }

  function buildConvergenceAssimilationWorkOrderDraftMarkdown(payload) {
    const draft = toControlPlaneRecord(payload.draft);
    const blueprint = toControlPlaneRecord(payload.blueprint);
    const reasons = Array.isArray(payload.reasons) ? payload.reasons : [];
    const acceptanceCriteria = toTextList(draft.acceptanceCriteria);
    const validationCommands = toTextList(draft.validationCommands);
    const lines = [
      "# Convergence Assimilation Work-Order Draft",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Runner: ${toText(payload.runner) || "codex"}`,
      `Draft decision: ${toText(payload.draftDecision) || "review"}`,
      `Execution mode: ${toText(payload.executionMode) || "non-executing"}`,
      `Pair: ${toText(payload.pairId) || "not selected"}`,
      `Secret policy: ${toText(payload.secretPolicy) || "No secrets."}`,
      "",
      "## Objective",
      `- ${toText(draft.objective) || "Prepare a bounded convergence assimilation implementation plan."}`,
      "",
      "## Blueprint",
      `- Recommended path: ${toText(blueprint.recommendedPath) || "Review before implementation."}`,
      `- Review status: ${toText(toControlPlaneRecord(blueprint.summary).reviewStatus) || "unreviewed"}`,
      `- Shared frameworks: ${Array.isArray(blueprint.sharedFrameworks) && blueprint.sharedFrameworks.length ? blueprint.sharedFrameworks.join(", ") : "none detected"}`,
      `- Shared languages: ${Array.isArray(blueprint.sharedLanguages) && blueprint.sharedLanguages.length ? blueprint.sharedLanguages.join(", ") : "none detected"}`,
      "",
      "## Acceptance Criteria"
    ];

    if (acceptanceCriteria.length) {
      for (const item of acceptanceCriteria) lines.push(`- ${item}`);
    } else {
      lines.push("- Keep the work bounded to the selected convergence pair.");
      lines.push("- Return a non-secret result summary to Workspace Audit Pro.");
    }

    lines.push("", "## Validation Commands");
    if (validationCommands.length) {
      for (const command of validationCommands) lines.push(`- ${command}`);
    } else {
      lines.push("- Define and run manual smoke checks before implementation is considered complete.");
    }

    lines.push("", "## Readiness Reasons");
    for (const reason of reasons) {
      const record = toControlPlaneRecord(reason);
      lines.push(`- ${toText(record.severity) || "review"}: ${toText(record.message) || toText(record.code) || "Review required."}`);
    }

    lines.push("", "## Prompt", "", toText(draft.prompt) || "No prompt generated.");

    return lines.join("\n");
  }

  function createConvergenceAssimilationWorkOrderDraftPayload(inventory, persisted, pairId, options = {}) {
    const blueprint = createConvergenceAssimilationBlueprintPayload(inventory, persisted, pairId);
    if (!blueprint) return null;

    const runner = normalizeCliBridgeRunner(options.runner) === "claude" ? "claude" : "codex";
    const runnerLabel = runner === "claude" ? "Claude CLI" : "Codex CLI";
    const decision = getConvergenceAssimilationDraftDecision(blueprint);
    const reasons = [decision.reason];
    const validationCommands = Array.isArray(blueprint.validationTargets) && blueprint.validationTargets.length
      ? blueprint.validationTargets
      : ["Run project-specific validation from the workbench Launchpad", "Relaunch the local app and smoke-check the monitored URL"];
    const candidate = toControlPlaneRecord(blueprint.candidate);
    const projectName = `${toText(candidate.leftName) || toText(candidate.leftId)} + ${toText(candidate.rightName) || toText(candidate.rightId)}`;
    const acceptanceCriteria = [
      "Use Workspace Audit Pro as the source of truth for this convergence pair.",
      "Do not merge automatically; implement only the smallest reviewed module or script slice.",
      "Preserve current app behavior unless the blueprint explicitly calls for a change.",
      "Run validation commands, relaunch the local app, and smoke-check before reporting completion.",
      "Return changed files, validation results, blockers, and next action as non-secret structured output."
    ];
    const objective = `Prepare and execute a supervised convergence assimilation slice for ${projectName}.`;
    const phaseLines = (Array.isArray(blueprint.phases) ? blueprint.phases : [])
      .map((phase) => {
        const record = toControlPlaneRecord(phase);
        return `${toText(record.title)}: ${toText(record.detail)}`.trim();
      })
      .filter(Boolean);
    const riskLines = Array.isArray(blueprint.risks) ? blueprint.risks.map(toText).filter(Boolean) : [];
    const promptLines = [
      `You are ${runnerLabel} working under Workspace Audit Pro supervision.`,
      "This is a non-secret convergence assimilation work-order draft. Do not request or expose credentials, passwords, provider tokens, repository tokens, certificates, private keys, cookies, browser sessions, or raw command output containing secrets.",
      `Pair ID: ${toText(blueprint.pairId)}`,
      `Left app: ${toText(candidate.leftName) || toText(candidate.leftId)} (${toText(candidate.leftId)})`,
      `Right app: ${toText(candidate.rightName) || toText(candidate.rightId)} (${toText(candidate.rightId)})`,
      `Review status: ${toText(blueprint.summary.reviewStatus) || "unreviewed"}`,
      `Similarity score: ${toNumber(blueprint.summary.score)}%`,
      `Recommended path: ${toText(blueprint.recommendedPath)}`,
      `Shared frameworks: ${blueprint.sharedFrameworks.length ? blueprint.sharedFrameworks.join(", ") : "none detected"}`,
      `Shared languages: ${blueprint.sharedLanguages.length ? blueprint.sharedLanguages.join(", ") : "none detected"}`,
      `Validation targets: ${validationCommands.join(" | ")}`,
      `Build phases: ${phaseLines.length ? phaseLines.join(" | ") : "Follow the blueprint phases in Workspace Audit Pro."}`,
      `Risks: ${riskLines.length ? riskLines.join(" | ") : "No extra risks recorded."}`,
      "",
      "Implement only one bounded assimilation slice. If implementation is not safe, return status=blocked with a non-secret blocker summary.",
      "Return JSON-compatible output with status, summary, changedFiles, validationResults, blockers, nextAction, and handoffRecommendation."
    ];
    const draft = {
      sourceType: "convergence-assimilation-blueprint",
      sourcePairId: toText(blueprint.pairId),
      runner,
      projectId: toText(candidate.leftId),
      projectName,
      relPath: toText(toControlPlaneRecord(blueprint.leftProject).relPath),
      title: `Convergence Assimilation: ${projectName}`,
      objective,
      recommendedPath: toText(blueprint.recommendedPath),
      validationCommands,
      acceptanceCriteria,
      risks: riskLines,
      prompt: promptLines.join("\n")
    };
    const payload = {
      generatedAt: new Date().toISOString(),
      protocolVersion: "convergence-assimilation-work-order-draft.v1",
      bridgeMode: "workspace-audit-convergence-broker",
      executionMode: "non-executing",
      runner,
      pairId: toText(blueprint.pairId),
      draftDecision: decision.draftDecision,
      recommendedAction: decision.draftDecision === "ready"
        ? `Copy this convergence work-order draft into ${runnerLabel} or a future supervised adapter after confirming scope.`
        : decision.reason.message,
      secretPolicy: "Non-secret convergence assimilation work-order draft only. Do not store passwords, tokens, certificates, private keys, cookies, browser sessions, or raw command output containing secrets.",
      reasons,
      blueprint,
      draft
    };

    return {
      ...payload,
      markdown: buildConvergenceAssimilationWorkOrderDraftMarkdown(payload)
    };
  }

  function createAgentWorkOrderRunFromConvergenceAssimilationDraft(draftPayload, payload = {}) {
    const draft = toControlPlaneRecord(draftPayload.draft);
    const blueprint = toControlPlaneRecord(draftPayload.blueprint);
    const now = new Date().toISOString();
    const runner = toText(draftPayload.runner) || "codex";
    const status = toText(payload.status) || "queued";
    const notes = toText(payload.notes) || `Queued from convergence assimilation draft ${toText(draftPayload.pairId) || "unknown"} for ${runner}.`;
    const validationCommands = toTextList(draft.validationCommands);
    const blockers = Array.isArray(draftPayload.reasons)
      ? draftPayload.reasons.map((reason) => {
          const record = toControlPlaneRecord(reason);
          return toText(record.code) || toText(record.message);
        }).filter(Boolean)
      : [];
    return {
      id: createId("agent-work-order-run"),
      projectId: toText(draft.projectId),
      projectName: toText(draft.projectName),
      relPath: toText(draft.relPath),
      snapshotId: "",
      title: toText(payload.title) || toText(draft.title) || `Convergence assimilation for ${toText(draft.projectName) || "project pair"}`,
      objective: toText(draft.objective),
      status,
      readinessScore: toNumber(blueprint?.summary?.score),
      readinessStatus: `convergence-${toText(draftPayload.draftDecision) || "review"}`,
      blockers,
      agentPolicyId: "",
      agentPolicyCheckpointId: "",
      agentPolicyCheckpointStatus: "needs-review",
      agentRole: toText(payload.agentRole) || (runner === "claude" ? "convergence-review-agent" : "convergence-implementation-agent"),
      runtime: toText(payload.runtime) || `${runner}-cli-convergence-assimilation`,
      isolationMode: toText(payload.isolationMode) || "supervised-non-secret-convergence-work-order",
      skillBundle: ["project-governance", "convergence-assimilation", "validation-runner", "handoff-pack"],
      hookPolicy: ["policy-checkpoint-required", "preflight-status-review", "post-run-validation-log", "local-relaunch-required"],
      agentPolicySecretPolicy: toText(draftPayload.secretPolicy) || "Non-secret convergence assimilation work-order metadata only.",
      validationCommands: validationCommands.length ? validationCommands : ["Run project-specific validation from the workbench Launchpad"],
      notes,
      convergencePairId: toText(draftPayload.pairId),
      convergenceAssimilationDraftDecision: toText(draftPayload.draftDecision),
      convergenceAssimilationRunner: runner,
      convergenceAssimilationRecommendedPath: toText(draft.recommendedPath),
      history: [createAgentWorkOrderRunEvent(status, notes)],
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
    };
  }

  function buildConvergenceAssimilationRunLedgerMarkdown(payload) {
    const summary = toControlPlaneRecord(payload.summary);
    const runs = Array.isArray(payload.runs) ? payload.runs : [];
    const lines = [
      "# Convergence Assimilation Run Ledger",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Status filter: ${toText(payload.status) || "all"}`,
      `Secret policy: ${toText(payload.secretPolicy) || "Non-secret convergence assimilation run metadata only."}`,
      "",
      "## Summary",
      `- Total runs: ${toNumber(summary.total)}`,
      `- Visible runs: ${toNumber(summary.visible)}`,
      `- Open runs: ${toNumber(summary.open)}`,
      `- Closed runs: ${toNumber(summary.closed)}`,
      `- Codex runs: ${toNumber(summary.codex)}`,
      `- Claude runs: ${toNumber(summary.claude)}`,
      `- Pair count: ${toNumber(summary.pairCount)}`,
      "",
      "## Runs"
    ];

    if (!runs.length) {
      lines.push("- No convergence assimilation runs matched this filter.");
      return lines.join("\n");
    }

    for (const run of runs.slice(0, 80)) {
      const record = toControlPlaneRecord(run);
      lines.push(`- ${toText(record.projectName) || "Convergence pair"}: ${toText(record.title) || toText(record.id)} (${toText(record.status) || "queued"})`);
      lines.push(`  Pair: ${toText(record.convergencePairId) || "not recorded"} | Runner: ${toText(record.convergenceAssimilationRunner) || toText(record.runtime) || "not recorded"} | Draft: ${toText(record.convergenceAssimilationDraftDecision) || "review"}`);
      lines.push(`  Validation: ${toTextList(record.validationCommands).length ? toTextList(record.validationCommands).join("; ") : "not recorded"}`);
    }

    return lines.join("\n");
  }

  function createConvergenceAssimilationRunLedgerPayload(persisted, options = {}) {
    const status = toText(options.status) || "all";
    const allRuns = (Array.isArray(persisted.agentWorkOrderRuns) ? persisted.agentWorkOrderRuns : [])
      .map(toControlPlaneRecord)
      .filter((run) => toText(run.convergencePairId) && toText(run.convergenceAssimilationRunner))
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime());
    const matchesStatus = (run) => {
      if (status === "open") return !isGovernanceClosedStatus(run.status);
      if (status === "closed") return isGovernanceClosedStatus(run.status);
      if (status === "archived") return Boolean(toText(run.archivedAt));
      if (status === "active") return !toText(run.archivedAt);
      return true;
    };
    const runs = allRuns.filter(matchesStatus);
    const pairIds = new Set(allRuns.map((run) => toText(run.convergencePairId)).filter(Boolean));
    const summary = {
      total: allRuns.length,
      visible: runs.length,
      open: allRuns.filter((run) => !isGovernanceClosedStatus(run.status)).length,
      closed: allRuns.filter((run) => isGovernanceClosedStatus(run.status)).length,
      active: allRuns.filter((run) => !toText(run.archivedAt)).length,
      archived: allRuns.filter((run) => toText(run.archivedAt)).length,
      codex: allRuns.filter((run) => toText(run.convergenceAssimilationRunner) === "codex").length,
      claude: allRuns.filter((run) => toText(run.convergenceAssimilationRunner) === "claude").length,
      pairCount: pairIds.size
    };
    const payload = {
      generatedAt: new Date().toISOString(),
      status,
      summary,
      runs,
      secretPolicy: "Non-secret convergence assimilation run metadata only. Do not store credentials, tokens, certificates, private keys, cookies, browser sessions, or raw command output containing secrets."
    };

    return {
      ...payload,
      markdown: buildConvergenceAssimilationRunLedgerMarkdown(payload)
    };
  }

  function buildConvergenceAssimilationRunTracePackMarkdown(payload) {
    const run = toControlPlaneRecord(payload.run);
    const candidate = toControlPlaneRecord(payload.candidate);
    const draft = toControlPlaneRecord(payload.draft);
    const tasks = Array.isArray(payload.relatedTasks) ? payload.relatedTasks.map(toControlPlaneRecord) : [];
    const validationCommands = toTextList(payload.validationCommands);
    const reasons = Array.isArray(payload.reasons) ? payload.reasons.map(toControlPlaneRecord) : [];
    const lines = [
      "# Convergence Assimilation Run Trace Pack",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Run ID: ${toText(payload.runId) || "not selected"}`,
      `Pair ID: ${toText(payload.pairId) || "not linked"}`,
      `Runner: ${toText(payload.runner) || "not recorded"}`,
      `Trace decision: ${toText(payload.traceDecision) || "review"}`,
      `Execution mode: ${toText(payload.executionMode) || "non-executing"}`,
      `Secret policy: ${toText(payload.secretPolicy) || "No secrets."}`,
      "",
      "## Run",
      `- Title: ${toText(run.title) || "not found"}`,
      `- Project: ${toText(run.projectName) || toText(run.projectId) || "not linked"}`,
      `- Status: ${toText(run.status) || "unknown"}`,
      `- Draft decision: ${toText(run.convergenceAssimilationDraftDecision) || "review"}`,
      `- Recommended path: ${toText(run.convergenceAssimilationRecommendedPath) || "not recorded"}`,
      `- Runtime: ${toText(run.runtime) || "not recorded"}`,
      "",
      "## Pair Context",
      `- Left app: ${toText(candidate.leftName) || toText(candidate.leftId) || "not recorded"}`,
      `- Right app: ${toText(candidate.rightName) || toText(candidate.rightId) || "not recorded"}`,
      `- Review status: ${toText(candidate.reviewStatus) || "unreviewed"}`,
      `- Recommendation: ${toText(candidate.recommendation) || "needs-review"}`,
      `- Score: ${toNumber(candidate.score)}%`,
      "",
      "## Draft Context",
      `- Objective: ${toText(draft.objective) || toText(run.objective) || "not recorded"}`,
      `- Draft runtime: ${toText(draft.runtime) || toText(run.runtime) || "not recorded"}`,
      `- Isolation: ${toText(draft.isolationMode) || toText(run.isolationMode) || "not recorded"}`,
      "",
      "## Validation Commands"
    ];

    if (validationCommands.length) {
      for (const command of validationCommands) {
        lines.push(`- ${command}`);
      }
    } else {
      lines.push("- No validation commands recorded.");
    }

    lines.push("", "## Related Convergence Tasks");
    if (tasks.length) {
      for (const task of tasks.slice(0, 20)) {
        lines.push(`- ${toText(task.title) || toText(task.id) || "Convergence task"}: ${toText(task.status) || "open"} / ${toText(task.priority) || "normal"}`);
      }
    } else {
      lines.push("- No related convergence tasks found for this pair.");
    }

    lines.push("", "## Trace Reasons");
    if (reasons.length) {
      for (const reason of reasons) {
        lines.push(`- ${toText(reason.severity) || "review"}: ${toText(reason.message) || toText(reason.code) || "Review required."}`);
      }
    } else {
      lines.push("- No trace blockers recorded.");
    }

    return lines.join("\n");
  }

  function createConvergenceAssimilationRunTracePackPayload(inventory, persisted, runId) {
    const runs = Array.isArray(persisted.agentWorkOrderRuns) ? persisted.agentWorkOrderRuns.map(toControlPlaneRecord) : [];
    const run = runs.find((item) => toText(item.id) === toText(runId)) || null;
    const pairId = toText(run?.convergencePairId);
    const runner = toText(run?.convergenceAssimilationRunner);
    const reasons = [];
    if (!toText(runId)) {
      reasons.push({
        severity: "hold",
        code: "convergence-assimilation-run-id-required",
        message: "A run id is required before preparing a convergence assimilation run trace pack."
      });
    }
    if (!run) {
      reasons.push({
        severity: "hold",
        code: "convergence-assimilation-run-not-found",
        message: "The selected convergence assimilation Agent Work Order Run was not found."
      });
    } else if (!pairId || !runner) {
      reasons.push({
        severity: "hold",
        code: "not-convergence-assimilation-run",
        message: "The selected Agent Work Order Run is not linked to a convergence assimilation pair and runner."
      });
    }

    const blueprint = pairId ? createConvergenceAssimilationBlueprintPayload(inventory, persisted, pairId) : null;
    const draftPayload = pairId ? createConvergenceAssimilationWorkOrderDraftPayload(inventory, persisted, pairId, { runner: runner || "codex" }) : null;
    if (pairId && !blueprint) {
      reasons.push({
        severity: "review",
        code: "convergence-assimilation-blueprint-missing",
        message: "No current convergence assimilation blueprint could be rebuilt for this pair."
      });
    }
    if (pairId && !draftPayload) {
      reasons.push({
        severity: "review",
        code: "convergence-assimilation-draft-missing",
        message: "No current convergence assimilation draft could be rebuilt for this run."
      });
    }

    const relatedTasks = (Array.isArray(persisted.tasks) ? persisted.tasks : [])
      .map(toControlPlaneRecord)
      .filter((task) => toText(task.convergencePairId) === pairId)
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime());
    const validationCommands = [
      ...toTextList(run?.validationCommands),
      ...toTextList(toControlPlaneRecord(draftPayload?.draft).validationCommands)
    ].filter((command, index, list) => command && list.indexOf(command) === index);
    if (run && !relatedTasks.length) {
      reasons.push({
        severity: "review",
        code: "convergence-assimilation-run-without-related-tasks",
        message: "The run exists but has no related convergence tasks for follow-up tracking."
      });
    }
    if (run && !validationCommands.length) {
      reasons.push({
        severity: "review",
        code: "convergence-assimilation-run-without-validation",
        message: "The run exists but has no validation commands recorded."
      });
    }

    const traceDecision = reasons.some((reason) => toText(toControlPlaneRecord(reason).severity) === "hold")
      ? "hold"
      : reasons.length
        ? "review"
        : "ready";
    const payload = {
      generatedAt: new Date().toISOString(),
      protocolVersion: "convergence-assimilation-run-trace-pack.v1",
      executionMode: "non-executing",
      runId: toText(runId),
      pairId,
      runner,
      traceDecision,
      recommendedAction: traceDecision === "ready"
        ? "Use this trace pack to review the convergence assimilation work-order lifecycle before execution, result intake, or follow-up task seeding."
        : reasons.find((reason) => toText(toControlPlaneRecord(reason).severity) === "hold")?.message || reasons[0]?.message || "Review this trace pack before continuing.",
      secretPolicy: "Non-secret convergence assimilation run trace metadata only. Do not store credentials, tokens, certificates, private keys, cookies, browser sessions, raw command output, or private repository access material.",
      reasons,
      run: run || {},
      blueprint: blueprint || {},
      draft: toControlPlaneRecord(draftPayload?.draft),
      candidate: toControlPlaneRecord(blueprint?.candidate),
      relatedTasks,
      relatedTaskCount: relatedTasks.length,
      validationCommands
    };

    return {
      ...payload,
      markdown: buildConvergenceAssimilationRunTracePackMarkdown(payload)
    };
  }

  /**
   * @param {unknown} value
   */
  function normalizeConvergenceAssimilationRunResultStatus(value) {
    const status = toText(value).toLowerCase();
    return ["passed", "failed", "blocked", "needs-review", "cancelled"].includes(status) ? status : "needs-review";
  }

  /**
   * @param {Record<string, unknown>} run
   * @param {Record<string, unknown>} payload
   */
  function createConvergenceAssimilationRunResultRecord(run, payload = {}) {
    const summary = toText(payload.summary);
    if (!summary) {
      throw new Error("summary is required");
    }
    const status = normalizeConvergenceAssimilationRunResultStatus(payload.status || payload.resultStatus);
    const blockers = toTextList(payload.blockers).slice(0, 30);
    const now = new Date().toISOString();
    return {
      id: createId("convergence-assimilation-run-result"),
      runId: toText(run.id),
      pairId: toText(run.convergencePairId),
      runner: toText(run.convergenceAssimilationRunner),
      projectId: toText(run.projectId),
      projectName: toText(run.projectName),
      status,
      summary,
      changedFiles: toTextList(payload.changedFiles).slice(0, 80),
      validationSummary: toText(payload.validationResults || payload.validationSummary) || (blockers.length ? `Blocked: ${blockers.join(", ")}` : "Validation not recorded."),
      blockers,
      nextAction: toText(payload.nextAction) || (status === "passed"
        ? "Review and close related convergence tasks or queue the next assimilation slice."
        : "Review this convergence assimilation result before approving follow-up implementation."),
      notes: toText(payload.notes),
      secretPolicy: "Non-secret convergence assimilation run result metadata only. Do not store credentials, tokens, certificates, private keys, cookies, browser sessions, raw command output, or private repository access material.",
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * @param {string} resultStatus
   * @param {string} currentStatus
   */
  function getConvergenceAssimilationRunStatusFromResult(resultStatus, currentStatus) {
    if (resultStatus === "passed") return "passed";
    if (resultStatus === "failed") return "failed";
    if (resultStatus === "blocked") return "blocked";
    if (resultStatus === "cancelled") return "cancelled";
    return toText(currentStatus) || "queued";
  }

  function normalizeConvergenceAssimilationResultLedgerStatus(value) {
    const status = toText(value).toLowerCase();
    return ["all", "passed", "failed", "blocked", "needs-review", "cancelled"].includes(status) ? status : "all";
  }

  function buildConvergenceAssimilationResultLedgerMarkdown(payload) {
    const summary = toControlPlaneRecord(payload.summary);
    const results = Array.isArray(payload.results) ? payload.results : [];
    const lines = [
      "# Convergence Assimilation Result Ledger",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Status filter: ${toText(payload.status) || "all"}`,
      `Secret policy: ${toText(payload.secretPolicy) || "Non-secret convergence assimilation result metadata only."}`,
      "",
      "## Summary",
      `- Total results: ${toNumber(summary.total)}`,
      `- Visible results: ${toNumber(summary.visible)}`,
      `- Passed: ${toNumber(summary.passed)}`,
      `- Failed: ${toNumber(summary.failed)}`,
      `- Blocked: ${toNumber(summary.blocked)}`,
      `- Needs review: ${toNumber(summary.needsReview)}`,
      `- Cancelled: ${toNumber(summary.cancelled)}`,
      `- Pair count: ${toNumber(summary.pairCount)}`,
      "",
      "## Results"
    ];

    if (!results.length) {
      lines.push("- No convergence assimilation results matched this filter.");
      return lines.join("\n");
    }

    for (const result of results.slice(0, 100)) {
      const record = toControlPlaneRecord(result);
      lines.push(`- ${toText(record.projectName) || toText(record.projectId) || "Convergence run"}: ${toText(record.status) || "needs-review"}`);
      lines.push(`  Run: ${toText(record.runId) || "not recorded"} | Pair: ${toText(record.pairId) || "not recorded"} | Runner: ${toText(record.runner) || "not recorded"}`);
      lines.push(`  Summary: ${toText(record.summary) || "No summary recorded."}`);
      lines.push(`  Validation: ${toText(record.validationSummary) || "Validation not recorded."}`);
      if (toTextList(record.changedFiles).length) {
        lines.push(`  Changed files: ${toTextList(record.changedFiles).join("; ")}`);
      }
      if (toTextList(record.blockers).length) {
        lines.push(`  Blockers: ${toTextList(record.blockers).join("; ")}`);
      }
    }

    return lines.join("\n");
  }

  function createConvergenceAssimilationResultLedgerPayload(persisted, options = {}) {
    const status = normalizeConvergenceAssimilationResultLedgerStatus(options.status);
    const allResults = (Array.isArray(persisted.convergenceAssimilationRunResults) ? persisted.convergenceAssimilationRunResults : [])
      .map(toControlPlaneRecord)
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime());
    const results = status === "all"
      ? allResults
      : allResults.filter((result) => normalizeConvergenceAssimilationRunResultStatus(result.status) === status);
    const pairIds = new Set(allResults.map((result) => toText(result.pairId)).filter(Boolean));
    const summary = {
      total: allResults.length,
      visible: results.length,
      passed: allResults.filter((result) => normalizeConvergenceAssimilationRunResultStatus(result.status) === "passed").length,
      failed: allResults.filter((result) => normalizeConvergenceAssimilationRunResultStatus(result.status) === "failed").length,
      blocked: allResults.filter((result) => normalizeConvergenceAssimilationRunResultStatus(result.status) === "blocked").length,
      needsReview: allResults.filter((result) => normalizeConvergenceAssimilationRunResultStatus(result.status) === "needs-review").length,
      cancelled: allResults.filter((result) => normalizeConvergenceAssimilationRunResultStatus(result.status) === "cancelled").length,
      codex: allResults.filter((result) => toText(result.runner) === "codex").length,
      claude: allResults.filter((result) => toText(result.runner) === "claude").length,
      pairCount: pairIds.size
    };
    const payload = {
      generatedAt: new Date().toISOString(),
      status,
      summary,
      results,
      secretPolicy: "Non-secret convergence assimilation result metadata only. Do not store credentials, tokens, certificates, private keys, cookies, browser sessions, raw command output, or private repository access material."
    };

    return {
      ...payload,
      markdown: buildConvergenceAssimilationResultLedgerMarkdown(payload)
    };
  }

  function normalizeConvergenceAssimilationResultCheckpointDecision(value) {
    const decision = toText(value).toLowerCase();
    return ["confirmed", "deferred", "escalated"].includes(decision) ? decision : "deferred";
  }

  function getConvergenceAssimilationResultCheckpointLabels(decision) {
    if (decision === "confirmed") {
      return {
        titlePrefix: "Confirmed convergence assimilation result",
        status: "resolved",
        priority: "medium",
        note: "Operator confirmed this convergence assimilation result as accepted evidence."
      };
    }
    if (decision === "escalated") {
      return {
        titlePrefix: "Escalated convergence assimilation result",
        status: "blocked",
        priority: "high",
        note: "Operator escalated this convergence assimilation result for follow-up before more automation."
      };
    }
    return {
      titlePrefix: "Deferred convergence assimilation result",
      status: "open",
      priority: "medium",
      note: "Operator deferred this convergence assimilation result for later review."
    };
  }

  function createConvergenceAssimilationResultCheckpointTask(result, decision, payload = {}) {
    const labels = getConvergenceAssimilationResultCheckpointLabels(decision);
    const now = new Date().toISOString();
    const note = toText(payload.note) || labels.note;
    return {
      id: createId("task"),
      projectId: toText(result.projectId) || undefined,
      projectName: toText(result.projectName) || undefined,
      title: `${labels.titlePrefix}: ${toText(result.projectName) || toText(result.projectId) || toText(result.pairId) || "convergence run"}`,
      description: [
        `${labels.note}`,
        `Result status: ${toText(result.status) || "needs-review"}.`,
        `Runner: ${toText(result.runner) || "not recorded"}.`,
        `Run ID: ${toText(result.runId) || "not recorded"}.`,
        `Pair ID: ${toText(result.pairId) || "not recorded"}.`,
        `Summary: ${toText(result.summary) || "No summary recorded."}`,
        `Validation: ${toText(result.validationSummary) || "Validation not recorded."}`,
        note ? `Checkpoint note: ${note}` : "",
        "Secret policy: non-secret convergence assimilation result checkpoint only. Do not store credentials, tokens, certificates, private keys, cookies, browser sessions, raw command output, or private repository access material."
      ].filter(Boolean).join("\n"),
      priority: labels.priority,
      status: labels.status,
      convergenceAssimilationPairId: toText(result.pairId),
      convergenceAssimilationRunId: toText(result.runId),
      convergenceAssimilationRunResultId: toText(result.id),
      convergenceAssimilationResultStatus: toText(result.status),
      convergenceAssimilationResultCheckpointDecision: decision,
      convergenceAssimilationResultCheckpointNote: note,
      convergenceAssimilationResultCheckpointAt: now,
      sourceType: "convergence-assimilation-result-checkpoint",
      secretPolicy: "non-secret-convergence-assimilation-result-checkpoint-only",
      createdAt: now,
      updatedAt: now
    };
  }

  function buildConvergenceAssimilationResultCheckpointLedgerMarkdown(payload) {
    const summary = toControlPlaneRecord(payload.summary);
    const items = Array.isArray(payload.items) ? payload.items : [];
    const lines = [
      "# Convergence Assimilation Result Checkpoint Ledger",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Status filter: ${toText(payload.status) || "all"}`,
      `Secret policy: ${toText(payload.secretPolicy) || "Non-secret convergence assimilation result checkpoint metadata only."}`,
      "",
      "## Summary",
      `- Total checkpoints: ${toNumber(summary.total)}`,
      `- Visible checkpoints: ${toNumber(summary.visible)}`,
      `- Open: ${toNumber(summary.open)}`,
      `- Closed: ${toNumber(summary.closed)}`,
      `- Confirmed: ${toNumber(summary.confirmed)}`,
      `- Deferred: ${toNumber(summary.deferred)}`,
      `- Escalated: ${toNumber(summary.escalated)}`,
      "",
      "## Checkpoints"
    ];

    if (!items.length) {
      lines.push("- No convergence assimilation result checkpoints matched this filter.");
      return lines.join("\n");
    }

    for (const item of items.slice(0, 100)) {
      const record = toControlPlaneRecord(item);
      lines.push(`- ${toText(record.title) || toText(record.id) || "Result checkpoint"}: ${toText(record.convergenceAssimilationResultCheckpointDecision) || "deferred"} / ${toText(record.status) || "open"}`);
      lines.push(`  Result: ${toText(record.convergenceAssimilationRunResultId) || "not recorded"} | Run: ${toText(record.convergenceAssimilationRunId) || "not recorded"} | Pair: ${toText(record.convergenceAssimilationPairId) || "not recorded"}`);
      lines.push(`  Note: ${toText(record.convergenceAssimilationResultCheckpointNote) || "No checkpoint note recorded."}`);
    }

    return lines.join("\n");
  }

  function createConvergenceAssimilationResultCheckpointLedgerPayload(persisted, options = {}) {
    const requestedStatus = toText(options.status) || "all";
    const status = ["all", "open", "closed"].includes(requestedStatus) ? requestedStatus : "all";
    const allItems = (Array.isArray(persisted.tasks) ? persisted.tasks : [])
      .map(toControlPlaneRecord)
      .filter((task) => toText(task.sourceType) === "convergence-assimilation-result-checkpoint")
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime());
    const items = allItems.filter((item) => {
      if (status === "open") return !isGovernanceClosedStatus(item.status);
      if (status === "closed") return isGovernanceClosedStatus(item.status);
      return true;
    });
    const summary = {
      total: allItems.length,
      visible: items.length,
      open: allItems.filter((item) => !isGovernanceClosedStatus(item.status)).length,
      closed: allItems.filter((item) => isGovernanceClosedStatus(item.status)).length,
      confirmed: allItems.filter((item) => toText(item.convergenceAssimilationResultCheckpointDecision) === "confirmed").length,
      deferred: allItems.filter((item) => toText(item.convergenceAssimilationResultCheckpointDecision) === "deferred").length,
      escalated: allItems.filter((item) => toText(item.convergenceAssimilationResultCheckpointDecision) === "escalated").length
    };
    const payload = {
      generatedAt: new Date().toISOString(),
      status,
      summary,
      items,
      secretPolicy: "Non-secret convergence assimilation result checkpoint metadata only. Do not store credentials, tokens, certificates, private keys, cookies, browser sessions, raw command output, or private repository access material."
    };

    return {
      ...payload,
      markdown: buildConvergenceAssimilationResultCheckpointLedgerMarkdown(payload)
    };
  }

  function buildConvergenceAssimilationReadinessGateMarkdown(payload) {
    const summary = toControlPlaneRecord(payload.summary);
    const reasons = Array.isArray(payload.reasons) ? payload.reasons.map(toControlPlaneRecord) : [];
    const lines = [
      "# Convergence Assimilation Readiness Gate",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Decision: ${toText(payload.decision) || "review"}`,
      `Recommended action: ${toText(payload.recommendedAction) || "Review convergence assimilation state."}`,
      `Secret policy: ${toText(payload.secretPolicy) || "Non-secret convergence assimilation readiness metadata only."}`,
      "",
      "## Summary",
      `- Runs: ${toNumber(summary.runCount)}`,
      `- Open runs: ${toNumber(summary.openRunCount)}`,
      `- Results: ${toNumber(summary.resultCount)}`,
      `- Passed results: ${toNumber(summary.passedResultCount)}`,
      `- Failed results: ${toNumber(summary.failedResultCount)}`,
      `- Blocked results: ${toNumber(summary.blockedResultCount)}`,
      `- Checkpoints: ${toNumber(summary.checkpointCount)}`,
      `- Open checkpoints: ${toNumber(summary.openCheckpointCount)}`,
      `- Escalated checkpoints: ${toNumber(summary.escalatedCheckpointCount)}`,
      "",
      "## Reasons"
    ];

    if (!reasons.length) {
      lines.push("- No readiness blockers found.");
      return lines.join("\n");
    }

    for (const reason of reasons) {
      lines.push(`- ${toText(reason.severity) || "review"}: ${toText(reason.message) || toText(reason.code) || "Review required."}`);
    }

    return lines.join("\n");
  }

  function createConvergenceAssimilationReadinessGatePayload(persisted) {
    const runs = (Array.isArray(persisted.agentWorkOrderRuns) ? persisted.agentWorkOrderRuns : [])
      .map(toControlPlaneRecord)
      .filter((run) => toText(run.convergencePairId) && toText(run.convergenceAssimilationRunner));
    const results = (Array.isArray(persisted.convergenceAssimilationRunResults) ? persisted.convergenceAssimilationRunResults : [])
      .map(toControlPlaneRecord);
    const checkpoints = (Array.isArray(persisted.tasks) ? persisted.tasks : [])
      .map(toControlPlaneRecord)
      .filter((task) => toText(task.sourceType) === "convergence-assimilation-result-checkpoint");
    const summary = {
      runCount: runs.length,
      openRunCount: runs.filter((run) => !isGovernanceClosedStatus(run.status)).length,
      resultCount: results.length,
      passedResultCount: results.filter((result) => normalizeConvergenceAssimilationRunResultStatus(result.status) === "passed").length,
      failedResultCount: results.filter((result) => normalizeConvergenceAssimilationRunResultStatus(result.status) === "failed").length,
      blockedResultCount: results.filter((result) => normalizeConvergenceAssimilationRunResultStatus(result.status) === "blocked").length,
      needsReviewResultCount: results.filter((result) => normalizeConvergenceAssimilationRunResultStatus(result.status) === "needs-review").length,
      checkpointCount: checkpoints.length,
      openCheckpointCount: checkpoints.filter((checkpoint) => !isGovernanceClosedStatus(checkpoint.status)).length,
      escalatedCheckpointCount: checkpoints.filter((checkpoint) => toText(checkpoint.convergenceAssimilationResultCheckpointDecision) === "escalated").length,
      confirmedCheckpointCount: checkpoints.filter((checkpoint) => toText(checkpoint.convergenceAssimilationResultCheckpointDecision) === "confirmed").length
    };
    const reasons = [];
    if (!summary.runCount) {
      reasons.push({
        severity: "review",
        code: "no-convergence-assimilation-runs",
        message: "No convergence assimilation Agent Work Order runs have been queued yet."
      });
    }
    if (summary.openRunCount) {
      reasons.push({
        severity: "review",
        code: "open-convergence-assimilation-runs",
        message: `${summary.openRunCount} convergence assimilation run(s) are still open.`
      });
    }
    if (!summary.resultCount && summary.runCount) {
      reasons.push({
        severity: "review",
        code: "missing-convergence-assimilation-results",
        message: "Queued convergence assimilation runs do not have captured result records yet."
      });
    }
    if (summary.failedResultCount || summary.blockedResultCount) {
      reasons.push({
        severity: "hold",
        code: "failed-or-blocked-convergence-assimilation-results",
        message: `${summary.failedResultCount + summary.blockedResultCount} convergence assimilation result(s) failed or blocked.`
      });
    }
    if (summary.needsReviewResultCount) {
      reasons.push({
        severity: "review",
        code: "convergence-assimilation-results-need-review",
        message: `${summary.needsReviewResultCount} convergence assimilation result(s) need operator review.`
      });
    }
    if (summary.openCheckpointCount) {
      reasons.push({
        severity: "review",
        code: "open-convergence-assimilation-result-checkpoints",
        message: `${summary.openCheckpointCount} convergence assimilation result checkpoint(s) are still open.`
      });
    }
    if (summary.escalatedCheckpointCount) {
      reasons.push({
        severity: "hold",
        code: "escalated-convergence-assimilation-result-checkpoints",
        message: `${summary.escalatedCheckpointCount} convergence assimilation result checkpoint(s) are escalated.`
      });
    }

    const decision = reasons.some((reason) => toText(reason.severity) === "hold")
      ? "hold"
      : reasons.length
        ? "review"
        : "ready";
    const payload = {
      generatedAt: new Date().toISOString(),
      protocolVersion: "convergence-assimilation-readiness-gate.v1",
      decision,
      summary,
      reasons,
      recommendedAction: decision === "ready"
        ? "Convergence assimilation has passed current run, result, and checkpoint checks. Proceed with the next bounded implementation slice."
        : decision === "hold"
          ? "Resolve failed, blocked, or escalated convergence assimilation records before continuing automation."
          : "Review open runs, missing results, or pending checkpoints before continuing automation.",
      secretPolicy: "Non-secret convergence assimilation readiness metadata only. Do not store credentials, tokens, certificates, private keys, cookies, browser sessions, raw command output, or private repository access material."
    };

    return {
      ...payload,
      markdown: buildConvergenceAssimilationReadinessGateMarkdown(payload)
    };
  }

  function getConvergenceOperatorProposalQueueStatus(candidate, relatedTasks) {
    const reviewStatus = toText(candidate.reviewStatus) || "unreviewed";
    const openTasks = relatedTasks.filter((task) => !isGovernanceClosedStatus(task.status));
    const blockedTasks = relatedTasks.filter((task) => toText(task.status) === "blocked");
    if (reviewStatus === "not-related") return "suppressed";
    if (blockedTasks.length) return "blocked";
    if (openTasks.length) return "task-tracked";
    if (relatedTasks.length) return "completed";
    if (reviewStatus === "confirmed-overlap" || reviewStatus === "merge-candidate") return "task-ready";
    return "review-required";
  }

  function buildConvergenceOperatorProposalQueueMarkdown(payload) {
    const summary = toControlPlaneRecord(payload.summary);
    const items = Array.isArray(payload.items) ? payload.items : [];
    const lines = [
      "# Operator Convergence Proposal Review Queue",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Filter: ${toText(payload.status) || "active"}`,
      `Secret policy: ${toText(payload.secretPolicy) || "Non-secret operator convergence proposal metadata only."}`,
      "",
      "## Summary",
      `- Total operator proposals: ${toNumber(summary.total)}`,
      `- Visible proposals: ${toNumber(summary.visible)}`,
      `- Review required: ${toNumber(summary.reviewRequired)}`,
      `- Task ready: ${toNumber(summary.taskReady)}`,
      `- Task tracked: ${toNumber(summary.taskTracked)}`,
      `- Blocked: ${toNumber(summary.blocked)}`,
      `- Suppressed: ${toNumber(summary.suppressed)}`,
      "",
      "## Queue"
    ];

    if (!items.length) {
      lines.push("- No operator-contributed convergence proposals matched this queue filter.");
      return lines.join("\n");
    }

    for (const item of items.slice(0, 50)) {
      const record = toControlPlaneRecord(item);
      lines.push(`- ${toText(record.leftName) || toText(record.leftId)} -> ${toText(record.rightName) || toText(record.rightId)}: ${toText(record.queueStatus) || "review-required"} (${toNumber(record.score)}%)`);
      lines.push(`  Pair: ${toText(record.pairId)}`);
      lines.push(`  Review: ${toText(record.reviewStatus) || "unreviewed"} | Tasks: ${toNumber(record.openTaskCount)} open / ${toNumber(record.relatedTaskCount)} total`);
      lines.push(`  Recommendation: ${toText(record.recommendedAction) || "Review operator proposal before assimilation."}`);
      if (toText(record.generatedInsight)) {
        lines.push(`  AI insight: ${toText(record.generatedInsight)}`);
      }
      if (toText(record.reviewNote)) {
        lines.push(`  Operator note: ${toText(record.reviewNote)}`);
      }
    }

    return lines.join("\n");
  }

  function createConvergenceOperatorProposalQueuePayload(inventory, persisted, options = {}) {
    const status = toText(options.status) || "active";
    const candidatePayload = createConvergenceCandidatesPayload(inventory, persisted, {
      status: "all",
      includeNotRelated: "true"
    });
    const tasks = Array.isArray(persisted.tasks) ? persisted.tasks : [];
    const allItems = candidatePayload.candidates
      .filter((candidate) => candidate.operatorProposed === true || toText(candidate.reviewSource) === "operator-contributed-overlap")
      .map((candidate) => {
        const relatedTasks = tasks.filter((task) => toText(task.convergencePairId) === toText(candidate.pairId));
        const openTasks = relatedTasks.filter((task) => !isGovernanceClosedStatus(task.status));
        const blockedTasks = relatedTasks.filter((task) => toText(task.status) === "blocked");
        const queueStatus = getConvergenceOperatorProposalQueueStatus(candidate, relatedTasks);
        return {
          pairId: toText(candidate.pairId),
          leftId: toText(candidate.leftId),
          rightId: toText(candidate.rightId),
          leftName: toText(candidate.leftName),
          rightName: toText(candidate.rightName),
          score: toNumber(candidate.score),
          reasons: Array.isArray(candidate.reasons) ? candidate.reasons : [],
          reviewStatus: toText(candidate.reviewStatus) || "unreviewed",
          reviewId: toText(candidate.reviewId),
          reviewNote: toText(candidate.reviewNote),
          reviewedAt: toText(candidate.reviewedAt),
          reviewer: toText(candidate.reviewer),
          reviewSource: toText(candidate.reviewSource) || "operator-contributed-overlap",
          generatedInsight: toText(candidate.generatedInsight),
          assimilationRecommendation: toText(candidate.assimilationRecommendation),
          queueStatus,
          relatedTaskCount: relatedTasks.length,
          openTaskCount: openTasks.length,
          blockedTaskCount: blockedTasks.length,
          relatedTasks: relatedTasks.slice(0, 5).map((task) => ({
            id: toText(task.id),
            title: toText(task.title),
            status: toText(task.status) || "open",
            priority: toText(task.priority) || "normal",
            updatedAt: toText(task.updatedAt || task.createdAt)
          })),
          recommendedAction: getConvergenceDueDiligenceRecommendation(candidate, relatedTasks),
          secretPolicy: "Non-secret operator convergence proposal metadata only."
        };
      })
      .sort((left, right) => {
        const statusRank = { blocked: 0, "review-required": 1, "task-ready": 2, "task-tracked": 3, completed: 4, suppressed: 5 };
        const statusDelta = (statusRank[left.queueStatus] ?? 9) - (statusRank[right.queueStatus] ?? 9);
        if (statusDelta) return statusDelta;
        return right.score - left.score || left.leftName.localeCompare(right.leftName);
      });

    const matchesStatus = (item) => {
      if (status === "all") return true;
      if (status === "active") return item.queueStatus !== "suppressed" && item.queueStatus !== "completed";
      return item.queueStatus === status;
    };
    const items = allItems.filter(matchesStatus);
    const countStatus = (queueStatus) => allItems.filter((item) => item.queueStatus === queueStatus).length;
    const summary = {
      total: allItems.length,
      visible: items.length,
      active: allItems.filter((item) => item.queueStatus !== "suppressed" && item.queueStatus !== "completed").length,
      reviewRequired: countStatus("review-required"),
      taskReady: countStatus("task-ready"),
      taskTracked: countStatus("task-tracked"),
      blocked: countStatus("blocked"),
      completed: countStatus("completed"),
      suppressed: countStatus("suppressed"),
      highConfidence: allItems.filter((item) => item.score >= 80).length
    };
    const payload = {
      generatedAt: new Date().toISOString(),
      status,
      summary,
      items,
      secretPolicy: "Non-secret operator convergence proposal metadata only. Resolve credentials, tokens, passwords, certificates, private keys, cookies, and browser sessions outside this app."
    };

    return {
      ...payload,
      markdown: buildConvergenceOperatorProposalQueueMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} candidate
   */
  function getConvergenceReviewTaskPriority(candidate) {
    const status = toText(candidate.reviewStatus);
    const score = toNumber(candidate.score);
    if (status === "merge-candidate" || score >= 85) return "high";
    if (status === "confirmed-overlap" || status === "needs-review" || score >= 60) return "medium";
    return "low";
  }

  /**
   * @param {Record<string, unknown>} candidate
   */
  function createConvergenceReviewTask(candidate) {
    const pairId = toText(candidate.pairId) || createConvergencePairId(candidate.leftId, candidate.rightId);
    const leftName = toText(candidate.leftName) || toText(candidate.leftId) || "Left project";
    const rightName = toText(candidate.rightName) || toText(candidate.rightId) || "Right project";
    const status = toText(candidate.reviewStatus) || "needs-review";
    const priority = getConvergenceReviewTaskPriority(candidate);
    const reasons = Array.isArray(candidate.reasons)
      ? candidate.reasons.map((reason) => toText(reason)).filter(Boolean)
      : [];
    const descriptionLines = [
      `Convergence pair: ${leftName} -> ${rightName}`,
      `Pair ID: ${pairId}`,
      `Review status: ${status}`,
      `Score: ${toNumber(candidate.score)}%`,
      `Review ID: ${toText(candidate.reviewId) || "not recorded"}`,
      `Recommendation: ${toText(candidate.assimilationRecommendation) || status}`,
      reasons.length ? `Reasons: ${reasons.slice(0, 8).join("; ")}` : "Reasons: none recorded",
      toText(candidate.generatedInsight) ? `AI insight: ${toText(candidate.generatedInsight)}` : "",
      toText(candidate.reviewNote) ? `Review note: ${toText(candidate.reviewNote)}` : "",
      "Secret policy: Record only non-secret convergence triage and assimilation evidence. Do not store passwords, tokens, certificates, private keys, cookies, browser sessions, or repository credentials."
    ].filter(Boolean);

    return {
      id: createId("task"),
      projectId: toText(candidate.leftId) || "convergence-control",
      projectName: leftName,
      title: `Convergence review: ${leftName} + ${rightName}`,
      description: descriptionLines.join("\n"),
      priority,
      status: "open",
      convergencePairId: pairId,
      convergenceLeftId: toText(candidate.leftId),
      convergenceRightId: toText(candidate.rightId),
      convergenceLeftName: leftName,
      convergenceRightName: rightName,
      convergenceReviewId: toText(candidate.reviewId),
      convergenceReviewStatus: status,
      convergenceScore: toNumber(candidate.score),
      convergenceRecommendation: toText(candidate.assimilationRecommendation) || status,
      convergenceOperatorProposed: Boolean(candidate.operatorProposed),
      secretPolicy: "non-secret-convergence-review-evidence-only",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildConvergenceTaskLedgerMarkdown(payload) {
    const summary = toControlPlaneRecord(payload.summary);
    const items = Array.isArray(payload.items) ? payload.items : [];
    const lines = [
      "# Convergence Review Task Ledger",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Status filter: ${toText(payload.status) || "all"}`,
      `Secret policy: ${toText(payload.secretPolicy) || "Non-secret convergence review task metadata only."}`,
      "",
      "## Summary",
      `- Total tasks: ${toNumber(summary.total)}`,
      `- Open tasks: ${toNumber(summary.open)}`,
      `- Closed tasks: ${toNumber(summary.closed)}`,
      `- Visible tasks: ${toNumber(summary.visible)}`,
      `- Unique pairs: ${toNumber(summary.pairCount)}`,
      `- Operator-proposed tasks: ${toNumber(summary.operatorProposed)}`,
      `- Priority split: ${toNumber(summary.high)} high / ${toNumber(summary.medium)} medium / ${toNumber(summary.low)} low / ${toNumber(summary.normal)} normal`,
      "",
      "## Tasks"
    ];

    if (items.length) {
      for (const item of items) {
        const record = toControlPlaneRecord(item);
        lines.push(`- ${toText(record.priority) || "normal"} ${toText(record.status) || "open"}: ${toText(record.title) || "Convergence review task"}`);
        lines.push(`  Pair: ${toText(record.convergenceLeftName || record.convergenceLeftId) || "left project"} -> ${toText(record.convergenceRightName || record.convergenceRightId) || "right project"} | Pair ID: ${toText(record.convergencePairId) || "not recorded"}`);
        lines.push(`  Review: ${toText(record.convergenceReviewStatus) || "needs-review"} | Recommendation: ${toText(record.convergenceRecommendation) || "needs-review"} | Score: ${toNumber(record.convergenceScore)}%`);
        if (toText(record.convergenceTaskCheckpointStatus)) {
          lines.push(`  Checkpoint: ${toText(record.convergenceTaskCheckpointStatus)} at ${toText(record.convergenceTaskCheckpointedAt) || "not recorded"} | ${toText(record.convergenceTaskCheckpointNote) || "no checkpoint note"}`);
        }
        if (toText(record.convergenceTaskLedgerDriftField)) {
          lines.push(`  Drift checkpoint: ${toText(record.convergenceTaskLedgerDriftCheckpointStatus) || toText(record.convergenceTaskLedgerDriftDecision) || "tracked"} | Field: ${toText(record.convergenceTaskLedgerDriftField)} | Snapshot: ${toText(record.convergenceTaskLedgerDriftSnapshotTitle) || toText(record.convergenceTaskLedgerDriftSnapshotId) || "latest"}`);
        }
        lines.push(`  Updated: ${toText(record.updatedAt) || toText(record.createdAt) || "not recorded"} | Secret policy: ${toText(record.secretPolicy) || "non-secret-convergence-review-evidence-only"}`);
      }
    } else {
      lines.push("- No Convergence Review tasks match the current filter.");
    }

    return lines.join("\n");
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {{ status?: string, limit?: number }} [options]
   */
  function createConvergenceTaskLedgerPayload(persisted, options = {}) {
    const requestedStatus = toText(options.status) || "all";
    const status = ["all", "open", "closed"].includes(requestedStatus) ? requestedStatus : "all";
    const requestedLimit = Number(options.limit || 100);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(250, Math.trunc(requestedLimit)))
      : 100;
    const convergenceTasks = (Array.isArray(persisted.tasks) ? persisted.tasks : [])
      .filter((task) => toText(task.convergencePairId) || toText(task.projectId) === "convergence-control")
      .map((task) => {
        const record = toControlPlaneRecord(task);
        return {
          id: toText(record.id),
          title: toText(record.title) || "Convergence review task",
          status: toText(record.status) || "open",
          priority: toText(record.priority) || "normal",
          projectId: toText(record.projectId) || toText(record.convergenceLeftId) || "convergence-control",
          projectName: toText(record.projectName) || toText(record.convergenceLeftName) || "Convergence Review",
          convergencePairId: toText(record.convergencePairId),
          convergenceLeftId: toText(record.convergenceLeftId),
          convergenceRightId: toText(record.convergenceRightId),
          convergenceLeftName: toText(record.convergenceLeftName),
          convergenceRightName: toText(record.convergenceRightName),
          convergenceReviewId: toText(record.convergenceReviewId),
          convergenceReviewStatus: toText(record.convergenceReviewStatus) || "needs-review",
          convergenceScore: toNumber(record.convergenceScore),
          convergenceRecommendation: toText(record.convergenceRecommendation) || toText(record.convergenceReviewStatus) || "needs-review",
          convergenceOperatorProposed: Boolean(record.convergenceOperatorProposed),
          convergenceTaskCheckpointStatus: toText(record.convergenceTaskCheckpointStatus),
          convergenceTaskCheckpointedAt: toText(record.convergenceTaskCheckpointedAt),
          convergenceTaskCheckpointNote: toText(record.convergenceTaskCheckpointNote),
          convergenceTaskLedgerDriftSnapshotId: toText(record.convergenceTaskLedgerDriftSnapshotId),
          convergenceTaskLedgerDriftSnapshotTitle: toText(record.convergenceTaskLedgerDriftSnapshotTitle),
          convergenceTaskLedgerDriftField: toText(record.convergenceTaskLedgerDriftField),
          convergenceTaskLedgerDriftLabel: toText(record.convergenceTaskLedgerDriftLabel),
          convergenceTaskLedgerDriftDecision: toText(record.convergenceTaskLedgerDriftDecision),
          convergenceTaskLedgerDriftSeverity: toText(record.convergenceTaskLedgerDriftSeverity),
          convergenceTaskLedgerDriftScore: toNumber(record.convergenceTaskLedgerDriftScore),
          convergenceTaskLedgerDriftBefore: toText(record.convergenceTaskLedgerDriftBefore),
          convergenceTaskLedgerDriftCurrent: toText(record.convergenceTaskLedgerDriftCurrent),
          convergenceTaskLedgerDriftDelta: toNumber(record.convergenceTaskLedgerDriftDelta),
          convergenceTaskLedgerDriftCheckpointStatus: toText(record.convergenceTaskLedgerDriftCheckpointStatus),
          convergenceTaskLedgerDriftCheckpointedAt: toText(record.convergenceTaskLedgerDriftCheckpointedAt),
          convergenceTaskLedgerDriftCheckpointNote: toText(record.convergenceTaskLedgerDriftCheckpointNote),
          description: toText(record.description),
          secretPolicy: toText(record.secretPolicy) || "non-secret-convergence-review-evidence-only",
          createdAt: toText(record.createdAt),
          updatedAt: toText(record.updatedAt || record.createdAt)
        };
      })
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime());

    const openTasks = convergenceTasks.filter((task) => !isGovernanceClosedStatus(task.status));
    const closedTasks = convergenceTasks.filter((task) => isGovernanceClosedStatus(task.status));
    const visibleTasks = status === "open"
      ? openTasks
      : status === "closed"
        ? closedTasks
        : convergenceTasks;
    const reviewStatusCounts = {};
    const pairIds = new Set();
    for (const task of convergenceTasks) {
      const reviewStatus = toText(task.convergenceReviewStatus) || "needs-review";
      reviewStatusCounts[reviewStatus] = toNumber(reviewStatusCounts[reviewStatus]) + 1;
      const pairId = toText(task.convergencePairId);
      if (pairId) pairIds.add(pairId);
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      status,
      limit,
      secretPolicy: "Non-secret convergence review task metadata only. Resolve repository credentials, tokens, passwords, private keys, certificates, cookies, and browser sessions outside this app.",
      summary: {
        total: convergenceTasks.length,
        open: openTasks.length,
        closed: closedTasks.length,
        visible: Math.min(visibleTasks.length, limit),
        high: convergenceTasks.filter((task) => task.priority === "high").length,
        medium: convergenceTasks.filter((task) => task.priority === "medium").length,
        low: convergenceTasks.filter((task) => task.priority === "low").length,
        normal: convergenceTasks.filter((task) => !["high", "medium", "low"].includes(task.priority)).length,
        pairCount: pairIds.size,
        operatorProposed: convergenceTasks.filter((task) => task.convergenceOperatorProposed).length,
        reviewStatusCounts
      },
      items: visibleTasks.slice(0, limit)
    };

    return {
      ...payload,
      markdown: buildConvergenceTaskLedgerMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {{ title?: string, status?: string, limit?: number }} [options]
   */
  function createConvergenceTaskLedgerSnapshotRecord(persisted, options = {}) {
    const ledger = createConvergenceTaskLedgerPayload(persisted, {
      status: toText(options.status) || "all",
      limit: Number(options.limit || 100)
    });

    return {
      id: createId("convergence-task-ledger-snapshot"),
      title: toText(options.title) || "Convergence Review Task Ledger",
      statusFilter: ledger.status,
      limit: ledger.limit,
      total: ledger.summary.total,
      openCount: ledger.summary.open,
      closedCount: ledger.summary.closed,
      visibleCount: ledger.summary.visible,
      pairCount: ledger.summary.pairCount,
      operatorProposedCount: ledger.summary.operatorProposed,
      reviewStatusCounts: ledger.summary.reviewStatusCounts,
      secretPolicy: ledger.secretPolicy,
      markdown: ledger.markdown,
      items: ledger.items,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildConvergenceTaskLedgerSnapshotDiffMarkdown(payload) {
    const formatDriftValue = (value) => typeof value === "number" ? String(value) : toText(value);
    const lines = [
      "# Convergence Review Task Ledger Snapshot Drift",
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
      lines.push("- No Convergence Review task ledger drift detected.");
      return lines.join("\n");
    }

    for (const item of driftItems) {
      const record = toControlPlaneRecord(item);
      lines.push(`- ${toText(record.label) || toText(record.field) || "Convergence Review task drift"}: ${formatDriftValue(record.before)} -> ${formatDriftValue(record.current)}`);
    }

    return lines.join("\n");
  }

  function createMissingConvergenceTaskLedgerSnapshotDiffPayload() {
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: false,
      snapshotId: "",
      snapshotTitle: "",
      snapshotCreatedAt: "",
      hasDrift: false,
      driftScore: 0,
      driftSeverity: "missing-snapshot",
      recommendedAction: "Save a Convergence Review task ledger snapshot before comparing overlap follow-up task drift.",
      driftItems: [],
      liveSummary: null,
      snapshotSummary: null
    };
    return {
      ...payload,
      markdown: buildConvergenceTaskLedgerSnapshotDiffMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} snapshot
   * @param {ReturnType<typeof createConvergenceTaskLedgerPayload>} live
   */
  function createConvergenceTaskLedgerSnapshotDiffPayload(snapshot, live) {
    const driftItems = [];
    const snapshotSummary = {
      total: toNumber(snapshot.total),
      open: toNumber(snapshot.openCount),
      closed: toNumber(snapshot.closedCount),
      visible: toNumber(snapshot.visibleCount),
      pairCount: toNumber(snapshot.pairCount),
      operatorProposed: toNumber(snapshot.operatorProposedCount)
    };
    const liveSummary = toControlPlaneRecord(live.summary);
    const countFields = [
      { field: "total", label: "Total Convergence Review tasks" },
      { field: "open", label: "Open Convergence Review tasks" },
      { field: "closed", label: "Closed Convergence Review tasks" },
      { field: "visible", label: "Visible Convergence Review tasks" },
      { field: "pairCount", label: "Unique convergence pairs" },
      { field: "operatorProposed", label: "Operator-proposed convergence tasks" }
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
    const taskKey = (task) => toText(task.id) || toText(task.convergencePairId) || `${toText(task.convergenceLeftName)}:${toText(task.convergenceRightName)}`;
    const snapshotByKey = new Map(snapshotTasks.map((task) => [taskKey(task), task]));
    const liveByKey = new Map(liveTasks.map((task) => [taskKey(task), task]));

    for (const [key, task] of liveByKey) {
      const previous = snapshotByKey.get(key);
      const label = toText(task.title) || toText(task.convergencePairId) || key;
      const currentState = `${toText(task.status) || "open"} / ${toText(task.priority) || "normal"} / ${toText(task.convergenceReviewStatus) || "needs-review"} / ${toNumber(task.convergenceScore)} / ${toText(task.convergenceTaskCheckpointStatus) || "unchecked"}`;
      if (!previous) {
        driftItems.push({
          field: `convergence-task:${key}`,
          label: `${label} added`,
          before: "missing",
          current: currentState,
          delta: 1
        });
        continue;
      }
      const beforeState = `${toText(previous.status) || "open"} / ${toText(previous.priority) || "normal"} / ${toText(previous.convergenceReviewStatus) || "needs-review"} / ${toNumber(previous.convergenceScore)} / ${toText(previous.convergenceTaskCheckpointStatus) || "unchecked"}`;
      if (beforeState !== currentState) {
        driftItems.push({
          field: `convergence-task:${key}`,
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
          field: `convergence-task:${key}`,
          label: `${toText(task.title) || toText(task.convergencePairId) || key} removed`,
          before: `${toText(task.status) || "open"} / ${toText(task.priority) || "normal"} / ${toText(task.convergenceReviewStatus) || "needs-review"} / ${toNumber(task.convergenceScore)}`,
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
      ? "Review new open Convergence Review tasks before merging, suppressing, or handing overlap work to a CLI runner."
      : driftSeverity === "medium"
        ? "Review Convergence Review task ledger drift and refresh the snapshot if changes are intentional."
        : driftSeverity === "low"
          ? "Monitor low Convergence Review task drift and refresh the snapshot after confirmation."
          : "No Convergence Review task ledger drift detected.";
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: true,
      snapshotId: toText(snapshot.id),
      snapshotTitle: toText(snapshot.title) || "Convergence Review Task Ledger",
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
      markdown: buildConvergenceTaskLedgerSnapshotDiffMarkdown(payload)
    };
  }

  function getConvergenceTaskLedgerDriftCheckpointDecision(decision) {
    const normalized = toText(decision).toLowerCase();
    if (normalized === "escalate" || normalized === "escalated") {
      return { key: "escalated", status: "blocked", priority: "high", label: "Escalated" };
    }
    if (normalized === "defer" || normalized === "deferred") {
      return { key: "deferred", status: "deferred", priority: "medium", label: "Deferred" };
    }
    return { key: "confirmed", status: "resolved", priority: "low", label: "Confirmed" };
  }

  function formatConvergenceTaskLedgerDriftValue(value) {
    return typeof value === "number" ? String(value) : toText(value);
  }

  function buildConvergenceTaskLedgerDriftCheckpointTask(diff, item, decision, now) {
    const label = toText(item.label) || toText(item.field) || "Convergence Review task ledger drift";
    const field = toText(item.field) || label;
    return {
      projectId: "convergence-control",
      projectName: "Convergence Review",
      title: `Convergence task ledger drift ${decision.label.toLowerCase()}: ${label}`.slice(0, 140),
      description: [
        `Operator ${decision.label.toLowerCase()} Convergence Review task ledger drift item ${label}.`,
        `Snapshot: ${toText(diff.snapshotTitle) || toText(diff.snapshotId) || "latest Convergence Review task ledger snapshot"}.`,
        `Field: ${field}.`,
        `Previous: ${formatConvergenceTaskLedgerDriftValue(item.before)}; current: ${formatConvergenceTaskLedgerDriftValue(item.current)}; delta: ${toNumber(item.delta)}.`,
        `Drift severity: ${toText(diff.driftSeverity) || "none"}; score: ${toNumber(diff.driftScore)}.`,
        "Secret policy: non-secret convergence review task ledger drift metadata only; do not store credentials, repository tokens, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
      ].join(" "),
      priority: decision.priority,
      status: decision.status,
      convergenceTaskLedgerDriftSnapshotId: toText(diff.snapshotId),
      convergenceTaskLedgerDriftSnapshotTitle: toText(diff.snapshotTitle),
      convergenceTaskLedgerDriftField: field,
      convergenceTaskLedgerDriftLabel: label,
      convergenceTaskLedgerDriftDecision: decision.key,
      convergenceTaskLedgerDriftSeverity: toText(diff.driftSeverity) || "none",
      convergenceTaskLedgerDriftScore: toNumber(diff.driftScore),
      convergenceTaskLedgerDriftBefore: formatConvergenceTaskLedgerDriftValue(item.before),
      convergenceTaskLedgerDriftCurrent: formatConvergenceTaskLedgerDriftValue(item.current),
      convergenceTaskLedgerDriftDelta: toNumber(item.delta),
      convergenceTaskLedgerDriftCheckpointStatus: decision.key,
      convergenceTaskLedgerDriftCheckpointedAt: now,
      convergenceTaskLedgerDriftCheckpointNote: `Operator ${decision.label.toLowerCase()} ${label} from Convergence Review task ledger drift.`,
      secretPolicy: "non-secret-convergence-review-task-ledger-drift-only"
    };
  }

  function buildConvergenceTaskLedgerDriftCheckpointLedgerMarkdown(payload) {
    const summary = toControlPlaneRecord(payload.summary);
    const items = Array.isArray(payload.items) ? payload.items : [];
    const lines = [
      "# Convergence Review Task Ledger Drift Checkpoints",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Status filter: ${toText(payload.status) || "all"}`,
      `Secret policy: ${toText(payload.secretPolicy) || "Non-secret convergence review task ledger drift metadata only."}`,
      "",
      "## Summary",
      `- Total checkpoint tasks: ${toNumber(summary.total)}`,
      `- Open checkpoint tasks: ${toNumber(summary.open)}`,
      `- Closed checkpoint tasks: ${toNumber(summary.closed)}`,
      `- Visible checkpoint tasks: ${toNumber(summary.visible)}`,
      `- Decisions: ${toNumber(summary.confirmed)} confirmed / ${toNumber(summary.deferred)} deferred / ${toNumber(summary.escalated)} escalated`,
      `- Unique snapshots: ${toNumber(summary.snapshotCount)}`,
      `- Unique drift fields: ${toNumber(summary.fieldCount)}`,
      "",
      "## Checkpoints"
    ];

    if (items.length) {
      for (const item of items) {
        const record = toControlPlaneRecord(item);
        lines.push(`- ${toText(record.priority) || "normal"} ${toText(record.status) || "open"}: ${toText(record.title) || "Convergence drift checkpoint"}`);
        lines.push(`  Decision: ${toText(record.decision) || toText(record.checkpointStatus) || "tracked"} | Field: ${toText(record.field) || "not recorded"} | Snapshot: ${toText(record.snapshotTitle) || toText(record.snapshotId) || "not recorded"}`);
        lines.push(`  Drift: ${toText(record.before) || "none"} -> ${toText(record.current) || "none"} | Delta: ${toNumber(record.delta)} | Severity: ${toText(record.severity) || "none"} | Score: ${toNumber(record.score)}`);
        lines.push(`  Checkpointed: ${toText(record.checkpointedAt) || toText(record.updatedAt) || "not recorded"} | Note: ${toText(record.note) || "no checkpoint note"}`);
        lines.push(`  Secret policy: ${toText(record.secretPolicy) || "non-secret-convergence-review-task-ledger-drift-only"}`);
      }
    } else {
      lines.push("- No Convergence Review task ledger drift checkpoints match the current filter.");
    }

    return lines.join("\n");
  }

  function createConvergenceTaskLedgerDriftCheckpointLedgerPayload(persisted, options = {}) {
    const requestedStatus = toText(options.status) || "all";
    const status = ["all", "open", "closed"].includes(requestedStatus) ? requestedStatus : "all";
    const requestedLimit = Number(options.limit || 100);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(250, Math.trunc(requestedLimit)))
      : 100;
    const checkpoints = (Array.isArray(persisted.tasks) ? persisted.tasks : [])
      .filter((task) => toText(task.convergenceTaskLedgerDriftField))
      .map((task) => {
        const record = toControlPlaneRecord(task);
        return {
          id: toText(record.id),
          title: toText(record.title) || "Convergence drift checkpoint",
          status: toText(record.status) || "open",
          priority: toText(record.priority) || "normal",
          projectId: toText(record.projectId) || "convergence-control",
          projectName: toText(record.projectName) || "Convergence Review",
          snapshotId: toText(record.convergenceTaskLedgerDriftSnapshotId),
          snapshotTitle: toText(record.convergenceTaskLedgerDriftSnapshotTitle),
          field: toText(record.convergenceTaskLedgerDriftField),
          label: toText(record.convergenceTaskLedgerDriftLabel),
          decision: toText(record.convergenceTaskLedgerDriftDecision),
          checkpointStatus: toText(record.convergenceTaskLedgerDriftCheckpointStatus),
          severity: toText(record.convergenceTaskLedgerDriftSeverity),
          score: toNumber(record.convergenceTaskLedgerDriftScore),
          before: toText(record.convergenceTaskLedgerDriftBefore),
          current: toText(record.convergenceTaskLedgerDriftCurrent),
          delta: toNumber(record.convergenceTaskLedgerDriftDelta),
          checkpointedAt: toText(record.convergenceTaskLedgerDriftCheckpointedAt),
          note: toText(record.convergenceTaskLedgerDriftCheckpointNote),
          secretPolicy: toText(record.secretPolicy) || "non-secret-convergence-review-task-ledger-drift-only",
          createdAt: toText(record.createdAt),
          updatedAt: toText(record.updatedAt || record.createdAt)
        };
      })
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime());

    const openTasks = checkpoints.filter((task) => !isGovernanceClosedStatus(task.status));
    const closedTasks = checkpoints.filter((task) => isGovernanceClosedStatus(task.status));
    const visibleTasks = status === "open"
      ? openTasks
      : status === "closed"
        ? closedTasks
        : checkpoints;
    const snapshotIds = new Set(checkpoints.map((task) => toText(task.snapshotId)).filter(Boolean));
    const fields = new Set(checkpoints.map((task) => toText(task.field)).filter(Boolean));
    const payload = {
      generatedAt: new Date().toISOString(),
      status,
      limit,
      secretPolicy: "Non-secret convergence review task ledger drift metadata only. Resolve repository credentials, tokens, passwords, private keys, certificates, cookies, and browser sessions outside this app.",
      summary: {
        total: checkpoints.length,
        open: openTasks.length,
        closed: closedTasks.length,
        visible: Math.min(visibleTasks.length, limit),
        confirmed: checkpoints.filter((task) => task.decision === "confirmed" || task.checkpointStatus === "confirmed").length,
        deferred: checkpoints.filter((task) => task.decision === "deferred" || task.checkpointStatus === "deferred").length,
        escalated: checkpoints.filter((task) => task.decision === "escalated" || task.checkpointStatus === "escalated").length,
        high: checkpoints.filter((task) => task.priority === "high").length,
        medium: checkpoints.filter((task) => task.priority === "medium").length,
        low: checkpoints.filter((task) => task.priority === "low").length,
        normal: checkpoints.filter((task) => !["high", "medium", "low"].includes(task.priority)).length,
        snapshotCount: snapshotIds.size,
        fieldCount: fields.size
      },
      items: visibleTasks.slice(0, limit)
    };

    return {
      ...payload,
      markdown: buildConvergenceTaskLedgerDriftCheckpointLedgerMarkdown(payload)
    };
  }

  /**
   * @param {Awaited<ReturnType<typeof getInventoryPayload>>} inventory
   * @param {{ convergenceReviews?: Record<string, unknown>[] }} [options]
   */
  function buildFindings(inventory, options = {}) {
    const findings = [];
    const convergenceReviewMap = getConvergencePairReviewMap(options.convergenceReviews);

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
        const convergencePairId = createConvergencePairId(project.id, strongestMatch.id);
        const convergenceReview = convergenceReviewMap.get(convergencePairId);
        if (convergenceReview?.status === "not-related") {
          continue;
        }
        findings.push({
          id: createId("finding"),
          projectId: project.id,
          projectName: project.name,
          severity: "medium",
          category: "convergence",
          title: "High overlap candidate",
          detail: `${project.name} overlaps strongly with ${strongestMatch.name} (${strongestMatch.score}%). Review status: ${convergenceReview?.status || "unreviewed"}.`,
          convergencePairId,
          convergenceReviewStatus: convergenceReview?.status || "unreviewed",
          relatedProjectId: strongestMatch.id,
          relatedProjectName: strongestMatch.name,
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
   *   releaseTaskLedgerSnapshots?: Array<Record<string, unknown>>,
   *   convergenceTaskLedgerSnapshots?: Array<Record<string, unknown>>,
   *   projectProfiles?: Array<Record<string, unknown>>,
   *   projectProfileHistory?: Array<Record<string, unknown>>,
   *   queueSuppressions?: Array<Record<string, unknown>>,
   *   governanceOperations?: Array<Record<string, unknown>>,
   *   agentSessions?: Array<Record<string, unknown>>,
   *   agentControlPlaneSnapshots?: Array<Record<string, unknown>>,
   *   agentControlPlaneBaselineSnapshotId?: string,
   *   agentControlPlaneDecisionSnapshots?: Array<Record<string, unknown>>,
   *   agentPolicyCheckpoints?: Array<Record<string, unknown>>,
   *   agentExecutionResultCheckpoints?: Array<Record<string, unknown>>,
   *   agentWorkOrderSnapshots?: Array<Record<string, unknown>>,
   *   governanceTaskUpdateLedgerSnapshots?: Array<Record<string, unknown>>,
   *   dataSourceAccessTaskLedgerSnapshots?: Array<Record<string, unknown>>,
   *   agentControlPlaneDecisionTaskLedgerSnapshots?: Array<Record<string, unknown>>,
   *   agentExecutionResultTaskLedgerSnapshots?: Array<Record<string, unknown>>,
   *   dataSourceAccessValidationEvidence?: Array<Record<string, unknown>>,
   *   dataSourceAccessValidationEvidenceSnapshots?: Array<Record<string, unknown>>,
   *   dataSourceAccessValidationWorkflowSnapshots?: Array<Record<string, unknown>>,
   *   agentExecutionSlaLedgerSnapshots?: Array<Record<string, unknown>>,
   *   agentWorkOrderRuns?: Array<Record<string, unknown>>,
   *   cliBridgeHandoffs?: Array<Record<string, unknown>>,
   *   cliBridgeRunTraceSnapshots?: Array<Record<string, unknown>>,
   *   governanceExecutionViews?: Array<Record<string, unknown>>,
   *   governanceExecutionPolicy?: Record<string, unknown>
   * }} persisted
   * @param {{ projects?: Array<Record<string, unknown>> }} inventory
   * @param {{ dataSourcesAccessGate?: Record<string, unknown> | null, dataSourcesAccessReviewQueue?: Record<string, unknown> | null, dataSourcesAccessValidationRunbook?: Record<string, unknown> | null, dataSourcesAccessValidationEvidenceCoverage?: Record<string, unknown> | null, dataSourcesAccessValidationWorkflow?: Record<string, unknown> | null, releaseBuildGate?: Record<string, unknown> | null }} [options]
   */
  function buildGovernanceSnapshot(persisted, inventory, options = {}) {
    const isClosed = isClosedTaskStatus;
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
    const agentExecutionResultTasks = persisted.tasks.filter((task) => toText(task.agentExecutionResultRunId) || toText(task.agentExecutionResultCheckpointId));
    const openAgentExecutionResultTasks = agentExecutionResultTasks.filter((task) => !isClosed(task.status));
    const agentExecutionResultTaskFocus = [...agentExecutionResultTasks]
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime())
      .slice(0, 24);
    const convergenceTasks = persisted.tasks.filter((task) => toText(task.convergencePairId) || toText(task.projectId) === "convergence-control");
    const openConvergenceTasks = convergenceTasks.filter((task) => !isClosed(task.status));
    const convergenceTaskFocus = [...convergenceTasks]
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime())
      .slice(0, 24);
    const activeWorkflows = persisted.workflows.filter((workflow) => !isClosed(workflow.status));
    const pendingMilestones = persisted.milestones.filter((milestone) => !isClosed(milestone.status));
    const decisionNotes = persisted.notes.filter((note) => String(note.kind || "").toLowerCase() === "decision");
    const profiles = Array.isArray(persisted.projectProfiles) ? persisted.projectProfiles : [];
    const profileHistory = Array.isArray(persisted.projectProfileHistory) ? persisted.projectProfileHistory : [];
    const queueSuppressions = Array.isArray(persisted.queueSuppressions) ? persisted.queueSuppressions : [];
    const governanceOperations = Array.isArray(persisted.governanceOperations) ? persisted.governanceOperations : [];
    const taskSeedingCheckpoints = Array.isArray(persisted.taskSeedingCheckpoints) ? persisted.taskSeedingCheckpoints : [];
    const sourceAccessCheckpointSummary = createSourceAccessCheckpointSummary(taskSeedingCheckpoints);
    const deploymentSmokeChecks = Array.isArray(persisted.deploymentSmokeChecks)
      ? normalizeDeploymentSmokeChecks(persisted.deploymentSmokeChecks)
      : [];
    const deploymentSmokeCheckPassCount = deploymentSmokeChecks.filter((item) => toText(item.status) === "pass").length;
    const deploymentSmokeCheckFailCount = deploymentSmokeChecks.filter((item) => toText(item.status) === "fail").length;
    const latestDeploymentSmokeCheck = deploymentSmokeChecks[0] || null;
    const releaseCheckpoints = normalizeReleaseCheckpoints(persisted.releaseCheckpoints);
    const latestReleaseCheckpoint = releaseCheckpoints[0] || null;
    const releaseTaskLedgerSnapshots = Array.isArray(persisted.releaseTaskLedgerSnapshots) ? persisted.releaseTaskLedgerSnapshots : [];
    const agentSessions = Array.isArray(persisted.agentSessions) ? persisted.agentSessions : [];
    const agentControlPlaneSnapshots = Array.isArray(persisted.agentControlPlaneSnapshots) ? persisted.agentControlPlaneSnapshots : [];
    const agentControlPlaneBaselineSnapshotId = toText(persisted.agentControlPlaneBaselineSnapshotId);
    const agentControlPlaneBaselineSnapshot = agentControlPlaneSnapshots.find((snapshot) => toText(snapshot.id) === agentControlPlaneBaselineSnapshotId) || null;
    const agentControlPlaneBaselineFreshness = getAgentControlPlaneBaselineFreshness(agentControlPlaneBaselineSnapshot?.createdAt);
    const agentControlPlaneDecisionSnapshots = Array.isArray(persisted.agentControlPlaneDecisionSnapshots) ? persisted.agentControlPlaneDecisionSnapshots : [];
    const agentPolicyCheckpoints = Array.isArray(persisted.agentPolicyCheckpoints) ? persisted.agentPolicyCheckpoints.map(toControlPlaneRecord) : [];
    const agentPolicyCheckpointSummary = createAgentPolicyCheckpointSummary(agentPolicyCheckpoints);
    const latestAgentPolicyCheckpointByPolicyId = createLatestAgentPolicyCheckpointMap(agentPolicyCheckpoints);
    const agentExecutionResultCheckpoints = Array.isArray(persisted.agentExecutionResultCheckpoints) ? persisted.agentExecutionResultCheckpoints.map(toControlPlaneRecord) : [];
    const agentExecutionResultCheckpointSummary = createAgentExecutionResultCheckpointSummary(agentExecutionResultCheckpoints);
    const latestAgentExecutionResultCheckpointByRunAction = createLatestAgentExecutionResultCheckpointMap(agentExecutionResultCheckpoints);
    const agentWorkOrderSnapshots = Array.isArray(persisted.agentWorkOrderSnapshots) ? persisted.agentWorkOrderSnapshots : [];
    const governanceTaskUpdateLedgerSnapshots = Array.isArray(persisted.governanceTaskUpdateLedgerSnapshots) ? persisted.governanceTaskUpdateLedgerSnapshots : [];
    const dataSourceAccessTaskLedgerSnapshots = Array.isArray(persisted.dataSourceAccessTaskLedgerSnapshots) ? persisted.dataSourceAccessTaskLedgerSnapshots : [];
    const agentControlPlaneDecisionTaskLedgerSnapshots = Array.isArray(persisted.agentControlPlaneDecisionTaskLedgerSnapshots) ? persisted.agentControlPlaneDecisionTaskLedgerSnapshots : [];
    const agentExecutionResultTaskLedgerSnapshots = Array.isArray(persisted.agentExecutionResultTaskLedgerSnapshots) ? persisted.agentExecutionResultTaskLedgerSnapshots : [];
    const convergenceTaskLedgerSnapshots = Array.isArray(persisted.convergenceTaskLedgerSnapshots) ? persisted.convergenceTaskLedgerSnapshots : [];
    const dataSourceAccessValidationEvidence = Array.isArray(persisted.dataSourceAccessValidationEvidence) ? persisted.dataSourceAccessValidationEvidence.map(toControlPlaneRecord) : [];
    const dataSourceAccessValidationEvidenceSnapshots = Array.isArray(persisted.dataSourceAccessValidationEvidenceSnapshots) ? persisted.dataSourceAccessValidationEvidenceSnapshots : [];
    const dataSourceAccessValidationWorkflowSnapshots = Array.isArray(persisted.dataSourceAccessValidationWorkflowSnapshots) ? persisted.dataSourceAccessValidationWorkflowSnapshots : [];
    const agentExecutionSlaLedgerSnapshots = Array.isArray(persisted.agentExecutionSlaLedgerSnapshots) ? persisted.agentExecutionSlaLedgerSnapshots : [];
    const agentWorkOrderRuns = Array.isArray(persisted.agentWorkOrderRuns) ? persisted.agentWorkOrderRuns : [];
    const cliBridgeHandoffs = Array.isArray(persisted.cliBridgeHandoffs) ? persisted.cliBridgeHandoffs.map(toControlPlaneRecord) : [];
    const cliBridgeRunTraceSnapshots = Array.isArray(persisted.cliBridgeRunTraceSnapshots) ? persisted.cliBridgeRunTraceSnapshots : [];
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
    const dataSourcesAccessValidationWorkflow = options.dataSourcesAccessValidationWorkflow && typeof options.dataSourcesAccessValidationWorkflow === "object"
      ? options.dataSourcesAccessValidationWorkflow
      : null;
    const dataSourcesAccessValidationWorkflowSummary = toControlPlaneRecord(dataSourcesAccessValidationWorkflow?.summary);
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
      ...cliBridgeRunTraceSnapshots.map((snapshot) => ({
        projectId: toText(snapshot.projectId),
        kind: "cli-bridge-run-trace-snapshot",
        title: toText(snapshot.title) || "CLI Bridge Run Trace",
        projectName: toText(snapshot.projectName) || "Portfolio",
        status: toText(snapshot.traceDecision) || "review",
        timestamp: toText(snapshot.createdAt),
        detail: `${toNumber(snapshot.relatedHandoffCount)} related CLI bridge handoff(s)`
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
      ...dataSourceAccessValidationWorkflowSnapshots.map((snapshot) => ({
        projectId: "data-sources",
        kind: "data-source-access-validation-workflow-snapshot",
        title: toText(snapshot.title) || "Data Sources Access Validation Workflow",
        projectName: "Data Sources",
        status: "workflow-snapshot",
        timestamp: toText(snapshot.createdAt),
        detail: `${toNumber(snapshot.readyCount)} ready / ${toNumber(snapshot.pendingCount)} pending / ${toNumber(snapshot.blockedCount)} blocked`
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
    const agentExecutionResultCheckpointFocus = [...agentExecutionResultCheckpoints]
      .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())
      .slice(0, 24);
    const agentExecutionSlaLedgerSnapshotFocus = [...agentExecutionSlaLedgerSnapshots]
      .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())
      .slice(0, 24);
    const releaseTaskLedgerSnapshotFocus = [...releaseTaskLedgerSnapshots]
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
    const agentExecutionResultTaskLedgerSnapshotFocus = [...agentExecutionResultTaskLedgerSnapshots]
      .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())
      .slice(0, 24);
    const convergenceTaskLedgerSnapshotFocus = [...convergenceTaskLedgerSnapshots]
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
    const dataSourceAccessValidationWorkflowSnapshotFocus = [...dataSourceAccessValidationWorkflowSnapshots]
      .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())
      .slice(0, 24);
    const dataSourceAccessValidationWorkflowSnapshotDiff = dataSourceAccessValidationWorkflowSnapshotFocus[0] && dataSourcesAccessValidationWorkflow
      ? createSourcesAccessValidationWorkflowSnapshotDiffPayload(toControlPlaneRecord(dataSourceAccessValidationWorkflowSnapshotFocus[0]), dataSourcesAccessValidationWorkflow)
      : createMissingSourcesAccessValidationWorkflowSnapshotDiffPayload();
    const agentWorkOrderRunFocus = [...agentWorkOrderRuns]
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime())
      .slice(0, 24);
    const cliBridgeHandoffSummary = createCliBridgeHandoffSummary(cliBridgeHandoffs);
    const cliBridgeHandoffFocus = [...cliBridgeHandoffs]
      .sort((left, right) => getCliBridgeHandoffReviewRank(left) - getCliBridgeHandoffReviewRank(right) || new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime())
      .slice(0, 24);
    const cliBridgeRunTraceSnapshotFocus = [...cliBridgeRunTraceSnapshots]
      .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())
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

        const readinessItem = {
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
        return {
          ...readinessItem,
          agentPolicy: createAgentPolicyRecommendation(
            readinessItem,
            latestAgentPolicyCheckpointByPolicyId.get(`agent-policy:${projectId}`)
          )
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
    const agentExecutionResultRequirements = createAgentExecutionResultRequirementSummary(
      activeAgentWorkOrderRunCorpus,
      agentExecutionPolicy,
      latestAgentExecutionResultCheckpointByRunAction
    );

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
      taskSeedingCheckpointCount: taskSeedingCheckpoints.length,
      agentPolicyCheckpointCount: agentPolicyCheckpointSummary.total,
      agentPolicyCheckpointApprovedCount: agentPolicyCheckpointSummary.approved,
      agentPolicyCheckpointDeferredCount: agentPolicyCheckpointSummary.deferred,
      agentPolicyCheckpointDismissedCount: agentPolicyCheckpointSummary.dismissed,
      agentPolicyCheckpointNeedsReviewCount: agentPolicyCheckpointSummary.needsReview,
      agentPolicyCheckpointUnresolvedCount: agentPolicyCheckpointSummary.unresolved,
      agentPolicyExecutableCount: agentReadinessMatrix.filter((item) => item.agentPolicy?.executable).length,
      agentExecutionResultCheckpointCount: agentExecutionResultCheckpointSummary.total,
      agentExecutionResultCheckpointApprovedCount: agentExecutionResultCheckpointSummary.approved,
      agentExecutionResultCheckpointDeferredCount: agentExecutionResultCheckpointSummary.deferred,
      agentExecutionResultCheckpointDismissedCount: agentExecutionResultCheckpointSummary.dismissed,
      agentExecutionResultCheckpointNeedsReviewCount: agentExecutionResultCheckpointSummary.needsReview,
      agentExecutionResultCheckpointUnresolvedCount: agentExecutionResultCheckpointSummary.unresolved,
      agentExecutionResultRetryBlockedCount: agentExecutionResultRequirements.retryBlocked,
      agentExecutionResultArchiveBlockedCount: agentExecutionResultRequirements.archiveBlocked,
      agentExecutionResultRetentionBlockedCount: agentExecutionResultRequirements.retentionBlocked,
      agentExecutionResultSlaResolveBlockedCount: agentExecutionResultRequirements.slaResolveBlocked,
      agentExecutionResultBaselineBlockedCount: agentExecutionResultRequirements.baselineBlocked,
      agentExecutionResultCheckpointRequiredCount: agentExecutionResultRequirements.totalBlocked,
      sourceAccessCheckpointCount: sourceAccessCheckpointSummary.total,
      sourceAccessCheckpointApprovedCount: sourceAccessCheckpointSummary.approved,
      sourceAccessCheckpointDeferredCount: sourceAccessCheckpointSummary.deferred,
      sourceAccessCheckpointDismissedCount: sourceAccessCheckpointSummary.dismissed,
      sourceAccessCheckpointNeedsReviewCount: sourceAccessCheckpointSummary.needsReview,
      sourceAccessCheckpointUnresolvedCount: sourceAccessCheckpointSummary.unresolved,
      sourceAccessCheckpointSources: sourceAccessCheckpointSummary.sources,
      sourceAccessCheckpointBySource: sourceAccessCheckpointSummary.bySource,
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
      agentExecutionResultTaskLedgerSnapshotCount: agentExecutionResultTaskLedgerSnapshots.length,
      convergenceTaskLedgerSnapshotCount: convergenceTaskLedgerSnapshots.length,
      dataSourceAccessValidationEvidenceSnapshotCount: dataSourceAccessValidationEvidenceSnapshots.length,
      dataSourceAccessValidationWorkflowSnapshotCount: dataSourceAccessValidationWorkflowSnapshots.length,
      agentExecutionSlaLedgerSnapshotCount: agentExecutionSlaLedgerSnapshots.length,
      agentWorkOrderRunCount: agentWorkOrderRuns.length,
      cliBridgeHandoffCount: cliBridgeHandoffs.length,
      cliBridgeRunTraceSnapshotCount: cliBridgeRunTraceSnapshots.length,
      cliBridgeHandoffProposedCount: cliBridgeHandoffSummary.proposed,
      cliBridgeHandoffAcceptedCount: cliBridgeHandoffSummary.accepted,
      cliBridgeHandoffRejectedCount: cliBridgeHandoffSummary.rejected,
      cliBridgeHandoffNeedsReviewCount: cliBridgeHandoffSummary.needsReview,
      cliBridgeHandoffReviewQueueCount: cliBridgeHandoffSummary.reviewQueue,
      cliBridgeHandoffEscalatedCount: cliBridgeHandoffSummary.escalated,
      governanceExecutionViewCount: governanceExecutionViews.length,
      deploymentSmokeCheckCount: deploymentSmokeChecks.length,
      deploymentSmokeCheckPassCount,
      deploymentSmokeCheckFailCount,
      deploymentLatestSmokeCheckStatus: toText(latestDeploymentSmokeCheck?.status),
      deploymentLatestSmokeCheckAt: toText(latestDeploymentSmokeCheck?.checkedAt),
      deploymentLatestSmokeCheckTarget: toText(latestDeploymentSmokeCheck?.label) || toText(latestDeploymentSmokeCheck?.host),
      releaseCheckpointCount: releaseCheckpoints.length,
      releaseTaskLedgerSnapshotCount: releaseTaskLedgerSnapshots.length,
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
      agentExecutionResultTaskCount: agentExecutionResultTasks.length,
      agentExecutionResultOpenTaskCount: openAgentExecutionResultTasks.length,
      agentExecutionResultClosedTaskCount: agentExecutionResultTasks.length - openAgentExecutionResultTasks.length,
      convergenceTaskCount: convergenceTasks.length,
      convergenceOpenTaskCount: openConvergenceTasks.length,
      convergenceClosedTaskCount: convergenceTasks.length - openConvergenceTasks.length,
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
      dataSourcesAccessValidationWorkflowTotalCount: toNumber(dataSourcesAccessValidationWorkflowSummary.total),
      dataSourcesAccessValidationWorkflowReadyCount: toNumber(dataSourcesAccessValidationWorkflowSummary.ready),
      dataSourcesAccessValidationWorkflowPendingCount: toNumber(dataSourcesAccessValidationWorkflowSummary.pending),
      dataSourcesAccessValidationWorkflowBlockedCount: toNumber(dataSourcesAccessValidationWorkflowSummary.blocked),
      dataSourcesAccessValidationWorkflowMissingEvidenceCount: toNumber(dataSourcesAccessValidationWorkflowSummary.missingEvidence),
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
      dataSourceAccessValidationWorkflowSnapshotHasDrift: Boolean(dataSourceAccessValidationWorkflowSnapshotDiff.hasDrift),
      dataSourceAccessValidationWorkflowSnapshotDriftScore: toNumber(dataSourceAccessValidationWorkflowSnapshotDiff.driftScore),
      dataSourceAccessValidationWorkflowSnapshotDriftSeverity: toText(dataSourceAccessValidationWorkflowSnapshotDiff.driftSeverity) || "missing-snapshot",
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
      { field: "agentPolicyCheckpointCount", label: "Agent Policy Checkpoints" },
      { field: "agentPolicyCheckpointUnresolvedCount", label: "Agent Policy Unresolved Checkpoints" },
      { field: "agentPolicyExecutableCount", label: "Agent Policy Executable Items" },
      { field: "agentExecutionResultCheckpointCount", label: "Execution Result Checkpoints" },
      { field: "agentExecutionResultCheckpointRequiredCount", label: "Execution Result Checkpoint Requirements" },
      { field: "agentExecutionResultBaselineBlockedCount", label: "Baseline Refresh Result Checkpoints" },
      { field: "agentExecutionResultTaskLedgerSnapshotCount", label: "Execution Result Task Ledger Snapshots" },
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
      { field: "releaseTaskLedgerSnapshotCount", label: "Release Task Ledger Snapshots" },
      { field: "releaseBuildGateRank", label: "Release Build Gate Rank" },
      { field: "releaseBuildGateRiskScore", label: "Release Build Gate Risk Score" },
      { field: "releaseBuildGateReasonCount", label: "Release Build Gate Reasons" },
      { field: "releaseBuildGateActionCount", label: "Release Build Gate Actions" },
      { field: "sourceAccessCheckpointUnresolvedCount", label: "Source Access Unresolved Checkpoints" },
      { field: "sourceAccessCheckpointCount", label: "Source Access Checkpoints" },
      { field: "releaseControlTaskCount", label: "Release Control Tasks" },
      { field: "releaseControlOpenTaskCount", label: "Release Control Open Tasks" },
      { field: "agentControlPlaneDecisionTaskCount", label: "Control Plane Decision Tasks" },
      { field: "agentControlPlaneDecisionOpenTaskCount", label: "Control Plane Decision Open Tasks" },
      { field: "convergenceTaskCount", label: "Convergence Review Tasks" },
      { field: "convergenceOpenTaskCount", label: "Convergence Review Open Tasks" },
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
      { field: "dataSourcesAccessValidationWorkflowTotalCount", label: "Data Sources Access Validation Workflow Items" },
      { field: "dataSourcesAccessValidationWorkflowReadyCount", label: "Data Sources Access Validation Workflow Ready" },
      { field: "dataSourcesAccessValidationWorkflowPendingCount", label: "Data Sources Access Validation Workflow Pending" },
      { field: "dataSourcesAccessValidationWorkflowBlockedCount", label: "Data Sources Access Validation Workflow Blocked" },
      { field: "dataSourcesAccessValidationWorkflowMissingEvidenceCount", label: "Data Sources Access Validation Workflow Missing Evidence" },
      { field: "dataSourcesAccessValidationEvidenceCount", label: "Data Sources Access Validation Evidence" },
      { field: "dataSourcesAccessValidationEvidenceValidatedCount", label: "Data Sources Access Validation Evidence Validated" },
      { field: "dataSourcesAccessValidationEvidenceReviewCount", label: "Data Sources Access Validation Evidence Review" },
      { field: "dataSourcesAccessValidationEvidenceBlockedCount", label: "Data Sources Access Validation Evidence Blocked" },
      { field: "dataSourcesAccessValidationEvidenceCoverageMissingCount", label: "Data Sources Access Validation Evidence Coverage Missing" },
      { field: "dataSourcesAccessValidationEvidenceCoverageHighPriorityCount", label: "Data Sources Access Validation Evidence Coverage High Priority" },
      { field: "dataSourcesAccessValidationEvidenceCoveragePercent", label: "Data Sources Access Validation Evidence Coverage Percent" },
      { field: "dataSourceAccessValidationWorkflowSnapshotCount", label: "Data Sources Access Validation Workflow Snapshots" },
      { field: "dataSourceAccessValidationWorkflowSnapshotDriftScore", label: "Data Sources Access Validation Workflow Snapshot Drift Score" },
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
      taskSeedingCheckpoints: [...taskSeedingCheckpoints]
        .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())
        .slice(0, 24),
      agentPolicyCheckpoints: [...agentPolicyCheckpoints]
        .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())
        .slice(0, 24),
      agentExecutionResultCheckpoints: agentExecutionResultCheckpointFocus,
      agentExecutionResultRequirements,
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
      agentExecutionResultTaskLedgerSnapshots: agentExecutionResultTaskLedgerSnapshotFocus,
      convergenceTaskLedgerSnapshots: convergenceTaskLedgerSnapshotFocus,
      agentExecutionSlaLedgerSnapshots: agentExecutionSlaLedgerSnapshotFocus,
      agentWorkOrderRuns: agentWorkOrderRunFocus,
      cliBridgeHandoffs: cliBridgeHandoffFocus,
      cliBridgeRunTraceSnapshots: cliBridgeRunTraceSnapshotFocus,
      agentExecutionSlaLedger,
      agentExecutionMetrics,
      agentExecutionPolicy,
      deploymentSmokeChecks: deploymentSmokeChecks.slice(0, 50),
      releaseCheckpoints: releaseCheckpoints.slice(0, 50),
      releaseTaskLedgerSnapshots: releaseTaskLedgerSnapshotFocus,
      releaseBuildGate,
      releaseControlTasks: releaseControlTaskFocus,
      agentControlPlaneDecisionTasks: agentControlPlaneDecisionTaskFocus,
      agentExecutionResultTasks: agentExecutionResultTaskFocus,
      convergenceTasks: convergenceTaskFocus,
      dataSourcesAccessGate,
      dataSourcesAccessReviewQueue,
      dataSourcesAccessValidationRunbook,
      dataSourcesAccessValidationEvidenceCoverage,
      dataSourcesAccessValidationWorkflow,
      dataSourceAccessValidationEvidence: dataSourceAccessValidationEvidenceFocus,
      dataSourceAccessValidationEvidenceSnapshots: dataSourceAccessValidationEvidenceSnapshotFocus,
      dataSourceAccessValidationEvidenceSnapshotDiff,
      dataSourceAccessValidationWorkflowSnapshots: dataSourceAccessValidationWorkflowSnapshotFocus,
      dataSourceAccessValidationWorkflowSnapshotDiff,
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
        dataSourcesAccessValidationWorkflow,
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
      const agentPolicy = toControlPlaneRecord(item.agentPolicy);
      const skillBundle = toTextList(agentPolicy.skillBundle);
      const hookPolicy = toTextList(agentPolicy.hookPolicy);
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
      lines.push(`- Agent policy checkpoint: ${toText(agentPolicy.checkpointStatus) || "needs-review"} (${toText(agentPolicy.executable) === "true" || agentPolicy.executable === true ? "executable" : "blocked"})`);
      lines.push(`- Managed agent role: ${toText(agentPolicy.role) || "readiness-reviewer"}`);
      lines.push(`- Runtime / isolation: ${toText(agentPolicy.runtime) || "planning-only-agent"} / ${toText(agentPolicy.isolationMode) || "read-only-planning"}`);
      lines.push(`- Skill bundle: ${skillBundle.length ? skillBundle.join(", ") : "project-governance, validation-runner, handoff-pack"}`);
      lines.push(`- Hook policy: ${hookPolicy.length ? hookPolicy.join(", ") : "policy-checkpoint-required, preflight-status-review, post-run-validation-log"}`);
      lines.push(`- Secret policy: ${toText(agentPolicy.secretPolicy) || "Non-secret managed agent policy metadata only."}`);
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
    const dataSourcesAccessValidationWorkflow = payload.dataSourcesAccessValidationWorkflow && typeof payload.dataSourcesAccessValidationWorkflow === "object" ? payload.dataSourcesAccessValidationWorkflow : {};
    const dataSourcesAccessValidationWorkflowSummary = toControlPlaneRecord(dataSourcesAccessValidationWorkflow.summary);
    const dataSourcesAccessValidationWorkflowItems = Array.isArray(dataSourcesAccessValidationWorkflow.items) ? dataSourcesAccessValidationWorkflow.items : [];
    const dataSourcesAccessValidationEvidenceCoverage = payload.dataSourcesAccessValidationEvidenceCoverage && typeof payload.dataSourcesAccessValidationEvidenceCoverage === "object" ? payload.dataSourcesAccessValidationEvidenceCoverage : {};
    const dataSourcesAccessValidationEvidenceCoverageSummary = toControlPlaneRecord(dataSourcesAccessValidationEvidenceCoverage.summary);
    const dataSourcesAccessValidationEvidenceCoverageItems = Array.isArray(dataSourcesAccessValidationEvidenceCoverage.items) ? dataSourcesAccessValidationEvidenceCoverage.items : [];
    const dataSourceAccessValidationEvidence = Array.isArray(payload.dataSourceAccessValidationEvidence) ? payload.dataSourceAccessValidationEvidence : [];
    const dataSourceAccessValidationEvidenceSnapshots = Array.isArray(payload.dataSourceAccessValidationEvidenceSnapshots) ? payload.dataSourceAccessValidationEvidenceSnapshots : [];
    const dataSourceAccessValidationWorkflowSnapshots = Array.isArray(payload.dataSourceAccessValidationWorkflowSnapshots) ? payload.dataSourceAccessValidationWorkflowSnapshots : [];
    const dataSourceAccessValidationWorkflowSnapshotDiff = payload.dataSourceAccessValidationWorkflowSnapshotDiff && typeof payload.dataSourceAccessValidationWorkflowSnapshotDiff === "object" ? payload.dataSourceAccessValidationWorkflowSnapshotDiff : null;
    const baselineDriftItems = Array.isArray(baselineStatus.driftItems) ? baselineStatus.driftItems : [];
    const readiness = Array.isArray(payload.readiness) ? payload.readiness : [];
    const agentSessions = Array.isArray(payload.agentSessions) ? payload.agentSessions : [];
    const executionRuns = Array.isArray(payload.executionRuns) ? payload.executionRuns : [];
    const executionResultCheckpoints = Array.isArray(payload.executionResultCheckpoints) ? payload.executionResultCheckpoints : [];
    const executionResultTasks = Array.isArray(payload.executionResultTasks) ? payload.executionResultTasks : [];
    const executionResultRequirements = payload.executionResultRequirements && typeof payload.executionResultRequirements === "object" ? payload.executionResultRequirements : {};
    const executionResultRequirementItems = Array.isArray(executionResultRequirements.items) ? executionResultRequirements.items : [];
    const deploymentSmokeChecks = Array.isArray(payload.deploymentSmokeChecks) ? payload.deploymentSmokeChecks : [];
    const releaseCheckpoints = Array.isArray(payload.releaseCheckpoints) ? payload.releaseCheckpoints : [];
    const releaseTaskLedgerSnapshots = Array.isArray(payload.releaseTaskLedgerSnapshots) ? payload.releaseTaskLedgerSnapshots : [];
    const releaseControlTasks = Array.isArray(payload.releaseControlTasks) ? payload.releaseControlTasks : [];
    const agentControlPlaneDecisionTasks = Array.isArray(payload.agentControlPlaneDecisionTasks) ? payload.agentControlPlaneDecisionTasks : [];
    const releaseBuildGate = payload.releaseBuildGate && typeof payload.releaseBuildGate === "object" ? payload.releaseBuildGate : {};
    const releaseBuildGateReasons = Array.isArray(releaseBuildGate.reasons) ? releaseBuildGate.reasons : [];
    const releaseBuildGateActions = Array.isArray(releaseBuildGate.actions) ? releaseBuildGate.actions : [];
    const decisionSnapshots = Array.isArray(payload.decisionSnapshots) ? payload.decisionSnapshots : [];
    const governanceTaskUpdateLedgerSnapshots = Array.isArray(payload.governanceTaskUpdateLedgerSnapshots) ? payload.governanceTaskUpdateLedgerSnapshots : [];
    const decisionTaskLedgerSnapshots = Array.isArray(payload.agentControlPlaneDecisionTaskLedgerSnapshots) ? payload.agentControlPlaneDecisionTaskLedgerSnapshots : [];
    const executionResultTaskLedgerSnapshots = Array.isArray(payload.agentExecutionResultTaskLedgerSnapshots) ? payload.agentExecutionResultTaskLedgerSnapshots : [];
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
      `- Agent policy checkpoints: ${toNumber(summary.agentPolicyCheckpointUnresolvedCount)} unresolved / ${toNumber(summary.agentPolicyCheckpointCount)} total`,
      `- Agent policy executable work orders: ${toNumber(summary.agentPolicyExecutableCount)}/${toNumber(summary.agentReadinessItems)}`,
      `- Execution result checkpoints: ${toNumber(summary.agentExecutionResultCheckpointUnresolvedCount)} unresolved / ${toNumber(summary.agentExecutionResultCheckpointCount)} total`,
      `- Execution result gates: ${toNumber(summary.agentExecutionResultCheckpointRequiredCount)} pending (${toNumber(summary.agentExecutionResultBaselineBlockedCount)} baseline-refresh blocker(s))`,
      `- Execution result tasks: ${toNumber(summary.agentExecutionResultOpenTaskCount)} open / ${toNumber(summary.agentExecutionResultTaskCount)} total`,
      `- Work order snapshots: ${toNumber(summary.agentWorkOrderSnapshotCount)}`,
      `- Decision snapshots: ${toNumber(summary.agentControlPlaneDecisionSnapshotCount)}`,
      `- Execution runs: ${toNumber(summary.activeAgentWorkOrderRunCount)}/${toNumber(summary.agentWorkOrderRunCount)} active/total`,
      `- SLA ledger records: ${toNumber(summary.agentExecutionSlaLedgerCount)}`,
      `- SLA ledger snapshots: ${toNumber(summary.agentExecutionSlaLedgerSnapshotCount)}`,
      `- Deployment smoke checks: ${toNumber(summary.deploymentSmokeCheckPassCount)} pass / ${toNumber(summary.deploymentSmokeCheckFailCount)} fail / ${toNumber(summary.deploymentSmokeCheckCount)} total`,
      `- Release checkpoints: ${toNumber(summary.releaseCheckpointCount)}`,
      `- Release task ledger snapshots: ${toNumber(summary.releaseTaskLedgerSnapshotCount)}`,
      `- Release build gate: ${toText(releaseBuildGate.decision) || toText(summary.releaseBuildGateDecision) || "not-evaluated"} (risk ${toNumber(releaseBuildGate.riskScore || summary.releaseBuildGateRiskScore)})`,
      `- Release build action: ${toText(releaseBuildGate.recommendedAction) || "Evaluate release build gate evidence before the next supervised build."}`,
      `- Release Control tasks: ${toNumber(summary.releaseControlOpenTaskCount)} open / ${toNumber(summary.releaseControlTaskCount)} total`,
      `- Control Plane decision tasks: ${toNumber(summary.agentControlPlaneDecisionOpenTaskCount)} open / ${toNumber(summary.agentControlPlaneDecisionTaskCount)} total`,
      `- Governance task update audit ledger snapshots: ${toNumber(summary.governanceTaskUpdateLedgerSnapshotCount)}`,
      `- Control Plane decision task ledger snapshots: ${toNumber(summary.agentControlPlaneDecisionTaskLedgerSnapshotCount)}`,
      `- Execution result task ledger snapshots: ${toNumber(summary.agentExecutionResultTaskLedgerSnapshotCount)}`,
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
      `- Data Sources access validation workflow: ${toNumber(dataSourcesAccessValidationWorkflowSummary.ready || summary.dataSourcesAccessValidationWorkflowReadyCount)} ready / ${toNumber(dataSourcesAccessValidationWorkflowSummary.pending || summary.dataSourcesAccessValidationWorkflowPendingCount)} pending / ${toNumber(dataSourcesAccessValidationWorkflowSummary.blocked || summary.dataSourcesAccessValidationWorkflowBlockedCount)} blocked`,
      `- Data Sources access validation workflow snapshots: ${toNumber(summary.dataSourceAccessValidationWorkflowSnapshotCount)}`,
      `- Data Sources access validation workflow snapshot drift: ${toText(summary.dataSourceAccessValidationWorkflowSnapshotDriftSeverity) || "missing-snapshot"} / score ${toNumber(summary.dataSourceAccessValidationWorkflowSnapshotDriftScore)}`,
      `- Data Sources access validation evidence: ${toNumber(summary.dataSourcesAccessValidationEvidenceValidatedCount)} validated / ${toNumber(summary.dataSourcesAccessValidationEvidenceCount)} total`,
      `- Data Sources access validation evidence coverage: ${toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.covered || summary.dataSourcesAccessValidationEvidenceCoverageCoveredCount)} covered / ${toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.sourceCount || summary.dataSourcesAccessValidationEvidenceCoverageCount)} source(s) (${toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.coveragePercent || summary.dataSourcesAccessValidationEvidenceCoveragePercent)}%)`,
      `- Data Sources access validation evidence coverage gaps: ${toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.missing || summary.dataSourcesAccessValidationEvidenceCoverageMissingCount)} missing / ${toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.highPriority || summary.dataSourcesAccessValidationEvidenceCoverageHighPriorityCount)} high priority`,
      `- Source-access checkpoints: ${toNumber(summary.sourceAccessCheckpointUnresolvedCount)} unresolved / ${toNumber(summary.sourceAccessCheckpointCount)} total across ${toNumber(summary.sourceAccessCheckpointSources)} source(s)`,
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

    lines.push("", "## Data Sources Access Validation Workflow");
    if (dataSourcesAccessValidationWorkflowItems.length) {
      for (const item of dataSourcesAccessValidationWorkflowItems.slice(0, 10)) {
        const record = toControlPlaneRecord(item);
        lines.push(`- ${toText(record.priority) || "medium"} ${toText(record.status) || "pending"}: ${toText(record.label) || toText(record.sourceId) || "Source"} (${toText(record.accessMethod) || "review-required"})`);
        lines.push(`  Stage: ${toText(record.stage) || "external-access-review"} | Evidence: ${toText(record.latestEvidenceStatus) || "missing"}`);
      }
    } else {
      lines.push("- No Data Sources access validation workflow items.");
    }

    lines.push("", "## Data Sources Access Validation Workflow Snapshots");
    if (dataSourceAccessValidationWorkflowSnapshots.length) {
      for (const snapshot of dataSourceAccessValidationWorkflowSnapshots.slice(0, 10)) {
        const record = toControlPlaneRecord(snapshot);
        lines.push(`- ${toText(record.title) || "Data Sources Access Validation Workflow"}: ${toNumber(record.readyCount)} ready / ${toNumber(record.pendingCount)} pending / ${toNumber(record.blockedCount)} blocked`);
      }
    } else {
      lines.push("- No Data Sources access validation workflow snapshots available.");
    }

    lines.push("", "## Data Sources Access Validation Workflow Snapshot Drift");
    if (dataSourceAccessValidationWorkflowSnapshotDiff) {
      lines.push(`- Snapshot: ${toText(dataSourceAccessValidationWorkflowSnapshotDiff.snapshotTitle) || "missing"}`);
      lines.push(`- Drift severity: ${toText(dataSourceAccessValidationWorkflowSnapshotDiff.driftSeverity) || "missing-snapshot"}`);
      lines.push(`- Drift score: ${toNumber(dataSourceAccessValidationWorkflowSnapshotDiff.driftScore)}`);
      lines.push(`- Recommended action: ${toText(dataSourceAccessValidationWorkflowSnapshotDiff.recommendedAction) || "Save a source-access validation workflow snapshot before comparing drift."}`);
    } else {
      lines.push("- No Data Sources access validation workflow snapshot drift available.");
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

    lines.push("", "## Release Task Ledger Snapshots");
    if (releaseTaskLedgerSnapshots.length) {
      for (const snapshot of releaseTaskLedgerSnapshots.slice(0, 10)) {
        const record = toControlPlaneRecord(snapshot);
        lines.push(`- ${toText(record.title) || "Release Control Task Ledger"}: ${toNumber(record.openCount)} open / ${toNumber(record.total)} total at ${toText(record.createdAt) || "not recorded"}`);
      }
    } else {
      lines.push("- No Release Control task ledger snapshots available.");
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

    lines.push("", "## Governance Task Update Audit Ledger Snapshots");
    if (governanceTaskUpdateLedgerSnapshots.length) {
      for (const snapshot of governanceTaskUpdateLedgerSnapshots.slice(0, 10)) {
        const record = toControlPlaneRecord(snapshot);
        lines.push(`- ${toText(record.title) || "Governance Task Update Ledger"}: ${toNumber(record.statusChangeCount)} status change(s) / ${toNumber(record.total)} total at ${toText(record.createdAt) || "not recorded"}`);
      }
    } else {
      lines.push("- No Governance task update audit ledger snapshots available.");
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

    lines.push("", "## Execution Result Task Ledger Snapshots");
    if (executionResultTaskLedgerSnapshots.length) {
      for (const snapshot of executionResultTaskLedgerSnapshots.slice(0, 10)) {
        const record = toControlPlaneRecord(snapshot);
        lines.push(`- ${toText(record.title) || "Agent Execution Result Task Ledger"}: ${toNumber(record.openCount)} open / ${toNumber(record.total)} total at ${toText(record.createdAt) || "not recorded"}`);
      }
    } else {
      lines.push("- No execution-result task ledger snapshots available.");
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

    lines.push("", "## Execution Result Checkpoints");
    if (executionResultRequirementItems.length) {
      lines.push("- Pending gates:");
      for (const item of executionResultRequirementItems.slice(0, 10)) {
        const record = toControlPlaneRecord(item);
        lines.push(`  - ${toText(record.projectName) || "Project"}: ${toText(record.targetAction) || "review"} for ${toText(record.runStatus) || "execution"} (${toText(record.checkpointStatus) || "needs-review"})`);
      }
    } else {
      lines.push("- No pending execution-result gates.");
    }
    if (executionResultCheckpoints.length) {
      lines.push("- Recent checkpoints:");
      for (const checkpoint of executionResultCheckpoints.slice(0, 10)) {
        const record = toControlPlaneRecord(checkpoint);
        lines.push(`  - ${toText(record.projectName) || "Project"}: ${toText(record.targetAction) || "review"} ${toText(record.status) || "needs-review"}`);
      }
    } else {
      lines.push("- No saved execution-result checkpoints available.");
    }

    lines.push("", "## Execution Result Follow-up Tasks");
    if (executionResultTasks.length) {
      for (const task of executionResultTasks.slice(0, 10)) {
        const record = toControlPlaneRecord(task);
        lines.push(`- ${toText(record.priority) || "normal"} ${toText(record.status) || "open"}: ${toText(record.title) || "Execution result task"}`);
        lines.push(`  Run: ${toText(record.agentExecutionResultRunId) || "unknown"} | Action: ${toText(record.agentExecutionResultTargetAction) || "review"} | Checkpoint: ${toText(record.agentExecutionResultCheckpointStatus) || "deferred"}`);
      }
    } else {
      lines.push("- No execution-result follow-up tasks available.");
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
   * @param {{ limit?: number, dataSourcesAccessGate?: Record<string, unknown> | null, dataSourcesAccessReviewQueue?: Record<string, unknown> | null, dataSourcesAccessValidationRunbook?: Record<string, unknown> | null, dataSourcesAccessValidationWorkflow?: Record<string, unknown> | null, releaseBuildGate?: Record<string, unknown> | null }} options
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
      dataSourcesAccessValidationWorkflow: options.dataSourcesAccessValidationWorkflow || governance.dataSourcesAccessValidationWorkflow || null,
      dataSourcesAccessValidationEvidenceCoverage: governance.dataSourcesAccessValidationEvidenceCoverage || null,
      dataSourceAccessValidationEvidence: (Array.isArray(governance.dataSourceAccessValidationEvidence) ? governance.dataSourceAccessValidationEvidence : []).slice(0, limit),
      dataSourceAccessValidationEvidenceSnapshots: (Array.isArray(governance.dataSourceAccessValidationEvidenceSnapshots) ? governance.dataSourceAccessValidationEvidenceSnapshots : []).slice(0, limit),
      dataSourceAccessValidationWorkflowSnapshots: (Array.isArray(governance.dataSourceAccessValidationWorkflowSnapshots) ? governance.dataSourceAccessValidationWorkflowSnapshots : []).slice(0, limit),
      dataSourceAccessValidationWorkflowSnapshotDiff: governance.dataSourceAccessValidationWorkflowSnapshotDiff || null,
      readiness: (Array.isArray(governance.agentReadinessMatrix) ? governance.agentReadinessMatrix : []).slice(0, limit),
      agentSessions: (Array.isArray(governance.agentSessions) ? governance.agentSessions : []).slice(0, limit),
      deploymentSmokeChecks: (Array.isArray(governance.deploymentSmokeChecks) ? governance.deploymentSmokeChecks : []).slice(0, limit),
      releaseCheckpoints: (Array.isArray(governance.releaseCheckpoints) ? governance.releaseCheckpoints : []).slice(0, limit),
      releaseTaskLedgerSnapshots: (Array.isArray(governance.releaseTaskLedgerSnapshots) ? governance.releaseTaskLedgerSnapshots : []).slice(0, limit),
      releaseControlTasks: (Array.isArray(governance.releaseControlTasks) ? governance.releaseControlTasks : []).slice(0, limit),
      agentControlPlaneDecisionTasks: (Array.isArray(governance.agentControlPlaneDecisionTasks) ? governance.agentControlPlaneDecisionTasks : []).slice(0, limit),
      governanceTaskUpdateLedgerSnapshots: (Array.isArray(governance.governanceTaskUpdateLedgerSnapshots) ? governance.governanceTaskUpdateLedgerSnapshots : []).slice(0, limit),
      agentControlPlaneDecisionTaskLedgerSnapshots: (Array.isArray(governance.agentControlPlaneDecisionTaskLedgerSnapshots) ? governance.agentControlPlaneDecisionTaskLedgerSnapshots : []).slice(0, limit),
      agentExecutionResultTaskLedgerSnapshots: (Array.isArray(governance.agentExecutionResultTaskLedgerSnapshots) ? governance.agentExecutionResultTaskLedgerSnapshots : []).slice(0, limit),
      workOrders,
      executionRuns: (Array.isArray(governance.agentWorkOrderRuns) ? governance.agentWorkOrderRuns : []).slice(0, limit),
      executionResultCheckpoints: (Array.isArray(governance.agentExecutionResultCheckpoints) ? governance.agentExecutionResultCheckpoints : []).slice(0, limit),
      executionResultTasks: (Array.isArray(governance.agentExecutionResultTasks) ? governance.agentExecutionResultTasks : []).slice(0, limit),
      executionResultRequirements: governance.agentExecutionResultRequirements || null,
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
  function buildCliBridgeContextMarkdown(payload) {
    const bridgeDecision = toText(payload.bridgeDecision) || "review";
    const adapters = Array.isArray(payload.adapters) ? payload.adapters : [];
    const workOrders = payload.workOrders && typeof payload.workOrders === "object" ? payload.workOrders : {};
    const items = Array.isArray(workOrders.items) ? workOrders.items : [];
    const reasons = Array.isArray(payload.reasons) ? payload.reasons : [];
    const handoffContract = payload.handoffContract && typeof payload.handoffContract === "object" ? payload.handoffContract : {};
    const validationLoop = Array.isArray(payload.validationLoop) ? payload.validationLoop : [];
    const lines = [
      "# CLI Bridge Context Pack",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Bridge decision: ${bridgeDecision}`,
      `Runner filter: ${toText(payload.runner) || "all"}`,
      `Execution mode: ${toText(payload.executionMode) || "non-executing"}`,
      `Secret policy: ${toText(payload.secretPolicy) || "No secrets."}`,
      "",
      "## Broker Rule",
      "- Workspace Audit Pro owns work-order creation, context sanitization, runner selection, validation, relaunch, result capture, and follow-up handoff decisions.",
      "- Codex CLI and Claude CLI should not free-chat directly. Each runner receives a bounded work order from this context pack and returns a constrained result to the app.",
      "",
      "## Adapter Guidance"
    ];

    for (const adapter of adapters) {
      const record = toControlPlaneRecord(adapter);
      lines.push(`- ${toText(record.label) || toText(record.id) || "Runner"}: ${toText(record.method) || "adapter"}`);
      lines.push(`  Purpose: ${toText(record.purpose) || "bounded agent work"}`);
      lines.push(`  Command pattern: ${toText(record.commandPattern) || "SDK preferred"}`);
    }
    if (!adapters.length) {
      lines.push("- No runner adapters matched the requested filter.");
    }

    lines.push("", "## Readiness Reasons");
    if (reasons.length) {
      for (const reason of reasons) {
        const record = toControlPlaneRecord(reason);
        lines.push(`- ${toText(record.severity) || "review"}: ${toText(record.message) || toText(record.code) || "Review required."}`);
      }
    } else {
      lines.push("- No bridge blockers detected.");
    }

    lines.push("", "## Work Orders");
    if (items.length) {
      for (const item of items) {
        const agentPolicy = toControlPlaneRecord(item.agentPolicy);
        lines.push(`- ${toText(item.projectName) || "Project"}: ${toText(item.status) || "needs-prep"} (${toNumber(item.score)}/100)`);
        lines.push(`  Objective: ${toText(item.nextStep) || "Review readiness and define the next execution step."}`);
        lines.push(`  Runtime: ${toText(agentPolicy.runtime) || "planning-only-agent"} | Role: ${toText(agentPolicy.role) || "readiness-reviewer"} | Executable: ${agentPolicy.executable === true ? "yes" : "no"}`);
      }
    } else {
      lines.push("- No work orders matched this bridge context.");
    }

    lines.push("", "## Handoff Contract");
    for (const [key, value] of Object.entries(handoffContract)) {
      if (Array.isArray(value)) {
        lines.push(`- ${key}: ${value.map(toText).filter(Boolean).join("; ") || "none"}`);
      } else {
        lines.push(`- ${key}: ${toText(value) || "none"}`);
      }
    }

    lines.push("", "## Validation Loop");
    if (validationLoop.length) {
      for (const step of validationLoop) {
        lines.push(`- ${toText(step)}`);
      }
    } else {
      lines.push("- Run syntax checks, tests, build checks, local smoke checks, relaunch, milestone note, commit, and optional push before the next handoff.");
    }

    return lines.join("\n");
  }

  /**
   * @param {string} value
   */
  function normalizeCliBridgeRunner(value) {
    const runner = toText(value).toLowerCase();
    return ["all", "codex", "claude"].includes(runner) ? runner : "all";
  }

  /**
   * @param {unknown} value
   */
  function normalizeCliBridgeHandoffRunner(value) {
    const runner = toText(value).toLowerCase();
    return ["codex", "claude", "operator", "workspace-audit"].includes(runner) ? runner : "operator";
  }

  /**
   * @param {unknown} value
   */
  function normalizeCliBridgeHandoffStatus(value) {
    const status = toText(value).toLowerCase();
    return ["proposed", "accepted", "rejected", "needs-review"].includes(status) ? status : "needs-review";
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function createCliBridgeHandoffRecord(payload) {
    const sourceRunner = normalizeCliBridgeHandoffRunner(payload.sourceRunner);
    const targetRunner = normalizeCliBridgeHandoffRunner(payload.targetRunner);
    const summary = toText(payload.summary);
    if (!summary) {
      throw new Error("summary is required");
    }
    const now = new Date().toISOString();
    return {
      id: createId("cli-bridge-handoff"),
      sourceRunner,
      targetRunner,
      status: normalizeCliBridgeHandoffStatus(payload.status),
      resultType: toText(payload.resultType) || "handoff",
      projectId: toText(payload.projectId),
      projectName: toText(payload.projectName),
      workOrderRunId: toText(payload.workOrderRunId),
      title: toText(payload.title) || `${sourceRunner} to ${targetRunner} handoff`,
      summary,
      changedFiles: toTextList(payload.changedFiles).slice(0, 50),
      validationSummary: toText(payload.validationSummary),
      nextAction: toText(payload.nextAction) || "Review this handoff before creating a follow-up work order.",
      notes: toText(payload.notes),
      secretPolicy: "Non-secret CLI bridge handoff metadata only. Do not store passwords, tokens, certificates, private keys, cookies, browser sessions, or raw command output containing secrets.",
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * @param {unknown} value
   */
  function normalizeCliBridgeRunnerResultStatus(value) {
    const status = toText(value).toLowerCase();
    return ["ready", "changed", "blocked", "failed", "needs-review"].includes(status) ? status : "needs-review";
  }

  /**
   * @param {unknown} value
   */
  function normalizeCliBridgeHandoffRecommendation(value) {
    const recommendation = toText(value).toLowerCase();
    if (["codex", "claude", "operator", "workspace-audit"].includes(recommendation)) {
      return recommendation;
    }
    return "workspace-audit";
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {Record<string, unknown>} payload
   */
  function createCliBridgeRunnerResultHandoffRecord(persisted, payload) {
    const runner = normalizeCliBridgeTargetRunner(payload.runner || payload.sourceRunner || "codex");
    const resultStatus = normalizeCliBridgeRunnerResultStatus(payload.status || payload.resultStatus);
    const handoffRecommendation = normalizeCliBridgeHandoffRecommendation(payload.handoffRecommendation || payload.nextRunner);
    const workOrderRunId = toText(payload.workOrderRunId || payload.runId);
    const runs = Array.isArray(persisted.agentWorkOrderRuns) ? persisted.agentWorkOrderRuns.map(toControlPlaneRecord) : [];
    const run = workOrderRunId ? runs.find((item) => toText(item.id) === workOrderRunId) || {} : {};
    const summary = toText(payload.summary);
    if (!summary) {
      throw new Error("summary is required");
    }
    const blockers = toTextList(payload.blockers);
    const validationSummary = toText(payload.validationResults || payload.validationSummary) || (blockers.length ? `Blocked: ${blockers.join(", ")}` : "Validation not recorded.");
    const handoff = createCliBridgeHandoffRecord({
      sourceRunner: runner,
      targetRunner: handoffRecommendation,
      status: resultStatus === "failed" || resultStatus === "blocked" ? "needs-review" : "proposed",
      resultType: `runner-result:${resultStatus}`,
      projectId: toText(payload.projectId) || toText(run.projectId),
      projectName: toText(payload.projectName) || toText(run.projectName),
      workOrderRunId,
      title: toText(payload.title) || `${runner} runner result for ${toText(run.projectName) || toText(payload.projectName) || "Workspace Audit"}`,
      summary,
      changedFiles: toTextList(payload.changedFiles),
      validationSummary,
      nextAction: toText(payload.nextAction) || "Review this runner result before accepting changes or creating a follow-up work order.",
      notes: blockers.length ? `Blockers: ${blockers.join(", ")}` : toText(payload.notes)
    });
    return {
      ...handoff,
      resultStatus,
      handoffRecommendation,
      blockers
    };
  }

  /**
   * @param {unknown} value
   */
  function normalizeCliBridgeHandoffReviewAction(value) {
    const action = toText(value).toLowerCase();
    return ["accept", "reject", "escalate", "needs-review"].includes(action) ? action : "needs-review";
  }

  /**
   * @param {Record<string, unknown>} handoff
   * @param {string} action
   * @param {string} note
   */
  function createCliBridgeHandoffReviewTask(handoff, action, note) {
    const now = new Date().toISOString();
    return {
      id: createId("task"),
      projectId: toText(handoff.projectId) || undefined,
      projectName: toText(handoff.projectName) || undefined,
      title: `Review CLI handoff: ${toText(handoff.title) || toText(handoff.id) || "Runner result"}`,
      description: [
        `Review ${toText(handoff.sourceRunner) || "runner"} to ${toText(handoff.targetRunner) || "operator"} CLI bridge handoff.`,
        `Action: ${action}.`,
        `Summary: ${toText(handoff.summary) || "No summary recorded."}`,
        `Validation: ${toText(handoff.validationSummary) || "Validation not recorded."}`,
        note ? `Operator note: ${note}` : ""
      ].filter(Boolean).join("\n"),
      priority: action === "escalate" ? "high" : "medium",
      status: "open",
      cliBridgeHandoffId: toText(handoff.id),
      cliBridgeHandoffAction: action,
      cliBridgeHandoffStatus: toText(handoff.status) || "needs-review",
      secretPolicy: "Non-secret CLI bridge handoff review task. Do not store credentials, private keys, certificates, tokens, cookies, browser sessions, or raw secret-bearing command output.",
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * @param {unknown} value
   */
  function normalizeCliBridgeHandoffLedgerStatus(value) {
    const status = toText(value).toLowerCase();
    return ["all", "proposed", "accepted", "rejected", "needs-review"].includes(status) ? status : "all";
  }

  /**
   * @param {Record<string, unknown>} handoff
   */
  function getCliBridgeHandoffReviewRank(handoff) {
    const status = toText(handoff.status) || "needs-review";
    if (status === "needs-review" || status === "proposed" || toText(handoff.reviewAction) === "escalate") return 0;
    if (status === "accepted") return 1;
    if (status === "rejected") return 2;
    return 3;
  }

  /**
   * @param {Array<Record<string, unknown>>} handoffs
   */
  function createCliBridgeHandoffSummary(handoffs) {
    const summary = {
      total: handoffs.length,
      proposed: 0,
      accepted: 0,
      rejected: 0,
      needsReview: 0,
      reviewQueue: 0,
      escalated: 0,
      runnerResult: 0
    };

    for (const handoff of handoffs) {
      const status = normalizeCliBridgeHandoffStatus(handoff.status);
      if (status === "proposed") summary.proposed += 1;
      if (status === "accepted") summary.accepted += 1;
      if (status === "rejected") summary.rejected += 1;
      if (status === "needs-review") summary.needsReview += 1;
      if (status === "proposed" || status === "needs-review") summary.reviewQueue += 1;
      if (toText(handoff.reviewAction) === "escalate") summary.escalated += 1;
      if (toText(handoff.resultType).startsWith("runner-result:")) summary.runnerResult += 1;
    }

    return summary;
  }

  /**
   * @param {Array<Record<string, unknown>>} items
   * @param {{ runner?: string, status?: string, limit?: number, summary?: Record<string, unknown> }} [options]
   */
  function buildCliBridgeHandoffLedgerMarkdown(items, options = {}) {
    const runner = normalizeCliBridgeRunner(options.runner || "all");
    const status = normalizeCliBridgeHandoffLedgerStatus(options.status || "all");
    const summary = toControlPlaneRecord(options.summary);
    const lines = [
      "# CLI Bridge Handoff Ledger",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Runner filter: ${runner}`,
      `Status filter: ${status}`,
      "Secret policy: Non-secret CLI bridge handoff metadata only. Do not store passwords, tokens, certificates, private keys, cookies, browser sessions, or raw command output containing secrets.",
      "",
      "Use this ledger as the app-owned mailbox between Codex CLI, Claude CLI, and the operator. Runners should not free-chat directly.",
      ""
    ];
    lines.push("## Review Queue Summary");
    lines.push(`- Total: ${toNumber(summary.total)}`);
    lines.push(`- Review queue: ${toNumber(summary.reviewQueue)}`);
    lines.push(`- Proposed: ${toNumber(summary.proposed)}`);
    lines.push(`- Needs review: ${toNumber(summary.needsReview)}`);
    lines.push(`- Accepted: ${toNumber(summary.accepted)}`);
    lines.push(`- Rejected: ${toNumber(summary.rejected)}`);
    lines.push(`- Escalated: ${toNumber(summary.escalated)}`);
    lines.push(`- Runner results: ${toNumber(summary.runnerResult)}`);
    lines.push("");

    if (!items.length) {
      lines.push("No CLI bridge handoffs matched this filter.");
      return lines.join("\n");
    }

    for (const item of items) {
      const record = toControlPlaneRecord(item);
      const changedFiles = toTextList(record.changedFiles);
      lines.push(`## ${toText(record.title) || "CLI Bridge Handoff"}`);
      lines.push("");
      lines.push(`- Handoff ID: ${toText(record.id) || "unknown"}`);
      lines.push(`- Source runner: ${toText(record.sourceRunner) || "operator"}`);
      lines.push(`- Target runner: ${toText(record.targetRunner) || "operator"}`);
      lines.push(`- Status: ${toText(record.status) || "needs-review"}`);
      lines.push(`- Result type: ${toText(record.resultType) || "handoff"}`);
      lines.push(`- Project: ${toText(record.projectName) || toText(record.projectId) || "portfolio"}`);
      lines.push(`- Work order run: ${toText(record.workOrderRunId) || "not linked"}`);
      lines.push(`- Summary: ${toText(record.summary) || "No summary recorded."}`);
      lines.push(`- Validation: ${toText(record.validationSummary) || "not recorded"}`);
      lines.push(`- Changed files: ${changedFiles.length ? changedFiles.join(", ") : "none recorded"}`);
      lines.push(`- Next action: ${toText(record.nextAction) || "Review before creating a follow-up work order."}`);
      lines.push(`- Updated: ${toText(record.updatedAt) || toText(record.createdAt) || "unknown"}`);
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {{ runner?: string, status?: string, limit?: number }} options
   */
  function createCliBridgeHandoffLedgerPayload(persisted, options = {}) {
    const runner = normalizeCliBridgeRunner(options.runner || "all");
    const status = normalizeCliBridgeHandoffLedgerStatus(options.status || "all");
    const requestedLimit = Number(options.limit || 50);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(100, Math.trunc(requestedLimit)))
      : 50;
    const handoffs = Array.isArray(persisted.cliBridgeHandoffs) ? persisted.cliBridgeHandoffs.map(toControlPlaneRecord) : [];
    const runnerFiltered = runner === "all"
      ? handoffs
      : handoffs.filter((handoff) => toText(handoff.sourceRunner) === runner || toText(handoff.targetRunner) === runner);
    const filtered = status === "all"
      ? runnerFiltered
      : runnerFiltered.filter((handoff) => normalizeCliBridgeHandoffStatus(handoff.status) === status);
    const summary = createCliBridgeHandoffSummary(runnerFiltered);
    const items = filtered
      .sort((left, right) => getCliBridgeHandoffReviewRank(left) - getCliBridgeHandoffReviewRank(right) || new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime())
      .slice(0, limit);

    return {
      generatedAt: new Date().toISOString(),
      runner,
      status,
      limit,
      total: filtered.length,
      available: runnerFiltered.length,
      visible: items.length,
      summary,
      secretPolicy: "Non-secret CLI bridge handoff metadata only. Do not store passwords, tokens, certificates, private keys, cookies, browser sessions, or raw command output containing secrets.",
      items,
      markdown: buildCliBridgeHandoffLedgerMarkdown(items, { runner, status, limit, summary })
    };
  }

  /**
   * @param {ReturnType<typeof buildGovernanceSnapshot>} governance
   * @param {{ runner?: string, status?: string, limit?: number, dataSourcesAccessGate?: Record<string, unknown> | null, dataSourcesAccessReviewQueue?: Record<string, unknown> | null, dataSourcesAccessValidationRunbook?: Record<string, unknown> | null, dataSourcesAccessValidationWorkflow?: Record<string, unknown> | null, releaseBuildGate?: Record<string, unknown> | null }} options
   */
  function createCliBridgeContextPayload(governance, options = {}) {
    const runner = normalizeCliBridgeRunner(options.runner || "all");
    const requestedLimit = Number(options.limit || 12);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(50, Math.trunc(requestedLimit)))
      : 12;
    const status = toText(options.status || "all") || "all";
    const workOrders = createAgentWorkOrdersPayload(governance, { status, limit });
    const controlPlaneDecision = createAgentControlPlaneDecisionPayload(governance, {
      dataSourcesAccessGate: options.dataSourcesAccessGate || null,
      dataSourcesAccessReviewQueue: options.dataSourcesAccessReviewQueue || null,
      dataSourcesAccessValidationRunbook: options.dataSourcesAccessValidationRunbook || null,
      dataSourcesAccessValidationWorkflow: options.dataSourcesAccessValidationWorkflow || null,
      releaseBuildGate: options.releaseBuildGate || null
    });
    const workOrderItems = Array.isArray(workOrders.items) ? workOrders.items : [];
    const executableWorkOrderCount = workOrderItems.filter((item) => {
      const agentPolicy = toControlPlaneRecord(item.agentPolicy);
      return agentPolicy.executable === true || toText(agentPolicy.executable) === "true";
    }).length;
    const reasons = (Array.isArray(controlPlaneDecision.reasons) ? controlPlaneDecision.reasons : []).map(toControlPlaneRecord);
    if (!workOrderItems.length) {
      reasons.push({
        severity: "review",
        code: "cli-bridge-no-work-orders",
        message: "No work orders are available for the requested CLI bridge context."
      });
    } else if (executableWorkOrderCount === 0) {
      reasons.push({
        severity: "review",
        code: "cli-bridge-no-executable-work-orders",
        message: "No work orders have approved executable managed-agent policy checkpoints."
      });
    }
    const bridgeDecision = reasons.some((reason) => toText(reason.severity) === "hold")
      ? "hold"
      : reasons.length
        ? "review"
        : "ready";
    const adapterCatalog = [
      {
        id: "codex",
        label: "Codex CLI",
        method: "Codex SDK preferred; codex exec fallback for bounded non-interactive slices.",
        purpose: "Repository-aware implementation, refactors, tests, and validation fixes.",
        commandPattern: "codex exec <sanitized-work-order>",
        outputExpectation: "Structured implementation summary, changed files, validation results, blockers, and next handoff recommendation.",
        executionPolicy: "Not executed by this endpoint."
      },
      {
        id: "claude",
        label: "Claude CLI",
        method: "Claude Code SDK preferred; claude -p fallback with JSON or stream-json output and allowed-tool restrictions.",
        purpose: "Planning, large-context review, documentation, alternate-agent verification, and implementation slices when policy allows.",
        commandPattern: "claude -p <sanitized-work-order> --output-format json",
        outputExpectation: "Structured plan or result summary, changed files if any, validation recommendations, blockers, and next handoff recommendation.",
        executionPolicy: "Not executed by this endpoint."
      }
    ];
    const adapters = runner === "all"
      ? adapterCatalog
      : adapterCatalog.filter((adapter) => adapter.id === runner);
    const payload = {
      generatedAt: new Date().toISOString(),
      protocolVersion: "cli-bridge-context.v1",
      bridgeMode: "workspace-audit-work-order-broker",
      executionMode: "non-executing",
      runner,
      status,
      limit,
      bridgeDecision,
      recommendedAction: bridgeDecision === "ready"
        ? "Start a supervised dry run from one approved work order, then validate and record the result before any cross-runner handoff."
        : reasons.find((reason) => toText(reason.severity) === "hold")?.message || reasons[0]?.message || "Review bridge context before running external CLI adapters.",
      secretPolicy: "Non-secret CLI bridge context only. Do not include passwords, tokens, certificates, private keys, cookies, browser sessions, or raw command output containing secrets.",
      reasons,
      adapters,
      workOrders,
      executableWorkOrderCount,
      controlPlaneDecision: {
        decision: controlPlaneDecision.decision,
        recommendedAction: controlPlaneDecision.recommendedAction,
        reasonCount: Array.isArray(controlPlaneDecision.reasons) ? controlPlaneDecision.reasons.length : 0,
        baselineHealth: controlPlaneDecision.baselineHealth,
        baselineDriftSeverity: controlPlaneDecision.baselineDriftSeverity,
        releaseBuildGateDecision: controlPlaneDecision.releaseBuildGateDecision,
        dataSourcesGateDecision: controlPlaneDecision.dataSourcesGateDecision,
        activeRuns: controlPlaneDecision.activeRuns,
        staleActiveRuns: controlPlaneDecision.staleActiveRuns,
        slaBreachedRuns: controlPlaneDecision.slaBreachedRuns
      },
      handoffContract: {
        input: [
          "target project id and relative path",
          "bounded objective",
          "files or modules in scope",
          "acceptance criteria",
          "validation commands",
          "non-goals and blockers"
        ],
        output: [
          "status",
          "summary",
          "changed files",
          "validation results",
          "blocked reasons",
          "follow-up work-order recommendation"
        ],
        prohibited: [
          "secrets",
          "credentials",
          "certificate payloads",
          "private keys",
          "browser sessions",
          "unbounded recursive execution"
        ]
      },
      validationLoop: [
        "Run the work-order validation commands.",
        "Run app-level tests and build checks when available.",
        "Relaunch the local app and smoke-check the monitored URL.",
        "Record a milestone note and non-secret result summary.",
        "Commit and optionally push only validated changes.",
        "Create a new sanitized follow-up work order before handing off to another runner."
      ]
    };

    return {
      ...payload,
      markdown: buildCliBridgeContextMarkdown(payload)
    };
  }

  /**
   * @param {unknown} value
   */
  function normalizeCliBridgeTargetRunner(value) {
    const runner = normalizeCliBridgeRunner(value);
    return runner === "claude" ? "claude" : "codex";
  }

  /**
   * @param {Record<string, unknown>} workOrder
   * @param {string} sourceType
   */
  function createCliBridgeRunnerWorkOrderContract(workOrder, sourceType) {
    const record = toControlPlaneRecord(workOrder);
    const agentPolicy = toControlPlaneRecord(record.agentPolicy);
    const validationCommands = toTextList(record.validationCommands);
    return {
      sourceType,
      id: toText(record.id) || toText(record.projectId) || "",
      projectId: toText(record.projectId),
      projectName: toText(record.projectName) || "Project",
      relPath: toText(record.relPath),
      title: toText(record.title) || `Agent work order for ${toText(record.projectName) || "Project"}`,
      objective: toText(record.objective) || toText(record.nextStep) || "Review readiness and define the next execution step.",
      readinessScore: toNumber(record.readinessScore || record.score),
      readinessStatus: toText(record.readinessStatus) || toText(record.status),
      blockers: toTextList(record.blockers),
      agentPolicyId: toText(record.agentPolicyId) || toText(agentPolicy.policyId),
      agentPolicyCheckpointStatus: toText(record.agentPolicyCheckpointStatus) || toText(agentPolicy.checkpointStatus),
      agentRole: toText(record.agentRole) || toText(agentPolicy.role) || "readiness-reviewer",
      runtime: toText(record.runtime) || toText(agentPolicy.runtime) || "planning-only-agent",
      isolationMode: toText(record.isolationMode) || toText(agentPolicy.isolationMode) || "read-only-planning",
      skillBundle: toTextList(record.skillBundle).length ? toTextList(record.skillBundle) : toTextList(agentPolicy.skillBundle),
      hookPolicy: toTextList(record.hookPolicy).length ? toTextList(record.hookPolicy) : toTextList(agentPolicy.hookPolicy),
      validationCommands: validationCommands.length ? validationCommands : ["Run project-specific validation from the workbench Launchpad"],
      secretPolicy: toText(record.agentPolicySecretPolicy) || toText(agentPolicy.secretPolicy) || "Non-secret managed agent policy metadata only.",
      notes: toText(record.notes)
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildCliBridgeRunnerDryRunMarkdown(payload) {
    const workOrder = toControlPlaneRecord(payload.selectedWorkOrder);
    const envelope = toControlPlaneRecord(payload.commandEnvelope);
    const expectedOutputSchema = toControlPlaneRecord(payload.expectedOutputSchema);
    const lines = [
      "# CLI Bridge Runner Dry Run",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Runner: ${toText(payload.runner) || "codex"}`,
      `Decision: ${toText(payload.dryRunDecision) || "review"}`,
      `Execution mode: ${toText(payload.executionMode) || "non-executing"}`,
      `Secret policy: ${toText(payload.secretPolicy) || "No secrets."}`,
      "",
      "## Command Envelope",
      `- Adapter: ${toText(envelope.adapterId) || "codex"}`,
      `- Display command: ${toText(envelope.displayCommand) || "not available"}`,
      `- Working directory: ${toText(envelope.workingDirectory) || "workspace root"}`,
      `- Invocation policy: ${toText(envelope.invocationPolicy) || "manual dry-run only"}`,
      "",
      "## Selected Work Order",
      `- Source type: ${toText(workOrder.sourceType) || "unknown"}`,
      `- Work order ID: ${toText(workOrder.id) || "not linked"}`,
      `- Project: ${toText(workOrder.projectName) || "Project"} (${toText(workOrder.projectId) || "unknown"})`,
      `- Relative path: ${toText(workOrder.relPath) || "unknown"}`,
      `- Objective: ${toText(workOrder.objective) || "Review readiness and define next step."}`,
      `- Readiness: ${toText(workOrder.readinessStatus) || "unset"} (${toNumber(workOrder.readinessScore)}/100)`,
      `- Agent policy: ${toText(workOrder.agentPolicyCheckpointStatus) || "needs-review"}`,
      `- Runtime: ${toText(workOrder.runtime) || "planning-only-agent"}`,
      `- Isolation: ${toText(workOrder.isolationMode) || "read-only-planning"}`,
      "",
      "## Prompt",
      "",
      toText(envelope.prompt) || "No prompt generated.",
      "",
      "## Expected Output Schema",
      `- status: ${toText(expectedOutputSchema.status) || "required"}`,
      `- summary: ${toText(expectedOutputSchema.summary) || "required"}`,
      `- changedFiles: ${toText(expectedOutputSchema.changedFiles) || "required array"}`,
      `- validationResults: ${toText(expectedOutputSchema.validationResults) || "required"}`,
      `- blockers: ${toText(expectedOutputSchema.blockers) || "required array"}`,
      `- nextAction: ${toText(expectedOutputSchema.nextAction) || "required"}`,
      `- handoffRecommendation: ${toText(expectedOutputSchema.handoffRecommendation) || "required"}`,
      "",
      "## Validation Loop"
    ];

    const validationLoop = Array.isArray(payload.validationLoop) ? payload.validationLoop : [];
    if (validationLoop.length) {
      for (const step of validationLoop) {
        lines.push(`- ${toText(step)}`);
      }
    } else {
      lines.push("- Validate, relaunch, record a milestone, and create a non-secret handoff before any follow-up runner.");
    }

    return lines.join("\n");
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {ReturnType<typeof buildGovernanceSnapshot>} governance
   * @param {{ runner?: string, runId?: string, status?: string, limit?: number, dataSourcesAccessGate?: Record<string, unknown> | null, dataSourcesAccessReviewQueue?: Record<string, unknown> | null, dataSourcesAccessValidationRunbook?: Record<string, unknown> | null, dataSourcesAccessValidationWorkflow?: Record<string, unknown> | null, releaseBuildGate?: Record<string, unknown> | null }} options
   */
  function createCliBridgeRunnerDryRunPayload(persisted, governance, options = {}) {
    const runner = normalizeCliBridgeTargetRunner(options.runner || "codex");
    const requestedRunId = toText(options.runId);
    const context = createCliBridgeContextPayload(governance, {
      runner,
      status: options.status || "all",
      limit: options.limit || 12,
      dataSourcesAccessGate: options.dataSourcesAccessGate || null,
      dataSourcesAccessReviewQueue: options.dataSourcesAccessReviewQueue || null,
      dataSourcesAccessValidationRunbook: options.dataSourcesAccessValidationRunbook || null,
      dataSourcesAccessValidationWorkflow: options.dataSourcesAccessValidationWorkflow || null,
      releaseBuildGate: options.releaseBuildGate || null
    });
    const runs = Array.isArray(persisted.agentWorkOrderRuns) ? persisted.agentWorkOrderRuns.map(toControlPlaneRecord) : [];
    const candidateRuns = runs
      .filter((run) => !toText(run.archivedAt))
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime());
    const selectedRun = requestedRunId
      ? candidateRuns.find((run) => toText(run.id) === requestedRunId)
      : candidateRuns.find((run) => toText(run.status) === "queued") || candidateRuns.find((run) => !["passed", "failed", "cancelled"].includes(toText(run.status)));
    const workOrderItems = context.workOrders && typeof context.workOrders === "object" && Array.isArray(context.workOrders.items) ? context.workOrders.items : [];
    const fallbackWorkOrder = workOrderItems.find((item) => {
      const agentPolicy = toControlPlaneRecord(item.agentPolicy);
      return agentPolicy.executable === true || toText(agentPolicy.executable) === "true";
    }) || workOrderItems[0] || {};
    const selectedWorkOrder = selectedRun
      ? createCliBridgeRunnerWorkOrderContract(selectedRun, "agent-work-order-run")
      : createCliBridgeRunnerWorkOrderContract(toControlPlaneRecord(fallbackWorkOrder), "readiness-work-order");
    const reasons = (Array.isArray(context.reasons) ? context.reasons : []).map(toControlPlaneRecord);
    if (requestedRunId && !selectedRun) {
      reasons.push({
        severity: "hold",
        code: "cli-bridge-run-not-found",
        message: "Requested Agent Work Order run was not found or is archived."
      });
    }
    if (!toText(selectedWorkOrder.projectId)) {
      reasons.push({
        severity: "hold",
        code: "cli-bridge-no-selected-work-order",
        message: "No queued run or fallback work order is available for the dry-run contract."
      });
    }
    if (selectedWorkOrder.sourceType === "readiness-work-order" && selectedWorkOrder.agentPolicyCheckpointStatus !== "approved") {
      reasons.push({
        severity: "review",
        code: "cli-bridge-policy-not-approved",
        message: "Fallback readiness work order is not backed by an approved Agent Policy checkpoint."
      });
    }
    const dryRunDecision = reasons.some((reason) => toText(reason.severity) === "hold")
      ? "hold"
      : reasons.length
        ? "review"
        : "ready";
    const adapter = runner === "claude"
      ? {
          adapterId: "claude",
          label: "Claude CLI",
          displayCommand: "claude -p <sanitized-work-order-prompt> --output-format json",
          commandPattern: "claude -p <sanitized-work-order-prompt> --output-format json",
          promptMode: "single prompt with JSON response"
        }
      : {
          adapterId: "codex",
          label: "Codex CLI",
          displayCommand: "codex exec <sanitized-work-order-prompt>",
          commandPattern: "codex exec <sanitized-work-order-prompt>",
          promptMode: "single bounded exec prompt"
        };
    const validationCommands = toTextList(selectedWorkOrder.validationCommands);
    const promptLines = [
      `You are ${adapter.label} running under Workspace Audit Pro supervision.`,
      "Do not use or request secrets. Do not start unrelated work.",
      `Project: ${selectedWorkOrder.projectName} (${selectedWorkOrder.projectId})`,
      `Relative path: ${selectedWorkOrder.relPath || "unknown"}`,
      `Objective: ${selectedWorkOrder.objective}`,
      `Role: ${selectedWorkOrder.agentRole}`,
      `Runtime: ${selectedWorkOrder.runtime}`,
      `Isolation: ${selectedWorkOrder.isolationMode}`,
      `Skill bundle: ${selectedWorkOrder.skillBundle.length ? selectedWorkOrder.skillBundle.join(", ") : "project-governance, validation-runner, handoff-pack"}`,
      `Hook policy: ${selectedWorkOrder.hookPolicy.length ? selectedWorkOrder.hookPolicy.join(", ") : "policy-checkpoint-required, preflight-status-review, post-run-validation-log"}`,
      `Blockers: ${selectedWorkOrder.blockers.length ? selectedWorkOrder.blockers.join(", ") : "none recorded"}`,
      `Validation commands: ${validationCommands.length ? validationCommands.join(" && ") : "Run project-specific validation from the workbench Launchpad"}`,
      "",
      "Return a JSON-compatible result summary with status, summary, changedFiles, validationResults, blockers, nextAction, and handoffRecommendation.",
      "If you cannot safely proceed, return status=blocked and explain the blocker."
    ];
    const payload = {
      generatedAt: new Date().toISOString(),
      protocolVersion: "cli-bridge-runner-dry-run.v1",
      bridgeMode: "workspace-audit-work-order-broker",
      executionMode: "non-executing",
      runner,
      requestedRunId,
      dryRunDecision,
      recommendedAction: dryRunDecision === "ready"
        ? `Copy this dry-run contract into ${adapter.label} manually or wire it into the future supervised adapter prototype.`
        : reasons.find((reason) => toText(reason.severity) === "hold")?.message || reasons[0]?.message || "Review dry-run contract before using a CLI runner.",
      secretPolicy: "Non-secret CLI runner dry-run contract only. Do not include passwords, tokens, certificates, private keys, cookies, browser sessions, or raw command output containing secrets.",
      reasons,
      contextDecision: context.bridgeDecision,
      selectedWorkOrder,
      commandEnvelope: {
        ...adapter,
        workingDirectory: selectedWorkOrder.relPath || ".",
        invocationPolicy: "Manual dry-run only. Workspace Audit Pro is not launching the external CLI from this endpoint.",
        prompt: promptLines.join("\n")
      },
      expectedOutputSchema: {
        status: "ready | changed | blocked | failed | needs-review",
        summary: "short non-secret implementation or review summary",
        changedFiles: "array of relative paths; empty array if no edits",
        validationResults: "commands run and pass/fail summary",
        blockers: "array of non-secret blockers",
        nextAction: "recommended next app-controlled action",
        handoffRecommendation: "none | codex | claude | operator | workspace-audit"
      },
      validationLoop: [
        "Paste or pass the sanitized prompt only after confirming the selected work order.",
        "Run one runner at a time; do not allow Codex CLI and Claude CLI to free-chat directly.",
        "Validate changed files with project-specific tests and app-level checks.",
        "Relaunch the app and smoke-check the monitored URL.",
        "Record a non-secret CLI bridge handoff with the result summary before creating a follow-up runner task."
      ]
    };

    return {
      ...payload,
      markdown: buildCliBridgeRunnerDryRunMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} handoff
   * @param {unknown} requestedRunner
   */
  function getCliBridgeFollowUpWorkOrderRunner(handoff, requestedRunner) {
    const requested = normalizeCliBridgeRunner(requestedRunner);
    if (requested === "codex" || requested === "claude") return requested;
    const targetRunner = normalizeCliBridgeRunner(handoff.targetRunner);
    if (targetRunner === "codex" || targetRunner === "claude") return targetRunner;
    const recommendation = normalizeCliBridgeRunner(handoff.handoffRecommendation);
    if (recommendation === "codex" || recommendation === "claude") return recommendation;
    return normalizeCliBridgeRunner(handoff.sourceRunner) === "codex" ? "claude" : "codex";
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildCliBridgeFollowUpWorkOrderDraftMarkdown(payload) {
    const draft = toControlPlaneRecord(payload.draft);
    const handoff = toControlPlaneRecord(payload.sourceHandoff);
    const reasons = Array.isArray(payload.reasons) ? payload.reasons : [];
    const acceptanceCriteria = toTextList(draft.acceptanceCriteria);
    const validationCommands = toTextList(draft.validationCommands);
    const lines = [
      "# CLI Bridge Follow-up Work-Order Draft",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Runner: ${toText(payload.runner) || "codex"}`,
      `Draft decision: ${toText(payload.draftDecision) || "review"}`,
      `Execution mode: ${toText(payload.executionMode) || "non-executing"}`,
      `Source handoff: ${toText(payload.handoffId) || "not selected"}`,
      `Secret policy: ${toText(payload.secretPolicy) || "No secrets."}`,
      "",
      "## Source Handoff",
      `- Title: ${toText(handoff.title) || "not found"}`,
      `- Status: ${toText(handoff.status) || "unknown"}`,
      `- Review action: ${toText(handoff.reviewAction) || "not reviewed"}`,
      `- Source runner: ${toText(handoff.sourceRunner) || "operator"}`,
      `- Target runner: ${toText(handoff.targetRunner) || "operator"}`,
      `- Summary: ${toText(handoff.summary) || "No handoff summary recorded."}`,
      `- Validation: ${toText(handoff.validationSummary) || "not recorded"}`,
      "",
      "## Draft",
      `- Title: ${toText(draft.title) || "Follow-up work order"}`,
      `- Project: ${toText(draft.projectName) || toText(draft.projectId) || "portfolio"}`,
      `- Work order run: ${toText(draft.workOrderRunId) || "not linked"}`,
      `- Objective: ${toText(draft.objective) || "Review the source handoff and define a bounded follow-up."}`,
      `- Changed files: ${toTextList(draft.changedFiles).length ? toTextList(draft.changedFiles).join(", ") : "none recorded"}`,
      "",
      "## Acceptance Criteria"
    ];

    if (acceptanceCriteria.length) {
      for (const item of acceptanceCriteria) lines.push(`- ${item}`);
    } else {
      lines.push("- Keep the follow-up bounded to the source handoff.");
      lines.push("- Return a non-secret result summary to Workspace Audit Pro.");
    }

    lines.push("", "## Validation Commands");
    if (validationCommands.length) {
      for (const command of validationCommands) lines.push(`- ${command}`);
    } else {
      lines.push("- Run the project-specific validation commands from the workbench Launchpad.");
    }

    lines.push("", "## Readiness Reasons");
    if (reasons.length) {
      for (const reason of reasons) {
        const record = toControlPlaneRecord(reason);
        lines.push(`- ${toText(record.severity) || "review"}: ${toText(record.message) || toText(record.code) || "Review required."}`);
      }
    } else {
      lines.push("- No draft blockers recorded.");
    }

    lines.push("", "## Prompt", "", toText(draft.prompt) || "No prompt generated.");

    return lines.join("\n");
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {ReturnType<typeof buildGovernanceSnapshot>} governance
   * @param {{ handoffId?: string, runner?: string, limit?: number, dataSourcesAccessGate?: Record<string, unknown> | null, dataSourcesAccessReviewQueue?: Record<string, unknown> | null, dataSourcesAccessValidationRunbook?: Record<string, unknown> | null, dataSourcesAccessValidationWorkflow?: Record<string, unknown> | null, releaseBuildGate?: Record<string, unknown> | null }} [options]
   */
  function createCliBridgeFollowUpWorkOrderDraftPayload(persisted, governance, options = {}) {
    const handoffId = toText(options.handoffId);
    const handoffs = Array.isArray(persisted.cliBridgeHandoffs) ? persisted.cliBridgeHandoffs.map(toControlPlaneRecord) : [];
    const handoff = handoffs.find((item) => toText(item.id) === handoffId) || null;
    const runner = getCliBridgeFollowUpWorkOrderRunner(handoff || {}, options.runner || "");
    const context = createCliBridgeContextPayload(governance, {
      runner,
      status: "all",
      limit: Number(options.limit || 12),
      dataSourcesAccessGate: options.dataSourcesAccessGate || null,
      dataSourcesAccessReviewQueue: options.dataSourcesAccessReviewQueue || null,
      dataSourcesAccessValidationRunbook: options.dataSourcesAccessValidationRunbook || null,
      dataSourcesAccessValidationWorkflow: options.dataSourcesAccessValidationWorkflow || null,
      releaseBuildGate: options.releaseBuildGate || null
    });
    const reasons = [];

    if (!handoffId) {
      reasons.push({
        severity: "hold",
        code: "cli-bridge-handoff-id-required",
        message: "A CLI bridge handoff ID is required before preparing a follow-up work-order draft."
      });
    }
    if (!handoff) {
      reasons.push({
        severity: "hold",
        code: "cli-bridge-handoff-not-found",
        message: "The selected CLI bridge handoff was not found."
      });
    }
    if (handoff && toText(handoff.status) === "rejected") {
      reasons.push({
        severity: "hold",
        code: "cli-bridge-handoff-rejected",
        message: "Rejected handoffs cannot seed follow-up work-order drafts."
      });
    }
    if (handoff && toText(handoff.status) !== "accepted") {
      reasons.push({
        severity: "review",
        code: "cli-bridge-handoff-not-accepted",
        message: "This handoff is not accepted yet; keep the draft advisory until operator review is complete."
      });
    }
    if (context.bridgeDecision === "hold") {
      reasons.push({
        severity: "review",
        code: "cli-bridge-control-plane-hold",
        message: "The control plane currently reports a hold; the draft may be copied for planning but should not be executed until blockers clear."
      });
    }

    const runs = Array.isArray(persisted.agentWorkOrderRuns) ? persisted.agentWorkOrderRuns.map(toControlPlaneRecord) : [];
    const linkedRun = handoff ? runs.find((run) => toText(run.id) === toText(handoff.workOrderRunId)) || null : null;
    const validationCommands = linkedRun ? toTextList(linkedRun.validationCommands) : [];
    const changedFiles = handoff ? toTextList(handoff.changedFiles) : [];
    const draftDecision = reasons.some((reason) => toText(toControlPlaneRecord(reason).severity) === "hold")
      ? "hold"
      : reasons.length
        ? "review"
        : "ready";
    const runnerLabel = runner === "claude" ? "Claude CLI" : "Codex CLI";
    const title = handoff
      ? `Follow-up from ${toText(handoff.title) || toText(handoff.id) || "CLI bridge handoff"}`
      : "CLI bridge follow-up work-order draft";
    const objective = handoff
      ? toText(handoff.nextAction) || `Review and continue from ${toText(handoff.sourceRunner) || "runner"} handoff summary.`
      : "Select a CLI bridge handoff before preparing a follow-up work-order draft.";
    const acceptanceCriteria = [
      "Use Workspace Audit Pro as the broker and source of truth.",
      "Keep the follow-up bounded to the source handoff summary and changed files.",
      "Do not include or request secrets, credentials, private keys, certificates, cookies, browser sessions, or raw secret-bearing command output.",
      "Return a structured non-secret result summary to the CLI bridge runner result intake.",
      "Run validation, relaunch the local app, and smoke-check the monitored URL before marking the work complete."
    ];
    const promptLines = [
      `You are ${runnerLabel} working under Workspace Audit Pro supervision.`,
      "Do not free-chat with another runner. Use this app-owned work-order draft only.",
      "Do not use or request secrets, credentials, private keys, certificates, cookies, browser sessions, or raw secret-bearing command output.",
      `Source handoff ID: ${handoffId || "not selected"}`,
      `Source status: ${handoff ? toText(handoff.status) || "needs-review" : "not found"}`,
      `Review action: ${handoff ? toText(handoff.reviewAction) || "not reviewed" : "not found"}`,
      `Project: ${handoff ? toText(handoff.projectName) || toText(handoff.projectId) || "portfolio" : "not selected"}`,
      `Work order run: ${handoff ? toText(handoff.workOrderRunId) || "not linked" : "not selected"}`,
      `Objective: ${objective}`,
      `Source summary: ${handoff ? toText(handoff.summary) || "No summary recorded." : "No handoff selected."}`,
      `Validation summary: ${handoff ? toText(handoff.validationSummary) || "not recorded" : "not recorded"}`,
      `Changed files: ${changedFiles.length ? changedFiles.join(", ") : "none recorded"}`,
      `Validation commands: ${validationCommands.length ? validationCommands.join(" && ") : "Run project-specific validation from the workbench Launchpad"}`,
      "",
      "Return JSON-compatible output with status, summary, changedFiles, validationResults, blockers, nextAction, and handoffRecommendation.",
      "If blocked, return status=blocked with a non-secret blocker summary."
    ];
    const draft = {
      sourceType: "cli-bridge-handoff",
      sourceHandoffId: handoffId,
      runner,
      projectId: handoff ? toText(handoff.projectId) : "",
      projectName: handoff ? toText(handoff.projectName) : "",
      relPath: linkedRun ? toText(linkedRun.relPath) : "",
      workOrderRunId: handoff ? toText(handoff.workOrderRunId) : "",
      title,
      objective,
      sourceSummary: handoff ? toText(handoff.summary) : "",
      sourceValidationSummary: handoff ? toText(handoff.validationSummary) : "",
      changedFiles,
      validationCommands: validationCommands.length ? validationCommands : ["Run project-specific validation from the workbench Launchpad"],
      acceptanceCriteria,
      prompt: promptLines.join("\n")
    };
    const payload = {
      generatedAt: new Date().toISOString(),
      protocolVersion: "cli-bridge-follow-up-work-order-draft.v1",
      bridgeMode: "workspace-audit-work-order-broker",
      executionMode: "non-executing",
      runner,
      handoffId,
      draftDecision,
      recommendedAction: draftDecision === "ready"
        ? `Copy this follow-up work-order draft into ${runnerLabel} or a future supervised adapter after validation gates are clear.`
        : reasons.find((reason) => toText(toControlPlaneRecord(reason).severity) === "hold")?.message || reasons[0]?.message || "Review this follow-up draft before any runner action.",
      secretPolicy: "Non-secret CLI bridge follow-up work-order draft only. Do not store passwords, tokens, certificates, private keys, cookies, browser sessions, or raw command output containing secrets.",
      reasons,
      contextDecision: context.bridgeDecision,
      sourceHandoff: handoff || {},
      linkedRun: linkedRun || {},
      draft
    };

    return {
      ...payload,
      markdown: buildCliBridgeFollowUpWorkOrderDraftMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildCliBridgeRunTraceMarkdown(payload) {
    const run = toControlPlaneRecord(payload.run);
    const handoffs = Array.isArray(payload.relatedHandoffs) ? payload.relatedHandoffs.map(toControlPlaneRecord) : [];
    const history = Array.isArray(run.history) ? run.history.map(toControlPlaneRecord) : [];
    const reasons = Array.isArray(payload.reasons) ? payload.reasons.map(toControlPlaneRecord) : [];
    const lines = [
      "# CLI Bridge Run Trace",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Run ID: ${toText(payload.runId) || "not selected"}`,
      `Trace decision: ${toText(payload.traceDecision) || "review"}`,
      `Execution mode: ${toText(payload.executionMode) || "non-executing"}`,
      `Secret policy: ${toText(payload.secretPolicy) || "No secrets."}`,
      "",
      "## Run",
      `- Title: ${toText(run.title) || "not found"}`,
      `- Project: ${toText(run.projectName) || toText(run.projectId) || "not linked"}`,
      `- Status: ${toText(run.status) || "unknown"}`,
      `- CLI bridge handoff: ${toText(run.cliBridgeHandoffId) || "not linked"}`,
      `- CLI runner: ${toText(run.cliBridgeRunner) || "not linked"}`,
      `- Latest CLI result: ${toText(run.latestCliBridgeResultStatus) || "none"} ${toText(run.latestCliBridgeResultHandoffId) || ""}`.trim(),
      `- Latest CLI review: ${toText(run.latestCliBridgeReviewAction) || "none"} ${toText(run.latestCliBridgeReviewStatus) || ""}`.trim(),
      "",
      "## Related Handoffs"
    ];

    if (handoffs.length) {
      for (const handoff of handoffs) {
        lines.push(`- ${toText(handoff.title) || "CLI Bridge Handoff"} (${toText(handoff.status) || "needs-review"})`);
        lines.push(`  Handoff ID: ${toText(handoff.id) || "unknown"}`);
        lines.push(`  Runners: ${toText(handoff.sourceRunner) || "operator"} -> ${toText(handoff.targetRunner) || "operator"}`);
        lines.push(`  Result: ${toText(handoff.resultType) || "handoff"} ${toText(handoff.resultStatus) || ""}`.trim());
        lines.push(`  Review: ${toText(handoff.reviewAction) || "not reviewed"} ${toText(handoff.reviewStatus) || ""}`.trim());
        lines.push(`  Summary: ${toText(handoff.summary) || "No summary recorded."}`);
      }
    } else {
      lines.push("- No related CLI bridge handoffs found for this run.");
    }

    lines.push("", "## Run History");
    if (history.length) {
      for (const event of history.slice(0, 12)) {
        lines.push(`- ${toText(event.status) || "event"}: ${toText(event.note) || "No note."} (${toText(event.createdAt) || "unknown"})`);
      }
    } else {
      lines.push("- No run history recorded.");
    }

    lines.push("", "## Trace Reasons");
    if (reasons.length) {
      for (const reason of reasons) {
        lines.push(`- ${toText(reason.severity) || "review"}: ${toText(reason.message) || toText(reason.code) || "Review required."}`);
      }
    } else {
      lines.push("- No trace blockers recorded.");
    }

    return lines.join("\n");
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {{ runId?: string }} [options]
   */
  function createCliBridgeRunTracePayload(persisted, options = {}) {
    const runId = toText(options.runId);
    const runs = Array.isArray(persisted.agentWorkOrderRuns) ? persisted.agentWorkOrderRuns.map(toControlPlaneRecord) : [];
    const handoffs = Array.isArray(persisted.cliBridgeHandoffs) ? persisted.cliBridgeHandoffs.map(toControlPlaneRecord) : [];
    const run = runs.find((item) => toText(item.id) === runId) || null;
    const relatedIds = new Set();
    if (run) {
      for (const key of ["cliBridgeHandoffId", "latestCliBridgeResultHandoffId", "latestCliBridgeReviewHandoffId"]) {
        const value = toText(run[key]);
        if (value) relatedIds.add(value);
      }
    }
    const relatedHandoffs = handoffs
      .filter((handoff) => {
        const handoffId = toText(handoff.id);
        return relatedIds.has(handoffId)
          || toText(handoff.workOrderRunId) === runId
          || toText(handoff.followUpWorkOrderRunId) === runId;
      })
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime());
    const reasons = [];
    if (!runId) {
      reasons.push({
        severity: "hold",
        code: "cli-bridge-run-id-required",
        message: "A run id is required before preparing a CLI bridge run trace."
      });
    }
    if (!run) {
      reasons.push({
        severity: "hold",
        code: "cli-bridge-run-not-found",
        message: "The selected Agent Work Order Run was not found."
      });
    } else if (!relatedHandoffs.length) {
      reasons.push({
        severity: "review",
        code: "cli-bridge-run-without-handoffs",
        message: "The run exists but has no related CLI bridge handoffs yet."
      });
    }
    const traceDecision = reasons.some((reason) => toText(toControlPlaneRecord(reason).severity) === "hold")
      ? "hold"
      : reasons.length
        ? "review"
        : "ready";
    const payload = {
      generatedAt: new Date().toISOString(),
      protocolVersion: "cli-bridge-run-trace.v1",
      bridgeMode: "workspace-audit-work-order-broker",
      executionMode: "non-executing",
      runId,
      traceDecision,
      recommendedAction: traceDecision === "ready"
        ? "Use this trace to review the app-owned CLI bridge lifecycle before accepting, rejecting, escalating, or queueing a follow-up work order."
        : reasons.find((reason) => toText(toControlPlaneRecord(reason).severity) === "hold")?.message || reasons[0]?.message || "Review the trace before continuing.",
      secretPolicy: "Non-secret CLI bridge run trace only. Do not store passwords, tokens, certificates, private keys, cookies, browser sessions, or raw command output containing secrets.",
      reasons,
      run: run || {},
      relatedHandoffs,
      relatedHandoffCount: relatedHandoffs.length
    };

    return {
      ...payload,
      markdown: buildCliBridgeRunTraceMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {{ runId?: string, title?: string }} [options]
   */
  function createCliBridgeRunTraceSnapshot(persisted, options = {}) {
    const trace = createCliBridgeRunTracePayload(persisted, { runId: options.runId });
    const run = toControlPlaneRecord(trace.run);
    return {
      id: createId("cli-bridge-run-trace-snapshot"),
      title: toText(options.title) || `CLI bridge run trace: ${toText(run.title) || trace.runId || "selected run"}`,
      runId: trace.runId,
      projectId: toText(run.projectId),
      projectName: toText(run.projectName),
      traceDecision: trace.traceDecision,
      relatedHandoffCount: trace.relatedHandoffCount,
      latestCliBridgeResultHandoffId: toText(run.latestCliBridgeResultHandoffId),
      latestCliBridgeReviewHandoffId: toText(run.latestCliBridgeReviewHandoffId),
      secretPolicy: trace.secretPolicy,
      markdown: trace.markdown,
      trace,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * @param {Record<string, unknown>} trace
   */
  function createCliBridgeRunTraceSummary(trace) {
    const run = toControlPlaneRecord(trace.run);
    const handoffs = Array.isArray(trace.relatedHandoffs) ? trace.relatedHandoffs.map(toControlPlaneRecord) : [];
    return {
      traceDecision: toText(trace.traceDecision) || "review",
      runStatus: toText(run.status) || "unknown",
      relatedHandoffCount: toNumber(trace.relatedHandoffCount),
      latestCliBridgeResultHandoffId: toText(run.latestCliBridgeResultHandoffId),
      latestCliBridgeReviewHandoffId: toText(run.latestCliBridgeReviewHandoffId),
      relatedHandoffIds: handoffs.map((handoff) => toText(handoff.id)).filter(Boolean).sort().join(", ")
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildCliBridgeRunTraceSnapshotDiffMarkdown(payload) {
    const driftItems = Array.isArray(payload.driftItems) ? payload.driftItems.map(toControlPlaneRecord) : [];
    const lines = [
      "# CLI Bridge Run Trace Snapshot Drift",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Snapshot: ${toText(payload.snapshotTitle) || toText(payload.snapshotId) || "missing"}`,
      `Run ID: ${toText(payload.runId) || "not selected"}`,
      `Drift severity: ${toText(payload.driftSeverity) || "missing-snapshot"}`,
      `Drift score: ${toNumber(payload.driftScore)}`,
      `Recommended action: ${toText(payload.recommendedAction) || "Save a CLI bridge run trace snapshot before comparing drift."}`,
      `Secret policy: ${toText(payload.secretPolicy) || "No secrets."}`,
      "",
      "## Drift Items"
    ];

    if (driftItems.length) {
      for (const item of driftItems) {
        lines.push(`- ${toText(item.label) || toText(item.field)}: ${toText(item.before)} -> ${toText(item.current)}`);
      }
    } else {
      lines.push("- No live trace drift detected against the saved snapshot.");
    }

    return lines.join("\n");
  }

  /**
   * @param {Record<string, unknown>} [snapshot]
   * @param {string} [recommendedAction]
   */
  function createMissingCliBridgeRunTraceSnapshotDiffPayload(snapshot = {}, recommendedAction = "Save a CLI bridge run trace snapshot before comparing drift.") {
    const payload = {
      generatedAt: new Date().toISOString(),
      status: "missing-snapshot",
      snapshotId: toText(snapshot.id),
      snapshotTitle: toText(snapshot.title),
      runId: toText(snapshot.runId),
      hasDrift: false,
      driftScore: 0,
      driftSeverity: "missing-snapshot",
      recommendedAction,
      secretPolicy: "Non-secret CLI bridge run trace snapshot drift only. Do not store passwords, tokens, certificates, private keys, cookies, browser sessions, or raw command output containing secrets.",
      driftItems: [],
      liveSummary: null,
      snapshotSummary: null
    };

    return {
      ...payload,
      markdown: buildCliBridgeRunTraceSnapshotDiffMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {{ snapshotId?: string }} [options]
   */
  function createCliBridgeRunTraceSnapshotDiffPayload(persisted, options = {}) {
    const snapshots = Array.isArray(persisted.cliBridgeRunTraceSnapshots)
      ? persisted.cliBridgeRunTraceSnapshots.map(toControlPlaneRecord)
      : [];
    if (!snapshots.length) {
      return createMissingCliBridgeRunTraceSnapshotDiffPayload();
    }

    const snapshotId = toText(options.snapshotId) || "latest";
    const snapshot = snapshotId === "latest"
      ? [...snapshots].sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())[0]
      : snapshots.find((item) => toText(item.id) === snapshotId);
    if (!snapshot) {
      return createMissingCliBridgeRunTraceSnapshotDiffPayload({}, `Trace snapshot ${snapshotId} was not found.`);
    }

    const savedTrace = toControlPlaneRecord(snapshot.trace);
    const liveTrace = createCliBridgeRunTracePayload(persisted, { runId: toText(snapshot.runId) });
    const snapshotSummary = createCliBridgeRunTraceSummary(savedTrace);
    const liveSummary = createCliBridgeRunTraceSummary(liveTrace);
    const driftFields = [
      { field: "traceDecision", label: "Trace Decision" },
      { field: "runStatus", label: "Run Status" },
      { field: "relatedHandoffCount", label: "Related Handoff Count" },
      { field: "latestCliBridgeResultHandoffId", label: "Latest CLI Result Handoff" },
      { field: "latestCliBridgeReviewHandoffId", label: "Latest CLI Review Handoff" },
      { field: "relatedHandoffIds", label: "Related Handoff IDs" }
    ];
    const driftItems = driftFields
      .map(({ field, label }) => {
        const before = snapshotSummary[field] ?? "";
        const current = liveSummary[field] ?? "";
        if (String(before) === String(current)) return null;
        return {
          field,
          label,
          before,
          current,
          delta: typeof before === "number" && typeof current === "number" ? current - before : 0
        };
      })
      .filter(Boolean);
    const driftScore = driftItems.length;
    const driftSeverity = !driftItems.length
      ? "none"
      : driftItems.some((item) => item.field === "traceDecision") || liveSummary.traceDecision === "hold"
        ? "high"
        : driftItems.length > 2
          ? "medium"
          : "low";
    const payload = {
      generatedAt: new Date().toISOString(),
      status: "ready",
      snapshotId: toText(snapshot.id),
      snapshotTitle: toText(snapshot.title) || "CLI Bridge Run Trace",
      runId: toText(snapshot.runId),
      hasDrift: driftItems.length > 0,
      driftScore,
      driftSeverity,
      recommendedAction: driftItems.length
        ? "Review CLI bridge run trace drift before accepting, rejecting, escalating, or queueing more follow-up work."
        : "No live CLI bridge run trace drift detected against the saved snapshot.",
      secretPolicy: "Non-secret CLI bridge run trace snapshot drift only. Do not store passwords, tokens, certificates, private keys, cookies, browser sessions, or raw command output containing secrets.",
      driftItems,
      liveSummary,
      snapshotSummary
    };

    return {
      ...payload,
      markdown: buildCliBridgeRunTraceSnapshotDiffMarkdown(payload)
    };
  }

  /**
   * @param {unknown} createdAt
   */
  function getCliBridgeRunTraceSnapshotBaselineFreshness(createdAt) {
    const createdAtText = toText(createdAt);
    const createdAtTime = new Date(createdAtText).getTime();
    if (!createdAtText || !Number.isFinite(createdAtTime)) {
      return {
        baselineAgeHours: 0,
        baselineFreshness: "missing",
        baselineFreshnessThresholdHours: CLI_BRIDGE_RUN_TRACE_BASELINE_STALE_HOURS
      };
    }
    const baselineAgeHours = Math.max(0, Math.round(((Date.now() - createdAtTime) / (60 * 60 * 1000)) * 10) / 10);
    return {
      baselineAgeHours,
      baselineFreshness: baselineAgeHours > CLI_BRIDGE_RUN_TRACE_BASELINE_STALE_HOURS ? "stale" : "fresh",
      baselineFreshnessThresholdHours: CLI_BRIDGE_RUN_TRACE_BASELINE_STALE_HOURS
    };
  }

  /**
   * @param {boolean} hasBaseline
   * @param {string} freshness
   * @param {number} driftScore
   * @param {string} driftSeverity
   */
  function getCliBridgeRunTraceSnapshotBaselineHealth(hasBaseline, freshness, driftScore, driftSeverity) {
    if (!hasBaseline) {
      return {
        health: "missing",
        recommendedAction: "Save a CLI bridge run trace snapshot before relying on trace baseline drift."
      };
    }
    if (freshness === "stale") {
      return {
        health: "stale",
        recommendedAction: "Refresh the CLI bridge run trace snapshot baseline before the next CLI handoff."
      };
    }
    if (driftSeverity === "high" || driftScore >= 4) {
      return {
        health: "drifted",
        recommendedAction: "Review CLI bridge trace drift and accept a refreshed baseline only after operator approval."
      };
    }
    if (driftScore > 0) {
      return {
        health: "changed",
        recommendedAction: "Review CLI bridge trace drift fields before accepting the live trace as baseline."
      };
    }
    return {
      health: "healthy",
      recommendedAction: "Continue monitoring CLI bridge trace baseline freshness and drift."
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildCliBridgeRunTraceSnapshotBaselineStatusMarkdown(payload) {
    const lines = [
      "# CLI Bridge Run Trace Baseline Status",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Baseline selected: ${payload.hasBaseline ? "yes" : "no"}`,
      `Snapshot: ${toText(payload.title) || toText(payload.snapshotId) || "missing"}`,
      `Run ID: ${toText(payload.runId) || "missing"}`,
      `Freshness: ${toText(payload.freshness) || "missing"} (${toNumber(payload.ageHours)}h old, threshold ${toNumber(payload.freshnessThresholdHours)}h)`,
      `Health: ${toText(payload.health) || "missing"}`,
      `Recommended action: ${toText(payload.recommendedAction) || "Save a CLI bridge run trace snapshot before relying on trace baseline drift."}`,
      `Drift detected: ${payload.hasDrift ? "yes" : "no"}`,
      `Drift score: ${toNumber(payload.driftScore)}`,
      `Drift severity: ${toText(payload.driftSeverity) || "missing-baseline"}`,
      `Drift action: ${toText(payload.driftRecommendedAction) || "Save a CLI bridge run trace snapshot before comparing drift."}`,
      `Secret policy: ${toText(payload.secretPolicy) || "Non-secret CLI bridge run trace baseline status only."}`,
      "",
      "## Drift Fields"
    ];

    const driftItems = Array.isArray(payload.driftItems) ? payload.driftItems.map(toControlPlaneRecord) : [];
    if (driftItems.length) {
      for (const item of driftItems) {
        lines.push(`- ${toText(item.label) || toText(item.field)}: ${toText(item.before)} -> ${toText(item.current)}`);
      }
    } else {
      lines.push("- No non-zero CLI bridge run trace baseline drift fields.");
    }

    return lines.join("\n");
  }

  /**
   * @param {Record<string, unknown>} persisted
   */
  function createCliBridgeRunTraceSnapshotBaselineStatusPayload(persisted) {
    const snapshots = Array.isArray(persisted.cliBridgeRunTraceSnapshots)
      ? persisted.cliBridgeRunTraceSnapshots.map(toControlPlaneRecord)
      : [];
    const snapshot = [...snapshots].sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())[0] || null;
    const secretPolicy = "Non-secret CLI bridge run trace baseline status only. Do not store passwords, tokens, certificates, private keys, cookies, browser sessions, raw command output, or provider credentials.";

    if (!snapshot) {
      const health = getCliBridgeRunTraceSnapshotBaselineHealth(false, "missing", 0, "missing-baseline");
      const payload = {
        generatedAt: new Date().toISOString(),
        hasBaseline: false,
        baselineSnapshotId: "",
        snapshotId: "",
        title: "",
        createdAt: "",
        runId: "",
        projectId: "",
        projectName: "",
        snapshotCount: snapshots.length,
        ageHours: 0,
        freshness: "missing",
        freshnessThresholdHours: CLI_BRIDGE_RUN_TRACE_BASELINE_STALE_HOURS,
        baselineAgeHours: 0,
        baselineFreshness: "missing",
        baselineFreshnessThresholdHours: CLI_BRIDGE_RUN_TRACE_BASELINE_STALE_HOURS,
        health: health.health,
        recommendedAction: health.recommendedAction,
        hasDrift: false,
        driftScore: 0,
        driftSeverity: "missing-baseline",
        driftRecommendedAction: "Save a CLI bridge run trace snapshot before comparing baseline drift.",
        driftItems: [],
        diff: null,
        secretPolicy
      };

      return {
        ...payload,
        markdown: buildCliBridgeRunTraceSnapshotBaselineStatusMarkdown(payload)
      };
    }

    const freshness = getCliBridgeRunTraceSnapshotBaselineFreshness(snapshot.createdAt);
    const diff = createCliBridgeRunTraceSnapshotDiffPayload(persisted, { snapshotId: toText(snapshot.id) });
    const driftSeverity = toText(diff.driftSeverity) || "none";
    const health = getCliBridgeRunTraceSnapshotBaselineHealth(true, freshness.baselineFreshness, toNumber(diff.driftScore), driftSeverity);
    const payload = {
      generatedAt: new Date().toISOString(),
      hasBaseline: true,
      baselineSnapshotId: toText(snapshot.id),
      snapshotId: toText(snapshot.id),
      title: toText(snapshot.title) || "CLI Bridge Run Trace Baseline",
      createdAt: toText(snapshot.createdAt),
      runId: toText(snapshot.runId),
      projectId: toText(snapshot.projectId),
      projectName: toText(snapshot.projectName),
      snapshotCount: snapshots.length,
      ageHours: freshness.baselineAgeHours,
      freshness: freshness.baselineFreshness,
      freshnessThresholdHours: freshness.baselineFreshnessThresholdHours,
      baselineAgeHours: freshness.baselineAgeHours,
      baselineFreshness: freshness.baselineFreshness,
      baselineFreshnessThresholdHours: freshness.baselineFreshnessThresholdHours,
      health: health.health,
      recommendedAction: health.recommendedAction,
      hasDrift: diff.hasDrift,
      driftScore: toNumber(diff.driftScore),
      driftSeverity,
      driftRecommendedAction: toText(diff.recommendedAction) || "No CLI bridge run trace drift detected.",
      driftItems: Array.isArray(diff.driftItems) ? diff.driftItems : [],
      diff,
      secretPolicy
    };

    return {
      ...payload,
      markdown: buildCliBridgeRunTraceSnapshotBaselineStatusMarkdown(payload)
    };
  }

  /**
   * @param {ReturnType<typeof createCliBridgeFollowUpWorkOrderDraftPayload>} draftPayload
   * @param {Record<string, unknown>} payload
   */
  function createAgentWorkOrderRunFromCliBridgeDraft(draftPayload, payload = {}) {
    const draft = toControlPlaneRecord(draftPayload.draft);
    const linkedRun = toControlPlaneRecord(draftPayload.linkedRun);
    const handoff = toControlPlaneRecord(draftPayload.sourceHandoff);
    const now = new Date().toISOString();
    const status = toText(payload.status) || "queued";
    const notes = toText(payload.notes) || `Queued from CLI bridge handoff ${toText(draftPayload.handoffId) || "unknown"} for ${toText(draftPayload.runner) || "codex"}.`;
    const skillBundle = toTextList(linkedRun.skillBundle);
    const hookPolicy = toTextList(linkedRun.hookPolicy);
    const validationCommands = toTextList(draft.validationCommands);
    return {
      id: createId("agent-work-order-run"),
      projectId: toText(draft.projectId),
      projectName: toText(draft.projectName),
      relPath: toText(draft.relPath) || toText(linkedRun.relPath),
      snapshotId: "",
      title: toText(payload.title) || toText(draft.title) || `CLI bridge follow-up for ${toText(draft.projectName) || "Project"}`,
      objective: toText(draft.objective),
      status,
      readinessScore: toNumber(linkedRun.readinessScore),
      readinessStatus: toText(linkedRun.readinessStatus) || "cli-bridge-follow-up",
      blockers: Array.isArray(draftPayload.reasons)
        ? draftPayload.reasons.map((reason) => {
            const record = toControlPlaneRecord(reason);
            return toText(record.code) || toText(record.message);
          }).filter(Boolean)
        : [],
      agentPolicyId: toText(linkedRun.agentPolicyId),
      agentPolicyCheckpointId: toText(linkedRun.agentPolicyCheckpointId),
      agentPolicyCheckpointStatus: normalizeAgentPolicyCheckpointStatus(linkedRun.agentPolicyCheckpointStatus),
      agentRole: toText(payload.agentRole) || toText(linkedRun.agentRole) || (draftPayload.runner === "claude" ? "cli-reviewer" : "cli-implementation-agent"),
      runtime: toText(payload.runtime) || toText(linkedRun.runtime) || `${toText(draftPayload.runner) || "codex"}-cli-supervised-work-order`,
      isolationMode: toText(payload.isolationMode) || toText(linkedRun.isolationMode) || "supervised-non-secret-work-order",
      skillBundle: skillBundle.length ? skillBundle : ["project-governance", "validation-runner", "handoff-pack"],
      hookPolicy: hookPolicy.length ? hookPolicy : ["policy-checkpoint-required", "preflight-status-review", "post-run-validation-log"],
      agentPolicySecretPolicy: toText(linkedRun.agentPolicySecretPolicy) || toText(handoff.secretPolicy) || "Non-secret CLI bridge work-order metadata only.",
      validationCommands: validationCommands.length ? validationCommands : ["Run project-specific validation from the workbench Launchpad"],
      notes,
      cliBridgeHandoffId: toText(draftPayload.handoffId),
      cliBridgeRunner: toText(draftPayload.runner),
      cliBridgeDraftDecision: toText(draftPayload.draftDecision),
      cliBridgeSourceSummary: toText(draft.sourceSummary),
      history: [createAgentWorkOrderRunEvent(status, notes)],
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
    const dataSourcesAccessValidationWorkflow = payload.dataSourcesAccessValidationWorkflow && typeof payload.dataSourcesAccessValidationWorkflow === "object" ? payload.dataSourcesAccessValidationWorkflow : {};
    const dataSourcesAccessValidationWorkflowItems = Array.isArray(dataSourcesAccessValidationWorkflow.items) ? dataSourcesAccessValidationWorkflow.items : [];
    const dataSourcesAccessValidationEvidenceCoverage = payload.dataSourcesAccessValidationEvidenceCoverage && typeof payload.dataSourcesAccessValidationEvidenceCoverage === "object" ? payload.dataSourcesAccessValidationEvidenceCoverage : {};
    const dataSourcesAccessValidationEvidenceCoverageItems = Array.isArray(dataSourcesAccessValidationEvidenceCoverage.items) ? dataSourcesAccessValidationEvidenceCoverage.items : [];
    const dataSourceAccessValidationEvidence = Array.isArray(payload.dataSourceAccessValidationEvidence) ? payload.dataSourceAccessValidationEvidence : [];
    const dataSourcesAccessTasks = Array.isArray(payload.dataSourcesAccessTasks) ? payload.dataSourcesAccessTasks : [];
    const releaseControlTasks = Array.isArray(payload.releaseControlTasks) ? payload.releaseControlTasks : [];
    const agentControlPlaneDecisionTasks = Array.isArray(payload.agentControlPlaneDecisionTasks) ? payload.agentControlPlaneDecisionTasks : [];
    const agentExecutionResultTasks = Array.isArray(payload.agentExecutionResultTasks) ? payload.agentExecutionResultTasks : [];
    const agentExecutionResultRequirements = toControlPlaneRecord(payload.agentExecutionResultRequirements);
    const agentExecutionResultRequirementItems = Array.isArray(agentExecutionResultRequirements.items) ? agentExecutionResultRequirements.items : [];
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
    lines.push(`- Agent policy checkpoints: ${toNumber(payload.agentPolicyCheckpointUnresolvedCount)} unresolved / ${toNumber(payload.agentPolicyCheckpointCount)} total`);
    lines.push(`- Agent policy executable work orders: ${toNumber(payload.agentPolicyExecutableCount)}/${toNumber(payload.agentReadinessItems)}`);
    lines.push(`- Execution result checkpoints: ${toNumber(payload.agentExecutionResultCheckpointUnresolvedCount)} unresolved / ${toNumber(payload.agentExecutionResultCheckpointCount)} total`);
    lines.push(`- Execution result action gates: ${toNumber(payload.agentExecutionResultCheckpointRequiredCount)} pending (${toNumber(payload.agentExecutionResultBaselineBlockedCount)} baseline-refresh blocker(s))`);
    lines.push(`- Execution result follow-up tasks: ${toNumber(payload.agentExecutionResultOpenTaskCount)} open / ${toNumber(payload.agentExecutionResultTaskCount)} total (${toNumber(payload.agentExecutionResultClosedTaskCount)} closed)`);

    lines.push("", "## Execution Result Checkpoints");
    if (agentExecutionResultRequirementItems.length) {
      for (const item of agentExecutionResultRequirementItems.slice(0, 10)) {
        const record = toControlPlaneRecord(item);
        lines.push(`- ${toText(record.projectName) || "Project"}: ${toText(record.targetAction) || "review"} for ${toText(record.runStatus) || "execution"} (${toText(record.checkpointStatus) || "needs-review"})`);
      }
    } else {
      lines.push("- No pending execution-result action gates.");
    }

    lines.push("", "## Execution Result Follow-up Tasks");
    if (agentExecutionResultTasks.length) {
      for (const task of agentExecutionResultTasks.slice(0, 10)) {
        const record = toControlPlaneRecord(task);
        lines.push(`- ${toText(record.priority) || "normal"} ${toText(record.status) || "open"}: ${toText(record.title) || "Execution result task"}`);
        lines.push(`  Run: ${toText(record.agentExecutionResultRunId) || "unknown"} | Action: ${toText(record.agentExecutionResultTargetAction) || "review"} | Checkpoint: ${toText(record.agentExecutionResultCheckpointStatus) || "deferred"}`);
      }
    } else {
      lines.push("- No execution-result follow-up tasks.");
    }

    lines.push(`- Data Sources access gate: ${toText(payload.dataSourcesGateDecision) || toText(dataSourcesAccessGate.decision) || "not evaluated"}`);
    lines.push(`- Data Sources ready/review/blocked: ${toNumber(payload.dataSourcesReady)}/${toNumber(payload.dataSourcesReview)}/${toNumber(payload.dataSourcesBlocked)}`);
    lines.push(`- Data Sources token-likely sources: ${toNumber(payload.dataSourcesTokenLikely)}`);
    lines.push(`- Data Sources access review queue: ${toNumber(payload.dataSourcesAccessReviewQueueCount || dataSourcesAccessReviewQueue.summary?.total)}`);
    lines.push(`- Data Sources access validation methods: ${toNumber(payload.dataSourcesAccessValidationMethodCount)} across ${toNumber(payload.dataSourcesAccessValidationSourceCount)} source(s)`);
    lines.push(`- Data Sources access validation workflow: ${toNumber(payload.dataSourcesAccessValidationWorkflowReadyCount)} ready / ${toNumber(payload.dataSourcesAccessValidationWorkflowPendingCount)} pending / ${toNumber(payload.dataSourcesAccessValidationWorkflowBlockedCount)} blocked`);
    lines.push(`- Data Sources access validation workflow snapshots: ${toNumber(payload.dataSourceAccessValidationWorkflowSnapshotCount)} (${toText(payload.dataSourceAccessValidationWorkflowSnapshotDriftSeverity) || "missing-snapshot"} / score ${toNumber(payload.dataSourceAccessValidationWorkflowSnapshotDriftScore)})`);
    lines.push(`- Data Sources access validation evidence: ${toNumber(payload.dataSourcesAccessValidationEvidenceValidatedCount)} validated / ${toNumber(payload.dataSourcesAccessValidationEvidenceCount)} total`);
    lines.push(`- Data Sources access validation evidence coverage: ${toNumber(payload.dataSourcesAccessValidationEvidenceCoverageCoveredCount)} covered / ${toNumber(payload.dataSourcesAccessValidationEvidenceCoverageCount)} source(s) (${toNumber(payload.dataSourcesAccessValidationEvidenceCoveragePercent)}%)`);
    lines.push(`- Data Sources access validation evidence coverage gaps: ${toNumber(payload.dataSourcesAccessValidationEvidenceCoverageMissingCount)} missing / ${toNumber(payload.dataSourcesAccessValidationEvidenceCoverageHighPriorityCount)} high priority`);
    lines.push(`- Source-access checkpoints: ${toNumber(payload.sourceAccessCheckpointUnresolvedCount)} unresolved / ${toNumber(payload.sourceAccessCheckpointCount)} total across ${toNumber(payload.sourceAccessCheckpointSources)} source(s)`);
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

    lines.push("", "## Data Sources Access Validation Workflow");
    if (dataSourcesAccessValidationWorkflowItems.length) {
      for (const item of dataSourcesAccessValidationWorkflowItems.slice(0, 10)) {
        const record = toControlPlaneRecord(item);
        lines.push(`- ${toText(record.priority) || "medium"} ${toText(record.status) || "pending"}: ${toText(record.label) || toText(record.sourceId) || "Source"} (${toText(record.stage) || "external-access-review"})`);
      }
    } else {
      lines.push("- No Data Sources access validation workflow items.");
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
   * @param {{ dataSourcesAccessGate?: Record<string, unknown> | null, dataSourcesAccessReviewQueue?: Record<string, unknown> | null, dataSourcesAccessValidationRunbook?: Record<string, unknown> | null, dataSourcesAccessValidationWorkflow?: Record<string, unknown> | null, releaseBuildGate?: Record<string, unknown> | null }} options
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
    const dataSourcesAccessValidationWorkflow = options.dataSourcesAccessValidationWorkflow && typeof options.dataSourcesAccessValidationWorkflow === "object"
      ? options.dataSourcesAccessValidationWorkflow
      : governance.dataSourcesAccessValidationWorkflow && typeof governance.dataSourcesAccessValidationWorkflow === "object"
        ? governance.dataSourcesAccessValidationWorkflow
        : null;
    const dataSourcesAccessValidationWorkflowSummary = toControlPlaneRecord(dataSourcesAccessValidationWorkflow?.summary);
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
    const agentExecutionResultTasks = Array.isArray(governance.agentExecutionResultTasks) ? governance.agentExecutionResultTasks : [];
    const agentExecutionResultOpenTaskCount = toNumber(summary.agentExecutionResultOpenTaskCount);
    const executionResultBaselineBlockedCount = toNumber(summary.agentExecutionResultBaselineBlockedCount);
    const executionResultCheckpointRequiredCount = toNumber(summary.agentExecutionResultCheckpointRequiredCount);
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
    if (executionResultBaselineBlockedCount > 0) {
      addReason("hold", "execution-result-baseline-checkpoints", `Approve ${executionResultBaselineBlockedCount} execution result baseline-refresh checkpoint${executionResultBaselineBlockedCount === 1 ? "" : "s"} before refreshing or finalizing the Control Plane baseline.`);
    }
    if (executionResultCheckpointRequiredCount > executionResultBaselineBlockedCount) {
      const remaining = executionResultCheckpointRequiredCount - executionResultBaselineBlockedCount;
      addReason("review", "execution-result-action-checkpoints", `Approve, defer, or dismiss ${remaining} execution result action checkpoint${remaining === 1 ? "" : "s"} before retry, archive, retention, or SLA resolution actions are treated as final.`);
    }
    if (toNumber(metrics.staleActive) > 0) {
      addReason("review", "stale-active-runs", "Review stale active Agent Execution runs before starting new work.");
    }
    if (toNumber(summary.agentReadyProjects) === 0 && toNumber(summary.agentReadinessItems) > 0) {
      addReason("review", "no-ready-projects", "No projects are currently rated agent-ready.");
    }
    const agentPolicyExecutableCount = toNumber(summary.agentPolicyExecutableCount);
    const agentReadinessItemCount = toNumber(summary.agentReadinessItems);
    if (agentReadinessItemCount > 0 && agentPolicyExecutableCount < agentReadinessItemCount) {
      addReason("review", "agent-policy-checkpoints-unresolved", `Approve, defer, or dismiss generated managed-agent policies before queueing ${agentReadinessItemCount - agentPolicyExecutableCount} non-executable work order${agentReadinessItemCount - agentPolicyExecutableCount === 1 ? "" : "s"}.`);
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
    if (agentExecutionResultOpenTaskCount > 0) {
      addReason("review", "execution-result-open-tasks", `Resolve ${agentExecutionResultOpenTaskCount} open execution-result follow-up task${agentExecutionResultOpenTaskCount === 1 ? "" : "s"} before treating deferred run gates as handled.`);
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
    const sourceAccessCheckpointUnresolvedCount = toNumber(summary.sourceAccessCheckpointUnresolvedCount);
    if (sourceAccessCheckpointUnresolvedCount > 0) {
      addReason("review", "source-access-checkpoints-unresolved", `Review ${sourceAccessCheckpointUnresolvedCount} unresolved source-access checkpoint${sourceAccessCheckpointUnresolvedCount === 1 ? "" : "s"} before supervised agent work or ingestion.`);
    }
    const dataSourceAccessValidationWorkflowSnapshotDriftSeverity = toText(summary.dataSourceAccessValidationWorkflowSnapshotDriftSeverity) || "missing-snapshot";
    if (dataSourceAccessValidationWorkflowSnapshotDriftSeverity === "high") {
      addReason("hold", "data-sources-access-validation-workflow-snapshot-drift-high", "Resolve high Data Sources access validation workflow snapshot drift before supervised agent work.");
    } else if (dataSourceAccessValidationWorkflowSnapshotDriftSeverity === "medium") {
      addReason("review", "data-sources-access-validation-workflow-snapshot-drift-medium", "Review Data Sources access validation workflow snapshot drift and refresh the snapshot if intentional.");
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
      agentExecutionResultTaskCount: toNumber(summary.agentExecutionResultTaskCount),
      agentExecutionResultOpenTaskCount,
      agentExecutionResultClosedTaskCount: toNumber(summary.agentExecutionResultClosedTaskCount),
      agentExecutionResultTasks: agentExecutionResultTasks.slice(0, 12),
      activeRuns: toNumber(metrics.active),
      staleActiveRuns: toNumber(metrics.staleActive),
      slaBreachedRuns: toNumber(metrics.slaBreached),
      agentReadyProjects: toNumber(summary.agentReadyProjects),
      agentReadinessItems: toNumber(summary.agentReadinessItems),
      agentPolicyCheckpointCount: toNumber(summary.agentPolicyCheckpointCount),
      agentPolicyCheckpointApprovedCount: toNumber(summary.agentPolicyCheckpointApprovedCount),
      agentPolicyCheckpointDeferredCount: toNumber(summary.agentPolicyCheckpointDeferredCount),
      agentPolicyCheckpointDismissedCount: toNumber(summary.agentPolicyCheckpointDismissedCount),
      agentPolicyCheckpointNeedsReviewCount: toNumber(summary.agentPolicyCheckpointNeedsReviewCount),
      agentPolicyCheckpointUnresolvedCount: toNumber(summary.agentPolicyCheckpointUnresolvedCount),
      agentPolicyExecutableCount,
      agentExecutionResultCheckpointCount: toNumber(summary.agentExecutionResultCheckpointCount),
      agentExecutionResultCheckpointApprovedCount: toNumber(summary.agentExecutionResultCheckpointApprovedCount),
      agentExecutionResultCheckpointDeferredCount: toNumber(summary.agentExecutionResultCheckpointDeferredCount),
      agentExecutionResultCheckpointDismissedCount: toNumber(summary.agentExecutionResultCheckpointDismissedCount),
      agentExecutionResultCheckpointNeedsReviewCount: toNumber(summary.agentExecutionResultCheckpointNeedsReviewCount),
      agentExecutionResultCheckpointUnresolvedCount: toNumber(summary.agentExecutionResultCheckpointUnresolvedCount),
      agentExecutionResultCheckpointRequiredCount: executionResultCheckpointRequiredCount,
      agentExecutionResultBaselineBlockedCount: executionResultBaselineBlockedCount,
      agentExecutionResultRequirements: governance.agentExecutionResultRequirements || null,
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
      dataSourcesAccessValidationWorkflowTotalCount: toNumber(dataSourcesAccessValidationWorkflowSummary.total || summary.dataSourcesAccessValidationWorkflowTotalCount),
      dataSourcesAccessValidationWorkflowReadyCount: toNumber(dataSourcesAccessValidationWorkflowSummary.ready || summary.dataSourcesAccessValidationWorkflowReadyCount),
      dataSourcesAccessValidationWorkflowPendingCount: toNumber(dataSourcesAccessValidationWorkflowSummary.pending || summary.dataSourcesAccessValidationWorkflowPendingCount),
      dataSourcesAccessValidationWorkflowBlockedCount: toNumber(dataSourcesAccessValidationWorkflowSummary.blocked || summary.dataSourcesAccessValidationWorkflowBlockedCount),
      dataSourcesAccessValidationWorkflowMissingEvidenceCount: toNumber(dataSourcesAccessValidationWorkflowSummary.missingEvidence || summary.dataSourcesAccessValidationWorkflowMissingEvidenceCount),
      dataSourcesAccessValidationWorkflow,
      dataSourceAccessValidationWorkflowSnapshotCount: toNumber(summary.dataSourceAccessValidationWorkflowSnapshotCount),
      dataSourceAccessValidationWorkflowSnapshotHasDrift: Boolean(summary.dataSourceAccessValidationWorkflowSnapshotHasDrift),
      dataSourceAccessValidationWorkflowSnapshotDriftScore: toNumber(summary.dataSourceAccessValidationWorkflowSnapshotDriftScore),
      dataSourceAccessValidationWorkflowSnapshotDriftSeverity: dataSourceAccessValidationWorkflowSnapshotDriftSeverity,
      dataSourceAccessValidationWorkflowSnapshots: (Array.isArray(governance.dataSourceAccessValidationWorkflowSnapshots) ? governance.dataSourceAccessValidationWorkflowSnapshots : []).slice(0, 12),
      dataSourceAccessValidationWorkflowSnapshotDiff: governance.dataSourceAccessValidationWorkflowSnapshotDiff || null,
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
      sourceAccessCheckpointCount: toNumber(summary.sourceAccessCheckpointCount),
      sourceAccessCheckpointApprovedCount: toNumber(summary.sourceAccessCheckpointApprovedCount),
      sourceAccessCheckpointDeferredCount: toNumber(summary.sourceAccessCheckpointDeferredCount),
      sourceAccessCheckpointDismissedCount: toNumber(summary.sourceAccessCheckpointDismissedCount),
      sourceAccessCheckpointNeedsReviewCount: toNumber(summary.sourceAccessCheckpointNeedsReviewCount),
      sourceAccessCheckpointUnresolvedCount,
      sourceAccessCheckpointSources: toNumber(summary.sourceAccessCheckpointSources),
      sourceAccessCheckpointBySource: Array.isArray(summary.sourceAccessCheckpointBySource) ? summary.sourceAccessCheckpointBySource : [],
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
   * @param {{ dataSourcesAccessGate?: Record<string, unknown> | null, dataSourcesAccessReviewQueue?: Record<string, unknown> | null, dataSourcesAccessValidationRunbook?: Record<string, unknown> | null, dataSourcesAccessValidationWorkflow?: Record<string, unknown> | null, releaseBuildGate?: Record<string, unknown> | null }} options
   */
  function createAgentControlPlaneDecisionSnapshotRecord(governance, payload = {}, options = {}) {
    const decision = createAgentControlPlaneDecisionPayload(governance, {
      dataSourcesAccessGate: options.dataSourcesAccessGate || null,
      dataSourcesAccessReviewQueue: options.dataSourcesAccessReviewQueue || null,
      dataSourcesAccessValidationRunbook: options.dataSourcesAccessValidationRunbook || null,
      dataSourcesAccessValidationWorkflow: options.dataSourcesAccessValidationWorkflow || null,
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
      agentExecutionResultTaskCount: decision.agentExecutionResultTaskCount,
      agentExecutionResultOpenTaskCount: decision.agentExecutionResultOpenTaskCount,
      agentExecutionResultClosedTaskCount: decision.agentExecutionResultClosedTaskCount,
      agentExecutionResultTasks: decision.agentExecutionResultTasks,
      activeRuns: decision.activeRuns,
      staleActiveRuns: decision.staleActiveRuns,
      slaBreachedRuns: decision.slaBreachedRuns,
      agentReadyProjects: decision.agentReadyProjects,
      agentReadinessItems: decision.agentReadinessItems,
      agentExecutionResultCheckpointCount: decision.agentExecutionResultCheckpointCount,
      agentExecutionResultCheckpointApprovedCount: decision.agentExecutionResultCheckpointApprovedCount,
      agentExecutionResultCheckpointDeferredCount: decision.agentExecutionResultCheckpointDeferredCount,
      agentExecutionResultCheckpointDismissedCount: decision.agentExecutionResultCheckpointDismissedCount,
      agentExecutionResultCheckpointNeedsReviewCount: decision.agentExecutionResultCheckpointNeedsReviewCount,
      agentExecutionResultCheckpointUnresolvedCount: decision.agentExecutionResultCheckpointUnresolvedCount,
      agentExecutionResultCheckpointRequiredCount: decision.agentExecutionResultCheckpointRequiredCount,
      agentExecutionResultBaselineBlockedCount: decision.agentExecutionResultBaselineBlockedCount,
      agentExecutionResultRequirements: decision.agentExecutionResultRequirements,
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
      dataSourcesAccessValidationWorkflowTotalCount: decision.dataSourcesAccessValidationWorkflowTotalCount,
      dataSourcesAccessValidationWorkflowReadyCount: decision.dataSourcesAccessValidationWorkflowReadyCount,
      dataSourcesAccessValidationWorkflowPendingCount: decision.dataSourcesAccessValidationWorkflowPendingCount,
      dataSourcesAccessValidationWorkflowBlockedCount: decision.dataSourcesAccessValidationWorkflowBlockedCount,
      dataSourcesAccessValidationWorkflowMissingEvidenceCount: decision.dataSourcesAccessValidationWorkflowMissingEvidenceCount,
      dataSourcesAccessValidationWorkflow: decision.dataSourcesAccessValidationWorkflow,
      dataSourceAccessValidationWorkflowSnapshotCount: decision.dataSourceAccessValidationWorkflowSnapshotCount,
      dataSourceAccessValidationWorkflowSnapshotHasDrift: decision.dataSourceAccessValidationWorkflowSnapshotHasDrift,
      dataSourceAccessValidationWorkflowSnapshotDriftScore: decision.dataSourceAccessValidationWorkflowSnapshotDriftScore,
      dataSourceAccessValidationWorkflowSnapshotDriftSeverity: decision.dataSourceAccessValidationWorkflowSnapshotDriftSeverity,
      dataSourceAccessValidationWorkflowSnapshots: decision.dataSourceAccessValidationWorkflowSnapshots,
      dataSourceAccessValidationWorkflowSnapshotDiff: decision.dataSourceAccessValidationWorkflowSnapshotDiff,
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
      sourceAccessCheckpointCount: decision.sourceAccessCheckpointCount,
      sourceAccessCheckpointApprovedCount: decision.sourceAccessCheckpointApprovedCount,
      sourceAccessCheckpointDeferredCount: decision.sourceAccessCheckpointDeferredCount,
      sourceAccessCheckpointDismissedCount: decision.sourceAccessCheckpointDismissedCount,
      sourceAccessCheckpointNeedsReviewCount: decision.sourceAccessCheckpointNeedsReviewCount,
      sourceAccessCheckpointUnresolvedCount: decision.sourceAccessCheckpointUnresolvedCount,
      sourceAccessCheckpointSources: decision.sourceAccessCheckpointSources,
      sourceAccessCheckpointBySource: decision.sourceAccessCheckpointBySource,
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
    const dataSourcesAccessValidationWorkflow = toControlPlaneRecord(payload.dataSourcesAccessValidationWorkflow);
    const dataSourcesAccessValidationWorkflowSummary = toControlPlaneRecord(dataSourcesAccessValidationWorkflow.summary);
    const dataSourcesAccessValidationWorkflowItems = Array.isArray(dataSourcesAccessValidationWorkflow.items) ? dataSourcesAccessValidationWorkflow.items : [];
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
      releaseTaskLedgerSnapshots: summaryCount("releaseTaskLedgerSnapshotCount", getControlPlaneList(payload, "releaseTaskLedgerSnapshots").length),
      agentControlPlaneDecisionTasks: summaryCount("agentControlPlaneDecisionTaskCount", getControlPlaneList(payload, "agentControlPlaneDecisionTasks").length),
      agentControlPlaneDecisionOpenTasks: summaryCount("agentControlPlaneDecisionOpenTaskCount", 0),
      agentControlPlaneDecisionClosedTasks: summaryCount("agentControlPlaneDecisionClosedTaskCount", 0),
      governanceTaskUpdateLedgerSnapshots: summaryCount("governanceTaskUpdateLedgerSnapshotCount", getControlPlaneList(payload, "governanceTaskUpdateLedgerSnapshots").length),
      agentControlPlaneDecisionTaskLedgerSnapshots: summaryCount("agentControlPlaneDecisionTaskLedgerSnapshotCount", getControlPlaneList(payload, "agentControlPlaneDecisionTaskLedgerSnapshots").length),
      agentExecutionResultTaskLedgerSnapshots: summaryCount("agentExecutionResultTaskLedgerSnapshotCount", getControlPlaneList(payload, "agentExecutionResultTaskLedgerSnapshots").length),
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
      dataSourcesAccessValidationWorkflow: summaryCount("dataSourcesAccessValidationWorkflowTotalCount", dataSourcesAccessValidationWorkflowItems.length),
      dataSourcesAccessValidationWorkflowReady: summaryCount("dataSourcesAccessValidationWorkflowReadyCount", toNumber(dataSourcesAccessValidationWorkflowSummary.ready)),
      dataSourcesAccessValidationWorkflowPending: summaryCount("dataSourcesAccessValidationWorkflowPendingCount", toNumber(dataSourcesAccessValidationWorkflowSummary.pending)),
      dataSourcesAccessValidationWorkflowBlocked: summaryCount("dataSourcesAccessValidationWorkflowBlockedCount", toNumber(dataSourcesAccessValidationWorkflowSummary.blocked)),
      dataSourcesAccessValidationWorkflowMissingEvidence: summaryCount("dataSourcesAccessValidationWorkflowMissingEvidenceCount", toNumber(dataSourcesAccessValidationWorkflowSummary.missingEvidence)),
      dataSourceAccessValidationWorkflowSnapshots: summaryCount("dataSourceAccessValidationWorkflowSnapshotCount", getControlPlaneList(payload, "dataSourceAccessValidationWorkflowSnapshots").length),
      dataSourceAccessValidationWorkflowSnapshotDriftScore: summaryCount("dataSourceAccessValidationWorkflowSnapshotDriftScore", 0),
      dataSourcesAccessValidationEvidence: summaryCount("dataSourcesAccessValidationEvidenceCount", getControlPlaneList(payload, "dataSourceAccessValidationEvidence").length),
      dataSourcesAccessValidationEvidenceValidated: summaryCount("dataSourcesAccessValidationEvidenceValidatedCount", getControlPlaneList(payload, "dataSourceAccessValidationEvidence").filter((item) => toText(toControlPlaneRecord(item).status) === "validated").length),
      dataSourcesAccessValidationEvidenceReview: summaryCount("dataSourcesAccessValidationEvidenceReviewCount", getControlPlaneList(payload, "dataSourceAccessValidationEvidence").filter((item) => toText(toControlPlaneRecord(item).status) === "review").length),
      dataSourcesAccessValidationEvidenceBlocked: summaryCount("dataSourcesAccessValidationEvidenceBlockedCount", getControlPlaneList(payload, "dataSourceAccessValidationEvidence").filter((item) => toText(toControlPlaneRecord(item).status) === "blocked").length),
      dataSourcesAccessValidationEvidenceCoverage: summaryCount("dataSourcesAccessValidationEvidenceCoverageCount", toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.sourceCount)),
      dataSourcesAccessValidationEvidenceCoverageCovered: summaryCount("dataSourcesAccessValidationEvidenceCoverageCoveredCount", toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.covered)),
      dataSourcesAccessValidationEvidenceCoverageMissing: summaryCount("dataSourcesAccessValidationEvidenceCoverageMissingCount", toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.missing)),
      dataSourcesAccessValidationEvidenceCoverageHighPriority: summaryCount("dataSourcesAccessValidationEvidenceCoverageHighPriorityCount", toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.highPriority)),
      dataSourcesAccessValidationEvidenceCoveragePercent: summaryCount("dataSourcesAccessValidationEvidenceCoveragePercent", toNumber(dataSourcesAccessValidationEvidenceCoverageSummary.coveragePercent)),
      sourceAccessCheckpoints: summaryCount("sourceAccessCheckpointCount", 0),
      sourceAccessCheckpointUnresolved: summaryCount("sourceAccessCheckpointUnresolvedCount", 0),
      sourceAccessCheckpointNeedsReview: summaryCount("sourceAccessCheckpointNeedsReviewCount", 0),
      sourceAccessCheckpointDeferred: summaryCount("sourceAccessCheckpointDeferredCount", 0),
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
        ["Release task ledger snapshots", "releaseTaskLedgerSnapshots"],
        ["Control Plane decision tasks", "agentControlPlaneDecisionTasks"],
        ["Control Plane decision open tasks", "agentControlPlaneDecisionOpenTasks"],
        ["Control Plane decision closed tasks", "agentControlPlaneDecisionClosedTasks"],
        ["Governance task update audit ledger snapshots", "governanceTaskUpdateLedgerSnapshots"],
        ["Control Plane decision task ledger snapshots", "agentControlPlaneDecisionTaskLedgerSnapshots"],
        ["Execution Result task ledger snapshots", "agentExecutionResultTaskLedgerSnapshots"]
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
      ["Data Sources access validation workflow", "dataSourcesAccessValidationWorkflow"],
      ["Data Sources access validation workflow ready", "dataSourcesAccessValidationWorkflowReady"],
      ["Data Sources access validation workflow pending", "dataSourcesAccessValidationWorkflowPending"],
      ["Data Sources access validation workflow blocked", "dataSourcesAccessValidationWorkflowBlocked"],
      ["Data Sources access validation workflow missing evidence", "dataSourcesAccessValidationWorkflowMissingEvidence"],
      ["Data Sources access validation workflow snapshots", "dataSourceAccessValidationWorkflowSnapshots"],
      ["Data Sources access validation workflow snapshot drift score", "dataSourceAccessValidationWorkflowSnapshotDriftScore"],
      ["Data Sources access validation evidence", "dataSourcesAccessValidationEvidence"],
      ["Data Sources access validation evidence validated", "dataSourcesAccessValidationEvidenceValidated"],
      ["Data Sources access validation evidence review", "dataSourcesAccessValidationEvidenceReview"],
      ["Data Sources access validation evidence blocked", "dataSourcesAccessValidationEvidenceBlocked"],
      ["Data Sources access validation evidence coverage", "dataSourcesAccessValidationEvidenceCoverage"],
      ["Data Sources access validation evidence coverage covered", "dataSourcesAccessValidationEvidenceCoverageCovered"],
      ["Data Sources access validation evidence coverage missing", "dataSourcesAccessValidationEvidenceCoverageMissing"],
      ["Data Sources access validation evidence coverage high priority", "dataSourcesAccessValidationEvidenceCoverageHighPriority"],
      ["Data Sources access validation evidence coverage percent", "dataSourcesAccessValidationEvidenceCoveragePercent"],
      ["Source access checkpoints", "sourceAccessCheckpoints"],
      ["Source access unresolved checkpoints", "sourceAccessCheckpointUnresolved"],
      ["Source access needs-review checkpoints", "sourceAccessCheckpointNeedsReview"],
      ["Source access deferred checkpoints", "sourceAccessCheckpointDeferred"],
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
      ["Task Update Audit Ledger Snapshot Drift", toControlPlaneRecord(diff.governanceTaskUpdateLedgerSnapshots)],
      ["Release Task Ledger Snapshot Drift", toControlPlaneRecord(diff.releaseTaskLedgerSnapshots)],
      ["Data Sources Access Validation Workflow Snapshot Drift", toControlPlaneRecord(diff.dataSourceAccessValidationWorkflowSnapshots)],
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
    const governanceTaskUpdateLedgerSnapshots = createAgentControlPlaneCollectionDrift(
      getControlPlaneList(snapshotPayload, "governanceTaskUpdateLedgerSnapshots"),
      getControlPlaneList(currentPayload, "governanceTaskUpdateLedgerSnapshots"),
      {
        getKey: (item) => toText(item.id) || toText(item.title),
        describe: describeControlPlaneSnapshotItem
      }
    );
    const releaseTaskLedgerSnapshots = createAgentControlPlaneCollectionDrift(
      getControlPlaneList(snapshotPayload, "releaseTaskLedgerSnapshots"),
      getControlPlaneList(currentPayload, "releaseTaskLedgerSnapshots"),
      {
        getKey: (item) => toText(item.id) || toText(item.title),
        describe: describeControlPlaneSnapshotItem
      }
    );
    const dataSourceAccessValidationWorkflowSnapshots = createAgentControlPlaneCollectionDrift(
      getControlPlaneList(snapshotPayload, "dataSourceAccessValidationWorkflowSnapshots"),
      getControlPlaneList(currentPayload, "dataSourceAccessValidationWorkflowSnapshots"),
      {
        getKey: (item) => toText(item.id) || toText(item.title),
        describe: describeControlPlaneSnapshotItem,
        hasChanged: (before, current) => hasControlPlaneFieldDrift(before, current, ["readyCount", "pendingCount", "blockedCount", "missingEvidenceCount"]),
        describeChange: (before, current) => `${toText(current.title) || toText(before.title) || "Workflow snapshot"}: ${toNumber(before.readyCount)}/${toNumber(before.pendingCount)}/${toNumber(before.blockedCount)} -> ${toNumber(current.readyCount)}/${toNumber(current.pendingCount)}/${toNumber(current.blockedCount)}`
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
      + governanceTaskUpdateLedgerSnapshots.addedCount + governanceTaskUpdateLedgerSnapshots.removedCount + governanceTaskUpdateLedgerSnapshots.changedCount
      + releaseTaskLedgerSnapshots.addedCount + releaseTaskLedgerSnapshots.removedCount + releaseTaskLedgerSnapshots.changedCount
      + dataSourceAccessValidationWorkflowSnapshots.addedCount + dataSourceAccessValidationWorkflowSnapshots.removedCount + dataSourceAccessValidationWorkflowSnapshots.changedCount
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
      governanceTaskUpdateLedgerSnapshots,
      releaseTaskLedgerSnapshots,
      dataSourceAccessValidationWorkflowSnapshots,
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
      { field: "governance-task-update-ledger-snapshots", label: "Task Update Audit Ledger Snapshots", section: toControlPlaneRecord(diff.governanceTaskUpdateLedgerSnapshots) },
      { field: "release-task-ledger-snapshots", label: "Release Task Ledger Snapshots", section: toControlPlaneRecord(diff.releaseTaskLedgerSnapshots) },
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
      governanceTaskUpdateLedgerSnapshots: { addedCount: 0, removedCount: 0, changedCount: 0, added: [], removed: [], changed: [] },
      releaseTaskLedgerSnapshots: { addedCount: 0, removedCount: 0, changedCount: 0, added: [], removed: [], changed: [] },
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
   * @param {{ dataSourcesAccessGate?: Record<string, unknown> | null, dataSourcesAccessReviewQueue?: Record<string, unknown> | null, dataSourcesAccessValidationRunbook?: Record<string, unknown> | null, dataSourcesAccessValidationWorkflow?: Record<string, unknown> | null, releaseBuildGate?: Record<string, unknown> | null }} options
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
      dataSourcesAccessValidationWorkflow: options.dataSourcesAccessValidationWorkflow || null,
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
   * @param {{ dataSourcesAccessGate?: Record<string, unknown> | null, dataSourcesAccessReviewQueue?: Record<string, unknown> | null, dataSourcesAccessValidationRunbook?: Record<string, unknown> | null, dataSourcesAccessValidationWorkflow?: Record<string, unknown> | null, releaseBuildGate?: Record<string, unknown> | null }} options
   */
  function createAgentControlPlaneSnapshotRecord(governance, payload = {}, options = {}) {
    const controlPlane = createAgentControlPlanePayload(governance, {
      limit: Number(payload.limit || 24),
      dataSourcesAccessGate: options.dataSourcesAccessGate || null,
      dataSourcesAccessReviewQueue: options.dataSourcesAccessReviewQueue || null,
      dataSourcesAccessValidationRunbook: options.dataSourcesAccessValidationRunbook || null,
      dataSourcesAccessValidationWorkflow: options.dataSourcesAccessValidationWorkflow || null,
      releaseBuildGate: options.releaseBuildGate || null
    });

    return {
      id: createId("agent-control-plane-snapshot"),
      title: String(payload.title || "Agent Control Plane").trim() || "Agent Control Plane",
      limit: controlPlane.limit,
      totalWorkOrders: controlPlane.workOrders.total,
      totalExecutionRuns: controlPlane.executionRuns.length,
      totalExecutionResultCheckpoints: controlPlane.executionResultCheckpoints.length,
      executionResultCheckpointRequiredCount: toNumber(controlPlane.summary?.agentExecutionResultCheckpointRequiredCount),
      executionResultBaselineBlockedCount: toNumber(controlPlane.summary?.agentExecutionResultBaselineBlockedCount),
      executionResultCheckpoints: controlPlane.executionResultCheckpoints,
      executionResultTaskCount: toNumber(controlPlane.summary?.agentExecutionResultTaskCount),
      executionResultOpenTaskCount: toNumber(controlPlane.summary?.agentExecutionResultOpenTaskCount),
      executionResultClosedTaskCount: toNumber(controlPlane.summary?.agentExecutionResultClosedTaskCount),
      executionResultTasks: controlPlane.executionResultTasks,
      executionResultRequirements: controlPlane.executionResultRequirements,
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
      governanceTaskUpdateLedgerSnapshotCount: toNumber(controlPlane.summary?.governanceTaskUpdateLedgerSnapshotCount),
      governanceTaskUpdateLedgerSnapshots: controlPlane.governanceTaskUpdateLedgerSnapshots,
      agentControlPlaneDecisionTaskLedgerSnapshotCount: toNumber(controlPlane.summary?.agentControlPlaneDecisionTaskLedgerSnapshotCount),
      agentControlPlaneDecisionTaskLedgerSnapshots: controlPlane.agentControlPlaneDecisionTaskLedgerSnapshots,
      agentExecutionResultTaskLedgerSnapshotCount: toNumber(controlPlane.summary?.agentExecutionResultTaskLedgerSnapshotCount),
      agentExecutionResultTaskLedgerSnapshots: controlPlane.agentExecutionResultTaskLedgerSnapshots,
      dataSourcesGateDecision: toText(controlPlane.dataSourcesAccessGate?.decision) || "not-evaluated",
      dataSourcesReview: toNumber(controlPlane.dataSourcesAccessGate?.review),
      dataSourcesBlocked: toNumber(controlPlane.dataSourcesAccessGate?.blocked),
      dataSourcesAccessGate: controlPlane.dataSourcesAccessGate,
      dataSourcesAccessReviewQueueCount: toNumber(controlPlane.dataSourcesAccessReviewQueue?.summary?.total),
      dataSourcesAccessReviewQueue: controlPlane.dataSourcesAccessReviewQueue,
      dataSourcesAccessValidationMethodCount: toNumber(controlPlane.dataSourcesAccessValidationRunbook?.summary?.methodCount),
      dataSourcesAccessValidationSourceCount: toNumber(controlPlane.dataSourcesAccessValidationRunbook?.summary?.sourceCount),
      dataSourcesAccessValidationRunbook: controlPlane.dataSourcesAccessValidationRunbook,
      dataSourcesAccessValidationWorkflowTotalCount: toNumber(controlPlane.summary?.dataSourcesAccessValidationWorkflowTotalCount),
      dataSourcesAccessValidationWorkflowReadyCount: toNumber(controlPlane.summary?.dataSourcesAccessValidationWorkflowReadyCount),
      dataSourcesAccessValidationWorkflowPendingCount: toNumber(controlPlane.summary?.dataSourcesAccessValidationWorkflowPendingCount),
      dataSourcesAccessValidationWorkflowBlockedCount: toNumber(controlPlane.summary?.dataSourcesAccessValidationWorkflowBlockedCount),
      dataSourcesAccessValidationWorkflowMissingEvidenceCount: toNumber(controlPlane.summary?.dataSourcesAccessValidationWorkflowMissingEvidenceCount),
      dataSourcesAccessValidationWorkflow: controlPlane.dataSourcesAccessValidationWorkflow,
      dataSourceAccessValidationWorkflowSnapshotCount: toNumber(controlPlane.summary?.dataSourceAccessValidationWorkflowSnapshotCount),
      dataSourceAccessValidationWorkflowSnapshotHasDrift: Boolean(controlPlane.summary?.dataSourceAccessValidationWorkflowSnapshotHasDrift),
      dataSourceAccessValidationWorkflowSnapshotDriftScore: toNumber(controlPlane.summary?.dataSourceAccessValidationWorkflowSnapshotDriftScore),
      dataSourceAccessValidationWorkflowSnapshotDriftSeverity: toText(controlPlane.summary?.dataSourceAccessValidationWorkflowSnapshotDriftSeverity) || "missing-snapshot",
      dataSourceAccessValidationWorkflowSnapshots: controlPlane.dataSourceAccessValidationWorkflowSnapshots,
      dataSourceAccessValidationWorkflowSnapshotDiff: controlPlane.dataSourceAccessValidationWorkflowSnapshotDiff,
      dataSourcesAccessValidationEvidenceCount: toNumber(controlPlane.summary?.dataSourcesAccessValidationEvidenceCount),
      dataSourcesAccessValidationEvidenceValidatedCount: toNumber(controlPlane.summary?.dataSourcesAccessValidationEvidenceValidatedCount),
      dataSourcesAccessValidationEvidenceCoverageCount: toNumber(controlPlane.summary?.dataSourcesAccessValidationEvidenceCoverageCount),
      dataSourcesAccessValidationEvidenceCoverageCoveredCount: toNumber(controlPlane.summary?.dataSourcesAccessValidationEvidenceCoverageCoveredCount),
      dataSourcesAccessValidationEvidenceCoverageMissingCount: toNumber(controlPlane.summary?.dataSourcesAccessValidationEvidenceCoverageMissingCount),
      dataSourcesAccessValidationEvidenceCoverageHighPriorityCount: toNumber(controlPlane.summary?.dataSourcesAccessValidationEvidenceCoverageHighPriorityCount),
      dataSourcesAccessValidationEvidenceCoveragePercent: toNumber(controlPlane.summary?.dataSourcesAccessValidationEvidenceCoveragePercent),
      dataSourcesAccessValidationEvidenceCoverage: controlPlane.dataSourcesAccessValidationEvidenceCoverage,
      sourceAccessCheckpointCount: toNumber(controlPlane.summary?.sourceAccessCheckpointCount),
      sourceAccessCheckpointApprovedCount: toNumber(controlPlane.summary?.sourceAccessCheckpointApprovedCount),
      sourceAccessCheckpointDeferredCount: toNumber(controlPlane.summary?.sourceAccessCheckpointDeferredCount),
      sourceAccessCheckpointDismissedCount: toNumber(controlPlane.summary?.sourceAccessCheckpointDismissedCount),
      sourceAccessCheckpointNeedsReviewCount: toNumber(controlPlane.summary?.sourceAccessCheckpointNeedsReviewCount),
      sourceAccessCheckpointUnresolvedCount: toNumber(controlPlane.summary?.sourceAccessCheckpointUnresolvedCount),
      sourceAccessCheckpointSources: toNumber(controlPlane.summary?.sourceAccessCheckpointSources),
      sourceAccessCheckpointBySource: Array.isArray(controlPlane.summary?.sourceAccessCheckpointBySource) ? controlPlane.summary.sourceAccessCheckpointBySource : [],
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
      privateRepoLikely: false,
      manualAccessLikely: false,
      localPathLikely: false,
      gitRemoteLikely: false,
      githubRemoteLikely: false,
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
      profile.localPathLikely = true;
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
      profile.privateRepoLikely = true;
      profile.gitRemoteLikely = true;
      profile.githubRemoteLikely = true;
      profile.credentialHints.push(isSsh ? "SSH private key loaded in ssh-agent" : "Git Credential Manager, OAuth session, or personal access token for private repositories");
      profile.notes.push("Public repositories may be readable without credentials; private repositories require GitHub authorization.");
      profile.notes.push("Do not paste GitHub tokens into the source URL.");
      return profile;
    }

    if (isSsh || /\.git(?:$|[?#])/i.test(value) || ["gitlab.com", "bitbucket.org"].some((host) => sourceHost === host || sourceHost.endsWith(`.${host}`))) {
      profile.accessLevel = "repository-access-unknown";
      profile.accessMethod = isSsh ? "git-ssh" : "git-https";
      profile.requiresReview = true;
      profile.sshKeyLikely = isSsh;
      profile.tokenLikely = !isSsh;
      profile.privateRepoLikely = true;
      profile.gitRemoteLikely = true;
      profile.credentialHints.push(isSsh ? "SSH private key loaded in ssh-agent" : "Git Credential Manager, OAuth session, or provider-managed token for private repositories");
      profile.notes.push("Git remotes may be public, but private repositories require provider authorization outside this app.");
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
      profile.manualAccessLikely = true;
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
      profile.privateRepoLikely = true;
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
    const isSsh = /^git@|^ssh:\/\//i.test(value);
    const isLocal = type === "local" || (value && !/^https?:\/\//i.test(value) && !isSsh);
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
    } else if (isSsh) {
      status = "registered";
      health = "review";
      issue = "SSH Git remote requires external access validation.";
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
      `Source-access checkpoints: ${toNumber(payload.summary.sourceAccessCheckpointUnresolvedCount)} unresolved / ${toNumber(payload.summary.sourceAccessCheckpointCount)} total`,
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
      const sourceCheckpoints = toControlPlaneRecord(source.sourceAccessCheckpoints);
      if (toNumber(sourceCheckpoints.total) > 0) {
        lines.push(`  Source-access checkpoints: ${toNumber(sourceCheckpoints.unresolved)} unresolved / ${toNumber(sourceCheckpoints.total)} total`);
      }
    }

    if (!payload.sources.length) {
      lines.push("- No sources configured.");
    }

    return lines.join("\n");
  }

  async function createSourcesSummaryPayload() {
    const [sources, persisted] = await Promise.all([
      getSourcesPayload(),
      store.readStore()
    ]);
    const sourceAccessCheckpointSummary = createSourceAccessCheckpointSummary(persisted.taskSeedingCheckpoints);
    const rawRecords = await Promise.all(sources.map((source, index) => createSourceHealthRecord(toControlPlaneRecord(source), index)));
    const records = rawRecords.map((record) => ({
      ...record,
      sourceAccessCheckpoints: createSourceAccessCheckpointDrilldown(persisted.taskSeedingCheckpoints, record)
    }));
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
      sourceAccessCheckpointCount: sourceAccessCheckpointSummary.total,
      sourceAccessCheckpointApprovedCount: sourceAccessCheckpointSummary.approved,
      sourceAccessCheckpointDeferredCount: sourceAccessCheckpointSummary.deferred,
      sourceAccessCheckpointDismissedCount: sourceAccessCheckpointSummary.dismissed,
      sourceAccessCheckpointNeedsReviewCount: sourceAccessCheckpointSummary.needsReview,
      sourceAccessCheckpointUnresolvedCount: sourceAccessCheckpointSummary.unresolved,
      sourceAccessCheckpointSources: sourceAccessCheckpointSummary.sources,
      sourceAccessCheckpointBySource: sourceAccessCheckpointSummary.bySource,
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
  function buildAgentExecutionResultTaskLedgerMarkdown(payload) {
    const summary = toControlPlaneRecord(payload.summary);
    const items = Array.isArray(payload.items) ? payload.items : [];
    const lines = [
      "# Agent Execution Result Task Ledger",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Status filter: ${toText(payload.status) || "all"}`,
      `Secret policy: ${toText(payload.secretPolicy) || "Non-secret execution-result follow-up task metadata only."}`,
      "",
      "## Summary",
      `- Total tasks: ${toNumber(summary.total)}`,
      `- Open tasks: ${toNumber(summary.open)}`,
      `- Closed tasks: ${toNumber(summary.closed)}`,
      `- Visible tasks: ${toNumber(summary.visible)}`,
      `- Unique actions: ${toNumber(summary.actionCount)}`,
      `- Priority split: ${toNumber(summary.high)} high / ${toNumber(summary.medium)} medium / ${toNumber(summary.low)} low / ${toNumber(summary.normal)} normal`,
      "",
      "## Tasks"
    ];

    if (items.length) {
      for (const item of items) {
        const record = toControlPlaneRecord(item);
        lines.push(`- ${toText(record.priority) || "normal"} ${toText(record.status) || "open"}: ${toText(record.title) || "Execution result follow-up task"}`);
        lines.push(`  Run: ${toText(record.agentExecutionResultRunId) || "unknown"} | Action: ${toText(record.agentExecutionResultTargetAction) || "review"} | Checkpoint: ${toText(record.agentExecutionResultCheckpointStatus) || "deferred"}`);
        if (toText(record.agentExecutionResultRunTitle)) {
          lines.push(`  Run title: ${toText(record.agentExecutionResultRunTitle)}`);
        }
        lines.push(`  Updated: ${toText(record.updatedAt) || toText(record.createdAt) || "not recorded"} | Secret policy: ${toText(record.secretPolicy) || "non-secret-execution-result-follow-up-evidence-only"}`);
      }
    } else {
      lines.push("- No execution-result follow-up tasks match the current filter.");
    }

    return lines.join("\n");
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {{ status?: string, limit?: number }} [options]
   */
  function createAgentExecutionResultTaskLedgerPayload(persisted, options = {}) {
    const requestedStatus = toText(options.status) || "all";
    const status = ["all", "open", "closed"].includes(requestedStatus) ? requestedStatus : "all";
    const requestedLimit = Number(options.limit || 100);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(250, Math.trunc(requestedLimit)))
      : 100;
    const executionResultTasks = (Array.isArray(persisted.tasks) ? persisted.tasks : [])
      .filter((task) => toText(task.agentExecutionResultRunId) || toText(task.agentExecutionResultCheckpointId))
      .map((task) => {
        const record = toControlPlaneRecord(task);
        return {
          id: toText(record.id),
          title: toText(record.title) || `Execution result follow-up: ${toText(record.agentExecutionResultTargetAction) || "review"}`,
          status: toText(record.status) || "open",
          priority: toText(record.priority) || "normal",
          projectId: toText(record.projectId) || "agent-execution-result",
          projectName: toText(record.projectName) || "Agent Execution Result",
          agentExecutionResultCheckpointId: toText(record.agentExecutionResultCheckpointId),
          agentExecutionResultRunId: toText(record.agentExecutionResultRunId),
          agentExecutionResultRunTitle: toText(record.agentExecutionResultRunTitle),
          agentExecutionResultRunStatus: toText(record.agentExecutionResultRunStatus),
          agentExecutionResultTargetAction: toText(record.agentExecutionResultTargetAction) || "review",
          agentExecutionResultCheckpointStatus: toText(record.agentExecutionResultCheckpointStatus) || "deferred",
          agentExecutionResultResultType: toText(record.agentExecutionResultResultType) || "execution-result",
          description: toText(record.description),
          secretPolicy: toText(record.secretPolicy) || "non-secret-execution-result-follow-up-evidence-only",
          createdAt: toText(record.createdAt),
          updatedAt: toText(record.updatedAt || record.createdAt)
        };
      })
      .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime());

    const openTasks = executionResultTasks.filter((task) => !isGovernanceClosedStatus(task.status));
    const closedTasks = executionResultTasks.filter((task) => isGovernanceClosedStatus(task.status));
    const visibleTasks = status === "open"
      ? openTasks
      : status === "closed"
        ? closedTasks
        : executionResultTasks;
    const actionCounts = {};
    const actionCodes = new Set();
    for (const task of executionResultTasks) {
      const action = toText(task.agentExecutionResultTargetAction) || "review";
      actionCounts[action] = toNumber(actionCounts[action]) + 1;
      actionCodes.add(action);
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      status,
      limit,
      secretPolicy: "Non-secret Agent Execution Result follow-up task metadata only. Resolve credentials, provider tokens, cookies, private keys, certificates, browser sessions, and command output outside this app.",
      summary: {
        total: executionResultTasks.length,
        open: openTasks.length,
        closed: closedTasks.length,
        visible: Math.min(visibleTasks.length, limit),
        high: executionResultTasks.filter((task) => task.priority === "high").length,
        medium: executionResultTasks.filter((task) => task.priority === "medium").length,
        low: executionResultTasks.filter((task) => task.priority === "low").length,
        normal: executionResultTasks.filter((task) => !["high", "medium", "low"].includes(task.priority)).length,
        actionCount: actionCodes.size,
        actionCounts
      },
      items: visibleTasks.slice(0, limit)
    };

    return {
      ...payload,
      markdown: buildAgentExecutionResultTaskLedgerMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} persisted
   * @param {{ title?: string, status?: string, limit?: number }} [options]
   */
  function createAgentExecutionResultTaskLedgerSnapshotRecord(persisted, options = {}) {
    const ledger = createAgentExecutionResultTaskLedgerPayload(persisted, {
      status: toText(options.status) || "all",
      limit: Number(options.limit || 100)
    });

    return {
      id: createId("agent-execution-result-task-ledger-snapshot"),
      title: toText(options.title) || "Agent Execution Result Task Ledger",
      statusFilter: ledger.status,
      limit: ledger.limit,
      total: ledger.summary.total,
      openCount: ledger.summary.open,
      closedCount: ledger.summary.closed,
      visibleCount: ledger.summary.visible,
      actionCount: ledger.summary.actionCount,
      secretPolicy: ledger.secretPolicy,
      markdown: ledger.markdown,
      items: ledger.items,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildAgentExecutionResultTaskLedgerSnapshotDiffMarkdown(payload) {
    const formatDriftValue = (value) => typeof value === "number" ? String(value) : toText(value);
    const lines = [
      "# Agent Execution Result Task Ledger Snapshot Drift",
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
      lines.push("- No execution-result task ledger drift detected.");
      return lines.join("\n");
    }

    for (const item of driftItems) {
      const record = toControlPlaneRecord(item);
      lines.push(`- ${toText(record.label) || toText(record.field) || "Execution-result task drift"}: ${formatDriftValue(record.before)} -> ${formatDriftValue(record.current)}`);
    }

    return lines.join("\n");
  }

  function createMissingAgentExecutionResultTaskLedgerSnapshotDiffPayload() {
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: false,
      snapshotId: "",
      snapshotTitle: "",
      snapshotCreatedAt: "",
      hasDrift: false,
      driftScore: 0,
      driftSeverity: "missing-snapshot",
      recommendedAction: "Save an execution-result task ledger snapshot before comparing follow-up task drift.",
      driftItems: [],
      liveSummary: null,
      snapshotSummary: null
    };
    return {
      ...payload,
      markdown: buildAgentExecutionResultTaskLedgerSnapshotDiffMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} snapshot
   * @param {ReturnType<typeof createAgentExecutionResultTaskLedgerPayload>} live
   */
  function createAgentExecutionResultTaskLedgerSnapshotDiffPayload(snapshot, live) {
    const driftItems = [];
    const snapshotSummary = {
      total: toNumber(snapshot.total),
      open: toNumber(snapshot.openCount),
      closed: toNumber(snapshot.closedCount),
      visible: toNumber(snapshot.visibleCount),
      actionCount: toNumber(snapshot.actionCount)
    };
    const liveSummary = toControlPlaneRecord(live.summary);
    const countFields = [
      { field: "total", label: "Total execution-result tasks" },
      { field: "open", label: "Open execution-result tasks" },
      { field: "closed", label: "Closed execution-result tasks" },
      { field: "visible", label: "Visible execution-result tasks" },
      { field: "actionCount", label: "Unique execution-result actions" }
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
    const taskKey = (task) => toText(task.id) || [toText(task.agentExecutionResultRunId), toText(task.agentExecutionResultTargetAction)].filter(Boolean).join(":") || toText(task.title);
    const snapshotByKey = new Map(snapshotTasks.map((task) => [taskKey(task), task]));
    const liveByKey = new Map(liveTasks.map((task) => [taskKey(task), task]));

    for (const [key, task] of liveByKey) {
      const previous = snapshotByKey.get(key);
      const label = toText(task.title) || `${toText(task.agentExecutionResultTargetAction) || "review"} on ${toText(task.agentExecutionResultRunId) || key}`;
      if (!previous) {
        driftItems.push({
          field: `execution-result-task:${key}`,
          label: `${label} added`,
          before: "missing",
          current: `${toText(task.status) || "open"} / ${toText(task.priority) || "normal"} / ${toText(task.agentExecutionResultTargetAction) || "review"}`,
          delta: 1
        });
        continue;
      }
      const beforeState = `${toText(previous.status) || "open"} / ${toText(previous.priority) || "normal"} / ${toText(previous.agentExecutionResultTargetAction) || "review"} / ${toText(previous.agentExecutionResultCheckpointStatus) || "deferred"}`;
      const currentState = `${toText(task.status) || "open"} / ${toText(task.priority) || "normal"} / ${toText(task.agentExecutionResultTargetAction) || "review"} / ${toText(task.agentExecutionResultCheckpointStatus) || "deferred"}`;
      if (beforeState !== currentState) {
        driftItems.push({
          field: `execution-result-task:${key}`,
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
          field: `execution-result-task:${key}`,
          label: `${toText(task.title) || toText(task.agentExecutionResultTargetAction) || key} removed`,
          before: `${toText(task.status) || "open"} / ${toText(task.priority) || "normal"} / ${toText(task.agentExecutionResultTargetAction) || "review"}`,
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
      ? "Review new open execution-result follow-up tasks before treating deferred run gates as handled."
      : driftSeverity === "medium"
        ? "Review execution-result task ledger drift and refresh the snapshot if changes are intentional."
        : driftSeverity === "low"
          ? "Monitor low execution-result task ledger drift and refresh the snapshot after confirmation."
          : "No execution-result task ledger drift detected.";
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: true,
      snapshotId: toText(snapshot.id),
      snapshotTitle: toText(snapshot.title) || "Agent Execution Result Task Ledger",
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
      markdown: buildAgentExecutionResultTaskLedgerSnapshotDiffMarkdown(payload)
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
   * @param {{ title?: string, status?: string, limit?: number }} [options]
   */
  function createReleaseTaskLedgerSnapshotRecord(persisted, options = {}) {
    const ledger = createReleaseTaskLedgerPayload(persisted, {
      status: toText(options.status) || "all",
      limit: Number(options.limit || 100)
    });

    return {
      id: createId("release-task-ledger-snapshot"),
      title: toText(options.title) || "Release Control Task Ledger",
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
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildReleaseTaskLedgerSnapshotDiffMarkdown(payload) {
    const formatDriftValue = (value) => typeof value === "number" ? String(value) : toText(value);
    const lines = [
      "# Release Control Task Ledger Snapshot Drift",
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
      lines.push("- No Release Control task ledger drift detected.");
      return lines.join("\n");
    }

    for (const item of driftItems) {
      const record = toControlPlaneRecord(item);
      lines.push(`- ${toText(record.label) || toText(record.field) || "Release Control task drift"}: ${formatDriftValue(record.before)} -> ${formatDriftValue(record.current)}`);
    }

    return lines.join("\n");
  }

  function createMissingReleaseTaskLedgerSnapshotDiffPayload() {
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: false,
      snapshotId: "",
      snapshotTitle: "",
      snapshotCreatedAt: "",
      hasDrift: false,
      driftScore: 0,
      driftSeverity: "missing-snapshot",
      recommendedAction: "Save a Release Control task ledger snapshot before comparing deployment-gate task drift.",
      driftItems: [],
      liveSummary: null,
      snapshotSummary: null
    };
    return {
      ...payload,
      markdown: buildReleaseTaskLedgerSnapshotDiffMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} snapshot
   * @param {ReturnType<typeof createReleaseTaskLedgerPayload>} live
   */
  function createReleaseTaskLedgerSnapshotDiffPayload(snapshot, live) {
    const driftItems = [];
    const snapshotSummary = {
      total: toNumber(snapshot.total),
      open: toNumber(snapshot.openCount),
      closed: toNumber(snapshot.closedCount),
      visible: toNumber(snapshot.visibleCount)
    };
    const liveSummary = toControlPlaneRecord(live.summary);
    const countFields = [
      { field: "total", label: "Total Release Control tasks" },
      { field: "open", label: "Open Release Control tasks" },
      { field: "closed", label: "Closed Release Control tasks" },
      { field: "visible", label: "Visible Release Control tasks" }
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
    const taskKey = (task) => toText(task.id) || toText(task.releaseBuildGateActionId) || `${toText(task.title)}:${toText(task.releaseBuildGateDecision)}`;
    const snapshotByKey = new Map(snapshotTasks.map((task) => [taskKey(task), task]));
    const liveByKey = new Map(liveTasks.map((task) => [taskKey(task), task]));

    for (const [key, task] of liveByKey) {
      const previous = snapshotByKey.get(key);
      const label = toText(task.title) || toText(task.releaseBuildGateActionId) || key;
      if (!previous) {
        driftItems.push({
          field: `release-control-task:${key}`,
          label: `${label} added`,
          before: "missing",
          current: `${toText(task.status) || "open"} / ${toText(task.priority) || "normal"} / ${toText(task.releaseBuildGateDecision) || "review"}`,
          delta: 1
        });
        continue;
      }
      const beforeState = `${toText(previous.status) || "open"} / ${toText(previous.priority) || "normal"} / ${toText(previous.releaseBuildGateDecision) || "review"} / ${toNumber(previous.releaseBuildGateRiskScore)}`;
      const currentState = `${toText(task.status) || "open"} / ${toText(task.priority) || "normal"} / ${toText(task.releaseBuildGateDecision) || "review"} / ${toNumber(task.releaseBuildGateRiskScore)}`;
      if (beforeState !== currentState) {
        driftItems.push({
          field: `release-control-task:${key}`,
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
          field: `release-control-task:${key}`,
          label: `${toText(task.title) || toText(task.releaseBuildGateActionId) || key} removed`,
          before: `${toText(task.status) || "open"} / ${toText(task.priority) || "normal"} / ${toText(task.releaseBuildGateDecision) || "review"}`,
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
      ? "Review new open Release Control tasks before continuing deployment or unattended build work."
      : driftSeverity === "medium"
        ? "Review Release Control task ledger drift and refresh the snapshot if changes are intentional."
        : driftSeverity === "low"
          ? "Monitor low Release Control task drift and refresh the snapshot after confirmation."
          : "No Release Control task ledger drift detected.";
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: true,
      snapshotId: toText(snapshot.id),
      snapshotTitle: toText(snapshot.title) || "Release Control Task Ledger",
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
      markdown: buildReleaseTaskLedgerSnapshotDiffMarkdown(payload)
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

  /**
   * @param {string} accessMethod
   */
  function getSourceAccessRegistryCategory(accessMethod) {
    const method = toText(accessMethod);
    if (method === "local-filesystem" || method === "network-filesystem") return "filesystem";
    if (method === "git-https" || method === "git-ssh") return "git";
    if (method === "provider-token-or-oauth") return "provider-api";
    if (method === "provider-token-or-database-credentials") return "provider-database";
    if (method === "browser-session-or-manual-export") return "manual-session";
    return "provider-review";
  }

  /**
   * @param {Record<string, unknown>} source
   */
  function createSourceAccessRegistrySource(source) {
    const record = toControlPlaneRecord(source);
    const access = toControlPlaneRecord(record.access);
    const accessMethod = toText(access.accessMethod) || "review-required";
    const type = toText(record.type) || "unknown";
    const value = toText(record.value);
    const locator = (() => {
      try {
        const parsed = new URL(value);
        if (parsed.username || parsed.password) {
          parsed.username = "";
          parsed.password = "";
        }
        return parsed.toString();
      } catch {
        return containsLikelySecret(value) ? "[redacted-secret-like-source]" : value;
      }
    })();
    const githubRemoteLikely = Boolean(access.githubRemoteLikely) || type === "github" || value.toLowerCase().includes("github.com");
    const gitRemoteLikely = Boolean(access.gitRemoteLikely) || accessMethod === "git-https" || accessMethod === "git-ssh";
    const localPathLikely = Boolean(access.localPathLikely) || accessMethod === "local-filesystem" || accessMethod === "network-filesystem";
    const manualAccessLikely = Boolean(access.manualAccessLikely) || accessMethod === "browser-session-or-manual-export";
    const privateRepoLikely = Boolean(access.privateRepoLikely) || (gitRemoteLikely && Boolean(access.requiresReview));

    return {
      id: toText(record.id),
      label: toText(record.label) || locator || "Source",
      type,
      locator,
      health: toText(record.health) || "review",
      status: toText(record.status) || "registered",
      accessMethod,
      accessLevel: toText(access.accessLevel) || "unknown",
      requiresReview: Boolean(access.requiresReview),
      localPathLikely,
      gitRemoteLikely,
      githubRemoteLikely,
      privateRepoLikely,
      tokenLikely: Boolean(access.tokenLikely),
      passwordLikely: Boolean(access.passwordLikely),
      certificateLikely: Boolean(access.certificateLikely),
      sshKeyLikely: Boolean(access.sshKeyLikely),
      manualAccessLikely,
      credentialHints: Array.isArray(access.credentialHints) ? access.credentialHints.map(toText).filter(Boolean) : [],
      notes: Array.isArray(access.notes) ? access.notes.map(toText).filter(Boolean) : [],
      secretPolicy: toText(access.secretPolicy) || "Non-secret access method metadata only. Resolve secrets outside this app."
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildSourcesAccessMethodRegistryMarkdown(payload) {
    const methods = Array.isArray(payload.methods) ? payload.methods : [];
    const lines = [
      "# Data Sources Access Method Registry",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Sources: ${toNumber(payload.summary.totalSources)}`,
      `Access methods: ${toNumber(payload.summary.totalMethods)}`,
      `Review required: ${toNumber(payload.summary.reviewRequired)}`,
      `Local path sources: ${toNumber(payload.summary.localPathSources)}`,
      `Git remote sources: ${toNumber(payload.summary.gitRemoteSources)}`,
      `GitHub remote sources: ${toNumber(payload.summary.githubRemoteSources)}`,
      `Private repo likely: ${toNumber(payload.summary.privateRepoLikely)}`,
      `Token/OAuth likely: ${toNumber(payload.summary.tokenLikely)}`,
      `Password/session likely: ${toNumber(payload.summary.passwordLikely)}`,
      `Certificate likely: ${toNumber(payload.summary.certificateLikely)}`,
      `SSH key likely: ${toNumber(payload.summary.sshKeyLikely)}`,
      `Manual access likely: ${toNumber(payload.summary.manualAccessLikely)}`,
      "",
      `Secret policy: ${toText(payload.secretPolicy) || "Non-secret access method metadata only. Do not store credentials in this app."}`,
      "",
      "## Methods"
    ];

    if (!methods.length) {
      lines.push("- No access methods registered.");
      return lines.join("\n");
    }

    for (const method of methods) {
      const record = toControlPlaneRecord(method);
      const sources = Array.isArray(record.sources) ? record.sources : [];
      const commandHints = Array.isArray(record.commandHints) ? record.commandHints.map(toText).filter(Boolean) : [];
      lines.push("");
      lines.push(`### ${toText(record.accessMethod) || "unknown-access-method"}`);
      lines.push(`- Category: ${toText(record.category) || "provider-review"}`);
      lines.push(`- Sources: ${toNumber(record.sourceCount)} (${toNumber(record.ready)} ready / ${toNumber(record.review)} review / ${toNumber(record.blocked)} blocked)`);
      lines.push(`- Signals: ${toNumber(record.localPathSources)} local path / ${toNumber(record.gitRemoteSources)} git remote / ${toNumber(record.githubRemoteSources)} GitHub / ${toNumber(record.privateRepoLikely)} private likely`);
      lines.push(`- Access needs: ${toNumber(record.tokenLikely)} token/OAuth / ${toNumber(record.passwordLikely)} password-session / ${toNumber(record.certificateLikely)} certificate / ${toNumber(record.sshKeyLikely)} SSH / ${toNumber(record.manualAccessLikely)} manual`);
      if (commandHints.length) {
        lines.push(`- Command hints: ${commandHints.join("; ")}`);
      }
      lines.push(`- Setup: ${toText(record.externalSetup) || "Resolve required access outside this app."}`);
      for (const source of sources.slice(0, 8)) {
        const item = toControlPlaneRecord(source);
        lines.push(`- ${toText(item.label) || toText(item.id) || "Source"}: ${toText(item.health) || "review"} / ${toText(item.status) || "registered"} (${toText(item.locator) || "no locator"})`);
      }
    }

    return lines.join("\n");
  }

  async function createSourcesAccessMethodRegistryPayload() {
    const [requirements, matrix, runbook] = await Promise.all([
      createSourcesAccessRequirementsPayload(),
      createSourcesAccessMatrixPayload(),
      createSourcesAccessValidationRunbookPayload()
    ]);
    const registrySources = (Array.isArray(requirements.sources) ? requirements.sources : []).map((source) => createSourceAccessRegistrySource(toControlPlaneRecord(source)));
    const runbookByMethod = new Map((Array.isArray(runbook.methods) ? runbook.methods : []).map((method) => [toText(method.accessMethod), toControlPlaneRecord(method)]));
    const sourcesByMethod = new Map();
    for (const source of registrySources) {
      if (!sourcesByMethod.has(source.accessMethod)) sourcesByMethod.set(source.accessMethod, []);
      sourcesByMethod.get(source.accessMethod).push(source);
    }
    const methods = (Array.isArray(matrix.methods) ? matrix.methods : []).map((method) => {
      const record = toControlPlaneRecord(method);
      const accessMethod = toText(record.accessMethod) || "unknown-access-method";
      const sources = sourcesByMethod.get(accessMethod) || [];
      const methodRunbook = runbookByMethod.get(accessMethod) || {};
      const commandHints = Array.isArray(methodRunbook.commandHints) ? methodRunbook.commandHints.map(toText).filter(Boolean) : [];
      const steps = Array.isArray(methodRunbook.steps) ? methodRunbook.steps.map(toText).filter(Boolean) : [];
      return {
        accessMethod,
        title: toText(methodRunbook.title) || accessMethod,
        category: getSourceAccessRegistryCategory(accessMethod),
        sourceCount: sources.length,
        ready: sources.filter((source) => source.health === "ready" && source.requiresReview !== true).length,
        review: sources.filter((source) => source.health !== "blocked" && source.requiresReview === true).length,
        blocked: sources.filter((source) => source.health === "blocked").length,
        reviewRequired: sources.filter((source) => source.requiresReview).length,
        localPathSources: sources.filter((source) => source.localPathLikely).length,
        gitRemoteSources: sources.filter((source) => source.gitRemoteLikely).length,
        githubRemoteSources: sources.filter((source) => source.githubRemoteLikely).length,
        privateRepoLikely: sources.filter((source) => source.privateRepoLikely).length,
        tokenLikely: sources.filter((source) => source.tokenLikely).length,
        passwordLikely: sources.filter((source) => source.passwordLikely).length,
        certificateLikely: sources.filter((source) => source.certificateLikely).length,
        sshKeyLikely: sources.filter((source) => source.sshKeyLikely).length,
        manualAccessLikely: sources.filter((source) => source.manualAccessLikely).length,
        commandHints,
        externalSetup: steps.join(" ") || "Resolve required credentials, certificates, SSH keys, VPN access, OAuth sessions, or manual exports outside this app.",
        secretHandling: "Non-secret registry metadata only. Use OS credential managers, SSH agent, provider vaults, OAuth/browser sessions, or manual export workflows for secrets.",
        sources
      };
    }).sort((left, right) => right.reviewRequired - left.reviewRequired || left.accessMethod.localeCompare(right.accessMethod));
    const summary = {
      totalSources: registrySources.length,
      totalMethods: methods.length,
      readySources: registrySources.filter((source) => source.health === "ready" && source.requiresReview !== true).length,
      reviewSources: registrySources.filter((source) => source.health !== "blocked" && source.requiresReview === true).length,
      blockedSources: registrySources.filter((source) => source.health === "blocked").length,
      reviewRequired: registrySources.filter((source) => source.requiresReview).length,
      localPathSources: registrySources.filter((source) => source.localPathLikely).length,
      gitRemoteSources: registrySources.filter((source) => source.gitRemoteLikely).length,
      githubRemoteSources: registrySources.filter((source) => source.githubRemoteLikely).length,
      privateRepoLikely: registrySources.filter((source) => source.privateRepoLikely).length,
      tokenLikely: registrySources.filter((source) => source.tokenLikely).length,
      passwordLikely: registrySources.filter((source) => source.passwordLikely).length,
      certificateLikely: registrySources.filter((source) => source.certificateLikely).length,
      sshKeyLikely: registrySources.filter((source) => source.sshKeyLikely).length,
      manualAccessLikely: registrySources.filter((source) => source.manualAccessLikely).length
    };
    const payload = {
      generatedAt: new Date().toISOString(),
      summary,
      secretPolicy: "Non-secret access method registry only. Do not store passwords, tokens, private keys, certificates, cookies, or browser-session data in this app.",
      methods,
      sources: registrySources,
      requirements,
      matrix,
      runbook
    };

    return {
      ...payload,
      markdown: buildSourcesAccessMethodRegistryMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} source
   * @param {Record<string, unknown>} coverage
   */
  function getSourceAccessValidationWorkflowBlockers(source, coverage) {
    const blockers = [];
    if (source.localPathLikely && source.health === "blocked") blockers.push("local-path-unreachable");
    if (source.gitRemoteLikely) blockers.push("git-remote-validation");
    if (source.githubRemoteLikely) blockers.push("github-membership");
    if (source.privateRepoLikely) blockers.push("private-repository-access");
    if (source.tokenLikely) blockers.push("token-or-oauth");
    if (source.passwordLikely) blockers.push("password-or-browser-session");
    if (source.certificateLikely) blockers.push("certificate-or-tls");
    if (source.sshKeyLikely) blockers.push("ssh-key");
    if (source.manualAccessLikely) blockers.push("manual-export");
    if (toText(coverage.coverageStatus) === "missing") blockers.push("missing-validation-evidence");
    if (toText(coverage.coverageStatus) === "review") blockers.push("evidence-review");
    if (toText(coverage.coverageStatus) === "blocked") blockers.push("blocked-validation-evidence");
    return [...new Set(blockers)];
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildSourcesAccessValidationWorkflowMarkdown(payload) {
    const items = Array.isArray(payload.items) ? payload.items : [];
    const lines = [
      "# Data Sources Access Validation Workflow",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Sources: ${toNumber(payload.summary.total)}`,
      `Ready: ${toNumber(payload.summary.ready)}`,
      `Pending: ${toNumber(payload.summary.pending)}`,
      `Blocked: ${toNumber(payload.summary.blocked)}`,
      `Missing evidence: ${toNumber(payload.summary.missingEvidence)}`,
      `External access required: ${toNumber(payload.summary.externalAccessRequired)}`,
      `Token/OAuth required: ${toNumber(payload.summary.tokenRequired)}`,
      `Certificate/TLS required: ${toNumber(payload.summary.certificateRequired)}`,
      `SSH key required: ${toNumber(payload.summary.sshRequired)}`,
      `Manual access required: ${toNumber(payload.summary.manualRequired)}`,
      "",
      `Secret policy: ${toText(payload.secretPolicy) || "Non-secret validation workflow only. Resolve secrets outside this app."}`,
      "",
      "## Workflow Items"
    ];

    if (!items.length) {
      lines.push("- No Data Sources access validation workflow items.");
      return lines.join("\n");
    }

    for (const item of items) {
      const record = toControlPlaneRecord(item);
      const blockers = Array.isArray(record.blockerTypes) ? record.blockerTypes.map(toText).filter(Boolean) : [];
      const commandHints = Array.isArray(record.commandHints) ? record.commandHints.map(toText).filter(Boolean) : [];
      lines.push(`- ${toText(record.priority).toUpperCase()} ${toText(record.status).toUpperCase()}: ${toText(record.label) || "Source"} (${toText(record.accessMethod) || "review-required"})`);
      lines.push(`  Stage: ${toText(record.stage) || "external-access-review"}`);
      lines.push(`  Evidence: ${toText(record.latestEvidenceStatus) || "missing"} at ${toText(record.latestEvidenceAt) || "not recorded"}`);
      lines.push(`  Action: ${toText(record.action) || "Review source access outside this app."}`);
      if (blockers.length) lines.push(`  Blockers: ${blockers.join(", ")}`);
      if (commandHints.length) lines.push(`  Command hints: ${commandHints.join("; ")}`);
    }

    return lines.join("\n");
  }

  async function createSourcesAccessValidationWorkflowPayload() {
    const persisted = await store.readStore();
    const [registry, coverage] = await Promise.all([
      createSourcesAccessMethodRegistryPayload(),
      createSourcesAccessValidationEvidenceCoveragePayload(persisted)
    ]);
    const coverageBySource = new Map((Array.isArray(coverage.items) ? coverage.items : []).map((item) => [toText(item.sourceId), toControlPlaneRecord(item)]));
    const methodByName = new Map((Array.isArray(registry.methods) ? registry.methods : []).map((method) => [toText(method.accessMethod), toControlPlaneRecord(method)]));
    const items = (Array.isArray(registry.sources) ? registry.sources : []).map((source) => {
      const record = toControlPlaneRecord(source);
      const accessMethod = toText(record.accessMethod) || "review-required";
      const sourceCoverage = coverageBySource.get(toText(record.id)) || {};
      const coverageStatus = toText(sourceCoverage.coverageStatus) || "missing";
      const latestEvidenceStatus = toText(sourceCoverage.latestEvidenceStatus) || "missing";
      const method = methodByName.get(accessMethod) || {};
      const blockerTypes = getSourceAccessValidationWorkflowBlockers(record, sourceCoverage);
      const blocked = toText(record.health) === "blocked" || coverageStatus === "blocked" || latestEvidenceStatus === "blocked";
      const ready = !blocked && coverageStatus === "covered" && latestEvidenceStatus === "validated";
      const externalAccessRequired = Boolean(record.requiresReview || record.tokenLikely || record.passwordLikely || record.certificateLikely || record.sshKeyLikely || record.manualAccessLikely || record.privateRepoLikely);
      const status = blocked ? "blocked" : ready ? "ready" : "pending";
      const stage = ready
        ? "validated"
        : blocked
          ? "blocked"
          : externalAccessRequired
            ? "external-access-review"
            : "record-validation-evidence";
      const priority = blocked || record.certificateLikely || record.passwordLikely
        ? "high"
        : externalAccessRequired || coverageStatus === "missing"
          ? "medium"
          : "low";
      const action = ready
        ? "Proceed with read-only ingestion planning for this source."
        : blocked
          ? "Resolve the blocked source access outside this app, then record updated non-secret evidence."
          : externalAccessRequired
            ? "Complete the listed external access checks outside this app, then record non-secret validation evidence."
            : "Record non-secret evidence that the current operator context can read this source.";

      return {
        id: `source-access-validation-workflow:${toText(record.id) || toText(record.label) || accessMethod}`,
        sourceId: toText(record.id),
        label: toText(record.label) || "Source",
        type: toText(record.type),
        locator: toText(record.locator),
        accessMethod,
        category: toText(method.category) || getSourceAccessRegistryCategory(accessMethod),
        status,
        stage,
        priority,
        externalAccessRequired,
        blockerTypes,
        latestEvidenceStatus,
        latestEvidenceAt: toText(sourceCoverage.latestEvidenceAt),
        coverageStatus,
        action,
        commandHints: Array.isArray(method.commandHints) ? method.commandHints.map(toText).filter(Boolean) : [],
        secretPolicy: "Non-secret validation workflow only. Do not store passwords, tokens, private keys, certificates, cookies, or browser sessions in this app."
      };
    }).sort((left, right) => {
      const priorityRank = { high: 0, medium: 1, low: 2 };
      const statusRank = { blocked: 0, pending: 1, ready: 2 };
      return statusRank[left.status] - statusRank[right.status]
        || priorityRank[left.priority] - priorityRank[right.priority]
        || left.label.localeCompare(right.label);
    });
    const summary = {
      total: items.length,
      ready: items.filter((item) => item.status === "ready").length,
      pending: items.filter((item) => item.status === "pending").length,
      blocked: items.filter((item) => item.status === "blocked").length,
      missingEvidence: items.filter((item) => item.coverageStatus === "missing").length,
      externalAccessRequired: items.filter((item) => item.externalAccessRequired).length,
      tokenRequired: items.filter((item) => item.blockerTypes.includes("token-or-oauth")).length,
      passwordRequired: items.filter((item) => item.blockerTypes.includes("password-or-browser-session")).length,
      certificateRequired: items.filter((item) => item.blockerTypes.includes("certificate-or-tls")).length,
      sshRequired: items.filter((item) => item.blockerTypes.includes("ssh-key")).length,
      manualRequired: items.filter((item) => item.blockerTypes.includes("manual-export")).length
    };
    const payload = {
      generatedAt: new Date().toISOString(),
      summary,
      secretPolicy: "Non-secret source access validation workflow only. Resolve credentials, private keys, certificates, cookies, and browser sessions outside this app.",
      items,
      registry,
      coverage
    };

    return {
      ...payload,
      markdown: buildSourcesAccessValidationWorkflowMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} workflow
   * @param {{ title?: string }} [options]
   */
  function createSourcesAccessValidationWorkflowSnapshotRecord(workflow, options = {}) {
    const summary = toControlPlaneRecord(workflow.summary);
    return {
      id: createId("data-source-access-validation-workflow-snapshot"),
      title: String(options.title || "Data Sources Access Validation Workflow").trim() || "Data Sources Access Validation Workflow",
      total: toNumber(summary.total),
      readyCount: toNumber(summary.ready),
      pendingCount: toNumber(summary.pending),
      blockedCount: toNumber(summary.blocked),
      missingEvidenceCount: toNumber(summary.missingEvidence),
      externalAccessRequiredCount: toNumber(summary.externalAccessRequired),
      tokenRequiredCount: toNumber(summary.tokenRequired),
      passwordRequiredCount: toNumber(summary.passwordRequired),
      certificateRequiredCount: toNumber(summary.certificateRequired),
      sshRequiredCount: toNumber(summary.sshRequired),
      manualRequiredCount: toNumber(summary.manualRequired),
      secretPolicy: toText(workflow.secretPolicy) || "Non-secret source access validation workflow snapshot only.",
      markdown: toText(workflow.markdown),
      items: Array.isArray(workflow.items) ? workflow.items : [],
      createdAt: new Date().toISOString()
    };
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function buildSourcesAccessValidationWorkflowSnapshotDiffMarkdown(payload) {
    const lines = [
      "# Data Sources Access Validation Workflow Snapshot Drift",
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
      lines.push("- No source-access validation workflow drift detected.");
      return lines.join("\n");
    }
    for (const item of driftItems) {
      const record = toControlPlaneRecord(item);
      lines.push(`- ${toText(record.label) || toText(record.field) || "Workflow drift"}: ${toText(record.before)} -> ${toText(record.current)}`);
    }
    return lines.join("\n");
  }

  function createMissingSourcesAccessValidationWorkflowSnapshotDiffPayload() {
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: false,
      snapshotId: "",
      snapshotTitle: "",
      snapshotCreatedAt: "",
      hasDrift: false,
      driftScore: 0,
      driftSeverity: "missing-snapshot",
      recommendedAction: "Save a Data Sources access validation workflow snapshot before comparing workflow drift.",
      driftItems: [],
      liveSummary: null,
      snapshotSummary: null
    };
    return {
      ...payload,
      markdown: buildSourcesAccessValidationWorkflowSnapshotDiffMarkdown(payload)
    };
  }

  /**
   * @param {Record<string, unknown>} snapshot
   * @param {Awaited<ReturnType<typeof createSourcesAccessValidationWorkflowPayload>>} live
   */
  function createSourcesAccessValidationWorkflowSnapshotDiffPayload(snapshot, live) {
    const liveSummary = toControlPlaneRecord(live.summary);
    const snapshotSummary = {
      total: toNumber(snapshot.total),
      ready: toNumber(snapshot.readyCount),
      pending: toNumber(snapshot.pendingCount),
      blocked: toNumber(snapshot.blockedCount),
      missingEvidence: toNumber(snapshot.missingEvidenceCount),
      externalAccessRequired: toNumber(snapshot.externalAccessRequiredCount),
      tokenRequired: toNumber(snapshot.tokenRequiredCount),
      passwordRequired: toNumber(snapshot.passwordRequiredCount),
      certificateRequired: toNumber(snapshot.certificateRequiredCount),
      sshRequired: toNumber(snapshot.sshRequiredCount),
      manualRequired: toNumber(snapshot.manualRequiredCount)
    };
    const countFields = [
      { field: "total", label: "Workflow sources" },
      { field: "ready", label: "Ready workflow items" },
      { field: "pending", label: "Pending workflow items" },
      { field: "blocked", label: "Blocked workflow items" },
      { field: "missingEvidence", label: "Missing validation evidence" },
      { field: "externalAccessRequired", label: "External access required" },
      { field: "tokenRequired", label: "Token or OAuth required" },
      { field: "passwordRequired", label: "Password or browser session required" },
      { field: "certificateRequired", label: "Certificate or TLS required" },
      { field: "sshRequired", label: "SSH key required" },
      { field: "manualRequired", label: "Manual access required" }
    ];
    const driftItems = [];
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
    const workflowKey = (item) => toText(item.sourceId) || toText(item.id) || toText(item.label);
    const snapshotByKey = new Map(snapshotItems.map((item) => [workflowKey(item), item]).filter(([key]) => Boolean(key)));
    const liveByKey = new Map(liveItems.map((item) => [workflowKey(item), item]).filter(([key]) => Boolean(key)));

    for (const [key, item] of liveByKey) {
      const previous = snapshotByKey.get(key);
      const label = toText(item.label) || key;
      if (!previous) {
        driftItems.push({
          field: `source-access-validation-workflow:${key}`,
          label: `${label} added`,
          before: "missing",
          current: `${toText(item.status) || "pending"} / ${toText(item.stage) || "external-access-review"}`,
          delta: 1
        });
        continue;
      }
      const beforeState = `${toText(previous.status) || "pending"} / ${toText(previous.stage) || "external-access-review"} / ${toText(previous.coverageStatus) || "missing"} / ${toText(previous.latestEvidenceStatus) || "missing"}`;
      const currentState = `${toText(item.status) || "pending"} / ${toText(item.stage) || "external-access-review"} / ${toText(item.coverageStatus) || "missing"} / ${toText(item.latestEvidenceStatus) || "missing"}`;
      if (beforeState !== currentState) {
        driftItems.push({
          field: `source-access-validation-workflow:${key}`,
          label,
          before: beforeState,
          current: currentState,
          delta: toText(previous.status) === toText(item.status) ? 0 : 1
        });
      }
    }

    for (const [key, item] of snapshotByKey) {
      if (!liveByKey.has(key)) {
        driftItems.push({
          field: `source-access-validation-workflow:${key}`,
          label: `${toText(item.label) || key} removed`,
          before: `${toText(item.status) || "pending"} / ${toText(item.stage) || "external-access-review"}`,
          current: "missing",
          delta: -1
        });
      }
    }

    const driftScore = driftItems.reduce((total, item) => total + Math.max(1, Math.abs(toNumber(item.delta))), 0);
    const blockedDelta = toNumber(liveSummary.blocked) - toNumber(snapshotSummary.blocked);
    const pendingDelta = toNumber(liveSummary.pending) - toNumber(snapshotSummary.pending);
    const missingEvidenceDelta = toNumber(liveSummary.missingEvidence) - toNumber(snapshotSummary.missingEvidence);
    const driftSeverity = !driftItems.length
      ? "none"
      : blockedDelta > 0
        ? "high"
        : pendingDelta > 0 || missingEvidenceDelta > 0 || driftScore >= 5
          ? "medium"
          : "low";
    const recommendedAction = driftSeverity === "high"
      ? "Resolve blocked Data Sources validation workflow items before app-management ingestion."
      : driftSeverity === "medium"
        ? "Review workflow drift and refresh the snapshot after access evidence changes are confirmed."
        : driftSeverity === "low"
          ? "Monitor low workflow drift and refresh the snapshot when intentional."
          : "No source-access validation workflow drift detected.";
    const payload = {
      generatedAt: new Date().toISOString(),
      hasSnapshot: true,
      snapshotId: toText(snapshot.id),
      snapshotTitle: toText(snapshot.title) || "Data Sources Access Validation Workflow",
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
      markdown: buildSourcesAccessValidationWorkflowSnapshotDiffMarkdown(payload)
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
      `Source-access checkpoints: ${toNumber(payload.summary.checkpointUnresolved)} unresolved / ${toNumber(payload.summary.checkpointCount)} total`,
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
    const sourceAccessCheckpointSummary = createSourceAccessCheckpointSummary(persisted.taskSeedingCheckpoints);
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
          sourceAccessCheckpoints: createSourceAccessCheckpointDrilldown(persisted.taskSeedingCheckpoints, {
            id: sourceId,
            sourceId,
            label: toText(source.label),
            value: toText(source.value),
            path: toText(source.path),
            url: toText(source.url)
          }),
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
      coveragePercent: items.length ? Math.round((covered / items.length) * 100) : 0,
      checkpointCount: sourceAccessCheckpointSummary.total,
      checkpointApproved: sourceAccessCheckpointSummary.approved,
      checkpointDeferred: sourceAccessCheckpointSummary.deferred,
      checkpointDismissed: sourceAccessCheckpointSummary.dismissed,
      checkpointNeedsReview: sourceAccessCheckpointSummary.needsReview,
      checkpointUnresolved: sourceAccessCheckpointSummary.unresolved,
      checkpointSources: sourceAccessCheckpointSummary.sources,
      checkpointBySource: sourceAccessCheckpointSummary.bySource
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
      `Source-access checkpoints: ${toNumber(payload.summary.checkpointUnresolved)} unresolved / ${toNumber(payload.summary.checkpointCount)} total`,
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
    const [checklist, matrix, persisted] = await Promise.all([
      createSourcesAccessChecklistPayload(),
      createSourcesAccessMatrixPayload(),
      store.readStore()
    ]);
    const sourceAccessCheckpointSummary = createSourceAccessCheckpointSummary(persisted.taskSeedingCheckpoints);
    const checklistItems = Array.isArray(checklist.items) ? checklist.items : [];
    const items = checklistItems
      .filter((item) => item.status !== "ready")
      .map((item) => {
        const record = toControlPlaneRecord(item);
        const sourceId = toText(record.sourceId);
        const label = toText(record.label) || "Source";
        const accessMethod = toText(record.accessMethod) || "review-required";
        const status = toText(record.status) === "blocked" ? "blocked" : "review";
        const priority = status === "blocked"
          ? "high"
          : ["git-https", "git-ssh", "provider-token-or-database-credentials"].includes(accessMethod)
            ? "medium"
            : "normal";
        return {
          id: `source-access-review:${sourceId || toText(record.value) || label}`,
          sourceId,
          label,
          type: toText(record.type),
          value: toText(record.value),
          title: `Review ${label || toText(record.type) || "source"} access`,
          status,
          priority,
          accessMethod,
          sourceHealth: toText(record.sourceHealth),
          sourceStatus: toText(record.sourceStatus),
          action: toText(record.action),
          validation: toText(record.validation),
          credentialHint: toText(record.credentialHint),
          sourceAccessCheckpoints: createSourceAccessCheckpointDrilldown(persisted.taskSeedingCheckpoints, {
            id: sourceId,
            sourceId,
            label,
            value: toText(record.value),
            path: toText(record.path),
            url: toText(record.url)
          }),
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
      sshKeyLikely: toNumber(matrix.summary.sshKeyLikely),
      checkpointCount: sourceAccessCheckpointSummary.total,
      checkpointApproved: sourceAccessCheckpointSummary.approved,
      checkpointDeferred: sourceAccessCheckpointSummary.deferred,
      checkpointDismissed: sourceAccessCheckpointSummary.dismissed,
      checkpointNeedsReview: sourceAccessCheckpointSummary.needsReview,
      checkpointUnresolved: sourceAccessCheckpointSummary.unresolved,
      checkpointSources: sourceAccessCheckpointSummary.sources,
      checkpointBySource: sourceAccessCheckpointSummary.bySource
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

  /**
   * @param {Record<string, unknown>} item
   */
  function createSourceAccessValidationWorkflowTask(item) {
    const sourceLabel = toText(item.label) || "Source";
    const sourceId = toText(item.sourceId);
    const accessMethod = toText(item.accessMethod) || "review-required";
    const workflowStage = toText(item.stage) || "record-validation-evidence";
    const workflowStatus = toText(item.status) || "pending";
    const priority = toText(item.priority) || (workflowStatus === "blocked" ? "high" : "medium");
    const blockerTypes = Array.isArray(item.blockerTypes) ? item.blockerTypes.map(toText).filter(Boolean) : [];
    const commandHints = Array.isArray(item.commandHints) ? item.commandHints.map(toText).filter(Boolean) : [];
    const coverageId = sourceId ? `source-access-validation-evidence-coverage:${sourceId}` : "";
    const descriptionLines = [
      `Source: ${sourceLabel}`,
      `Type: ${toText(item.type) || "source"}`,
      `Locator: ${toText(item.locator) || "not recorded"}`,
      `Access method: ${accessMethod}`,
      `Workflow stage: ${workflowStage}`,
      `Workflow status: ${workflowStatus}`,
      `Coverage status: ${toText(item.coverageStatus) || "missing"}`,
      `Latest evidence: ${toText(item.latestEvidenceStatus) || "missing"}`,
      toText(item.latestEvidenceAt) ? `Latest evidence at: ${toText(item.latestEvidenceAt)}` : "",
      blockerTypes.length ? `Blockers: ${blockerTypes.join(", ")}` : "",
      commandHints.length ? `Command hints: ${commandHints.join("; ")}` : "",
      `Action: ${toText(item.action) || "Complete source access validation outside this app, then record non-secret evidence."}`,
      "Secret policy: Resolve credentials, private keys, certificates, browser sessions, cookies, and provider tokens outside this app. Do not store secrets in this task."
    ].filter(Boolean);

    return {
      id: createId("task"),
      projectId: "data-sources",
      projectName: "Data Sources",
      title: `Source validation workflow: ${sourceLabel}`,
      description: descriptionLines.join("\n"),
      priority: priority === "high" ? "high" : priority === "low" ? "low" : "medium",
      status: "open",
      sourceAccessValidationWorkflowId: toText(item.id),
      sourceAccessValidationEvidenceCoverageId: coverageId,
      sourceId,
      sourceLabel,
      sourceType: toText(item.type),
      sourceValue: toText(item.locator),
      accessMethod,
      workflowStage,
      workflowStatus,
      blockerTypes,
      coverageStatus: toText(item.coverageStatus) || "missing",
      latestEvidenceStatus: toText(item.latestEvidenceStatus) || "missing",
      latestEvidenceAt: toText(item.latestEvidenceAt),
      secretPolicy: toText(item.secretPolicy) || "non-secret-validation-workflow-only",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function isGovernanceClosedStatus(status) {
    return ["done", "resolved", "closed", "passed", "failed", "cancelled", "archived"].includes(String(status || "").toLowerCase());
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
        const taskRef = toText(record.sourceAccessValidationWorkflowId) || toText(record.sourceAccessValidationEvidenceCoverageId) || toText(record.sourceAccessReviewId) || "source-access-task";
        lines.push(`  Source: ${toText(record.sourceLabel) || toText(record.sourceId) || "source"} | Type: ${toText(record.sourceType) || "source"} | Task ref: ${taskRef}`);
        if (toText(record.workflowStage || record.workflowStatus)) {
          lines.push(`  Workflow: ${toText(record.workflowStage) || "not recorded"} | Status: ${toText(record.workflowStatus) || "not recorded"}`);
        }
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
          sourceAccessValidationWorkflowId: toText(record.sourceAccessValidationWorkflowId),
          sourceId: toText(record.sourceId),
          sourceLabel: toText(record.sourceLabel) || toText(record.projectName) || "Data Sources",
          sourceType: toText(record.sourceType),
          sourceValue: toText(record.sourceValue),
          accessMethod: toText(record.accessMethod) || "review-required",
          workflowStage: toText(record.workflowStage),
          workflowStatus: toText(record.workflowStatus),
          blockerTypes: Array.isArray(record.blockerTypes) ? record.blockerTypes.map(toText).filter(Boolean) : [],
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
   * @param {Record<string, unknown>} persisted
   * @param {{ title?: string, status?: string, limit?: number }} [options]
   */
  function createSourcesAccessTaskLedgerSnapshotRecord(persisted, options = {}) {
    const ledger = createSourcesAccessTaskLedgerPayload(persisted, {
      status: String(options.status || "all"),
      limit: Number(options.limit || 100)
    });

    return {
      id: createId("data-source-access-task-ledger-snapshot"),
      title: String(options.title || "Data Sources Access Task Ledger").trim() || "Data Sources Access Task Ledger",
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
    const [dataSourcesAccessGate, dataSourcesAccessReviewQueue, dataSourcesAccessValidationRunbook, dataSourcesAccessValidationWorkflow, releaseBuildGate] = await Promise.all([
      createSourcesAccessGatePayload(),
      createSourcesAccessReviewQueuePayload(),
      createSourcesAccessValidationRunbookPayload(),
      createSourcesAccessValidationWorkflowPayload(),
      createReleaseBuildGatePayload(persisted)
    ]);
    const dataSourcesAccessValidationEvidenceCoverage = await createSourcesAccessValidationEvidenceCoveragePayload(persisted, dataSourcesAccessValidationRunbook);
    return {
      governance: buildGovernanceSnapshot(persisted, inventory, {
        dataSourcesAccessGate,
        dataSourcesAccessReviewQueue,
        dataSourcesAccessValidationRunbook,
        dataSourcesAccessValidationEvidenceCoverage,
        dataSourcesAccessValidationWorkflow,
        releaseBuildGate
      }),
      dataSourcesAccessGate,
      dataSourcesAccessReviewQueue,
      dataSourcesAccessValidationRunbook,
      dataSourcesAccessValidationEvidenceCoverage,
      dataSourcesAccessValidationWorkflow,
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
    const isWorkflowTask = (task) => Boolean(toText(task.sourceAccessValidationWorkflowId));
    const snapshotWorkflowTasks = snapshotTasks.filter(isWorkflowTask);
    const liveWorkflowTasks = liveTasks.filter(isWorkflowTask);
    const buildWorkflowTaskSummary = (tasks) => {
      const open = tasks.filter((task) => !isGovernanceClosedStatus(task.status)).length;
      const closed = tasks.filter((task) => isGovernanceClosedStatus(task.status)).length;
      return {
        total: tasks.length,
        open,
        closed,
        blocked: tasks.filter((task) => toText(task.status) === "blocked").length,
        ready: tasks.filter((task) => toText(task.workflowStatus) === "ready").length,
        pending: tasks.filter((task) => toText(task.workflowStatus) === "pending").length
      };
    };
    const snapshotWorkflowTaskSummary = buildWorkflowTaskSummary(snapshotWorkflowTasks);
    const liveWorkflowTaskSummary = buildWorkflowTaskSummary(liveWorkflowTasks);
    const workflowTaskCountFields = [
      { field: "total", label: "Validation workflow tasks" },
      { field: "open", label: "Open validation workflow tasks" },
      { field: "closed", label: "Closed validation workflow tasks" },
      { field: "blocked", label: "Blocked validation workflow tasks" },
      { field: "ready", label: "Ready validation workflow tasks" },
      { field: "pending", label: "Pending validation workflow tasks" }
    ];

    for (const item of workflowTaskCountFields) {
      const before = toNumber(snapshotWorkflowTaskSummary[item.field]);
      const current = toNumber(liveWorkflowTaskSummary[item.field]);
      if (before !== current) {
        driftItems.push({
          category: "source-access-validation-workflow-task-ledger",
          field: `source-access-validation-workflow-task-ledger:${item.field}`,
          label: item.label,
          before,
          current,
          delta: current - before
        });
      }
    }

    const taskKey = (task) => toText(task.id) || toText(task.sourceAccessReviewId) || `${toText(task.sourceLabel)}:${toText(task.accessMethod)}`;
    const snapshotByKey = new Map(snapshotTasks.map((task) => [taskKey(task), task]));
    const liveByKey = new Map(liveTasks.map((task) => [taskKey(task), task]));
    const snapshotWorkflowByKey = new Map(snapshotWorkflowTasks.map((task) => [taskKey(task), task]));
    const liveWorkflowByKey = new Map(liveWorkflowTasks.map((task) => [taskKey(task), task]));

    for (const [key, task] of liveWorkflowByKey) {
      const previous = snapshotWorkflowByKey.get(key);
      const label = toText(task.title) || toText(task.sourceLabel) || key;
      const currentWorkflowState = `${toText(task.status) || "open"} / ${toText(task.priority) || "normal"} / ${toText(task.workflowStage) || "validation"} / ${toText(task.workflowStatus) || "pending"} / ${toText(task.latestEvidenceStatus || task.coverageStatus) || "missing"}`;
      if (!previous) {
        driftItems.push({
          category: "source-access-validation-workflow-task-ledger",
          field: `source-access-validation-workflow-task:${key}`,
          label: `${label} workflow task added`,
          before: "missing",
          current: currentWorkflowState,
          delta: 1
        });
        continue;
      }
      const beforeWorkflowState = `${toText(previous.status) || "open"} / ${toText(previous.priority) || "normal"} / ${toText(previous.workflowStage) || "validation"} / ${toText(previous.workflowStatus) || "pending"} / ${toText(previous.latestEvidenceStatus || previous.coverageStatus) || "missing"}`;
      if (beforeWorkflowState !== currentWorkflowState) {
        driftItems.push({
          category: "source-access-validation-workflow-task-ledger",
          field: `source-access-validation-workflow-task:${key}`,
          label: `${label} workflow task`,
          before: beforeWorkflowState,
          current: currentWorkflowState,
          delta: toText(previous.status) === toText(task.status) ? 0 : 1
        });
      }
    }

    for (const [key, task] of snapshotWorkflowByKey) {
      if (!liveWorkflowByKey.has(key)) {
        driftItems.push({
          category: "source-access-validation-workflow-task-ledger",
          field: `source-access-validation-workflow-task:${key}`,
          label: `${toText(task.title) || toText(task.sourceLabel) || key} workflow task removed`,
          before: `${toText(task.status) || "open"} / ${toText(task.priority) || "normal"} / ${toText(task.workflowStage) || "validation"} / ${toText(task.workflowStatus) || "pending"} / ${toText(task.latestEvidenceStatus || task.coverageStatus) || "missing"}`,
          current: "missing",
          delta: -1
        });
      }
    }

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
      snapshotSummary,
      liveWorkflowTaskSummary,
      snapshotWorkflowTaskSummary
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
      dataSourceAccessValidationWorkflowSnapshotCount: Array.isArray(persisted.dataSourceAccessValidationWorkflowSnapshots) ? persisted.dataSourceAccessValidationWorkflowSnapshots.length : 0,
      convergenceReviewCount: Array.isArray(persisted.convergenceReviews) ? persisted.convergenceReviews.length : 0,
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
      agentPolicyCheckpointCount: Array.isArray(persisted.agentPolicyCheckpoints) ? persisted.agentPolicyCheckpoints.length : 0,
      agentExecutionResultCheckpointCount: Array.isArray(persisted.agentExecutionResultCheckpoints) ? persisted.agentExecutionResultCheckpoints.length : 0,
      agentExecutionResultTaskLedgerSnapshotCount: Array.isArray(persisted.agentExecutionResultTaskLedgerSnapshots) ? persisted.agentExecutionResultTaskLedgerSnapshots.length : 0,
      agentWorkOrderSnapshotCount: Array.isArray(persisted.agentWorkOrderSnapshots) ? persisted.agentWorkOrderSnapshots.length : 0,
      agentExecutionSlaLedgerSnapshotCount: Array.isArray(persisted.agentExecutionSlaLedgerSnapshots) ? persisted.agentExecutionSlaLedgerSnapshots.length : 0,
      agentWorkOrderRunCount: Array.isArray(persisted.agentWorkOrderRuns) ? persisted.agentWorkOrderRuns.length : 0,
      cliBridgeRunTraceSnapshotCount: Array.isArray(persisted.cliBridgeRunTraceSnapshots) ? persisted.cliBridgeRunTraceSnapshots.length : 0,
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
          const allowedTaskSeedingStatuses = new Set(["all", "approved", "deferred", "dismissed", "needs-review"]);
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
            taskSeedingStatus: allowedTaskSeedingStatuses.has(String(payload.taskSeedingStatus || "")) ? String(payload.taskSeedingStatus) : "all",
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
                taskSeedingStatus: view.taskSeedingStatus,
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

    if (req.method === "GET" && pathname === "/api/cli-bridge/context") {
      try {
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        const {
          governance,
          dataSourcesAccessGate,
          dataSourcesAccessReviewQueue,
          dataSourcesAccessValidationRunbook,
          dataSourcesAccessValidationWorkflow,
          releaseBuildGate
        } = await createGovernanceSnapshotWithDataSources(persisted, inventory);
        return sendJson(res, 200, createCliBridgeContextPayload(governance, {
          runner: requestUrl.searchParams.get("runner") || "all",
          status: requestUrl.searchParams.get("status") || "all",
          limit: Number(requestUrl.searchParams.get("limit") || 12),
          dataSourcesAccessGate,
          dataSourcesAccessReviewQueue,
          dataSourcesAccessValidationRunbook,
          dataSourcesAccessValidationWorkflow,
          releaseBuildGate
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/cli-bridge/runner-dry-run") {
      try {
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        const {
          governance,
          dataSourcesAccessGate,
          dataSourcesAccessReviewQueue,
          dataSourcesAccessValidationRunbook,
          dataSourcesAccessValidationWorkflow,
          releaseBuildGate
        } = await createGovernanceSnapshotWithDataSources(persisted, inventory);
        return sendJson(res, 200, createCliBridgeRunnerDryRunPayload(persisted, governance, {
          runner: requestUrl.searchParams.get("runner") || "codex",
          runId: requestUrl.searchParams.get("runId") || "",
          status: requestUrl.searchParams.get("status") || "all",
          limit: Number(requestUrl.searchParams.get("limit") || 12),
          dataSourcesAccessGate,
          dataSourcesAccessReviewQueue,
          dataSourcesAccessValidationRunbook,
          dataSourcesAccessValidationWorkflow,
          releaseBuildGate
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname.startsWith("/api/cli-bridge/handoffs/") && pathname.endsWith("/work-order-draft")) {
      try {
        const handoffId = decodeURIComponent(pathname.split("/")[4] || "");
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        const {
          governance,
          dataSourcesAccessGate,
          dataSourcesAccessReviewQueue,
          dataSourcesAccessValidationRunbook,
          dataSourcesAccessValidationWorkflow,
          releaseBuildGate
        } = await createGovernanceSnapshotWithDataSources(persisted, inventory);
        return sendJson(res, 200, createCliBridgeFollowUpWorkOrderDraftPayload(persisted, governance, {
          handoffId,
          runner: requestUrl.searchParams.get("runner") || "",
          limit: Number(requestUrl.searchParams.get("limit") || 12),
          dataSourcesAccessGate,
          dataSourcesAccessReviewQueue,
          dataSourcesAccessValidationRunbook,
          dataSourcesAccessValidationWorkflow,
          releaseBuildGate
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname.startsWith("/api/cli-bridge/runs/") && pathname.endsWith("/trace")) {
      try {
        const runId = decodeURIComponent(pathname.split("/")[4] || "");
        const persisted = await store.readStore();
        return sendJson(res, 200, createCliBridgeRunTracePayload(persisted, { runId }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/cli-bridge/run-trace-snapshots") {
      try {
        const persisted = await store.readStore();
        const snapshots = Array.isArray(persisted.cliBridgeRunTraceSnapshots) ? persisted.cliBridgeRunTraceSnapshots : [];
        return sendJson(res, 200, snapshots.slice(0, 50));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/cli-bridge/run-trace-snapshots/diff") {
      try {
        const persisted = await store.readStore();
        return sendJson(res, 200, createCliBridgeRunTraceSnapshotDiffPayload(persisted, {
          snapshotId: requestUrl.searchParams.get("snapshotId") || "latest"
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/cli-bridge/run-trace-snapshots/baseline-status") {
      try {
        const persisted = await store.readStore();
        return sendJson(res, 200, createCliBridgeRunTraceSnapshotBaselineStatusPayload(persisted));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "POST" && pathname.startsWith("/api/cli-bridge/runs/") && pathname.endsWith("/trace-snapshots")) {
      try {
        const runId = decodeURIComponent(pathname.split("/")[4] || "");
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        const persisted = await store.readStore();
        const snapshot = createCliBridgeRunTraceSnapshot(persisted, {
          runId,
          title: payload.title
        });

        if (snapshot.traceDecision === "hold") {
          return sendJson(res, 409, {
            error: toText(snapshot.trace.recommendedAction) || "CLI bridge run trace is not ready to snapshot.",
            trace: snapshot.trace
          });
        }

        const updated = await store.updateStore((current) => appendGovernanceOperations({
          ...current,
          cliBridgeRunTraceSnapshots: [snapshot, ...(Array.isArray(current.cliBridgeRunTraceSnapshots) ? current.cliBridgeRunTraceSnapshots : [])].slice(0, 100)
        }, [
          createGovernanceOperation(
            "cli-bridge-run-trace-snapshot-created",
            `Saved CLI bridge run trace snapshot for ${snapshot.projectName || snapshot.runId}.`,
            {
              snapshotId: snapshot.id,
              runId: snapshot.runId,
              projectId: snapshot.projectId,
              projectName: snapshot.projectName,
              traceDecision: snapshot.traceDecision,
              relatedHandoffCount: snapshot.relatedHandoffCount
            }
          )
        ]));

        return sendJson(res, 200, {
          success: true,
          snapshot,
          cliBridgeRunTraceSnapshots: updated.cliBridgeRunTraceSnapshots,
          governanceOperationCount: Array.isArray(updated.governanceOperations) ? updated.governanceOperations.length : 0
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid CLI bridge run trace snapshot request" });
      }
    }

    if (req.method === "POST" && pathname.startsWith("/api/cli-bridge/handoffs/") && pathname.endsWith("/work-order-run")) {
      try {
        const handoffId = decodeURIComponent(pathname.split("/")[4] || "");
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        const {
          governance,
          dataSourcesAccessGate,
          dataSourcesAccessReviewQueue,
          dataSourcesAccessValidationRunbook,
          dataSourcesAccessValidationWorkflow,
          releaseBuildGate
        } = await createGovernanceSnapshotWithDataSources(persisted, inventory);
        const draftPayload = createCliBridgeFollowUpWorkOrderDraftPayload(persisted, governance, {
          handoffId,
          runner: payload.runner || requestUrl.searchParams.get("runner") || "",
          limit: Number(payload.limit || requestUrl.searchParams.get("limit") || 12),
          dataSourcesAccessGate,
          dataSourcesAccessReviewQueue,
          dataSourcesAccessValidationRunbook,
          dataSourcesAccessValidationWorkflow,
          releaseBuildGate
        });

        if (draftPayload.draftDecision === "hold") {
          return sendJson(res, 409, {
            error: draftPayload.recommendedAction,
            draft: draftPayload
          });
        }
        if (!toText(draftPayload.draft.projectId) || !toText(draftPayload.draft.projectName)) {
          return sendJson(res, 400, {
            error: "CLI bridge follow-up work-order runs require a linked project id and project name.",
            draft: draftPayload
          });
        }

        let queuedRun = null;
        let skippedRun = null;
        const updated = await store.updateStore((current) => {
          const existingRuns = Array.isArray(current.agentWorkOrderRuns) ? current.agentWorkOrderRuns : [];
          const existingHandoffs = Array.isArray(current.cliBridgeHandoffs) ? current.cliBridgeHandoffs : [];
          const existingRun = existingRuns.find((run) => toText(run.cliBridgeHandoffId) === handoffId && !toText(run.archivedAt));
          if (existingRun) {
            skippedRun = {
              id: toText(existingRun.id),
              title: toText(existingRun.title),
              reason: "Open CLI bridge follow-up work-order run already exists"
            };
            const nextHandoffs = existingHandoffs.map((handoff) => {
              if (toText(handoff.id) !== handoffId) return handoff;
              return {
                ...handoff,
                followUpWorkOrderRunId: toText(existingRun.id),
                followUpWorkOrderRunStatus: toText(existingRun.status),
                followUpWorkOrderRunner: toText(existingRun.cliBridgeRunner) || toText(draftPayload.runner),
                followUpWorkOrderQueuedAt: toText(existingRun.createdAt),
                nextAction: "Follow-up work-order run is already queued; review the Agent Execution Queue before queueing another runner.",
                updatedAt: new Date().toISOString()
              };
            });
            return {
              ...current,
              cliBridgeHandoffs: nextHandoffs
            };
          }

          queuedRun = createAgentWorkOrderRunFromCliBridgeDraft(draftPayload, payload);
          const nextHandoffs = existingHandoffs.map((handoff) => {
            if (toText(handoff.id) !== handoffId) return handoff;
            return {
              ...handoff,
              followUpWorkOrderRunId: queuedRun.id,
              followUpWorkOrderRunStatus: queuedRun.status,
              followUpWorkOrderRunner: toText(draftPayload.runner),
              followUpWorkOrderQueuedAt: queuedRun.createdAt,
              nextAction: `Follow-up work-order run ${queuedRun.id} queued for ${toText(draftPayload.runner)}; monitor it in the Agent Execution Queue.`,
              updatedAt: queuedRun.updatedAt
            };
          });
          return appendGovernanceOperations({
            ...current,
            agentWorkOrderRuns: [queuedRun, ...existingRuns].slice(0, 200),
            cliBridgeHandoffs: nextHandoffs
          }, [
            createGovernanceOperation(
              "cli-bridge-follow-up-work-order-run-queued",
              `Queued CLI bridge follow-up work-order run for ${queuedRun.projectName || queuedRun.projectId}.`,
              {
                runId: queuedRun.id,
                handoffId,
                runner: toText(draftPayload.runner),
                draftDecision: toText(draftPayload.draftDecision),
                projectId: queuedRun.projectId,
                projectName: queuedRun.projectName
              }
            )
          ]);
        });

        return sendJson(res, 200, {
          success: true,
          run: queuedRun,
          skippedRun,
          draft: draftPayload,
          agentWorkOrderRuns: updated.agentWorkOrderRuns,
          governanceOperationCount: Array.isArray(updated.governanceOperations) ? updated.governanceOperations.length : 0
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid CLI bridge follow-up work-order run request" });
      }
    }

    if (pathname === "/api/cli-bridge/runner-results" && req.method === "POST") {
      try {
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        const persisted = await store.readStore();
        const handoff = createCliBridgeRunnerResultHandoffRecord(persisted, payload);
        let linkedRun = null;
        const updated = await store.updateStore((current) => {
          const now = new Date().toISOString();
          const operations = [
            createGovernanceOperation(
            "cli-bridge-runner-result-recorded",
            `Recorded ${handoff.sourceRunner} CLI runner result for ${handoff.projectName || handoff.projectId || "Workspace Audit"}.`,
            {
              handoffId: handoff.id,
              sourceRunner: handoff.sourceRunner,
              targetRunner: handoff.targetRunner,
              resultStatus: handoff.resultStatus,
              resultType: handoff.resultType,
              projectId: handoff.projectId,
              workOrderRunId: handoff.workOrderRunId,
              handoffRecommendation: handoff.handoffRecommendation
            }
            )
          ];
          const workOrderRunId = toText(handoff.workOrderRunId);
          const existingRuns = Array.isArray(current.agentWorkOrderRuns) ? current.agentWorkOrderRuns : [];
          const nextRuns = existingRuns.map((run) => {
            if (!workOrderRunId || toText(run.id) !== workOrderRunId) return run;
            const status = toText(run.status) || "queued";
            const history = Array.isArray(run.history) ? run.history : [];
            linkedRun = {
              ...run,
              latestCliBridgeResultHandoffId: handoff.id,
              latestCliBridgeResultStatus: handoff.resultStatus,
              latestCliBridgeResultRunner: handoff.sourceRunner,
              latestCliBridgeResultAt: now,
              latestCliBridgeResultSummary: handoff.summary,
              history: [
                createAgentWorkOrderRunEvent(status, `CLI bridge ${handoff.sourceRunner} result recorded: ${handoff.resultStatus}.`, status),
                ...history
              ].slice(0, 50),
              updatedAt: now
            };
            return linkedRun;
          });
          if (linkedRun) {
            operations.push(createGovernanceOperation(
              "cli-bridge-runner-result-linked-to-run",
              `Linked ${handoff.sourceRunner} CLI result to Agent Work Order run ${linkedRun.title || workOrderRunId}.`,
              {
                runId: workOrderRunId,
                handoffId: handoff.id,
                runner: handoff.sourceRunner,
                resultStatus: handoff.resultStatus,
                projectId: handoff.projectId,
                projectName: handoff.projectName
              }
            ));
          }

          return appendGovernanceOperations({
            ...current,
            agentWorkOrderRuns: nextRuns,
            cliBridgeHandoffs: [handoff, ...(Array.isArray(current.cliBridgeHandoffs) ? current.cliBridgeHandoffs : [])].slice(0, 250)
          }, operations);
        });

        return sendJson(res, 200, {
          success: true,
          handoff,
          linkedRun,
          ledger: createCliBridgeHandoffLedgerPayload(updated, { runner: "all", limit: 50 })
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid CLI bridge runner result request" });
      }
    }

    if (pathname.startsWith("/api/cli-bridge/handoffs/") && req.method === "PATCH") {
      try {
        const handoffId = decodeURIComponent(pathname.split("/").pop() || "");
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        const action = normalizeCliBridgeHandoffReviewAction(payload.action || payload.status);
        const nextStatus = action === "accept"
          ? "accepted"
          : action === "reject"
            ? "rejected"
            : "needs-review";
        const note = toText(payload.note || payload.notes);
        let updatedHandoff = null;
        let createdTask = null;
        let skippedTask = null;
        let linkedRun = null;
        const updated = await store.updateStore((current) => {
          const now = new Date().toISOString();
          const handoffs = Array.isArray(current.cliBridgeHandoffs) ? current.cliBridgeHandoffs : [];
          const tasks = Array.isArray(current.tasks) ? current.tasks : [];
          const nextHandoffs = handoffs.map((handoff) => {
            if (toText(handoff.id) !== handoffId) return handoff;
            const reviewHistory = Array.isArray(handoff.reviewHistory) ? handoff.reviewHistory : [];
            updatedHandoff = {
              ...handoff,
              status: nextStatus,
              nextAction: toText(payload.nextAction) || (action === "accept"
                ? "Accepted by operator review. Continue with validation and milestone closure before follow-up work."
                : action === "reject"
                  ? "Rejected by operator review. Do not use this runner result without a new work order."
                  : "Needs operator follow-up before acceptance or follow-up runner work."),
              notes: note || toText(handoff.notes),
              reviewAction: action,
              reviewStatus: nextStatus,
              reviewedBy: toText(payload.reviewer) || "operator",
              reviewedAt: now,
              reviewHistory: [
                {
                  action,
                  status: nextStatus,
                  note,
                  reviewer: toText(payload.reviewer) || "operator",
                  createdAt: now
                },
                ...reviewHistory
              ].slice(0, 25),
              updatedAt: now
            };
            return updatedHandoff;
          });

          if (!updatedHandoff) {
            return current;
          }

          let nextTasks = tasks;
          const workOrderRunId = toText(updatedHandoff.workOrderRunId);
          const existingRuns = Array.isArray(current.agentWorkOrderRuns) ? current.agentWorkOrderRuns : [];
          const nextRuns = existingRuns.map((run) => {
            if (!workOrderRunId || toText(run.id) !== workOrderRunId) return run;
            const status = toText(run.status) || "queued";
            const history = Array.isArray(run.history) ? run.history : [];
            linkedRun = {
              ...run,
              latestCliBridgeReviewHandoffId: handoffId,
              latestCliBridgeReviewAction: action,
              latestCliBridgeReviewStatus: nextStatus,
              latestCliBridgeReviewedAt: now,
              latestCliBridgeReviewNote: note,
              history: [
                createAgentWorkOrderRunEvent(status, `CLI bridge handoff review recorded: ${action} (${nextStatus}).`, status),
                ...history
              ].slice(0, 50),
              updatedAt: now
            };
            return linkedRun;
          });
          const operations = [
            createGovernanceOperation(
              "cli-bridge-handoff-review-recorded",
              `Marked CLI bridge handoff ${toText(updatedHandoff.title) || handoffId} ${nextStatus}.`,
              {
                handoffId,
                action,
                status: nextStatus,
                sourceRunner: toText(updatedHandoff.sourceRunner),
                targetRunner: toText(updatedHandoff.targetRunner),
                projectId: toText(updatedHandoff.projectId),
                workOrderRunId: toText(updatedHandoff.workOrderRunId)
              }
            )
          ];
          if (linkedRun) {
            operations.push(createGovernanceOperation(
              "cli-bridge-handoff-review-linked-to-run",
              `Linked CLI bridge review ${action} to Agent Work Order run ${linkedRun.title || workOrderRunId}.`,
              {
                runId: workOrderRunId,
                handoffId,
                action,
                status: nextStatus,
                projectId: toText(updatedHandoff.projectId),
                projectName: toText(updatedHandoff.projectName)
              }
            ));
          }

          if (action === "escalate" || payload.createTask === true) {
            const existingTask = tasks.find((task) => toText(task.cliBridgeHandoffId) === handoffId && toText(task.status) !== "resolved");
            if (existingTask) {
              skippedTask = {
                id: toText(existingTask.id),
                title: toText(existingTask.title),
                reason: "Open CLI bridge handoff review task already exists"
              };
            } else {
              createdTask = createCliBridgeHandoffReviewTask(updatedHandoff, action, note);
              nextTasks = [...tasks, createdTask];
              operations.push(createGovernanceOperation(
                "cli-bridge-handoff-review-task-created",
                `Created CLI bridge handoff review task for ${toText(updatedHandoff.projectName) || toText(updatedHandoff.projectId) || "Workspace Audit"}.`,
                {
                  taskId: createdTask.id,
                  handoffId,
                  action,
                  projectId: toText(updatedHandoff.projectId),
                  projectName: toText(updatedHandoff.projectName)
                }
              ));
            }
          }

          return appendGovernanceOperations({
            ...current,
            agentWorkOrderRuns: nextRuns,
            cliBridgeHandoffs: nextHandoffs,
            tasks: nextTasks
          }, operations);
        });

        if (!updatedHandoff) {
          return sendJson(res, 404, { error: "CLI bridge handoff not found" });
        }

        return sendJson(res, 200, {
          success: true,
          handoff: updatedHandoff,
          createdTask,
          skippedTask,
          linkedRun,
          ledger: createCliBridgeHandoffLedgerPayload(updated, { runner: "all", limit: 50 }),
          taskCount: Array.isArray(updated.tasks) ? updated.tasks.length : 0,
          governanceOperationCount: Array.isArray(updated.governanceOperations) ? updated.governanceOperations.length : 0
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid CLI bridge handoff review request" });
      }
    }

    if (pathname === "/api/cli-bridge/handoffs") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          return sendJson(res, 200, createCliBridgeHandoffLedgerPayload(persisted, {
            runner: requestUrl.searchParams.get("runner") || "all",
            status: requestUrl.searchParams.get("status") || "all",
            limit: Number(requestUrl.searchParams.get("limit") || 50)
          }));
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = body ? JSON.parse(body) : {};
          const handoff = createCliBridgeHandoffRecord(payload);
          const updated = await store.updateStore((current) => appendGovernanceOperations({
            ...current,
            cliBridgeHandoffs: [handoff, ...(Array.isArray(current.cliBridgeHandoffs) ? current.cliBridgeHandoffs : [])].slice(0, 250)
          }, [
            createGovernanceOperation(
              "cli-bridge-handoff-recorded",
              `Recorded ${handoff.sourceRunner} to ${handoff.targetRunner} CLI bridge handoff.`,
              {
                handoffId: handoff.id,
                sourceRunner: handoff.sourceRunner,
                targetRunner: handoff.targetRunner,
                status: handoff.status,
                resultType: handoff.resultType,
                projectId: handoff.projectId,
                workOrderRunId: handoff.workOrderRunId
              }
            )
          ]));

          return sendJson(res, 200, {
            success: true,
            handoff,
            ledger: createCliBridgeHandoffLedgerPayload(updated, { runner: "all", limit: 50 })
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid CLI bridge handoff request" });
        }
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

    if (req.method === "GET" && pathname === "/api/agent-execution-result/task-ledger") {
      try {
        const persisted = await store.readStore();
        return sendJson(res, 200, createAgentExecutionResultTaskLedgerPayload(persisted, {
          status: requestUrl.searchParams.get("status") || "all",
          limit: Number(requestUrl.searchParams.get("limit") || 100)
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/agent-execution-result/task-ledger-snapshots/diff") {
      try {
        const snapshotId = String(requestUrl.searchParams.get("snapshotId") || "latest").trim() || "latest";
        const persisted = await store.readStore();
        const snapshots = Array.isArray(persisted.agentExecutionResultTaskLedgerSnapshots)
          ? persisted.agentExecutionResultTaskLedgerSnapshots.map(toControlPlaneRecord)
          : [];
        const snapshot = snapshotId === "latest"
          ? snapshots[0]
          : snapshots.find((item) => toText(item.id) === snapshotId);
        if (!snapshot) {
          return sendJson(res, 200, createMissingAgentExecutionResultTaskLedgerSnapshotDiffPayload());
        }
        return sendJson(res, 200, createAgentExecutionResultTaskLedgerSnapshotDiffPayload(snapshot, createAgentExecutionResultTaskLedgerPayload(persisted, {
          status: toText(snapshot.statusFilter) || "all",
          limit: Number(snapshot.limit || 100)
        })));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (pathname === "/api/agent-execution-result/task-ledger-snapshots") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const snapshots = Array.isArray(persisted.agentExecutionResultTaskLedgerSnapshots) ? persisted.agentExecutionResultTaskLedgerSnapshots : [];
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
          const snapshot = createAgentExecutionResultTaskLedgerSnapshotRecord(persisted, {
            title: toText(payload.title) || "Agent Execution Result Task Ledger",
            status: toText(payload.status) || "all",
            limit: Number(payload.limit || 100)
          });

          const updated = await store.updateStore((current) => appendGovernanceOperations({
            ...current,
            agentExecutionResultTaskLedgerSnapshots: [snapshot, ...(Array.isArray(current.agentExecutionResultTaskLedgerSnapshots) ? current.agentExecutionResultTaskLedgerSnapshots : [])].slice(0, 100)
          }, [
            createGovernanceOperation(
              "agent-execution-result-task-ledger-snapshot-created",
              `Saved ${snapshot.title} execution-result task ledger snapshot.`,
              {
                snapshotId: snapshot.id,
                snapshotTitle: snapshot.title,
                statusFilter: snapshot.statusFilter,
                total: snapshot.total,
                openCount: snapshot.openCount,
                closedCount: snapshot.closedCount,
                actionCount: snapshot.actionCount
              }
            )
          ]));

          return sendJson(res, 200, {
            success: true,
            snapshot,
            agentExecutionResultTaskLedgerSnapshots: updated.agentExecutionResultTaskLedgerSnapshots
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid execution-result task ledger snapshot request" });
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
        if (toNumber(governance.summary.agentExecutionResultBaselineBlockedCount) > 0) {
          return sendJson(res, 409, {
            error: "Execution result baseline-refresh checkpoints are required before refreshing the Agent Control Plane baseline",
            checkpointBlocked: toNumber(governance.summary.agentExecutionResultBaselineBlockedCount),
            requirements: governance.agentExecutionResultRequirements || null
          });
        }
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
            approvedPolicyCount: workOrders.items.filter((item) => toControlPlaneRecord(item.agentPolicy).checkpointStatus === "approved").length,
            executableCount: workOrders.items.filter((item) => toControlPlaneRecord(item.agentPolicy).executable === true).length,
            unresolvedPolicyCount: workOrders.items.filter((item) => ["needs-review", "deferred"].includes(toText(toControlPlaneRecord(item.agentPolicy).checkpointStatus))).length,
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

    if (pathname === "/api/agent-policy-checkpoints") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const checkpoints = Array.isArray(persisted.agentPolicyCheckpoints) ? persisted.agentPolicyCheckpoints.map(toControlPlaneRecord) : [];
          return sendJson(res, 200, {
            generatedAt: new Date().toISOString(),
            summary: createAgentPolicyCheckpointSummary(checkpoints),
            agentPolicyCheckpoints: [...checkpoints]
              .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())
              .slice(0, 100),
            secretPolicy: "Non-secret managed agent policy checkpoint metadata only. Do not store passwords, tokens, certificates, private keys, cookies, browser sessions, or prompt text containing secrets."
          });
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = body ? JSON.parse(body) : {};
          const checkpoint = createAgentPolicyCheckpoint(payload);
          if (!checkpoint.policyId || !checkpoint.projectId) {
            return sendJson(res, 400, { error: "policyId and projectId are required" });
          }
          const updated = await store.updateStore((current) => {
            const existing = Array.isArray(current.agentPolicyCheckpoints) ? current.agentPolicyCheckpoints : [];
            return appendGovernanceOperations({
              ...current,
              agentPolicyCheckpoints: [checkpoint, ...existing].slice(0, 200)
            }, [
              createGovernanceOperation(
                "agent-policy-checkpoint-recorded",
                `Recorded ${checkpoint.status} managed-agent policy checkpoint for ${checkpoint.projectName || checkpoint.projectId}.`,
                {
                  checkpointId: checkpoint.id,
                  policyId: checkpoint.policyId,
                  projectId: checkpoint.projectId,
                  projectName: checkpoint.projectName,
                  status: checkpoint.status,
                  role: checkpoint.role,
                  runtime: checkpoint.runtime,
                  isolationMode: checkpoint.isolationMode
                }
              )
            ]);
          });

          return sendJson(res, 200, {
            success: true,
            checkpoint,
            summary: createAgentPolicyCheckpointSummary(updated.agentPolicyCheckpoints),
            agentPolicyCheckpointCount: Array.isArray(updated.agentPolicyCheckpoints) ? updated.agentPolicyCheckpoints.length : 0,
            governanceOperationCount: Array.isArray(updated.governanceOperations) ? updated.governanceOperations.length : 0
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid agent policy checkpoint request" });
        }
      }
    }

    if (pathname === "/api/agent-execution-result-checkpoints") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const inventory = await getInventoryPayload();
          const governance = buildGovernanceSnapshot(persisted, inventory);
          const checkpoints = Array.isArray(persisted.agentExecutionResultCheckpoints) ? persisted.agentExecutionResultCheckpoints.map(toControlPlaneRecord) : [];
          return sendJson(res, 200, {
            generatedAt: new Date().toISOString(),
            summary: createAgentExecutionResultCheckpointSummary(checkpoints),
            requirements: governance.agentExecutionResultRequirements || null,
            agentExecutionResultCheckpoints: [...checkpoints]
              .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime())
              .slice(0, 100),
            secretPolicy: "Non-secret execution result checkpoint metadata only. Do not store passwords, tokens, certificates, private keys, cookies, browser sessions, or command output containing secrets."
          });
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = body ? JSON.parse(body) : {};
          const requestedRunId = toText(payload.runId);
          if (!requestedRunId) {
            return sendJson(res, 400, { error: "runId is required" });
          }

          let checkpoint = null;
          let createdTask = null;
          let skippedTask = null;
          const updated = await store.updateStore((current) => {
            const runs = Array.isArray(current.agentWorkOrderRuns) ? current.agentWorkOrderRuns : [];
            const run = runs.find((item) => toText(item.id) === requestedRunId);
            if (!run) {
              throw new Error("Agent work order run not found");
            }
            checkpoint = createAgentExecutionResultCheckpoint({
              ...payload,
              runId: requestedRunId,
              projectId: toText(run.projectId),
              projectName: toText(run.projectName),
              runTitle: toText(run.title),
              runStatus: toText(run.status),
              resultType: toText(payload.resultType) || (toText(run.slaBreachedAt) && !toText(run.slaResolvedAt) ? "sla-breach" : toText(run.status) || "execution-result")
            });
            const existing = Array.isArray(current.agentExecutionResultCheckpoints) ? current.agentExecutionResultCheckpoints : [];
            const tasks = Array.isArray(current.tasks) ? current.tasks : [];
            let nextTasks = tasks;
            const operations = [
              createGovernanceOperation(
                "agent-execution-result-checkpoint-recorded",
                `Recorded ${checkpoint.status} execution-result checkpoint for ${checkpoint.projectName || checkpoint.runId}.`,
                {
                  checkpointId: checkpoint.id,
                  runId: checkpoint.runId,
                  projectId: checkpoint.projectId,
                  projectName: checkpoint.projectName,
                  runStatus: checkpoint.runStatus,
                  resultType: checkpoint.resultType,
                  targetAction: checkpoint.targetAction,
                  status: checkpoint.status
                }
              )
            ];

            if (checkpoint.status === "deferred") {
              const existingTask = findOpenAgentExecutionResultTask(tasks, checkpoint);
              if (existingTask) {
                skippedTask = {
                  id: toText(existingTask.id),
                  title: toText(existingTask.title),
                  reason: "Open execution-result follow-up task already exists"
                };
              } else {
                createdTask = createAgentExecutionResultCheckpointTask(checkpoint, run);
                nextTasks = [...tasks, createdTask];
                operations.push(createGovernanceOperation(
                  "agent-execution-result-checkpoint-task-created",
                  `Created execution-result follow-up task for ${checkpoint.projectName || checkpoint.runId}.`,
                  {
                    taskId: createdTask.id,
                    checkpointId: checkpoint.id,
                    runId: checkpoint.runId,
                    projectId: checkpoint.projectId,
                    projectName: checkpoint.projectName,
                    targetAction: checkpoint.targetAction,
                    status: checkpoint.status
                  }
                ));
              }
            }

            return appendGovernanceOperations({
              ...current,
              tasks: nextTasks,
              agentExecutionResultCheckpoints: [checkpoint, ...existing].slice(0, 250)
            }, operations);
          });

          return sendJson(res, 200, {
            success: true,
            checkpoint,
            createdTask,
            skippedTask,
            summary: createAgentExecutionResultCheckpointSummary(updated.agentExecutionResultCheckpoints),
            agentExecutionResultCheckpointCount: Array.isArray(updated.agentExecutionResultCheckpoints) ? updated.agentExecutionResultCheckpoints.length : 0,
            agentExecutionResultTaskCount: Array.isArray(updated.tasks) ? updated.tasks.filter((task) => toText(task.agentExecutionResultRunId) || toText(task.agentExecutionResultCheckpointId)).length : 0,
            governanceOperationCount: Array.isArray(updated.governanceOperations) ? updated.governanceOperations.length : 0
          });
        } catch (error) {
          return sendJson(res, error.message === "Agent work order run not found" ? 404 : 400, { error: error.message || "Invalid execution result checkpoint request" });
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
          const agentPolicyId = String(payload.agentPolicyId || "").trim();
          let agentPolicyCheckpoint = {};
          if (agentPolicyId) {
            const persisted = await store.readStore();
            agentPolicyCheckpoint = createLatestAgentPolicyCheckpointMap(persisted.agentPolicyCheckpoints).get(agentPolicyId) || {};
            const policyStatus = normalizeAgentPolicyCheckpointStatus(agentPolicyCheckpoint.status);
            if (policyStatus !== "approved") {
              return sendJson(res, 409, {
                error: "Generated agent policy must be approved before queueing this work order",
                policyId: agentPolicyId,
                checkpointStatus: policyStatus
              });
            }
          }
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
            agentPolicyId,
            agentPolicyCheckpointId: toText(agentPolicyCheckpoint.id) || String(payload.agentPolicyCheckpointId || "").trim(),
            agentPolicyCheckpointStatus: agentPolicyId ? normalizeAgentPolicyCheckpointStatus(agentPolicyCheckpoint.status) : normalizeAgentPolicyCheckpointStatus(payload.agentPolicyCheckpointStatus),
            agentRole: String(payload.agentRole || payload.role || toText(agentPolicyCheckpoint.role) || "").trim(),
            runtime: String(payload.runtime || toText(agentPolicyCheckpoint.runtime) || "").trim(),
            isolationMode: String(payload.isolationMode || toText(agentPolicyCheckpoint.isolationMode) || "").trim(),
            skillBundle: toTextList(payload.skillBundle).length ? toTextList(payload.skillBundle) : toTextList(agentPolicyCheckpoint.skillBundle),
            hookPolicy: toTextList(payload.hookPolicy).length ? toTextList(payload.hookPolicy) : toTextList(agentPolicyCheckpoint.hookPolicy),
            agentPolicySecretPolicy: toText(agentPolicyCheckpoint.secretPolicy) || "Non-secret managed agent policy metadata only.",
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
        let policyBlocked = 0;
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
          const latestPolicyCheckpointByPolicyId = createLatestAgentPolicyCheckpointMap(current.agentPolicyCheckpoints);
          queuedRuns = (Array.isArray(snapshot.items) ? snapshot.items : [])
            .filter((item) => {
              const key = `${snapshotId}:${toText(item.projectId)}`;
              if (existingProjectKeys.has(key)) {
                skipped += 1;
                return false;
              }
              const agentPolicy = toControlPlaneRecord(item.agentPolicy);
              const policyId = toText(agentPolicy.policyId) || (toText(item.projectId) ? `agent-policy:${toText(item.projectId)}` : "");
              if (policyId) {
                const checkpoint = latestPolicyCheckpointByPolicyId.get(policyId) || {};
                if (normalizeAgentPolicyCheckpointStatus(checkpoint.status) !== "approved") {
                  skipped += 1;
                  policyBlocked += 1;
                  return false;
                }
              }
              existingProjectKeys.add(key);
              return true;
            })
            .map((item) => {
              const agentPolicy = toControlPlaneRecord(item.agentPolicy);
              const policyId = toText(agentPolicy.policyId) || (toText(item.projectId) ? `agent-policy:${toText(item.projectId)}` : "");
              const checkpoint = policyId ? latestPolicyCheckpointByPolicyId.get(policyId) || {} : {};
              return {
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
                agentPolicyId: policyId,
                agentPolicyCheckpointId: toText(checkpoint.id),
                agentPolicyCheckpointStatus: policyId ? normalizeAgentPolicyCheckpointStatus(checkpoint.status) : normalizeAgentPolicyCheckpointStatus(agentPolicy.checkpointStatus),
                agentRole: toText(agentPolicy.role) || toText(checkpoint.role),
                runtime: toText(agentPolicy.runtime) || toText(checkpoint.runtime),
                isolationMode: toText(agentPolicy.isolationMode) || toText(checkpoint.isolationMode),
                skillBundle: toTextList(agentPolicy.skillBundle).length ? toTextList(agentPolicy.skillBundle) : toTextList(checkpoint.skillBundle),
                hookPolicy: toTextList(agentPolicy.hookPolicy).length ? toTextList(agentPolicy.hookPolicy) : toTextList(checkpoint.hookPolicy),
                agentPolicySecretPolicy: toText(agentPolicy.secretPolicy) || toText(checkpoint.secretPolicy) || "Non-secret managed agent policy metadata only.",
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
              };
            })
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
                skipped,
                policyBlocked
              }
            )
          ]);
        });

        return sendJson(res, 200, {
          success: true,
          queuedRuns,
          skipped,
          policyBlocked,
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
        let checkpointBlocked = 0;
        const now = new Date().toISOString();

        const updated = await store.updateStore((current) => {
          const existingRuns = Array.isArray(current.agentWorkOrderRuns) ? current.agentWorkOrderRuns : [];
          const latestExecutionResultCheckpointByRunAction = createLatestAgentExecutionResultCheckpointMap(current.agentExecutionResultCheckpoints);
          const candidates = existingRuns
            .filter((run) => terminalStatuses.has(toText(run.status)))
            .filter((run) => !toText(run.archivedAt))
            .filter((run) => !requestedRunIds || requestedRunIds.has(toText(run.id)))
            .sort((left, right) => new Date(toText(right.updatedAt || right.createdAt)).getTime() - new Date(toText(left.updatedAt || left.createdAt)).getTime());
          const retainedIds = new Set(candidates.slice(0, retainCompleted).map((run) => toText(run.id)));
          const archiveIds = new Set();
          for (const run of candidates.slice(retainCompleted)) {
            const runId = toText(run.id);
            if (
              hasApprovedAgentExecutionResultCheckpoint(latestExecutionResultCheckpointByRunAction, runId, "retention")
              || hasApprovedAgentExecutionResultCheckpoint(latestExecutionResultCheckpointByRunAction, runId, "archive")
            ) {
              archiveIds.add(runId);
            } else {
              checkpointBlocked += 1;
            }
          }
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
                    checkpointBlocked,
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
          checkpointBlocked,
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
        let checkpointBlocked = 0;

        const updated = await store.updateStore((current) => {
          const latestExecutionResultCheckpointByRunAction = createLatestAgentExecutionResultCheckpointMap(current.agentExecutionResultCheckpoints);
          const nextRuns = (Array.isArray(current.agentWorkOrderRuns) ? current.agentWorkOrderRuns : []).map((run) => {
            const runId = toText(run.id);
            if (requestedRunIds && !requestedRunIds.has(runId)) return run;
            if (toText(run.archivedAt) || !toText(run.slaBreachedAt) || toText(run.slaResolvedAt)) {
              skipped += 1;
              return run;
            }
            if (!hasApprovedAgentExecutionResultCheckpoint(latestExecutionResultCheckpointByRunAction, runId, "resolve-sla")) {
              checkpointBlocked += 1;
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
                    skipped,
                    checkpointBlocked
                  }
                )
              ])
            : nextStore;
        });

        return sendJson(res, 200, {
          success: true,
          resolved: resolvedRuns.length,
          skipped,
          checkpointBlocked,
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
          const latestExecutionResultCheckpointByRunAction = createLatestAgentExecutionResultCheckpointMap(current.agentExecutionResultCheckpoints);
          const nextRuns = (Array.isArray(current.agentWorkOrderRuns) ? current.agentWorkOrderRuns : []).map((run) => {
            if (run.id !== runId) return run;
            const now = new Date().toISOString();
            const nextStatus = payload.status ? String(payload.status).trim() : toText(run.status);
            const nextNotes = payload.notes != null ? String(payload.notes || "").trim() : toText(run.notes);
            const currentArchivedAt = toText(run.archivedAt);
            const shouldArchive = payload.archived === true;
            const shouldRestore = payload.archived === false;
            const currentStatus = toText(run.status) || "queued";
            if (nextStatus === "queued" && ["failed", "cancelled"].includes(currentStatus) && !hasApprovedAgentExecutionResultCheckpoint(latestExecutionResultCheckpointByRunAction, toText(run.id), "retry")) {
              const checkpointError = new Error("An approved execution result retry checkpoint is required before retrying this run");
              checkpointError.statusCode = 409;
              checkpointError.checkpointBlocked = 1;
              checkpointError.targetAction = "retry";
              throw checkpointError;
            }
            if (shouldArchive && !currentArchivedAt && ["passed", "failed", "cancelled"].includes(nextStatus) && !hasApprovedAgentExecutionResultCheckpoint(latestExecutionResultCheckpointByRunAction, toText(run.id), "archive")) {
              const checkpointError = new Error("An approved execution result archive checkpoint is required before archiving this run");
              checkpointError.statusCode = 409;
              checkpointError.checkpointBlocked = 1;
              checkpointError.targetAction = "archive";
              throw checkpointError;
            }
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
        return sendJson(res, error.statusCode || 400, {
          error: error.message || "Invalid request",
          checkpointBlocked: error.checkpointBlocked || 0,
          targetAction: error.targetAction || ""
        });
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
          findings: buildFindings(result.payload, {
            convergenceReviews: current.convergenceReviews
          }),
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

    if (req.method === "GET" && pathname === "/api/releases/task-ledger-snapshots/diff") {
      try {
        const snapshotId = String(requestUrl.searchParams.get("snapshotId") || "latest").trim() || "latest";
        const persisted = await store.readStore();
        const snapshots = Array.isArray(persisted.releaseTaskLedgerSnapshots)
          ? persisted.releaseTaskLedgerSnapshots.map(toControlPlaneRecord)
          : [];
        const snapshot = snapshotId === "latest"
          ? snapshots[0]
          : snapshots.find((item) => toText(item.id) === snapshotId);
        if (!snapshot) {
          return sendJson(res, 200, createMissingReleaseTaskLedgerSnapshotDiffPayload());
        }
        return sendJson(res, 200, createReleaseTaskLedgerSnapshotDiffPayload(snapshot, createReleaseTaskLedgerPayload(persisted, {
          status: toText(snapshot.statusFilter) || "all",
          limit: Number(snapshot.limit || 100)
        })));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (pathname === "/api/releases/task-ledger-snapshots") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const snapshots = Array.isArray(persisted.releaseTaskLedgerSnapshots) ? persisted.releaseTaskLedgerSnapshots : [];
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
          const snapshot = createReleaseTaskLedgerSnapshotRecord(persisted, {
            title: toText(payload.title) || "Release Control Task Ledger",
            status: toText(payload.status) || "all",
            limit: Number(payload.limit || 100)
          });

          const updated = await store.updateStore((current) => appendGovernanceOperations({
            ...current,
            releaseTaskLedgerSnapshots: [snapshot, ...(Array.isArray(current.releaseTaskLedgerSnapshots) ? current.releaseTaskLedgerSnapshots : [])].slice(0, 100)
          }, [
            createGovernanceOperation(
              "release-task-ledger-snapshot-created",
              `Saved ${snapshot.title} Release Control task ledger snapshot.`,
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
            releaseTaskLedgerSnapshots: updated.releaseTaskLedgerSnapshots
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid Release Control task ledger snapshot request" });
        }
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
        const shouldCaptureSnapshot = payload.saveSnapshot === true || payload.captureSnapshot === true || payload.autoCaptureSnapshot === true;
        /** @type {Record<string, unknown> | null} */
        let capturedSnapshot = null;
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

          let nextState = {
            ...current,
            tasks: nextTasks
          };
          const operations = [
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
          ];

          if (shouldCaptureSnapshot) {
            capturedSnapshot = createReleaseTaskLedgerSnapshotRecord(nextState, {
              title: toText(payload.snapshotTitle) || "Release Control Task Ledger Auto Capture",
              status: toText(payload.snapshotStatus || payload.status) || "all",
              limit: Number(payload.snapshotLimit || payload.limit || 100)
            });
            nextState = {
              ...nextState,
              releaseTaskLedgerSnapshots: [capturedSnapshot, ...(Array.isArray(current.releaseTaskLedgerSnapshots) ? current.releaseTaskLedgerSnapshots : [])].slice(0, 100)
            };
            operations.push(createGovernanceOperation(
              "release-task-ledger-snapshot-auto-captured",
              `Auto-captured ${toText(capturedSnapshot.title) || "Release Control Task Ledger"} after Release Build Gate task seeding.`,
              {
                snapshotId: toText(capturedSnapshot.id),
                snapshotTitle: toText(capturedSnapshot.title),
                statusFilter: toText(capturedSnapshot.statusFilter),
                total: toNumber(capturedSnapshot.total),
                openCount: toNumber(capturedSnapshot.openCount),
                closedCount: toNumber(capturedSnapshot.closedCount),
                created: createdTasks.length,
                skipped: skipped.length
              }
            ));
          }

          return appendGovernanceOperations(nextState, operations);
        });

        return sendJson(res, 200, {
          success: true,
          requested: requestedActions.length,
          createdTasks,
          skipped,
          snapshotCaptured: Boolean(capturedSnapshot),
          snapshot: capturedSnapshot,
          totals: {
            requested: requestedActions.length,
            created: createdTasks.length,
            skipped: skipped.length
          },
          releaseTaskLedgerSnapshots: Array.isArray(updated.releaseTaskLedgerSnapshots) ? updated.releaseTaskLedgerSnapshots : [],
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

    if (req.method === "GET" && pathname === "/api/sources/access-method-registry") {
      try {
        return sendJson(res, 200, await createSourcesAccessMethodRegistryPayload());
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/sources/access-validation-workflow") {
      try {
        return sendJson(res, 200, await createSourcesAccessValidationWorkflowPayload());
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/sources/access-validation-workflow-snapshots/diff") {
      try {
        const snapshotId = String(requestUrl.searchParams.get("snapshotId") || "latest").trim() || "latest";
        const persisted = await store.readStore();
        const snapshots = Array.isArray(persisted.dataSourceAccessValidationWorkflowSnapshots)
          ? persisted.dataSourceAccessValidationWorkflowSnapshots.map(toControlPlaneRecord)
          : [];
        const snapshot = snapshotId === "latest"
          ? snapshots[0]
          : snapshots.find((item) => toText(item.id) === snapshotId);
        if (!snapshot) {
          return sendJson(res, 200, createMissingSourcesAccessValidationWorkflowSnapshotDiffPayload());
        }
        return sendJson(res, 200, createSourcesAccessValidationWorkflowSnapshotDiffPayload(snapshot, await createSourcesAccessValidationWorkflowPayload()));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (pathname === "/api/sources/access-validation-workflow-snapshots") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const snapshots = Array.isArray(persisted.dataSourceAccessValidationWorkflowSnapshots) ? persisted.dataSourceAccessValidationWorkflowSnapshots : [];
          return sendJson(res, 200, snapshots.slice(0, 50));
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = body ? JSON.parse(body) : {};
          const workflow = await createSourcesAccessValidationWorkflowPayload();
          const snapshot = createSourcesAccessValidationWorkflowSnapshotRecord(workflow, payload);
          const updated = await store.updateStore((current) => appendGovernanceOperations({
            ...current,
            dataSourceAccessValidationWorkflowSnapshots: [snapshot, ...(Array.isArray(current.dataSourceAccessValidationWorkflowSnapshots) ? current.dataSourceAccessValidationWorkflowSnapshots : [])].slice(0, 100)
          }, [
            createGovernanceOperation(
              "data-source-access-validation-workflow-snapshot-created",
              `Saved ${snapshot.title} Data Sources access validation workflow snapshot.`,
              {
                snapshotId: snapshot.id,
                snapshotTitle: snapshot.title,
                total: snapshot.total,
                readyCount: snapshot.readyCount,
                pendingCount: snapshot.pendingCount,
                blockedCount: snapshot.blockedCount,
                missingEvidenceCount: snapshot.missingEvidenceCount
              }
            )
          ]));

          return sendJson(res, 200, {
            success: true,
            snapshot,
            dataSourceAccessValidationWorkflowSnapshots: updated.dataSourceAccessValidationWorkflowSnapshots
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    if (req.method === "POST" && pathname === "/api/sources/access-validation-workflow/tasks") {
      try {
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        const workflow = await createSourcesAccessValidationWorkflowPayload();
        const liveItems = Array.isArray(workflow.items) ? workflow.items.map(toControlPlaneRecord) : [];
        const actionableItems = liveItems.filter((item) => toText(item.status) !== "ready");
        const liveItemsById = new Map(liveItems.map((item) => [toText(item.id), item]));
        const requestedItems = (Array.isArray(payload.items) && payload.items.length ? payload.items : actionableItems)
          .map((item) => {
            const record = toControlPlaneRecord(item);
            return liveItemsById.get(toText(record.id)) || record;
          })
          .filter((item) => toText(item.id) && toText(item.status) !== "ready");

        if (!requestedItems.length) {
          return sendJson(res, 400, { error: "At least one pending or blocked validation workflow item is required" });
        }

        /** @type {Record<string, unknown>[]} */
        const createdTasks = [];
        /** @type {Array<{ id: string, label: string, reason: string }>} */
        const skipped = [];
        const shouldCaptureSnapshot = payload.saveSnapshot === true || payload.captureSnapshot === true || payload.autoCaptureSnapshot === true;
        /** @type {Record<string, unknown> | null} */
        let capturedSnapshot = null;
        const updated = await store.updateStore((current) => {
          const tasks = Array.isArray(current.tasks) ? current.tasks : [];
          let nextTasks = tasks;

          for (const item of requestedItems) {
            const workflowId = toText(item.id);
            const sourceLabel = toText(item.label) || "Source";
            const title = `Source validation workflow: ${sourceLabel}`;
            const exists = nextTasks.some((task) => (
              toText(task.sourceAccessValidationWorkflowId) === workflowId
              || (toText(task.projectId) === "data-sources" && toText(task.title) === title)
            ));

            if (exists) {
              skipped.push({ id: workflowId, label: sourceLabel, reason: "Task already exists" });
              continue;
            }

            const task = createSourceAccessValidationWorkflowTask(item);
            createdTasks.push(task);
            nextTasks = [...nextTasks, task];
          }

          let nextState = {
            ...current,
            tasks: nextTasks
          };
          const operations = [
            createGovernanceOperation(
              "data-source-access-validation-workflow-tasks-created",
              `Created ${createdTasks.length} Data Sources access validation workflow task(s).`,
              {
                requested: requestedItems.length,
                created: createdTasks.length,
                skipped: skipped.length,
                workflowIds: requestedItems.map((item) => toText(item.id))
              }
            )
          ];

          if (shouldCaptureSnapshot) {
            capturedSnapshot = createSourcesAccessTaskLedgerSnapshotRecord(nextState, {
              title: toText(payload.snapshotTitle) || "Data Sources Access Validation Workflow Task Ledger Auto Capture",
              status: toText(payload.snapshotStatus || payload.status) || "open",
              limit: Number(payload.snapshotLimit || payload.limit || 100)
            });
            nextState = {
              ...nextState,
              dataSourceAccessTaskLedgerSnapshots: [capturedSnapshot, ...(Array.isArray(current.dataSourceAccessTaskLedgerSnapshots) ? current.dataSourceAccessTaskLedgerSnapshots : [])].slice(0, 100)
            };
            operations.push(createGovernanceOperation(
              "data-source-access-validation-workflow-task-ledger-snapshot-auto-captured",
              `Auto-captured ${toText(capturedSnapshot.title) || "Data Sources Access Task Ledger"} after validation workflow task seeding.`,
              {
                snapshotId: toText(capturedSnapshot.id),
                snapshotTitle: toText(capturedSnapshot.title),
                statusFilter: toText(capturedSnapshot.statusFilter),
                total: toNumber(capturedSnapshot.total),
                openCount: toNumber(capturedSnapshot.openCount),
                closedCount: toNumber(capturedSnapshot.closedCount),
                created: createdTasks.length,
                skipped: skipped.length
              }
            ));
          }

          return appendGovernanceOperations(nextState, operations);
        });

        return sendJson(res, 200, {
          success: true,
          requested: requestedItems.length,
          createdTasks,
          skipped,
          snapshotCaptured: Boolean(capturedSnapshot),
          snapshot: capturedSnapshot,
          totals: {
            requested: requestedItems.length,
            created: createdTasks.length,
            skipped: skipped.length
          },
          dataSourceAccessTaskLedgerSnapshots: Array.isArray(updated.dataSourceAccessTaskLedgerSnapshots) ? updated.dataSourceAccessTaskLedgerSnapshots : [],
          tasks: updated.tasks
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid request" });
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
        const shouldCaptureSnapshot = payload.saveSnapshot === true || payload.captureSnapshot === true || payload.autoCaptureSnapshot === true;
        /** @type {Record<string, unknown> | null} */
        let capturedSnapshot = null;
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

          let nextState = {
            ...current,
            tasks: nextTasks
          };
          const operations = [
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
          ];

          if (shouldCaptureSnapshot) {
            capturedSnapshot = createSourcesAccessTaskLedgerSnapshotRecord(nextState, {
              title: toText(payload.snapshotTitle) || "Data Sources Access Validation Evidence Coverage Task Ledger Auto Capture",
              status: toText(payload.snapshotStatus || payload.status) || "all",
              limit: Number(payload.snapshotLimit || payload.limit || 100)
            });
            nextState = {
              ...nextState,
              dataSourceAccessTaskLedgerSnapshots: [capturedSnapshot, ...(Array.isArray(current.dataSourceAccessTaskLedgerSnapshots) ? current.dataSourceAccessTaskLedgerSnapshots : [])].slice(0, 100)
            };
            operations.push(createGovernanceOperation(
              "data-source-access-validation-evidence-coverage-task-ledger-snapshot-auto-captured",
              `Auto-captured ${toText(capturedSnapshot.title) || "Data Sources Access Task Ledger"} after evidence coverage task seeding.`,
              {
                snapshotId: toText(capturedSnapshot.id),
                snapshotTitle: toText(capturedSnapshot.title),
                statusFilter: toText(capturedSnapshot.statusFilter),
                total: toNumber(capturedSnapshot.total),
                openCount: toNumber(capturedSnapshot.openCount),
                closedCount: toNumber(capturedSnapshot.closedCount),
                created: createdTasks.length,
                skipped: skipped.length
              }
            ));
          }

          return appendGovernanceOperations(nextState, operations);
        });

        return sendJson(res, 200, {
          success: true,
          requested: requestedItems.length,
          createdTasks,
          skipped,
          snapshotCaptured: Boolean(capturedSnapshot),
          snapshot: capturedSnapshot,
          totals: {
            requested: requestedItems.length,
            created: createdTasks.length,
            skipped: skipped.length
          },
          dataSourceAccessTaskLedgerSnapshots: Array.isArray(updated.dataSourceAccessTaskLedgerSnapshots) ? updated.dataSourceAccessTaskLedgerSnapshots : [],
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
        const shouldCaptureSnapshot = payload.saveSnapshot === true || payload.captureSnapshot === true || payload.autoCaptureSnapshot === true;
        /** @type {Record<string, unknown> | null} */
        let capturedSnapshot = null;
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

          let nextState = nextStore;
          const operations = [
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
          ];

          if (shouldCaptureSnapshot) {
            capturedSnapshot = createSourcesAccessTaskLedgerSnapshotRecord(nextState, {
              title: toText(payload.snapshotTitle) || "Data Sources Access Review Task Ledger Auto Capture",
              status: toText(payload.snapshotStatus || payload.status) || "all",
              limit: Number(payload.snapshotLimit || payload.limit || 100)
            });
            nextState = {
              ...nextState,
              dataSourceAccessTaskLedgerSnapshots: [capturedSnapshot, ...(Array.isArray(current.dataSourceAccessTaskLedgerSnapshots) ? current.dataSourceAccessTaskLedgerSnapshots : [])].slice(0, 100)
            };
            operations.push(createGovernanceOperation(
              "data-source-access-review-task-ledger-snapshot-auto-captured",
              `Auto-captured ${toText(capturedSnapshot.title) || "Data Sources Access Task Ledger"} after source access review task seeding.`,
              {
                snapshotId: toText(capturedSnapshot.id),
                snapshotTitle: toText(capturedSnapshot.title),
                statusFilter: toText(capturedSnapshot.statusFilter),
                total: toNumber(capturedSnapshot.total),
                openCount: toNumber(capturedSnapshot.openCount),
                closedCount: toNumber(capturedSnapshot.closedCount),
                created: createdTasks.length,
                skipped: skipped.length
              }
            ));
          }

          return appendGovernanceOperations(nextState, operations);
        });

        return sendJson(res, 200, {
          success: true,
          requested: requestedItems.length,
          createdTasks,
          skipped,
          snapshotCaptured: Boolean(capturedSnapshot),
          snapshot: capturedSnapshot,
          totals: {
            requested: requestedItems.length,
            created: createdTasks.length,
            skipped: skipped.length
          },
          dataSourceAccessTaskLedgerSnapshots: Array.isArray(updated.dataSourceAccessTaskLedgerSnapshots) ? updated.dataSourceAccessTaskLedgerSnapshots : [],
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
          const snapshot = createSourcesAccessTaskLedgerSnapshotRecord(persisted, payload);

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

    if (pathname === "/api/governance/task-seeding-checkpoints") {
      if (req.method === "GET") {
        const persisted = await store.readStore();
        const checkpoints = Array.isArray(persisted.taskSeedingCheckpoints) ? persisted.taskSeedingCheckpoints : [];
        return sendJson(res, 200, {
          generatedAt: new Date().toISOString(),
          taskSeedingCheckpoints: [...checkpoints]
            .sort((left, right) => new Date(toText(right.createdAt)).getTime() - new Date(toText(left.createdAt)).getTime()),
          secretPolicy: "Non-secret generated task batch checkpoint metadata only. Do not store passwords, tokens, certificates, private keys, cookies, or browser sessions."
        });
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = JSON.parse(body);
          const checkpoint = createTaskSeedingCheckpoint(payload);
          const updated = await store.updateStore((current) => {
            const existing = Array.isArray(current.taskSeedingCheckpoints) ? current.taskSeedingCheckpoints : [];
            return appendGovernanceOperations({
              ...current,
              taskSeedingCheckpoints: [checkpoint, ...existing].slice(0, 100)
            }, [
              createGovernanceOperation("task-seeding-checkpoint-recorded", `Recorded ${checkpoint.status} task seeding checkpoint for ${checkpoint.title}.`, {
                checkpointId: checkpoint.id,
                batchId: checkpoint.batchId,
                status: checkpoint.status,
                source: checkpoint.source,
                itemCount: checkpoint.itemCount
              })
            ]);
          });

          return sendJson(res, 200, {
            success: true,
            checkpoint,
            taskSeedingCheckpointCount: Array.isArray(updated.taskSeedingCheckpoints) ? updated.taskSeedingCheckpoints.length : 0,
            governanceOperationCount: Array.isArray(updated.governanceOperations) ? updated.governanceOperations.length : 0
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid request" });
        }
      }
    }

    if (req.method === "GET" && pathname === "/api/convergence/candidates") {
      try {
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        return sendJson(res, 200, createConvergenceCandidatesPayload(inventory, persisted, {
          projectId: requestUrl.searchParams.get("projectId"),
          status: requestUrl.searchParams.get("status"),
          includeNotRelated: requestUrl.searchParams.get("includeNotRelated")
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/convergence/due-diligence-pack") {
      try {
        const pairId = toText(requestUrl.searchParams.get("pairId"));
        if (!pairId) {
          return sendJson(res, 400, { error: "pairId is required" });
        }
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        const pack = createConvergenceDueDiligencePackPayload(inventory, persisted, pairId);
        if (!pack) {
          return sendJson(res, 404, { error: "Convergence candidate not found" });
        }
        return sendJson(res, 200, pack);
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/convergence/assimilation-blueprint") {
      try {
        const pairId = toText(requestUrl.searchParams.get("pairId"));
        if (!pairId) {
          return sendJson(res, 400, { error: "pairId is required" });
        }
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        const blueprint = createConvergenceAssimilationBlueprintPayload(inventory, persisted, pairId);
        if (!blueprint) {
          return sendJson(res, 404, { error: "Convergence candidate not found" });
        }
        return sendJson(res, 200, blueprint);
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/convergence/assimilation-work-order-draft") {
      try {
        const pairId = toText(requestUrl.searchParams.get("pairId"));
        if (!pairId) {
          return sendJson(res, 400, { error: "pairId is required" });
        }
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        const draft = createConvergenceAssimilationWorkOrderDraftPayload(inventory, persisted, pairId, {
          runner: requestUrl.searchParams.get("runner")
        });
        if (!draft) {
          return sendJson(res, 404, { error: "Convergence candidate not found" });
        }
        return sendJson(res, 200, draft);
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "POST" && pathname === "/api/convergence/assimilation-work-order-run") {
      try {
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        const pairId = toText(payload.pairId || requestUrl.searchParams.get("pairId"));
        if (!pairId) {
          return sendJson(res, 400, { error: "pairId is required" });
        }
        const runner = payload.runner || requestUrl.searchParams.get("runner") || "codex";
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        const draftPayload = createConvergenceAssimilationWorkOrderDraftPayload(inventory, persisted, pairId, { runner });
        if (!draftPayload) {
          return sendJson(res, 404, { error: "Convergence candidate not found" });
        }
        if (draftPayload.draftDecision === "hold") {
          return sendJson(res, 409, {
            error: draftPayload.recommendedAction,
            draft: draftPayload
          });
        }
        if (!toText(draftPayload.draft.projectId) || !toText(draftPayload.draft.projectName)) {
          return sendJson(res, 400, {
            error: "Convergence assimilation work-order runs require a linked project id and project name.",
            draft: draftPayload
          });
        }

        let queuedRun = null;
        let skippedRun = null;
        const updated = await store.updateStore((current) => {
          const existingRuns = Array.isArray(current.agentWorkOrderRuns) ? current.agentWorkOrderRuns : [];
          const existingRun = existingRuns.find((run) =>
            toText(run.convergencePairId) === toText(draftPayload.pairId)
            && toText(run.convergenceAssimilationRunner) === toText(draftPayload.runner)
            && !toText(run.archivedAt)
          );
          if (existingRun) {
            skippedRun = {
              id: toText(existingRun.id),
              title: toText(existingRun.title),
              reason: "Open convergence assimilation work-order run already exists for this runner"
            };
            return current;
          }

          queuedRun = createAgentWorkOrderRunFromConvergenceAssimilationDraft(draftPayload, payload);
          return appendGovernanceOperations({
            ...current,
            agentWorkOrderRuns: [queuedRun, ...existingRuns].slice(0, 200)
          }, [
            createGovernanceOperation(
              "convergence-assimilation-work-order-run-queued",
              `Queued convergence assimilation work-order run for ${queuedRun.projectName || queuedRun.projectId}.`,
              {
                runId: queuedRun.id,
                pairId: toText(draftPayload.pairId),
                runner: toText(draftPayload.runner),
                draftDecision: toText(draftPayload.draftDecision),
                projectId: queuedRun.projectId,
                projectName: queuedRun.projectName
              }
            )
          ]);
        });

        return sendJson(res, 200, {
          success: true,
          run: queuedRun,
          skippedRun,
          draft: draftPayload,
          agentWorkOrderRuns: updated.agentWorkOrderRuns,
          governanceOperationCount: Array.isArray(updated.governanceOperations) ? updated.governanceOperations.length : 0
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid convergence assimilation work-order run request" });
      }
    }

    if (req.method === "GET" && pathname === "/api/convergence/assimilation-run-ledger") {
      try {
        const persisted = await store.readStore();
        return sendJson(res, 200, createConvergenceAssimilationRunLedgerPayload(persisted, {
          status: requestUrl.searchParams.get("status")
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/convergence/assimilation-result-ledger") {
      try {
        const persisted = await store.readStore();
        return sendJson(res, 200, createConvergenceAssimilationResultLedgerPayload(persisted, {
          status: requestUrl.searchParams.get("status")
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/convergence/assimilation-result-checkpoint-ledger") {
      try {
        const persisted = await store.readStore();
        return sendJson(res, 200, createConvergenceAssimilationResultCheckpointLedgerPayload(persisted, {
          status: requestUrl.searchParams.get("status")
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/convergence/assimilation-readiness-gate") {
      try {
        const persisted = await store.readStore();
        return sendJson(res, 200, createConvergenceAssimilationReadinessGatePayload(persisted));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname.startsWith("/api/convergence/assimilation-runs/") && pathname.endsWith("/trace-pack")) {
      try {
        const runId = decodeURIComponent(pathname.split("/")[4] || "");
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        return sendJson(res, 200, createConvergenceAssimilationRunTracePackPayload(inventory, persisted, runId));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "POST" && pathname.startsWith("/api/convergence/assimilation-runs/") && pathname.endsWith("/result")) {
      try {
        const runId = decodeURIComponent(pathname.split("/")[4] || "");
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        let resultRecord = null;
        let linkedRun = null;
        const updated = await store.updateStore((current) => {
          const now = new Date().toISOString();
          const existingRuns = Array.isArray(current.agentWorkOrderRuns) ? current.agentWorkOrderRuns : [];
          const selectedRun = existingRuns.map(toControlPlaneRecord).find((run) => toText(run.id) === runId);
          if (!runId || !selectedRun) {
            throw new Error("Convergence assimilation run was not found.");
          }
          if (!toText(selectedRun.convergencePairId) || !toText(selectedRun.convergenceAssimilationRunner)) {
            throw new Error("Selected Agent Work Order run is not a convergence assimilation run.");
          }

          resultRecord = createConvergenceAssimilationRunResultRecord(selectedRun, payload);
          const nextStatus = getConvergenceAssimilationRunStatusFromResult(resultRecord.status, selectedRun.status);
          const nextRuns = existingRuns.map((run) => {
            if (toText(run.id) !== runId) return run;
            const previousStatus = toText(run.status) || "queued";
            const history = Array.isArray(run.history) ? run.history : [];
            linkedRun = {
              ...run,
              status: nextStatus,
              blockers: resultRecord.blockers.length ? resultRecord.blockers : (Array.isArray(run.blockers) ? run.blockers : []),
              latestConvergenceAssimilationResultId: resultRecord.id,
              convergenceAssimilationResultStatus: resultRecord.status,
              convergenceAssimilationResultSummary: resultRecord.summary,
              convergenceAssimilationResultAt: now,
              convergenceAssimilationChangedFiles: resultRecord.changedFiles,
              convergenceAssimilationValidationSummary: resultRecord.validationSummary,
              convergenceAssimilationBlockers: resultRecord.blockers,
              convergenceAssimilationNextAction: resultRecord.nextAction,
              history: [
                createAgentWorkOrderRunEvent(nextStatus, `Convergence assimilation result recorded: ${resultRecord.status}.`, previousStatus),
                ...history
              ].slice(0, 50),
              updatedAt: now
            };
            return linkedRun;
          });

          return appendGovernanceOperations({
            ...current,
            agentWorkOrderRuns: nextRuns,
            convergenceAssimilationRunResults: [
              resultRecord,
              ...(Array.isArray(current.convergenceAssimilationRunResults) ? current.convergenceAssimilationRunResults : [])
            ].slice(0, 250)
          }, [
            createGovernanceOperation(
              "convergence-assimilation-run-result-recorded",
              `Recorded ${resultRecord.runner || "runner"} convergence assimilation result for ${resultRecord.projectName || resultRecord.projectId || resultRecord.pairId}.`,
              {
                resultId: resultRecord.id,
                runId,
                pairId: resultRecord.pairId,
                runner: resultRecord.runner,
                resultStatus: resultRecord.status,
                projectId: resultRecord.projectId,
                projectName: resultRecord.projectName
              }
            )
          ]);
        });

        return sendJson(res, 200, {
          success: true,
          result: resultRecord,
          run: linkedRun,
          convergenceAssimilationRunResults: updated.convergenceAssimilationRunResults || [],
          agentWorkOrderRuns: updated.agentWorkOrderRuns || [],
          governanceOperationCount: Array.isArray(updated.governanceOperations) ? updated.governanceOperations.length : 0
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid convergence assimilation run result request" });
      }
    }

    if (req.method === "POST" && pathname.startsWith("/api/convergence/assimilation-results/") && pathname.endsWith("/checkpoint")) {
      try {
        const resultId = decodeURIComponent(pathname.split("/")[4] || "");
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        const decision = normalizeConvergenceAssimilationResultCheckpointDecision(payload.decision);
        let taskRecord = null;
        let mode = "created";
        const updated = await store.updateStore((current) => {
          const results = Array.isArray(current.convergenceAssimilationRunResults) ? current.convergenceAssimilationRunResults.map(toControlPlaneRecord) : [];
          const result = results.find((item) => toText(item.id) === resultId);
          if (!resultId || !result) {
            throw new Error("Convergence assimilation result was not found.");
          }

          const existingTasks = Array.isArray(current.tasks) ? current.tasks : [];
          const existingTask = existingTasks.find((task) =>
            toText(task.sourceType) === "convergence-assimilation-result-checkpoint"
            && toText(task.convergenceAssimilationRunResultId) === resultId
          );
          const nextTask = createConvergenceAssimilationResultCheckpointTask(result, decision, payload);
          const nextTasks = existingTask
            ? existingTasks.map((task) => {
                if (toText(task.id) !== toText(existingTask.id)) return task;
                mode = "updated";
                taskRecord = {
                  ...task,
                  ...nextTask,
                  id: toText(existingTask.id),
                  createdAt: toText(existingTask.createdAt) || nextTask.createdAt,
                  updatedAt: nextTask.updatedAt
                };
                return taskRecord;
              })
            : [nextTask, ...existingTasks];
          if (!existingTask) {
            taskRecord = nextTask;
          }

          return appendGovernanceOperations({
            ...current,
            tasks: nextTasks
          }, [
            createGovernanceOperation(
              "convergence-assimilation-result-checkpoint-upserted",
              `${mode === "updated" ? "Updated" : "Created"} convergence assimilation result checkpoint: ${decision}.`,
              {
                mode,
                resultId,
                taskId: taskRecord.id,
                decision,
                runId: toText(result.runId),
                pairId: toText(result.pairId),
                runner: toText(result.runner),
                resultStatus: toText(result.status)
              }
            )
          ]);
        });

        return sendJson(res, 200, {
          success: true,
          mode,
          decision,
          task: taskRecord,
          tasks: updated.tasks || [],
          governanceOperationCount: Array.isArray(updated.governanceOperations) ? updated.governanceOperations.length : 0
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid convergence assimilation result checkpoint request" });
      }
    }

    if (req.method === "GET" && pathname === "/api/convergence/operator-proposal-queue") {
      try {
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        return sendJson(res, 200, createConvergenceOperatorProposalQueuePayload(inventory, persisted, {
          status: requestUrl.searchParams.get("status")
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "POST" && pathname === "/api/convergence/tasks") {
      try {
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        const persisted = await store.readStore();
        const inventory = await getInventoryPayload();
        const candidatePayload = createConvergenceCandidatesPayload(inventory, persisted, {
          status: "all",
          includeNotRelated: "true"
        });
        const candidatesByPairId = new Map(candidatePayload.candidates.map((candidate) => [toText(candidate.pairId), candidate]));
        const requestedPairIds = [
          ...toTextList(payload.pairIds),
          ...toTextList(payload.pairId ? [payload.pairId] : []),
          ...(Array.isArray(payload.candidates) ? payload.candidates.map((candidate) => toText(candidate?.pairId)).filter(Boolean) : [])
        ];
        const statusFilter = toText(payload.status);
        const requestedCandidates = requestedPairIds.length
          ? requestedPairIds.map((pairId) => candidatesByPairId.get(pairId)).filter(Boolean)
          : statusFilter
            ? candidatePayload.candidates.filter((candidate) => {
                if (statusFilter === "actionable") {
                  return ["confirmed-overlap", "merge-candidate", "needs-review"].includes(toText(candidate.reviewStatus));
                }
                return toText(candidate.reviewStatus) === statusFilter;
              })
            : [];

        if (!requestedCandidates.length) {
          return sendJson(res, 400, { error: "At least one convergence pair or taskable status is required" });
        }

        /** @type {Record<string, unknown>[]} */
        const createdTasks = [];
        /** @type {Array<{ pairId: string, label: string, reason: string }>} */
        const skipped = [];
        const updated = await store.updateStore((current) => {
          const tasks = Array.isArray(current.tasks) ? current.tasks : [];
          let nextTasks = tasks;

          for (const candidate of requestedCandidates) {
            const pairId = toText(candidate.pairId);
            const label = `${toText(candidate.leftName) || toText(candidate.leftId)} + ${toText(candidate.rightName) || toText(candidate.rightId)}`;
            if (!pairId) {
              skipped.push({ pairId: "", label, reason: "Missing convergence pair id" });
              continue;
            }
            if (toText(candidate.reviewStatus) === "not-related") {
              skipped.push({ pairId, label, reason: "Not Related pairs are intentionally not task-seeded" });
              continue;
            }
            const exists = nextTasks.some((task) => toText(task.convergencePairId) === pairId && !isClosedTaskStatus(task.status));
            if (exists) {
              skipped.push({ pairId, label, reason: "Open convergence task already exists" });
              continue;
            }

            const task = createConvergenceReviewTask(candidate);
            createdTasks.push(task);
            nextTasks = [...nextTasks, task];
          }

          return appendGovernanceOperations({
            ...current,
            tasks: nextTasks
          }, [
            createGovernanceOperation(
              "convergence-review-tasks-created",
              `Created ${createdTasks.length} Convergence review task(s).`,
              {
                requested: requestedCandidates.length,
                created: createdTasks.length,
                skipped: skipped.length,
                pairIds: requestedCandidates.map((candidate) => toText(candidate.pairId)).filter(Boolean)
              }
            )
          ]);
        });

        return sendJson(res, 200, {
          success: true,
          requested: requestedCandidates.length,
          createdTasks,
          skipped,
          totals: {
            requested: requestedCandidates.length,
            created: createdTasks.length,
            skipped: skipped.length
          },
          tasks: updated.tasks
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid convergence review task request" });
      }
    }

    if (req.method === "GET" && pathname === "/api/convergence/task-ledger") {
      try {
        const persisted = await store.readStore();
        return sendJson(res, 200, createConvergenceTaskLedgerPayload(persisted, {
          status: requestUrl.searchParams.get("status"),
          limit: requestUrl.searchParams.get("limit")
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/convergence/task-ledger-snapshots/diff") {
      try {
        const persisted = await store.readStore();
        const snapshots = Array.isArray(persisted.convergenceTaskLedgerSnapshots)
          ? persisted.convergenceTaskLedgerSnapshots.map(toControlPlaneRecord)
          : [];
        const snapshotId = toText(requestUrl.searchParams.get("snapshotId")) || "latest";
        const snapshot = snapshotId === "latest"
          ? snapshots[0]
          : snapshots.find((item) => toText(item.id) === snapshotId);
        if (!snapshot) {
          return sendJson(res, 200, createMissingConvergenceTaskLedgerSnapshotDiffPayload());
        }
        return sendJson(res, 200, createConvergenceTaskLedgerSnapshotDiffPayload(snapshot, createConvergenceTaskLedgerPayload(persisted, {
          status: toText(snapshot.statusFilter) || "all",
          limit: Number(snapshot.limit || 100)
        })));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "GET" && pathname === "/api/convergence/task-ledger-drift-checkpoints") {
      try {
        const persisted = await store.readStore();
        return sendJson(res, 200, createConvergenceTaskLedgerDriftCheckpointLedgerPayload(persisted, {
          status: requestUrl.searchParams.get("status"),
          limit: requestUrl.searchParams.get("limit")
        }));
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "POST" && pathname === "/api/convergence/task-ledger-drift-checkpoints") {
      try {
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        const requestedField = toText(payload.field);
        if (!requestedField) {
          return sendJson(res, 400, { error: "field is required" });
        }

        const persisted = await store.readStore();
        const snapshots = Array.isArray(persisted.convergenceTaskLedgerSnapshots)
          ? persisted.convergenceTaskLedgerSnapshots.map(toControlPlaneRecord)
          : [];
        const snapshotId = toText(payload.snapshotId) || "latest";
        const snapshot = snapshotId === "latest"
          ? snapshots[0]
          : snapshots.find((item) => toText(item.id) === snapshotId);
        if (!snapshot) {
          return sendJson(res, 400, { error: "Convergence Review task ledger snapshot not found" });
        }

        const diff = createConvergenceTaskLedgerSnapshotDiffPayload(snapshot, createConvergenceTaskLedgerPayload(persisted, {
          status: toText(snapshot.statusFilter) || "all",
          limit: Number(snapshot.limit || 100)
        }));
        const driftItem = (Array.isArray(diff.driftItems) ? diff.driftItems : [])
          .find((item) => toText(item.field) === requestedField || toText(item.label) === requestedField);
        if (!driftItem) {
          return sendJson(res, 400, { error: "Convergence Review task ledger drift item not found" });
        }

        const decision = getConvergenceTaskLedgerDriftCheckpointDecision(payload.decision);
        const now = new Date().toISOString();
        const taskPatch = buildConvergenceTaskLedgerDriftCheckpointTask(diff, driftItem, decision, now);
        let mode = "created";
        let checkpointTask = null;
        const updated = await store.updateStore((current) => {
          const tasks = Array.isArray(current.tasks) ? current.tasks : [];
          const existingIndex = tasks.findIndex((task) =>
            toText(task.convergenceTaskLedgerDriftSnapshotId) === toText(taskPatch.convergenceTaskLedgerDriftSnapshotId) &&
            toText(task.convergenceTaskLedgerDriftField) === toText(taskPatch.convergenceTaskLedgerDriftField)
          );
          let nextTasks;
          if (existingIndex >= 0) {
            mode = "updated";
            checkpointTask = {
              ...tasks[existingIndex],
              ...taskPatch,
              id: toText(tasks[existingIndex].id) || createId("task"),
              createdAt: toText(tasks[existingIndex].createdAt) || now,
              updatedAt: now
            };
            nextTasks = tasks.map((task, index) => index === existingIndex ? checkpointTask : task);
          } else {
            checkpointTask = {
              id: createId("task"),
              ...taskPatch,
              createdAt: now,
              updatedAt: now
            };
            nextTasks = [...tasks, checkpointTask];
          }

          return appendGovernanceOperations({
            ...current,
            tasks: nextTasks
          }, [
            createGovernanceOperation(
              "convergence-task-ledger-drift-checkpoint-upserted",
              `${mode === "updated" ? "Updated" : "Created"} Convergence Review task ledger drift checkpoint for ${taskPatch.convergenceTaskLedgerDriftLabel}.`,
              {
                mode,
                taskId: toText(checkpointTask.id),
                snapshotId: toText(taskPatch.convergenceTaskLedgerDriftSnapshotId),
                field: toText(taskPatch.convergenceTaskLedgerDriftField),
                decision: decision.key,
                status: decision.status,
                priority: decision.priority
              }
            )
          ]);
        });

        return sendJson(res, 200, {
          success: true,
          mode,
          decision: decision.key,
          decisionLabel: decision.label,
          task: checkpointTask,
          tasks: updated.tasks
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid Convergence Review task ledger drift checkpoint request" });
      }
    }

    if (pathname === "/api/convergence/task-ledger-snapshots") {
      if (req.method === "GET") {
        try {
          const persisted = await store.readStore();
          const snapshots = Array.isArray(persisted.convergenceTaskLedgerSnapshots) ? persisted.convergenceTaskLedgerSnapshots : [];
          return sendJson(res, 200, snapshots);
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (req.method === "POST") {
        try {
          const body = await readRequestBody(req);
          const payload = body ? JSON.parse(body) : {};
          const persisted = await store.readStore();
          const snapshot = createConvergenceTaskLedgerSnapshotRecord(persisted, payload);
          const updated = await store.updateStore((current) => appendGovernanceOperations({
            ...current,
            convergenceTaskLedgerSnapshots: [snapshot, ...(Array.isArray(current.convergenceTaskLedgerSnapshots) ? current.convergenceTaskLedgerSnapshots : [])].slice(0, 100)
          }, [
            createGovernanceOperation(
              "convergence-task-ledger-snapshot-created",
              `Saved Convergence Review task ledger snapshot ${snapshot.title}.`,
              {
                snapshotId: snapshot.id,
                total: snapshot.total,
                open: snapshot.openCount,
                statusFilter: snapshot.statusFilter
              }
            )
          ]));

          return sendJson(res, 200, {
            success: true,
            snapshot,
            convergenceTaskLedgerSnapshots: updated.convergenceTaskLedgerSnapshots
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message || "Invalid Convergence Review task ledger snapshot request" });
        }
      }
    }

    if (req.method === "GET" && pathname === "/api/convergence/reviews") {
      try {
        const persisted = await store.readStore();
        const projectId = String(requestUrl.searchParams.get("projectId") || "").trim();
        const status = String(requestUrl.searchParams.get("status") || "").trim().toLowerCase();
        let reviews = normalizeConvergenceReviews(persisted.convergenceReviews);
        if (projectId) {
          reviews = reviews.filter((review) => review.leftId === projectId || review.rightId === projectId);
        }
        if (status) {
          reviews = reviews.filter((review) => review.status === status);
        }
        return sendJson(res, 200, reviews);
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "POST" && pathname === "/api/convergence/reviews") {
      try {
        const body = await readRequestBody(req);
        const payload = JSON.parse(body || "{}");
        const inventory = await getInventoryPayload();
        let savedReview = null;
        const updated = await store.updateStore((current) => {
          const reviews = normalizeConvergenceReviews(current.convergenceReviews);
          const pairId = createConvergencePairId(payload.leftId, payload.rightId);
          const existing = reviews.find((review) => review.pairId === pairId);
          savedReview = createConvergenceReviewRecord(payload, existing, inventory);
          const nextReviews = [
            savedReview,
            ...reviews.filter((review) => review.pairId !== pairId)
          ];
          return appendGovernanceOperations({
            ...current,
            convergenceReviews: nextReviews
          }, [
            createGovernanceOperation(
              "convergence-review-upserted",
              `Marked ${savedReview.leftName} and ${savedReview.rightName} as ${savedReview.status}.`,
              {
                pairId: savedReview.pairId,
                leftId: savedReview.leftId,
                rightId: savedReview.rightId,
                status: savedReview.status,
                score: savedReview.score
              }
            )
          ]);
        });

        return sendJson(res, 200, {
          success: true,
          review: savedReview,
          reviews: normalizeConvergenceReviews(updated.convergenceReviews)
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid convergence review request" });
      }
    }

    if (req.method === "POST" && pathname === "/api/convergence/proposals") {
      try {
        const body = await readRequestBody(req);
        const payload = JSON.parse(body || "{}");
        const inventory = await getInventoryPayload();
        let savedReview = null;
        const updated = await store.updateStore((current) => {
          const reviews = normalizeConvergenceReviews(current.convergenceReviews);
          const pairId = createConvergencePairId(payload.leftId, payload.rightId);
          const existing = reviews.find((review) => review.pairId === pairId);
          savedReview = createOperatorConvergenceProposalReview(payload, existing, inventory);
          const nextReviews = [
            savedReview,
            ...reviews.filter((review) => review.pairId !== pairId)
          ];
          return appendGovernanceOperations({
            ...current,
            convergenceReviews: nextReviews
          }, [
            createGovernanceOperation(
              "convergence-operator-overlap-proposed",
              `Operator proposed ${savedReview.leftName} and ${savedReview.rightName} as ${savedReview.assimilationRecommendation}.`,
              {
                pairId: savedReview.pairId,
                leftId: savedReview.leftId,
                rightId: savedReview.rightId,
                status: savedReview.status,
                score: savedReview.score,
                recommendation: savedReview.assimilationRecommendation
              }
            )
          ]);
        });
        const candidatesPayload = createConvergenceCandidatesPayload(inventory, updated, {
          projectId: payload.leftId,
          status: "all",
          includeNotRelated: "true"
        });

        return sendJson(res, 200, {
          success: true,
          review: savedReview,
          candidates: candidatesPayload.candidates,
          reviews: normalizeConvergenceReviews(updated.convergenceReviews)
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message || "Invalid convergence proposal request" });
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
        const persisted = await store.readStore();
        const findings = buildFindings(inventory, {
          convergenceReviews: persisted.convergenceReviews
        });
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
