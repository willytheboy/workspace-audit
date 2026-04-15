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
  const createExecutionResultCheckpoint = async (runId, targetAction, status = "approved") => {
    const checkpointResponse = await fetch(`${baseUrl}/api/agent-execution-result-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId,
        targetAction,
        status,
        note: `Fixture ${targetAction} checkpoint.`
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

    const rejectedDeploymentSmokeCheckResponse = await fetch(`${baseUrl}/api/deployments/smoke-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: `${baseUrl}/` })
    });
    assert.equal(rejectedDeploymentSmokeCheckResponse.status, 400);
    const rejectedDeploymentSmokeCheckJson = await rejectedDeploymentSmokeCheckResponse.json();
    assert.match(rejectedDeploymentSmokeCheckJson.error, /allowLocal=true/);

    const deploymentSmokeCheckResponse = await fetch(`${baseUrl}/api/deployments/smoke-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: `${baseUrl}/`, label: "Fixture local app", allowLocal: true, timeoutMs: 3000 })
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

    const createReleaseCheckpointResponse = await fetch(`${baseUrl}/api/releases/checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Release Checkpoint", status: "review", notes: "Fixture non-secret release checkpoint." })
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

    const releaseGateBootstrapResponse = await fetch(`${baseUrl}/api/releases/build-gate/bootstrap-local-evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: baseUrl,
        label: "Fixture release gate local app",
        title: "Fixture Release Gate Bootstrap",
        notes: "Fixture local non-secret release gate evidence."
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

    const createSourcesAccessValidationWorkflowSnapshotResponse = await fetch(`${baseUrl}/api/sources/access-validation-workflow-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Source Access Validation Workflow" })
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

    const rejectedSourcesAccessValidationEvidenceResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: sourcesAccessValidationRunbookJson.methods[0].sources[0].sourceId,
        status: "validated",
        evidence: "password=supersecretvalue"
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
        commandHint: "PowerShell: Test-Path <local-path>"
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

    const createSourcesAccessValidationEvidenceSnapshotResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Source Access Evidence", status: "validated", limit: 5 })
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
    assert.deepEqual(sourcesAccessReviewQueueJson.items, []);
    assert.match(sourcesAccessReviewQueueJson.markdown, /# Data Sources Access Review Queue/);

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

    const createSourcesSummarySnapshotResponse = await fetch(`${baseUrl}/api/sources/summary-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Sources Health Summary" })
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

    const addSourceResponse = await fetch(`${baseUrl}/api/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "github", url: "https://example.com/org/repo" })
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
    assert.equal(sourcesAccessReviewQueueAfterAddJson.items[0].accessMethod, "git-https");
    assert.match(sourcesAccessReviewQueueAfterAddJson.items[0].action, /Git Credential Manager/);
    assert.match(sourcesAccessReviewQueueAfterAddJson.markdown, /Data Sources Access Review Queue/);

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
    assert.equal(governanceAfterSourceReviewQueueJson.dataSourcesAccessReviewQueue.items[0].accessMethod, "git-https");
    assert.equal(governanceAfterSourceReviewQueueJson.agentControlPlaneDecision.dataSourcesAccessReviewQueueCount, 1);

    const sourcesAccessGateAfterAddResponse = await fetch(`${baseUrl}/api/sources/access-gate`);
    assert.equal(sourcesAccessGateAfterAddResponse.status, 200);
    const sourcesAccessGateAfterAddJson = await sourcesAccessGateAfterAddResponse.json();
    assert.equal(sourcesAccessGateAfterAddJson.decision, "review");
    assert.equal(sourcesAccessGateAfterAddJson.review, 1);
    assert.equal(sourcesAccessGateAfterAddJson.tokenLikely, 1);
    assert.ok(sourcesAccessGateAfterAddJson.reasons.some((reason) => reason.code === "token-oauth-review"));

    const deleteSourceResponse = await fetch(`${baseUrl}/api/sources/${encodeURIComponent(addedSource.id)}`, {
      method: "DELETE"
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
        note: "Same stack but different product intent."
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

    const createTaskResponse = await fetch(`${baseUrl}/api/tasks`, {
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

    const patchTaskResponse = await fetch(`${baseUrl}/api/tasks/${createTaskJson.task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" })
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

    const createTaskUpdateLedgerSnapshotResponse = await fetch(`${baseUrl}/api/governance/task-update-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Governance Task Update Ledger", limit: 5 })
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
      body: JSON.stringify({ priority: "medium" })
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

    const createWorkflowResponse = await fetch(`${baseUrl}/api/workflows`, {
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

    const scriptRunResponse = await fetch(`${baseUrl}/api/run?script=missing-script&path=alpha-app`);
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
        status: "prepared"
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

    const patchWorkflowResponse = await fetch(`${baseUrl}/api/workflows/${createWorkflowJson.workflow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" })
    });
    assert.equal(patchWorkflowResponse.status, 200);
    const patchWorkflowJson = await patchWorkflowResponse.json();
    assert.equal(patchWorkflowJson.workflow.status, "done");

    const createNoteResponse = await fetch(`${baseUrl}/api/notes`, {
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
    assert.equal(createNoteResponse.status, 200);
    const createNoteJson = await createNoteResponse.json();
    assert.equal(createNoteJson.success, true);

    const notesResponse = await fetch(`${baseUrl}/api/notes?projectId=alpha-app`);
    assert.equal(notesResponse.status, 200);
    const notesJson = await notesResponse.json();
    assert.equal(notesJson.length, 1);

    const patchNoteResponse = await fetch(`${baseUrl}/api/notes/${createNoteJson.note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "decision" })
    });
    assert.equal(patchNoteResponse.status, 200);
    const patchNoteJson = await patchNoteResponse.json();
    assert.equal(patchNoteJson.note.kind, "decision");

    const createMilestoneResponse = await fetch(`${baseUrl}/api/milestones`, {
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
    assert.equal(createMilestoneResponse.status, 200);
    const createMilestoneJson = await createMilestoneResponse.json();
    assert.equal(createMilestoneJson.success, true);

    const milestonesResponse = await fetch(`${baseUrl}/api/milestones?projectId=alpha-app`);
    assert.equal(milestonesResponse.status, 200);
    const milestonesJson = await milestonesResponse.json();
    assert.equal(milestonesJson.length, 1);

    const patchMilestoneResponse = await fetch(`${baseUrl}/api/milestones/${createMilestoneJson.milestone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" })
    });
    assert.equal(patchMilestoneResponse.status, 200);
    const patchMilestoneJson = await patchMilestoneResponse.json();
    assert.equal(patchMilestoneJson.milestone.status, "done");

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
        summary: "Primary fixture app used to validate the control-center workflow."
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
        summary: "Profile updated to reflect the control-center rollout."
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

    const approveAgentPolicyResponse = await fetch(`${baseUrl}/api/agent-policy-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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

    const createAgentWorkOrderSnapshotResponse = await fetch(`${baseUrl}/api/agent-work-order-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Agent Work Orders",
        status: "all",
        limit: 10
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

    const batchAgentWorkOrderRunsResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createAgentWorkOrderSnapshotJson.snapshot.id
      })
    });
    assert.equal(batchAgentWorkOrderRunsResponse.status, 200);
    const batchAgentWorkOrderRunsJson = await batchAgentWorkOrderRunsResponse.json();
    assert.equal(batchAgentWorkOrderRunsJson.success, true);
    assert.equal(batchAgentWorkOrderRunsJson.queuedRuns.length, 1);
    assert.equal(batchAgentWorkOrderRunsJson.queuedRuns[0].snapshotId, createAgentWorkOrderSnapshotJson.snapshot.id);
    assert.equal(batchAgentWorkOrderRunsJson.queuedRuns[0].agentPolicyId, "agent-policy:alpha-app");
    assert.equal(batchAgentWorkOrderRunsJson.queuedRuns[0].agentPolicyCheckpointStatus, "approved");
    assert.equal(batchAgentWorkOrderRunsJson.queuedRuns[0].history.length, 1);
    assert.equal(batchAgentWorkOrderRunsJson.queuedRuns[0].history[0].status, "queued");

    const repeatBatchAgentWorkOrderRunsResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createAgentWorkOrderSnapshotJson.snapshot.id
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
        notes: "Fixture execution queue item."
      })
    });
    assert.equal(createAgentWorkOrderRunResponse.status, 200);
    const createAgentWorkOrderRunJson = await createAgentWorkOrderRunResponse.json();
    assert.equal(createAgentWorkOrderRunJson.success, true);
    assert.equal(createAgentWorkOrderRunJson.run.status, "queued");
    assert.equal(createAgentWorkOrderRunJson.run.agentPolicyCheckpointStatus, "approved");
    assert.equal(createAgentWorkOrderRunJson.run.agentRole, approvedAgentWorkOrdersJson.items[0].agentPolicy.role);
    assert.equal(createAgentWorkOrderRunJson.run.history.length, 1);
    assert.equal(createAgentWorkOrderRunJson.run.history[0].status, "queued");

    const codexCliBridgeDryRunResponse = await fetch(`${baseUrl}/api/cli-bridge/runner-dry-run?runner=codex&runId=${createAgentWorkOrderRunJson.run.id}`);
    assert.equal(codexCliBridgeDryRunResponse.status, 200);
    const codexCliBridgeDryRunJson = await codexCliBridgeDryRunResponse.json();
    assert.equal(codexCliBridgeDryRunJson.protocolVersion, "cli-bridge-runner-dry-run.v1");
    assert.equal(codexCliBridgeDryRunJson.executionMode, "non-executing");
    assert.equal(codexCliBridgeDryRunJson.runner, "codex");
    assert.equal(codexCliBridgeDryRunJson.selectedWorkOrder.id, createAgentWorkOrderRunJson.run.id);
    assert.equal(codexCliBridgeDryRunJson.commandEnvelope.adapterId, "codex");
    assert.match(codexCliBridgeDryRunJson.commandEnvelope.displayCommand, /codex exec/);
    assert.match(codexCliBridgeDryRunJson.markdown, /# CLI Bridge Runner Dry Run/);
    assert.match(codexCliBridgeDryRunJson.markdown, /Do not use or request secrets/);

    const claudeCliBridgeDryRunResponse = await fetch(`${baseUrl}/api/cli-bridge/runner-dry-run?runner=claude&runId=${createAgentWorkOrderRunJson.run.id}`);
    assert.equal(claudeCliBridgeDryRunResponse.status, 200);
    const claudeCliBridgeDryRunJson = await claudeCliBridgeDryRunResponse.json();
    assert.equal(claudeCliBridgeDryRunJson.runner, "claude");
    assert.equal(claudeCliBridgeDryRunJson.commandEnvelope.adapterId, "claude");
    assert.match(claudeCliBridgeDryRunJson.commandEnvelope.displayCommand, /claude -p/);
    assert.match(claudeCliBridgeDryRunJson.expectedOutputSchema.handoffRecommendation, /codex/);

    const updateAgentWorkOrderRunResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/${createAgentWorkOrderRunJson.run.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "running",
        notes: "Fixture run started."
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
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.total, 2);
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.active, 2);
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.statusCounts.queued, 1);
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.statusCounts.running, 1);
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.statusCounts.blocked, 0);
    assert.equal(governanceAfterWorkOrderRunJson.agentExecutionMetrics.latestEventStatus, "running");
    assert.equal(governanceAfterWorkOrderRunJson.agentWorkOrderRuns.length, 2);
    const governanceOperationTypes = governanceAfterWorkOrderRunJson.operationLog.map((operation) => operation.type);
    assert.ok(governanceOperationTypes.includes("agent-work-order-runs-batch-queued"));
    assert.ok(governanceOperationTypes.includes("agent-work-order-run-created"));
    assert.ok(governanceOperationTypes.includes("agent-work-order-run-status-updated"));
    assert.ok(governanceOperationTypes.includes("agent-policy-checkpoint-recorded"));

    const cancelAgentWorkOrderRunResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/${createAgentWorkOrderRunJson.run.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "cancelled",
        notes: "Fixture run cancelled."
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
        notes: "Fixture run retried without checkpoint."
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
      body: JSON.stringify({ status: "resolved" })
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
        notes: "Fixture run retried."
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
        notes: "Fixture run blocked."
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
        notes: "Fixture run resumed."
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
        notes: "Fixture run passed."
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
        notes: "Fixture run archived without checkpoint."
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
        notes: "Fixture run archived."
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
          notes: `Retention fixture ${status}.`
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
        runIds: retentionRunIds
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
        runIds: retentionRunIds
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
        showArchivedExecution: true
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

    const saveExecutionPolicyResponse = await fetch(`${baseUrl}/api/governance/execution-policy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staleThresholdHours: 6
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
        updatedAt: staleRunCreatedAt
      })
    });
    assert.equal(staleRunResponse.status, 200);
    const staleRunJson = await staleRunResponse.json();

    const slaBreachResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/sla-breaches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "escalated",
        runIds: [staleRunJson.run.id]
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
        showArchivedExecution: false
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
        runIds: [staleRunJson.run.id]
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
        runIds: [staleRunJson.run.id]
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

    const createSlaLedgerSnapshotResponse = await fetch(`${baseUrl}/api/agent-work-order-runs/sla-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Resolved SLA ledger",
        state: "resolved",
        limit: 5
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
    assert.equal(cliBridgeContextJson.bridgeDecision, "hold");
    assert.match(cliBridgeContextJson.secretPolicy, /Do not include passwords/);
    assert.match(cliBridgeContextJson.markdown, /# CLI Bridge Context Pack/);
    assert.match(cliBridgeContextJson.markdown, /Codex CLI/);
    assert.match(cliBridgeContextJson.markdown, /Workspace Audit Pro owns work-order creation/);

    const initialCliBridgeHandoffsResponse = await fetch(`${baseUrl}/api/cli-bridge/handoffs?runner=all&limit=5`);
    assert.equal(initialCliBridgeHandoffsResponse.status, 200);
    const initialCliBridgeHandoffsJson = await initialCliBridgeHandoffsResponse.json();
    assert.equal(initialCliBridgeHandoffsJson.total, 0);
    assert.match(initialCliBridgeHandoffsJson.markdown, /# CLI Bridge Handoff Ledger/);

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
        nextAction: "Claude should review the summary and recommend follow-up work-order scope."
      })
    });
    assert.equal(createCliBridgeHandoffResponse.status, 200);
    const createCliBridgeHandoffJson = await createCliBridgeHandoffResponse.json();
    assert.equal(createCliBridgeHandoffJson.success, true);
    assert.equal(createCliBridgeHandoffJson.handoff.sourceRunner, "codex");
    assert.equal(createCliBridgeHandoffJson.handoff.targetRunner, "claude");
    assert.match(createCliBridgeHandoffJson.handoff.secretPolicy, /Non-secret CLI bridge handoff/);
    assert.equal(createCliBridgeHandoffJson.ledger.total, 1);

    const acceptCliBridgeHandoffResponse = await fetch(`${baseUrl}/api/cli-bridge/handoffs/${createCliBridgeHandoffJson.handoff.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "accept",
        note: "Fixture operator accepted the Codex to Claude handoff."
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

    const acceptedCliBridgeWorkOrderDraftResponse = await fetch(`${baseUrl}/api/cli-bridge/handoffs/${createCliBridgeHandoffJson.handoff.id}/work-order-draft?runner=claude`);
    assert.equal(acceptedCliBridgeWorkOrderDraftResponse.status, 200);
    const acceptedCliBridgeWorkOrderDraftJson = await acceptedCliBridgeWorkOrderDraftResponse.json();
    assert.equal(acceptedCliBridgeWorkOrderDraftJson.protocolVersion, "cli-bridge-follow-up-work-order-draft.v1");
    assert.equal(acceptedCliBridgeWorkOrderDraftJson.executionMode, "non-executing");
    assert.equal(acceptedCliBridgeWorkOrderDraftJson.runner, "claude");
    assert.equal(acceptedCliBridgeWorkOrderDraftJson.handoffId, createCliBridgeHandoffJson.handoff.id);
    assert.equal(acceptedCliBridgeWorkOrderDraftJson.sourceHandoff.status, "accepted");
    assert.match(acceptedCliBridgeWorkOrderDraftJson.draft.prompt, /Codex completed the bounded fixture implementation slice/);
    assert.match(acceptedCliBridgeWorkOrderDraftJson.markdown, /# CLI Bridge Follow-up Work-Order Draft/);

    const queueCliBridgeWorkOrderRunResponse = await fetch(`${baseUrl}/api/cli-bridge/handoffs/${createCliBridgeHandoffJson.handoff.id}/work-order-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "claude",
        notes: "Fixture queued a CLI bridge follow-up work-order run."
      })
    });
    assert.equal(queueCliBridgeWorkOrderRunResponse.status, 200);
    const queueCliBridgeWorkOrderRunJson = await queueCliBridgeWorkOrderRunResponse.json();
    assert.equal(queueCliBridgeWorkOrderRunJson.success, true);
    assert.equal(queueCliBridgeWorkOrderRunJson.run.cliBridgeHandoffId, createCliBridgeHandoffJson.handoff.id);
    assert.equal(queueCliBridgeWorkOrderRunJson.run.cliBridgeRunner, "claude");
    assert.equal(queueCliBridgeWorkOrderRunJson.run.status, "queued");
    assert.match(queueCliBridgeWorkOrderRunJson.run.notes, /Fixture queued/);

    const claudeCliBridgeHandoffsResponse = await fetch(`${baseUrl}/api/cli-bridge/handoffs?runner=claude&limit=5`);
    assert.equal(claudeCliBridgeHandoffsResponse.status, 200);
    const claudeCliBridgeHandoffsJson = await claudeCliBridgeHandoffsResponse.json();
    assert.equal(claudeCliBridgeHandoffsJson.total, 1);
    assert.equal(claudeCliBridgeHandoffsJson.items[0].targetRunner, "claude");
    assert.match(claudeCliBridgeHandoffsJson.markdown, /Codex implementation handoff for Claude review/);

    const governanceAfterCliBridgeHandoffResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterCliBridgeHandoffResponse.status, 200);
    const governanceAfterCliBridgeHandoffJson = await governanceAfterCliBridgeHandoffResponse.json();
    assert.equal(governanceAfterCliBridgeHandoffJson.summary.cliBridgeHandoffCount, 1);
    assert.equal(governanceAfterCliBridgeHandoffJson.cliBridgeHandoffs.length, 1);
    assert.equal(governanceAfterCliBridgeHandoffJson.cliBridgeHandoffs[0].sourceRunner, "codex");
    assert.equal(governanceAfterCliBridgeHandoffJson.cliBridgeHandoffs[0].followUpWorkOrderRunId, queueCliBridgeWorkOrderRunJson.run.id);
    assert.equal(governanceAfterCliBridgeHandoffJson.cliBridgeHandoffs[0].followUpWorkOrderRunner, "claude");
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
        nextAction: "Operator should review and accept or request a follow-up work order."
      })
    });
    assert.equal(createCliBridgeRunnerResultResponse.status, 200);
    const createCliBridgeRunnerResultJson = await createCliBridgeRunnerResultResponse.json();
    assert.equal(createCliBridgeRunnerResultJson.success, true);
    assert.equal(createCliBridgeRunnerResultJson.handoff.sourceRunner, "claude");
    assert.equal(createCliBridgeRunnerResultJson.handoff.targetRunner, "operator");
    assert.equal(createCliBridgeRunnerResultJson.handoff.resultStatus, "changed");
    assert.equal(createCliBridgeRunnerResultJson.handoff.handoffRecommendation, "operator");
    assert.equal(createCliBridgeRunnerResultJson.linkedRun.id, createAgentWorkOrderRunJson.run.id);
    assert.equal(createCliBridgeRunnerResultJson.linkedRun.latestCliBridgeResultHandoffId, createCliBridgeRunnerResultJson.handoff.id);
    assert.equal(createCliBridgeRunnerResultJson.linkedRun.latestCliBridgeResultStatus, "changed");
    assert.equal(createCliBridgeRunnerResultJson.linkedRun.latestCliBridgeResultRunner, "claude");
    assert.equal(createCliBridgeRunnerResultJson.ledger.total, 2);
    assert.ok(createCliBridgeRunnerResultJson.ledger.markdown.includes("runner-result:changed"));

    const escalateCliBridgeRunnerResultResponse = await fetch(`${baseUrl}/api/cli-bridge/handoffs/${createCliBridgeRunnerResultJson.handoff.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "escalate",
        createTask: true,
        note: "Fixture operator escalated the runner result for follow-up."
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

    const escalatedCliBridgeWorkOrderDraftResponse = await fetch(`${baseUrl}/api/cli-bridge/handoffs/${createCliBridgeRunnerResultJson.handoff.id}/work-order-draft?runner=codex`);
    assert.equal(escalatedCliBridgeWorkOrderDraftResponse.status, 200);
    const escalatedCliBridgeWorkOrderDraftJson = await escalatedCliBridgeWorkOrderDraftResponse.json();
    assert.equal(escalatedCliBridgeWorkOrderDraftJson.runner, "codex");
    assert.equal(escalatedCliBridgeWorkOrderDraftJson.draftDecision, "review");
    assert.equal(escalatedCliBridgeWorkOrderDraftJson.sourceHandoff.reviewAction, "escalate");
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
    assert.ok(cliBridgeRunTraceJson.relatedHandoffCount >= 2);
    assert.match(cliBridgeRunTraceJson.markdown, /# CLI Bridge Run Trace/);
    assert.match(cliBridgeRunTraceJson.markdown, /CLI bridge handoff review recorded/);

    const cliBridgeRunTraceSnapshotResponse = await fetch(`${baseUrl}/api/cli-bridge/runs/${createAgentWorkOrderRunJson.run.id}/trace-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture CLI bridge run trace"
      })
    });
    assert.equal(cliBridgeRunTraceSnapshotResponse.status, 200);
    const cliBridgeRunTraceSnapshotJson = await cliBridgeRunTraceSnapshotResponse.json();
    assert.equal(cliBridgeRunTraceSnapshotJson.snapshot.title, "Fixture CLI bridge run trace");
    assert.equal(cliBridgeRunTraceSnapshotJson.snapshot.runId, createAgentWorkOrderRunJson.run.id);
    assert.equal(cliBridgeRunTraceSnapshotJson.snapshot.traceDecision, "ready");
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
    assert.ok(initialAgentControlPlaneDecisionJson.reasons.some((reason) => reason.code === "baseline-missing"));
    assert.ok(initialAgentControlPlaneDecisionJson.reasons.some((reason) => reason.code === "release-build-gate-review"));
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /# Agent Control Plane Decision/);
    assert.match(initialAgentControlPlaneDecisionJson.markdown, /Decision: hold/);
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

    const createAgentControlPlaneDecisionSnapshotResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Control Plane Decision" })
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

    const createAgentControlPlaneSnapshotResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Agent Control Plane",
        limit: 5
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

    const setAgentControlPlaneBaselineResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots/baseline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: createAgentControlPlaneSnapshotJson.snapshot.id
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
        baseline: true
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

    const blockedRefreshAgentControlPlaneBaselineResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots/baseline/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Blocked Fixture Refreshed Baseline",
        limit: 5
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
        limit: 5
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

    const clearAgentControlPlaneBaselineResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots/baseline/clear`, {
      method: "POST"
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
        snapshotId: refreshAgentControlPlaneBaselineJson.snapshot.id
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
        showArchivedExecution: false
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
        showArchivedExecution: false
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
        notes: "Fixture baseline drift item."
      })
    });
    assert.equal(driftFixtureRunResponse.status, 200);

    const governanceAfterBaselineDriftResponse = await fetch(`${baseUrl}/api/governance`);
    assert.equal(governanceAfterBaselineDriftResponse.status, 200);
    const governanceAfterBaselineDriftJson = await governanceAfterBaselineDriftResponse.json();
    assert.equal(governanceAfterBaselineDriftJson.agentControlPlaneBaselineStatus.hasDrift, true);
    assert.ok(governanceAfterBaselineDriftJson.agentControlPlaneBaselineStatus.driftScore >= 1);
    assert.equal(governanceAfterBaselineDriftJson.agentControlPlaneBaselineStatus.health, "changed");
    assert.match(governanceAfterBaselineDriftJson.agentControlPlaneBaselineStatus.recommendedAction, /Review the baseline drift fields/);
    assert.equal(governanceAfterBaselineDriftJson.agentControlPlaneBaselineStatus.driftSeverity, "low");
    assert.match(governanceAfterBaselineDriftJson.agentControlPlaneBaselineStatus.driftRecommendedAction, /Review the listed drift fields/);
    assert.equal(governanceAfterBaselineDriftJson.summary.agentControlPlaneBaselineHealth, "changed");
    assert.equal(governanceAfterBaselineDriftJson.summary.agentControlPlaneBaselineDriftSeverity, "low");
    assert.equal(governanceAfterBaselineDriftJson.agentControlPlaneDecision.decision, "review");
    assert.equal(governanceAfterBaselineDriftJson.agentControlPlaneDecision.baselineDriftSeverity, "low");
    assert.ok(governanceAfterBaselineDriftJson.agentControlPlaneDecision.reasons.some((reason) => reason.code === "baseline-drift-low"));
    assert.ok(governanceAfterBaselineDriftJson.agentControlPlaneBaselineStatus.driftItems.some((item) => item.field === "agentWorkOrderRunCount" && item.delta === 1));
    assert.ok(governanceAfterBaselineDriftJson.summary.agentControlPlaneBaselineDriftItems.some((item) => item.label === "Execution Runs"));

    const directBaselineStatusAfterDriftResponse = await fetch(`${baseUrl}/api/agent-control-plane/baseline-status`);
    assert.equal(directBaselineStatusAfterDriftResponse.status, 200);
    const directBaselineStatusAfterDriftJson = await directBaselineStatusAfterDriftResponse.json();
    assert.equal(directBaselineStatusAfterDriftJson.hasBaseline, true);
    assert.equal(directBaselineStatusAfterDriftJson.health, "changed");
    assert.ok(directBaselineStatusAfterDriftJson.driftScore >= 1);
    assert.equal(directBaselineStatusAfterDriftJson.driftSeverity, "low");
    assert.match(directBaselineStatusAfterDriftJson.driftRecommendedAction, /Review the listed drift fields/);
    assert.ok(directBaselineStatusAfterDriftJson.driftItems.some((item) => item.field === "execution-runs" && item.delta >= 1));
    assert.ok(directBaselineStatusAfterDriftJson.diff.driftItems.some((item) => item.field === "execution-runs" && item.delta >= 1));
    assert.equal(directBaselineStatusAfterDriftJson.diff.driftSeverity, "low");
    assert.match(directBaselineStatusAfterDriftJson.diff.recommendedAction, /Review the listed drift fields/);
    assert.match(directBaselineStatusAfterDriftJson.markdown, /Recommended action:/);
    assert.match(directBaselineStatusAfterDriftJson.markdown, /Drift severity: low/);
    assert.match(directBaselineStatusAfterDriftJson.markdown, /## Drift Fields/);

    const baselineSnapshotDiffAfterDriftResponse = await fetch(`${baseUrl}/api/agent-control-plane-snapshots/diff?snapshotId=baseline`);
    assert.equal(baselineSnapshotDiffAfterDriftResponse.status, 200);
    const baselineSnapshotDiffAfterDriftJson = await baselineSnapshotDiffAfterDriftResponse.json();
    assert.equal(baselineSnapshotDiffAfterDriftJson.hasDrift, true);
    assert.equal(baselineSnapshotDiffAfterDriftJson.driftSeverity, "low");
    assert.match(baselineSnapshotDiffAfterDriftJson.recommendedAction, /Review the listed drift fields/);
    assert.ok(baselineSnapshotDiffAfterDriftJson.driftItems.some((item) => item.field === "execution-runs" && item.delta >= 1));
    assert.match(baselineSnapshotDiffAfterDriftJson.markdown, /Drift severity: low/);
    assert.match(baselineSnapshotDiffAfterDriftJson.markdown, /## Drift Fields/);
    assert.match(baselineSnapshotDiffAfterDriftJson.markdown, /Execution runs/);

    const agentControlPlaneAfterBaselineDriftResponse = await fetch(`${baseUrl}/api/agent-control-plane?limit=5`);
    assert.equal(agentControlPlaneAfterBaselineDriftResponse.status, 200);
    const agentControlPlaneAfterBaselineDriftJson = await agentControlPlaneAfterBaselineDriftResponse.json();
    assert.equal(agentControlPlaneAfterBaselineDriftJson.baselineStatus.hasBaseline, true);
    assert.equal(agentControlPlaneAfterBaselineDriftJson.baselineStatus.health, "changed");
    assert.ok(agentControlPlaneAfterBaselineDriftJson.baselineStatus.driftScore >= 1);
    assert.ok(agentControlPlaneAfterBaselineDriftJson.baselineStatus.driftItems.some((item) => item.field === "agentWorkOrderRunCount" && item.delta === 1));
    assert.match(agentControlPlaneAfterBaselineDriftJson.markdown, /Baseline health: changed/);
    assert.match(agentControlPlaneAfterBaselineDriftJson.markdown, /Baseline action:/);
    assert.match(agentControlPlaneAfterBaselineDriftJson.markdown, /Baseline drift severity: low/);
    assert.match(agentControlPlaneAfterBaselineDriftJson.markdown, /## Baseline Drift Fields/);
    assert.match(agentControlPlaneAfterBaselineDriftJson.markdown, /Execution Runs/);

    const agentControlPlaneDecisionAfterDriftResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision`);
    assert.equal(agentControlPlaneDecisionAfterDriftResponse.status, 200);
    const agentControlPlaneDecisionAfterDriftJson = await agentControlPlaneDecisionAfterDriftResponse.json();
    assert.equal(agentControlPlaneDecisionAfterDriftJson.decision, "review");
    assert.equal(agentControlPlaneDecisionAfterDriftJson.baselineDriftSeverity, "low");
    assert.ok(agentControlPlaneDecisionAfterDriftJson.reasons.some((reason) => reason.code === "baseline-drift-low"));
    assert.match(agentControlPlaneDecisionAfterDriftJson.markdown, /Decision: review/);
    assert.match(agentControlPlaneDecisionAfterDriftJson.markdown, /Baseline drift severity: low/);

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
        }]
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
        }]
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

    const createSourcesAccessTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/sources/access-task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Source Access Task Ledger", status: "open", limit: 5 })
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
      body: JSON.stringify({ status: "resolved" })
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
        }]
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
        }]
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
    name: "beta-app",
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

    const createReviewResponse = await fetch(`${baseUrl}/api/convergence/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leftId: "alpha-app",
        rightId: "beta-app",
        status: "not-related",
        note: "Different operator-confirmed product intent."
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

    const operatorProposalResponse = await fetch(`${baseUrl}/api/convergence/proposals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leftId: "alpha-app",
        rightId: "beta-app",
        operatorContext: "The operator knows these apps share the same generated Vite/React app shell and should be reviewed for assimilation."
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

    const convergenceTaskResponse = await fetch(`${baseUrl}/api/convergence/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairIds: [operatorProposalJson.review.pairId]
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

    const queueConvergenceAssimilationRunResponse = await fetch(`${baseUrl}/api/convergence/assimilation-work-order-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairId: operatorProposalJson.review.pairId,
        runner: "claude"
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
        runner: "claude"
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

    const convergenceAssimilationRunResultResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runs/${encodeURIComponent(queueConvergenceAssimilationRunJson.run.id)}/result`, {
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

    const convergenceAssimilationResultCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-results/${encodeURIComponent(convergenceAssimilationRunResultJson.result.id)}/checkpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision: "confirmed",
        note: "Fixture checkpoint accepted."
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

    const createConvergenceAssimilationSessionPacketSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-session-packet-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Codex Session Packet",
        runner: "codex"
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

    const createConvergenceAssimilationRunnerLaunchpadGateSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launchpad-gate-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Codex Launchpad Gate",
        runner: "codex"
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
    assert.match(convergenceAssimilationRunnerLaunchStackStatusJson.markdown, /# Convergence Assimilation Runner Launch Stack Status/);
    assert.match(convergenceAssimilationRunnerLaunchStackStatusJson.secretPolicy, /Non-secret convergence assimilation runner launch stack status only/);

    const launchStackActionTaskStages = convergenceAssimilationRunnerLaunchStackStatusJson.stages.filter((stage) => stage.status !== "ready");
    assert.ok(launchStackActionTaskStages.length >= 1);
    const createConvergenceAssimilationRunnerLaunchStackActionTasksResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "claude",
        stages: [launchStackActionTaskStages[0]]
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
        stages: [launchStackActionTaskStages[0]]
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

    const createConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "claude",
        status: "open",
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
        stages: [launchStackActionTaskStages[0]]
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

    const convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-task-ledger-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "all",
        status: "open",
        field: "total",
        decision: "escalated",
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

    const createConvergenceAssimilationRunnerLaunchStackRemediationPackSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-remediation-pack-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "claude",
        title: "Fixture Claude Launch Stack Remediation Pack"
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

    const refreshConvergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-stack-action-task-ledger-snapshots/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "all",
        status: "open",
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
      body: JSON.stringify({ status: "resolved" })
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

    const createConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-execution-packet-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "claude",
        title: "Fixture Claude Launch Execution Packet"
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

    const createConvergenceAssimilationRunnerLaunchControlBoardSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-control-board-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runner: "codex",
        title: "Fixture Codex Launch Control Board"
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

    const createConvergenceAssimilationRunnerLaunchAuthorizationPackSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-authorization-pack-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Codex Launch Authorization Pack",
        runner: "codex"
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
        validationSummary: "Drift fixture validation."
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

    const convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-execution-packet-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "claude",
        field: launchExecutionPacketCheckpointField,
        decision: "confirmed",
        note: "Fixture launch execution packet drift accepted."
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

    const refreshConvergenceAssimilationRunnerLaunchExecutionPacketSnapshotResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-execution-packet-snapshots/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "claude",
        title: "Fixture Refreshed Claude Launch Execution Packet"
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

    const convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-control-board-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "codex",
        field: launchControlBoardCheckpointField,
        decision: "confirmed",
        note: "Fixture launch control board drift accepted."
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

    const convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launch-authorization-pack-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "codex",
        field: launchAuthorizationPackCheckpointField,
        decision: "confirmed",
        note: "Fixture launch authorization pack drift accepted."
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

    const convergenceAssimilationRunnerLaunchpadGateDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-runner-launchpad-gate-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "codex",
        field: "decision",
        decision: "confirmed",
        note: "Fixture launchpad gate drift accepted."
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

    const convergenceAssimilationSessionPacketDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/assimilation-session-packet-snapshot-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        runner: "codex",
        field: "resultCount",
        decision: "confirmed",
        note: "Fixture packet drift accepted."
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
        pairIds: [operatorProposalJson.review.pairId]
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

    const createConvergenceTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/convergence/task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fixture Convergence Review Task Ledger",
        status: "all",
        limit: 10
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
    assert.equal(governanceAfterConvergenceTasksJson.summary.convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotCount, 2);
    assert.equal(governanceAfterConvergenceTasksJson.convergenceTasks[0].convergencePairId, operatorProposalJson.review.pairId);
    assert.equal(governanceAfterConvergenceTasksJson.convergenceTaskLedgerSnapshots[0].title, "Fixture Convergence Review Task Ledger");
    assert.equal(governanceAfterConvergenceTasksJson.convergenceAssimilationSessionPacketSnapshots[0].title, "Fixture Codex Session Packet");
    assert.equal(governanceAfterConvergenceTasksJson.convergenceAssimilationRunnerLaunchpadGateSnapshots[0].title, "Fixture Codex Launchpad Gate");
    assert.equal(governanceAfterConvergenceTasksJson.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshots[0].title, "Fixture Codex Launch Authorization Pack");
    assert.equal(governanceAfterConvergenceTasksJson.convergenceAssimilationRunnerLaunchControlBoardSnapshots[0].title, "Fixture Codex Launch Control Board");
    assert.equal(governanceAfterConvergenceTasksJson.convergenceAssimilationRunnerLaunchExecutionPacketSnapshots[0].title, "Fixture Refreshed Claude Launch Execution Packet");
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

    const updateConvergenceTaskForDriftResponse = await fetch(`${baseUrl}/api/tasks/${convergenceTaskJson.createdTasks[0].id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "blocked", priority: "high" })
    });
    assert.equal(updateConvergenceTaskForDriftResponse.status, 200);

    const convergenceTaskLedgerDriftAfterUpdateResponse = await fetch(`${baseUrl}/api/convergence/task-ledger-snapshots/diff?snapshotId=latest`);
    assert.equal(convergenceTaskLedgerDriftAfterUpdateResponse.status, 200);
    const convergenceTaskLedgerDriftAfterUpdateJson = await convergenceTaskLedgerDriftAfterUpdateResponse.json();
    assert.equal(convergenceTaskLedgerDriftAfterUpdateJson.hasDrift, true);
    const convergenceTaskDriftItem = convergenceTaskLedgerDriftAfterUpdateJson.driftItems.find((item) => String(item.field || "").startsWith("convergence-task:"));
    assert.ok(convergenceTaskDriftItem);

    const createConvergenceTaskLedgerDriftCheckpointResponse = await fetch(`${baseUrl}/api/convergence/task-ledger-drift-checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: "latest",
        field: convergenceTaskDriftItem.field,
        decision: "deferred"
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
        decision: "escalated"
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

  try {
    const releaseBuildGateResponse = await fetch(`${baseUrl}/api/releases/build-gate`);
    assert.equal(releaseBuildGateResponse.status, 200);
    const releaseBuildGateJson = await releaseBuildGateResponse.json();
    assert.equal(releaseBuildGateJson.decision, "review");
    const openActions = releaseBuildGateJson.actions.filter((action) => action.status !== "ready");
    assert.ok(openActions.length >= 1);

    const seedResponse = await fetch(`${baseUrl}/api/releases/build-gate/actions/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actions: [openActions[0]] })
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

    const createReleaseTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/releases/task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Release Control Task Ledger", status: "all", limit: 5 })
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
        snapshotLimit: 5
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

    const controlPlaneReason = decisionJson.reasons.find((reason) => reason.code === "release-control-open-tasks") || decisionJson.reasons[0];
    const seedDecisionTaskResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reasons: [controlPlaneReason] })
    });
    assert.equal(seedDecisionTaskResponse.status, 200);
    const seedDecisionTaskJson = await seedDecisionTaskResponse.json();
    assert.equal(seedDecisionTaskJson.success, true);
    assert.equal(seedDecisionTaskJson.totals.requested, 1);
    assert.equal(seedDecisionTaskJson.totals.created, 1);
    assert.equal(seedDecisionTaskJson.totals.skipped, 0);
    assert.equal(seedDecisionTaskJson.createdTasks[0].projectId, "agent-control-plane");
    assert.equal(seedDecisionTaskJson.createdTasks[0].agentControlPlaneDecisionReasonCode, controlPlaneReason.code);
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

    const createDecisionTaskLedgerSnapshotResponse = await fetch(`${baseUrl}/api/agent-control-plane/decision/task-ledger-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixture Control Plane Decision Task Ledger", status: "open", limit: 5 })
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
        snapshotLimit: 5
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
      body: JSON.stringify({ status: "resolved" })
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
      body: JSON.stringify({ status: "open" })
    });
    assert.equal(reopenDecisionTaskResponse.status, 200);
    const reopenDecisionTaskJson = await reopenDecisionTaskResponse.json();
    assert.equal(reopenDecisionTaskJson.task.status, "open");

    const blockDecisionTaskResponse = await fetch(`${baseUrl}/api/tasks/${seedDecisionTaskJson.createdTasks[0].id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "blocked" })
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

    const taskSeedingCheckpointResponse = await fetch(`${baseUrl}/api/governance/task-seeding-checkpoints`, {
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
        note: "Fixture non-secret source workflow task seeding checkpoint."
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
        note: "Fixture non-secret source review item checkpoint before task creation."
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
        note: "Fixture unresolved source evidence coverage checkpoint before task creation."
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
        note: "fixture-source-card-checkpoint unresolved source card checkpoint drilldown."
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

  try {
    const coverageResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence-coverage`);
    assert.equal(coverageResponse.status, 200);
    const coverageJson = await coverageResponse.json();
    assert.equal(coverageJson.items.length, 1);
    assert.equal(coverageJson.items[0].coverageStatus, "missing");

    const seedResponse = await fetch(`${baseUrl}/api/sources/access-validation-evidence-coverage/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [coverageJson.items[0]] })
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
        evidence: "Operator confirmed read-only local folder access before syncing the evidence coverage task."
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

  try {
    const workflowResponse = await fetch(`${baseUrl}/api/sources/access-validation-workflow`);
    assert.equal(workflowResponse.status, 200);
    const workflowJson = await workflowResponse.json();
    assert.equal(workflowJson.summary.total, 1);
    assert.equal(workflowJson.summary.pending, 1);
    assert.equal(workflowJson.items[0].stage, "record-validation-evidence");

    const seedResponse = await fetch(`${baseUrl}/api/sources/access-validation-workflow/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [workflowJson.items[0]],
        saveSnapshot: true,
        snapshotTitle: "Fixture Workflow Task Ledger Auto Capture",
        snapshotStatus: "open",
        snapshotLimit: 5
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
      body: JSON.stringify({ items: [workflowJson.items[0]] })
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
        evidence: "Operator confirmed read-only local folder access before syncing the workflow task."
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
