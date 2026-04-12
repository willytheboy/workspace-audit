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
   * @returns {DashboardAction[]}
   */
  function getFilteredActions() {
    const actions = getActions();
    if (!query.trim()) return actions.slice(0, 16);

    const lowerQuery = query.toLowerCase();
    return actions.filter((action) => {
      const haystack = [
        action.label,
        action.description,
        action.category,
        ...(action.keywords || [])
      ].join(" ").toLowerCase();

      return haystack.includes(lowerQuery);
    }).slice(0, 16);
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
