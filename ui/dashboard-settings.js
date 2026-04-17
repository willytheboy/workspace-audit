// @ts-check

/**
 * @typedef {import("./dashboard-types.js").DashboardRuntimeState} DashboardRuntimeState
 * @typedef {import("./dashboard-types.js").AuditPayload} AuditPayload
 */

/**
 * @param {string} className
 * @param {string} text
 */
function createTextBlock(className, text) {
  const node = document.createElement("div");
  node.className = className;
  node.textContent = text;
  return node;
}

/**
 * @param {string} label
 * @param {string} value
 */
function createSettingRow(label, value) {
  const row = document.createElement("div");
  row.className = "settings-row";
  row.append(
    createTextBlock("settings-row-label", label),
    createTextBlock("settings-row-value", value)
  );
  return row;
}

/**
 * @param {{
 *   api: {
 *     fetchFindings: () => Promise<import("./dashboard-types.js").PersistedFinding[]>,
 *     fetchSources: () => Promise<Array<{ type: string, url?: string, path?: string, addedAt?: string }>>,
 *     fetchDiagnostics: () => Promise<{
 *       rootDir: string,
 *       publicDir: string,
 *       inventoryGeneratedAt?: string | null,
 *       totalProjects: number,
 *       historySnapshots: number,
 *       sourceCount: number,
 *       findingsCount: number,
 *       taskCount: number,
 *       workflowCount: number,
 *       scriptRunCount: number,
 *       agentSessionCount: number,
 *       noteCount: number,
 *       milestoneCount: number,
 *       projectProfileCount: number,
 *       scanRunCount: number,
 *       hasInventoryFile: boolean,
 *       hasBootstrappedShell: boolean,
 *       databaseFile: string,
 *       hasDatabaseFile: boolean,
 *       storeFile: string,
 *       hasStoreFile: boolean,
 *       lastFindingsRefreshAt?: string | null,
 *       latestScanAt?: string | null,
 *       mutationScope?: {
 *         generatedAt: string,
 *         summary: { total: number, scopeRelevant: number, guarded: number, unguarded: number, utility: number },
 *         unguarded: Array<{ method: string, route: string, category: string, sourceLine: number, recommendedAction?: string }>
 *       }
 *     }>
 *   },
 *   getData: () => AuditPayload,
 *   getRuntime: () => DashboardRuntimeState,
 *   onOpenSourceSetup: () => void,
 *   onRunAuditRefresh: () => Promise<void>,
 *   onRefreshFindings: () => Promise<void>,
 *   onRefreshSources: () => Promise<void>,
 *   onRefreshGovernance: () => Promise<void>,
 *   onExportCsv: () => void
 * }} options
 */
