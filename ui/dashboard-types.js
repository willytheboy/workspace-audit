// @ts-check

/**
 * @typedef {{ type: string, message: string }} AuditWarning
 * @typedef {{ name: string, id: string, score: number, reasons: string[] }} SimilarApp
 * @typedef {{
 *   id: string,
 *   name: string,
 *   relPath: string,
 *   description: string,
 *   frameworks: string[],
 *   languages: string[],
 *   zone: string,
 *   category: string,
 *   qualityScore: number,
 *   freshnessScore: number,
 *   docsScore: number,
 *   testingScore: number,
 *   readinessScore: number,
 *   daysOld: number,
 *   docsFiles: number,
 *   testFiles: number,
 *   sourceFiles: number,
 *   sourceLines: number,
 *   warnings?: AuditWarning[],
 *   scripts?: string[],
 *   similarApps?: SimilarApp[]
 * }} AuditProject
 * @typedef {{ zoneOptions: string[], categoryOptions: string[] }} AuditMeta
 * @typedef {{
 *   totalApps: number,
 *   avgQuality?: number,
 *   totalSource?: number,
 *   totalTests?: number,
 *   zoneCounts?: Record<string, number>,
 *   strongest?: { score: number, leftName: string, rightName: string }
 * }} AuditSummary
 * @typedef {{
 *   generatedAt?: string,
 *   rootDir?: string,
 *   meta: AuditMeta,
 *   summary: AuditSummary,
 *   projects: AuditProject[]
 * }} AuditPayload
 * @typedef {{
 *   id: string,
 *   projectId?: string,
 *   projectName?: string,
 *   severity: "high" | "medium" | "low",
 *   category: string,
 *   title: string,
 *   detail: string,
 *   createdAt: string,
 *   status: string
 * }} PersistedFinding
 * @typedef {{
 *   id: string,
 *   projectId?: string,
 *   projectName?: string,
 *   title: string,
 *   description?: string,
 *   priority: string,
 *   status: string,
 *   sourceAccessReviewId?: string,
 *   sourceAccessValidationEvidenceCoverageId?: string,
 *   sourceId?: string,
 *   sourceLabel?: string,
 *   sourceType?: string,
 *   sourceValue?: string,
 *   accessMethod?: string,
 *   coverageStatus?: string,
 *   latestEvidenceStatus?: string,
 *   latestEvidenceId?: string,
 *   latestEvidenceAt?: string,
 *   lastSourceAccessValidationEvidenceId?: string,
 *   lastSourceAccessValidationEvidenceStatus?: string,
 *   lastSourceAccessValidationEvidenceAt?: string,
 *   releaseBuildGateActionId?: string,
 *   releaseBuildGateActionStatus?: string,
 *   releaseBuildGateActionPriority?: string,
 *   releaseBuildGateDecision?: string,
 *   releaseBuildGateRiskScore?: number,
 *   releaseBuildGateReasonCount?: number,
 *   releaseBuildGateCommandHint?: string,
 *   agentControlPlaneDecisionReasonCode?: string,
 *   agentControlPlaneDecisionReasonSeverity?: string,
 *   agentControlPlaneDecision?: string,
 *   agentControlPlaneRecommendedAction?: string,
 *   agentControlPlaneCommandHint?: string,
 *   secretPolicy?: string,
 *   createdAt: string,
 *   updatedAt: string
 * }} PersistedTask
 * @typedef {{
 *   id: string,
 *   projectId?: string,
 *   projectName?: string,
 *   title: string,
 *   brief?: string,
 *   status: string,
 *   phase: string,
 *   createdAt: string,
 *   updatedAt: string
 * }} PersistedWorkflow
 * @typedef {{
 *   id: string,
 *   projectId?: string,
 *   projectName?: string,
 *   relPath: string,
 *   script: string,
 *   status: "running" | "success" | "failed" | "cancelled",
 *   startedAt: string,
 *   endedAt?: string | null,
 *   exitCode?: number | null,
 *   detail?: string
 * }} PersistedScriptRun
 * @typedef {{
 *   id: string,
 *   projectId: string,
 *   projectName: string,
 *   relPath: string,
 *   title: string,
 *   summary?: string,
 *   handoffPack: string,
 *   status: string,
 *   createdAt: string,
 *   updatedAt: string
 * }} PersistedAgentSession
 * @typedef {{
 *   id: string,
 *   title: string,
 *   statusFilter: string,
 *   total: number,
 *   readyCount: number,
 *   needsPrepCount: number,
 *   blockedCount: number,
 *   markdown: string,
 *   items: GovernanceAgentReadinessItem[],
 *   createdAt: string
 * }} PersistedAgentWorkOrderSnapshot
 * @typedef {{
 *   id: string,
 *   status: string,
 *   previousStatus: string | null,
 *   note: string,
 *   actor: string,
 *   createdAt: string
 * }} PersistedAgentWorkOrderRunEvent
 * @typedef {{
 *   id: string,
 *   projectId: string,
 *   projectName: string,
 *   relPath: string,
 *   snapshotId: string,
 *   title: string,
 *   objective: string,
 *   status: "queued" | "running" | "blocked" | "passed" | "failed" | "cancelled",
 *   readinessScore: number,
 *   readinessStatus: string,
 *   blockers: string[],
 *   validationCommands: string[],
 *   notes: string,
 *   history: PersistedAgentWorkOrderRunEvent[],
 *   archivedAt: string,
 *   archivedBy: string,
 *   slaBreachedAt: string,
 *   slaResolvedAt: string,
 *   slaLastActionAt: string,
 *   slaAction: string,
 *   slaEscalationCount: number,
 *   slaResolutionCount: number,
 *   createdAt: string,
 *   updatedAt: string
 * }} PersistedAgentWorkOrderRun
 * @typedef {{
 *   total: number,
 *   active: number,
 *   completed: number,
 *   archived: number,
 *   staleActive: number,
 *   slaBreached: number,
 *   slaResolved: number,
 *   slaAverageResolutionHours: number,
 *   completionRate: number,
 *   failureRate: number,
 *   statusCounts: {
 *     queued: number,
 *     running: number,
 *     blocked: number,
 *     passed: number,
 *     failed: number,
 *     cancelled: number,
 *     other: number
 *   },
 *   latestEventAt: string,
 *   latestEventNote: string,
 *   latestEventStatus: string,
 *   latestEventProjectName: string,
 *   latestEventRunTitle: string
 *   staleThresholdHours: number,
 *   staleStatuses: string[]
 * }} GovernanceAgentExecutionMetrics
 * @typedef {{
 *   staleThresholdHours: number,
 *   staleStatuses: string[],
 *   terminalStatuses: string[],
 *   updatedAt: string
 * }} GovernanceAgentExecutionPolicy
 * @typedef {{
 *   id: string,
 *   projectId?: string,
 *   projectName?: string,
 *   title: string,
 *   body?: string,
 *   kind: string,
 *   createdAt: string,
 *   updatedAt: string
 * }} PersistedNote
 * @typedef {{
 *   id: string,
 *   projectId?: string,
 *   projectName?: string,
 *   title: string,
 *   detail?: string,
 *   status: string,
 *   targetDate?: string,
 *   createdAt: string,
 *   updatedAt: string
 * }} PersistedMilestone
 * @typedef {{
 *   id: string,
 *   projectId: string,
 *   projectName: string,
 *   owner: string,
 *   status: string,
 *   lifecycle: string,
 *   tier: string,
 *   targetState: string,
 *   summary?: string,
 *   createdAt: string,
 *   updatedAt: string
 * }} PersistedProjectProfile
 * @typedef {{
 *   id: string,
 *   projectId: string,
 *   projectName: string,
 *   changeType: "created" | "updated",
 *   changedFields: string[],
 *   previous: {
 *     owner: string,
 *     status: string,
 *     lifecycle: string,
 *     tier: string,
 *     targetState: string,
 *     summary: string
 *   } | null,
 *   next: {
 *     owner: string,
 *     status: string,
 *     lifecycle: string,
 *     tier: string,
 *     targetState: string,
 *     summary: string
 *   },
 *   changedAt: string
 * }} PersistedProjectProfileHistory
 * @typedef {{
 *   id: string,
 *   name: string,
 *   relPath: string,
 *   zone: string,
 *   category: string,
 *   qualityScore: number,
 *   freshnessScore: number,
 *   docsFiles: number,
 *   testFiles: number,
 *   sourceFiles: number,
 *   sourceLines: number,
 *   daysOld: number,
 *   frameworks: string[],
 *   warningsCount: number
 * }} ProjectScanSnapshot
 * @typedef {{
 *   id: string,
 *   generatedAt: string,
 *   summary: AuditSummary,
 *   projects?: ProjectScanSnapshot[]
 * }} PersistedScanRun
 * @typedef {{
 *   id: string,
 *   name: string,
 *   relPath: string,
 *   zone: string,
 *   category: string,
 *   qualityDelta: number,
 *   freshnessDelta: number,
 *   sourceDelta: number,
 *   testDelta: number,
 *   docsDelta: number,
 *   lineDelta: number,
 *   warningsDelta: number,
 *   fromZone: string,
 *   toZone: string,
 *   fromCategory: string,
 *   toCategory: string,
 *   changeScore: number
 * }} ScanDiffProjectChange
 * @typedef {{
 *   status: "insufficient_data" | "summary_only" | "ready",
 *   latestGeneratedAt: string | null,
 *   previousGeneratedAt: string | null,
 *   totals: {
 *     appDelta: number,
 *     qualityDelta: number,
 *     sourceDelta: number,
 *     testDelta: number,
 *     addedCount: number,
 *     removedCount: number,
 *     changedCount: number
 *   },
 *   addedProjects: Array<Pick<ProjectScanSnapshot, "id" | "name" | "relPath" | "zone" | "category" | "qualityScore">>,
 *   removedProjects: Array<Pick<ProjectScanSnapshot, "id" | "name" | "relPath" | "zone" | "category" | "qualityScore">>,
 *   changedProjects: ScanDiffProjectChange[],
 *   topChanges: ScanDiffProjectChange[]
 * }} ScanDiffPayload
 * @typedef {{
 *   projectId?: string,
 *   kind: string,
 *   title: string,
 *   projectName: string,
 *   status: string,
 *   timestamp: string,
 *   detail: string
 * }} GovernanceActivity
 * @typedef {{
 *   id: string,
 *   name: string,
 *   relPath: string,
 *   zone: string,
 *   category: string,
 *   qualityScore: number,
 *   findingCount: number
 * }} GovernanceGapProject
 * @typedef {{
 *   id: string,
 *   projectId: string,
 *   projectName: string,
 *   kind: "profile-gap" | "owner-gap" | "task-gap" | "workflow-gap" | "decision-gap",
 *   title: string,
 *   detail: string,
 *   priority: "high" | "medium" | "low",
 *   actionType: "create-profile" | "create-task" | "create-workflow" | "create-starter-pack" | "create-decision-note" | "open-project",
 *   actionLabel: string
 * }} GovernanceQueueItem
 * @typedef {{
 *   id: string,
 *   projectId: string,
 *   projectName: string,
 *   kind: string,
 *   title: string,
 *   reason: string,
 *   suppressedAt: string
 * }} GovernanceQueueSuppression
 * @typedef {{
 *   id: string,
 *   type: string,
 *   summary: string,
 *   actor: string,
 *   details: Record<string, unknown>,
 *   createdAt: string
 * }} GovernanceOperation
 * @typedef {{
 *   id: string,
 *   title: string,
 *   search: string,
 *   scope: string,
 *   sort: string,
 *   executionStatus: string,
 *   executionRetention: number,
 *   showArchivedExecution: boolean,
 *   createdAt: string,
 *   updatedAt: string
 * }} PersistedGovernanceExecutionView
 * @typedef {{
 *   id: string,
 *   projectId: string,
 *   projectName: string,
 *   title: string,
 *   phase: string,
 *   status: string,
 *   readiness: string,
 *   priority: "high" | "medium" | "low",
 *   blockers: string[],
 *   nextStep: string,
 *   updatedAt: string
 * }} GovernanceWorkflowRunbookItem
 * @typedef {{
 *   projectId: string,
 *   projectName: string,
 *   relPath: string,
 *   status: "ready" | "needs-prep" | "blocked",
 *   score: number,
 *   owner: string,
 *   lifecycle: string,
 *   targetState: string,
 *   openFindingCount: number,
 *   openTaskCount: number,
 *   activeWorkflowCount: number,
 *   agentSessionCount: number,
 *   latestWorkflowTitle: string,
 *   latestAgentSessionAt: string,
 *   blockers: string[],
 *   nextStep: string,
 *   updatedAt: string
 * }} GovernanceAgentReadinessItem
 * @typedef {{
 *   id: string,
 *   projectId: string,
 *   projectName: string,
 *   title: string,
 *   status: string,
 *   breachState: string,
 *   action: string,
 *   breachedAt: string,
 *   resolvedAt: string,
 *   escalationCount: number,
 *   resolutionCount: number,
 *   durationHours: number,
 *   updatedAt: string
 * }} GovernanceAgentExecutionSlaLedgerItem
 * @typedef {{
 *   id: string,
 *   title: string,
 *   stateFilter: "all" | "open" | "resolved",
 *   limit: number,
 *   available: number,
 *   total: number,
 *   openCount: number,
 *   resolvedCount: number,
 *   markdown: string,
 *   items: GovernanceAgentExecutionSlaLedgerItem[],
 *   createdAt: string
 * }} PersistedAgentExecutionSlaLedgerSnapshot
 * @typedef {{
 *   id: string,
 *   title: string,
 *   limit: number,
 *   totalWorkOrders: number,
 *   totalExecutionRuns: number,
 *   totalSlaLedgerRecords: number,
 *   totalSlaLedgerSnapshots: number,
 *   releaseBuildGateDecision: "ready" | "review" | "hold" | "not-evaluated",
 *   releaseBuildGateRiskScore: number,
 *   releaseBuildGateReasonCount: number,
 *   releaseBuildGateActionCount: number,
 *   releaseBuildGate: ReleaseBuildGatePayload | null,
 *   releaseControlTaskCount: number,
 *   releaseControlOpenTaskCount: number,
 *   releaseControlClosedTaskCount: number,
 *   releaseControlTasks: PersistedTask[],
 *   agentControlPlaneDecisionTaskCount: number,
 *   agentControlPlaneDecisionOpenTaskCount: number,
 *   agentControlPlaneDecisionClosedTaskCount: number,
 *   agentControlPlaneDecisionTasks: PersistedTask[],
 *   dataSourcesGateDecision: "ready" | "review" | "hold" | "not-evaluated",
 *   dataSourcesReview: number,
 *   dataSourcesBlocked: number,
 *   dataSourcesAccessGate: DataSourcesAccessGatePayload | null,
 *   dataSourcesAccessReviewQueueCount: number,
 *   dataSourcesAccessReviewQueue: DataSourcesAccessReviewQueuePayload | null,
 *   dataSourcesAccessValidationMethodCount: number,
 *   dataSourcesAccessValidationSourceCount: number,
 *   dataSourcesAccessValidationRunbook: DataSourcesAccessValidationRunbookPayload | null,
 *   dataSourcesAccessValidationEvidenceCount: number,
 *   dataSourcesAccessValidationEvidenceValidatedCount: number,
 *   dataSourcesAccessValidationEvidenceCoverageCount: number,
 *   dataSourcesAccessValidationEvidenceCoverageCoveredCount: number,
 *   dataSourcesAccessValidationEvidenceCoverageMissingCount: number,
 *   dataSourcesAccessValidationEvidenceCoverageHighPriorityCount: number,
 *   dataSourcesAccessValidationEvidenceCoveragePercent: number,
 *   dataSourcesAccessValidationEvidenceCoverage: DataSourcesAccessValidationEvidenceCoveragePayload | null,
 *   dataSourceAccessValidationEvidenceSnapshotCount: number,
 *   dataSourceAccessValidationEvidence: DataSourcesAccessValidationEvidenceRecord[],
 *   dataSourceAccessValidationEvidenceSnapshots: PersistedDataSourcesAccessValidationEvidenceSnapshot[],
 *   summary: Record<string, unknown>,
 *   markdown: string,
 *   payload: Record<string, unknown>,
 *   createdAt: string,
 *   isBaseline?: boolean
 * }} PersistedAgentControlPlaneSnapshot
 * @typedef {{
 *   id: string,
 *   title: string,
 *   decision: "ready" | "review" | "hold",
 *   recommendedAction: string,
 *   reasonCount: number,
 *   reasonCodes: string[],
 *   reasons: AgentControlPlaneDecisionReason[],
 *   baselineHealth: "missing" | "healthy" | "changed" | "drifted" | "stale",
 *   baselineDriftSeverity: "none" | "low" | "medium" | "high" | "missing-baseline",
 *   activeRuns: number,
 *   staleActiveRuns: number,
 *   slaBreachedRuns: number,
 *   agentReadyProjects: number,
 *   agentReadinessItems: number,
 *   releaseBuildGateDecision: "ready" | "review" | "hold" | "not-evaluated",
 *   releaseBuildGateRiskScore: number,
 *   releaseBuildGateReasonCount: number,
 *   releaseBuildGateActionCount: number,
 *   releaseBuildGate: ReleaseBuildGatePayload | null,
 *   releaseControlTaskCount: number,
 *   releaseControlOpenTaskCount: number,
 *   releaseControlClosedTaskCount: number,
 *   releaseControlTasks: PersistedTask[],
 *   agentControlPlaneDecisionTaskCount: number,
 *   agentControlPlaneDecisionOpenTaskCount: number,
 *   agentControlPlaneDecisionClosedTaskCount: number,
 *   agentControlPlaneDecisionTasks: PersistedTask[],
 *   dataSourcesGateDecision: "ready" | "review" | "hold" | "not-evaluated",
 *   dataSourcesReview: number,
 *   dataSourcesBlocked: number,
 *   dataSourcesAccessGate: DataSourcesAccessGatePayload | null,
 *   dataSourcesAccessReviewQueueCount: number,
 *   dataSourcesAccessReviewQueue: DataSourcesAccessReviewQueuePayload | null,
 *   dataSourcesAccessValidationMethodCount: number,
 *   dataSourcesAccessValidationSourceCount: number,
 *   dataSourcesAccessValidationReviewCount: number,
 *   dataSourcesAccessValidationBlockedCount: number,
 *   dataSourcesAccessValidationRunbook: DataSourcesAccessValidationRunbookPayload | null,
 *   dataSourcesAccessValidationEvidenceCount: number,
 *   dataSourcesAccessValidationEvidenceValidatedCount: number,
 *   dataSourcesAccessValidationEvidenceReviewCount: number,
 *   dataSourcesAccessValidationEvidenceBlockedCount: number,
 *   dataSourcesAccessValidationEvidenceCoverageCount: number,
 *   dataSourcesAccessValidationEvidenceCoverageCoveredCount: number,
 *   dataSourcesAccessValidationEvidenceCoverageReviewCount: number,
 *   dataSourcesAccessValidationEvidenceCoverageBlockedCount: number,
 *   dataSourcesAccessValidationEvidenceCoverageMissingCount: number,
 *   dataSourcesAccessValidationEvidenceCoverageHighPriorityCount: number,
 *   dataSourcesAccessValidationEvidenceCoveragePercent: number,
 *   dataSourcesAccessValidationEvidenceCoverage: DataSourcesAccessValidationEvidenceCoveragePayload | null,
 *   dataSourceAccessValidationEvidenceSnapshotCount: number,
 *   dataSourceAccessValidationEvidence: DataSourcesAccessValidationEvidenceRecord[],
 *   dataSourcesAccessTaskCount: number,
 *   dataSourcesAccessOpenTaskCount: number,
 *   dataSourcesAccessClosedTaskCount: number,
 *   dataSourcesAccessTasks: PersistedTask[],
 *   markdown: string,
 *   payload: AgentControlPlaneDecisionPayload,
 *   createdAt: string
 * }} PersistedAgentControlPlaneDecisionSnapshot
 * @typedef {{
 *   summary: {
 *     openFindings: number,
 *     openTasks: number,
 *     activeWorkflows: number,
 *     pendingMilestones: number,
 *     decisionNotes: number,
 *     trackedProjects: number,
 *     profileCount: number,
 *     ownedProfiles: number,
 *     actionQueueItems: number,
 *     suppressedQueueItems: number,
 *     governanceOperationCount: number,
 *     workflowRunbookItems: number,
 *     agentSessionCount: number,
 *     agentControlPlaneSnapshotCount: number,
 *     agentControlPlaneDecisionSnapshotCount: number,
 *     agentControlPlaneBaselineSnapshotId: string,
 *     agentControlPlaneBaselineSnapshotTitle: string,
 *     agentControlPlaneBaselineSnapshotCreatedAt: string,
 *     agentControlPlaneBaselineAgeHours: number,
 *     agentControlPlaneBaselineFreshness: string,
 *     agentControlPlaneBaselineFreshnessThresholdHours: number,
 *     agentControlPlaneBaselineHasDrift: boolean,
 *     agentControlPlaneBaselineDriftScore: number,
 *     agentControlPlaneBaselineDriftItems: Array<{ field: string, label: string, before: number, current: number, delta: number }>,
 *     agentControlPlaneBaselineDriftSeverity: "none" | "low" | "medium" | "high" | "missing-baseline",
 *     agentControlPlaneBaselineDriftRecommendedAction: string,
 *     agentControlPlaneBaselineHealth: "missing" | "healthy" | "changed" | "drifted" | "stale",
 *     agentControlPlaneBaselineRecommendedAction: string,
 *     agentWorkOrderSnapshotCount: number,
 *     agentExecutionSlaLedgerSnapshotCount: number,
 *     agentWorkOrderRunCount: number,
 *     governanceExecutionViewCount: number,
 *     archivedAgentWorkOrderRunCount: number,
 *     activeAgentWorkOrderRunCount: number,
 *     blockedAgentWorkOrderRunCount: number,
 *     staleAgentWorkOrderRunCount: number,
 *     slaBreachedAgentWorkOrderRunCount: number,
 *     agentExecutionSlaLedgerCount: number,
 *     dataSourcesAccessGateDecision: "ready" | "review" | "hold" | "not-evaluated",
 *     dataSourcesAccessGateRank: number,
 *     dataSourcesAccessReadyCount: number,
 *     dataSourcesAccessReviewCount: number,
 *     dataSourcesAccessBlockedCount: number,
 *     dataSourcesAccessTokenLikelyCount: number,
 *     dataSourcesAccessReviewQueueCount: number,
 *     dataSourcesAccessReviewBlockedCount: number,
 *     dataSourcesAccessReviewHighCount: number,
 *     dataSourcesAccessReviewMediumCount: number,
 *     dataSourcesAccessValidationMethodCount: number,
 *     dataSourcesAccessValidationSourceCount: number,
 *     dataSourcesAccessValidationReviewCount: number,
 *     dataSourcesAccessValidationBlockedCount: number,
 *     dataSourcesAccessValidationEvidenceCount: number,
 *     dataSourcesAccessValidationEvidenceValidatedCount: number,
 *     dataSourcesAccessValidationEvidenceReviewCount: number,
 *     dataSourcesAccessValidationEvidenceBlockedCount: number,
 *     dataSourcesAccessValidationEvidenceCoverageCount: number,
 *     dataSourcesAccessValidationEvidenceCoverageCoveredCount: number,
 *     dataSourcesAccessValidationEvidenceCoverageReviewCount: number,
 *     dataSourcesAccessValidationEvidenceCoverageBlockedCount: number,
 *     dataSourcesAccessValidationEvidenceCoverageMissingCount: number,
 *     dataSourcesAccessValidationEvidenceCoverageHighPriorityCount: number,
 *     dataSourcesAccessValidationEvidenceCoveragePercent: number,
 *     dataSourceAccessValidationEvidenceSnapshotCount: number,
 *     dataSourceAccessValidationEvidenceSnapshotHasDrift: boolean,
 *     dataSourceAccessValidationEvidenceSnapshotDriftScore: number,
 *     dataSourceAccessValidationEvidenceSnapshotDriftSeverity: "none" | "low" | "medium" | "high" | "missing-snapshot",
 *     dataSourcesAccessTaskCount: number,
 *     dataSourcesAccessOpenTaskCount: number,
 *     dataSourcesAccessClosedTaskCount: number,
 *     dataSourceAccessTaskLedgerSnapshotCount: number,
 *     deploymentSmokeCheckCount: number,
 *     deploymentSmokeCheckPassCount: number,
 *     deploymentSmokeCheckFailCount: number,
 *     releaseCheckpointCount: number,
 *     releaseLatestCheckpointStatus: string,
 *     releaseLatestCheckpointAt: string,
 *     releaseLatestCheckpointTitle: string,
 *     releaseBuildGateDecision: "ready" | "review" | "hold" | "not-evaluated",
 *     releaseBuildGateRank: number,
 *     releaseBuildGateRiskScore: number,
 *     releaseBuildGateReasonCount: number,
 *     releaseBuildGateActionCount: number,
 *     releaseControlTaskCount: number,
 *     releaseControlOpenTaskCount: number,
 *     releaseControlClosedTaskCount: number,
 *     agentReadyProjects: number,
 *     agentReadinessItems: number
 *   },
 *   recentActivity: GovernanceActivity[],
 *   workflowFocus: PersistedWorkflow[],
  *   milestoneFocus: PersistedMilestone[],
  *   decisions: PersistedNote[],
  *   profiles: PersistedProjectProfile[],
 *   profileHistory: PersistedProjectProfileHistory[],
 *   actionQueue: GovernanceQueueItem[],
  *   queueSuppressions: GovernanceQueueSuppression[],
 *   operationLog: GovernanceOperation[],
 *   workflowRunbook: GovernanceWorkflowRunbookItem[],
 *   agentSessions: PersistedAgentSession[],
 *   agentControlPlaneBaselineStatus: GovernanceAgentControlPlaneBaselineStatus | null,
 *   agentControlPlaneDecision: AgentControlPlaneDecisionPayload,
 *   agentControlPlaneSnapshots: PersistedAgentControlPlaneSnapshot[],
 *   agentControlPlaneBaselineSnapshotId: string,
 *   agentControlPlaneDecisionSnapshots: PersistedAgentControlPlaneDecisionSnapshot[],
 *   agentWorkOrderSnapshots: PersistedAgentWorkOrderSnapshot[],
 *   dataSourceAccessTaskLedgerSnapshots: PersistedDataSourcesAccessTaskLedgerSnapshot[],
 *   agentExecutionSlaLedgerSnapshots: PersistedAgentExecutionSlaLedgerSnapshot[],
 *   agentWorkOrderRuns: PersistedAgentWorkOrderRun[],
 *   agentExecutionSlaLedger: GovernanceAgentExecutionSlaLedgerItem[],
 *   agentExecutionMetrics: GovernanceAgentExecutionMetrics,
 *   agentExecutionPolicy: GovernanceAgentExecutionPolicy,
 *   deploymentSmokeChecks?: DeploymentSmokeCheckRecord[],
 *   releaseCheckpoints?: ReleaseCheckpointRecord[],
 *   releaseSummary?: ReleaseSummaryPayload | null,
 *   releaseCheckpointDrift?: ReleaseCheckpointDriftPayload | null,
 *   releaseBuildGate?: ReleaseBuildGatePayload | null,
 *   releaseControlTasks: PersistedTask[],
 *   agentControlPlaneDecisionTasks: PersistedTask[],
 *   dataSourcesAccessGate: DataSourcesAccessGatePayload | null,
 *   dataSourcesAccessReviewQueue: DataSourcesAccessReviewQueuePayload | null,
 *   dataSourcesAccessValidationRunbook: DataSourcesAccessValidationRunbookPayload | null,
 *   dataSourcesAccessValidationEvidenceCoverage: DataSourcesAccessValidationEvidenceCoveragePayload | null,
 *   dataSourceAccessValidationEvidence: DataSourcesAccessValidationEvidenceRecord[],
 *   dataSourceAccessValidationEvidenceSnapshots: PersistedDataSourcesAccessValidationEvidenceSnapshot[],
 *   dataSourceAccessValidationEvidenceSnapshotDiff: DataSourcesAccessValidationEvidenceSnapshotDiffPayload,
 *   dataSourcesAccessTasks: PersistedTask[],
 *   agentReadinessMatrix: GovernanceAgentReadinessItem[],
  *   unprofiledProjects: GovernanceGapProject[]
 * }} GovernancePayload
 * @typedef {{
 *   generatedAt: string,
 *   status: string,
 *   total: number,
 *   items: GovernanceAgentReadinessItem[],
 *   markdown: string
 * }} AgentWorkOrdersPayload
 * @typedef {{
 *   generatedAt: string,
 *   state: "all" | "open" | "resolved",
 *   limit: number,
 *   available: number,
 *   total: number,
 *   items: GovernanceAgentExecutionSlaLedgerItem[],
 *   markdown: string
 * }} AgentExecutionSlaLedgerPayload
 * @typedef {{
 *   generatedAt: string,
 *   limit: number,
 *   summary: GovernancePayload["summary"],
 *   agentExecutionMetrics: GovernanceAgentExecutionMetrics,
 *   agentExecutionPolicy: GovernanceAgentExecutionPolicy,
 *   baselineStatus: GovernanceAgentControlPlaneBaselineStatus | null,
 *   releaseBuildGate: ReleaseBuildGatePayload | null,
 *   releaseControlTasks: PersistedTask[],
 *   agentControlPlaneDecisionTasks: PersistedTask[],
 *   dataSourcesAccessGate: DataSourcesAccessGatePayload | null,
 *   dataSourcesAccessReviewQueue: DataSourcesAccessReviewQueuePayload | null,
 *   dataSourcesAccessValidationRunbook: DataSourcesAccessValidationRunbookPayload | null,
 *   dataSourcesAccessValidationEvidenceCoverage: DataSourcesAccessValidationEvidenceCoveragePayload | null,
 *   dataSourceAccessValidationEvidence: DataSourcesAccessValidationEvidenceRecord[],
 *   dataSourceAccessValidationEvidenceSnapshots: PersistedDataSourcesAccessValidationEvidenceSnapshot[],
 *   readiness: GovernanceAgentReadinessItem[],
 *   agentSessions: PersistedAgentSession[],
 *   workOrders: AgentWorkOrdersPayload,
 *   executionRuns: PersistedAgentWorkOrderRun[],
 *   slaLedger: AgentExecutionSlaLedgerPayload,
 *   workOrderSnapshots: PersistedAgentWorkOrderSnapshot[],
 *   decisionSnapshots: PersistedAgentControlPlaneDecisionSnapshot[],
 *   slaLedgerSnapshots: PersistedAgentExecutionSlaLedgerSnapshot[],
 *   markdown: string
 * }} AgentControlPlanePayload
 * @typedef {{
 *   severity: "review" | "hold",
 *   code: string,
 *   message: string
 * }} AgentControlPlaneDecisionReason
 * @typedef {{
 *   id: string,
 *   title: string,
 *   status: string,
 *   priority: string,
 *   projectId: string,
 *   projectName: string,
 *   agentControlPlaneDecisionReasonCode: string,
 *   agentControlPlaneDecisionReasonSeverity: string,
 *   agentControlPlaneDecision: string,
 *   agentControlPlaneRecommendedAction: string,
 *   agentControlPlaneCommandHint: string,
 *   description: string,
 *   secretPolicy: string,
 *   createdAt: string,
 *   updatedAt: string
 * }} AgentControlPlaneDecisionTaskLedgerItem
 * @typedef {{
 *   generatedAt: string,
 *   status: "all" | "open" | "closed",
 *   limit: number,
 *   secretPolicy: string,
 *   summary: {
 *     total: number,
 *     open: number,
 *     closed: number,
 *     visible: number,
 *     high: number,
 *     medium: number,
 *     low: number,
 *     normal: number,
 *     reasonCount: number,
 *     decisionCounts: Record<string, number>
 *   },
 *   items: AgentControlPlaneDecisionTaskLedgerItem[],
 *   markdown: string
 * }} AgentControlPlaneDecisionTaskLedgerPayload
 * @typedef {{
 *   generatedAt: string,
 *   decision: "ready" | "review" | "hold",
 *   recommendedAction: string,
 *   reasons: AgentControlPlaneDecisionReason[],
 *   baselineHealth: "missing" | "healthy" | "changed" | "drifted" | "stale",
 *   baselineDriftSeverity: "none" | "low" | "medium" | "high" | "missing-baseline",
 *   baselineDriftRecommendedAction: string,
 *   releaseBuildGateDecision: "ready" | "review" | "hold" | "not-evaluated",
 *   releaseBuildGateRiskScore: number,
 *   releaseBuildGateReasonCount: number,
 *   releaseBuildGateActionCount: number,
 *   releaseBuildGate: ReleaseBuildGatePayload | null,
 *   releaseControlTaskCount: number,
 *   releaseControlOpenTaskCount: number,
 *   releaseControlClosedTaskCount: number,
 *   releaseControlTasks: PersistedTask[],
 *   agentControlPlaneDecisionTaskCount: number,
 *   agentControlPlaneDecisionOpenTaskCount: number,
 *   agentControlPlaneDecisionClosedTaskCount: number,
 *   agentControlPlaneDecisionTasks: PersistedTask[],
 *   activeRuns: number,
 *   staleActiveRuns: number,
 *   slaBreachedRuns: number,
 *   agentReadyProjects: number,
 *   agentReadinessItems: number,
 *   dataSourcesGateDecision: "ready" | "review" | "hold" | "not-evaluated",
 *   dataSourcesReady: number,
 *   dataSourcesReview: number,
 *   dataSourcesBlocked: number,
 *   dataSourcesTokenLikely: number,
 *   dataSourcesAccessGate: DataSourcesAccessGatePayload | null,
 *   dataSourcesAccessReviewQueueCount: number,
 *   dataSourcesAccessReviewQueue: DataSourcesAccessReviewQueuePayload | null,
 *   dataSourcesAccessValidationMethodCount: number,
 *   dataSourcesAccessValidationSourceCount: number,
 *   dataSourcesAccessValidationReviewCount: number,
 *   dataSourcesAccessValidationBlockedCount: number,
 *   dataSourcesAccessValidationRunbook: DataSourcesAccessValidationRunbookPayload | null,
 *   dataSourcesAccessValidationEvidenceCount: number,
 *   dataSourcesAccessValidationEvidenceValidatedCount: number,
 *   dataSourcesAccessValidationEvidenceReviewCount: number,
 *   dataSourcesAccessValidationEvidenceBlockedCount: number,
 *   dataSourcesAccessValidationEvidenceCoverageCount: number,
 *   dataSourcesAccessValidationEvidenceCoverageCoveredCount: number,
 *   dataSourcesAccessValidationEvidenceCoverageReviewCount: number,
 *   dataSourcesAccessValidationEvidenceCoverageBlockedCount: number,
 *   dataSourcesAccessValidationEvidenceCoverageMissingCount: number,
 *   dataSourcesAccessValidationEvidenceCoverageHighPriorityCount: number,
 *   dataSourcesAccessValidationEvidenceCoveragePercent: number,
 *   dataSourcesAccessValidationEvidenceCoverage: DataSourcesAccessValidationEvidenceCoveragePayload | null,
 *   dataSourceAccessValidationEvidenceSnapshotCount: number,
 *   dataSourceAccessValidationEvidence: DataSourcesAccessValidationEvidenceRecord[],
 *   dataSourcesAccessTaskCount: number,
 *   dataSourcesAccessOpenTaskCount: number,
 *   dataSourcesAccessClosedTaskCount: number,
 *   dataSourcesAccessTasks: PersistedTask[],
 *   baselineStatus: GovernanceAgentControlPlaneBaselineStatus,
 *   agentExecutionMetrics: GovernanceAgentExecutionMetrics,
 *   summary: GovernancePayload["summary"],
 *   markdown: string
 * }} AgentControlPlaneDecisionPayload
 * @typedef {{
 *   addedCount: number,
 *   removedCount: number,
 *   changedCount: number,
 *   added: string[],
 *   removed: string[],
 *   changed: string[]
 * }} AgentControlPlaneSnapshotDriftSection
 * @typedef {{
 *   label: string,
 *   before: number,
 *   current: number,
 *   delta: number
 * }} AgentControlPlaneMetricDelta
 * @typedef {{
 *   generatedAt: string,
 *   snapshotId: string,
 *   snapshotTitle: string,
 *   snapshotCreatedAt: string,
 *   currentGeneratedAt: string,
 *   hasDrift: boolean,
 *   driftScore: number,
 *   driftSeverity: "none" | "low" | "medium" | "high" | "missing-baseline",
 *   recommendedAction: string,
 *   driftItems: Array<{ field: string, label: string, before: number, current: number, delta: number }>,
 *   metricDeltas: AgentControlPlaneMetricDelta[],
 *   readiness: AgentControlPlaneSnapshotDriftSection,
 *   executionRuns: AgentControlPlaneSnapshotDriftSection,
 *   slaLedger: AgentControlPlaneSnapshotDriftSection,
 *   workOrderSnapshots: AgentControlPlaneSnapshotDriftSection,
 *   slaLedgerSnapshots: AgentControlPlaneSnapshotDriftSection,
 *   markdown: string
 * }} AgentControlPlaneSnapshotDiffPayload
 * @typedef {{
 *   generatedAt: string,
 *   hasBaseline: boolean,
 *   baselineSnapshotId: string,
 *   snapshotTitle: string,
 *   snapshotCreatedAt: string,
 *   baselineAgeHours: number,
 *   baselineFreshness: "missing" | "fresh" | "stale",
 *   baselineFreshnessThresholdHours: number,
 *   health: "missing" | "healthy" | "changed" | "drifted" | "stale",
 *   recommendedAction: string,
 *   hasDrift: boolean,
 *   driftScore: number,
 *   driftSeverity: "none" | "low" | "medium" | "high" | "missing-baseline",
 *   driftRecommendedAction: string,
 *   driftItems: Array<{ field: string, label: string, before: number, current: number, delta: number }>,
 *   diff: AgentControlPlaneSnapshotDiffPayload | null,
 *   markdown: string
 * }} AgentControlPlaneBaselineStatusPayload
 * @typedef {{
 *   hasBaseline: boolean,
 *   snapshotId: string,
 *   title: string,
 *   createdAt: string,
 *   ageHours: number,
 *   freshness: "missing" | "fresh" | "stale",
 *   freshnessThresholdHours: number,
 *   hasDrift: boolean,
 *   driftScore: number,
 *   driftSeverity: "none" | "low" | "medium" | "high" | "missing-baseline",
 *   driftRecommendedAction: string,
 *   driftItems: Array<{ field: string, label: string, before: number, current: number, delta: number }>,
 *   health: "missing" | "healthy" | "changed" | "drifted" | "stale",
 *   recommendedAction: string,
 *   snapshotCount: number
 * }} GovernanceAgentControlPlaneBaselineStatus
 * @typedef {{
 *   id: string,
 *   type: string,
 *   label: string,
 *   value: string,
 *   path: string,
 *   url: string,
 *   resolvedPath: string,
 *   status: "reachable" | "registered" | "file" | "missing" | "unreachable" | "invalid-url",
 *   health: "ready" | "review" | "blocked",
 *   issue: string,
 *   access: DataSourceAccessProfile,
 *   addedAt: string,
 *   lastCheckedAt: string
 * }} DataSourceHealthRecord
 * @typedef {{
 *   accessLevel: string,
 *   accessMethod: string,
 *   requiresReview: boolean,
 *   passwordLikely: boolean,
 *   tokenLikely: boolean,
 *   certificateLikely: boolean,
 *   sshKeyLikely: boolean,
 *   credentialHints: string[],
 *   notes: string[],
 *   secretPolicy: string
 * }} DataSourceAccessProfile
 * @typedef {{
 *   generatedAt: string,
 *   summary: {
 *     total: number,
 *     ready: number,
 *     review: number,
 *     blocked: number,
 *     local: number,
 *     remote: number,
 *     typeCounts: Record<string, number>
 *   },
 *   sources: DataSourceHealthRecord[],
 *   markdown: string
 * }} DataSourcesSummaryPayload
 * @typedef {{
 *   id: string,
 *   sourceId: string,
 *   label: string,
 *   provider: string,
 *   url: string,
 *   host: string,
 *   sourceHealth: string,
 *   sourceStatus: string,
 *   accessMethod: string,
 *   protectedLikely: boolean,
 *   secretPolicy: string,
 *   latestSmokeCheck: DeploymentSmokeCheckRecord | null
 * }} DeploymentHealthTarget
 * @typedef {{
 *   generatedAt: string,
 *   summary: {
 *     total: number,
 *     protectedLikely: number,
 *     targetChecked: number,
 *     checked: number,
 *     pass: number,
 *     fail: number,
 *     unknown: number,
 *     latestCheckedAt: string,
 *     latestStatus: string,
 *     providerCounts: Record<string, number>
 *   },
 *   targets: DeploymentHealthTarget[],
 *   recentSmokeChecks: DeploymentSmokeCheckRecord[],
 *   markdown: string
 * }} DeploymentHealthPayload
 * @typedef {{
 *   id: string,
 *   targetId: string,
 *   sourceId: string,
 *   label: string,
 *   provider: string,
 *   url: string,
 *   host: string,
 *   status: "pass" | "fail",
 *   ok: boolean,
 *   httpStatus: number,
 *   statusText: string,
 *   contentType: string,
 *   latencyMs: number,
 *   timeoutMs: number,
 *   error: string,
 *   checkedAt: string,
 *   secretPolicy: string,
 *   markdown: string
 * }} DeploymentSmokeCheckRecord
 * @typedef {{
 *   generatedAt: string,
 *   summary: {
 *     total: number,
 *     pass: number,
 *     fail: number,
 *     latestStatus: string,
 *     latestCheckedAt: string,
 *     latestTarget: string
 *   },
 *   smokeChecks: DeploymentSmokeCheckRecord[],
 *   markdown: string
 * }} DeploymentSmokeChecksPayload
 * @typedef {{
 *   id: string,
 *   title: string,
 *   status: "ready" | "review" | "hold",
 *   branch: string,
 *   commit: string,
 *   commitShort: string,
 *   commitMessage: string,
 *   dirty: boolean,
 *   changedFileCount: number,
 *   deploymentStatus: string,
 *   deploymentSmokeCheckCount: number,
 *   deploymentSmokeCheckPassCount: number,
 *   deploymentSmokeCheckFailCount: number,
 *   validationStatus: string,
 *   latestScanAt: string,
 *   notes: string,
 *   markdown: string,
 *   createdAt: string
 * }} ReleaseCheckpointRecord
 * @typedef {{
 *   generatedAt: string,
 *   summary: {
 *     status: "ready" | "review" | "hold",
 *     releaseCheckpointCount: number,
 *     deploymentSmokeCheckCount: number,
 *     deploymentSmokeCheckPassCount: number,
 *     deploymentSmokeCheckFailCount: number,
 *     latestScanAt: string,
 *     validationStatus: string
 *   },
 *   git: {
 *     available: boolean,
 *     branch: string,
 *     commit: string,
 *     commitShort: string,
 *     commitMessage: string,
 *     dirty: boolean,
 *     changedFileCount: number,
 *     changedFiles?: string[],
 *     error: string
 *   },
 *   latestSmokeCheck: DeploymentSmokeCheckRecord | null,
 *   checkpoints: ReleaseCheckpointRecord[],
 *   markdown: string
 * }} ReleaseSummaryPayload
 * @typedef {{
 *   field: string,
 *   label: string,
 *   before: string,
 *   current: string,
 *   severity: "low" | "medium" | "high"
 * }} ReleaseCheckpointDriftItem
 * @typedef {{
 *   generatedAt: string,
 *   hasSnapshot: boolean,
 *   snapshotId: string,
 *   snapshotTitle: string,
 *   snapshotCreatedAt: string,
 *   hasDrift: boolean,
 *   driftScore: number,
 *   driftSeverity: "none" | "low" | "medium" | "high" | "missing-checkpoint",
 *   recommendedAction: string,
 *   driftItems: ReleaseCheckpointDriftItem[],
 *   checkpoint: ReleaseCheckpointRecord | null,
 *   live: {
 *     status: "ready" | "review" | "hold",
 *     branch: string,
 *     commit: string,
 *     commitShort: string,
 *     commitMessage: string,
 *     dirty: boolean,
 *     changedFileCount: number,
 *     deploymentStatus: string,
 *     deploymentSmokeCheckCount: number,
 *     deploymentSmokeCheckPassCount: number,
 *     deploymentSmokeCheckFailCount: number,
 *     validationStatus: string,
 *     latestScanAt: string
 *   } | null,
 *   markdown: string
 * }} ReleaseCheckpointDriftPayload
 * @typedef {{
 *   code: string,
 *   label: string,
 *   message: string,
 *   severity: "low" | "medium" | "high"
 * }} ReleaseBuildGateReason
 * @typedef {{
 *   id: string,
 *   label: string,
 *   priority: "low" | "medium" | "high",
 *   status: "open" | "ready",
 *   description: string,
 *   commandHint: string
 * }} ReleaseBuildGateAction
 * @typedef {{
 *   generatedAt: string,
 *   decision: "ready" | "review" | "hold",
 *   riskScore: number,
 *   recommendedAction: string,
 *   reasons: ReleaseBuildGateReason[],
 *   actions: ReleaseBuildGateAction[],
 *   releaseSummary: ReleaseSummaryPayload,
 *   releaseCheckpointDrift: ReleaseCheckpointDriftPayload,
 *   markdown: string
 * }} ReleaseBuildGatePayload
 * @typedef {{
 *   id: string,
 *   title: string,
 *   status: string,
 *   priority: string,
 *   projectId: string,
 *   projectName: string,
 *   releaseBuildGateActionId: string,
 *   releaseBuildGateActionStatus: string,
 *   releaseBuildGateActionPriority: string,
 *   releaseBuildGateDecision: string,
 *   releaseBuildGateRiskScore: number,
 *   releaseBuildGateReasonCount: number,
 *   releaseBuildGateCommandHint: string,
 *   description: string,
 *   secretPolicy: string,
 *   createdAt: string,
 *   updatedAt: string
 * }} ReleaseTaskLedgerItem
 * @typedef {{
 *   generatedAt: string,
 *   status: "all" | "open" | "closed",
 *   limit: number,
 *   secretPolicy: string,
 *   summary: {
 *     total: number,
 *     open: number,
 *     closed: number,
 *     visible: number,
 *     high: number,
 *     medium: number,
 *     low: number,
 *     normal: number
 *   },
 *   items: ReleaseTaskLedgerItem[],
 *   markdown: string
 * }} ReleaseTaskLedgerPayload
 * @typedef {{
 *   generatedAt: string,
 *   summary: {
 *     total: number,
 *     reviewRequired: number,
 *     tokenLikely: number,
 *     passwordLikely: number,
 *     certificateLikely: number,
 *     sshKeyLikely: number
 *   },
 *   sources: Array<{
 *     id: string,
 *     type: string,
 *     label: string,
 *     value: string,
 *     health: string,
 *     status: string,
 *     access: DataSourceAccessProfile
 *   }>,
 *   markdown: string
 * }} DataSourcesAccessRequirementsPayload
 * @typedef {{
 *   generatedAt: string,
 *   summary: {
 *     total: number,
 *     ready: number,
 *     review: number,
 *     blocked: number
 *   },
 *   items: Array<{
 *     id: string,
 *     sourceId: string,
 *     label: string,
 *     type: string,
 *     value: string,
 *     sourceHealth: string,
 *     sourceStatus: string,
 *     status: "ready" | "review" | "blocked",
 *     accessMethod: string,
 *     action: string,
 *     validation: string,
 *     credentialHint: string,
 *     secretPolicy: string
 *   }>,
 *   markdown: string
 * }} DataSourcesAccessChecklistPayload
 * @typedef {{
 *   accessMethod: string,
 *   title: string,
 *   steps: string[],
 *   commandHints: string[],
 *   evidence: string,
 *   sources: Array<{
 *     sourceId: string,
 *     label: string,
 *     type: string,
 *     status: string,
 *     sourceHealth: string,
 *     sourceStatus: string,
 *     credentialHint: string,
 *     secretPolicy: string
 *   }>
 * }} DataSourcesAccessValidationRunbookMethod
 * @typedef {{
 *   generatedAt: string,
 *   summary: {
 *     methodCount: number,
 *     sourceCount: number,
 *     ready: number,
 *     review: number,
 *     blocked: number
 *   },
 *   methods: DataSourcesAccessValidationRunbookMethod[],
 *   checklist: DataSourcesAccessChecklistPayload,
 *   markdown: string
 * }} DataSourcesAccessValidationRunbookPayload
 * @typedef {{
 *   id: string,
 *   sourceId: string,
 *   sourceLabel: string,
 *   sourceType: string,
 *   accessMethod: string,
 *   status: "validated" | "review" | "blocked",
 *   evidence: string,
 *   commandHint: string,
 *   checkedAt: string,
 *   createdAt: string,
 *   updatedAt: string,
 *   secretPolicy: string
 * }} DataSourcesAccessValidationEvidenceRecord
 * @typedef {{
 *   generatedAt: string,
 *   status: "all" | "validated" | "review" | "blocked",
 *   sourceId: string,
 *   accessMethod: string,
 *   limit: number,
 *   total: number,
 *   summary: {
 *     total: number,
 *     validated: number,
 *     review: number,
 *     blocked: number,
 *     methodCount: number,
 *     sourceCount: number
 *   },
 *   secretPolicy: string,
 *   items: DataSourcesAccessValidationEvidenceRecord[],
 *   markdown: string
 * }} DataSourcesAccessValidationEvidencePayload
 * @typedef {{
 *   id: string,
 *   sourceId: string,
 *   label: string,
 *   type: string,
 *   status: string,
 *   sourceHealth: string,
 *   sourceStatus: string,
 *   accessMethod: string,
 *   coverageStatus: "covered" | "review" | "blocked" | "missing",
 *   priority: "high" | "medium" | "low",
 *   action: string,
 *   latestEvidenceId: string,
 *   latestEvidenceStatus: string,
 *   latestEvidenceAt: string,
 *   latestEvidenceSummary: string,
 *   secretPolicy: string
 * }} DataSourcesAccessValidationEvidenceCoverageItem
 * @typedef {{
 *   generatedAt: string,
 *   summary: {
 *     sourceCount: number,
 *     covered: number,
 *     review: number,
 *     blocked: number,
 *     missing: number,
 *     highPriority: number,
 *     mediumPriority: number,
 *     methodCount: number,
 *     coveragePercent: number
 *   },
 *   secretPolicy: string,
 *   items: DataSourcesAccessValidationEvidenceCoverageItem[],
 *   runbook: DataSourcesAccessValidationRunbookPayload,
 *   markdown: string
 * }} DataSourcesAccessValidationEvidenceCoveragePayload
 * @typedef {{
 *   id: string,
 *   title: string,
 *   statusFilter: "all" | "validated" | "review" | "blocked",
 *   sourceId: string,
 *   accessMethod: string,
 *   limit: number,
 *   total: number,
 *   validatedCount: number,
 *   reviewCount: number,
 *   blockedCount: number,
 *   methodCount: number,
 *   sourceCount: number,
 *   secretPolicy: string,
 *   markdown: string,
 *   items: DataSourcesAccessValidationEvidenceRecord[],
 *   createdAt: string
 * }} PersistedDataSourcesAccessValidationEvidenceSnapshot
 * @typedef {{
 *   generatedAt: string,
 *   hasSnapshot: boolean,
 *   snapshotId: string,
 *   snapshotTitle: string,
 *   snapshotCreatedAt: string,
 *   hasDrift: boolean,
 *   driftScore: number,
 *   driftSeverity: "none" | "low" | "medium" | "high" | "missing-snapshot",
 *   recommendedAction: string,
 *   driftItems: Array<{ field: string, label: string, before: string | number, current: string | number, delta: number }>,
 *   liveSummary: DataSourcesAccessValidationEvidencePayload["summary"] | null,
 *   snapshotSummary: { total: number, validated: number, review: number, blocked: number, methodCount: number, sourceCount: number } | null,
 *   markdown: string
 * }} DataSourcesAccessValidationEvidenceSnapshotDiffPayload
 * @typedef {{
 *   accessMethod: string,
 *   total: number,
 *   reviewRequired: number,
 *   tokenLikely: number,
 *   passwordLikely: number,
 *   certificateLikely: number,
 *   sshKeyLikely: number,
 *   sources: Array<{
 *     id: string,
 *     label: string,
 *     type: string,
 *     health: string,
 *     status: string,
 *     accessLevel: string,
 *     requiresReview: boolean,
 *     credentialHints: string[],
 *     notes: string[]
 *   }>
 * }} DataSourcesAccessMatrixMethod
 * @typedef {{
 *   generatedAt: string,
 *   summary: {
 *     total: number,
 *     methodCount: number,
 *     reviewRequired: number,
 *     tokenLikely: number,
 *     passwordLikely: number,
 *     certificateLikely: number,
 *     sshKeyLikely: number
 *   },
 *   methods: DataSourcesAccessMatrixMethod[],
 *   requirements: DataSourcesAccessRequirementsPayload,
 *   markdown: string
 * }} DataSourcesAccessMatrixPayload
 * @typedef {{
 *   id: string,
 *   sourceId: string,
 *   label: string,
 *   type: string,
 *   value: string,
 *   title: string,
 *   status: "review" | "blocked",
 *   priority: "high" | "medium" | "normal",
 *   accessMethod: string,
 *   sourceHealth: string,
 *   sourceStatus: string,
 *   action: string,
 *   validation: string,
 *   credentialHint: string,
 *   secretPolicy: string
 * }} DataSourcesAccessReviewQueueItem
 * @typedef {{
 *   generatedAt: string,
 *   summary: {
 *     total: number,
 *     review: number,
 *     blocked: number,
 *     high: number,
 *     medium: number,
 *     normal: number,
 *     methodCount: number,
 *     tokenLikely: number,
 *     passwordLikely: number,
 *     certificateLikely: number,
 *     sshKeyLikely: number
 *   },
 *   items: DataSourcesAccessReviewQueueItem[],
 *   checklist: DataSourcesAccessChecklistPayload,
 *   matrix: DataSourcesAccessMatrixPayload,
 *   markdown: string
 * }} DataSourcesAccessReviewQueuePayload
 * @typedef {{
 *   id: string,
 *   title: string,
 *   status: string,
 *   priority: string,
 *   sourceAccessReviewId: string,
 *   sourceId: string,
 *   sourceLabel: string,
 *   sourceType: string,
 *   sourceValue: string,
 *   accessMethod: string,
 *   secretPolicy: string,
 *   createdAt: string,
 *   updatedAt: string
 * }} DataSourcesAccessTaskLedgerItem
 * @typedef {{
 *   generatedAt: string,
 *   status: "all" | "open" | "closed",
 *   limit: number,
 *   secretPolicy: string,
 *   summary: {
 *     total: number,
 *     open: number,
 *     closed: number,
 *     visible: number,
 *     high: number,
 *     medium: number,
 *     low: number,
 *     normal: number,
 *     methodCount: number,
 *     accessMethods: Record<string, number>
 *   },
 *   items: DataSourcesAccessTaskLedgerItem[],
 *   markdown: string
 * }} DataSourcesAccessTaskLedgerPayload
 * @typedef {{
 *   id: string,
 *   title: string,
 *   statusFilter: "all" | "open" | "closed",
 *   limit: number,
 *   total: number,
 *   openCount: number,
 *   closedCount: number,
 *   visibleCount: number,
 *   secretPolicy: string,
 *   markdown: string,
 *   items: DataSourcesAccessTaskLedgerItem[],
 *   createdAt: string
 * }} PersistedDataSourcesAccessTaskLedgerSnapshot
 * @typedef {{
 *   generatedAt: string,
 *   hasSnapshot: boolean,
 *   snapshotId: string,
 *   snapshotTitle: string,
 *   snapshotCreatedAt: string,
 *   hasDrift: boolean,
 *   driftScore: number,
 *   driftSeverity: "none" | "low" | "medium" | "high" | "missing-snapshot",
 *   recommendedAction: string,
 *   driftItems: Array<{ field: string, label: string, before: string | number, current: string | number, delta: number }>,
 *   liveSummary: DataSourcesAccessTaskLedgerPayload["summary"] | null,
 *   snapshotSummary: { total: number, open: number, closed: number, visible: number } | null,
 *   markdown: string
 * }} DataSourcesAccessTaskLedgerSnapshotDiffPayload
 * @typedef {{
 *   generatedAt: string,
 *   decision: "ready" | "review" | "hold",
 *   recommendedAction: string,
 *   reasons: Array<{ severity: "review" | "hold", code: string, message: string }>,
 *   total: number,
 *   ready: number,
 *   review: number,
 *   blocked: number,
 *   tokenLikely: number,
 *   passwordLikely: number,
 *   certificateLikely: number,
 *   sshKeyLikely: number,
 *   checklist: DataSourcesAccessChecklistPayload,
 *   accessRequirements: DataSourcesAccessRequirementsPayload,
 *   markdown: string
 * }} DataSourcesAccessGatePayload
 * @typedef {{
 *   id: string,
 *   title: string,
 *   total: number,
 *   ready: number,
 *   review: number,
 *   blocked: number,
 *   local: number,
 *   remote: number,
 *   typeCounts: Record<string, number>,
 *   markdown: string,
 *   sources: DataSourceHealthRecord[],
 *   payload: DataSourcesSummaryPayload,
 *   createdAt: string
 * }} PersistedDataSourcesSummarySnapshot
 * @typedef {{
 *   generatedAt: string,
 *   hasSnapshot: boolean,
 *   snapshotId: string,
 *   snapshotTitle: string,
 *   snapshotCreatedAt: string,
 *   hasDrift: boolean,
 *   driftScore: number,
 *   driftSeverity: "none" | "low" | "medium" | "high" | "missing-snapshot",
 *   recommendedAction: string,
 *   driftItems: Array<{ field: string, label: string, before: string | number, current: string | number, delta: number }>,
 *   liveSummary: DataSourcesSummaryPayload["summary"] | null,
 *   snapshotSummary: DataSourcesSummaryPayload["summary"] | Record<string, number> | null,
 *   markdown: string
 * }} DataSourcesSummarySnapshotDiffPayload
 * @typedef {"api" | "file" | "embedded" | "unavailable"} InventorySource
 * @typedef {"idle" | "loading" | "ready" | "empty" | "error"} PanelLoadStatus
 * @typedef {{
 *   status: PanelLoadStatus,
 *   lastLoadedAt?: string,
 *   itemCount?: number,
 *   message?: string
 * }} PanelRuntimeState
 * @typedef {{
 *   inventorySource: InventorySource,
 *   lastLoadedAt?: string,
 *   snapshotGeneratedAt?: string,
 *   loadError?: string,
 *   panels: {
 *     findings: PanelRuntimeState,
 *     trends: PanelRuntimeState,
 *     sources: PanelRuntimeState,
 *     governance: PanelRuntimeState
 *   }
 * }} DashboardRuntimeState
 * @typedef {{
 *   search: string,
 *   zone: string,
 *   category: string,
 *   sortKey: string,
 *   sortDir: "asc" | "desc",
 *   showArchived: boolean,
 *   view: "grid" | "table" | "graph" | "findings" | "trends" | "sources" | "governance"
 * }} DashboardState
 */

export {};
