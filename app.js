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

async function seedGovernanceDataSourcesAccessValidationEvidenceCoverageTasks() {
  setView("governance");
  await views.renderGovernance();
  return views.seedGovernanceDataSourcesAccessValidationEvidenceCoverageTasks();
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

async function executeGovernanceQueue() {
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
  setView("governance");
  await views.renderGovernance();
  await views.startVisibleQueuedAgentWorkOrderRuns();
}

async function blockStaleAgentWorkOrderRuns() {
  setView("governance");
  await views.renderGovernance();
  await views.blockVisibleStaleAgentWorkOrderRuns();
}

async function actionSlaBreaches() {
  setView("governance");
  await views.renderGovernance();
  await views.actionVisibleSlaBreaches();
}

async function resolveSlaBreaches() {
  setView("governance");
  await views.renderGovernance();
  await views.resolveVisibleSlaBreaches();
}

async function retryTerminalAgentWorkOrderRuns() {
  setView("governance");
  await views.renderGovernance();
  await views.retryVisibleTerminalAgentWorkOrderRuns();
}

async function archiveCompletedAgentWorkOrderRuns() {
  setView("governance");
  await views.renderGovernance();
  await views.archiveVisibleCompletedAgentWorkOrderRuns();
}

async function applyAgentExecutionRetention() {
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
    exportGovernanceReport,
    copyGovernanceSummary,
    copyGovernanceDataSourcesAccessGate,
    copyGovernanceDataSourcesAccessReviewQueue,
    copyGovernanceDataSourcesAccessValidationEvidence,
    seedGovernanceDataSourcesAccessReviewTasks,
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
    bootstrapReleaseBuildGateLocalEvidence,
    seedReleaseBuildGateActionTasks,
    saveReleaseCheckpoint,
    copyLatestAgentControlPlaneSnapshotDrift,
    copyBaselineAgentControlPlaneSnapshotDrift,
    copyAgentControlPlaneBaselineStatus,
    copyAgentControlPlaneDecision,
    copyAgentControlPlaneDecisionTaskLedger,
    saveAgentControlPlaneDecisionTaskLedgerSnapshot,
    copyLatestAgentControlPlaneDecisionTaskLedgerSnapshotDrift,
    seedAgentControlPlaneDecisionTasks,
    seedAgentControlPlaneDecisionTasksWithSnapshot,
    clearAgentControlPlaneBaselineSnapshot,
    refreshAgentControlPlaneBaselineSnapshot,
    copySlaBreachLedger,
    saveAgentWorkOrderSnapshot,
    saveAgentControlPlaneSnapshot,
    saveAgentControlPlaneDecisionSnapshot,
    saveAgentControlPlaneBaselineSnapshot,
    saveSlaLedgerSnapshot,
    seedGovernanceProfiles,
    seedGovernanceStarterPacks,
    executeGovernanceQueue,
    suppressGovernanceQueue,
    startQueuedAgentWorkOrderRuns,
    blockStaleAgentWorkOrderRuns,
    actionSlaBreaches,
    resolveSlaBreaches,
    retryTerminalAgentWorkOrderRuns,
    archiveCompletedAgentWorkOrderRuns,
    applyAgentExecutionRetention,
    saveGovernanceExecutionView,
    saveAgentExecutionPolicy,
    setArchivedVisibility,
    openProject: (projectId) => modal.openModal(projectId)
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
    /** @type {HTMLButtonElement} */ (document.getElementById("seed-governance-source-access-tasks-btn")),
    "Creating...",
    () => seedGovernanceDataSourcesAccessReviewTasks()
  );

  bindAsyncButton(
    /** @type {HTMLButtonElement} */ (document.getElementById("seed-governance-source-evidence-coverage-tasks-btn")),
    "Creating...",
    () => seedGovernanceDataSourcesAccessValidationEvidenceCoverageTasks()
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
