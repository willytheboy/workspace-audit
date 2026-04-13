// @ts-check

import { encodeAppId, getColor } from "./dashboard-utils.js";

/**
 * @param {ParentNode} parent
 * @param {Array<Node | string | null | undefined>} children
 */
function appendChildren(parent, children) {
  for (const child of children) {
    if (child == null) continue;
    if (typeof child === "string") {
      parent.append(document.createTextNode(child));
      continue;
    }
    parent.append(child);
  }
}

/**
 * @param {keyof HTMLElementTagNameMap} tagName
 * @param {{
 *   className?: string,
 *   text?: string,
 *   attrs?: Record<string, string>,
 *   dataset?: Record<string, string>,
 *   style?: Partial<CSSStyleDeclaration>,
 *   title?: string
 * }} [options]
 * @param {Array<Node | string | null | undefined>} [children]
 */
function createElement(tagName, options = {}, children = []) {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  if (options.text != null) element.textContent = options.text;
  if (options.title) element.title = options.title;
  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) {
      element.setAttribute(name, value);
    }
  }
  if (options.dataset) {
    for (const [name, value] of Object.entries(options.dataset)) {
      element.dataset[name] = value;
    }
  }
  if (options.style) {
    Object.assign(element.style, options.style);
  }
  appendChildren(element, children);
  return element;
}

/**
 * @param {string} text
 * @param {Partial<CSSStyleDeclaration>} [style]
 */
function createTag(text, style = {}) {
  return createElement("span", {
    className: "tag",
    text,
    style
  });
}

/**
 * @param {string[]} items
 */
export function createStackTags(items) {
  if (!items.length) {
    return createElement("span", {
      text: "Frameworks unidentifiable",
      style: { color: "var(--text-muted)" }
    });
  }

  const fragment = document.createDocumentFragment();
  for (const item of items) {
    fragment.append(createTag(item, {
      fontSize: "0.9rem",
      padding: "0.4rem 1rem"
    }));
  }
  return fragment;
}

/**
 * @param {{
 *   label: string,
 *   score: number,
 *   detail: string
 * }} config
 */
export function createMetricBarCard({ label, score, detail }) {
  const color = getColor(score);

  return createElement("div", { className: "metric" }, [
    createElement("span", { className: "metric-name", text: label }),
    createElement("div", { className: "metric-bar-bg" }, [
      createElement("div", {
        className: "metric-bar-fill",
        style: {
          width: `${score}%`,
          background: color
        }
      })
    ]),
    createElement("strong", {
      className: "metric-val",
      text: `${score}%`,
      style: { color }
    }),
    createElement("span", {
      text: detail,
      style: {
        fontSize: "0.8rem",
        color: "var(--text-muted)"
      }
    })
  ]);
}

/**
 * @param {{
 *   label: string,
 *   value: string,
 *   detail: string
 * }} config
 */
export function createMetricValueCard({ label, value, detail }) {
  return createElement("div", { className: "metric" }, [
    createElement("span", { className: "metric-name", text: label }),
    createElement("strong", {
      className: "metric-val",
      text: value,
      style: { color: "var(--text)" }
    }),
    createElement("span", {
      text: detail,
      style: {
        fontSize: "0.8rem",
        color: "var(--text-muted)"
      }
    })
  ]);
}

/**
 * @param {{ type: string, message: string }} warning
 */
export function createWarningItem(warning) {
  let icon = "💡";
  let color = "var(--primary)";
  if (warning.type === "danger") {
    icon = "⚠️";
    color = "var(--danger)";
  }
  if (warning.type === "warning") {
    icon = "⚠️";
    color = "var(--warning)";
  }

  return createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: "0.75rem",
      background: "var(--bg)",
      padding: "1rem",
      borderRadius: "0.5rem",
      border: "1px solid var(--border)",
      borderLeft: `4px solid ${color}`
    }
  }, [
    createElement("span", {
      text: icon,
      style: { fontSize: "1.2rem" }
    }),
    createElement("div", {
      text: warning.message,
      style: {
        fontSize: "0.95rem",
        lineHeight: "1.5",
        color: "var(--text)"
      }
    })
  ]);
}

/**
 * @param {string} script
 */
export function createScriptButton(script) {
  return createElement("button", {
    className: "btn",
    text: `▶ ${script}`,
    dataset: { script },
    style: {
      fontSize: "0.8rem",
      padding: "0.25rem 0.75rem"
    }
  });
}

/**
 * @param {{ name: string, id: string, score: number, reasons: string[] }} similar
 * @param {{ reviewStatus?: string, reviewNote?: string }} [options]
 */
