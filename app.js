// @ts-check

import { dashboardApi } from "./ui/dashboard-api.js";
import { createDashboardActionRegistry } from "./ui/dashboard-actions.js";
import { createDashboardCommandPalette } from "./ui/dashboard-command-palette.js";
import { createDashboardModal } from "./ui/dashboard-modal.js";
import { createDashboardSettingsModal } from "./ui/dashboard-settings.js";
import { createSourceSetupModal } from "./ui/dashboard-source-setup.js";
import { createDashboardViews } from "./ui/dashboard-views.js";
import { escapeHtml } from "./ui/dashboard-utils.js";

/**
 * @typedef {import("./ui/dashboard-types.js").AuditPayload} AuditPayload
 * @typedef {import("./ui/dashboard-types.js").DashboardState} DashboardState
 * @typedef {import("./ui/dashboard-types.js").DashboardRuntimeState} DashboardRuntimeState
 */

/** @type {AuditPayload} */
let data = { projects: [], meta: { zoneOptions: [], categoryOptions: [] }, summary: {} };

/** @type {DashboardState} */
const state = {
  search: "",
  zone: "all",
  category: "all",
  sortKey: "qualityScore",
  sortDir: "desc",
  showArchived: false,
  view: "grid"
};

/** @type {DashboardRuntimeState} */
const runtime = {
  inventorySource: "embedded",
  panels: {
    findings: { status: "idle" },
    trends: { status: "idle" },
    sources: { status: "idle" },
    governance: { status: "idle" }
  }
};

const ACTIVE_PROJECT_STORAGE_KEY = "workspace-audit-active-project";
const SCOPE_MODE_STORAGE_KEY = "workspace-audit-scope-mode";
const SCOPE_GUARDED_CONTROL_IDS = [
  "execute-governance-queue-btn",
  "start-queued-agent-work-order-runs-btn",
  "block-stale-agent-work-order-runs-btn",
  "action-sla-breach-agent-work-order-runs-btn",
  "resolve-sla-breach-agent-work-order-runs-btn",
  "retry-terminal-agent-work-order-runs-btn",
  "archive-completed-agent-work-order-runs-btn",
  "apply-agent-execution-retention-btn"
];

/**
 * @param {string} key
 */
function readLocalStorage(key) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

/**
 * @param {string} key
 * @param {string} value
 */
function writeLocalStorage(key, value) {
  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable in hardened browser contexts.
  }
}

/**
 * @param {unknown} value
 * @returns {"project" | "portfolio"}
 */
function normalizeScopeMode(value) {
  return value === "portfolio" ? "portfolio" : "project";
}

state.activeProjectId = readLocalStorage(ACTIVE_PROJECT_STORAGE_KEY);
state.scopeMode = normalizeScopeMode(readLocalStorage(SCOPE_MODE_STORAGE_KEY));

const modal = createDashboardModal({
  getData: () => data,
  api: dashboardApi
});

const views = createDashboardViews({
  getData: () => data,
  getState: () => state,
  getRuntime: () => runtime,
  api: dashboardApi,
  openModal: modal.openModal
});

function syncViewButtons() {
  document.querySelectorAll(".view-btn").forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    button.classList.toggle("active", button.dataset.view === state.view);
  });
}

function getActiveProject() {
  return (data.projects || []).find((project) => project.id === state.activeProjectId) || null;
}

function hasActiveExecutionScope() {
  return state.scopeMode === "portfolio" || Boolean(getActiveProject());
}

function getExecutionScopeOptions() {
  return {
    activeProjectId: state.activeProjectId || "",
    scopeMode: state.scopeMode === "portfolio" ? "portfolio" : "project"
  };
}

function persistScopeState() {
  writeLocalStorage(ACTIVE_PROJECT_STORAGE_KEY, state.activeProjectId || "");
  writeLocalStorage(SCOPE_MODE_STORAGE_KEY, state.scopeMode || "project");
}

function syncActiveProjectValidity() {
  if (!state.activeProjectId || !(data.projects || []).length) return;
  if (!getActiveProject()) {
    state.activeProjectId = "";
    state.scopeMode = "project";
    persistScopeState();
  }
}

function renderScopeLock() {
  syncActiveProjectValidity();
  const select = /** @type {HTMLSelectElement | null} */ (document.getElementById("active-project-select"));
  const badge = /** @type {HTMLButtonElement | null} */ (document.getElementById("scope-mode-toggle"));
  const clearButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("clear-active-project-btn"));
  const warning = /** @type {HTMLDivElement | null} */ (document.getElementById("scope-guard-warning"));
  if (!select || !badge || !clearButton) return;

  const activeProject = getActiveProject();
  const sortedProjects = [...(data.projects || [])].sort((left, right) => {
    const leftActive = left.zone === "active" ? 0 : 1;
    const rightActive = right.zone === "active" ? 0 : 1;
    return leftActive - rightActive || left.name.localeCompare(right.name);
  });
  const options = [
    new Option("No active project selected", ""),
    ...sortedProjects.map((project) => new Option(`${project.name} - ${project.category}`, project.id))
  ];
  select.replaceChildren(...options);
  select.value = activeProject?.id || "";

  badge.classList.toggle("portfolio", state.scopeMode === "portfolio");
  badge.classList.toggle("unscoped", state.scopeMode !== "portfolio" && !activeProject);
  badge.textContent = state.scopeMode === "portfolio" ? "PORTFOLIO MODE" : activeProject ? "SCOPED" : "NO PROJECT";
  badge.title = state.scopeMode === "portfolio"
    ? "Portfolio mode allows AI and CLI planning across all visible projects. Click to return to project scope."
    : activeProject
      ? `Scoped to ${activeProject.name}. Click to enter portfolio mode.`
      : "No active project is selected. Choose a project before project-scoped AI work.";
  clearButton.disabled = !activeProject && state.scopeMode !== "portfolio";
  if (warning) {
    const hasScope = hasActiveExecutionScope();
    warning.hidden = hasScope;
    warning.textContent = hasScope
      ? ""
      : "Guarded build, agent, governance, data-source, and mutation actions are locked until you select an active project or enter portfolio mode.";
  }
  syncScopeGuardedControls();
}

function renderScopeState() {
  renderScopeLock();
  views.renderRuntimeStatus();
}

function syncScopeGuardedControls() {
  const hasScope = hasActiveExecutionScope();
  for (const id of SCOPE_GUARDED_CONTROL_IDS) {
    const element = /** @type {HTMLButtonElement | null} */ (document.getElementById(id));
    if (!element) continue;
    element.disabled = !hasScope;
    element.title = hasScope
      ? ""
      : "Select an active project or explicitly enter portfolio mode before running execution controls.";
  }
}

/**
 * @param {string} projectId
 * @param {string} [source]
 */
