// @ts-check

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   summary: string,
 *   placeholder: string,
 *   hint: string
 * }} SourceMode
 */

const SOURCE_MODES = /** @type {SourceMode[]} */ ([
  {
    id: "local",
    label: "Local folder",
    summary: "Track a project directory or drive path.",
    placeholder: "D:\\projects\\my-app",
    hint: "Use a full local path to a project folder or workspace root."
  },
  {
    id: "github",
    label: "GitHub repo",
    summary: "Track a repository URL.",
    placeholder: "https://github.com/owner/repo",
    hint: "Use a full GitHub repository URL."
  },
  {
    id: "vercel",
    label: "Vercel project",
    summary: "Track deployment-facing projects.",
    placeholder: "https://my-app.vercel.app",
    hint: "Use a deployment URL or project hostname."
  },
  {
    id: "supabase",
    label: "Supabase instance",
    summary: "Track backend and data services.",
    placeholder: "https://your-project.supabase.co",
    hint: "Use the project URL or dashboard URL."
  },
  {
    id: "claude",
    label: "AI workspace",
    summary: "Track Claude, Gemini, or ChatGPT context links.",
    placeholder: "https://claude.ai/...",
    hint: "Use the most stable URL or workspace entry point available."
  }
]);

/**
 * @param {string} className
 * @param {string} text
 */
function createTextNode(className, text) {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = text;
  return element;
}

/**
 * @param {{
 *   api: {
 *     addSource: (payload: { type: string, url: string }) => Promise<unknown>
 *   },
 *   refreshSources: () => Promise<void>,
 *   setView: (view: "sources") => void
 * }} options
 */
export function createSourceSetupModal({ api, refreshSources, setView }) {
  const overlay = document.getElementById("source-setup-modal");
  const title = document.getElementById("source-setup-title");
  const subtitle = document.getElementById("source-setup-subtitle");
  const body = document.getElementById("source-setup-body");
  const closeButton = document.getElementById("source-setup-close");

  /** @type {SourceMode | null} */
  let selectedMode = null;
  /** @type {{ type: string, value: string } | null} */
  let completedSource = null;
  let isSubmitting = false;
  let errorMessage = "";
  let isOpen = false;

  function reset() {
    selectedMode = null;
    completedSource = null;
    isSubmitting = false;
    errorMessage = "";
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
    reset();
  }

  function open() {
    reset();
    isOpen = true;
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    render();
  }

  /**
   * @param {SourceMode} mode
   */
  function renderInputStep(mode) {
    title.textContent = `Connect ${mode.label}`;
    subtitle.textContent = mode.hint;

    const field = document.createElement("input");
    field.className = "setup-modal-input";
    field.type = "text";
    field.placeholder = mode.placeholder;
    field.autocomplete = "off";
    field.spellcheck = false;

    const errorNode = createTextNode("setup-modal-error", errorMessage);
    errorNode.hidden = !errorMessage;

    const helper = createTextNode("setup-modal-helper", `${mode.summary} Register source locations only; do not paste passwords, tokens, private keys, or certificates here.`);

    const backButton = document.createElement("button");
    backButton.type = "button";
    backButton.className = "btn";
    backButton.textContent = "Back";
    backButton.addEventListener("click", () => {
      selectedMode = null;
      errorMessage = "";
      render();
    });

    const connectButton = document.createElement("button");
    connectButton.type = "button";
    connectButton.className = "btn btn-primary";
    connectButton.textContent = isSubmitting ? "Connecting..." : "Connect Source";
    connectButton.disabled = isSubmitting;
    connectButton.addEventListener("click", async () => {
      const value = field.value.trim();
      if (!value) {
        errorMessage = "A path or URL is required.";
        render();
        return;
      }

      try {
        isSubmitting = true;
        errorMessage = "";
        render();
        await api.addSource({ type: mode.id, url: value });
        completedSource = { type: mode.id, value };
        await refreshSources();
        isSubmitting = false;
        render();
      } catch (error) {
        isSubmitting = false;
        errorMessage = error instanceof Error ? error.message : "Source connection failed.";
        render();
      }
    });

    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        connectButton.click();
      }
    });

    const actions = document.createElement("div");
    actions.className = "setup-modal-actions";
    actions.append(backButton, connectButton);

    body.replaceChildren(helper, field, errorNode, actions);
    requestAnimationFrame(() => field.focus());
  }

  function renderDoneStep() {
    title.textContent = "Source Ready";
    subtitle.textContent = "The source has been added to the workspace audit registry.";

    const summary = document.createElement("div");
    summary.className = "setup-modal-summary";
    summary.append(
      createTextNode("setup-modal-summary-label", (completedSource?.type || "").toUpperCase()),
      createTextNode("setup-modal-summary-value", completedSource?.value || "")
    );

    const addAnotherButton = document.createElement("button");
    addAnotherButton.type = "button";
    addAnotherButton.className = "btn";
    addAnotherButton.textContent = "Add Another";
    addAnotherButton.addEventListener("click", () => {
      selectedMode = null;
      completedSource = null;
      render();
    });

    const openSourcesButton = document.createElement("button");
    openSourcesButton.type = "button";
    openSourcesButton.className = "btn btn-primary";
    openSourcesButton.textContent = "Open Sources";
    openSourcesButton.addEventListener("click", () => {
      setView("sources");
      close();
    });

    const actions = document.createElement("div");
    actions.className = "setup-modal-actions";
    actions.append(addAnotherButton, openSourcesButton);

    body.replaceChildren(summary, actions);
  }

  function renderModeSelection() {
    title.textContent = "Connect a Source";
    subtitle.textContent = "Start with a local workspace, repo, deployment, or backend service.";

    const grid = document.createElement("div");
    grid.className = "setup-mode-grid";

    for (const mode of SOURCE_MODES) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "setup-mode-card";
      button.addEventListener("click", () => {
        selectedMode = mode;
        render();
      });
      button.append(
        createTextNode("setup-mode-title", mode.label),
        createTextNode("setup-mode-copy", mode.summary)
      );
      grid.append(button);
    }

    body.replaceChildren(grid);
  }

  function render() {
    if (completedSource) {
      renderDoneStep();
      return;
    }
    if (selectedMode) {
      renderInputStep(selectedMode);
      return;
    }
    renderModeSelection();
  }

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