export function createSimilarCard(similar, options = {}) {
  const reviewStatus = options.reviewStatus || "unreviewed";
  const reviewColor = reviewStatus === "not-related"
    ? "var(--danger)"
    : reviewStatus === "confirmed-overlap" || reviewStatus === "merge-candidate"
      ? "var(--success)"
      : "var(--warning)";
  return createElement("div", {
    className: "similar-app-card",
    dataset: { openAppId: encodeAppId(similar.id) }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        marginBottom: "0.5rem",
        alignItems: "center"
      }
    }, [
      createElement("strong", {
        text: similar.name,
        style: { fontSize: "1.1rem" }
      }),
      createTag(`${similar.score}% overlap`, {
        background: "var(--surface)",
        color: "var(--primary)",
        borderColor: "var(--primary)"
      }),
      createTag(reviewStatus.replaceAll("-", " ").toUpperCase(), {
        background: "var(--surface)",
        color: reviewColor,
        borderColor: reviewColor
      })
    ]),
    createElement("div", {
      text: similar.reasons.join(" • "),
      style: {
        fontSize: "0.9rem",
        color: "var(--text-muted)",
        lineHeight: "1.4"
      }
    }),
    options.reviewNote
      ? createElement("div", {
          text: options.reviewNote,
          style: {
            marginTop: "0.5rem",
            fontSize: "0.84rem",
            color: "var(--text-muted)",
            lineHeight: "1.4"
          }
        })
      : null,
    createElement("div", {
      className: "governance-actions",
      style: {
        marginTop: "0.75rem"
      }
    }, [
      createElement("button", {
        className: "btn governance-action-btn",
        text: "Confirm",
        attrs: { type: "button" },
        dataset: {
          convergenceAction: "confirmed-overlap",
          convergenceTargetId: similar.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn",
        text: "Not Related",
        attrs: { type: "button" },
        dataset: {
          convergenceAction: "not-related",
          convergenceTargetId: similar.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn",
        text: "Needs Review",
        attrs: { type: "button" },
        dataset: {
          convergenceAction: "needs-review",
          convergenceTargetId: similar.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn",
        text: "Merge",
        attrs: { type: "button" },
        dataset: {
          convergenceAction: "merge-candidate",
          convergenceTargetId: similar.id
        }
      })
    ])
  ]);
}

/**
 * @param {string} text
 */
export function createMutedItalicMessage(text) {
  return createElement("p", {
    text,
    style: {
      color: "var(--text-muted)",
      fontStyle: "italic"
    }
  });
}

/**
 * @param {string} title
 * @param {string} message
 */
export function createWorkbenchEmptyState(title, message) {
  return createElement("div", { className: "workbench-empty" }, [
    createElement("div", { className: "workbench-empty-title", text: title }),
    createElement("div", { className: "workbench-empty-copy", text: message })
  ]);
}

/**
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   detail?: string,
 *   badges?: Array<{ text: string, tone?: string }>,
 *   meta?: string[],
 *   accentColor?: string,
 *   actions?: Node[]
 * }} config
 */
export function createWorkbenchEntry({
  title,
  subtitle = "",
  detail = "",
  badges = [],
  meta = [],
  accentColor = "",
  actions = []
}) {
  const entry = createElement("div", {
    className: "workbench-entry",
    style: accentColor ? { borderLeft: `4px solid ${accentColor}` } : {}
  });

  const top = createElement("div", { className: "workbench-entry-top" }, [
    createElement("div", { className: "workbench-entry-copy" }, [
      createElement("div", { className: "workbench-entry-title", text: title }),
      subtitle
        ? createElement("div", { className: "workbench-entry-subtitle", text: subtitle })
        : null
    ]),
    badges.length
      ? createElement("div", { className: "workbench-entry-badges" }, badges.map((badge) => createTag(badge.text, {
        color: badge.tone || "var(--text-muted)",
        borderColor: `${badge.tone || "var(--border)"}55`,
        background: "var(--bg)"
      })))
      : null
  ]);

  entry.append(top);

  if (detail) {
    entry.append(createElement("div", { className: "workbench-entry-detail", text: detail }));
  }

  if (meta.length) {
    entry.append(createElement("div", { className: "workbench-entry-meta" }, meta.map((line) => createElement("span", { text: line }))));
  }

  if (actions.length) {
    entry.append(createElement("div", { className: "workbench-entry-actions" }, actions));
  }

  return entry;
}

/**
 * @param {{
 *   title: string,
 *   copy: string
 * }} config
 */
export function createWorkbenchLaunchCard({ title, copy }) {
  return createElement("div", { className: "workbench-launch-card" }, [
    createElement("div", { className: "workbench-launch-title", text: title }),
    createElement("div", { className: "workbench-launch-copy", text: copy })
  ]);
}