function setActiveProject(projectId, source = "manual") {
  const project = (data.projects || []).find((item) => item.id === projectId);
  if (!project) return false;
  state.activeProjectId = project.id;
  state.scopeMode = "project";
  persistScopeState();
  console.info(`[SCOPE] Active project -> ${project.id} (source: ${source})`);
  renderScopeState();
  return true;
}

function clearActiveProject() {
  state.activeProjectId = "";
  state.scopeMode = "project";
  persistScopeState();
  console.info("[SCOPE] Active project cleared");
  renderScopeState();
}

/**
 * @param {boolean} [showWarning]
 */
function enterPortfolioMode(showWarning = false) {
  state.scopeMode = "portfolio";
  persistScopeState();
  console.warn("[SCOPE] Portfolio mode enabled");
  renderScopeState();
  if (showWarning) {
    window.alert("Portfolio mode enabled. AI and CLI planning can now operate across all visible projects until you return to project scope.");
  }
}

function exitPortfolioMode() {
  state.scopeMode = "project";
  persistScopeState();
  console.info("[SCOPE] Project scope mode enabled");
  renderScopeState();
}

function requireActiveProject() {
  if (hasActiveExecutionScope()) return true;
  window.alert("Select an active project first, or explicitly enter portfolio mode.");
  return false;
}

/**
 * @param {DashboardState["view"]} view
 */
function setView(view) {
  state.view = view;
  syncViewButtons();
  views.renderApps();
}

/**
 * @param {boolean} showArchived
 */
function setArchivedVisibility(showArchived) {
  state.showArchived = showArchived;
  const checkbox = /** @type {HTMLInputElement} */ (document.getElementById("show-archived"));
  checkbox.checked = showArchived;
  views.renderApps();
}

function focusSearch() {
  const searchInput = /** @type {HTMLInputElement} */ (document.getElementById("search"));
  searchInput.focus();
  searchInput.select();
}

async function loadInventory() {
  const result = await dashboardApi.fetchInventoryWithSource();
  data = result.payload;
  runtime.inventorySource = result.source;
  runtime.lastLoadedAt = new Date().toISOString();
  runtime.snapshotGeneratedAt = result.payload.generatedAt;
  runtime.loadError = "";
}

async function refreshInventory() {
  await loadInventory();
  views.renderDashboard();
  renderScopeLock();
}

async function runAuditRefresh() {
  await dashboardApi.runAudit();
  await refreshInventory();
}

async function refreshTrendsView() {
  setView("trends");
  await views.renderTrends();
}

async function refreshFindingsView() {
  setView("findings");
  await views.renderFindings();
}

async function refreshSourcesView() {
  setView("sources");
  await views.renderSources();
}

async function copySourcesSummary() {
  setView("sources");
  await views.renderSources();
  return views.copySourcesSummary();
}

async function copySourcesAccessRequirements() {
  setView("sources");
  await views.renderSources();
  return views.copySourcesAccessRequirements();
}

async function copySourcesAccessMethodRegistry() {
  setView("sources");
  await views.renderSources();
  return views.copySourcesAccessMethodRegistry();
}

async function copySourcesAccessValidationWorkflow() {
  setView("sources");
  await views.renderSources();
  return views.copySourcesAccessValidationWorkflow();
}

async function saveSourcesAccessValidationWorkflowSnapshot() {
  setView("sources");
  return views.saveSourcesAccessValidationWorkflowSnapshot();
}

async function copyLatestSourcesAccessValidationWorkflowSnapshotDrift() {
  setView("sources");
  return views.copyLatestSourcesAccessValidationWorkflowSnapshotDrift();
}

async function seedSourcesAccessValidationWorkflowTasks() {
  setView("sources");
  return views.seedSourcesAccessValidationWorkflowTasks();
}

async function checkpointSourcesAccessValidationWorkflowTasks(status) {
  setView("sources");
  await views.renderSources();
  return views.checkpointSourcesAccessValidationWorkflowTasks(status);
}

async function copySourcesAccessChecklist() {
  setView("sources");
  await views.renderSources();
  return views.copySourcesAccessChecklist();
}

async function copySourcesAccessValidationRunbook() {
  setView("sources");
  await views.renderSources();
  return views.copySourcesAccessValidationRunbook();
}

async function copySourcesAccessValidationEvidence() {
  setView("sources");
  await views.renderSources();
  return views.copySourcesAccessValidationEvidence();
}

async function copySourcesAccessValidationEvidenceCoverage() {
  setView("sources");
  await views.renderSources();
  return views.copySourcesAccessValidationEvidenceCoverage();
}

async function copySourcesDeploymentHealth() {
  setView("sources");
  await views.renderSources();
  return views.copySourcesDeploymentHealth();
}

async function copySourcesDeploymentSmokeChecks() {
  setView("sources");
  await views.renderSources();
  return views.copySourcesDeploymentSmokeChecks();
}

async function copyGovernanceDataSourcesAccessValidationEvidence() {
  setView("governance");
  await views.renderGovernance();
  return views.copySourcesAccessValidationEvidence();
}

async function copyGovernanceDataSourcesAccessValidationWorkflow() {
  setView("governance");
  await views.renderGovernance();
  return views.copySourcesAccessValidationWorkflow();
}

async function saveGovernanceDataSourcesAccessValidationWorkflowSnapshot() {
  setView("governance");
  await views.renderGovernance();
  return views.saveSourcesAccessValidationWorkflowSnapshot({ renderTarget: "governance" });
}

async function copyGovernanceDataSourcesAccessValidationWorkflowSnapshotDrift() {
  setView("governance");
  await views.renderGovernance();
  return views.copyLatestSourcesAccessValidationWorkflowSnapshotDrift();
}

async function seedGovernanceDataSourcesAccessValidationWorkflowTasks() {
  setView("governance");
  await views.renderGovernance();
  return views.seedSourcesAccessValidationWorkflowTasks({ renderTarget: "governance" });
}

async function checkpointGovernanceDataSourcesAccessValidationWorkflowTasks(status) {
  setView("governance");
  await views.renderGovernance();
  return views.checkpointSourcesAccessValidationWorkflowTasks(status, { renderTarget: "governance" });
}

async function copySourcesAccessMatrix() {
  setView("sources");
  await views.renderSources();
  return views.copySourcesAccessMatrix();
}

async function copySourcesAccessReviewQueue() {
  setView("sources");
  await views.renderSources();
  return views.copySourcesAccessReviewQueue();
}

async function copySourcesAccessGate() {
  setView("sources");
  await views.renderSources();
  return views.copySourcesAccessGate();
}

async function saveSourcesSummarySnapshot() {
  setView("sources");
  return views.saveSourcesSummarySnapshot();
}

async function copyLatestSourcesSummarySnapshotDrift() {
  setView("sources");
  return views.copyLatestSourcesSummarySnapshotDrift();
}

