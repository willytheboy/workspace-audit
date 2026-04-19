import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createWorkspaceAuditServer } from "../lib/workspace-audit-server.mjs";
import { createFixtureWorkspace } from "./test-helpers.mjs";

export async function serverTest() {
  const { appDir, workspaceRoot } = await createFixtureWorkspace();
  const server = createWorkspaceAuditServer({
    rootDir: workspaceRoot,
    publicDir: appDir
  });

  server.listen(0);
  await once(server, "listening");

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const activeProjectScope = { activeProjectId: "alpha-app", scopeMode: "project" };
  const dataSourcesScope = { scopeMode: "portfolio" };
  const taskMutationScope = { scopeMode: "portfolio" };
  const createExecutionResultCheckpoint = async (runId, targetAction, status = "approved", scopePayload = { scopeMode: "portfolio" }) => {
    const checkpointResponse = await fetch(`${baseUrl}/api/agent-execution-result-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId,
        targetAction,
        status,
        note: `Fixture ${targetAction} checkpoint.`,
        ...scopePayload
      })
    });
    assert.equal(checkpointResponse.status, 200);
    const checkpointJson = await checkpointResponse.json();
    assert.equal(checkpointJson.success, true);
    assert.equal(checkpointJson.checkpoint.targetAction, targetAction);
    assert.equal(checkpointJson.checkpoint.status, status);
    return checkpointJson;
  };

  try {
    const rootResponse = await fetch(`${baseUrl}/`);
    assert.equal(rootResponse.status, 200);
    const rootHtml = await rootResponse.text();
    assert.match(rootHtml, /app\.js/);
    assert.match(rootHtml, /styles\.css/);
    assert.match(rootHtml, /workspace-audit-bootstrap/);
    assert.doesNotMatch(rootHtml, /d3js\.org/);
    assert.doesNotMatch(rootHtml, /<style>/);

    const stylesResponse = await fetch(`${baseUrl}/styles.css`);
    assert.equal(stylesResponse.status, 200);
    assert.match(stylesResponse.headers.get("content-type") ?? "", /text\/css/);
    assert.match(stylesResponse.headers.get("cache-control") ?? "", /no-store/);

    const inventoryResponse = await fetch(`${baseUrl}/api/inventory`);
    assert.equal(inventoryResponse.status, 200);
    const inventoryJson = await inventoryResponse.json();
    assert.equal(inventoryJson.summary.totalApps, 1);

    const diagnosticsResponse = await fetch(`${baseUrl}/api/diagnostics`);
    assert.equal(diagnosticsResponse.status, 200);
    const diagnosticsJson = await diagnosticsResponse.json();
    assert.equal(diagnosticsJson.totalProjects, 1);
    assert.equal(diagnosticsJson.sourceCount, 1);
    assert.equal(diagnosticsJson.deploymentSmokeCheckCount, 0);
    assert.equal(diagnosticsJson.releaseCheckpointCount, 0);
    assert.equal(diagnosticsJson.dataSourceHealthSnapshotCount, 0);
    assert.equal(diagnosticsJson.dataSourceAccessValidationEvidenceSnapshotCount, 0);
    assert.equal(diagnosticsJson.dataSourceAccessValidationWorkflowSnapshotCount, 0);
    assert.equal(diagnosticsJson.convergenceReviewCount, 0);
    assert.equal(diagnosticsJson.findingsCount, 0);
    assert.equal(diagnosticsJson.taskCount, 0);
    assert.equal(diagnosticsJson.workflowCount, 0);
    assert.equal(diagnosticsJson.noteCount, 0);
    assert.equal(diagnosticsJson.milestoneCount, 0);
    assert.equal(diagnosticsJson.projectProfileCount, 0);
    assert.equal(diagnosticsJson.agentPolicyCheckpointCount, 0);
    assert.equal(diagnosticsJson.agentExecutionResultCheckpointCount, 0);
    assert.equal(diagnosticsJson.scanRunCount, 1);
    assert.equal(diagnosticsJson.hasInventoryFile, true);
    assert.equal(diagnosticsJson.hasBootstrappedShell, true);
    assert.equal(diagnosticsJson.hasDatabaseFile, true);
    assert.equal(diagnosticsJson.hasStoreFile, true);
    assert.ok(diagnosticsJson.latestScanAt);
    assert.equal(diagnosticsJson.mutationScope.protocolVersion, "mutation-scope-inventory.v1");
    assert.ok(diagnosticsJson.mutationScope.summary.total > 0);
    assert.ok(diagnosticsJson.mutationScope.summary.scopeRelevant > 0);
    assert.ok(diagnosticsJson.mutationScope.items.some((item) => item.method === "POST" && item.route === "/api/convergence/tasks" && item.guarded === true));

    const mutationScopeResponse = await fetch(`${baseUrl}/api/diagnostics/mutation-scope`);
    assert.equal(mutationScopeResponse.status, 200);
    const mutationScopeJson = await mutationScopeResponse.json();
    assert.equal(mutationScopeJson.protocolVersion, "mutation-scope-inventory.v1");
    assert.ok(mutationScopeJson.summary.guarded > 0);
    assert.equal(mutationScopeJson.summary.unguarded, 0);
    assert.equal(mutationScopeJson.unguarded.length, 0);
    assert.ok(mutationScopeJson.items.some((item) => item.method === "POST" && item.route === "/api/findings/refresh"));
    assert.match(mutationScopeJson.markdown, /# Mutation Scope Inventory/);

    const sourcesSummaryResponse = await fetch(`${baseUrl}/api/sources/summary`);
    assert.equal(sourcesSummaryResponse.status, 200);
    const sourcesSummaryJson = await sourcesSummaryResponse.json();
    assert.equal(sourcesSummaryJson.summary.total, 1);
    assert.equal(sourcesSummaryJson.summary.ready, 1);
    assert.equal(sourcesSummaryJson.summary.local, 1);
    assert.equal(sourcesSummaryJson.sources[0].health, "ready");
    assert.equal(sourcesSummaryJson.sources[0].status, "reachable");
    assert.equal(sourcesSummaryJson.sources[0].access.accessMethod, "local-filesystem");
    assert.equal(sourcesSummaryJson.sources[0].access.requiresReview, false);
    assert.match(sourcesSummaryJson.markdown, /# Data Sources Summary/);
    const deploymentHealthResponse = await fetch(`${baseUrl}/api/deployments/health`);
    assert.equal(deploymentHealthResponse.status, 200);
    const deploymentHealthJson = await deploymentHealthResponse.json();
    assert.equal(deploymentHealthJson.summary.total, 0);
    assert.deepEqual(deploymentHealthJson.targets, []);
    assert.match(deploymentHealthJson.markdown, /# Deployment Health Targets/);
    assert.match(deploymentHealthJson.markdown, /No deployment targets detected/);
    const releaseEvidenceScope = { scopeMode: "portfolio" };

    const unscopedDeploymentSmokeCheckResponse = await fetch(`${baseUrl}/api/deployments/smoke-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: `${baseUrl}/`, allowLocal: true })
    });
    assert.equal(unscopedDeploymentSmokeCheckResponse.status, 409);
    const unscopedDeploymentSmokeCheckJson = await unscopedDeploymentSmokeCheckResponse.json();
    assert.equal(unscopedDeploymentSmokeCheckJson.reasonCode, "agent-execution-scope-required");

    const rejectedDeploymentSmokeCheckResponse = await fetch(`${baseUrl}/api/deployments/smoke-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: `${baseUrl}/`, ...releaseEvidenceScope })
    });
    assert.equal(rejectedDeploymentSmokeCheckResponse.status, 400);
    const rejectedDeploymentSmokeCheckJson = await rejectedDeploymentSmokeCheckResponse.json();
    assert.match(rejectedDeploymentSmokeCheckJson.error, /allowLocal=true/);

    const deploymentSmokeCheckResponse = await fetch(`${baseUrl}/api/deployments/smoke-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: `${baseUrl}/`, label: "Fixture local app", allowLocal: true, timeoutMs: 3000, ...releaseEvidenceScope })
    });
    assert.equal(deploymentSmokeCheckResponse.status, 200);
    const deploymentSmokeCheckJson = await deploymentSmokeCheckResponse.json();
    assert.equal(deploymentSmokeCheckJson.success, true);
    assert.equal(deploymentSmokeCheckJson.smokeCheck.status, "pass");
    assert.equal(deploymentSmokeCheckJson.smokeCheck.httpStatus, 200);
    assert.equal(deploymentSmokeCheckJson.smokeCheck.label, "Fixture local app");
    assert.equal(deploymentSmokeCheckJson.smokeCheck.error, "");
    assert.equal(deploymentSmokeCheckJson.deploymentSmokeCheckCount, 1);
    assert.match(deploymentSmokeCheckJson.smokeCheck.secretPolicy, /No response body/);
    assert.match(deploymentSmokeCheckJson.smokeCheck.markdown, /# Deployment Smoke Check/);

    const deploymentSmokeChecksResponse = await fetch(`${baseUrl}/api/deployments/smoke-checks`);
    assert.equal(deploymentSmokeChecksResponse.status, 200);
    const deploymentSmokeChecksJson = await deploymentSmokeChecksResponse.json();
    assert.equal(deploymentSmokeChecksJson.summary.total, 1);
    assert.equal(deploymentSmokeChecksJson.summary.pass, 1);
    assert.equal(deploymentSmokeChecksJson.summary.fail, 0);
    assert.equal(deploymentSmokeChecksJson.smokeChecks[0].label, "Fixture local app");
    assert.match(deploymentSmokeChecksJson.markdown, /# Deployment Smoke Check Ledger/);
    assert.match(deploymentSmokeChecksJson.markdown, /Fixture local app/);

    const deploymentHealthAfterSmokeResponse = await fetch(`${baseUrl}/api/deployments/health`);
    assert.equal(deploymentHealthAfterSmokeResponse.status, 200);
    const deploymentHealthAfterSmokeJson = await deploymentHealthAfterSmokeResponse.json();
    assert.equal(deploymentHealthAfterSmokeJson.summary.checked, 1);
    assert.equal(deploymentHealthAfterSmokeJson.summary.pass, 1);
    assert.equal(deploymentHealthAfterSmokeJson.summary.fail, 0);
    assert.equal(deploymentHealthAfterSmokeJson.recentSmokeChecks.length, 1);
    assert.equal(deploymentHealthAfterSmokeJson.recentSmokeChecks[0].label, "Fixture local app");
    assert.match(deploymentHealthAfterSmokeJson.markdown, /Recent Smoke Checks/);

    const releaseSummaryResponse = await fetch(`${baseUrl}/api/releases/summary`);
    assert.equal(releaseSummaryResponse.status, 200);
    const releaseSummaryJson = await releaseSummaryResponse.json();
    assert.equal(releaseSummaryJson.summary.deploymentSmokeCheckCount, 1);
    assert.equal(releaseSummaryJson.summary.deploymentSmokeCheckPassCount, 1);
    assert.equal(releaseSummaryJson.summary.releaseCheckpointCount, 0);
    assert.equal(releaseSummaryJson.summary.status, "review");
    assert.equal(releaseSummaryJson.git.available, false);
    assert.equal(releaseSummaryJson.latestSmokeCheck.label, "Fixture local app");
    assert.match(releaseSummaryJson.markdown, /# Release Control Ledger/);

    const missingReleaseCheckpointDriftResponse = await fetch(`${baseUrl}/api/releases/checkpoints/diff?snapshotId=latest`);
    assert.equal(missingReleaseCheckpointDriftResponse.status, 200);
    const missingReleaseCheckpointDriftJson = await missingReleaseCheckpointDriftResponse.json();
    assert.equal(missingReleaseCheckpointDriftJson.hasSnapshot, false);
    assert.equal(missingReleaseCheckpointDriftJson.driftSeverity, "missing-checkpoint");
    assert.match(missingReleaseCheckpointDriftJson.markdown, /# Release Checkpoint Drift/);

    const missingReleaseBuildGateResponse = await fetch(`${baseUrl}/api/releases/build-gate`);
    assert.equal(missingReleaseBuildGateResponse.status, 200);
    const missingReleaseBuildGateJson = await missingReleaseBuildGateResponse.json();
    assert.equal(missingReleaseBuildGateJson.decision, "review");
    assert.ok(missingReleaseBuildGateJson.reasons.some((reason) => reason.code === "release-checkpoint-missing"));
    assert.ok(missingReleaseBuildGateJson.actions.some((action) => action.id === "save-release-checkpoint"));
    assert.match(missingReleaseBuildGateJson.markdown, /# Release Build Gate/);
    assert.match(missingReleaseBuildGateJson.markdown, /## Gate Actions/);

    const unscopedReleaseCheckpointResponse = await fetch(`${baseUrl}/api/releases/checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Release Checkpoint", status: "review", notes: "Fixture non-secret release checkpoint." })
    });
    assert.equal(unscopedReleaseCheckpointResponse.status, 409);
    const unscopedReleaseCheckpointJson = await unscopedReleaseCheckpointResponse.json();
    assert.equal(unscopedReleaseCheckpointJson.reasonCode, "agent-execution-scope-required");

    const createReleaseCheckpointResponse = await fetch(`${baseUrl}/api/releases/checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Release Checkpoint",
        status: "review",
        notes: "Fixture non-secret release checkpoint.",
        ...releaseEvidenceScope
      })
    });
    assert.equal(createReleaseCheckpointResponse.status, 200);
    const createReleaseCheckpointJson = await createReleaseCheckpointResponse.json();
    assert.equal(createReleaseCheckpointJson.success, true);
    assert.equal(createReleaseCheckpointJson.releaseCheckpointCount, 1);
    assert.equal(createReleaseCheckpointJson.checkpoint.title, "Fixture Release Checkpoint");
    assert.equal(createReleaseCheckpointJson.checkpoint.deploymentSmokeCheckCount, 1);
    assert.match(createReleaseCheckpointJson.checkpoint.markdown, /# Release Control Ledger/);

    const releaseSummaryAfterCheckpointResponse = await fetch(`${baseUrl}/api/releases/summary`);
    assert.equal(releaseSummaryAfterCheckpointResponse.status, 200);
    const releaseSummaryAfterCheckpointJson = await releaseSummaryAfterCheckpointResponse.json();
    assert.equal(releaseSummaryAfterCheckpointJson.summary.releaseCheckpointCount, 1);
    assert.equal(releaseSummaryAfterCheckpointJson.checkpoints[0].title, "Fixture Release Checkpoint");

    const releaseCheckpointDriftResponse = await fetch(`${baseUrl}/api/releases/checkpoints/diff?snapshotId=latest`);
    assert.equal(releaseCheckpointDriftResponse.status, 200);
    const releaseCheckpointDriftJson = await releaseCheckpointDriftResponse.json();
    assert.equal(releaseCheckpointDriftJson.hasSnapshot, true);
    assert.equal(releaseCheckpointDriftJson.snapshotTitle, "Fixture Release Checkpoint");
    assert.equal(releaseCheckpointDriftJson.hasDrift, false);
    assert.equal(releaseCheckpointDriftJson.driftSeverity, "none");
    assert.deepEqual(releaseCheckpointDriftJson.driftItems, []);
    assert.match(releaseCheckpointDriftJson.markdown, /# Release Checkpoint Drift/);

    const releaseBuildGateResponse = await fetch(`${baseUrl}/api/releases/build-gate`);
    assert.equal(releaseBuildGateResponse.status, 200);
    const releaseBuildGateJson = await releaseBuildGateResponse.json();
    assert.equal(releaseBuildGateJson.decision, "review");
    assert.equal(releaseBuildGateJson.releaseCheckpointDrift.driftSeverity, "none");
    assert.ok(releaseBuildGateJson.reasons.some((reason) => reason.code === "git-unavailable"));
    assert.ok(releaseBuildGateJson.actions.some((action) => action.id === "verify-git-runtime-access"));
    assert.match(releaseBuildGateJson.markdown, /# Release Build Gate/);

    const unscopedReleaseGateBootstrapResponse = await fetch(`${baseUrl}/api/releases/build-gate/bootstrap-local-evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: baseUrl,
        label: "Fixture release gate local app",
        title: "Fixture Release Gate Bootstrap",
        notes: "Fixture local non-secret release gate evidence."
      })
    });
    assert.equal(unscopedReleaseGateBootstrapResponse.status, 409);
    const unscopedReleaseGateBootstrapJson = await unscopedReleaseGateBootstrapResponse.json();
    assert.equal(unscopedReleaseGateBootstrapJson.reasonCode, "agent-execution-scope-required");

    const releaseGateBootstrapResponse = await fetch(`${baseUrl}/api/releases/build-gate/bootstrap-local-evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: baseUrl,
        label: "Fixture release gate local app",
        title: "Fixture Release Gate Bootstrap",
        notes: "Fixture local non-secret release gate evidence.",
        ...releaseEvidenceScope
      })
    });
    assert.equal(releaseGateBootstrapResponse.status, 200);
    const releaseGateBootstrapJson = await releaseGateBootstrapResponse.json();
    assert.equal(releaseGateBootstrapJson.success, true);
    assert.equal(releaseGateBootstrapJson.smokeCheck.status, "pass");
    assert.equal(releaseGateBootstrapJson.checkpoint.title, "Fixture Release Gate Bootstrap");
    assert.equal(releaseGateBootstrapJson.releaseBuildGate.decision, "review");
    assert.ok(releaseGateBootstrapJson.releaseBuildGate.actions.some((action) => action.id === "verify-git-runtime-access"));

    const sourcesAccessRequirementsResponse = await fetch(`${baseUrl}/api/sources/access-requirements`);
    assert.equal(sourcesAccessRequirementsResponse.status, 200);
    const sourcesAccessRequirementsJson = await sourcesAccessRequirementsResponse.json();
    assert.equal(sourcesAccessRequirementsJson.summary.total, 1);
    assert.equal(sourcesAccessRequirementsJson.summary.reviewRequired, 0);
    assert.match(sourcesAccessRequirementsJson.sources[0].access.secretPolicy, /Do not store passwords/);
    assert.match(sourcesAccessRequirementsJson.markdown, /# Data Sources Access Requirements/);

    const sourcesAccessMethodRegistryResponse = await fetch(`${baseUrl}/api/sources/access-method-registry`);
    assert.equal(sourcesAccessMethodRegistryResponse.status, 200);
    const sourcesAccessMethodRegistryJson = await sourcesAccessMethodRegistryResponse.json();
    assert.equal(sourcesAccessMethodRegistryJson.summary.totalSources, 1);
    assert.equal(sourcesAccessMethodRegistryJson.summary.totalMethods, 1);
    assert.equal(sourcesAccessMethodRegistryJson.summary.localPathSources, 1);
    assert.equal(sourcesAccessMethodRegistryJson.summary.gitRemoteSources, 0);
    assert.equal(sourcesAccessMethodRegistryJson.methods[0].accessMethod, "local-filesystem");
    assert.equal(sourcesAccessMethodRegistryJson.methods[0].category, "filesystem");
    assert.equal(sourcesAccessMethodRegistryJson.sources[0].localPathLikely, true);
    assert.match(sourcesAccessMethodRegistryJson.secretPolicy, /Non-secret access method registry/);
    assert.match(sourcesAccessMethodRegistryJson.markdown, /# Data Sources Access Method Registry/);

    const sourcesAccessValidationWorkflowResponse = await fetch(`${baseUrl}/api/sources/access-validation-workflow`);
    assert.equal(sourcesAccessValidationWorkflowResponse.status, 200);
    const sourcesAccessValidationWorkflowJson = await sourcesAccessValidationWorkflowResponse.json();
    assert.equal(sourcesAccessValidationWorkflowJson.summary.total, 1);
    assert.equal(sourcesAccessValidationWorkflowJson.summary.pending, 1);
    assert.equal(sourcesAccessValidationWorkflowJson.summary.missingEvidence, 1);
    assert.equal(sourcesAccessValidationWorkflowJson.items[0].stage, "record-validation-evidence");
    assert.equal(sourcesAccessValidationWorkflowJson.items[0].status, "pending");
    assert.match(sourcesAccessValidationWorkflowJson.secretPolicy, /Non-secret source access validation workflow/);
    assert.match(sourcesAccessValidationWorkflowJson.markdown, /# Data Sources Access Validation Workflow/);

    const initialSourcesAccessValidationWorkflowSnapshotsResponse = await fetch(`${baseUrl}/api/sources/access-validation-workflow-snapshots`);
    assert.equal(initialSourcesAccessValidationWorkflowSnapshotsResponse.status, 200);
    const initialSourcesAccessValidationWorkflowSnapshotsJson = await initialSourcesAccessValidationWorkflowSnapshotsResponse.json();
    assert.equal(initialSourcesAccessValidationWorkflowSnapshotsJson.length, 0);

    const missingSourcesAccessValidationWorkflowSnapshotDiffResponse = await fetch(`${baseUrl}/api/sources/access-validation-workflow-snapshots/diff?snapshotId=latest`);
    assert.equal(missingSourcesAccessValidationWorkflowSnapshotDiffResponse.status, 200);
    const missingSourcesAccessValidationWorkflowSnapshotDiffJson = await missingSourcesAccessValidationWorkflowSnapshotDiffResponse.json();
    assert.equal(missingSourcesAccessValidationWorkflowSnapshotDiffJson.hasSnapshot, false);
    assert.equal(missingSourcesAccessValidationWorkflowSnapshotDiffJson.driftSeverity, "missing-snapshot");
    assert.match(missingSourcesAccessValidationWorkflowSnapshotDiffJson.markdown, /# Data Sources Access Validation Workflow Snapshot Drift/);

    const unscopedSourcesAccessValidationWorkflowSnapshotResponse = await fetch(`${baseUrl}/api/sources/access-validation-workflow-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Source Access Validation Workflow" })
    });
    assert.equal(unscopedSourcesAccessValidationWorkflowSnapshotResponse.status, 409);
    const unscopedSourcesAccessValidationWorkflowSnapshotJson = await unscopedSourcesAccessValidationWorkflowSnapshotResponse.json();
    assert.equal(unscopedSourcesAccessValidationWorkflowSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createSourcesAccessValidationWorkflowSnapshotResponse = await fetch(`${baseUrl}/api/sources/access-validation-workflow-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Source Access Validation Workflow", ...dataSourcesScope })
    });
    assert.equal(createSourcesAccessValidationWorkflowSnapshotResponse.status, 200);
    const createSourcesAccessValidationWorkflowSnapshotJson = await createSourcesAccessValidationWorkflowSnapshotResponse.json();
    assert.equal(createSourcesAccessValidationWorkflowSnapshotJson.success, true);
    assert.equal(createSourcesAccessValidationWorkflowSnapshotJson.snapshot.title, "Fixture Source Access Validation Workflow");
    assert.equal(createSourcesAccessValidationWorkflowSnapshotJson.snapshot.total, 1);
    assert.equal(createSourcesAccessValidationWorkflowSnapshotJson.snapshot.pendingCount, 1);
    assert.equal(createSourcesAccessValidationWorkflowSnapshotJson.snapshot.missingEvidenceCount, 1);
    assert.equal(createSourcesAccessValidationWorkflowSnapshotJson.snapshot.items.length, 1);
    assert.match(createSourcesAccessValidationWorkflowSnapshotJson.snapshot.markdown, /# Data Sources Access Validation Workflow/);

    const sourcesAccessValidationWorkflowSnapshotsResponse = await fetch(`${baseUrl}/api/sources/access-validation-workflow-snapshots`);
    assert.equal(sourcesAccessValidationWorkflowSnapshotsResponse.status, 200);
    const sourcesAccessValidationWorkflowSnapshotsJson = await sourcesAccessValidationWorkflowSnapshotsResponse.json();
    assert.equal(sourcesAccessValidationWorkflowSnapshotsJson.length, 1);
    assert.equal(sourcesAccessValidationWorkflowSnapshotsJson[0].title, "Fixture Source Access Validation Workflow");

    const sourcesAccessValidationWorkflowSnapshotDiffResponse = await fetch(`${baseUrl}/api/sources/access-validation-workflow-snapshots/diff?snapshotId=latest`);
    assert.equal(sourcesAccessValidationWorkflowSnapshotDiffResponse.status, 200);
    const sourcesAccessValidationWorkflowSnapshotDiffJson = await sourcesAccessValidationWorkflowSnapshotDiffResponse.json();
    assert.equal(sourcesAccessValidationWorkflowSnapshotDiffJson.hasSnapshot, true);
    assert.equal(sourcesAccessValidationWorkflowSnapshotDiffJson.hasDrift, false);
    assert.equal(sourcesAccessValidationWorkflowSnapshotDiffJson.snapshotTitle, "Fixture Source Access Validation Workflow");
    assert.equal(sourcesAccessValidationWorkflowSnapshotDiffJson.snapshotSummary.pending, 1);
    assert.match(sourcesAccessValidationWorkflowSnapshotDiffJson.markdown, /# Data Sources Access Validation Workflow Snapshot Drift/);

    const sourcesAccessChecklistResponse = await fetch(`${baseUrl}/api/sources/access-checklist`);
    assert.equal(sourcesAccessChecklistResponse.status, 200);
    const sourcesAccessChecklistJson = await sourcesAccessChecklistResponse.json();
    assert.equal(sourcesAccessChecklistJson.summary.total, 1);
    assert.equal(sourcesAccessChecklistJson.summary.ready, 1);
    assert.match(sourcesAccessChecklistJson.items[0].action, /OS account/);
    assert.match(sourcesAccessChecklistJson.markdown, /# Data Sources Access Checklist/);

    const sourcesAccessValidationRunbookResponse = await fetch(`${baseUrl}/api/sources/access-validation-runbook`);
    assert.equal(sourcesAccessValidationRunbookResponse.status, 200);
    const sourcesAccessValidationRunbookJson = await sourcesAccessValidationRunbookResponse.json();
    assert.equal(sourcesAccessValidationRunbookJson.summary.sourceCount, 1);
    assert.equal(sourcesAccessValidationRunbookJson.summary.methodCount, 1);
    assert.equal(sourcesAccessValidationRunbookJson.methods[0].accessMethod, "local-filesystem");
    assert.match(sourcesAccessValidationRunbookJson.methods[0].commandHints[0], /Test-Path/);
    assert.match(sourcesAccessValidationRunbookJson.markdown, /# Data Sources Access Validation Runbook/);
    assert.match(sourcesAccessValidationRunbookJson.markdown, /Secret policy/);

    const initialSourcesAccessValidationEvidenceResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence`);
    assert.equal(initialSourcesAccessValidationEvidenceResponse.status, 200);
    const initialSourcesAccessValidationEvidenceJson = await initialSourcesAccessValidationEvidenceResponse.json();
    assert.equal(initialSourcesAccessValidationEvidenceJson.summary.total, 0);
    assert.deepEqual(initialSourcesAccessValidationEvidenceJson.items, []);
    assert.match(initialSourcesAccessValidationEvidenceJson.markdown, /# Data Sources Access Validation Evidence Ledger/);

    const initialSourcesAccessValidationEvidenceSnapshotsResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence-snapshots`);
    assert.equal(initialSourcesAccessValidationEvidenceSnapshotsResponse.status, 200);
    const initialSourcesAccessValidationEvidenceSnapshotsJson = await initialSourcesAccessValidationEvidenceSnapshotsResponse.json();
    assert.equal(initialSourcesAccessValidationEvidenceSnapshotsJson.length, 0);

    const missingSourcesAccessValidationEvidenceSnapshotDiffResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence-snapshots/diff?snapshotId=latest`);
    assert.equal(missingSourcesAccessValidationEvidenceSnapshotDiffResponse.status, 200);
    const missingSourcesAccessValidationEvidenceSnapshotDiffJson = await missingSourcesAccessValidationEvidenceSnapshotDiffResponse.json();
    assert.equal(missingSourcesAccessValidationEvidenceSnapshotDiffJson.hasSnapshot, false);
    assert.equal(missingSourcesAccessValidationEvidenceSnapshotDiffJson.driftSeverity, "missing-snapshot");
    assert.match(missingSourcesAccessValidationEvidenceSnapshotDiffJson.markdown, /# Data Sources Access Validation Evidence Snapshot Drift/);

    const initialSourcesAccessValidationEvidenceCoverageResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence-coverage`);
    assert.equal(initialSourcesAccessValidationEvidenceCoverageResponse.status, 200);
    const initialSourcesAccessValidationEvidenceCoverageJson = await initialSourcesAccessValidationEvidenceCoverageResponse.json();
    assert.equal(initialSourcesAccessValidationEvidenceCoverageJson.summary.sourceCount, 1);
    assert.equal(initialSourcesAccessValidationEvidenceCoverageJson.summary.covered, 0);
    assert.equal(initialSourcesAccessValidationEvidenceCoverageJson.summary.missing, 1);
    assert.equal(initialSourcesAccessValidationEvidenceCoverageJson.summary.coveragePercent, 0);
    assert.equal(initialSourcesAccessValidationEvidenceCoverageJson.items[0].coverageStatus, "missing");
    assert.match(initialSourcesAccessValidationEvidenceCoverageJson.markdown, /# Data Sources Access Validation Evidence Coverage/);

    const unscopedSourcesAccessValidationEvidenceResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: sourcesAccessValidationRunbookJson.methods[0].sources[0].sourceId,
        status: "validated",
        evidence: "Operator confirmed read-only local folder access."
      })
    });
    assert.equal(unscopedSourcesAccessValidationEvidenceResponse.status, 409);
    const unscopedSourcesAccessValidationEvidenceJson = await unscopedSourcesAccessValidationEvidenceResponse.json();
    assert.equal(unscopedSourcesAccessValidationEvidenceJson.reasonCode, "agent-execution-scope-required");

    const rejectedSourcesAccessValidationEvidenceResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: sourcesAccessValidationRunbookJson.methods[0].sources[0].sourceId,
        status: "validated",
        evidence: "password=supersecretvalue",
        ...dataSourcesScope
      })
    });
    assert.equal(rejectedSourcesAccessValidationEvidenceResponse.status, 400);
    const rejectedSourcesAccessValidationEvidenceJson = await rejectedSourcesAccessValidationEvidenceResponse.json();
    assert.match(rejectedSourcesAccessValidationEvidenceJson.error, /secret/i);

    const createSourcesAccessValidationEvidenceResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: sourcesAccessValidationRunbookJson.methods[0].sources[0].sourceId,
        accessMethod: "local-filesystem",
        status: "validated",
        evidence: "Operator confirmed read-only local folder access from the current OS account.",
        commandHint: "PowerShell: Test-Path <local-path>",
        ...dataSourcesScope
      })
    });
    assert.equal(createSourcesAccessValidationEvidenceResponse.status, 200);
    const createSourcesAccessValidationEvidenceJson = await createSourcesAccessValidationEvidenceResponse.json();
    assert.equal(createSourcesAccessValidationEvidenceJson.success, true);
    assert.equal(createSourcesAccessValidationEvidenceJson.evidence.status, "validated");
    assert.equal(createSourcesAccessValidationEvidenceJson.evidence.accessMethod, "local-filesystem");
    assert.match(createSourcesAccessValidationEvidenceJson.evidence.secretPolicy, /Non-secret/);
    assert.equal(createSourcesAccessValidationEvidenceJson.ledger.summary.validated, 1);

    const sourcesAccessValidationEvidenceResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence?status=validated`);
    assert.equal(sourcesAccessValidationEvidenceResponse.status, 200);
    const sourcesAccessValidationEvidenceJson = await sourcesAccessValidationEvidenceResponse.json();
    assert.equal(sourcesAccessValidationEvidenceJson.summary.total, 1);
    assert.equal(sourcesAccessValidationEvidenceJson.summary.validated, 1);
    assert.equal(sourcesAccessValidationEvidenceJson.items[0].sourceId, sourcesAccessValidationRunbookJson.methods[0].sources[0].sourceId);
    assert.match(sourcesAccessValidationEvidenceJson.markdown, /Operator confirmed read-only local folder access/);

    const sourcesAccessValidationEvidenceCoverageResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence-coverage`);
    assert.equal(sourcesAccessValidationEvidenceCoverageResponse.status, 200);
    const sourcesAccessValidationEvidenceCoverageJson = await sourcesAccessValidationEvidenceCoverageResponse.json();
    assert.equal(sourcesAccessValidationEvidenceCoverageJson.summary.sourceCount, 1);
    assert.equal(sourcesAccessValidationEvidenceCoverageJson.summary.covered, 1);
    assert.equal(sourcesAccessValidationEvidenceCoverageJson.summary.missing, 0);
    assert.equal(sourcesAccessValidationEvidenceCoverageJson.summary.coveragePercent, 100);
    assert.equal(sourcesAccessValidationEvidenceCoverageJson.items[0].coverageStatus, "covered");
    assert.equal(sourcesAccessValidationEvidenceCoverageJson.items[0].latestEvidenceStatus, "validated");
    assert.match(sourcesAccessValidationEvidenceCoverageJson.markdown, /Operator confirmed/);

    const sourcesAccessValidationWorkflowAfterEvidenceResponse = await fetch(`${baseUrl}/api/sources/access-validation-workflow`);
    assert.equal(sourcesAccessValidationWorkflowAfterEvidenceResponse.status, 200);
    const sourcesAccessValidationWorkflowAfterEvidenceJson = await sourcesAccessValidationWorkflowAfterEvidenceResponse.json();
    assert.equal(sourcesAccessValidationWorkflowAfterEvidenceJson.summary.ready, 1);
    assert.equal(sourcesAccessValidationWorkflowAfterEvidenceJson.items[0].stage, "validated");
    assert.equal(sourcesAccessValidationWorkflowAfterEvidenceJson.items[0].status, "ready");

    const unscopedSourcesAccessValidationEvidenceSnapshotResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Source Access Evidence", status: "validated", limit: 5 })
    });
    assert.equal(unscopedSourcesAccessValidationEvidenceSnapshotResponse.status, 409);
    const unscopedSourcesAccessValidationEvidenceSnapshotJson = await unscopedSourcesAccessValidationEvidenceSnapshotResponse.json();
    assert.equal(unscopedSourcesAccessValidationEvidenceSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createSourcesAccessValidationEvidenceSnapshotResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Source Access Evidence", status: "validated", limit: 5, ...dataSourcesScope })
    });
    assert.equal(createSourcesAccessValidationEvidenceSnapshotResponse.status, 200);
    const createSourcesAccessValidationEvidenceSnapshotJson = await createSourcesAccessValidationEvidenceSnapshotResponse.json();
    assert.equal(createSourcesAccessValidationEvidenceSnapshotJson.success, true);
    assert.equal(createSourcesAccessValidationEvidenceSnapshotJson.snapshot.title, "Fixture Source Access Evidence");
    assert.equal(createSourcesAccessValidationEvidenceSnapshotJson.snapshot.statusFilter, "validated");
    assert.equal(createSourcesAccessValidationEvidenceSnapshotJson.snapshot.total, 1);
    assert.equal(createSourcesAccessValidationEvidenceSnapshotJson.snapshot.validatedCount, 1);
    assert.equal(createSourcesAccessValidationEvidenceSnapshotJson.snapshot.items.length, 1);
    assert.match(createSourcesAccessValidationEvidenceSnapshotJson.snapshot.markdown, /# Data Sources Access Validation Evidence Ledger/);

    const sourcesAccessValidationEvidenceSnapshotsResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence-snapshots`);
    assert.equal(sourcesAccessValidationEvidenceSnapshotsResponse.status, 200);
    const sourcesAccessValidationEvidenceSnapshotsJson = await sourcesAccessValidationEvidenceSnapshotsResponse.json();
    assert.equal(sourcesAccessValidationEvidenceSnapshotsJson.length, 1);
    assert.equal(sourcesAccessValidationEvidenceSnapshotsJson[0].title, "Fixture Source Access Evidence");

    const sourcesAccessValidationEvidenceSnapshotDiffResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence-snapshots/diff?snapshotId=latest`);
    assert.equal(sourcesAccessValidationEvidenceSnapshotDiffResponse.status, 200);
    const sourcesAccessValidationEvidenceSnapshotDiffJson = await sourcesAccessValidationEvidenceSnapshotDiffResponse.json();
    assert.equal(sourcesAccessValidationEvidenceSnapshotDiffJson.hasSnapshot, true);
    assert.equal(sourcesAccessValidationEvidenceSnapshotDiffJson.hasDrift, false);
    assert.equal(sourcesAccessValidationEvidenceSnapshotDiffJson.snapshotTitle, "Fixture Source Access Evidence");
    assert.equal(sourcesAccessValidationEvidenceSnapshotDiffJson.snapshotSummary.validated, 1);
    assert.match(sourcesAccessValidationEvidenceSnapshotDiffJson.markdown, /# Data Sources Access Validation Evidence Snapshot Drift/);

    const sourcesAccessMatrixResponse = await fetch(`${baseUrl}/api/sources/access-matrix`);
    assert.equal(sourcesAccessMatrixResponse.status, 200);
    const sourcesAccessMatrixJson = await sourcesAccessMatrixResponse.json();
    assert.equal(sourcesAccessMatrixJson.summary.total, 1);
    assert.equal(sourcesAccessMatrixJson.summary.methodCount, 1);
    assert.equal(sourcesAccessMatrixJson.methods[0].accessMethod, "local-filesystem");
    assert.equal(sourcesAccessMatrixJson.methods[0].reviewRequired, 0);
    assert.match(sourcesAccessMatrixJson.markdown, /# Data Sources Access Matrix/);

    const sourcesAccessReviewQueueResponse = await fetch(`${baseUrl}/api/sources/access-review-queue`);
    assert.equal(sourcesAccessReviewQueueResponse.status, 200);
    const sourcesAccessReviewQueueJson = await sourcesAccessReviewQueueResponse.json();
    assert.equal(sourcesAccessReviewQueueJson.summary.total, 0);
    assert.equal(sourcesAccessReviewQueueJson.summary.evidenceMissing, 0);
    assert.equal(sourcesAccessReviewQueueJson.summary.evidenceCoveragePercent, 0);
    assert.deepEqual(sourcesAccessReviewQueueJson.items, []);
    assert.match(sourcesAccessReviewQueueJson.markdown, /# Data Sources Access Review Queue/);
    assert.match(sourcesAccessReviewQueueJson.markdown, /Validation evidence:/);

    const sourcesAccessTaskLedgerResponse = await fetch(`${baseUrl}/api/sources/access-task-ledger`);
    assert.equal(sourcesAccessTaskLedgerResponse.status, 200);
    const sourcesAccessTaskLedgerJson = await sourcesAccessTaskLedgerResponse.json();
    assert.equal(sourcesAccessTaskLedgerJson.summary.total, 0);
    assert.equal(sourcesAccessTaskLedgerJson.summary.open, 0);
    assert.deepEqual(sourcesAccessTaskLedgerJson.items, []);
    assert.match(sourcesAccessTaskLedgerJson.markdown, /# Data Sources Access Task Ledger/);
    assert.match(sourcesAccessTaskLedgerJson.secretPolicy, /Non-secret metadata only/);

    const initialSourcesAccessTaskLedgerSnapshotsResponse = await fetch(`${baseUrl}/api/sources/access-task-ledger-snapshots`);
    assert.equal(initialSourcesAccessTaskLedgerSnapshotsResponse.status, 200);
    const initialSourcesAccessTaskLedgerSnapshotsJson = await initialSourcesAccessTaskLedgerSnapshotsResponse.json();
    assert.equal(initialSourcesAccessTaskLedgerSnapshotsJson.length, 0);

    const missingSourcesAccessTaskLedgerSnapshotDiffResponse = await fetch(`${baseUrl}/api/sources/access-task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(missingSourcesAccessTaskLedgerSnapshotDiffResponse.status, 200);
    const missingSourcesAccessTaskLedgerSnapshotDiffJson = await missingSourcesAccessTaskLedgerSnapshotDiffResponse.json();
    assert.equal(missingSourcesAccessTaskLedgerSnapshotDiffJson.hasSnapshot, false);
    assert.equal(missingSourcesAccessTaskLedgerSnapshotDiffJson.driftSeverity, "missing-snapshot");
    assert.match(missingSourcesAccessTaskLedgerSnapshotDiffJson.markdown, /# Data Sources Access Task Ledger Snapshot Drift/);

    const sourcesAccessGateResponse = await fetch(`${baseUrl}/api/sources/access-gate`);
    assert.equal(sourcesAccessGateResponse.status, 200);
    const sourcesAccessGateJson = await sourcesAccessGateResponse.json();
    assert.equal(sourcesAccessGateJson.decision, "ready");
    assert.equal(sourcesAccessGateJson.total, 1);
    assert.equal(sourcesAccessGateJson.review, 0);
    assert.match(sourcesAccessGateJson.markdown, /# Data Sources Access Gate/);

    const initialSourcesSummarySnapshotsResponse = await fetch(`${baseUrl}/api/sources/summary-snapshots`);
    assert.equal(initialSourcesSummarySnapshotsResponse.status, 200);
    const initialSourcesSummarySnapshotsJson = await initialSourcesSummarySnapshotsResponse.json();
    assert.equal(initialSourcesSummarySnapshotsJson.length, 0);

    const unscopedSourcesSummarySnapshotResponse = await fetch(`${baseUrl}/api/sources/summary-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Sources Health Summary" })
    });
    assert.equal(unscopedSourcesSummarySnapshotResponse.status, 409);
    const unscopedSourcesSummarySnapshotJson = await unscopedSourcesSummarySnapshotResponse.json();
    assert.equal(unscopedSourcesSummarySnapshotJson.reasonCode, "agent-execution-scope-required");

    const createSourcesSummarySnapshotResponse = await fetch(`${baseUrl}/api/sources/summary-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Sources Health Summary", ...dataSourcesScope })
    });
    assert.equal(createSourcesSummarySnapshotResponse.status, 200);
    const createSourcesSummarySnapshotJson = await createSourcesSummarySnapshotResponse.json();
    assert.equal(createSourcesSummarySnapshotJson.success, true);
    assert.equal(createSourcesSummarySnapshotJson.snapshot.title, "Fixture Sources Health Summary");
    assert.equal(createSourcesSummarySnapshotJson.snapshot.total, 1);
    assert.equal(createSourcesSummarySnapshotJson.snapshot.ready, 1);
    assert.match(createSourcesSummarySnapshotJson.snapshot.markdown, /# Data Sources Summary/);

    const sourcesSummarySnapshotsResponse = await fetch(`${baseUrl}/api/sources/summary-snapshots`);
    assert.equal(sourcesSummarySnapshotsResponse.status, 200);
    const sourcesSummarySnapshotsJson = await sourcesSummarySnapshotsResponse.json();
    assert.equal(sourcesSummarySnapshotsJson.length, 1);
    assert.equal(sourcesSummarySnapshotsJson[0].title, "Fixture Sources Health Summary");

    const sourcesSummarySnapshotDiffResponse = await fetch(`${baseUrl}/api/sources/summary-snapshots/diff?snapshotId=latest`);
    assert.equal(sourcesSummarySnapshotDiffResponse.status, 200);
    const sourcesSummarySnapshotDiffJson = await sourcesSummarySnapshotDiffResponse.json();
    assert.equal(sourcesSummarySnapshotDiffJson.hasSnapshot, true);
    assert.equal(sourcesSummarySnapshotDiffJson.hasDrift, false);
    assert.equal(sourcesSummarySnapshotDiffJson.driftSeverity, "none");
    assert.equal(sourcesSummarySnapshotDiffJson.driftScore, 0);
    assert.match(sourcesSummarySnapshotDiffJson.markdown, /# Data Sources Snapshot Drift/);

    const unscopedAddSourceResponse = await fetch(`${baseUrl}/api/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "github", url: "https://example.com/org/repo" })
    });
    assert.equal(unscopedAddSourceResponse.status, 409);
    const unscopedAddSourceJson = await unscopedAddSourceResponse.json();
    assert.equal(unscopedAddSourceJson.reasonCode, "agent-execution-scope-required");

    const addSourceResponse = await fetch(`${baseUrl}/api/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "github", url: "https://example.com/org/repo", ...dataSourcesScope })
    });
    assert.equal(addSourceResponse.status, 200);
    const addSourceJson = await addSourceResponse.json();
    assert.equal(addSourceJson.success, true);
    assert.equal(addSourceJson.sources.length, 2);
    const addedSource = addSourceJson.sources.find((source) => source.type === "github");
    assert.ok(addedSource?.id);

    const sourcesAccessRequirementsAfterAddResponse = await fetch(`${baseUrl}/api/sources/access-requirements`);
    assert.equal(sourcesAccessRequirementsAfterAddResponse.status, 200);
    const sourcesAccessRequirementsAfterAddJson = await sourcesAccessRequirementsAfterAddResponse.json();
    assert.equal(sourcesAccessRequirementsAfterAddJson.summary.total, 2);
    assert.equal(sourcesAccessRequirementsAfterAddJson.summary.reviewRequired, 1);
    assert.equal(sourcesAccessRequirementsAfterAddJson.summary.tokenLikely, 1);
    assert.ok(sourcesAccessRequirementsAfterAddJson.sources.some((source) => source.type === "github" && source.access.accessMethod === "git-https"));

    const sourcesAccessMethodRegistryAfterAddResponse = await fetch(`${baseUrl}/api/sources/access-method-registry`);
    assert.equal(sourcesAccessMethodRegistryAfterAddResponse.status, 200);
    const sourcesAccessMethodRegistryAfterAddJson = await sourcesAccessMethodRegistryAfterAddResponse.json();
    assert.equal(sourcesAccessMethodRegistryAfterAddJson.summary.totalSources, 2);
    assert.equal(sourcesAccessMethodRegistryAfterAddJson.summary.gitRemoteSources, 1);
    assert.equal(sourcesAccessMethodRegistryAfterAddJson.summary.githubRemoteSources, 1);
    assert.equal(sourcesAccessMethodRegistryAfterAddJson.summary.privateRepoLikely, 1);
    assert.equal(sourcesAccessMethodRegistryAfterAddJson.summary.tokenLikely, 1);
    assert.ok(sourcesAccessMethodRegistryAfterAddJson.methods.some((method) => method.accessMethod === "git-https" && method.category === "git" && method.privateRepoLikely === 1));
    assert.match(sourcesAccessMethodRegistryAfterAddJson.markdown, /git-https/);

    const sourcesAccessValidationWorkflowAfterAddResponse = await fetch(`${baseUrl}/api/sources/access-validation-workflow`);
    assert.equal(sourcesAccessValidationWorkflowAfterAddResponse.status, 200);
    const sourcesAccessValidationWorkflowAfterAddJson = await sourcesAccessValidationWorkflowAfterAddResponse.json();
    assert.equal(sourcesAccessValidationWorkflowAfterAddJson.summary.total, 2);
    assert.equal(sourcesAccessValidationWorkflowAfterAddJson.summary.ready, 1);
    assert.equal(sourcesAccessValidationWorkflowAfterAddJson.summary.pending, 1);
    assert.equal(sourcesAccessValidationWorkflowAfterAddJson.summary.externalAccessRequired, 1);
    assert.equal(sourcesAccessValidationWorkflowAfterAddJson.summary.tokenRequired, 1);
    assert.ok(sourcesAccessValidationWorkflowAfterAddJson.items.some((item) => item.accessMethod === "git-https" && item.stage === "external-access-review" && item.blockerTypes.includes("token-or-oauth")));
    assert.match(sourcesAccessValidationWorkflowAfterAddJson.markdown, /external-access-review/);

    const sourcesAccessChecklistAfterAddResponse = await fetch(`${baseUrl}/api/sources/access-checklist`);
    assert.equal(sourcesAccessChecklistAfterAddResponse.status, 200);
    const sourcesAccessChecklistAfterAddJson = await sourcesAccessChecklistAfterAddResponse.json();
    assert.equal(sourcesAccessChecklistAfterAddJson.summary.total, 2);
    assert.equal(sourcesAccessChecklistAfterAddJson.summary.review, 1);
    assert.ok(sourcesAccessChecklistAfterAddJson.items.some((item) => item.type === "github" && /Git Credential Manager/.test(item.action)));

    const sourcesAccessMatrixAfterAddResponse = await fetch(`${baseUrl}/api/sources/access-matrix`);
    assert.equal(sourcesAccessMatrixAfterAddResponse.status, 200);
    const sourcesAccessMatrixAfterAddJson = await sourcesAccessMatrixAfterAddResponse.json();
    assert.equal(sourcesAccessMatrixAfterAddJson.summary.methodCount, 2);
    assert.equal(sourcesAccessMatrixAfterAddJson.summary.tokenLikely, 1);
    assert.ok(sourcesAccessMatrixAfterAddJson.methods.some((method) => method.accessMethod === "git-https" && method.reviewRequired === 1));
    assert.match(sourcesAccessMatrixAfterAddJson.markdown, /git-https/);

    const sourcesAccessReviewQueueAfterAddResponse = await fetch(`${baseUrl}/api/sources/access-review-queue`);
    assert.equal(sourcesAccessReviewQueueAfterAddResponse.status, 200);
    const sourcesAccessReviewQueueAfterAddJson = await sourcesAccessReviewQueueAfterAddResponse.json();
    assert.equal(sourcesAccessReviewQueueAfterAddJson.summary.total, 1);
    assert.equal(sourcesAccessReviewQueueAfterAddJson.summary.medium, 1);
    assert.equal(sourcesAccessReviewQueueAfterAddJson.summary.evidenceMissing, 1);
    assert.equal(sourcesAccessReviewQueueAfterAddJson.summary.evidenceCovered, 0);
    assert.equal(sourcesAccessReviewQueueAfterAddJson.summary.evidenceCoveragePercent, 0);
    assert.equal(sourcesAccessReviewQueueAfterAddJson.items[0].accessMethod, "git-https");
    assert.equal(sourcesAccessReviewQueueAfterAddJson.items[0].evidenceCoverageStatus, "missing");
    assert.equal(sourcesAccessReviewQueueAfterAddJson.items[0].latestEvidenceStatus, "missing");
    assert.equal(sourcesAccessReviewQueueAfterAddJson.items[0].evidenceRequired, true);
    assert.match(sourcesAccessReviewQueueAfterAddJson.items[0].action, /Git Credential Manager/);
    assert.match(sourcesAccessReviewQueueAfterAddJson.markdown, /Data Sources Access Review Queue/);
    assert.match(sourcesAccessReviewQueueAfterAddJson.markdown, /Evidence coverage: missing/);

    const governanceAfterSourceReviewQueueResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterSourceReviewQueueResponse.status, 200);
    const governanceAfterSourceReviewQueueJson = await governanceAfterSourceReviewQueueResponse.json();
    assert.equal(governanceAfterSourceReviewQueueJson.summary.dataSourcesAccessGateDecision, "review");
    assert.equal(governanceAfterSourceReviewQueueJson.summary.dataSourcesAccessGateRank, 2);
    assert.equal(governanceAfterSourceReviewQueueJson.summary.dataSourcesAccessReviewCount, 1);
    assert.equal(governanceAfterSourceReviewQueueJson.summary.dataSourcesAccessBlockedCount, 0);
    assert.equal(governanceAfterSourceReviewQueueJson.dataSourcesAccessGate.decision, "review");
    assert.equal(governanceAfterSourceReviewQueueJson.dataSourcesAccessGate.review, 1);
    assert.equal(governanceAfterSourceReviewQueueJson.summary.dataSourcesAccessReviewQueueCount, 1);
    assert.equal(governanceAfterSourceReviewQueueJson.dataSourcesAccessReviewQueue.summary.total, 1);
    assert.equal(governanceAfterSourceReviewQueueJson.dataSourcesAccessReviewQueue.summary.evidenceMissing, 1);
    assert.equal(governanceAfterSourceReviewQueueJson.dataSourcesAccessReviewQueue.items[0].accessMethod, "git-https");
    assert.equal(governanceAfterSourceReviewQueueJson.dataSourcesAccessReviewQueue.items[0].evidenceCoverageStatus, "missing");
    assert.equal(governanceAfterSourceReviewQueueJson.agentControlPlaneDecision.dataSourcesAccessReviewQueueCount, 1);

    const sourcesAccessGateAfterAddResponse = await fetch(`${baseUrl}/api/sources/access-gate`);
    assert.equal(sourcesAccessGateAfterAddResponse.status, 200);
    const sourcesAccessGateAfterAddJson = await sourcesAccessGateAfterAddResponse.json();
    assert.equal(sourcesAccessGateAfterAddJson.decision, "review");
    assert.equal(sourcesAccessGateAfterAddJson.review, 1);
    assert.equal(sourcesAccessGateAfterAddJson.tokenLikely, 1);
    assert.ok(sourcesAccessGateAfterAddJson.reasons.some((reason) => reason.code === "token-oauth-review"));

    const unscopedDeleteSourceResponse = await fetch(`${baseUrl}/api/sources/${encodeURIComponent(addedSource.id)}`, {
      method: "DELETE"
    });
    assert.equal(unscopedDeleteSourceResponse.status, 409);
    const unscopedDeleteSourceJson = await unscopedDeleteSourceResponse.json();
    assert.equal(unscopedDeleteSourceJson.reasonCode, "agent-execution-scope-required");

    const deleteSourceResponse = await fetch(`${baseUrl}/api/sources/${encodeURIComponent(addedSource.id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataSourcesScope)
    });
    assert.equal(deleteSourceResponse.status, 200);
    const deleteSourceJson = await deleteSourceResponse.json();
    assert.equal(deleteSourceJson.success, true);
    assert.equal(deleteSourceJson.removed, true);
    assert.equal(deleteSourceJson.sourceId, addedSource.id);
    assert.equal(deleteSourceJson.sources.length, 1);
    assert.equal(deleteSourceJson.sources.some((source) => source.id === addedSource.id), false);

    const auditResponse = await fetch(`${baseUrl}/api/audit`, { method: "POST" });
    assert.equal(auditResponse.status, 200);
    const auditJson = await auditResponse.json();
    assert.equal(auditJson.success, true);
    assert.equal(auditJson.totalApps, 1);

    const scansResponse = await fetch(`${baseUrl}/api/scans`);
    assert.equal(scansResponse.status, 200);
    const scansJson = await scansResponse.json();
    assert.equal(scansJson.length, 2);
    assert.equal(Array.isArray(scansJson[0].projects), true);

    const scanDiffResponse = await fetch(`${baseUrl}/api/scans/diff`);
    assert.equal(scanDiffResponse.status, 200);
    const scanDiffJson = await scanDiffResponse.json();
    assert.equal(scanDiffJson.status, "ready");
    assert.ok(scanDiffJson.latestGeneratedAt);
    assert.ok(scanDiffJson.previousGeneratedAt);
    assert.equal(typeof scanDiffJson.totals.changedCount, "number");
    assert.equal(Array.isArray(scanDiffJson.alerts), true);
    assert.equal(typeof scanDiffJson.alertSummary.total, "number");
    assert.match(scanDiffJson.recommendedAction, /scan|regression|healthy|triage/i);

    const findingsResponse = await fetch(`${baseUrl}/api/findings`);
    assert.equal(findingsResponse.status, 200);
    const findingsJson = await findingsResponse.json();
    assert.equal(Array.isArray(findingsJson), true);

    const refreshFindingsResponse = await fetch(`${baseUrl}/api/findings/refresh`, { method: "POST" });
    assert.equal(refreshFindingsResponse.status, 200);
    const refreshFindingsJson = await refreshFindingsResponse.json();
    assert.equal(refreshFindingsJson.success, true);
    assert.equal(Array.isArray(refreshFindingsJson.findings), true);
    const filteredFindingsResponse = await fetch(`${baseUrl}/api/findings?projectId=alpha-app`);
    assert.equal(filteredFindingsResponse.status, 200);
    const filteredFindingsJson = await filteredFindingsResponse.json();
    assert.equal(Array.isArray(filteredFindingsJson), true);

    const convergenceCandidatesResponse = await fetch(`${baseUrl}/api/convergence/candidates`);
    assert.equal(convergenceCandidatesResponse.status, 200);
    const convergenceCandidatesJson = await convergenceCandidatesResponse.json();
    assert.equal(Array.isArray(convergenceCandidatesJson.candidates), true);
    assert.equal(convergenceCandidatesJson.summary.total, 0);
    assert.match(convergenceCandidatesJson.markdown, /# Convergence Review Candidates/);

    const initialConvergenceReviewsResponse = await fetch(`${baseUrl}/api/convergence/reviews`);
    assert.equal(initialConvergenceReviewsResponse.status, 200);
    const initialConvergenceReviewsJson = await initialConvergenceReviewsResponse.json();
    assert.deepEqual(initialConvergenceReviewsJson, []);

    const unscopedConvergenceReviewResponse = await fetch(`${baseUrl}/api/convergence/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leftId: "alpha-app",
        rightId: "beta-app",
        leftName: "Alpha App",
        rightName: "Beta App",
        score: 87,
        reasons: ["React", "Vite"],
        status: "not-related",
        note: "Same stack but different product intent."
      })
    });
    assert.equal(unscopedConvergenceReviewResponse.status, 409);
    const unscopedConvergenceReviewJson = await unscopedConvergenceReviewResponse.json();
    assert.equal(unscopedConvergenceReviewJson.reasonCode, "agent-execution-scope-required");

    const createConvergenceReviewResponse = await fetch(`${baseUrl}/api/convergence/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leftId: "alpha-app",
        rightId: "beta-app",
        leftName: "Alpha App",
        rightName: "Beta App",
        score: 87,
        reasons: ["React", "Vite"],
        status: "not-related",
        note: "Same stack but different product intent.",
        ...activeProjectScope
      })
    });
    assert.equal(createConvergenceReviewResponse.status, 200);
    const createConvergenceReviewJson = await createConvergenceReviewResponse.json();
    assert.equal(createConvergenceReviewJson.success, true);
    assert.equal(createConvergenceReviewJson.review.status, "not-related");
    assert.equal(createConvergenceReviewJson.review.pairId, "alpha-app__converges_with__beta-app");
    assert.match(createConvergenceReviewJson.review.secretPolicy, /Non-secret convergence/);

    const filteredConvergenceReviewsResponse = await fetch(`${baseUrl}/api/convergence/reviews?projectId=alpha-app&status=not-related`);
    assert.equal(filteredConvergenceReviewsResponse.status, 200);
    const filteredConvergenceReviewsJson = await filteredConvergenceReviewsResponse.json();
    assert.equal(filteredConvergenceReviewsJson.length, 1);
    assert.equal(filteredConvergenceReviewsJson[0].note, "Same stack but different product intent.");

    const unscopedCreateTaskResponse = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Review portfolio finding",
        description: "Validate generated findings for alpha-app",
        priority: "high",
        projectId: "alpha-app",
        projectName: "Alpha App"
      })
    });
    assert.equal(unscopedCreateTaskResponse.status, 409);
    const unscopedCreateTaskJson = await unscopedCreateTaskResponse.json();
    assert.equal(unscopedCreateTaskJson.reasonCode, "agent-execution-scope-required");

    const createTaskResponse = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Review portfolio finding",
        description: "Validate generated findings for alpha-app",
        priority: "high",
        projectId: "alpha-app",
        projectName: "Alpha App",
        ...activeProjectScope
      })
    });
    assert.equal(createTaskResponse.status, 200);
    const createTaskJson = await createTaskResponse.json();
    assert.equal(createTaskJson.success, true);
    assert.equal(createTaskJson.task.title, "Review portfolio finding");

    const tasksResponse = await fetch(`${baseUrl}/api/tasks`);
    assert.equal(tasksResponse.status, 200);
    const tasksJson = await tasksResponse.json();
    assert.equal(tasksJson.length, 1);
    const filteredTasksResponse = await fetch(`${baseUrl}/api/tasks?projectId=alpha-app`);
    assert.equal(filteredTasksResponse.status, 200);
    const filteredTasksJson = await filteredTasksResponse.json();
    assert.equal(filteredTasksJson.length, 1);

    const unscopedPatchTaskResponse = await fetch(`${baseUrl}/api/tasks/${createTaskJson.task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" })
    });
    assert.equal(unscopedPatchTaskResponse.status, 409);
    const unscopedPatchTaskJson = await unscopedPatchTaskResponse.json();
    assert.equal(unscopedPatchTaskJson.reasonCode, "agent-execution-scope-required");

    const patchTaskResponse = await fetch(`${baseUrl}/api/tasks/${createTaskJson.task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done", ...activeProjectScope })
    });
    assert.equal(patchTaskResponse.status, 200);
    const patchTaskJson = await patchTaskResponse.json();
    assert.equal(patchTaskJson.task.status, "done");

    const taskUpdateLedgerResponse = await fetch(`${baseUrl}/api/governance/task-update-ledger`);
    assert.equal(taskUpdateLedgerResponse.status, 200);
    const taskUpdateLedgerJson = await taskUpdateLedgerResponse.json();
    assert.equal(taskUpdateLedgerJson.summary.total, 1);
    assert.equal(taskUpdateLedgerJson.summary.statusChanges, 1);
    assert.equal(taskUpdateLedgerJson.summary.taskCount, 1);
    assert.equal(taskUpdateLedgerJson.items[0].taskId, createTaskJson.task.id);
    assert.equal(taskUpdateLedgerJson.items[0].previousStatus, "open");
    assert.equal(taskUpdateLedgerJson.items[0].nextStatus, "done");
    assert.match(taskUpdateLedgerJson.markdown, /# Governance Task Update Ledger/);

    const missingTaskUpdateLedgerSnapshotDiffResponse = await fetch(`${baseUrl}/api/governance/task-update-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(missingTaskUpdateLedgerSnapshotDiffResponse.status, 200);
    const missingTaskUpdateLedgerSnapshotDiffJson = await missingTaskUpdateLedgerSnapshotDiffResponse.json();
    assert.equal(missingTaskUpdateLedgerSnapshotDiffJson.hasSnapshot, false);
    assert.equal(missingTaskUpdateLedgerSnapshotDiffJson.driftSeverity, "missing-snapshot");
    assert.match(missingTaskUpdateLedgerSnapshotDiffJson.markdown, /# Governance Task Update Ledger Snapshot Drift/);

    const unscopedTaskUpdateLedgerSnapshotResponse = await fetch(`${baseUrl}/api/governance/task-update-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Governance Task Update Ledger", limit: 5 })
    });
    assert.equal(unscopedTaskUpdateLedgerSnapshotResponse.status, 409);
    const unscopedTaskUpdateLedgerSnapshotJson = await unscopedTaskUpdateLedgerSnapshotResponse.json();
    assert.equal(unscopedTaskUpdateLedgerSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createTaskUpdateLedgerSnapshotResponse = await fetch(`${baseUrl}/api/governance/task-update-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Governance Task Update Ledger", limit: 5, ...taskMutationScope })
    });
    assert.equal(createTaskUpdateLedgerSnapshotResponse.status, 200);
    const createTaskUpdateLedgerSnapshotJson = await createTaskUpdateLedgerSnapshotResponse.json();
    assert.equal(createTaskUpdateLedgerSnapshotJson.success, true);
    assert.equal(createTaskUpdateLedgerSnapshotJson.snapshot.title, "Fixture Governance Task Update Ledger");
    assert.equal(createTaskUpdateLedgerSnapshotJson.snapshot.total, 1);
    assert.equal(createTaskUpdateLedgerSnapshotJson.snapshot.statusChangeCount, 1);
    assert.equal(createTaskUpdateLedgerSnapshotJson.snapshot.taskCount, 1);
    assert.equal(createTaskUpdateLedgerSnapshotJson.snapshot.items.length, 1);
    assert.match(createTaskUpdateLedgerSnapshotJson.snapshot.markdown, /# Governance Task Update Ledger/);

    const taskUpdateLedgerSnapshotsResponse = await fetch(`${baseUrl}/api/governance/task-update-ledger-snapshots`);
    assert.equal(taskUpdateLedgerSnapshotsResponse.status, 200);
    const taskUpdateLedgerSnapshotsJson = await taskUpdateLedgerSnapshotsResponse.json();
    assert.equal(taskUpdateLedgerSnapshotsJson.length, 1);
    assert.equal(taskUpdateLedgerSnapshotsJson[0].title, "Fixture Governance Task Update Ledger");

    const metadataTaskUpdateResponse = await fetch(`${baseUrl}/api/tasks/${createTaskJson.task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: "medium", ...activeProjectScope })
    });
    assert.equal(metadataTaskUpdateResponse.status, 200);

    const taskUpdateLedgerSnapshotDiffResponse = await fetch(`${baseUrl}/api/governance/task-update-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(taskUpdateLedgerSnapshotDiffResponse.status, 200);
    const taskUpdateLedgerSnapshotDiffJson = await taskUpdateLedgerSnapshotDiffResponse.json();
    assert.equal(taskUpdateLedgerSnapshotDiffJson.hasSnapshot, true);
    assert.equal(taskUpdateLedgerSnapshotDiffJson.hasDrift, true);
    assert.equal(taskUpdateLedgerSnapshotDiffJson.snapshotTitle, "Fixture Governance Task Update Ledger");
    assert.ok(taskUpdateLedgerSnapshotDiffJson.driftItems.some((item) => item.label === "Total task update audit operations" && item.before === 1 && item.current === 2));
    assert.match(taskUpdateLedgerSnapshotDiffJson.markdown, /# Governance Task Update Ledger Snapshot Drift/);

    const unscopedCreateWorkflowResponse = await fetch(`${baseUrl}/api/workflows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Promote portfolio persistence",
        brief: "Land persistence routes and UI findings view",
        phase: "integration",
        status: "active",
        projectId: "alpha-app",
        projectName: "Alpha App"
      })
    });
    assert.equal(unscopedCreateWorkflowResponse.status, 409);
    const unscopedCreateWorkflowJson = await unscopedCreateWorkflowResponse.json();
    assert.equal(unscopedCreateWorkflowJson.reasonCode, "agent-execution-scope-required");

    const createWorkflowResponse = await fetch(`${baseUrl}/api/workflows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Promote portfolio persistence",
        brief: "Land persistence routes and UI findings view",
        phase: "integration",
        status: "active",
        projectId: "alpha-app",
        projectName: "Alpha App",
        ...activeProjectScope
      })
    });
    assert.equal(createWorkflowResponse.status, 200);
    const createWorkflowJson = await createWorkflowResponse.json();
    assert.equal(createWorkflowJson.success, true);
    assert.equal(createWorkflowJson.workflow.title, "Promote portfolio persistence");

    const workflowsResponse = await fetch(`${baseUrl}/api/workflows`);
    assert.equal(workflowsResponse.status, 200);
    const workflowsJson = await workflowsResponse.json();
    assert.equal(workflowsJson.length, 1);
    const filteredWorkflowsResponse = await fetch(`${baseUrl}/api/workflows?projectId=alpha-app`);
    assert.equal(filteredWorkflowsResponse.status, 200);
    const filteredWorkflowsJson = await filteredWorkflowsResponse.json();
    assert.equal(filteredWorkflowsJson.length, 1);

    const initialScriptRunsResponse = await fetch(`${baseUrl}/api/script-runs?projectId=alpha-app`);
    assert.equal(initialScriptRunsResponse.status, 200);
    const initialScriptRunsJson = await initialScriptRunsResponse.json();
    assert.equal(initialScriptRunsJson.length, 0);

    const unscopedScriptRunResponse = await fetch(`${baseUrl}/api/run?script=missing-script&path=alpha-app`);
    assert.equal(unscopedScriptRunResponse.status, 200);
    const unscopedScriptRunStream = await unscopedScriptRunResponse.text();
    assert.match(unscopedScriptRunStream, /agent-execution-scope-required/);

    const scriptRunsAfterUnscopedResponse = await fetch(`${baseUrl}/api/script-runs?projectId=alpha-app`);
    assert.equal(scriptRunsAfterUnscopedResponse.status, 200);
    const scriptRunsAfterUnscopedJson = await scriptRunsAfterUnscopedResponse.json();
    assert.equal(scriptRunsAfterUnscopedJson.length, 0);

    const scriptRunResponse = await fetch(`${baseUrl}/api/run?script=missing-script&path=alpha-app&activeProjectId=alpha-app&scopeMode=project`);
    assert.equal(scriptRunResponse.status, 200);
    const scriptRunStream = await scriptRunResponse.text();
    assert.match(scriptRunStream, /Process exited with code 1|spawn E/);

    const scriptRunsResponse = await fetch(`${baseUrl}/api/script-runs?projectId=alpha-app`);
    assert.equal(scriptRunsResponse.status, 200);
    const scriptRunsJson = await scriptRunsResponse.json();
    assert.equal(scriptRunsJson.length, 1);
    assert.equal(scriptRunsJson[0].script, "missing-script");
    assert.equal(scriptRunsJson[0].status, "failed");
    assert.ok(scriptRunsJson[0].exitCode === 1 || scriptRunsJson[0].exitCode === null);

    const initialAgentSessionsResponse = await fetch(`${baseUrl}/api/agent-sessions?projectId=alpha-app`);
    assert.equal(initialAgentSessionsResponse.status, 200);
    const initialAgentSessionsJson = await initialAgentSessionsResponse.json();
    assert.equal(initialAgentSessionsJson.length, 0);

    const unscopedCreateAgentSessionResponse = await fetch(`${baseUrl}/api/agent-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "alpha-app",
        projectName: "Alpha App",
        relPath: "alpha-app",
        title: "Agent handoff for Alpha App",
        summary: "Fixture handoff session",
        handoffPack: "# Agent Handoff Pack: Alpha App\n\nUse this fixture pack.",
        status: "prepared"
      })
    });
    assert.equal(unscopedCreateAgentSessionResponse.status, 409);
    const unscopedCreateAgentSessionJson = await unscopedCreateAgentSessionResponse.json();
    assert.equal(unscopedCreateAgentSessionJson.reasonCode, "agent-execution-scope-required");

    const createAgentSessionResponse = await fetch(`${baseUrl}/api/agent-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "alpha-app",
        projectName: "Alpha App",
        relPath: "alpha-app",
        title: "Agent handoff for Alpha App",
        summary: "Fixture handoff session",
        handoffPack: "# Agent Handoff Pack: Alpha App\n\nUse this fixture pack.",
        status: "prepared",
        ...activeProjectScope
      })
    });
    assert.equal(createAgentSessionResponse.status, 200);
    const createAgentSessionJson = await createAgentSessionResponse.json();
    assert.equal(createAgentSessionJson.success, true);
    assert.equal(createAgentSessionJson.agentSession.projectId, "alpha-app");

    const agentSessionsResponse = await fetch(`${baseUrl}/api/agent-sessions?projectId=alpha-app`);
    assert.equal(agentSessionsResponse.status, 200);
    const agentSessionsJson = await agentSessionsResponse.json();
    assert.equal(agentSessionsJson.length, 1);
    assert.equal(agentSessionsJson[0].status, "prepared");
    assert.match(agentSessionsJson[0].handoffPack, /Agent Handoff Pack/);

    const unscopedPatchWorkflowResponse = await fetch(`${baseUrl}/api/workflows/${createWorkflowJson.workflow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" })
    });
    assert.equal(unscopedPatchWorkflowResponse.status, 409);
    const unscopedPatchWorkflowJson = await unscopedPatchWorkflowResponse.json();
    assert.equal(unscopedPatchWorkflowJson.reasonCode, "agent-execution-scope-required");

    const patchWorkflowResponse = await fetch(`${baseUrl}/api/workflows/${createWorkflowJson.workflow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done", ...activeProjectScope })
    });
    assert.equal(patchWorkflowResponse.status, 200);
    const patchWorkflowJson = await patchWorkflowResponse.json();
    assert.equal(patchWorkflowJson.workflow.status, "done");

    const unscopedCreateNoteResponse = await fetch(`${baseUrl}/api/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Project context",
        body: "Alpha app is the fixture used for server integration tests.",
        kind: "context",
        projectId: "alpha-app",
        projectName: "Alpha App"
      })
    });
    assert.equal(unscopedCreateNoteResponse.status, 409);
    const unscopedCreateNoteJson = await unscopedCreateNoteResponse.json();
    assert.equal(unscopedCreateNoteJson.reasonCode, "agent-execution-scope-required");

    const createNoteResponse = await fetch(`${baseUrl}/api/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Project context",
        body: "Alpha app is the fixture used for server integration tests.",
        kind: "context",
        projectId: "alpha-app",
        projectName: "Alpha App",
        ...activeProjectScope
      })
    });
    assert.equal(createNoteResponse.status, 200);
    const createNoteJson = await createNoteResponse.json();
    assert.equal(createNoteJson.success, true);

    const notesResponse = await fetch(`${baseUrl}/api/notes?projectId=alpha-app`);
    assert.equal(notesResponse.status, 200);
    const notesJson = await notesResponse.json();
    assert.equal(notesJson.length, 1);

    const unscopedPatchNoteResponse = await fetch(`${baseUrl}/api/notes/${createNoteJson.note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "decision" })
    });
    assert.equal(unscopedPatchNoteResponse.status, 409);
    const unscopedPatchNoteJson = await unscopedPatchNoteResponse.json();
    assert.equal(unscopedPatchNoteJson.reasonCode, "agent-execution-scope-required");

    const patchNoteResponse = await fetch(`${baseUrl}/api/notes/${createNoteJson.note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "decision", ...activeProjectScope })
    });
    assert.equal(patchNoteResponse.status, 200);
    const patchNoteJson = await patchNoteResponse.json();
    assert.equal(patchNoteJson.note.kind, "decision");

    const unscopedCreateMilestoneResponse = await fetch(`${baseUrl}/api/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture memory live",
        detail: "Project memory routes are available for alpha-app.",
        status: "planned",
        targetDate: "2026-04-20",
        projectId: "alpha-app",
        projectName: "Alpha App"
      })
    });
    assert.equal(unscopedCreateMilestoneResponse.status, 409);
    const unscopedCreateMilestoneJson = await unscopedCreateMilestoneResponse.json();
    assert.equal(unscopedCreateMilestoneJson.reasonCode, "agent-execution-scope-required");

    const createMilestoneResponse = await fetch(`${baseUrl}/api/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture memory live",
        detail: "Project memory routes are available for alpha-app.",
        status: "planned",
        targetDate: "2026-04-20",
        projectId: "alpha-app",
        projectName: "Alpha App",
        ...activeProjectScope
      })
    });
    assert.equal(createMilestoneResponse.status, 200);
    const createMilestoneJson = await createMilestoneResponse.json();
    assert.equal(createMilestoneJson.success, true);

    const milestonesResponse = await fetch(`${baseUrl}/api/milestones?projectId=alpha-app`);
    assert.equal(milestonesResponse.status, 200);
    const milestonesJson = await milestonesResponse.json();
    assert.equal(milestonesJson.length, 1);

    const unscopedPatchMilestoneResponse = await fetch(`${baseUrl}/api/milestones/${createMilestoneJson.milestone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" })
    });
    assert.equal(unscopedPatchMilestoneResponse.status, 409);
    const unscopedPatchMilestoneJson = await unscopedPatchMilestoneResponse.json();
    assert.equal(unscopedPatchMilestoneJson.reasonCode, "agent-execution-scope-required");

    const patchMilestoneResponse = await fetch(`${baseUrl}/api/milestones/${createMilestoneJson.milestone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done", ...activeProjectScope })
    });
    assert.equal(patchMilestoneResponse.status, 200);
    const patchMilestoneJson = await patchMilestoneResponse.json();
    assert.equal(patchMilestoneJson.milestone.status, "done");

    const unscopedSaveProfileResponse = await fetch(`${baseUrl}/api/project-profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "alpha-app",
        projectName: "Alpha App",
        owner: "Platform Team",
        status: "active",
        lifecycle: "stabilizing",
        tier: "core",
        targetState: "scale",
        summary: "Primary fixture app used to validate the control-center workflow."
      })
    });
    assert.equal(unscopedSaveProfileResponse.status, 409);
    const unscopedSaveProfileJson = await unscopedSaveProfileResponse.json();
    assert.equal(unscopedSaveProfileJson.reasonCode, "agent-execution-scope-required");

    const saveProfileResponse = await fetch(`${baseUrl}/api/project-profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "alpha-app",
        projectName: "Alpha App",
        owner: "Platform Team",
        status: "active",
        lifecycle: "stabilizing",
        tier: "core",
        targetState: "scale",
        summary: "Primary fixture app used to validate the control-center workflow.",
        ...activeProjectScope
      })
    });
    assert.equal(saveProfileResponse.status, 200);
    const saveProfileJson = await saveProfileResponse.json();
    assert.equal(saveProfileJson.success, true);
    assert.equal(saveProfileJson.profile.owner, "Platform Team");
    assert.equal(saveProfileJson.profileHistoryEntry.changeType, "created");

    const projectProfilesResponse = await fetch(`${baseUrl}/api/project-profiles?projectId=alpha-app`);
    assert.equal(projectProfilesResponse.status, 200);
    const projectProfilesJson = await projectProfilesResponse.json();
    assert.equal(projectProfilesJson.length, 1);
    assert.equal(projectProfilesJson[0].tier, "core");

    const updateProfileResponse = await fetch(`${baseUrl}/api/project-profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "alpha-app",
        projectName: "Alpha App",
        owner: "Control Plane Team",
        status: "active",
        lifecycle: "scaling",
        tier: "core",
        targetState: "scale",
        summary: "Profile updated to reflect the control-center rollout.",
        ...activeProjectScope
      })
    });
    assert.equal(updateProfileResponse.status, 200);
    const updateProfileJson = await updateProfileResponse.json();
    assert.equal(updateProfileJson.success, true);
    assert.equal(updateProfileJson.profile.owner, "Control Plane Team");
    assert.equal(updateProfileJson.profileHistoryEntry.changeType, "updated");
    assert.match(updateProfileJson.profileHistoryEntry.changedFields.join(","), /owner/);
    assert.match(updateProfileJson.profileHistoryEntry.changedFields.join(","), /lifecycle/);

    const profileHistoryResponse = await fetch(`${baseUrl}/api/project-profile-history?projectId=alpha-app`);
    assert.equal(profileHistoryResponse.status, 200);
    const profileHistoryJson = await profileHistoryResponse.json();
    assert.equal(profileHistoryJson.length, 2);
    assert.equal(profileHistoryJson[0].projectId, "alpha-app");

    const governanceResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceResponse.status, 200);
    const governanceJson = await governanceResponse.json();
    assert.equal(governanceJson.summary.openTasks, 0);
    assert.equal(governanceJson.summary.activeWorkflows, 0);
    assert.equal(governanceJson.summary.pendingMilestones, 0);
    assert.equal(governanceJson.summary.decisionNotes, 1);
    assert.equal(governanceJson.summary.profileCount, 1);
    assert.equal(governanceJson.summary.ownedProfiles, 1);
    assert.equal(governanceJson.summary.agentSessionCount, 1);
    assert.equal(governanceJson.summary.agentReadinessItems, 1);
    assert.equal(governanceJson.summary.agentReadyProjects, 0);
    assert.equal(governanceJson.summary.deploymentSmokeCheckCount, 2);
    assert.equal(governanceJson.summary.deploymentSmokeCheckPassCount, 2);
    assert.equal(governanceJson.summary.deploymentSmokeCheckFailCount, 0);
    assert.equal(governanceJson.deploymentSmokeChecks.length, 2);
    assert.equal(governanceJson.deploymentSmokeChecks[0].label, "Fixture release gate local app");
    assert.equal(governanceJson.summary.releaseCheckpointCount, 2);
    assert.equal(governanceJson.summary.releaseLatestCheckpointStatus, "review");
    assert.equal(governanceJson.releaseCheckpoints.length, 2);
    assert.equal(governanceJson.releaseCheckpoints[0].title, "Fixture Release Gate Bootstrap");
    assert.ok(Array.isArray(governanceJson.recentActivity));
    assert.ok(Array.isArray(governanceJson.decisions));
    assert.equal(governanceJson.profiles.length, 1);
    assert.equal(governanceJson.profileHistory.length, 2);
    assert.equal(governanceJson.agentSessions.length, 1);
    assert.equal(governanceJson.agentSessions[0].projectId, "alpha-app");
    assert.equal(governanceJson.agentReadinessMatrix.length, 1);
    assert.equal(governanceJson.agentReadinessMatrix[0].projectId, "alpha-app");
    assert.match(governanceJson.agentReadinessMatrix[0].blockers.join(","), /active workflow missing/);
    assert.equal(governanceJson.summary.dataSourcesAccessGateDecision, "ready");
    assert.equal(governanceJson.summary.dataSourcesAccessGateRank, 1);
    assert.equal(governanceJson.summary.dataSourcesAccessReadyCount, 1);
    assert.equal(governanceJson.summary.dataSourcesAccessReviewCount, 0);
    assert.equal(governanceJson.dataSourcesAccessGate.decision, "ready");
    assert.equal(governanceJson.summary.dataSourcesAccessReviewQueueCount, 0);
    assert.equal(governanceJson.dataSourcesAccessReviewQueue.summary.total, 0);
    assert.equal(governanceJson.summary.dataSourcesAccessValidationMethodCount, 1);
    assert.equal(governanceJson.summary.dataSourcesAccessValidationSourceCount, 1);
    assert.equal(governanceJson.summary.dataSourcesAccessValidationReviewCount, 0);
    assert.equal(governanceJson.summary.dataSourcesAccessValidationBlockedCount, 0);
    assert.equal(governanceJson.dataSourcesAccessValidationRunbook.summary.methodCount, 1);
    assert.equal(governanceJson.dataSourcesAccessValidationRunbook.methods[0].accessMethod, "local-filesystem");
    assert.equal(governanceJson.summary.dataSourcesAccessValidationWorkflowTotalCount, 1);
    assert.equal(governanceJson.summary.dataSourcesAccessValidationWorkflowReadyCount, 1);
    assert.equal(governanceJson.summary.dataSourcesAccessValidationWorkflowPendingCount, 0);
    assert.equal(governanceJson.summary.dataSourcesAccessValidationWorkflowBlockedCount, 0);
    assert.equal(governanceJson.summary.dataSourcesAccessValidationWorkflowMissingEvidenceCount, 0);
    assert.equal(governanceJson.summary.dataSourceAccessValidationWorkflowSnapshotCount, 1);
    assert.equal(governanceJson.summary.dataSourceAccessValidationWorkflowSnapshotHasDrift, true);
    assert.ok(governanceJson.summary.dataSourceAccessValidationWorkflowSnapshotDriftScore > 0);
    assert.equal(governanceJson.summary.dataSourceAccessValidationWorkflowSnapshotDriftSeverity, "low");
    assert.equal(governanceJson.dataSourcesAccessValidationWorkflow.summary.ready, 1);
    assert.equal(governanceJson.dataSourceAccessValidationWorkflowSnapshots.length, 1);
    assert.equal(governanceJson.dataSourceAccessValidationWorkflowSnapshots[0].title, "Fixture Source Access Validation Workflow");
    assert.equal(governanceJson.dataSourceAccessValidationWorkflowSnapshotDiff.hasSnapshot, true);
    assert.equal(governanceJson.dataSourceAccessValidationWorkflowSnapshotDiff.hasDrift, true);
    assert.equal(governanceJson.dataSourceAccessValidationWorkflowSnapshotDiff.driftSeverity, "low");
    assert.equal(governanceJson.summary.dataSourcesAccessValidationEvidenceCount, 1);
    assert.equal(governanceJson.summary.dataSourcesAccessValidationEvidenceValidatedCount, 1);
    assert.equal(governanceJson.summary.dataSourcesAccessValidationEvidenceReviewCount, 0);
    assert.equal(governanceJson.summary.dataSourcesAccessValidationEvidenceBlockedCount, 0);
    assert.equal(governanceJson.summary.dataSourcesAccessValidationEvidenceCoverageCount, 1);
    assert.equal(governanceJson.summary.dataSourcesAccessValidationEvidenceCoverageCoveredCount, 1);
    assert.equal(governanceJson.summary.dataSourcesAccessValidationEvidenceCoverageMissingCount, 0);
    assert.equal(governanceJson.summary.dataSourcesAccessValidationEvidenceCoveragePercent, 100);
    assert.equal(governanceJson.dataSourcesAccessValidationEvidenceCoverage.summary.coveragePercent, 100);
    assert.equal(governanceJson.dataSourcesAccessValidationEvidenceCoverage.items[0].coverageStatus, "covered");
    assert.equal(governanceJson.summary.dataSourceAccessValidationEvidenceSnapshotCount, 1);
    assert.equal(governanceJson.summary.dataSourceAccessValidationEvidenceSnapshotHasDrift, false);
    assert.equal(governanceJson.summary.dataSourceAccessValidationEvidenceSnapshotDriftScore, 0);
    assert.equal(governanceJson.summary.dataSourceAccessValidationEvidenceSnapshotDriftSeverity, "none");
    assert.equal(governanceJson.dataSourceAccessValidationEvidence.length, 1);
    assert.equal(governanceJson.dataSourceAccessValidationEvidence[0].status, "validated");
    assert.equal(governanceJson.dataSourceAccessValidationEvidenceSnapshots.length, 1);
    assert.equal(governanceJson.dataSourceAccessValidationEvidenceSnapshots[0].title, "Fixture Source Access Evidence");
    assert.equal(governanceJson.dataSourceAccessValidationEvidenceSnapshotDiff.hasSnapshot, true);
    assert.equal(governanceJson.dataSourceAccessValidationEvidenceSnapshotDiff.hasDrift, false);
    assert.equal(governanceJson.dataSourceAccessValidationEvidenceSnapshotDiff.driftSeverity, "none");
    assert.ok(governanceJson.operationLog.some((operation) => operation.type === "deployment-smoke-check-recorded"));
    assert.ok(governanceJson.operationLog.some((operation) => operation.type === "release-checkpoint-recorded"));
    assert.ok(governanceJson.operationLog.some((operation) => operation.type === "data-source-access-validation-evidence-recorded"));
    assert.ok(governanceJson.operationLog.some((operation) => operation.type === "data-source-access-validation-evidence-snapshot-created"));
    assert.ok(governanceJson.operationLog.some((operation) => operation.type === "data-source-access-validation-workflow-snapshot-created"));
    assert.equal(governanceJson.agentControlPlaneDecision.decision, "hold");
    assert.equal(governanceJson.agentControlPlaneDecision.baselineDriftSeverity, "missing-baseline");
    assert.ok(governanceJson.agentControlPlaneDecision.reasons.some((reason) => reason.code === "baseline-missing"));
    assert.equal(governanceJson.unprofiledProjects.length, 0);

    const agentWorkOrdersResponse = await fetch(`${baseUrl}/api/agent-work-orders`);
    assert.equal(agentWorkOrdersResponse.status, 200);
    const agentWorkOrdersJson = await agentWorkOrdersResponse.json();
    assert.equal(agentWorkOrdersJson.total, 1);
    assert.equal(agentWorkOrdersJson.items[0].projectId, "alpha-app");
    assert.equal(agentWorkOrdersJson.items[0].agentPolicy.policyId, "agent-policy:alpha-app");
    assert.equal(agentWorkOrdersJson.items[0].agentPolicy.checkpointStatus, "needs-review");
    assert.equal(agentWorkOrdersJson.items[0].agentPolicy.executable, false);
    assert.match(agentWorkOrdersJson.markdown, /# Agent Work Orders/);
    assert.match(agentWorkOrdersJson.markdown, /Alpha App/);
    assert.match(agentWorkOrdersJson.markdown, /Agent policy checkpoint: needs-review/);

    const initialAgentPolicyCheckpointsResponse = await fetch(`${baseUrl}/api/agent-policy-checkpoints`);
    assert.equal(initialAgentPolicyCheckpointsResponse.status, 200);
    const initialAgentPolicyCheckpointsJson = await initialAgentPolicyCheckpointsResponse.json();
    assert.equal(initialAgentPolicyCheckpointsJson.summary.total, 0);

    const agentPolicyCheckpointPayload = {
      policyId: agentWorkOrdersJson.items[0].agentPolicy.policyId,
      projectId: "alpha-app",
      projectName: "Alpha App",
      relPath: "alpha-app",
      status: "approved",
      role: agentWorkOrdersJson.items[0].agentPolicy.role,
      runtime: agentWorkOrdersJson.items[0].agentPolicy.runtime,
      isolationMode: agentWorkOrdersJson.items[0].agentPolicy.isolationMode,
      skillBundle: agentWorkOrdersJson.items[0].agentPolicy.skillBundle,
      hookPolicy: agentWorkOrdersJson.items[0].agentPolicy.hookPolicy,
      note: "Fixture approved generated managed-agent policy."
    };
    const unscopedAgentPolicyResponse = await fetch(`${baseUrl}/api/agent-policy-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(agentPolicyCheckpointPayload)
    });
    assert.equal(unscopedAgentPolicyResponse.status, 409);
    const unscopedAgentPolicyJson = await unscopedAgentPolicyResponse.json();
    assert.equal(unscopedAgentPolicyJson.reasonCode, "agent-execution-scope-required");

    const mismatchedAgentPolicyResponse = await fetch(`${baseUrl}/api/agent-policy-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...agentPolicyCheckpointPayload,
        policyId: "agent-policy:beta-app",
        projectId: "beta-app",
        projectName: "Beta App",
        relPath: "beta-app",
        activeProjectId: "alpha-app",
        scopeMode: "project"
      })
    });
    assert.equal(mismatchedAgentPolicyResponse.status, 409);
    const mismatchedAgentPolicyJson = await mismatchedAgentPolicyResponse.json();
    assert.equal(mismatchedAgentPolicyJson.reasonCode, "agent-execution-scope-mismatch");
    assert.deepEqual(mismatchedAgentPolicyJson.mismatchedProjectIds, ["beta-app"]);

    const approveAgentPolicyResponse = await fetch(`${baseUrl}/api/agent-policy-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...agentPolicyCheckpointPayload,
        activeProjectId: "alpha-app",
        scopeMode: "project"
      })
    });
    assert.equal(approveAgentPolicyResponse.status, 200);
    const approveAgentPolicyJson = await approveAgentPolicyResponse.json();
    assert.equal(approveAgentPolicyJson.success, true);
    assert.equal(approveAgentPolicyJson.checkpoint.status, "approved");

    const approvedAgentWorkOrdersResponse = await fetch(`${baseUrl}/api/agent-work-orders`);
    assert.equal(approvedAgentWorkOrdersResponse.status, 200);
    const approvedAgentWorkOrdersJson = await approvedAgentWorkOrdersResponse.json();
    assert.equal(approvedAgentWorkOrdersJson.items[0].agentPolicy.checkpointStatus, "approved");
    assert.equal(approvedAgentWorkOrdersJson.items[0].agentPolicy.executable, true);

    const initialAgentWorkOrderSnapshotsResponse = await fetch(`${baseUrl}/api/agent-work-order-snapshots`);
    assert.equal(initialAgentWorkOrderSnapshotsResponse.status, 200);
    const initialAgentWorkOrderSnapshotsJson = await initialAgentWorkOrderSnapshotsResponse.json();
    assert.equal(initialAgentWorkOrderSnapshotsJson.length, 0);

    const unscopedAgentWorkOrderSnapshotResponse = await fetch(`${baseUrl}/api/agent-work-order-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Agent Work Orders",
        status: "all",
        limit: 10
      })
    });
    assert.equal(unscopedAgentWorkOrderSnapshotResponse.status, 409);
    const unscopedAgentWorkOrderSnapshotJson = await unscopedAgentWorkOrderSnapshotResponse.json();
    assert.equal(unscopedAgentWorkOrderSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createAgentWorkOrderSnapshotResponse = await fetch(`${baseUrl}/api/agent-work-order-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Agent Work Orders",
        status: "all",
        limit: 10,
        scopeMode: "portfolio"
      })
    });
    assert.equal(createAgentWorkOrderSnapshotResponse.status, 200);
    const createAgentWorkOrderSnapshotJson = await createAgentWorkOrderSnapshotResponse.json();
    assert.equal(createAgentWorkOrderSnapshotJson.success, true);
    assert.equal(createAgentWorkOrderSnapshotJson.snapshot.total, 1);
    assert.equal(createAgentWorkOrderSnapshotJson.snapshot.approvedPolicyCount, 1);
    assert.equal(createAgentWorkOrderSnapshotJson.snapshot.executableCount, 1);
    assert.equal(createAgentWorkOrderSnapshotJson.snapshot.unresolvedPolicyCount, 0);
    assert.match(createAgentWorkOrderSnapshotJson.snapshot.markdown, /Alpha App/);

    const agentWorkOrderSnapshotsResponse = await fetch(`${baseUrl}/api/agent-work-order-snapshots`);
    assert.equal(agentWorkOrderSnapshotsResponse.status, 200);
    const agentWorkOrderSnapshotsJson = await agentWorkOrderSnapshotsResponse.json();
    assert.equal(agentWorkOrderSnapshotsJson.length, 1);
    assert.equal(agentWorkOrderSnapshotsJson[0].title, "Fixture Agent Work Orders");

    const governanceAfterWorkOrderSnapshotResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterWorkOrderSnapshotResponse.status, 200);
    const governanceAfterWorkOrderSnapshotJson = await governanceAfterWorkOrderSnapshotResponse.json();
    assert.equal(governanceAfterWorkOrderSnapshotJson.summary.agentWorkOrderSnapshotCount, 1);
    assert.equal(governanceAfterWorkOrderSnapshotJson.summary.agentPolicyCheckpointCount, 1);
    assert.equal(governanceAfterWorkOrderSnapshotJson.summary.agentPolicyCheckpointApprovedCount, 1);
    assert.equal(governanceAfterWorkOrderSnapshotJson.summary.agentPolicyCheckpointUnresolvedCount, 0);
    assert.equal(governanceAfterWorkOrderSnapshotJson.summary.agentPolicyExecutableCount, 1);
    assert.equal(governanceAfterWorkOrderSnapshotJson.agentPolicyCheckpoints.length, 1);
    assert.equal(governanceAfterWorkOrderSnapshotJson.agentWorkOrderSnapshots.length, 1);

    const initialAgentWorkOrderRunsResponse = await fetch(`${baseUrl}/api/agent-work-order-runs`);
    assert.equal(initialAgentWorkOrderRunsResponse.status, 200);
    const initialAgentWorkOrderRunsJson = await initialAgentWorkOrderRunsResponse.json();
    assert.equal(initialAgentWorkOrderRunsJson.length, 0);

    const initialExecutionResultCheckpointsResponse = await fetch(`${baseUrl}/api/agent-execution-result-checkpoints`);
    assert.equal(initialExecutionResultCheckpointsResponse.status, 200);
    const initialExecutionResultCheckpointsJson = await initialExecutionResultCheckpointsResponse.json();
    assert.equal(initialExecutionResultCheckpointsJson.summary.total, 0);
    assert.equal(initialExecutionResultCheckpointsJson.requirements.totalBlocked, 0);
    assert.equal(initialExecutionResultCheckpointsJson.agentExecutionResultCheckpoints.length, 0);

    const alphaAgentExecutionScope = { activeProjectId: "alpha-app", scopeMode: "project" };
    const portfolioAgentExecutionScope = { scopeMode: "portfolio" };

    const unscopedBatchAgentWorkOrderRunsResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createAgentWorkOrderSnapshotJson.snapshot.id
      })
    });
    assert.equal(unscopedBatchAgentWorkOrderRunsResponse.status, 409);
    const unscopedBatchAgentWorkOrderRunsJson = await unscopedBatchAgentWorkOrderRunsResponse.json();
    assert.equal(unscopedBatchAgentWorkOrderRunsJson.reasonCode, "agent-execution-scope-required");
    assert.equal(unscopedBatchAgentWorkOrderRunsJson.scopeContext.guardDecision, "project-required");

    const mismatchedAgentWorkOrderRunResponse = await fetch(`${baseUrl}/api/agent-work-order-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "beta-app",
        projectName: "Beta App",
        objective: "Verify server-side execution scope mismatch handling.",
        status: "queued",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(mismatchedAgentWorkOrderRunResponse.status, 409);
    const mismatchedAgentWorkOrderRunJson = await mismatchedAgentWorkOrderRunResponse.json();
    assert.equal(mismatchedAgentWorkOrderRunJson.reasonCode, "agent-execution-scope-mismatch");
    assert.deepEqual(mismatchedAgentWorkOrderRunJson.mismatchedProjectIds, ["beta-app"]);

    const batchAgentWorkOrderRunsResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createAgentWorkOrderSnapshotJson.snapshot.id,
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(batchAgentWorkOrderRunsResponse.status, 200);
    const batchAgentWorkOrderRunsJson = await batchAgentWorkOrderRunsResponse.json();
    assert.equal(batchAgentWorkOrderRunsJson.success, true);
    assert.equal(batchAgentWorkOrderRunsJson.queuedRuns.length, 1);
    assert.equal(batchAgentWorkOrderRunsJson.queuedRuns[0].snapshotId, createAgentWorkOrderSnapshotJson.snapshot.id);
    assert.equal(batchAgentWorkOrderRunsJson.queuedRuns[0].agentPolicyId, "agent-policy:alpha-app");
    assert.equal(batchAgentWorkOrderRunsJson.queuedRuns[0].agentPolicyCheckpointStatus, "approved");
    assert.equal(batchAgentWorkOrderRunsJson.queuedRuns[0].profileTargetTaskLedgerBaselineHealth, "missing");
    assert.equal(batchAgentWorkOrderRunsJson.queuedRuns[0].profileTargetTaskLedgerBaselineUncheckpointedDriftCount, 0);
    assert.equal(batchAgentWorkOrderRunsJson.queuedRuns[0].targetBaselineAuditLedgerBaselineHealth, "missing");
    assert.equal(batchAgentWorkOrderRunsJson.queuedRuns[0].targetBaselineAuditLedgerBaselineUncheckpointedDriftCount, 0);
    assert.equal(batchAgentWorkOrderRunsJson.queuedRuns[0].regressionAlertTaskLedgerBaselineHealth, "missing");
    assert.equal(batchAgentWorkOrderRunsJson.queuedRuns[0].regressionAlertTaskLedgerBaselineRefreshGateDecision, "ready");
    assert.equal(batchAgentWorkOrderRunsJson.queuedRuns[0].regressionAlertTaskLedgerBaselineUncheckpointedDriftCount, 0);
    assert.equal(batchAgentWorkOrderRunsJson.queuedRuns[0].history.length, 1);
    assert.equal(batchAgentWorkOrderRunsJson.queuedRuns[0].history[0].status, "queued");

    const repeatBatchAgentWorkOrderRunsResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createAgentWorkOrderSnapshotJson.snapshot.id,
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(repeatBatchAgentWorkOrderRunsResponse.status, 200);
    const repeatBatchAgentWorkOrderRunsJson = await repeatBatchAgentWorkOrderRunsResponse.json();
    assert.equal(repeatBatchAgentWorkOrderRunsJson.queuedRuns.length, 0);
    assert.equal(repeatBatchAgentWorkOrderRunsJson.skipped, 1);

    const createAgentWorkOrderRunResponse = await fetch(`${baseUrl}/api/agent-work-order-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "alpha-app",
        projectName: "Alpha App",
        relPath: "alpha-app",
        snapshotId: createAgentWorkOrderSnapshotJson.snapshot.id,
        title: "Agent work order for Alpha App",
        objective: "Create or reactivate a workflow stream for supervised implementation.",
        status: "queued",
        readinessScore: 45,
        readinessStatus: "blocked",
        blockers: ["active workflow missing"],
        agentPolicyId: approvedAgentWorkOrdersJson.items[0].agentPolicy.policyId,
        agentPolicyCheckpointId: approvedAgentWorkOrdersJson.items[0].agentPolicy.checkpointId,
        agentPolicyCheckpointStatus: approvedAgentWorkOrdersJson.items[0].agentPolicy.checkpointStatus,
        agentRole: approvedAgentWorkOrdersJson.items[0].agentPolicy.role,
        runtime: approvedAgentWorkOrdersJson.items[0].agentPolicy.runtime,
        isolationMode: approvedAgentWorkOrdersJson.items[0].agentPolicy.isolationMode,
        skillBundle: approvedAgentWorkOrdersJson.items[0].agentPolicy.skillBundle,
        hookPolicy: approvedAgentWorkOrdersJson.items[0].agentPolicy.hookPolicy,
        validationCommands: ["npm test"],
        notes: "Fixture execution queue item.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(createAgentWorkOrderRunResponse.status, 200);
    const createAgentWorkOrderRunJson = await createAgentWorkOrderRunResponse.json();
    assert.equal(createAgentWorkOrderRunJson.success, true);
    assert.equal(createAgentWorkOrderRunJson.run.status, "queued");
    assert.equal(createAgentWorkOrderRunJson.run.agentPolicyCheckpointStatus, "approved");
    assert.equal(createAgentWorkOrderRunJson.run.agentRole, approvedAgentWorkOrdersJson.items[0].agentPolicy.role);
    assert.equal(createAgentWorkOrderRunJson.run.profileTargetTaskLedgerBaselineHealth, "missing");
    assert.equal(createAgentWorkOrderRunJson.run.profileTargetTaskLedgerBaselineFreshness, "missing");
    assert.equal(createAgentWorkOrderRunJson.run.regressionAlertTaskLedgerBaselineHealth, "missing");
    assert.equal(createAgentWorkOrderRunJson.run.regressionAlertTaskLedgerBaselineRefreshGateDecision, "ready");

    const unscopedExecutionResultCheckpointResponse = await fetch(`${baseUrl}/api/agent-execution-result-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: createAgentWorkOrderRunJson.run.id,
        targetAction: "baseline-refresh",
        status: "approved",
        note: "Fixture unscoped execution-result checkpoint should be blocked."
      })
    });
    assert.equal(unscopedExecutionResultCheckpointResponse.status, 409);
    const unscopedExecutionResultCheckpointJson = await unscopedExecutionResultCheckpointResponse.json();
    assert.equal(unscopedExecutionResultCheckpointJson.reasonCode, "agent-execution-scope-required");
    assert.equal(createAgentWorkOrderRunJson.run.targetBaselineAuditLedgerBaselineHealth, "missing");
    assert.equal(createAgentWorkOrderRunJson.run.targetBaselineAuditLedgerBaselineFreshness, "missing");
    assert.equal(createAgentWorkOrderRunJson.run.history.length, 1);
    assert.equal(createAgentWorkOrderRunJson.run.history[0].status, "queued");

    const cliBridgeRunnerDryRunScopeParams = "activeProjectId=alpha-app&scopeMode=project";
    const cliBridgeRunnerDryRunScopePayload = {
      activeProjectId: "alpha-app",
      scopeMode: "project"
    };
    const unscopedCodexCliBridgeDryRunResponse = await fetch(`${baseUrl}/api/cli-bridge/runner-dry-run?runner=codex&runId=${createAgentWorkOrderRunJson.run.id}`);
    assert.equal(unscopedCodexCliBridgeDryRunResponse.status, 200);
    const unscopedCodexCliBridgeDryRunJson = await unscopedCodexCliBridgeDryRunResponse.json();
    assert.equal(unscopedCodexCliBridgeDryRunJson.dryRunDecision, "hold");
    assert.equal(unscopedCodexCliBridgeDryRunJson.scopeContext.scopeReady, false);
    assert.equal(unscopedCodexCliBridgeDryRunJson.scopeContext.guardDecision, "project-required");
    assert.ok(unscopedCodexCliBridgeDryRunJson.reasons.some((reason) => reason.code === "cli-bridge-runner-scope-required"));
    assert.match(unscopedCodexCliBridgeDryRunJson.markdown, /Scope Context/);

    const codexCliBridgeDryRunResponse = await fetch(`${baseUrl}/api/cli-bridge/runner-dry-run?runner=codex&runId=${createAgentWorkOrderRunJson.run.id}&${cliBridgeRunnerDryRunScopeParams}`);
    assert.equal(codexCliBridgeDryRunResponse.status, 200);
    const codexCliBridgeDryRunJson = await codexCliBridgeDryRunResponse.json();
    assert.equal(codexCliBridgeDryRunJson.protocolVersion, "cli-bridge-runner-dry-run.v1");
    assert.equal(codexCliBridgeDryRunJson.executionMode, "non-executing");
    assert.equal(codexCliBridgeDryRunJson.runner, "codex");
    assert.equal(codexCliBridgeDryRunJson.scopeContext.scopeMode, "project");
    assert.equal(codexCliBridgeDryRunJson.scopeContext.activeProjectId, "alpha-app");
    assert.equal(codexCliBridgeDryRunJson.scopeContext.scopeReady, true);
    assert.equal(codexCliBridgeDryRunJson.scopeContext.guardDecision, "project-ready");
    assert.equal(codexCliBridgeDryRunJson.selectedWorkOrder.id, createAgentWorkOrderRunJson.run.id);
    assert.equal(codexCliBridgeDryRunJson.commandEnvelope.adapterId, "codex");
    assert.equal(codexCliBridgeDryRunJson.targetBaselineAuditGate.health, "missing");
    assert.equal(codexCliBridgeDryRunJson.targetBaselineAuditGate.decision, "review");
    assert.equal(codexCliBridgeDryRunJson.auditBaselineRunGate.decision, "review");
    assert.ok(codexCliBridgeDryRunJson.auditBaselineRunGate.reviewRequiredCount >= 1);
    assert.equal(codexCliBridgeDryRunJson.commandEnvelope.targetBaselineAuditGate.health, "missing");
    assert.equal(codexCliBridgeDryRunJson.commandEnvelope.auditBaselineRunGate.decision, "review");
    assert.ok(codexCliBridgeDryRunJson.reasons.some((reason) => reason.code === "cli-bridge-target-baseline-audit-gate"));
    assert.ok(codexCliBridgeDryRunJson.reasons.some((reason) => reason.code === "cli-bridge-audit-baseline-run-gate"));
    assert.match(codexCliBridgeDryRunJson.commandEnvelope.displayCommand, /codex exec/);
    assert.match(codexCliBridgeDryRunJson.commandEnvelope.prompt, /Profile target task baseline:/);
    assert.match(codexCliBridgeDryRunJson.commandEnvelope.prompt, /Selected run Regression Alert baseline capture: missing/);
    assert.match(codexCliBridgeDryRunJson.commandEnvelope.prompt, /Scope mode: project/);
    assert.match(codexCliBridgeDryRunJson.commandEnvelope.prompt, /Execution audit snapshot baseline runs:/);
    assert.match(codexCliBridgeDryRunJson.commandEnvelope.prompt, /Target baseline audit gate: review/);
    assert.match(codexCliBridgeDryRunJson.commandEnvelope.prompt, /Audit baseline run gate: review/);
    assert.match(codexCliBridgeDryRunJson.markdown, /# CLI Bridge Runner Dry Run/);
    assert.match(codexCliBridgeDryRunJson.markdown, /## Target Baseline Audit Gate/);
    assert.match(codexCliBridgeDryRunJson.markdown, /## Audit Baseline Run Gate/);
    assert.match(codexCliBridgeDryRunJson.markdown, /Do not use or request secrets/);

    const initialCliBridgeDryRunSnapshotsResponse = await fetch(`${baseUrl}/api/cli-bridge/runner-dry-run-snapshots`);
    assert.equal(initialCliBridgeDryRunSnapshotsResponse.status, 200);
    const initialCliBridgeDryRunSnapshotsJson = await initialCliBridgeDryRunSnapshotsResponse.json();
    assert.deepEqual(initialCliBridgeDryRunSnapshotsJson, []);

    const initialCliBridgeDryRunSnapshotDiffResponse = await fetch(`${baseUrl}/api/cli-bridge/runner-dry-run-snapshots/diff`);
    assert.equal(initialCliBridgeDryRunSnapshotDiffResponse.status, 200);
    const initialCliBridgeDryRunSnapshotDiffJson = await initialCliBridgeDryRunSnapshotDiffResponse.json();
    assert.equal(initialCliBridgeDryRunSnapshotDiffJson.status, "missing-snapshot");
    assert.match(initialCliBridgeDryRunSnapshotDiffJson.markdown, /dry-run snapshot/i);

    const unscopedCliBridgeDryRunSnapshotResponse = await fetch(`${baseUrl}/api/cli-bridge/runner-dry-run-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture unscoped Codex dry-run snapshot",
        runner: "codex",
        runId: createAgentWorkOrderRunJson.run.id,
        limit: 12
      })
    });
    assert.equal(unscopedCliBridgeDryRunSnapshotResponse.status, 409);
    const unscopedCliBridgeDryRunSnapshotJson = await unscopedCliBridgeDryRunSnapshotResponse.json();
    assert.equal(unscopedCliBridgeDryRunSnapshotJson.reasonCode, "agent-execution-scope-required");

    const invalidScopeCliBridgeDryRunSnapshotResponse = await fetch(`${baseUrl}/api/cli-bridge/runner-dry-run-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture invalid-scope Codex dry-run snapshot",
        runner: "codex",
        runId: createAgentWorkOrderRunJson.run.id,
        limit: 12,
        activeProjectId: "beta-app",
        scopeMode: "project"
      })
    });
    assert.equal(invalidScopeCliBridgeDryRunSnapshotResponse.status, 409);
    const invalidScopeCliBridgeDryRunSnapshotJson = await invalidScopeCliBridgeDryRunSnapshotResponse.json();
    assert.equal(invalidScopeCliBridgeDryRunSnapshotJson.reasonCode, "agent-execution-scope-required");
    assert.equal(invalidScopeCliBridgeDryRunSnapshotJson.scopeContext.guardDecision, "project-required");

    const createCliBridgeDryRunSnapshotResponse = await fetch(`${baseUrl}/api/cli-bridge/runner-dry-run-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Codex dry-run snapshot",
        runner: "codex",
        runId: createAgentWorkOrderRunJson.run.id,
        limit: 12,
        ...cliBridgeRunnerDryRunScopePayload
      })
    });
    assert.equal(createCliBridgeDryRunSnapshotResponse.status, 200);
    const createCliBridgeDryRunSnapshotJson = await createCliBridgeDryRunSnapshotResponse.json();
    assert.equal(createCliBridgeDryRunSnapshotJson.success, true);
    assert.equal(createCliBridgeDryRunSnapshotJson.snapshot.runner, "codex");
    assert.equal(createCliBridgeDryRunSnapshotJson.snapshot.scopeMode, "project");
    assert.equal(createCliBridgeDryRunSnapshotJson.snapshot.activeProjectId, "alpha-app");
    assert.equal(createCliBridgeDryRunSnapshotJson.snapshot.scopeReady, true);
    assert.equal(createCliBridgeDryRunSnapshotJson.snapshot.selectedWorkOrderId, createAgentWorkOrderRunJson.run.id);
    assert.equal(createCliBridgeDryRunSnapshotJson.snapshot.dryRunDecision, codexCliBridgeDryRunJson.dryRunDecision);
    assert.equal(createCliBridgeDryRunSnapshotJson.snapshot.targetBaselineAuditGateDecision, "review");
    assert.equal(createCliBridgeDryRunSnapshotJson.snapshot.auditBaselineRunGateDecision, "review");
    assert.ok(createCliBridgeDryRunSnapshotJson.snapshot.reasonCodes.includes("cli-bridge-target-baseline-audit-gate"));
    assert.ok(createCliBridgeDryRunSnapshotJson.snapshot.reasonCodes.includes("cli-bridge-audit-baseline-run-gate"));
    assert.match(createCliBridgeDryRunSnapshotJson.snapshot.markdown, /# CLI Bridge Runner Dry Run/);
    assert.match(createCliBridgeDryRunSnapshotJson.snapshot.dryRun.markdown, /## Audit Baseline Run Gate/);

    const cliBridgeDryRunSnapshotsResponse = await fetch(`${baseUrl}/api/cli-bridge/runner-dry-run-snapshots`);
    assert.equal(cliBridgeDryRunSnapshotsResponse.status, 200);
    const cliBridgeDryRunSnapshotsJson = await cliBridgeDryRunSnapshotsResponse.json();
    assert.equal(cliBridgeDryRunSnapshotsJson.length, 1);
    assert.equal(cliBridgeDryRunSnapshotsJson[0].id, createCliBridgeDryRunSnapshotJson.snapshot.id);

    const cliBridgeDryRunSnapshotDiffResponse = await fetch(`${baseUrl}/api/cli-bridge/runner-dry-run-snapshots/diff?snapshotId=${createCliBridgeDryRunSnapshotJson.snapshot.id}&${cliBridgeRunnerDryRunScopeParams}`);
    assert.equal(cliBridgeDryRunSnapshotDiffResponse.status, 200);
    const cliBridgeDryRunSnapshotDiffJson = await cliBridgeDryRunSnapshotDiffResponse.json();
    assert.equal(cliBridgeDryRunSnapshotDiffJson.status, "ready");
    assert.equal(cliBridgeDryRunSnapshotDiffJson.snapshotId, createCliBridgeDryRunSnapshotJson.snapshot.id);
    assert.equal(cliBridgeDryRunSnapshotDiffJson.runner, "codex");
    assert.equal(cliBridgeDryRunSnapshotDiffJson.snapshotSummary.selectedWorkOrderId, createAgentWorkOrderRunJson.run.id);
    assert.equal(cliBridgeDryRunSnapshotDiffJson.liveSummary.selectedWorkOrderId, createAgentWorkOrderRunJson.run.id);
    assert.equal(cliBridgeDryRunSnapshotDiffJson.liveSummary.scopeGuardDecision, "project-ready");
    assert.ok(Array.isArray(cliBridgeDryRunSnapshotDiffJson.driftItems));
    assert.match(cliBridgeDryRunSnapshotDiffJson.secretPolicy, /dry-run snapshot drift/);
    assert.match(cliBridgeDryRunSnapshotDiffJson.recommendedAction, /dry-run drift|No live CLI Bridge runner dry-run drift/);
    assert.match(cliBridgeDryRunSnapshotDiffJson.markdown, /CLI Bridge Runner Dry-Run Snapshot Drift/);

    const cliBridgeDryRunSnapshotBaselineStatusResponse = await fetch(`${baseUrl}/api/cli-bridge/runner-dry-run-snapshots/baseline-status?${cliBridgeRunnerDryRunScopeParams}`);
    assert.equal(cliBridgeDryRunSnapshotBaselineStatusResponse.status, 200);
    const cliBridgeDryRunSnapshotBaselineStatusJson = await cliBridgeDryRunSnapshotBaselineStatusResponse.json();
    assert.equal(cliBridgeDryRunSnapshotBaselineStatusJson.hasBaseline, true);
    assert.equal(cliBridgeDryRunSnapshotBaselineStatusJson.baselineSnapshotId, createCliBridgeDryRunSnapshotJson.snapshot.id);
    assert.equal(cliBridgeDryRunSnapshotBaselineStatusJson.snapshotId, createCliBridgeDryRunSnapshotJson.snapshot.id);
    assert.equal(cliBridgeDryRunSnapshotBaselineStatusJson.runner, "codex");
    assert.equal(cliBridgeDryRunSnapshotBaselineStatusJson.selectedWorkOrderId, createAgentWorkOrderRunJson.run.id);
    assert.equal(cliBridgeDryRunSnapshotBaselineStatusJson.scopeGuardDecision, "project-ready");
    assert.equal(cliBridgeDryRunSnapshotBaselineStatusJson.freshness, "fresh");
    assert.ok(["healthy", "changed", "drifted", "stale"].includes(cliBridgeDryRunSnapshotBaselineStatusJson.health));
    assert.ok(Number.isFinite(cliBridgeDryRunSnapshotBaselineStatusJson.driftScore));
    assert.match(cliBridgeDryRunSnapshotBaselineStatusJson.markdown, /# CLI Bridge Runner Dry-Run Baseline Status/);

    const cliBridgeDryRunSnapshotLifecycleLedgerResponse = await fetch(`${baseUrl}/api/cli-bridge/runner-dry-run-snapshots/lifecycle-ledger?runner=all`);
    assert.equal(cliBridgeDryRunSnapshotLifecycleLedgerResponse.status, 200);
    const cliBridgeDryRunSnapshotLifecycleLedgerJson = await cliBridgeDryRunSnapshotLifecycleLedgerResponse.json();
    assert.equal(cliBridgeDryRunSnapshotLifecycleLedgerJson.summary.total, 1);
    assert.equal(cliBridgeDryRunSnapshotLifecycleLedgerJson.summary.visible, 1);
    assert.equal(cliBridgeDryRunSnapshotLifecycleLedgerJson.summary.codex, 1);
    assert.equal(cliBridgeDryRunSnapshotLifecycleLedgerJson.summary.claude, 0);
    assert.equal(cliBridgeDryRunSnapshotLifecycleLedgerJson.items[0].snapshotId, createCliBridgeDryRunSnapshotJson.snapshot.id);
    assert.equal(cliBridgeDryRunSnapshotLifecycleLedgerJson.items[0].runner, "codex");
    assert.match(cliBridgeDryRunSnapshotLifecycleLedgerJson.items[0].lifecycleAction, /snapshot-saved|accepted-drift-baseline/);
    assert.match(cliBridgeDryRunSnapshotLifecycleLedgerJson.markdown, /dry-run baseline lifecycle ledger/i);

    const claudeCliBridgeDryRunResponse = await fetch(`${baseUrl}/api/cli-bridge/runner-dry-run?runner=claude&runId=${createAgentWorkOrderRunJson.run.id}&${cliBridgeRunnerDryRunScopeParams}`);
    assert.equal(claudeCliBridgeDryRunResponse.status, 200);
    const claudeCliBridgeDryRunJson = await claudeCliBridgeDryRunResponse.json();
    assert.equal(claudeCliBridgeDryRunJson.runner, "claude");
    assert.equal(claudeCliBridgeDryRunJson.commandEnvelope.adapterId, "claude");
    assert.equal(claudeCliBridgeDryRunJson.targetBaselineAuditGate.health, "missing");
    assert.equal(claudeCliBridgeDryRunJson.auditBaselineRunGate.decision, "review");
    assert.match(claudeCliBridgeDryRunJson.commandEnvelope.displayCommand, /claude -p/);
    assert.match(claudeCliBridgeDryRunJson.expectedOutputSchema.handoffRecommendation, /codex/);

    const updateAgentWorkOrderRunResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/${createAgentWorkOrderRunJson.run.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "running",
        notes: "Fixture run started.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(updateAgentWorkOrderRunResponse.status, 200);
    const updateAgentWorkOrderRunJson = await updateAgentWorkOrderRunResponse.json();
    assert.equal(updateAgentWorkOrderRunJson.success, true);
    assert.equal(updateAgentWorkOrderRunJson.run.status, "running");
    assert.equal(updateAgentWorkOrderRunJson.run.history.length, 2);
    assert.equal(updateAgentWorkOrderRunJson.run.history[0].previousStatus, "queued");
    assert.equal(updateAgentWorkOrderRunJson.run.history[0].status, "running");

    const agentWorkOrderRunsResponse = await fetch(`${baseUrl}/api/agent-work-order-runs?projectId=alpha-app`);
    assert.equal(agentWorkOrderRunsResponse.status, 200);
    const agentWorkOrderRunsJson = await agentWorkOrderRunsResponse.json();
    assert.equal(agentWorkOrderRunsJson.length, 2);
    assert.equal(agentWorkOrderRunsJson[0].projectId, "alpha-app");

    const governanceAfterWorkOrderRunResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterWorkOrderRunResponse.status, 200);
    const governanceAfterWorkOrderRunJson = await governanceAfterWorkOrderRunResponse.json();
    assert.equal(governanceAfterWorkOrderRunJson.summary.agentWorkOrderRunCount, 2);
    assert.equal(governanceAfterWorkOrderRunJson.summary.activeAgentWorkOrderRunCount, 2);
    assert.equal(governanceAfterWorkOrderRunJson.summary.blockedAgentWorkOrderRunCount, 0);
    assert.equal(governanceAfterWorkOrderRunJson.summary.staleAgentWorkOrderRunCount, 0);
    assert.equal(governanceAfterWorkOrderRunJson.summary.agentExecutionTargetBaselineMissingCount, 2);
    assert.equal(governanceAfterWorkOrderRunJson.summary.agentExecutionTargetBaselineReviewRequiredCount, 2);
    assert.equal(governanceAfterWorkOrderRunJson.summary.agentExecutionTargetBaselineUncheckpointedDriftItemCount, 0);
    assert.equal(governanceAfterWorkOrderRunJson.summary.cliBridgeRunnerDryRunSnapshotCount, 1);
    assert.equal(governanceAfterWorkOrderRunJson.cliBridgeRunnerDryRunSnapshots.length, 1);
    assert.equal(governanceAfterWorkOrderRunJson.cliBridgeRunnerDryRunSnapshots[0].selectedWorkOrderId, createAgentWorkOrderRunJson.run.id);
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.total, 2);
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.active, 2);
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.statusCounts.queued, 1);
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.statusCounts.running, 1);
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.statusCounts.blocked, 0);
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.targetBaselineMissing, 2);
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.targetBaselineReviewRequired, 2);
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.auditBaselineCaptured, 2);
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.auditBaselineMissing, 2);
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.auditBaselineReviewRequired, 2);
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.alertBaselineCaptured, 2);
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.alertBaselineMissing, 2);
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.alertBaselineReviewRequired, 2);
    assert.equal(governanceAfterWorkOrderRunJson.summary.agentExecutionTargetBaselineAuditBaselineMissingCount, 2);
    assert.equal(governanceAfterWorkOrderRunJson.summary.agentExecutionTargetBaselineAuditBaselineReviewRequiredCount, 2);
    assert.equal(governanceAfterWorkOrderRunJson.summary.agentExecutionRegressionAlertBaselineMissingCount, 2);
    assert.equal(governanceAfterWorkOrderRunJson.summary.agentExecutionRegressionAlertBaselineReviewRequiredCount, 2);
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.latestEventStatus, "running");
    assert.equal(governanceAfterWorkOrderRunJson.agentWorkOrderRuns.length, 2);
    const governanceOperationTypes = governanceAfterWorkOrderRunJson.operationLog.map((operation) => operation.type);
    assert.ok(governanceOperationTypes.includes("agent-work-order-runs-batch-queued"));
    assert.ok(governanceOperationTypes.includes("agent-work-order-run-created"));
    assert.ok(governanceOperationTypes.includes("agent-work-order-run-status-updated"));
    assert.ok(governanceOperationTypes.includes("agent-policy-checkpoint-recorded"));
    assert.ok(governanceOperationTypes.includes("cli-bridge-runner-dry-run-snapshot-created"));

    const refreshBatchRunTargetBaselineResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/${batchAgentWorkOrderRunsJson.queuedRuns[0].id}/target-baseline-refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notes: "Fixture target baseline recapture.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(refreshBatchRunTargetBaselineResponse.status, 200);
    const refreshBatchRunTargetBaselineJson = await refreshBatchRunTargetBaselineResponse.json();
    assert.equal(refreshBatchRunTargetBaselineJson.success, true);
    assert.equal(refreshBatchRunTargetBaselineJson.run.id, batchAgentWorkOrderRunsJson.queuedRuns[0].id);
    assert.equal(refreshBatchRunTargetBaselineJson.run.profileTargetTaskLedgerBaselineHealth, "missing");
    assert.equal(refreshBatchRunTargetBaselineJson.run.history[0].note, "Fixture target baseline recapture.");

    const governanceAfterTargetBaselineRefreshResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterTargetBaselineRefreshResponse.status, 200);
    const governanceAfterTargetBaselineRefreshJson = await governanceAfterTargetBaselineRefreshResponse.json();
    assert.equal(governanceAfterTargetBaselineRefreshJson.summary.agentExecutionTargetBaselineMissingCount, 2);
    assert.ok(governanceAfterTargetBaselineRefreshJson.operationLog.some((operation) => operation.type === "agent-work-order-run-target-baseline-refreshed"));

    const targetBaselineAuditLedgerResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/target-baseline-audit-ledger?state=review&limit=5`);
    assert.equal(targetBaselineAuditLedgerResponse.status, 200);
    const targetBaselineAuditLedgerJson = await targetBaselineAuditLedgerResponse.json();
    assert.equal(targetBaselineAuditLedgerJson.state, "review");
    assert.equal(targetBaselineAuditLedgerJson.total, 2);
    assert.equal(targetBaselineAuditLedgerJson.summary.review, 2);
    assert.equal(targetBaselineAuditLedgerJson.summary.missing, 2);
    assert.match(targetBaselineAuditLedgerJson.markdown, /# Agent Execution Target Baseline Audit Ledger/);
    assert.match(targetBaselineAuditLedgerJson.markdown, /Secret policy/);

    const regressionAlertBaselineLedgerResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/regression-alert-baseline-ledger?state=review&limit=5`);
    assert.equal(regressionAlertBaselineLedgerResponse.status, 200);
    const regressionAlertBaselineLedgerJson = await regressionAlertBaselineLedgerResponse.json();
    assert.equal(regressionAlertBaselineLedgerJson.state, "review");
    assert.equal(regressionAlertBaselineLedgerJson.total, 2);
    assert.equal(regressionAlertBaselineLedgerJson.summary.review, 2);
    assert.equal(regressionAlertBaselineLedgerJson.summary.missing, 2);
    assert.equal(regressionAlertBaselineLedgerJson.summary.hold, 0);
    assert.match(regressionAlertBaselineLedgerJson.markdown, /# Agent Execution Regression Alert Baseline Ledger/);
    assert.match(regressionAlertBaselineLedgerJson.markdown, /Regression Alert baseline/);
    assert.match(regressionAlertBaselineLedgerJson.markdown, /Secret policy/);

    const initialRegressionAlertBaselineLedgerSnapshotsResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/regression-alert-baseline-ledger-snapshots`);
    assert.equal(initialRegressionAlertBaselineLedgerSnapshotsResponse.status, 200);
    const initialRegressionAlertBaselineLedgerSnapshotsJson = await initialRegressionAlertBaselineLedgerSnapshotsResponse.json();
    assert.equal(initialRegressionAlertBaselineLedgerSnapshotsJson.length, 0);

    const unscopedRegressionAlertBaselineLedgerSnapshotResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/regression-alert-baseline-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Regression Alert Baseline Ledger",
        state: "review",
        limit: 5
      })
    });
    assert.equal(unscopedRegressionAlertBaselineLedgerSnapshotResponse.status, 409);
    const unscopedRegressionAlertBaselineLedgerSnapshotJson = await unscopedRegressionAlertBaselineLedgerSnapshotResponse.json();
    assert.equal(unscopedRegressionAlertBaselineLedgerSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createRegressionAlertBaselineLedgerSnapshotResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/regression-alert-baseline-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Regression Alert Baseline Ledger",
        state: "review",
        limit: 5,
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(createRegressionAlertBaselineLedgerSnapshotResponse.status, 200);
    const createRegressionAlertBaselineLedgerSnapshotJson = await createRegressionAlertBaselineLedgerSnapshotResponse.json();
    assert.equal(createRegressionAlertBaselineLedgerSnapshotJson.success, true);
    assert.equal(createRegressionAlertBaselineLedgerSnapshotJson.snapshot.title, "Fixture Regression Alert Baseline Ledger");
    assert.equal(createRegressionAlertBaselineLedgerSnapshotJson.snapshot.total, 2);
    assert.equal(createRegressionAlertBaselineLedgerSnapshotJson.snapshot.reviewCount, 2);
    assert.equal(createRegressionAlertBaselineLedgerSnapshotJson.snapshot.missingCount, 2);
    assert.match(createRegressionAlertBaselineLedgerSnapshotJson.snapshot.markdown, /# Agent Execution Regression Alert Baseline Ledger/);

    const regressionAlertBaselineLedgerSnapshotsResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/regression-alert-baseline-ledger-snapshots`);
    assert.equal(regressionAlertBaselineLedgerSnapshotsResponse.status, 200);
    const regressionAlertBaselineLedgerSnapshotsJson = await regressionAlertBaselineLedgerSnapshotsResponse.json();
    assert.equal(regressionAlertBaselineLedgerSnapshotsJson.length, 1);

    const regressionAlertBaselineLedgerSnapshotDriftResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/regression-alert-baseline-ledger-snapshots/${createRegressionAlertBaselineLedgerSnapshotJson.snapshot.id}/drift`);
    assert.equal(regressionAlertBaselineLedgerSnapshotDriftResponse.status, 200);
    const regressionAlertBaselineLedgerSnapshotDriftJson = await regressionAlertBaselineLedgerSnapshotDriftResponse.json();
    assert.equal(regressionAlertBaselineLedgerSnapshotDriftJson.hasDrift, false);
    assert.equal(regressionAlertBaselineLedgerSnapshotDriftJson.driftScore, 0);
    assert.match(regressionAlertBaselineLedgerSnapshotDriftJson.markdown, /# Agent Execution Regression Alert Baseline Ledger Snapshot Drift/);
    assert.match(regressionAlertBaselineLedgerSnapshotDriftJson.markdown, /No Regression Alert baseline ledger drift detected/);

    const unscopedRegressionAlertBaselineLedgerDriftCheckpointResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/regression-alert-baseline-ledger-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createRegressionAlertBaselineLedgerSnapshotJson.snapshot.id,
        field: "snapshot-clean",
        decision: "confirmed",
        note: "Fixture checkpoint for clean regression alert baseline drift."
      })
    });
    assert.equal(unscopedRegressionAlertBaselineLedgerDriftCheckpointResponse.status, 409);
    const unscopedRegressionAlertBaselineLedgerDriftCheckpointJson = await unscopedRegressionAlertBaselineLedgerDriftCheckpointResponse.json();
    assert.equal(unscopedRegressionAlertBaselineLedgerDriftCheckpointJson.reasonCode, "agent-execution-scope-required");

    const regressionAlertBaselineLedgerDriftCheckpointResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/regression-alert-baseline-ledger-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createRegressionAlertBaselineLedgerSnapshotJson.snapshot.id,
        field: "snapshot-clean",
        decision: "confirmed",
        note: "Fixture checkpoint for clean regression alert baseline drift.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(regressionAlertBaselineLedgerDriftCheckpointResponse.status, 200);
    const regressionAlertBaselineLedgerDriftCheckpointJson = await regressionAlertBaselineLedgerDriftCheckpointResponse.json();
    assert.equal(regressionAlertBaselineLedgerDriftCheckpointJson.success, true);
    assert.equal(regressionAlertBaselineLedgerDriftCheckpointJson.decision, "confirmed");
    assert.equal(regressionAlertBaselineLedgerDriftCheckpointJson.field, "snapshot-clean");
    assert.equal(regressionAlertBaselineLedgerDriftCheckpointJson.task.sourceType, "agent-execution-regression-alert-baseline-ledger-snapshot-drift-checkpoint");
    assert.equal(regressionAlertBaselineLedgerDriftCheckpointJson.ledger.summary.total, 1);
    assert.equal(regressionAlertBaselineLedgerDriftCheckpointJson.ledger.summary.confirmed, 1);

    const regressionAlertBaselineLedgerDriftCheckpointLedgerResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/regression-alert-baseline-ledger-drift-checkpoints?status=all&limit=5`);
    assert.equal(regressionAlertBaselineLedgerDriftCheckpointLedgerResponse.status, 200);
    const regressionAlertBaselineLedgerDriftCheckpointLedgerJson = await regressionAlertBaselineLedgerDriftCheckpointLedgerResponse.json();
    assert.equal(regressionAlertBaselineLedgerDriftCheckpointLedgerJson.summary.total, 1);
    assert.match(regressionAlertBaselineLedgerDriftCheckpointLedgerJson.markdown, /# Agent Execution Regression Alert Baseline Ledger Drift Checkpoints/);

    const regressionAlertBaselineLedgerBaselineStatusResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/regression-alert-baseline-ledger-baseline-status`);
    assert.equal(regressionAlertBaselineLedgerBaselineStatusResponse.status, 200);
    const regressionAlertBaselineLedgerBaselineStatusJson = await regressionAlertBaselineLedgerBaselineStatusResponse.json();
    assert.equal(regressionAlertBaselineLedgerBaselineStatusJson.hasBaseline, true);
    assert.equal(regressionAlertBaselineLedgerBaselineStatusJson.snapshotId, createRegressionAlertBaselineLedgerSnapshotJson.snapshot.id);
    assert.ok(["healthy", "stale", "drifted", "drift-review-required"].includes(regressionAlertBaselineLedgerBaselineStatusJson.health));
    assert.equal(regressionAlertBaselineLedgerBaselineStatusJson.driftScore, 0);
    assert.equal(regressionAlertBaselineLedgerBaselineStatusJson.uncheckpointedDriftItemCount, 0);
    assert.match(regressionAlertBaselineLedgerBaselineStatusJson.markdown, /# Agent Execution Regression Alert Baseline Ledger Baseline Status/);

    const governanceAfterRegressionAlertBaselineSnapshotResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterRegressionAlertBaselineSnapshotResponse.status, 200);
    const governanceAfterRegressionAlertBaselineSnapshotJson = await governanceAfterRegressionAlertBaselineSnapshotResponse.json();
    assert.equal(governanceAfterRegressionAlertBaselineSnapshotJson.summary.agentExecutionRegressionAlertBaselineLedgerSnapshotCount, 1);
    assert.equal(governanceAfterRegressionAlertBaselineSnapshotJson.summary.agentExecutionRegressionAlertBaselineLedgerDriftCheckpointCount, 1);
    assert.equal(governanceAfterRegressionAlertBaselineSnapshotJson.summary.agentExecutionRegressionAlertBaselineLedgerBaselineDriftScore, 0);
    assert.equal(governanceAfterRegressionAlertBaselineSnapshotJson.agentExecutionRegressionAlertBaselineLedgerSnapshots.length, 1);
    assert.equal(governanceAfterRegressionAlertBaselineSnapshotJson.agentExecutionRegressionAlertBaselineLedgerDriftCheckpointLedger.summary.confirmed, 1);
    assert.equal(governanceAfterRegressionAlertBaselineSnapshotJson.agentExecutionRegressionAlertBaselineLedgerBaselineStatus.hasBaseline, true);

    const unscopedRefreshRegressionAlertBaselineLedgerSnapshotResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/regression-alert-baseline-ledger-snapshots/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createRegressionAlertBaselineLedgerSnapshotJson.snapshot.id,
        title: "Fixture Refreshed Regression Alert Baseline Ledger"
      })
    });
    assert.equal(unscopedRefreshRegressionAlertBaselineLedgerSnapshotResponse.status, 409);
    const unscopedRefreshRegressionAlertBaselineLedgerSnapshotJson = await unscopedRefreshRegressionAlertBaselineLedgerSnapshotResponse.json();
    assert.equal(unscopedRefreshRegressionAlertBaselineLedgerSnapshotJson.reasonCode, "agent-execution-scope-required");

    const refreshRegressionAlertBaselineLedgerSnapshotResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/regression-alert-baseline-ledger-snapshots/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createRegressionAlertBaselineLedgerSnapshotJson.snapshot.id,
        title: "Fixture Refreshed Regression Alert Baseline Ledger",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(refreshRegressionAlertBaselineLedgerSnapshotResponse.status, 200);
    const refreshRegressionAlertBaselineLedgerSnapshotJson = await refreshRegressionAlertBaselineLedgerSnapshotResponse.json();
    assert.equal(refreshRegressionAlertBaselineLedgerSnapshotJson.success, true);
    assert.equal(refreshRegressionAlertBaselineLedgerSnapshotJson.previousSnapshotId, createRegressionAlertBaselineLedgerSnapshotJson.snapshot.id);
    assert.equal(refreshRegressionAlertBaselineLedgerSnapshotJson.snapshot.title, "Fixture Refreshed Regression Alert Baseline Ledger");
    assert.equal(refreshRegressionAlertBaselineLedgerSnapshotJson.snapshot.total, 2);
    assert.equal(refreshRegressionAlertBaselineLedgerSnapshotJson.agentExecutionRegressionAlertBaselineLedgerSnapshots.length, 2);

    const initialTargetBaselineAuditLedgerSnapshotsResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/target-baseline-audit-ledger-snapshots`);
    assert.equal(initialTargetBaselineAuditLedgerSnapshotsResponse.status, 200);
    const initialTargetBaselineAuditLedgerSnapshotsJson = await initialTargetBaselineAuditLedgerSnapshotsResponse.json();
    assert.equal(initialTargetBaselineAuditLedgerSnapshotsJson.length, 0);

    const unscopedTargetBaselineAuditLedgerSnapshotResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/target-baseline-audit-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Target Baseline Audit Ledger",
        state: "review",
        limit: 5
      })
    });
    assert.equal(unscopedTargetBaselineAuditLedgerSnapshotResponse.status, 409);
    const unscopedTargetBaselineAuditLedgerSnapshotJson = await unscopedTargetBaselineAuditLedgerSnapshotResponse.json();
    assert.equal(unscopedTargetBaselineAuditLedgerSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createTargetBaselineAuditLedgerSnapshotResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/target-baseline-audit-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Target Baseline Audit Ledger",
        state: "review",
        limit: 5,
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(createTargetBaselineAuditLedgerSnapshotResponse.status, 200);
    const createTargetBaselineAuditLedgerSnapshotJson = await createTargetBaselineAuditLedgerSnapshotResponse.json();
    assert.equal(createTargetBaselineAuditLedgerSnapshotJson.success, true);
    assert.equal(createTargetBaselineAuditLedgerSnapshotJson.snapshot.title, "Fixture Target Baseline Audit Ledger");
    assert.equal(createTargetBaselineAuditLedgerSnapshotJson.snapshot.stateFilter, "review");
    assert.equal(createTargetBaselineAuditLedgerSnapshotJson.snapshot.total, 2);
    assert.equal(createTargetBaselineAuditLedgerSnapshotJson.snapshot.reviewCount, 2);
    assert.equal(createTargetBaselineAuditLedgerSnapshotJson.snapshot.missingCount, 2);
    assert.match(createTargetBaselineAuditLedgerSnapshotJson.snapshot.markdown, /# Agent Execution Target Baseline Audit Ledger/);

    const targetBaselineAuditLedgerSnapshotsResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/target-baseline-audit-ledger-snapshots`);
    assert.equal(targetBaselineAuditLedgerSnapshotsResponse.status, 200);
    const targetBaselineAuditLedgerSnapshotsJson = await targetBaselineAuditLedgerSnapshotsResponse.json();
    assert.equal(targetBaselineAuditLedgerSnapshotsJson.length, 1);
    assert.equal(targetBaselineAuditLedgerSnapshotsJson[0].title, "Fixture Target Baseline Audit Ledger");

    const targetBaselineAuditLedgerSnapshotDriftResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/target-baseline-audit-ledger-snapshots/${createTargetBaselineAuditLedgerSnapshotJson.snapshot.id}/drift`);
    assert.equal(targetBaselineAuditLedgerSnapshotDriftResponse.status, 200);
    const targetBaselineAuditLedgerSnapshotDriftJson = await targetBaselineAuditLedgerSnapshotDriftResponse.json();
    assert.equal(targetBaselineAuditLedgerSnapshotDriftJson.snapshotId, createTargetBaselineAuditLedgerSnapshotJson.snapshot.id);
    assert.equal(targetBaselineAuditLedgerSnapshotDriftJson.hasDrift, false);
    assert.equal(targetBaselineAuditLedgerSnapshotDriftJson.driftSeverity, "none");
    assert.match(targetBaselineAuditLedgerSnapshotDriftJson.markdown, /# Agent Execution Target Baseline Audit Ledger Snapshot Drift/);

    const unscopedTargetBaselineAuditLedgerDriftCheckpointResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/target-baseline-audit-ledger-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createTargetBaselineAuditLedgerSnapshotJson.snapshot.id,
        field: "snapshot-clean",
        decision: "confirmed",
        note: "Fixture checkpoint for clean target baseline audit drift."
      })
    });
    assert.equal(unscopedTargetBaselineAuditLedgerDriftCheckpointResponse.status, 409);
    const unscopedTargetBaselineAuditLedgerDriftCheckpointJson = await unscopedTargetBaselineAuditLedgerDriftCheckpointResponse.json();
    assert.equal(unscopedTargetBaselineAuditLedgerDriftCheckpointJson.reasonCode, "agent-execution-scope-required");

    const targetBaselineAuditLedgerDriftCheckpointResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/target-baseline-audit-ledger-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createTargetBaselineAuditLedgerSnapshotJson.snapshot.id,
        field: "snapshot-clean",
        decision: "confirmed",
        note: "Fixture checkpoint for clean target baseline audit drift.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(targetBaselineAuditLedgerDriftCheckpointResponse.status, 200);
    const targetBaselineAuditLedgerDriftCheckpointJson = await targetBaselineAuditLedgerDriftCheckpointResponse.json();
    assert.equal(targetBaselineAuditLedgerDriftCheckpointJson.success, true);
    assert.equal(targetBaselineAuditLedgerDriftCheckpointJson.decision, "confirmed");
    assert.equal(targetBaselineAuditLedgerDriftCheckpointJson.field, "snapshot-clean");
    assert.equal(targetBaselineAuditLedgerDriftCheckpointJson.ledger.summary.total, 1);
    assert.equal(targetBaselineAuditLedgerDriftCheckpointJson.ledger.summary.confirmed, 1);

    const targetBaselineAuditLedgerDriftCheckpointLedgerResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/target-baseline-audit-ledger-drift-checkpoints?status=all&limit=5`);
    assert.equal(targetBaselineAuditLedgerDriftCheckpointLedgerResponse.status, 200);
    const targetBaselineAuditLedgerDriftCheckpointLedgerJson = await targetBaselineAuditLedgerDriftCheckpointLedgerResponse.json();
    assert.equal(targetBaselineAuditLedgerDriftCheckpointLedgerJson.summary.total, 1);
    assert.match(targetBaselineAuditLedgerDriftCheckpointLedgerJson.markdown, /# Agent Execution Target Baseline Audit Ledger Drift Checkpoints/);

    const governanceAfterTargetBaselineAuditSnapshotResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterTargetBaselineAuditSnapshotResponse.status, 200);
    const governanceAfterTargetBaselineAuditSnapshotJson = await governanceAfterTargetBaselineAuditSnapshotResponse.json();
    assert.equal(governanceAfterTargetBaselineAuditSnapshotJson.summary.agentExecutionTargetBaselineAuditLedgerSnapshotCount, 1);
    assert.equal(governanceAfterTargetBaselineAuditSnapshotJson.summary.agentExecutionTargetBaselineAuditLedgerDriftCheckpointCount, 1);
    assert.equal(governanceAfterTargetBaselineAuditSnapshotJson.agentExecutionTargetBaselineAuditLedgerSnapshots.length, 1);
    assert.equal(governanceAfterTargetBaselineAuditSnapshotJson.agentExecutionTargetBaselineAuditLedgerDriftCheckpointLedger.summary.confirmed, 1);

    const unscopedRefreshTargetBaselineAuditLedgerSnapshotResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/target-baseline-audit-ledger-snapshots/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createTargetBaselineAuditLedgerSnapshotJson.snapshot.id,
        title: "Fixture Refreshed Target Baseline Audit Ledger"
      })
    });
    assert.equal(unscopedRefreshTargetBaselineAuditLedgerSnapshotResponse.status, 409);
    const unscopedRefreshTargetBaselineAuditLedgerSnapshotJson = await unscopedRefreshTargetBaselineAuditLedgerSnapshotResponse.json();
    assert.equal(unscopedRefreshTargetBaselineAuditLedgerSnapshotJson.reasonCode, "agent-execution-scope-required");

    const refreshTargetBaselineAuditLedgerSnapshotResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/target-baseline-audit-ledger-snapshots/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createTargetBaselineAuditLedgerSnapshotJson.snapshot.id,
        title: "Fixture Refreshed Target Baseline Audit Ledger",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(refreshTargetBaselineAuditLedgerSnapshotResponse.status, 200);
    const refreshTargetBaselineAuditLedgerSnapshotJson = await refreshTargetBaselineAuditLedgerSnapshotResponse.json();
    assert.equal(refreshTargetBaselineAuditLedgerSnapshotJson.success, true);
    assert.equal(refreshTargetBaselineAuditLedgerSnapshotJson.previousSnapshotId, createTargetBaselineAuditLedgerSnapshotJson.snapshot.id);
    assert.equal(refreshTargetBaselineAuditLedgerSnapshotJson.snapshot.title, "Fixture Refreshed Target Baseline Audit Ledger");
    assert.equal(refreshTargetBaselineAuditLedgerSnapshotJson.snapshot.stateFilter, "review");
    assert.equal(refreshTargetBaselineAuditLedgerSnapshotJson.snapshot.total, 2);

    const governanceAfterTargetBaselineAuditSnapshotRefreshResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterTargetBaselineAuditSnapshotRefreshResponse.status, 200);
    const governanceAfterTargetBaselineAuditSnapshotRefreshJson = await governanceAfterTargetBaselineAuditSnapshotRefreshResponse.json();
    assert.equal(governanceAfterTargetBaselineAuditSnapshotRefreshJson.summary.agentExecutionTargetBaselineAuditLedgerSnapshotCount, 2);
    assert.equal(governanceAfterTargetBaselineAuditSnapshotRefreshJson.summary.agentExecutionTargetBaselineAuditLedgerBaselineHealth, "healthy");
    assert.equal(governanceAfterTargetBaselineAuditSnapshotRefreshJson.summary.agentExecutionTargetBaselineAuditLedgerBaselineFreshness, "fresh");
    assert.ok(governanceAfterTargetBaselineAuditSnapshotRefreshJson.operationLog.some((operation) => operation.type === "agent-execution-target-baseline-audit-ledger-snapshot-refreshed"));
    assert.ok(governanceAfterTargetBaselineAuditSnapshotRefreshJson.operationLog.some((operation) => operation.type === "agent-execution-target-baseline-audit-ledger-drift-checkpoint-upserted"));

    const targetBaselineAuditLedgerBaselineStatusResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/target-baseline-audit-ledger-baseline-status`);
    assert.equal(targetBaselineAuditLedgerBaselineStatusResponse.status, 200);
    const targetBaselineAuditLedgerBaselineStatusJson = await targetBaselineAuditLedgerBaselineStatusResponse.json();
    assert.equal(targetBaselineAuditLedgerBaselineStatusJson.hasBaseline, true);
    assert.equal(targetBaselineAuditLedgerBaselineStatusJson.health, "healthy");
    assert.equal(targetBaselineAuditLedgerBaselineStatusJson.freshness, "fresh");
    assert.equal(targetBaselineAuditLedgerBaselineStatusJson.driftScore, 0);
    assert.match(targetBaselineAuditLedgerBaselineStatusJson.markdown, /# Agent Execution Target Baseline Audit Ledger Baseline Status/);

    const refreshBatchRunTargetBaselineAuditResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/${batchAgentWorkOrderRunsJson.queuedRuns[0].id}/target-baseline-audit-refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notes: "Fixture target baseline audit recapture.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(refreshBatchRunTargetBaselineAuditResponse.status, 200);
    const refreshBatchRunTargetBaselineAuditJson = await refreshBatchRunTargetBaselineAuditResponse.json();
    assert.equal(refreshBatchRunTargetBaselineAuditJson.success, true);
    assert.equal(refreshBatchRunTargetBaselineAuditJson.run.id, batchAgentWorkOrderRunsJson.queuedRuns[0].id);
    assert.equal(refreshBatchRunTargetBaselineAuditJson.run.targetBaselineAuditLedgerBaselineHealth, "healthy");
    assert.equal(refreshBatchRunTargetBaselineAuditJson.run.targetBaselineAuditLedgerBaselineFreshness, "fresh");
    assert.equal(refreshBatchRunTargetBaselineAuditJson.run.history[0].note, "Fixture target baseline audit recapture.");

    const governanceAfterTargetBaselineAuditRefreshResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterTargetBaselineAuditRefreshResponse.status, 200);
    const governanceAfterTargetBaselineAuditRefreshJson = await governanceAfterTargetBaselineAuditRefreshResponse.json();
    assert.ok(governanceAfterTargetBaselineAuditRefreshJson.operationLog.some((operation) => operation.type === "agent-work-order-run-target-baseline-audit-refreshed"));

    const unscopedRefreshBatchRunRegressionAlertBaselineResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/${batchAgentWorkOrderRunsJson.queuedRuns[0].id}/regression-alert-baseline-refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notes: "Fixture unscoped Regression Alert baseline recapture."
      })
    });
    assert.equal(unscopedRefreshBatchRunRegressionAlertBaselineResponse.status, 409);
    const unscopedRefreshBatchRunRegressionAlertBaselineJson = await unscopedRefreshBatchRunRegressionAlertBaselineResponse.json();
    assert.equal(unscopedRefreshBatchRunRegressionAlertBaselineJson.reasonCode, "agent-execution-scope-required");

    const refreshBatchRunRegressionAlertBaselineResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/${batchAgentWorkOrderRunsJson.queuedRuns[0].id}/regression-alert-baseline-refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notes: "Fixture Regression Alert baseline recapture.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(refreshBatchRunRegressionAlertBaselineResponse.status, 200);
    const refreshBatchRunRegressionAlertBaselineJson = await refreshBatchRunRegressionAlertBaselineResponse.json();
    assert.equal(refreshBatchRunRegressionAlertBaselineJson.success, true);
    assert.equal(refreshBatchRunRegressionAlertBaselineJson.run.id, batchAgentWorkOrderRunsJson.queuedRuns[0].id);
    assert.equal(refreshBatchRunRegressionAlertBaselineJson.run.regressionAlertTaskLedgerBaselineHealth, "missing");
    assert.equal(refreshBatchRunRegressionAlertBaselineJson.run.regressionAlertTaskLedgerBaselineRefreshGateDecision, "ready");
    assert.equal(refreshBatchRunRegressionAlertBaselineJson.run.history[0].note, "Fixture Regression Alert baseline recapture.");

    const governanceAfterRegressionAlertBaselineRefreshResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterRegressionAlertBaselineRefreshResponse.status, 200);
    const governanceAfterRegressionAlertBaselineRefreshJson = await governanceAfterRegressionAlertBaselineRefreshResponse.json();
    assert.ok(governanceAfterRegressionAlertBaselineRefreshJson.operationLog.some((operation) => operation.type === "agent-work-order-run-regression-alert-baseline-refreshed"));

    const cancelAgentWorkOrderRunResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/${createAgentWorkOrderRunJson.run.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "cancelled",
        notes: "Fixture run cancelled.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(cancelAgentWorkOrderRunResponse.status, 200);
    const cancelAgentWorkOrderRunJson = await cancelAgentWorkOrderRunResponse.json();
    assert.equal(cancelAgentWorkOrderRunJson.success, true);
    assert.equal(cancelAgentWorkOrderRunJson.run.status, "cancelled");
    assert.equal(cancelAgentWorkOrderRunJson.run.history.length, 3);
    assert.equal(cancelAgentWorkOrderRunJson.run.history[0].previousStatus, "running");
    assert.equal(cancelAgentWorkOrderRunJson.run.history[0].status, "cancelled");

    const blockedRetryAgentWorkOrderRunResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/${createAgentWorkOrderRunJson.run.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "queued",
        notes: "Fixture run retried without checkpoint.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(blockedRetryAgentWorkOrderRunResponse.status, 409);
    const blockedRetryAgentWorkOrderRunJson = await blockedRetryAgentWorkOrderRunResponse.json();
    assert.equal(blockedRetryAgentWorkOrderRunJson.checkpointBlocked, 1);
    assert.equal(blockedRetryAgentWorkOrderRunJson.targetAction, "retry");

    const deferredRetryCheckpointJson = await createExecutionResultCheckpoint(createAgentWorkOrderRunJson.run.id, "retry", "deferred");
    assert.equal(deferredRetryCheckpointJson.checkpoint.runStatus, "cancelled");
    assert.ok(deferredRetryCheckpointJson.createdTask);
    assert.equal(deferredRetryCheckpointJson.createdTask.agentExecutionResultRunId, createAgentWorkOrderRunJson.run.id);
    assert.equal(deferredRetryCheckpointJson.createdTask.agentExecutionResultTargetAction, "retry");
    assert.equal(deferredRetryCheckpointJson.agentExecutionResultTaskCount, 1);

    const duplicateDeferredRetryCheckpointJson = await createExecutionResultCheckpoint(createAgentWorkOrderRunJson.run.id, "retry", "deferred");
    assert.equal(duplicateDeferredRetryCheckpointJson.createdTask, null);
    assert.equal(duplicateDeferredRetryCheckpointJson.skippedTask.reason, "Open execution-result follow-up task already exists");
    assert.equal(duplicateDeferredRetryCheckpointJson.agentExecutionResultTaskCount, 1);

    const resolveDeferredRetryTaskResponse = await fetch(`${baseUrl}/api/tasks/${deferredRetryCheckpointJson.createdTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved", ...taskMutationScope })
    });
    assert.equal(resolveDeferredRetryTaskResponse.status, 200);
    const resolveDeferredRetryTaskJson = await resolveDeferredRetryTaskResponse.json();
    assert.equal(resolveDeferredRetryTaskJson.task.status, "resolved");

    const retryCheckpointJson = await createExecutionResultCheckpoint(createAgentWorkOrderRunJson.run.id, "retry");
    assert.equal(retryCheckpointJson.checkpoint.runStatus, "cancelled");

    const retryAgentWorkOrderRunResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/${createAgentWorkOrderRunJson.run.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "queued",
        notes: "Fixture run retried.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(retryAgentWorkOrderRunResponse.status, 200);
    const retryAgentWorkOrderRunJson = await retryAgentWorkOrderRunResponse.json();
    assert.equal(retryAgentWorkOrderRunJson.success, true);
    assert.equal(retryAgentWorkOrderRunJson.run.status, "queued");
    assert.equal(retryAgentWorkOrderRunJson.run.history.length, 4);
    assert.equal(retryAgentWorkOrderRunJson.run.history[0].previousStatus, "cancelled");
    assert.equal(retryAgentWorkOrderRunJson.run.history[0].status, "queued");

    const blockAgentWorkOrderRunResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/${createAgentWorkOrderRunJson.run.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "blocked",
        notes: "Fixture run blocked.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(blockAgentWorkOrderRunResponse.status, 200);
    const blockAgentWorkOrderRunJson = await blockAgentWorkOrderRunResponse.json();
    assert.equal(blockAgentWorkOrderRunJson.success, true);
    assert.equal(blockAgentWorkOrderRunJson.run.status, "blocked");
    assert.equal(blockAgentWorkOrderRunJson.run.history.length, 5);
    assert.equal(blockAgentWorkOrderRunJson.run.history[0].previousStatus, "queued");
    assert.equal(blockAgentWorkOrderRunJson.run.history[0].status, "blocked");

    const resumeAgentWorkOrderRunResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/${createAgentWorkOrderRunJson.run.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "running",
        notes: "Fixture run resumed.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(resumeAgentWorkOrderRunResponse.status, 200);
    const resumeAgentWorkOrderRunJson = await resumeAgentWorkOrderRunResponse.json();
    assert.equal(resumeAgentWorkOrderRunJson.success, true);
    assert.equal(resumeAgentWorkOrderRunJson.run.status, "running");
    assert.equal(resumeAgentWorkOrderRunJson.run.history.length, 6);
    assert.equal(resumeAgentWorkOrderRunJson.run.history[0].previousStatus, "blocked");
    assert.equal(resumeAgentWorkOrderRunJson.run.history[0].status, "running");

    const passAgentWorkOrderRunResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/${createAgentWorkOrderRunJson.run.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "passed",
        notes: "Fixture run passed.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(passAgentWorkOrderRunResponse.status, 200);
    const passAgentWorkOrderRunJson = await passAgentWorkOrderRunResponse.json();
    assert.equal(passAgentWorkOrderRunJson.success, true);
    assert.equal(passAgentWorkOrderRunJson.run.status, "passed");
    assert.equal(passAgentWorkOrderRunJson.run.history[0].previousStatus, "running");
    assert.equal(passAgentWorkOrderRunJson.run.history[0].status, "passed");

    const blockedArchiveAgentWorkOrderRunResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/${createAgentWorkOrderRunJson.run.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        archived: true,
        notes: "Fixture run archived without checkpoint.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(blockedArchiveAgentWorkOrderRunResponse.status, 409);
    const blockedArchiveAgentWorkOrderRunJson = await blockedArchiveAgentWorkOrderRunResponse.json();
    assert.equal(blockedArchiveAgentWorkOrderRunJson.checkpointBlocked, 1);
    assert.equal(blockedArchiveAgentWorkOrderRunJson.targetAction, "archive");

    const archiveCheckpointJson = await createExecutionResultCheckpoint(createAgentWorkOrderRunJson.run.id, "archive");
    assert.equal(archiveCheckpointJson.checkpoint.runStatus, "passed");

    const archiveAgentWorkOrderRunResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/${createAgentWorkOrderRunJson.run.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        archived: true,
        notes: "Fixture run archived.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(archiveAgentWorkOrderRunResponse.status, 200);
    const archiveAgentWorkOrderRunJson = await archiveAgentWorkOrderRunResponse.json();
    assert.equal(archiveAgentWorkOrderRunJson.success, true);
    assert.equal(archiveAgentWorkOrderRunJson.run.status, "passed");
    assert.ok(archiveAgentWorkOrderRunJson.run.archivedAt);

    const unarchivedAgentWorkOrderRunsResponse = await fetch(`${baseUrl}/api/agent-work-order-runs?projectId=alpha-app&archived=false`);
    assert.equal(unarchivedAgentWorkOrderRunsResponse.status, 200);
    const unarchivedAgentWorkOrderRunsJson = await unarchivedAgentWorkOrderRunsResponse.json();
    assert.equal(unarchivedAgentWorkOrderRunsJson.length, 1);

    const archivedAgentWorkOrderRunsResponse = await fetch(`${baseUrl}/api/agent-work-order-runs?projectId=alpha-app&archived=true`);
    assert.equal(archivedAgentWorkOrderRunsResponse.status, 200);
    const archivedAgentWorkOrderRunsJson = await archivedAgentWorkOrderRunsResponse.json();
    assert.equal(archivedAgentWorkOrderRunsJson.length, 1);
    assert.equal(archivedAgentWorkOrderRunsJson[0].status, "passed");

    const governanceAfterArchiveResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterArchiveResponse.status, 200);
    const governanceAfterArchiveJson = await governanceAfterArchiveResponse.json();
    assert.equal(governanceAfterArchiveJson.summary.agentWorkOrderRunCount, 2);
    assert.equal(governanceAfterArchiveJson.summary.archivedAgentWorkOrderRunCount, 1);
    assert.equal(governanceAfterArchiveJson.summary.activeAgentWorkOrderRunCount, 1);
    assert.equal(governanceAfterArchiveJson.agentExecutionMetrics.archived, 1);
    assert.equal(governanceAfterArchiveJson.agentExecutionMetrics.statusCounts.passed, 0);
    assert.equal(governanceAfterArchiveJson.agentExecutionMetrics.statusCounts.queued, 1);
    assert.equal(governanceAfterArchiveJson.summary.agentExecutionResultCheckpointCount, 4);
    assert.equal(governanceAfterArchiveJson.summary.agentExecutionResultCheckpointApprovedCount, 2);
    assert.equal(governanceAfterArchiveJson.summary.agentExecutionResultCheckpointDeferredCount, 2);
    assert.equal(governanceAfterArchiveJson.summary.agentExecutionResultTaskCount, 1);
    assert.equal(governanceAfterArchiveJson.summary.agentExecutionResultOpenTaskCount, 0);
    assert.equal(governanceAfterArchiveJson.summary.agentExecutionResultClosedTaskCount, 1);
    assert.equal(governanceAfterArchiveJson.agentExecutionResultTasks.length, 1);
    assert.equal(governanceAfterArchiveJson.agentExecutionResultTasks[0].status, "resolved");
    assert.equal(governanceAfterArchiveJson.agentExecutionResultCheckpoints.length, 4);
    assert.ok(governanceAfterArchiveJson.operationLog.map((operation) => operation.type).includes("agent-work-order-run-archived"));
    assert.ok(governanceAfterArchiveJson.operationLog.map((operation) => operation.type).includes("agent-execution-result-checkpoint-recorded"));
    assert.ok(governanceAfterArchiveJson.operationLog.map((operation) => operation.type).includes("agent-execution-result-checkpoint-task-created"));

    const executionResultTaskLedgerResponse = await fetch(`${baseUrl}/api/agent-execution-result/task-ledger`);
    assert.equal(executionResultTaskLedgerResponse.status, 200);
    const executionResultTaskLedgerJson = await executionResultTaskLedgerResponse.json();
    assert.equal(executionResultTaskLedgerJson.summary.total, 1);
    assert.equal(executionResultTaskLedgerJson.summary.open, 0);
    assert.equal(executionResultTaskLedgerJson.summary.closed, 1);
    assert.equal(executionResultTaskLedgerJson.summary.actionCount, 1);
    assert.equal(executionResultTaskLedgerJson.items.length, 1);
    assert.equal(executionResultTaskLedgerJson.items[0].agentExecutionResultTargetAction, "retry");
    assert.match(executionResultTaskLedgerJson.markdown, /# Agent Execution Result Task Ledger/);

    const openExecutionResultTaskLedgerResponse = await fetch(`${baseUrl}/api/agent-execution-result/task-ledger?status=open&limit=5`);
    assert.equal(openExecutionResultTaskLedgerResponse.status, 200);
    const openExecutionResultTaskLedgerJson = await openExecutionResultTaskLedgerResponse.json();
    assert.equal(openExecutionResultTaskLedgerJson.status, "open");
    assert.equal(openExecutionResultTaskLedgerJson.items.length, 0);

    const missingExecutionResultTaskLedgerSnapshotDiffResponse = await fetch(`${baseUrl}/api/agent-execution-result/task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(missingExecutionResultTaskLedgerSnapshotDiffResponse.status, 200);
    const missingExecutionResultTaskLedgerSnapshotDiffJson = await missingExecutionResultTaskLedgerSnapshotDiffResponse.json();
    assert.equal(missingExecutionResultTaskLedgerSnapshotDiffJson.hasSnapshot, false);
    assert.equal(missingExecutionResultTaskLedgerSnapshotDiffJson.driftSeverity, "missing-snapshot");
    assert.match(missingExecutionResultTaskLedgerSnapshotDiffJson.markdown, /# Agent Execution Result Task Ledger Snapshot Drift/);

    const createExecutionResultTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/agent-execution-result/task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Execution Result Task Ledger", status: "all", limit: 5 })
    });
    assert.equal(createExecutionResultTaskLedgerSnapshotResponse.status, 200);
    const createExecutionResultTaskLedgerSnapshotJson = await createExecutionResultTaskLedgerSnapshotResponse.json();
    assert.equal(createExecutionResultTaskLedgerSnapshotJson.success, true);
    assert.equal(createExecutionResultTaskLedgerSnapshotJson.snapshot.title, "Fixture Execution Result Task Ledger");
    assert.equal(createExecutionResultTaskLedgerSnapshotJson.snapshot.total, 1);
    assert.equal(createExecutionResultTaskLedgerSnapshotJson.snapshot.openCount, 0);
    assert.equal(createExecutionResultTaskLedgerSnapshotJson.snapshot.closedCount, 1);
    assert.equal(createExecutionResultTaskLedgerSnapshotJson.snapshot.actionCount, 1);
    assert.equal(createExecutionResultTaskLedgerSnapshotJson.snapshot.items.length, 1);

    const executionResultTaskLedgerSnapshotsResponse = await fetch(`${baseUrl}/api/agent-execution-result/task-ledger-snapshots`);
    assert.equal(executionResultTaskLedgerSnapshotsResponse.status, 200);
    const executionResultTaskLedgerSnapshotsJson = await executionResultTaskLedgerSnapshotsResponse.json();
    assert.equal(executionResultTaskLedgerSnapshotsJson.length, 1);

    const executionResultTaskLedgerSnapshotDiffResponse = await fetch(`${baseUrl}/api/agent-execution-result/task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(executionResultTaskLedgerSnapshotDiffResponse.status, 200);
    const executionResultTaskLedgerSnapshotDiffJson = await executionResultTaskLedgerSnapshotDiffResponse.json();
    assert.equal(executionResultTaskLedgerSnapshotDiffJson.hasSnapshot, true);
    assert.equal(executionResultTaskLedgerSnapshotDiffJson.hasDrift, false);
    assert.equal(executionResultTaskLedgerSnapshotDiffJson.driftSeverity, "none");

    const governanceAfterExecutionResultTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterExecutionResultTaskLedgerSnapshotResponse.status, 200);
    const governanceAfterExecutionResultTaskLedgerSnapshotJson = await governanceAfterExecutionResultTaskLedgerSnapshotResponse.json();
    assert.equal(governanceAfterExecutionResultTaskLedgerSnapshotJson.summary.agentExecutionResultTaskLedgerSnapshotCount, 1);
    assert.equal(governanceAfterExecutionResultTaskLedgerSnapshotJson.agentExecutionResultTaskLedgerSnapshots[0].title, "Fixture Execution Result Task Ledger");
    assert.ok(governanceAfterExecutionResultTaskLedgerSnapshotJson.operationLog.some((operation) => operation.type === "agent-execution-result-task-ledger-snapshot-created"));

    const retentionRunIds = [];
    for (const status of ["passed", "failed", "cancelled"]) {
      const retentionRunResponse = await fetch(`${baseUrl}/api/agent-work-order-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "beta-app",
          projectName: "Beta App",
          title: `Retention fixture ${status}`,
          objective: "Exercise execution retention controls.",
          status,
          readinessScore: 90,
          readinessStatus: "ready",
          validationCommands: ["npm test"],
          notes: `Retention fixture ${status}.`,
          ...portfolioAgentExecutionScope
        })
      });
      assert.equal(retentionRunResponse.status, 200);
      const retentionRunJson = await retentionRunResponse.json();
      retentionRunIds.push(retentionRunJson.run.id);
    }

    const blockedRetentionResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/retention`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        retainCompleted: 1,
        runIds: retentionRunIds,
        ...portfolioAgentExecutionScope
      })
    });
    assert.equal(blockedRetentionResponse.status, 200);
    const blockedRetentionJson = await blockedRetentionResponse.json();
    assert.equal(blockedRetentionJson.success, true);
    assert.equal(blockedRetentionJson.retained, 1);
    assert.equal(blockedRetentionJson.archived, 0);
    assert.equal(blockedRetentionJson.checkpointBlocked, 2);

    for (const runId of retentionRunIds) {
      await createExecutionResultCheckpoint(runId, "retention");
    }

    const retentionResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/retention`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        retainCompleted: 1,
        runIds: retentionRunIds,
        ...portfolioAgentExecutionScope
      })
    });
    assert.equal(retentionResponse.status, 200);
    const retentionJson = await retentionResponse.json();
    assert.equal(retentionJson.success, true);
    assert.equal(retentionJson.retainCompleted, 1);
    assert.equal(retentionJson.retained, 1);
    assert.equal(retentionJson.archived, 2);
    assert.equal(retentionJson.checkpointBlocked, 0);
    assert.equal(retentionJson.archivedRuns.length, 2);

    const betaUnarchivedRunsResponse = await fetch(`${baseUrl}/api/agent-work-order-runs?projectId=beta-app&archived=false`);
    assert.equal(betaUnarchivedRunsResponse.status, 200);
    const betaUnarchivedRunsJson = await betaUnarchivedRunsResponse.json();
    assert.equal(betaUnarchivedRunsJson.length, 1);

    const betaArchivedRunsResponse = await fetch(`${baseUrl}/api/agent-work-order-runs?projectId=beta-app&archived=true`);
    assert.equal(betaArchivedRunsResponse.status, 200);
    const betaArchivedRunsJson = await betaArchivedRunsResponse.json();
    assert.equal(betaArchivedRunsJson.length, 2);

    const governanceAfterRetentionResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterRetentionResponse.status, 200);
    const governanceAfterRetentionJson = await governanceAfterRetentionResponse.json();
    assert.equal(governanceAfterRetentionJson.summary.agentWorkOrderRunCount, 5);
    assert.equal(governanceAfterRetentionJson.summary.archivedAgentWorkOrderRunCount, 3);
    assert.equal(governanceAfterRetentionJson.summary.agentExecutionResultCheckpointCount, 7);
    assert.equal(governanceAfterRetentionJson.summary.agentExecutionResultCheckpointApprovedCount, 5);
    assert.equal(governanceAfterRetentionJson.summary.agentExecutionResultCheckpointDeferredCount, 2);
    assert.equal(governanceAfterRetentionJson.summary.agentExecutionResultTaskCount, 1);
    assert.equal(governanceAfterRetentionJson.summary.agentExecutionResultOpenTaskCount, 0);
    assert.equal(governanceAfterRetentionJson.agentExecutionMetrics.archived, 3);
    assert.ok(governanceAfterRetentionJson.operationLog.map((operation) => operation.type).includes("agent-work-order-runs-retention-applied"));

    const emptyExecutionViewsResponse = await fetch(`${baseUrl}/api/governance/execution-views`);
    assert.equal(emptyExecutionViewsResponse.status, 200);
    const emptyExecutionViewsJson = await emptyExecutionViewsResponse.json();
    assert.equal(emptyExecutionViewsJson.length, 0);

    const unscopedSaveExecutionViewResponse = await fetch(`${baseUrl}/api/governance/execution-views`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Completed runs needing review",
        search: "beta",
        scope: "execution",
        sort: "recent",
        executionStatus: "completed",
        executionRetention: 10,
        showArchivedExecution: true
      })
    });
    assert.equal(unscopedSaveExecutionViewResponse.status, 409);
    const unscopedSaveExecutionViewJson = await unscopedSaveExecutionViewResponse.json();
    assert.equal(unscopedSaveExecutionViewJson.reasonCode, "agent-execution-scope-required");

    const saveExecutionViewResponse = await fetch(`${baseUrl}/api/governance/execution-views`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Completed runs needing review",
        search: "beta",
        scope: "execution",
        sort: "recent",
        executionStatus: "completed",
        executionRetention: 10,
        showArchivedExecution: true,
        ...taskMutationScope
      })
    });
    assert.equal(saveExecutionViewResponse.status, 200);
    const saveExecutionViewJson = await saveExecutionViewResponse.json();
    assert.equal(saveExecutionViewJson.success, true);
    assert.equal(saveExecutionViewJson.view.title, "Completed runs needing review");
    assert.equal(saveExecutionViewJson.view.executionStatus, "completed");
    assert.equal(saveExecutionViewJson.view.executionRetention, 10);
    assert.equal(saveExecutionViewJson.view.showArchivedExecution, true);
    assert.equal(saveExecutionViewJson.governanceExecutionViews.length, 1);

    const savedExecutionViewsResponse = await fetch(`${baseUrl}/api/governance/execution-views`);
    assert.equal(savedExecutionViewsResponse.status, 200);
    const savedExecutionViewsJson = await savedExecutionViewsResponse.json();
    assert.equal(savedExecutionViewsJson.length, 1);
    assert.equal(savedExecutionViewsJson[0].title, "Completed runs needing review");

    const governanceAfterExecutionViewResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterExecutionViewResponse.status, 200);
    const governanceAfterExecutionViewJson = await governanceAfterExecutionViewResponse.json();
    assert.equal(governanceAfterExecutionViewJson.summary.governanceExecutionViewCount, 1);
    assert.ok(governanceAfterExecutionViewJson.operationLog.map((operation) => operation.type).includes("governance-execution-view-saved"));

    const defaultExecutionPolicyResponse = await fetch(`${baseUrl}/api/governance/execution-policy`);
    assert.equal(defaultExecutionPolicyResponse.status, 200);
    const defaultExecutionPolicyJson = await defaultExecutionPolicyResponse.json();
    assert.equal(defaultExecutionPolicyJson.staleThresholdHours, 24);
    assert.deepEqual(defaultExecutionPolicyJson.staleStatuses, ["queued", "running", "blocked"]);

    const unscopedSaveExecutionPolicyResponse = await fetch(`${baseUrl}/api/governance/execution-policy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staleThresholdHours: 6
      })
    });
    assert.equal(unscopedSaveExecutionPolicyResponse.status, 409);
    const unscopedSaveExecutionPolicyJson = await unscopedSaveExecutionPolicyResponse.json();
    assert.equal(unscopedSaveExecutionPolicyJson.reasonCode, "agent-execution-scope-required");

    const saveExecutionPolicyResponse = await fetch(`${baseUrl}/api/governance/execution-policy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staleThresholdHours: 6,
        ...taskMutationScope
      })
    });
    assert.equal(saveExecutionPolicyResponse.status, 200);
    const saveExecutionPolicyJson = await saveExecutionPolicyResponse.json();
    assert.equal(saveExecutionPolicyJson.success, true);
    assert.equal(saveExecutionPolicyJson.policy.staleThresholdHours, 6);

    const staleRunCreatedAt = new Date(Date.now() - (8 * 60 * 60 * 1000)).toISOString();
    const staleRunResponse = await fetch(`${baseUrl}/api/agent-work-order-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "gamma-app",
        projectName: "Gamma App",
        title: "SLA breach fixture",
        objective: "Exercise SLA breach action controls.",
        status: "running",
        readinessScore: 88,
        readinessStatus: "ready",
        validationCommands: ["npm test"],
        notes: "SLA breach fixture.",
        createdAt: staleRunCreatedAt,
        updatedAt: staleRunCreatedAt,
        ...portfolioAgentExecutionScope
      })
    });
    assert.equal(staleRunResponse.status, 200);
    const staleRunJson = await staleRunResponse.json();

    const slaBreachResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/sla-breaches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "escalated",
        runIds: [staleRunJson.run.id],
        ...portfolioAgentExecutionScope
      })
    });
    assert.equal(slaBreachResponse.status, 200);
    const slaBreachJson = await slaBreachResponse.json();
    assert.equal(slaBreachJson.success, true);
    assert.equal(slaBreachJson.breached, 1);
    assert.equal(slaBreachJson.breachedRuns[0].slaAction, "escalated");
    assert.equal(slaBreachJson.breachedRuns[0].slaEscalationCount, 1);
    assert.ok(slaBreachJson.breachedRuns[0].slaBreachedAt);

    const governanceAfterExecutionPolicyResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterExecutionPolicyResponse.status, 200);
    const governanceAfterExecutionPolicyJson = await governanceAfterExecutionPolicyResponse.json();
    assert.equal(governanceAfterExecutionPolicyJson.agentExecutionPolicy.staleThresholdHours, 6);
    assert.equal(governanceAfterExecutionPolicyJson.agentExecutionMetrics.staleThresholdHours, 6);
    assert.equal(governanceAfterExecutionPolicyJson.agentExecutionMetrics.slaBreached, 1);
    assert.equal(governanceAfterExecutionPolicyJson.summary.agentExecutionSlaLedgerCount, 1);
    assert.equal(governanceAfterExecutionPolicyJson.agentExecutionSlaLedger[0].breachState, "open");
    assert.ok(governanceAfterExecutionPolicyJson.operationLog.map((operation) => operation.type).includes("governance-execution-policy-saved"));
    assert.ok(governanceAfterExecutionPolicyJson.operationLog.map((operation) => operation.type).includes("agent-work-order-runs-sla-breach-actioned"));

    const saveSlaBreachExecutionViewResponse = await fetch(`${baseUrl}/api/governance/execution-views`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "SLA breach review",
        search: "gamma",
        scope: "execution",
        sort: "recent",
        executionStatus: "sla-breached",
        executionRetention: 25,
        showArchivedExecution: false,
        ...taskMutationScope
      })
    });
    assert.equal(saveSlaBreachExecutionViewResponse.status, 200);
    const saveSlaBreachExecutionViewJson = await saveSlaBreachExecutionViewResponse.json();
    assert.equal(saveSlaBreachExecutionViewJson.success, true);
    assert.equal(saveSlaBreachExecutionViewJson.view.executionStatus, "sla-breached");

    const blockedResolveSlaBreachResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/sla-breaches/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runIds: [staleRunJson.run.id],
        ...portfolioAgentExecutionScope
      })
    });
    assert.equal(blockedResolveSlaBreachResponse.status, 200);
    const blockedResolveSlaBreachJson = await blockedResolveSlaBreachResponse.json();
    assert.equal(blockedResolveSlaBreachJson.success, true);
    assert.equal(blockedResolveSlaBreachJson.resolved, 0);
    assert.equal(blockedResolveSlaBreachJson.checkpointBlocked, 1);

    const resolveSlaCheckpointJson = await createExecutionResultCheckpoint(staleRunJson.run.id, "resolve-sla");
    assert.equal(resolveSlaCheckpointJson.checkpoint.resultType, "sla-breach");

    const resolveSlaBreachResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/sla-breaches/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runIds: [staleRunJson.run.id],
        ...portfolioAgentExecutionScope
      })
    });
    assert.equal(resolveSlaBreachResponse.status, 200);
    const resolveSlaBreachJson = await resolveSlaBreachResponse.json();
    assert.equal(resolveSlaBreachJson.success, true);
    assert.equal(resolveSlaBreachJson.resolved, 1);
    assert.equal(resolveSlaBreachJson.checkpointBlocked, 0);
    assert.equal(resolveSlaBreachJson.resolvedRuns[0].slaAction, "resolved");
    assert.equal(resolveSlaBreachJson.resolvedRuns[0].slaResolutionCount, 1);
    assert.ok(resolveSlaBreachJson.resolvedRuns[0].slaResolvedAt);

    const governanceAfterSlaResolutionResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterSlaResolutionResponse.status, 200);
    const governanceAfterSlaResolutionJson = await governanceAfterSlaResolutionResponse.json();
    assert.equal(governanceAfterSlaResolutionJson.agentExecutionMetrics.slaBreached, 0);
    assert.equal(governanceAfterSlaResolutionJson.agentExecutionMetrics.slaResolved, 1);
    assert.ok(governanceAfterSlaResolutionJson.agentExecutionMetrics.slaAverageResolutionHours >= 0);
    assert.equal(governanceAfterSlaResolutionJson.summary.agentExecutionResultCheckpointCount, 8);
    assert.equal(governanceAfterSlaResolutionJson.summary.agentExecutionResultCheckpointApprovedCount, 6);
    assert.equal(governanceAfterSlaResolutionJson.summary.agentExecutionResultCheckpointDeferredCount, 2);
    assert.equal(governanceAfterSlaResolutionJson.summary.agentExecutionResultTaskCount, 1);
    assert.equal(governanceAfterSlaResolutionJson.summary.agentExecutionResultOpenTaskCount, 0);
    assert.equal(governanceAfterSlaResolutionJson.summary.agentExecutionSlaLedgerCount, 1);
    assert.equal(governanceAfterSlaResolutionJson.agentExecutionSlaLedger[0].breachState, "resolved");
    assert.ok(governanceAfterSlaResolutionJson.operationLog.map((operation) => operation.type).includes("agent-work-order-runs-sla-breach-resolved"));

    const slaLedgerApiResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/sla-ledger?state=resolved&limit=5`);
    assert.equal(slaLedgerApiResponse.status, 200);
    const slaLedgerApiJson = await slaLedgerApiResponse.json();
    assert.equal(slaLedgerApiJson.state, "resolved");
    assert.equal(slaLedgerApiJson.limit, 5);
    assert.equal(slaLedgerApiJson.available, 1);
    assert.equal(slaLedgerApiJson.total, 1);
    assert.equal(slaLedgerApiJson.items[0].projectId, "gamma-app");
    assert.equal(slaLedgerApiJson.items[0].breachState, "resolved");
    assert.match(slaLedgerApiJson.markdown, /# Agent Execution SLA Ledger/);
    assert.match(slaLedgerApiJson.markdown, /Gamma App/);

    const initialSlaLedgerSnapshotsResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/sla-ledger-snapshots`);
    assert.equal(initialSlaLedgerSnapshotsResponse.status, 200);
    const initialSlaLedgerSnapshotsJson = await initialSlaLedgerSnapshotsResponse.json();
    assert.equal(initialSlaLedgerSnapshotsJson.length, 0);

    const unscopedSlaLedgerSnapshotResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/sla-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Resolved SLA ledger",
        state: "resolved",
        limit: 5
      })
    });
    assert.equal(unscopedSlaLedgerSnapshotResponse.status, 409);
    const unscopedSlaLedgerSnapshotJson = await unscopedSlaLedgerSnapshotResponse.json();
    assert.equal(unscopedSlaLedgerSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createSlaLedgerSnapshotResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/sla-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Resolved SLA ledger",
        state: "resolved",
        limit: 5,
        ...portfolioAgentExecutionScope
      })
    });
    assert.equal(createSlaLedgerSnapshotResponse.status, 200);
    const createSlaLedgerSnapshotJson = await createSlaLedgerSnapshotResponse.json();
    assert.equal(createSlaLedgerSnapshotJson.success, true);
    assert.equal(createSlaLedgerSnapshotJson.snapshot.stateFilter, "resolved");
    assert.equal(createSlaLedgerSnapshotJson.snapshot.total, 1);
    assert.equal(createSlaLedgerSnapshotJson.snapshot.resolvedCount, 1);
    assert.match(createSlaLedgerSnapshotJson.snapshot.markdown, /Gamma App/);

    const slaLedgerSnapshotsResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/sla-ledger-snapshots`);
    assert.equal(slaLedgerSnapshotsResponse.status, 200);
    const slaLedgerSnapshotsJson = await slaLedgerSnapshotsResponse.json();
    assert.equal(slaLedgerSnapshotsJson.length, 1);
    assert.equal(slaLedgerSnapshotsJson[0].title, "Resolved SLA ledger");

    const governanceAfterSlaLedgerSnapshotResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterSlaLedgerSnapshotResponse.status, 200);
    const governanceAfterSlaLedgerSnapshotJson = await governanceAfterSlaLedgerSnapshotResponse.json();
    assert.equal(governanceAfterSlaLedgerSnapshotJson.summary.agentExecutionSlaLedgerSnapshotCount, 1);
    assert.equal(governanceAfterSlaLedgerSnapshotJson.agentExecutionSlaLedgerSnapshots.length, 1);

    const agentControlPlaneResponse = await fetch(`${baseUrl}/api/agent-control-plane?limit=5`);
    assert.equal(agentControlPlaneResponse.status, 200);
    const agentControlPlaneJson = await agentControlPlaneResponse.json();
    assert.equal(agentControlPlaneJson.limit, 5);
    assert.equal(agentControlPlaneJson.summary.agentExecutionSlaLedgerSnapshotCount, 1);
    assert.equal(agentControlPlaneJson.agentSessions.length, 1);
    assert.equal(agentControlPlaneJson.agentSessions[0].projectId, "alpha-app");
    assert.equal(agentControlPlaneJson.workOrders.total, 1);
    assert.equal(agentControlPlaneJson.slaLedger.total, 1);
    assert.equal(agentControlPlaneJson.slaLedgerSnapshots.length, 1);
    assert.equal(agentControlPlaneJson.agentExecutionMetrics.slaResolved, 1);
    assert.ok(agentControlPlaneJson.agentExecutionMetrics.targetBaselineReviewRequired > 0);
    assert.ok(agentControlPlaneJson.agentExecutionMetrics.alertBaselineReviewRequired > 0);
    assert.match(agentControlPlaneJson.markdown, /Target baseline audit:/);
    assert.match(agentControlPlaneJson.markdown, /Regression Alert baseline capture:/);
    assert.equal(agentControlPlaneJson.agentExecutionTargetBaselineAuditLedgerBaselineStatus.hasBaseline, true);
    assert.ok(["healthy", "stale", "drifted", "drift-review-required"].includes(agentControlPlaneJson.agentExecutionTargetBaselineAuditLedgerBaselineStatus.health));
    assert.match(agentControlPlaneJson.markdown, /Target baseline audit baseline:/);
    assert.equal(agentControlPlaneJson.agentExecutionRegressionAlertBaselineLedgerBaselineStatus.hasBaseline, true);
    assert.ok(["healthy", "stale", "drifted", "drift-review-required"].includes(agentControlPlaneJson.agentExecutionRegressionAlertBaselineLedgerBaselineStatus.health));
    assert.equal(agentControlPlaneJson.dataSourcesAccessGate.decision, "ready");
    assert.equal(agentControlPlaneJson.dataSourcesAccessGate.total, 1);
    assert.equal(agentControlPlaneJson.dataSourcesAccessGate.review, 0);
    assert.equal(agentControlPlaneJson.dataSourcesAccessReviewQueue.summary.total, 0);
    assert.equal(agentControlPlaneJson.dataSourcesAccessValidationRunbook.summary.methodCount, 1);
    assert.equal(agentControlPlaneJson.dataSourcesAccessValidationRunbook.methods[0].accessMethod, "local-filesystem");
    assert.equal(agentControlPlaneJson.summary.dataSourcesAccessValidationWorkflowTotalCount, 1);
    assert.equal(agentControlPlaneJson.summary.dataSourcesAccessValidationWorkflowReadyCount, 1);
    assert.equal(agentControlPlaneJson.summary.dataSourcesAccessValidationWorkflowPendingCount, 0);
    assert.equal(agentControlPlaneJson.summary.dataSourceAccessValidationWorkflowSnapshotCount, 1);
    assert.equal(agentControlPlaneJson.summary.dataSourceAccessValidationWorkflowSnapshotDriftSeverity, "low");
    assert.equal(agentControlPlaneJson.summary.dataSourcesAccessValidationEvidenceCount, 1);
    assert.equal(agentControlPlaneJson.summary.dataSourcesAccessValidationEvidenceValidatedCount, 1);
    assert.equal(agentControlPlaneJson.summary.dataSourcesAccessValidationEvidenceCoverageCount, 1);
    assert.equal(agentControlPlaneJson.summary.dataSourcesAccessValidationEvidenceCoverageCoveredCount, 1);
    assert.equal(agentControlPlaneJson.summary.dataSourcesAccessValidationEvidenceCoverageMissingCount, 0);
    assert.equal(agentControlPlaneJson.summary.dataSourcesAccessValidationEvidenceCoveragePercent, 100);
    assert.equal(agentControlPlaneJson.summary.dataSourceAccessValidationEvidenceSnapshotCount, 1);
    assert.equal(agentControlPlaneJson.summary.deploymentSmokeCheckCount, 2);
    assert.equal(agentControlPlaneJson.summary.deploymentSmokeCheckPassCount, 2);
    assert.equal(agentControlPlaneJson.summary.deploymentSmokeCheckFailCount, 0);
    assert.equal(agentControlPlaneJson.deploymentSmokeChecks.length, 2);
    assert.equal(agentControlPlaneJson.deploymentSmokeChecks[0].label, "Fixture release gate local app");
    assert.equal(agentControlPlaneJson.summary.releaseCheckpointCount, 2);
    assert.equal(agentControlPlaneJson.releaseCheckpoints.length, 2);
    assert.equal(agentControlPlaneJson.releaseCheckpoints[0].title, "Fixture Release Gate Bootstrap");
    assert.equal(agentControlPlaneJson.releaseBuildGate.decision, "review");
    assert.ok(agentControlPlaneJson.releaseBuildGate.reasons.some((reason) => reason.code === "git-unavailable"));
    assert.equal(agentControlPlaneJson.summary.releaseBuildGateDecision, "review");
    assert.ok(agentControlPlaneJson.summary.releaseBuildGateReasonCount >= 1);
    assert.equal(agentControlPlaneJson.dataSourceAccessValidationEvidence.length, 1);
    assert.equal(agentControlPlaneJson.dataSourcesAccessValidationWorkflow.summary.ready, 1);
    assert.equal(agentControlPlaneJson.dataSourceAccessValidationWorkflowSnapshots.length, 1);
    assert.equal(agentControlPlaneJson.dataSourceAccessValidationWorkflowSnapshotDiff.driftSeverity, "low");
    assert.equal(agentControlPlaneJson.dataSourcesAccessValidationEvidenceCoverage.items.length, 1);
    assert.equal(agentControlPlaneJson.dataSourcesAccessValidationEvidenceCoverage.items[0].coverageStatus, "covered");
    assert.equal(agentControlPlaneJson.dataSourceAccessValidationEvidenceSnapshots.length, 1);
    assert.equal(agentControlPlaneJson.baselineStatus.hasBaseline, false);
    assert.equal(agentControlPlaneJson.baselineStatus.health, "missing");
    assert.match(agentControlPlaneJson.baselineStatus.recommendedAction, /Save or mark/);
    assert.equal(agentControlPlaneJson.baselineStatus.driftScore, 0);
    assert.equal(agentControlPlaneJson.baselineStatus.driftSeverity, "missing-baseline");
    assert.match(agentControlPlaneJson.baselineStatus.driftRecommendedAction, /Save or mark/);
    assert.match(agentControlPlaneJson.markdown, /# Agent Control Plane/);
    assert.match(agentControlPlaneJson.markdown, /Baseline health: missing/);
    assert.match(agentControlPlaneJson.markdown, /Baseline drift severity: missing-baseline/);
    assert.match(agentControlPlaneJson.markdown, /## Baseline Drift Fields/);
    assert.match(agentControlPlaneJson.markdown, /Data Sources access gate: ready/);
    assert.match(agentControlPlaneJson.markdown, /Data Sources access validation methods: 1 across 1 source/);
    assert.match(agentControlPlaneJson.markdown, /Data Sources access validation workflow: 1 ready \/ 0 pending \/ 0 blocked/);
    assert.match(agentControlPlaneJson.markdown, /Data Sources access validation workflow snapshots: 1/);
    assert.match(agentControlPlaneJson.markdown, /Data Sources access validation evidence: 1 validated \/ 1 total/);
    assert.match(agentControlPlaneJson.markdown, /Data Sources access validation evidence coverage: 1 covered \/ 1 source/);
    assert.match(agentControlPlaneJson.markdown, /## Data Sources Access Validation Evidence Coverage/);
    assert.match(agentControlPlaneJson.markdown, /Data Sources access validation evidence snapshots: 1/);
    assert.match(agentControlPlaneJson.markdown, /## Data Sources Access Gate/);
    assert.match(agentControlPlaneJson.markdown, /## Data Sources Access Review Queue/);
    assert.match(agentControlPlaneJson.markdown, /## Data Sources Access Validation Runbook/);
    assert.match(agentControlPlaneJson.markdown, /## Data Sources Access Validation Workflow/);
    assert.match(agentControlPlaneJson.markdown, /## Data Sources Access Validation Workflow Snapshot Drift/);
    assert.match(agentControlPlaneJson.markdown, /## Data Sources Access Validation Evidence/);
    assert.match(agentControlPlaneJson.markdown, /## Data Sources Access Validation Evidence Snapshots/);
    assert.match(agentControlPlaneJson.markdown, /Deployment smoke checks: 2 pass \/ 0 fail \/ 2 total/);
    assert.match(agentControlPlaneJson.markdown, /## Deployment Smoke Checks/);
    assert.match(agentControlPlaneJson.markdown, /Release checkpoints: 2/);
    assert.match(agentControlPlaneJson.markdown, /## Release Checkpoints/);
    assert.match(agentControlPlaneJson.markdown, /Release build gate: review/);
    assert.match(agentControlPlaneJson.markdown, /## Release Build Gate/);
    assert.match(agentControlPlaneJson.markdown, /## Saved Handoffs/);
    assert.match(agentControlPlaneJson.markdown, /Gamma App/);

    const cliBridgeContextResponse = await fetch(`${baseUrl}/api/cli-bridge/context?runner=codex&limit=5`);
    assert.equal(cliBridgeContextResponse.status, 200);
    const cliBridgeContextJson = await cliBridgeContextResponse.json();
    assert.equal(cliBridgeContextJson.protocolVersion, "cli-bridge-context.v1");
    assert.equal(cliBridgeContextJson.bridgeMode, "workspace-audit-work-order-broker");
    assert.equal(cliBridgeContextJson.executionMode, "non-executing");
    assert.equal(cliBridgeContextJson.runner, "codex");
    assert.equal(cliBridgeContextJson.adapters.length, 1);
    assert.equal(cliBridgeContextJson.adapters[0].id, "codex");
    assert.match(cliBridgeContextJson.adapters[0].method, /Codex SDK/);
    assert.equal(cliBridgeContextJson.workOrders.total, 1);
    assert.equal(cliBridgeContextJson.executableWorkOrderCount, 1);
    assert.equal(cliBridgeContextJson.controlPlaneDecision.decision, "hold");
    assert.equal(cliBridgeContextJson.controlPlaneDecision.profileTargetTaskLedgerBaselineHealth, "missing");
    assert.equal(cliBridgeContextJson.controlPlaneDecision.profileTargetTaskLedgerBaselineUncheckpointedDriftCount, 0);
    assert.ok(cliBridgeContextJson.controlPlaneDecision.targetBaselineAuditLedgerBaselineHealth);
    assert.ok(cliBridgeContextJson.controlPlaneDecision.regressionAlertBaselineLedgerBaselineHealth);
    assert.equal(typeof cliBridgeContextJson.controlPlaneDecision.regressionAlertBaselineLedgerBaselineUncheckpointedDriftCount, "number");
    assert.equal(cliBridgeContextJson.controlPlaneDecision.regressionAlertTaskLedgerBaselineHealth, "missing");
    assert.equal(cliBridgeContextJson.controlPlaneDecision.regressionAlertTaskLedgerBaselineRefreshGateDecision, "ready");
    assert.ok(cliBridgeContextJson.controlPlaneDecision.agentExecutionTargetBaselineAuditBaselineReviewRequiredCount >= 1);
    assert.equal(typeof cliBridgeContextJson.controlPlaneDecision.agentExecutionTargetBaselineAuditBaselineHealthyCount, "number");
    assert.ok(cliBridgeContextJson.controlPlaneDecision.agentExecutionRegressionAlertBaselineReviewRequiredCount >= 1);
    assert.equal(typeof cliBridgeContextJson.controlPlaneDecision.agentExecutionRegressionAlertBaselineHealthyCount, "number");
    assert.equal(cliBridgeContextJson.bridgeDecision, "hold");
    assert.match(cliBridgeContextJson.secretPolicy, /Do not include passwords/);
    assert.match(cliBridgeContextJson.markdown, /# CLI Bridge Context Pack/);
    assert.match(cliBridgeContextJson.markdown, /Profile target task baseline health: missing/);
    assert.match(cliBridgeContextJson.markdown, /Target baseline audit baseline health:/);
    assert.match(cliBridgeContextJson.markdown, /Regression Alert baseline snapshot health:/);
    assert.match(cliBridgeContextJson.markdown, /Regression Alert task baseline health: missing/);
    assert.match(cliBridgeContextJson.markdown, /Execution audit snapshot baseline runs:/);
    assert.match(cliBridgeContextJson.markdown, /Codex CLI/);
    assert.match(cliBridgeContextJson.markdown, /Workspace Audit Pro owns work-order creation/);

    const initialCliBridgeHandoffsResponse = await fetch(`${baseUrl}/api/cli-bridge/handoffs?runner=all&limit=5`);
    assert.equal(initialCliBridgeHandoffsResponse.status, 200);
    const initialCliBridgeHandoffsJson = await initialCliBridgeHandoffsResponse.json();
    assert.equal(initialCliBridgeHandoffsJson.total, 0);
    assert.match(initialCliBridgeHandoffsJson.markdown, /# CLI Bridge Handoff Ledger/);

    const unscopedCliBridgeHandoffResponse = await fetch(`${baseUrl}/api/cli-bridge/handoffs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceRunner: "codex",
        targetRunner: "claude",
        status: "proposed",
        projectId: "alpha-app",
        projectName: "Alpha App",
        workOrderRunId: createAgentWorkOrderRunJson.run.id,
        summary: "Fixture unscoped handoff should be blocked."
      })
    });
    assert.equal(unscopedCliBridgeHandoffResponse.status, 409);
    const unscopedCliBridgeHandoffJson = await unscopedCliBridgeHandoffResponse.json();
    assert.equal(unscopedCliBridgeHandoffJson.reasonCode, "agent-execution-scope-required");

    const mismatchedCliBridgeHandoffResponse = await fetch(`${baseUrl}/api/cli-bridge/handoffs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceRunner: "codex",
        targetRunner: "claude",
        status: "proposed",
        projectId: "beta-app",
        projectName: "Beta App",
        summary: "Fixture mismatched handoff should be blocked.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(mismatchedCliBridgeHandoffResponse.status, 409);
    const mismatchedCliBridgeHandoffJson = await mismatchedCliBridgeHandoffResponse.json();
    assert.equal(mismatchedCliBridgeHandoffJson.reasonCode, "agent-execution-scope-mismatch");
    assert.deepEqual(mismatchedCliBridgeHandoffJson.mismatchedProjectIds, ["beta-app"]);

    const createCliBridgeHandoffResponse = await fetch(`${baseUrl}/api/cli-bridge/handoffs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceRunner: "codex",
        targetRunner: "claude",
        status: "proposed",
        resultType: "implementation-result",
        projectId: "alpha-app",
        projectName: "Alpha App",
        workOrderRunId: createAgentWorkOrderRunJson.run.id,
        title: "Codex implementation handoff for Claude review",
        summary: "Codex completed the bounded fixture implementation slice and requests Claude review.",
        changedFiles: ["src/index.js"],
        validationSummary: "Fixture validation passed.",
        nextAction: "Claude should review the summary and recommend follow-up work-order scope.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(createCliBridgeHandoffResponse.status, 200);
    const createCliBridgeHandoffJson = await createCliBridgeHandoffResponse.json();
    assert.equal(createCliBridgeHandoffJson.success, true);
    assert.equal(createCliBridgeHandoffJson.handoff.sourceRunner, "codex");
    assert.equal(createCliBridgeHandoffJson.handoff.targetRunner, "claude");
    assert.match(createCliBridgeHandoffJson.handoff.secretPolicy, /Non-secret CLI bridge handoff/);
    assert.ok(["healthy", "missing", "stale", "drifted", "drift-review-required"].includes(createCliBridgeHandoffJson.handoff.targetBaselineAuditLedgerBaselineHealth));
    assert.ok(createCliBridgeHandoffJson.handoff.targetBaselineAuditLedgerBaselineFreshness);
    assert.equal(createCliBridgeHandoffJson.ledger.total, 1);
    assert.match(createCliBridgeHandoffJson.ledger.markdown, /Target baseline audit baseline:/);

    const acceptCliBridgeHandoffResponse = await fetch(`${baseUrl}/api/cli-bridge/handoffs/${createCliBridgeHandoffJson.handoff.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "accept",
        note: "Fixture operator accepted the Codex to Claude handoff.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(acceptCliBridgeHandoffResponse.status, 200);
    const acceptCliBridgeHandoffJson = await acceptCliBridgeHandoffResponse.json();
    assert.equal(acceptCliBridgeHandoffJson.success, true);
    assert.equal(acceptCliBridgeHandoffJson.handoff.status, "accepted");
    assert.equal(acceptCliBridgeHandoffJson.handoff.reviewAction, "accept");
    assert.equal(acceptCliBridgeHandoffJson.linkedRun.id, createAgentWorkOrderRunJson.run.id);
    assert.equal(acceptCliBridgeHandoffJson.linkedRun.latestCliBridgeReviewAction, "accept");
    assert.equal(acceptCliBridgeHandoffJson.linkedRun.latestCliBridgeReviewStatus, "accepted");
    assert.equal(acceptCliBridgeHandoffJson.ledger.total, 1);

    const acceptedCliBridgeHandoffsResponse = await fetch(`${baseUrl}/api/cli-bridge/handoffs?runner=all&status=accepted&limit=5`);
    assert.equal(acceptedCliBridgeHandoffsResponse.status, 200);
    const acceptedCliBridgeHandoffsJson = await acceptedCliBridgeHandoffsResponse.json();
    assert.equal(acceptedCliBridgeHandoffsJson.status, "accepted");
    assert.equal(acceptedCliBridgeHandoffsJson.total, 1);
    assert.equal(acceptedCliBridgeHandoffsJson.summary.accepted, 1);
    assert.match(acceptedCliBridgeHandoffsJson.markdown, /Status filter: accepted/);
    assert.match(acceptedCliBridgeHandoffsJson.markdown, /Target baseline audit baseline:/);

    const acceptedCliBridgeWorkOrderDraftResponse = await fetch(`${baseUrl}/api/cli-bridge/handoffs/${createCliBridgeHandoffJson.handoff.id}/work-order-draft?runner=claude`);
    assert.equal(acceptedCliBridgeWorkOrderDraftResponse.status, 200);
    const acceptedCliBridgeWorkOrderDraftJson = await acceptedCliBridgeWorkOrderDraftResponse.json();
    assert.equal(acceptedCliBridgeWorkOrderDraftJson.protocolVersion, "cli-bridge-follow-up-work-order-draft.v1");
    assert.equal(acceptedCliBridgeWorkOrderDraftJson.executionMode, "non-executing");
    assert.equal(acceptedCliBridgeWorkOrderDraftJson.runner, "claude");
    assert.equal(acceptedCliBridgeWorkOrderDraftJson.handoffId, createCliBridgeHandoffJson.handoff.id);
    assert.equal(acceptedCliBridgeWorkOrderDraftJson.sourceHandoff.status, "accepted");
    assert.ok(acceptedCliBridgeWorkOrderDraftJson.sourceHandoff.targetBaselineAuditLedgerBaselineHealth);
    assert.match(acceptedCliBridgeWorkOrderDraftJson.draft.prompt, /Codex completed the bounded fixture implementation slice/);
    assert.match(acceptedCliBridgeWorkOrderDraftJson.markdown, /# CLI Bridge Follow-up Work-Order Draft/);

    const queueCliBridgeWorkOrderRunResponse = await fetch(`${baseUrl}/api/cli-bridge/handoffs/${createCliBridgeHandoffJson.handoff.id}/work-order-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "claude",
        notes: "Fixture queued a CLI bridge follow-up work-order run.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(queueCliBridgeWorkOrderRunResponse.status, 200);
    const queueCliBridgeWorkOrderRunJson = await queueCliBridgeWorkOrderRunResponse.json();
    assert.equal(queueCliBridgeWorkOrderRunJson.success, true);
    assert.equal(queueCliBridgeWorkOrderRunJson.run.cliBridgeHandoffId, createCliBridgeHandoffJson.handoff.id);
    assert.equal(queueCliBridgeWorkOrderRunJson.run.cliBridgeRunner, "claude");
    assert.equal(queueCliBridgeWorkOrderRunJson.run.profileTargetTaskLedgerBaselineHealth, "missing");
    assert.ok(["healthy", "missing", "stale", "drifted", "drift-review-required"].includes(queueCliBridgeWorkOrderRunJson.run.targetBaselineAuditLedgerBaselineHealth));
    assert.equal(queueCliBridgeWorkOrderRunJson.run.status, "queued");
    assert.match(queueCliBridgeWorkOrderRunJson.run.notes, /Fixture queued/);

    const claudeCliBridgeHandoffsResponse = await fetch(`${baseUrl}/api/cli-bridge/handoffs?runner=claude&limit=5`);
    assert.equal(claudeCliBridgeHandoffsResponse.status, 200);
    const claudeCliBridgeHandoffsJson = await claudeCliBridgeHandoffsResponse.json();
    assert.equal(claudeCliBridgeHandoffsJson.total, 1);
    assert.equal(claudeCliBridgeHandoffsJson.items[0].targetRunner, "claude");
    assert.ok(claudeCliBridgeHandoffsJson.items[0].targetBaselineAuditLedgerBaselineHealth);
    assert.match(claudeCliBridgeHandoffsJson.markdown, /Codex implementation handoff for Claude review/);
    assert.match(claudeCliBridgeHandoffsJson.markdown, /Target baseline audit baseline:/);

    const governanceAfterCliBridgeHandoffResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterCliBridgeHandoffResponse.status, 200);
    const governanceAfterCliBridgeHandoffJson = await governanceAfterCliBridgeHandoffResponse.json();
    assert.equal(governanceAfterCliBridgeHandoffJson.summary.cliBridgeHandoffCount, 1);
    assert.equal(governanceAfterCliBridgeHandoffJson.cliBridgeHandoffs.length, 1);
    assert.equal(governanceAfterCliBridgeHandoffJson.cliBridgeHandoffs[0].sourceRunner, "codex");
    assert.equal(governanceAfterCliBridgeHandoffJson.cliBridgeHandoffs[0].followUpWorkOrderRunId, queueCliBridgeWorkOrderRunJson.run.id);
    assert.equal(governanceAfterCliBridgeHandoffJson.cliBridgeHandoffs[0].followUpWorkOrderRunner, "claude");
    assert.ok(governanceAfterCliBridgeHandoffJson.cliBridgeHandoffs[0].targetBaselineAuditLedgerBaselineHealth);
    assert.ok(governanceAfterCliBridgeHandoffJson.operationLog.some((operation) => operation.type === "cli-bridge-handoff-recorded"));

    const createCliBridgeRunnerResultResponse = await fetch(`${baseUrl}/api/cli-bridge/runner-results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "claude",
        workOrderRunId: createAgentWorkOrderRunJson.run.id,
        status: "changed",
        summary: "Claude reviewed the bounded fixture result and recommends operator acceptance after validation.",
        changedFiles: ["src/index.js"],
        validationResults: "Fixture validation passed after runner review.",
        blockers: [],
        handoffRecommendation: "operator",
        nextAction: "Operator should review and accept or request a follow-up work order.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(createCliBridgeRunnerResultResponse.status, 200);
    const createCliBridgeRunnerResultJson = await createCliBridgeRunnerResultResponse.json();
    assert.equal(createCliBridgeRunnerResultJson.success, true);
    assert.equal(createCliBridgeRunnerResultJson.handoff.sourceRunner, "claude");
    assert.equal(createCliBridgeRunnerResultJson.handoff.targetRunner, "operator");
    assert.equal(createCliBridgeRunnerResultJson.handoff.resultStatus, "changed");
    assert.equal(createCliBridgeRunnerResultJson.handoff.handoffRecommendation, "operator");
    assert.ok(createCliBridgeRunnerResultJson.handoff.targetBaselineAuditLedgerBaselineHealth);
    assert.equal(createCliBridgeRunnerResultJson.linkedRun.id, createAgentWorkOrderRunJson.run.id);
    assert.equal(createCliBridgeRunnerResultJson.linkedRun.latestCliBridgeResultHandoffId, createCliBridgeRunnerResultJson.handoff.id);
    assert.equal(createCliBridgeRunnerResultJson.linkedRun.latestCliBridgeResultStatus, "changed");
    assert.equal(createCliBridgeRunnerResultJson.linkedRun.latestCliBridgeResultRunner, "claude");
    assert.equal(createCliBridgeRunnerResultJson.ledger.total, 2);
    assert.ok(createCliBridgeRunnerResultJson.ledger.markdown.includes("runner-result:changed"));
    assert.ok(createCliBridgeRunnerResultJson.ledger.markdown.includes("Target baseline audit baseline:"));

    const escalateCliBridgeRunnerResultResponse = await fetch(`${baseUrl}/api/cli-bridge/handoffs/${createCliBridgeRunnerResultJson.handoff.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "escalate",
        createTask: true,
        note: "Fixture operator escalated the runner result for follow-up.",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(escalateCliBridgeRunnerResultResponse.status, 200);
    const escalateCliBridgeRunnerResultJson = await escalateCliBridgeRunnerResultResponse.json();
    assert.equal(escalateCliBridgeRunnerResultJson.success, true);
    assert.equal(escalateCliBridgeRunnerResultJson.handoff.status, "needs-review");
    assert.equal(escalateCliBridgeRunnerResultJson.handoff.reviewAction, "escalate");
    assert.equal(escalateCliBridgeRunnerResultJson.linkedRun.id, createAgentWorkOrderRunJson.run.id);
    assert.equal(escalateCliBridgeRunnerResultJson.linkedRun.latestCliBridgeReviewAction, "escalate");
    assert.equal(escalateCliBridgeRunnerResultJson.linkedRun.latestCliBridgeReviewStatus, "needs-review");
    assert.equal(escalateCliBridgeRunnerResultJson.createdTask.cliBridgeHandoffId, createCliBridgeRunnerResultJson.handoff.id);
    assert.match(escalateCliBridgeRunnerResultJson.createdTask.secretPolicy, /Non-secret CLI bridge handoff review task/);

    const needsReviewCliBridgeHandoffsResponse = await fetch(`${baseUrl}/api/cli-bridge/handoffs?runner=all&status=needs-review&limit=5`);
    assert.equal(needsReviewCliBridgeHandoffsResponse.status, 200);
    const needsReviewCliBridgeHandoffsJson = await needsReviewCliBridgeHandoffsResponse.json();
    assert.equal(needsReviewCliBridgeHandoffsJson.status, "needs-review");
    assert.equal(needsReviewCliBridgeHandoffsJson.total, 1);
    assert.equal(needsReviewCliBridgeHandoffsJson.available, 2);
    assert.equal(needsReviewCliBridgeHandoffsJson.summary.reviewQueue, 1);
    assert.equal(needsReviewCliBridgeHandoffsJson.items[0].reviewAction, "escalate");
    assert.ok(needsReviewCliBridgeHandoffsJson.items[0].targetBaselineAuditLedgerBaselineHealth);

    const escalatedCliBridgeWorkOrderDraftResponse = await fetch(`${baseUrl}/api/cli-bridge/handoffs/${createCliBridgeRunnerResultJson.handoff.id}/work-order-draft?runner=codex`);
    assert.equal(escalatedCliBridgeWorkOrderDraftResponse.status, 200);
    const escalatedCliBridgeWorkOrderDraftJson = await escalatedCliBridgeWorkOrderDraftResponse.json();
    assert.equal(escalatedCliBridgeWorkOrderDraftJson.runner, "codex");
    assert.equal(escalatedCliBridgeWorkOrderDraftJson.draftDecision, "review");
    assert.equal(escalatedCliBridgeWorkOrderDraftJson.sourceHandoff.reviewAction, "escalate");
    assert.ok(escalatedCliBridgeWorkOrderDraftJson.sourceHandoff.targetBaselineAuditLedgerBaselineHealth);
    assert.ok(escalatedCliBridgeWorkOrderDraftJson.reasons.some((reason) => reason.code === "cli-bridge-handoff-not-accepted"));
    assert.match(escalatedCliBridgeWorkOrderDraftJson.markdown, /Do not free-chat with another runner/);

    const governanceAfterCliBridgeRunnerResultResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterCliBridgeRunnerResultResponse.status, 200);
    const governanceAfterCliBridgeRunnerResultJson = await governanceAfterCliBridgeRunnerResultResponse.json();
    assert.equal(governanceAfterCliBridgeRunnerResultJson.summary.cliBridgeHandoffCount, 2);
    assert.equal(governanceAfterCliBridgeRunnerResultJson.summary.cliBridgeHandoffAcceptedCount, 1);
    assert.equal(governanceAfterCliBridgeRunnerResultJson.summary.cliBridgeHandoffNeedsReviewCount, 1);
    assert.equal(governanceAfterCliBridgeRunnerResultJson.summary.cliBridgeHandoffReviewQueueCount, 1);
    assert.equal(governanceAfterCliBridgeRunnerResultJson.summary.cliBridgeHandoffEscalatedCount, 1);
    assert.equal(governanceAfterCliBridgeRunnerResultJson.cliBridgeHandoffs[0].status, "needs-review");
    const cliBridgeResultLinkedRun = governanceAfterCliBridgeRunnerResultJson.agentWorkOrderRuns.find((run) => run.id === createAgentWorkOrderRunJson.run.id);
    assert.equal(cliBridgeResultLinkedRun.latestCliBridgeResultHandoffId, createCliBridgeRunnerResultJson.handoff.id);
    assert.equal(cliBridgeResultLinkedRun.latestCliBridgeResultStatus, "changed");
    assert.equal(cliBridgeResultLinkedRun.latestCliBridgeReviewAction, "escalate");
    assert.equal(cliBridgeResultLinkedRun.latestCliBridgeReviewStatus, "needs-review");
    assert.ok(governanceAfterCliBridgeRunnerResultJson.operationLog.some((operation) => operation.type === "cli-bridge-runner-result-recorded"));
    assert.ok(governanceAfterCliBridgeRunnerResultJson.operationLog.some((operation) => operation.type === "cli-bridge-runner-result-linked-to-run"));
    assert.ok(governanceAfterCliBridgeRunnerResultJson.operationLog.some((operation) => operation.type === "cli-bridge-handoff-review-recorded"));
    assert.ok(governanceAfterCliBridgeRunnerResultJson.operationLog.some((operation) => operation.type === "cli-bridge-handoff-review-linked-to-run"));
    assert.ok(governanceAfterCliBridgeRunnerResultJson.operationLog.some((operation) => operation.type === "cli-bridge-handoff-review-task-created"));
    assert.ok(governanceAfterCliBridgeRunnerResultJson.operationLog.some((operation) => operation.type === "cli-bridge-follow-up-work-order-run-queued"));

    const cliBridgeRunTraceResponse = await fetch(`${baseUrl}/api/cli-bridge/runs/${createAgentWorkOrderRunJson.run.id}/trace`);
    assert.equal(cliBridgeRunTraceResponse.status, 200);
    const cliBridgeRunTraceJson = await cliBridgeRunTraceResponse.json();
    assert.equal(cliBridgeRunTraceJson.protocolVersion, "cli-bridge-run-trace.v1");
    assert.equal(cliBridgeRunTraceJson.executionMode, "non-executing");
    assert.equal(cliBridgeRunTraceJson.runId, createAgentWorkOrderRunJson.run.id);
    assert.equal(cliBridgeRunTraceJson.traceDecision, "ready");
    assert.equal(cliBridgeRunTraceJson.profileTargetTaskLedgerBaselineHealth, "missing");
    assert.equal(cliBridgeRunTraceJson.profileTargetTaskLedgerBaselineUncheckpointedDriftCount, 0);
    assert.ok(["healthy", "missing", "stale", "drifted", "drift-review-required"].includes(cliBridgeRunTraceJson.targetBaselineAuditLedgerBaselineHealth));
    assert.ok(["fresh", "missing", "stale"].includes(cliBridgeRunTraceJson.targetBaselineAuditLedgerBaselineFreshness));
    assert.ok(cliBridgeRunTraceJson.relatedHandoffCount >= 2);
    assert.match(cliBridgeRunTraceJson.markdown, /# CLI Bridge Run Trace/);
    assert.match(cliBridgeRunTraceJson.markdown, /Profile Target Task Baseline/);
    assert.match(cliBridgeRunTraceJson.markdown, /Target Baseline Audit Snapshot/);
    assert.match(cliBridgeRunTraceJson.markdown, /CLI bridge handoff review recorded/);

    const cliBridgeRunTraceSnapshotResponse = await fetch(`${baseUrl}/api/cli-bridge/runs/${createAgentWorkOrderRunJson.run.id}/trace-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture CLI bridge run trace",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(cliBridgeRunTraceSnapshotResponse.status, 200);
    const cliBridgeRunTraceSnapshotJson = await cliBridgeRunTraceSnapshotResponse.json();
    assert.equal(cliBridgeRunTraceSnapshotJson.snapshot.title, "Fixture CLI bridge run trace");
    assert.equal(cliBridgeRunTraceSnapshotJson.snapshot.runId, createAgentWorkOrderRunJson.run.id);
    assert.equal(cliBridgeRunTraceSnapshotJson.snapshot.traceDecision, "ready");
    assert.equal(cliBridgeRunTraceSnapshotJson.snapshot.profileTargetTaskLedgerBaselineHealth, "missing");
    assert.equal(cliBridgeRunTraceSnapshotJson.snapshot.targetBaselineAuditLedgerBaselineHealth, cliBridgeRunTraceJson.targetBaselineAuditLedgerBaselineHealth);
    assert.equal(cliBridgeRunTraceSnapshotJson.snapshot.relatedHandoffCount, cliBridgeRunTraceJson.relatedHandoffCount);
    assert.equal(cliBridgeRunTraceSnapshotJson.snapshot.secretPolicy, cliBridgeRunTraceJson.secretPolicy);
    assert.match(cliBridgeRunTraceSnapshotJson.snapshot.markdown, /# CLI Bridge Run Trace/);
    assert.ok(cliBridgeRunTraceSnapshotJson.cliBridgeRunTraceSnapshots.some((snapshot) => snapshot.id === cliBridgeRunTraceSnapshotJson.snapshot.id));

    const cliBridgeRunTraceSnapshotsResponse = await fetch(`${baseUrl}/api/cli-bridge/run-trace-snapshots`);
    assert.equal(cliBridgeRunTraceSnapshotsResponse.status, 200);
    const cliBridgeRunTraceSnapshotsJson = await cliBridgeRunTraceSnapshotsResponse.json();
    assert.equal(cliBridgeRunTraceSnapshotsJson.length, 1);
    assert.equal(cliBridgeRunTraceSnapshotsJson[0].runId, createAgentWorkOrderRunJson.run.id);

    const governanceAfterCliBridgeRunTraceSnapshotResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterCliBridgeRunTraceSnapshotResponse.status, 200);
    const governanceAfterCliBridgeRunTraceSnapshotJson = await governanceAfterCliBridgeRunTraceSnapshotResponse.json();
    assert.equal(governanceAfterCliBridgeRunTraceSnapshotJson.summary.cliBridgeRunTraceSnapshotCount, 1);
    assert.equal(governanceAfterCliBridgeRunTraceSnapshotJson.cliBridgeRunTraceSnapshots[0].id, cliBridgeRunTraceSnapshotJson.snapshot.id);
    assert.ok(governanceAfterCliBridgeRunTraceSnapshotJson.operationLog.some((operation) => operation.type === "cli-bridge-run-trace-snapshot-created"));

    const cliBridgeRunTraceSnapshotDiffResponse = await fetch(`${baseUrl}/api/cli-bridge/run-trace-snapshots/diff`);
    assert.equal(cliBridgeRunTraceSnapshotDiffResponse.status, 200);
    const cliBridgeRunTraceSnapshotDiffJson = await cliBridgeRunTraceSnapshotDiffResponse.json();
    assert.equal(cliBridgeRunTraceSnapshotDiffJson.status, "ready");
    assert.equal(cliBridgeRunTraceSnapshotDiffJson.snapshotId, cliBridgeRunTraceSnapshotJson.snapshot.id);
    assert.equal(cliBridgeRunTraceSnapshotDiffJson.runId, createAgentWorkOrderRunJson.run.id);
    assert.equal(cliBridgeRunTraceSnapshotDiffJson.hasDrift, false);
    assert.equal(cliBridgeRunTraceSnapshotDiffJson.driftScore, 0);
    assert.equal(cliBridgeRunTraceSnapshotDiffJson.driftSeverity, "none");
    assert.match(cliBridgeRunTraceSnapshotDiffJson.markdown, /# CLI Bridge Run Trace Snapshot Drift/);

    const cliBridgeRunTraceSnapshotBaselineStatusResponse = await fetch(`${baseUrl}/api/cli-bridge/run-trace-snapshots/baseline-status`);
    assert.equal(cliBridgeRunTraceSnapshotBaselineStatusResponse.status, 200);
    const cliBridgeRunTraceSnapshotBaselineStatusJson = await cliBridgeRunTraceSnapshotBaselineStatusResponse.json();
    assert.equal(cliBridgeRunTraceSnapshotBaselineStatusJson.hasBaseline, true);
    assert.equal(cliBridgeRunTraceSnapshotBaselineStatusJson.baselineSnapshotId, cliBridgeRunTraceSnapshotJson.snapshot.id);
    assert.equal(cliBridgeRunTraceSnapshotBaselineStatusJson.snapshotId, cliBridgeRunTraceSnapshotJson.snapshot.id);
    assert.equal(cliBridgeRunTraceSnapshotBaselineStatusJson.runId, createAgentWorkOrderRunJson.run.id);
    assert.equal(cliBridgeRunTraceSnapshotBaselineStatusJson.freshness, "fresh");
    assert.equal(cliBridgeRunTraceSnapshotBaselineStatusJson.health, "healthy");
    assert.equal(cliBridgeRunTraceSnapshotBaselineStatusJson.driftScore, 0);
    assert.equal(cliBridgeRunTraceSnapshotBaselineStatusJson.driftSeverity, "none");
    assert.match(cliBridgeRunTraceSnapshotBaselineStatusJson.markdown, /# CLI Bridge Run Trace Baseline Status/);

    const cliBridgeRunTraceSnapshotLifecycleLedgerResponse = await fetch(`${baseUrl}/api/cli-bridge/run-trace-snapshots/lifecycle-ledger`);
    assert.equal(cliBridgeRunTraceSnapshotLifecycleLedgerResponse.status, 200);
    const cliBridgeRunTraceSnapshotLifecycleLedgerJson = await cliBridgeRunTraceSnapshotLifecycleLedgerResponse.json();
    assert.equal(cliBridgeRunTraceSnapshotLifecycleLedgerJson.summary.total, 1);
    assert.equal(cliBridgeRunTraceSnapshotLifecycleLedgerJson.summary.visible, 1);
    assert.equal(cliBridgeRunTraceSnapshotLifecycleLedgerJson.summary.ready, 1);
    assert.equal(cliBridgeRunTraceSnapshotLifecycleLedgerJson.items[0].snapshotId, cliBridgeRunTraceSnapshotJson.snapshot.id);
    assert.equal(cliBridgeRunTraceSnapshotLifecycleLedgerJson.items[0].runId, createAgentWorkOrderRunJson.run.id);
    assert.equal(cliBridgeRunTraceSnapshotLifecycleLedgerJson.items[0].traceDecision, "ready");
    assert.match(cliBridgeRunTraceSnapshotLifecycleLedgerJson.markdown, /run trace lifecycle ledger/i);

    const cliBridgeLifecycleStackStatusResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-status`);
    assert.equal(cliBridgeLifecycleStackStatusResponse.status, 200);
    const cliBridgeLifecycleStackStatusJson = await cliBridgeLifecycleStackStatusResponse.json();
    assert.ok(["ready", "review", "hold"].includes(cliBridgeLifecycleStackStatusJson.decision));
    assert.ok(Array.isArray(cliBridgeLifecycleStackStatusJson.stages));
    assert.equal(cliBridgeLifecycleStackStatusJson.stages.length, 5);
    assert.ok(cliBridgeLifecycleStackStatusJson.stages.some((stage) => stage.id === "remediation-task-ledger-baseline"));
    assert.equal(cliBridgeLifecycleStackStatusJson.remediationTaskLedgerBaselineStatus.refreshGateDecision, "ready");
    assert.ok(["ready", "review", "hold"].includes(cliBridgeLifecycleStackStatusJson.handoffGate.decision));
    assert.equal(cliBridgeLifecycleStackStatusJson.handoffGate.allowed, cliBridgeLifecycleStackStatusJson.decision === "ready");
    assert.equal(cliBridgeLifecycleStackStatusJson.handoffGate.checklist.length, 5);
    assert.match(cliBridgeLifecycleStackStatusJson.markdown, /lifecycle stack status/i);

    const cliBridgeLifecycleStackRemediationPackResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-remediation-pack`);
    assert.equal(cliBridgeLifecycleStackRemediationPackResponse.status, 200);
    const cliBridgeLifecycleStackRemediationPackJson = await cliBridgeLifecycleStackRemediationPackResponse.json();
    assert.equal(cliBridgeLifecycleStackRemediationPackJson.nonReadyCount, cliBridgeLifecycleStackStatusJson.stages.filter((stage) => stage.decision !== "ready").length);
    assert.equal(cliBridgeLifecycleStackRemediationPackJson.workItemCount, cliBridgeLifecycleStackRemediationPackJson.workItems.length);
    assert.match(cliBridgeLifecycleStackRemediationPackJson.markdown, /lifecycle stack remediation pack/i);

    const cliBridgeLifecycleStackRemediationTaskLedgerResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-remediation-task-ledger`);
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerResponse.status, 200);
    const cliBridgeLifecycleStackRemediationTaskLedgerJson = await cliBridgeLifecycleStackRemediationTaskLedgerResponse.json();
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerJson.summary.total, 0);
    assert.ok(Array.isArray(cliBridgeLifecycleStackRemediationTaskLedgerJson.items));
    assert.match(cliBridgeLifecycleStackRemediationTaskLedgerJson.markdown, /lifecycle stack remediation task ledger/i);

    const initialCliBridgeLifecycleStackRemediationTaskLedgerSnapshotsResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-remediation-task-ledger-snapshots`);
    assert.equal(initialCliBridgeLifecycleStackRemediationTaskLedgerSnapshotsResponse.status, 200);
    const initialCliBridgeLifecycleStackRemediationTaskLedgerSnapshotsJson = await initialCliBridgeLifecycleStackRemediationTaskLedgerSnapshotsResponse.json();
    assert.equal(initialCliBridgeLifecycleStackRemediationTaskLedgerSnapshotsJson.length, 0);

    const unscopedCliBridgeLifecycleStackRemediationTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-remediation-task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture unscoped CLI Bridge Lifecycle Remediation Task Ledger",
        status: "all",
        limit: 100
      })
    });
    assert.equal(unscopedCliBridgeLifecycleStackRemediationTaskLedgerSnapshotResponse.status, 409);
    const unscopedCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson = await unscopedCliBridgeLifecycleStackRemediationTaskLedgerSnapshotResponse.json();
    assert.equal(unscopedCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createCliBridgeLifecycleStackRemediationTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-remediation-task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture CLI Bridge Lifecycle Remediation Task Ledger",
        status: "all",
        limit: 100,
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(createCliBridgeLifecycleStackRemediationTaskLedgerSnapshotResponse.status, 200);
    const createCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson = await createCliBridgeLifecycleStackRemediationTaskLedgerSnapshotResponse.json();
    assert.equal(createCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.success, true);
    assert.equal(createCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.snapshot.title, "Fixture CLI Bridge Lifecycle Remediation Task Ledger");
    assert.equal(createCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.snapshot.statusFilter, "all");
    assert.equal(createCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.snapshot.total, 0);
    assert.match(createCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.snapshot.markdown, /lifecycle stack remediation task ledger/i);

    const cliBridgeLifecycleStackRemediationTaskLedgerSnapshotsResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-remediation-task-ledger-snapshots`);
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerSnapshotsResponse.status, 200);
    const cliBridgeLifecycleStackRemediationTaskLedgerSnapshotsJson = await cliBridgeLifecycleStackRemediationTaskLedgerSnapshotsResponse.json();
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerSnapshotsJson.length, 1);
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerSnapshotsJson[0].title, "Fixture CLI Bridge Lifecycle Remediation Task Ledger");

    const governanceAfterCliBridgeLifecycleStackRemediationTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterCliBridgeLifecycleStackRemediationTaskLedgerSnapshotResponse.status, 200);
    const governanceAfterCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson = await governanceAfterCliBridgeLifecycleStackRemediationTaskLedgerSnapshotResponse.json();
    assert.equal(governanceAfterCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.summary.cliBridgeLifecycleStackRemediationTaskLedgerSnapshotCount, 1);
    assert.equal(governanceAfterCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.cliBridgeLifecycleStackRemediationTaskLedgerSnapshots[0].title, "Fixture CLI Bridge Lifecycle Remediation Task Ledger");
    assert.ok(governanceAfterCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.operationLog.some((operation) => operation.type === "cli-bridge-lifecycle-stack-remediation-task-ledger-snapshot-created"));

    const cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiffResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-remediation-task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiffResponse.status, 200);
    const cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiffJson = await cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiffResponse.json();
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiffJson.hasSnapshot, true);
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiffJson.hasDrift, false);
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiffJson.driftSeverity, "none");
    assert.match(cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiffJson.markdown, /# CLI Bridge Lifecycle Stack Remediation Task Ledger Snapshot Drift/);

    const cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-remediation-task-ledger-snapshots/baseline-status`);
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusResponse.status, 200);
    const cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson = await cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusResponse.json();
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.hasBaseline, true);
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.baselineSnapshotId, createCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.snapshot.id);
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.health, "healthy");
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.freshness, "fresh");
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.driftScore, 0);
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.checkpointedDriftItemCount, 0);
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.refreshGateDecision, "ready");
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.refreshAllowed, true);
    assert.ok(cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.refreshGateReasons.length >= 1);
    assert.match(cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.markdown, /# CLI Bridge Lifecycle Stack Remediation Task Ledger Baseline Status/);

    const unscopedCliBridgeLifecycleHandoffPacketResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-handoff-packet?runner=codex&limit=25`);
    assert.equal(unscopedCliBridgeLifecycleHandoffPacketResponse.status, 200);
    const unscopedCliBridgeLifecycleHandoffPacketJson = await unscopedCliBridgeLifecycleHandoffPacketResponse.json();
    assert.equal(unscopedCliBridgeLifecycleHandoffPacketJson.packetDecision, "hold");
    assert.equal(unscopedCliBridgeLifecycleHandoffPacketJson.readyToLaunch, false);
    assert.equal(unscopedCliBridgeLifecycleHandoffPacketJson.scopeContext.scopeReady, false);
    assert.equal(unscopedCliBridgeLifecycleHandoffPacketJson.scopeContext.guardDecision, "project-required");
    assert.match(unscopedCliBridgeLifecycleHandoffPacketJson.markdown, /Scope Context/);

    const cliBridgeLifecycleHandoffPacketScopeParams = "activeProjectId=alpha-app&scopeMode=project";
    const cliBridgeLifecycleHandoffPacketScopePayload = {
      activeProjectId: "alpha-app",
      scopeMode: "project"
    };
    const cliBridgeLifecycleHandoffPacketResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-handoff-packet?runner=codex&limit=25&${cliBridgeLifecycleHandoffPacketScopeParams}`);
    assert.equal(cliBridgeLifecycleHandoffPacketResponse.status, 200);
    const cliBridgeLifecycleHandoffPacketJson = await cliBridgeLifecycleHandoffPacketResponse.json();
    assert.equal(cliBridgeLifecycleHandoffPacketJson.protocolVersion, "cli-bridge-lifecycle-handoff-packet.v1");
    assert.equal(cliBridgeLifecycleHandoffPacketJson.runner, "codex");
    assert.equal(cliBridgeLifecycleHandoffPacketJson.scopeContext.scopeMode, "project");
    assert.equal(cliBridgeLifecycleHandoffPacketJson.scopeContext.activeProjectId, "alpha-app");
    assert.equal(cliBridgeLifecycleHandoffPacketJson.scopeContext.scopeReady, true);
    assert.equal(cliBridgeLifecycleHandoffPacketJson.scopeContext.guardDecision, "project-ready");
    assert.ok(["ready", "review", "hold"].includes(cliBridgeLifecycleHandoffPacketJson.packetDecision));
    assert.equal(cliBridgeLifecycleHandoffPacketJson.readyToLaunch, cliBridgeLifecycleHandoffPacketJson.handoffGate.allowed === true && cliBridgeLifecycleHandoffPacketJson.packetDecision === "ready");
    assert.equal(cliBridgeLifecycleHandoffPacketJson.handoffGate.checklist.length, 5);
    assert.equal(cliBridgeLifecycleHandoffPacketJson.lifecycleStackStatus.stages.length, 5);
    assert.equal(cliBridgeLifecycleHandoffPacketJson.remediationTaskLedgerBaselineStatus.refreshGateDecision, "ready");
    assert.ok(Array.isArray(cliBridgeLifecycleHandoffPacketJson.runnerInstructions));
    assert.ok(Array.isArray(cliBridgeLifecycleHandoffPacketJson.validationLoop));
    assert.match(cliBridgeLifecycleHandoffPacketJson.markdown, /# CLI Bridge Lifecycle Handoff Packet/);

    const initialCliBridgeLifecycleHandoffPacketSnapshotsResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-handoff-packet-snapshots`);
    assert.equal(initialCliBridgeLifecycleHandoffPacketSnapshotsResponse.status, 200);
    const initialCliBridgeLifecycleHandoffPacketSnapshotsJson = await initialCliBridgeLifecycleHandoffPacketSnapshotsResponse.json();
    assert.equal(initialCliBridgeLifecycleHandoffPacketSnapshotsJson.length, 0);

    const missingCliBridgeLifecycleHandoffPacketBaselineStatusResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-handoff-packet-snapshots/baseline-status?${cliBridgeLifecycleHandoffPacketScopeParams}`);
    assert.equal(missingCliBridgeLifecycleHandoffPacketBaselineStatusResponse.status, 200);
    const missingCliBridgeLifecycleHandoffPacketBaselineStatusJson = await missingCliBridgeLifecycleHandoffPacketBaselineStatusResponse.json();
    assert.equal(missingCliBridgeLifecycleHandoffPacketBaselineStatusJson.hasBaseline, false);
    assert.equal(missingCliBridgeLifecycleHandoffPacketBaselineStatusJson.health, "missing");
    assert.equal(missingCliBridgeLifecycleHandoffPacketBaselineStatusJson.reuseGateDecision, "hold");
    assert.equal(missingCliBridgeLifecycleHandoffPacketBaselineStatusJson.refreshGateDecision, "ready");
    assert.equal(missingCliBridgeLifecycleHandoffPacketBaselineStatusJson.refreshAllowed, true);
    assert.match(missingCliBridgeLifecycleHandoffPacketBaselineStatusJson.markdown, /CLI Bridge Lifecycle Handoff Packet Baseline Status/);

    const unscopedCliBridgeLifecycleHandoffPacketSnapshotResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-handoff-packet-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture unscoped CLI Bridge Lifecycle Handoff Packet",
        runner: "codex",
        limit: 25
      })
    });
    assert.equal(unscopedCliBridgeLifecycleHandoffPacketSnapshotResponse.status, 409);
    const unscopedCliBridgeLifecycleHandoffPacketSnapshotJson = await unscopedCliBridgeLifecycleHandoffPacketSnapshotResponse.json();
    assert.equal(unscopedCliBridgeLifecycleHandoffPacketSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createCliBridgeLifecycleHandoffPacketSnapshotResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-handoff-packet-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture CLI Bridge Lifecycle Handoff Packet",
        runner: "codex",
        limit: 25,
        ...cliBridgeLifecycleHandoffPacketScopePayload
      })
    });
    assert.equal(createCliBridgeLifecycleHandoffPacketSnapshotResponse.status, 200);
    const createCliBridgeLifecycleHandoffPacketSnapshotJson = await createCliBridgeLifecycleHandoffPacketSnapshotResponse.json();
    assert.equal(createCliBridgeLifecycleHandoffPacketSnapshotJson.success, true);
    assert.equal(createCliBridgeLifecycleHandoffPacketSnapshotJson.snapshot.title, "Fixture CLI Bridge Lifecycle Handoff Packet");
    assert.equal(createCliBridgeLifecycleHandoffPacketSnapshotJson.snapshot.runner, "codex");
    assert.equal(createCliBridgeLifecycleHandoffPacketSnapshotJson.snapshot.scopeMode, "project");
    assert.equal(createCliBridgeLifecycleHandoffPacketSnapshotJson.snapshot.activeProjectId, "alpha-app");
    assert.equal(createCliBridgeLifecycleHandoffPacketSnapshotJson.snapshot.scopeReady, true);
    assert.equal(createCliBridgeLifecycleHandoffPacketSnapshotJson.snapshot.protocolVersion, "cli-bridge-lifecycle-handoff-packet.v1");
    assert.equal(createCliBridgeLifecycleHandoffPacketSnapshotJson.snapshot.packetDecision, cliBridgeLifecycleHandoffPacketJson.packetDecision);
    assert.match(createCliBridgeLifecycleHandoffPacketSnapshotJson.snapshot.markdown, /# CLI Bridge Lifecycle Handoff Packet/);

    const cliBridgeLifecycleHandoffPacketSnapshotsResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-handoff-packet-snapshots`);
    assert.equal(cliBridgeLifecycleHandoffPacketSnapshotsResponse.status, 200);
    const cliBridgeLifecycleHandoffPacketSnapshotsJson = await cliBridgeLifecycleHandoffPacketSnapshotsResponse.json();
    assert.equal(cliBridgeLifecycleHandoffPacketSnapshotsJson.length, 1);
    assert.equal(cliBridgeLifecycleHandoffPacketSnapshotsJson[0].title, "Fixture CLI Bridge Lifecycle Handoff Packet");

    const governanceAfterCliBridgeLifecycleHandoffPacketSnapshotResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterCliBridgeLifecycleHandoffPacketSnapshotResponse.status, 200);
    const governanceAfterCliBridgeLifecycleHandoffPacketSnapshotJson = await governanceAfterCliBridgeLifecycleHandoffPacketSnapshotResponse.json();
    assert.equal(governanceAfterCliBridgeLifecycleHandoffPacketSnapshotJson.summary.cliBridgeLifecycleHandoffPacketSnapshotCount, 1);
    assert.equal(governanceAfterCliBridgeLifecycleHandoffPacketSnapshotJson.cliBridgeLifecycleHandoffPacketSnapshots[0].title, "Fixture CLI Bridge Lifecycle Handoff Packet");
    assert.ok(governanceAfterCliBridgeLifecycleHandoffPacketSnapshotJson.operationLog.some((operation) => operation.type === "cli-bridge-lifecycle-handoff-packet-snapshot-created"));

    const cliBridgeLifecycleHandoffPacketSnapshotDiffResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-handoff-packet-snapshots/diff?snapshotId=latest&runner=codex&${cliBridgeLifecycleHandoffPacketScopeParams}`);
    assert.equal(cliBridgeLifecycleHandoffPacketSnapshotDiffResponse.status, 200);
    const cliBridgeLifecycleHandoffPacketSnapshotDiffJson = await cliBridgeLifecycleHandoffPacketSnapshotDiffResponse.json();
    assert.equal(cliBridgeLifecycleHandoffPacketSnapshotDiffJson.hasSnapshot, true);
    assert.equal(cliBridgeLifecycleHandoffPacketSnapshotDiffJson.snapshotId, createCliBridgeLifecycleHandoffPacketSnapshotJson.snapshot.id);
    assert.equal(cliBridgeLifecycleHandoffPacketSnapshotDiffJson.runner, "codex");
    assert.equal(cliBridgeLifecycleHandoffPacketSnapshotDiffJson.hasDrift, false);
    assert.equal(cliBridgeLifecycleHandoffPacketSnapshotDiffJson.driftScore, 0);
    assert.equal(cliBridgeLifecycleHandoffPacketSnapshotDiffJson.driftSeverity, "none");
    assert.match(cliBridgeLifecycleHandoffPacketSnapshotDiffJson.markdown, /# CLI Bridge Lifecycle Handoff Packet Snapshot Drift/);

    const cliBridgeLifecycleHandoffPacketBaselineStatusResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-handoff-packet-snapshots/baseline-status?${cliBridgeLifecycleHandoffPacketScopeParams}`);
    assert.equal(cliBridgeLifecycleHandoffPacketBaselineStatusResponse.status, 200);
    const cliBridgeLifecycleHandoffPacketBaselineStatusJson = await cliBridgeLifecycleHandoffPacketBaselineStatusResponse.json();
    assert.equal(cliBridgeLifecycleHandoffPacketBaselineStatusJson.hasBaseline, true);
    assert.equal(cliBridgeLifecycleHandoffPacketBaselineStatusJson.baselineSnapshotId, createCliBridgeLifecycleHandoffPacketSnapshotJson.snapshot.id);
    assert.equal(cliBridgeLifecycleHandoffPacketBaselineStatusJson.health, "healthy");
    assert.equal(cliBridgeLifecycleHandoffPacketBaselineStatusJson.freshness, "fresh");
    assert.equal(cliBridgeLifecycleHandoffPacketBaselineStatusJson.driftScore, 0);
    assert.equal(cliBridgeLifecycleHandoffPacketBaselineStatusJson.reuseGateDecision, "ready");
    assert.equal(cliBridgeLifecycleHandoffPacketBaselineStatusJson.reuseAllowed, true);
    assert.equal(cliBridgeLifecycleHandoffPacketBaselineStatusJson.refreshGateDecision, "ready");
    assert.equal(cliBridgeLifecycleHandoffPacketBaselineStatusJson.refreshAllowed, true);
    assert.match(cliBridgeLifecycleHandoffPacketBaselineStatusJson.markdown, /# CLI Bridge Lifecycle Handoff Packet Baseline Status/);

    const createCliBridgeLifecycleRemediationFixtureTaskResponse = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "cli-bridge",
        projectName: "CLI Bridge",
        title: "Fixture CLI Bridge Lifecycle Remediation Follow-up",
        description: "CLI Bridge Lifecycle remediation follow-up.\nStage ID: fixture-cli-stage",
        priority: "high",
        status: "resolved",
        ...taskMutationScope
      })
    });
    assert.equal(createCliBridgeLifecycleRemediationFixtureTaskResponse.status, 200);
    const createCliBridgeLifecycleRemediationFixtureTaskJson = await createCliBridgeLifecycleRemediationFixtureTaskResponse.json();
    assert.equal(createCliBridgeLifecycleRemediationFixtureTaskJson.success, true);

    const cliBridgeLifecycleHandoffPacketSnapshotDriftAfterTaskResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-handoff-packet-snapshots/diff?snapshotId=latest&runner=codex&${cliBridgeLifecycleHandoffPacketScopeParams}`);
    assert.equal(cliBridgeLifecycleHandoffPacketSnapshotDriftAfterTaskResponse.status, 200);
    const cliBridgeLifecycleHandoffPacketSnapshotDriftAfterTaskJson = await cliBridgeLifecycleHandoffPacketSnapshotDriftAfterTaskResponse.json();
    assert.equal(cliBridgeLifecycleHandoffPacketSnapshotDriftAfterTaskJson.hasDrift, true);
    const cliBridgeLifecycleHandoffPacketDriftField = cliBridgeLifecycleHandoffPacketSnapshotDriftAfterTaskJson.driftItems[0]?.field;
    assert.ok(cliBridgeLifecycleHandoffPacketDriftField);

    const unscopedCliBridgeLifecycleHandoffPacketDriftCheckpointResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-handoff-packet-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createCliBridgeLifecycleHandoffPacketSnapshotJson.snapshot.id,
        runner: "codex",
        field: cliBridgeLifecycleHandoffPacketDriftField,
        decision: "confirmed",
        note: "Fixture unscoped handoff packet drift checkpoint should be blocked."
      })
    });
    assert.equal(unscopedCliBridgeLifecycleHandoffPacketDriftCheckpointResponse.status, 409);
    const unscopedCliBridgeLifecycleHandoffPacketDriftCheckpointJson = await unscopedCliBridgeLifecycleHandoffPacketDriftCheckpointResponse.json();
    assert.equal(unscopedCliBridgeLifecycleHandoffPacketDriftCheckpointJson.reasonCode, "agent-execution-scope-required");

    const cliBridgeLifecycleHandoffPacketDriftCheckpointResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-handoff-packet-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createCliBridgeLifecycleHandoffPacketSnapshotJson.snapshot.id,
        runner: "codex",
        ...cliBridgeLifecycleHandoffPacketScopePayload,
        field: cliBridgeLifecycleHandoffPacketDriftField,
        decision: "confirmed",
        note: "Fixture non-secret handoff packet drift checkpoint"
      })
    });
    assert.equal(cliBridgeLifecycleHandoffPacketDriftCheckpointResponse.status, 200);
    const cliBridgeLifecycleHandoffPacketDriftCheckpointJson = await cliBridgeLifecycleHandoffPacketDriftCheckpointResponse.json();
    assert.equal(cliBridgeLifecycleHandoffPacketDriftCheckpointJson.success, true);
    assert.equal(cliBridgeLifecycleHandoffPacketDriftCheckpointJson.decision, "confirmed");
    assert.equal(cliBridgeLifecycleHandoffPacketDriftCheckpointJson.task.sourceType, "cli-bridge-lifecycle-handoff-packet-snapshot-drift-checkpoint");
    assert.equal(cliBridgeLifecycleHandoffPacketDriftCheckpointJson.task.secretPolicy, "non-secret-cli-bridge-lifecycle-handoff-packet-drift-checkpoint-only");
    assert.equal(cliBridgeLifecycleHandoffPacketDriftCheckpointJson.task.status, "resolved");

    const cliBridgeLifecycleHandoffPacketDriftCheckpointLedgerResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-handoff-packet-drift-checkpoint-ledger?status=all`);
    assert.equal(cliBridgeLifecycleHandoffPacketDriftCheckpointLedgerResponse.status, 200);
    const cliBridgeLifecycleHandoffPacketDriftCheckpointLedgerJson = await cliBridgeLifecycleHandoffPacketDriftCheckpointLedgerResponse.json();
    assert.equal(cliBridgeLifecycleHandoffPacketDriftCheckpointLedgerJson.summary.total, 1);
    assert.equal(cliBridgeLifecycleHandoffPacketDriftCheckpointLedgerJson.summary.confirmed, 1);
    assert.match(cliBridgeLifecycleHandoffPacketDriftCheckpointLedgerJson.markdown, /CLI Bridge Lifecycle Handoff Packet Drift Checkpoint Ledger/);

    const cliBridgeLifecycleHandoffPacketSnapshotDriftAfterCheckpointResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-handoff-packet-snapshots/diff?snapshotId=latest&runner=codex&${cliBridgeLifecycleHandoffPacketScopeParams}`);
    assert.equal(cliBridgeLifecycleHandoffPacketSnapshotDriftAfterCheckpointResponse.status, 200);
    const cliBridgeLifecycleHandoffPacketSnapshotDriftAfterCheckpointJson = await cliBridgeLifecycleHandoffPacketSnapshotDriftAfterCheckpointResponse.json();
    const checkpointedCliBridgeLifecycleHandoffPacketDriftItem = cliBridgeLifecycleHandoffPacketSnapshotDriftAfterCheckpointJson.driftItems.find((item) => item.field === cliBridgeLifecycleHandoffPacketDriftField);
    assert.equal(checkpointedCliBridgeLifecycleHandoffPacketDriftItem.checkpointDecision, "confirmed");
    assert.equal(checkpointedCliBridgeLifecycleHandoffPacketDriftItem.checkpointStatus, "resolved");

    const driftedCliBridgeLifecycleHandoffPacketBaselineStatusResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-handoff-packet-snapshots/baseline-status?${cliBridgeLifecycleHandoffPacketScopeParams}`);
    assert.equal(driftedCliBridgeLifecycleHandoffPacketBaselineStatusResponse.status, 200);
    const driftedCliBridgeLifecycleHandoffPacketBaselineStatusJson = await driftedCliBridgeLifecycleHandoffPacketBaselineStatusResponse.json();
    assert.equal(driftedCliBridgeLifecycleHandoffPacketBaselineStatusJson.hasBaseline, true);
    assert.equal(driftedCliBridgeLifecycleHandoffPacketBaselineStatusJson.hasDrift, true);
    assert.ok(["healthy", "changed", "drifted"].includes(driftedCliBridgeLifecycleHandoffPacketBaselineStatusJson.health));
    assert.ok(driftedCliBridgeLifecycleHandoffPacketBaselineStatusJson.driftItemCount >= 1);
    assert.ok(driftedCliBridgeLifecycleHandoffPacketBaselineStatusJson.checkpointedDriftItemCount >= 1);
    assert.ok(["ready", "review", "hold"].includes(driftedCliBridgeLifecycleHandoffPacketBaselineStatusJson.reuseGateDecision));
    assert.ok(["ready", "review", "hold"].includes(driftedCliBridgeLifecycleHandoffPacketBaselineStatusJson.refreshGateDecision));
    assert.equal(typeof driftedCliBridgeLifecycleHandoffPacketBaselineStatusJson.refreshAllowed, "boolean");
    assert.ok(driftedCliBridgeLifecycleHandoffPacketBaselineStatusJson.refreshGateReasons.length >= 1);

    const invalidScopeRefreshCliBridgeLifecycleHandoffPacketSnapshotResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-handoff-packet-snapshots/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createCliBridgeLifecycleHandoffPacketSnapshotJson.snapshot.id,
        title: "Fixture invalid-scope CLI Bridge Lifecycle Handoff Packet",
        runner: "codex",
        limit: 25,
        activeProjectId: "beta-app",
        scopeMode: "project"
      })
    });
    assert.equal(invalidScopeRefreshCliBridgeLifecycleHandoffPacketSnapshotResponse.status, 409);
    const invalidScopeRefreshCliBridgeLifecycleHandoffPacketSnapshotJson = await invalidScopeRefreshCliBridgeLifecycleHandoffPacketSnapshotResponse.json();
    assert.equal(invalidScopeRefreshCliBridgeLifecycleHandoffPacketSnapshotJson.reasonCode, "agent-execution-scope-required");
    assert.equal(invalidScopeRefreshCliBridgeLifecycleHandoffPacketSnapshotJson.scopeContext.guardDecision, "project-required");

    const refreshCliBridgeLifecycleHandoffPacketSnapshotResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-handoff-packet-snapshots/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createCliBridgeLifecycleHandoffPacketSnapshotJson.snapshot.id,
        title: "Fixture Refreshed CLI Bridge Lifecycle Handoff Packet",
        runner: "codex",
        limit: 25,
        ...cliBridgeLifecycleHandoffPacketScopePayload
      })
    });
    assert.equal(refreshCliBridgeLifecycleHandoffPacketSnapshotResponse.status, 200);
    const refreshCliBridgeLifecycleHandoffPacketSnapshotJson = await refreshCliBridgeLifecycleHandoffPacketSnapshotResponse.json();
    assert.equal(refreshCliBridgeLifecycleHandoffPacketSnapshotJson.success, true);
    assert.equal(refreshCliBridgeLifecycleHandoffPacketSnapshotJson.previousSnapshotId, createCliBridgeLifecycleHandoffPacketSnapshotJson.snapshot.id);
    assert.equal(refreshCliBridgeLifecycleHandoffPacketSnapshotJson.snapshot.title, "Fixture Refreshed CLI Bridge Lifecycle Handoff Packet");
    assert.equal(refreshCliBridgeLifecycleHandoffPacketSnapshotJson.snapshot.runner, "codex");
    assert.equal(refreshCliBridgeLifecycleHandoffPacketSnapshotJson.cliBridgeLifecycleHandoffPacketSnapshots.length, 2);

    const refreshedCliBridgeLifecycleHandoffPacketSnapshotDiffResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-handoff-packet-snapshots/diff?snapshotId=latest&runner=codex&${cliBridgeLifecycleHandoffPacketScopeParams}`);
    assert.equal(refreshedCliBridgeLifecycleHandoffPacketSnapshotDiffResponse.status, 200);
    const refreshedCliBridgeLifecycleHandoffPacketSnapshotDiffJson = await refreshedCliBridgeLifecycleHandoffPacketSnapshotDiffResponse.json();
    assert.equal(refreshedCliBridgeLifecycleHandoffPacketSnapshotDiffJson.hasDrift, false);
    assert.equal(refreshedCliBridgeLifecycleHandoffPacketSnapshotDiffJson.driftSeverity, "none");

    const refreshedCliBridgeLifecycleHandoffPacketBaselineStatusResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-handoff-packet-snapshots/baseline-status?${cliBridgeLifecycleHandoffPacketScopeParams}`);
    assert.equal(refreshedCliBridgeLifecycleHandoffPacketBaselineStatusResponse.status, 200);
    const refreshedCliBridgeLifecycleHandoffPacketBaselineStatusJson = await refreshedCliBridgeLifecycleHandoffPacketBaselineStatusResponse.json();
    assert.equal(refreshedCliBridgeLifecycleHandoffPacketBaselineStatusJson.baselineSnapshotId, refreshCliBridgeLifecycleHandoffPacketSnapshotJson.snapshot.id);
    assert.equal(refreshedCliBridgeLifecycleHandoffPacketBaselineStatusJson.health, "healthy");
    assert.equal(refreshedCliBridgeLifecycleHandoffPacketBaselineStatusJson.driftScore, 0);
    assert.equal(refreshedCliBridgeLifecycleHandoffPacketBaselineStatusJson.refreshGateDecision, "ready");
    assert.equal(refreshedCliBridgeLifecycleHandoffPacketBaselineStatusJson.refreshAllowed, true);

    const governanceAfterCliBridgeLifecycleHandoffPacketRefreshResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterCliBridgeLifecycleHandoffPacketRefreshResponse.status, 200);
    const governanceAfterCliBridgeLifecycleHandoffPacketRefreshJson = await governanceAfterCliBridgeLifecycleHandoffPacketRefreshResponse.json();
    assert.ok(governanceAfterCliBridgeLifecycleHandoffPacketRefreshJson.operationLog.some((operation) => operation.type === "cli-bridge-lifecycle-handoff-packet-snapshot-refreshed"));

    const cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDriftAfterTaskResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-remediation-task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDriftAfterTaskResponse.status, 200);
    const cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDriftAfterTaskJson = await cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDriftAfterTaskResponse.json();
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDriftAfterTaskJson.hasDrift, true);
    assert.ok(cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDriftAfterTaskJson.driftItems.some((item) => item.field === "total"));

    const unscopedCliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-remediation-task-ledger-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.snapshot.id,
        status: "all",
        field: "total",
        decision: "escalated",
        note: "Fixture unscoped remediation ledger drift checkpoint should be blocked."
      })
    });
    assert.equal(unscopedCliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointResponse.status, 409);
    const unscopedCliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointJson = await unscopedCliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointResponse.json();
    assert.equal(unscopedCliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointJson.reasonCode, "agent-execution-scope-required");

    const cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-remediation-task-ledger-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.snapshot.id,
        status: "all",
        field: "total",
        decision: "escalated",
        note: "Fixture non-secret drift checkpoint",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointResponse.status, 200);
    const cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointJson = await cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointResponse.json();
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointJson.success, true);
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointJson.decision, "escalated");
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointJson.task.sourceType, "cli-bridge-lifecycle-stack-remediation-task-ledger-snapshot-drift-checkpoint");
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointJson.task.secretPolicy, "non-secret-cli-bridge-lifecycle-stack-remediation-task-ledger-drift-checkpoint-only");
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointJson.task.status, "blocked");

    const cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedgerResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-remediation-task-ledger-drift-checkpoint-ledger?status=open`);
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedgerResponse.status, 200);
    const cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedgerJson = await cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedgerResponse.json();
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedgerJson.summary.visible, 1);
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedgerJson.summary.openEscalated, 1);
    assert.match(cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedgerJson.markdown, /CLI Bridge Lifecycle Stack Remediation Task Ledger Drift Checkpoint Ledger/);

    const cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDriftAfterCheckpointResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-remediation-task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDriftAfterCheckpointResponse.status, 200);
    const cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDriftAfterCheckpointJson = await cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDriftAfterCheckpointResponse.json();
    const checkpointedCliBridgeLifecycleTaskLedgerDriftItem = cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDriftAfterCheckpointJson.driftItems.find((item) => item.field === "total");
    assert.equal(checkpointedCliBridgeLifecycleTaskLedgerDriftItem.checkpointDecision, "escalated");
    assert.equal(checkpointedCliBridgeLifecycleTaskLedgerDriftItem.checkpointStatus, "blocked");

    const driftedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-remediation-task-ledger-snapshots/baseline-status`);
    assert.equal(driftedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusResponse.status, 200);
    const driftedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson = await driftedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusResponse.json();
    assert.equal(driftedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.hasBaseline, true);
    assert.equal(driftedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.hasDrift, true);
    assert.ok(["changed", "drifted"].includes(driftedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.health));
    assert.ok(driftedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.driftItemCount >= 1);
    assert.ok(driftedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.checkpointedDriftItemCount >= 1);
    assert.equal(driftedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.openEscalatedCheckpointCount, 1);
    assert.equal(driftedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.refreshGateDecision, "hold");
    assert.equal(driftedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.refreshAllowed, false);
    assert.ok(driftedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.refreshGateReasons.some((reason) => /drift field/i.test(reason)));

    const unscopedRefreshCliBridgeLifecycleStackRemediationTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-remediation-task-ledger-snapshots/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.snapshot.id,
        title: "Fixture unscoped refreshed CLI Bridge Lifecycle Remediation Task Ledger",
        status: "all",
        limit: 100
      })
    });
    assert.equal(unscopedRefreshCliBridgeLifecycleStackRemediationTaskLedgerSnapshotResponse.status, 409);
    const unscopedRefreshCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson = await unscopedRefreshCliBridgeLifecycleStackRemediationTaskLedgerSnapshotResponse.json();
    assert.equal(unscopedRefreshCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.reasonCode, "agent-execution-scope-required");

    const refreshCliBridgeLifecycleStackRemediationTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-remediation-task-ledger-snapshots/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.snapshot.id,
        title: "Fixture Refreshed CLI Bridge Lifecycle Remediation Task Ledger",
        status: "all",
        limit: 100,
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(refreshCliBridgeLifecycleStackRemediationTaskLedgerSnapshotResponse.status, 200);
    const refreshCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson = await refreshCliBridgeLifecycleStackRemediationTaskLedgerSnapshotResponse.json();
    assert.equal(refreshCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.success, true);
    assert.equal(refreshCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.previousSnapshotId, createCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.snapshot.id);
    assert.equal(refreshCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.snapshot.title, "Fixture Refreshed CLI Bridge Lifecycle Remediation Task Ledger");
    assert.equal(refreshCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.snapshot.statusFilter, "all");
    assert.equal(refreshCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.snapshot.total, 1);
    assert.equal(refreshCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.cliBridgeLifecycleStackRemediationTaskLedgerSnapshots.length, 2);

    const refreshedCliBridgeLifecycleStackRemediationTaskLedgerSnapshotDriftResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-remediation-task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(refreshedCliBridgeLifecycleStackRemediationTaskLedgerSnapshotDriftResponse.status, 200);
    const refreshedCliBridgeLifecycleStackRemediationTaskLedgerSnapshotDriftJson = await refreshedCliBridgeLifecycleStackRemediationTaskLedgerSnapshotDriftResponse.json();
    assert.equal(refreshedCliBridgeLifecycleStackRemediationTaskLedgerSnapshotDriftJson.hasDrift, false);
    assert.equal(refreshedCliBridgeLifecycleStackRemediationTaskLedgerSnapshotDriftJson.driftSeverity, "none");

    const refreshedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-remediation-task-ledger-snapshots/baseline-status`);
    assert.equal(refreshedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusResponse.status, 200);
    const refreshedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson = await refreshedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusResponse.json();
    assert.equal(refreshedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.baselineSnapshotId, refreshCliBridgeLifecycleStackRemediationTaskLedgerSnapshotJson.snapshot.id);
    assert.equal(refreshedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.health, "healthy");
    assert.equal(refreshedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.driftScore, 0);
    assert.equal(refreshedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.refreshGateDecision, "ready");
    assert.equal(refreshedCliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusJson.refreshAllowed, true);

    const resolveCliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointResponse = await fetch(`${baseUrl}/api/tasks/${encodeURIComponent(cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointJson.task.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved", ...taskMutationScope })
    });
    assert.equal(resolveCliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointResponse.status, 200);
    const resolvedCliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedgerResponse = await fetch(`${baseUrl}/api/cli-bridge/lifecycle-stack-remediation-task-ledger-drift-checkpoint-ledger?status=closed`);
    assert.equal(resolvedCliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedgerResponse.status, 200);
    const resolvedCliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedgerJson = await resolvedCliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedgerResponse.json();
    assert.equal(resolvedCliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedgerJson.summary.visible, 1);
    assert.equal(resolvedCliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedgerJson.summary.closed, 1);

    const initialAgentControlPlaneSnapshotsResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots`);
    assert.equal(initialAgentControlPlaneSnapshotsResponse.status, 200);
    const initialAgentControlPlaneSnapshotsJson = await initialAgentControlPlaneSnapshotsResponse.json();
    assert.equal(initialAgentControlPlaneSnapshotsJson.length, 0);

    const initialAgentControlPlaneDecisionSnapshotsResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision-snapshots`);
    assert.equal(initialAgentControlPlaneDecisionSnapshotsResponse.status, 200);
    const initialAgentControlPlaneDecisionSnapshotsJson = await initialAgentControlPlaneDecisionSnapshotsResponse.json();
    assert.equal(initialAgentControlPlaneDecisionSnapshotsJson.length, 0);

    const initialAgentControlPlaneBaselineStatusResponse = await fetch(`${baseUrl}/api/agent-control-plane/baseline-status`);
    assert.equal(initialAgentControlPlaneBaselineStatusResponse.status, 200);
    const initialAgentControlPlaneBaselineStatusJson = await initialAgentControlPlaneBaselineStatusResponse.json();
    assert.equal(initialAgentControlPlaneBaselineStatusJson.hasBaseline, false);
    assert.equal(initialAgentControlPlaneBaselineStatusJson.baselineFreshness, "missing");
    assert.equal(initialAgentControlPlaneBaselineStatusJson.baselineAgeHours, 0);
    assert.equal(initialAgentControlPlaneBaselineStatusJson.health, "missing");
    assert.match(initialAgentControlPlaneBaselineStatusJson.recommendedAction, /Save or mark/);
    assert.equal(initialAgentControlPlaneBaselineStatusJson.driftScore, 0);
    assert.equal(initialAgentControlPlaneBaselineStatusJson.driftSeverity, "missing-baseline");
    assert.match(initialAgentControlPlaneBaselineStatusJson.driftRecommendedAction, /Save or mark/);
    assert.deepEqual(initialAgentControlPlaneBaselineStatusJson.driftItems, []);
    assert.match(initialAgentControlPlaneBaselineStatusJson.markdown, /Baseline selected: no/);
    assert.match(initialAgentControlPlaneBaselineStatusJson.markdown, /Health: missing/);
    assert.match(initialAgentControlPlaneBaselineStatusJson.markdown, /Drift severity: missing-baseline/);

    const initialAgentControlPlaneDecisionResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision`);
    assert.equal(initialAgentControlPlaneDecisionResponse.status, 200);
    const initialAgentControlPlaneDecisionJson = await initialAgentControlPlaneDecisionResponse.json();
    assert.equal(initialAgentControlPlaneDecisionJson.decision, "hold");
    assert.equal(initialAgentControlPlaneDecisionJson.baselineDriftSeverity, "missing-baseline");
    assert.equal(initialAgentControlPlaneDecisionJson.releaseBuildGateDecision, "review");
    assert.ok(initialAgentControlPlaneDecisionJson.releaseBuildGateReasonCount >= 1);
    assert.ok(initialAgentControlPlaneDecisionJson.releaseBuildGate.reasons.some((reason) => reason.code === "git-unavailable"));
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesGateDecision, "ready");
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesReview, 0);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessGate.decision, "ready");
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessReviewQueueCount, 0);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessReviewQueue.summary.total, 0);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationMethodCount, 1);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationSourceCount, 1);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationReviewCount, 0);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationBlockedCount, 0);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationRunbook.summary.methodCount, 1);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationWorkflowTotalCount, 1);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationWorkflowReadyCount, 1);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationWorkflowPendingCount, 0);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationWorkflowBlockedCount, 0);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationWorkflowMissingEvidenceCount, 0);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourceAccessValidationWorkflowSnapshotCount, 1);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourceAccessValidationWorkflowSnapshotHasDrift, true);
    assert.ok(initialAgentControlPlaneDecisionJson.dataSourceAccessValidationWorkflowSnapshotDriftScore > 0);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourceAccessValidationWorkflowSnapshotDriftSeverity, "low");
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationWorkflow.summary.ready, 1);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourceAccessValidationWorkflowSnapshots.length, 1);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourceAccessValidationWorkflowSnapshotDiff.hasDrift, true);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationEvidenceCount, 1);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationEvidenceValidatedCount, 1);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationEvidenceReviewCount, 0);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationEvidenceBlockedCount, 0);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationEvidenceCoverageCount, 1);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationEvidenceCoverageCoveredCount, 1);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationEvidenceCoverageMissingCount, 0);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationEvidenceCoveragePercent, 100);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessValidationEvidenceCoverage.items[0].coverageStatus, "covered");
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourceAccessValidationEvidenceSnapshotCount, 1);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourceAccessValidationEvidence.length, 1);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessTaskCount, 0);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessOpenTaskCount, 0);
    assert.equal(initialAgentControlPlaneDecisionJson.dataSourcesAccessClosedTaskCount, 0);
    assert.deepEqual(initialAgentControlPlaneDecisionJson.dataSourcesAccessTasks, []);
    assert.ok(initialAgentControlPlaneDecisionJson.agentExecutionTargetBaselineAuditBaselineReviewRequiredCount >= 1);
    assert.equal(typeof initialAgentControlPlaneDecisionJson.agentExecutionTargetBaselineAuditBaselineMissingCount, "number");
    assert.ok(["healthy", "missing", "stale", "drifted", "drift-review-required"].includes(initialAgentControlPlaneDecisionJson.regressionAlertBaselineLedgerBaselineHealth));
    assert.equal(typeof initialAgentControlPlaneDecisionJson.regressionAlertBaselineLedgerBaselineUncheckpointedDriftCount, "number");
    assert.equal(initialAgentControlPlaneDecisionJson.regressionAlertTaskLedgerBaselineHealth, "missing");
    assert.equal(initialAgentControlPlaneDecisionJson.regressionAlertTaskLedgerBaselineRefreshGateDecision, "ready");
    assert.equal(initialAgentControlPlaneDecisionJson.regressionAlertTaskLedgerBaselineUncheckpointedDriftCount, 0);
    assert.equal(initialAgentControlPlaneDecisionJson.regressionAlertTaskLedgerBaselineOpenEscalatedCheckpointCount, 0);
    assert.ok(initialAgentControlPlaneDecisionJson.reasons.some((reason) => reason.code === "baseline-missing"));
    assert.ok(initialAgentControlPlaneDecisionJson.reasons.some((reason) => reason.code === "regression-alert-task-baseline-missing"));
    assert.ok(initialAgentControlPlaneDecisionJson.reasons.some((reason) => reason.code === "execution-audit-baseline-review"));
    assert.ok(initialAgentControlPlaneDecisionJson.reasons.some((reason) => reason.code === "release-build-gate-review"));
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /# Agent Control Plane Decision/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /Decision: hold/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /Regression Alert Baseline Snapshot/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /Regression Alert baseline snapshot health:/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /Regression Alert task baseline health: missing/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /## Regression Alert Task Baseline/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /Execution run audit snapshot baseline:/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /Release build gate: review/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /## Release Build Gate/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /Data Sources access gate: ready/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /Data Sources access validation methods: 1 across 1 source/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /Data Sources access validation workflow: 1 ready \/ 0 pending \/ 0 blocked/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /Data Sources access validation workflow snapshots: 1/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /Data Sources access validation evidence: 1 validated \/ 1 total/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /Data Sources access validation evidence coverage: 1 covered \/ 1 source/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /Data Sources access validation evidence snapshots: 1/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /Data Sources access tasks: 0 open \/ 0 total/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /## Data Sources Access Review Queue/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /## Data Sources Access Validation Runbook/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /## Data Sources Access Validation Workflow/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /## Data Sources Access Validation Evidence Coverage/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /## Data Sources Access Validation Evidence/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /## Data Sources Access Tasks/);

    const unscopedAgentControlPlaneDecisionSnapshotResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Unscoped Control Plane Decision" })
    });
    assert.equal(unscopedAgentControlPlaneDecisionSnapshotResponse.status, 409);
    const unscopedAgentControlPlaneDecisionSnapshotJson = await unscopedAgentControlPlaneDecisionSnapshotResponse.json();
    assert.equal(unscopedAgentControlPlaneDecisionSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createAgentControlPlaneDecisionSnapshotResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Control Plane Decision",
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(createAgentControlPlaneDecisionSnapshotResponse.status, 200);
    const createAgentControlPlaneDecisionSnapshotJson = await createAgentControlPlaneDecisionSnapshotResponse.json();
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.success, true);
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.title, "Fixture Control Plane Decision");
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.decision, "hold");
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.baselineDriftSeverity, "missing-baseline");
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.releaseBuildGateDecision, "review");
    assert.ok(createAgentControlPlaneDecisionSnapshotJson.snapshot.releaseBuildGateReasonCount >= 1);
    assert.ok(createAgentControlPlaneDecisionSnapshotJson.snapshot.releaseBuildGate.reasons.some((reason) => reason.code === "git-unavailable"));
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.dataSourcesGateDecision, "ready");
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.dataSourcesAccessReviewQueueCount, 0);
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.dataSourcesAccessTaskCount, 0);
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.dataSourcesAccessOpenTaskCount, 0);
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.dataSourcesAccessValidationMethodCount, 1);
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.dataSourcesAccessValidationSourceCount, 1);
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.dataSourcesAccessValidationWorkflowTotalCount, 1);
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.dataSourcesAccessValidationWorkflowReadyCount, 1);
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.dataSourceAccessValidationWorkflowSnapshotCount, 1);
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.dataSourceAccessValidationWorkflowSnapshotDriftSeverity, "low");
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.dataSourcesAccessValidationEvidenceCount, 1);
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.dataSourcesAccessValidationEvidenceValidatedCount, 1);
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.dataSourcesAccessValidationEvidenceCoverageCount, 1);
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.dataSourcesAccessValidationEvidenceCoverageCoveredCount, 1);
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.dataSourcesAccessValidationEvidenceCoveragePercent, 100);
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.dataSourceAccessValidationEvidenceSnapshotCount, 1);
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.regressionAlertTaskLedgerBaselineHealth, "missing");
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.regressionAlertTaskLedgerBaselineRefreshGateDecision, "ready");
    assert.equal(createAgentControlPlaneDecisionSnapshotJson.snapshot.agentExecutionTargetBaselineAuditBaselineReviewRequiredCount, initialAgentControlPlaneDecisionJson.agentExecutionTargetBaselineAuditBaselineReviewRequiredCount);
    assert.match(createAgentControlPlaneDecisionSnapshotJson.snapshot.markdown, /# Agent Control Plane Decision/);
    assert.match(createAgentControlPlaneDecisionSnapshotJson.snapshot.markdown, /## Release Build Gate/);
    assert.match(createAgentControlPlaneDecisionSnapshotJson.snapshot.markdown, /## Data Sources Access Review Queue/);
    assert.match(createAgentControlPlaneDecisionSnapshotJson.snapshot.markdown, /## Data Sources Access Validation Runbook/);
    assert.match(createAgentControlPlaneDecisionSnapshotJson.snapshot.markdown, /## Data Sources Access Validation Workflow/);
    assert.match(createAgentControlPlaneDecisionSnapshotJson.snapshot.markdown, /## Data Sources Access Validation Evidence Coverage/);
    assert.match(createAgentControlPlaneDecisionSnapshotJson.snapshot.markdown, /## Data Sources Access Validation Evidence/);
    assert.match(createAgentControlPlaneDecisionSnapshotJson.snapshot.markdown, /## Data Sources Access Tasks/);

    const agentControlPlaneDecisionSnapshotsResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision-snapshots`);
    assert.equal(agentControlPlaneDecisionSnapshotsResponse.status, 200);
    const agentControlPlaneDecisionSnapshotsJson = await agentControlPlaneDecisionSnapshotsResponse.json();
    assert.equal(agentControlPlaneDecisionSnapshotsJson.length, 1);
    assert.equal(agentControlPlaneDecisionSnapshotsJson[0].title, "Fixture Control Plane Decision");

    const missingBaselineDiffResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots/diff?snapshotId=baseline`);
    assert.equal(missingBaselineDiffResponse.status, 200);
    const missingBaselineDiffJson = await missingBaselineDiffResponse.json();
    assert.equal(missingBaselineDiffJson.hasBaseline, false);
    assert.equal(missingBaselineDiffJson.hasDrift, false);
    assert.equal(missingBaselineDiffJson.driftScore, 0);
    assert.equal(missingBaselineDiffJson.driftSeverity, "missing-baseline");
    assert.match(missingBaselineDiffJson.recommendedAction, /Save or mark/);
    assert.deepEqual(missingBaselineDiffJson.driftItems, []);
    assert.match(missingBaselineDiffJson.markdown, /Baseline selected: no/);
    assert.match(missingBaselineDiffJson.markdown, /Drift severity: missing-baseline/);
    assert.match(missingBaselineDiffJson.markdown, /## Drift Fields/);

    const unscopedAgentControlPlaneSnapshotResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture unscoped Agent Control Plane",
        limit: 5
      })
    });
    assert.equal(unscopedAgentControlPlaneSnapshotResponse.status, 409);
    const unscopedAgentControlPlaneSnapshotJson = await unscopedAgentControlPlaneSnapshotResponse.json();
    assert.equal(unscopedAgentControlPlaneSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createAgentControlPlaneSnapshotResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Agent Control Plane",
        limit: 5,
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(createAgentControlPlaneSnapshotResponse.status, 200);
    const createAgentControlPlaneSnapshotJson = await createAgentControlPlaneSnapshotResponse.json();
    assert.equal(createAgentControlPlaneSnapshotJson.success, true);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.title, "Fixture Agent Control Plane");
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.totalWorkOrders, 1);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.totalSlaLedgerRecords, 1);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.deploymentSmokeCheckCount, 2);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.deploymentSmokeCheckPassCount, 2);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.deploymentSmokeCheckFailCount, 0);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.deploymentSmokeChecks.length, 2);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.releaseCheckpointCount, 2);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.releaseCheckpoints.length, 2);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.releaseBuildGateDecision, "review");
    assert.ok(createAgentControlPlaneSnapshotJson.snapshot.releaseBuildGateReasonCount >= 1);
    assert.ok(createAgentControlPlaneSnapshotJson.snapshot.releaseBuildGate.reasons.some((reason) => reason.code === "git-unavailable"));
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.dataSourcesGateDecision, "ready");
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.dataSourcesReview, 0);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.dataSourcesAccessReviewQueueCount, 0);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.dataSourcesAccessValidationMethodCount, 1);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.dataSourcesAccessValidationSourceCount, 1);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.dataSourcesAccessValidationWorkflowTotalCount, 1);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.dataSourcesAccessValidationWorkflowReadyCount, 1);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.dataSourcesAccessValidationWorkflowPendingCount, 0);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.dataSourceAccessValidationWorkflowSnapshotCount, 1);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.dataSourceAccessValidationWorkflowSnapshotDriftSeverity, "low");
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.dataSourcesAccessValidationEvidenceCount, 1);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.dataSourcesAccessValidationEvidenceValidatedCount, 1);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.dataSourcesAccessValidationEvidenceCoverageCount, 1);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.dataSourcesAccessValidationEvidenceCoverageCoveredCount, 1);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.dataSourcesAccessValidationEvidenceCoveragePercent, 100);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.dataSourceAccessValidationEvidenceSnapshotCount, 1);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.payload.dataSourcesAccessGate.decision, "ready");
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.payload.dataSourcesAccessReviewQueue.summary.total, 0);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.payload.dataSourcesAccessValidationEvidenceCoverage.items[0].coverageStatus, "covered");
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.payload.dataSourcesAccessValidationRunbook.summary.methodCount, 1);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.payload.dataSourcesAccessValidationWorkflow.summary.ready, 1);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.payload.dataSourceAccessValidationWorkflowSnapshots.length, 1);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.payload.dataSourceAccessValidationWorkflowSnapshotDiff.driftSeverity, "low");
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.payload.deploymentSmokeChecks[0].label, "Fixture release gate local app");
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.payload.releaseCheckpoints[0].title, "Fixture Release Gate Bootstrap");
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.payload.releaseBuildGate.decision, "review");
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.payload.governanceTaskUpdateLedgerSnapshots.length, 1);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.governanceTaskUpdateLedgerSnapshotCount, 1);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.payload.agentControlPlaneDecisionTaskLedgerSnapshots.length, 0);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.agentControlPlaneDecisionTaskLedgerSnapshotCount, 0);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.payload.dataSourceAccessValidationEvidence.length, 1);
    assert.equal(createAgentControlPlaneSnapshotJson.snapshot.payload.dataSourceAccessValidationEvidenceSnapshots.length, 1);
    assert.match(createAgentControlPlaneSnapshotJson.snapshot.markdown, /# Agent Control Plane/);
    assert.match(createAgentControlPlaneSnapshotJson.snapshot.markdown, /Audit snapshot baseline capture:/);
    assert.match(createAgentControlPlaneSnapshotJson.snapshot.markdown, /## Deployment Smoke Checks/);
    assert.match(createAgentControlPlaneSnapshotJson.snapshot.markdown, /## Release Checkpoints/);
    assert.match(createAgentControlPlaneSnapshotJson.snapshot.markdown, /## Release Build Gate/);
    assert.match(createAgentControlPlaneSnapshotJson.snapshot.markdown, /Governance task update audit ledger snapshots: 1/);
    assert.match(createAgentControlPlaneSnapshotJson.snapshot.markdown, /## Governance Task Update Audit Ledger Snapshots/);
    assert.match(createAgentControlPlaneSnapshotJson.snapshot.markdown, /Control Plane decision task ledger snapshots: 0/);
    assert.match(createAgentControlPlaneSnapshotJson.snapshot.markdown, /Data Sources access gate: ready/);
    assert.match(createAgentControlPlaneSnapshotJson.snapshot.markdown, /Data Sources access validation workflow snapshots: 1/);
    assert.match(createAgentControlPlaneSnapshotJson.snapshot.markdown, /## Data Sources Access Validation Workflow/);
    assert.match(createAgentControlPlaneSnapshotJson.snapshot.markdown, /## Data Sources Access Validation Workflow Snapshot Drift/);
    assert.match(createAgentControlPlaneSnapshotJson.snapshot.markdown, /## Data Sources Access Validation Runbook/);
    assert.match(createAgentControlPlaneSnapshotJson.snapshot.markdown, /## Data Sources Access Validation Evidence Coverage/);

    const agentControlPlaneSnapshotsResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots`);
    assert.equal(agentControlPlaneSnapshotsResponse.status, 200);
    const agentControlPlaneSnapshotsJson = await agentControlPlaneSnapshotsResponse.json();
    assert.equal(agentControlPlaneSnapshotsJson.length, 1);
    assert.equal(agentControlPlaneSnapshotsJson[0].title, "Fixture Agent Control Plane");

    const agentControlPlaneSnapshotDiffResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots/diff?snapshotId=${createAgentControlPlaneSnapshotJson.snapshot.id}`);
    assert.equal(agentControlPlaneSnapshotDiffResponse.status, 200);
    const agentControlPlaneSnapshotDiffJson = await agentControlPlaneSnapshotDiffResponse.json();
    assert.equal(agentControlPlaneSnapshotDiffJson.snapshotId, createAgentControlPlaneSnapshotJson.snapshot.id);
    assert.equal(agentControlPlaneSnapshotDiffJson.hasDrift, false);
    assert.equal(agentControlPlaneSnapshotDiffJson.driftScore, 0);
    assert.equal(agentControlPlaneSnapshotDiffJson.driftSeverity, "none");
    assert.match(agentControlPlaneSnapshotDiffJson.recommendedAction, /No snapshot drift detected/);
    assert.deepEqual(agentControlPlaneSnapshotDiffJson.driftItems, []);
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Data Sources gate rank" && item.before === 1 && item.current === 1));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Data Sources review sources" && item.before === 0 && item.current === 0));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Data Sources access review queue" && item.before === 0 && item.current === 0));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Data Sources access review medium priority" && item.before === 0 && item.current === 0));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Deployment smoke checks" && item.before === 2 && item.current === 2));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Deployment smoke check passes" && item.before === 2 && item.current === 2));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Deployment smoke check failures" && item.before === 0 && item.current === 0));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Release checkpoints" && item.before === 2 && item.current === 2));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Release build gate rank" && item.before === 2 && item.current === 2));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Release build gate reasons" && item.before === item.current && item.current >= 1));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Data Sources access validation methods" && item.before === 1 && item.current === 1));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Data Sources access validation sources" && item.before === 1 && item.current === 1));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Data Sources access validation evidence" && item.before === 1 && item.current === 1));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Data Sources access validation evidence validated" && item.before === 1 && item.current === 1));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Data Sources access validation evidence coverage" && item.before === 1 && item.current === 1));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Data Sources access validation evidence coverage covered" && item.before === 1 && item.current === 1));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Data Sources access validation evidence coverage percent" && item.before === 100 && item.current === 100));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Data Sources access validation evidence snapshots" && item.before === 1 && item.current === 1));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Data Sources access tasks" && item.before === 0 && item.current === 0));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Data Sources access task ledger snapshots" && item.before === 0 && item.current === 0));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Governance task update audit ledger snapshots" && item.before === 1 && item.current === 1));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Control Plane decision task ledger snapshots" && item.before === 0 && item.current === 0));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Audit snapshot baseline review runs" && item.before === item.current && item.current === createAgentControlPlaneSnapshotJson.snapshot.payload.agentExecutionMetrics.auditBaselineReviewRequired));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Audit snapshot baseline uncheckpointed drift items" && item.before === item.current));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Regression Alert baseline snapshot drift score" && item.before === item.current));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Regression Alert baseline snapshot uncheckpointed drift items" && item.before === item.current));
    assert.ok(agentControlPlaneSnapshotDiffJson.metricDeltas.some((item) => item.label === "Regression Alert baseline snapshots" && item.before === item.current && item.current >= 1));
    assert.equal(agentControlPlaneSnapshotDiffJson.readiness.addedCount, 0);
    assert.equal(agentControlPlaneSnapshotDiffJson.executionRuns.changedCount, 0);
    assert.match(agentControlPlaneSnapshotDiffJson.markdown, /# Agent Control Plane Snapshot Drift/);
    assert.match(agentControlPlaneSnapshotDiffJson.markdown, /Drift severity: none/);
    assert.match(agentControlPlaneSnapshotDiffJson.markdown, /## Drift Fields/);
    assert.match(agentControlPlaneSnapshotDiffJson.markdown, /Fixture Agent Control Plane/);

    const latestAgentControlPlaneSnapshotDiffResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots/diff?snapshotId=latest`);
    assert.equal(latestAgentControlPlaneSnapshotDiffResponse.status, 200);
    const latestAgentControlPlaneSnapshotDiffJson = await latestAgentControlPlaneSnapshotDiffResponse.json();
    assert.equal(latestAgentControlPlaneSnapshotDiffJson.snapshotId, createAgentControlPlaneSnapshotJson.snapshot.id);
    assert.equal(latestAgentControlPlaneSnapshotDiffJson.driftSeverity, "none");
    assert.deepEqual(latestAgentControlPlaneSnapshotDiffJson.driftItems, []);
    assert.match(latestAgentControlPlaneSnapshotDiffJson.markdown, /# Agent Control Plane Snapshot Drift/);

    const unscopedSetAgentControlPlaneBaselineResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots/baseline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createAgentControlPlaneSnapshotJson.snapshot.id
      })
    });
    assert.equal(unscopedSetAgentControlPlaneBaselineResponse.status, 409);
    const unscopedSetAgentControlPlaneBaselineJson = await unscopedSetAgentControlPlaneBaselineResponse.json();
    assert.equal(unscopedSetAgentControlPlaneBaselineJson.reasonCode, "agent-execution-scope-required");

    const setAgentControlPlaneBaselineResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots/baseline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createAgentControlPlaneSnapshotJson.snapshot.id,
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(setAgentControlPlaneBaselineResponse.status, 200);
    const setAgentControlPlaneBaselineJson = await setAgentControlPlaneBaselineResponse.json();
    assert.equal(setAgentControlPlaneBaselineJson.success, true);
    assert.equal(setAgentControlPlaneBaselineJson.baselineSnapshotId, createAgentControlPlaneSnapshotJson.snapshot.id);
    assert.equal(setAgentControlPlaneBaselineJson.snapshot.title, "Fixture Agent Control Plane");

    const baselineAgentControlPlaneSnapshotDiffResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots/diff?snapshotId=baseline`);
    assert.equal(baselineAgentControlPlaneSnapshotDiffResponse.status, 200);
    const baselineAgentControlPlaneSnapshotDiffJson = await baselineAgentControlPlaneSnapshotDiffResponse.json();
    assert.equal(baselineAgentControlPlaneSnapshotDiffJson.snapshotId, createAgentControlPlaneSnapshotJson.snapshot.id);
    assert.match(baselineAgentControlPlaneSnapshotDiffJson.markdown, /Fixture Agent Control Plane/);

    const createAgentControlPlaneBaselineSnapshotResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Baseline Control Plane",
        limit: 5,
        baseline: true,
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(createAgentControlPlaneBaselineSnapshotResponse.status, 200);
    const createAgentControlPlaneBaselineSnapshotJson = await createAgentControlPlaneBaselineSnapshotResponse.json();
    assert.equal(createAgentControlPlaneBaselineSnapshotJson.success, true);
    assert.equal(createAgentControlPlaneBaselineSnapshotJson.snapshot.title, "Fixture Baseline Control Plane");
    assert.equal(createAgentControlPlaneBaselineSnapshotJson.snapshot.isBaseline, true);
    assert.equal(createAgentControlPlaneBaselineSnapshotJson.baselineSnapshotId, createAgentControlPlaneBaselineSnapshotJson.snapshot.id);

    const refreshedBaselineAgentControlPlaneSnapshotDiffResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots/diff?snapshotId=baseline`);
    assert.equal(refreshedBaselineAgentControlPlaneSnapshotDiffResponse.status, 200);
    const refreshedBaselineAgentControlPlaneSnapshotDiffJson = await refreshedBaselineAgentControlPlaneSnapshotDiffResponse.json();
    assert.equal(refreshedBaselineAgentControlPlaneSnapshotDiffJson.snapshotId, createAgentControlPlaneBaselineSnapshotJson.snapshot.id);
    assert.match(refreshedBaselineAgentControlPlaneSnapshotDiffJson.markdown, /Fixture Baseline Control Plane/);

    const agentControlPlaneBaselineStatusResponse = await fetch(`${baseUrl}/api/agent-control-plane/baseline-status`);
    assert.equal(agentControlPlaneBaselineStatusResponse.status, 200);
    const agentControlPlaneBaselineStatusJson = await agentControlPlaneBaselineStatusResponse.json();
    assert.equal(agentControlPlaneBaselineStatusJson.hasBaseline, true);
    assert.equal(agentControlPlaneBaselineStatusJson.baselineSnapshotId, createAgentControlPlaneBaselineSnapshotJson.snapshot.id);
    assert.equal(agentControlPlaneBaselineStatusJson.snapshotTitle, "Fixture Baseline Control Plane");
    assert.equal(agentControlPlaneBaselineStatusJson.baselineFreshness, "fresh");
    assert.ok(agentControlPlaneBaselineStatusJson.baselineAgeHours >= 0);
    assert.equal(agentControlPlaneBaselineStatusJson.baselineFreshnessThresholdHours, 24);
    assert.equal(agentControlPlaneBaselineStatusJson.health, "healthy");
    assert.match(agentControlPlaneBaselineStatusJson.recommendedAction, /Continue monitoring/);
    assert.equal(agentControlPlaneBaselineStatusJson.driftScore, 0);
    assert.equal(agentControlPlaneBaselineStatusJson.driftSeverity, "none");
    assert.match(agentControlPlaneBaselineStatusJson.driftRecommendedAction, /No snapshot drift detected/);
    assert.deepEqual(agentControlPlaneBaselineStatusJson.driftItems, []);
    assert.match(agentControlPlaneBaselineStatusJson.markdown, /# Agent Control Plane Baseline Status/);
    assert.match(agentControlPlaneBaselineStatusJson.markdown, /Health: healthy/);
    assert.match(agentControlPlaneBaselineStatusJson.markdown, /Drift severity: none/);

    const governanceAfterAgentControlPlaneSnapshotResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterAgentControlPlaneSnapshotResponse.status, 200);
    const governanceAfterAgentControlPlaneSnapshotJson = await governanceAfterAgentControlPlaneSnapshotResponse.json();
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.summary.agentControlPlaneSnapshotCount, 2);
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.summary.agentControlPlaneDecisionSnapshotCount, 1);
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.summary.agentControlPlaneBaselineSnapshotId, createAgentControlPlaneBaselineSnapshotJson.snapshot.id);
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.summary.agentControlPlaneBaselineSnapshotTitle, "Fixture Baseline Control Plane");
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.summary.agentControlPlaneBaselineSnapshotCreatedAt, createAgentControlPlaneBaselineSnapshotJson.snapshot.createdAt);
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.summary.agentControlPlaneBaselineFreshness, "fresh");
    assert.ok(governanceAfterAgentControlPlaneSnapshotJson.summary.agentControlPlaneBaselineAgeHours >= 0);
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.summary.agentControlPlaneBaselineFreshnessThresholdHours, 24);
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.summary.agentControlPlaneBaselineHasDrift, false);
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.summary.agentControlPlaneBaselineDriftScore, 0);
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.summary.agentControlPlaneBaselineDriftSeverity, "none");
    assert.match(governanceAfterAgentControlPlaneSnapshotJson.summary.agentControlPlaneBaselineDriftRecommendedAction, /No snapshot drift detected/);
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.summary.agentControlPlaneBaselineHealth, "healthy");
    assert.match(governanceAfterAgentControlPlaneSnapshotJson.summary.agentControlPlaneBaselineRecommendedAction, /Continue monitoring/);
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.agentControlPlaneBaselineSnapshotId, createAgentControlPlaneBaselineSnapshotJson.snapshot.id);
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.agentControlPlaneBaselineStatus.hasBaseline, true);
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.agentControlPlaneBaselineStatus.title, "Fixture Baseline Control Plane");
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.agentControlPlaneBaselineStatus.freshness, "fresh");
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.agentControlPlaneBaselineStatus.hasDrift, false);
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.agentControlPlaneBaselineStatus.driftScore, 0);
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.agentControlPlaneBaselineStatus.driftSeverity, "none");
    assert.match(governanceAfterAgentControlPlaneSnapshotJson.agentControlPlaneBaselineStatus.driftRecommendedAction, /No snapshot drift detected/);
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.agentControlPlaneBaselineStatus.health, "healthy");
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.agentControlPlaneBaselineStatus.snapshotCount, 2);
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.agentControlPlaneDecision.decision, "hold");
    assert.ok(governanceAfterAgentControlPlaneSnapshotJson.agentControlPlaneDecision.reasons.some((reason) => reason.code === "execution-result-baseline-checkpoints"));
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.agentControlPlaneDecision.baselineDriftSeverity, "none");
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.agentControlPlaneDecisionSnapshots.length, 1);
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.agentControlPlaneDecisionSnapshots[0].title, "Fixture Control Plane Decision");
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.agentControlPlaneSnapshots.length, 2);
    assert.equal(governanceAfterAgentControlPlaneSnapshotJson.agentControlPlaneSnapshots[0].isBaseline, true);

    const unscopedRefreshAgentControlPlaneBaselineResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots/baseline/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture unscoped refreshed baseline",
        limit: 5
      })
    });
    assert.equal(unscopedRefreshAgentControlPlaneBaselineResponse.status, 409);
    const unscopedRefreshAgentControlPlaneBaselineJson = await unscopedRefreshAgentControlPlaneBaselineResponse.json();
    assert.equal(unscopedRefreshAgentControlPlaneBaselineJson.reasonCode, "agent-execution-scope-required");

    const blockedRefreshAgentControlPlaneBaselineResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots/baseline/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Blocked Fixture Refreshed Baseline",
        limit: 5,
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(blockedRefreshAgentControlPlaneBaselineResponse.status, 409);
    const blockedRefreshAgentControlPlaneBaselineJson = await blockedRefreshAgentControlPlaneBaselineResponse.json();
    assert.ok(blockedRefreshAgentControlPlaneBaselineJson.checkpointBlocked >= 1);
    const baselineRefreshRunIds = [...new Set((blockedRefreshAgentControlPlaneBaselineJson.requirements?.items || [])
      .filter((item) => item.targetAction === "baseline-refresh")
      .map((item) => item.runId)
      .filter(Boolean))];
    assert.ok(baselineRefreshRunIds.length >= 1);
    for (const runId of baselineRefreshRunIds) {
      await createExecutionResultCheckpoint(runId, "baseline-refresh");
    }

    const refreshAgentControlPlaneBaselineResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots/baseline/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Refreshed Baseline",
        limit: 5,
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(refreshAgentControlPlaneBaselineResponse.status, 200);
    const refreshAgentControlPlaneBaselineJson = await refreshAgentControlPlaneBaselineResponse.json();
    assert.equal(refreshAgentControlPlaneBaselineJson.success, true);
    assert.equal(refreshAgentControlPlaneBaselineJson.previousBaselineSnapshotId, createAgentControlPlaneBaselineSnapshotJson.snapshot.id);
    assert.equal(refreshAgentControlPlaneBaselineJson.baselineSnapshotId, refreshAgentControlPlaneBaselineJson.snapshot.id);
    assert.equal(refreshAgentControlPlaneBaselineJson.snapshot.title, "Fixture Refreshed Baseline");
    assert.equal(refreshAgentControlPlaneBaselineJson.snapshot.isBaseline, true);

    const refreshedAgentControlPlaneBaselineStatusResponse = await fetch(`${baseUrl}/api/agent-control-plane/baseline-status`);
    assert.equal(refreshedAgentControlPlaneBaselineStatusResponse.status, 200);
    const refreshedAgentControlPlaneBaselineStatusJson = await refreshedAgentControlPlaneBaselineStatusResponse.json();
    assert.equal(refreshedAgentControlPlaneBaselineStatusJson.hasBaseline, true);
    assert.equal(refreshedAgentControlPlaneBaselineStatusJson.baselineSnapshotId, refreshAgentControlPlaneBaselineJson.snapshot.id);
    assert.equal(refreshedAgentControlPlaneBaselineStatusJson.snapshotTitle, "Fixture Refreshed Baseline");
    assert.equal(refreshedAgentControlPlaneBaselineStatusJson.baselineFreshness, "fresh");
    assert.equal(refreshedAgentControlPlaneBaselineStatusJson.health, "healthy");
    assert.match(refreshedAgentControlPlaneBaselineStatusJson.markdown, /Fixture Refreshed Baseline/);

    const governanceAfterBaselineRefreshResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterBaselineRefreshResponse.status, 200);
    const governanceAfterBaselineRefreshJson = await governanceAfterBaselineRefreshResponse.json();
    assert.equal(governanceAfterBaselineRefreshJson.summary.agentControlPlaneSnapshotCount, 3);
    assert.equal(governanceAfterBaselineRefreshJson.summary.agentControlPlaneBaselineSnapshotId, refreshAgentControlPlaneBaselineJson.snapshot.id);
    assert.equal(governanceAfterBaselineRefreshJson.summary.agentControlPlaneBaselineHasDrift, false);
    assert.equal(governanceAfterBaselineRefreshJson.summary.agentControlPlaneBaselineDriftScore, 0);
    assert.equal(governanceAfterBaselineRefreshJson.summary.agentControlPlaneBaselineDriftSeverity, "none");
    assert.equal(governanceAfterBaselineRefreshJson.summary.agentControlPlaneBaselineHealth, "healthy");
    assert.equal(governanceAfterBaselineRefreshJson.agentControlPlaneBaselineStatus.title, "Fixture Refreshed Baseline");
    assert.equal(governanceAfterBaselineRefreshJson.agentControlPlaneBaselineStatus.hasDrift, false);
    assert.equal(governanceAfterBaselineRefreshJson.agentControlPlaneBaselineStatus.driftScore, 0);
    assert.equal(governanceAfterBaselineRefreshJson.agentControlPlaneBaselineStatus.driftSeverity, "none");
    assert.equal(governanceAfterBaselineRefreshJson.agentControlPlaneBaselineStatus.health, "healthy");
    assert.equal(governanceAfterBaselineRefreshJson.agentControlPlaneBaselineStatus.snapshotCount, 3);
    assert.equal(governanceAfterBaselineRefreshJson.agentControlPlaneSnapshots[0].isBaseline, true);
    assert.ok(governanceAfterBaselineRefreshJson.operationLog.some((operation) => operation.type === "agent-control-plane-baseline-refreshed"));

    const unscopedClearAgentControlPlaneBaselineResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots/baseline/clear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert.equal(unscopedClearAgentControlPlaneBaselineResponse.status, 409);
    const unscopedClearAgentControlPlaneBaselineJson = await unscopedClearAgentControlPlaneBaselineResponse.json();
    assert.equal(unscopedClearAgentControlPlaneBaselineJson.reasonCode, "agent-execution-scope-required");

    const clearAgentControlPlaneBaselineResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots/baseline/clear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alphaAgentExecutionScope)
    });
    assert.equal(clearAgentControlPlaneBaselineResponse.status, 200);
    const clearAgentControlPlaneBaselineJson = await clearAgentControlPlaneBaselineResponse.json();
    assert.equal(clearAgentControlPlaneBaselineJson.success, true);
    assert.equal(clearAgentControlPlaneBaselineJson.baselineSnapshotId, "");

    const governanceAfterClearBaselineResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterClearBaselineResponse.status, 200);
    const governanceAfterClearBaselineJson = await governanceAfterClearBaselineResponse.json();
    assert.equal(governanceAfterClearBaselineJson.agentControlPlaneBaselineSnapshotId, "");
    assert.equal(governanceAfterClearBaselineJson.agentControlPlaneBaselineStatus.hasBaseline, false);
    assert.equal(governanceAfterClearBaselineJson.agentControlPlaneBaselineStatus.freshness, "missing");
    assert.equal(governanceAfterClearBaselineJson.agentControlPlaneBaselineStatus.hasDrift, false);
    assert.equal(governanceAfterClearBaselineJson.agentControlPlaneBaselineStatus.driftScore, 0);
    assert.equal(governanceAfterClearBaselineJson.agentControlPlaneBaselineStatus.driftSeverity, "missing-baseline");
    assert.equal(governanceAfterClearBaselineJson.agentControlPlaneBaselineStatus.health, "missing");
    assert.equal(governanceAfterClearBaselineJson.agentControlPlaneBaselineStatus.snapshotCount, 3);

    const restoreAgentControlPlaneBaselineResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots/baseline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: refreshAgentControlPlaneBaselineJson.snapshot.id,
        ...alphaAgentExecutionScope
      })
    });
    assert.equal(restoreAgentControlPlaneBaselineResponse.status, 200);

    const saveSlaResolvedExecutionViewResponse = await fetch(`${baseUrl}/api/governance/execution-views`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Resolved SLA breach review",
        search: "gamma",
        scope: "execution",
        sort: "recent",
        executionStatus: "sla-resolved",
        executionRetention: 25,
        showArchivedExecution: false,
        ...taskMutationScope
      })
    });
    assert.equal(saveSlaResolvedExecutionViewResponse.status, 200);
    const saveSlaResolvedExecutionViewJson = await saveSlaResolvedExecutionViewResponse.json();
    assert.equal(saveSlaResolvedExecutionViewJson.success, true);
    assert.equal(saveSlaResolvedExecutionViewJson.view.executionStatus, "sla-resolved");

    const saveSlaLedgerExecutionViewResponse = await fetch(`${baseUrl}/api/governance/execution-views`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "SLA ledger review",
        search: "resolved",
        scope: "sla-ledger",
        sort: "recent",
        executionStatus: "sla-resolved",
        executionRetention: 25,
        showArchivedExecution: false,
        ...taskMutationScope
      })
    });
    assert.equal(saveSlaLedgerExecutionViewResponse.status, 200);
    const saveSlaLedgerExecutionViewJson = await saveSlaLedgerExecutionViewResponse.json();
    assert.equal(saveSlaLedgerExecutionViewJson.success, true);
    assert.equal(saveSlaLedgerExecutionViewJson.view.scope, "sla-ledger");

    const diagnosticsAfterProfileResponse = await fetch(`${baseUrl}/api/diagnostics`);
    assert.equal(diagnosticsAfterProfileResponse.status, 200);
    const diagnosticsAfterProfileJson = await diagnosticsAfterProfileResponse.json();
    assert.equal(diagnosticsAfterProfileJson.projectProfileCount, 1);
    assert.equal(diagnosticsAfterProfileJson.projectProfileHistoryCount, 2);
    assert.equal(diagnosticsAfterProfileJson.dataSourceAccessValidationEvidenceSnapshotCount, 1);
    assert.equal(diagnosticsAfterProfileJson.agentSessionCount, 1);
    assert.equal(diagnosticsAfterProfileJson.agentControlPlaneSnapshotCount, 3);
    assert.equal(diagnosticsAfterProfileJson.agentControlPlaneBaselineSnapshotId, refreshAgentControlPlaneBaselineJson.snapshot.id);
    assert.equal(diagnosticsAfterProfileJson.agentPolicyCheckpointCount, 1);
    assert.equal(diagnosticsAfterProfileJson.agentExecutionResultCheckpointCount, 8 + baselineRefreshRunIds.length);
    assert.equal(diagnosticsAfterProfileJson.agentWorkOrderSnapshotCount, 1);
    assert.equal(diagnosticsAfterProfileJson.agentExecutionSlaLedgerSnapshotCount, 1);
    assert.equal(diagnosticsAfterProfileJson.agentWorkOrderRunCount, 7);
    assert.equal(diagnosticsAfterProfileJson.governanceExecutionViewCount, 4);
    assert.equal(diagnosticsAfterProfileJson.governanceExecutionPolicy.staleThresholdHours, 6);

    const driftFixtureRunResponse = await fetch(`${baseUrl}/api/agent-work-order-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "gamma-app",
        projectName: "Gamma App",
        title: "Baseline drift fixture",
        objective: "Create a post-baseline execution delta.",
        status: "queued",
        readinessScore: 70,
        readinessStatus: "needs-prep",
        validationCommands: ["npm test"],
        notes: "Fixture baseline drift item.",
        ...portfolioAgentExecutionScope
      })
    });
    assert.equal(driftFixtureRunResponse.status, 200);

    const governanceAfterBaselineDriftResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterBaselineDriftResponse.status, 200);
    const governanceAfterBaselineDriftJson = await governanceAfterBaselineDriftResponse.json();
    assert.equal(governanceAfterBaselineDriftJson.agentControlPlaneBaselineStatus.hasDrift, true);
    assert.ok(governanceAfterBaselineDriftJson.agentControlPlaneBaselineStatus.driftScore >= 1);
    assert.ok(["changed", "drifted"].includes(governanceAfterBaselineDriftJson.agentControlPlaneBaselineStatus.health));
    assert.match(governanceAfterBaselineDriftJson.agentControlPlaneBaselineStatus.recommendedAction, /Review the baseline drift fields/);
    assert.ok(["low", "medium", "high"].includes(governanceAfterBaselineDriftJson.agentControlPlaneBaselineStatus.driftSeverity));
    assert.match(governanceAfterBaselineDriftJson.agentControlPlaneBaselineStatus.driftRecommendedAction, /Review the listed drift fields|focused control-plane drift review|Pause automated handoffs/);
    assert.ok(["changed", "drifted"].includes(governanceAfterBaselineDriftJson.summary.agentControlPlaneBaselineHealth));
    assert.ok(["low", "medium", "high"].includes(governanceAfterBaselineDriftJson.summary.agentControlPlaneBaselineDriftSeverity));
    assert.equal(governanceAfterBaselineDriftJson.agentControlPlaneDecision.decision, "review");
    assert.ok(["low", "medium", "high"].includes(governanceAfterBaselineDriftJson.agentControlPlaneDecision.baselineDriftSeverity));
    assert.ok(governanceAfterBaselineDriftJson.agentControlPlaneDecision.reasons.some((reason) => ["baseline-drift-low", "baseline-drift-medium", "baseline-drift-high"].includes(reason.code)));
    assert.ok(governanceAfterBaselineDriftJson.agentControlPlaneBaselineStatus.driftItems.some((item) => item.field === "agentWorkOrderRunCount" && item.delta === 1));
    assert.ok(governanceAfterBaselineDriftJson.summary.agentControlPlaneBaselineDriftItems.some((item) => item.label === "Execution Runs"));

    const directBaselineStatusAfterDriftResponse = await fetch(`${baseUrl}/api/agent-control-plane/baseline-status`);
    assert.equal(directBaselineStatusAfterDriftResponse.status, 200);
    const directBaselineStatusAfterDriftJson = await directBaselineStatusAfterDriftResponse.json();
    assert.equal(directBaselineStatusAfterDriftJson.hasBaseline, true);
    assert.ok(["changed", "drifted"].includes(directBaselineStatusAfterDriftJson.health));
    assert.ok(directBaselineStatusAfterDriftJson.driftScore >= 1);
    assert.ok(["low", "medium", "high"].includes(directBaselineStatusAfterDriftJson.driftSeverity));
    assert.match(directBaselineStatusAfterDriftJson.driftRecommendedAction, /Review the listed drift fields|focused control-plane drift review|Pause automated handoffs/);
    assert.ok(directBaselineStatusAfterDriftJson.driftItems.some((item) => item.field === "execution-runs" && item.delta >= 1));
    assert.ok(directBaselineStatusAfterDriftJson.diff.driftItems.some((item) => item.field === "execution-runs" && item.delta >= 1));
    assert.ok(["low", "medium", "high"].includes(directBaselineStatusAfterDriftJson.diff.driftSeverity));
    assert.match(directBaselineStatusAfterDriftJson.diff.recommendedAction, /Review the listed drift fields|focused control-plane drift review|Pause automated handoffs/);
    assert.match(directBaselineStatusAfterDriftJson.markdown, /Recommended action:/);
    assert.match(directBaselineStatusAfterDriftJson.markdown, /Drift severity: (low|medium|high)/);
    assert.match(directBaselineStatusAfterDriftJson.markdown, /## Drift Fields/);

    const baselineSnapshotDiffAfterDriftResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots/diff?snapshotId=baseline`);
    assert.equal(baselineSnapshotDiffAfterDriftResponse.status, 200);
    const baselineSnapshotDiffAfterDriftJson = await baselineSnapshotDiffAfterDriftResponse.json();
    assert.equal(baselineSnapshotDiffAfterDriftJson.hasDrift, true);
    assert.ok(["low", "medium", "high"].includes(baselineSnapshotDiffAfterDriftJson.driftSeverity));
    assert.match(baselineSnapshotDiffAfterDriftJson.recommendedAction, /Review the listed drift fields|focused control-plane drift review|Pause automated handoffs/);
    assert.ok(baselineSnapshotDiffAfterDriftJson.driftItems.some((item) => item.field === "execution-runs" && item.delta >= 1));
    assert.match(baselineSnapshotDiffAfterDriftJson.markdown, /Drift severity: (low|medium|high)/);
    assert.match(baselineSnapshotDiffAfterDriftJson.markdown, /## Drift Fields/);
    assert.match(baselineSnapshotDiffAfterDriftJson.markdown, /Execution runs/);

    const agentControlPlaneAfterBaselineDriftResponse = await fetch(`${baseUrl}/api/agent-control-plane?limit=5`);
    assert.equal(agentControlPlaneAfterBaselineDriftResponse.status, 200);
    const agentControlPlaneAfterBaselineDriftJson = await agentControlPlaneAfterBaselineDriftResponse.json();
    assert.equal(agentControlPlaneAfterBaselineDriftJson.baselineStatus.hasBaseline, true);
    assert.ok(["changed", "drifted"].includes(agentControlPlaneAfterBaselineDriftJson.baselineStatus.health));
    assert.ok(agentControlPlaneAfterBaselineDriftJson.baselineStatus.driftScore >= 1);
    assert.ok(agentControlPlaneAfterBaselineDriftJson.baselineStatus.driftItems.some((item) => item.field === "agentWorkOrderRunCount" && item.delta === 1));
    assert.match(agentControlPlaneAfterBaselineDriftJson.markdown, /Baseline health: (changed|drifted)/);
    assert.match(agentControlPlaneAfterBaselineDriftJson.markdown, /Baseline action:/);
    assert.match(agentControlPlaneAfterBaselineDriftJson.markdown, /Baseline drift severity: (low|medium|high)/);
    assert.match(agentControlPlaneAfterBaselineDriftJson.markdown, /## Baseline Drift Fields/);
    assert.match(agentControlPlaneAfterBaselineDriftJson.markdown, /Execution Runs/);

    const agentControlPlaneDecisionAfterDriftResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision`);
    assert.equal(agentControlPlaneDecisionAfterDriftResponse.status, 200);
    const agentControlPlaneDecisionAfterDriftJson = await agentControlPlaneDecisionAfterDriftResponse.json();
    assert.equal(agentControlPlaneDecisionAfterDriftJson.decision, "review");
    assert.ok(["low", "medium", "high"].includes(agentControlPlaneDecisionAfterDriftJson.baselineDriftSeverity));
    assert.ok(agentControlPlaneDecisionAfterDriftJson.reasons.some((reason) => ["baseline-drift-low", "baseline-drift-medium", "baseline-drift-high"].includes(reason.code)));
    assert.match(agentControlPlaneDecisionAfterDriftJson.markdown, /Decision: review/);
    assert.match(agentControlPlaneDecisionAfterDriftJson.markdown, /Baseline drift severity: (low|medium|high)/);

    const unscopedSeedSourceAccessTasksResponse = await fetch(`${baseUrl}/api/sources/access-review-queue/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{
          id: "source-access-review:github-fixture",
          label: "GitHub Fixture"
        }]
      })
    });
    assert.equal(unscopedSeedSourceAccessTasksResponse.status, 409);
    const unscopedSeedSourceAccessTasksJson = await unscopedSeedSourceAccessTasksResponse.json();
    assert.equal(unscopedSeedSourceAccessTasksJson.reasonCode, "agent-execution-scope-required");

    const seedSourceAccessTasksResponse = await fetch(`${baseUrl}/api/sources/access-review-queue/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{
          id: "source-access-review:github-fixture",
          sourceId: "github-fixture",
          label: "GitHub Fixture",
          type: "github",
          value: "https://github.com/example/repo",
          status: "review",
          priority: "medium",
          accessMethod: "git-https",
          sourceHealth: "review",
          sourceStatus: "review-required",
          action: "Confirm Git Credential Manager or token access outside this app.",
          validation: "Run git ls-remote from the operator shell.",
          credentialHint: "git-credential-manager-or-token",
          secretPolicy: "non-secret-metadata-only"
        }],
        ...dataSourcesScope
      })
    });
    assert.equal(seedSourceAccessTasksResponse.status, 200);
    const seedSourceAccessTasksJson = await seedSourceAccessTasksResponse.json();
    assert.equal(seedSourceAccessTasksJson.success, true);
    assert.equal(seedSourceAccessTasksJson.totals.created, 1);
    assert.equal(seedSourceAccessTasksJson.createdTasks[0].projectId, "data-sources");
    assert.equal(seedSourceAccessTasksJson.createdTasks[0].sourceAccessReviewId, "source-access-review:github-fixture");
    assert.match(seedSourceAccessTasksJson.createdTasks[0].description, /Do not store secrets/);

    const repeatSeedSourceAccessTasksResponse = await fetch(`${baseUrl}/api/sources/access-review-queue/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saveSnapshot: true,
        snapshotTitle: "Fixture Source Access Review Task Ledger Auto Capture",
        snapshotStatus: "all",
        snapshotLimit: 5,
        items: [{
          id: "source-access-review:github-fixture",
          label: "GitHub Fixture"
        }],
        ...dataSourcesScope
      })
    });
    assert.equal(repeatSeedSourceAccessTasksResponse.status, 200);
    const repeatSeedSourceAccessTasksJson = await repeatSeedSourceAccessTasksResponse.json();
    assert.equal(repeatSeedSourceAccessTasksJson.totals.created, 0);
    assert.equal(repeatSeedSourceAccessTasksJson.totals.skipped, 1);
    assert.equal(repeatSeedSourceAccessTasksJson.snapshotCaptured, true);
    assert.equal(repeatSeedSourceAccessTasksJson.snapshot.title, "Fixture Source Access Review Task Ledger Auto Capture");
    assert.equal(repeatSeedSourceAccessTasksJson.snapshot.statusFilter, "all");
    assert.equal(repeatSeedSourceAccessTasksJson.snapshot.total, 1);
    assert.equal(repeatSeedSourceAccessTasksJson.snapshot.openCount, 1);
    assert.equal(repeatSeedSourceAccessTasksJson.dataSourceAccessTaskLedgerSnapshots.length, 1);

    const governanceAfterSourceAccessTasksResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterSourceAccessTasksResponse.status, 200);
    const governanceAfterSourceAccessTasksJson = await governanceAfterSourceAccessTasksResponse.json();
    assert.equal(governanceAfterSourceAccessTasksJson.summary.dataSourcesAccessTaskCount, 1);
    assert.equal(governanceAfterSourceAccessTasksJson.summary.dataSourcesAccessOpenTaskCount, 1);
    assert.equal(governanceAfterSourceAccessTasksJson.dataSourcesAccessTasks.length, 1);
    assert.equal(governanceAfterSourceAccessTasksJson.dataSourcesAccessTasks[0].sourceAccessReviewId, "source-access-review:github-fixture");
    assert.equal(governanceAfterSourceAccessTasksJson.agentControlPlaneDecision.dataSourcesAccessTaskCount, 1);
    assert.equal(governanceAfterSourceAccessTasksJson.agentControlPlaneDecision.dataSourcesAccessOpenTaskCount, 1);
    assert.ok(governanceAfterSourceAccessTasksJson.agentControlPlaneDecision.reasons.some((reason) => reason.code === "data-sources-access-open-tasks"));

    const agentControlPlaneDecisionWithSourceAccessTaskResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision`);
    assert.equal(agentControlPlaneDecisionWithSourceAccessTaskResponse.status, 200);
    const agentControlPlaneDecisionWithSourceAccessTaskJson = await agentControlPlaneDecisionWithSourceAccessTaskResponse.json();
    assert.equal(agentControlPlaneDecisionWithSourceAccessTaskJson.dataSourcesAccessTaskCount, 1);
    assert.equal(agentControlPlaneDecisionWithSourceAccessTaskJson.dataSourcesAccessOpenTaskCount, 1);
    assert.equal(agentControlPlaneDecisionWithSourceAccessTaskJson.dataSourcesAccessClosedTaskCount, 0);
    assert.equal(agentControlPlaneDecisionWithSourceAccessTaskJson.dataSourcesAccessTasks[0].sourceAccessReviewId, "source-access-review:github-fixture");
    assert.ok(agentControlPlaneDecisionWithSourceAccessTaskJson.reasons.some((reason) => reason.code === "data-sources-access-open-tasks"));
    assert.match(agentControlPlaneDecisionWithSourceAccessTaskJson.markdown, /Data Sources access tasks: 1 open \/ 1 total/);
    assert.match(agentControlPlaneDecisionWithSourceAccessTaskJson.markdown, /## Data Sources Access Tasks/);

    const sourcesAccessTaskLedgerWithTaskResponse = await fetch(`${baseUrl}/api/sources/access-task-ledger?status=open&limit=5`);
    assert.equal(sourcesAccessTaskLedgerWithTaskResponse.status, 200);
    const sourcesAccessTaskLedgerWithTaskJson = await sourcesAccessTaskLedgerWithTaskResponse.json();
    assert.equal(sourcesAccessTaskLedgerWithTaskJson.status, "open");
    assert.equal(sourcesAccessTaskLedgerWithTaskJson.summary.total, 1);
    assert.equal(sourcesAccessTaskLedgerWithTaskJson.summary.open, 1);
    assert.equal(sourcesAccessTaskLedgerWithTaskJson.summary.visible, 1);
    assert.equal(sourcesAccessTaskLedgerWithTaskJson.items.length, 1);
    assert.equal(sourcesAccessTaskLedgerWithTaskJson.items[0].sourceAccessReviewId, "source-access-review:github-fixture");
    assert.equal(sourcesAccessTaskLedgerWithTaskJson.items[0].accessMethod, "git-https");
    assert.equal(sourcesAccessTaskLedgerWithTaskJson.items[0].secretPolicy, "non-secret-metadata-only");
    assert.equal(Object.hasOwn(sourcesAccessTaskLedgerWithTaskJson.items[0], "description"), false);
    assert.match(sourcesAccessTaskLedgerWithTaskJson.markdown, /# Data Sources Access Task Ledger/);
    assert.match(sourcesAccessTaskLedgerWithTaskJson.markdown, /GitHub Fixture/);

    const unscopedSourcesAccessTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/sources/access-task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Source Access Task Ledger", status: "open", limit: 5 })
    });
    assert.equal(unscopedSourcesAccessTaskLedgerSnapshotResponse.status, 409);
    const unscopedSourcesAccessTaskLedgerSnapshotJson = await unscopedSourcesAccessTaskLedgerSnapshotResponse.json();
    assert.equal(unscopedSourcesAccessTaskLedgerSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createSourcesAccessTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/sources/access-task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Source Access Task Ledger", status: "open", limit: 5, ...dataSourcesScope })
    });
    assert.equal(createSourcesAccessTaskLedgerSnapshotResponse.status, 200);
    const createSourcesAccessTaskLedgerSnapshotJson = await createSourcesAccessTaskLedgerSnapshotResponse.json();
    assert.equal(createSourcesAccessTaskLedgerSnapshotJson.success, true);
    assert.equal(createSourcesAccessTaskLedgerSnapshotJson.snapshot.title, "Fixture Source Access Task Ledger");
    assert.equal(createSourcesAccessTaskLedgerSnapshotJson.snapshot.statusFilter, "open");
    assert.equal(createSourcesAccessTaskLedgerSnapshotJson.snapshot.total, 1);
    assert.equal(createSourcesAccessTaskLedgerSnapshotJson.snapshot.openCount, 1);
    assert.equal(createSourcesAccessTaskLedgerSnapshotJson.snapshot.items.length, 1);
    assert.equal(Object.hasOwn(createSourcesAccessTaskLedgerSnapshotJson.snapshot.items[0], "description"), false);
    assert.match(createSourcesAccessTaskLedgerSnapshotJson.snapshot.markdown, /# Data Sources Access Task Ledger/);

    const sourcesAccessTaskLedgerSnapshotsResponse = await fetch(`${baseUrl}/api/sources/access-task-ledger-snapshots`);
    assert.equal(sourcesAccessTaskLedgerSnapshotsResponse.status, 200);
    const sourcesAccessTaskLedgerSnapshotsJson = await sourcesAccessTaskLedgerSnapshotsResponse.json();
    assert.equal(sourcesAccessTaskLedgerSnapshotsJson.length, 2);
    assert.equal(sourcesAccessTaskLedgerSnapshotsJson[0].title, "Fixture Source Access Task Ledger");
    assert.equal(sourcesAccessTaskLedgerSnapshotsJson[1].title, "Fixture Source Access Review Task Ledger Auto Capture");

    const resolveSourceAccessTaskResponse = await fetch(`${baseUrl}/api/tasks/${seedSourceAccessTasksJson.createdTasks[0].id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved", ...taskMutationScope })
    });
    assert.equal(resolveSourceAccessTaskResponse.status, 200);

    const governanceAfterSourceAccessTaskResolveResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterSourceAccessTaskResolveResponse.status, 200);
    const governanceAfterSourceAccessTaskResolveJson = await governanceAfterSourceAccessTaskResolveResponse.json();
    assert.equal(governanceAfterSourceAccessTaskResolveJson.summary.dataSourcesAccessTaskCount, 1);
    assert.equal(governanceAfterSourceAccessTaskResolveJson.summary.dataSourcesAccessOpenTaskCount, 0);
    assert.equal(governanceAfterSourceAccessTaskResolveJson.summary.dataSourcesAccessClosedTaskCount, 1);
    assert.equal(governanceAfterSourceAccessTaskResolveJson.summary.dataSourceAccessTaskLedgerSnapshotCount, 2);
    assert.equal(governanceAfterSourceAccessTaskResolveJson.dataSourcesAccessTasks[0].status, "resolved");
    assert.equal(governanceAfterSourceAccessTaskResolveJson.dataSourceAccessTaskLedgerSnapshots.length, 2);
    assert.equal(governanceAfterSourceAccessTaskResolveJson.dataSourceAccessTaskLedgerSnapshots[0].title, "Fixture Source Access Task Ledger");
    assert.equal(governanceAfterSourceAccessTaskResolveJson.dataSourceAccessTaskLedgerSnapshots[1].title, "Fixture Source Access Review Task Ledger Auto Capture");
    assert.equal(governanceAfterSourceAccessTaskResolveJson.agentControlPlaneDecision.dataSourcesAccessTaskCount, 1);
    assert.equal(governanceAfterSourceAccessTaskResolveJson.agentControlPlaneDecision.dataSourcesAccessOpenTaskCount, 0);
    assert.equal(governanceAfterSourceAccessTaskResolveJson.agentControlPlaneDecision.dataSourcesAccessClosedTaskCount, 1);
    assert.ok(!governanceAfterSourceAccessTaskResolveJson.agentControlPlaneDecision.reasons.some((reason) => reason.code === "data-sources-access-open-tasks"));

    const sourcesAccessTaskLedgerClosedResponse = await fetch(`${baseUrl}/api/sources/access-task-ledger?status=closed`);
    assert.equal(sourcesAccessTaskLedgerClosedResponse.status, 200);
    const sourcesAccessTaskLedgerClosedJson = await sourcesAccessTaskLedgerClosedResponse.json();
    assert.equal(sourcesAccessTaskLedgerClosedJson.status, "closed");
    assert.equal(sourcesAccessTaskLedgerClosedJson.summary.total, 1);
    assert.equal(sourcesAccessTaskLedgerClosedJson.summary.open, 0);
    assert.equal(sourcesAccessTaskLedgerClosedJson.summary.closed, 1);
    assert.equal(sourcesAccessTaskLedgerClosedJson.items.length, 1);
    assert.equal(sourcesAccessTaskLedgerClosedJson.items[0].status, "resolved");
    assert.ok(governanceAfterSourceAccessTaskResolveJson.operationLog.some((operation) => operation.type === "data-source-access-task-ledger-snapshot-created"));
    assert.ok(governanceAfterSourceAccessTaskResolveJson.operationLog.some((operation) => operation.type === "data-source-access-review-task-ledger-snapshot-auto-captured"));

    const sourcesAccessTaskLedgerSnapshotDiffResponse = await fetch(`${baseUrl}/api/sources/access-task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(sourcesAccessTaskLedgerSnapshotDiffResponse.status, 200);
    const sourcesAccessTaskLedgerSnapshotDiffJson = await sourcesAccessTaskLedgerSnapshotDiffResponse.json();
    assert.equal(sourcesAccessTaskLedgerSnapshotDiffJson.hasSnapshot, true);
    assert.equal(sourcesAccessTaskLedgerSnapshotDiffJson.hasDrift, true);
    assert.equal(sourcesAccessTaskLedgerSnapshotDiffJson.snapshotTitle, "Fixture Source Access Task Ledger");
    assert.ok(["low", "medium"].includes(sourcesAccessTaskLedgerSnapshotDiffJson.driftSeverity));
    assert.ok(sourcesAccessTaskLedgerSnapshotDiffJson.driftItems.some((item) => item.label === "Open source-access tasks" && item.before === 1 && item.current === 0));
    assert.match(sourcesAccessTaskLedgerSnapshotDiffJson.markdown, /# Data Sources Access Task Ledger Snapshot Drift/);
    assert.match(sourcesAccessTaskLedgerSnapshotDiffJson.markdown, /Open source-access tasks/);

    const unscopedSeedSourceEvidenceCoverageTasksResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence-coverage/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{
          id: "source-access-validation-evidence-coverage:github-coverage-fixture",
          label: "GitHub Coverage Fixture",
          coverageStatus: "missing"
        }]
      })
    });
    assert.equal(unscopedSeedSourceEvidenceCoverageTasksResponse.status, 409);
    const unscopedSeedSourceEvidenceCoverageTasksJson = await unscopedSeedSourceEvidenceCoverageTasksResponse.json();
    assert.equal(unscopedSeedSourceEvidenceCoverageTasksJson.reasonCode, "agent-execution-scope-required");

    const seedSourceEvidenceCoverageTasksResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence-coverage/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{
          id: "source-access-validation-evidence-coverage:github-coverage-fixture",
          sourceId: "github-coverage-fixture",
          label: "GitHub Coverage Fixture",
          type: "github",
          coverageStatus: "missing",
          priority: "high",
          accessMethod: "git-https",
          latestEvidenceStatus: "missing",
          action: "Record non-secret Git HTTPS validation evidence after confirming provider access outside this app.",
          secretPolicy: "non-secret-validation-evidence-only"
        }],
        ...dataSourcesScope
      })
    });
    assert.equal(seedSourceEvidenceCoverageTasksResponse.status, 200);
    const seedSourceEvidenceCoverageTasksJson = await seedSourceEvidenceCoverageTasksResponse.json();
    assert.equal(seedSourceEvidenceCoverageTasksJson.success, true);
    assert.equal(seedSourceEvidenceCoverageTasksJson.totals.created, 1);
    assert.equal(seedSourceEvidenceCoverageTasksJson.createdTasks[0].projectId, "data-sources");
    assert.equal(seedSourceEvidenceCoverageTasksJson.createdTasks[0].sourceAccessValidationEvidenceCoverageId, "source-access-validation-evidence-coverage:github-coverage-fixture");
    assert.match(seedSourceEvidenceCoverageTasksJson.createdTasks[0].description, /Do not store secrets/);

    const repeatSeedSourceEvidenceCoverageTasksResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence-coverage/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saveSnapshot: true,
        snapshotTitle: "Fixture Source Evidence Coverage Task Ledger Auto Capture",
        snapshotStatus: "all",
        snapshotLimit: 5,
        items: [{
          id: "source-access-validation-evidence-coverage:github-coverage-fixture",
          label: "GitHub Coverage Fixture",
          coverageStatus: "missing"
        }],
        ...dataSourcesScope
      })
    });
    assert.equal(repeatSeedSourceEvidenceCoverageTasksResponse.status, 200);
    const repeatSeedSourceEvidenceCoverageTasksJson = await repeatSeedSourceEvidenceCoverageTasksResponse.json();
    assert.equal(repeatSeedSourceEvidenceCoverageTasksJson.totals.created, 0);
    assert.equal(repeatSeedSourceEvidenceCoverageTasksJson.totals.skipped, 1);
    assert.equal(repeatSeedSourceEvidenceCoverageTasksJson.snapshotCaptured, true);
    assert.equal(repeatSeedSourceEvidenceCoverageTasksJson.snapshot.title, "Fixture Source Evidence Coverage Task Ledger Auto Capture");
    assert.equal(repeatSeedSourceEvidenceCoverageTasksJson.snapshot.statusFilter, "all");
    assert.equal(repeatSeedSourceEvidenceCoverageTasksJson.snapshot.total, 2);
    assert.equal(repeatSeedSourceEvidenceCoverageTasksJson.snapshot.openCount, 1);
    assert.equal(repeatSeedSourceEvidenceCoverageTasksJson.dataSourceAccessTaskLedgerSnapshots.length, 3);

    const governanceAfterSourceEvidenceCoverageTasksResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterSourceEvidenceCoverageTasksResponse.status, 200);
    const governanceAfterSourceEvidenceCoverageTasksJson = await governanceAfterSourceEvidenceCoverageTasksResponse.json();
    assert.equal(governanceAfterSourceEvidenceCoverageTasksJson.summary.dataSourcesAccessTaskCount, 2);
    assert.equal(governanceAfterSourceEvidenceCoverageTasksJson.summary.dataSourcesAccessOpenTaskCount, 1);
    assert.equal(governanceAfterSourceEvidenceCoverageTasksJson.summary.dataSourceAccessTaskLedgerSnapshotCount, 3);
    assert.equal(governanceAfterSourceEvidenceCoverageTasksJson.dataSourceAccessTaskLedgerSnapshots[0].title, "Fixture Source Evidence Coverage Task Ledger Auto Capture");
    assert.equal(governanceAfterSourceEvidenceCoverageTasksJson.dataSourcesAccessTasks.some((task) => task.sourceAccessValidationEvidenceCoverageId === "source-access-validation-evidence-coverage:github-coverage-fixture"), true);
    assert.ok(governanceAfterSourceEvidenceCoverageTasksJson.operationLog.some((operation) => operation.type === "data-source-access-validation-evidence-coverage-tasks-created"));
    assert.ok(governanceAfterSourceEvidenceCoverageTasksJson.operationLog.some((operation) => operation.type === "data-source-access-validation-evidence-coverage-task-ledger-snapshot-auto-captured"));

    const historyResponse = await fetch(`${baseUrl}/api/history`);
    assert.equal(historyResponse.status, 200);
    const historyJson = await historyResponse.json();
    assert.equal(historyJson.length, 2);
    assert.equal(historyJson[0].summary.totalApps, 1);

    const inventoryFileJson = JSON.parse(await readFile(join(appDir, "inventory.json"), "utf8"));
    assert.equal(inventoryFileJson.summary.totalApps, 1);
    await stat(join(appDir, "workspace-state.db"));
    await stat(join(appDir, "workspace-state.json"));
  } finally {
    server.close();
    await once(server, "close");
  }
}

export async function convergenceReviewSuppressionTest() {
  const { appDir, workspaceRoot } = await createFixtureWorkspace();
  const betaDir = join(workspaceRoot, "beta-app");
  await mkdir(join(betaDir, "src"), { recursive: true });
  await writeFile(join(betaDir, "package.json"), JSON.stringify({
    name: "alpha-app",
    description: "Beta app for convergence testing",
    scripts: {
      dev: "vite",
      test: "node --test"
    },
    dependencies: {
      react: "^19.0.0"
    },
    devDependencies: {
      vite: "^7.0.0"
    }
  }, null, 2));
  await writeFile(join(betaDir, "README.md"), "# Beta App\nA matching fixture app for convergence review suppression.\n");
  await writeFile(join(betaDir, "vite.config.js"), "export default {};\n");
  await writeFile(join(betaDir, "src", "index.js"), "export const answer = 43;\n");
  await writeFile(join(betaDir, "src", "index.test.js"), "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('fixture', () => assert.equal(1, 1));\n");

  const server = createWorkspaceAuditServer({
    rootDir: workspaceRoot,
    publicDir: appDir
  });

  server.listen(0);
  await once(server, "listening");

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const convergenceScope = { activeProjectId: "alpha-app", scopeMode: "project" };
  const taskMutationScope = { scopeMode: "portfolio" };

  try {
    const inventoryResponse = await fetch(`${baseUrl}/api/inventory`);
    assert.equal(inventoryResponse.status, 200);
    const inventoryJson = await inventoryResponse.json();
    const isAlphaBetaPair = (candidate) => [candidate.leftId, candidate.rightId].sort().join("__converges_with__") === "alpha-app__converges_with__beta-app";
    assert.equal(inventoryJson.crossChecks.some(isAlphaBetaPair), true);
    assert.equal(inventoryJson.projects.some((project) =>
      project.id === "alpha-app" && Array.isArray(project.similarApps) && project.similarApps.some((similar) => similar.id === "beta-app")
    ), true);
    await writeFile(join(appDir, "inventory.json"), JSON.stringify({
      ...inventoryJson,
      crossChecks: []
    }, null, 2));

    const activeCandidatesResponse = await fetch(`${baseUrl}/api/convergence/candidates?projectId=alpha-app`);
    assert.equal(activeCandidatesResponse.status, 200);
    const activeCandidatesJson = await activeCandidatesResponse.json();
    const activePair = activeCandidatesJson.candidates.find((candidate) => candidate.pairId === "alpha-app__converges_with__beta-app");
    assert.ok(activePair);
    assert.notEqual(activePair.reviewStatus, "not-related");
    assert.equal(activePair.leftName, activePair.rightName);
    assert.notEqual(activePair.leftLabel, activePair.rightLabel);
    assert.match(activePair.leftLabel, /\[/);
    assert.match(activePair.rightLabel, /\[/);

    const findingsRefreshResponse = await fetch(`${baseUrl}/api/findings/refresh`, {
      method: "POST"
    });
    assert.equal(findingsRefreshResponse.status, 200);
    const findingsRefreshJson = await findingsRefreshResponse.json();
    const convergenceFindings = findingsRefreshJson.findings.filter((finding) => finding.title === "High overlap candidate");
    assert.equal(convergenceFindings.length, 1);
    assert.equal(convergenceFindings[0].convergencePairId, "alpha-app__converges_with__beta-app");
    assert.doesNotMatch(convergenceFindings[0].detail, /^Alpha App overlaps strongly with Alpha App/);
    assert.match(convergenceFindings[0].detail, /Alpha App \[alpha-app\] overlaps strongly with Alpha App \[beta-app\]/);

    const unscopedReviewResponse = await fetch(`${baseUrl}/api/convergence/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leftId: "alpha-app",
        rightId: "beta-app",
        status: "not-related",
        note: "Different operator-confirmed product intent."
      })
    });
    assert.equal(unscopedReviewResponse.status, 409);
    const unscopedReviewJson = await unscopedReviewResponse.json();
    assert.equal(unscopedReviewJson.reasonCode, "agent-execution-scope-required");

    const createReviewResponse = await fetch(`${baseUrl}/api/convergence/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leftId: "alpha-app",
        rightId: "beta-app",
        status: "not-related",
        note: "Different operator-confirmed product intent.",
        ...convergenceScope
      })
    });
    assert.equal(createReviewResponse.status, 200);
    const createReviewJson = await createReviewResponse.json();
    assert.equal(createReviewJson.review.status, "not-related");

    const suppressedActiveCandidatesResponse = await fetch(`${baseUrl}/api/convergence/candidates?projectId=alpha-app`);
    assert.equal(suppressedActiveCandidatesResponse.status, 200);
    const suppressedActiveCandidatesJson = await suppressedActiveCandidatesResponse.json();
    assert.equal(suppressedActiveCandidatesJson.candidates.some((candidate) => candidate.pairId === "alpha-app__converges_with__beta-app"), false);
    assert.equal(suppressedActiveCandidatesJson.summary.notRelated, 0);

    const auditCandidatesResponse = await fetch(`${baseUrl}/api/convergence/candidates?projectId=alpha-app&status=not-related`);
    assert.equal(auditCandidatesResponse.status, 200);
    const auditCandidatesJson = await auditCandidatesResponse.json();
    assert.equal(auditCandidatesJson.candidates.length, 1);
    assert.equal(auditCandidatesJson.candidates[0].pairId, "alpha-app__converges_with__beta-app");
    assert.equal(auditCandidatesJson.candidates[0].reviewStatus, "not-related");

    const allCandidatesResponse = await fetch(`${baseUrl}/api/convergence/candidates?projectId=alpha-app&status=all`);
    assert.equal(allCandidatesResponse.status, 200);
    const allCandidatesJson = await allCandidatesResponse.json();
    assert.equal(allCandidatesJson.candidates.some((candidate) => candidate.pairId === "alpha-app__converges_with__beta-app"), true);

    const unscopedOperatorProposalResponse = await fetch(`${baseUrl}/api/convergence/proposals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leftId: "alpha-app",
        rightId: "beta-app",
        operatorContext: "The operator knows these apps share the same generated Vite/React app shell and should be reviewed for assimilation."
      })
    });
    assert.equal(unscopedOperatorProposalResponse.status, 409);
    const unscopedOperatorProposalJson = await unscopedOperatorProposalResponse.json();
    assert.equal(unscopedOperatorProposalJson.reasonCode, "agent-execution-scope-required");

    const operatorProposalResponse = await fetch(`${baseUrl}/api/convergence/proposals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leftId: "alpha-app",
        rightId: "beta-app",
        operatorContext: "The operator knows these apps share the same generated Vite/React app shell and should be reviewed for assimilation.",
        ...convergenceScope
      })
    });
    assert.equal(operatorProposalResponse.status, 200);
    const operatorProposalJson = await operatorProposalResponse.json();
    assert.equal(operatorProposalJson.success, true);
    assert.equal(operatorProposalJson.review.source, "operator-contributed-overlap");
    assert.match(operatorProposalJson.review.generatedInsight, /AI-assisted due diligence/);
    assert.match(operatorProposalJson.review.note, /Operator context/);
    assert.equal(operatorProposalJson.candidates.some((candidate) => candidate.operatorProposed === true), true);

    const operatorProposalQueueResponse = await fetch(`${baseUrl}/api/convergence/operator-proposal-queue?status=active`);
    assert.equal(operatorProposalQueueResponse.status, 200);
    const operatorProposalQueueJson = await operatorProposalQueueResponse.json();
    assert.equal(operatorProposalQueueJson.summary.total, 1);
    assert.equal(operatorProposalQueueJson.summary.visible, 1);
    assert.equal(operatorProposalQueueJson.items[0].pairId, operatorProposalJson.review.pairId);
    assert.equal(operatorProposalQueueJson.items[0].queueStatus, "task-ready");
    assert.match(operatorProposalQueueJson.items[0].recommendedAction, /task|merge|assimilation/i);
    assert.match(operatorProposalQueueJson.markdown, /# Operator Convergence Proposal Review Queue/);
    assert.match(operatorProposalQueueJson.secretPolicy, /Non-secret operator convergence proposal metadata only/);

    const unscopedConvergenceTaskResponse = await fetch(`${baseUrl}/api/convergence/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairIds: [operatorProposalJson.review.pairId]
      })
    });
    assert.equal(unscopedConvergenceTaskResponse.status, 409);
    const unscopedConvergenceTaskJson = await unscopedConvergenceTaskResponse.json();
    assert.equal(unscopedConvergenceTaskJson.reasonCode, "agent-execution-scope-required");

    const convergenceTaskResponse = await fetch(`${baseUrl}/api/convergence/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairIds: [operatorProposalJson.review.pairId],
        ...convergenceScope
      })
    });
    assert.equal(convergenceTaskResponse.status, 200);
    const convergenceTaskJson = await convergenceTaskResponse.json();
    assert.equal(convergenceTaskJson.success, true);
    assert.equal(convergenceTaskJson.totals.requested, 1);
    assert.equal(convergenceTaskJson.totals.created, 1);
    assert.equal(convergenceTaskJson.totals.skipped, 0);
    assert.equal(convergenceTaskJson.createdTasks[0].convergencePairId, operatorProposalJson.review.pairId);
    assert.equal(convergenceTaskJson.createdTasks[0].convergenceReviewStatus, operatorProposalJson.review.status);
    assert.equal(convergenceTaskJson.createdTasks[0].secretPolicy, "non-secret-convergence-review-evidence-only");
    assert.match(convergenceTaskJson.createdTasks[0].description, /Do not store passwords/);

    const trackedOperatorProposalQueueResponse = await fetch(`${baseUrl}/api/convergence/operator-proposal-queue?status=task-tracked`);
    assert.equal(trackedOperatorProposalQueueResponse.status, 200);
    const trackedOperatorProposalQueueJson = await trackedOperatorProposalQueueResponse.json();
    assert.equal(trackedOperatorProposalQueueJson.summary.taskTracked, 1);
    assert.equal(trackedOperatorProposalQueueJson.items[0].pairId, operatorProposalJson.review.pairId);
    assert.equal(trackedOperatorProposalQueueJson.items[0].openTaskCount, 1);

    const unscopedQueueConvergenceAssimilationRunResponse = await fetch(`${baseUrl}/api/convergence/assimilation-work-order-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairId: operatorProposalJson.review.pairId,
        runner: "claude"
      })
    });
    assert.equal(unscopedQueueConvergenceAssimilationRunResponse.status, 409);
    const unscopedQueueConvergenceAssimilationRunJson = await unscopedQueueConvergenceAssimilationRunResponse.json();
    assert.equal(unscopedQueueConvergenceAssimilationRunJson.reasonCode, "agent-execution-scope-required");

    const queueConvergenceAssimilationRunResponse = await fetch(`${baseUrl}/api/convergence/assimilation-work-order-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairId: operatorProposalJson.review.pairId,
        runner: "claude",
        ...convergenceScope
      })
    });
    assert.equal(queueConvergenceAssimilationRunResponse.status, 200);
    const queueConvergenceAssimilationRunJson = await queueConvergenceAssimilationRunResponse.json();
    assert.equal(queueConvergenceAssimilationRunJson.success, true);
    assert.equal(queueConvergenceAssimilationRunJson.run.convergencePairId, operatorProposalJson.review.pairId);
    assert.equal(queueConvergenceAssimilationRunJson.run.convergenceAssimilationRunner, "claude");
    assert.equal(queueConvergenceAssimilationRunJson.run.runtime, "claude-cli-convergence-assimilation");
    assert.match(queueConvergenceAssimilationRunJson.draft.markdown, /# Convergence Assimilation Work-Order Draft/);

    const duplicateConvergenceAssimilationRunResponse = await fetch(`${baseUrl}/api/convergence/assimilation-work-order-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairId: operatorProposalJson.review.pairId,
        runner: "claude",
        ...convergenceScope
      })
    });
    assert.equal(duplicateConvergenceAssimilationRunResponse.status, 200);
    const duplicateConvergenceAssimilationRunJson = await duplicateConvergenceAssimilationRunResponse.json();
    assert.equal(duplicateConvergenceAssimilationRunJson.run, null);
    assert.match(duplicateConvergenceAssimilationRunJson.skippedRun.reason, /already exists/);

    const convergenceAssimilationRunLedgerResponse = await fetch(`${baseUrl}/api/convergence/assimilation-run-ledger?status=all`);
    assert.equal(convergenceAssimilationRunLedgerResponse.status, 200);
    const convergenceAssimilationRunLedgerJson = await convergenceAssimilationRunLedgerResponse.json();
    assert.equal(convergenceAssimilationRunLedgerJson.summary.total, 1);
    assert.equal(convergenceAssimilationRunLedgerJson.summary.claude, 1);
    assert.equal(convergenceAssimilationRunLedgerJson.summary.pairCount, 1);
    assert.equal(convergenceAssimilationRunLedgerJson.runs[0].convergencePairId, operatorProposalJson.review.pairId);
    assert.match(convergenceAssimilationRunLedgerJson.markdown, /# Convergence Assimilation Run Ledger/);
    assert.match(convergenceAssimilationRunLedgerJson.secretPolicy, /Non-secret convergence assimilation run metadata only/);

    const convergenceAssimilationRunTracePackResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runs/${encodeURIComponent(queueConvergenceAssimilationRunJson.run.id)}/trace-pack`);
    assert.equal(convergenceAssimilationRunTracePackResponse.status, 200);
    const convergenceAssimilationRunTracePackJson = await convergenceAssimilationRunTracePackResponse.json();
    assert.equal(convergenceAssimilationRunTracePackJson.runId, queueConvergenceAssimilationRunJson.run.id);
    assert.equal(convergenceAssimilationRunTracePackJson.pairId, operatorProposalJson.review.pairId);
    assert.equal(convergenceAssimilationRunTracePackJson.runner, "claude");
    assert.equal(convergenceAssimilationRunTracePackJson.relatedTaskCount, 1);
    assert.match(convergenceAssimilationRunTracePackJson.protocolVersion, /convergence-assimilation-run-trace-pack/);
    assert.match(convergenceAssimilationRunTracePackJson.markdown, /# Convergence Assimilation Run Trace Pack/);
    assert.match(convergenceAssimilationRunTracePackJson.secretPolicy, /Non-secret convergence assimilation run trace metadata only/);

    const unscopedConvergenceAssimilationRunResultResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runs/${encodeURIComponent(queueConvergenceAssimilationRunJson.run.id)}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "passed",
        summary: "Non-secret fixture result captured.",
        changedFiles: ["src/shared.js"],
        validationSummary: "Fixture validation passed.",
        nextAction: "Review result checkpoint."
      })
    });
    assert.equal(unscopedConvergenceAssimilationRunResultResponse.status, 409);
    const unscopedConvergenceAssimilationRunResultJson = await unscopedConvergenceAssimilationRunResultResponse.json();
    assert.equal(unscopedConvergenceAssimilationRunResultJson.reasonCode, "agent-execution-scope-required");

    const convergenceAssimilationRunResultResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runs/${encodeURIComponent(queueConvergenceAssimilationRunJson.run.id)}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "passed",
        summary: "Non-secret fixture result captured.",
        changedFiles: ["src/shared.js"],
        validationSummary: "Fixture validation passed.",
        nextAction: "Review result checkpoint.",
        ...convergenceScope
      })
    });
    assert.equal(convergenceAssimilationRunResultResponse.status, 200);
    const convergenceAssimilationRunResultJson = await convergenceAssimilationRunResultResponse.json();
    assert.equal(convergenceAssimilationRunResultJson.success, true);
    assert.equal(convergenceAssimilationRunResultJson.result.runId, queueConvergenceAssimilationRunJson.run.id);
    assert.equal(convergenceAssimilationRunResultJson.result.pairId, operatorProposalJson.review.pairId);
    assert.equal(convergenceAssimilationRunResultJson.result.status, "passed");
    assert.equal(convergenceAssimilationRunResultJson.result.changedFiles[0], "src/shared.js");
    assert.match(convergenceAssimilationRunResultJson.result.secretPolicy, /Non-secret convergence assimilation run result metadata only/);
    assert.equal(convergenceAssimilationRunResultJson.run.convergenceAssimilationResultStatus, "passed");
    assert.equal(convergenceAssimilationRunResultJson.run.status, "passed");
    assert.equal(convergenceAssimilationRunResultJson.run.convergenceAssimilationValidationSummary, "Fixture validation passed.");
    assert.ok(convergenceAssimilationRunResultJson.governanceOperationCount >= 1);

    const convergenceAssimilationResultLedgerResponse = await fetch(`${baseUrl}/api/convergence/assimilation-result-ledger?status=passed`);
    assert.equal(convergenceAssimilationResultLedgerResponse.status, 200);
    const convergenceAssimilationResultLedgerJson = await convergenceAssimilationResultLedgerResponse.json();
    assert.equal(convergenceAssimilationResultLedgerJson.summary.total, 1);
    assert.equal(convergenceAssimilationResultLedgerJson.summary.visible, 1);
    assert.equal(convergenceAssimilationResultLedgerJson.summary.passed, 1);
    assert.equal(convergenceAssimilationResultLedgerJson.summary.pairCount, 1);
    assert.equal(convergenceAssimilationResultLedgerJson.results[0].runId, queueConvergenceAssimilationRunJson.run.id);
    assert.match(convergenceAssimilationResultLedgerJson.markdown, /# Convergence Assimilation Result Ledger/);
    assert.match(convergenceAssimilationResultLedgerJson.secretPolicy, /Non-secret convergence assimilation result metadata only/);

    const unscopedConvergenceAssimilationResultCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-results/${encodeURIComponent(convergenceAssimilationRunResultJson.result.id)}/checkpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision: "confirmed",
        note: "Fixture checkpoint accepted."
      })
    });
    assert.equal(unscopedConvergenceAssimilationResultCheckpointResponse.status, 409);
    const unscopedConvergenceAssimilationResultCheckpointJson = await unscopedConvergenceAssimilationResultCheckpointResponse.json();
    assert.equal(unscopedConvergenceAssimilationResultCheckpointJson.reasonCode, "agent-execution-scope-required");

    const convergenceAssimilationResultCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-results/${encodeURIComponent(convergenceAssimilationRunResultJson.result.id)}/checkpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision: "confirmed",
        note: "Fixture checkpoint accepted.",
        ...convergenceScope
      })
    });
    assert.equal(convergenceAssimilationResultCheckpointResponse.status, 200);
    const convergenceAssimilationResultCheckpointJson = await convergenceAssimilationResultCheckpointResponse.json();
    assert.equal(convergenceAssimilationResultCheckpointJson.success, true);
    assert.equal(convergenceAssimilationResultCheckpointJson.mode, "created");
    assert.equal(convergenceAssimilationResultCheckpointJson.decision, "confirmed");
    assert.equal(convergenceAssimilationResultCheckpointJson.task.convergenceAssimilationRunResultId, convergenceAssimilationRunResultJson.result.id);
    assert.equal(convergenceAssimilationResultCheckpointJson.task.convergenceAssimilationResultCheckpointDecision, "confirmed");
    assert.equal(convergenceAssimilationResultCheckpointJson.task.status, "resolved");
    assert.match(convergenceAssimilationResultCheckpointJson.task.secretPolicy, /non-secret-convergence-assimilation-result-checkpoint-only/);

    const convergenceAssimilationResultCheckpointLedgerResponse = await fetch(`${baseUrl}/api/convergence/assimilation-result-checkpoint-ledger?status=closed`);
    assert.equal(convergenceAssimilationResultCheckpointLedgerResponse.status, 200);
    const convergenceAssimilationResultCheckpointLedgerJson = await convergenceAssimilationResultCheckpointLedgerResponse.json();
    assert.equal(convergenceAssimilationResultCheckpointLedgerJson.summary.total, 1);
    assert.equal(convergenceAssimilationResultCheckpointLedgerJson.summary.visible, 1);
    assert.equal(convergenceAssimilationResultCheckpointLedgerJson.summary.confirmed, 1);
    assert.equal(convergenceAssimilationResultCheckpointLedgerJson.summary.closed, 1);
    assert.equal(convergenceAssimilationResultCheckpointLedgerJson.items[0].convergenceAssimilationRunResultId, convergenceAssimilationRunResultJson.result.id);
    assert.match(convergenceAssimilationResultCheckpointLedgerJson.markdown, /# Convergence Assimilation Result Checkpoint Ledger/);
    assert.match(convergenceAssimilationResultCheckpointLedgerJson.secretPolicy, /Non-secret convergence assimilation result checkpoint metadata only/);

    const convergenceAssimilationReadinessGateResponse = await fetch(`${baseUrl}/api/convergence/assimilation-readiness-gate`);
    assert.equal(convergenceAssimilationReadinessGateResponse.status, 200);
    const convergenceAssimilationReadinessGateJson = await convergenceAssimilationReadinessGateResponse.json();
    assert.equal(convergenceAssimilationReadinessGateJson.decision, "ready");
    assert.equal(convergenceAssimilationReadinessGateJson.summary.runCount, 1);
    assert.equal(convergenceAssimilationReadinessGateJson.summary.resultCount, 1);
    assert.equal(convergenceAssimilationReadinessGateJson.summary.confirmedCheckpointCount, 1);
    assert.equal(convergenceAssimilationReadinessGateJson.reasons.length, 0);
    assert.match(convergenceAssimilationReadinessGateJson.protocolVersion, /convergence-assimilation-readiness-gate/);
    assert.match(convergenceAssimilationReadinessGateJson.markdown, /# Convergence Assimilation Readiness Gate/);
    assert.match(convergenceAssimilationReadinessGateJson.secretPolicy, /Non-secret convergence assimilation readiness metadata only/);

    const convergenceAssimilationCliHandoffContractResponse = await fetch(`${baseUrl}/api/convergence/assimilation-cli-handoff-contract?runner=claude`);
    assert.equal(convergenceAssimilationCliHandoffContractResponse.status, 200);
    const convergenceAssimilationCliHandoffContractJson = await convergenceAssimilationCliHandoffContractResponse.json();
    assert.equal(convergenceAssimilationCliHandoffContractJson.runner, "claude");
    assert.equal(convergenceAssimilationCliHandoffContractJson.readinessGate.decision, "ready");
    assert.ok(convergenceAssimilationCliHandoffContractJson.expectedResultSchema.status.includes("passed"));
    assert.match(convergenceAssimilationCliHandoffContractJson.protocolVersion, /convergence-assimilation-cli-handoff-contract/);
    assert.match(convergenceAssimilationCliHandoffContractJson.markdown, /# Convergence Assimilation CLI Handoff Contract/);
    assert.match(convergenceAssimilationCliHandoffContractJson.secretPolicy, /Non-secret convergence assimilation CLI handoff contract only/);

    const convergenceAssimilationOperatorPlaybookResponse = await fetch(`${baseUrl}/api/convergence/assimilation-operator-playbook`);
    assert.equal(convergenceAssimilationOperatorPlaybookResponse.status, 200);
    const convergenceAssimilationOperatorPlaybookJson = await convergenceAssimilationOperatorPlaybookResponse.json();
    assert.equal(convergenceAssimilationOperatorPlaybookJson.readinessGateDecision, "ready");
    assert.ok(convergenceAssimilationOperatorPlaybookJson.steps.length >= 7);
    assert.match(convergenceAssimilationOperatorPlaybookJson.protocolVersion, /convergence-assimilation-operator-playbook/);
    assert.match(convergenceAssimilationOperatorPlaybookJson.markdown, /# Convergence Assimilation Operator Playbook/);
    assert.match(convergenceAssimilationOperatorPlaybookJson.secretPolicy, /Non-secret convergence assimilation operator playbook only/);

    const convergenceAssimilationSessionPacketResponse = await fetch(`${baseUrl}/api/convergence/assimilation-session-packet?runner=codex`);
    assert.equal(convergenceAssimilationSessionPacketResponse.status, 200);
    const convergenceAssimilationSessionPacketJson = await convergenceAssimilationSessionPacketResponse.json();
    assert.equal(convergenceAssimilationSessionPacketJson.runner, "codex");
    assert.equal(convergenceAssimilationSessionPacketJson.readinessGate.decision, "ready");
    assert.match(convergenceAssimilationSessionPacketJson.protocolVersion, /convergence-assimilation-session-packet/);
    assert.match(convergenceAssimilationSessionPacketJson.markdown, /# Convergence Assimilation Session Packet/);
    assert.match(convergenceAssimilationSessionPacketJson.markdown, /# Convergence Assimilation Operator Playbook/);
    assert.match(convergenceAssimilationSessionPacketJson.secretPolicy, /Non-secret convergence assimilation session packet only/);

    const unscopedConvergenceAssimilationSessionPacketSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-session-packet-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Unscoped Fixture Codex Session Packet",
        runner: "codex"
      })
    });
    assert.equal(unscopedConvergenceAssimilationSessionPacketSnapshotResponse.status, 409);
    const unscopedConvergenceAssimilationSessionPacketSnapshotJson = await unscopedConvergenceAssimilationSessionPacketSnapshotResponse.json();
    assert.equal(unscopedConvergenceAssimilationSessionPacketSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createConvergenceAssimilationSessionPacketSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-session-packet-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Codex Session Packet",
        runner: "codex",
        ...convergenceScope
      })
    });
    assert.equal(createConvergenceAssimilationSessionPacketSnapshotResponse.status, 200);
    const createConvergenceAssimilationSessionPacketSnapshotJson = await createConvergenceAssimilationSessionPacketSnapshotResponse.json();
    assert.equal(createConvergenceAssimilationSessionPacketSnapshotJson.success, true);
    assert.equal(createConvergenceAssimilationSessionPacketSnapshotJson.snapshot.title, "Fixture Codex Session Packet");
    assert.equal(createConvergenceAssimilationSessionPacketSnapshotJson.snapshot.runner, "codex");
    assert.equal(createConvergenceAssimilationSessionPacketSnapshotJson.snapshot.readinessDecision, "ready");
    assert.equal(createConvergenceAssimilationSessionPacketSnapshotJson.snapshot.packet.readinessGate.decision, "ready");
    assert.match(createConvergenceAssimilationSessionPacketSnapshotJson.snapshot.markdown, /# Convergence Assimilation Session Packet/);

    const convergenceAssimilationSessionPacketSnapshotsResponse = await fetch(`${baseUrl}/api/convergence/assimilation-session-packet-snapshots`);
    assert.equal(convergenceAssimilationSessionPacketSnapshotsResponse.status, 200);
    const convergenceAssimilationSessionPacketSnapshotsJson = await convergenceAssimilationSessionPacketSnapshotsResponse.json();
    assert.equal(convergenceAssimilationSessionPacketSnapshotsJson.length, 1);
    assert.equal(convergenceAssimilationSessionPacketSnapshotsJson[0].title, "Fixture Codex Session Packet");

    const convergenceAssimilationRunnerCommandQueueDraftResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-command-queue-draft?runner=claude`);
    assert.equal(convergenceAssimilationRunnerCommandQueueDraftResponse.status, 200);
    const convergenceAssimilationRunnerCommandQueueDraftJson = await convergenceAssimilationRunnerCommandQueueDraftResponse.json();
    assert.equal(convergenceAssimilationRunnerCommandQueueDraftJson.runner, "claude");
    assert.match(convergenceAssimilationRunnerCommandQueueDraftJson.protocolVersion, /convergence-assimilation-runner-command-queue-draft/);
    assert.ok(convergenceAssimilationRunnerCommandQueueDraftJson.commands.length >= 6);
    assert.match(convergenceAssimilationRunnerCommandQueueDraftJson.markdown, /# Convergence Assimilation Runner Command Queue Draft/);
    assert.match(convergenceAssimilationRunnerCommandQueueDraftJson.secretPolicy, /Non-secret convergence assimilation runner command queue draft only/);

    const convergenceAssimilationRunnerResultReplayChecklistResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-result-replay-checklist?runner=codex`);
    assert.equal(convergenceAssimilationRunnerResultReplayChecklistResponse.status, 200);
    const convergenceAssimilationRunnerResultReplayChecklistJson = await convergenceAssimilationRunnerResultReplayChecklistResponse.json();
    assert.equal(convergenceAssimilationRunnerResultReplayChecklistJson.runner, "codex");
    assert.match(convergenceAssimilationRunnerResultReplayChecklistJson.protocolVersion, /convergence-assimilation-runner-result-replay-checklist/);
    assert.ok(convergenceAssimilationRunnerResultReplayChecklistJson.items.length >= 6);
    assert.match(convergenceAssimilationRunnerResultReplayChecklistJson.markdown, /# Convergence Assimilation Runner Result Replay Checklist/);
    assert.match(convergenceAssimilationRunnerResultReplayChecklistJson.secretPolicy, /Non-secret convergence assimilation runner result replay checklist only/);

    const convergenceAssimilationRunnerLaunchpadGateResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launchpad-gate?runner=codex`);
    assert.equal(convergenceAssimilationRunnerLaunchpadGateResponse.status, 200);
    const convergenceAssimilationRunnerLaunchpadGateJson = await convergenceAssimilationRunnerLaunchpadGateResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchpadGateJson.runner, "codex");
    assert.equal(convergenceAssimilationRunnerLaunchpadGateJson.decision, "ready");
    assert.match(convergenceAssimilationRunnerLaunchpadGateJson.protocolVersion, /convergence-assimilation-runner-launchpad-gate/);
    assert.match(convergenceAssimilationRunnerLaunchpadGateJson.markdown, /# Convergence Assimilation Runner Launchpad Gate/);
    assert.match(convergenceAssimilationRunnerLaunchpadGateJson.secretPolicy, /Non-secret convergence assimilation runner launchpad gate only/);

    const unscopedConvergenceAssimilationRunnerLaunchpadGateSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launchpad-gate-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Unscoped Fixture Codex Launchpad Gate",
        runner: "codex"
      })
    });
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchpadGateSnapshotResponse.status, 409);
    const unscopedConvergenceAssimilationRunnerLaunchpadGateSnapshotJson = await unscopedConvergenceAssimilationRunnerLaunchpadGateSnapshotResponse.json();
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchpadGateSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createConvergenceAssimilationRunnerLaunchpadGateSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launchpad-gate-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Codex Launchpad Gate",
        runner: "codex",
        ...convergenceScope
      })
    });
    assert.equal(createConvergenceAssimilationRunnerLaunchpadGateSnapshotResponse.status, 200);
    const createConvergenceAssimilationRunnerLaunchpadGateSnapshotJson = await createConvergenceAssimilationRunnerLaunchpadGateSnapshotResponse.json();
    assert.equal(createConvergenceAssimilationRunnerLaunchpadGateSnapshotJson.success, true);
    assert.equal(createConvergenceAssimilationRunnerLaunchpadGateSnapshotJson.snapshot.title, "Fixture Codex Launchpad Gate");
    assert.equal(createConvergenceAssimilationRunnerLaunchpadGateSnapshotJson.snapshot.runner, "codex");
    assert.equal(createConvergenceAssimilationRunnerLaunchpadGateSnapshotJson.snapshot.decision, "ready");
    assert.equal(createConvergenceAssimilationRunnerLaunchpadGateSnapshotJson.snapshot.gate.decision, "ready");
    assert.match(createConvergenceAssimilationRunnerLaunchpadGateSnapshotJson.snapshot.markdown, /# Convergence Assimilation Runner Launchpad Gate/);

    const convergenceAssimilationRunnerLaunchpadGateSnapshotsResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launchpad-gate-snapshots`);
    assert.equal(convergenceAssimilationRunnerLaunchpadGateSnapshotsResponse.status, 200);
    const convergenceAssimilationRunnerLaunchpadGateSnapshotsJson = await convergenceAssimilationRunnerLaunchpadGateSnapshotsResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchpadGateSnapshotsJson.length, 1);
    assert.equal(convergenceAssimilationRunnerLaunchpadGateSnapshotsJson[0].title, "Fixture Codex Launchpad Gate");

    const convergenceAssimilationRunnerLaunchpadGateSnapshotDiffResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launchpad-gate-snapshots/diff?snapshotId=latest&runner=codex`);
    assert.equal(convergenceAssimilationRunnerLaunchpadGateSnapshotDiffResponse.status, 200);
    const convergenceAssimilationRunnerLaunchpadGateSnapshotDiffJson = await convergenceAssimilationRunnerLaunchpadGateSnapshotDiffResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchpadGateSnapshotDiffJson.hasSnapshot, true);
    assert.equal(convergenceAssimilationRunnerLaunchpadGateSnapshotDiffJson.runner, "codex");
    assert.equal(convergenceAssimilationRunnerLaunchpadGateSnapshotDiffJson.driftSeverity, "none");
    assert.equal(convergenceAssimilationRunnerLaunchpadGateSnapshotDiffJson.driftItems.length, 0);
    assert.match(convergenceAssimilationRunnerLaunchpadGateSnapshotDiffJson.markdown, /# Convergence Assimilation Runner Launchpad Gate Snapshot Drift/);

    const convergenceAssimilationRunnerLaunchAuthorizationPackResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-authorization-pack?runner=codex`);
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackResponse.status, 200);
    const convergenceAssimilationRunnerLaunchAuthorizationPackJson = await convergenceAssimilationRunnerLaunchAuthorizationPackResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackJson.runner, "codex");
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackJson.decision, "ready");
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackJson.authorizationStatus, "authorized-for-one-bounded-run");
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackJson.launchpadGateSnapshotDrift.hasSnapshot, true);
    assert.ok(convergenceAssimilationRunnerLaunchAuthorizationPackJson.commandQueueDraft.commands.length >= 6);
    assert.match(convergenceAssimilationRunnerLaunchAuthorizationPackJson.protocolVersion, /convergence-assimilation-runner-launch-authorization-pack/);
    assert.match(convergenceAssimilationRunnerLaunchAuthorizationPackJson.markdown, /# Convergence Assimilation Runner Launch Authorization Pack/);
    assert.match(convergenceAssimilationRunnerLaunchAuthorizationPackJson.secretPolicy, /Non-secret convergence assimilation runner launch authorization pack only/);

    const convergenceAssimilationRunnerLaunchControlBoardResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-control-board?runner=codex`);
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardResponse.status, 200);
    const convergenceAssimilationRunnerLaunchControlBoardJson = await convergenceAssimilationRunnerLaunchControlBoardResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardJson.runner, "codex");
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardJson.launchDecision, "ready");
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardJson.launchStatus, "launch-ready");
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardJson.openCheckpointCount, 0);
    assert.match(convergenceAssimilationRunnerLaunchControlBoardJson.protocolVersion, /convergence-assimilation-runner-launch-control-board/);
    assert.match(convergenceAssimilationRunnerLaunchControlBoardJson.markdown, /# Convergence Assimilation Runner Launch Control Board/);

    const convergenceAssimilationRunnerLaunchExecutionPacketResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-execution-packet?runner=claude`);
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketResponse.status, 200);
    const convergenceAssimilationRunnerLaunchExecutionPacketJson = await convergenceAssimilationRunnerLaunchExecutionPacketResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketJson.runner, "claude");
    assert.match(convergenceAssimilationRunnerLaunchExecutionPacketJson.protocolVersion, /convergence-assimilation-runner-launch-execution-packet/);
    assert.ok(convergenceAssimilationRunnerLaunchExecutionPacketJson.preflightChecks.length >= 5);
    assert.ok(convergenceAssimilationRunnerLaunchExecutionPacketJson.commandQueueDraft.commands.length >= 6);
    assert.match(convergenceAssimilationRunnerLaunchExecutionPacketJson.markdown, /# Convergence Assimilation Runner Launch Execution Packet/);
    assert.match(convergenceAssimilationRunnerLaunchExecutionPacketJson.secretPolicy, /Non-secret convergence assimilation runner launch execution packet only/);

    const convergenceAssimilationRunnerLaunchStackStatusResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-status?runner=claude`);
    assert.equal(convergenceAssimilationRunnerLaunchStackStatusResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackStatusJson = await convergenceAssimilationRunnerLaunchStackStatusResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackStatusJson.runner, "claude");
    assert.match(convergenceAssimilationRunnerLaunchStackStatusJson.protocolVersion, /convergence-assimilation-runner-launch-stack-status/);
    assert.ok(["ready", "review", "hold"].includes(convergenceAssimilationRunnerLaunchStackStatusJson.decision));
    assert.ok(convergenceAssimilationRunnerLaunchStackStatusJson.stages.length >= 8);
    assert.ok(convergenceAssimilationRunnerLaunchStackStatusJson.summary.total >= 8);
    assert.equal(convergenceAssimilationRunnerLaunchStackStatusJson.stages.some((stage) => stage.id === "launch-stack-remediation-pack-snapshot-drift"), true);
    assert.equal(convergenceAssimilationRunnerLaunchStackStatusJson.stages.some((stage) => stage.id === "launch-stack-remediation-pack-drift-checkpoints"), true);
    assert.match(convergenceAssimilationRunnerLaunchStackStatusJson.markdown, /# Convergence Assimilation Runner Launch Stack Status/);
    assert.match(convergenceAssimilationRunnerLaunchStackStatusJson.secretPolicy, /Non-secret convergence assimilation runner launch stack status only/);

    const launchStackActionTaskStages = convergenceAssimilationRunnerLaunchStackStatusJson.stages.filter((stage) => stage.status !== "ready");
    assert.ok(launchStackActionTaskStages.length >= 1);
    const unscopedConvergenceAssimilationRunnerLaunchStackActionTasksResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "claude",
        stages: [launchStackActionTaskStages[0]]
      })
    });
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchStackActionTasksResponse.status, 409);
    const unscopedConvergenceAssimilationRunnerLaunchStackActionTasksJson = await unscopedConvergenceAssimilationRunnerLaunchStackActionTasksResponse.json();
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchStackActionTasksJson.reasonCode, "agent-execution-scope-required");

    const createConvergenceAssimilationRunnerLaunchStackActionTasksResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "claude",
        stages: [launchStackActionTaskStages[0]],
        ...convergenceScope
      })
    });
    assert.equal(createConvergenceAssimilationRunnerLaunchStackActionTasksResponse.status, 200);
    const createConvergenceAssimilationRunnerLaunchStackActionTasksJson = await createConvergenceAssimilationRunnerLaunchStackActionTasksResponse.json();
    assert.equal(createConvergenceAssimilationRunnerLaunchStackActionTasksJson.success, true);
    assert.equal(createConvergenceAssimilationRunnerLaunchStackActionTasksJson.totals.requested, 1);
    assert.equal(createConvergenceAssimilationRunnerLaunchStackActionTasksJson.totals.created, 1);
    assert.equal(createConvergenceAssimilationRunnerLaunchStackActionTasksJson.totals.skipped, 0);
    assert.equal(createConvergenceAssimilationRunnerLaunchStackActionTasksJson.createdTasks[0].sourceType, "convergence-assimilation-runner-launch-stack-stage-action");
    assert.equal(createConvergenceAssimilationRunnerLaunchStackActionTasksJson.createdTasks[0].convergenceAssimilationRunnerLaunchStackRunner, "claude");
    assert.equal(createConvergenceAssimilationRunnerLaunchStackActionTasksJson.createdTasks[0].convergenceAssimilationRunnerLaunchStackStageId, launchStackActionTaskStages[0].id);
    assert.equal(createConvergenceAssimilationRunnerLaunchStackActionTasksJson.createdTasks[0].status, "open");
    assert.equal(createConvergenceAssimilationRunnerLaunchStackActionTasksJson.createdTasks[0].secretPolicy, "non-secret-convergence-assimilation-runner-launch-stack-readiness-evidence-only");

    const duplicateConvergenceAssimilationRunnerLaunchStackActionTasksResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "claude",
        stages: [launchStackActionTaskStages[0]],
        ...convergenceScope
      })
    });
    assert.equal(duplicateConvergenceAssimilationRunnerLaunchStackActionTasksResponse.status, 200);
    const duplicateConvergenceAssimilationRunnerLaunchStackActionTasksJson = await duplicateConvergenceAssimilationRunnerLaunchStackActionTasksResponse.json();
    assert.equal(duplicateConvergenceAssimilationRunnerLaunchStackActionTasksJson.totals.requested, 1);
    assert.equal(duplicateConvergenceAssimilationRunnerLaunchStackActionTasksJson.totals.created, 0);
    assert.equal(duplicateConvergenceAssimilationRunnerLaunchStackActionTasksJson.totals.skipped, 1);

    const convergenceAssimilationRunnerLaunchStackActionTaskLedgerResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-task-ledger?runner=claude&status=open`);
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackActionTaskLedgerJson = await convergenceAssimilationRunnerLaunchStackActionTaskLedgerResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerJson.runner, "claude");
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerJson.status, "open");
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerJson.summary.total, 1);
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerJson.summary.open, 1);
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerJson.summary.claude, 1);
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerJson.items[0].stageId, launchStackActionTaskStages[0].id);
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerJson.items[0].runner, "claude");
    assert.match(convergenceAssimilationRunnerLaunchStackActionTaskLedgerJson.markdown, /# Convergence Assimilation Runner Launch Stack Action Task Ledger/);
    assert.match(convergenceAssimilationRunnerLaunchStackActionTaskLedgerJson.secretPolicy, /Non-secret convergence assimilation runner launch stack action task metadata only/);

    const unscopedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "claude",
        status: "open",
        title: "Unscoped Fixture Claude Launch Stack Action Tasks"
      })
    });
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotResponse.status, 409);
    const unscopedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotJson = await unscopedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotResponse.json();
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "claude",
        status: "open",
        ...convergenceScope,
        title: "Fixture Claude Launch Stack Action Tasks"
      })
    });
    assert.equal(createConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotResponse.status, 200);
    const createConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotJson = await createConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotResponse.json();
    assert.equal(createConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotJson.success, true);
    assert.equal(createConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotJson.snapshot.runner, "claude");
    assert.equal(createConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotJson.snapshot.statusFilter, "open");
    assert.equal(createConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotJson.snapshot.total, 1);
    assert.equal(createConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotJson.snapshot.openCount, 1);
    assert.equal(createConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotJson.snapshot.title, "Fixture Claude Launch Stack Action Tasks");

    const convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotsResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-task-ledger-snapshots`);
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotsResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotsJson = await convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotsResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotsJson.length, 1);
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotsJson[0].title, "Fixture Claude Launch Stack Action Tasks");

    const convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffJson = await convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffJson.hasSnapshot, true);
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffJson.hasDrift, false);
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffJson.driftSeverity, "none");
    assert.match(convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffJson.markdown, /# Convergence Assimilation Runner Launch Stack Action Task Ledger Snapshot Drift/);

    const createCodexConvergenceAssimilationRunnerLaunchStackActionTasksResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "codex",
        stages: [launchStackActionTaskStages[0]],
        ...convergenceScope
      })
    });
    assert.equal(createCodexConvergenceAssimilationRunnerLaunchStackActionTasksResponse.status, 200);
    const createCodexConvergenceAssimilationRunnerLaunchStackActionTasksJson = await createCodexConvergenceAssimilationRunnerLaunchStackActionTasksResponse.json();
    assert.equal(createCodexConvergenceAssimilationRunnerLaunchStackActionTasksJson.totals.created, 1);

    const driftedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-task-ledger-snapshots/diff?snapshotId=latest&runner=all&status=open`);
    assert.equal(driftedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffResponse.status, 200);
    const driftedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffJson = await driftedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffResponse.json();
    assert.equal(driftedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffJson.hasDrift, true);
    assert.equal(driftedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffJson.driftItems.some((item) => item.field === "total"), true);

    const unscopedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-task-ledger-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "all",
        status: "open",
        field: "total",
        decision: "escalated",
        note: "Unscoped fixture drift checkpoint for launch stack action task ledger totals."
      })
    });
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointResponse.status, 409);
    const unscopedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointJson = await unscopedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointResponse.json();
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointJson.reasonCode, "agent-execution-scope-required");

    const convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-task-ledger-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "all",
        status: "open",
        field: "total",
        decision: "escalated",
        ...convergenceScope,
        note: "Fixture drift checkpoint for launch stack action task ledger totals."
      })
    });
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointJson = await convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointJson.success, true);
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointJson.decision, "escalated");
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointJson.task.sourceType, "convergence-assimilation-runner-launch-stack-action-task-ledger-snapshot-drift-checkpoint");
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointJson.task.secretPolicy, "non-secret-convergence-assimilation-runner-launch-stack-action-task-ledger-drift-checkpoint-only");

    const checkpointedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-task-ledger-snapshots/diff?snapshotId=latest&runner=all&status=open`);
    assert.equal(checkpointedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffResponse.status, 200);
    const checkpointedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffJson = await checkpointedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffResponse.json();
    assert.equal(checkpointedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffJson.driftItems.find((item) => item.field === "total")?.checkpointDecision, "escalated");

    const convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedgerResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-task-ledger-drift-checkpoint-ledger?status=open`);
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedgerResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedgerJson = await convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedgerResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedgerJson.summary.visible, 1);
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedgerJson.summary.escalated, 1);
    assert.equal(convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedgerJson.summary.openEscalated, 1);
    assert.match(convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedgerJson.markdown, /# Convergence Assimilation Runner Launch Stack Action Task Ledger Drift Checkpoint Ledger/);

    const convergenceAssimilationRunnerLaunchStackStatusAfterActionTaskDriftResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-status?runner=claude`);
    assert.equal(convergenceAssimilationRunnerLaunchStackStatusAfterActionTaskDriftResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackStatusAfterActionTaskDriftJson = await convergenceAssimilationRunnerLaunchStackStatusAfterActionTaskDriftResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackStatusAfterActionTaskDriftJson.stages.some((stage) => stage.id === "launch-stack-action-task-ledger-snapshot-drift"), true);
    assert.equal(convergenceAssimilationRunnerLaunchStackStatusAfterActionTaskDriftJson.stages.some((stage) => stage.id === "launch-stack-action-task-ledger-drift-checkpoints"), true);
    assert.equal(convergenceAssimilationRunnerLaunchStackStatusAfterActionTaskDriftJson.stages.find((stage) => stage.id === "launch-stack-action-task-ledger-drift-checkpoints")?.status, "hold");

    const convergenceAssimilationRunnerLaunchStackRemediationPackResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-pack?runner=claude`);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackRemediationPackJson = await convergenceAssimilationRunnerLaunchStackRemediationPackResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackJson.protocolVersion, "convergence-assimilation-runner-launch-stack-remediation-pack.v1");
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackJson.runner, "claude");
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackJson.decision, "hold");
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackJson.summary.openCheckpoints, 1);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackJson.summary.openEscalatedCheckpoints, 1);
    assert.match(convergenceAssimilationRunnerLaunchStackRemediationPackJson.markdown, /# Convergence Assimilation Runner Launch Stack Remediation Pack/);
    assert.match(convergenceAssimilationRunnerLaunchStackRemediationPackJson.markdown, /Open escalated checkpoints: 1/);

    const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraftResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-work-order-draft?runner=claude`);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraftResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraftJson = await convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraftResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraftJson.protocolVersion, "convergence-assimilation-runner-launch-stack-remediation-work-order-draft.v1");
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraftJson.runner, "claude");
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraftJson.executionMode, "non-executing");
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraftJson.remediationPackDecision, "hold");
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraftJson.workItems.length >= 1, true);
    assert.match(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraftJson.draft.prompt, /Claude CLI/);
    assert.match(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraftJson.markdown, /# Convergence Assimilation Runner Launch Stack Remediation Work-Order Draft/);
    assert.match(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraftJson.secretPolicy, /Non-secret convergence assimilation runner launch stack remediation work-order draft only/);

    const unscopedQueueConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-work-order-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runner: "claude" })
    });
    assert.equal(unscopedQueueConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResponse.status, 409);
    const unscopedQueueConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunJson = await unscopedQueueConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResponse.json();
    assert.equal(unscopedQueueConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunJson.reasonCode, "agent-execution-scope-required");

    const queueConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-work-order-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runner: "claude", ...taskMutationScope })
    });
    assert.equal(queueConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResponse.status, 200);
    const queueConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunJson = await queueConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResponse.json();
    assert.equal(queueConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunJson.success, true);
    assert.equal(queueConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunJson.run.convergenceAssimilationRunnerLaunchStackRemediationRunner, "claude");
    assert.equal(queueConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunJson.run.convergenceAssimilationRunnerLaunchStackRemediationBridgeMode, "runner-remediation-work-order-draft");
    assert.equal(queueConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunJson.run.convergenceAssimilationRunnerLaunchStackRemediationWorkItemCount >= 1, true);

    const duplicateConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-work-order-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runner: "claude", ...taskMutationScope })
    });
    assert.equal(duplicateConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResponse.status, 200);
    const duplicateConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunJson = await duplicateConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResponse.json();
    assert.equal(duplicateConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunJson.run, null);
    assert.match(duplicateConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunJson.skippedRun.reason, /already exists/);

    const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-work-order-run-ledger?status=all&runner=claude`);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerJson = await convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerJson.protocolVersion, "convergence-assimilation-runner-launch-stack-remediation-work-order-run-ledger.v1");
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerJson.runner, "claude");
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerJson.summary.visible, 1);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerJson.summary.claude, 1);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerJson.summary.workItems >= 1, true);
    assert.match(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerJson.markdown, /# Convergence Assimilation Runner Launch Stack Remediation Work-Order Run Ledger/);

    const unscopedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-work-order-runs/${encodeURIComponent(queueConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunJson.run.id)}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "passed",
        summary: "Unscoped fixture remediation result should be rejected."
      })
    });
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultResponse.status, 409);
    const unscopedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultJson = await unscopedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultResponse.json();
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultJson.reasonCode, "agent-execution-scope-required");

    const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-work-order-runs/${encodeURIComponent(queueConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunJson.run.id)}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "passed",
        ...taskMutationScope,
        summary: "Non-secret fixture remediation result captured.",
        changedFiles: ["lib/workspace-audit-server.mjs"],
        validationSummary: "Fixture remediation validation passed.",
        nextAction: "Refresh remediation pack baseline."
      })
    });
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultJson = await convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultJson.success, true);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultJson.result.runId, queueConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunJson.run.id);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultJson.result.status, "passed");
    assert.match(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultJson.result.secretPolicy, /Non-secret convergence assimilation runner launch stack remediation work-order result metadata only/);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultJson.run.status, "passed");
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultJson.run.convergenceAssimilationRunnerLaunchStackRemediationResultStatus, "passed");

    const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-work-order-result-ledger?status=passed&runner=claude`);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerJson = await convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerJson.protocolVersion, "convergence-assimilation-runner-launch-stack-remediation-work-order-result-ledger.v1");
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerJson.status, "passed");
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerJson.runner, "claude");
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerJson.summary.visible, 1);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerJson.summary.passed, 1);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerJson.results[0].runId, queueConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunJson.run.id);
    assert.match(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerJson.markdown, /# Convergence Assimilation Runner Launch Stack Remediation Work-Order Result Ledger/);

    const blockedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-work-order-runs/${encodeURIComponent(queueConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunJson.run.id)}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "blocked",
        ...taskMutationScope,
        summary: "Non-secret fixture remediation blocker captured.",
        validationSummary: "Fixture remediation validation blocked.",
        blockers: ["Fixture blocker"],
        nextAction: "Create result follow-up task."
      })
    });
    assert.equal(blockedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultResponse.status, 200);
    const blockedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultJson = await blockedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultResponse.json();
    assert.equal(blockedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultJson.success, true);
    assert.equal(blockedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultJson.result.status, "blocked");

    const unscopedCreateConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-work-order-result-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "blocked", runner: "claude" })
    });
    assert.equal(unscopedCreateConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksResponse.status, 409);
    const unscopedCreateConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksJson = await unscopedCreateConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksResponse.json();
    assert.equal(unscopedCreateConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksJson.reasonCode, "agent-execution-scope-required");

    const createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-work-order-result-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "blocked", runner: "claude", ...taskMutationScope })
    });
    assert.equal(createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksResponse.status, 200);
    const createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksJson = await createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksResponse.json();
    assert.equal(createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksJson.success, true);
    assert.equal(createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksJson.totals.requested, 1);
    assert.equal(createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksJson.totals.created, 1);
    assert.equal(createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksJson.totals.skipped, 0);
    assert.equal(createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksJson.createdTasks[0].sourceType, "convergence-assimilation-runner-launch-stack-remediation-work-order-result");
    assert.equal(createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksJson.createdTasks[0].sourceId, blockedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultJson.result.id);
    assert.equal(createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksJson.createdTasks[0].runner, "claude");
    assert.equal(createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksJson.createdTasks[0].convergenceAssimilationRunnerLaunchStackRemediationResultStatus, "blocked");
    assert.match(createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksJson.createdTasks[0].secretPolicy, /Non-secret convergence assimilation runner launch stack remediation result follow-up task only/);

    const duplicateConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-work-order-result-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "blocked", runner: "claude", ...taskMutationScope })
    });
    assert.equal(duplicateConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksResponse.status, 200);
    const duplicateConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksJson = await duplicateConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksResponse.json();
    assert.equal(duplicateConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksJson.totals.requested, 1);
    assert.equal(duplicateConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksJson.totals.created, 0);
    assert.equal(duplicateConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksJson.totals.skipped, 1);

    const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-work-order-result-task-ledger?status=open&runner=claude`);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerJson = await convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerJson.status, "open");
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerJson.runner, "claude");
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerJson.summary.visible, 1);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerJson.summary.open, 1);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerJson.summary.blocked, 1);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerJson.items[0].sourceId, blockedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunResultJson.result.id);
    assert.match(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerJson.markdown, /# Convergence Assimilation Runner Launch Stack Remediation Work-Order Result Follow-Up Task Ledger/);

    const resolveConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskResponse = await fetch(`${baseUrl}/api/tasks/${createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksJson.createdTasks[0].id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved", ...taskMutationScope })
    });
    assert.equal(resolveConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskResponse.status, 200);
    const resolveConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskJson = await resolveConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskResponse.json();
    assert.equal(resolveConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskJson.task.status, "resolved");

    const resolvedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-work-order-result-task-ledger?status=closed&runner=claude`);
    assert.equal(resolvedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerResponse.status, 200);
    const resolvedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerJson = await resolvedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerResponse.json();
    assert.equal(resolvedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerJson.summary.visible, 1);
    assert.equal(resolvedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerJson.summary.closed, 1);

    const reopenConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskResponse = await fetch(`${baseUrl}/api/tasks/${createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksJson.createdTasks[0].id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "open", ...taskMutationScope })
    });
    assert.equal(reopenConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskResponse.status, 200);
    const reopenConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskJson = await reopenConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskResponse.json();
    assert.equal(reopenConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskJson.task.status, "open");

    const blockConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskResponse = await fetch(`${baseUrl}/api/tasks/${createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksJson.createdTasks[0].id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "blocked", ...taskMutationScope })
    });
    assert.equal(blockConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskResponse.status, 200);
    const blockConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskJson = await blockConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskResponse.json();
    assert.equal(blockConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskJson.task.status, "blocked");

    const unscopedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-work-order-result-task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "claude",
        status: "all",
        title: "Unscoped Fixture Remediation Result Follow-Up Task Ledger"
      })
    });
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotResponse.status, 409);
    const unscopedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotJson = await unscopedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotResponse.json();
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-work-order-result-task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "claude",
        status: "all",
        title: "Fixture Remediation Result Follow-Up Task Ledger",
        ...taskMutationScope
      })
    });
    assert.equal(createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotResponse.status, 200);
    const createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotJson = await createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotResponse.json();
    assert.equal(createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotJson.success, true);
    assert.equal(createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotJson.snapshot.title, "Fixture Remediation Result Follow-Up Task Ledger");
    assert.equal(createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotJson.snapshot.runner, "claude");
    assert.equal(createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotJson.snapshot.visibleCount, 1);
    assert.match(createConvergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotJson.snapshot.markdown, /# Convergence Assimilation Runner Launch Stack Remediation Work-Order Result Follow-Up Task Ledger/);

    const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotsResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-work-order-result-task-ledger-snapshots`);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotsResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotsJson = await convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotsResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotsJson.length, 1);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotsJson[0].title, "Fixture Remediation Result Follow-Up Task Ledger");

    const unscopedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-pack-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "claude",
        title: "Unscoped Fixture Claude Launch Stack Remediation Pack"
      })
    });
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotResponse.status, 409);
    const unscopedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotJson = await unscopedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotResponse.json();
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-pack-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "claude",
        title: "Fixture Claude Launch Stack Remediation Pack",
        ...convergenceScope
      })
    });
    assert.equal(createConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotResponse.status, 200);
    const createConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotJson = await createConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotResponse.json();
    assert.equal(createConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotJson.success, true);
    assert.equal(createConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotJson.snapshot.title, "Fixture Claude Launch Stack Remediation Pack");
    assert.equal(createConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotJson.snapshot.runner, "claude");
    assert.equal(createConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotJson.snapshot.openEscalatedCheckpoints, 1);
    assert.match(createConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotJson.snapshot.markdown, /# Convergence Assimilation Runner Launch Stack Remediation Pack/);

    const convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotsResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-pack-snapshots`);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotsResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotsJson = await convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotsResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotsJson.length, 1);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotsJson[0].title, "Fixture Claude Launch Stack Remediation Pack");

    const convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-pack-snapshots/diff?snapshotId=latest&runner=claude`);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffJson = await convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffJson.hasSnapshot, true);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffJson.snapshotId, createConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotJson.snapshot.id);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffJson.hasDrift, false);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffJson.driftSeverity, "none");
    assert.match(convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffJson.markdown, /# Convergence Assimilation Runner Launch Stack Remediation Pack Snapshot Drift/);

    const unscopedRefreshConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-task-ledger-snapshots/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "all",
        status: "open",
        title: "Unscoped Fixture Refreshed Launch Stack Action Tasks"
      })
    });
    assert.equal(unscopedRefreshConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotResponse.status, 409);
    const unscopedRefreshConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotJson = await unscopedRefreshConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotResponse.json();
    assert.equal(unscopedRefreshConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotJson.reasonCode, "agent-execution-scope-required");

    const refreshConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-task-ledger-snapshots/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "all",
        status: "open",
        ...convergenceScope,
        title: "Fixture Refreshed Launch Stack Action Tasks"
      })
    });
    assert.equal(refreshConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotResponse.status, 200);
    const refreshConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotJson = await refreshConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotResponse.json();
    assert.equal(refreshConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotJson.success, true);
    assert.equal(refreshConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotJson.previousSnapshotId, createConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotJson.snapshot.id);
    assert.equal(refreshConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotJson.snapshot.title, "Fixture Refreshed Launch Stack Action Tasks");
    assert.equal(refreshConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotJson.snapshot.runner, "all");
    assert.equal(refreshConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotJson.snapshot.total, 2);
    assert.equal(refreshConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotJson.convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshots.length, 2);

    const refreshedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-task-ledger-snapshots/diff?snapshotId=latest&runner=all&status=open`);
    assert.equal(refreshedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffResponse.status, 200);
    const refreshedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffJson = await refreshedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffResponse.json();
    assert.equal(refreshedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffJson.hasDrift, false);
    assert.equal(refreshedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffJson.driftSeverity, "none");

    const resolveLaunchStackActionTaskLedgerDriftCheckpointResponse = await fetch(`${baseUrl}/api/tasks/${convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointJson.task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved", ...taskMutationScope })
    });
    assert.equal(resolveLaunchStackActionTaskLedgerDriftCheckpointResponse.status, 200);
    const resolveLaunchStackActionTaskLedgerDriftCheckpointJson = await resolveLaunchStackActionTaskLedgerDriftCheckpointResponse.json();
    assert.equal(resolveLaunchStackActionTaskLedgerDriftCheckpointJson.task.status, "resolved");

    const resolvedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedgerResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-task-ledger-drift-checkpoint-ledger?status=closed`);
    assert.equal(resolvedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedgerResponse.status, 200);
    const resolvedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedgerJson = await resolvedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedgerResponse.json();
    assert.equal(resolvedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedgerJson.summary.visible, 1);
    assert.equal(resolvedConvergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedgerJson.summary.openEscalated, 0);

    const convergenceAssimilationRunnerLaunchStackStatusAfterResolvedActionTaskDriftResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-status?runner=claude`);
    assert.equal(convergenceAssimilationRunnerLaunchStackStatusAfterResolvedActionTaskDriftResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackStatusAfterResolvedActionTaskDriftJson = await convergenceAssimilationRunnerLaunchStackStatusAfterResolvedActionTaskDriftResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackStatusAfterResolvedActionTaskDriftJson.stages.find((stage) => stage.id === "launch-stack-action-task-ledger-drift-checkpoints")?.status, "ready");
    assert.equal(convergenceAssimilationRunnerLaunchStackStatusAfterResolvedActionTaskDriftJson.stages.find((stage) => stage.id === "launch-stack-remediation-pack-snapshot-drift")?.status, "hold");

    const driftedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-pack-snapshots/diff?snapshotId=latest&runner=claude`);
    assert.equal(driftedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffResponse.status, 200);
    const driftedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffJson = await driftedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffResponse.json();
    assert.equal(driftedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffJson.hasSnapshot, true);
    assert.equal(driftedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffJson.hasDrift, true);
    const remediationPackDriftItem = driftedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffJson.driftItems.find((item) => item.field === "openEscalatedCheckpoints");
    assert.ok(remediationPackDriftItem);

    const unscopedConvergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-pack-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "claude",
        field: "openEscalatedCheckpoints",
        decision: "confirmed",
        note: "Unscoped remediation pack drift checkpoint should be rejected."
      })
    });
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointResponse.status, 409);
    const unscopedConvergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointJson = await unscopedConvergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointResponse.json();
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointJson.reasonCode, "agent-execution-scope-required");

    const convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-pack-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "claude",
        field: "openEscalatedCheckpoints",
        decision: "confirmed",
        note: "Fixture remediation pack drift accepted after action task ledger checkpoint resolution.",
        ...convergenceScope
      })
    });
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointJson = await convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointJson.success, true);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointJson.mode, "created");
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointJson.decision, "confirmed");
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointJson.task.sourceType, "convergence-assimilation-runner-launch-stack-remediation-pack-snapshot-drift-checkpoint");
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointJson.task.convergenceAssimilationRunnerLaunchStackRemediationPackDriftField, "openEscalatedCheckpoints");
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointJson.task.secretPolicy, "non-secret-convergence-assimilation-runner-launch-stack-remediation-pack-drift-checkpoint-only");

    const convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-pack-drift-checkpoint-ledger?status=closed`);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerJson = await convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerJson.summary.visible, 1);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerJson.summary.confirmed, 1);
    assert.equal(convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerJson.summary.closed, 1);
    assert.match(convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerJson.markdown, /# Convergence Assimilation Runner Launch Stack Remediation Pack Drift Checkpoint Ledger/);

    const checkpointedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-pack-snapshots/diff?snapshotId=latest&runner=claude`);
    assert.equal(checkpointedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffResponse.status, 200);
    const checkpointedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffJson = await checkpointedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffResponse.json();
    const checkpointedRemediationPackDriftItem = checkpointedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffJson.driftItems.find((item) => item.field === "openEscalatedCheckpoints");
    assert.equal(checkpointedRemediationPackDriftItem?.checkpointDecision, "confirmed");
    assert.equal(checkpointedRemediationPackDriftItem?.checkpointStatus, "resolved");

    const blockRemediationPackDriftCheckpointResponse = await fetch(`${baseUrl}/api/tasks/${convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointJson.task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "blocked", ...taskMutationScope })
    });
    assert.equal(blockRemediationPackDriftCheckpointResponse.status, 200);
    const blockRemediationPackDriftCheckpointJson = await blockRemediationPackDriftCheckpointResponse.json();
    assert.equal(blockRemediationPackDriftCheckpointJson.task.status, "blocked");

    const openConvergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-pack-drift-checkpoint-ledger?status=open`);
    assert.equal(openConvergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerResponse.status, 200);
    const openConvergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerJson = await openConvergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerResponse.json();
    assert.equal(openConvergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerJson.summary.visible, 1);
    assert.equal(openConvergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerJson.summary.open, 1);
    assert.equal(openConvergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerJson.summary.closed, 0);

    const reopenRemediationPackDriftCheckpointResponse = await fetch(`${baseUrl}/api/tasks/${convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointJson.task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "open", ...taskMutationScope })
    });
    assert.equal(reopenRemediationPackDriftCheckpointResponse.status, 200);
    const reopenRemediationPackDriftCheckpointJson = await reopenRemediationPackDriftCheckpointResponse.json();
    assert.equal(reopenRemediationPackDriftCheckpointJson.task.status, "open");

    const resolveRemediationPackDriftCheckpointResponse = await fetch(`${baseUrl}/api/tasks/${convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointJson.task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved", ...taskMutationScope })
    });
    assert.equal(resolveRemediationPackDriftCheckpointResponse.status, 200);
    const resolveRemediationPackDriftCheckpointJson = await resolveRemediationPackDriftCheckpointResponse.json();
    assert.equal(resolveRemediationPackDriftCheckpointJson.task.status, "resolved");

    const resolvedConvergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-pack-drift-checkpoint-ledger?status=closed`);
    assert.equal(resolvedConvergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerResponse.status, 200);
    const resolvedConvergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerJson = await resolvedConvergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerResponse.json();
    assert.equal(resolvedConvergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerJson.summary.visible, 1);
    assert.equal(resolvedConvergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerJson.summary.closed, 1);

    const unscopedRefreshConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-pack-snapshots/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "claude",
        title: "Unscoped Fixture Refreshed Claude Launch Stack Remediation Pack"
      })
    });
    assert.equal(unscopedRefreshConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotResponse.status, 409);
    const unscopedRefreshConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotJson = await unscopedRefreshConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotResponse.json();
    assert.equal(unscopedRefreshConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotJson.reasonCode, "agent-execution-scope-required");

    const refreshConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-pack-snapshots/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "claude",
        title: "Fixture Refreshed Claude Launch Stack Remediation Pack",
        ...convergenceScope
      })
    });
    assert.equal(refreshConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotResponse.status, 200);
    const refreshConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotJson = await refreshConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotResponse.json();
    assert.equal(refreshConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotJson.success, true);
    assert.equal(refreshConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotJson.previousSnapshotId, createConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotJson.snapshot.id);
    assert.equal(refreshConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotJson.snapshot.title, "Fixture Refreshed Claude Launch Stack Remediation Pack");
    assert.equal(refreshConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotJson.snapshot.runner, "claude");
    assert.equal(refreshConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotJson.snapshot.openEscalatedCheckpoints, 0);
    assert.equal(refreshConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotJson.convergenceAssimilationRunnerLaunchStackRemediationPackSnapshots.length, 2);

    const refreshedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-pack-snapshots/diff?snapshotId=latest&runner=claude`);
    assert.equal(refreshedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffResponse.status, 200);
    const refreshedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffJson = await refreshedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffResponse.json();
    assert.equal(refreshedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffJson.hasDrift, false);
    assert.equal(refreshedConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffJson.driftSeverity, "none");

    const convergenceAssimilationRunnerLaunchStackStatusAfterRemediationPackRefreshResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-status?runner=claude`);
    assert.equal(convergenceAssimilationRunnerLaunchStackStatusAfterRemediationPackRefreshResponse.status, 200);
    const convergenceAssimilationRunnerLaunchStackStatusAfterRemediationPackRefreshJson = await convergenceAssimilationRunnerLaunchStackStatusAfterRemediationPackRefreshResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchStackStatusAfterRemediationPackRefreshJson.stages.find((stage) => stage.id === "launch-stack-remediation-pack-snapshot-drift")?.status, "ready");
    assert.equal(convergenceAssimilationRunnerLaunchStackStatusAfterRemediationPackRefreshJson.stages.find((stage) => stage.id === "launch-stack-remediation-pack-drift-checkpoints")?.status, "ready");

    const unscopedConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-execution-packet-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "claude",
        title: "Unscoped Fixture Claude Launch Execution Packet"
      })
    });
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotResponse.status, 409);
    const unscopedConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotJson = await unscopedConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotResponse.json();
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-execution-packet-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "claude",
        title: "Fixture Claude Launch Execution Packet",
        ...convergenceScope
      })
    });
    assert.equal(createConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotResponse.status, 200);
    const createConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotJson = await createConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotResponse.json();
    assert.equal(createConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotJson.success, true);
    assert.equal(createConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotJson.snapshot.title, "Fixture Claude Launch Execution Packet");
    assert.equal(createConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotJson.snapshot.runner, "claude");
    assert.match(createConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotJson.snapshot.markdown, /# Convergence Assimilation Runner Launch Execution Packet/);

    const convergenceAssimilationRunnerLaunchExecutionPacketSnapshotsResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-execution-packet-snapshots`);
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketSnapshotsResponse.status, 200);
    const convergenceAssimilationRunnerLaunchExecutionPacketSnapshotsJson = await convergenceAssimilationRunnerLaunchExecutionPacketSnapshotsResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketSnapshotsJson.length, 1);
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketSnapshotsJson[0].title, "Fixture Claude Launch Execution Packet");

    const convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiffResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-execution-packet-snapshots/diff?snapshotId=latest&runner=claude`);
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiffResponse.status, 200);
    const convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiffJson = await convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiffResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiffJson.hasSnapshot, true);
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiffJson.runner, "claude");
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiffJson.driftSeverity, "none");
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiffJson.driftItems.length, 0);
    assert.match(convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiffJson.markdown, /# Convergence Assimilation Runner Launch Execution Packet Snapshot Drift/);

    const unscopedConvergenceAssimilationRunnerLaunchControlBoardSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-control-board-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "codex",
        title: "Unscoped Fixture Codex Launch Control Board"
      })
    });
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchControlBoardSnapshotResponse.status, 409);
    const unscopedConvergenceAssimilationRunnerLaunchControlBoardSnapshotJson = await unscopedConvergenceAssimilationRunnerLaunchControlBoardSnapshotResponse.json();
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchControlBoardSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createConvergenceAssimilationRunnerLaunchControlBoardSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-control-board-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "codex",
        title: "Fixture Codex Launch Control Board",
        ...convergenceScope
      })
    });
    assert.equal(createConvergenceAssimilationRunnerLaunchControlBoardSnapshotResponse.status, 200);
    const createConvergenceAssimilationRunnerLaunchControlBoardSnapshotJson = await createConvergenceAssimilationRunnerLaunchControlBoardSnapshotResponse.json();
    assert.equal(createConvergenceAssimilationRunnerLaunchControlBoardSnapshotJson.success, true);
    assert.equal(createConvergenceAssimilationRunnerLaunchControlBoardSnapshotJson.snapshot.title, "Fixture Codex Launch Control Board");
    assert.equal(createConvergenceAssimilationRunnerLaunchControlBoardSnapshotJson.snapshot.runner, "codex");
    assert.equal(createConvergenceAssimilationRunnerLaunchControlBoardSnapshotJson.snapshot.launchDecision, "ready");
    assert.equal(createConvergenceAssimilationRunnerLaunchControlBoardSnapshotJson.snapshot.launchStatus, "launch-ready");
    assert.match(createConvergenceAssimilationRunnerLaunchControlBoardSnapshotJson.snapshot.markdown, /# Convergence Assimilation Runner Launch Control Board/);

    const convergenceAssimilationRunnerLaunchControlBoardSnapshotsResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-control-board-snapshots`);
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardSnapshotsResponse.status, 200);
    const convergenceAssimilationRunnerLaunchControlBoardSnapshotsJson = await convergenceAssimilationRunnerLaunchControlBoardSnapshotsResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardSnapshotsJson.length, 1);
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardSnapshotsJson[0].title, "Fixture Codex Launch Control Board");

    const convergenceAssimilationRunnerLaunchControlBoardSnapshotDiffResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-control-board-snapshots/diff?snapshotId=latest&runner=codex`);
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardSnapshotDiffResponse.status, 200);
    const convergenceAssimilationRunnerLaunchControlBoardSnapshotDiffJson = await convergenceAssimilationRunnerLaunchControlBoardSnapshotDiffResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardSnapshotDiffJson.hasSnapshot, true);
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardSnapshotDiffJson.runner, "codex");
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardSnapshotDiffJson.driftSeverity, "none");
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardSnapshotDiffJson.driftItems.length, 0);
    assert.match(convergenceAssimilationRunnerLaunchControlBoardSnapshotDiffJson.markdown, /# Convergence Assimilation Runner Launch Control Board Snapshot Drift/);

    const unscopedConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-authorization-pack-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Unscoped Fixture Codex Launch Authorization Pack",
        runner: "codex"
      })
    });
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotResponse.status, 409);
    const unscopedConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotJson = await unscopedConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotResponse.json();
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-authorization-pack-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Codex Launch Authorization Pack",
        runner: "codex",
        ...convergenceScope
      })
    });
    assert.equal(createConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotResponse.status, 200);
    const createConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotJson = await createConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotResponse.json();
    assert.equal(createConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotJson.success, true);
    assert.equal(createConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotJson.snapshot.title, "Fixture Codex Launch Authorization Pack");
    assert.equal(createConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotJson.snapshot.runner, "codex");
    assert.equal(createConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotJson.snapshot.decision, "ready");
    assert.equal(createConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotJson.snapshot.authorizationStatus, "authorized-for-one-bounded-run");
    assert.equal(createConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotJson.snapshot.pack.decision, "ready");
    assert.match(createConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotJson.snapshot.markdown, /# Convergence Assimilation Runner Launch Authorization Pack/);

    const convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotsResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-authorization-pack-snapshots`);
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotsResponse.status, 200);
    const convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotsJson = await convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotsResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotsJson.length, 1);
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotsJson[0].title, "Fixture Codex Launch Authorization Pack");

    const convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiffResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-authorization-pack-snapshots/diff?snapshotId=latest&runner=codex`);
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiffResponse.status, 200);
    const convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiffJson = await convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiffResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiffJson.hasSnapshot, true);
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiffJson.runner, "codex");
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiffJson.driftSeverity, "none");
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiffJson.driftItems.length, 0);
    assert.match(convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiffJson.markdown, /# Convergence Assimilation Runner Launch Authorization Pack Snapshot Drift/);

    const convergenceAssimilationSessionPacketSnapshotDiffResponse = await fetch(`${baseUrl}/api/convergence/assimilation-session-packet-snapshots/diff?snapshotId=latest&runner=codex`);
    assert.equal(convergenceAssimilationSessionPacketSnapshotDiffResponse.status, 200);
    const convergenceAssimilationSessionPacketSnapshotDiffJson = await convergenceAssimilationSessionPacketSnapshotDiffResponse.json();
    assert.equal(convergenceAssimilationSessionPacketSnapshotDiffJson.hasSnapshot, true);
    assert.equal(convergenceAssimilationSessionPacketSnapshotDiffJson.runner, "codex");
    assert.equal(convergenceAssimilationSessionPacketSnapshotDiffJson.driftSeverity, "none");
    assert.equal(convergenceAssimilationSessionPacketSnapshotDiffJson.driftItems.length, 0);
    assert.match(convergenceAssimilationSessionPacketSnapshotDiffJson.markdown, /# Convergence Assimilation Session Packet Snapshot Drift/);

    const secondConvergenceAssimilationRunResultResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runs/${encodeURIComponent(queueConvergenceAssimilationRunJson.run.id)}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "needs-review",
        summary: "Second fixture result to force deterministic packet drift.",
        validationSummary: "Drift fixture validation.",
        ...convergenceScope
      })
    });
    assert.equal(secondConvergenceAssimilationRunResultResponse.status, 200);

    const convergenceAssimilationSessionPacketSnapshotDriftResponse = await fetch(`${baseUrl}/api/convergence/assimilation-session-packet-snapshots/diff?snapshotId=latest&runner=codex`);
    assert.equal(convergenceAssimilationSessionPacketSnapshotDriftResponse.status, 200);
    const convergenceAssimilationSessionPacketSnapshotDriftJson = await convergenceAssimilationSessionPacketSnapshotDriftResponse.json();
    assert.equal(convergenceAssimilationSessionPacketSnapshotDriftJson.hasDrift, true);
    assert.ok(convergenceAssimilationSessionPacketSnapshotDriftJson.driftItems.some((item) => item.field === "resultCount"));

    const convergenceAssimilationRunnerLaunchpadGateSnapshotDriftResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launchpad-gate-snapshots/diff?snapshotId=latest&runner=codex`);
    assert.equal(convergenceAssimilationRunnerLaunchpadGateSnapshotDriftResponse.status, 200);
    const convergenceAssimilationRunnerLaunchpadGateSnapshotDriftJson = await convergenceAssimilationRunnerLaunchpadGateSnapshotDriftResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchpadGateSnapshotDriftJson.hasDrift, true);
    assert.equal(convergenceAssimilationRunnerLaunchpadGateSnapshotDriftJson.driftSeverity, "high");
    assert.ok(convergenceAssimilationRunnerLaunchpadGateSnapshotDriftJson.driftItems.some((item) => item.field === "decision"));

    const convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDriftResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-authorization-pack-snapshots/diff?snapshotId=latest&runner=codex`);
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDriftResponse.status, 200);
    const convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDriftJson = await convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDriftResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDriftJson.hasDrift, true);
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDriftJson.driftSeverity, "high");
    assert.ok(convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDriftJson.driftItems.some((item) => item.field === "decision" || item.field === "authorizationStatus"));

    const convergenceAssimilationRunnerLaunchControlBoardSnapshotDriftResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-control-board-snapshots/diff?snapshotId=latest&runner=codex`);
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardSnapshotDriftResponse.status, 200);
    const convergenceAssimilationRunnerLaunchControlBoardSnapshotDriftJson = await convergenceAssimilationRunnerLaunchControlBoardSnapshotDriftResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardSnapshotDriftJson.hasDrift, true);
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardSnapshotDriftJson.driftSeverity, "high");
    assert.ok(convergenceAssimilationRunnerLaunchControlBoardSnapshotDriftJson.driftItems.some((item) => item.field === "launchDecision" || item.field === "launchStatus" || item.field === "authorizationStatus"));
    const launchControlBoardCheckpointField = convergenceAssimilationRunnerLaunchControlBoardSnapshotDriftJson.driftItems.find((item) => item.field === "launchDecision" || item.field === "launchStatus" || item.field === "authorizationStatus")?.field || "launchDecision";

    const convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDriftResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-execution-packet-snapshots/diff?snapshotId=latest&runner=claude`);
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDriftResponse.status, 200);
    const convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDriftJson = await convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDriftResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDriftJson.hasDrift, true);
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDriftJson.driftSeverity, "high");
    assert.ok(convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDriftJson.driftItems.some((item) => item.field === "launchDecision" || item.field === "launchStatus"));
    const launchExecutionPacketCheckpointField = convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDriftJson.driftItems.find((item) => item.field === "launchDecision" || item.field === "launchStatus")?.field || "launchDecision";

    const unscopedConvergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-execution-packet-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "claude",
        field: launchExecutionPacketCheckpointField,
        decision: "confirmed",
        note: "Unscoped fixture launch execution packet drift accepted."
      })
    });
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointResponse.status, 409);
    const unscopedConvergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointJson = await unscopedConvergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointResponse.json();
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointJson.reasonCode, "agent-execution-scope-required");

    const convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-execution-packet-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "claude",
        field: launchExecutionPacketCheckpointField,
        decision: "confirmed",
        note: "Fixture launch execution packet drift accepted.",
        ...convergenceScope
      })
    });
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointResponse.status, 200);
    const convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointJson = await convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointJson.success, true);
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointJson.decision, "confirmed");
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointJson.task.convergenceAssimilationRunnerLaunchExecutionPacketDriftField, launchExecutionPacketCheckpointField);
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointJson.task.status, "resolved");

    const convergenceAssimilationRunnerLaunchExecutionPacketCheckpointedDriftResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-execution-packet-snapshots/diff?snapshotId=latest&runner=claude`);
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketCheckpointedDriftResponse.status, 200);
    const convergenceAssimilationRunnerLaunchExecutionPacketCheckpointedDriftJson = await convergenceAssimilationRunnerLaunchExecutionPacketCheckpointedDriftResponse.json();
    const checkpointedLaunchExecutionPacketDrift = convergenceAssimilationRunnerLaunchExecutionPacketCheckpointedDriftJson.driftItems.find((item) => item.field === launchExecutionPacketCheckpointField);
    assert.equal(checkpointedLaunchExecutionPacketDrift.checkpointDecision, "confirmed");
    assert.equal(checkpointedLaunchExecutionPacketDrift.checkpointStatus, "resolved");

    const convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointLedgerResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-execution-packet-drift-checkpoint-ledger?status=closed`);
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointLedgerResponse.status, 200);
    const convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointLedgerJson = await convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointLedgerResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointLedgerJson.summary.total, 1);
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointLedgerJson.summary.visible, 1);
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointLedgerJson.summary.confirmed, 1);
    assert.equal(convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointLedgerJson.items[0].convergenceAssimilationRunnerLaunchExecutionPacketDriftField, launchExecutionPacketCheckpointField);
    assert.match(convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointLedgerJson.markdown, /# Convergence Assimilation Runner Launch Execution Packet Drift Checkpoint Ledger/);

    const unscopedRefreshConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-execution-packet-snapshots/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "claude",
        title: "Unscoped Fixture Refreshed Claude Launch Execution Packet"
      })
    });
    assert.equal(unscopedRefreshConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotResponse.status, 409);
    const unscopedRefreshConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotJson = await unscopedRefreshConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotResponse.json();
    assert.equal(unscopedRefreshConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotJson.reasonCode, "agent-execution-scope-required");

    const refreshConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-execution-packet-snapshots/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "claude",
        title: "Fixture Refreshed Claude Launch Execution Packet",
        ...convergenceScope
      })
    });
    assert.equal(refreshConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotResponse.status, 200);
    const refreshConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotJson = await refreshConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotResponse.json();
    assert.equal(refreshConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotJson.success, true);
    assert.equal(refreshConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotJson.previousSnapshotId, createConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotJson.snapshot.id);
    assert.equal(refreshConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotJson.snapshot.title, "Fixture Refreshed Claude Launch Execution Packet");
    assert.equal(refreshConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotJson.snapshot.runner, "claude");
    assert.equal(refreshConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotJson.convergenceAssimilationRunnerLaunchExecutionPacketSnapshots.length, 2);

    const refreshedConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiffResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-execution-packet-snapshots/diff?snapshotId=latest&runner=claude`);
    assert.equal(refreshedConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiffResponse.status, 200);
    const refreshedConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiffJson = await refreshedConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiffResponse.json();
    assert.equal(refreshedConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiffJson.hasSnapshot, true);
    assert.equal(refreshedConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiffJson.hasDrift, false);
    assert.equal(refreshedConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiffJson.driftItems.length, 0);

    const unscopedConvergenceAssimilationRunnerLaunchControlBoardDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-control-board-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "codex",
        field: launchControlBoardCheckpointField,
        decision: "confirmed",
        note: "Unscoped fixture launch control board drift accepted."
      })
    });
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchControlBoardDriftCheckpointResponse.status, 409);
    const unscopedConvergenceAssimilationRunnerLaunchControlBoardDriftCheckpointJson = await unscopedConvergenceAssimilationRunnerLaunchControlBoardDriftCheckpointResponse.json();
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchControlBoardDriftCheckpointJson.reasonCode, "agent-execution-scope-required");

    const convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-control-board-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "codex",
        field: launchControlBoardCheckpointField,
        decision: "confirmed",
        note: "Fixture launch control board drift accepted.",
        ...convergenceScope
      })
    });
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointResponse.status, 200);
    const convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointJson = await convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointJson.success, true);
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointJson.decision, "confirmed");
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointJson.task.convergenceAssimilationRunnerLaunchControlBoardDriftField, launchControlBoardCheckpointField);
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointJson.task.status, "resolved");

    const convergenceAssimilationRunnerLaunchControlBoardCheckpointedDriftResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-control-board-snapshots/diff?snapshotId=latest&runner=codex`);
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardCheckpointedDriftResponse.status, 200);
    const convergenceAssimilationRunnerLaunchControlBoardCheckpointedDriftJson = await convergenceAssimilationRunnerLaunchControlBoardCheckpointedDriftResponse.json();
    const checkpointedLaunchControlBoardDrift = convergenceAssimilationRunnerLaunchControlBoardCheckpointedDriftJson.driftItems.find((item) => item.field === launchControlBoardCheckpointField);
    assert.equal(checkpointedLaunchControlBoardDrift.checkpointDecision, "confirmed");
    assert.equal(checkpointedLaunchControlBoardDrift.checkpointStatus, "resolved");

    const convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointLedgerResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-control-board-drift-checkpoint-ledger?status=closed`);
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointLedgerResponse.status, 200);
    const convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointLedgerJson = await convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointLedgerResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointLedgerJson.summary.total, 1);
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointLedgerJson.summary.visible, 1);
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointLedgerJson.summary.confirmed, 1);
    assert.equal(convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointLedgerJson.items[0].convergenceAssimilationRunnerLaunchControlBoardDriftField, launchControlBoardCheckpointField);
    assert.match(convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointLedgerJson.markdown, /# Convergence Assimilation Runner Launch Control Board Drift Checkpoint Ledger/);
    const launchAuthorizationPackCheckpointField = convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDriftJson.driftItems.find((item) => item.field === "decision" || item.field === "authorizationStatus")?.field || "decision";

    const unscopedConvergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-authorization-pack-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "codex",
        field: launchAuthorizationPackCheckpointField,
        decision: "confirmed",
        note: "Unscoped fixture launch authorization pack drift accepted."
      })
    });
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointResponse.status, 409);
    const unscopedConvergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointJson = await unscopedConvergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointResponse.json();
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointJson.reasonCode, "agent-execution-scope-required");

    const convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-authorization-pack-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "codex",
        field: launchAuthorizationPackCheckpointField,
        decision: "confirmed",
        note: "Fixture launch authorization pack drift accepted.",
        ...convergenceScope
      })
    });
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointResponse.status, 200);
    const convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointJson = await convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointJson.success, true);
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointJson.decision, "confirmed");
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointJson.task.convergenceAssimilationRunnerLaunchAuthorizationPackDriftField, launchAuthorizationPackCheckpointField);
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointJson.task.status, "resolved");

    const convergenceAssimilationRunnerLaunchAuthorizationPackCheckpointedDriftResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-authorization-pack-snapshots/diff?snapshotId=latest&runner=codex`);
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackCheckpointedDriftResponse.status, 200);
    const convergenceAssimilationRunnerLaunchAuthorizationPackCheckpointedDriftJson = await convergenceAssimilationRunnerLaunchAuthorizationPackCheckpointedDriftResponse.json();
    const checkpointedLaunchAuthorizationPackDrift = convergenceAssimilationRunnerLaunchAuthorizationPackCheckpointedDriftJson.driftItems.find((item) => item.field === launchAuthorizationPackCheckpointField);
    assert.equal(checkpointedLaunchAuthorizationPackDrift.checkpointDecision, "confirmed");
    assert.equal(checkpointedLaunchAuthorizationPackDrift.checkpointStatus, "resolved");

    const convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedgerResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-authorization-pack-drift-checkpoint-ledger?status=closed`);
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedgerResponse.status, 200);
    const convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedgerJson = await convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedgerResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedgerJson.summary.total, 1);
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedgerJson.summary.visible, 1);
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedgerJson.summary.confirmed, 1);
    assert.equal(convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedgerJson.items[0].convergenceAssimilationRunnerLaunchAuthorizationPackDriftField, launchAuthorizationPackCheckpointField);
    assert.match(convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedgerJson.markdown, /# Convergence Assimilation Runner Launch Authorization Pack Drift Checkpoint Ledger/);

    const unscopedConvergenceAssimilationRunnerLaunchpadGateDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launchpad-gate-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "codex",
        field: "decision",
        decision: "confirmed",
        note: "Unscoped fixture launchpad gate drift accepted."
      })
    });
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchpadGateDriftCheckpointResponse.status, 409);
    const unscopedConvergenceAssimilationRunnerLaunchpadGateDriftCheckpointJson = await unscopedConvergenceAssimilationRunnerLaunchpadGateDriftCheckpointResponse.json();
    assert.equal(unscopedConvergenceAssimilationRunnerLaunchpadGateDriftCheckpointJson.reasonCode, "agent-execution-scope-required");

    const convergenceAssimilationRunnerLaunchpadGateDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launchpad-gate-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "codex",
        field: "decision",
        decision: "confirmed",
        note: "Fixture launchpad gate drift accepted.",
        ...convergenceScope
      })
    });
    assert.equal(convergenceAssimilationRunnerLaunchpadGateDriftCheckpointResponse.status, 200);
    const convergenceAssimilationRunnerLaunchpadGateDriftCheckpointJson = await convergenceAssimilationRunnerLaunchpadGateDriftCheckpointResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchpadGateDriftCheckpointJson.success, true);
    assert.equal(convergenceAssimilationRunnerLaunchpadGateDriftCheckpointJson.decision, "confirmed");
    assert.equal(convergenceAssimilationRunnerLaunchpadGateDriftCheckpointJson.task.convergenceAssimilationRunnerLaunchpadGateDriftField, "decision");
    assert.equal(convergenceAssimilationRunnerLaunchpadGateDriftCheckpointJson.task.status, "resolved");

    const convergenceAssimilationRunnerLaunchpadGateCheckpointedDriftResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launchpad-gate-snapshots/diff?snapshotId=latest&runner=codex`);
    assert.equal(convergenceAssimilationRunnerLaunchpadGateCheckpointedDriftResponse.status, 200);
    const convergenceAssimilationRunnerLaunchpadGateCheckpointedDriftJson = await convergenceAssimilationRunnerLaunchpadGateCheckpointedDriftResponse.json();
    const checkpointedLaunchDecisionDrift = convergenceAssimilationRunnerLaunchpadGateCheckpointedDriftJson.driftItems.find((item) => item.field === "decision");
    assert.equal(checkpointedLaunchDecisionDrift.checkpointDecision, "confirmed");
    assert.equal(checkpointedLaunchDecisionDrift.checkpointStatus, "resolved");

    const convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedgerResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launchpad-gate-drift-checkpoint-ledger?status=closed`);
    assert.equal(convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedgerResponse.status, 200);
    const convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedgerJson = await convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedgerResponse.json();
    assert.equal(convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedgerJson.summary.total, 1);
    assert.equal(convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedgerJson.summary.visible, 1);
    assert.equal(convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedgerJson.summary.confirmed, 1);
    assert.equal(convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedgerJson.items[0].convergenceAssimilationRunnerLaunchpadGateDriftField, "decision");
    assert.match(convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedgerJson.markdown, /# Convergence Assimilation Runner Launchpad Gate Drift Checkpoint Ledger/);

    const unscopedConvergenceAssimilationSessionPacketDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-session-packet-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "codex",
        field: "resultCount",
        decision: "confirmed",
        note: "Unscoped fixture packet drift accepted."
      })
    });
    assert.equal(unscopedConvergenceAssimilationSessionPacketDriftCheckpointResponse.status, 409);
    const unscopedConvergenceAssimilationSessionPacketDriftCheckpointJson = await unscopedConvergenceAssimilationSessionPacketDriftCheckpointResponse.json();
    assert.equal(unscopedConvergenceAssimilationSessionPacketDriftCheckpointJson.reasonCode, "agent-execution-scope-required");

    const convergenceAssimilationSessionPacketDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-session-packet-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "codex",
        field: "resultCount",
        decision: "confirmed",
        note: "Fixture packet drift accepted.",
        ...convergenceScope
      })
    });
    assert.equal(convergenceAssimilationSessionPacketDriftCheckpointResponse.status, 200);
    const convergenceAssimilationSessionPacketDriftCheckpointJson = await convergenceAssimilationSessionPacketDriftCheckpointResponse.json();
    assert.equal(convergenceAssimilationSessionPacketDriftCheckpointJson.success, true);
    assert.equal(convergenceAssimilationSessionPacketDriftCheckpointJson.decision, "confirmed");
    assert.equal(convergenceAssimilationSessionPacketDriftCheckpointJson.task.convergenceAssimilationSessionPacketDriftField, "resultCount");
    assert.equal(convergenceAssimilationSessionPacketDriftCheckpointJson.task.status, "resolved");

    const convergenceAssimilationSessionPacketSnapshotCheckpointedDriftResponse = await fetch(`${baseUrl}/api/convergence/assimilation-session-packet-snapshots/diff?snapshotId=latest&runner=codex`);
    assert.equal(convergenceAssimilationSessionPacketSnapshotCheckpointedDriftResponse.status, 200);
    const convergenceAssimilationSessionPacketSnapshotCheckpointedDriftJson = await convergenceAssimilationSessionPacketSnapshotCheckpointedDriftResponse.json();
    const checkpointedResultCountDrift = convergenceAssimilationSessionPacketSnapshotCheckpointedDriftJson.driftItems.find((item) => item.field === "resultCount");
    assert.equal(checkpointedResultCountDrift.checkpointDecision, "confirmed");
    assert.equal(checkpointedResultCountDrift.checkpointStatus, "resolved");

    const convergenceAssimilationSessionPacketDriftCheckpointLedgerResponse = await fetch(`${baseUrl}/api/convergence/assimilation-session-packet-drift-checkpoint-ledger?status=closed`);
    assert.equal(convergenceAssimilationSessionPacketDriftCheckpointLedgerResponse.status, 200);
    const convergenceAssimilationSessionPacketDriftCheckpointLedgerJson = await convergenceAssimilationSessionPacketDriftCheckpointLedgerResponse.json();
    assert.equal(convergenceAssimilationSessionPacketDriftCheckpointLedgerJson.summary.total, 1);
    assert.equal(convergenceAssimilationSessionPacketDriftCheckpointLedgerJson.summary.visible, 1);
    assert.equal(convergenceAssimilationSessionPacketDriftCheckpointLedgerJson.summary.confirmed, 1);
    assert.equal(convergenceAssimilationSessionPacketDriftCheckpointLedgerJson.items[0].convergenceAssimilationSessionPacketDriftField, "resultCount");
    assert.match(convergenceAssimilationSessionPacketDriftCheckpointLedgerJson.markdown, /# Convergence Assimilation Session Packet Drift Checkpoint Ledger/);

    const repeatConvergenceTaskResponse = await fetch(`${baseUrl}/api/convergence/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairIds: [operatorProposalJson.review.pairId],
        ...convergenceScope
      })
    });
    assert.equal(repeatConvergenceTaskResponse.status, 200);
    const repeatConvergenceTaskJson = await repeatConvergenceTaskResponse.json();
    assert.equal(repeatConvergenceTaskJson.totals.created, 0);
    assert.equal(repeatConvergenceTaskJson.totals.skipped, 1);
    assert.match(repeatConvergenceTaskJson.skipped[0].reason, /already exists/);

    const convergenceTaskLedgerResponse = await fetch(`${baseUrl}/api/convergence/task-ledger`);
    assert.equal(convergenceTaskLedgerResponse.status, 200);
    const convergenceTaskLedgerJson = await convergenceTaskLedgerResponse.json();
    assert.equal(convergenceTaskLedgerJson.summary.total, 1);
    assert.equal(convergenceTaskLedgerJson.summary.open, 1);
    assert.equal(convergenceTaskLedgerJson.summary.pairCount, 1);
    assert.equal(convergenceTaskLedgerJson.items[0].convergencePairId, operatorProposalJson.review.pairId);
    assert.match(convergenceTaskLedgerJson.markdown, /# Convergence Review Task Ledger/);
    assert.match(convergenceTaskLedgerJson.secretPolicy, /Non-secret convergence review task metadata only/);

    const missingConvergenceTaskLedgerDiffResponse = await fetch(`${baseUrl}/api/convergence/task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(missingConvergenceTaskLedgerDiffResponse.status, 200);
    const missingConvergenceTaskLedgerDiffJson = await missingConvergenceTaskLedgerDiffResponse.json();
    assert.equal(missingConvergenceTaskLedgerDiffJson.hasSnapshot, false);
    assert.equal(missingConvergenceTaskLedgerDiffJson.driftSeverity, "missing-snapshot");

    const unscopedCreateConvergenceTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/convergence/task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Unscoped Fixture Convergence Review Task Ledger",
        status: "all",
        limit: 10
      })
    });
    assert.equal(unscopedCreateConvergenceTaskLedgerSnapshotResponse.status, 409);
    const unscopedCreateConvergenceTaskLedgerSnapshotJson = await unscopedCreateConvergenceTaskLedgerSnapshotResponse.json();
    assert.equal(unscopedCreateConvergenceTaskLedgerSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createConvergenceTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/convergence/task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Convergence Review Task Ledger",
        status: "all",
        limit: 10,
        ...taskMutationScope
      })
    });
    assert.equal(createConvergenceTaskLedgerSnapshotResponse.status, 200);
    const createConvergenceTaskLedgerSnapshotJson = await createConvergenceTaskLedgerSnapshotResponse.json();
    assert.equal(createConvergenceTaskLedgerSnapshotJson.success, true);
    assert.equal(createConvergenceTaskLedgerSnapshotJson.snapshot.total, 1);
    assert.equal(createConvergenceTaskLedgerSnapshotJson.snapshot.pairCount, 1);
    assert.equal(createConvergenceTaskLedgerSnapshotJson.snapshot.title, "Fixture Convergence Review Task Ledger");

    const convergenceTaskLedgerSnapshotsResponse = await fetch(`${baseUrl}/api/convergence/task-ledger-snapshots`);
    assert.equal(convergenceTaskLedgerSnapshotsResponse.status, 200);
    const convergenceTaskLedgerSnapshotsJson = await convergenceTaskLedgerSnapshotsResponse.json();
    assert.equal(convergenceTaskLedgerSnapshotsJson.length, 1);
    assert.equal(convergenceTaskLedgerSnapshotsJson[0].title, "Fixture Convergence Review Task Ledger");

    const convergenceTaskLedgerDiffResponse = await fetch(`${baseUrl}/api/convergence/task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(convergenceTaskLedgerDiffResponse.status, 200);
    const convergenceTaskLedgerDiffJson = await convergenceTaskLedgerDiffResponse.json();
    assert.equal(convergenceTaskLedgerDiffJson.hasSnapshot, true);
    assert.equal(convergenceTaskLedgerDiffJson.hasDrift, false);
    assert.match(convergenceTaskLedgerDiffJson.markdown, /# Convergence Review Task Ledger Snapshot Drift/);

    const governanceAfterConvergenceTasksResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterConvergenceTasksResponse.status, 200);
    const governanceAfterConvergenceTasksJson = await governanceAfterConvergenceTasksResponse.json();
    assert.equal(governanceAfterConvergenceTasksJson.summary.convergenceTaskCount, 1);
    assert.equal(governanceAfterConvergenceTasksJson.summary.convergenceOpenTaskCount, 1);
    assert.equal(governanceAfterConvergenceTasksJson.summary.convergenceTaskLedgerSnapshotCount, 1);
    assert.equal(governanceAfterConvergenceTasksJson.summary.convergenceAssimilationSessionPacketSnapshotCount, 1);
    assert.equal(governanceAfterConvergenceTasksJson.summary.convergenceAssimilationRunnerLaunchpadGateSnapshotCount, 1);
    assert.equal(governanceAfterConvergenceTasksJson.summary.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotCount, 1);
    assert.equal(governanceAfterConvergenceTasksJson.summary.convergenceAssimilationRunnerLaunchControlBoardSnapshotCount, 1);
    assert.equal(governanceAfterConvergenceTasksJson.summary.convergenceAssimilationRunnerLaunchExecutionPacketSnapshotCount, 2);
    assert.equal(governanceAfterConvergenceTasksJson.summary.convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotCount, 2);
    assert.equal(governanceAfterConvergenceTasksJson.summary.convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotCount, 2);
    assert.equal(governanceAfterConvergenceTasksJson.convergenceTasks[0].convergencePairId, operatorProposalJson.review.pairId);
    assert.equal(governanceAfterConvergenceTasksJson.convergenceTaskLedgerSnapshots[0].title, "Fixture Convergence Review Task Ledger");
    assert.equal(governanceAfterConvergenceTasksJson.convergenceAssimilationSessionPacketSnapshots[0].title, "Fixture Codex Session Packet");
    assert.equal(governanceAfterConvergenceTasksJson.convergenceAssimilationRunnerLaunchpadGateSnapshots[0].title, "Fixture Codex Launchpad Gate");
    assert.equal(governanceAfterConvergenceTasksJson.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshots[0].title, "Fixture Codex Launch Authorization Pack");
    assert.equal(governanceAfterConvergenceTasksJson.convergenceAssimilationRunnerLaunchControlBoardSnapshots[0].title, "Fixture Codex Launch Control Board");
    assert.equal(governanceAfterConvergenceTasksJson.convergenceAssimilationRunnerLaunchExecutionPacketSnapshots[0].title, "Fixture Refreshed Claude Launch Execution Packet");
    assert.equal(governanceAfterConvergenceTasksJson.convergenceAssimilationRunnerLaunchStackRemediationPackSnapshots[0].title, "Fixture Refreshed Claude Launch Stack Remediation Pack");
    assert.equal(governanceAfterConvergenceTasksJson.convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshots[0].title, "Fixture Refreshed Launch Stack Action Tasks");
    assert.ok(governanceAfterConvergenceTasksJson.operationLog.some((operation) => operation.type === "convergence-review-tasks-created"));
    assert.ok(governanceAfterConvergenceTasksJson.operationLog.some((operation) => operation.type === "convergence-task-ledger-snapshot-created"));
    assert.ok(governanceAfterConvergenceTasksJson.operationLog.some((operation) => operation.type === "convergence-assimilation-session-packet-snapshot-created"));
    assert.ok(governanceAfterConvergenceTasksJson.operationLog.some((operation) => operation.type === "convergence-assimilation-runner-launchpad-gate-snapshot-created"));
    assert.ok(governanceAfterConvergenceTasksJson.operationLog.some((operation) => operation.type === "convergence-assimilation-runner-launchpad-gate-drift-checkpoint-upserted"));
    assert.ok(governanceAfterConvergenceTasksJson.operationLog.some((operation) => operation.type === "convergence-assimilation-runner-launch-authorization-pack-snapshot-created"));
    assert.ok(governanceAfterConvergenceTasksJson.operationLog.some((operation) => operation.type === "convergence-assimilation-runner-launch-authorization-pack-drift-checkpoint-upserted"));
    assert.ok(governanceAfterConvergenceTasksJson.operationLog.some((operation) => operation.type === "convergence-assimilation-runner-launch-control-board-snapshot-created"));
    assert.ok(governanceAfterConvergenceTasksJson.operationLog.some((operation) => operation.type === "convergence-assimilation-runner-launch-control-board-drift-checkpoint-upserted"));
    assert.ok(governanceAfterConvergenceTasksJson.operationLog.some((operation) => operation.type === "convergence-assimilation-runner-launch-execution-packet-snapshot-created"));
    assert.ok(governanceAfterConvergenceTasksJson.operationLog.some((operation) => operation.type === "convergence-assimilation-runner-launch-execution-packet-drift-checkpoint-upserted"));
    assert.ok(governanceAfterConvergenceTasksJson.operationLog.some((operation) => operation.type === "convergence-assimilation-runner-launch-execution-packet-snapshot-refreshed"));
    assert.ok(governanceAfterConvergenceTasksJson.operationLog.some((operation) => operation.type === "convergence-assimilation-runner-launch-stack-action-tasks-created"));
    assert.ok(governanceAfterConvergenceTasksJson.operationLog.some((operation) => operation.type === "convergence-assimilation-runner-launch-stack-action-task-ledger-snapshot-created"));
    assert.ok(governanceAfterConvergenceTasksJson.operationLog.some((operation) => operation.type === "convergence-assimilation-runner-launch-stack-action-task-ledger-drift-checkpoint-upserted"));
    assert.ok(governanceAfterConvergenceTasksJson.operationLog.some((operation) => operation.type === "convergence-assimilation-runner-launch-stack-action-task-ledger-snapshot-refreshed"));
    assert.ok(governanceAfterConvergenceTasksJson.operationLog.some((operation) => operation.type === "convergence-assimilation-runner-launch-stack-remediation-pack-snapshot-refreshed"));

    const updateConvergenceTaskForDriftResponse = await fetch(`${baseUrl}/api/tasks/${convergenceTaskJson.createdTasks[0].id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "blocked", priority: "high", ...taskMutationScope })
    });
    assert.equal(updateConvergenceTaskForDriftResponse.status, 200);

    const convergenceTaskLedgerDriftAfterUpdateResponse = await fetch(`${baseUrl}/api/convergence/task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(convergenceTaskLedgerDriftAfterUpdateResponse.status, 200);
    const convergenceTaskLedgerDriftAfterUpdateJson = await convergenceTaskLedgerDriftAfterUpdateResponse.json();
    assert.equal(convergenceTaskLedgerDriftAfterUpdateJson.hasDrift, true);
    const convergenceTaskDriftItem = convergenceTaskLedgerDriftAfterUpdateJson.driftItems.find((item) => String(item.field || "").startsWith("convergence-task:"));
    assert.ok(convergenceTaskDriftItem);

    const unscopedCreateConvergenceTaskLedgerDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/task-ledger-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        field: convergenceTaskDriftItem.field,
        decision: "deferred"
      })
    });
    assert.equal(unscopedCreateConvergenceTaskLedgerDriftCheckpointResponse.status, 409);
    const unscopedCreateConvergenceTaskLedgerDriftCheckpointJson = await unscopedCreateConvergenceTaskLedgerDriftCheckpointResponse.json();
    assert.equal(unscopedCreateConvergenceTaskLedgerDriftCheckpointJson.reasonCode, "agent-execution-scope-required");

    const createConvergenceTaskLedgerDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/task-ledger-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        field: convergenceTaskDriftItem.field,
        decision: "deferred",
        ...taskMutationScope
      })
    });
    assert.equal(createConvergenceTaskLedgerDriftCheckpointResponse.status, 200);
    const createConvergenceTaskLedgerDriftCheckpointJson = await createConvergenceTaskLedgerDriftCheckpointResponse.json();
    assert.equal(createConvergenceTaskLedgerDriftCheckpointJson.success, true);
    assert.equal(createConvergenceTaskLedgerDriftCheckpointJson.mode, "created");
    assert.equal(createConvergenceTaskLedgerDriftCheckpointJson.task.convergenceTaskLedgerDriftField, convergenceTaskDriftItem.field);
    assert.equal(createConvergenceTaskLedgerDriftCheckpointJson.task.convergenceTaskLedgerDriftCheckpointStatus, "deferred");
    assert.equal(createConvergenceTaskLedgerDriftCheckpointJson.task.status, "deferred");
    assert.equal(createConvergenceTaskLedgerDriftCheckpointJson.task.secretPolicy, "non-secret-convergence-review-task-ledger-drift-only");

    const updateConvergenceTaskLedgerDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/task-ledger-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        field: convergenceTaskDriftItem.field,
        decision: "escalated",
        ...taskMutationScope
      })
    });
    assert.equal(updateConvergenceTaskLedgerDriftCheckpointResponse.status, 200);
    const updateConvergenceTaskLedgerDriftCheckpointJson = await updateConvergenceTaskLedgerDriftCheckpointResponse.json();
    assert.equal(updateConvergenceTaskLedgerDriftCheckpointJson.success, true);
    assert.equal(updateConvergenceTaskLedgerDriftCheckpointJson.mode, "updated");
    assert.equal(updateConvergenceTaskLedgerDriftCheckpointJson.task.id, createConvergenceTaskLedgerDriftCheckpointJson.task.id);
    assert.equal(updateConvergenceTaskLedgerDriftCheckpointJson.task.convergenceTaskLedgerDriftCheckpointStatus, "escalated");
    assert.equal(updateConvergenceTaskLedgerDriftCheckpointJson.task.status, "blocked");
    assert.equal(updateConvergenceTaskLedgerDriftCheckpointJson.task.priority, "high");

    const convergenceTaskLedgerAfterDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/task-ledger`);
    assert.equal(convergenceTaskLedgerAfterDriftCheckpointResponse.status, 200);
    const convergenceTaskLedgerAfterDriftCheckpointJson = await convergenceTaskLedgerAfterDriftCheckpointResponse.json();
    assert.ok(convergenceTaskLedgerAfterDriftCheckpointJson.items.some((item) => item.convergenceTaskLedgerDriftField === convergenceTaskDriftItem.field));
    assert.match(convergenceTaskLedgerAfterDriftCheckpointJson.markdown, /Drift checkpoint/);

    const convergenceTaskLedgerDriftCheckpointLedgerResponse = await fetch(`${baseUrl}/api/convergence/task-ledger-drift-checkpoints`);
    assert.equal(convergenceTaskLedgerDriftCheckpointLedgerResponse.status, 200);
    const convergenceTaskLedgerDriftCheckpointLedgerJson = await convergenceTaskLedgerDriftCheckpointLedgerResponse.json();
    assert.equal(convergenceTaskLedgerDriftCheckpointLedgerJson.summary.total, 1);
    assert.equal(convergenceTaskLedgerDriftCheckpointLedgerJson.summary.escalated, 1);
    assert.equal(convergenceTaskLedgerDriftCheckpointLedgerJson.summary.fieldCount, 1);
    assert.equal(convergenceTaskLedgerDriftCheckpointLedgerJson.items[0].field, convergenceTaskDriftItem.field);
    assert.match(convergenceTaskLedgerDriftCheckpointLedgerJson.markdown, /# Convergence Review Task Ledger Drift Checkpoints/);
    assert.match(convergenceTaskLedgerDriftCheckpointLedgerJson.secretPolicy, /Non-secret convergence review task ledger drift metadata only/);

    const convergenceDueDiligencePackResponse = await fetch(`${baseUrl}/api/convergence/due-diligence-pack?pairId=${encodeURIComponent(operatorProposalJson.review.pairId)}`);
    assert.equal(convergenceDueDiligencePackResponse.status, 200);
    const convergenceDueDiligencePackJson = await convergenceDueDiligencePackResponse.json();
    assert.equal(convergenceDueDiligencePackJson.pairId, operatorProposalJson.review.pairId);
    assert.equal(convergenceDueDiligencePackJson.summary.relatedTaskCount, 1);
    assert.equal(convergenceDueDiligencePackJson.summary.relatedDriftCheckpointCount, 1);
    assert.match(convergenceDueDiligencePackJson.markdown, /# Convergence Candidate Due Diligence Pack/);
    assert.match(convergenceDueDiligencePackJson.markdown, /AI insight/);
    assert.match(convergenceDueDiligencePackJson.secretPolicy, /Non-secret convergence due diligence metadata only/);

    const convergenceAssimilationBlueprintResponse = await fetch(`${baseUrl}/api/convergence/assimilation-blueprint?pairId=${encodeURIComponent(operatorProposalJson.review.pairId)}`);
    assert.equal(convergenceAssimilationBlueprintResponse.status, 200);
    const convergenceAssimilationBlueprintJson = await convergenceAssimilationBlueprintResponse.json();
    assert.equal(convergenceAssimilationBlueprintJson.pairId, operatorProposalJson.review.pairId);
    assert.equal(convergenceAssimilationBlueprintJson.summary.relatedTaskCount, 1);
    assert.equal(convergenceAssimilationBlueprintJson.phases.length, 5);
    assert.match(convergenceAssimilationBlueprintJson.markdown, /# Convergence Assimilation Blueprint/);
    assert.match(convergenceAssimilationBlueprintJson.markdown, /No-Secrets Boundary/);
    assert.match(convergenceAssimilationBlueprintJson.secretPolicy, /Non-secret convergence assimilation planning metadata only/);

    const convergenceAssimilationWorkOrderDraftResponse = await fetch(`${baseUrl}/api/convergence/assimilation-work-order-draft?pairId=${encodeURIComponent(operatorProposalJson.review.pairId)}&runner=claude`);
    assert.equal(convergenceAssimilationWorkOrderDraftResponse.status, 200);
    const convergenceAssimilationWorkOrderDraftJson = await convergenceAssimilationWorkOrderDraftResponse.json();
    assert.equal(convergenceAssimilationWorkOrderDraftJson.pairId, operatorProposalJson.review.pairId);
    assert.equal(convergenceAssimilationWorkOrderDraftJson.runner, "claude");
    assert.equal(convergenceAssimilationWorkOrderDraftJson.executionMode, "non-executing");
    assert.match(convergenceAssimilationWorkOrderDraftJson.protocolVersion, /convergence-assimilation-work-order-draft/);
    assert.match(convergenceAssimilationWorkOrderDraftJson.markdown, /# Convergence Assimilation Work-Order Draft/);
    assert.match(convergenceAssimilationWorkOrderDraftJson.draft.prompt, /Claude CLI/);
    assert.match(convergenceAssimilationWorkOrderDraftJson.secretPolicy, /Non-secret convergence assimilation work-order draft only/);
  } finally {
    server.close();
    await once(server, "close");
  }
}

export async function releaseBuildGateTaskSeedingTest() {
  const { appDir, workspaceRoot } = await createFixtureWorkspace();
  const server = createWorkspaceAuditServer({
    rootDir: workspaceRoot,
    publicDir: appDir
  });

  server.listen(0);
  await once(server, "listening");

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const taskMutationScope = { scopeMode: "portfolio" };

  try {
    const releaseBuildGateResponse = await fetch(`${baseUrl}/api/releases/build-gate`);
    assert.equal(releaseBuildGateResponse.status, 200);
    const releaseBuildGateJson = await releaseBuildGateResponse.json();
    assert.equal(releaseBuildGateJson.decision, "review");
    const openActions = releaseBuildGateJson.actions.filter((action) => action.status !== "ready");
    assert.ok(openActions.length >= 1);
    const releaseControlScope = { scopeMode: "portfolio" };

    const unscopedReleaseBuildGateTaskResponse = await fetch(`${baseUrl}/api/releases/build-gate/actions/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actions: [openActions[0]] })
    });
    assert.equal(unscopedReleaseBuildGateTaskResponse.status, 409);
    const unscopedReleaseBuildGateTaskJson = await unscopedReleaseBuildGateTaskResponse.json();
    assert.equal(unscopedReleaseBuildGateTaskJson.reasonCode, "agent-execution-scope-required");

    const seedResponse = await fetch(`${baseUrl}/api/releases/build-gate/actions/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actions: [openActions[0]],
        ...releaseControlScope
      })
    });
    assert.equal(seedResponse.status, 200);
    const seedJson = await seedResponse.json();
    assert.equal(seedJson.success, true);
    assert.equal(seedJson.totals.requested, 1);
    assert.equal(seedJson.totals.created, 1);
    assert.equal(seedJson.totals.skipped, 0);
    assert.equal(seedJson.createdTasks[0].projectId, "release-control");
    assert.equal(seedJson.createdTasks[0].releaseBuildGateActionId, openActions[0].id);
    assert.equal(seedJson.createdTasks[0].releaseBuildGateDecision, "review");
    assert.match(seedJson.createdTasks[0].description, /Do not store credentials/);
    assert.equal(seedJson.createdTasks[0].secretPolicy, "non-secret-release-control-evidence-only");

    const releaseTaskLedgerResponse = await fetch(`${baseUrl}/api/releases/task-ledger`);
    assert.equal(releaseTaskLedgerResponse.status, 200);
    const releaseTaskLedgerJson = await releaseTaskLedgerResponse.json();
    assert.equal(releaseTaskLedgerJson.status, "all");
    assert.equal(releaseTaskLedgerJson.summary.total, 1);
    assert.equal(releaseTaskLedgerJson.summary.open, 1);
    assert.equal(releaseTaskLedgerJson.summary.closed, 0);
    assert.equal(releaseTaskLedgerJson.items[0].releaseBuildGateActionId, openActions[0].id);
    assert.equal(releaseTaskLedgerJson.items[0].releaseBuildGateDecision, "review");
    assert.match(releaseTaskLedgerJson.markdown, /# Release Control Task Ledger/);
    assert.match(releaseTaskLedgerJson.markdown, /Non-secret release-control task metadata/);

    const openReleaseTaskLedgerResponse = await fetch(`${baseUrl}/api/releases/task-ledger?status=open&limit=5`);
    assert.equal(openReleaseTaskLedgerResponse.status, 200);
    const openReleaseTaskLedgerJson = await openReleaseTaskLedgerResponse.json();
    assert.equal(openReleaseTaskLedgerJson.status, "open");
    assert.equal(openReleaseTaskLedgerJson.items.length, 1);

    const missingReleaseTaskLedgerSnapshotDiffResponse = await fetch(`${baseUrl}/api/releases/task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(missingReleaseTaskLedgerSnapshotDiffResponse.status, 200);
    const missingReleaseTaskLedgerSnapshotDiffJson = await missingReleaseTaskLedgerSnapshotDiffResponse.json();
    assert.equal(missingReleaseTaskLedgerSnapshotDiffJson.hasSnapshot, false);
    assert.equal(missingReleaseTaskLedgerSnapshotDiffJson.driftSeverity, "missing-snapshot");
    assert.match(missingReleaseTaskLedgerSnapshotDiffJson.markdown, /# Release Control Task Ledger Snapshot Drift/);

    const unscopedReleaseTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/releases/task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Release Control Task Ledger", status: "all", limit: 5 })
    });
    assert.equal(unscopedReleaseTaskLedgerSnapshotResponse.status, 409);
    const unscopedReleaseTaskLedgerSnapshotJson = await unscopedReleaseTaskLedgerSnapshotResponse.json();
    assert.equal(unscopedReleaseTaskLedgerSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createReleaseTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/releases/task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Release Control Task Ledger",
        status: "all",
        limit: 5,
        ...releaseControlScope
      })
    });
    assert.equal(createReleaseTaskLedgerSnapshotResponse.status, 200);
    const createReleaseTaskLedgerSnapshotJson = await createReleaseTaskLedgerSnapshotResponse.json();
    assert.equal(createReleaseTaskLedgerSnapshotJson.success, true);
    assert.equal(createReleaseTaskLedgerSnapshotJson.snapshot.title, "Fixture Release Control Task Ledger");
    assert.equal(createReleaseTaskLedgerSnapshotJson.snapshot.statusFilter, "all");
    assert.equal(createReleaseTaskLedgerSnapshotJson.snapshot.total, 1);
    assert.equal(createReleaseTaskLedgerSnapshotJson.snapshot.openCount, 1);
    assert.equal(createReleaseTaskLedgerSnapshotJson.snapshot.closedCount, 0);
    assert.equal(createReleaseTaskLedgerSnapshotJson.snapshot.items.length, 1);
    assert.match(createReleaseTaskLedgerSnapshotJson.snapshot.markdown, /# Release Control Task Ledger/);

    const releaseTaskLedgerSnapshotsResponse = await fetch(`${baseUrl}/api/releases/task-ledger-snapshots`);
    assert.equal(releaseTaskLedgerSnapshotsResponse.status, 200);
    const releaseTaskLedgerSnapshotsJson = await releaseTaskLedgerSnapshotsResponse.json();
    assert.equal(releaseTaskLedgerSnapshotsJson.length, 1);
    assert.equal(releaseTaskLedgerSnapshotsJson[0].title, "Fixture Release Control Task Ledger");

    const releaseTaskLedgerSnapshotDiffResponse = await fetch(`${baseUrl}/api/releases/task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(releaseTaskLedgerSnapshotDiffResponse.status, 200);
    const releaseTaskLedgerSnapshotDiffJson = await releaseTaskLedgerSnapshotDiffResponse.json();
    assert.equal(releaseTaskLedgerSnapshotDiffJson.hasSnapshot, true);
    assert.equal(releaseTaskLedgerSnapshotDiffJson.hasDrift, false);
    assert.equal(releaseTaskLedgerSnapshotDiffJson.driftSeverity, "none");
    assert.equal(releaseTaskLedgerSnapshotDiffJson.snapshotTitle, "Fixture Release Control Task Ledger");
    assert.match(releaseTaskLedgerSnapshotDiffJson.markdown, /# Release Control Task Ledger Snapshot Drift/);

    const repeatSeedResponse = await fetch(`${baseUrl}/api/releases/build-gate/actions/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actions: [openActions[0]],
        saveSnapshot: true,
        snapshotTitle: "Fixture Release Control Task Ledger Auto Capture",
        snapshotStatus: "all",
        snapshotLimit: 5,
        ...releaseControlScope
      })
    });
    assert.equal(repeatSeedResponse.status, 200);
    const repeatSeedJson = await repeatSeedResponse.json();
    assert.equal(repeatSeedJson.totals.created, 0);
    assert.equal(repeatSeedJson.totals.skipped, 1);
    assert.equal(repeatSeedJson.snapshotCaptured, true);
    assert.equal(repeatSeedJson.snapshot.title, "Fixture Release Control Task Ledger Auto Capture");
    assert.equal(repeatSeedJson.snapshot.statusFilter, "all");
    assert.equal(repeatSeedJson.snapshot.total, 1);
    assert.equal(repeatSeedJson.snapshot.openCount, 1);
    assert.equal(repeatSeedJson.releaseTaskLedgerSnapshots.length, 2);

    const governanceResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceResponse.status, 200);
    const governanceJson = await governanceResponse.json();
    assert.ok(governanceJson.recentActivity.some((item) => item.kind === "task" && item.projectId === "release-control"));
    assert.ok(governanceJson.operationLog.some((operation) => operation.type === "release-build-gate-action-tasks-created"));
    assert.equal(governanceJson.summary.releaseControlTaskCount, 1);
    assert.equal(governanceJson.summary.releaseControlOpenTaskCount, 1);
    assert.equal(governanceJson.summary.releaseControlClosedTaskCount, 0);
    assert.equal(governanceJson.summary.releaseTaskLedgerSnapshotCount, 2);
    assert.equal(governanceJson.releaseControlTasks[0].releaseBuildGateActionId, openActions[0].id);
    assert.equal(governanceJson.releaseTaskLedgerSnapshots[0].title, "Fixture Release Control Task Ledger Auto Capture");
    assert.equal(governanceJson.releaseTaskLedgerSnapshots[1].title, "Fixture Release Control Task Ledger");
    assert.ok(governanceJson.operationLog.some((operation) => operation.type === "release-task-ledger-snapshot-created"));
    assert.ok(governanceJson.operationLog.some((operation) => operation.type === "release-task-ledger-snapshot-auto-captured"));

    const decisionResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision`);
    assert.equal(decisionResponse.status, 200);
    const decisionJson = await decisionResponse.json();
    assert.equal(decisionJson.releaseControlTaskCount, 1);
    assert.equal(decisionJson.releaseControlOpenTaskCount, 1);
    assert.ok(decisionJson.reasons.some((reason) => reason.code === "release-control-open-tasks"));
    assert.match(decisionJson.markdown, /## Release Control Tasks/);

    const controlPlaneReason = {
      severity: "review",
      code: "execution-regression-alert-baseline-drift-review",
      message: "Confirm, defer, or escalate Regression Alert baseline snapshot drift before autonomous build work."
    };
    const agentControlPlaneDecisionScope = { scopeMode: "portfolio" };
    const unscopedAgentControlPlaneDecisionTasksResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reasons: [controlPlaneReason] })
    });
    assert.equal(unscopedAgentControlPlaneDecisionTasksResponse.status, 409);
    const unscopedAgentControlPlaneDecisionTasksJson = await unscopedAgentControlPlaneDecisionTasksResponse.json();
    assert.equal(unscopedAgentControlPlaneDecisionTasksJson.reasonCode, "agent-execution-scope-required");

    const seedDecisionTaskResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reasons: [controlPlaneReason],
        ...agentControlPlaneDecisionScope
      })
    });
    assert.equal(seedDecisionTaskResponse.status, 200);
    const seedDecisionTaskJson = await seedDecisionTaskResponse.json();
    assert.equal(seedDecisionTaskJson.success, true);
    assert.equal(seedDecisionTaskJson.totals.requested, 1);
    assert.equal(seedDecisionTaskJson.totals.created, 1);
    assert.equal(seedDecisionTaskJson.totals.skipped, 0);
    assert.equal(seedDecisionTaskJson.createdTasks[0].projectId, "agent-control-plane");
    assert.equal(seedDecisionTaskJson.createdTasks[0].agentControlPlaneDecisionReasonCode, controlPlaneReason.code);
    assert.match(seedDecisionTaskJson.createdTasks[0].agentControlPlaneCommandHint, /Regression Alert Baseline Status/);
    assert.match(seedDecisionTaskJson.createdTasks[0].description, /accepted alert-baseline snapshot/);
    assert.equal(seedDecisionTaskJson.createdTasks[0].secretPolicy, "non-secret-control-plane-remediation-evidence-only");

    const decisionTaskLedgerResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision/task-ledger`);
    assert.equal(decisionTaskLedgerResponse.status, 200);
    const decisionTaskLedgerJson = await decisionTaskLedgerResponse.json();
    assert.equal(decisionTaskLedgerJson.status, "all");
    assert.equal(decisionTaskLedgerJson.summary.total, 1);
    assert.equal(decisionTaskLedgerJson.summary.open, 1);
    assert.equal(decisionTaskLedgerJson.summary.closed, 0);
    assert.equal(decisionTaskLedgerJson.summary.reasonCount, 1);
    assert.equal(decisionTaskLedgerJson.items[0].agentControlPlaneDecisionReasonCode, controlPlaneReason.code);
    assert.equal(decisionTaskLedgerJson.items[0].agentControlPlaneDecision, seedDecisionTaskJson.createdTasks[0].agentControlPlaneDecision);
    assert.match(decisionTaskLedgerJson.markdown, /# Agent Control Plane Decision Task Ledger/);
    assert.match(decisionTaskLedgerJson.markdown, /Non-secret Agent Control Plane decision task metadata/);

    const openDecisionTaskLedgerResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision/task-ledger?status=open&limit=5`);
    assert.equal(openDecisionTaskLedgerResponse.status, 200);
    const openDecisionTaskLedgerJson = await openDecisionTaskLedgerResponse.json();
    assert.equal(openDecisionTaskLedgerJson.status, "open");
    assert.equal(openDecisionTaskLedgerJson.items.length, 1);

    const missingDecisionTaskLedgerSnapshotDiffResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision/task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(missingDecisionTaskLedgerSnapshotDiffResponse.status, 200);
    const missingDecisionTaskLedgerSnapshotDiffJson = await missingDecisionTaskLedgerSnapshotDiffResponse.json();
    assert.equal(missingDecisionTaskLedgerSnapshotDiffJson.hasSnapshot, false);
    assert.equal(missingDecisionTaskLedgerSnapshotDiffJson.driftSeverity, "missing-snapshot");
    assert.match(missingDecisionTaskLedgerSnapshotDiffJson.markdown, /# Agent Control Plane Decision Task Ledger Snapshot Drift/);

    const unscopedDecisionTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision/task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Control Plane Decision Task Ledger", status: "open", limit: 5 })
    });
    assert.equal(unscopedDecisionTaskLedgerSnapshotResponse.status, 409);
    const unscopedDecisionTaskLedgerSnapshotJson = await unscopedDecisionTaskLedgerSnapshotResponse.json();
    assert.equal(unscopedDecisionTaskLedgerSnapshotJson.reasonCode, "agent-execution-scope-required");

    const createDecisionTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision/task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Control Plane Decision Task Ledger",
        status: "open",
        limit: 5,
        ...agentControlPlaneDecisionScope
      })
    });
    assert.equal(createDecisionTaskLedgerSnapshotResponse.status, 200);
    const createDecisionTaskLedgerSnapshotJson = await createDecisionTaskLedgerSnapshotResponse.json();
    assert.equal(createDecisionTaskLedgerSnapshotJson.success, true);
    assert.equal(createDecisionTaskLedgerSnapshotJson.snapshot.title, "Fixture Control Plane Decision Task Ledger");
    assert.equal(createDecisionTaskLedgerSnapshotJson.snapshot.statusFilter, "open");
    assert.equal(createDecisionTaskLedgerSnapshotJson.snapshot.total, 1);
    assert.equal(createDecisionTaskLedgerSnapshotJson.snapshot.openCount, 1);
    assert.equal(createDecisionTaskLedgerSnapshotJson.snapshot.reasonCount, 1);
    assert.equal(createDecisionTaskLedgerSnapshotJson.snapshot.items.length, 1);
    assert.match(createDecisionTaskLedgerSnapshotJson.snapshot.markdown, /# Agent Control Plane Decision Task Ledger/);

    const decisionTaskLedgerSnapshotsResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision/task-ledger-snapshots`);
    assert.equal(decisionTaskLedgerSnapshotsResponse.status, 200);
    const decisionTaskLedgerSnapshotsJson = await decisionTaskLedgerSnapshotsResponse.json();
    assert.equal(decisionTaskLedgerSnapshotsJson.length, 1);
    assert.equal(decisionTaskLedgerSnapshotsJson[0].title, "Fixture Control Plane Decision Task Ledger");

    const decisionTaskLedgerSnapshotDiffResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision/task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(decisionTaskLedgerSnapshotDiffResponse.status, 200);
    const decisionTaskLedgerSnapshotDiffJson = await decisionTaskLedgerSnapshotDiffResponse.json();
    assert.equal(decisionTaskLedgerSnapshotDiffJson.hasSnapshot, true);
    assert.equal(decisionTaskLedgerSnapshotDiffJson.hasDrift, false);
    assert.equal(decisionTaskLedgerSnapshotDiffJson.snapshotTitle, "Fixture Control Plane Decision Task Ledger");
    assert.match(decisionTaskLedgerSnapshotDiffJson.markdown, /# Agent Control Plane Decision Task Ledger Snapshot Drift/);

    const repeatSeedDecisionTaskResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reasons: [controlPlaneReason],
        saveSnapshot: true,
        snapshotTitle: "Fixture Control Plane Decision Task Ledger Auto Capture",
        snapshotStatus: "open",
        snapshotLimit: 5,
        ...agentControlPlaneDecisionScope
      })
    });
    assert.equal(repeatSeedDecisionTaskResponse.status, 200);
    const repeatSeedDecisionTaskJson = await repeatSeedDecisionTaskResponse.json();
    assert.equal(repeatSeedDecisionTaskJson.totals.created, 0);
    assert.equal(repeatSeedDecisionTaskJson.totals.skipped, 1);
    assert.equal(repeatSeedDecisionTaskJson.snapshotCaptured, true);
    assert.equal(repeatSeedDecisionTaskJson.snapshot.title, "Fixture Control Plane Decision Task Ledger Auto Capture");
    assert.equal(repeatSeedDecisionTaskJson.snapshot.statusFilter, "open");
    assert.equal(repeatSeedDecisionTaskJson.snapshot.total, 1);
    assert.equal(repeatSeedDecisionTaskJson.snapshot.openCount, 1);
    assert.equal(repeatSeedDecisionTaskJson.agentControlPlaneDecisionTaskLedgerSnapshots.length, 2);

    const governanceAfterDecisionTaskResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterDecisionTaskResponse.status, 200);
    const governanceAfterDecisionTaskJson = await governanceAfterDecisionTaskResponse.json();
    assert.equal(governanceAfterDecisionTaskJson.summary.agentControlPlaneDecisionTaskCount, 1);
    assert.equal(governanceAfterDecisionTaskJson.summary.agentControlPlaneDecisionOpenTaskCount, 1);
    assert.equal(governanceAfterDecisionTaskJson.summary.agentControlPlaneDecisionTaskLedgerSnapshotCount, 2);
    assert.equal(governanceAfterDecisionTaskJson.agentControlPlaneDecisionTasks[0].agentControlPlaneDecisionReasonCode, controlPlaneReason.code);
    assert.equal(governanceAfterDecisionTaskJson.agentControlPlaneDecisionTaskLedgerSnapshots[0].title, "Fixture Control Plane Decision Task Ledger Auto Capture");
    assert.equal(governanceAfterDecisionTaskJson.agentControlPlaneDecisionTaskLedgerSnapshots[1].title, "Fixture Control Plane Decision Task Ledger");
    assert.ok(governanceAfterDecisionTaskJson.operationLog.some((operation) => operation.type === "agent-control-plane-decision-tasks-created"));
    assert.ok(governanceAfterDecisionTaskJson.operationLog.some((operation) => operation.type === "agent-control-plane-decision-task-ledger-snapshot-created"));
    assert.ok(governanceAfterDecisionTaskJson.operationLog.some((operation) => operation.type === "agent-control-plane-decision-task-ledger-snapshot-auto-captured"));

    const resolveDecisionTaskResponse = await fetch(`${baseUrl}/api/tasks/${seedDecisionTaskJson.createdTasks[0].id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved", ...taskMutationScope })
    });
    assert.equal(resolveDecisionTaskResponse.status, 200);
    const resolveDecisionTaskJson = await resolveDecisionTaskResponse.json();
    assert.equal(resolveDecisionTaskJson.task.status, "resolved");

    const decisionTaskLedgerClosedResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision/task-ledger?status=closed`);
    assert.equal(decisionTaskLedgerClosedResponse.status, 200);
    const decisionTaskLedgerClosedJson = await decisionTaskLedgerClosedResponse.json();
    assert.equal(decisionTaskLedgerClosedJson.summary.total, 1);
    assert.equal(decisionTaskLedgerClosedJson.summary.open, 0);
    assert.equal(decisionTaskLedgerClosedJson.summary.closed, 1);
    assert.equal(decisionTaskLedgerClosedJson.items[0].status, "resolved");

    const reopenDecisionTaskResponse = await fetch(`${baseUrl}/api/tasks/${seedDecisionTaskJson.createdTasks[0].id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "open", ...taskMutationScope })
    });
    assert.equal(reopenDecisionTaskResponse.status, 200);
    const reopenDecisionTaskJson = await reopenDecisionTaskResponse.json();
    assert.equal(reopenDecisionTaskJson.task.status, "open");

    const blockDecisionTaskResponse = await fetch(`${baseUrl}/api/tasks/${seedDecisionTaskJson.createdTasks[0].id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "blocked", ...taskMutationScope })
    });
    assert.equal(blockDecisionTaskResponse.status, 200);
    const blockDecisionTaskJson = await blockDecisionTaskResponse.json();
    assert.equal(blockDecisionTaskJson.task.status, "blocked");

    const decisionTaskLedgerBlockedResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision/task-ledger?status=open`);
    assert.equal(decisionTaskLedgerBlockedResponse.status, 200);
    const decisionTaskLedgerBlockedJson = await decisionTaskLedgerBlockedResponse.json();
    assert.equal(decisionTaskLedgerBlockedJson.summary.open, 1);
    assert.equal(decisionTaskLedgerBlockedJson.items[0].status, "blocked");

    const governanceAfterDecisionTaskLifecycleResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterDecisionTaskLifecycleResponse.status, 200);
    const governanceAfterDecisionTaskLifecycleJson = await governanceAfterDecisionTaskLifecycleResponse.json();
    assert.ok(governanceAfterDecisionTaskLifecycleJson.operationLog.some((operation) => (
      operation.type === "governance-task-updated"
      && operation.details.taskId === seedDecisionTaskJson.createdTasks[0].id
      && operation.details.nextStatus === "blocked"
    )));

    const unscopedTaskSeedingCheckpointResponse = await fetch(`${baseUrl}/api/governance/task-seeding-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchId: "fixture-generated-task-batch",
        title: "Fixture Generated Task Batch",
        source: "fixture",
        status: "deferred",
        itemCount: 2,
        note: "Fixture non-secret task seeding checkpoint."
      })
    });
    assert.equal(unscopedTaskSeedingCheckpointResponse.status, 409);
    const unscopedTaskSeedingCheckpointJson = await unscopedTaskSeedingCheckpointResponse.json();
    assert.equal(unscopedTaskSeedingCheckpointJson.reasonCode, "agent-execution-scope-required");

    const taskSeedingCheckpointResponse = await fetch(`${baseUrl}/api/governance/task-seeding-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchId: "fixture-generated-task-batch",
        title: "Fixture Generated Task Batch",
        source: "fixture",
        status: "deferred",
        itemCount: 2,
        note: "Fixture non-secret task seeding checkpoint.",
        ...releaseControlScope
      })
    });
    assert.equal(taskSeedingCheckpointResponse.status, 200);
    const taskSeedingCheckpointJson = await taskSeedingCheckpointResponse.json();
    assert.equal(taskSeedingCheckpointJson.success, true);
    assert.equal(taskSeedingCheckpointJson.checkpoint.status, "deferred");
    assert.equal(taskSeedingCheckpointJson.checkpoint.itemCount, 2);
    assert.match(taskSeedingCheckpointJson.checkpoint.secretPolicy, /Non-secret generated task batch checkpoint/);

    const sourceTaskSeedingCheckpointResponse = await fetch(`${baseUrl}/api/governance/task-seeding-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchId: "fixture-source-workflow-task-batch",
        title: "Fixture Source Workflow Task Batch",
        source: "sources-access-validation-workflow",
        status: "dismissed",
        itemCount: 1,
        note: "Fixture non-secret source workflow task seeding checkpoint.",
        ...releaseControlScope
      })
    });
    assert.equal(sourceTaskSeedingCheckpointResponse.status, 200);
    const sourceTaskSeedingCheckpointJson = await sourceTaskSeedingCheckpointResponse.json();
    assert.equal(sourceTaskSeedingCheckpointJson.success, true);
    assert.equal(sourceTaskSeedingCheckpointJson.checkpoint.status, "dismissed");
    assert.equal(sourceTaskSeedingCheckpointJson.checkpoint.source, "sources-access-validation-workflow");

    const sourceItemTaskSeedingCheckpointResponse = await fetch(`${baseUrl}/api/governance/task-seeding-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchId: "fixture-source-review-item",
        title: "Fixture Source Review Item Checkpoint",
        source: "sources-access-review-queue",
        status: "approved",
        itemCount: 1,
        note: "Fixture non-secret source review item checkpoint before task creation.",
        ...releaseControlScope
      })
    });
    assert.equal(sourceItemTaskSeedingCheckpointResponse.status, 200);
    const sourceItemTaskSeedingCheckpointJson = await sourceItemTaskSeedingCheckpointResponse.json();
    assert.equal(sourceItemTaskSeedingCheckpointJson.success, true);
    assert.equal(sourceItemTaskSeedingCheckpointJson.checkpoint.status, "approved");
    assert.equal(sourceItemTaskSeedingCheckpointJson.checkpoint.source, "sources-access-review-queue");

    const sourceCoverageTaskSeedingCheckpointResponse = await fetch(`${baseUrl}/api/governance/task-seeding-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchId: "fixture-source-coverage-item",
        title: "Fixture Source Evidence Coverage Checkpoint",
        source: "sources-access-validation-evidence-coverage",
        status: "needs-review",
        itemCount: 1,
        note: "Fixture unresolved source evidence coverage checkpoint before task creation.",
        ...releaseControlScope
      })
    });
    assert.equal(sourceCoverageTaskSeedingCheckpointResponse.status, 200);
    const sourceCoverageTaskSeedingCheckpointJson = await sourceCoverageTaskSeedingCheckpointResponse.json();
    assert.equal(sourceCoverageTaskSeedingCheckpointJson.success, true);
    assert.equal(sourceCoverageTaskSeedingCheckpointJson.checkpoint.status, "needs-review");
    assert.equal(sourceCoverageTaskSeedingCheckpointJson.checkpoint.source, "sources-access-validation-evidence-coverage");

    const sourceCardSourcesSummaryResponse = await fetch(`${baseUrl}/api/sources/summary`);
    assert.equal(sourceCardSourcesSummaryResponse.status, 200);
    const sourceCardSourcesSummaryJson = await sourceCardSourcesSummaryResponse.json();
    const fixtureSourceCheckpointBatchId = `source-access-review:${sourceCardSourcesSummaryJson.sources[0].id || "source-1"}`;
    const sourceCardTaskSeedingCheckpointResponse = await fetch(`${baseUrl}/api/governance/task-seeding-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchId: fixtureSourceCheckpointBatchId,
        title: "Fixture Source Card Checkpoint",
        source: "sources-access-review-queue",
        status: "deferred",
        itemCount: 1,
        note: "fixture-source-card-checkpoint unresolved source card checkpoint drilldown.",
        ...releaseControlScope
      })
    });
    assert.equal(sourceCardTaskSeedingCheckpointResponse.status, 200);
    const sourceCardTaskSeedingCheckpointJson = await sourceCardTaskSeedingCheckpointResponse.json();
    assert.equal(sourceCardTaskSeedingCheckpointJson.success, true);
    assert.equal(sourceCardTaskSeedingCheckpointJson.checkpoint.status, "deferred");
    assert.equal(sourceCardTaskSeedingCheckpointJson.checkpoint.batchId, fixtureSourceCheckpointBatchId);

    const taskSeedingCheckpointLedgerResponse = await fetch(`${baseUrl}/api/governance/task-seeding-checkpoints`);
    assert.equal(taskSeedingCheckpointLedgerResponse.status, 200);
    const taskSeedingCheckpointLedgerJson = await taskSeedingCheckpointLedgerResponse.json();
    assert.equal(taskSeedingCheckpointLedgerJson.taskSeedingCheckpoints.length, 5);
    assert.ok(taskSeedingCheckpointLedgerJson.taskSeedingCheckpoints.some((checkpoint) => checkpoint.batchId === "fixture-generated-task-batch"));
    assert.ok(taskSeedingCheckpointLedgerJson.taskSeedingCheckpoints.some((checkpoint) => checkpoint.batchId === "fixture-source-workflow-task-batch"));
    assert.ok(taskSeedingCheckpointLedgerJson.taskSeedingCheckpoints.some((checkpoint) => checkpoint.batchId === "fixture-source-review-item"));
    assert.ok(taskSeedingCheckpointLedgerJson.taskSeedingCheckpoints.some((checkpoint) => checkpoint.batchId === "fixture-source-coverage-item"));
    assert.ok(taskSeedingCheckpointLedgerJson.taskSeedingCheckpoints.some((checkpoint) => checkpoint.batchId === fixtureSourceCheckpointBatchId));

    const governanceAfterTaskSeedingCheckpointResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterTaskSeedingCheckpointResponse.status, 200);
    const governanceAfterTaskSeedingCheckpointJson = await governanceAfterTaskSeedingCheckpointResponse.json();
    assert.equal(governanceAfterTaskSeedingCheckpointJson.summary.taskSeedingCheckpointCount, 5);
    assert.equal(governanceAfterTaskSeedingCheckpointJson.summary.sourceAccessCheckpointCount, 4);
    assert.equal(governanceAfterTaskSeedingCheckpointJson.summary.sourceAccessCheckpointApprovedCount, 1);
    assert.equal(governanceAfterTaskSeedingCheckpointJson.summary.sourceAccessCheckpointDismissedCount, 1);
    assert.equal(governanceAfterTaskSeedingCheckpointJson.summary.sourceAccessCheckpointNeedsReviewCount, 1);
    assert.equal(governanceAfterTaskSeedingCheckpointJson.summary.sourceAccessCheckpointDeferredCount, 1);
    assert.equal(governanceAfterTaskSeedingCheckpointJson.summary.sourceAccessCheckpointUnresolvedCount, 2);
    assert.equal(governanceAfterTaskSeedingCheckpointJson.agentControlPlaneDecision.sourceAccessCheckpointUnresolvedCount, 2);
    assert.ok(governanceAfterTaskSeedingCheckpointJson.agentControlPlaneDecision.reasons.some((reason) => reason.code === "source-access-checkpoints-unresolved"));
    assert.ok(governanceAfterTaskSeedingCheckpointJson.taskSeedingCheckpoints.some((checkpoint) => checkpoint.status === "approved"));
    assert.ok(governanceAfterTaskSeedingCheckpointJson.taskSeedingCheckpoints.some((checkpoint) => checkpoint.status === "deferred"));
    assert.ok(governanceAfterTaskSeedingCheckpointJson.taskSeedingCheckpoints.some((checkpoint) => checkpoint.status === "dismissed"));
    assert.ok(governanceAfterTaskSeedingCheckpointJson.operationLog.some((operation) => operation.type === "task-seeding-checkpoint-recorded"));

    const sourcesSummaryCheckpointResponse = await fetch(`${baseUrl}/api/sources/summary`);
    assert.equal(sourcesSummaryCheckpointResponse.status, 200);
    const sourcesSummaryCheckpointJson = await sourcesSummaryCheckpointResponse.json();
    assert.equal(sourcesSummaryCheckpointJson.summary.sourceAccessCheckpointCount, 4);
    assert.equal(sourcesSummaryCheckpointJson.summary.sourceAccessCheckpointUnresolvedCount, 2);
    assert.equal(sourcesSummaryCheckpointJson.sources[0].sourceAccessCheckpoints.total, 1);
    assert.equal(sourcesSummaryCheckpointJson.sources[0].sourceAccessCheckpoints.unresolved, 1);
    assert.equal(sourcesSummaryCheckpointJson.sources[0].sourceAccessCheckpoints.deferred, 1);
    assert.equal(sourcesSummaryCheckpointJson.sources[0].sourceAccessCheckpoints.items[0].batchId, fixtureSourceCheckpointBatchId);

    const sourcesAccessReviewQueueCheckpointResponse = await fetch(`${baseUrl}/api/sources/access-review-queue`);
    assert.equal(sourcesAccessReviewQueueCheckpointResponse.status, 200);
    const sourcesAccessReviewQueueCheckpointJson = await sourcesAccessReviewQueueCheckpointResponse.json();
    assert.equal(sourcesAccessReviewQueueCheckpointJson.summary.checkpointCount, 4);
    assert.equal(sourcesAccessReviewQueueCheckpointJson.summary.checkpointUnresolved, 2);
    if (sourcesAccessReviewQueueCheckpointJson.items.length) {
      assert.ok(sourcesAccessReviewQueueCheckpointJson.items[0].sourceAccessCheckpoints);
    }

    const sourcesEvidenceCoverageCheckpointResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence-coverage`);
    assert.equal(sourcesEvidenceCoverageCheckpointResponse.status, 200);
    const sourcesEvidenceCoverageCheckpointJson = await sourcesEvidenceCoverageCheckpointResponse.json();
    assert.equal(sourcesEvidenceCoverageCheckpointJson.summary.checkpointCount, 4);
    assert.equal(sourcesEvidenceCoverageCheckpointJson.summary.checkpointUnresolved, 2);
    if (sourcesEvidenceCoverageCheckpointJson.items.length) {
      assert.ok(sourcesEvidenceCoverageCheckpointJson.items[0].sourceAccessCheckpoints);
    }
  } finally {
    server.close();
    await once(server, "close");
  }
}

export async function sourceEvidenceCoverageTaskSyncTest() {
  const { appDir, workspaceRoot } = await createFixtureWorkspace();
  const server = createWorkspaceAuditServer({
    rootDir: workspaceRoot,
    publicDir: appDir
  });

  server.listen(0);
  await once(server, "listening");

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const dataSourcesScope = { scopeMode: "portfolio" };

  try {
    const coverageResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence-coverage`);
    assert.equal(coverageResponse.status, 200);
    const coverageJson = await coverageResponse.json();
    assert.equal(coverageJson.items.length, 1);
    assert.equal(coverageJson.items[0].coverageStatus, "missing");

    const unscopedSeedResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence-coverage/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [coverageJson.items[0]] })
    });
    assert.equal(unscopedSeedResponse.status, 409);
    const unscopedSeedJson = await unscopedSeedResponse.json();
    assert.equal(unscopedSeedJson.reasonCode, "agent-execution-scope-required");

    const seedResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence-coverage/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [coverageJson.items[0]], ...dataSourcesScope })
    });
    assert.equal(seedResponse.status, 200);
    const seedJson = await seedResponse.json();
    assert.equal(seedJson.totals.created, 1);
    const coverageTaskId = seedJson.createdTasks[0].id;
    const coverageId = seedJson.createdTasks[0].sourceAccessValidationEvidenceCoverageId;

    const createEvidenceResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: coverageJson.items[0].sourceId,
        accessMethod: coverageJson.items[0].accessMethod,
        status: "validated",
        evidence: "Operator confirmed read-only local folder access before syncing the evidence coverage task.",
        ...dataSourcesScope
      })
    });
    assert.equal(createEvidenceResponse.status, 200);
    const createEvidenceJson = await createEvidenceResponse.json();
    assert.equal(createEvidenceJson.evidence.status, "validated");
    assert.equal(createEvidenceJson.taskSync.updated, 1);
    assert.deepEqual(createEvidenceJson.taskSync.taskIds, [coverageTaskId]);

    const governanceResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceResponse.status, 200);
    const governanceJson = await governanceResponse.json();
    const syncedTask = governanceJson.dataSourcesAccessTasks.find((task) => task.id === coverageTaskId);
    assert.equal(syncedTask.sourceAccessValidationEvidenceCoverageId, coverageId);
    assert.equal(syncedTask.status, "resolved");
    assert.equal(syncedTask.coverageStatus, "covered");
    assert.equal(syncedTask.latestEvidenceStatus, "validated");
    assert.equal(syncedTask.lastSourceAccessValidationEvidenceId, createEvidenceJson.evidence.id);
    assert.equal(governanceJson.summary.dataSourcesAccessTaskCount, 1);
    assert.equal(governanceJson.summary.dataSourcesAccessOpenTaskCount, 0);
    assert.equal(governanceJson.summary.dataSourcesAccessClosedTaskCount, 1);
    assert.ok(governanceJson.operationLog.some((operation) => operation.type === "data-source-access-validation-evidence-coverage-tasks-synced"));

    const taskLedgerResponse = await fetch(`${baseUrl}/api/sources/access-task-ledger?status=closed`);
    assert.equal(taskLedgerResponse.status, 200);
    const taskLedgerJson = await taskLedgerResponse.json();
    assert.equal(taskLedgerJson.items.length, 1);
    assert.equal(taskLedgerJson.items[0].sourceAccessValidationEvidenceCoverageId, coverageId);
    assert.equal(taskLedgerJson.items[0].lastSourceAccessValidationEvidenceStatus, "validated");
    assert.match(taskLedgerJson.markdown, /Evidence sync: validated/);
  } finally {
    server.close();
    await once(server, "close");
  }
}

export async function sourceAccessValidationWorkflowTaskSeedingTest() {
  const { appDir, workspaceRoot } = await createFixtureWorkspace();
  const server = createWorkspaceAuditServer({
    rootDir: workspaceRoot,
    publicDir: appDir
  });

  server.listen(0);
  await once(server, "listening");

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const dataSourcesScope = { scopeMode: "portfolio" };

  try {
    const workflowResponse = await fetch(`${baseUrl}/api/sources/access-validation-workflow`);
    assert.equal(workflowResponse.status, 200);
    const workflowJson = await workflowResponse.json();
    assert.equal(workflowJson.summary.total, 1);
    assert.equal(workflowJson.summary.pending, 1);
    assert.equal(workflowJson.items[0].stage, "record-validation-evidence");

    const unscopedSeedResponse = await fetch(`${baseUrl}/api/sources/access-validation-workflow/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [workflowJson.items[0]] })
    });
    assert.equal(unscopedSeedResponse.status, 409);
    const unscopedSeedJson = await unscopedSeedResponse.json();
    assert.equal(unscopedSeedJson.reasonCode, "agent-execution-scope-required");

    const seedResponse = await fetch(`${baseUrl}/api/sources/access-validation-workflow/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [workflowJson.items[0]],
        saveSnapshot: true,
        snapshotTitle: "Fixture Workflow Task Ledger Auto Capture",
        snapshotStatus: "open",
        snapshotLimit: 5,
        ...dataSourcesScope
      })
    });
    assert.equal(seedResponse.status, 200);
    const seedJson = await seedResponse.json();
    assert.equal(seedJson.success, true);
    assert.equal(seedJson.totals.created, 1);
    assert.equal(seedJson.snapshotCaptured, true);
    assert.equal(seedJson.snapshot.title, "Fixture Workflow Task Ledger Auto Capture");
    assert.equal(seedJson.snapshot.statusFilter, "open");
    assert.equal(seedJson.snapshot.openCount, 1);
    assert.equal(seedJson.dataSourceAccessTaskLedgerSnapshots.length, 1);
    assert.equal(seedJson.createdTasks[0].sourceAccessValidationWorkflowId, workflowJson.items[0].id);
    assert.equal(seedJson.createdTasks[0].sourceAccessValidationEvidenceCoverageId, `source-access-validation-evidence-coverage:${workflowJson.items[0].sourceId}`);
    assert.equal(seedJson.createdTasks[0].workflowStage, "record-validation-evidence");
    assert.ok(seedJson.createdTasks[0].blockerTypes.includes("missing-validation-evidence"));
    assert.match(seedJson.createdTasks[0].description, /Do not store secrets/);

    const repeatSeedResponse = await fetch(`${baseUrl}/api/sources/access-validation-workflow/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [workflowJson.items[0]], ...dataSourcesScope })
    });
    assert.equal(repeatSeedResponse.status, 200);
    const repeatSeedJson = await repeatSeedResponse.json();
    assert.equal(repeatSeedJson.totals.created, 0);
    assert.equal(repeatSeedJson.totals.skipped, 1);

    const governanceResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceResponse.status, 200);
    const governanceJson = await governanceResponse.json();
    assert.equal(governanceJson.summary.dataSourcesAccessTaskCount, 1);
    assert.equal(governanceJson.summary.dataSourcesAccessOpenTaskCount, 1);
    assert.equal(governanceJson.summary.dataSourceAccessTaskLedgerSnapshotCount, 1);
    assert.equal(governanceJson.dataSourcesAccessTasks[0].sourceAccessValidationWorkflowId, workflowJson.items[0].id);
    assert.ok(governanceJson.operationLog.some((operation) => operation.type === "data-source-access-validation-workflow-tasks-created"));
    assert.ok(governanceJson.operationLog.some((operation) => operation.type === "data-source-access-validation-workflow-task-ledger-snapshot-auto-captured"));

    const taskLedgerResponse = await fetch(`${baseUrl}/api/sources/access-task-ledger?status=open`);
    assert.equal(taskLedgerResponse.status, 200);
    const taskLedgerJson = await taskLedgerResponse.json();
    assert.equal(taskLedgerJson.summary.total, 1);
    assert.equal(taskLedgerJson.items[0].sourceAccessValidationWorkflowId, workflowJson.items[0].id);
    assert.equal(taskLedgerJson.items[0].workflowStage, "record-validation-evidence");
    assert.match(taskLedgerJson.markdown, /Workflow: record-validation-evidence/);

    const createEvidenceResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: workflowJson.items[0].sourceId,
        accessMethod: workflowJson.items[0].accessMethod,
        status: "validated",
        evidence: "Operator confirmed read-only local folder access before syncing the workflow task.",
        ...dataSourcesScope
      })
    });
    assert.equal(createEvidenceResponse.status, 200);
    const createEvidenceJson = await createEvidenceResponse.json();
    assert.equal(createEvidenceJson.taskSync.updated, 1);
    assert.equal(createEvidenceJson.taskSync.taskIds.length, 1);

    const closedTaskLedgerResponse = await fetch(`${baseUrl}/api/sources/access-task-ledger?status=closed`);
    assert.equal(closedTaskLedgerResponse.status, 200);
    const closedTaskLedgerJson = await closedTaskLedgerResponse.json();
    assert.equal(closedTaskLedgerJson.summary.closed, 1);
    assert.equal(closedTaskLedgerJson.items[0].status, "resolved");
    assert.equal(closedTaskLedgerJson.items[0].lastSourceAccessValidationEvidenceStatus, "validated");
    assert.equal(closedTaskLedgerJson.items[0].sourceAccessValidationWorkflowId, workflowJson.items[0].id);

    const taskLedgerSnapshotDiffResponse = await fetch(`${baseUrl}/api/sources/access-task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(taskLedgerSnapshotDiffResponse.status, 200);
    const taskLedgerSnapshotDiffJson = await taskLedgerSnapshotDiffResponse.json();
    assert.equal(taskLedgerSnapshotDiffJson.snapshotWorkflowTaskSummary.total, 1);
    assert.equal(taskLedgerSnapshotDiffJson.liveWorkflowTaskSummary.total, 0);
    assert.ok(taskLedgerSnapshotDiffJson.driftItems.some((item) => item.category === "source-access-validation-workflow-task-ledger"));
    assert.ok(taskLedgerSnapshotDiffJson.driftItems.some((item) => item.field.startsWith("source-access-validation-workflow-task:")));
  } finally {
    server.close();
    await once(server, "close");
  }
}