export function createDashboardSettingsModal({
  api,
  getData,
  getRuntime,
  onOpenSourceSetup,
  onRunAuditRefresh,
  onRefreshFindings,
  onRefreshSources,
  onRefreshGovernance,
  onExportCsv
}) {
  const overlay = document.getElementById("settings-modal");
  const closeButton = document.getElementById("settings-close");
  const tabs = /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll("[data-settings-tab]"));
  const panel = document.getElementById("settings-panel");

  let activeTab = "workspace";
  let loading = false;
  let errorMessage = "";
  /** @type {Awaited<ReturnType<typeof api.fetchDiagnostics>> | null} */
  let diagnostics = null;
  /** @type {Awaited<ReturnType<typeof api.fetchSources>>} */
  let sources = [];
  /** @type {Awaited<ReturnType<typeof api.fetchFindings>>} */
  let findings = [];

  function close() {
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
  }

  function open() {
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    void load();
  }

  /**
   * @param {string | undefined | null} value
   */
  function formatDate(value) {
    if (!value) return "Not available";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  function syncTabs() {
    tabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.settingsTab === activeTab);
    });
  }

  async function load() {
    loading = true;
    errorMessage = "";
    render();
    try {
      const [nextDiagnostics, nextSources, nextFindings] = await Promise.all([
        api.fetchDiagnostics(),
        api.fetchSources(),
        api.fetchFindings()
      ]);
      diagnostics = nextDiagnostics;
      sources = nextSources;
      findings = nextFindings;
      loading = false;
      render();
    } catch (error) {
      loading = false;
      errorMessage = error instanceof Error ? error.message : "Settings data failed to load.";
      render();
    }
  }

  function renderWorkspaceTab() {
    const runtime = getRuntime();
    const data = getData();

    return [
      createSettingRow("Workspace root", diagnostics?.rootDir || data.rootDir || "Unknown"),
      createSettingRow("Public shell", diagnostics?.publicDir || "Unknown"),
      createSettingRow("Inventory source", runtime.inventorySource),
      createSettingRow("Projects in snapshot", String(diagnostics?.totalProjects ?? data.summary?.totalApps ?? 0)),
      createSettingRow("Snapshot generated", formatDate(diagnostics?.inventoryGeneratedAt || data.generatedAt)),
      createSettingRow("Last loaded", formatDate(runtime.lastLoadedAt)),
      createSettingRow("Persisted findings", String(diagnostics?.findingsCount ?? findings.length)),
      createSettingRow("Persisted tasks", String(diagnostics?.taskCount ?? 0)),
      createSettingRow("Persisted workflows", String(diagnostics?.workflowCount ?? 0)),
      createSettingRow("Script run history", String(diagnostics?.scriptRunCount ?? 0)),
      createSettingRow("Agent sessions", String(diagnostics?.agentSessionCount ?? 0)),
      createSettingRow("Persisted notes", String(diagnostics?.noteCount ?? 0)),
      createSettingRow("Persisted milestones", String(diagnostics?.milestoneCount ?? 0)),
      createSettingRow("Project profiles", String(diagnostics?.projectProfileCount ?? 0)),
      createSettingRow("Persisted scan runs", String(diagnostics?.scanRunCount ?? 0))
    ];
  }

  function renderSourcesTab() {
    const fragment = [];
    fragment.push(createSettingRow("Tracked sources", String(diagnostics?.sourceCount ?? sources.length)));
    fragment.push(createSettingRow("History snapshots", String(diagnostics?.historySnapshots ?? 0)));

    if (!sources.length) {
      fragment.push(createTextBlock("settings-empty", "No sources are currently configured."));
      return fragment;
    }

    const list = document.createElement("div");
    list.className = "settings-source-list";
    for (const source of sources) {
      const item = document.createElement("div");
      item.className = "settings-source-item";
      item.append(
        createTextBlock("settings-source-type", source.type.toUpperCase()),
        createTextBlock("settings-source-value", source.url || source.path || ""),
        createTextBlock("settings-source-meta", source.addedAt ? `Added ${formatDate(source.addedAt)}` : "Default source")
      );
      list.append(item);
    }
    fragment.push(list);
    return fragment;
  }

  function renderDiagnosticsTab() {
    const nodes = [
      createSettingRow("Embedded shell", diagnostics?.hasBootstrappedShell ? "Present" : "Missing"),
      createSettingRow("Inventory file", diagnostics?.hasInventoryFile ? "Present" : "Missing"),
      createSettingRow("SQLite store", diagnostics?.databaseFile || "Unknown"),
      createSettingRow("SQLite status", diagnostics?.hasDatabaseFile ? "Present" : "Missing"),
      createSettingRow("Store file", diagnostics?.storeFile || "Unknown"),
      createSettingRow("JSON mirror", diagnostics?.hasStoreFile ? "Present" : "Missing"),
      createSettingRow("Latest scan", formatDate(diagnostics?.latestScanAt || null)),
      createSettingRow("Findings refreshed", formatDate(diagnostics?.lastFindingsRefreshAt || null)),
      createSettingRow("History snapshots", String(diagnostics?.historySnapshots ?? 0)),
      createSettingRow("Load error", getRuntime().loadError || "None"),
      createSettingRow("Panel findings state", getRuntime().panels.findings.status),
      createSettingRow("Panel trends state", getRuntime().panels.trends.status),
      createSettingRow("Panel sources state", getRuntime().panels.sources.status),
      createSettingRow("Panel governance state", getRuntime().panels.governance.status)
    ];

    const mutationScope = diagnostics?.mutationScope;
    if (!mutationScope) return nodes;

    nodes.push(
      createSettingRow("Mutation routes", String(mutationScope.summary.total)),
      createSettingRow("Scope-relevant mutations", String(mutationScope.summary.scopeRelevant)),
      createSettingRow("Guarded mutations", String(mutationScope.summary.guarded)),
      createSettingRow("Unguarded mutations", String(mutationScope.summary.unguarded))
    );

    const unguarded = Array.isArray(mutationScope.unguarded) ? mutationScope.unguarded.slice(0, 8) : [];
    const list = document.createElement("div");
    list.className = "settings-source-list";
    if (!unguarded.length) {
      list.append(createTextBlock("settings-empty", "All scope-relevant mutation routes have explicit scope guards."));
    } else {
      for (const route of unguarded) {
        const item = document.createElement("div");
        item.className = "settings-source-item";
        item.append(
          createTextBlock("settings-source-type", `${route.method} ${route.category}`.toUpperCase()),
          createTextBlock("settings-source-value", route.route),
          createTextBlock("settings-source-meta", `Line ${route.sourceLine}: ${route.recommendedAction || "Scope guard review required."}`)
        );
        list.append(item);
      }
    }
    nodes.push(createTextBlock("settings-about-title", "Mutation Scope Guard Coverage"), list);

    return nodes;
  }

  function renderAboutTab() {
    const block = document.createElement("div");
    block.className = "settings-about";
    block.append(
      createTextBlock("settings-about-title", "Workspace Audit control center"),
      createTextBlock(
        "settings-about-copy",
        "This dashboard is being upgraded from a generated audit report into a local-first control center. The current adopted donor slices are the command palette, guided source setup flow, durable persistence, and project workbench."
      ),
      createTextBlock(
        "settings-about-copy",
        "The platform now persists sources, findings, tasks, workflows, notes, milestones, and scan runs, and the project detail surface has been replaced with a workbench / launchpad panel for project-level action."
      ),
      createTextBlock(
        "settings-about-copy",
        "The workflow tab now acts as a lightweight supervised workflow engine with explicit phases and approval states."
      )
    );
    return [block];
  }

  function renderActions() {
    const actions = document.createElement("div");
    actions.className = "settings-actions";

    /**
     * @param {string} label
     * @param {() => void | Promise<void>} handler
     * @param {string} [variant]
     */
    function createActionButton(label, handler, variant = "") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `btn${variant ? ` ${variant}` : ""}`;
      button.textContent = label;
      button.addEventListener("click", async () => {
        try {
          button.disabled = true;
          await handler();
        } finally {
          button.disabled = false;
        }
      });
      return button;
    }

    actions.append(
      createActionButton("Refresh Audit", async () => {
        await onRunAuditRefresh();
        await load();
      }, "btn-primary"),
      createActionButton("Refresh Findings", async () => {
        await onRefreshFindings();
        await load();
      }),
      createActionButton("Refresh Sources", async () => {
        await onRefreshSources();
        await load();
      }),
      createActionButton("Refresh Governance", async () => {
        await onRefreshGovernance();
        await load();
      }),
      createActionButton("Open Source Setup", () => {
        close();
        onOpenSourceSetup();
      }),
      createActionButton("Export CSV", () => onExportCsv())
    );

    return actions;
  }

  function render() {
    syncTabs();
    panel.replaceChildren();

    if (loading) {
      panel.append(createTextBlock("settings-empty", "Loading settings and diagnostics..."));
      return;
    }

    if (errorMessage) {
      panel.append(createTextBlock("settings-error", errorMessage));
      return;
    }

    const body = document.createElement("div");
    body.className = "settings-body";

    const content = document.createElement("div");
    content.className = "settings-section";

    /** @type {Node[]} */
    let nodes = [];
    if (activeTab === "workspace") nodes = renderWorkspaceTab();
    else if (activeTab === "sources") nodes = renderSourcesTab();
    else if (activeTab === "diagnostics") nodes = renderDiagnosticsTab();
    else nodes = renderAboutTab();

    content.append(...nodes);
    body.append(content, renderActions());
    panel.append(body);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.settingsTab || "workspace";
      render();
    });
  });

  closeButton.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close();
    }
  });

  return {
    close,
    open
  };
}