async function refreshGovernanceView() {
  setView("governance");
  await views.renderGovernance();
}

async function copyGovernanceSummary() {
  setView("governance");
  await views.renderGovernance();
  await views.copyGovernanceSummary();
}

async function copyGovernanceTaskUpdateLedger() {
  setView("governance");
  await views.renderGovernance();
  return views.copyGovernanceTaskUpdateLedger();
}

async function saveGovernanceTaskUpdateLedgerSnapshot() {
  setView("governance");
  await views.renderGovernance();
  return views.saveGovernanceTaskUpdateLedgerSnapshot();
}

async function copyLatestGovernanceTaskUpdateLedgerSnapshotDrift() {
  setView("governance");
  await views.renderGovernance();
  return views.copyLatestGovernanceTaskUpdateLedgerSnapshotDrift();
}

async function copyGovernanceDataSourcesAccessReviewQueue() {
  setView("governance");
  await views.renderGovernance();
  return views.copyGovernanceDataSourcesAccessReviewQueue();
}

async function copyGovernanceDataSourcesAccessGate() {
  setView("governance");
  await views.renderGovernance();
  return views.copyGovernanceDataSourcesAccessGate();
}

async function seedGovernanceDataSourcesAccessReviewTasks() {
  setView("governance");
  await views.renderGovernance();
  return views.seedGovernanceDataSourcesAccessReviewTasks();
}

async function checkpointGovernanceDataSourcesAccessReviewTasks(status) {
  setView("governance");
  await views.renderGovernance();
  return views.checkpointGovernanceDataSourcesAccessReviewTasks(status);
}

async function seedGovernanceDataSourcesAccessValidationEvidenceCoverageTasks() {
  setView("governance");
  await views.renderGovernance();
  return views.seedGovernanceDataSourcesAccessValidationEvidenceCoverageTasks();
}

async function checkpointGovernanceDataSourcesAccessValidationEvidenceCoverageTasks(status) {
  setView("governance");
  await views.renderGovernance();
  return views.checkpointGovernanceDataSourcesAccessValidationEvidenceCoverageTasks(status);
}

async function copyGovernanceDataSourcesAccessTaskLedger() {
  setView("governance");
  await views.renderGovernance();
  return views.copyGovernanceDataSourcesAccessTaskLedger();
}

async function copyAgentWorkOrders() {
  setView("governance");
  await views.renderGovernance();
  await views.copyAgentWorkOrders();
}

async function copyAgentExecutionBriefs() {
  setView("governance");
  await views.renderGovernance();
  await views.copyAgentExecutionBriefs();
}

async function copyAgentControlPlane() {
  setView("governance");
  await views.renderGovernance();
  await views.copyAgentControlPlane();
}

async function copyReleaseControl() {
  setView("governance");
  await views.renderGovernance();
  return views.copyReleaseControl();
}

async function copyReleaseCheckpointDrift() {
  setView("governance");
  await views.renderGovernance();
  return views.copyReleaseCheckpointDrift();
}

async function copyReleaseBuildGate() {
  setView("governance");
  await views.renderGovernance();
  return views.copyReleaseBuildGate();
}

async function copyGovernanceReleaseTaskLedger() {
  setView("governance");
  await views.renderGovernance();
  return views.copyGovernanceReleaseTaskLedger();
}

async function saveReleaseTaskLedgerSnapshot() {
  setView("governance");
  await views.renderGovernance();
  return views.saveReleaseTaskLedgerSnapshot();
}

async function copyLatestReleaseTaskLedgerSnapshotDrift() {
  setView("governance");
  await views.renderGovernance();
  return views.copyLatestReleaseTaskLedgerSnapshotDrift();
}

async function bootstrapReleaseBuildGateLocalEvidence() {
  setView("governance");
  await views.renderGovernance();
  return views.bootstrapReleaseBuildGateLocalEvidence();
}

async function seedReleaseBuildGateActionTasks() {
  setView("governance");
  await views.renderGovernance();
  return views.seedReleaseBuildGateActionTasks();
}

async function seedReleaseBuildGateActionTasksWithSnapshot() {
  setView("governance");
  await views.renderGovernance();
  return views.seedReleaseBuildGateActionTasksWithSnapshot();
}

async function saveReleaseCheckpoint() {
  setView("governance");
  await views.renderGovernance();
  return views.saveReleaseCheckpoint();
}

async function copyLatestAgentControlPlaneSnapshotDrift() {
  setView("governance");
  await views.renderGovernance();
  return views.copyLatestAgentControlPlaneSnapshotDrift();
}

async function copyBaselineAgentControlPlaneSnapshotDrift() {
  setView("governance");
  await views.renderGovernance();
  return views.copyBaselineAgentControlPlaneSnapshotDrift();
}

async function copyAgentControlPlaneBaselineStatus() {
  setView("governance");
  await views.renderGovernance();
  await views.copyAgentControlPlaneBaselineStatus();
}

async function copyAgentControlPlaneDecision() {
  setView("governance");
  await views.renderGovernance();
  return views.copyAgentControlPlaneDecision();
}

async function copyAgentControlPlaneDecisionTaskLedger() {
  setView("governance");
  await views.renderGovernance();
  return views.copyAgentControlPlaneDecisionTaskLedger();
}

async function saveAgentControlPlaneDecisionTaskLedgerSnapshot() {
  setView("governance");
  await views.renderGovernance();
  return views.saveAgentControlPlaneDecisionTaskLedgerSnapshot();
}

async function copyLatestAgentControlPlaneDecisionTaskLedgerSnapshotDrift() {
  setView("governance");
  await views.renderGovernance();
  return views.copyLatestAgentControlPlaneDecisionTaskLedgerSnapshotDrift();
}

async function copyAgentExecutionResultTaskLedger() {
  setView("governance");
  await views.renderGovernance();
  return views.copyAgentExecutionResultTaskLedger();
}

async function saveAgentExecutionResultTaskLedgerSnapshot() {
  setView("governance");
  await views.renderGovernance();
  return views.saveAgentExecutionResultTaskLedgerSnapshot();
}

async function copyLatestAgentExecutionResultTaskLedgerSnapshotDrift() {
  setView("governance");
  await views.renderGovernance();
  return views.copyLatestAgentExecutionResultTaskLedgerSnapshotDrift();
}

async function seedAgentControlPlaneDecisionTasks() {
  setView("governance");
  await views.renderGovernance();
  return views.seedAgentControlPlaneDecisionTasks();
}

async function seedAgentControlPlaneDecisionTasksWithSnapshot() {
  setView("governance");
  await views.renderGovernance();
  return views.seedAgentControlPlaneDecisionTasksWithSnapshot();
}

async function clearAgentControlPlaneBaselineSnapshot() {
  setView("governance");
  await views.renderGovernance();
  await views.clearAgentControlPlaneBaselineSnapshot();
}

