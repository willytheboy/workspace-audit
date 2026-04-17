import assert from "node:assert/strict";
import { once } from "node:events";
import { createWorkspaceAuditServer } from "../lib/workspace-audit-server.mjs";
import { createFixtureWorkspace } from "./test-helpers.mjs";

export async function governanceBootstrapTest() {
  const { appDir, workspaceRoot } = await createFixtureWorkspace();
  const server = createWorkspaceAuditServer({
    rootDir: workspaceRoot,
    publicDir: appDir
  });

  server.listen(0);
  await once(server, "listening");

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const governanceScope = { activeProjectId: "alpha-app", scopeMode: "project" };

  try {
    const initialGovernanceResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(initialGovernanceResponse.status, 200);
    const initialGovernanceJson = await initialGovernanceResponse.json();
    assert.equal(initialGovernanceJson.summary.profileCount, 0);
    assert.equal(initialGovernanceJson.summary.governanceProfileScope, "app-development");
    assert.equal(initialGovernanceJson.summary.governanceScopeProjectCount, 1);
    assert.equal(initialGovernanceJson.summary.governanceScopeProfileCount, 0);
    assert.equal(initialGovernanceJson.summary.governanceScopeProfileGapCount, 1);
    assert.equal(initialGovernanceJson.summary.governanceScopeProfileCoveragePercent, 0);
    assert.equal(initialGovernanceJson.summary.pendingMilestones, 0);
    assert.equal(initialGovernanceJson.summary.decisionNotes, 0);
    assert.equal(initialGovernanceJson.unprofiledProjects.length, 1);
    assert.equal(initialGovernanceJson.unprofiledProjects[0].governanceScope, "app-development");
    assert.ok(initialGovernanceJson.unprofiledProjects[0].governanceScopeScore >= 45);
    assert.ok(initialGovernanceJson.unprofiledProjects[0].governanceScopeReasons.length > 0);
    assert.equal(initialGovernanceJson.profileCoverage.scopedProjects, 1);
    assert.equal(initialGovernanceJson.profileCoverage.scopedUnprofiledProjects, 1);
    assert.equal(initialGovernanceJson.summary.actionQueueItems, 1);
    assert.equal(initialGovernanceJson.summary.governanceOperationCount, 0);
    assert.equal(initialGovernanceJson.summary.workflowRunbookItems, 0);
    assert.equal(initialGovernanceJson.actionQueue.length, 1);
    assert.equal(initialGovernanceJson.operationLog.length, 0);
    assert.equal(initialGovernanceJson.workflowRunbook.length, 0);
    assert.equal(initialGovernanceJson.actionQueue[0].kind, "profile-gap");
    assert.equal(initialGovernanceJson.actionQueue[0].actionType, "create-starter-pack");
    assert.match(initialGovernanceJson.actionQueue[0].detail, /app-dev scope/);

    const unscopedSeedProfilesResponse = await fetch(`${baseUrl}/api/governance/bootstrap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "profiles",
        projectIds: ["alpha-app"]
      })
    });
    assert.equal(unscopedSeedProfilesResponse.status, 409);
    const unscopedSeedProfilesJson = await unscopedSeedProfilesResponse.json();
    assert.equal(unscopedSeedProfilesJson.reasonCode, "agent-execution-scope-required");

    const seedProfilesResponse = await fetch(`${baseUrl}/api/governance/bootstrap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "profiles",
        projectIds: ["alpha-app"],
        ...governanceScope
      })
    });
    assert.equal(seedProfilesResponse.status, 200);
    const seedProfilesJson = await seedProfilesResponse.json();
    assert.equal(seedProfilesJson.success, true);
    assert.equal(seedProfilesJson.totals.profiles, 1);
    assert.equal(seedProfilesJson.totals.tasks, 0);
    assert.equal(seedProfilesJson.totals.workflows, 0);
    assert.equal(seedProfilesJson.totals.notes, 0);
    assert.equal(seedProfilesJson.totals.milestones, 0);
    assert.equal(seedProfilesJson.profileHistoryEntries.length, 1);
    assert.ok(seedProfilesJson.createdProfiles[0].testCoverageTarget);
    assert.ok(seedProfilesJson.createdProfiles[0].runtimeTarget);
    assert.match(seedProfilesJson.createdProfiles[0].testCoverageTarget.rationale, /detected test file/);

    const profileHistoryResponse = await fetch(`${baseUrl}/api/project-profile-history?projectId=alpha-app`);
    assert.equal(profileHistoryResponse.status, 200);
    const profileHistoryJson = await profileHistoryResponse.json();
    assert.equal(profileHistoryJson.length, 1);
    assert.equal(profileHistoryJson[0].changeType, "created");

    const postProfileGovernanceResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(postProfileGovernanceResponse.status, 200);
    const postProfileGovernanceJson = await postProfileGovernanceResponse.json();
    assert.equal(postProfileGovernanceJson.summary.profileCount, 1);
    assert.equal(postProfileGovernanceJson.summary.governanceScopeProfileCount, 1);
    assert.equal(postProfileGovernanceJson.summary.governanceScopeProfileGapCount, 0);
    assert.equal(postProfileGovernanceJson.summary.governanceScopeProfileCoveragePercent, 100);
    assert.equal(postProfileGovernanceJson.summary.actionQueueItems, 3);
    assert.equal(postProfileGovernanceJson.summary.governanceOperationCount, 1);
    assert.equal(postProfileGovernanceJson.summary.workflowRunbookItems, 0);
    assert.equal(postProfileGovernanceJson.operationLog[0].type, "bootstrap-profiles");
    assert.deepEqual(
      postProfileGovernanceJson.actionQueue.map((item) => item.kind).sort(),
      ["owner-gap", "task-gap", "workflow-gap"]
    );

    const executableQueueItems = postProfileGovernanceJson.actionQueue
      .filter((item) => item.actionType !== "open-project")
      .map((item) => ({
        id: item.id,
        projectId: item.projectId,
        projectName: item.projectName,
        kind: item.kind,
        actionType: item.actionType
      }));
    const executeQueueResponse = await fetch(`${baseUrl}/api/governance/queue/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: executableQueueItems })
    });
    assert.equal(executeQueueResponse.status, 200);
    const executeQueueJson = await executeQueueResponse.json();
    assert.equal(executeQueueJson.success, true);
    assert.equal(executeQueueJson.totals.tasks, 1);
    assert.equal(executeQueueJson.totals.workflows, 1);
    assert.equal(executeQueueJson.totals.notes, 0);
    assert.equal(executeQueueJson.totals.milestones, 0);

    const starterPackResponse = await fetch(`${baseUrl}/api/governance/bootstrap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "starter-pack",
        projectIds: ["alpha-app"],
        ...governanceScope
      })
    });
    assert.equal(starterPackResponse.status, 200);
    const starterPackJson = await starterPackResponse.json();
    assert.equal(starterPackJson.success, true);
    assert.equal(starterPackJson.totals.profiles, 0);
    assert.equal(starterPackJson.totals.tasks, 0);
    assert.equal(starterPackJson.totals.workflows, 0);
    assert.equal(starterPackJson.totals.notes, 1);
    assert.equal(starterPackJson.totals.milestones, 1);
    assert.match(starterPackJson.createdMilestones[0].detail, /Coverage target:/);
    assert.match(starterPackJson.createdMilestones[0].detail, /Runtime target:/);

    const starterPackRepeatResponse = await fetch(`${baseUrl}/api/governance/bootstrap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "starter-pack",
        projectIds: ["alpha-app"],
        ...governanceScope
      })
    });
    assert.equal(starterPackRepeatResponse.status, 200);
    const starterPackRepeatJson = await starterPackRepeatResponse.json();
    assert.equal(starterPackRepeatJson.totals.profiles, 0);
    assert.equal(starterPackRepeatJson.totals.tasks, 0);
    assert.equal(starterPackRepeatJson.totals.workflows, 0);
    assert.equal(starterPackRepeatJson.totals.notes, 0);
    assert.equal(starterPackRepeatJson.totals.milestones, 0);

    const finalGovernanceResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(finalGovernanceResponse.status, 200);
    const finalGovernanceJson = await finalGovernanceResponse.json();
    assert.equal(finalGovernanceJson.summary.profileCount, 1);
    assert.equal(finalGovernanceJson.summary.governanceScopeProfileCoveragePercent, 100);
    assert.equal(finalGovernanceJson.summary.governanceScopeProfileGapCount, 0);
    assert.equal(finalGovernanceJson.summary.governanceProfileTargetCount, 1);
    assert.equal(finalGovernanceJson.profileTargets.length, 1);
    assert.equal(finalGovernanceJson.profileTargets[0].projectId, "alpha-app");
    assert.ok(finalGovernanceJson.profileTargets[0].targetTestFiles >= 1);
    assert.ok(["met", "missing", "needs-growth"].includes(finalGovernanceJson.profileTargets[0].testStatus));
    assert.equal(finalGovernanceJson.summary.openTasks, 1);
    assert.equal(finalGovernanceJson.summary.activeWorkflows, 1);
    assert.equal(finalGovernanceJson.summary.pendingMilestones, 1);
    assert.equal(finalGovernanceJson.summary.decisionNotes, 1);
    assert.equal(finalGovernanceJson.profileHistory.length, 1);
    assert.equal(finalGovernanceJson.unprofiledProjects.length, 0);
    assert.equal(finalGovernanceJson.summary.actionQueueItems, 1);
    assert.equal(finalGovernanceJson.summary.governanceOperationCount, 4);
    assert.equal(finalGovernanceJson.summary.workflowRunbookItems, 1);
    assert.equal(finalGovernanceJson.actionQueue.length, 1);
    assert.equal(finalGovernanceJson.operationLog.length, 4);
    assert.equal(finalGovernanceJson.workflowRunbook.length, 1);
    assert.equal(finalGovernanceJson.workflowRunbook[0].phase, "planning");
    assert.ok(finalGovernanceJson.workflowRunbook[0].blockers.includes("owner missing"));
    assert.equal(finalGovernanceJson.actionQueue[0].kind, "owner-gap");

    const unscopedRefreshProfileTargetsResponse = await fetch(`${baseUrl}/api/governance/profile-targets/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert.equal(unscopedRefreshProfileTargetsResponse.status, 409);
    const unscopedRefreshProfileTargetsJson = await unscopedRefreshProfileTargetsResponse.json();
    assert.equal(unscopedRefreshProfileTargetsJson.reasonCode, "agent-execution-scope-required");

    const refreshProfileTargetsResponse = await fetch(`${baseUrl}/api/governance/profile-targets/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(governanceScope)
    });
    assert.equal(refreshProfileTargetsResponse.status, 200);
    const refreshProfileTargetsJson = await refreshProfileTargetsResponse.json();
    assert.equal(refreshProfileTargetsJson.success, true);
    assert.equal(refreshProfileTargetsJson.totals.refreshed, 1);
    assert.equal(refreshProfileTargetsJson.refreshedProfiles[0].projectId, "alpha-app");

    const undercoveredProfileResponse = await fetch(`${baseUrl}/api/project-profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "alpha-app",
        projectName: "Alpha App",
        owner: "",
        status: "active",
        lifecycle: "active",
        tier: "important",
        targetState: "stabilize",
        summary: "Fixture profile target task seeding state.",
        testCoverageTarget: {
          currentTestFiles: 0,
          sourceFiles: 24,
          targetTestFiles: 2,
          missingTestFiles: 2,
          status: "missing",
          rationale: "Fixture target gap."
        },
        runtimeTarget: {
          scriptCount: 2,
          runtimeSurfaceCount: 1,
          launchCommandCount: 2,
          status: "detected",
          rationale: "Fixture runtime ready."
        },
        ...governanceScope
      })
    });
    assert.equal(undercoveredProfileResponse.status, 200);

    const unscopedSeedProfileTargetTasksResponse = await fetch(`${baseUrl}/api/governance/profile-targets/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert.equal(unscopedSeedProfileTargetTasksResponse.status, 409);
    const unscopedSeedProfileTargetTasksJson = await unscopedSeedProfileTargetTasksResponse.json();
    assert.equal(unscopedSeedProfileTargetTasksJson.reasonCode, "agent-execution-scope-required");

    const seedProfileTargetTasksResponse = await fetch(`${baseUrl}/api/governance/profile-targets/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(governanceScope)
    });
    assert.equal(seedProfileTargetTasksResponse.status, 200);
    const seedProfileTargetTasksJson = await seedProfileTargetTasksResponse.json();
    assert.equal(seedProfileTargetTasksJson.success, true);
    assert.equal(seedProfileTargetTasksJson.totals.created, 1);
    assert.equal(seedProfileTargetTasksJson.createdTasks[0].governanceProfileTargetKind, "test-coverage");
    assert.equal(seedProfileTargetTasksJson.createdTasks[0].governanceProfileTargetTaskKey, "alpha-app:test-coverage");

    const profileTargetGovernanceResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(profileTargetGovernanceResponse.status, 200);
    const profileTargetGovernanceJson = await profileTargetGovernanceResponse.json();
    assert.equal(profileTargetGovernanceJson.summary.governanceProfileTargetOpenTaskCount, 1);
    assert.equal(profileTargetGovernanceJson.summary.governanceProfileTargetMissingTaskCount, 0);
    assert.equal(profileTargetGovernanceJson.profileTargetTasks.length, 1);
    assert.equal(profileTargetGovernanceJson.profileTargets[0].testTaskStatus, "open");

    const profileTargetTaskLedgerResponse = await fetch(`${baseUrl}/api/governance/profile-target-task-ledger?status=open`);
    assert.equal(profileTargetTaskLedgerResponse.status, 200);
    const profileTargetTaskLedgerJson = await profileTargetTaskLedgerResponse.json();
    assert.equal(profileTargetTaskLedgerJson.summary.visible, 1);
    assert.equal(profileTargetTaskLedgerJson.summary.open, 1);
    assert.equal(profileTargetTaskLedgerJson.summary.testCoverage, 1);
    assert.match(profileTargetTaskLedgerJson.markdown, /Governance Profile Target Task Ledger/);
    assert.match(profileTargetTaskLedgerJson.markdown, /alpha-app:test-coverage/);

    const unscopedProfileTargetTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/governance/profile-target-task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Profile Target Task Ledger Snapshot",
        status: "open"
      })
    });
    assert.equal(unscopedProfileTargetTaskLedgerSnapshotResponse.status, 409);
    const unscopedProfileTargetTaskLedgerSnapshotJson = await unscopedProfileTargetTaskLedgerSnapshotResponse.json();
    assert.equal(unscopedProfileTargetTaskLedgerSnapshotJson.reasonCode, "agent-execution-scope-required");

    const profileTargetTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/governance/profile-target-task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Profile Target Task Ledger Snapshot",
        status: "open",
        ...governanceScope
      })
    });
    assert.equal(profileTargetTaskLedgerSnapshotResponse.status, 200);
    const profileTargetTaskLedgerSnapshotJson = await profileTargetTaskLedgerSnapshotResponse.json();
    assert.equal(profileTargetTaskLedgerSnapshotJson.success, true);
    assert.equal(profileTargetTaskLedgerSnapshotJson.snapshot.openCount, 1);
    assert.equal(profileTargetTaskLedgerSnapshotJson.snapshot.testCoverageCount, 1);
    assert.match(profileTargetTaskLedgerSnapshotJson.snapshot.markdown, /Fixture Profile Target Task Ledger Snapshot|Governance Profile Target Task Ledger/);

    const profileTargetTaskLedgerSnapshotDiffResponse = await fetch(`${baseUrl}/api/governance/profile-target-task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(profileTargetTaskLedgerSnapshotDiffResponse.status, 200);
    const profileTargetTaskLedgerSnapshotDiffJson = await profileTargetTaskLedgerSnapshotDiffResponse.json();
    assert.equal(profileTargetTaskLedgerSnapshotDiffJson.driftSeverity, "none");
    assert.equal(profileTargetTaskLedgerSnapshotDiffJson.driftScore, 0);
    assert.match(profileTargetTaskLedgerSnapshotDiffJson.markdown, /Governance Profile Target Task Ledger Snapshot Drift/);

    const profileTargetSnapshotGovernanceResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(profileTargetSnapshotGovernanceResponse.status, 200);
    const profileTargetSnapshotGovernanceJson = await profileTargetSnapshotGovernanceResponse.json();
    assert.equal(profileTargetSnapshotGovernanceJson.summary.governanceProfileTargetTaskLedgerSnapshotCount, 1);
    assert.equal(profileTargetSnapshotGovernanceJson.summary.governanceProfileTargetTaskLedgerSnapshotDriftSeverity, "none");
    assert.equal(profileTargetSnapshotGovernanceJson.governanceProfileTargetTaskLedgerSnapshots.length, 1);
    assert.equal(profileTargetSnapshotGovernanceJson.governanceProfileTargetTaskLedgerSnapshotDiff.driftScore, 0);
    assert.equal(profileTargetSnapshotGovernanceJson.governanceProfileTargetTaskLedgerBaselineStatus.health, "healthy");
    assert.equal(profileTargetSnapshotGovernanceJson.agentControlPlaneDecision.profileTargetTaskLedgerBaselineHealth, "healthy");
    assert.equal(profileTargetSnapshotGovernanceJson.agentControlPlaneDecision.profileTargetTaskLedgerBaselineUncheckpointedDriftCount, 0);

    const profileTargetTaskLedgerBaselineStatusResponse = await fetch(`${baseUrl}/api/governance/profile-target-task-ledger-baseline-status`);
    assert.equal(profileTargetTaskLedgerBaselineStatusResponse.status, 200);
    const profileTargetTaskLedgerBaselineStatusJson = await profileTargetTaskLedgerBaselineStatusResponse.json();
    assert.equal(profileTargetTaskLedgerBaselineStatusJson.hasBaseline, true);
    assert.equal(profileTargetTaskLedgerBaselineStatusJson.health, "healthy");
    assert.equal(profileTargetTaskLedgerBaselineStatusJson.driftScore, 0);
    assert.equal(profileTargetTaskLedgerBaselineStatusJson.uncheckpointedDriftItemCount, 0);
    assert.match(profileTargetTaskLedgerBaselineStatusJson.markdown, /Governance Profile Target Task Ledger Baseline Status/);

    const unscopedProfileTargetTaskLedgerSnapshotRefreshResponse = await fetch(`${baseUrl}/api/governance/profile-target-task-ledger-snapshots/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        title: "Fixture Refreshed Profile Target Task Ledger Baseline"
      })
    });
    assert.equal(unscopedProfileTargetTaskLedgerSnapshotRefreshResponse.status, 409);
    const unscopedProfileTargetTaskLedgerSnapshotRefreshJson = await unscopedProfileTargetTaskLedgerSnapshotRefreshResponse.json();
    assert.equal(unscopedProfileTargetTaskLedgerSnapshotRefreshJson.reasonCode, "agent-execution-scope-required");

    const profileTargetTaskLedgerSnapshotRefreshResponse = await fetch(`${baseUrl}/api/governance/profile-target-task-ledger-snapshots/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        title: "Fixture Refreshed Profile Target Task Ledger Baseline",
        ...governanceScope
      })
    });
    assert.equal(profileTargetTaskLedgerSnapshotRefreshResponse.status, 200);
    const profileTargetTaskLedgerSnapshotRefreshJson = await profileTargetTaskLedgerSnapshotRefreshResponse.json();
    assert.equal(profileTargetTaskLedgerSnapshotRefreshJson.success, true);
    assert.equal(profileTargetTaskLedgerSnapshotRefreshJson.snapshot.openCount, 1);
    assert.equal(profileTargetTaskLedgerSnapshotRefreshJson.governanceProfileTargetTaskLedgerSnapshots.length, 2);

    const updateProfileTargetTaskResponse = await fetch(`${baseUrl}/api/tasks/${encodeURIComponent(seedProfileTargetTasksJson.createdTasks[0].id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "resolved"
      })
    });
    assert.equal(updateProfileTargetTaskResponse.status, 200);

    const profileTargetTaskLedgerDriftAfterUpdateResponse = await fetch(`${baseUrl}/api/governance/profile-target-task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(profileTargetTaskLedgerDriftAfterUpdateResponse.status, 200);
    const profileTargetTaskLedgerDriftAfterUpdateJson = await profileTargetTaskLedgerDriftAfterUpdateResponse.json();
    assert.equal(profileTargetTaskLedgerDriftAfterUpdateJson.hasDrift, true);
    assert.ok(profileTargetTaskLedgerDriftAfterUpdateJson.driftItems.some((item) => item.field === "open"));

    const profileTargetTaskLedgerBaselineStatusAfterDriftResponse = await fetch(`${baseUrl}/api/governance/profile-target-task-ledger-baseline-status`);
    assert.equal(profileTargetTaskLedgerBaselineStatusAfterDriftResponse.status, 200);
    const profileTargetTaskLedgerBaselineStatusAfterDriftJson = await profileTargetTaskLedgerBaselineStatusAfterDriftResponse.json();
    assert.equal(profileTargetTaskLedgerBaselineStatusAfterDriftJson.health, "drift-review-required");
    assert.equal(profileTargetTaskLedgerBaselineStatusAfterDriftJson.uncheckpointedDriftItemCount > 0, true);

    const profileTargetTaskLedgerGovernanceAfterDriftResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(profileTargetTaskLedgerGovernanceAfterDriftResponse.status, 200);
    const profileTargetTaskLedgerGovernanceAfterDriftJson = await profileTargetTaskLedgerGovernanceAfterDriftResponse.json();
    assert.equal(profileTargetTaskLedgerGovernanceAfterDriftJson.agentControlPlaneDecision.profileTargetTaskLedgerBaselineHealth, "drift-review-required");
    assert.ok(profileTargetTaskLedgerGovernanceAfterDriftJson.agentControlPlaneDecision.reasons.some((reason) => reason.code === "profile-target-task-baseline-drift-review"));
    assert.match(profileTargetTaskLedgerGovernanceAfterDriftJson.agentControlPlaneDecision.markdown, /Profile target task baseline health: drift-review-required/);

    const unscopedProfileTargetTaskLedgerDriftCheckpointResponse = await fetch(`${baseUrl}/api/governance/profile-target-task-ledger-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        field: "open",
        decision: "confirmed",
        note: "Fixture checkpoint for target task ledger drift"
      })
    });
    assert.equal(unscopedProfileTargetTaskLedgerDriftCheckpointResponse.status, 409);
    const unscopedProfileTargetTaskLedgerDriftCheckpointJson = await unscopedProfileTargetTaskLedgerDriftCheckpointResponse.json();
    assert.equal(unscopedProfileTargetTaskLedgerDriftCheckpointJson.reasonCode, "agent-execution-scope-required");

    const profileTargetTaskLedgerDriftCheckpointResponse = await fetch(`${baseUrl}/api/governance/profile-target-task-ledger-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        field: "open",
        decision: "confirmed",
        note: "Fixture checkpoint for target task ledger drift",
        ...governanceScope
      })
    });
    assert.equal(profileTargetTaskLedgerDriftCheckpointResponse.status, 200);
    const profileTargetTaskLedgerDriftCheckpointJson = await profileTargetTaskLedgerDriftCheckpointResponse.json();
    assert.equal(profileTargetTaskLedgerDriftCheckpointJson.success, true);
    assert.equal(profileTargetTaskLedgerDriftCheckpointJson.decision, "confirmed");
    assert.equal(profileTargetTaskLedgerDriftCheckpointJson.task.sourceType, "governance-profile-target-task-ledger-snapshot-drift-checkpoint");
    assert.equal(profileTargetTaskLedgerDriftCheckpointJson.task.governanceProfileTargetTaskLedgerDriftField, "open");

    const profileTargetTaskLedgerDriftCheckpointLedgerResponse = await fetch(`${baseUrl}/api/governance/profile-target-task-ledger-drift-checkpoints?status=all`);
    assert.equal(profileTargetTaskLedgerDriftCheckpointLedgerResponse.status, 200);
    const profileTargetTaskLedgerDriftCheckpointLedgerJson = await profileTargetTaskLedgerDriftCheckpointLedgerResponse.json();
    assert.equal(profileTargetTaskLedgerDriftCheckpointLedgerJson.summary.total, 1);
    assert.equal(profileTargetTaskLedgerDriftCheckpointLedgerJson.summary.confirmed, 1);
    assert.equal(profileTargetTaskLedgerDriftCheckpointLedgerJson.items.length, 1);
    assert.equal(profileTargetTaskLedgerDriftCheckpointLedgerJson.items[0].field, "open");
    assert.match(profileTargetTaskLedgerDriftCheckpointLedgerJson.markdown, /Governance Profile Target Task Ledger Drift Checkpoints/);

    const profileTargetTaskLedgerClosedDriftCheckpointLedgerResponse = await fetch(`${baseUrl}/api/governance/profile-target-task-ledger-drift-checkpoints?status=closed`);
    assert.equal(profileTargetTaskLedgerClosedDriftCheckpointLedgerResponse.status, 200);
    const profileTargetTaskLedgerClosedDriftCheckpointLedgerJson = await profileTargetTaskLedgerClosedDriftCheckpointLedgerResponse.json();
    assert.equal(profileTargetTaskLedgerClosedDriftCheckpointLedgerJson.summary.visible, 1);

    const profileTargetTaskLedgerCheckpointGovernanceResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(profileTargetTaskLedgerCheckpointGovernanceResponse.status, 200);
    const profileTargetTaskLedgerCheckpointGovernanceJson = await profileTargetTaskLedgerCheckpointGovernanceResponse.json();
    assert.equal(profileTargetTaskLedgerCheckpointGovernanceJson.summary.governanceProfileTargetTaskLedgerDriftCheckpointCount, 1);
    assert.equal(profileTargetTaskLedgerCheckpointGovernanceJson.summary.governanceProfileTargetTaskLedgerBaselineHealth, "drift-review-required");
    assert.equal(profileTargetTaskLedgerCheckpointGovernanceJson.governanceProfileTargetTaskLedgerDriftCheckpointLedger.items.length, 1);

    const suppressQueueResponse = await fetch(`${baseUrl}/api/governance/queue/suppress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: finalGovernanceJson.actionQueue.map((item) => ({
          id: item.id,
          projectId: item.projectId,
          projectName: item.projectName,
          kind: item.kind,
          title: item.title
        })),
        reason: "Fixture suppression"
      })
    });
    assert.equal(suppressQueueResponse.status, 200);
    const suppressQueueJson = await suppressQueueResponse.json();
    assert.equal(suppressQueueJson.success, true);
    assert.equal(suppressQueueJson.totals.suppressed, 1);

    const suppressedGovernanceResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(suppressedGovernanceResponse.status, 200);
    const suppressedGovernanceJson = await suppressedGovernanceResponse.json();
    assert.equal(suppressedGovernanceJson.summary.actionQueueItems, 0);
    assert.equal(suppressedGovernanceJson.summary.suppressedQueueItems, 1);
    assert.equal(suppressedGovernanceJson.summary.governanceOperationCount, 11);
    assert.equal(suppressedGovernanceJson.actionQueue.length, 0);
    assert.equal(suppressedGovernanceJson.operationLog[0].type, "queue-suppress");

    const restoreQueueResponse = await fetch(`${baseUrl}/api/governance/queue/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: suppressQueueJson.suppressedItems.map((item) => item.id)
      })
    });
    assert.equal(restoreQueueResponse.status, 200);
    const restoreQueueJson = await restoreQueueResponse.json();
    assert.equal(restoreQueueJson.success, true);
    assert.equal(restoreQueueJson.totals.restored, 1);

    const restoredGovernanceResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(restoredGovernanceResponse.status, 200);
    const restoredGovernanceJson = await restoredGovernanceResponse.json();
    assert.equal(restoredGovernanceJson.summary.actionQueueItems, 1);
    assert.equal(restoredGovernanceJson.summary.suppressedQueueItems, 0);
    assert.equal(restoredGovernanceJson.summary.governanceOperationCount, 12);
    assert.equal(restoredGovernanceJson.actionQueue.length, 1);
    assert.equal(restoredGovernanceJson.operationLog[0].type, "queue-restore");
  } finally {
    server.close();
    await once(server, "close");
  }
}
