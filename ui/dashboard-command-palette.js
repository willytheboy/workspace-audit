// @ts-check

/**
 * @typedef {import("./dashboard-actions.js").DashboardAction} DashboardAction
 */

/**
 * @param {{
 *   getActions: () => DashboardAction[]
 * }} options
 */
export function createDashboardCommandPalette({ getActions }) {
  const overlay = document.getElementById("command-palette");
  const input = /** @type {HTMLInputElement} */ (document.getElementById("command-palette-input"));
  const list = document.getElementById("command-palette-list");
  const emptyState = document.getElementById("command-palette-empty");

  let isOpen = false;
  let query = "";
  let selectedIndex = 0;

  /**
   * @param {string} value
   */
  function normalizeSearchText(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  /**
   * @param {string} haystack
   * @param {string} needle
   */
  function hasFuzzySubsequence(haystack, needle) {
    if (!needle) return true;
    let offset = 0;
    for (const character of needle.replace(/\s+/g, "")) {
      offset = haystack.indexOf(character, offset);
      if (offset === -1) return false;
      offset += 1;
    }
    return true;
  }

  /**
   * @param {DashboardAction} action
   * @param {string} normalizedQuery
   */
  function scoreAction(action, normalizedQuery) {
    if (!normalizedQuery) return 1;
    const label = normalizeSearchText(action.label);
    const description = normalizeSearchText(action.description);
    const category = normalizeSearchText(action.category);
    const keywords = (action.keywords || []).map(normalizeSearchText).join(" ");
    const haystack = `${label} ${description} ${category} ${keywords}`;
    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

    let score = 0;
    if (label === normalizedQuery) score += 140;
    if (label.includes(normalizedQuery)) score += 110;
    if (haystack.includes(normalizedQuery)) score += 80;
    if (queryTokens.length && queryTokens.every((token) => haystack.includes(token))) score += 50 + queryTokens.length * 8;
    if (hasFuzzySubsequence(label, normalizedQuery)) score += 36;
    if (hasFuzzySubsequence(haystack, normalizedQuery)) score += 18;
    if (action.category === "Projects") score += 8;
    return score;
  }

  /**
   * @returns {DashboardAction[]}
   */
  function getFilteredActions() {
    const actions = getActions();
    if (!query.trim()) return actions.slice(0, 16);

    const normalizedQuery = normalizeSearchText(query);
    return actions
      .map((action) => ({ action, score: scoreAction(action, normalizedQuery) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.action.category.localeCompare(right.action.category) || left.action.label.localeCompare(right.action.label))
      .slice(0, 20)
      .map((item) => item.action);
  }

  /**
   * @param {DashboardAction[]} actions
   */
  function renderActions(actions) {
    const fragment = document.createDocumentFragment();
    let lastCategory = "";

    actions.forEach((action, index) => {
      if (action.category !== lastCategory) {
        lastCategory = action.category;
        const heading = document.createElement("div");
        heading.className = "command-palette-group";
        heading.textContent = action.category;
        fragment.append(heading);
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = `command-palette-item${index === selectedIndex ? " active" : ""}`;
      button.dataset.commandIndex = String(index);
      const copy = document.createElement("span");
      copy.className = "command-palette-copy";

      const label = document.createElement("span");
      label.className = "command-palette-label";
      label.textContent = action.label;

      const description = document.createElement("span");
      description.className = "command-palette-description";
      description.textContent = action.description;

      const enterHint = document.createElement("span");
      enterHint.className = "command-palette-enter";
      enterHint.textContent = "↵";

      copy.append(label, description);
      button.append(copy, enterHint);
      button.addEventListener("mouseenter", () => {
        selectedIndex = index;
        render();
      });
      button.addEventListener("click", async () => {
        await executeAction(index);
      });
      fragment.append(button);
    });

    list.replaceChildren(fragment);
    emptyState.hidden = actions.length > 0;

    requestAnimationFrame(() => {
      const active = /** @type {HTMLElement | null} */ (list.querySelector(`[data-command-index="${selectedIndex}"]`));
      active?.scrollIntoView({ block: "nearest" });
    });
  }

  function render() {
    const actions = getFilteredActions();
    if (selectedIndex >= actions.length) {
      selectedIndex = Math.max(actions.length - 1, 0);
    }
    renderActions(actions);
  }

  async function executeAction(index = selectedIndex) {
    const actions = getFilteredActions();
    const action = actions[index];
    if (!action) return;
    close();
    try {
      await action.run();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Command failed.";
      alert(message);
    }
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    query = "";
    selectedIndex = 0;
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    input.value = "";
    render();
    requestAnimationFrame(() => input.focus());
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
    input.blur();
  }

  function toggle() {
    if (isOpen) {
      close();
      return;
    }
    open();
  }

  /**
   * @param {KeyboardEvent} event
   */
  function handleGlobalKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      toggle();
      return;
    }

    if (!isOpen) return;

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, Math.max(getFilteredActions().length - 1, 0));
      render();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      render();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      void executeAction();
    }
  }

  function bind() {
    document.addEventListener("keydown", handleGlobalKeydown);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        close();
      }
    });

    input.addEventListener("input", () => {
      query = input.value;
      selectedIndex = 0;
      render();
    });
  }

  bind();

  return {
    close,
    open,
    toggle
  };
}