async function refreshAgentControlPlaneBaselineSnapshot() {
  setView("governance");
  await views.renderGovernance();
  await views.refreshAgentControlPlaneBaselineSnapshot();
}

async function copySlaBreachLedger() {
  setView("governance");
  await views.renderGovernance();
  await views.copySlaBreachLedger();
}

async function copyAgentExecutionTargetBaselineAuditLedger() {
  setView("governance");
  await views.renderGovernance();
  await views.copyAgentExecutionTargetBaselineAuditLedger();
}

async function copyAgentExecutionRegressionAlertBaselineLedger() {
  setView("governance");
  await views.renderGovernance();
  await views.copyAgentExecutionRegressionAlertBaselineLedger();
}

async function saveAgentExecutionRegressionAlertBaselineLedgerSnapshot() {
  setView("governance");
  await views.renderGovernance();
  await views.saveAgentExecutionRegressionAlertBaselineLedgerSnapshot();
}

async function refreshAgentExecutionRegressionAlertBaselineLedgerSnapshot() {
  setView("governance");
  await views.renderGovernance();
  await views.refreshAgentExecutionRegressionAlertBaselineLedgerSnapshot();
}

async function copyLatestAgentExecutionRegressionAlertBaselineLedgerSnapshotDrift() {
  setView("governance");
  await views.renderGovernance();
  await views.copyLatestAgentExecutionRegressionAlertBaselineLedgerSnapshotDrift();
}

async function createLatestAgentExecutionRegressionAlertBaselineLedgerSnapshotDriftTask() {
  setView("governance");
  await views.renderGovernance();
  await views.createLatestAgentExecutionRegressionAlertBaselineLedgerSnapshotDriftTask();
}

async function checkpointLatestAgentExecutionRegressionAlertBaselineLedgerSnapshotDrift() {
  setView("governance");
  await views.renderGovernance();
  await views.checkpointLatestAgentExecutionRegressionAlertBaselineLedgerSnapshotDrift();
}

async function copyAgentExecutionRegressionAlertBaselineLedgerBaselineStatus() {
  setView("governance");
  await views.renderGovernance();
  await views.copyAgentExecutionRegressionAlertBaselineLedgerBaselineStatus();
}

async function copyAgentExecutionTargetBaselineAuditLedgerBaselineStatus() {
  setView("governance");
  await views.renderGovernance();
  await views.copyAgentExecutionTargetBaselineAuditLedgerBaselineStatus();
}

async function copyLatestAgentExecutionTargetBaselineAuditLedgerSnapshotDrift() {
  setView("governance");
  await views.renderGovernance();
  await views.copyLatestAgentExecutionTargetBaselineAuditLedgerSnapshotDrift();
}

async function createLatestAgentExecutionTargetBaselineAuditLedgerSnapshotDriftTask() {
  setView("governance");
  await views.renderGovernance();
  await views.createLatestAgentExecutionTargetBaselineAuditLedgerSnapshotDriftTask();
}

async function saveAgentWorkOrderSnapshot() {
  setView("governance");
  await views.renderGovernance();
  await views.saveAgentWorkOrderSnapshot();
}

async function saveAgentControlPlaneSnapshot() {
  setView("governance");
  await views.renderGovernance();
  await views.saveAgentControlPlaneSnapshot();
}

async function saveAgentControlPlaneDecisionSnapshot() {
  setView("governance");
  await views.renderGovernance();
  await views.saveAgentControlPlaneDecisionSnapshot();
}

async function saveAgentControlPlaneBaselineSnapshot() {
  setView("governance");
  await views.renderGovernance();
  await views.saveAgentControlPlaneBaselineSnapshot();
}

async function saveSlaLedgerSnapshot() {
  setView("governance");
  await views.renderGovernance();
  await views.saveSlaLedgerSnapshot();
}

async function saveAgentExecutionTargetBaselineAuditLedgerSnapshot() {
  setView("governance");
  await views.renderGovernance();
  await views.saveAgentExecutionTargetBaselineAuditLedgerSnapshot();
}

async function refreshAgentExecutionTargetBaselineAuditLedgerSnapshot() {
  setView("governance");
  await views.renderGovernance();
  await views.refreshAgentExecutionTargetBaselineAuditLedgerSnapshot();
}

async function checkpointLatestAgentExecutionTargetBaselineAuditLedgerSnapshotDrift() {
  setView("governance");
  await views.renderGovernance();
  await views.checkpointLatestAgentExecutionTargetBaselineAuditLedgerSnapshotDrift();
}

async function saveDataSourcesAccessTaskLedgerSnapshot() {
  setView("governance");
  await views.renderGovernance();
  await views.saveDataSourcesAccessTaskLedgerSnapshot();
}

async function saveDataSourcesAccessValidationEvidenceSnapshot() {
  setView("governance");
  await views.renderGovernance();
  await views.saveDataSourcesAccessValidationEvidenceSnapshot();
}

async function copyLatestDataSourcesAccessTaskLedgerSnapshotDrift() {
  setView("governance");
  await views.renderGovernance();
  return views.copyLatestDataSourcesAccessTaskLedgerSnapshotDrift();
}

async function copyLatestDataSourcesAccessValidationEvidenceSnapshotDrift() {
  setView("governance");
  await views.renderGovernance();
  return views.copyLatestDataSourcesAccessValidationEvidenceSnapshotDrift();
}

async function exportGovernanceReport() {
  setView("governance");
  await views.renderGovernance();
  views.exportGovernanceReport();
}

async function seedGovernanceProfiles() {
  setView("governance");
  await views.renderGovernance();
  await views.bootstrapGovernance("profiles");
}

async function seedGovernanceStarterPacks() {
  setView("governance");
  await views.renderGovernance();
  await views.bootstrapGovernance("starter-pack");
}

async function refreshGovernanceProfileTargets() {
  setView("governance");
  await views.renderGovernance();
  await views.refreshGovernanceProfileTargets();
}

async function seedGovernanceProfileTargetTasks() {
  setView("governance");
  await views.renderGovernance();
  await views.seedGovernanceProfileTargetTasks();
}

async function copyGovernanceProfileTargetTaskLedger() {
  setView("governance");
  await views.renderGovernance();
  return views.copyGovernanceProfileTargetTaskLedger();
}

async function saveGovernanceProfileTargetTaskLedgerSnapshot() {
  setView("governance");
  await views.renderGovernance();
  return views.saveGovernanceProfileTargetTaskLedgerSnapshot();
}

async function copyLatestGovernanceProfileTargetTaskLedgerSnapshotDrift() {
  setView("governance");
  await views.renderGovernance();
  return views.copyLatestGovernanceProfileTargetTaskLedgerSnapshotDrift();
}

async function refreshGovernanceProfileTargetTaskLedgerSnapshot() {
  setView("governance");
  await views.renderGovernance();
  return views.refreshGovernanceProfileTargetTaskLedgerSnapshot();
}

