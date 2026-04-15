// @ts-check

import {
  createAppCard,
  createAppTableRow,
  createDataSourcesAccessValidationWorkflowSnapshotItem,
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
 *     fetchSourcesAccessMethodRegistry: () => Promise<import("./dashboard-types.js").DataSourcesAccessMethodRegistryPayload>,
 *     fetchSourcesAccessValidationWorkflow: () => Promise<import("./dashboard-types.js").DataSourcesAccessValidationWorkflowPayload>,
 *     fetchSourcesAccessValidationWorkflowSnapshots: () => Promise<import("./dashboard-types.js").PersistedDataSourcesAccessValidationWorkflowSnapshot[]>,
 *     createSourcesAccessValidationWorkflowSnapshot: (payload?: { title?: string }) => Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedDataSourcesAccessValidationWorkflowSnapshot, dataSourceAccessValidationWorkflowSnapshots: import("./dashboard-types.js").PersistedDataSourcesAccessValidationWorkflowSnapshot[] }>,
 *     fetchSourcesAccessValidationWorkflowSnapshotDiff: (snapshotId?: string) => Promise<import("./dashboard-types.js").DataSourcesAccessValidationWorkflowSnapshotDiffPayload>,
 *     createSourcesAccessValidationWorkflowTasks: (payload?: { items?: import("./dashboard-types.js").DataSourcesAccessValidationWorkflowItem[], saveSnapshot?: boolean, captureSnapshot?: boolean, autoCaptureSnapshot?: boolean, snapshotTitle?: string, snapshotStatus?: "all" | "open" | "closed", snapshotLimit?: number }) => Promise<{ success: true, requested: number, createdTasks: import("./dashboard-types.js").PersistedTask[], skipped: Array<{ id: string, label: string, reason: string }>, snapshotCaptured?: boolean, snapshot?: import("./dashboard-types.js").PersistedDataSourcesAccessTaskLedgerSnapshot | null, dataSourceAccessTaskLedgerSnapshots?: import("./dashboard-types.js").PersistedDataSourcesAccessTaskLedgerSnapshot[], totals: { requested: number, created: number, skipped: number }, tasks: import("./dashboard-types.js").PersistedTask[] }>,
 *     fetchSourcesAccessChecklist: () => Promise<import("./dashboard-types.js").DataSourcesAccessChecklistPayload>,
 *     fetchSourcesAccessValidationRunbook: () => Promise<import("./dashboard-types.js").DataSourcesAccessValidationRunbookPayload>,
 *     fetchSourcesAccessValidationEvidence: (options?: { status?: "all" | "validated" | "review" | "blocked", sourceId?: string, accessMethod?: string, limit?: number }) => Promise<import("./dashboard-types.js").DataSourcesAccessValidationEvidencePayload>,
 *     fetchSourcesAccessValidationEvidenceCoverage: () => Promise<import("./dashboard-types.js").DataSourcesAccessValidationEvidenceCoveragePayload>,
 *     createSourcesAccessValidationEvidenceCoverageTasks: (payload?: { items?: import("./dashboard-types.js").DataSourcesAccessValidationEvidenceCoverageItem[], saveSnapshot?: boolean, captureSnapshot?: boolean, autoCaptureSnapshot?: boolean, snapshotTitle?: string, snapshotStatus?: "all" | "open" | "closed", snapshotLimit?: number }) => Promise<{ success: true, requested: number, createdTasks: import("./dashboard-types.js").PersistedTask[], skipped: Array<{ id: string, label: string, reason: string }>, snapshotCaptured?: boolean, snapshot?: import("./dashboard-types.js").PersistedDataSourcesAccessTaskLedgerSnapshot | null, dataSourceAccessTaskLedgerSnapshots?: import("./dashboard-types.js").PersistedDataSourcesAccessTaskLedgerSnapshot[], totals: { requested: number, created: number, skipped: number }, tasks: import("./dashboard-types.js").PersistedTask[] }>,
 *     fetchDeploymentHealth: () => Promise<import("./dashboard-types.js").DeploymentHealthPayload>,
 *     fetchDeploymentSmokeChecks: () => Promise<import("./dashboard-types.js").DeploymentSmokeChecksPayload>,
 *     runDeploymentSmokeCheck: (payload: { url?: string, targetId?: string, label?: string, allowLocal?: boolean, timeoutMs?: number }) => Promise<{ success: true, smokeCheck: import("./dashboard-types.js").DeploymentSmokeCheckRecord, deploymentSmokeCheckCount: number, governanceOperationCount: number }>,
 *     fetchReleaseSummary: () => Promise<import("./dashboard-types.js").ReleaseSummaryPayload>,
 *     fetchReleaseCheckpointDrift: (checkpointId?: string) => Promise<import("./dashboard-types.js").ReleaseCheckpointDriftPayload>,
 *     fetchReleaseBuildGate: () => Promise<import("./dashboard-types.js").ReleaseBuildGatePayload>,
 *     fetchReleaseTaskLedger: (status?: "all" | "open" | "closed") => Promise<import("./dashboard-types.js").ReleaseTaskLedgerPayload>,
 *     createReleaseTaskLedgerSnapshot: (payload?: { title?: string, status?: "all" | "open" | "closed", limit?: number }) => Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedReleaseTaskLedgerSnapshot, releaseTaskLedgerSnapshots: import("./dashboard-types.js").PersistedReleaseTaskLedgerSnapshot[] }>,
 *     fetchReleaseTaskLedgerSnapshotDiff: (snapshotId?: string) => Promise<import("./dashboard-types.js").ReleaseTaskLedgerSnapshotDiffPayload>,
 *     bootstrapReleaseBuildGateLocalEvidence: (payload?: { url?: string, label?: string, title?: string, notes?: string, status?: "ready" | "review" | "hold", runSmokeCheck?: boolean, saveCheckpoint?: boolean, timeoutMs?: number }) => Promise<{ success: true, smokeCheck: import("./dashboard-types.js").DeploymentSmokeCheckRecord | null, checkpoint: import("./dashboard-types.js").ReleaseCheckpointRecord | null, releaseBuildGate: import("./dashboard-types.js").ReleaseBuildGatePayload }>,
 *     createReleaseBuildGateActionTasks: (payload?: { actions?: import("./dashboard-types.js").ReleaseBuildGateAction[], saveSnapshot?: boolean, captureSnapshot?: boolean, autoCaptureSnapshot?: boolean, snapshotTitle?: string, snapshotStatus?: "all" | "open" | "closed", snapshotLimit?: number }) => Promise<{ success: true, requested: number, createdTasks: import("./dashboard-types.js").PersistedTask[], skipped: Array<{ id: string, label: string, reason: string }>, snapshotCaptured?: boolean, snapshot?: import("./dashboard-types.js").PersistedReleaseTaskLedgerSnapshot | null, releaseTaskLedgerSnapshots?: import("./dashboard-types.js").PersistedReleaseTaskLedgerSnapshot[], totals: { requested: number, created: number, skipped: number }, tasks: import("./dashboard-types.js").PersistedTask[] }>,
 *     fetchConvergenceDueDiligencePack: (pairId: string) => Promise<import("./dashboard-types.js").ConvergenceDueDiligencePackPayload>,
 *     fetchConvergenceOperatorProposalQueue: (status?: import("./dashboard-types.js").ConvergenceOperatorProposalQueueStatus) => Promise<import("./dashboard-types.js").ConvergenceOperatorProposalQueuePayload>,
 *     fetchConvergenceAssimilationBlueprint: (pairId: string) => Promise<import("./dashboard-types.js").ConvergenceAssimilationBlueprintPayload>,
 *     fetchConvergenceAssimilationWorkOrderDraft: (pairId: string, options?: { runner?: "codex" | "claude" }) => Promise<import("./dashboard-types.js").ConvergenceAssimilationWorkOrderDraftPayload>,
 *     queueConvergenceAssimilationWorkOrderRun: (payload: { pairId: string, runner?: "codex" | "claude", status?: string, notes?: string }) => Promise<{ success: true, run: import("./dashboard-types.js").PersistedAgentWorkOrderRun | null, skippedRun?: { id: string, title: string, reason: string } | null, draft: import("./dashboard-types.js").ConvergenceAssimilationWorkOrderDraftPayload, agentWorkOrderRuns: import("./dashboard-types.js").PersistedAgentWorkOrderRun[], governanceOperationCount: number }>,
 *     fetchConvergenceAssimilationRunLedger: (status?: "all" | "open" | "closed" | "active" | "archived") => Promise<import("./dashboard-types.js").ConvergenceAssimilationRunLedgerPayload>,
 *     fetchConvergenceAssimilationResultLedger: (status?: import("./dashboard-types.js").ConvergenceAssimilationResultLedgerStatus) => Promise<import("./dashboard-types.js").ConvergenceAssimilationResultLedgerPayload>,
 *     fetchConvergenceAssimilationResultCheckpointLedger: (status?: "all" | "open" | "closed") => Promise<import("./dashboard-types.js").ConvergenceAssimilationResultCheckpointLedgerPayload>,
 *     fetchConvergenceAssimilationReadinessGate: () => Promise<import("./dashboard-types.js").ConvergenceAssimilationReadinessGatePayload>,
 *     fetchConvergenceAssimilationCliHandoffContract: (options?: { runner?: "codex" | "claude" }) => Promise<import("./dashboard-types.js").ConvergenceAssimilationCliHandoffContractPayload>,
 *     fetchConvergenceAssimilationOperatorPlaybook: () => Promise<import("./dashboard-types.js").ConvergenceAssimilationOperatorPlaybookPayload>,
 *     fetchConvergenceAssimilationSessionPacket: (options?: { runner?: "codex" | "claude" }) => Promise<import("./dashboard-types.js").ConvergenceAssimilationSessionPacketPayload>,
 *     fetchConvergenceAssimilationSessionPacketSnapshots: () => Promise<import("./dashboard-types.js").PersistedConvergenceAssimilationSessionPacketSnapshot[]>,
 *     createConvergenceAssimilationSessionPacketSnapshot: (payload?: { title?: string, runner?: "codex" | "claude" }) => Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedConvergenceAssimilationSessionPacketSnapshot, convergenceAssimilationSessionPacketSnapshots: import("./dashboard-types.js").PersistedConvergenceAssimilationSessionPacketSnapshot[] }>,
 *     fetchConvergenceAssimilationSessionPacketSnapshotDiff: (snapshotId?: string, options?: { runner?: "codex" | "claude" }) => Promise<import("./dashboard-types.js").ConvergenceAssimilationSessionPacketSnapshotDiffPayload>,
 *     checkpointConvergenceAssimilationSessionPacketDrift: (payload: { snapshotId?: string, runner?: "codex" | "claude", field: string, decision: "confirmed" | "deferred" | "escalated", note?: string }) => Promise<{ success: true, mode: "created" | "updated", decision: string, task: import("./dashboard-types.js").PersistedTask, tasks: import("./dashboard-types.js").PersistedTask[] }>,
 *     fetchConvergenceAssimilationSessionPacketDriftCheckpointLedger: (status?: "all" | "open" | "closed") => Promise<import("./dashboard-types.js").ConvergenceAssimilationSessionPacketDriftCheckpointLedgerPayload>,
 *     fetchConvergenceAssimilationRunnerCommandQueueDraft: (options?: { runner?: "codex" | "claude" }) => Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerCommandQueueDraftPayload>,
 *     fetchConvergenceAssimilationRunnerResultReplayChecklist: (options?: { runner?: "codex" | "claude" }) => Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerResultReplayChecklistPayload>,
 *     fetchConvergenceAssimilationRunnerLaunchpadGate: (options?: { runner?: "codex" | "claude" }) => Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerLaunchpadGatePayload>,
 *     fetchConvergenceAssimilationRunnerLaunchpadGateSnapshots: () => Promise<import("./dashboard-types.js").PersistedConvergenceAssimilationRunnerLaunchpadGateSnapshot[]>,
 *     createConvergenceAssimilationRunnerLaunchpadGateSnapshot: (payload?: { title?: string, runner?: "codex" | "claude" }) => Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedConvergenceAssimilationRunnerLaunchpadGateSnapshot, convergenceAssimilationRunnerLaunchpadGateSnapshots: import("./dashboard-types.js").PersistedConvergenceAssimilationRunnerLaunchpadGateSnapshot[] }>,
 *     fetchConvergenceAssimilationRunnerLaunchpadGateSnapshotDiff: (snapshotId?: string, options?: { runner?: "codex" | "claude" }) => Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerLaunchpadGateSnapshotDiffPayload>,
 *     checkpointConvergenceAssimilationRunnerLaunchpadGateDrift: (payload: { snapshotId?: string, runner?: "codex" | "claude", field: string, decision: "confirmed" | "deferred" | "escalated", note?: string }) => Promise<{ success: true, mode: "created" | "updated", decision: string, task: import("./dashboard-types.js").PersistedTask, tasks: import("./dashboard-types.js").PersistedTask[] }>,
 *     fetchConvergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger: (status?: "all" | "open" | "closed") => Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedgerPayload>,
 *     fetchConvergenceAssimilationRunnerLaunchAuthorizationPack: (options?: { runner?: "codex" | "claude" }) => Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerLaunchAuthorizationPackPayload>,
 *     fetchConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshots: () => Promise<import("./dashboard-types.js").PersistedConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshot[]>,
 *     createConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshot: (payload?: { title?: string, runner?: "codex" | "claude" }) => Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshot, convergenceAssimilationRunnerLaunchAuthorizationPackSnapshots: import("./dashboard-types.js").PersistedConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshot[] }>,
 *     fetchConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff: (snapshotId?: string, options?: { runner?: "codex" | "claude" }) => Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiffPayload>,
 *     checkpointConvergenceAssimilationRunnerLaunchAuthorizationPackDrift: (payload: { snapshotId?: string, runner?: "codex" | "claude", field: string, decision: "confirmed" | "deferred" | "escalated", note?: string }) => Promise<{ success: true, mode: "created" | "updated", decision: string, task: import("./dashboard-types.js").PersistedTask, tasks: import("./dashboard-types.js").PersistedTask[] }>,
 *     fetchConvergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger: (status?: "all" | "open" | "closed") => Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedgerPayload>,
 *     fetchConvergenceAssimilationRunnerLaunchControlBoard: (options?: { runner?: "codex" | "claude" }) => Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerLaunchControlBoardPayload>,
 *     fetchConvergenceAssimilationRunnerLaunchControlBoardSnapshots: () => Promise<import("./dashboard-types.js").PersistedConvergenceAssimilationRunnerLaunchControlBoardSnapshot[]>,
 *     createConvergenceAssimilationRunnerLaunchControlBoardSnapshot: (payload?: { title?: string, runner?: "codex" | "claude" }) => Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedConvergenceAssimilationRunnerLaunchControlBoardSnapshot, convergenceAssimilationRunnerLaunchControlBoardSnapshots: import("./dashboard-types.js").PersistedConvergenceAssimilationRunnerLaunchControlBoardSnapshot[] }>,
 *     fetchConvergenceAssimilationRunnerLaunchControlBoardSnapshotDiff: (snapshotId?: string, options?: { runner?: "codex" | "claude" }) => Promise<import("./dashboard-types.js").ConvergenceAssimilationRunnerLaunchControlBoardSnapshotDiffPayload>,
 *     checkpointConvergenceAssimilationRunnerLaunchControlBoardDrift: (payload: { snapshotId?: string, runner?: "codex" | "claude", field: string, decision: "confirmed" | "deferred" | "escalated", note?: string }) => Promise<{ success: true, mode: "created" | "updated", decision: string, task: import("./dashboard-types.js").PersistedTask, tasks: import("./dashboard-types.js").PersistedTask[] }>,
 *     fetchConvergenceAssimilationRunTracePack: (runId: string) => Promise<import("./dashboard-types.js").ConvergenceAssimilationRunTracePackPayload>,
 *     recordConvergenceAssimilationRunResult: (runId: string, payload: { status?: string, summary: string, changedFiles?: string[] | string, validationSummary?: string, validationResults?: string, blockers?: string[] | string, nextAction?: string, notes?: string }) => Promise<{ success: true, result: import("./dashboard-types.js").ConvergenceAssimilationRunResultRecord, run: import("./dashboard-types.js").PersistedAgentWorkOrderRun, convergenceAssimilationRunResults: import("./dashboard-types.js").ConvergenceAssimilationRunResultRecord[], agentWorkOrderRuns: import("./dashboard-types.js").PersistedAgentWorkOrderRun[], governanceOperationCount: number }>,
 *     checkpointConvergenceAssimilationResult: (resultId: string, payload: { decision: "confirmed" | "deferred" | "escalated", note?: string }) => Promise<{ success: true, mode: "created" | "updated", decision: string, task: import("./dashboard-types.js").PersistedTask, tasks: import("./dashboard-types.js").PersistedTask[], governanceOperationCount: number }>,
 *     saveConvergenceReview: (payload: { leftId: string, rightId: string, leftName?: string, rightName?: string, score?: number, reasons?: string[], status: string, note?: string }) => Promise<unknown>,
 *     createConvergenceReviewTasks: (payload?: { pairIds?: string[], pairId?: string, candidates?: import("./dashboard-types.js").ConvergenceCandidate[], status?: "confirmed-overlap" | "needs-review" | "merge-candidate" | "actionable" }) => Promise<{ success: true, requested: number, createdTasks: import("./dashboard-types.js").PersistedTask[], skipped: Array<{ pairId: string, label: string, reason: string }>, totals: { requested: number, created: number, skipped: number }, tasks: import("./dashboard-types.js").PersistedTask[] }>,
 *     fetchConvergenceTaskLedgerDriftCheckpointLedger: (status?: "all" | "open" | "closed") => Promise<import("./dashboard-types.js").ConvergenceTaskLedgerDriftCheckpointLedgerPayload>,
 *     createConvergenceTaskLedgerDriftCheckpoint: (payload: { snapshotId?: string, field: string, decision: "confirmed" | "deferred" | "escalated" }) => Promise<{ success: true, mode: "created" | "updated", decision: string, decisionLabel: string, task: import("./dashboard-types.js").PersistedTask, tasks: import("./dashboard-types.js").PersistedTask[] }>,
 *     createReleaseCheckpoint: (payload?: { title?: string, status?: "ready" | "review" | "hold", notes?: string }) => Promise<{ success: true, checkpoint: import("./dashboard-types.js").ReleaseCheckpointRecord, releaseCheckpointCount: number, governanceOperationCount: number }>,
 *     createSourcesAccessValidationEvidenceSnapshot: (payload?: { title?: string, status?: "all" | "validated" | "review" | "blocked", sourceId?: string, accessMethod?: string, limit?: number }) => Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedDataSourcesAccessValidationEvidenceSnapshot, dataSourceAccessValidationEvidenceSnapshots: import("./dashboard-types.js").PersistedDataSourcesAccessValidationEvidenceSnapshot[] }>,
 *     fetchSourcesAccessValidationEvidenceSnapshotDiff: (snapshotId?: string) => Promise<import("./dashboard-types.js").DataSourcesAccessValidationEvidenceSnapshotDiffPayload>,
 *     fetchSourcesAccessMatrix: () => Promise<import("./dashboard-types.js").DataSourcesAccessMatrixPayload>,
 *     fetchSourcesAccessReviewQueue: () => Promise<import("./dashboard-types.js").DataSourcesAccessReviewQueuePayload>,
 *     createSourcesAccessReviewTasks: (payload?: { items?: import("./dashboard-types.js").DataSourcesAccessReviewQueueItem[], saveSnapshot?: boolean, captureSnapshot?: boolean, autoCaptureSnapshot?: boolean, snapshotTitle?: string, snapshotStatus?: "all" | "open" | "closed", snapshotLimit?: number }) => Promise<{ success: true, requested: number, createdTasks: import("./dashboard-types.js").PersistedTask[], skipped: Array<{ id: string, label: string, reason: string }>, snapshotCaptured?: boolean, snapshot?: import("./dashboard-types.js").PersistedDataSourcesAccessTaskLedgerSnapshot | null, dataSourceAccessTaskLedgerSnapshots?: import("./dashboard-types.js").PersistedDataSourcesAccessTaskLedgerSnapshot[], totals: { requested: number, created: number, skipped: number }, tasks: import("./dashboard-types.js").PersistedTask[] }>,
 *     createSourcesAccessTaskLedgerSnapshot: (payload?: { title?: string, status?: "all" | "open" | "closed", limit?: number }) => Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedDataSourcesAccessTaskLedgerSnapshot, dataSourceAccessTaskLedgerSnapshots: import("./dashboard-types.js").PersistedDataSourcesAccessTaskLedgerSnapshot[] }>,
 *     fetchSourcesAccessTaskLedgerSnapshotDiff: (snapshotId?: string) => Promise<import("./dashboard-types.js").DataSourcesAccessTaskLedgerSnapshotDiffPayload>,
 *     fetchSourcesAccessGate: () => Promise<import("./dashboard-types.js").DataSourcesAccessGatePayload>,
 *     fetchSourcesSummarySnapshots: () => Promise<import("./dashboard-types.js").PersistedDataSourcesSummarySnapshot[]>,
 *     createSourcesSummarySnapshot: (payload?: { title?: string }) => Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedDataSourcesSummarySnapshot, dataSourceHealthSnapshots: import("./dashboard-types.js").PersistedDataSourcesSummarySnapshot[] }>,
 *     fetchSourcesSummarySnapshotDiff: (snapshotId?: string) => Promise<import("./dashboard-types.js").DataSourcesSummarySnapshotDiffPayload>,
 *     deleteSource: (sourceId: string) => Promise<unknown>,
 *     fetchGovernance: () => Promise<import("./dashboard-types.js").GovernancePayload>,
 *     fetchGovernanceTaskUpdateLedger: (options?: { limit?: number }) => Promise<import("./dashboard-types.js").GovernanceTaskUpdateLedgerPayload>,
 *     createGovernanceTaskUpdateLedgerSnapshot: (payload?: { title?: string, limit?: number }) => Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedGovernanceTaskUpdateLedgerSnapshot, governanceTaskUpdateLedgerSnapshots: import("./dashboard-types.js").PersistedGovernanceTaskUpdateLedgerSnapshot[] }>,
 *     fetchGovernanceTaskUpdateLedgerSnapshotDiff: (snapshotId?: string) => Promise<import("./dashboard-types.js").GovernanceTaskUpdateLedgerSnapshotDiffPayload>,
 *     fetchGovernanceExecutionViews: () => Promise<import("./dashboard-types.js").PersistedGovernanceExecutionView[]>,
 *     saveGovernanceExecutionView: (payload: { title: string, search: string, scope: string, sort: string, taskSeedingStatus: string, executionStatus: string, executionRetention: number, showArchivedExecution: boolean }) => Promise<{ success: true, view: import("./dashboard-types.js").PersistedGovernanceExecutionView, governanceExecutionViews: import("./dashboard-types.js").PersistedGovernanceExecutionView[] }>,
 *     fetchGovernanceExecutionPolicy: () => Promise<import("./dashboard-types.js").GovernanceAgentExecutionPolicy>,
 *     saveGovernanceExecutionPolicy: (payload: { staleThresholdHours: number }) => Promise<{ success: true, policy: import("./dashboard-types.js").GovernanceAgentExecutionPolicy }>,
 *     fetchAgentControlPlaneDecisionTaskLedger: (status?: "all" | "open" | "closed") => Promise<import("./dashboard-types.js").AgentControlPlaneDecisionTaskLedgerPayload>,
 *     createAgentControlPlaneDecisionTaskLedgerSnapshot: (payload?: { title?: string, status?: "all" | "open" | "closed", limit?: number }) => Promise<{ success: true, snapshot: import("./dashboard-types.js").PersistedAgentControlPlaneDecisionTaskLedgerSnapshot, agentControlPlaneDecisionTaskLedgerSnapshots: import("./dashboard-types.js").PersistedAgentControlPlaneDecisionTaskLedgerSnapshot[] }>,
 *     fetchAgentControlPlaneDecisionTaskLedgerSnapshotDiff: (snapshotId?: string) => Promise<import("./dashboard-types.js").AgentControlPlaneDecisionTaskLedgerSnapshotDiffPayload>,
 *     bootstrapGovernance: (payload: { mode: "profiles" | "starter-pack", projectIds: string[] }) => Promise<unknown>,
 *     executeGovernanceQueue: (payload: { items: Array<Pick<import("./dashboard-types.js").GovernanceQueueItem, "id" | "projectId" | "projectName" | "kind" | "actionType">> }) => Promise<unknown>,
 *     suppressGovernanceQueue: (payload: { items: Array<Pick<import("./dashboard-types.js").GovernanceQueueItem, "id" | "projectId" | "projectName" | "kind" | "title">>, reason?: string }) => Promise<unknown>,
 *     restoreGovernanceQueue: (payload: { ids: string[] }) => Promise<unknown>,
 *     createTaskSeedingCheckpoint: (payload: { batchId?: string, title?: string, source?: string, status?: "approved" | "deferred" | "dismissed" | "needs-review", itemCount?: number, note?: string, reviewer?: string }) => Promise<unknown>,
 *     createAgentPolicyCheckpoint: (payload: { policyId: string, projectId: string, projectName?: string, relPath?: string, status?: "approved" | "deferred" | "dismissed" | "needs-review", role?: string, runtime?: string, isolationMode?: string, skillBundle?: string[], hookPolicy?: string[], source?: string, reason?: string, note?: string, reviewer?: string }) => Promise<unknown>,
 *     saveProjectProfile: (payload: { projectId: string, projectName: string, owner?: string, status?: string, lifecycle?: string, tier?: string, targetState?: string, summary?: string }) => Promise<unknown>,
 *     createTask: (payload: { title: string, description?: string, priority?: string, status?: string, projectId?: string, projectName?: string }) => Promise<unknown>,
 *     createWorkflow: (payload: { title: string, brief?: string, status?: string, phase?: string, projectId?: string, projectName?: string }) => Promise<unknown>,
 *     createNote: (payload: { title: string, body?: string, kind?: string, projectId?: string, projectName?: string }) => Promise<unknown>,
 *     createAgentWorkOrderRun: (payload: { projectId: string, projectName: string, relPath?: string, snapshotId?: string, title?: string, objective: string, status?: string, readinessScore?: number, readinessStatus?: string, blockers?: string[], agentPolicyId?: string, agentPolicyCheckpointId?: string, agentPolicyCheckpointStatus?: string, agentRole?: string, runtime?: string, isolationMode?: string, skillBundle?: string[], hookPolicy?: string[], validationCommands?: string[], notes?: string }) => Promise<unknown>,
 *     createAgentWorkOrderRunsFromSnapshot: (payload: { snapshotId: string }) => Promise<unknown>,
 *     updateAgentWorkOrderRun: (runId: string, payload: { status?: string, notes?: string, archived?: boolean }) => Promise<unknown>,
 *     applyAgentWorkOrderRunRetention: (payload: { retainCompleted: number, runIds?: string[] }) => Promise<unknown>,
 *     actionAgentWorkOrderRunSlaBreaches: (payload: { runIds?: string[], action?: string }) => Promise<unknown>,
 *     resolveAgentWorkOrderRunSlaBreaches: (payload: { runIds?: string[] }) => Promise<unknown>,
 *     fetchCliBridgeContext: (options?: { runner?: "all" | "codex" | "claude", status?: string, limit?: number }) => Promise<import("./dashboard-types.js").CliBridgeContextPayload>,
 *     fetchCliBridgeRunnerDryRun: (options?: { runner?: "codex" | "claude", runId?: string, status?: string, limit?: number }) => Promise<import("./dashboard-types.js").CliBridgeRunnerDryRunPayload>,
 *     fetchCliBridgeFollowUpWorkOrderDraft: (handoffId: string, options?: { runner?: "codex" | "claude", limit?: number }) => Promise<import("./dashboard-types.js").CliBridgeFollowUpWorkOrderDraftPayload>,
 *     queueCliBridgeFollowUpWorkOrderRun: (handoffId: string, payload?: { runner?: "codex" | "claude", status?: string, notes?: string, limit?: number }) => Promise<unknown>,
 *     fetchCliBridgeRunTrace: (runId: string) => Promise<import("./dashboard-types.js").CliBridgeRunTracePayload>,
 *     fetchCliBridgeRunTraceSnapshots: () => Promise<import("./dashboard-types.js").PersistedCliBridgeRunTraceSnapshot[]>,
 *     fetchCliBridgeRunTraceSnapshotDiff: (snapshotId?: string) => Promise<import("./dashboard-types.js").CliBridgeRunTraceSnapshotDiffPayload>,
 *     fetchCliBridgeRunTraceSnapshotBaselineStatus: () => Promise<import("./dashboard-types.js").CliBridgeRunTraceSnapshotBaselineStatusPayload>,
 *     createCliBridgeRunTraceSnapshot: (runId: string, payload?: { title?: string }) => Promise<unknown>,
 *     fetchCliBridgeHandoffs: (options?: { runner?: "all" | "codex" | "claude", status?: "all" | "proposed" | "accepted" | "rejected" | "needs-review", limit?: number }) => Promise<import("./dashboard-types.js").CliBridgeHandoffLedgerPayload>,
 *     createCliBridgeRunnerResult: (payload: { runner: "codex" | "claude", workOrderRunId?: string, runId?: string, status?: string, projectId?: string, projectName?: string, title?: string, summary: string, changedFiles?: string[], validationResults?: string, validationSummary?: string, blockers?: string[], nextAction?: string, handoffRecommendation?: string, nextRunner?: string, notes?: string }) => Promise<unknown>,
 *     reviewCliBridgeHandoff: (handoffId: string, payload: { action: "accept" | "reject" | "escalate" | "needs-review", note?: string, notes?: string, reviewer?: string, nextAction?: string, createTask?: boolean }) => Promise<unknown>
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
  let convergenceTaskLedgerDriftCheckpointFilter = "all";
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
      taskSeedingStatus: /** @type {HTMLSelectElement | null} */ (document.getElementById("governance-task-seeding-status"))?.value || "all",
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
    setSelectControlValue("governance-task-seeding-status", view.taskSeedingStatus || "all");
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
    const checkpointLabel = filters.taskSeedingStatus && filters.taskSeedingStatus !== "all" ? ` | checkpoints ${filters.taskSeedingStatus}` : "";
    const searchLabel = filters.search ? ` | ${filters.search.slice(0, 32)}` : "";
    return `${scope}: ${filters.executionStatus} | keep ${filters.executionRetention} | ${archiveLabel}${checkpointLabel}${searchLabel}`;
  }

  /**
   * @param {import("./dashboard-types.js").GovernancePayload} governance
   */
  function applyGovernanceFilters(governance) {
    const filters = getGovernanceFilterState();
    const sortMode = filters.sort;
    const search = filters.search;
    const executionStatus = filters.executionStatus;
    const taskSeedingStatus = filters.taskSeedingStatus;

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

    /**
     * @param {import("./dashboard-types.js").TaskSeedingCheckpoint} checkpoint
     */
    function matchesTaskSeedingStatus(checkpoint) {
      if (taskSeedingStatus === "all") return true;
      return (checkpoint.status || "needs-review") === taskSeedingStatus;
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
      taskSeedingCheckpoints: filterAndSort(
        governance.taskSeedingCheckpoints || [],
        (checkpoint) => [checkpoint.title || "", checkpoint.source || "", checkpoint.status || "", checkpoint.note || "", checkpoint.batchId || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ).filter(matchesTaskSeedingStatus),
      convergenceCandidates: governance.convergenceCandidates
        ? {
            ...governance.convergenceCandidates,
            candidates: filterAndSort(
              governance.convergenceCandidates.candidates || [],
              (candidate) => [candidate.leftName || "", candidate.rightName || "", candidate.reviewStatus || "", candidate.reviewSource || "", candidate.reviewNote || "", Array.isArray(candidate.reasons) ? candidate.reasons.join(" ") : "", candidate.generatedInsight || ""],
              (left, right) => right.score - left.score || left.leftName.localeCompare(right.leftName)
            )
          }
        : null,
      convergenceOperatorProposalQueue: governance.convergenceOperatorProposalQueue
        ? {
            ...governance.convergenceOperatorProposalQueue,
            items: filterAndSort(
              governance.convergenceOperatorProposalQueue.items || [],
              (item) => [item.leftName || "", item.rightName || "", item.queueStatus || "", item.reviewStatus || "", item.reviewNote || "", item.generatedInsight || "", item.recommendedAction || "", Array.isArray(item.reasons) ? item.reasons.join(" ") : ""],
              (left, right) => {
                const statusRank = { blocked: 0, "review-required": 1, "task-ready": 2, "task-tracked": 3, completed: 4, suppressed: 5 };
                const statusDelta = (statusRank[left.queueStatus] ?? 9) - (statusRank[right.queueStatus] ?? 9);
                if (statusDelta) return statusDelta;
                return right.score - left.score || left.leftName.localeCompare(right.leftName);
              }
            )
          }
        : null,
      convergenceAssimilationRunLedger: governance.convergenceAssimilationRunLedger
        ? {
            ...governance.convergenceAssimilationRunLedger,
            runs: filterAndSort(
              governance.convergenceAssimilationRunLedger.runs || [],
              (run) => [run.projectName || "", run.title || "", run.status || "", run.convergencePairId || "", run.convergenceAssimilationRunner || "", run.convergenceAssimilationDraftDecision || "", run.objective || "", run.notes || ""],
              (left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime()
            )
          }
        : null,
      convergenceAssimilationResultLedger: governance.convergenceAssimilationResultLedger
        ? {
            ...governance.convergenceAssimilationResultLedger,
            results: filterAndSort(
              governance.convergenceAssimilationResultLedger.results || [],
              (result) => [result.projectName || "", result.status || "", result.pairId || "", result.runId || "", result.runner || "", result.summary || "", result.validationSummary || "", Array.isArray(result.changedFiles) ? result.changedFiles.join(" ") : "", Array.isArray(result.blockers) ? result.blockers.join(" ") : ""],
              (left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime()
            )
          }
        : null,
      convergenceAssimilationResultCheckpointLedger: governance.convergenceAssimilationResultCheckpointLedger
        ? {
            ...governance.convergenceAssimilationResultCheckpointLedger,
            items: filterAndSort(
              governance.convergenceAssimilationResultCheckpointLedger.items || [],
              (item) => [item.title || "", item.status || "", item.priority || "", item.convergenceAssimilationResultCheckpointDecision || "", item.convergenceAssimilationRunResultId || "", item.convergenceAssimilationRunId || "", item.convergenceAssimilationPairId || "", item.convergenceAssimilationResultCheckpointNote || ""],
              (left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime()
            )
          }
        : null,
      convergenceAssimilationReadinessGate: governance.convergenceAssimilationReadinessGate && matchesSearch([
        "convergence assimilation readiness gate",
        governance.convergenceAssimilationReadinessGate.decision || "",
        governance.convergenceAssimilationReadinessGate.recommendedAction || "",
        ...(governance.convergenceAssimilationReadinessGate.reasons || []).map((reason) => `${reason.severity || ""} ${reason.code || ""} ${reason.message || ""}`)
      ])
        ? governance.convergenceAssimilationReadinessGate
        : null,
      convergenceTasks: filterAndSort(
        governance.convergenceTasks || [],
        (task) => [task.projectName || "", task.title || "", task.status || "", task.priority || "", task.convergencePairId || "", task.convergenceReviewStatus || "", task.convergenceRecommendation || "", task.description || ""],
        (left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime()
      ),
      governanceTaskUpdateLedger: governance.governanceTaskUpdateLedger
        ? {
            ...governance.governanceTaskUpdateLedger,
            items: filterAndSort(
              governance.governanceTaskUpdateLedger.items || [],
              (item) => [item.title || "", item.taskId || "", item.projectName || "", item.previousStatus || "", item.nextStatus || "", (item.updatedFields || []).join(" "), item.operationId || ""],
              (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
            )
          }
        : null,
      governanceTaskUpdateLedgerSnapshotDiff: governance.governanceTaskUpdateLedgerSnapshotDiff && matchesSearch([
        "governance task update audit ledger snapshot drift",
        governance.governanceTaskUpdateLedgerSnapshotDiff.snapshotTitle || "",
        governance.governanceTaskUpdateLedgerSnapshotDiff.driftSeverity || "",
        governance.governanceTaskUpdateLedgerSnapshotDiff.recommendedAction || "",
        governance.governanceTaskUpdateLedgerSnapshotDiff.hasDrift ? "drift" : "no drift",
        ...(governance.governanceTaskUpdateLedgerSnapshotDiff.driftItems || []).map((item) => `${item.label || ""} ${item.field || ""} ${item.before ?? ""} ${item.current ?? ""} ${item.delta ?? ""}`)
      ])
        ? governance.governanceTaskUpdateLedgerSnapshotDiff
        : null,
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
      releaseControlTasks: filterAndSort(
        governance.releaseControlTasks || [],
        (task) => [task.projectName || "", task.title || "", task.status || "", task.priority || "", task.releaseBuildGateActionId || "", task.releaseBuildGateDecision || "", task.description || ""],
        (left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime()
      ),
      releaseTaskLedgerSnapshots: filterAndSort(
        governance.releaseTaskLedgerSnapshots || [],
        (snapshot) => [snapshot.title || "", snapshot.statusFilter || "", String(snapshot.total), String(snapshot.openCount), String(snapshot.closedCount), snapshot.markdown || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      releaseTaskLedgerSnapshotDiff: governance.releaseTaskLedgerSnapshotDiff && matchesSearch([
        "release control task ledger snapshot drift",
        governance.releaseTaskLedgerSnapshotDiff.snapshotTitle || "",
        governance.releaseTaskLedgerSnapshotDiff.driftSeverity || "",
        governance.releaseTaskLedgerSnapshotDiff.recommendedAction || "",
        governance.releaseTaskLedgerSnapshotDiff.hasDrift ? "drift" : "no drift",
        ...(governance.releaseTaskLedgerSnapshotDiff.driftItems || []).map((item) => `${item.label || ""} ${item.field || ""} ${item.before ?? ""} ${item.current ?? ""} ${item.delta ?? ""}`)
      ])
        ? governance.releaseTaskLedgerSnapshotDiff
        : null,
      convergenceTaskLedgerSnapshots: filterAndSort(
        governance.convergenceTaskLedgerSnapshots || [],
        (snapshot) => [snapshot.title || "", snapshot.statusFilter || "", String(snapshot.total), String(snapshot.openCount), String(snapshot.closedCount), String(snapshot.pairCount), snapshot.markdown || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      convergenceTaskLedgerSnapshotDiff: governance.convergenceTaskLedgerSnapshotDiff && matchesSearch([
        "convergence review task ledger snapshot drift",
        governance.convergenceTaskLedgerSnapshotDiff.snapshotTitle || "",
        governance.convergenceTaskLedgerSnapshotDiff.driftSeverity || "",
        governance.convergenceTaskLedgerSnapshotDiff.recommendedAction || "",
        governance.convergenceTaskLedgerSnapshotDiff.hasDrift ? "drift" : "no drift",
        ...(governance.convergenceTaskLedgerSnapshotDiff.driftItems || []).map((item) => `${item.label || ""} ${item.field || ""} ${item.before ?? ""} ${item.current ?? ""} ${item.delta ?? ""}`)
      ])
        ? governance.convergenceTaskLedgerSnapshotDiff
        : null,
      convergenceAssimilationSessionPacketSnapshots: filterAndSort(
        governance.convergenceAssimilationSessionPacketSnapshots || [],
        (snapshot) => [snapshot.title || "", snapshot.runner || "", snapshot.readinessDecision || "", snapshot.recommendedAction || "", snapshot.markdown || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      convergenceAssimilationRunnerLaunchpadGateSnapshots: filterAndSort(
        governance.convergenceAssimilationRunnerLaunchpadGateSnapshots || [],
        (snapshot) => [snapshot.title || "", snapshot.runner || "", snapshot.decision || "", snapshot.readinessDecision || "", snapshot.packetDriftSeverity || "", snapshot.recommendedAction || "", snapshot.markdown || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      convergenceAssimilationRunnerLaunchAuthorizationPackSnapshots: filterAndSort(
        governance.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshots || [],
        (snapshot) => [snapshot.title || "", snapshot.runner || "", snapshot.decision || "", snapshot.authorizationStatus || "", snapshot.launchpadDecision || "", snapshot.launchpadSnapshotDriftSeverity || "", snapshot.recommendedAction || "", snapshot.markdown || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff: governance.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff && matchesSearch([
        "convergence assimilation runner launch authorization pack snapshot drift",
        governance.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.snapshotTitle || "",
        governance.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.runner || "",
        governance.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.driftSeverity || "",
        governance.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.recommendedAction || "",
        governance.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.hasDrift ? "drift" : "no drift",
        ...(governance.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.driftItems || []).map((item) => `${item.label || ""} ${item.field || ""} ${item.before ?? ""} ${item.current ?? ""} ${item.delta ?? ""}`)
      ])
        ? governance.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff
        : null,
      convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger: governance.convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger && matchesSearch([
        "convergence assimilation runner launch authorization pack drift checkpoint ledger",
        governance.convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger.status || "",
        governance.convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger.markdown || "",
        ...(governance.convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger.items || []).map((item) => `${item.title || ""} ${item.status || ""} ${item.convergenceAssimilationRunnerLaunchAuthorizationPackDriftDecision || ""} ${item.convergenceAssimilationRunnerLaunchAuthorizationPackDriftField || ""}`)
      ])
        ? governance.convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger
        : null,
      convergenceAssimilationRunnerLaunchControlBoard: governance.convergenceAssimilationRunnerLaunchControlBoard && matchesSearch([
        "convergence assimilation runner launch control board",
        governance.convergenceAssimilationRunnerLaunchControlBoard.runner || "",
        governance.convergenceAssimilationRunnerLaunchControlBoard.launchDecision || "",
        governance.convergenceAssimilationRunnerLaunchControlBoard.launchStatus || "",
        governance.convergenceAssimilationRunnerLaunchControlBoard.authorizationStatus || "",
        governance.convergenceAssimilationRunnerLaunchControlBoard.recommendedAction || "",
        governance.convergenceAssimilationRunnerLaunchControlBoard.markdown || "",
        ...(governance.convergenceAssimilationRunnerLaunchControlBoard.reasons || [])
      ])
        ? governance.convergenceAssimilationRunnerLaunchControlBoard
        : null,
      convergenceAssimilationRunnerLaunchControlBoardSnapshots: filterAndSort(
        governance.convergenceAssimilationRunnerLaunchControlBoardSnapshots || [],
        (snapshot) => [snapshot.title || "", snapshot.runner || "", snapshot.launchDecision || "", snapshot.launchStatus || "", snapshot.authorizationStatus || "", snapshot.recommendedAction || "", snapshot.markdown || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff: governance.convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff && matchesSearch([
        "convergence assimilation runner launch control board snapshot drift",
        governance.convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.snapshotTitle || "",
        governance.convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.runner || "",
        governance.convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.driftSeverity || "",
        governance.convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.recommendedAction || "",
        governance.convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.hasDrift ? "drift" : "no drift",
        ...(governance.convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.driftItems || []).map((item) => `${item.label || ""} ${item.field || ""} ${item.before ?? ""} ${item.current ?? ""} ${item.delta ?? ""}`)
      ])
        ? governance.convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff
        : null,
      convergenceAssimilationRunnerLaunchpadGateSnapshotDiff: governance.convergenceAssimilationRunnerLaunchpadGateSnapshotDiff && matchesSearch([
        "convergence assimilation runner launchpad gate snapshot drift",
        governance.convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.snapshotTitle || "",
        governance.convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.runner || "",
        governance.convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.driftSeverity || "",
        governance.convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.recommendedAction || "",
        governance.convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.hasDrift ? "drift" : "no drift",
        ...(governance.convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.driftItems || []).map((item) => `${item.label || ""} ${item.field || ""} ${item.before ?? ""} ${item.current ?? ""} ${item.delta ?? ""}`)
      ])
        ? governance.convergenceAssimilationRunnerLaunchpadGateSnapshotDiff
        : null,
      convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger: governance.convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger && matchesSearch([
        "convergence assimilation runner launchpad gate drift checkpoint ledger",
        governance.convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger.status || "",
        governance.convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger.markdown || "",
        ...(governance.convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger.items || []).map((item) => `${item.title || ""} ${item.status || ""} ${item.convergenceAssimilationRunnerLaunchpadGateDriftDecision || ""} ${item.convergenceAssimilationRunnerLaunchpadGateDriftField || ""}`)
      ])
        ? governance.convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger
        : null,
      convergenceAssimilationSessionPacketSnapshotDiff: governance.convergenceAssimilationSessionPacketSnapshotDiff && matchesSearch([
        "convergence assimilation session packet snapshot drift",
        governance.convergenceAssimilationSessionPacketSnapshotDiff.snapshotTitle || "",
        governance.convergenceAssimilationSessionPacketSnapshotDiff.runner || "",
        governance.convergenceAssimilationSessionPacketSnapshotDiff.driftSeverity || "",
        governance.convergenceAssimilationSessionPacketSnapshotDiff.recommendedAction || "",
        governance.convergenceAssimilationSessionPacketSnapshotDiff.hasDrift ? "drift" : "no drift",
        ...(governance.convergenceAssimilationSessionPacketSnapshotDiff.driftItems || []).map((item) => `${item.label || ""} ${item.field || ""} ${item.before ?? ""} ${item.current ?? ""} ${item.delta ?? ""}`)
      ])
        ? governance.convergenceAssimilationSessionPacketSnapshotDiff
        : null,
      convergenceAssimilationSessionPacketDriftCheckpointLedger: governance.convergenceAssimilationSessionPacketDriftCheckpointLedger && matchesSearch([
        "convergence assimilation session packet drift checkpoint ledger",
        governance.convergenceAssimilationSessionPacketDriftCheckpointLedger.status || "",
        governance.convergenceAssimilationSessionPacketDriftCheckpointLedger.markdown || "",
        ...(governance.convergenceAssimilationSessionPacketDriftCheckpointLedger.items || []).map((item) => `${item.title || ""} ${item.status || ""} ${item.convergenceAssimilationSessionPacketDriftDecision || ""} ${item.convergenceAssimilationSessionPacketDriftField || ""}`)
      ])
        ? governance.convergenceAssimilationSessionPacketDriftCheckpointLedger
        : null,
      agentControlPlaneDecisionTasks: filterAndSort(
        governance.agentControlPlaneDecisionTasks || [],
        (task) => [task.projectName || "", task.title || "", task.status || "", task.priority || "", task.agentControlPlaneDecisionReasonCode || "", task.agentControlPlaneDecision || "", task.description || ""],
        (left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime()
      ),
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
      dataSourcesAccessValidationWorkflow: governance.dataSourcesAccessValidationWorkflow
        ? {
            ...governance.dataSourcesAccessValidationWorkflow,
            items: filterAndSort(
              governance.dataSourcesAccessValidationWorkflow.items || [],
              (item) => [item.label || "", item.sourceId || "", item.status || "", item.stage || "", item.priority || "", item.accessMethod || "", item.coverageStatus || "", item.latestEvidenceStatus || "", item.action || ""],
              (left, right) => {
                const statusRank = { blocked: 0, pending: 1, ready: 2 };
                const priorityRank = { high: 0, medium: 1, low: 2 };
                return (statusRank[left.status] ?? 99) - (statusRank[right.status] ?? 99)
                  || (priorityRank[left.priority] ?? 99) - (priorityRank[right.priority] ?? 99)
                  || left.label.localeCompare(right.label);
              }
            )
          }
        : null,
      dataSourceAccessValidationWorkflowSnapshots: filterAndSort(
        governance.dataSourceAccessValidationWorkflowSnapshots || [],
        (snapshot) => [snapshot.title || "", String(snapshot.total), String(snapshot.readyCount), String(snapshot.pendingCount), String(snapshot.blockedCount), String(snapshot.missingEvidenceCount), snapshot.markdown || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      dataSourceAccessValidationWorkflowSnapshotDiff: governance.dataSourceAccessValidationWorkflowSnapshotDiff && matchesSearch([
        "data sources access validation workflow snapshot drift",
        governance.dataSourceAccessValidationWorkflowSnapshotDiff.snapshotTitle || "",
        governance.dataSourceAccessValidationWorkflowSnapshotDiff.driftSeverity || "",
        governance.dataSourceAccessValidationWorkflowSnapshotDiff.recommendedAction || "",
        governance.dataSourceAccessValidationWorkflowSnapshotDiff.hasDrift ? "drift" : "no drift",
        ...(governance.dataSourceAccessValidationWorkflowSnapshotDiff.driftItems || []).map((item) => `${item.label} ${item.before} ${item.current} ${item.delta}`)
      ])
        ? governance.dataSourceAccessValidationWorkflowSnapshotDiff
        : null,
      dataSourcesAccessTasks: filterAndSort(
        governance.dataSourcesAccessTasks || [],
        (task) => [task.projectName || "", task.title || "", task.status || "", task.priority || "", task.sourceLabel || "", task.sourceType || "", task.accessMethod || "", task.workflowStage || "", task.workflowStatus || "", task.sourceAccessValidationWorkflowId || "", task.description || ""],
        (left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime()
      ),
      dataSourceAccessTaskLedgerSnapshots: filterAndSort(
        governance.dataSourceAccessTaskLedgerSnapshots || [],
        (snapshot) => [snapshot.title || "", snapshot.statusFilter || "", String(snapshot.total), String(snapshot.openCount), String(snapshot.closedCount), snapshot.markdown || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      dataSourceAccessTaskLedgerSnapshotDiff: governance.dataSourceAccessTaskLedgerSnapshotDiff && matchesSearch([
        "data sources access task ledger snapshot drift",
        governance.dataSourceAccessTaskLedgerSnapshotDiff.snapshotTitle || "",
        governance.dataSourceAccessTaskLedgerSnapshotDiff.driftSeverity || "",
        governance.dataSourceAccessTaskLedgerSnapshotDiff.recommendedAction || "",
        governance.dataSourceAccessTaskLedgerSnapshotDiff.hasDrift ? "drift" : "no drift",
        ...(governance.dataSourceAccessTaskLedgerSnapshotDiff.driftItems || []).map((item) => `${item.label || ""} ${item.field || ""} ${item.before ?? ""} ${item.current ?? ""} ${item.delta ?? ""}`)
      ])
        ? governance.dataSourceAccessTaskLedgerSnapshotDiff
        : null,
      agentControlPlaneDecisionSnapshots: filterAndSort(
        governance.agentControlPlaneDecisionSnapshots || [],
        (snapshot) => [snapshot.title || "", snapshot.decision || "", snapshot.recommendedAction || "", snapshot.baselineHealth || "", snapshot.baselineDriftSeverity || "", (snapshot.reasonCodes || []).join(" "), snapshot.markdown || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      agentControlPlaneDecisionTaskLedgerSnapshots: filterAndSort(
        governance.agentControlPlaneDecisionTaskLedgerSnapshots || [],
        (snapshot) => [snapshot.title || "", snapshot.statusFilter || "", String(snapshot.total), String(snapshot.openCount), String(snapshot.closedCount), String(snapshot.reasonCount), snapshot.markdown || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      agentControlPlaneDecisionTaskLedgerSnapshotDiff: governance.agentControlPlaneDecisionTaskLedgerSnapshotDiff && matchesSearch([
        "agent control plane decision task ledger snapshot drift",
        governance.agentControlPlaneDecisionTaskLedgerSnapshotDiff.snapshotTitle || "",
        governance.agentControlPlaneDecisionTaskLedgerSnapshotDiff.driftSeverity || "",
        governance.agentControlPlaneDecisionTaskLedgerSnapshotDiff.recommendedAction || "",
        governance.agentControlPlaneDecisionTaskLedgerSnapshotDiff.hasDrift ? "drift" : "no drift",
        ...(governance.agentControlPlaneDecisionTaskLedgerSnapshotDiff.driftItems || []).map((item) => `${item.label || ""} ${item.field || ""} ${item.before ?? ""} ${item.current ?? ""} ${item.delta ?? ""}`)
      ])
        ? governance.agentControlPlaneDecisionTaskLedgerSnapshotDiff
        : null,
      agentExecutionResultTaskLedgerSnapshots: filterAndSort(
        governance.agentExecutionResultTaskLedgerSnapshots || [],
        (snapshot) => [snapshot.title || "", snapshot.statusFilter || "", String(snapshot.total), String(snapshot.openCount), String(snapshot.closedCount), String(snapshot.actionCount), snapshot.markdown || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      agentExecutionResultTaskLedgerSnapshotDiff: governance.agentExecutionResultTaskLedgerSnapshotDiff && matchesSearch([
        "agent execution result task ledger snapshot drift",
        governance.agentExecutionResultTaskLedgerSnapshotDiff.snapshotTitle || "",
        governance.agentExecutionResultTaskLedgerSnapshotDiff.driftSeverity || "",
        governance.agentExecutionResultTaskLedgerSnapshotDiff.recommendedAction || "",
        governance.agentExecutionResultTaskLedgerSnapshotDiff.hasDrift ? "drift" : "no drift",
        ...(governance.agentExecutionResultTaskLedgerSnapshotDiff.driftItems || []).map((item) => `${item.label || ""} ${item.field || ""} ${item.before ?? ""} ${item.current ?? ""} ${item.delta ?? ""}`)
      ])
        ? governance.agentExecutionResultTaskLedgerSnapshotDiff
        : null,
      agentControlPlaneSnapshots: filterAndSort(
        governance.agentControlPlaneSnapshots || [],
        (snapshot) => [snapshot.title || "", snapshot.isBaseline ? "baseline" : "", String(snapshot.totalWorkOrders), String(snapshot.totalExecutionRuns), String(snapshot.totalSlaLedgerRecords), snapshot.markdown || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      agentReadinessMatrix: filterAndSort(
        governance.agentReadinessMatrix,
        (item) => [item.projectName || "", item.owner || "", item.status || "", item.lifecycle || "", item.targetState || "", item.nextStep || "", item.agentPolicy?.checkpointStatus || "", item.agentPolicy?.role || "", item.agentPolicy?.runtime || "", (item.agentPolicy?.skillBundle || []).join(" "), (item.agentPolicy?.hookPolicy || []).join(" "), item.blockers.join(" ")],
        (left, right) => left.score - right.score || right.openFindingCount - left.openFindingCount || left.projectName.localeCompare(right.projectName)
      ),
      agentPolicyCheckpoints: filterAndSort(
        governance.agentPolicyCheckpoints || [],
        (checkpoint) => [checkpoint.policyId || "", checkpoint.projectName || "", checkpoint.projectId || "", checkpoint.status || "", checkpoint.role || "", checkpoint.runtime || "", checkpoint.isolationMode || "", (checkpoint.skillBundle || []).join(" "), (checkpoint.hookPolicy || []).join(" "), checkpoint.note || "", checkpoint.reason || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
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
      cliBridgeRunTraceSnapshots: filterAndSort(
        governance.cliBridgeRunTraceSnapshots || [],
        (snapshot) => [snapshot.title || "", snapshot.projectName || "", snapshot.traceDecision || "", snapshot.runId || "", snapshot.latestCliBridgeResultHandoffId || "", snapshot.latestCliBridgeReviewHandoffId || "", snapshot.markdown || ""],
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
      cliBridgeRunTraceSnapshotDiff: governance.cliBridgeRunTraceSnapshotDiff && matchesSearch([
        "cli bridge run trace snapshot drift",
        governance.cliBridgeRunTraceSnapshotDiff.snapshotTitle || "",
        governance.cliBridgeRunTraceSnapshotDiff.driftSeverity || "",
        governance.cliBridgeRunTraceSnapshotDiff.recommendedAction || "",
        governance.cliBridgeRunTraceSnapshotDiff.hasDrift ? "drift" : "no drift",
        ...(governance.cliBridgeRunTraceSnapshotDiff.driftItems || []).map((item) => `${item.label || ""} ${item.field || ""} ${item.before ?? ""} ${item.current ?? ""} ${item.delta ?? ""}`)
      ])
        ? governance.cliBridgeRunTraceSnapshotDiff
        : null,
      cliBridgeRunTraceSnapshotBaselineStatus: governance.cliBridgeRunTraceSnapshotBaselineStatus && matchesSearch([
        "cli bridge run trace baseline status",
        governance.cliBridgeRunTraceSnapshotBaselineStatus.hasBaseline ? "baseline set" : "baseline missing",
        governance.cliBridgeRunTraceSnapshotBaselineStatus.title || "",
        governance.cliBridgeRunTraceSnapshotBaselineStatus.runId || "",
        governance.cliBridgeRunTraceSnapshotBaselineStatus.freshness || "",
        governance.cliBridgeRunTraceSnapshotBaselineStatus.health || "",
        governance.cliBridgeRunTraceSnapshotBaselineStatus.recommendedAction || "",
        governance.cliBridgeRunTraceSnapshotBaselineStatus.driftSeverity || "",
        governance.cliBridgeRunTraceSnapshotBaselineStatus.driftRecommendedAction || "",
        governance.cliBridgeRunTraceSnapshotBaselineStatus.hasDrift ? "drift" : "no drift",
        ...(governance.cliBridgeRunTraceSnapshotBaselineStatus.driftItems || []).map((item) => `${item.label || ""} ${item.field || ""} ${item.before ?? ""} ${item.current ?? ""} ${item.delta ?? ""}`)
      ])
        ? governance.cliBridgeRunTraceSnapshotBaselineStatus
        : null,
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
      if (scope !== "operations") filtered.taskSeedingCheckpoints = [];
      if (scope !== "convergence") filtered.convergenceCandidates = null;
      if (scope !== "convergence") filtered.convergenceOperatorProposalQueue = null;
      if (scope !== "convergence") filtered.convergenceAssimilationRunLedger = null;
      if (scope !== "convergence") filtered.convergenceAssimilationResultLedger = null;
      if (scope !== "convergence") filtered.convergenceAssimilationResultCheckpointLedger = null;
      if (scope !== "convergence") filtered.convergenceAssimilationReadinessGate = null;
      if (scope !== "convergence") filtered.convergenceAssimilationSessionPacketSnapshots = [];
      if (scope !== "convergence") filtered.convergenceAssimilationRunnerLaunchpadGateSnapshots = [];
      if (scope !== "convergence") filtered.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshots = [];
      if (scope !== "convergence") filtered.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff = null;
      if (scope !== "convergence") filtered.convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger = null;
      if (scope !== "convergence") filtered.convergenceAssimilationRunnerLaunchControlBoard = null;
      if (scope !== "convergence") filtered.convergenceAssimilationRunnerLaunchControlBoardSnapshots = [];
      if (scope !== "convergence") filtered.convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff = null;
      if (scope !== "convergence") filtered.convergenceAssimilationRunnerLaunchpadGateSnapshotDiff = null;
      if (scope !== "convergence") filtered.convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger = null;
      if (scope !== "convergence") filtered.convergenceAssimilationSessionPacketSnapshotDiff = null;
      if (scope !== "convergence") filtered.convergenceAssimilationSessionPacketDriftCheckpointLedger = null;
      if (scope !== "convergence") filtered.convergenceTasks = [];
      if (scope !== "convergence") filtered.convergenceTaskLedgerSnapshots = [];
      if (scope !== "convergence") filtered.convergenceTaskLedgerSnapshotDiff = null;
      if (scope !== "runbook") filtered.workflowRunbook = [];
      if (scope !== "agents") filtered.agentSessions = [];
      if (scope !== "agents") filtered.agentControlPlaneBaselineStatus = null;
      if (scope !== "agents") filtered.agentControlPlaneDecision = null;
      if (scope !== "agents") filtered.agentControlPlaneDecisionSnapshots = [];
      if (scope !== "agents") filtered.agentControlPlaneDecisionTaskLedgerSnapshots = [];
      if (scope !== "agents") filtered.agentControlPlaneDecisionTaskLedgerSnapshotDiff = null;
      if (scope !== "agents" && scope !== "execution") filtered.agentExecutionResultTaskLedgerSnapshots = [];
      if (scope !== "agents" && scope !== "execution") filtered.agentExecutionResultTaskLedgerSnapshotDiff = null;
      if (scope !== "agents") filtered.agentControlPlaneSnapshots = [];
      if (scope !== "release") filtered.releaseSummary = null;
      if (scope !== "release") filtered.releaseCheckpointDrift = null;
      if (scope !== "release") filtered.releaseBuildGate = null;
      if (scope !== "release") filtered.releaseControlTasks = [];
      if (scope !== "release") filtered.releaseTaskLedgerSnapshots = [];
      if (scope !== "release") filtered.releaseTaskLedgerSnapshotDiff = null;
      if (scope !== "agents") filtered.agentControlPlaneDecisionTasks = [];
      if (scope !== "data-sources") filtered.dataSourcesAccessGate = null;
      if (scope !== "data-sources") filtered.dataSourcesAccessReviewQueue = null;
      if (scope !== "data-sources") filtered.dataSourcesAccessValidationRunbook = null;
      if (scope !== "data-sources") filtered.dataSourcesAccessValidationEvidenceCoverage = null;
      if (scope !== "data-sources") filtered.dataSourceAccessValidationEvidence = [];
      if (scope !== "data-sources") filtered.dataSourceAccessValidationEvidenceSnapshots = [];
      if (scope !== "data-sources") filtered.dataSourceAccessValidationEvidenceSnapshotDiff = null;
      if (scope !== "data-sources") filtered.dataSourcesAccessValidationWorkflow = null;
      if (scope !== "data-sources") filtered.dataSourceAccessValidationWorkflowSnapshots = [];
      if (scope !== "data-sources") filtered.dataSourceAccessValidationWorkflowSnapshotDiff = null;
      if (scope !== "data-sources") filtered.dataSourcesAccessTasks = [];
      if (scope !== "data-sources") filtered.dataSourceAccessTaskLedgerSnapshots = [];
      if (scope !== "data-sources") filtered.dataSourceAccessTaskLedgerSnapshotDiff = null;
      if (scope !== "readiness") filtered.agentReadinessMatrix = [];
      if (scope !== "readiness") filtered.agentPolicyCheckpoints = [];
      if (scope !== "work-orders") filtered.agentWorkOrderSnapshots = [];
      if (scope !== "execution") filtered.agentWorkOrderRuns = [];
      if (scope !== "execution") filtered.cliBridgeRunTraceSnapshots = [];
      if (scope !== "execution") filtered.cliBridgeRunTraceSnapshotDiff = null;
      if (scope !== "execution") filtered.cliBridgeRunTraceSnapshotBaselineStatus = null;
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

          if (element.dataset.governanceAction === "suppress-queue-item") {
            const queueItemId = element.dataset.queueItemId ?? "";
            const queueKind = element.dataset.queueKind ?? "governance";
            const queueTitle = element.dataset.queueTitle ?? "Governance queue item";
            if (!queueItemId) return;
            await api.suppressGovernanceQueue({
              items: [{
                id: queueItemId,
                projectId,
                projectName,
                kind: queueKind,
                title: queueTitle
              }],
              reason: "Marked not actionable from the Governance queue checkpoint."
            });
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

    container.querySelectorAll("[data-task-seeding-checkpoint]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const batchId = element.dataset.taskSeedingBatchId || "";
        const status = element.dataset.taskSeedingStatus || "needs-review";
        const title = element.dataset.taskSeedingTitle || "Generated task batch";
        const source = element.dataset.taskSeedingSource || "governance";
        const itemCount = Number(element.dataset.taskSeedingItemCount || 0);
        const note = element.dataset.taskSeedingNote || `Operator marked generated task batch as ${status} from the Governance task seeding checkpoint.`;
        if (!batchId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = status === "dismissed" ? "Dismissing" : status === "approved" ? "Confirming" : "Deferring";
          await api.createTaskSeedingCheckpoint({
            batchId,
            status,
            title,
            source,
            itemCount,
            note
          });
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

    container.querySelectorAll("[data-source-access-task-checkpoint-action]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const taskId = element.dataset.taskId || "";
        const action = element.dataset.sourceAccessTaskCheckpointAction || "";
        if (!taskId || !action) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Updating";
          element.textContent = await updateDataSourcesAccessTaskCheckpoint(taskId, action);
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-source-validation-workflow-task-checkpoint-action]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const taskId = element.dataset.taskId || "";
        const action = element.dataset.sourceValidationWorkflowTaskCheckpointAction || "";
        if (!taskId || !action) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Updating";
          element.textContent = await updateDataSourcesAccessValidationWorkflowTaskCheckpoint(taskId, action);
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-control-plane-decision-task-action]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const taskId = element.dataset.taskId || "";
        const action = element.dataset.controlPlaneDecisionTaskAction || "";
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

    container.querySelectorAll("[data-control-plane-decision-task-checkpoint-action]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const taskId = element.dataset.taskId || "";
        const action = element.dataset.controlPlaneDecisionTaskCheckpointAction || "";
        if (!taskId || !action) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Updating";
          element.textContent = await updateAgentControlPlaneDecisionTaskCheckpoint(taskId, action);
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-agent-execution-result-task-action]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const taskId = element.dataset.taskId || "";
        const action = element.dataset.agentExecutionResultTaskAction || "";
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

    container.querySelectorAll("[data-agent-execution-result-task-checkpoint-action]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const taskId = element.dataset.taskId || "";
        const action = element.dataset.agentExecutionResultTaskCheckpointAction || "";
        if (!taskId || !action) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Updating";
          element.textContent = await updateAgentExecutionResultTaskCheckpoint(taskId, action);
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-release-control-task-checkpoint-action]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const taskId = element.dataset.taskId || "";
        const action = element.dataset.releaseControlTaskCheckpointAction || "";
        if (!taskId || !action) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Updating";
          const label = await updateReleaseControlTaskCheckpoint(taskId, action);
          element.textContent = label;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-task-checkpoint-action]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const taskId = element.dataset.taskId || "";
        const action = element.dataset.convergenceTaskCheckpointAction || "";
        if (!taskId || !action) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Updating";
          const label = await updateConvergenceTaskCheckpoint(taskId, action);
          element.textContent = label;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    bindSourceAccessEvidenceActions(container, renderGovernance);
  }

  /**
   * @param {HTMLElement} container
   * @param {() => Promise<void>} refreshAfterRecord
   */
  function bindSourceAccessEvidenceActions(container, refreshAfterRecord) {
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
            ? `Confirmed the inferred ${accessMethod} access method outside this app.`
            : status === "blocked"
              ? `Access blocked for ${accessMethod}; credentials or operator access must be resolved outside this app.`
              : `Access method ${accessMethod} needs operator review; non-secret evidence captured for follow-up.`
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
          await refreshAfterRecord();
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
  function bindSourceTaskSeedingCheckpointActions(container) {
    container.querySelectorAll("[data-source-task-seeding-checkpoint]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const batchId = element.dataset.taskSeedingBatchId || "";
        const status = element.dataset.taskSeedingStatus || "needs-review";
        const title = element.dataset.taskSeedingTitle || "Data Sources generated task item";
        const source = element.dataset.taskSeedingSource || "sources";
        const itemCount = Number(element.dataset.taskSeedingItemCount || 1);
        const note = element.dataset.taskSeedingNote || `Operator marked the Data Sources inferred task item as ${status} from the Sources item checkpoint before task creation.`;
        if (!batchId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = status === "dismissed" ? "Dismissing" : status === "approved" ? "Confirming" : "Deferring";
          await recordGeneratedTaskBatchCheckpoint({
            batchId,
            status,
            title,
            source,
            itemCount,
            renderTarget: "sources",
            note
          });
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
  function bindSourceAccessMatrixTaskActions(container) {
    container.querySelectorAll("[data-source-access-matrix-task-access-method]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const accessMethod = element.dataset.sourceAccessMatrixTaskAccessMethod || "";
        if (!accessMethod) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          const label = await createSourceAccessMatrixTasks(accessMethod);
          element.textContent = label;
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
   * @param {import("./dashboard-types.js").DataSourcesAccessMethodRegistryPayload} registry
   */
  function bindSourceAccessMethodRegistryActions(container, registry) {
    container.querySelectorAll("[data-source-access-method-registry-evidence-method]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const accessMethod = element.dataset.sourceAccessMethodRegistryEvidenceMethod || "";
        const method = (registry?.methods || []).find((item) => item.accessMethod === accessMethod);
        if (!method) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Recording";
          const label = await recordSourceAccessMethodRegistryEvidence(method);
          if (label === "Cancelled") {
            element.disabled = false;
            element.textContent = originalLabel;
            return;
          }
          element.textContent = label;
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
  function bindSourceAccessValidationRunbookTaskActions(container) {
    container.querySelectorAll("[data-source-access-validation-runbook-task-method]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const accessMethod = element.dataset.sourceAccessValidationRunbookTaskMethod || "";
        if (!accessMethod) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          const label = await createSourceAccessValidationRunbookEvidenceTasks(accessMethod);
          element.textContent = label;
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
  function bindSourceAccessChecklistTaskActions(container) {
    container.querySelectorAll("[data-source-access-checklist-task-source-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const sourceId = element.dataset.sourceAccessChecklistTaskSourceId || "";
        if (!sourceId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          const label = await createSourceAccessChecklistWorkflowTasks(sourceId);
          element.textContent = label;
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
   * @param {"governance" | "sources"} [defaultRenderTarget]
   */
  function bindSourceAccessReviewTaskSnapshotActions(container, defaultRenderTarget = "governance") {
    container.querySelectorAll("[data-source-access-review-task-snapshot]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const itemId = element.dataset.sourceAccessReviewTaskSnapshot || "";
        const renderTarget = element.dataset.sourceAccessReviewTaskSnapshotRenderTarget || defaultRenderTarget;
        if (!itemId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Capturing";
          await createSourceAccessReviewTaskWithSnapshot(itemId, renderTarget === "sources" ? "sources" : "governance");
          element.textContent = "Captured";
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
   * @param {"governance" | "sources"} [defaultRenderTarget]
   */
  function bindSourceEvidenceCoverageTaskSnapshotActions(container, defaultRenderTarget = "governance") {
    container.querySelectorAll("[data-source-evidence-coverage-task-snapshot]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const itemId = element.dataset.sourceEvidenceCoverageTaskSnapshot || "";
        const renderTarget = element.dataset.sourceEvidenceCoverageTaskSnapshotRenderTarget || defaultRenderTarget;
        if (!itemId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Capturing";
          await createSourceEvidenceCoverageTaskWithSnapshot(itemId, renderTarget === "sources" ? "sources" : "governance");
          element.textContent = "Captured";
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
   * @param {"governance" | "sources"} [defaultRenderTarget]
   */
  function bindSourceValidationWorkflowTaskSnapshotActions(container, defaultRenderTarget = "governance") {
    container.querySelectorAll("[data-source-validation-workflow-task-snapshot]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const itemId = element.dataset.sourceValidationWorkflowTaskSnapshot || "";
        const renderTarget = element.dataset.sourceValidationWorkflowTaskSnapshotRenderTarget || defaultRenderTarget;
        if (!itemId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Capturing";
          await createSourceValidationWorkflowTaskWithSnapshot(itemId, renderTarget === "sources" ? "sources" : "governance");
          element.textContent = "Captured";
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

  function buildVibeCoderOperatingGuideMarkdown() {
    return [
      "# Vibe Coder Operating Guide",
      "",
      "Purpose: use Workspace Audit Pro as the backbone for safe app debugging, implementation, validation, relaunch, and supervised agent build cycles.",
      "",
      "## Core Cycle",
      "",
      "1. Capture intent: convert the request into a scoped objective, success criteria, and non-goals.",
      "2. Check source readiness: confirm repo path, Git access method, source health, and external-only passwords, certificates, SSH, VPN, or browser-session requirements.",
      "3. Read the control plane: use Governance and Agent Control Plane to decide ready, review, or hold before execution.",
      "4. Generate a work order: define target repo, files or modules in scope, expected changes, validation commands, acceptance criteria, and rollback plan.",
      "5. Assign the execution engine: use Codex CLI for repository-aware coding and Claude CLI for complementary planning, review, or documentation when ready.",
      "6. Execute in small slices: capture non-secret status, changed files, validation summaries, and blockers.",
      "7. Debug systematically: reproduce, isolate, fix the smallest failing layer, rerun validation, then record what changed.",
      "8. Validate before moving on: run syntax checks, tests, build checks, smoke checks, and work-order-specific commands.",
      "9. Relaunch and inspect: restart the local app after each completed build cycle and record URL, PID, and smoke result.",
      "10. Commit and checkpoint: commit only validated milestone changes and push when the build is clean.",
      "11. Review and teach: explain what changed, why it matters, what passed, what remains risky, and what comes next.",
      "",
      "Secret policy: keep credentials, tokens, certificates, private keys, browser sessions, cookies, and raw command output out of Workspace Audit Pro."
    ].join("\n");
  }

  /**
   * @param {HTMLElement} container
   */
  function bindConvergenceReviewLedgerActions(container) {
    container.querySelectorAll("[data-convergence-review-ledger-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const status = element.dataset.convergenceReviewLedgerCopy || "active";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const payload = await api.fetchConvergenceCandidates({
            status: status === "active" ? undefined : status,
            includeNotRelated: status === "all" || status === "not-related"
          });
          await copyText(payload.markdown);
          element.textContent = `Copied ${payload.summary.total}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-operator-proposal-queue-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const status = element.dataset.convergenceOperatorProposalQueueCopy || "active";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const payload = await api.fetchConvergenceOperatorProposalQueue(status);
          await copyText(payload.markdown);
          element.textContent = `Copied ${payload.summary.visible}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-operator-proposal-action-pair-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const pairId = element.dataset.convergenceOperatorProposalActionPairId || "";
        const status = element.dataset.convergenceOperatorProposalAction || "";
        if (!pairId || !status) return;

        const item = governanceCache?.convergenceOperatorProposalQueue?.items?.find((candidate) => candidate.pairId === pairId)
          || governanceCache?.convergenceCandidates?.candidates?.find((candidate) => candidate.pairId === pairId);
        if (!item) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          await api.saveConvergenceReview({
            leftId: item.leftId,
            rightId: item.rightId,
            leftName: item.leftName,
            rightName: item.rightName,
            score: item.score,
            reasons: Array.isArray(item.reasons) ? item.reasons : [],
            status,
            note: item.reviewNote || `Operator proposal queue action: ${status}.`
          });
          await renderGovernance();
          element.textContent = "Saved";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-run-ledger-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const status = element.dataset.convergenceAssimilationRunLedgerCopy || "all";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const payload = await api.fetchConvergenceAssimilationRunLedger(status);
          await copyText(payload.markdown);
          element.textContent = `Copied ${payload.summary.visible}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-result-ledger-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const status = element.dataset.convergenceAssimilationResultLedgerCopy || "all";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const payload = await api.fetchConvergenceAssimilationResultLedger(status);
          await copyText(payload.markdown);
          element.textContent = `Copied ${payload.summary.visible}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-result-checkpoint-ledger-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const status = element.dataset.convergenceAssimilationResultCheckpointLedgerCopy || "all";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const payload = await api.fetchConvergenceAssimilationResultCheckpointLedger(status);
          await copyText(payload.markdown);
          element.textContent = `Copied ${payload.summary.visible}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-readiness-gate-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const payload = await api.fetchConvergenceAssimilationReadinessGate();
          await copyText(payload.markdown);
          element.textContent = `Copied ${payload.decision}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-cli-contract-runner]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runner = element.dataset.convergenceAssimilationCliContractRunner || "codex";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const payload = await api.fetchConvergenceAssimilationCliHandoffContract({
            runner: runner === "claude" ? "claude" : "codex"
          });
          await copyText(payload.markdown);
          element.textContent = `Copied ${payload.runner}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-operator-playbook-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const payload = await api.fetchConvergenceAssimilationOperatorPlaybook();
          await copyText(payload.markdown);
          element.textContent = "Copied Playbook";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-session-packet-runner]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runner = element.dataset.convergenceAssimilationSessionPacketRunner || "codex";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const payload = await api.fetchConvergenceAssimilationSessionPacket({
            runner: runner === "claude" ? "claude" : "codex"
          });
          await copyText(payload.markdown);
          element.textContent = `Copied ${payload.runner}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-session-packet-save-runner]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runner = element.dataset.convergenceAssimilationSessionPacketSaveRunner || "codex";
        const normalizedRunner = runner === "claude" ? "claude" : "codex";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          const response = await api.createConvergenceAssimilationSessionPacketSnapshot({
            runner: normalizedRunner,
            title: `Convergence Assimilation ${normalizedRunner} Session Packet`
          });
          await renderGovernance();
          element.textContent = `Saved ${response.snapshot.runner}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-session-packet-snapshot-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.convergenceAssimilationSessionPacketSnapshotId || "";
        const snapshot = governanceCache?.convergenceAssimilationSessionPacketSnapshots?.find((item) => item.id === snapshotId);
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

    container.querySelectorAll("[data-convergence-assimilation-session-packet-drift-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runner = element.dataset.convergenceAssimilationSessionPacketDriftCopy || "codex";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Diffing";
          const diff = await api.fetchConvergenceAssimilationSessionPacketSnapshotDiff("latest", {
            runner: runner === "claude" ? "claude" : "codex"
          });
          await copyText(diff.markdown);
          element.textContent = diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : diff.hasSnapshot ? "No Drift" : "No Snapshot";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-session-packet-snapshot-drift-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.convergenceAssimilationSessionPacketSnapshotDriftId || "";
        if (!snapshotId) return;
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Diffing";
          const diff = await api.fetchConvergenceAssimilationSessionPacketSnapshotDiff(snapshotId);
          await copyText(diff.markdown);
          element.textContent = diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : "No Drift";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-session-packet-drift-field]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.convergenceAssimilationSessionPacketDriftSnapshotId || "latest";
        const runner = element.dataset.convergenceAssimilationSessionPacketDriftRunner || "codex";
        const field = element.dataset.convergenceAssimilationSessionPacketDriftField || "";
        const decision = element.dataset.convergenceAssimilationSessionPacketDriftDecision || "deferred";
        if (!field) return;
        const note = (window.prompt(`Optional non-secret packet drift checkpoint note for ${decision}`, "") || "").trim();
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          const response = await api.checkpointConvergenceAssimilationSessionPacketDrift({
            snapshotId,
            runner: runner === "claude" ? "claude" : "codex",
            field,
            decision: decision === "confirmed" || decision === "escalated" ? decision : "deferred",
            note
          });
          await renderGovernance();
          element.textContent = response.mode === "updated" ? "Updated" : "Created";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-session-packet-drift-checkpoint-ledger-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const status = element.dataset.convergenceAssimilationSessionPacketDriftCheckpointLedgerCopy || "all";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const payload = await api.fetchConvergenceAssimilationSessionPacketDriftCheckpointLedger(status === "open" || status === "closed" ? status : "all");
          await copyText(payload.markdown);
          element.textContent = `Copied ${payload.summary.visible}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-runner-command-queue-runner]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runner = element.dataset.convergenceAssimilationRunnerCommandQueueRunner || "codex";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const payload = await api.fetchConvergenceAssimilationRunnerCommandQueueDraft({
            runner: runner === "claude" ? "claude" : "codex"
          });
          await copyText(payload.markdown);
          element.textContent = `Copied ${payload.runner}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-runner-result-replay-runner]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runner = element.dataset.convergenceAssimilationRunnerResultReplayRunner || "codex";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const payload = await api.fetchConvergenceAssimilationRunnerResultReplayChecklist({
            runner: runner === "claude" ? "claude" : "codex"
          });
          await copyText(payload.markdown);
          element.textContent = `Copied ${payload.runner}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-runner-launchpad-gate-runner]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runner = element.dataset.convergenceAssimilationRunnerLaunchpadGateRunner || "codex";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const payload = await api.fetchConvergenceAssimilationRunnerLaunchpadGate({
            runner: runner === "claude" ? "claude" : "codex"
          });
          await copyText(payload.markdown);
          element.textContent = `Copied ${payload.decision}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-runner-launchpad-gate-save-runner]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runner = element.dataset.convergenceAssimilationRunnerLaunchpadGateSaveRunner || "codex";
        const normalizedRunner = runner === "claude" ? "claude" : "codex";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          const response = await api.createConvergenceAssimilationRunnerLaunchpadGateSnapshot({
            runner: normalizedRunner,
            title: `Convergence Assimilation ${normalizedRunner} Launchpad Gate`
          });
          await renderGovernance();
          element.textContent = `Saved ${response.snapshot.decision}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-runner-launchpad-gate-snapshot-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.convergenceAssimilationRunnerLaunchpadGateSnapshotId || "";
        const snapshot = governanceCache?.convergenceAssimilationRunnerLaunchpadGateSnapshots?.find((item) => item.id === snapshotId);
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

    container.querySelectorAll("[data-convergence-assimilation-runner-launchpad-gate-drift-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runner = element.dataset.convergenceAssimilationRunnerLaunchpadGateDriftCopy || "codex";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Diffing";
          const diff = await api.fetchConvergenceAssimilationRunnerLaunchpadGateSnapshotDiff("latest", {
            runner: runner === "claude" ? "claude" : "codex"
          });
          await copyText(diff.markdown);
          element.textContent = diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : diff.hasSnapshot ? "No Drift" : "No Snapshot";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-runner-launchpad-gate-snapshot-drift-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.convergenceAssimilationRunnerLaunchpadGateSnapshotDriftId || "";
        if (!snapshotId) return;
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Diffing";
          const diff = await api.fetchConvergenceAssimilationRunnerLaunchpadGateSnapshotDiff(snapshotId);
          await copyText(diff.markdown);
          element.textContent = diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : "No Drift";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-runner-launchpad-gate-drift-field]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.convergenceAssimilationRunnerLaunchpadGateDriftSnapshotId || "latest";
        const runner = element.dataset.convergenceAssimilationRunnerLaunchpadGateDriftRunner || "codex";
        const field = element.dataset.convergenceAssimilationRunnerLaunchpadGateDriftField || "";
        const decision = element.dataset.convergenceAssimilationRunnerLaunchpadGateDriftDecision || "deferred";
        if (!field) return;
        const note = (window.prompt(`Optional non-secret launchpad gate drift checkpoint note for ${decision}`, "") || "").trim();
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          const response = await api.checkpointConvergenceAssimilationRunnerLaunchpadGateDrift({
            snapshotId,
            runner: runner === "claude" ? "claude" : "codex",
            field,
            decision: decision === "confirmed" || decision === "escalated" ? decision : "deferred",
            note
          });
          await renderGovernance();
          element.textContent = response.mode === "updated" ? "Updated" : "Created";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-runner-launchpad-gate-drift-checkpoint-ledger-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const status = element.dataset.convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedgerCopy || "all";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const payload = await api.fetchConvergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger(status === "open" || status === "closed" ? status : "all");
          await copyText(payload.markdown);
          element.textContent = `Copied ${payload.summary.visible}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-runner-launch-authorization-pack-runner]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runner = element.dataset.convergenceAssimilationRunnerLaunchAuthorizationPackRunner || "codex";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Packing";
          const payload = await api.fetchConvergenceAssimilationRunnerLaunchAuthorizationPack({
            runner: runner === "claude" ? "claude" : "codex"
          });
          await copyText(payload.markdown);
          element.textContent = `Copied ${payload.decision}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-runner-launch-authorization-pack-save-runner]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runner = element.dataset.convergenceAssimilationRunnerLaunchAuthorizationPackSaveRunner || "codex";
        const normalizedRunner = runner === "claude" ? "claude" : "codex";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          const response = await api.createConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshot({
            runner: normalizedRunner,
            title: `Convergence Assimilation ${normalizedRunner} Launch Authorization Pack`
          });
          await renderGovernance();
          element.textContent = `Saved ${response.snapshot.decision}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-runner-launch-authorization-pack-snapshot-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotId || "";
        const snapshot = governanceCache?.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshots?.find((item) => item.id === snapshotId);
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

    container.querySelectorAll("[data-convergence-assimilation-runner-launch-authorization-pack-drift-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runner = element.dataset.convergenceAssimilationRunnerLaunchAuthorizationPackDriftCopy || "codex";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Diffing";
          const diff = await api.fetchConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff("latest", {
            runner: runner === "claude" ? "claude" : "codex"
          });
          await copyText(diff.markdown);
          element.textContent = diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : diff.hasSnapshot ? "No Drift" : "No Snapshot";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-runner-launch-authorization-pack-snapshot-drift-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDriftId || "";
        if (!snapshotId) return;
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Diffing";
          const diff = await api.fetchConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff(snapshotId);
          await copyText(diff.markdown);
          element.textContent = diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : "No Drift";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-runner-launch-authorization-pack-drift-field]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.convergenceAssimilationRunnerLaunchAuthorizationPackDriftSnapshotId || "latest";
        const runner = element.dataset.convergenceAssimilationRunnerLaunchAuthorizationPackDriftRunner || "codex";
        const field = element.dataset.convergenceAssimilationRunnerLaunchAuthorizationPackDriftField || "";
        const decision = element.dataset.convergenceAssimilationRunnerLaunchAuthorizationPackDriftDecision || "deferred";
        if (!field) return;
        const note = (window.prompt(`Optional non-secret launch authorization pack drift checkpoint note for ${decision}`, "") || "").trim();
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          const response = await api.checkpointConvergenceAssimilationRunnerLaunchAuthorizationPackDrift({
            snapshotId,
            runner: runner === "claude" ? "claude" : "codex",
            field,
            decision: decision === "confirmed" || decision === "escalated" ? decision : "deferred",
            note
          });
          await renderGovernance();
          element.textContent = response.mode === "updated" ? "Updated" : "Created";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-runner-launch-authorization-pack-drift-checkpoint-ledger-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const status = element.dataset.convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedgerCopy || "all";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const payload = await api.fetchConvergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger(status === "open" || status === "closed" ? status : "all");
          await copyText(payload.markdown);
          element.textContent = `Copied ${payload.summary.visible}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-runner-launch-control-board-runner]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runner = element.dataset.convergenceAssimilationRunnerLaunchControlBoardRunner || "codex";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Boarding";
          const payload = await api.fetchConvergenceAssimilationRunnerLaunchControlBoard({
            runner: runner === "claude" ? "claude" : "codex"
          });
          await copyText(payload.markdown);
          element.textContent = `Copied ${payload.launchDecision}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-runner-launch-control-board-save-runner]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runner = element.dataset.convergenceAssimilationRunnerLaunchControlBoardSaveRunner || "codex";
        const normalizedRunner = runner === "claude" ? "claude" : "codex";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          const response = await api.createConvergenceAssimilationRunnerLaunchControlBoardSnapshot({
            runner: normalizedRunner,
            title: `Convergence Assimilation ${normalizedRunner} Launch Control Board`
          });
          await renderGovernance();
          element.textContent = `Saved ${response.snapshot.launchDecision}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-runner-launch-control-board-snapshot-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.convergenceAssimilationRunnerLaunchControlBoardSnapshotId || "";
        const snapshot = governanceCache?.convergenceAssimilationRunnerLaunchControlBoardSnapshots?.find((item) => item.id === snapshotId);
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

    container.querySelectorAll("[data-convergence-assimilation-runner-launch-control-board-drift-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runner = element.dataset.convergenceAssimilationRunnerLaunchControlBoardDriftCopy || "codex";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Diffing";
          const diff = await api.fetchConvergenceAssimilationRunnerLaunchControlBoardSnapshotDiff("latest", {
            runner: runner === "claude" ? "claude" : "codex"
          });
          await copyText(diff.markdown);
          element.textContent = diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : diff.hasSnapshot ? "No Drift" : "No Snapshot";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-runner-launch-control-board-snapshot-drift-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.convergenceAssimilationRunnerLaunchControlBoardSnapshotDriftId || "";
        if (!snapshotId) return;
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Diffing";
          const diff = await api.fetchConvergenceAssimilationRunnerLaunchControlBoardSnapshotDiff(snapshotId);
          await copyText(diff.markdown);
          element.textContent = diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : "No Drift";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-runner-launch-control-board-drift-field]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.convergenceAssimilationRunnerLaunchControlBoardDriftSnapshotId || "latest";
        const runner = element.dataset.convergenceAssimilationRunnerLaunchControlBoardDriftRunner || "codex";
        const field = element.dataset.convergenceAssimilationRunnerLaunchControlBoardDriftField || "";
        const decision = element.dataset.convergenceAssimilationRunnerLaunchControlBoardDriftDecision || "deferred";
        if (!field) return;
        const note = (window.prompt(`Optional non-secret launch control board drift checkpoint note for ${decision}`, "") || "").trim();
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          const response = await api.checkpointConvergenceAssimilationRunnerLaunchControlBoardDrift({
            snapshotId,
            runner: runner === "claude" ? "claude" : "codex",
            field,
            decision: decision === "confirmed" || decision === "escalated" ? decision : "deferred",
            note
          });
          await renderGovernance();
          element.textContent = response.mode === "updated" ? "Updated" : "Created";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-run-trace-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runId = element.dataset.convergenceAssimilationRunTraceId || "";
        if (!runId) return;
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Tracing";
          const payload = await api.fetchConvergenceAssimilationRunTracePack(runId);
          await copyText(payload.markdown);
          element.textContent = payload.traceDecision === "ready" ? "Copied Trace" : `Copied ${payload.traceDecision}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-run-result-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runId = element.dataset.convergenceAssimilationRunResultId || "";
        if (!runId) return;
        const status = (window.prompt("Result status: passed, failed, blocked, needs-review, or cancelled", "needs-review") || "").trim() || "needs-review";
        const summary = (window.prompt("Non-secret result summary. Do not paste logs, tokens, passwords, certificates, cookies, or private keys.", "") || "").trim();
        if (!summary) return;
        const validationSummary = (window.prompt("Optional non-secret validation summary", "") || "").trim();
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Recording";
          const response = await api.recordConvergenceAssimilationRunResult(runId, {
            status,
            summary,
            validationSummary
          });
          await renderGovernance();
          element.textContent = `Recorded ${response.result.status}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-result-checkpoint-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const resultId = element.dataset.convergenceAssimilationResultCheckpointId || "";
        const decision = element.dataset.convergenceAssimilationResultCheckpointDecision || "deferred";
        if (!resultId) return;
        const note = (window.prompt(`Optional non-secret checkpoint note for ${decision}`, "") || "").trim();
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          const response = await api.checkpointConvergenceAssimilationResult(resultId, {
            decision,
            note
          });
          await renderGovernance();
          element.textContent = response.mode === "updated" ? "Updated" : "Created";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-task-ledger-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const status = element.dataset.convergenceTaskLedgerCopy || "all";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const payload = await api.fetchConvergenceTaskLedger(status === "open" || status === "closed" ? status : "all");
          await copyText(payload.markdown);
          element.textContent = `Copied ${payload.summary.visible}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-task-ledger-snapshot-save]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          await api.createConvergenceTaskLedgerSnapshot({
            title: "Convergence Review Task Ledger",
            status: "all",
            limit: 100
          });
          await renderGovernance();
          element.textContent = "Saved";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-task-ledger-drift-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const diff = await api.fetchConvergenceTaskLedgerSnapshotDiff("latest");
          await copyText(diff.markdown);
          element.textContent = diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : diff.hasSnapshot ? "No Drift" : "No Snapshot";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-task-ledger-snapshot-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.convergenceTaskLedgerSnapshotId || "";
        const snapshot = governanceCache?.convergenceTaskLedgerSnapshots?.find((item) => item.id === snapshotId);
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

    container.querySelectorAll("[data-convergence-task-ledger-snapshot-drift-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.convergenceTaskLedgerSnapshotDriftId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Diffing";
          const diff = await api.fetchConvergenceTaskLedgerSnapshotDiff(snapshotId);
          await copyText(diff.markdown);
          element.textContent = diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : "No Drift";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-task-ledger-drift-item-field]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const field = element.dataset.convergenceTaskLedgerDriftItemField || "";
        const decision = element.dataset.convergenceTaskLedgerDriftItemDecision || "";
        if (!field || !decision) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Updating";
          element.textContent = await updateConvergenceTaskLedgerDriftItemCheckpoint(field, decision);
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-task-ledger-drift-checkpoint-filter]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();

        const filter = element.dataset.convergenceTaskLedgerDriftCheckpointFilter || "all";
        convergenceTaskLedgerDriftCheckpointFilter = ["all", "uncheckpointed", "confirmed", "deferred", "escalated"].includes(filter) ? filter : "all";
        renderGovernanceFromCache();
      };
    });

    container.querySelectorAll("[data-convergence-task-ledger-drift-checkpoint-ledger-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const status = element.dataset.convergenceTaskLedgerDriftCheckpointLedgerCopy || "all";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const ledger = await api.fetchConvergenceTaskLedgerDriftCheckpointLedger(status);
          await copyText(ledger.markdown);
          element.textContent = `Copied ${ledger.summary.visible}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-task-ledger-baseline-refresh]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          await api.createConvergenceTaskLedgerSnapshot({
            title: "Accepted Convergence Review Task Ledger Baseline",
            status: "all",
            limit: 100
          });
          element.textContent = "Baseline Saved";
          await renderGovernance();
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-due-diligence-pair-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const pairId = element.dataset.convergenceDueDiligencePairId || "";
        if (!pairId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const pack = await api.fetchConvergenceDueDiligencePack(pairId);
          await copyText(pack.markdown);
          element.textContent = "Pack Copied";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-blueprint-pair-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const pairId = element.dataset.convergenceAssimilationBlueprintPairId || "";
        if (!pairId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const blueprint = await api.fetchConvergenceAssimilationBlueprint(pairId);
          await copyText(blueprint.markdown);
          element.textContent = "Blueprint Copied";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-work-order-pair-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const pairId = element.dataset.convergenceAssimilationWorkOrderPairId || "";
        const runner = element.dataset.convergenceAssimilationWorkOrderRunner || "codex";
        if (!pairId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const draft = await api.fetchConvergenceAssimilationWorkOrderDraft(pairId, {
            runner: runner === "claude" ? "claude" : "codex"
          });
          await copyText(draft.markdown);
          element.textContent = runner === "claude" ? "Claude Draft Copied" : "Codex Draft Copied";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-assimilation-work-order-run-pair-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const pairId = element.dataset.convergenceAssimilationWorkOrderRunPairId || "";
        const runner = element.dataset.convergenceAssimilationWorkOrderRunRunner || "codex";
        if (!pairId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Queueing";
          const result = await api.queueConvergenceAssimilationWorkOrderRun({
            pairId,
            runner: runner === "claude" ? "claude" : "codex"
          });
          await renderGovernance();
          element.textContent = result.run ? "Run Queued" : "Already Queued";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-convergence-review-task-pair-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const pairId = element.dataset.convergenceReviewTaskPairId || "";
        if (!pairId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          const payload = await api.createConvergenceReviewTasks({ pairIds: [pairId] });
          await renderGovernance();
          element.textContent = payload.totals.created
            ? `Tasked ${payload.totals.created}`
            : `Skipped ${payload.totals.skipped}`;
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
  function bindVibeCoderGuideActions(container) {
    container.querySelectorAll("[data-vibe-coder-guide-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copied";
          await copyText(buildVibeCoderOperatingGuideMarkdown());
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
  function bindCliBridgeContextActions(container) {
    container.querySelectorAll("[data-cli-bridge-context-runner]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runner = element.dataset.cliBridgeContextRunner || "all";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const payload = await api.fetchCliBridgeContext({ runner, limit: 24 });
          await copyText(payload.markdown);
          element.textContent = payload.bridgeDecision === "ready" ? "Copied Ready" : `Copied ${payload.bridgeDecision}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-cli-bridge-runner-dry-run]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runner = element.dataset.cliBridgeRunnerDryRun || "codex";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Preparing";
          const payload = await api.fetchCliBridgeRunnerDryRun({ runner, limit: 24 });
          await copyText(payload.markdown);
          element.textContent = payload.dryRunDecision === "ready" ? "Copied Ready" : `Copied ${payload.dryRunDecision}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-cli-bridge-handoff-work-order-draft]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const handoffId = element.dataset.cliBridgeHandoffWorkOrderDraft || "";
        const runner = element.dataset.cliBridgeHandoffWorkOrderRunner || "codex";
        if (!handoffId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Drafting";
          const payload = await api.fetchCliBridgeFollowUpWorkOrderDraft(handoffId, { runner, limit: 12 });
          await copyText(payload.markdown);
          element.textContent = payload.draftDecision === "ready" ? "Copied Draft" : `Copied ${payload.draftDecision}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-cli-bridge-handoff-work-order-run]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const handoffId = element.dataset.cliBridgeHandoffWorkOrderRun || "";
        const runner = element.dataset.cliBridgeHandoffWorkOrderRunner || "codex";
        if (!handoffId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Queueing";
          await api.queueCliBridgeFollowUpWorkOrderRun(handoffId, {
            runner,
            status: "queued",
            notes: "Queued from the Governance CLI bridge handoff ledger."
          });
          await renderGovernance();
        } catch (error) {
          element.textContent = originalLabel;
          element.disabled = false;
          alert(getErrorMessage(error));
        }
      };
    });

    container.querySelectorAll("[data-cli-bridge-handoff-ledger-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const status = element.dataset.cliBridgeHandoffLedgerStatus || "all";
        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const payload = await api.fetchCliBridgeHandoffs({ runner: "all", status, limit: 50 });
          await copyText(payload.markdown);
          element.textContent = `Copied ${payload.visible}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-cli-bridge-runner-result-capture]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runner = element.dataset.cliBridgeRunnerResultCapture || "codex";
        const summary = prompt(`Paste a non-secret ${runner} runner result summary. Do not include secrets or raw credential-bearing output.`);
        if (!summary || !summary.trim()) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Recording";
          await api.createCliBridgeRunnerResult({
            runner,
            status: "needs-review",
            summary: summary.trim(),
            handoffRecommendation: "workspace-audit",
            nextAction: "Review this manually recorded runner result before accepting or escalating it.",
            notes: "Recorded from the Governance CLI bridge handoff ledger."
          });
          await renderGovernance();
        } catch (error) {
          element.textContent = originalLabel;
          element.disabled = false;
          alert(getErrorMessage(error));
        }
      };
    });

    container.querySelectorAll("[data-cli-bridge-handoff-review]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const action = element.dataset.cliBridgeHandoffReview || "needs-review";
        const handoffId = element.dataset.cliBridgeHandoffId || "";
        if (!handoffId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = action === "accept" ? "Accepting" : action === "reject" ? "Rejecting" : "Escalating";
          await api.reviewCliBridgeHandoff(handoffId, {
            action,
            createTask: action === "escalate",
            note: `Operator selected ${action} from the Governance CLI bridge handoff ledger.`
          });
          await renderGovernance();
        } catch (error) {
          element.textContent = originalLabel;
          element.disabled = false;
          alert(getErrorMessage(error));
        }
      };
    });
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
      `Source-access task checkpoints: ${sourceSummary.checkpointUnresolved || governanceCache?.summary.sourceAccessCheckpointUnresolvedCount || 0} unresolved / ${sourceSummary.checkpointCount || governanceCache?.summary.sourceAccessCheckpointCount || 0} total`,
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
    const workflowTasks = tasks.filter((task) => task.sourceAccessValidationWorkflowId);
    const filters = getGovernanceFilterState();
    const lines = [
      "# Governance Data Sources Access Task Ledger",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Visible tasks: ${tasks.length}`,
      `Visible validation workflow tasks: ${workflowTasks.length}`,
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
      if (task.sourceAccessValidationWorkflowId) {
        lines.push(`  Workflow id: ${task.sourceAccessValidationWorkflowId}`);
        lines.push(`  Workflow stage: ${task.workflowStage || "validation"} / ${task.workflowStatus || "pending"}`);
      }
      if (task.description) {
        lines.push(`  Detail: ${String(task.description).split("\n")[0]}`);
      }
    }

    return lines.join("\n");
  }

  function buildGovernanceReleaseTaskLedgerMarkdown() {
    const governance = getFilteredGovernance();
    const tasks = governance?.releaseControlTasks || [];
    const filters = getGovernanceFilterState();
    const lines = [
      "# Governance Release Control Task Ledger",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Visible tasks: ${tasks.length}`,
      `Open tasks: ${governanceCache?.summary.releaseControlOpenTaskCount ?? 0}`,
      `Total tasks: ${governanceCache?.summary.releaseControlTaskCount ?? 0}`,
      `Scope filter: ${filters.scope}`,
      `Search filter: ${filters.search || "none"}`,
      "",
      "Secret policy: Resolve credentials, private keys, certificates, cookies, and browser sessions outside this app. This handoff stores only non-secret release-control task metadata.",
      "",
      "## Visible Tasks"
    ];

    if (!tasks.length) {
      lines.push("- No visible Release Control tasks matched the current Governance filters.");
      return lines.join("\n");
    }

    for (const task of tasks) {
      lines.push(`- ${task.title || "Release Control task"} [${task.priority || "normal"} / ${task.status || "open"}]`);
      lines.push(`  Release action: ${task.releaseBuildGateActionId || "release-control"}`);
      lines.push(`  Gate decision: ${task.releaseBuildGateDecision || "review"} / risk ${task.releaseBuildGateRiskScore || 0}`);
      if (task.releaseBuildGateCommandHint) {
        lines.push(`  Command hint: ${task.releaseBuildGateCommandHint}`);
      }
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
  function bindSlaLedgerItemActions(container) {
    container.querySelectorAll("[data-agent-execution-sla-ledger-item-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const itemId = element.dataset.agentExecutionSlaLedgerItemId || "";
        const decision = element.dataset.agentExecutionSlaLedgerItemDecision || "";
        if (!itemId || !decision) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Updating";
          element.textContent = await createAgentExecutionSlaLedgerItemCheckpoint(itemId, decision);
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

    container.querySelectorAll("[data-source-access-task-ledger-snapshot-drift-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.sourceAccessTaskLedgerSnapshotDriftId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Diffing";
          const diff = await api.fetchSourcesAccessTaskLedgerSnapshotDiff(snapshotId);
          await copyText(diff.markdown);
          element.textContent = diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : "No Drift";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-source-access-task-ledger-snapshot-drift-task-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.sourceAccessTaskLedgerSnapshotDriftTaskId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          await createDataSourcesAccessTaskLedgerDriftReviewTask(snapshotId);
          element.textContent = "Tracked";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-source-access-task-ledger-snapshot-drift-accept-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.sourceAccessTaskLedgerSnapshotDriftAcceptId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Accepting";
          await acceptDataSourcesAccessTaskLedgerSnapshotDrift(snapshotId);
          element.textContent = "Accepted";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-source-access-task-ledger-drift-item-field]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const field = element.dataset.sourceAccessTaskLedgerDriftItemField || "";
        const decision = element.dataset.sourceAccessTaskLedgerDriftItemDecision || "";
        if (!field || !decision) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Updating";
          element.textContent = await updateDataSourcesAccessTaskLedgerDriftItemCheckpoint(field, decision);
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-source-validation-workflow-task-ledger-drift-item-field]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const field = element.dataset.sourceValidationWorkflowTaskLedgerDriftItemField || "";
        const decision = element.dataset.sourceValidationWorkflowTaskLedgerDriftItemDecision || "";
        if (!field || !decision) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Updating";
          element.textContent = await updateDataSourcesAccessValidationWorkflowTaskLedgerDriftItemCheckpoint(field, decision);
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
  function bindGovernanceTaskUpdateLedgerActions(container) {
    container.querySelectorAll("[data-governance-task-update-ledger-checkpoint-action]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const operationId = element.dataset.governanceTaskUpdateLedgerOperationId || "";
        const action = element.dataset.governanceTaskUpdateLedgerCheckpointAction || "";
        if (!operationId || !action) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Updating";
          element.textContent = await createGovernanceTaskUpdateLedgerItemCheckpoint(operationId, action);
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-governance-task-update-ledger-drift-item-field]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const field = element.dataset.governanceTaskUpdateLedgerDriftItemField || "";
        const decision = element.dataset.governanceTaskUpdateLedgerDriftItemDecision || "";
        if (!field || !decision) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Updating";
          element.textContent = await createGovernanceTaskUpdateLedgerDriftItemCheckpoint(field, decision);
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
  function bindGovernanceTaskUpdateLedgerSnapshotActions(container) {
    container.querySelectorAll("[data-governance-task-update-ledger-snapshot-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.governanceTaskUpdateLedgerSnapshotId || "";
        const snapshot = governanceCache?.governanceTaskUpdateLedgerSnapshots?.find((item) => item.id === snapshotId);
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

    container.querySelectorAll("[data-source-access-validation-evidence-snapshot-drift-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.sourceAccessValidationEvidenceSnapshotDriftId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Diffing";
          const diff = await api.fetchSourcesAccessValidationEvidenceSnapshotDiff(snapshotId);
          await copyText(diff.markdown);
          element.textContent = diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : "No Drift";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-source-access-validation-evidence-snapshot-drift-task-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.sourceAccessValidationEvidenceSnapshotDriftTaskId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          await createDataSourcesAccessValidationEvidenceDriftReviewTask(snapshotId);
          element.textContent = "Tracked";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-source-access-validation-evidence-snapshot-drift-accept-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.sourceAccessValidationEvidenceSnapshotDriftAcceptId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Accepting";
          await acceptDataSourcesAccessValidationEvidenceSnapshotDrift(snapshotId);
          element.textContent = "Accepted";
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

    container.querySelectorAll("[data-release-task-ledger-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          await copyGovernanceReleaseTaskLedger();
          element.textContent = "Copied";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-release-task-ledger-snapshot-save]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          await saveReleaseTaskLedgerSnapshot();
          element.textContent = "Saved";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-release-task-ledger-drift-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          await copyLatestReleaseTaskLedgerSnapshotDrift();
          element.textContent = "Copied";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-release-task-ledger-snapshot-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.releaseTaskLedgerSnapshotId || "";
        const snapshot = governanceCache?.releaseTaskLedgerSnapshots?.find((item) => item.id === snapshotId);
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

    container.querySelectorAll("[data-release-task-ledger-snapshot-drift-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.releaseTaskLedgerSnapshotDriftId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Diffing";
          const diff = await api.fetchReleaseTaskLedgerSnapshotDiff(snapshotId);
          await copyText(diff.markdown);
          element.textContent = diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : "No Drift";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-release-task-ledger-snapshot-drift-task-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.releaseTaskLedgerSnapshotDriftTaskId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          await createReleaseTaskLedgerDriftReviewTask(snapshotId);
          element.textContent = "Tracked";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-release-task-ledger-snapshot-drift-accept-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.releaseTaskLedgerSnapshotDriftAcceptId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Accepting";
          await acceptReleaseTaskLedgerSnapshotDrift(snapshotId);
          element.textContent = "Accepted";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-release-task-ledger-drift-item-field]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const field = element.dataset.releaseTaskLedgerDriftItemField || "";
        const decision = element.dataset.releaseTaskLedgerDriftItemDecision || "";
        if (!field || !decision) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Updating";
          element.textContent = await updateReleaseTaskLedgerDriftItemCheckpoint(field, decision);
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

    container.querySelectorAll("[data-release-checkpoint-drift-field]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const field = element.dataset.releaseCheckpointDriftField || "";
        const decision = element.dataset.releaseCheckpointDriftFieldDecision || "";
        if (!field || !decision) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          const label = await createReleaseCheckpointDriftFieldDecision(field, decision);
          element.textContent = label;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-release-checkpoint-drift-field-task]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const field = element.dataset.releaseCheckpointDriftFieldTask || "";
        if (!field) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          const label = await createReleaseCheckpointDriftFieldTask(field);
          element.textContent = label;
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

    container.querySelectorAll("[data-release-build-gate-local-evidence-checkpoint]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const checkpointStatus = element.dataset.releaseBuildGateLocalEvidenceCheckpoint || "";
        if (!checkpointStatus) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          const label = await createReleaseBuildGateLocalEvidenceCheckpoint(checkpointStatus);
          element.textContent = label;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-release-build-gate-local-evidence-task]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          const label = await createReleaseBuildGateLocalEvidenceTask();
          element.textContent = label;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-release-control-checkpoint-decision-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const checkpointId = element.dataset.releaseControlCheckpointDecisionId || "";
        const checkpointDecision = element.dataset.releaseControlCheckpointDecision || "";
        if (!checkpointId || !checkpointDecision) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          const label = await createReleaseControlCheckpointDecision(checkpointId, checkpointDecision);
          element.textContent = label;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-release-control-checkpoint-task-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const checkpointId = element.dataset.releaseControlCheckpointTaskId || "";
        if (!checkpointId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          const label = await createReleaseControlCheckpointTask(checkpointId);
          element.textContent = label;
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

    container.querySelectorAll("[data-release-build-gate-tasks-snapshot]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          await seedReleaseBuildGateActionTasksWithSnapshot();
          element.textContent = "Captured";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-release-build-gate-action-task]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const actionId = element.dataset.releaseBuildGateActionTask || "";
        if (!actionId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          await createReleaseBuildGateActionTask(actionId);
          element.textContent = "Tasked";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-release-build-gate-action-task-snapshot]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const actionId = element.dataset.releaseBuildGateActionTaskSnapshot || "";
        if (!actionId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Capturing";
          await createReleaseBuildGateActionTaskWithSnapshot(actionId);
          element.textContent = "Captured";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-release-build-gate-action-checkpoint]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const actionId = element.dataset.releaseBuildGateActionCheckpoint || "";
        if (!actionId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          await createReleaseBuildGateActionCheckpoint(actionId);
          element.textContent = "Accepted";
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

    container.querySelectorAll("[data-control-plane-decision-tasks]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          await seedAgentControlPlaneDecisionTasks();
          element.textContent = "Created";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-control-plane-decision-tasks-snapshot]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Capturing";
          await seedAgentControlPlaneDecisionTasksWithSnapshot();
          element.textContent = "Captured";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-control-plane-decision-reason-task-snapshot]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const reasonCode = element.dataset.controlPlaneDecisionReasonTaskSnapshot || "";
        if (!reasonCode) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Capturing";
          await createAgentControlPlaneDecisionReasonTaskWithSnapshot(reasonCode);
          element.textContent = "Captured";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-control-plane-decision-task-ledger-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          await copyAgentControlPlaneDecisionTaskLedger();
          element.textContent = "Copied";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-control-plane-decision-task-ledger-snapshot-save]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          await saveAgentControlPlaneDecisionTaskLedgerSnapshot();
          element.textContent = "Saved";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-control-plane-decision-task-ledger-drift-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          await copyLatestAgentControlPlaneDecisionTaskLedgerSnapshotDrift();
          element.textContent = "Copied";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-control-plane-decision-task-ledger-drift-item-field]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const field = element.dataset.controlPlaneDecisionTaskLedgerDriftItemField || "";
        const decision = element.dataset.controlPlaneDecisionTaskLedgerDriftItemDecision || "";
        if (!field || !decision) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Updating";
          element.textContent = await updateAgentControlPlaneDecisionTaskLedgerDriftItemCheckpoint(field, decision);
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-control-plane-decision-task-ledger-snapshot-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.controlPlaneDecisionTaskLedgerSnapshotId || "";
        const snapshot = governanceCache?.agentControlPlaneDecisionTaskLedgerSnapshots?.find((item) => item.id === snapshotId);
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

    container.querySelectorAll("[data-agent-execution-result-task-ledger-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          await copyAgentExecutionResultTaskLedger();
          element.textContent = "Copied";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-agent-execution-result-task-ledger-snapshot-save]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          await saveAgentExecutionResultTaskLedgerSnapshot();
          element.textContent = "Saved";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-agent-execution-result-task-ledger-drift-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          await copyLatestAgentExecutionResultTaskLedgerSnapshotDrift();
          element.textContent = "Copied";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-agent-execution-result-task-ledger-drift-item-field]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const field = element.dataset.agentExecutionResultTaskLedgerDriftItemField || "";
        const decision = element.dataset.agentExecutionResultTaskLedgerDriftItemDecision || "";
        if (!field || !decision) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Updating";
          element.textContent = await updateAgentExecutionResultTaskLedgerDriftItemCheckpoint(field, decision);
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-agent-execution-result-task-ledger-snapshot-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.agentExecutionResultTaskLedgerSnapshotId || "";
        const snapshot = governanceCache?.agentExecutionResultTaskLedgerSnapshots?.find((item) => item.id === snapshotId);
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

    container.querySelectorAll("[data-agent-execution-result-task-ledger-snapshot-drift-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.agentExecutionResultTaskLedgerSnapshotDriftId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Diffing";
          const diff = await api.fetchAgentExecutionResultTaskLedgerSnapshotDiff(snapshotId);
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

    container.querySelectorAll("[data-agent-execution-result-task-ledger-snapshot-drift-task-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.agentExecutionResultTaskLedgerSnapshotDriftTaskId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          await createAgentExecutionResultTaskLedgerDriftReviewTask(snapshotId);
          element.textContent = "Tracked";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-agent-execution-result-task-ledger-snapshot-drift-accept-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.agentExecutionResultTaskLedgerSnapshotDriftAcceptId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Accepting";
          await acceptAgentExecutionResultTaskLedgerSnapshotDrift(snapshotId);
          element.textContent = "Accepted";
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

    container.querySelectorAll("[data-control-plane-snapshot-drift-task-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.controlPlaneSnapshotDriftTaskId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          await createAgentControlPlaneDriftReviewTask(snapshotId);
          element.textContent = "Tracked";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-control-plane-snapshot-drift-accept-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.controlPlaneSnapshotDriftAcceptId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Accepting";
          await acceptAgentControlPlaneSnapshotDrift(snapshotId);
          element.textContent = "Accepted";
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
   * @param {string | undefined} value
   */
  function parseDatasetList(value) {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item || "").trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  /**
   * @param {HTMLElement} container
   */
  function bindAgentPolicyCheckpointActions(container) {
    container.querySelectorAll("[data-agent-policy-checkpoint-status]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const policyId = element.dataset.agentPolicyId || "";
        const projectId = decodeURIComponent(element.dataset.agentPolicyProjectId || "");
        const status = element.dataset.agentPolicyCheckpointStatus || "needs-review";
        if (!policyId || !projectId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          await api.createAgentPolicyCheckpoint({
            policyId,
            projectId,
            projectName: element.dataset.agentPolicyProjectName || "",
            relPath: element.dataset.agentPolicyRelPath || "",
            status,
            role: element.dataset.agentPolicyRole || "readiness-reviewer",
            runtime: element.dataset.agentPolicyRuntime || "planning-only-agent",
            isolationMode: element.dataset.agentPolicyIsolationMode || "read-only-planning",
            skillBundle: parseDatasetList(element.dataset.agentPolicySkillBundle),
            hookPolicy: parseDatasetList(element.dataset.agentPolicyHookPolicy),
            source: "agent-control-plane",
            reason: `Operator marked generated managed-agent policy as ${status} before queueing.`,
            note: "Checkpoint recorded from the Governance Agent Readiness Matrix."
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
  function bindAgentExecutionResultCheckpointActions(container) {
    container.querySelectorAll("[data-agent-execution-result-checkpoint-status]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runId = element.dataset.agentExecutionResultCheckpointRunId || "";
        const targetAction = element.dataset.agentExecutionResultCheckpointTargetAction || "baseline-refresh";
        const status = element.dataset.agentExecutionResultCheckpointStatus || "needs-review";
        if (!runId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          await api.createAgentExecutionResultCheckpoint({
            runId,
            targetAction,
            status,
            source: "governance-execution-queue",
            reason: `Operator marked execution result ${targetAction} gate as ${status}.`,
            note: "Checkpoint recorded from the Governance Agent Execution Queue."
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

    container.querySelectorAll("[data-cli-bridge-runner-contract-run-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runId = element.dataset.cliBridgeRunnerContractRunId || "";
        const runner = element.dataset.cliBridgeRunnerContractRunner || "codex";
        if (!runId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Preparing";
          const payload = await api.fetchCliBridgeRunnerDryRun({ runner, runId, limit: 12 });
          await copyText(payload.markdown);
          element.textContent = payload.dryRunDecision === "ready" ? "Copied Ready" : `Copied ${payload.dryRunDecision}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-cli-bridge-run-trace-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runId = element.dataset.cliBridgeRunTraceId || "";
        if (!runId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Tracing";
          const payload = await api.fetchCliBridgeRunTrace(runId);
          await copyText(payload.markdown);
          element.textContent = payload.traceDecision === "ready" ? "Copied Trace" : `Copied ${payload.traceDecision}`;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-cli-bridge-run-trace-snapshot-run-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runId = element.dataset.cliBridgeRunTraceSnapshotRunId || "";
        if (!runId) return;
        const run = governanceCache?.agentWorkOrderRuns.find((item) => item.id === runId);

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          await api.createCliBridgeRunTraceSnapshot(runId, {
            title: `CLI bridge run trace: ${run?.title || runId}`
          });
          await renderGovernance();
        } catch (error) {
          element.textContent = originalLabel;
          element.disabled = false;
          alert(getErrorMessage(error));
        }
      };
    });

    container.querySelectorAll("[data-cli-bridge-run-trace-snapshot-copy-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.cliBridgeRunTraceSnapshotCopyId || "";
        const snapshot = governanceCache?.cliBridgeRunTraceSnapshots?.find((item) => item.id === snapshotId);
        if (!snapshot) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copied";
          await copyText(snapshot.markdown || snapshot.trace?.markdown || "");
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-cli-bridge-run-trace-snapshot-diff-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const diff = governanceCache?.cliBridgeRunTraceSnapshotDiff;
        if (!diff) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copied";
          await copyText(diff.markdown || "");
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-cli-bridge-run-trace-baseline-status-copy]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Copying";
          const status = await api.fetchCliBridgeRunTraceSnapshotBaselineStatus();
          await copyText(status.markdown || "");
          element.textContent = status.hasBaseline ? `Copied ${status.health || "status"}` : "No Baseline";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-cli-bridge-run-trace-snapshot-drift-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.cliBridgeRunTraceSnapshotDriftId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Diffing";
          const diff = await api.fetchCliBridgeRunTraceSnapshotDiff(snapshotId);
          await copyText(diff.markdown || "");
          element.textContent = diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : "No Drift";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-cli-bridge-run-trace-snapshot-drift-task-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.cliBridgeRunTraceSnapshotDriftTaskId || "latest";

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          await createCliBridgeRunTraceSnapshotDriftReviewTask(snapshotId);
          element.textContent = "Tracked";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-cli-bridge-run-trace-snapshot-drift-accept-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.cliBridgeRunTraceSnapshotDriftAcceptId || "latest";

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Accepting";
          await acceptCliBridgeRunTraceSnapshotDrift(snapshotId);
          element.textContent = "Accepted";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-cli-bridge-run-trace-snapshot-drift-item-field]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const field = element.dataset.cliBridgeRunTraceSnapshotDriftItemField || "";
        const decision = element.dataset.cliBridgeRunTraceSnapshotDriftItemDecision || "confirmed";
        if (!field) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Saving";
          const label = await updateCliBridgeRunTraceSnapshotDriftItemCheckpoint(field, decision);
          element.textContent = label;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-cli-bridge-runner-result-run-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const runId = element.dataset.cliBridgeRunnerResultRunId || "";
        const runner = element.dataset.cliBridgeRunnerResultRunner || "codex";
        const run = governanceCache?.agentWorkOrderRuns.find((item) => item.id === runId);
        if (!run) return;
        const summary = prompt(`Paste a non-secret ${runner} runner result summary for ${run.title}. Do not include secrets or raw credential-bearing output.`);
        if (!summary || !summary.trim()) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Recording";
          await api.createCliBridgeRunnerResult({
            runner,
            workOrderRunId: run.id,
            projectId: run.projectId,
            projectName: run.projectName,
            status: "needs-review",
            title: `${runner} result for ${run.title}`,
            summary: summary.trim(),
            handoffRecommendation: "workspace-audit",
            nextAction: "Review this run-tied CLI result before accepting or queueing another follow-up work order.",
            notes: "Recorded from the Agent Execution Queue CLI bridge run card."
          });
          await renderGovernance();
        } catch (error) {
          element.textContent = originalLabel;
          element.disabled = false;
          alert(getErrorMessage(error));
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
            agentPolicyId: item.agentPolicy?.policyId || "",
            agentPolicyCheckpointId: item.agentPolicy?.checkpointId || "",
            agentPolicyCheckpointStatus: item.agentPolicy?.checkpointStatus || "needs-review",
            agentRole: item.agentPolicy?.role || "",
            runtime: item.agentPolicy?.runtime || "",
            isolationMode: item.agentPolicy?.isolationMode || "",
            skillBundle: item.agentPolicy?.skillBundle || [],
            hookPolicy: item.agentPolicy?.hookPolicy || [],
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
    const taskSeedingStatusSelect = document.getElementById("governance-task-seeding-status");
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
    taskSeedingStatusSelect?.addEventListener("change", handler);
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
    governance.convergenceTaskLedgerDriftCheckpointFilter = convergenceTaskLedgerDriftCheckpointFilter;
    container.replaceChildren(
      createGovernanceSummaryGrid(governanceCache),
      createGovernanceDeck(governance)
    );
    bindAppLaunchers(container, openModal);
    bindGovernanceQuickActions(container);
    bindVibeCoderGuideActions(container);
    bindCliBridgeContextActions(container);
    bindWorkOrderSnapshotActions(container);
    bindSlaLedgerSnapshotActions(container);
    bindSlaLedgerItemActions(container);
    bindGovernanceTaskUpdateLedgerActions(container);
    bindGovernanceTaskUpdateLedgerSnapshotActions(container);
    bindDataSourcesAccessTaskLedgerSnapshotActions(container);
    bindDataSourcesAccessValidationEvidenceSnapshotActions(container);
    bindDataSourcesAccessValidationWorkflowSnapshotActions(container, governanceCache?.dataSourceAccessValidationWorkflowSnapshots || []);
    bindSourceAccessReviewTaskSnapshotActions(container, "governance");
    bindSourceEvidenceCoverageTaskSnapshotActions(container, "governance");
    bindSourceValidationWorkflowTaskSnapshotActions(container, "governance");
    bindSourceAccessValidationRunbookTaskActions(container);
    bindReleaseControlActions(container);
    bindControlPlaneSnapshotActions(container);
    bindAgentPolicyCheckpointActions(container);
    bindAgentExecutionResultCheckpointActions(container);
    bindAgentWorkOrderRunActions(container);
    bindConvergenceReviewLedgerActions(container);
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
      `Convergence review ledger candidates: ${governanceCache?.convergenceCandidates?.summary.total ?? 0}`,
      `Operator convergence proposal queue: ${governanceCache?.convergenceOperatorProposalQueue?.summary.active ?? 0} active / ${governanceCache?.convergenceOperatorProposalQueue?.summary.total ?? 0} total`,
      `Convergence hidden Not Related pairs: ${governanceCache?.convergenceCandidates?.summary.notRelated ?? 0}`,
      `Convergence review tasks: ${governanceCache?.summary.convergenceOpenTaskCount ?? 0} open / ${governanceCache?.summary.convergenceTaskCount ?? 0} total`,
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
      `Release Control tasks: ${governanceCache?.summary.releaseControlOpenTaskCount ?? 0} open / ${governanceCache?.summary.releaseControlTaskCount ?? 0} total`,
      `Release Control task ledger snapshots: ${governanceCache?.summary.releaseTaskLedgerSnapshotCount ?? 0}`,
      `Control Plane decision tasks: ${governanceCache?.summary.agentControlPlaneDecisionOpenTaskCount ?? 0} open / ${governanceCache?.summary.agentControlPlaneDecisionTaskCount ?? 0} total`,
      `Control plane decision action: ${governanceCache?.agentControlPlaneDecision?.recommendedAction || "Review the Agent Control Plane before the next supervised build."}`,
      `Control plane decision reasons: ${governanceCache?.agentControlPlaneDecision?.reasons?.length ? governanceCache.agentControlPlaneDecision.reasons.map((reason) => reason.code || reason.message).join(", ") : "none"}`,
      `Data Sources access gate: ${governanceCache?.dataSourcesAccessGate?.decision || governanceCache?.summary.dataSourcesAccessGateDecision || "not-evaluated"}`,
      `Data Sources access gate action: ${governanceCache?.dataSourcesAccessGate?.recommendedAction || "Evaluate Data Sources access before ingestion."}`,
      `Data Sources access ready/review/blocked: ${governanceCache?.dataSourcesAccessGate?.ready ?? governanceCache?.summary.dataSourcesAccessReadyCount ?? 0}/${governanceCache?.dataSourcesAccessGate?.review ?? governanceCache?.summary.dataSourcesAccessReviewCount ?? 0}/${governanceCache?.dataSourcesAccessGate?.blocked ?? governanceCache?.summary.dataSourcesAccessBlockedCount ?? 0}`,
      `Data Sources access review queue: ${governanceCache?.dataSourcesAccessReviewQueue?.summary?.total ?? governanceCache?.summary.dataSourcesAccessReviewQueueCount ?? 0}`,
      `Data Sources access review priority: ${governanceCache?.dataSourcesAccessReviewQueue?.summary?.high ?? 0} high | ${governanceCache?.dataSourcesAccessReviewQueue?.summary?.medium ?? 0} medium | ${governanceCache?.dataSourcesAccessReviewQueue?.summary?.blocked ?? 0} blocked`,
      `Source-access task checkpoints: ${governanceCache?.summary.sourceAccessCheckpointUnresolvedCount ?? 0} unresolved / ${governanceCache?.summary.sourceAccessCheckpointCount ?? 0} total`,
      `Data Sources access validation runbook: ${governanceCache?.summary.dataSourcesAccessValidationMethodCount ?? 0} method(s) across ${governanceCache?.summary.dataSourcesAccessValidationSourceCount ?? 0} source(s)`,
      `Data Sources access validation review/blocked: ${governanceCache?.summary.dataSourcesAccessValidationReviewCount ?? 0}/${governanceCache?.summary.dataSourcesAccessValidationBlockedCount ?? 0}`,
      `Data Sources access validation workflow: ${governanceCache?.summary.dataSourcesAccessValidationWorkflowReadyCount ?? 0} ready / ${governanceCache?.summary.dataSourcesAccessValidationWorkflowPendingCount ?? 0} pending / ${governanceCache?.summary.dataSourcesAccessValidationWorkflowBlockedCount ?? 0} blocked`,
      `Data Sources access validation workflow snapshots: ${governanceCache?.summary.dataSourceAccessValidationWorkflowSnapshotCount ?? 0}`,
      `Data Sources access validation workflow snapshot drift: ${governanceCache?.summary.dataSourceAccessValidationWorkflowSnapshotDriftSeverity || "missing-snapshot"} / score ${governanceCache?.summary.dataSourceAccessValidationWorkflowSnapshotDriftScore ?? 0}`,
      `Data Sources access validation evidence: ${governanceCache?.summary.dataSourcesAccessValidationEvidenceValidatedCount ?? 0} validated / ${governanceCache?.summary.dataSourcesAccessValidationEvidenceCount ?? 0} total`,
      `Data Sources access validation evidence review/blocked: ${governanceCache?.summary.dataSourcesAccessValidationEvidenceReviewCount ?? 0}/${governanceCache?.summary.dataSourcesAccessValidationEvidenceBlockedCount ?? 0}`,
      `Data Sources access validation evidence coverage: ${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoverageCoveredCount ?? 0}/${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoverageCount ?? 0} covered (${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoveragePercent ?? 0}%)`,
      `Data Sources access validation evidence coverage gaps: ${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoverageMissingCount ?? 0} missing | ${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoverageHighPriorityCount ?? 0} high priority`,
      `Data Sources access validation evidence snapshots: ${governanceCache?.summary.dataSourceAccessValidationEvidenceSnapshotCount ?? 0}`,
      `Data Sources access validation evidence snapshot drift: ${governanceCache?.summary.dataSourceAccessValidationEvidenceSnapshotDriftSeverity || "missing-snapshot"} / score ${governanceCache?.summary.dataSourceAccessValidationEvidenceSnapshotDriftScore ?? 0}`,
      `Data Sources access tasks: ${governanceCache?.summary.dataSourcesAccessOpenTaskCount ?? 0} open / ${governanceCache?.summary.dataSourcesAccessTaskCount ?? 0} total`,
      `Data Sources access task ledger snapshots: ${governanceCache?.summary.dataSourceAccessTaskLedgerSnapshotCount ?? 0}`,
      `Agent-ready projects: ${governanceCache?.summary.agentReadyProjects ?? 0}/${governanceCache?.summary.agentReadinessItems ?? 0}`,
      `Agent policy checkpoints: ${governanceCache?.summary.agentPolicyCheckpointUnresolvedCount ?? 0} unresolved / ${governanceCache?.summary.agentPolicyCheckpointCount ?? 0} total`,
      `Agent policy executable work orders: ${governanceCache?.summary.agentPolicyExecutableCount ?? 0}/${governanceCache?.summary.agentReadinessItems ?? 0}`,
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
      `Visible convergence review ledger candidates: ${governance.convergenceCandidates?.candidates?.length || 0}`,
      `Visible operator convergence proposal queue items: ${governance.convergenceOperatorProposalQueue?.items?.length || 0}`,
      `Visible convergence review tasks: ${governance.convergenceTasks?.length || 0}`,
      `Visible task update audit rows: ${governance.governanceTaskUpdateLedger?.items?.length || 0}`,
      `Visible task update audit snapshot drift: ${governance.governanceTaskUpdateLedgerSnapshotDiff ? "yes" : "no"}`,
      `Visible workflow runbook items: ${governance.workflowRunbook.length}`,
      `Visible agent sessions: ${governance.agentSessions.length}`,
      `Visible control plane baseline status: ${governance.agentControlPlaneBaselineStatus ? "yes" : "no"}`,
      `Visible control plane decision: ${governance.agentControlPlaneDecision ? "yes" : "no"}`,
      `Visible Control Plane decision tasks: ${governance.agentControlPlaneDecisionTasks?.length || 0}`,
      `Visible Release Control tasks: ${governance.releaseControlTasks?.length || 0}`,
      `Visible Release Control task ledger snapshots: ${(governance.releaseTaskLedgerSnapshots || []).length}`,
      `Visible Data Sources access gate: ${governance.dataSourcesAccessGate ? "yes" : "no"}`,
      `Visible Data Sources access review queue items: ${governance.dataSourcesAccessReviewQueue?.items?.length || 0}`,
      `Visible Data Sources access validation runbook methods: ${governance.dataSourcesAccessValidationRunbook?.methods?.length || 0}`,
      `Visible Data Sources access validation workflow items: ${governance.dataSourcesAccessValidationWorkflow?.items?.length || 0}`,
      `Visible Data Sources access validation workflow snapshots: ${(governance.dataSourceAccessValidationWorkflowSnapshots || []).length}`,
      `Visible Data Sources access validation workflow snapshot drift: ${governance.dataSourceAccessValidationWorkflowSnapshotDiff ? "yes" : "no"}`,
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
      `Visible CLI bridge run trace snapshots: ${(governance.cliBridgeRunTraceSnapshots || []).length}`,
      `Visible CLI bridge run trace baseline status: ${governance.cliBridgeRunTraceSnapshotBaselineStatus ? "yes" : "no"}`,
      `Visible CLI bridge run trace snapshot drift items: ${(governance.cliBridgeRunTraceSnapshotDiff?.driftItems || []).length}`,
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
      `- Convergence review ledger candidates: ${governanceCache?.convergenceCandidates?.summary.total ?? 0}`,
      `- Operator convergence proposal queue: ${governanceCache?.convergenceOperatorProposalQueue?.summary.active ?? 0} active / ${governanceCache?.convergenceOperatorProposalQueue?.summary.total ?? 0} total`,
      `- Convergence review tasks: ${governanceCache?.summary.convergenceOpenTaskCount ?? 0} open / ${governanceCache?.summary.convergenceTaskCount ?? 0} total`,
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
      `- Release Control tasks: ${governanceCache?.summary.releaseControlOpenTaskCount ?? 0} open / ${governanceCache?.summary.releaseControlTaskCount ?? 0} total`,
      `- Release Control task ledger snapshots: ${governanceCache?.summary.releaseTaskLedgerSnapshotCount ?? 0}`,
      `- Control Plane decision tasks: ${governanceCache?.summary.agentControlPlaneDecisionOpenTaskCount ?? 0} open / ${governanceCache?.summary.agentControlPlaneDecisionTaskCount ?? 0} total`,
      `- Control plane decision action: ${governanceCache?.agentControlPlaneDecision?.recommendedAction || "Review the Agent Control Plane before the next supervised build."}`,
      `- Control plane decision reasons: ${governanceCache?.agentControlPlaneDecision?.reasons?.length ? governanceCache.agentControlPlaneDecision.reasons.map((reason) => reason.code || reason.message).join(", ") : "none"}`,
      `- Data Sources access gate: ${governanceCache?.dataSourcesAccessGate?.decision || governanceCache?.summary.dataSourcesAccessGateDecision || "not-evaluated"}`,
      `- Data Sources access gate action: ${governanceCache?.dataSourcesAccessGate?.recommendedAction || "Evaluate Data Sources access before ingestion."}`,
      `- Data Sources access ready/review/blocked: ${governanceCache?.dataSourcesAccessGate?.ready ?? governanceCache?.summary.dataSourcesAccessReadyCount ?? 0}/${governanceCache?.dataSourcesAccessGate?.review ?? governanceCache?.summary.dataSourcesAccessReviewCount ?? 0}/${governanceCache?.dataSourcesAccessGate?.blocked ?? governanceCache?.summary.dataSourcesAccessBlockedCount ?? 0}`,
      `- Data Sources access review queue: ${governanceCache?.dataSourcesAccessReviewQueue?.summary?.total ?? governanceCache?.summary.dataSourcesAccessReviewQueueCount ?? 0}`,
      `- Data Sources access review priority: ${governanceCache?.dataSourcesAccessReviewQueue?.summary?.high ?? 0} high | ${governanceCache?.dataSourcesAccessReviewQueue?.summary?.medium ?? 0} medium | ${governanceCache?.dataSourcesAccessReviewQueue?.summary?.blocked ?? 0} blocked`,
      `- Source-access task checkpoints: ${governanceCache?.summary.sourceAccessCheckpointUnresolvedCount ?? 0} unresolved / ${governanceCache?.summary.sourceAccessCheckpointCount ?? 0} total`,
      `- Data Sources access validation runbook: ${governanceCache?.summary.dataSourcesAccessValidationMethodCount ?? 0} method(s) across ${governanceCache?.summary.dataSourcesAccessValidationSourceCount ?? 0} source(s)`,
      `- Data Sources access validation review/blocked: ${governanceCache?.summary.dataSourcesAccessValidationReviewCount ?? 0}/${governanceCache?.summary.dataSourcesAccessValidationBlockedCount ?? 0}`,
      `- Data Sources access validation evidence: ${governanceCache?.summary.dataSourcesAccessValidationEvidenceValidatedCount ?? 0} validated / ${governanceCache?.summary.dataSourcesAccessValidationEvidenceCount ?? 0} total`,
      `- Data Sources access validation evidence review/blocked: ${governanceCache?.summary.dataSourcesAccessValidationEvidenceReviewCount ?? 0}/${governanceCache?.summary.dataSourcesAccessValidationEvidenceBlockedCount ?? 0}`,
      `- Data Sources access validation evidence coverage: ${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoverageCoveredCount ?? 0}/${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoverageCount ?? 0} covered (${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoveragePercent ?? 0}%)`,
      `- Data Sources access validation evidence coverage gaps: ${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoverageMissingCount ?? 0} missing | ${governanceCache?.summary.dataSourcesAccessValidationEvidenceCoverageHighPriorityCount ?? 0} high priority`,
      `- Data Sources access tasks: ${governanceCache?.summary.dataSourcesAccessOpenTaskCount ?? 0} open / ${governanceCache?.summary.dataSourcesAccessTaskCount ?? 0} total`,
      `- Agent-ready projects: ${governanceCache?.summary.agentReadyProjects ?? 0}/${governanceCache?.summary.agentReadinessItems ?? 0}`,
      `- Agent policy checkpoints: ${governanceCache?.summary.agentPolicyCheckpointUnresolvedCount ?? 0} unresolved / ${governanceCache?.summary.agentPolicyCheckpointCount ?? 0} total`,
      `- Agent policy executable work orders: ${governanceCache?.summary.agentPolicyExecutableCount ?? 0}/${governanceCache?.summary.agentReadinessItems ?? 0}`,
      `- Work order snapshots: ${governanceCache?.summary.agentWorkOrderSnapshotCount ?? 0}`,
      `- SLA ledger snapshots: ${governanceCache?.summary.agentExecutionSlaLedgerSnapshotCount ?? 0}`,
      `- CLI bridge run trace snapshots: ${governanceCache?.summary.cliBridgeRunTraceSnapshotCount ?? 0}`,
      `- CLI bridge run trace baseline: ${governanceCache?.cliBridgeRunTraceSnapshotBaselineStatus?.health || "missing"} | ${governanceCache?.cliBridgeRunTraceSnapshotBaselineStatus?.freshness || "missing"} | drift ${governanceCache?.cliBridgeRunTraceSnapshotBaselineStatus?.driftScore ?? 0}`,
      `- CLI bridge run trace snapshot drift: ${governanceCache?.cliBridgeRunTraceSnapshotDiff?.driftSeverity || "missing-snapshot"} (${governanceCache?.cliBridgeRunTraceSnapshotDiff?.driftScore ?? 0})`,
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
      lines.push(`- Release Control tasks: ${governance.agentControlPlaneDecision.releaseControlOpenTaskCount || 0} open / ${governance.agentControlPlaneDecision.releaseControlTaskCount || 0} total`);
      lines.push(`- Control Plane decision tasks: ${governance.agentControlPlaneDecision.agentControlPlaneDecisionOpenTaskCount || 0} open / ${governance.agentControlPlaneDecision.agentControlPlaneDecisionTaskCount || 0} total`);
      lines.push(`- Active runs: ${governance.agentControlPlaneDecision.activeRuns || 0}, stale active: ${governance.agentControlPlaneDecision.staleActiveRuns || 0}, SLA breached: ${governance.agentControlPlaneDecision.slaBreachedRuns || 0}`);
      lines.push(`- Source-access task checkpoints: ${governance.agentControlPlaneDecision.sourceAccessCheckpointUnresolvedCount || 0} unresolved / ${governance.agentControlPlaneDecision.sourceAccessCheckpointCount || 0} total`);
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

    lines.push("", "## Control Plane Decision Task Ledger");
    if (governance.agentControlPlaneDecisionTasks?.length) {
      for (const task of governance.agentControlPlaneDecisionTasks) {
        lines.push(`- ${task.title || "Control Plane decision task"}: ${task.status || "open"} / ${task.priority || "normal"}`);
        lines.push(`  Reason: ${task.agentControlPlaneDecisionReasonCode || "control-plane-decision"}`);
        lines.push(`  Decision: ${task.agentControlPlaneDecision || "review"}`);
        if (task.agentControlPlaneCommandHint) {
          lines.push(`  Command hint: ${task.agentControlPlaneCommandHint}`);
        }
        if (task.description) {
          lines.push(`  Detail: ${String(task.description).split("\n")[0]}`);
        }
      }
    } else {
      lines.push("- No visible Control Plane decision tasks.");
    }

    lines.push("", "## Release Control Task Ledger");
    if (governance.releaseControlTasks?.length) {
      for (const task of governance.releaseControlTasks) {
        lines.push(`- ${task.title || "Release Control task"}: ${task.status || "open"} / ${task.priority || "normal"}`);
        lines.push(`  Release action: ${task.releaseBuildGateActionId || "release-control"}`);
        lines.push(`  Gate decision: ${task.releaseBuildGateDecision || "review"} / risk ${task.releaseBuildGateRiskScore || 0}`);
        if (task.releaseBuildGateCommandHint) {
          lines.push(`  Command hint: ${task.releaseBuildGateCommandHint}`);
        }
        if (task.description) {
          lines.push(`  Detail: ${String(task.description).split("\n")[0]}`);
        }
      }
    } else {
      lines.push("- No visible Release Control tasks.");
    }

    lines.push("", "## Release Control Task Ledger Snapshots");
    if (governance.releaseTaskLedgerSnapshots?.length) {
      for (const snapshot of governance.releaseTaskLedgerSnapshots) {
        lines.push(`- ${snapshot.title || "Release Control Task Ledger"}: ${snapshot.openCount || 0} open / ${snapshot.total || 0} total at ${snapshot.createdAt || "not recorded"}`);
        lines.push(`  Status filter: ${snapshot.statusFilter || "all"} | Visible tasks: ${snapshot.visibleCount || 0}`);
      }
    } else {
      lines.push("- No visible Release Control task ledger snapshots.");
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

    lines.push("", "## Data Sources Access Validation Workflow");
    if (governance.dataSourcesAccessValidationWorkflow?.items?.length) {
      for (const item of governance.dataSourcesAccessValidationWorkflow.items) {
        lines.push(`- ${item.label || item.sourceId || "Source"}: ${item.status || "pending"} / ${item.stage || "external-access-review"} [${item.priority || "medium"}]`);
        lines.push(`  Access method: ${item.accessMethod || "review-required"}`);
        lines.push(`  Evidence: ${item.latestEvidenceStatus || "missing"} / ${item.coverageStatus || "missing"}`);
        lines.push(`  Action: ${item.action || "Review source access outside this app."}`);
      }
    } else {
      lines.push("- No visible Data Sources access validation workflow items.");
    }

    lines.push("", "## Data Sources Access Validation Workflow Snapshots");
    if ((governance.dataSourceAccessValidationWorkflowSnapshots || []).length) {
      for (const snapshot of governance.dataSourceAccessValidationWorkflowSnapshots) {
        lines.push(`- ${snapshot.title}: ${snapshot.readyCount || 0} ready / ${snapshot.pendingCount || 0} pending / ${snapshot.blockedCount || 0} blocked`);
        lines.push(`  Created: ${new Date(snapshot.createdAt).toLocaleString()}`);
      }
    } else {
      lines.push("- No visible Data Sources access validation workflow snapshots.");
    }

    lines.push("", "## Data Sources Access Validation Workflow Snapshot Drift");
    if (governance.dataSourceAccessValidationWorkflowSnapshotDiff) {
      const diff = governance.dataSourceAccessValidationWorkflowSnapshotDiff;
      lines.push(`- Snapshot: ${diff.snapshotTitle || "missing"}`);
      lines.push(`- Drift severity: ${diff.driftSeverity || "missing-snapshot"}`);
      lines.push(`- Drift score: ${diff.driftScore || 0}`);
      lines.push(`- Recommended action: ${diff.recommendedAction || "Save a source-access validation workflow snapshot before comparing drift."}`);
    } else {
      lines.push("- No visible Data Sources access validation workflow snapshot drift.");
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

    lines.push("", "## Data Sources Access Validation Workflow Tasks");
    const dataSourcesAccessValidationWorkflowTasks = (governance.dataSourcesAccessTasks || []).filter((task) => task.sourceAccessValidationWorkflowId);
    if (dataSourcesAccessValidationWorkflowTasks.length) {
      for (const task of dataSourcesAccessValidationWorkflowTasks) {
        lines.push(`- ${task.title}: ${task.status || "open"} / ${task.priority || "low"}`);
        lines.push(`  Source: ${task.sourceLabel || "Source"} (${task.sourceType || "source"})`);
        lines.push(`  Workflow: ${task.workflowStage || "validation"} / ${task.workflowStatus || "pending"}`);
        lines.push(`  Workflow id: ${task.sourceAccessValidationWorkflowId}`);
        lines.push(`  Evidence: ${task.latestEvidenceStatus || task.coverageStatus || "missing"}`);
      }
    } else {
      lines.push("- No visible Data Sources access validation workflow tasks.");
    }

    lines.push("", "## Data Sources Access Task Ledger");
    if (governance.dataSourcesAccessTasks?.length) {
      for (const task of governance.dataSourcesAccessTasks) {
        lines.push(`- ${task.title}: ${task.status || "open"} / ${task.priority || "low"}`);
        lines.push(`  Source: ${task.sourceLabel || "Source"} (${task.sourceType || "source"})`);
        lines.push(`  Access method: ${task.accessMethod || "review-required"}`);
        if (task.sourceAccessValidationWorkflowId) {
          lines.push(`  Workflow id: ${task.sourceAccessValidationWorkflowId}`);
        }
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

    lines.push("", "## CLI Bridge Run Trace Snapshots");
    if ((governance.cliBridgeRunTraceSnapshots || []).length) {
      for (const snapshot of governance.cliBridgeRunTraceSnapshots) {
        lines.push(`- ${snapshot.title || "CLI Bridge Run Trace"}: ${snapshot.traceDecision || "review"} for ${snapshot.projectName || snapshot.projectId || "Portfolio"}`);
        lines.push(`  Run: ${snapshot.runId || "unknown"} | Related handoffs: ${snapshot.relatedHandoffCount || 0}`);
        lines.push(`  Created: ${new Date(snapshot.createdAt).toLocaleString()}`);
      }
    } else {
      lines.push("- No visible CLI bridge run trace snapshots.");
    }

    lines.push("", "## CLI Bridge Run Trace Snapshot Drift");
    if (governance.cliBridgeRunTraceSnapshotBaselineStatus) {
      const status = governance.cliBridgeRunTraceSnapshotBaselineStatus;
      lines.push(`- Baseline status: ${status.hasBaseline ? "set" : "missing"}`);
      lines.push(`- Baseline freshness: ${status.freshness || "missing"} (${status.ageHours || 0}h old, threshold ${status.freshnessThresholdHours || 24}h)`);
      lines.push(`- Baseline health: ${status.health || "missing"}`);
      lines.push(`- Baseline action: ${status.recommendedAction || "Save a CLI bridge run trace snapshot before relying on trace baseline drift."}`);
      lines.push(`- Baseline drift severity: ${status.driftSeverity || "missing-baseline"}`);
      lines.push(`- Baseline drift score: ${status.driftScore || 0}`);
    } else {
      lines.push("- No visible CLI bridge run trace baseline status.");
    }

    lines.push("", "## CLI Bridge Run Trace Snapshot Drift Details");
    if (governance.cliBridgeRunTraceSnapshotDiff) {
      const diff = governance.cliBridgeRunTraceSnapshotDiff;
      lines.push(`- Snapshot: ${diff.snapshotTitle || diff.snapshotId || "missing"}`);
      lines.push(`- Drift severity: ${diff.driftSeverity || "missing-snapshot"}`);
      lines.push(`- Drift score: ${diff.driftScore || 0}`);
      lines.push(`- Recommended action: ${diff.recommendedAction || "Save a CLI bridge run trace snapshot before comparing drift."}`);
      for (const item of (diff.driftItems || []).slice(0, 8)) {
        lines.push(`- Drift item: ${item.label || item.field} ${item.before ?? ""} -> ${item.current ?? ""}`);
      }
    } else {
      lines.push("- No visible CLI bridge run trace snapshot drift.");
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
      const agentPolicy = item.agentPolicy || {};
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
      lines.push(`- Agent policy checkpoint: ${agentPolicy.checkpointStatus || "needs-review"} (${agentPolicy.executable ? "executable" : "blocked"})`);
      lines.push(`- Managed agent role: ${agentPolicy.role || "readiness-reviewer"}`);
      lines.push(`- Runtime / isolation: ${agentPolicy.runtime || "planning-only-agent"} / ${agentPolicy.isolationMode || "read-only-planning"}`);
      lines.push(`- Skill bundle: ${(agentPolicy.skillBundle || []).join(", ") || "project-governance, validation-runner, handoff-pack"}`);
      lines.push(`- Hook policy: ${(agentPolicy.hookPolicy || []).join(", ") || "policy-checkpoint-required, preflight-status-review, post-run-validation-log"}`);
      lines.push(`- Secret policy: ${agentPolicy.secretPolicy || "Non-secret managed agent policy metadata only."}`);
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
   * @param {import("./dashboard-types.js").PersistedDataSourcesAccessValidationWorkflowSnapshot[]} snapshots
   */
  function createDataSourcesAccessValidationWorkflowSnapshotSection(snapshots) {
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
    title.textContent = "Data Sources Validation Workflow Snapshot History";
    title.style.fontWeight = "800";
    title.style.color = "var(--text)";

    const count = document.createElement("div");
    count.textContent = `${snapshots.length} saved`;
    count.style.color = "var(--text-muted)";
    count.style.fontSize = "0.84rem";

    heading.append(title, count);
    section.append(heading);
    for (const snapshot of snapshots.slice(0, 8)) {
      section.append(createDataSourcesAccessValidationWorkflowSnapshotItem(snapshot));
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

      const actions = document.createElement("div");
      actions.className = "governance-actions source-access-matrix-checkpoints";
      actions.style.marginTop = "0.75rem";

      for (const [status, label] of [["approved", "Confirm"], ["deferred", "Defer"]]) {
        const checkpointButton = document.createElement("button");
        checkpointButton.className = `btn governance-action-btn source-access-matrix-${status}-btn`;
        checkpointButton.type = "button";
        checkpointButton.textContent = label;
        checkpointButton.dataset.sourceTaskSeedingCheckpoint = "true";
        checkpointButton.dataset.taskSeedingBatchId = `sources-access-matrix:${method.accessMethod}`;
        checkpointButton.dataset.taskSeedingStatus = status;
        checkpointButton.dataset.taskSeedingSource = "sources-access-matrix";
        checkpointButton.dataset.taskSeedingTitle = `Data Sources access matrix: ${method.accessMethod}`;
        checkpointButton.dataset.taskSeedingItemCount = String(method.total || 0);
        checkpointButton.dataset.taskSeedingNote = `Operator marked the Data Sources access matrix row for ${method.accessMethod} as ${status} before task creation; non-secret access-method metadata only.`;
        actions.append(checkpointButton);
      }

      const trackButton = document.createElement("button");
      trackButton.className = "btn governance-action-btn source-access-matrix-task-btn";
      trackButton.type = "button";
      trackButton.textContent = "Track Tasks";
      trackButton.dataset.sourceAccessMatrixTaskAccessMethod = method.accessMethod;
      actions.append(trackButton);

      body.append(actions);
      card.append(body, stats);
      section.append(card);
    }

    return section;
  }

  /**
   * @param {import("./dashboard-types.js").DataSourcesAccessChecklistPayload} checklist
   */
  function createDataSourcesAccessChecklistSection(checklist) {
    const section = document.createElement("section");
    section.className = "source-access-checklist-deck";
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
    title.textContent = "Data Sources Access Checklist";
    title.style.fontWeight = "800";
    title.style.color = "var(--text)";

    const summary = document.createElement("div");
    summary.textContent = `${checklist.summary.ready} ready | ${checklist.summary.review} review | ${checklist.summary.blocked} blocked`;
    summary.style.color = checklist.summary.blocked
      ? "var(--danger)"
      : checklist.summary.review
        ? "var(--warning)"
        : "var(--success)";
    summary.style.fontSize = "0.84rem";

    heading.append(title, summary);
    section.append(heading);

    if (!checklist.items.length) {
      const empty = document.createElement("div");
      empty.textContent = "No source access checklist items found.";
      empty.style.padding = "1rem";
      empty.style.border = "1px solid var(--border)";
      empty.style.borderRadius = "0.65rem";
      empty.style.background = "var(--surface)";
      empty.style.color = "var(--text-muted)";
      section.append(empty);
      return section;
    }

    for (const item of checklist.items.slice(0, 10)) {
      const card = document.createElement("div");
      card.className = "source-access-checklist-card";
      card.style.display = "flex";
      card.style.justifyContent = "space-between";
      card.style.gap = "1rem";
      card.style.padding = "1rem";
      card.style.border = "1px solid var(--border)";
      card.style.borderRadius = "0.65rem";
      card.style.background = "var(--surface)";
      card.style.borderLeft = `4px solid ${item.status === "blocked" ? "var(--danger)" : item.status === "review" ? "var(--warning)" : "var(--success)"}`;

      const body = document.createElement("div");
      const itemTitle = document.createElement("div");
      itemTitle.textContent = item.label || item.sourceId || "Source access checklist item";
      itemTitle.style.fontWeight = "800";
      itemTitle.style.color = "var(--text)";
      itemTitle.style.marginBottom = "0.25rem";

      const details = document.createElement("div");
      details.textContent = `${item.accessMethod || "review-required"} | ${item.action || "Review source access."}`;
      details.style.color = "var(--text-muted)";
      details.style.fontSize = "0.84rem";
      details.style.lineHeight = "1.45";

      const validation = document.createElement("div");
      validation.textContent = item.validation || "Confirm the source can be reached without storing secrets in this app.";
      validation.style.color = "var(--text-muted)";
      validation.style.fontSize = "0.78rem";
      validation.style.lineHeight = "1.45";
      validation.style.marginTop = "0.35rem";

      const actions = document.createElement("div");
      actions.className = "governance-actions source-access-checklist-checkpoints";
      actions.style.marginTop = "0.75rem";

      for (const [status, label] of [["approved", "Confirm"], ["deferred", "Defer"]]) {
        const checkpointButton = document.createElement("button");
        checkpointButton.className = `btn governance-action-btn source-access-checklist-${status}-btn`;
        checkpointButton.type = "button";
        checkpointButton.textContent = label;
        checkpointButton.dataset.sourceTaskSeedingCheckpoint = "true";
        checkpointButton.dataset.taskSeedingBatchId = `sources-access-checklist:${item.sourceId || item.id || item.label || "source"}`;
        checkpointButton.dataset.taskSeedingStatus = status;
        checkpointButton.dataset.taskSeedingSource = "sources-access-checklist";
        checkpointButton.dataset.taskSeedingTitle = `Data Sources access checklist: ${item.label || item.sourceId || "Source"}`;
        checkpointButton.dataset.taskSeedingItemCount = "1";
        checkpointButton.dataset.taskSeedingNote = `Operator marked the Data Sources access checklist item for ${item.label || item.sourceId || "Source"} as ${status}; non-secret checklist metadata only.`;
        actions.append(checkpointButton);
      }

      const taskButton = document.createElement("button");
      taskButton.className = "btn governance-action-btn source-access-checklist-task-btn";
      taskButton.type = "button";
      taskButton.textContent = "Track Workflow Task";
      taskButton.dataset.sourceAccessChecklistTaskSourceId = item.sourceId || "";
      actions.append(taskButton);

      body.append(itemTitle, details, validation, actions);

      const status = document.createElement("div");
      status.style.display = "flex";
      status.style.flexDirection = "column";
      status.style.alignItems = "flex-end";
      status.style.gap = "0.25rem";
      status.style.color = "var(--text-muted)";
      status.style.fontSize = "0.82rem";
      for (const line of [
        item.status,
        item.sourceHealth || "review",
        item.credentialHint || "non-secret access metadata"
      ]) {
        const statLine = document.createElement("span");
        statLine.textContent = line;
        status.append(statLine);
      }

      card.append(body, status);
      section.append(card);
    }

    return section;
  }

  /**
   * @param {import("./dashboard-types.js").DataSourcesAccessMethodRegistryPayload} registry
   */
  function createDataSourcesAccessMethodRegistrySection(registry) {
    const section = document.createElement("section");
    section.className = "source-access-method-registry";
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
    title.textContent = "Data Sources Access Method Registry";
    title.style.fontWeight = "800";
    title.style.color = "var(--text)";

    const summary = document.createElement("div");
    summary.textContent = `${registry.summary.totalMethods} method(s) | ${registry.summary.gitRemoteSources} git | ${registry.summary.manualAccessLikely} manual | ${registry.summary.privateRepoLikely} private likely`;
    summary.style.color = registry.summary.blockedSources
      ? "var(--danger)"
      : registry.summary.reviewRequired
        ? "var(--warning)"
        : "var(--success)";
    summary.style.fontSize = "0.84rem";

    heading.append(title, summary);
    section.append(heading);

    if (!registry.methods.length) {
      const empty = document.createElement("div");
      empty.textContent = "No access methods registered.";
      empty.style.padding = "1rem";
      empty.style.border = "1px solid var(--border)";
      empty.style.borderRadius = "0.65rem";
      empty.style.background = "var(--surface)";
      empty.style.color = "var(--text-muted)";
      section.append(empty);
      return section;
    }

    for (const method of registry.methods.slice(0, 8)) {
      const card = document.createElement("div");
      card.className = "source-access-method-registry-card";
      card.style.display = "flex";
      card.style.justifyContent = "space-between";
      card.style.gap = "1rem";
      card.style.padding = "1rem";
      card.style.border = "1px solid var(--border)";
      card.style.borderRadius = "0.65rem";
      card.style.background = "var(--surface)";

      const body = document.createElement("div");
      const methodTitle = document.createElement("div");
      methodTitle.textContent = method.title || method.accessMethod;
      methodTitle.style.fontWeight = "800";
      methodTitle.style.color = "var(--text)";
      methodTitle.style.marginBottom = "0.25rem";

      const setup = document.createElement("div");
      setup.textContent = method.externalSetup || "Resolve required access outside this app.";
      setup.style.color = "var(--text-muted)";
      setup.style.fontSize = "0.84rem";

      const methodActions = document.createElement("div");
      methodActions.className = "governance-actions source-access-method-registry-checkpoints";
      methodActions.style.marginTop = "0.75rem";

      for (const [status, label] of [["approved", "Confirm"], ["deferred", "Defer"]]) {
        const checkpointButton = document.createElement("button");
        checkpointButton.className = `btn governance-action-btn source-access-method-registry-${status}-btn`;
        checkpointButton.type = "button";
        checkpointButton.textContent = label;
        checkpointButton.dataset.sourceTaskSeedingCheckpoint = "true";
        checkpointButton.dataset.taskSeedingBatchId = `sources-access-method-registry:${method.accessMethod}`;
        checkpointButton.dataset.taskSeedingStatus = status;
        checkpointButton.dataset.taskSeedingSource = "sources-access-method-registry";
        checkpointButton.dataset.taskSeedingTitle = `Data Sources access method registry: ${method.accessMethod}`;
        checkpointButton.dataset.taskSeedingItemCount = String(method.sourceCount || 0);
        checkpointButton.dataset.taskSeedingNote = `Operator marked the Data Sources access method registry row for ${method.accessMethod} as ${status}; non-secret access-method metadata only.`;
        methodActions.append(checkpointButton);
      }

      const evidenceButton = document.createElement("button");
      evidenceButton.className = "btn governance-action-btn source-access-method-registry-evidence-btn";
      evidenceButton.type = "button";
      evidenceButton.textContent = "Record Evidence";
      evidenceButton.dataset.sourceAccessMethodRegistryEvidenceMethod = method.accessMethod;
      methodActions.append(evidenceButton);

      const sources = document.createElement("div");
      sources.textContent = method.sources.slice(0, 4).map((source) => source.label).join(" | ") || "No sources";
      sources.style.color = "var(--text-muted)";
      sources.style.fontSize = "0.78rem";
      sources.style.marginTop = "0.25rem";

      const sourceActions = document.createElement("div");
      sourceActions.className = "source-access-method-checkpoints";
      sourceActions.style.display = "flex";
      sourceActions.style.flexDirection = "column";
      sourceActions.style.gap = "0.45rem";
      sourceActions.style.marginTop = "0.75rem";

      for (const source of method.sources.slice(0, 4)) {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.gap = "0.75rem";
        row.style.alignItems = "center";
        row.style.flexWrap = "wrap";

        const sourceLabel = document.createElement("span");
        sourceLabel.textContent = `${source.label || source.id || "Source"} • ${source.health || "review"}${source.requiresReview ? " • review required" : ""}`;
        sourceLabel.style.color = "var(--text-muted)";
        sourceLabel.style.fontSize = "0.78rem";

        const actions = document.createElement("div");
        actions.className = "governance-actions";
        actions.style.marginTop = "0";

        for (const [status, label] of [
          ["validated", "Confirm Method"],
          ["review", "Needs Review"],
          ["blocked", "Blocked"]
        ]) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "btn governance-action-btn source-access-method-review-btn";
          button.textContent = label;
          button.dataset.sourceAccessEvidenceAction = status;
          button.dataset.sourceId = source.id || "";
          button.dataset.sourceLabel = source.label || source.id || "Source";
          button.dataset.accessMethod = method.accessMethod || source.accessMethod || "review-required";
          actions.append(button);
        }

        row.append(sourceLabel, actions);
        sourceActions.append(row);
      }

      body.append(methodTitle, setup, methodActions, sources, sourceActions);

      const stats = document.createElement("div");
      stats.style.display = "flex";
      stats.style.flexDirection = "column";
      stats.style.alignItems = "flex-end";
      stats.style.gap = "0.25rem";
      stats.style.color = "var(--text-muted)";
      stats.style.fontSize = "0.82rem";
      for (const line of [
        method.category,
        `${method.sourceCount} source(s), ${method.reviewRequired} review`,
        `${method.tokenLikely} token | ${method.certificateLikely} cert | ${method.sshKeyLikely} SSH`,
        `${method.privateRepoLikely} private | ${method.manualAccessLikely} manual`
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
   * @param {import("./dashboard-types.js").DataSourcesAccessValidationWorkflowPayload} workflow
   */
  function createDataSourcesAccessValidationWorkflowSection(workflow) {
    const section = document.createElement("section");
    section.className = "source-access-validation-workflow";
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
    title.textContent = "Data Sources Access Validation Workflow";
    title.style.fontWeight = "800";
    title.style.color = "var(--text)";

    const summary = document.createElement("div");
    summary.textContent = `${workflow.summary.ready} ready | ${workflow.summary.pending} pending | ${workflow.summary.blocked} blocked | ${workflow.summary.externalAccessRequired} external`;
    summary.style.color = workflow.summary.blocked
      ? "var(--danger)"
      : workflow.summary.pending
        ? "var(--warning)"
        : "var(--success)";
    summary.style.fontSize = "0.84rem";

    heading.append(title, summary);
    section.append(heading);

    if (!workflow.items.length) {
      const empty = document.createElement("div");
      empty.textContent = "No source access validation workflow items found.";
      empty.style.padding = "1rem";
      empty.style.border = "1px solid var(--border)";
      empty.style.borderRadius = "0.65rem";
      empty.style.background = "var(--surface)";
      empty.style.color = "var(--text-muted)";
      section.append(empty);
      return section;
    }

    for (const item of workflow.items.slice(0, 10)) {
      const card = document.createElement("div");
      card.className = "source-access-validation-workflow-card";
      card.style.display = "flex";
      card.style.justifyContent = "space-between";
      card.style.gap = "1rem";
      card.style.padding = "1rem";
      card.style.border = "1px solid var(--border)";
      card.style.borderRadius = "0.65rem";
      card.style.background = "var(--surface)";
      card.style.borderLeft = `4px solid ${item.status === "blocked" ? "var(--danger)" : item.status === "pending" ? "var(--warning)" : "var(--success)"}`;

      const body = document.createElement("div");
      const itemTitle = document.createElement("div");
      itemTitle.textContent = item.label;
      itemTitle.style.fontWeight = "800";
      itemTitle.style.color = "var(--text)";
      itemTitle.style.marginBottom = "0.25rem";

      const action = document.createElement("div");
      action.textContent = item.action;
      action.style.color = "var(--text-muted)";
      action.style.fontSize = "0.84rem";

      const blockers = document.createElement("div");
      blockers.textContent = item.blockerTypes.length ? `Blockers: ${item.blockerTypes.join(", ")}` : "Blockers: none";
      blockers.style.color = "var(--text-muted)";
      blockers.style.fontSize = "0.78rem";
      blockers.style.marginTop = "0.25rem";

      const workflowActions = document.createElement("div");
      workflowActions.className = "governance-actions source-validation-workflow-item-actions";
      workflowActions.style.marginTop = "0.65rem";
      const trackSnapshotButton = document.createElement("button");
      trackSnapshotButton.type = "button";
      trackSnapshotButton.className = "btn governance-action-btn source-validation-workflow-task-snapshot-btn";
      trackSnapshotButton.textContent = "Track + Snapshot";
      trackSnapshotButton.dataset.sourceValidationWorkflowTaskSnapshot = item.id || "";
      trackSnapshotButton.dataset.sourceValidationWorkflowTaskSnapshotRenderTarget = "sources";
      workflowActions.append(trackSnapshotButton);

      body.append(itemTitle, action, blockers, workflowActions);

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
        item.stage,
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

  function getSourceCheckpointDrilldownCounts(item) {
    const checkpoints = item?.sourceAccessCheckpoints || {};
    return {
      total: Number(checkpoints.total || 0),
      unresolved: Number(checkpoints.unresolved || 0)
    };
  }

  function createSourceCheckpointFilterController({ label, totalCount, unresolvedCount, applyFilter }) {
    const bar = document.createElement("div");
    bar.className = "source-checkpoint-filter";
    bar.style.display = "flex";
    bar.style.flexWrap = "wrap";
    bar.style.alignItems = "center";
    bar.style.justifyContent = "space-between";
    bar.style.gap = "0.6rem";
    bar.style.padding = "0.75rem";
    bar.style.border = "1px solid var(--border)";
    bar.style.borderRadius = "0.65rem";
    bar.style.background = "var(--bg)";

    const summary = document.createElement("div");
    summary.style.color = unresolvedCount ? "var(--warning)" : "var(--text-muted)";
    summary.style.fontSize = "0.84rem";

    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.flexWrap = "wrap";
    controls.style.gap = "0.45rem";

    const allButton = document.createElement("button");
    allButton.type = "button";
    allButton.className = "btn governance-action-btn source-checkpoint-filter-all-btn";
    allButton.textContent = "Show All";

    const unresolvedButton = document.createElement("button");
    unresolvedButton.type = "button";
    unresolvedButton.className = "btn governance-action-btn source-checkpoint-filter-unresolved-btn";
    unresolvedButton.textContent = "Unresolved checkpoints";
    unresolvedButton.disabled = unresolvedCount === 0;

    controls.append(allButton, unresolvedButton);
    bar.append(summary, controls);

    function setMode(mode) {
      const unresolvedMode = mode === "unresolved";
      allButton.classList.toggle("active", !unresolvedMode);
      unresolvedButton.classList.toggle("active", unresolvedMode);
      summary.textContent = unresolvedMode
        ? `Showing ${unresolvedCount} ${label}${unresolvedCount === 1 ? "" : "s"} with unresolved source checkpoints.`
        : `Showing ${totalCount} ${label}${totalCount === 1 ? "" : "s"}; ${unresolvedCount} have unresolved source checkpoints.`;
      applyFilter(mode);
    }

    allButton.addEventListener("click", () => setMode("all"));
    unresolvedButton.addEventListener("click", () => setMode("unresolved"));

    return {
      node: bar,
      setMode
    };
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
    summary.textContent = `${queue.summary.total} item(s) | ${queue.summary.blocked} blocked | ${queue.summary.review} review | ${queue.summary.checkpointUnresolved || 0} unresolved checkpoint(s)`;
    summary.style.color = queue.summary.blocked ? "var(--danger)" : queue.summary.review || queue.summary.checkpointUnresolved ? "var(--warning)" : "var(--success)";
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

    const visibleReviewItems = queue.items.slice(0, 8);
    const reviewCardEntries = [];
    const unresolvedReviewCount = visibleReviewItems.filter((item) => getSourceCheckpointDrilldownCounts(item).unresolved > 0).length;
    const filterController = createSourceCheckpointFilterController({
      label: "review item",
      totalCount: visibleReviewItems.length,
      unresolvedCount: unresolvedReviewCount,
      applyFilter: (mode) => {
        for (const entry of reviewCardEntries) {
          entry.card.style.display = mode === "unresolved" && !entry.hasUnresolvedCheckpoint ? "none" : "";
        }
      }
    });
    section.append(filterController.node);

    for (const item of visibleReviewItems) {
      const checkpointCounts = getSourceCheckpointDrilldownCounts(item);
      const card = document.createElement("div");
      card.className = "source-access-review-card";
      card.dataset.sourceAccessCheckpointUnresolved = String(checkpointCounts.unresolved);
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

      const sourceCheckpoints = document.createElement("div");
      sourceCheckpoints.textContent = `Source checkpoints: ${checkpointCounts.unresolved} unresolved / ${checkpointCounts.total} total`;
      sourceCheckpoints.style.color = checkpointCounts.unresolved ? "var(--warning)" : checkpointCounts.total ? "var(--success)" : "var(--text-muted)";
      sourceCheckpoints.style.fontSize = "0.78rem";
      sourceCheckpoints.style.marginTop = "0.25rem";

      const checkpointActions = document.createElement("div");
      checkpointActions.className = "governance-actions source-access-review-item-checkpoints";
      checkpointActions.style.marginTop = "0.65rem";
      for (const [status, label] of [
        ["approved", "Confirm Item"],
        ["deferred", "Defer Item"],
        ["dismissed", "Dismiss Item"]
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `btn governance-action-btn source-access-review-item-${status}-btn`;
        button.textContent = label;
        button.dataset.sourceTaskSeedingCheckpoint = "true";
        button.dataset.taskSeedingBatchId = item.id || `source-access-review:${item.sourceId || item.label || "source"}`;
        button.dataset.taskSeedingStatus = status;
        button.dataset.taskSeedingSource = "sources-access-review-queue";
        button.dataset.taskSeedingTitle = item.title || `Source access review: ${item.label || item.sourceId || "Source"}`;
        button.dataset.taskSeedingItemCount = "1";
        checkpointActions.append(button);
      }
      const trackSnapshotButton = document.createElement("button");
      trackSnapshotButton.type = "button";
      trackSnapshotButton.className = "btn governance-action-btn source-access-review-task-snapshot-btn";
      trackSnapshotButton.textContent = "Track + Snapshot";
      trackSnapshotButton.dataset.sourceAccessReviewTaskSnapshot = item.id || "";
      trackSnapshotButton.dataset.sourceAccessReviewTaskSnapshotRenderTarget = "sources";
      checkpointActions.append(trackSnapshotButton);

      body.append(itemTitle, action, validation, sourceCheckpoints, checkpointActions);

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
      reviewCardEntries.push({
        card,
        hasUnresolvedCheckpoint: checkpointCounts.unresolved > 0
      });
    }
    filterController.setMode("all");

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
    summary.textContent = `${coverage.summary.covered}/${coverage.summary.sourceCount} covered | ${coverage.summary.missing} missing | ${coverage.summary.highPriority} high priority | ${coverage.summary.checkpointUnresolved || 0} unresolved checkpoint(s)`;
    summary.style.color = coverage.summary.blocked || coverage.summary.highPriority
      ? "var(--danger)"
      : coverage.summary.missing || coverage.summary.review || coverage.summary.checkpointUnresolved
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

    const visibleCoverageItems = coverage.items.slice(0, 10);
    const coverageCardEntries = [];
    const unresolvedCoverageCount = visibleCoverageItems.filter((item) => getSourceCheckpointDrilldownCounts(item).unresolved > 0).length;
    const filterController = createSourceCheckpointFilterController({
      label: "coverage item",
      totalCount: visibleCoverageItems.length,
      unresolvedCount: unresolvedCoverageCount,
      applyFilter: (mode) => {
        for (const entry of coverageCardEntries) {
          entry.card.style.display = mode === "unresolved" && !entry.hasUnresolvedCheckpoint ? "none" : "";
        }
      }
    });
    section.append(filterController.node);

    for (const item of visibleCoverageItems) {
      const checkpointCounts = getSourceCheckpointDrilldownCounts(item);
      const card = document.createElement("div");
      card.className = "source-evidence-coverage-card";
      card.dataset.sourceAccessCheckpointUnresolved = String(checkpointCounts.unresolved);
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

      const sourceCheckpoints = document.createElement("div");
      sourceCheckpoints.textContent = `Source checkpoints: ${checkpointCounts.unresolved} unresolved / ${checkpointCounts.total} total`;
      sourceCheckpoints.style.color = checkpointCounts.unresolved ? "var(--warning)" : checkpointCounts.total ? "var(--success)" : "var(--text-muted)";
      sourceCheckpoints.style.fontSize = "0.78rem";
      sourceCheckpoints.style.lineHeight = "1.4";

      const checkpointActions = document.createElement("div");
      checkpointActions.className = "governance-actions source-evidence-coverage-item-checkpoints";
      checkpointActions.style.marginTop = "0.65rem";
      for (const [status, label] of [
        ["approved", "Confirm Item"],
        ["deferred", "Defer Item"],
        ["dismissed", "Dismiss Item"]
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `btn governance-action-btn source-evidence-coverage-item-${status}-btn`;
        button.textContent = label;
        button.dataset.sourceTaskSeedingCheckpoint = "true";
        button.dataset.taskSeedingBatchId = item.id || `source-evidence-coverage:${item.sourceId || item.label || "source"}`;
        button.dataset.taskSeedingStatus = status;
        button.dataset.taskSeedingSource = "sources-access-validation-evidence-coverage";
        button.dataset.taskSeedingTitle = `Source evidence coverage: ${item.label || item.sourceId || "Source"}`;
        button.dataset.taskSeedingItemCount = "1";
        checkpointActions.append(button);
      }
      const trackSnapshotButton = document.createElement("button");
      trackSnapshotButton.type = "button";
      trackSnapshotButton.className = "btn governance-action-btn source-evidence-coverage-task-snapshot-btn";
      trackSnapshotButton.textContent = "Track + Snapshot";
      trackSnapshotButton.dataset.sourceEvidenceCoverageTaskSnapshot = item.id || "";
      trackSnapshotButton.dataset.sourceEvidenceCoverageTaskSnapshotRenderTarget = "sources";
      checkpointActions.append(trackSnapshotButton);

      body.append(cardTitle, action, evidence, sourceCheckpoints, checkpointActions);

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
      coverageCardEntries.push({
        card,
        hasUnresolvedCheckpoint: checkpointCounts.unresolved > 0
      });
    }
    filterController.setMode("all");

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

      for (const [status, label] of [["approved", "Confirm"], ["deferred", "Defer"]]) {
        const checkpointButton = document.createElement("button");
        checkpointButton.className = `btn governance-action-btn deployment-health-${status}-btn`;
        checkpointButton.type = "button";
        checkpointButton.textContent = label;
        checkpointButton.dataset.sourceTaskSeedingCheckpoint = "true";
        checkpointButton.dataset.taskSeedingBatchId = `sources-deployment-health:${target.id || target.url || target.label || "target"}`;
        checkpointButton.dataset.taskSeedingStatus = status;
        checkpointButton.dataset.taskSeedingSource = "sources-deployment-health";
        checkpointButton.dataset.taskSeedingTitle = `Deployment health: ${target.label || target.host || target.url || "target"}`;
        checkpointButton.dataset.taskSeedingItemCount = "1";
        checkpointButton.dataset.taskSeedingNote = `Operator marked the deployment health target ${target.label || target.host || target.url || "target"} as ${status}; non-secret deployment metadata only.`;
        action.append(checkpointButton);
      }

      const taskButton = document.createElement("button");
      taskButton.className = "btn governance-action-btn deployment-health-release-task-btn";
      taskButton.type = "button";
      taskButton.textContent = "Track Release Task";
      taskButton.dataset.deploymentHealthReleaseTaskTargetId = target.id || "";
      action.append(taskButton);

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

        const actions = document.createElement("div");
        actions.className = "governance-actions deployment-smoke-check-checkpoints";
        actions.style.marginTop = "0";

        for (const [checkpointStatus, checkpointLabel] of [["approved", "Confirm"], ["deferred", "Defer"]]) {
          const checkpointButton = document.createElement("button");
          checkpointButton.className = `btn governance-action-btn deployment-smoke-check-${checkpointStatus}-btn`;
          checkpointButton.type = "button";
          checkpointButton.textContent = checkpointLabel;
          checkpointButton.dataset.sourceTaskSeedingCheckpoint = "true";
          checkpointButton.dataset.taskSeedingBatchId = `sources-deployment-smoke-check:${smokeCheck.id || smokeCheck.targetId || smokeCheck.url || "smoke-check"}`;
          checkpointButton.dataset.taskSeedingStatus = checkpointStatus;
          checkpointButton.dataset.taskSeedingSource = "sources-deployment-smoke-check-ledger";
          checkpointButton.dataset.taskSeedingTitle = `Deployment smoke check: ${smokeCheck.label || smokeCheck.host || smokeCheck.url || "target"}`;
          checkpointButton.dataset.taskSeedingItemCount = "1";
          checkpointButton.dataset.taskSeedingNote = `Operator marked deployment smoke-check result ${smokeCheck.id || smokeCheck.targetId || "smoke-check"} as ${checkpointStatus}; non-secret smoke-check metadata only.`;
          actions.append(checkpointButton);
        }

        const taskButton = document.createElement("button");
        taskButton.className = "btn governance-action-btn deployment-smoke-check-release-task-btn";
        taskButton.type = "button";
        taskButton.textContent = "Track Release Task";
        taskButton.dataset.deploymentSmokeReleaseTaskId = smokeCheck.id || "";
        actions.append(taskButton);

        row.append(label, status, actions);
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

    container.querySelectorAll("[data-source-summary-snapshot-drift-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.sourceSummarySnapshotDriftId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Diffing";
          const diff = await api.fetchSourcesSummarySnapshotDiff(snapshotId);
          await copyText(diff.markdown);
          element.textContent = diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : "No Drift";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-source-summary-snapshot-drift-task-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.sourceSummarySnapshotDriftTaskId || "";
        const snapshot = snapshots.find((item) => item.id === snapshotId);
        if (!snapshot) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          await createDataSourcesSummaryDriftReviewTask(snapshot);
          element.textContent = "Tracked";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-source-summary-snapshot-drift-accept-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.sourceSummarySnapshotDriftAcceptId || "";
        const snapshot = snapshots.find((item) => item.id === snapshotId);
        if (!snapshot) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Accepting";
          await acceptDataSourcesSummarySnapshotDrift(snapshot);
          element.textContent = "Accepted";
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
   * @param {import("./dashboard-types.js").PersistedDataSourcesAccessValidationWorkflowSnapshot[]} snapshots
   */
  function bindDataSourcesAccessValidationWorkflowSnapshotActions(container, snapshots = []) {
    const snapshotList = snapshots.length ? snapshots : (governanceCache?.dataSourceAccessValidationWorkflowSnapshots || []);
    container.querySelectorAll("[data-source-access-validation-workflow-snapshot-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.sourceAccessValidationWorkflowSnapshotId || "";
        const snapshot = snapshotList.find((item) => item.id === snapshotId);
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

    container.querySelectorAll("[data-source-access-validation-workflow-snapshot-drift-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.sourceAccessValidationWorkflowSnapshotDriftId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Diffing";
          const diff = await api.fetchSourcesAccessValidationWorkflowSnapshotDiff(snapshotId);
          await copyText(diff.markdown);
          element.textContent = diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : "No Drift";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-source-access-validation-workflow-snapshot-drift-task-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.sourceAccessValidationWorkflowSnapshotDriftTaskId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          await createDataSourcesAccessValidationWorkflowDriftReviewTask(snapshotId);
          element.textContent = "Tracked";
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-source-access-validation-workflow-snapshot-drift-accept-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const snapshotId = element.dataset.sourceAccessValidationWorkflowSnapshotDriftAcceptId || "";
        if (!snapshotId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Accepting";
          await acceptDataSourcesAccessValidationWorkflowSnapshotDrift(snapshotId);
          element.textContent = "Accepted";
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

    container.querySelectorAll("[data-deployment-health-release-task-target-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const targetId = element.dataset.deploymentHealthReleaseTaskTargetId || "";
        if (!targetId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          const label = await createDeploymentHealthReleaseTask(targetId);
          element.textContent = label;
        } catch (error) {
          element.textContent = originalLabel;
          alert(getErrorMessage(error));
        } finally {
          element.disabled = false;
        }
      };
    });

    container.querySelectorAll("[data-deployment-smoke-release-task-id]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const smokeCheckId = element.dataset.deploymentSmokeReleaseTaskId || "";
        if (!smokeCheckId) return;

        const originalLabel = element.textContent || "";
        try {
          element.disabled = true;
          element.textContent = "Creating";
          const label = await createDeploymentSmokeCheckReleaseTask(smokeCheckId);
          element.textContent = label;
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
      const [sourcesPayload, accessMethodRegistry, accessValidationWorkflow, workflowSnapshots, accessChecklist, accessMatrix, accessReviewQueue, accessValidationEvidenceCoverage, deploymentHealth, snapshots] = await Promise.all([
        api.fetchSourcesSummary(),
        api.fetchSourcesAccessMethodRegistry(),
        api.fetchSourcesAccessValidationWorkflow(),
        api.fetchSourcesAccessValidationWorkflowSnapshots(),
        api.fetchSourcesAccessChecklist(),
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

      const unresolvedCheckpointCount = sourcesPayload.summary.sourceAccessCheckpointUnresolvedCount || 0;
      updatePanelState("sources", {
        status: sourcesPayload.summary.blocked ? "error" : "ready",
        itemCount: sources.length,
        lastLoadedAt: new Date().toISOString(),
        message: sourcesPayload.summary.blocked
          ? `${sourcesPayload.summary.blocked} blocked source(s) need attention | ${unresolvedCheckpointCount} unresolved checkpoint(s).`
          : `${sourcesPayload.summary.ready} ready, ${sourcesPayload.summary.review} review | ${unresolvedCheckpointCount} unresolved checkpoint(s).`
      });
      renderPanelStatus("sources");
      const fragment = document.createDocumentFragment();
      for (const source of sources) {
        fragment.append(createSourceItem(source));
      }
      fragment.append(createDeploymentHealthSection(deploymentHealth));
      fragment.append(createDataSourcesAccessChecklistSection(accessChecklist));
      fragment.append(createDataSourcesAccessValidationEvidenceCoverageSection(accessValidationEvidenceCoverage));
      fragment.append(createDataSourcesAccessValidationWorkflowSection(accessValidationWorkflow));
      const workflowSnapshotSection = createDataSourcesAccessValidationWorkflowSnapshotSection(workflowSnapshots || []);
      if (workflowSnapshotSection) {
        fragment.append(workflowSnapshotSection);
      }
      fragment.append(createDataSourcesAccessReviewQueueSection(accessReviewQueue));
      fragment.append(createDataSourcesAccessMethodRegistrySection(accessMethodRegistry));
      fragment.append(createDataSourcesAccessMatrixSection(accessMatrix));
      const snapshotSection = createDataSourcesSummarySnapshotSection(snapshots || []);
      if (snapshotSection) {
        fragment.append(snapshotSection);
      }
      container.replaceChildren(fragment);
      bindSourceRegistryActions(container, sources);
      bindDeploymentHealthActions(container);
      bindSourceAccessEvidenceActions(container, renderSources);
      bindSourceTaskSeedingCheckpointActions(container);
      bindSourceAccessChecklistTaskActions(container);
      bindSourceAccessMatrixTaskActions(container);
      bindSourceAccessMethodRegistryActions(container, accessMethodRegistry);
      bindSourceAccessReviewTaskSnapshotActions(container, "sources");
      bindSourceEvidenceCoverageTaskSnapshotActions(container, "sources");
      bindSourceValidationWorkflowTaskSnapshotActions(container, "sources");
      bindDataSourcesAccessValidationWorkflowSnapshotActions(container, workflowSnapshots || []);
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
      const [governance, executionViews, executionPolicy, governanceTaskUpdateLedger, governanceTaskUpdateLedgerSnapshotDiff, releaseSummary, releaseCheckpointDrift, releaseBuildGate, releaseTaskLedgerSnapshotDiff, agentControlPlaneDecisionTaskLedgerSnapshotDiff, agentExecutionResultTaskLedgerSnapshotDiff, dataSourceAccessTaskLedgerSnapshotDiff, cliBridgeRunTraceSnapshotDiff, cliBridgeRunTraceSnapshotBaselineStatus, convergenceCandidates, convergenceOperatorProposalQueue, convergenceAssimilationRunLedger, convergenceAssimilationResultLedger, convergenceAssimilationResultCheckpointLedger, convergenceAssimilationReadinessGate, convergenceAssimilationSessionPacketSnapshotDiff, convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff, convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger, convergenceAssimilationRunnerLaunchControlBoard, convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff, convergenceAssimilationRunnerLaunchpadGateSnapshotDiff, convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger, convergenceAssimilationSessionPacketDriftCheckpointLedger, convergenceTaskLedgerSnapshotDiff] = await Promise.all([
        api.fetchGovernance(),
        api.fetchGovernanceExecutionViews(),
        api.fetchGovernanceExecutionPolicy(),
        api.fetchGovernanceTaskUpdateLedger({ limit: 50 }),
        api.fetchGovernanceTaskUpdateLedgerSnapshotDiff("latest"),
        api.fetchReleaseSummary(),
        api.fetchReleaseCheckpointDrift("latest"),
        api.fetchReleaseBuildGate(),
        api.fetchReleaseTaskLedgerSnapshotDiff("latest"),
        api.fetchAgentControlPlaneDecisionTaskLedgerSnapshotDiff("latest"),
        api.fetchAgentExecutionResultTaskLedgerSnapshotDiff("latest"),
        api.fetchSourcesAccessTaskLedgerSnapshotDiff("latest"),
        api.fetchCliBridgeRunTraceSnapshotDiff("latest"),
        api.fetchCliBridgeRunTraceSnapshotBaselineStatus(),
        api.fetchConvergenceCandidates({ status: "all", includeNotRelated: true }),
        api.fetchConvergenceOperatorProposalQueue("active"),
        api.fetchConvergenceAssimilationRunLedger("all"),
        api.fetchConvergenceAssimilationResultLedger("all"),
        api.fetchConvergenceAssimilationResultCheckpointLedger("all"),
        api.fetchConvergenceAssimilationReadinessGate(),
        api.fetchConvergenceAssimilationSessionPacketSnapshotDiff("latest"),
        api.fetchConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff("latest"),
        api.fetchConvergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger("all"),
        api.fetchConvergenceAssimilationRunnerLaunchControlBoard({ runner: "codex" }),
        api.fetchConvergenceAssimilationRunnerLaunchControlBoardSnapshotDiff("latest"),
        api.fetchConvergenceAssimilationRunnerLaunchpadGateSnapshotDiff("latest"),
        api.fetchConvergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger("all"),
        api.fetchConvergenceAssimilationSessionPacketDriftCheckpointLedger("all"),
        api.fetchConvergenceTaskLedgerSnapshotDiff("latest")
      ]);
      governanceCache = {
        ...governance,
        convergenceCandidates,
        convergenceOperatorProposalQueue,
        convergenceAssimilationRunLedger,
        convergenceAssimilationResultLedger,
        convergenceAssimilationResultCheckpointLedger,
        convergenceAssimilationReadinessGate,
        convergenceAssimilationSessionPacketSnapshotDiff,
        convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff,
        convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger,
        convergenceAssimilationRunnerLaunchControlBoard,
        convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff,
        convergenceAssimilationRunnerLaunchpadGateSnapshotDiff,
        convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger,
        convergenceAssimilationSessionPacketDriftCheckpointLedger,
        governanceTaskUpdateLedger,
        governanceTaskUpdateLedgerSnapshotDiff,
        releaseSummary,
        releaseCheckpointDrift,
        releaseBuildGate,
        releaseTaskLedgerSnapshotDiff,
        agentControlPlaneDecisionTaskLedgerSnapshotDiff,
        agentExecutionResultTaskLedgerSnapshotDiff,
        dataSourceAccessTaskLedgerSnapshotDiff,
        cliBridgeRunTraceSnapshotDiff,
        cliBridgeRunTraceSnapshotBaselineStatus,
        convergenceTaskLedgerSnapshotDiff
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
        + (convergenceCandidates ? 1 : 0)
        + (convergenceCandidates?.candidates || []).length
        + (convergenceOperatorProposalQueue ? 1 : 0)
        + (convergenceOperatorProposalQueue?.items || []).length
        + (convergenceAssimilationRunLedger ? 1 : 0)
        + (convergenceAssimilationRunLedger?.runs || []).length
        + (convergenceAssimilationResultLedger ? 1 : 0)
        + (convergenceAssimilationResultLedger?.results || []).length
        + (convergenceAssimilationResultCheckpointLedger ? 1 : 0)
        + (convergenceAssimilationResultCheckpointLedger?.items || []).length
        + (convergenceAssimilationReadinessGate ? 1 : 0)
        + (convergenceAssimilationReadinessGate?.reasons || []).length
        + (governance.convergenceAssimilationSessionPacketSnapshots || []).length
        + (governance.convergenceAssimilationRunnerLaunchpadGateSnapshots || []).length
        + (governance.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshots || []).length
        + (convergenceAssimilationSessionPacketSnapshotDiff ? 1 : 0)
        + (convergenceAssimilationSessionPacketSnapshotDiff?.driftItems || []).length
        + (convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff ? 1 : 0)
        + (convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff?.driftItems || []).length
        + (convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger ? 1 : 0)
        + (convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger?.items || []).length
        + (convergenceAssimilationRunnerLaunchControlBoard ? 1 : 0)
        + (convergenceAssimilationRunnerLaunchControlBoard?.reasons || []).length
        + (governance.convergenceAssimilationRunnerLaunchControlBoardSnapshots || []).length
        + (convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff ? 1 : 0)
        + (convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff?.driftItems || []).length
        + (convergenceAssimilationRunnerLaunchpadGateSnapshotDiff ? 1 : 0)
        + (convergenceAssimilationRunnerLaunchpadGateSnapshotDiff?.driftItems || []).length
        + (convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger ? 1 : 0)
        + (convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger?.items || []).length
        + (convergenceAssimilationSessionPacketDriftCheckpointLedger ? 1 : 0)
        + (convergenceAssimilationSessionPacketDriftCheckpointLedger?.items || []).length
        + (governance.convergenceTasks || []).length
        + (governance.convergenceTaskLedgerSnapshots || []).length
        + (convergenceTaskLedgerSnapshotDiff ? 1 : 0)
        + (convergenceTaskLedgerSnapshotDiff?.driftItems || []).length
        + (governanceTaskUpdateLedger?.items || []).length
        + (governanceTaskUpdateLedgerSnapshotDiff ? 1 : 0)
        + (governanceTaskUpdateLedgerSnapshotDiff?.driftItems || []).length
        + governance.workflowRunbook.length
        + governance.agentSessions.length
        + (governance.agentControlPlaneBaselineStatus ? 1 : 0)
        + (governance.agentControlPlaneDecision ? 1 : 0)
        + (governance.agentControlPlaneDecisionTasks || []).length
        + (governance.agentControlPlaneDecisionTaskLedgerSnapshots || []).length
        + (governance.agentExecutionResultTaskLedgerSnapshots || []).length
        + (governance.releaseControlTasks || []).length
        + (governance.dataSourcesAccessGate ? 1 : 0)
        + (governance.dataSourcesAccessReviewQueue?.items || []).length
        + (governance.dataSourcesAccessValidationRunbook?.methods || []).length
        + (governance.dataSourcesAccessValidationWorkflow?.items || []).length
        + (governance.dataSourceAccessValidationWorkflowSnapshots || []).length
        + (governance.dataSourceAccessValidationWorkflowSnapshotDiff ? 1 : 0)
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
        + (governance.cliBridgeRunTraceSnapshots || []).length
        + (cliBridgeRunTraceSnapshotDiff ? 1 : 0)
        + (cliBridgeRunTraceSnapshotDiff?.driftItems || []).length
        + (cliBridgeRunTraceSnapshotBaselineStatus ? 1 : 0)
        + (governance.agentExecutionSlaLedger || []).length
        + governance.agentWorkOrderRuns.length
        + governance.unprofiledProjects.length
        + (releaseSummary ? 1 : 0)
        + (releaseSummary?.checkpoints || []).length
        + (releaseCheckpointDrift ? 1 : 0)
        + (releaseCheckpointDrift?.driftItems || []).length
        + (releaseBuildGate ? 1 : 0)
        + (releaseBuildGate?.reasons || []).length
        + (releaseBuildGate?.actions || []).length
        + (releaseTaskLedgerSnapshotDiff ? 1 : 0)
        + (releaseTaskLedgerSnapshotDiff?.driftItems || []).length
        + (agentControlPlaneDecisionTaskLedgerSnapshotDiff ? 1 : 0)
        + (agentControlPlaneDecisionTaskLedgerSnapshotDiff?.driftItems || []).length
        + (agentExecutionResultTaskLedgerSnapshotDiff ? 1 : 0)
        + (agentExecutionResultTaskLedgerSnapshotDiff?.driftItems || []).length
        + (dataSourceAccessTaskLedgerSnapshotDiff ? 1 : 0)
        + (dataSourceAccessTaskLedgerSnapshotDiff?.driftItems || []).length;

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
      taskSeedingStatus: filters.taskSeedingStatus,
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

  async function copyGovernanceTaskUpdateLedger() {
    const payload = await api.fetchGovernanceTaskUpdateLedger({ limit: 100 });
    await copyText(payload.markdown);
    return `Copied ${payload.summary.visible} task update${payload.summary.visible === 1 ? "" : "s"}`;
  }

  async function saveGovernanceTaskUpdateLedgerSnapshot() {
    await api.createGovernanceTaskUpdateLedgerSnapshot({
      title: "Governance Task Update Ledger",
      limit: 100
    });
    await renderGovernance();
    return "Saved Task Audit Snapshot";
  }

  async function copyLatestGovernanceTaskUpdateLedgerSnapshotDrift() {
    const diff = await api.fetchGovernanceTaskUpdateLedgerSnapshotDiff("latest");
    await copyText(diff.markdown);
    return diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : diff.hasSnapshot ? "No Drift" : "No Snapshot";
  }

  function findCliBridgeRunTraceSnapshot(snapshotId) {
    const snapshots = Array.isArray(governanceCache?.cliBridgeRunTraceSnapshots)
      ? governanceCache.cliBridgeRunTraceSnapshots
      : [];
    if (snapshotId === "latest") {
      return [...snapshots].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] || null;
    }
    return snapshots.find((snapshot) => snapshot.id === snapshotId) || null;
  }

  function getCliBridgeRunTraceSnapshotDriftTaskPriority(severity) {
    if (severity === "high") return "high";
    if (severity === "medium" || severity === "missing-snapshot") return "medium";
    return "low";
  }

  function buildCliBridgeRunTraceSnapshotDriftTaskDescription(snapshot, diff) {
    const driftItems = Array.isArray(diff.driftItems) ? diff.driftItems : [];
    const snapshotSummary = diff.snapshotSummary || {};
    const liveSummary = diff.liveSummary || {};
    const lines = [
      `Review CLI bridge run trace drift from snapshot ${diff.snapshotTitle || snapshot?.title || diff.snapshotId || "latest snapshot"}.`,
      `Snapshot ID: ${diff.snapshotId || snapshot?.id || "missing"}.`,
      `Run ID: ${diff.runId || snapshot?.runId || "missing"}.`,
      `Drift severity: ${diff.driftSeverity || "none"}; score: ${diff.driftScore || 0}.`,
      `Recommended action: ${diff.recommendedAction || "Review CLI bridge run trace drift before accepting the live trace as the new baseline."}`,
      `Trace decision: ${snapshotSummary.traceDecision || "missing"} -> ${liveSummary.traceDecision || "missing"}.`,
      `Run status: ${snapshotSummary.runStatus || "missing"} -> ${liveSummary.runStatus || "missing"}.`,
      `Related handoffs: ${snapshotSummary.relatedHandoffCount ?? 0} -> ${liveSummary.relatedHandoffCount ?? 0}.`,
      "Secret policy: non-secret CLI bridge run trace drift metadata only; do not store passwords, tokens, certificates, private keys, cookies, browser sessions, raw command output, or provider credentials."
    ];

    if (driftItems.length) {
      lines.push("Drift fields:");
      driftItems.slice(0, 10).forEach((item) => {
        lines.push(`- ${item.label || item.field || "CLI bridge trace drift"}: ${item.before ?? "none"} -> ${item.current ?? "none"} (${item.delta >= 0 ? "+" : ""}${item.delta ?? 0})`);
      });
    }

    return lines.join("\n");
  }

  async function createCliBridgeRunTraceSnapshotDriftReviewTask(snapshotId) {
    const snapshot = findCliBridgeRunTraceSnapshot(snapshotId);
    const diff = await api.fetchCliBridgeRunTraceSnapshotDiff(snapshotId || "latest");
    const title = `Review CLI bridge run trace drift: ${diff.snapshotTitle || snapshot?.title || diff.snapshotId || "latest snapshot"}`;
    await api.createTask({
      projectId: snapshot?.projectId || "cli-bridge",
      projectName: snapshot?.projectName || "CLI Bridge",
      title: title.slice(0, 140),
      description: buildCliBridgeRunTraceSnapshotDriftTaskDescription(snapshot, diff),
      priority: getCliBridgeRunTraceSnapshotDriftTaskPriority(diff.driftSeverity),
      status: "open"
    });
    await renderGovernance();
    return "Created CLI bridge run trace drift review task";
  }

  async function acceptCliBridgeRunTraceSnapshotDrift(snapshotId) {
    const snapshot = findCliBridgeRunTraceSnapshot(snapshotId);
    const diff = await api.fetchCliBridgeRunTraceSnapshotDiff(snapshotId || "latest");
    const runId = diff.runId || snapshot?.runId || "";
    if (!runId) throw new Error("Cannot accept CLI bridge run trace drift without a source run id.");

    const sourceTitle = diff.snapshotTitle || snapshot?.title || snapshotId || "latest snapshot";
    await api.createCliBridgeRunTraceSnapshot(runId, {
      title: `Accepted CLI bridge run trace drift as current baseline: ${sourceTitle}`.slice(0, 120)
    });
    await renderGovernance();
    return "Accepted CLI bridge run trace drift as current baseline";
  }

  function findCliBridgeRunTraceSnapshotDriftItem(field) {
    const diff = governanceCache?.cliBridgeRunTraceSnapshotDiff || null;
    const driftItems = Array.isArray(diff?.driftItems) ? diff.driftItems : [];
    const item = driftItems.find((candidate) => candidate.field === field || candidate.label === field) || null;
    return { diff, item };
  }

  function getCliBridgeRunTraceSnapshotDriftItemDecision(decision) {
    if (decision === "escalated") return { status: "blocked", priority: "high", label: "Escalated" };
    if (decision === "deferred") return { status: "deferred", priority: "medium", label: "Deferred" };
    return { status: "resolved", priority: "low", label: "Confirmed" };
  }

  function buildCliBridgeRunTraceSnapshotDriftItemDescription(decision, diff, item) {
    const label = item?.label || item?.field || "CLI bridge run trace drift";
    return [
      `Operator ${decision.label.toLowerCase()} CLI bridge run trace drift item ${label}.`,
      `Snapshot: ${diff?.snapshotTitle || diff?.snapshotId || "latest CLI bridge run trace snapshot"}.`,
      `Run ID: ${diff?.runId || "missing"}.`,
      `Field: ${item?.field || label}.`,
      `Previous: ${item?.before ?? "none"}; current: ${item?.current ?? "none"}; delta: ${item?.delta ?? 0}.`,
      `Drift severity: ${diff?.driftSeverity || "none"}; score: ${diff?.driftScore || 0}.`,
      "Secret policy: non-secret CLI bridge run trace drift metadata only; do not store passwords, tokens, certificates, private keys, cookies, browser sessions, raw command output, or provider credentials."
    ].join(" ");
  }

  async function updateCliBridgeRunTraceSnapshotDriftItemCheckpoint(field, checkpointDecision) {
    const { diff, item } = findCliBridgeRunTraceSnapshotDriftItem(field);
    if (!diff) throw new Error("CLI bridge run trace snapshot drift is not loaded.");
    if (!item) throw new Error(`CLI bridge run trace drift item not found: ${field}`);

    const decision = getCliBridgeRunTraceSnapshotDriftItemDecision(checkpointDecision);
    await api.createTask({
      projectId: "cli-bridge",
      projectName: "CLI Bridge",
      title: `CLI trace drift ${decision.label.toLowerCase()}: ${item.label || item.field || field}`.slice(0, 140),
      description: buildCliBridgeRunTraceSnapshotDriftItemDescription(decision, diff, item),
      priority: decision.priority,
      status: decision.status
    });
    await renderGovernance();
    return decision.label;
  }

  function getGovernanceTaskUpdateLedgerCheckpointDecision(action) {
    if (action === "escalate") return { status: "blocked", priority: "high", label: "Escalated" };
    if (action === "defer") return { status: "deferred", priority: "medium", label: "Deferred" };
    return { status: "resolved", priority: "low", label: "Confirmed" };
  }

  function buildGovernanceTaskUpdateLedgerItemCheckpointDescription(decision, item) {
    return [
      `Operator ${decision.label.toLowerCase()} Governance task update audit row ${item.operationId || item.taskId || "unknown"}.`,
      `Task: ${item.title || item.taskId || "unknown task"}.`,
      `Project: ${item.projectName || item.projectId || "unassigned"}.`,
      `Status transition: ${item.previousStatus || "unset"} -> ${item.nextStatus || "unset"}.`,
      `Changed fields: ${Array.isArray(item.updatedFields) && item.updatedFields.length ? item.updatedFields.join(", ") : "none recorded"}.`,
      "Secret policy: non-secret Governance task update audit metadata only; do not store response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
    ].join(" ");
  }

  async function createGovernanceTaskUpdateLedgerItemCheckpoint(operationId, action) {
    const item = (governanceCache?.governanceTaskUpdateLedger?.items || [])
      .find((candidate) => candidate.operationId === operationId);
    if (!item) throw new Error(`Governance task update audit row not found: ${operationId}`);

    const decision = getGovernanceTaskUpdateLedgerCheckpointDecision(action);
    await api.createTask({
      projectId: item.projectId || "governance",
      projectName: item.projectName || "Governance",
      title: `Task update audit ${decision.label.toLowerCase()}: ${item.title || item.taskId || operationId}`.slice(0, 140),
      description: buildGovernanceTaskUpdateLedgerItemCheckpointDescription(decision, item),
      priority: decision.priority,
      status: decision.status
    });
    await renderGovernance();
    return decision.label;
  }

  function findGovernanceTaskUpdateLedgerDriftItem(field) {
    const diff = governanceCache?.governanceTaskUpdateLedgerSnapshotDiff || null;
    const driftItems = Array.isArray(diff?.driftItems) ? diff.driftItems : [];
    const item = driftItems.find((candidate) => candidate.field === field || candidate.label === field) || null;
    return { diff, item };
  }

  function buildGovernanceTaskUpdateLedgerDriftItemCheckpointDescription(decision, diff, item) {
    const label = item?.label || item?.field || "Governance task update audit ledger drift";
    return [
      `Operator ${decision.label.toLowerCase()} Governance task update audit ledger drift item ${label}.`,
      `Snapshot: ${diff?.snapshotTitle || diff?.snapshotId || "latest Governance task update audit ledger snapshot"}.`,
      `Field: ${item?.field || label}.`,
      `Previous: ${item?.before ?? "none"}; current: ${item?.current ?? "none"}; delta: ${item?.delta ?? 0}.`,
      `Drift severity: ${diff?.driftSeverity || "none"}; score: ${diff?.driftScore || 0}.`,
      "Secret policy: non-secret Governance task update audit ledger drift metadata only; do not store response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
    ].join(" ");
  }

  async function createGovernanceTaskUpdateLedgerDriftItemCheckpoint(field, checkpointDecision) {
    const { diff, item } = findGovernanceTaskUpdateLedgerDriftItem(field);
    if (!diff) throw new Error("Governance task update audit ledger snapshot drift is not loaded.");
    if (!item) throw new Error(`Governance task update audit ledger drift item not found: ${field}`);

    const decision = getGovernanceTaskUpdateLedgerCheckpointDecision(checkpointDecision);
    await api.createTask({
      projectId: "governance",
      projectName: "Governance",
      title: `Task update audit drift ${decision.label.toLowerCase()}: ${item.label || item.field || field}`.slice(0, 140),
      description: buildGovernanceTaskUpdateLedgerDriftItemCheckpointDescription(decision, diff, item),
      priority: decision.priority,
      status: decision.status
    });
    await renderGovernance();
    return decision.label;
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

  async function copySourcesAccessMethodRegistry() {
    const payload = await api.fetchSourcesAccessMethodRegistry();
    await copyText(payload.markdown);
    return `Copied ${payload.summary.totalMethods} access method${payload.summary.totalMethods === 1 ? "" : "s"}`;
  }

  function getAccessMethodRegistryEvidenceStatus(method) {
    if ((method.blocked || 0) > 0) return "blocked";
    if ((method.reviewRequired || 0) > 0 || (method.review || 0) > 0) return "review";
    return "validated";
  }

  function buildAccessMethodRegistryEvidenceDefault(method, status) {
    if (status === "validated") {
      return `Confirmed ${method.accessMethod} access method for ${method.sourceCount || 0} source(s) outside this app.`;
    }
    if (status === "blocked") {
      return `${method.accessMethod} has blocked source access; credentials, certificates, or operator access must be resolved outside this app.`;
    }
    return `${method.accessMethod} needs operator review for ${method.reviewRequired || method.review || 0} source(s); access must be verified outside this app.`;
  }

  async function recordSourceAccessMethodRegistryEvidence(method) {
    const sources = (method.sources || []).filter((source) => source.id);
    if (!sources.length) return "No Sources";

    const status = getAccessMethodRegistryEvidenceStatus(method);
    const evidence = window.prompt(
      `Enter non-secret method-level access evidence for ${method.title || method.accessMethod}.\n\nThis will create one evidence record per source in this method. Do not paste passwords, tokens, certificates, private keys, cookies, browser sessions, or command output.`,
      buildAccessMethodRegistryEvidenceDefault(method, status)
    );
    if (evidence == null || !evidence.trim()) return "Cancelled";

    const checkedAt = new Date().toISOString();
    for (const source of sources) {
      await api.createSourcesAccessValidationEvidence({
        sourceId: source.id,
        status,
        accessMethod: method.accessMethod || source.accessMethod || "review-required",
        evidence: `${evidence.trim()}\nMethod registry source: ${source.label || source.id}.`,
        checkedAt
      });
    }

    await renderSources();
    return `Recorded ${sources.length} Evidence`;
  }

  async function copySourcesAccessValidationWorkflow() {
    const payload = await api.fetchSourcesAccessValidationWorkflow();
    await copyText(payload.markdown);
    return `Copied ${payload.summary.pending} pending`;
  }

  async function saveSourcesAccessValidationWorkflowSnapshot(options = {}) {
    const created = await api.createSourcesAccessValidationWorkflowSnapshot({
      title: "Data Sources Access Validation Workflow"
    });
    if (options.renderTarget === "governance") {
      await renderGovernance();
    } else {
      await renderSources();
    }
    return `Saved ${created.snapshot.total} workflow item${created.snapshot.total === 1 ? "" : "s"}`;
  }

  async function copyLatestSourcesAccessValidationWorkflowSnapshotDrift() {
    const diff = await api.fetchSourcesAccessValidationWorkflowSnapshotDiff("latest");
    await copyText(diff.markdown);
    return diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : diff.hasSnapshot ? "No Drift" : "No Snapshot";
  }

  function getTaskSeedingCheckpointStatusLabel(status) {
    if (status === "deferred") return "Deferred";
    if (status === "dismissed") return "Dismissed";
    if (status === "approved") return "Approved";
    return "Marked";
  }

  async function recordGeneratedTaskBatchCheckpoint({
    batchId,
    status,
    title,
    source,
    itemCount,
    note,
    renderTarget
  }) {
    const allowedStatuses = new Set(["approved", "deferred", "dismissed", "needs-review"]);
    const checkpointStatus = allowedStatuses.has(status) ? status : "needs-review";
    await api.createTaskSeedingCheckpoint({
      batchId,
      title,
      source,
      status: checkpointStatus,
      itemCount,
      note
    });
    if (renderTarget === "sources") {
      await renderSources();
    } else {
      await renderGovernance();
    }
    return `${getTaskSeedingCheckpointStatusLabel(checkpointStatus)} ${title}`;
  }

  async function checkpointSourcesAccessValidationWorkflowTasks(status, options = {}) {
    const workflow = await api.fetchSourcesAccessValidationWorkflow();
    const items = workflow.items.filter((item) => item.status !== "ready");
    const renderTarget = options.renderTarget === "governance" ? "governance" : "sources";
    const surface = renderTarget === "governance" ? "Governance" : "Sources";
    return recordGeneratedTaskBatchCheckpoint({
      batchId: "data-sources-access-validation-workflow-tasks",
      title: "Data Sources access validation workflow task batch",
      source: renderTarget === "governance" ? "governance-data-sources-access-validation-workflow" : "sources-access-validation-workflow",
      status,
      itemCount: items.length,
      renderTarget,
      note: `Operator marked the Data Sources access validation workflow generated task batch as ${status} from the ${surface} task-seeding checkpoint before creating tasks.`
    });
  }

  async function seedSourcesAccessValidationWorkflowTasks(options = {}) {
    const workflow = await api.fetchSourcesAccessValidationWorkflow();
    const items = workflow.items.filter((item) => item.status !== "ready");
    if (!items.length) return "No Workflow Tasks";
    const result = await api.createSourcesAccessValidationWorkflowTasks({
      items,
      saveSnapshot: true,
      snapshotTitle: "Data Sources Access Validation Workflow Task Ledger Auto Capture",
      snapshotStatus: "open",
      snapshotLimit: 100
    });
    if (options.renderTarget === "governance") {
      await renderGovernance();
    } else {
      await renderSources();
    }
    return result.snapshotCaptured
      ? `Created ${result.totals.created} Workflow Task${result.totals.created === 1 ? "" : "s"} + Snapshot`
      : `Created ${result.totals.created} Workflow Task${result.totals.created === 1 ? "" : "s"}`;
  }

  async function createSourceValidationWorkflowTaskWithSnapshot(itemId, renderTarget = "governance") {
    const cachedWorkflow = renderTarget === "governance"
      ? getFilteredGovernance()?.dataSourcesAccessValidationWorkflow
      : null;
    const workflow = cachedWorkflow || await api.fetchSourcesAccessValidationWorkflow();
    const item = (workflow?.items || []).find((entry) => entry.id === itemId);
    if (!item) throw new Error(`Source validation workflow item not found: ${itemId}`);

    const label = item.label || item.sourceId || itemId;
    const result = await api.createSourcesAccessValidationWorkflowTasks({
      items: [item],
      saveSnapshot: true,
      snapshotTitle: `Data Sources Validation Workflow Task Ledger Auto Capture: ${label}`.slice(0, 120),
      snapshotStatus: "open",
      snapshotLimit: 100
    });
    if (renderTarget === "sources") {
      await renderSources();
    } else {
      await renderGovernance();
    }
    const taskLabel = `Created ${result.totals.created} Workflow Task${result.totals.created === 1 ? "" : "s"}`;
    return result.snapshotCaptured ? `${taskLabel} + Snapshot` : taskLabel;
  }

  async function createSourceAccessChecklistWorkflowTasks(sourceId) {
    const workflow = await api.fetchSourcesAccessValidationWorkflow();
    const items = (workflow?.items || [])
      .filter((item) => item.sourceId === sourceId && item.status !== "ready");
    if (!items.length) return "No Workflow Tasks";

    const label = items[0]?.label || sourceId;
    const result = await api.createSourcesAccessValidationWorkflowTasks({
      items,
      saveSnapshot: true,
      snapshotTitle: `Data Sources Checklist Workflow Task Ledger Auto Capture: ${label}`.slice(0, 120),
      snapshotStatus: "open",
      snapshotLimit: 100
    });
    await renderSources();
    const created = result.totals.created || 0;
    const skipped = result.totals.skipped || 0;
    const taskLabel = created
      ? `Created ${created} Checklist Task${created === 1 ? "" : "s"}`
      : `Skipped ${skipped} Checklist Task${skipped === 1 ? "" : "s"}`;
    return result.snapshotCaptured ? `${taskLabel} + Snapshot` : taskLabel;
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

  async function createDeploymentHealthReleaseTask(targetId) {
    const deploymentHealth = await api.fetchDeploymentHealth();
    const target = (deploymentHealth.targets || []).find((item) => item.id === targetId);
    if (!target) throw new Error(`Deployment health target not found: ${targetId}`);

    const latestSmokeCheck = target.latestSmokeCheck || null;
    const priority = latestSmokeCheck?.status === "fail" || target.sourceHealth === "blocked"
      ? "high"
      : target.protectedLikely
        ? "medium"
        : "low";
    const label = `Review deployment health: ${target.label || target.host || target.url || target.id}`;
    const action = {
      id: `deployment-health:${target.id || target.host || target.url}`,
      label,
      status: "open",
      priority,
      description: [
        `Review non-secret deployment target ${target.label || target.host || target.url || "target"}.`,
        `Provider: ${target.provider || "deployment"}.`,
        `Access method: ${target.accessMethod || "url-review"}.`,
        `Protected/review likely: ${target.protectedLikely ? "yes" : "no"}.`,
        latestSmokeCheck
          ? `Latest smoke check: ${(latestSmokeCheck.status || "fail").toUpperCase()} HTTP ${latestSmokeCheck.httpStatus || "unreachable"} at ${latestSmokeCheck.checkedAt || "not recorded"}.`
          : "Latest smoke check: not recorded.",
        "Secret policy: store only non-secret deployment URL/status metadata. Do not store credentials, provider tokens, cookies, certificates, private keys, browser sessions, or response bodies."
      ].join(" "),
      commandHint: target.url ? `Use the Sources deployment-health Smoke Check action for ${target.url}.` : "Use the Sources deployment-health Smoke Check action."
    };

    const result = await api.createReleaseBuildGateActionTasks({
      actions: [action],
      saveSnapshot: true,
      snapshotTitle: `Release Control Deployment Health Task Auto Capture: ${target.label || target.host || target.id}`.slice(0, 120),
      snapshotStatus: "all",
      snapshotLimit: 100
    });
    await renderSources();
    const created = result.totals.created || 0;
    const skipped = result.totals.skipped || 0;
    const taskLabel = created
      ? `Created ${created} Release Task${created === 1 ? "" : "s"}`
      : `Skipped ${skipped} Release Task${skipped === 1 ? "" : "s"}`;
    return result.snapshotCaptured ? `${taskLabel} + Snapshot` : taskLabel;
  }

  async function createDeploymentSmokeCheckReleaseTask(smokeCheckId) {
    const ledger = await api.fetchDeploymentSmokeChecks();
    const smokeCheck = (ledger.smokeChecks || []).find((item) => item.id === smokeCheckId);
    if (!smokeCheck) throw new Error(`Deployment smoke check not found: ${smokeCheckId}`);

    const priority = smokeCheck.status === "fail" ? "high" : "low";
    const label = `Review deployment smoke check: ${smokeCheck.label || smokeCheck.host || smokeCheck.url || smokeCheck.id}`;
    const action = {
      id: `deployment-smoke-check:${smokeCheck.id}`,
      label,
      status: "open",
      priority,
      description: [
        `Review non-secret deployment smoke-check outcome ${smokeCheck.id}.`,
        `Target: ${smokeCheck.label || smokeCheck.host || smokeCheck.url || "deployment target"}.`,
        `Provider: ${smokeCheck.provider || "deployment"}.`,
        `Status: ${(smokeCheck.status || "fail").toUpperCase()} HTTP ${smokeCheck.httpStatus || "unreachable"}.`,
        `Latency: ${smokeCheck.latencyMs || 0}ms; content type: ${smokeCheck.contentType || "not captured"}.`,
        smokeCheck.error ? `Error class: ${smokeCheck.error}.` : "",
        "Secret policy: store only non-secret deployment smoke-check metadata. Do not store credentials, provider tokens, cookies, certificates, private keys, browser sessions, response bodies, or command output."
      ].filter(Boolean).join(" "),
      commandHint: smokeCheck.url ? `Use the Sources deployment-health Smoke Check action for ${smokeCheck.url}.` : "Use the Sources deployment-health Smoke Check action."
    };

    const result = await api.createReleaseBuildGateActionTasks({
      actions: [action],
      saveSnapshot: true,
      snapshotTitle: `Release Control Smoke Check Task Auto Capture: ${smokeCheck.label || smokeCheck.host || smokeCheck.id}`.slice(0, 120),
      snapshotStatus: "all",
      snapshotLimit: 100
    });
    await renderSources();
    const created = result.totals.created || 0;
    const skipped = result.totals.skipped || 0;
    const taskLabel = created
      ? `Created ${created} Smoke Task${created === 1 ? "" : "s"}`
      : `Skipped ${skipped} Smoke Task${skipped === 1 ? "" : "s"}`;
    return result.snapshotCaptured ? `${taskLabel} + Snapshot` : taskLabel;
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

  function getDataSourcesSummaryDriftTaskPriority(severity) {
    if (severity === "high") return "high";
    if (severity === "medium") return "medium";
    return "low";
  }

  function buildDataSourcesSummaryDriftTaskDescription(snapshot, diff) {
    const driftItems = Array.isArray(diff.driftItems) ? diff.driftItems : [];
    const snapshotSummary = diff.snapshotSummary || {};
    const liveSummary = diff.liveSummary || {};
    const lines = [
      `Review Data Sources health summary drift from snapshot ${diff.snapshotTitle || snapshot.title || snapshot.id}.`,
      `Snapshot ID: ${diff.snapshotId || snapshot.id}.`,
      `Drift severity: ${diff.driftSeverity || "none"}; score: ${diff.driftScore || 0}.`,
      `Recommended action: ${diff.recommendedAction || "Review source-health drift before the next ingestion or agent handoff."}`,
      `Ready sources: ${snapshotSummary.ready ?? 0} -> ${liveSummary.ready ?? 0}; review sources: ${snapshotSummary.review ?? 0} -> ${liveSummary.review ?? 0}; blocked sources: ${snapshotSummary.blocked ?? 0} -> ${liveSummary.blocked ?? 0}.`,
      "Secret policy: non-secret Data Sources health summary metadata only; do not store passwords, tokens, certificates, private keys, cookies, browser sessions, or command output."
    ];

    if (driftItems.length) {
      lines.push("Drift fields:");
      driftItems.slice(0, 10).forEach((item) => {
        lines.push(`- ${item.label || item.field || "Data Sources health drift"}: ${item.before ?? "none"} -> ${item.current ?? "none"} (${item.delta >= 0 ? "+" : ""}${item.delta ?? 0})`);
      });
    }

    return lines.join("\n");
  }

  async function createDataSourcesSummaryDriftReviewTask(snapshot) {
    const diff = await api.fetchSourcesSummarySnapshotDiff(snapshot.id);
    const title = `Review Data Sources health summary drift: ${diff.snapshotTitle || snapshot.title || snapshot.id}`;
    await api.createTask({
      projectId: "data-sources",
      projectName: "Data Sources",
      title,
      description: buildDataSourcesSummaryDriftTaskDescription(snapshot, diff),
      priority: getDataSourcesSummaryDriftTaskPriority(diff.driftSeverity),
      status: "open"
    });
    await renderSources();
    return "Created Data Sources summary drift review task";
  }

  async function acceptDataSourcesSummarySnapshotDrift(snapshot) {
    const diff = await api.fetchSourcesSummarySnapshotDiff(snapshot.id);
    const sourceTitle = diff.snapshotTitle || snapshot.title || snapshot.id;
    await api.createSourcesSummarySnapshot({
      title: `Accepted Data Sources summary drift as current baseline: ${sourceTitle}`.slice(0, 120)
    });
    await renderSources();
    return "Accepted Data Sources summary drift as current baseline";
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

  function getReleaseCheckpointDriftContext() {
    const governance = getFilteredGovernance() || {};
    const drift = governance.releaseCheckpointDrift || null;
    const driftItems = Array.isArray(drift?.driftItems) ? drift.driftItems : [];
    return {
      drift,
      driftItems
    };
  }

  function findReleaseCheckpointDriftField(field) {
    const { drift, driftItems } = getReleaseCheckpointDriftContext();
    const item = driftItems.find((candidate) => candidate.field === field || candidate.label === field) || null;
    return {
      drift,
      item
    };
  }

  function buildReleaseCheckpointDriftFieldNotes(decision, drift, item) {
    return [
      `Operator ${decision} Release Control checkpoint drift field ${item.field || item.label || "field"}.`,
      `Snapshot: ${drift?.snapshotTitle || drift?.snapshotId || "latest release checkpoint"}.`,
      `Field: ${item.label || item.field}; previous: ${item.before || "none"}; current: ${item.current || "none"}; severity: ${item.severity || "review"}.`,
      `Drift severity: ${drift?.driftSeverity || "none"}; score: ${drift?.driftScore || 0}.`,
      `Recommended action: ${drift?.recommendedAction || "Review release checkpoint drift before changing release readiness."}`,
      "Secret policy: non-secret release checkpoint drift metadata only; do not store response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
    ].join(" ");
  }

  async function createReleaseCheckpointDriftFieldDecision(field, checkpointDecision) {
    const { drift, item } = findReleaseCheckpointDriftField(field);
    if (!item) throw new Error(`Release checkpoint drift field not found: ${field}`);

    const normalizedDecision = checkpointDecision === "confirmed" ? "confirmed" : "deferred";
    const status = normalizedDecision === "confirmed" ? drift?.live?.status || "review" : "review";
    const created = await api.createReleaseCheckpoint({
      title: `Release checkpoint drift ${normalizedDecision}: ${item.label || item.field}`,
      status,
      notes: buildReleaseCheckpointDriftFieldNotes(normalizedDecision, drift, item)
    });
    await renderGovernance();
    return `${normalizedDecision === "confirmed" ? "Confirmed" : "Deferred"} ${created.checkpoint.status.toUpperCase()}`;
  }

  async function createReleaseCheckpointDriftFieldTask(field) {
    const { drift, item } = findReleaseCheckpointDriftField(field);
    if (!item) throw new Error(`Release checkpoint drift field not found: ${field}`);

    const priority = item.severity === "high" ? "high" : item.severity === "medium" ? "medium" : "low";
    const action = {
      id: `release-checkpoint-drift:${drift?.snapshotId || "latest"}:${item.field || item.label || "field"}`,
      label: `Review release checkpoint drift: ${item.label || item.field}`,
      status: "open",
      priority,
      description: [
        `Review Release Control checkpoint drift field ${item.field || item.label || "field"}.`,
        `Snapshot: ${drift?.snapshotTitle || drift?.snapshotId || "latest release checkpoint"}.`,
        `Previous: ${item.before || "none"}; current: ${item.current || "none"}; severity: ${item.severity || "review"}.`,
        `Drift severity: ${drift?.driftSeverity || "none"}; score: ${drift?.driftScore || 0}.`,
        `Recommended action: ${drift?.recommendedAction || "Review release checkpoint drift before changing release readiness."}`,
        "Secret policy: store only non-secret release checkpoint drift metadata. Do not store response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
      ].join(" "),
      commandHint: "Use Copy Drift and compare the latest Release Control checkpoint against live release evidence before accepting or remediating drift."
    };

    const payload = await api.createReleaseBuildGateActionTasks({
      actions: [action],
      saveSnapshot: true,
      snapshotTitle: `Release Control Drift Field Task Auto Capture: ${item.label || item.field}`.slice(0, 120),
      snapshotStatus: "all",
      snapshotLimit: 100
    });
    await renderGovernance();
    const taskLabel = payload.totals.created
      ? `Created ${payload.totals.created} Drift Task${payload.totals.created === 1 ? "" : "s"}`
      : `Skipped ${payload.totals.skipped} Drift Task${payload.totals.skipped === 1 ? "" : "s"}`;
    return payload.snapshotCaptured ? `${taskLabel} + Snapshot` : taskLabel;
  }

  async function copyReleaseBuildGate() {
    const payload = await api.fetchReleaseBuildGate();
    await copyText(payload.markdown);
    return `Copied ${payload.decision || "review"} release build gate`;
  }

  async function copyGovernanceReleaseTaskLedger() {
    const markdown = buildGovernanceReleaseTaskLedgerMarkdown();
    await copyText(markdown);
    return `Copied ${getFilteredGovernance()?.releaseControlTasks?.length || 0} Release Task${(getFilteredGovernance()?.releaseControlTasks?.length || 0) === 1 ? "" : "s"}`;
  }

  function findReleaseControlTask(taskId) {
    return (getFilteredGovernance()?.releaseControlTasks || [])
      .find((task) => task.id === taskId) || null;
  }

  async function updateReleaseControlTaskCheckpoint(taskId, action) {
    const task = findReleaseControlTask(taskId);
    if (!task) throw new Error(`Release Control task not found: ${taskId}`);

    const checkpointStatus = action === "escalate" ? "escalated" : action === "defer" ? "deferred" : "confirmed";
    const patch = {
      releaseControlTaskCheckpointStatus: checkpointStatus,
      releaseControlTaskCheckpointedAt: new Date().toISOString(),
      releaseControlTaskCheckpointNote: [
        `Operator ${checkpointStatus} Release Control task ${task.id || task.title || "task"}.`,
        `Release action: ${task.releaseBuildGateActionId || "release-control"}; gate decision: ${task.releaseBuildGateDecision || "review"}; risk score: ${task.releaseBuildGateRiskScore || 0}.`,
        "Secret policy: non-secret release-control task metadata only; do not store response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
      ].join(" ")
    };

    if (action === "defer") {
      patch.status = "deferred";
    } else if (action === "escalate") {
      patch.status = "blocked";
      patch.priority = "high";
    } else {
      patch.status = task.status === "deferred" ? "open" : task.status || "open";
    }

    const updated = await api.updateTask(taskId, patch);
    await renderGovernance();
    const nextTask = updated.task || patch;
    if (checkpointStatus === "escalated") return `Escalated ${nextTask.priority || "high"}`;
    if (checkpointStatus === "deferred") return "Deferred";
    return `Confirmed ${nextTask.status || "open"}`;
  }

  async function saveReleaseTaskLedgerSnapshot() {
    await api.createReleaseTaskLedgerSnapshot({
      title: "Release Control Task Ledger",
      status: "all",
      limit: 100
    });
    await renderGovernance();
    return "Saved Release Task Snapshot";
  }

  async function copyLatestReleaseTaskLedgerSnapshotDrift() {
    const diff = await api.fetchReleaseTaskLedgerSnapshotDiff("latest");
    await copyText(diff.markdown);
    return diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : diff.hasSnapshot ? "No Drift" : "No Snapshot";
  }

  function findReleaseTaskLedgerSnapshot(snapshotId) {
    return (governanceCache?.releaseTaskLedgerSnapshots || [])
      .find((snapshot) => snapshot.id === snapshotId) || null;
  }

  function findReleaseTaskLedgerDriftItem(field) {
    const diff = governanceCache?.releaseTaskLedgerSnapshotDiff || null;
    const driftItems = Array.isArray(diff?.driftItems) ? diff.driftItems : [];
    const item = driftItems.find((candidate) => candidate.field === field || candidate.label === field) || null;
    return { diff, item };
  }

  function getReleaseTaskLedgerDriftItemDecision(decision) {
    if (decision === "escalated") return { status: "blocked", priority: "high", label: "Escalated" };
    if (decision === "deferred") return { status: "deferred", priority: "medium", label: "Deferred" };
    return { status: "resolved", priority: "low", label: "Confirmed" };
  }

  function buildReleaseTaskLedgerDriftItemCheckpointDescription(decision, diff, item) {
    const label = item?.label || item?.field || "Release Control task ledger drift";
    return [
      `Operator ${decision.label.toLowerCase()} Release Control task ledger drift item ${label}.`,
      `Snapshot: ${diff?.snapshotTitle || diff?.snapshotId || "latest Release Control task ledger snapshot"}.`,
      `Field: ${item?.field || label}.`,
      `Previous: ${item?.before ?? "none"}; current: ${item?.current ?? "none"}; delta: ${item?.delta ?? 0}.`,
      `Drift severity: ${diff?.driftSeverity || "none"}; score: ${diff?.driftScore || 0}.`,
      "Secret policy: non-secret release-control task ledger drift metadata only; do not store response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
    ].join(" ");
  }

  async function updateReleaseTaskLedgerDriftItemCheckpoint(field, checkpointDecision) {
    const { diff, item } = findReleaseTaskLedgerDriftItem(field);
    if (!diff) throw new Error("Release Control task ledger snapshot drift is not loaded.");
    if (!item) throw new Error(`Release Control task ledger drift item not found: ${field}`);

    const decision = getReleaseTaskLedgerDriftItemDecision(checkpointDecision);
    await api.createTask({
      projectId: "release-control",
      projectName: "Release Control",
      title: `Release task ledger drift ${decision.label.toLowerCase()}: ${item.label || item.field || field}`.slice(0, 140),
      description: buildReleaseTaskLedgerDriftItemCheckpointDescription(decision, diff, item),
      priority: decision.priority,
      status: decision.status
    });
    await renderGovernance();
    return decision.label;
  }

  function getReleaseTaskLedgerDriftTaskPriority(severity) {
    if (severity === "high") return "high";
    if (severity === "medium") return "medium";
    return "low";
  }

  function buildReleaseTaskLedgerDriftTaskDescription(snapshot, diff) {
    const driftItems = Array.isArray(diff.driftItems) ? diff.driftItems : [];
    const snapshotSummary = diff.snapshotSummary || {};
    const liveSummary = diff.liveSummary || {};
    const lines = [
      `Review Release Control task ledger drift from snapshot ${diff.snapshotTitle || snapshot.title || snapshot.id}.`,
      `Snapshot ID: ${diff.snapshotId || snapshot.id}.`,
      `Drift severity: ${diff.driftSeverity || "none"}; score: ${diff.driftScore || 0}.`,
      `Recommended action: ${diff.recommendedAction || "Review Release Control task ledger drift before the next deployment or build handoff."}`,
      `Open tasks: ${snapshotSummary.open ?? 0} -> ${liveSummary.open ?? 0}; total tasks: ${snapshotSummary.total ?? 0} -> ${liveSummary.total ?? 0}.`,
      "Secret policy: non-secret Release Control task ledger metadata only; do not store deployment tokens, credentials, certificates, private keys, cookies, browser sessions, or command output."
    ];

    if (driftItems.length) {
      lines.push("Drift fields:");
      driftItems.slice(0, 10).forEach((item) => {
        lines.push(`- ${item.label || item.field || "Release Control task drift"}: ${item.before ?? "none"} -> ${item.current ?? "none"} (${item.delta >= 0 ? "+" : ""}${item.delta ?? 0})`);
      });
    }

    return lines.join("\n");
  }

  async function createReleaseTaskLedgerDriftReviewTask(snapshotId) {
    const snapshot = findReleaseTaskLedgerSnapshot(snapshotId);
    if (!snapshot) throw new Error(`Release Control task ledger snapshot not found: ${snapshotId}`);

    const diff = await api.fetchReleaseTaskLedgerSnapshotDiff(snapshotId);
    const title = `Review Release Control task ledger drift: ${diff.snapshotTitle || snapshot.title || snapshotId}`;
    await api.createTask({
      projectId: "release-control",
      projectName: "Release Control",
      title,
      description: buildReleaseTaskLedgerDriftTaskDescription(snapshot, diff),
      priority: getReleaseTaskLedgerDriftTaskPriority(diff.driftSeverity),
      status: "open"
    });
    await renderGovernance();
    return "Created Release Control task ledger drift review task";
  }

  async function acceptReleaseTaskLedgerSnapshotDrift(snapshotId) {
    const snapshot = findReleaseTaskLedgerSnapshot(snapshotId);
    if (!snapshot) throw new Error(`Release Control task ledger snapshot not found: ${snapshotId}`);

    const diff = await api.fetchReleaseTaskLedgerSnapshotDiff(snapshotId);
    const sourceTitle = diff.snapshotTitle || snapshot.title || snapshotId;
    await api.createReleaseTaskLedgerSnapshot({
      title: `Accepted Release Control task ledger drift as current baseline: ${sourceTitle}`.slice(0, 120),
      status: snapshot.statusFilter || "all",
      limit: snapshot.limit || 100
    });
    await renderGovernance();
    return "Accepted Release Control task ledger drift as current baseline";
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

  function getReleaseBuildGateEvidenceContext() {
    const governance = getFilteredGovernance() || {};
    const releaseSummary = governance.releaseSummary || null;
    const releaseBuildGate = governance.releaseBuildGate || null;
    const latestSmokeCheck = releaseSummary?.latestSmokeCheck || null;
    return {
      releaseSummary,
      releaseBuildGate,
      latestSmokeCheck
    };
  }

  function getReleaseBuildGateLocalEvidencePriority(releaseBuildGate, releaseSummary, latestSmokeCheck) {
    if (releaseBuildGate?.decision === "hold" || releaseSummary?.summary?.status === "hold" || latestSmokeCheck?.status === "fail") return "high";
    if (releaseBuildGate?.decision === "review" || releaseSummary?.summary?.status === "review") return "medium";
    return "low";
  }

  function buildReleaseBuildGateLocalEvidenceNotes(decision, releaseSummary, releaseBuildGate, latestSmokeCheck) {
    const releaseStatus = releaseSummary?.summary?.status || "review";
    const gateDecision = releaseBuildGate?.decision || "not-evaluated";
    const riskScore = releaseBuildGate?.riskScore || 0;
    const smokeStatus = latestSmokeCheck?.status || "not-run";
    const smokeStatusText = latestSmokeCheck
      ? `${smokeStatus.toUpperCase()} HTTP ${latestSmokeCheck.httpStatus || "unreachable"} at ${latestSmokeCheck.checkedAt || "not recorded"}`
      : "not recorded";

    return [
      `Operator ${decision} local release gate smoke/bootstrap evidence from the Release Control checkpoint.`,
      `Release status: ${releaseStatus}; gate decision: ${gateDecision}; risk score: ${riskScore}.`,
      `Latest smoke check: ${smokeStatusText}.`,
      `Deployment smoke totals: ${releaseSummary?.summary?.deploymentSmokeCheckPassCount || 0} pass / ${releaseSummary?.summary?.deploymentSmokeCheckFailCount || 0} fail / ${releaseSummary?.summary?.deploymentSmokeCheckCount || 0} total.`,
      `Git evidence: ${releaseSummary?.git?.available ? `${releaseSummary.git.branch || "unknown"} @ ${releaseSummary.git.commitShort || "unknown"}` : "unavailable"}.`,
      "Secret policy: non-secret local release evidence only; do not store response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
    ].join(" ");
  }

  async function createReleaseBuildGateLocalEvidenceCheckpoint(checkpointDecision) {
    const { releaseSummary, releaseBuildGate, latestSmokeCheck } = getReleaseBuildGateEvidenceContext();
    if (!releaseSummary) throw new Error("Release summary is not loaded.");

    const normalizedDecision = checkpointDecision === "confirmed" ? "confirmed" : "deferred";
    const checkpointStatus = normalizedDecision === "confirmed"
      ? releaseSummary.summary?.status || releaseBuildGate?.decision || "review"
      : "review";
    const created = await api.createReleaseCheckpoint({
      title: `Release gate local evidence ${normalizedDecision}: ${releaseSummary.git?.commitShort || "current"}`,
      status: checkpointStatus,
      notes: buildReleaseBuildGateLocalEvidenceNotes(normalizedDecision, releaseSummary, releaseBuildGate, latestSmokeCheck)
    });
    await renderGovernance();
    return `${normalizedDecision === "confirmed" ? "Confirmed" : "Deferred"} ${created.checkpoint.status.toUpperCase()}`;
  }

  async function createReleaseBuildGateLocalEvidenceTask() {
    const { releaseSummary, releaseBuildGate, latestSmokeCheck } = getReleaseBuildGateEvidenceContext();
    if (!releaseSummary) throw new Error("Release summary is not loaded.");

    const priority = getReleaseBuildGateLocalEvidencePriority(releaseBuildGate, releaseSummary, latestSmokeCheck);
    const action = {
      id: `release-local-evidence:${latestSmokeCheck?.id || releaseSummary.git?.commitShort || releaseSummary.generatedAt || "current"}`,
      label: "Review local release gate evidence",
      status: "open",
      priority,
      description: [
        "Review local release gate smoke/bootstrap evidence before the next supervised build pass.",
        `Release status: ${releaseSummary.summary?.status || "review"}; gate decision: ${releaseBuildGate?.decision || "not-evaluated"}; risk score: ${releaseBuildGate?.riskScore || 0}.`,
        `Latest smoke check: ${latestSmokeCheck ? `${latestSmokeCheck.status || "fail"} HTTP ${latestSmokeCheck.httpStatus || "unreachable"} at ${latestSmokeCheck.checkedAt || "not recorded"}` : "not recorded"}.`,
        `Deployment smoke totals: ${releaseSummary.summary?.deploymentSmokeCheckPassCount || 0} pass / ${releaseSummary.summary?.deploymentSmokeCheckFailCount || 0} fail / ${releaseSummary.summary?.deploymentSmokeCheckCount || 0} total.`,
        `Latest release checkpoint count: ${releaseSummary.summary?.releaseCheckpointCount || 0}.`,
        "Secret policy: store only non-secret local release evidence metadata. Do not store response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
      ].join(" "),
      commandHint: "Use Bootstrap Local Evidence, Copy Gate, and the local app smoke-check ledger before promoting the next build."
    };

    const payload = await api.createReleaseBuildGateActionTasks({
      actions: [action],
      saveSnapshot: true,
      snapshotTitle: "Release Control Local Evidence Task Auto Capture",
      snapshotStatus: "all",
      snapshotLimit: 100
    });
    await renderGovernance();
    const taskLabel = payload.totals.created
      ? `Created ${payload.totals.created} Evidence Task${payload.totals.created === 1 ? "" : "s"}`
      : `Skipped ${payload.totals.skipped} Evidence Task${payload.totals.skipped === 1 ? "" : "s"}`;
    return payload.snapshotCaptured ? `${taskLabel} + Snapshot` : taskLabel;
  }

  function findReleaseControlCheckpoint(checkpointId) {
    return (getFilteredGovernance()?.releaseSummary?.checkpoints || [])
      .find((checkpoint) => checkpoint.id === checkpointId) || null;
  }

  function buildReleaseControlCheckpointDecisionNotes(decision, checkpoint) {
    return [
      `Operator ${decision} saved Release Control checkpoint ${checkpoint.id || checkpoint.title || "checkpoint"}.`,
      `Checkpoint title: ${checkpoint.title || "Release Checkpoint"}.`,
      `Checkpoint status: ${checkpoint.status || "review"}; branch: ${checkpoint.branch || "unknown"}; commit: ${checkpoint.commitShort || checkpoint.commit || "unknown"}.`,
      `Deployment smoke: ${checkpoint.deploymentSmokeCheckPassCount || 0} pass / ${checkpoint.deploymentSmokeCheckFailCount || 0} fail / ${checkpoint.deploymentSmokeCheckCount || 0} total.`,
      `Validation status: ${checkpoint.validationStatus || "scan-missing"}.`,
      "Secret policy: non-secret release checkpoint metadata only; do not store response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
    ].join(" ");
  }

  async function createReleaseControlCheckpointDecision(checkpointId, checkpointDecision) {
    const checkpoint = findReleaseControlCheckpoint(checkpointId);
    if (!checkpoint) throw new Error(`Release Control checkpoint not found: ${checkpointId}`);

    const normalizedDecision = checkpointDecision === "confirmed" ? "confirmed" : "deferred";
    const status = normalizedDecision === "confirmed" ? checkpoint.status || "review" : "review";
    const created = await api.createReleaseCheckpoint({
      title: `Release checkpoint ${normalizedDecision}: ${checkpoint.title || checkpoint.id}`,
      status,
      notes: buildReleaseControlCheckpointDecisionNotes(normalizedDecision, checkpoint)
    });
    await renderGovernance();
    return `${normalizedDecision === "confirmed" ? "Confirmed" : "Deferred"} ${created.checkpoint.status.toUpperCase()}`;
  }

  async function createReleaseControlCheckpointTask(checkpointId) {
    const checkpoint = findReleaseControlCheckpoint(checkpointId);
    if (!checkpoint) throw new Error(`Release Control checkpoint not found: ${checkpointId}`);

    const releaseBuildGate = getFilteredGovernance()?.releaseBuildGate || null;
    const priority = checkpoint.status === "hold" || checkpoint.deploymentSmokeCheckFailCount > 0
      ? "high"
      : checkpoint.status === "review"
        ? "medium"
        : "low";
    const action = {
      id: `release-checkpoint:${checkpoint.id}`,
      label: `Review release checkpoint: ${checkpoint.title || checkpoint.id}`,
      status: "open",
      priority,
      description: [
        `Review saved Release Control checkpoint ${checkpoint.id || checkpoint.title || "checkpoint"}.`,
        `Checkpoint status: ${checkpoint.status || "review"}; branch: ${checkpoint.branch || "unknown"}; commit: ${checkpoint.commitShort || checkpoint.commit || "unknown"}.`,
        `Deployment smoke: ${checkpoint.deploymentSmokeCheckPassCount || 0} pass / ${checkpoint.deploymentSmokeCheckFailCount || 0} fail / ${checkpoint.deploymentSmokeCheckCount || 0} total.`,
        `Validation status: ${checkpoint.validationStatus || "scan-missing"}.`,
        `Current gate decision: ${releaseBuildGate?.decision || "not-evaluated"}; risk score: ${releaseBuildGate?.riskScore || 0}.`,
        "Secret policy: store only non-secret release checkpoint metadata. Do not store response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
      ].join(" "),
      commandHint: "Use Release Control Copy Release, Copy Gate, and checkpoint drift before changing release readiness."
    };

    const payload = await api.createReleaseBuildGateActionTasks({
      actions: [action],
      saveSnapshot: true,
      snapshotTitle: `Release Control Checkpoint Task Auto Capture: ${checkpoint.title || checkpoint.id}`.slice(0, 120),
      snapshotStatus: "all",
      snapshotLimit: 100
    });
    await renderGovernance();
    const taskLabel = payload.totals.created
      ? `Created ${payload.totals.created} Checkpoint Task${payload.totals.created === 1 ? "" : "s"}`
      : `Skipped ${payload.totals.skipped} Checkpoint Task${payload.totals.skipped === 1 ? "" : "s"}`;
    return payload.snapshotCaptured ? `${taskLabel} + Snapshot` : taskLabel;
  }

  async function seedReleaseBuildGateActionTasks(options = {}) {
    const actions = (getFilteredGovernance()?.releaseBuildGate?.actions || [])
      .filter((action) => action.status !== "ready");
    if (!actions.length) return "No Gate Tasks";
    const request = { actions };
    if (options.saveSnapshot) {
      request.saveSnapshot = true;
      request.snapshotTitle = options.snapshotTitle || "Release Control Task Ledger Auto Capture";
      request.snapshotStatus = options.snapshotStatus || "all";
      request.snapshotLimit = options.snapshotLimit || 100;
    }
    const payload = await api.createReleaseBuildGateActionTasks(request);
    await renderGovernance();
    const taskLabel = `Created ${payload.totals.created} Release Task${payload.totals.created === 1 ? "" : "s"}`;
    return payload.snapshotCaptured ? `${taskLabel} + Snapshot` : taskLabel;
  }

  async function seedReleaseBuildGateActionTasksWithSnapshot() {
    return seedReleaseBuildGateActionTasks({
      saveSnapshot: true,
      snapshotTitle: "Release Control Task Ledger Auto Capture",
      snapshotStatus: "all",
      snapshotLimit: 100
    });
  }

  function findReleaseBuildGateAction(actionId) {
    return (getFilteredGovernance()?.releaseBuildGate?.actions || [])
      .find((action) => action.id === actionId) || null;
  }

  async function createReleaseBuildGateActionTask(actionId) {
    const action = findReleaseBuildGateAction(actionId);
    if (!action) throw new Error(`Release Build Gate action not found: ${actionId}`);

    const payload = await api.createReleaseBuildGateActionTasks({ actions: [action] });
    await renderGovernance();
    return `Created ${payload.totals.created} Release Task${payload.totals.created === 1 ? "" : "s"}`;
  }

  async function createReleaseBuildGateActionTaskWithSnapshot(actionId) {
    const action = findReleaseBuildGateAction(actionId);
    if (!action) throw new Error(`Release Build Gate action not found: ${actionId}`);

    const label = action.label || action.id || "release gate action";
    const payload = await api.createReleaseBuildGateActionTasks({
      actions: [action],
      saveSnapshot: true,
      snapshotTitle: `Release Control Task Ledger Auto Capture: ${label}`.slice(0, 120),
      snapshotStatus: "all",
      snapshotLimit: 100
    });
    await renderGovernance();
    const taskLabel = `Created ${payload.totals.created} Release Task${payload.totals.created === 1 ? "" : "s"}`;
    return payload.snapshotCaptured ? `${taskLabel} + Snapshot` : taskLabel;
  }

  async function createReleaseBuildGateActionCheckpoint(actionId) {
    const releaseBuildGate = getFilteredGovernance()?.releaseBuildGate;
    const action = findReleaseBuildGateAction(actionId);
    if (!action) throw new Error(`Release Build Gate action not found: ${actionId}`);

    const status = action.status === "ready" && releaseBuildGate?.decision === "ready" ? "ready" : "review";
    const created = await api.createReleaseCheckpoint({
      title: `Release gate action accepted: ${action.label || action.id}`,
      status,
      notes: [
        `Accepted release build gate action ${action.id} as operator-reviewed from the Release Build Gate checkpoint.`,
        `Action status: ${action.status || "open"}; priority: ${action.priority || "medium"}.`,
        `Gate decision: ${releaseBuildGate?.decision || "review"}; risk score: ${releaseBuildGate?.riskScore || 0}.`,
        "Secret policy: non-secret release metadata only; do not store passwords, tokens, certificates, private keys, cookies, or browser sessions."
      ].join(" ")
    });
    await renderGovernance();
    return `Accepted release gate action as ${created.checkpoint.status.toUpperCase()}`;
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

  function findAgentControlPlaneSnapshot(snapshotId) {
    return (governanceCache?.agentControlPlaneSnapshots || [])
      .find((snapshot) => snapshot.id === snapshotId) || null;
  }

  function getAgentControlPlaneDriftTaskPriority(severity) {
    if (severity === "high") return "high";
    if (severity === "medium") return "medium";
    return "low";
  }

  function buildAgentControlPlaneDriftTaskDescription(snapshot, diff) {
    const driftItems = Array.isArray(diff.driftItems) ? diff.driftItems : [];
    const metricDeltas = Array.isArray(diff.metricDeltas) ? diff.metricDeltas : [];
    const lines = [
      `Review Agent Control Plane drift from snapshot ${diff.snapshotTitle || snapshot.title || snapshot.id}.`,
      `Snapshot ID: ${diff.snapshotId || snapshot.id}.`,
      `Drift severity: ${diff.driftSeverity || "none"}; score: ${diff.driftScore || 0}.`,
      `Recommended action: ${diff.recommendedAction || "Review the drift before the next supervised build."}`,
      "Secret policy: non-secret control-plane metadata only; do not store passwords, tokens, certificates, private keys, cookies, or browser sessions."
    ];

    if (driftItems.length) {
      lines.push("Drift fields:");
      driftItems.slice(0, 8).forEach((item) => {
        lines.push(`- ${item.label || item.field || "Drift field"}: ${item.before ?? "none"} -> ${item.current ?? "none"} (${item.delta >= 0 ? "+" : ""}${item.delta ?? 0})`);
      });
    }

    const changedMetrics = metricDeltas.filter((item) => Number(item.delta || 0) !== 0);
    if (changedMetrics.length) {
      lines.push("Metric deltas:");
      changedMetrics.slice(0, 8).forEach((item) => {
        lines.push(`- ${item.label || "Metric"}: ${item.before ?? 0} -> ${item.current ?? 0} (${item.delta >= 0 ? "+" : ""}${item.delta ?? 0})`);
      });
    }

    return lines.join("\n");
  }

  async function createAgentControlPlaneDriftReviewTask(snapshotId) {
    const snapshot = findAgentControlPlaneSnapshot(snapshotId);
    if (!snapshot) throw new Error(`Agent Control Plane snapshot not found: ${snapshotId}`);

    const diff = await api.fetchAgentControlPlaneSnapshotDiff(snapshotId);
    const title = `Review Agent Control Plane drift: ${diff.snapshotTitle || snapshot.title || snapshotId}`;
    await api.createTask({
      title,
      description: buildAgentControlPlaneDriftTaskDescription(snapshot, diff),
      priority: getAgentControlPlaneDriftTaskPriority(diff.driftSeverity),
      status: "open"
    });
    await renderGovernance();
    return "Created Agent Control Plane drift review task";
  }

  async function acceptAgentControlPlaneSnapshotDrift(snapshotId) {
    const snapshot = findAgentControlPlaneSnapshot(snapshotId);
    if (!snapshot) throw new Error(`Agent Control Plane snapshot not found: ${snapshotId}`);

    const diff = await api.fetchAgentControlPlaneSnapshotDiff(snapshotId);
    const sourceTitle = diff.snapshotTitle || snapshot.title || snapshotId;
    await api.refreshAgentControlPlaneBaselineSnapshot({
      title: `Accepted Agent Control Plane drift as current baseline: ${sourceTitle}`.slice(0, 120),
      limit: snapshot.limit || 24
    });
    await renderGovernance();
    return "Accepted Agent Control Plane drift as current baseline";
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

  async function copyAgentControlPlaneDecisionTaskLedger() {
    const payload = await api.fetchAgentControlPlaneDecisionTaskLedger("all");
    await copyText(payload.markdown);
    return `Copied ${payload.summary.visible} Decision Task${payload.summary.visible === 1 ? "" : "s"}`;
  }

  async function saveAgentControlPlaneDecisionTaskLedgerSnapshot() {
    await api.createAgentControlPlaneDecisionTaskLedgerSnapshot({
      title: "Agent Control Plane Decision Task Ledger",
      status: "all",
      limit: 100
    });
    await renderGovernance();
    return "Saved Decision Task Snapshot";
  }

  async function copyLatestAgentControlPlaneDecisionTaskLedgerSnapshotDrift() {
    const diff = await api.fetchAgentControlPlaneDecisionTaskLedgerSnapshotDiff("latest");
    await copyText(diff.markdown);
    return diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : diff.hasSnapshot ? "No Drift" : "No Snapshot";
  }

  function findAgentControlPlaneDecisionTaskLedgerDriftItem(field) {
    const diff = governanceCache?.agentControlPlaneDecisionTaskLedgerSnapshotDiff || null;
    const driftItems = Array.isArray(diff?.driftItems) ? diff.driftItems : [];
    const item = driftItems.find((candidate) => candidate.field === field || candidate.label === field) || null;
    return { diff, item };
  }

  function getAgentControlPlaneDecisionTaskLedgerDriftItemDecision(decision) {
    if (decision === "escalated") return { status: "blocked", priority: "high", label: "Escalated" };
    if (decision === "deferred") return { status: "deferred", priority: "medium", label: "Deferred" };
    return { status: "resolved", priority: "low", label: "Confirmed" };
  }

  function buildAgentControlPlaneDecisionTaskLedgerDriftItemDescription(decision, diff, item) {
    const label = item?.label || item?.field || "Agent Control Plane decision task ledger drift";
    return [
      `Operator ${decision.label.toLowerCase()} Agent Control Plane decision task ledger drift item ${label}.`,
      `Snapshot: ${diff?.snapshotTitle || diff?.snapshotId || "latest Agent Control Plane decision task ledger snapshot"}.`,
      `Field: ${item?.field || label}.`,
      `Previous: ${item?.before ?? "none"}; current: ${item?.current ?? "none"}; delta: ${item?.delta ?? 0}.`,
      `Drift severity: ${diff?.driftSeverity || "none"}; score: ${diff?.driftScore || 0}.`,
      "Secret policy: non-secret agent control-plane decision task ledger drift metadata only; do not store response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
    ].join(" ");
  }

  async function updateAgentControlPlaneDecisionTaskLedgerDriftItemCheckpoint(field, checkpointDecision) {
    const { diff, item } = findAgentControlPlaneDecisionTaskLedgerDriftItem(field);
    if (!diff) throw new Error("Agent Control Plane decision task ledger snapshot drift is not loaded.");
    if (!item) throw new Error(`Agent Control Plane decision task ledger drift item not found: ${field}`);

    const decision = getAgentControlPlaneDecisionTaskLedgerDriftItemDecision(checkpointDecision);
    await api.createTask({
      projectId: "agent-control-plane",
      projectName: "Agent Control Plane",
      title: `Decision task ledger drift ${decision.label.toLowerCase()}: ${item.label || item.field || field}`.slice(0, 140),
      description: buildAgentControlPlaneDecisionTaskLedgerDriftItemDescription(decision, diff, item),
      priority: decision.priority,
      status: decision.status
    });
    await renderGovernance();
    return decision.label;
  }

  function getAgentControlPlaneDecisionTaskCheckpointPatch(task, action) {
    const checkpointStatus = action === "escalate" ? "escalated" : action === "defer" ? "deferred" : "confirmed";
    const patch = {
      agentControlPlaneDecisionTaskCheckpointStatus: checkpointStatus,
      agentControlPlaneDecisionTaskCheckpointedAt: new Date().toISOString(),
      agentControlPlaneDecisionTaskCheckpointNote: [
        `Operator ${checkpointStatus} Agent Control Plane decision task ${task.title || task.id}.`,
        `Decision reason: ${task.agentControlPlaneDecisionReasonCode || "control-plane-decision"}; decision ${task.agentControlPlaneDecision || "review"}.`,
        "Secret policy: non-secret agent control-plane decision task metadata only; do not store response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
      ].join(" ")
    };

    if (action === "defer") {
      patch.status = "deferred";
    } else if (action === "escalate") {
      patch.status = "blocked";
      patch.priority = "high";
    } else {
      patch.status = "resolved";
    }

    return { checkpointStatus, patch };
  }

  async function updateAgentControlPlaneDecisionTaskCheckpoint(taskId, action) {
    const task = (governanceCache?.agentControlPlaneDecisionTasks || []).find((item) => item.id === taskId);
    if (!task) throw new Error(`Agent Control Plane decision task not found: ${taskId}`);

    const { checkpointStatus, patch } = getAgentControlPlaneDecisionTaskCheckpointPatch(task, action);
    const updated = await api.updateTask(taskId, patch);
    await renderGovernance();
    const nextTask = updated.task || patch;
    if (checkpointStatus === "escalated") return `Escalated ${nextTask.priority || "high"}`;
    if (checkpointStatus === "deferred") return "Deferred";
    return `Confirmed ${nextTask.status || "resolved"}`;
  }

  function getAgentExecutionResultTaskCheckpointPatch(task, action) {
    const checkpointStatus = action === "escalate" ? "escalated" : action === "defer" ? "deferred" : "confirmed";
    const patch = {
      agentExecutionResultTaskCheckpointStatus: checkpointStatus,
      agentExecutionResultTaskCheckpointedAt: new Date().toISOString(),
      agentExecutionResultTaskCheckpointNote: [
        `Operator ${checkpointStatus} Agent Execution Result follow-up task ${task.title || task.id}.`,
        `Target action: ${task.agentExecutionResultTargetAction || "execution-result"}; run status ${task.agentExecutionResultRunStatus || "unknown"}.`,
        "Secret policy: non-secret agent execution-result follow-up task metadata only; do not store response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
      ].join(" ")
    };

    if (action === "defer") {
      patch.status = "deferred";
    } else if (action === "escalate") {
      patch.status = "blocked";
      patch.priority = "high";
    } else {
      patch.status = "resolved";
    }

    return { checkpointStatus, patch };
  }

  async function updateAgentExecutionResultTaskCheckpoint(taskId, action) {
    const task = (governanceCache?.agentExecutionResultTasks || []).find((item) => item.id === taskId);
    if (!task) throw new Error(`Agent Execution Result follow-up task not found: ${taskId}`);

    const { checkpointStatus, patch } = getAgentExecutionResultTaskCheckpointPatch(task, action);
    const updated = await api.updateTask(taskId, patch);
    await renderGovernance();
    const nextTask = updated.task || patch;
    if (checkpointStatus === "escalated") return `Escalated ${nextTask.priority || "high"}`;
    if (checkpointStatus === "deferred") return "Deferred";
    return `Confirmed ${nextTask.status || "resolved"}`;
  }

  function getConvergenceTaskCheckpointPatch(task, action) {
    const checkpointStatus = action === "escalate" ? "escalated" : action === "defer" ? "deferred" : "confirmed";
    const patch = {
      convergenceTaskCheckpointStatus: checkpointStatus,
      convergenceTaskCheckpointedAt: new Date().toISOString(),
      convergenceTaskCheckpointNote: [
        `Operator ${checkpointStatus} Convergence review task ${task.title || task.id}.`,
        `Pair: ${task.convergenceLeftName || task.convergenceLeftId || "left project"} -> ${task.convergenceRightName || task.convergenceRightId || "right project"}; review ${task.convergenceReviewStatus || "needs-review"}; score ${task.convergenceScore || 0}%.`,
        "Secret policy: non-secret convergence review task metadata only; do not store credentials, provider tokens, cookies, certificates, private keys, browser sessions, repository secrets, or command output."
      ].join(" ")
    };

    if (action === "defer") {
      patch.status = "deferred";
    } else if (action === "escalate") {
      patch.status = "blocked";
      patch.priority = "high";
    } else {
      patch.status = "resolved";
    }

    return { checkpointStatus, patch };
  }

  async function updateConvergenceTaskCheckpoint(taskId, action) {
    const task = (governanceCache?.convergenceTasks || []).find((item) => item.id === taskId);
    if (!task) throw new Error(`Convergence review task not found: ${taskId}`);

    const { checkpointStatus, patch } = getConvergenceTaskCheckpointPatch(task, action);
    const updated = await api.updateTask(taskId, patch);
    await renderGovernance();
    const nextTask = updated.task || patch;
    if (checkpointStatus === "escalated") return `Escalated ${nextTask.priority || "high"}`;
    if (checkpointStatus === "deferred") return "Deferred";
    return `Confirmed ${nextTask.status || "resolved"}`;
  }

  function findConvergenceTaskLedgerDriftItem(field) {
    const diff = governanceCache?.convergenceTaskLedgerSnapshotDiff || null;
    const driftItems = Array.isArray(diff?.driftItems) ? diff.driftItems : [];
    const item = driftItems.find((candidate) => candidate.field === field || candidate.label === field) || null;
    return { diff, item };
  }

  async function updateConvergenceTaskLedgerDriftItemCheckpoint(field, checkpointDecision) {
    const { diff, item } = findConvergenceTaskLedgerDriftItem(field);
    if (!diff) throw new Error("Convergence Review task ledger snapshot drift is not loaded.");
    if (!item) throw new Error(`Convergence Review task ledger drift item not found: ${field}`);

    const result = await api.createConvergenceTaskLedgerDriftCheckpoint({
      snapshotId: diff.snapshotId || "latest",
      field: item.field || field,
      decision: checkpointDecision
    });
    await renderGovernance();
    return `${result.decisionLabel || "Checkpoint"} ${result.mode === "updated" ? "Updated" : "Tracked"}`;
  }

  async function copyAgentExecutionResultTaskLedger() {
    const payload = await api.fetchAgentExecutionResultTaskLedger("all");
    await copyText(payload.markdown);
    return `Copied ${payload.summary.visible} Execution Task${payload.summary.visible === 1 ? "" : "s"}`;
  }

  async function saveAgentExecutionResultTaskLedgerSnapshot() {
    await api.createAgentExecutionResultTaskLedgerSnapshot({
      title: "Agent Execution Result Task Ledger",
      status: "all",
      limit: 100
    });
    await renderGovernance();
    return "Saved Execution Task Snapshot";
  }

  async function copyLatestAgentExecutionResultTaskLedgerSnapshotDrift() {
    const diff = await api.fetchAgentExecutionResultTaskLedgerSnapshotDiff("latest");
    await copyText(diff.markdown);
    return diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : diff.hasSnapshot ? "No Drift" : "No Snapshot";
  }

  function findAgentExecutionResultTaskLedgerDriftItem(field) {
    const diff = governanceCache?.agentExecutionResultTaskLedgerSnapshotDiff || null;
    const driftItems = Array.isArray(diff?.driftItems) ? diff.driftItems : [];
    const item = driftItems.find((candidate) => candidate.field === field || candidate.label === field) || null;
    return { diff, item };
  }

  function getAgentExecutionResultTaskLedgerDriftItemDecision(decision) {
    if (decision === "escalated") return { status: "blocked", priority: "high", label: "Escalated" };
    if (decision === "deferred") return { status: "deferred", priority: "medium", label: "Deferred" };
    return { status: "resolved", priority: "low", label: "Confirmed" };
  }

  function buildAgentExecutionResultTaskLedgerDriftItemDescription(decision, diff, item) {
    const label = item?.label || item?.field || "Agent Execution Result task ledger drift";
    return [
      `Operator ${decision.label.toLowerCase()} Agent Execution Result task ledger drift item ${label}.`,
      `Snapshot: ${diff?.snapshotTitle || diff?.snapshotId || "latest Agent Execution Result task ledger snapshot"}.`,
      `Field: ${item?.field || label}.`,
      `Previous: ${item?.before ?? "none"}; current: ${item?.current ?? "none"}; delta: ${item?.delta ?? 0}.`,
      `Drift severity: ${diff?.driftSeverity || "none"}; score: ${diff?.driftScore || 0}.`,
      "Secret policy: non-secret agent execution-result task ledger drift metadata only; do not store response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
    ].join(" ");
  }

  async function updateAgentExecutionResultTaskLedgerDriftItemCheckpoint(field, checkpointDecision) {
    const { diff, item } = findAgentExecutionResultTaskLedgerDriftItem(field);
    if (!diff) throw new Error("Agent Execution Result task ledger snapshot drift is not loaded.");
    if (!item) throw new Error(`Agent Execution Result task ledger drift item not found: ${field}`);

    const decision = getAgentExecutionResultTaskLedgerDriftItemDecision(checkpointDecision);
    await api.createTask({
      projectId: "agent-execution-result",
      projectName: "Agent Execution Result",
      title: `Execution-result task ledger drift ${decision.label.toLowerCase()}: ${item.label || item.field || field}`.slice(0, 140),
      description: buildAgentExecutionResultTaskLedgerDriftItemDescription(decision, diff, item),
      priority: decision.priority,
      status: decision.status
    });
    await renderGovernance();
    return decision.label;
  }

  function findAgentExecutionResultTaskLedgerSnapshot(snapshotId) {
    return (governanceCache?.agentExecutionResultTaskLedgerSnapshots || [])
      .find((snapshot) => snapshot.id === snapshotId) || null;
  }

  function getAgentExecutionResultTaskLedgerDriftTaskPriority(severity) {
    if (severity === "high") return "high";
    if (severity === "medium") return "medium";
    return "low";
  }

  function buildAgentExecutionResultTaskLedgerDriftTaskDescription(snapshot, diff) {
    const driftItems = Array.isArray(diff.driftItems) ? diff.driftItems : [];
    const snapshotSummary = diff.snapshotSummary || {};
    const liveSummary = diff.liveSummary || {};
    const lines = [
      `Review Agent Execution Result task ledger drift from snapshot ${diff.snapshotTitle || snapshot.title || snapshot.id}.`,
      `Snapshot ID: ${diff.snapshotId || snapshot.id}.`,
      `Drift severity: ${diff.driftSeverity || "none"}; score: ${diff.driftScore || 0}.`,
      `Recommended action: ${diff.recommendedAction || "Review execution-result task ledger drift before the next run-gate handoff."}`,
      `Open tasks: ${snapshotSummary.open ?? 0} -> ${liveSummary.open ?? 0}; total tasks: ${snapshotSummary.total ?? 0} -> ${liveSummary.total ?? 0}.`,
      "Secret policy: non-secret execution-result task ledger metadata only; do not store passwords, tokens, certificates, private keys, cookies, browser sessions, or command output."
    ];

    if (driftItems.length) {
      lines.push("Drift fields:");
      driftItems.slice(0, 10).forEach((item) => {
        lines.push(`- ${item.label || item.field || "Execution-result task drift"}: ${item.before ?? "none"} -> ${item.current ?? "none"} (${item.delta >= 0 ? "+" : ""}${item.delta ?? 0})`);
      });
    }

    return lines.join("\n");
  }

  async function createAgentExecutionResultTaskLedgerDriftReviewTask(snapshotId) {
    const snapshot = findAgentExecutionResultTaskLedgerSnapshot(snapshotId);
    if (!snapshot) throw new Error(`Agent Execution Result task ledger snapshot not found: ${snapshotId}`);

    const diff = await api.fetchAgentExecutionResultTaskLedgerSnapshotDiff(snapshotId);
    const title = `Review execution-result task ledger drift: ${diff.snapshotTitle || snapshot.title || snapshotId}`;
    await api.createTask({
      projectId: "agent-execution-result",
      projectName: "Agent Execution Result",
      title,
      description: buildAgentExecutionResultTaskLedgerDriftTaskDescription(snapshot, diff),
      priority: getAgentExecutionResultTaskLedgerDriftTaskPriority(diff.driftSeverity),
      status: "open"
    });
    await renderGovernance();
    return "Created execution-result task ledger drift review task";
  }

  async function acceptAgentExecutionResultTaskLedgerSnapshotDrift(snapshotId) {
    const snapshot = findAgentExecutionResultTaskLedgerSnapshot(snapshotId);
    if (!snapshot) throw new Error(`Agent Execution Result task ledger snapshot not found: ${snapshotId}`);

    const diff = await api.fetchAgentExecutionResultTaskLedgerSnapshotDiff(snapshotId);
    const sourceTitle = diff.snapshotTitle || snapshot.title || snapshotId;
    await api.createAgentExecutionResultTaskLedgerSnapshot({
      title: `Accepted execution-result task ledger drift as current baseline: ${sourceTitle}`.slice(0, 120),
      status: snapshot.statusFilter || "all",
      limit: snapshot.limit || 100
    });
    await renderGovernance();
    return "Accepted execution-result task ledger drift as current baseline";
  }

  async function seedAgentControlPlaneDecisionTasks(options = {}) {
    const reasons = getFilteredGovernance()?.agentControlPlaneDecision?.reasons || [];
    if (!reasons.length) return "No Decision Tasks";
    const payload = { reasons };
    if (options.saveSnapshot) {
      payload.saveSnapshot = true;
      payload.snapshotTitle = options.snapshotTitle || "Agent Control Plane Decision Task Ledger Auto Capture";
      payload.snapshotStatus = options.snapshotStatus || "all";
      payload.snapshotLimit = options.snapshotLimit || 100;
    }
    const result = await api.createAgentControlPlaneDecisionTasks(payload);
    await renderGovernance();
    const taskLabel = `Created ${result.totals.created} Decision Task${result.totals.created === 1 ? "" : "s"}`;
    return result.snapshotCaptured ? `${taskLabel} + Snapshot` : taskLabel;
  }

  async function seedAgentControlPlaneDecisionTasksWithSnapshot() {
    return seedAgentControlPlaneDecisionTasks({
      saveSnapshot: true,
      snapshotTitle: "Agent Control Plane Decision Task Ledger Auto Capture",
      snapshotStatus: "all",
      snapshotLimit: 100
    });
  }

  function findAgentControlPlaneDecisionReason(reasonCode) {
    return (getFilteredGovernance()?.agentControlPlaneDecision?.reasons || [])
      .find((reason) => reason.code === reasonCode) || null;
  }

  async function createAgentControlPlaneDecisionReasonTaskWithSnapshot(reasonCode) {
    const reason = findAgentControlPlaneDecisionReason(reasonCode);
    if (!reason) throw new Error(`Agent Control Plane decision reason not found: ${reasonCode}`);

    const payload = await api.createAgentControlPlaneDecisionTasks({
      reasons: [reason],
      saveSnapshot: true,
      snapshotTitle: `Agent Control Plane Decision Task Ledger Auto Capture: ${reason.code || reasonCode}`.slice(0, 120),
      snapshotStatus: "all",
      snapshotLimit: 100
    });
    await renderGovernance();
    const taskLabel = `Created ${payload.totals.created} Decision Task${payload.totals.created === 1 ? "" : "s"}`;
    return payload.snapshotCaptured ? `${taskLabel} + Snapshot` : taskLabel;
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

  function getAgentExecutionSlaLedgerItemCheckpointDecision(action) {
    if (action === "escalate") return { status: "blocked", priority: "high", label: "Escalated" };
    if (action === "defer") return { status: "deferred", priority: "medium", label: "Deferred" };
    return { status: "resolved", priority: "low", label: "Confirmed" };
  }

  function buildAgentExecutionSlaLedgerItemCheckpointDescription(decision, item) {
    return [
      `Operator ${decision.label.toLowerCase()} Agent Execution SLA breach ledger row ${item.id || "unknown"}.`,
      `Run: ${item.title || "Agent Work Order Run"}.`,
      `Project: ${item.projectName || item.projectId || "unassigned"}.`,
      `Breach state: ${item.breachState || "open"}; run status: ${item.status || "queued"}; action: ${item.action || "breached"}.`,
      `Breached: ${item.breachedAt || "not recorded"}; resolved: ${item.resolvedAt || "open"}; duration hours: ${item.durationHours || 0}.`,
      `Escalations: ${item.escalationCount || 0}; resolutions: ${item.resolutionCount || 0}.`,
      "Secret policy: non-secret agent execution SLA breach ledger metadata only; do not store response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
    ].join(" ");
  }

  async function createAgentExecutionSlaLedgerItemCheckpoint(itemId, action) {
    const item = (governanceCache?.agentExecutionSlaLedger || [])
      .find((candidate) => candidate.id === itemId);
    if (!item) throw new Error(`Agent Execution SLA breach ledger row not found: ${itemId}`);

    const decision = getAgentExecutionSlaLedgerItemCheckpointDecision(action);
    await api.createTask({
      projectId: item.projectId || "agent-execution-sla-ledger",
      projectName: item.projectName || "Agent Execution SLA Ledger",
      title: `SLA breach ledger ${decision.label.toLowerCase()}: ${item.title || item.id || itemId}`.slice(0, 140),
      description: buildAgentExecutionSlaLedgerItemCheckpointDescription(decision, item),
      priority: decision.priority,
      status: decision.status
    });
    await renderGovernance();
    return decision.label;
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

  async function createSourceAccessReviewTaskWithSnapshot(itemId, renderTarget = "governance") {
    const cachedQueue = renderTarget === "governance"
      ? getFilteredGovernance()?.dataSourcesAccessReviewQueue
      : null;
    const queue = cachedQueue || await api.fetchSourcesAccessReviewQueue();
    const item = (queue?.items || []).find((entry) => entry.id === itemId);
    if (!item) throw new Error(`Source access review item not found: ${itemId}`);

    const label = item.label || item.sourceId || itemId;
    const result = await api.createSourcesAccessReviewTasks({
      items: [item],
      saveSnapshot: true,
      snapshotTitle: `Data Sources Access Review Task Ledger Auto Capture: ${label}`.slice(0, 120),
      snapshotStatus: "all",
      snapshotLimit: 100
    });
    if (renderTarget === "sources") {
      await renderSources();
    } else {
      await renderGovernance();
    }
    const taskLabel = `Created ${result.totals.created} Source Task${result.totals.created === 1 ? "" : "s"}`;
    return result.snapshotCaptured ? `${taskLabel} + Snapshot` : taskLabel;
  }

  async function createSourceAccessMatrixTasks(accessMethod) {
    const queue = await api.fetchSourcesAccessReviewQueue();
    const items = (queue?.items || []).filter((item) => item.accessMethod === accessMethod);
    if (!items.length) return "No Matrix Tasks";

    const result = await api.createSourcesAccessReviewTasks({
      items,
      saveSnapshot: true,
      snapshotTitle: `Data Sources Access Matrix Task Ledger Auto Capture: ${accessMethod}`.slice(0, 120),
      snapshotStatus: "all",
      snapshotLimit: 100
    });
    await renderSources();
    const created = result.totals.created || 0;
    const skipped = result.totals.skipped || 0;
    const taskLabel = created
      ? `Created ${created} Matrix Task${created === 1 ? "" : "s"}`
      : `Skipped ${skipped} Matrix Task${skipped === 1 ? "" : "s"}`;
    return result.snapshotCaptured ? `${taskLabel} + Snapshot` : taskLabel;
  }

  async function checkpointGovernanceDataSourcesAccessReviewTasks(status) {
    const items = getFilteredGovernance()?.dataSourcesAccessReviewQueue?.items || [];
    return recordGeneratedTaskBatchCheckpoint({
      batchId: "governance-data-sources-access-review-tasks",
      title: "Governance Data Sources access review task batch",
      source: "governance-data-sources-access-review-queue",
      status,
      itemCount: items.length,
      renderTarget: "governance",
      note: `Operator marked the Governance Data Sources access review generated task batch as ${status} from the Governance task-seeding checkpoint before creating tasks.`
    });
  }

  async function seedGovernanceDataSourcesAccessValidationEvidenceCoverageTasks() {
    const items = (getFilteredGovernance()?.dataSourcesAccessValidationEvidenceCoverage?.items || [])
      .filter((item) => item.coverageStatus !== "covered");
    if (!items.length) return "No Evidence Tasks";
    const result = await api.createSourcesAccessValidationEvidenceCoverageTasks({ items });
    await renderGovernance();
    return `Created ${result.totals.created} Evidence Task${result.totals.created === 1 ? "" : "s"}`;
  }

  async function createSourceAccessValidationRunbookEvidenceTasks(accessMethod) {
    const cachedCoverage = getFilteredGovernance()?.dataSourcesAccessValidationEvidenceCoverage;
    const coverage = cachedCoverage || await api.fetchSourcesAccessValidationEvidenceCoverage();
    const items = (coverage?.items || [])
      .filter((item) => item.accessMethod === accessMethod && item.coverageStatus !== "covered");
    if (!items.length) return "No Runbook Tasks";

    const result = await api.createSourcesAccessValidationEvidenceCoverageTasks({
      items,
      saveSnapshot: true,
      snapshotTitle: `Data Sources Runbook Evidence Task Ledger Auto Capture: ${accessMethod}`.slice(0, 120),
      snapshotStatus: "open",
      snapshotLimit: 100
    });
    await renderGovernance();
    const created = result.totals.created || 0;
    const skipped = result.totals.skipped || 0;
    const taskLabel = created
      ? `Created ${created} Runbook Task${created === 1 ? "" : "s"}`
      : `Skipped ${skipped} Runbook Task${skipped === 1 ? "" : "s"}`;
    return result.snapshotCaptured ? `${taskLabel} + Snapshot` : taskLabel;
  }

  async function createSourceEvidenceCoverageTaskWithSnapshot(itemId, renderTarget = "governance") {
    const cachedCoverage = renderTarget === "governance"
      ? getFilteredGovernance()?.dataSourcesAccessValidationEvidenceCoverage
      : null;
    const coverage = cachedCoverage || await api.fetchSourcesAccessValidationEvidenceCoverage();
    const item = (coverage?.items || []).find((entry) => entry.id === itemId);
    if (!item) throw new Error(`Source evidence coverage item not found: ${itemId}`);

    const label = item.label || item.sourceId || itemId;
    const result = await api.createSourcesAccessValidationEvidenceCoverageTasks({
      items: [item],
      saveSnapshot: true,
      snapshotTitle: `Data Sources Evidence Coverage Task Ledger Auto Capture: ${label}`.slice(0, 120),
      snapshotStatus: "all",
      snapshotLimit: 100
    });
    if (renderTarget === "sources") {
      await renderSources();
    } else {
      await renderGovernance();
    }
    const taskLabel = `Created ${result.totals.created} Evidence Task${result.totals.created === 1 ? "" : "s"}`;
    return result.snapshotCaptured ? `${taskLabel} + Snapshot` : taskLabel;
  }

  async function checkpointGovernanceDataSourcesAccessValidationEvidenceCoverageTasks(status) {
    const items = (getFilteredGovernance()?.dataSourcesAccessValidationEvidenceCoverage?.items || [])
      .filter((item) => item.coverageStatus !== "covered");
    return recordGeneratedTaskBatchCheckpoint({
      batchId: "governance-data-sources-access-validation-evidence-coverage-tasks",
      title: "Governance Data Sources evidence coverage task batch",
      source: "governance-data-sources-access-validation-evidence-coverage",
      status,
      itemCount: items.length,
      renderTarget: "governance",
      note: `Operator marked the Governance Data Sources evidence coverage generated task batch as ${status} from the Governance task-seeding checkpoint before creating tasks.`
    });
  }

  async function copyGovernanceDataSourcesAccessTaskLedger() {
    const markdown = buildGovernanceDataSourcesAccessTaskLedgerMarkdown();
    await copyText(markdown);
    return `Copied ${getFilteredGovernance()?.dataSourcesAccessTasks?.length || 0} Task${(getFilteredGovernance()?.dataSourcesAccessTasks?.length || 0) === 1 ? "" : "s"}`;
  }

  function getDataSourcesAccessTaskCheckpointPatch(task, action) {
    const checkpointStatus = action === "escalate" ? "escalated" : action === "defer" ? "deferred" : "confirmed";
    const patch = {
      sourceAccessTaskCheckpointStatus: checkpointStatus,
      sourceAccessTaskCheckpointedAt: new Date().toISOString(),
      sourceAccessTaskCheckpointNote: [
        `Operator ${checkpointStatus} Data Sources access task ${task.title || task.id}.`,
        `Source: ${task.sourceLabel || task.sourceId || "unknown source"}; method ${task.accessMethod || "review-required"}; evidence ${task.coverageStatus || task.lastSourceAccessValidationEvidenceStatus || task.latestEvidenceStatus || "not-recorded"}.`,
        "Secret policy: non-secret source-access task metadata only; do not store response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
      ].join(" ")
    };

    if (action === "defer") {
      patch.status = "deferred";
    } else if (action === "escalate") {
      patch.status = "blocked";
      patch.priority = "high";
    } else {
      patch.status = "resolved";
    }

    return { checkpointStatus, patch };
  }

  async function updateDataSourcesAccessTaskCheckpoint(taskId, action) {
    const task = (governanceCache?.dataSourcesAccessTasks || []).find((item) => item.id === taskId);
    if (!task) throw new Error(`Data Sources access task not found: ${taskId}`);

    const { checkpointStatus, patch } = getDataSourcesAccessTaskCheckpointPatch(task, action);
    const updated = await api.updateTask(taskId, patch);
    await renderGovernance();
    const nextTask = updated.task || patch;
    if (checkpointStatus === "escalated") return `Escalated ${nextTask.priority || "high"}`;
    if (checkpointStatus === "deferred") return "Deferred";
    return `Confirmed ${nextTask.status || "resolved"}`;
  }

  function getDataSourcesAccessValidationWorkflowTaskCheckpointPatch(task, action) {
    const checkpointStatus = action === "escalate" ? "escalated" : action === "defer" ? "deferred" : "confirmed";
    const patch = {
      sourceAccessValidationWorkflowTaskCheckpointStatus: checkpointStatus,
      sourceAccessValidationWorkflowTaskCheckpointedAt: new Date().toISOString(),
      sourceAccessValidationWorkflowTaskCheckpointNote: [
        `Operator ${checkpointStatus} Data Sources access validation workflow task ${task.title || task.id}.`,
        `Source: ${task.sourceLabel || task.sourceId || "unknown source"}; workflow ${task.workflowStage || "validation"} / ${task.workflowStatus || "pending"}; method ${task.accessMethod || "review-required"}; evidence ${task.latestEvidenceStatus || task.coverageStatus || "missing"}.`,
        "Secret policy: non-secret source-access validation workflow task metadata only; do not store response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
      ].join(" ")
    };

    if (action === "defer") {
      patch.status = "deferred";
    } else if (action === "escalate") {
      patch.status = "blocked";
      patch.priority = "high";
    } else {
      patch.status = "resolved";
    }

    return { checkpointStatus, patch };
  }

  async function updateDataSourcesAccessValidationWorkflowTaskCheckpoint(taskId, action) {
    const task = (governanceCache?.dataSourcesAccessTasks || [])
      .find((item) => item.id === taskId && item.sourceAccessValidationWorkflowId);
    if (!task) throw new Error(`Data Sources access validation workflow task not found: ${taskId}`);

    const { checkpointStatus, patch } = getDataSourcesAccessValidationWorkflowTaskCheckpointPatch(task, action);
    const updated = await api.updateTask(taskId, patch);
    await renderGovernance();
    const nextTask = updated.task || patch;
    if (checkpointStatus === "escalated") return `Escalated ${nextTask.priority || "high"}`;
    if (checkpointStatus === "deferred") return "Deferred";
    return `Confirmed ${nextTask.status || "resolved"}`;
  }

  async function copyLatestDataSourcesAccessTaskLedgerSnapshotDrift() {
    const diff = await api.fetchSourcesAccessTaskLedgerSnapshotDiff("latest");
    await copyText(diff.markdown);
    return diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : diff.hasSnapshot ? "No Drift" : "No Snapshot";
  }

  function findDataSourcesAccessTaskLedgerDriftItem(field) {
    const diff = governanceCache?.dataSourceAccessTaskLedgerSnapshotDiff || null;
    const driftItems = Array.isArray(diff?.driftItems) ? diff.driftItems : [];
    const item = driftItems.find((candidate) => candidate.field === field || candidate.label === field) || null;
    return { diff, item };
  }

  function getDataSourcesAccessTaskLedgerDriftItemDecision(decision) {
    if (decision === "escalated") return { status: "blocked", priority: "high", label: "Escalated" };
    if (decision === "deferred") return { status: "deferred", priority: "medium", label: "Deferred" };
    return { status: "resolved", priority: "low", label: "Confirmed" };
  }

  function buildDataSourcesAccessTaskLedgerDriftItemDescription(decision, diff, item) {
    const label = item?.label || item?.field || "Data Sources access task ledger drift";
    return [
      `Operator ${decision.label.toLowerCase()} Data Sources access task ledger drift item ${label}.`,
      `Snapshot: ${diff?.snapshotTitle || diff?.snapshotId || "latest Data Sources access task ledger snapshot"}.`,
      `Field: ${item?.field || label}.`,
      `Previous: ${item?.before ?? "none"}; current: ${item?.current ?? "none"}; delta: ${item?.delta ?? 0}.`,
      `Drift severity: ${diff?.driftSeverity || "none"}; score: ${diff?.driftScore || 0}.`,
      "Secret policy: non-secret source-access task ledger drift metadata only; do not store response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
    ].join(" ");
  }

  async function updateDataSourcesAccessTaskLedgerDriftItemCheckpoint(field, checkpointDecision) {
    const { diff, item } = findDataSourcesAccessTaskLedgerDriftItem(field);
    if (!diff) throw new Error("Data Sources access task ledger snapshot drift is not loaded.");
    if (!item) throw new Error(`Data Sources access task ledger drift item not found: ${field}`);

    const decision = getDataSourcesAccessTaskLedgerDriftItemDecision(checkpointDecision);
    await api.createTask({
      projectId: "data-sources",
      projectName: "Data Sources",
      title: `Source-access task ledger drift ${decision.label.toLowerCase()}: ${item.label || item.field || field}`.slice(0, 140),
      description: buildDataSourcesAccessTaskLedgerDriftItemDescription(decision, diff, item),
      priority: decision.priority,
      status: decision.status
    });
    await renderGovernance();
    return decision.label;
  }

  function findDataSourcesAccessValidationWorkflowTaskLedgerDriftItem(field) {
    const diff = governanceCache?.dataSourceAccessTaskLedgerSnapshotDiff || null;
    const driftItems = Array.isArray(diff?.driftItems) ? diff.driftItems : [];
    const workflowTaskDriftItems = driftItems.filter((candidate) => {
      const category = String(candidate.category || "");
      const candidateField = String(candidate.field || "");
      return category === "source-access-validation-workflow-task-ledger" || candidateField.startsWith("source-access-validation-workflow-task");
    });
    const item = workflowTaskDriftItems.find((candidate) => candidate.field === field || candidate.label === field) || null;
    return { diff, item };
  }

  function buildDataSourcesAccessValidationWorkflowTaskLedgerDriftItemDescription(decision, diff, item) {
    const label = item?.label || item?.field || "Data Sources access validation workflow task ledger drift";
    return [
      `Operator ${decision.label.toLowerCase()} Data Sources access validation workflow task ledger drift item ${label}.`,
      `Snapshot: ${diff?.snapshotTitle || diff?.snapshotId || "latest Data Sources access task ledger snapshot"}.`,
      `Field: ${item?.field || label}.`,
      `Previous: ${item?.before ?? "none"}; current: ${item?.current ?? "none"}; delta: ${item?.delta ?? 0}.`,
      `Drift severity: ${diff?.driftSeverity || "none"}; score: ${diff?.driftScore || 0}.`,
      "Secret policy: non-secret source-access validation workflow task ledger drift metadata only; do not store response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output."
    ].join(" ");
  }

  async function updateDataSourcesAccessValidationWorkflowTaskLedgerDriftItemCheckpoint(field, checkpointDecision) {
    const { diff, item } = findDataSourcesAccessValidationWorkflowTaskLedgerDriftItem(field);
    if (!diff) throw new Error("Data Sources access validation workflow task ledger snapshot drift is not loaded.");
    if (!item) throw new Error(`Data Sources access validation workflow task ledger drift item not found: ${field}`);

    const decision = getDataSourcesAccessTaskLedgerDriftItemDecision(checkpointDecision);
    await api.createTask({
      projectId: "data-sources",
      projectName: "Data Sources",
      title: `Validation workflow task ledger drift ${decision.label.toLowerCase()}: ${item.label || item.field || field}`.slice(0, 140),
      description: buildDataSourcesAccessValidationWorkflowTaskLedgerDriftItemDescription(decision, diff, item),
      priority: decision.priority,
      status: decision.status
    });
    await renderGovernance();
    return decision.label;
  }

  function findDataSourcesAccessTaskLedgerSnapshot(snapshotId) {
    return (governanceCache?.dataSourceAccessTaskLedgerSnapshots || [])
      .find((snapshot) => snapshot.id === snapshotId) || null;
  }

  function getDataSourcesAccessTaskLedgerDriftTaskPriority(severity) {
    if (severity === "high") return "high";
    if (severity === "medium") return "medium";
    return "low";
  }

  function buildDataSourcesAccessTaskLedgerDriftTaskDescription(snapshot, diff) {
    const driftItems = Array.isArray(diff.driftItems) ? diff.driftItems : [];
    const snapshotSummary = diff.snapshotSummary || {};
    const liveSummary = diff.liveSummary || {};
    const lines = [
      `Review Data Sources access task ledger drift from snapshot ${diff.snapshotTitle || snapshot.title || snapshot.id}.`,
      `Snapshot ID: ${diff.snapshotId || snapshot.id}.`,
      `Drift severity: ${diff.driftSeverity || "none"}; score: ${diff.driftScore || 0}.`,
      `Recommended action: ${diff.recommendedAction || "Review source-access task ledger drift before the next ingestion or agent handoff."}`,
      `Open tasks: ${snapshotSummary.open ?? 0} -> ${liveSummary.open ?? 0}; total tasks: ${snapshotSummary.total ?? 0} -> ${liveSummary.total ?? 0}.`,
      "Secret policy: non-secret Data Sources access task ledger metadata only; do not store passwords, tokens, certificates, private keys, cookies, browser sessions, or command output."
    ];

    if (driftItems.length) {
      lines.push("Drift fields:");
      driftItems.slice(0, 10).forEach((item) => {
        lines.push(`- ${item.label || item.field || "Data Sources access task drift"}: ${item.before ?? "none"} -> ${item.current ?? "none"} (${item.delta >= 0 ? "+" : ""}${item.delta ?? 0})`);
      });
    }

    return lines.join("\n");
  }

  async function createDataSourcesAccessTaskLedgerDriftReviewTask(snapshotId) {
    const snapshot = findDataSourcesAccessTaskLedgerSnapshot(snapshotId);
    if (!snapshot) throw new Error(`Data Sources access task ledger snapshot not found: ${snapshotId}`);

    const diff = await api.fetchSourcesAccessTaskLedgerSnapshotDiff(snapshotId);
    const title = `Review Data Sources access task ledger drift: ${diff.snapshotTitle || snapshot.title || snapshotId}`;
    await api.createTask({
      projectId: "data-sources",
      projectName: "Data Sources",
      title,
      description: buildDataSourcesAccessTaskLedgerDriftTaskDescription(snapshot, diff),
      priority: getDataSourcesAccessTaskLedgerDriftTaskPriority(diff.driftSeverity),
      status: "open"
    });
    await renderGovernance();
    return "Created Data Sources access task ledger drift review task";
  }

  async function acceptDataSourcesAccessTaskLedgerSnapshotDrift(snapshotId) {
    const snapshot = findDataSourcesAccessTaskLedgerSnapshot(snapshotId);
    if (!snapshot) throw new Error(`Data Sources access task ledger snapshot not found: ${snapshotId}`);

    const diff = await api.fetchSourcesAccessTaskLedgerSnapshotDiff(snapshotId);
    const sourceTitle = diff.snapshotTitle || snapshot.title || snapshotId;
    await api.createSourcesAccessTaskLedgerSnapshot({
      title: `Accepted Data Sources access task ledger drift as current baseline: ${sourceTitle}`.slice(0, 120),
      status: snapshot.statusFilter || "all",
      limit: snapshot.limit || 100
    });
    await renderGovernance();
    return "Accepted Data Sources access task ledger drift as current baseline";
  }

  async function copyLatestDataSourcesAccessValidationEvidenceSnapshotDrift() {
    const diff = await api.fetchSourcesAccessValidationEvidenceSnapshotDiff("latest");
    await copyText(diff.markdown);
    return diff.hasDrift ? `Copied ${formatDriftSeverityLabel(diff.driftSeverity)}` : diff.hasSnapshot ? "No Drift" : "No Snapshot";
  }

  function findDataSourcesAccessValidationEvidenceSnapshot(snapshotId) {
    return (governanceCache?.dataSourceAccessValidationEvidenceSnapshots || [])
      .find((snapshot) => snapshot.id === snapshotId) || null;
  }

  function getDataSourcesAccessValidationEvidenceDriftTaskPriority(severity) {
    if (severity === "high") return "high";
    if (severity === "medium") return "medium";
    return "low";
  }

  function buildDataSourcesAccessValidationEvidenceDriftTaskDescription(snapshot, diff) {
    const driftItems = Array.isArray(diff.driftItems) ? diff.driftItems : [];
    const snapshotSummary = diff.snapshotSummary || {};
    const liveSummary = diff.liveSummary || {};
    const lines = [
      `Review Data Sources access validation evidence drift from snapshot ${diff.snapshotTitle || snapshot.title || snapshot.id}.`,
      `Snapshot ID: ${diff.snapshotId || snapshot.id}.`,
      `Drift severity: ${diff.driftSeverity || "none"}; score: ${diff.driftScore || 0}.`,
      `Recommended action: ${diff.recommendedAction || "Review source-access validation evidence drift before the next ingestion or agent handoff."}`,
      `Validated evidence: ${snapshotSummary.validated ?? 0} -> ${liveSummary.validated ?? 0}; blocked evidence: ${snapshotSummary.blocked ?? 0} -> ${liveSummary.blocked ?? 0}; total evidence: ${snapshotSummary.total ?? 0} -> ${liveSummary.total ?? 0}.`,
      "Secret policy: non-secret Data Sources access validation evidence metadata only; do not store passwords, tokens, certificates, private keys, cookies, browser sessions, or command output."
    ];

    if (driftItems.length) {
      lines.push("Drift fields:");
      driftItems.slice(0, 10).forEach((item) => {
        lines.push(`- ${item.label || item.field || "Data Sources access validation evidence drift"}: ${item.before ?? "none"} -> ${item.current ?? "none"} (${item.delta >= 0 ? "+" : ""}${item.delta ?? 0})`);
      });
    }

    return lines.join("\n");
  }

  async function createDataSourcesAccessValidationEvidenceDriftReviewTask(snapshotId) {
    const snapshot = findDataSourcesAccessValidationEvidenceSnapshot(snapshotId);
    if (!snapshot) throw new Error(`Data Sources access validation evidence snapshot not found: ${snapshotId}`);

    const diff = await api.fetchSourcesAccessValidationEvidenceSnapshotDiff(snapshotId);
    const title = `Review Data Sources access validation evidence drift: ${diff.snapshotTitle || snapshot.title || snapshotId}`;
    await api.createTask({
      projectId: "data-sources",
      projectName: "Data Sources",
      title,
      description: buildDataSourcesAccessValidationEvidenceDriftTaskDescription(snapshot, diff),
      priority: getDataSourcesAccessValidationEvidenceDriftTaskPriority(diff.driftSeverity),
      status: "open"
    });
    await renderGovernance();
    return "Created Data Sources access validation evidence drift review task";
  }

  async function acceptDataSourcesAccessValidationEvidenceSnapshotDrift(snapshotId) {
    const snapshot = findDataSourcesAccessValidationEvidenceSnapshot(snapshotId);
    if (!snapshot) throw new Error(`Data Sources access validation evidence snapshot not found: ${snapshotId}`);

    const diff = await api.fetchSourcesAccessValidationEvidenceSnapshotDiff(snapshotId);
    const sourceTitle = diff.snapshotTitle || snapshot.title || snapshotId;
    await api.createSourcesAccessValidationEvidenceSnapshot({
      title: `Accepted Data Sources access validation evidence drift as current baseline: ${sourceTitle}`.slice(0, 120),
      status: snapshot.statusFilter || "all",
      sourceId: snapshot.sourceId || "",
      accessMethod: snapshot.accessMethod || "",
      limit: snapshot.limit || 100
    });
    await renderGovernance();
    return "Accepted Data Sources access validation evidence drift as current baseline";
  }

  function findDataSourcesAccessValidationWorkflowSnapshot(snapshotId) {
    return (governanceCache?.dataSourceAccessValidationWorkflowSnapshots || [])
      .find((snapshot) => snapshot.id === snapshotId) || null;
  }

  function getDataSourcesAccessValidationWorkflowDriftTaskPriority(severity) {
    if (severity === "high") return "high";
    if (severity === "medium") return "medium";
    return "low";
  }

  function buildDataSourcesAccessValidationWorkflowDriftTaskDescription(snapshot, diff) {
    const driftItems = Array.isArray(diff.driftItems) ? diff.driftItems : [];
    const snapshotSummary = diff.snapshotSummary || {};
    const liveSummary = diff.liveSummary || {};
    const lines = [
      `Review Data Sources access validation workflow drift from snapshot ${diff.snapshotTitle || snapshot.title || snapshot.id}.`,
      `Snapshot ID: ${diff.snapshotId || snapshot.id}.`,
      `Drift severity: ${diff.driftSeverity || "none"}; score: ${diff.driftScore || 0}.`,
      `Recommended action: ${diff.recommendedAction || "Review source-access validation workflow drift before the next ingestion or agent handoff."}`,
      `Ready workflow: ${snapshotSummary.ready ?? 0} -> ${liveSummary.ready ?? 0}; blocked workflow: ${snapshotSummary.blocked ?? 0} -> ${liveSummary.blocked ?? 0}; missing evidence: ${snapshotSummary.missingEvidence ?? 0} -> ${liveSummary.missingEvidence ?? 0}.`,
      "Secret policy: non-secret Data Sources access validation workflow metadata only; do not store passwords, tokens, certificates, private keys, cookies, browser sessions, or command output."
    ];

    if (driftItems.length) {
      lines.push("Drift fields:");
      driftItems.slice(0, 10).forEach((item) => {
        lines.push(`- ${item.label || item.field || "Data Sources access validation workflow drift"}: ${item.before ?? "none"} -> ${item.current ?? "none"} (${item.delta >= 0 ? "+" : ""}${item.delta ?? 0})`);
      });
    }

    return lines.join("\n");
  }

  async function createDataSourcesAccessValidationWorkflowDriftReviewTask(snapshotId) {
    const snapshot = findDataSourcesAccessValidationWorkflowSnapshot(snapshotId);
    if (!snapshot) throw new Error(`Data Sources access validation workflow snapshot not found: ${snapshotId}`);

    const diff = await api.fetchSourcesAccessValidationWorkflowSnapshotDiff(snapshotId);
    const title = `Review Data Sources access validation workflow drift: ${diff.snapshotTitle || snapshot.title || snapshotId}`;
    await api.createTask({
      projectId: "data-sources",
      projectName: "Data Sources",
      title,
      description: buildDataSourcesAccessValidationWorkflowDriftTaskDescription(snapshot, diff),
      priority: getDataSourcesAccessValidationWorkflowDriftTaskPriority(diff.driftSeverity),
      status: "open"
    });
    await renderGovernance();
    return "Created Data Sources access validation workflow drift review task";
  }

  async function acceptDataSourcesAccessValidationWorkflowSnapshotDrift(snapshotId) {
    const snapshot = findDataSourcesAccessValidationWorkflowSnapshot(snapshotId);
    if (!snapshot) throw new Error(`Data Sources access validation workflow snapshot not found: ${snapshotId}`);

    const diff = await api.fetchSourcesAccessValidationWorkflowSnapshotDiff(snapshotId);
    const sourceTitle = diff.snapshotTitle || snapshot.title || snapshotId;
    await api.createSourcesAccessValidationWorkflowSnapshot({
      title: `Accepted Data Sources access validation workflow drift as current baseline: ${sourceTitle}`.slice(0, 120)
    });
    await renderGovernance();
    return "Accepted Data Sources access validation workflow drift as current baseline";
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
    copyGovernanceReleaseTaskLedger,
    saveReleaseTaskLedgerSnapshot,
    copyLatestReleaseTaskLedgerSnapshotDrift,
    createReleaseTaskLedgerDriftReviewTask,
    acceptReleaseTaskLedgerSnapshotDrift,
    bootstrapReleaseBuildGateLocalEvidence,
    seedReleaseBuildGateActionTasks,
    seedReleaseBuildGateActionTasksWithSnapshot,
    createReleaseBuildGateActionTaskWithSnapshot,
    saveReleaseCheckpoint,
    copyLatestAgentControlPlaneSnapshotDrift,
    copyBaselineAgentControlPlaneSnapshotDrift,
    copyAgentControlPlaneBaselineStatus,
    copyAgentControlPlaneDecision,
    copyAgentControlPlaneDecisionTaskLedger,
    saveAgentControlPlaneDecisionTaskLedgerSnapshot,
    copyLatestAgentControlPlaneDecisionTaskLedgerSnapshotDrift,
    copyAgentExecutionResultTaskLedger,
    saveAgentExecutionResultTaskLedgerSnapshot,
    copyLatestAgentExecutionResultTaskLedgerSnapshotDrift,
    createAgentExecutionResultTaskLedgerDriftReviewTask,
    acceptAgentExecutionResultTaskLedgerSnapshotDrift,
    seedAgentControlPlaneDecisionTasks,
    seedAgentControlPlaneDecisionTasksWithSnapshot,
    createAgentControlPlaneDecisionReasonTaskWithSnapshot,
    clearAgentControlPlaneBaselineSnapshot,
    refreshAgentControlPlaneBaselineSnapshot,
    copyAgentExecutionBriefs,
    copyAgentWorkOrders,
    copySourcesSummary,
    copySourcesAccessRequirements,
    copySourcesAccessMethodRegistry,
    copySourcesAccessValidationWorkflow,
    saveSourcesAccessValidationWorkflowSnapshot,
    copyLatestSourcesAccessValidationWorkflowSnapshotDrift,
    checkpointSourcesAccessValidationWorkflowTasks,
    seedSourcesAccessValidationWorkflowTasks,
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
    checkpointGovernanceDataSourcesAccessReviewTasks,
    seedGovernanceDataSourcesAccessReviewTasks,
    checkpointGovernanceDataSourcesAccessValidationEvidenceCoverageTasks,
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
    copyGovernanceTaskUpdateLedger,
    saveGovernanceTaskUpdateLedgerSnapshot,
    copyLatestGovernanceTaskUpdateLedgerSnapshotDrift,
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