async function copyGovernanceProfileTargetTaskLedgerBaselineStatus() {
  setView("governance");
  await views.renderGovernance();
  return views.copyGovernanceProfileTargetTaskLedgerBaselineStatus();
}

async function executeGovernanceQueue() {
  if (!requireActiveProject()) return;
  setView("governance");
  await views.renderGovernance();
  await views.executeVisibleGovernanceQueue();
}

async function suppressGovernanceQueue() {
  setView("governance");
  await views.renderGovernance();
  await views.suppressVisibleGovernanceQueue();
}

async function startQueuedAgentWorkOrderRuns() {
  if (!requireActiveProject()) return;
  setView("governance");
  await views.renderGovernance();
  await views.startVisibleQueuedAgentWorkOrderRuns();
}

async function refreshTargetBaselineAgentWorkOrderRuns() {
  if (!requireActiveProject()) return;
  setView("governance");
  await views.renderGovernance();
  await views.refreshVisibleTargetBaselineAgentWorkOrderRuns();
}

async function refreshTargetBaselineAuditAgentWorkOrderRuns() {
  if (!requireActiveProject()) return;
  setView("governance");
  await views.renderGovernance();
  await views.refreshVisibleTargetBaselineAuditAgentWorkOrderRuns();
}

async function refreshRegressionAlertBaselineAgentWorkOrderRuns() {
  if (!requireActiveProject()) return;
  setView("governance");
  await views.renderGovernance();
  await views.refreshVisibleRegressionAlertBaselineAgentWorkOrderRuns();
}

async function blockStaleAgentWorkOrderRuns() {
  if (!requireActiveProject()) return;
  setView("governance");
  await views.renderGovernance();
  await views.blockVisibleStaleAgentWorkOrderRuns();
}

async function actionSlaBreaches() {
  if (!requireActiveProject()) return;
  setView("governance");
  await views.renderGovernance();
  await views.actionVisibleSlaBreaches();
}

async function resolveSlaBreaches() {
  if (!requireActiveProject()) return;
  setView("governance");
  await views.renderGovernance();
  await views.resolveVisibleSlaBreaches();
}

async function retryTerminalAgentWorkOrderRuns() {
  if (!requireActiveProject()) return;
  setView("governance");
  await views.renderGovernance();
  await views.retryVisibleTerminalAgentWorkOrderRuns();
}

async function archiveCompletedAgentWorkOrderRuns() {
  if (!requireActiveProject()) return;
  setView("governance");
  await views.renderGovernance();
  await views.archiveVisibleCompletedAgentWorkOrderRuns();
}

async function applyAgentExecutionRetention() {
  if (!requireActiveProject()) return;
  setView("governance");
  await views.renderGovernance();
  await views.applyVisibleAgentExecutionRetention();
}

async function saveGovernanceExecutionView() {
  setView("governance");
  await views.renderGovernance();
  await views.saveGovernanceExecutionView();
}

async function saveAgentExecutionPolicy() {
  setView("governance");
  await views.renderGovernance();
  await views.saveAgentExecutionPolicy();
}

const sourceSetupModal = createSourceSetupModal({
  api: dashboardApi,
  getScopeOptions: getExecutionScopeOptions,
  refreshSources: refreshSourcesView,
  setView: (view) => setView(view)
});

const settingsModal = createDashboardSettingsModal({
  api: dashboardApi,
  getData: () => data,
  getRuntime: () => runtime,
  onOpenSourceSetup: () => sourceSetupModal.open(),
  onRunAuditRefresh: runAuditRefresh,
  onRefreshFindings: refreshFindingsView,
  onRefreshSources: refreshSourcesView,
  onRefreshGovernance: refreshGovernanceView,
  onExportCsv: () => views.exportCsv()
});

const actionRegistry = createDashboardActionRegistry({
  getData: () => data,
  getState: () => state,
  handlers: {
    setView,
    runAuditRefresh,
    refreshFindings: refreshFindingsView,
    refreshTrends: refreshTrendsView,
    refreshSources: refreshSourcesView,
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
    saveSourcesSummarySnapshot,
    copyLatestSourcesSummarySnapshotDrift,
    refreshGovernance: refreshGovernanceView,
    openSetupModal: () => sourceSetupModal.open(),
    openSettings: () => settingsModal.open(),
    focusSearch,
    exportCsv: () => views.exportCsv(),
    exportJson: () => views.exportJson(),
    exportMarkdown: () => views.exportMarkdown(),
    exportGovernanceReport,
    copyGovernanceSummary,
    copyGovernanceTaskUpdateLedger,
    saveGovernanceTaskUpdateLedgerSnapshot,
    copyLatestGovernanceTaskUpdateLedgerSnapshotDrift,
    copyGovernanceDataSourcesAccessGate,
    copyGovernanceDataSourcesAccessReviewQueue,
    copyGovernanceDataSourcesAccessValidationEvidence,
    copyGovernanceDataSourcesAccessValidationWorkflow,
    saveGovernanceDataSourcesAccessValidationWorkflowSnapshot,
    copyGovernanceDataSourcesAccessValidationWorkflowSnapshotDrift,
    checkpointGovernanceDataSourcesAccessValidationWorkflowTasks,
    seedGovernanceDataSourcesAccessValidationWorkflowTasks,
    checkpointGovernanceDataSourcesAccessReviewTasks,
    seedGovernanceDataSourcesAccessReviewTasks,
    checkpointGovernanceDataSourcesAccessValidationEvidenceCoverageTasks,
    seedGovernanceDataSourcesAccessValidationEvidenceCoverageTasks,
    copyGovernanceDataSourcesAccessTaskLedger,
    saveDataSourcesAccessTaskLedgerSnapshot,
    copyLatestDataSourcesAccessTaskLedgerSnapshotDrift,
    saveDataSourcesAccessValidationEvidenceSnapshot,
    copyLatestDataSourcesAccessValidationEvidenceSnapshotDrift,
    copyAgentWorkOrders,
    copyAgentExecutionBriefs,
    copyAgentControlPlane,
    copyReleaseControl,
    copyReleaseCheckpointDrift,
    copyReleaseBuildGate,
    copyGovernanceReleaseTaskLedger,
    saveReleaseTaskLedgerSnapshot,
    copyLatestReleaseTaskLedgerSnapshotDrift,
    bootstrapReleaseBuildGateLocalEvidence,
    seedReleaseBuildGateActionTasks,
    seedReleaseBuildGateActionTasksWithSnapshot,
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
    seedAgentControlPlaneDecisionTasks,
    seedAgentControlPlaneDecisionTasksWithSnapshot,
    clearAgentControlPlaneBaselineSnapshot,
    refreshAgentControlPlaneBaselineSnapshot,
    copySlaBreachLedger,
    copyAgentExecutionTargetBaselineAuditLedger,
    copyAgentExecutionRegressionAlertBaselineLedger,
    saveAgentExecutionRegressionAlertBaselineLedgerSnapshot,
    refreshAgentExecutionRegressionAlertBaselineLedgerSnapshot,
    copyLatestAgentExecutionRegressionAlertBaselineLedgerSnapshotDrift,
    createLatestAgentExecutionRegressionAlertBaselineLedgerSnapshotDriftTask,
    checkpointLatestAgentExecutionRegressionAlertBaselineLedgerSnapshotDrift,
    copyAgentExecutionRegressionAlertBaselineLedgerBaselineStatus,
    copyAgentExecutionTargetBaselineAuditLedgerBaselineStatus,
    copyLatestAgentExecutionTargetBaselineAuditLedgerSnapshotDrift,
    createLatestAgentExecutionTargetBaselineAuditLedgerSnapshotDriftTask,
    saveAgentWorkOrderSnapshot,
    saveAgentControlPlaneSnapshot,
    saveAgentControlPlaneDecisionSnapshot,
    saveAgentControlPlaneBaselineSnapshot,
    saveSlaLedgerSnapshot,
    saveAgentExecutionTargetBaselineAuditLedgerSnapshot,
    refreshAgentExecutionTargetBaselineAuditLedgerSnapshot,
    checkpointLatestAgentExecutionTargetBaselineAuditLedgerSnapshotDrift,
    seedGovernanceProfiles,
    seedGovernanceStarterPacks,
    refreshGovernanceProfileTargets,
    seedGovernanceProfileTargetTasks,
    copyGovernanceProfileTargetTaskLedger,
    saveGovernanceProfileTargetTaskLedgerSnapshot,
    copyLatestGovernanceProfileTargetTaskLedgerSnapshotDrift,
    refreshGovernanceProfileTargetTaskLedgerSnapshot,
    copyGovernanceProfileTargetTaskLedgerBaselineStatus,
    executeGovernanceQueue,
    suppressGovernanceQueue,
    startQueuedAgentWorkOrderRuns,
    refreshTargetBaselineAgentWorkOrderRuns,
    refreshTargetBaselineAuditAgentWorkOrderRuns,
    refreshRegressionAlertBaselineAgentWorkOrderRuns,
    blockStaleAgentWorkOrderRuns,
    actionSlaBreaches,
    resolveSlaBreaches,
    retryTerminalAgentWorkOrderRuns,
    archiveCompletedAgentWorkOrderRuns,
    applyAgentExecutionRetention,
    saveGovernanceExecutionView,
    saveAgentExecutionPolicy,
    setArchivedVisibility,
    setActiveProject: (projectId) => setActiveProject(projectId, "command-palette"),
    clearActiveProject,
    enterPortfolioMode: () => enterPortfolioMode(true),
    exitPortfolioMode,
    requireActiveProject,
    openProject: (projectId) => {
      setActiveProject(projectId, "workbench-open");
      modal.openModal(projectId);
    }
  }
});

const commandPalette = createDashboardCommandPalette({
  getActions: () => actionRegistry.getActions()
});

function bindEventListeners() {
  /**
   * @param {HTMLButtonElement} button
   * @param {string} loadingLabel
   * @param {() => Promise<unknown>} action
   */
  function bindAsyncButton(button, loadingLabel, action) {
    const originalText = button.textContent || "";
    button.addEventListener("click", async () => {
      let completionText = "";
      try {
        button.disabled = true;
        button.textContent = loadingLabel;
        const result = await action();
        completionText = typeof result === "string" ? result : "";
      } catch (error) {
        const message = error instanceof Error ? error.message : "Action failed.";
        alert(message);
      } finally {
        button.disabled = false;
        if (completionText) {
          button.textContent = completionText;
          window.setTimeout(() => {
            if (button.textContent === completionText) {
              button.textContent = originalText;
            }
          }, 1600);
        } else {
          button.textContent = originalText;
        }
      }
    });
  }

  document.getElementById("theme-btn").addEventListener("click", () => {
    const html = document.documentElement;
    html.dataset.theme = html.dataset.theme === "dark" ? "light" : "dark";
  });

  document.getElementById("command-palette-btn").addEventListener("click", () => {
    commandPalette.toggle();
  });

  document.getElementById("open-settings-btn").addEventListener("click", () => {
    settingsModal.open();
  });

  document.getElementById("active-project-select").addEventListener("change", (event) => {
    const target = /** @type {HTMLSelectElement} */ (event.target);
    if (target.value) {
      setActiveProject(target.value, "header-select");
      return;
    }
    clearActiveProject();
  });

  document.getElementById("scope-mode-toggle").addEventListener("click", () => {
    if (state.scopeMode === "portfolio") {
      exitPortfolioMode();
      return;
    }
    enterPortfolioMode(true);
  });

  document.getElementById("clear-active-project-btn").addEventListener("click", () => {
    clearActiveProject();
  });

  document.getElementById("open-source-setup-btn").addEventListener("click", () => {
    sourceSetupModal.open();
  });

  document.getElementById("refresh-audit-btn").addEventListener("click", async (event) => {
    const button = /** @type {HTMLButtonElement} */ (event.currentTarget);
    const originalHtml = button.innerHTML;
    try {
      button.disabled = true;
      button.innerHTML = `
        <svg style="width:16px; height:16px; vertical-align:middle; margin-right:4px; animation: spin 2s linear infinite;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
        Auditing...
      `;
      await runAuditRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Audit failed.";
      alert(message);
    } finally {
      button.disabled = false;
      button.innerHTML = originalHtml;
    }
  });

  const style = document.createElement("style");
  style.textContent = "@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
  document.head.appendChild(style);

  document.getElementById("search").addEventListener("input", (event) => {
    const target = /** @type {HTMLInputElement} */ (event.target);
    state.search = target.value;
    views.renderApps();
  });

  document.getElementById("zone-filter").addEventListener("change", (event) => {
    const target = /** @type {HTMLSelectElement} */ (event.target);
    state.zone = target.value;
    views.renderApps();
  });

  document.getElementById("cat-filter").addEventListener("change", (event) => {
    const target = /** @type {HTMLSelectElement} */ (event.target);
    state.category = target.value;
    views.renderApps();
  });

  document.getElementById("show-archived").addEventListener("change", (event) => {
    const target = /** @type {HTMLInputElement} */ (event.target);
    setArchivedVisibility(target.checked);
  });

  document.getElementById("sort-select").addEventListener("change", (event) => {
    const target = /** @type {HTMLSelectElement} */ (event.target);
    const [key = "qualityScore", dir = "desc"] = target.value.split("-");
    state.sortKey = key;
    state.sortDir = dir === "asc" ? "asc" : "desc";
    views.renderApps();
  });

  document.querySelectorAll(".view-btn").forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    button.addEventListener("click", () => {
      setView(/** @type {DashboardState["view"]} */ (button.dataset.view || "grid"));
    });
  });

  document.getElementById("modal-close").addEventListener("click", () => {
    modal.closeModal();
  });

  document.getElementById("app-modal").addEventListener("click", (event) => {
    if (event.target === document.getElementById("app-modal")) {
      modal.closeModal();
    }
  });

  document.getElementById("export-csv").addEventListener("click", () => {
    views.exportCsv();
  });

  document.getElementById("export-json").addEventListener("click", () => {
    views.exportJson();
  });

  document.getElementById("export-markdown").addEventListener("click", () => {
    views.exportMarkdown();
  });

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("refresh-findings-btn")),
    "Refreshing...",
    () => refreshFindingsView()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("refresh-trends-btn")),
    "Refreshing...",
    () => refreshTrendsView()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("refresh-sources-btn")),
    "Refreshing...",
    () => refreshSourcesView()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-sources-summary-btn")),
    "Copying...",
    () => copySourcesSummary()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-sources-access-requirements-btn")),
    "Copying...",
    () => copySourcesAccessRequirements()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-sources-access-method-registry-btn")),
    "Copying...",
    () => copySourcesAccessMethodRegistry()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-sources-access-validation-workflow-btn")),
    "Copying...",
    () => copySourcesAccessValidationWorkflow()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("save-sources-access-validation-workflow-snapshot-btn")),
    "Saving...",
    () => saveSourcesAccessValidationWorkflowSnapshot()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-sources-access-validation-workflow-drift-btn")),
    "Copying...",
    () => copyLatestSourcesAccessValidationWorkflowSnapshotDrift()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("seed-sources-access-validation-workflow-tasks-btn")),
    "Creating...",
    () => seedSourcesAccessValidationWorkflowTasks()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("defer-sources-access-validation-workflow-tasks-btn")),
    "Deferring...",
    () => checkpointSourcesAccessValidationWorkflowTasks("deferred")
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("dismiss-sources-access-validation-workflow-tasks-btn")),
    "Dismissing...",
    () => checkpointSourcesAccessValidationWorkflowTasks("dismissed")
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-sources-access-checklist-btn")),
    "Copying...",
    () => copySourcesAccessChecklist()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-sources-access-validation-runbook-btn")),
    "Copying...",
    () => copySourcesAccessValidationRunbook()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-sources-access-validation-evidence-btn")),
    "Copying...",
    () => copySourcesAccessValidationEvidence()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-sources-access-validation-evidence-coverage-btn")),
    "Copying...",
    () => copySourcesAccessValidationEvidenceCoverage()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-sources-deployment-health-btn")),
    "Copying...",
    () => copySourcesDeploymentHealth()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-sources-deployment-smoke-checks-btn")),
    "Copying...",
    () => copySourcesDeploymentSmokeChecks()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-sources-access-matrix-btn")),
    "Copying...",
    () => copySourcesAccessMatrix()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-sources-access-review-queue-btn")),
    "Copying...",
    () => copySourcesAccessReviewQueue()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-sources-access-gate-btn")),
    "Copying...",
    () => copySourcesAccessGate()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("save-sources-summary-snapshot-btn")),
    "Saving...",
    () => saveSourcesSummarySnapshot()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-sources-summary-drift-btn")),
    "Copying...",
    () => copyLatestSourcesSummarySnapshotDrift()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("refresh-governance-btn")),
    "Refreshing...",
    () => refreshGovernanceView()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("seed-governance-profiles-btn")),
    "Seeding...",
    () => seedGovernanceProfiles()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("seed-governance-starter-packs-btn")),
    "Seeding...",
    () => seedGovernanceStarterPacks()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("refresh-governance-profile-targets-btn")),
    "Refreshing...",
    () => refreshGovernanceProfileTargets()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("seed-governance-profile-target-tasks-btn")),
    "Seeding...",
    () => seedGovernanceProfileTargetTasks()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-governance-profile-target-task-ledger-btn")),
    "Copying...",
    () => copyGovernanceProfileTargetTaskLedger()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("save-governance-profile-target-task-ledger-snapshot-btn")),
    "Saving...",
    () => saveGovernanceProfileTargetTaskLedgerSnapshot()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-governance-profile-target-task-ledger-drift-btn")),
    "Copying...",
    () => copyLatestGovernanceProfileTargetTaskLedgerSnapshotDrift()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("refresh-governance-profile-target-task-ledger-snapshot-btn")),
    "Refreshing...",
    () => refreshGovernanceProfileTargetTaskLedgerSnapshot()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-governance-profile-target-task-ledger-baseline-status-btn")),
    "Copying...",
    () => copyGovernanceProfileTargetTaskLedgerBaselineStatus()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("execute-governance-queue-btn")),
    "Executing...",
    () => executeGovernanceQueue()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("suppress-governance-queue-btn")),
    "Suppressing...",
    () => suppressGovernanceQueue()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("start-queued-agent-work-order-runs-btn")),
    "Starting...",
    () => startQueuedAgentWorkOrderRuns()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("block-stale-agent-work-order-runs-btn")),
    "Blocking...",
    () => blockStaleAgentWorkOrderRuns()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("action-sla-breach-agent-work-order-runs-btn")),
    "Actioning...",
    () => actionSlaBreaches()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("resolve-sla-breach-agent-work-order-runs-btn")),
    "Resolving...",
    () => resolveSlaBreaches()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("retry-terminal-agent-work-order-runs-btn")),
    "Retrying...",
    () => retryTerminalAgentWorkOrderRuns()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("archive-completed-agent-work-order-runs-btn")),
    "Archiving...",
    () => archiveCompletedAgentWorkOrderRuns()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("apply-agent-execution-retention-btn")),
    "Applying...",
    () => applyAgentExecutionRetention()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("save-governance-execution-view-btn")),
    "Saving...",
    () => saveGovernanceExecutionView()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("save-agent-execution-policy-btn")),
    "Saving...",
    () => saveAgentExecutionPolicy()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-governance-summary-btn")),
    "Copying...",
    () => copyGovernanceSummary()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-governance-task-update-ledger-btn")),
    "Copying...",
    () => copyGovernanceTaskUpdateLedger()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("save-governance-task-update-ledger-snapshot-btn")),
    "Saving...",
    () => saveGovernanceTaskUpdateLedgerSnapshot()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-governance-task-update-ledger-drift-btn")),
    "Copying...",
    () => copyLatestGovernanceTaskUpdateLedgerSnapshotDrift()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-governance-source-access-gate-btn")),
    "Copying...",
    () => copyGovernanceDataSourcesAccessGate()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-governance-source-access-queue-btn")),
    "Copying...",
    () => copyGovernanceDataSourcesAccessReviewQueue()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-governance-source-access-validation-evidence-btn")),
    "Copying...",
    () => copyGovernanceDataSourcesAccessValidationEvidence()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-governance-source-access-validation-workflow-btn")),
    "Copying...",
    () => copyGovernanceDataSourcesAccessValidationWorkflow()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("save-governance-source-access-validation-workflow-snapshot-btn")),
    "Saving...",
    () => saveGovernanceDataSourcesAccessValidationWorkflowSnapshot()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-governance-source-access-validation-workflow-drift-btn")),
    "Copying...",
    () => copyGovernanceDataSourcesAccessValidationWorkflowSnapshotDrift()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("seed-governance-source-access-validation-workflow-tasks-btn")),
    "Creating...",
    () => seedGovernanceDataSourcesAccessValidationWorkflowTasks()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("defer-governance-source-access-validation-workflow-tasks-btn")),
    "Deferring...",
    () => checkpointGovernanceDataSourcesAccessValidationWorkflowTasks("deferred")
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("dismiss-governance-source-access-validation-workflow-tasks-btn")),
    "Dismissing...",
    () => checkpointGovernanceDataSourcesAccessValidationWorkflowTasks("dismissed")
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("seed-governance-source-access-tasks-btn")),
    "Creating...",
    () => seedGovernanceDataSourcesAccessReviewTasks()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("defer-governance-source-access-tasks-btn")),
    "Deferring...",
    () => checkpointGovernanceDataSourcesAccessReviewTasks("deferred")
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("dismiss-governance-source-access-tasks-btn")),
    "Dismissing...",
    () => checkpointGovernanceDataSourcesAccessReviewTasks("dismissed")
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("seed-governance-source-evidence-coverage-tasks-btn")),
    "Creating...",
    () => seedGovernanceDataSourcesAccessValidationEvidenceCoverageTasks()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("defer-governance-source-evidence-coverage-tasks-btn")),
    "Deferring...",
    () => checkpointGovernanceDataSourcesAccessValidationEvidenceCoverageTasks("deferred")
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("dismiss-governance-source-evidence-coverage-tasks-btn")),
    "Dismissing...",
    () => checkpointGovernanceDataSourcesAccessValidationEvidenceCoverageTasks("dismissed")
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-governance-source-access-task-ledger-btn")),
    "Copying...",
    () => copyGovernanceDataSourcesAccessTaskLedger()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("save-agent-work-order-snapshot-btn")),
    "Saving...",
    () => saveAgentWorkOrderSnapshot()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("save-agent-control-plane-snapshot-btn")),
    "Saving...",
    () => saveAgentControlPlaneSnapshot()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("save-agent-control-plane-decision-snapshot-btn")),
    "Saving...",
    () => saveAgentControlPlaneDecisionSnapshot()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("save-agent-control-plane-baseline-snapshot-btn")),
    "Saving...",
    () => saveAgentControlPlaneBaselineSnapshot()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("save-sla-ledger-snapshot-btn")),
    "Saving...",
    () => saveSlaLedgerSnapshot()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("save-source-access-task-ledger-snapshot-btn")),
    "Saving...",
    () => saveDataSourcesAccessTaskLedgerSnapshot()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("save-source-access-validation-evidence-snapshot-btn")),
    "Saving...",
    () => saveDataSourcesAccessValidationEvidenceSnapshot()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-source-access-task-ledger-drift-btn")),
    "Copying...",
    () => copyLatestDataSourcesAccessTaskLedgerSnapshotDrift()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-source-access-validation-evidence-drift-btn")),
    "Copying...",
    () => copyLatestDataSourcesAccessValidationEvidenceSnapshotDrift()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-agent-work-orders-btn")),
    "Copying...",
    () => copyAgentWorkOrders()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-agent-execution-briefs-btn")),
    "Copying...",
    () => copyAgentExecutionBriefs()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-agent-control-plane-btn")),
    "Copying...",
    () => copyAgentControlPlane()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-release-control-btn")),
    "Copying...",
    () => copyReleaseControl()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("save-release-checkpoint-btn")),
    "Saving...",
    () => saveReleaseCheckpoint()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-latest-agent-control-plane-drift-btn")),
    "Copying...",
    () => copyLatestAgentControlPlaneSnapshotDrift()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-baseline-agent-control-plane-drift-btn")),
    "Copying...",
    () => copyBaselineAgentControlPlaneSnapshotDrift()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-agent-control-plane-baseline-status-btn")),
    "Copying...",
    () => copyAgentControlPlaneBaselineStatus()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-agent-control-plane-decision-btn")),
    "Copying...",
    () => copyAgentControlPlaneDecision()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("clear-agent-control-plane-baseline-btn")),
    "Clearing...",
    () => clearAgentControlPlaneBaselineSnapshot()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("refresh-agent-control-plane-baseline-btn")),
    "Refreshing...",
    () => refreshAgentControlPlaneBaselineSnapshot()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("copy-sla-breach-ledger-btn")),
    "Copying...",
    () => copySlaBreachLedger()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("export-governance-report-btn")),
    "Exporting...",
    () => exportGovernanceReport()
  );

  document.getElementById("add-source-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const type = /** @type {HTMLSelectElement} */ (document.getElementById("source-type"));
    const url = /** @type {HTMLInputElement} */ (document.getElementById("source-url"));
    const form = /** @type {HTMLFormElement} */ (event.currentTarget);
    const button = form.querySelector("button");
    const originalText = button?.textContent || "Add";

    try {
      if (button) {
        button.textContent = "Adding...";
        button.disabled = true;
      }

      await dashboardApi.addSource({ type: type.value, url: url.value });
      url.value = "";
      await views.renderSources();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Source add failed.";
      alert(message);
    } finally {
      if (button) {
        button.textContent = originalText;
        button.disabled = false;
      }
    }
  });
}

async function initialize() {
  bindEventListeners();
  const embeddedInventory = dashboardApi.getEmbeddedInventory();

  if (embeddedInventory) {
    data = embeddedInventory;
    runtime.inventorySource = "embedded";
    runtime.lastLoadedAt = new Date().toISOString();
    runtime.snapshotGeneratedAt = embeddedInventory.generatedAt;
    runtime.loadError = "";
    views.renderDashboard();
    renderScopeLock();
  }

  try {
    await refreshInventory();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inventory load failed.";
    runtime.loadError = message;
    runtime.lastLoadedAt = new Date().toISOString();
    if (embeddedInventory) {
      runtime.inventorySource = "embedded";
      views.renderRuntimeStatus();
      return;
    }
    runtime.inventorySource = "unavailable";
    views.renderRuntimeStatus();
    document.getElementById("meta-info").textContent = `Inventory load failed: ${message}`;
    document.getElementById("app-grid").innerHTML = `<div class="app-card"><h3 class="app-title">Inventory load failed</h3><p class="app-desc">${escapeHtml(message)}</p></div>`;
  }
}

void initialize();
