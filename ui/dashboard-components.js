// @ts-check

import { encodeAppId, getColor } from "./dashboard-utils.js";

/**
 * @typedef {import("./dashboard-types.js").AuditProject} AuditProject
 * @typedef {import("./dashboard-types.js").AuditSummary} AuditSummary
 * @typedef {import("./dashboard-types.js").DashboardRuntimeState} DashboardRuntimeState
 * @typedef {import("./dashboard-types.js").GovernancePayload} GovernancePayload
 * @typedef {import("./dashboard-types.js").PanelLoadStatus} PanelLoadStatus
 * @typedef {import("./dashboard-types.js").PersistedFinding} PersistedFinding
 * @typedef {import("./dashboard-types.js").ScanDiffPayload} ScanDiffPayload
 */

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
 * @param {string} label
 * @param {string} value
 */
function createSelectOption(label, value) {
  const option = createElement("option", { text: label });
  option.value = value;
  return option;
}

/**
 * @param {string} text
 * @param {Partial<CSSStyleDeclaration>} [style]
 */
export function createTag(text, style = {}) {
  return createElement("span", { className: "tag", text, style });
}

/**
 * @param {GovernancePayload} governance
 * @returns {import("./dashboard-types.js").GovernanceAgentExecutionMetrics}
 */
function getAgentExecutionMetrics(governance) {
  const statusCounts = {
    queued: 0,
    running: 0,
    blocked: 0,
    passed: 0,
    failed: 0,
    cancelled: 0,
    other: 0,
    ...(governance.agentExecutionMetrics?.statusCounts || {})
  };

  return {
    total: governance.summary.agentWorkOrderRunCount,
    active: governance.summary.activeAgentWorkOrderRunCount,
    completed: 0,
    staleActive: governance.summary.staleAgentWorkOrderRunCount || 0,
    slaBreached: governance.summary.slaBreachedAgentWorkOrderRunCount || 0,
    slaResolved: 0,
    slaAverageResolutionHours: 0,
    staleThresholdHours: governance.agentExecutionPolicy?.staleThresholdHours || 24,
    staleStatuses: governance.agentExecutionPolicy?.staleStatuses || ["queued", "running", "blocked"],
    completionRate: 0,
    failureRate: 0,
    latestEventAt: "",
    latestEventNote: "",
    latestEventStatus: "",
    latestEventProjectName: "",
    latestEventRunTitle: "",
    ...(governance.agentExecutionMetrics || {}),
    statusCounts
  };
}

/**
 * @param {import("./dashboard-types.js").PersistedAgentWorkOrderRun} run
 * @param {number} staleThresholdHours
 * @param {string[]} staleStatuses
 */
function isStaleAgentWorkOrderRun(run, staleThresholdHours = 24, staleStatuses = ["queued", "running", "blocked"]) {
  if (!staleStatuses.includes(run.status)) return false;
  const timestamp = new Date(run.updatedAt || run.createdAt).getTime();
  return Number.isFinite(timestamp) && timestamp < Date.now() - (staleThresholdHours * 60 * 60 * 1000);
}

/**
 * @param {string} label
 * @param {string} value
 * @param {string} tone
 */
export function createStatusPill(label, value, tone = "var(--text-muted)") {
  return createElement("div", {
    className: "status-pill",
    style: {
      color: tone,
      borderColor: `${tone}55`
    }
  }, [
    createElement("span", {
      text: label,
      style: {
        color: "var(--text-muted)",
        textTransform: "uppercase",
        fontSize: "0.7rem",
        letterSpacing: "0.05em"
      }
    }),
    createElement("span", {
      text: value,
      style: {
        color: tone
      }
    })
  ]);
}

/**
 * @param {string} text
 * @param {string} [color]
 */
export function createMessage(text, color = "var(--text-muted)") {
  return createElement("p", {
    text,
    style: { color }
  });
}

/**
 * @param {{
 *   title: string,
 *   message: string,
 *   tone?: string
 * }} config
 */
export function createPanelNotice({ title, message, tone = "var(--text-muted)" }) {
  return createElement("div", {
    className: "panel-notice",
    style: { borderColor: `${tone}33` }
  }, [
    createElement("div", {
      className: "panel-notice-title",
      text: title,
      style: { color: tone === "var(--text-muted)" ? "var(--text)" : tone }
    }),
    createElement("div", {
      className: "panel-notice-copy",
      text: message
    })
  ]);
}

/**
 * @param {HTMLSelectElement} select
 * @param {{
 *   allLabel: string,
 *   options: string[],
 *   formatLabel?: (value: string) => string
 * }} config
 */
export function populateSelect(select, { allLabel, options, formatLabel = (value) => value }) {
  const fragment = document.createDocumentFragment();
  fragment.append(createSelectOption(allLabel, "all"));
  for (const option of options) {
    fragment.append(createSelectOption(formatLabel(option), option));
  }
  select.replaceChildren(fragment);
}

/**
 * @param {{
 *   accentColor: string,
 *   label: string,
 *   value: string,
 *   detail: string,
 *   valueColor?: string,
 *   detailTitle?: string
 * }} config
 */
export function createKpiCard({ accentColor, label, value, detail, valueColor, detailTitle }) {
  const card = createElement("div", { className: "kpi-card" });
  card.style.setProperty("--kpi-accent", accentColor);

  const valueNode = createElement("div", {
    className: "kpi-value",
    text: value
  });
  if (valueColor) {
    valueNode.style.color = valueColor;
  }

  const detailNode = createElement("div", {
    text: detail,
    title: detailTitle,
    style: {
      color: "var(--text-muted)",
      fontSize: "0.85rem",
      whiteSpace: detailTitle ? "nowrap" : "",
      overflow: detailTitle ? "hidden" : "",
      textOverflow: detailTitle ? "ellipsis" : ""
    }
  });

  appendChildren(card, [
    createElement("div", { className: "kpi-label", text: label }),
    valueNode,
    detailNode
  ]);

  return card;
}

/**
 * @param {string} title
 * @param {string} message
 */
export function createEmptyCard(title, message) {
  return createElement("div", { className: "app-card" }, [
    createElement("h3", { className: "app-title", text: title }),
    createElement("p", { className: "app-desc", text: message })
  ]);
}

/**
 * @param {AuditProject} project
 */
export function createAppCard(project) {
  const title = createElement("h3", { className: "app-title" }, [project.name]);
  if (project.warnings?.length) {
    title.append(createElement("span", {
      text: `💡${project.warnings.length}`,
      title: `${project.warnings.length} insights`,
      style: {
        marginLeft: "0.5rem",
        fontSize: "0.85rem",
        background: "var(--surface-hover)",
        color: "var(--text)",
        padding: "0.15rem 0.5rem",
        borderRadius: "999px",
        fontWeight: "600",
        border: "1px solid var(--border)"
      }
    }));
  }

  const card = createElement("div", {
    className: "app-card",
    dataset: { openAppId: encodeAppId(project.id) }
  }, [
    createElement("div", { className: "app-header" }, [
      title,
      createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end"
        }
      }, [
        createElement("span", {
          text: String(project.qualityScore),
          style: {
            color: getColor(project.qualityScore),
            fontWeight: "800",
            fontSize: "1.2rem"
          }
        }),
        createElement("span", {
          text: "Health",
          style: {
            fontSize: "0.65rem",
            color: "var(--text-muted)",
            textTransform: "uppercase"
          }
        })
      ])
    ]),
    createElement("div", { className: "tags" }, [
      createTag(project.zone.toUpperCase(), {
        background: "var(--surface-hover)",
        color: "var(--text)",
        border: "none"
      }),
      createTag(project.category, {
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      })
    ]),
    createElement("p", { className: "app-desc", text: project.description }),
    createElement("div", {
      className: "tags",
      style: {
        marginTop: "auto",
        paddingTop: "1.5rem",
        borderTop: "1px solid var(--border)"
      }
    }, [
      ...project.frameworks.slice(0, 4).map((framework) => createTag(framework)),
      project.frameworks.length > 4
        ? createTag(`+${project.frameworks.length - 4}`, {
          background: "var(--primary)",
          color: "white",
          border: "none"
        })
        : null
    ])
  ]);

  return card;
}

/**
 * @param {AuditProject} project
 */
export function createAppTableRow(project) {
  return createElement("tr", {
    dataset: { openAppId: encodeAppId(project.id) }
  }, [
    createElement("td", {}, [
      createElement("div", {
        text: project.name,
        style: {
          fontWeight: "600",
          fontSize: "1.05rem"
        }
      }),
      createElement("div", {
        text: project.relPath,
        style: {
          fontSize: "0.8rem",
          color: "var(--text-muted)",
          marginTop: "0.25rem"
        }
      })
    ]),
    createElement("td", {}, [
      createTag(project.zone.toUpperCase(), {
        background: "var(--surface-hover)",
        border: "none"
      })
    ]),
    createElement("td", { text: project.category }),
    createElement("td", {}, [
      createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "0.5rem"
        }
      }, [
        createElement("div", {
          style: {
            width: "40px",
            height: "6px",
            background: "var(--bg)",
            borderRadius: "3px",
            overflow: "hidden"
          }
        }, [
          createElement("div", {
            style: {
              height: "100%",
              background: getColor(project.qualityScore),
              width: `${project.qualityScore}%`
            }
          })
        ]),
        createElement("strong", {
          text: String(project.qualityScore),
          style: { color: getColor(project.qualityScore) }
        })
      ])
    ]),
    createElement("td", {}, [
      createElement("div", { className: "tags", style: { gap: "0.25rem" } }, [
        ...project.frameworks.slice(0, 3).map((framework) => createTag(framework, {
          fontSize: "0.7rem",
          padding: "0.1rem 0.5rem"
        }))
      ])
    ]),
    createElement("td", {}, [
      createElement("strong", {
        text: String(project.sourceFiles),
        style: {
          fontSize: "1.1rem"
        }
      }),
      " ",
      createElement("span", {
        text: "files",
        style: {
          fontSize: "0.8rem",
          color: "var(--text-muted)"
        }
      })
    ])
  ]);
}

/**
 * @param {import("./dashboard-types.js").DataSourceHealthRecord | { type: string, url?: string, path?: string, addedAt?: string }} source
 */
export function createSourceItem(source) {
  const health = "health" in source ? source.health : "review";
  const status = "status" in source ? source.status : "registered";
  const issue = "issue" in source ? source.issue : "";
  const access = "access" in source ? source.access : null;
  const accessMethod = access?.accessMethod || "review-required";
  const accessRequiresReview = access?.requiresReview === true;
  const credentialHints = Array.isArray(access?.credentialHints) ? access.credentialHints.slice(0, 3) : [];
  const healthColor = health === "ready"
    ? "var(--success)"
    : health === "blocked"
      ? "var(--danger)"
      : "var(--warning)";
  return createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "1rem",
      background: "var(--bg)",
      border: "1px solid var(--border)",
      borderRadius: "0.5rem",
      borderLeft: `4px solid ${healthColor}`,
      gap: "1rem"
    }
  }, [
    createElement("div", {}, [
      createElement("div", {
        text: "label" in source ? source.label : source.type,
        style: {
          fontWeight: "600",
          textTransform: "uppercase",
          fontSize: "0.8rem",
          color: healthColor,
          marginBottom: "0.25rem"
        }
      }),
      createElement("div", {
        text: ("value" in source ? source.value : "") || source.url || source.path || "",
        style: {
          fontFamily: "var(--font-mono)",
          color: "var(--text)"
        }
      }),
      createElement("div", {
        text: issue || `Status: ${status}`,
        style: {
          color: issue ? "var(--warning)" : "var(--text-muted)",
          fontSize: "0.82rem",
          marginTop: "0.35rem"
        }
      }),
      createElement("div", {
        text: `Access: ${accessMethod}${accessRequiresReview ? " (review required)" : ""}`,
        style: {
          color: accessRequiresReview ? "var(--warning)" : "var(--text-muted)",
          fontSize: "0.82rem",
          marginTop: "0.35rem"
        }
      }),
      credentialHints.length
        ? createElement("div", {
            text: `Credentials: ${credentialHints.join("; ")}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.78rem",
              marginTop: "0.25rem",
              maxWidth: "44rem"
            }
          })
        : null,
      access?.secretPolicy
        ? createElement("div", {
            text: "Secrets are not stored in this registry.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.76rem",
              marginTop: "0.25rem"
            }
          })
        : null
    ]),
    createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem",
        alignItems: "flex-end"
      }
    }, [
      createTag(health.toUpperCase(), {
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: healthColor
      }),
      createTag(accessRequiresReview ? "ACCESS REVIEW" : "ACCESS OK", {
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: accessRequiresReview ? "var(--warning)" : "var(--success)"
      }),
      createElement("div", {
        text: source.addedAt ? `Added: ${new Date(source.addedAt).toLocaleDateString()}` : "Default",
        style: {
          fontSize: "0.8rem",
          color: "var(--text-muted)"
        }
      }),
      "id" in source
        ? createElement("button", {
            className: "btn governance-action-btn source-remove-btn",
            text: "Remove",
            attrs: { type: "button" },
            dataset: {
              sourceRemoveId: source.id
            },
            style: {
              marginTop: "0.25rem"
            }
          })
        : null
    ])
  ]);
}

/**
 * @param {import("./dashboard-types.js").PersistedDataSourcesSummarySnapshot} snapshot
 */
export function createDataSourcesSummarySnapshotItem(snapshot) {
  const healthColor = snapshot.blocked > 0
    ? "var(--danger)"
    : snapshot.review > 0
      ? "var(--warning)"
      : "var(--success)";
  return createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "1rem",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "0.65rem",
      gap: "1rem"
    }
  }, [
    createElement("div", {}, [
      createElement("div", {
        text: snapshot.title || "Data Sources Health Summary",
        style: {
          fontWeight: "800",
          color: "var(--text)",
          marginBottom: "0.25rem"
        }
      }),
      createElement("div", {
        text: new Date(snapshot.createdAt).toLocaleString(),
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem"
        }
      }),
      createElement("div", {
        text: `${snapshot.total} total | ${snapshot.ready} ready | ${snapshot.review} review | ${snapshot.blocked} blocked`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          marginTop: "0.35rem"
        }
      })
    ]),
    createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "0.5rem"
      }
    }, [
      createTag(snapshot.blocked > 0 ? "BLOCKED" : snapshot.review > 0 ? "REVIEW" : "READY", {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: healthColor
      }),
      createElement("button", {
        className: "btn governance-action-btn data-source-summary-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: {
          sourceSummarySnapshotId: snapshot.id
        }
      })
    ])
  ]);
}

/**
 * @param {PersistedFinding} finding
 */
export function createFindingItem(finding) {
  const tone = finding.severity === "high"
    ? "var(--danger)"
    : finding.severity === "medium"
      ? "var(--warning)"
      : "var(--primary)";

  return createElement("div", {
    className: "finding-card",
    style: {
      borderLeft: `4px solid ${tone}`
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "1rem"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.35rem"
        }
      }, [
        createElement("div", {
          text: finding.title,
          style: {
            fontSize: "1rem",
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: finding.projectName || finding.projectId || "Portfolio finding",
          style: {
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em"
          }
        })
      ]),
      createTag(finding.severity.toUpperCase(), {
        color: tone,
        border: `1px solid ${tone}55`,
        background: "var(--bg)"
      })
    ]),
    createElement("p", {
      text: finding.detail,
      style: {
        color: "var(--text-muted)",
        lineHeight: "1.55"
      }
    }),
    createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: "0.5rem"
      }
    }, [
      createTag(finding.category, {
        background: "var(--surface-hover)",
        border: "1px solid var(--border)"
      }),
      createTag(finding.status, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      }),
      createTag(new Date(finding.createdAt).toLocaleDateString(), {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      })
    ])
  ]);
}

/**
 * @param {AuditSummary} earliest
 * @param {AuditSummary} latest
 */
export function createTrendSummaryGrid(earliest, latest) {
  return createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "1rem"
    }
  }, [
    createKpiCard({
      accentColor: "var(--primary)",
      label: "Health Score Trend",
      value: `${earliest.avgQuality} -> ${latest.avgQuality}`,
      detail: "Average quality movement across snapshots"
    }),
    createKpiCard({
      accentColor: "var(--success)",
      label: "Source File Count",
      value: `${earliest.totalSource} -> ${latest.totalSource}`,
      detail: "Tracked source files across the workspace"
    }),
    createKpiCard({
      accentColor: "var(--warning)",
      label: "Total Test Files",
      value: `${earliest.totalTests} -> ${latest.totalTests}`,
      detail: "Observed test inventory over time"
    })
  ]);
}

/**
 * @param {number} value
 */
function formatSigned(value) {
  if (!value) return "0";
  return `${value > 0 ? "+" : ""}${value}`;
}

/**
 * @param {string} title
 * @param {string} subtitle
 * @param {Node[]} content
 */
function createSectionCard(title, subtitle, content) {
  return createElement("div", {
    style: {
      padding: "1.2rem 1.25rem",
      background: "var(--bg)",
      border: "1px solid var(--border)",
      borderRadius: "1rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.9rem"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem"
      }
    }, [
      createElement("div", {
        text: title,
        style: {
          fontSize: "1rem",
          fontWeight: "800",
          color: "var(--text)"
        }
      }),
      createElement("div", {
        text: subtitle,
        style: {
          fontSize: "0.85rem",
          color: "var(--text-muted)",
          lineHeight: "1.45"
        }
      })
    ]),
    ...content
  ]);
}

/**
 * @param {ScanDiffPayload} scanDiff
 */
export function createTrendDiffSummary(scanDiff) {
  return createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: "1rem"
    }
  }, [
    createKpiCard({
      accentColor: "var(--primary)",
      label: "Workspace Delta",
      value: formatSigned(scanDiff.totals.appDelta),
      detail: `${scanDiff.totals.addedCount} added • ${scanDiff.totals.removedCount} removed`
    }),
    createKpiCard({
      accentColor: scanDiff.totals.qualityDelta >= 0 ? "var(--success)" : "var(--danger)",
      label: "Quality Movement",
      value: formatSigned(scanDiff.totals.qualityDelta),
      detail: `${scanDiff.totals.changedCount} projects changed`
    }),
    createKpiCard({
      accentColor: scanDiff.totals.sourceDelta >= 0 ? "var(--primary)" : "var(--warning)",
      label: "Source Files Delta",
      value: formatSigned(scanDiff.totals.sourceDelta),
      detail: "Code inventory movement between the latest scans"
    }),
    createKpiCard({
      accentColor: scanDiff.totals.testDelta >= 0 ? "var(--success)" : "var(--warning)",
      label: "Test Files Delta",
      value: formatSigned(scanDiff.totals.testDelta),
      detail: "Observed test coverage movement between the latest scans"
    })
  ]);
}

/**
 * @param {string} title
 * @param {string} subtitle
 * @param {Array<Node>} entries
 */
function createListSection(title, subtitle, entries) {
  const content = entries.length
    ? entries
    : [
        createElement("div", {
          text: "No items in this slice.",
          style: {
            color: "var(--text-muted)",
            fontSize: "0.88rem",
            lineHeight: "1.5"
          }
        })
      ];
  return createSectionCard(title, subtitle, content);
}

/**
 * @param {ScanDiffPayload} scanDiff
 */
export function createScanDiffBreakdown(scanDiff) {
  const windowCard = createSectionCard("Comparison Window", "The latest two persisted scans used for diffing.", [
    createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: "0.6rem"
      }
    }, [
      createTag(`Latest: ${scanDiff.latestGeneratedAt ? new Date(scanDiff.latestGeneratedAt).toLocaleString() : "Unknown"}`),
      createTag(`Previous: ${scanDiff.previousGeneratedAt ? new Date(scanDiff.previousGeneratedAt).toLocaleString() : "Unknown"}`)
    ])
  ]);

  if (scanDiff.status === "insufficient_data") {
    return createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "1rem"
      }
    }, [
      windowCard,
      createPanelNotice({
        title: "Diff unavailable",
        message: "At least two persisted scans are required before project-level diffing can be calculated.",
        tone: "var(--warning)"
      })
    ]);
  }

  if (scanDiff.status === "summary_only") {
    return createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "1rem"
      }
    }, [
      windowCard,
      createPanelNotice({
        title: "Project-level diff warming up",
        message: "Summary deltas are available, but one of the latest scans predates project snapshot persistence. The next scan will unlock project-level change lists.",
        tone: "var(--warning)"
      })
    ]);
  }

  const changeEntries = scanDiff.topChanges.map((change) => createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.35rem",
      padding: "0.95rem 1rem",
      borderRadius: "0.9rem",
      border: "1px solid var(--border)",
      background: "color-mix(in srgb, var(--surface-hover) 52%, transparent 48%)"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: "1rem",
        alignItems: "flex-start"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem"
        }
      }, [
        createElement("div", {
          text: change.name,
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: change.relPath,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.8rem",
            fontFamily: "var(--font-mono)"
          }
        })
      ]),
      createTag(`Impact ${change.changeScore}`, {
        border: "1px solid var(--border)",
        background: "var(--bg)"
      })
    ]),
    createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: "0.5rem"
      }
    }, [
      createTag(`Q ${formatSigned(change.qualityDelta)}`),
      createTag(`Src ${formatSigned(change.sourceDelta)}`),
      createTag(`Tests ${formatSigned(change.testDelta)}`),
      createTag(`Docs ${formatSigned(change.docsDelta)}`),
      createTag(`Warn ${formatSigned(change.warningsDelta)}`)
    ])
  ]));

  const addedEntries = scanDiff.addedProjects.map((project) => createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.25rem"
    }
  }, [
    createElement("div", {
      text: project.name,
      style: {
        fontWeight: "700",
        color: "var(--text)"
      }
    }),
    createElement("div", {
      text: `${project.category} • ${project.relPath}`,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.84rem",
        lineHeight: "1.45"
      }
    })
  ]));

  const removedEntries = scanDiff.removedProjects.map((project) => createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.25rem"
    }
  }, [
    createElement("div", {
      text: project.name,
      style: {
        fontWeight: "700",
        color: "var(--text)"
      }
    }),
    createElement("div", {
      text: `${project.category} • ${project.relPath}`,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.84rem",
        lineHeight: "1.45"
      }
    })
  ]));

  return createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
      gap: "1rem",
      marginTop: "1rem"
    }
  }, [
    windowCard,
    createListSection("Top Project Changes", "Largest per-project movement between the two latest persisted scans.", changeEntries),
    createListSection("Added Projects", "Projects present in the latest scan but not the previous one.", addedEntries),
    createListSection("Removed Projects", "Projects present in the previous scan but not the latest one.", removedEntries)
  ]);
}

/**
 * @param {Array<{ date: string, summary: AuditSummary }>} historyData
 */
export function createTrendHistory(historyData) {
  const tbody = createElement("tbody");
  for (const entry of historyData.slice().reverse()) {
    tbody.append(createElement("tr", {}, [
      createElement("td", { text: entry.date }),
      createElement("td", { text: String(entry.summary.totalApps) }),
      createElement("td", { text: String(entry.summary.avgQuality) }),
      createElement("td", { text: String(entry.summary.totalSource) }),
      createElement("td", { text: String(entry.summary.totalTests) })
    ]));
  }

  return createElement("div", {
    style: {
      marginTop: "1rem",
      padding: "1.5rem",
      background: "var(--bg)",
      border: "1px solid var(--border)",
      borderRadius: "1rem"
    }
  }, [
    createElement("h3", {
      text: "Snapshot History Log",
      style: {
        marginBottom: "1rem",
        fontSize: "1.1rem"
      }
    }),
    createElement("table", {
      className: "app-table",
      style: { width: "100%" }
    }, [
      createElement("thead", {}, [
        createElement("tr", {}, [
          createElement("th", { text: "Date" }),
          createElement("th", { text: "Apps" }),
          createElement("th", { text: "Health" }),
          createElement("th", { text: "Source Files" }),
          createElement("th", { text: "Tests" })
        ])
      ]),
      tbody
    ])
  ]);
}

/**
 * @param {GovernancePayload} governance
 */
export function createGovernanceSummaryGrid(governance) {
  const summary = governance.summary;
  const executionMetrics = getAgentExecutionMetrics(governance);
  const hasControlPlaneBaseline = Boolean(summary.agentControlPlaneBaselineSnapshotId);
  const baselineCreatedAt = summary.agentControlPlaneBaselineSnapshotCreatedAt
    ? new Date(summary.agentControlPlaneBaselineSnapshotCreatedAt).toLocaleString()
    : "";
  const baselineFreshness = summary.agentControlPlaneBaselineFreshness || "missing";
  const baselineDriftScore = summary.agentControlPlaneBaselineDriftScore || 0;
  const baselineHealth = summary.agentControlPlaneBaselineHealth || "missing";
  const controlPlaneDecision = governance.agentControlPlaneDecision;
  const decision = controlPlaneDecision?.decision || "review";
  const decisionAccent = decision === "hold"
    ? "var(--danger)"
    : decision === "review"
      ? "var(--warning)"
      : "var(--success)";
  const dataSourcesAccessReviewSummary = governance.dataSourcesAccessReviewQueue?.summary || {};
  const dataSourcesAccessReviewCount = dataSourcesAccessReviewSummary.total || summary.dataSourcesAccessReviewQueueCount || 0;
  const dataSourcesAccessValidationRunbookSummary = governance.dataSourcesAccessValidationRunbook?.summary || {};
  const dataSourcesAccessValidationEvidenceCoverageSummary = governance.dataSourcesAccessValidationEvidenceCoverage?.summary || {};
  const evidenceSnapshotDriftSeverity = summary.dataSourceAccessValidationEvidenceSnapshotDriftSeverity || "missing-snapshot";
  const evidenceSnapshotDriftAccent = evidenceSnapshotDriftSeverity === "high" || evidenceSnapshotDriftSeverity === "missing-snapshot"
    ? "var(--danger)"
    : evidenceSnapshotDriftSeverity === "medium" || evidenceSnapshotDriftSeverity === "low"
      ? "var(--warning)"
      : "var(--success)";
  const dataSourcesAccessGate = governance.dataSourcesAccessGate;
  const dataSourcesAccessGateDecision = dataSourcesAccessGate?.decision || summary.dataSourcesAccessGateDecision || "not-evaluated";
  const dataSourcesAccessGateAccent = dataSourcesAccessGateDecision === "hold"
    ? "var(--danger)"
    : dataSourcesAccessGateDecision === "review"
      ? "var(--warning)"
      : dataSourcesAccessGateDecision === "ready"
        ? "var(--success)"
        : "var(--text-muted)";
  const releaseSummary = governance.releaseSummary;
  const releaseStatus = releaseSummary?.summary?.status || summary.releaseLatestCheckpointStatus || "review";
  const releaseAccent = releaseStatus === "hold"
    ? "var(--danger)"
    : releaseStatus === "ready"
      ? "var(--success)"
      : "var(--warning)";
  const releaseCheckpointCount = releaseSummary?.summary?.releaseCheckpointCount ?? summary.releaseCheckpointCount ?? 0;
  const releaseSmokeFailCount = releaseSummary?.summary?.deploymentSmokeCheckFailCount ?? summary.deploymentSmokeCheckFailCount ?? 0;
  const releaseSmokePassCount = releaseSummary?.summary?.deploymentSmokeCheckPassCount ?? summary.deploymentSmokeCheckPassCount ?? 0;
  const releaseCheckpointDrift = governance.releaseCheckpointDrift;
  const releaseDriftSeverity = releaseCheckpointDrift?.driftSeverity || "missing-checkpoint";
  const releaseBuildGate = governance.releaseBuildGate;
  const releaseBuildGateDecision = releaseBuildGate?.decision || "review";
  const releaseBuildGateAccent = releaseBuildGateDecision === "hold"
    ? "var(--danger)"
    : releaseBuildGateDecision === "ready"
      ? "var(--success)"
      : "var(--warning)";
  return createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "1rem"
    }
  }, [
    createKpiCard({
      accentColor: "var(--danger)",
      label: "Open Findings",
      value: String(summary.openFindings),
      detail: "Unresolved risks and overlap candidates"
    }),
    createKpiCard({
      accentColor: "var(--warning)",
      label: "Open Tasks",
      value: String(summary.openTasks),
      detail: "Outstanding delivery work across projects"
    }),
    createKpiCard({
      accentColor: "var(--primary)",
      label: "Active Workflows",
      value: String(summary.activeWorkflows),
      detail: "In-flight implementation and review streams"
    }),
    createKpiCard({
      accentColor: "var(--success)",
      label: "Pending Milestones",
      value: String(summary.pendingMilestones),
      detail: `${summary.decisionNotes} decisions across ${summary.trackedProjects} tracked projects`
    }),
    createKpiCard({
      accentColor: "var(--primary)",
      label: "Project Profiles",
      value: String(summary.profileCount),
      detail: `${summary.ownedProfiles} assigned owners in the governance registry`
    }),
    createKpiCard({
      accentColor: "var(--warning)",
      label: "Governance Gaps",
      value: String(governance.unprofiledProjects.length),
      detail: "Visible high-signal projects without a saved governance profile"
    }),
    createKpiCard({
      accentColor: "var(--primary)",
      label: "Action Queue",
      value: String(summary.actionQueueItems),
      detail: `${summary.suppressedQueueItems} suppressed items hidden from the active queue`
    }),
    createKpiCard({
      accentColor: "var(--success)",
      label: "Operation Log",
      value: String(summary.governanceOperationCount),
      detail: "Persisted automation actions across the Governance control loop"
    }),
    createKpiCard({
      accentColor: "var(--primary)",
      label: "Workflow Runbook",
      value: String(summary.workflowRunbookItems),
      detail: "Supervised workflow / agent-readiness checkpoints"
    }),
    createKpiCard({
      accentColor: "var(--success)",
      label: "Agent Sessions",
      value: String(summary.agentSessionCount),
      detail: "Prepared supervised agent handoffs across projects"
    }),
    createKpiCard({
      accentColor: !hasControlPlaneBaseline || baselineFreshness === "stale" || baselineDriftScore > 0 ? "var(--warning)" : "var(--success)",
      label: "Control Plane Baseline",
      value: baselineHealth.toUpperCase(),
      detail: hasControlPlaneBaseline
        ? `${summary.agentControlPlaneBaselineSnapshotTitle || "Agent Control Plane"} • ${baselineFreshness} • drift ${baselineDriftScore} • ${summary.agentControlPlaneBaselineAgeHours || 0}h old${baselineCreatedAt ? ` • ${baselineCreatedAt}` : ""}`
        : `${summary.agentControlPlaneSnapshotCount} saved snapshot(s), no baseline selected`
    }),
    createKpiCard({
      accentColor: decisionAccent,
      label: "Decision Gate",
      value: decision.toUpperCase(),
      detail: controlPlaneDecision?.recommendedAction || "Review the Agent Control Plane before the next supervised build."
    }),
    createKpiCard({
      accentColor: releaseAccent,
      label: "Release Control",
      value: releaseStatus.toUpperCase(),
      detail: releaseSummary
        ? `${releaseCheckpointCount} checkpoint(s) | smoke ${releaseSmokePassCount} pass / ${releaseSmokeFailCount} fail | drift ${releaseDriftSeverity}`
        : `${releaseCheckpointCount} saved checkpoint(s), live release summary not loaded`
    }),
    createKpiCard({
      accentColor: releaseBuildGateAccent,
      label: "Release Build Gate",
      value: releaseBuildGateDecision.toUpperCase(),
      detail: releaseBuildGate
        ? `${releaseBuildGate.reasons?.length || 0} reason(s) | risk ${releaseBuildGate.riskScore || 0}`
        : "Release build gate has not been evaluated."
    }),
    createKpiCard({
      accentColor: dataSourcesAccessGateAccent,
      label: "Source Access Gate",
      value: dataSourcesAccessGateDecision.toUpperCase(),
      detail: dataSourcesAccessGate
        ? `${dataSourcesAccessGate.ready || 0} ready | ${dataSourcesAccessGate.review || 0} review | ${dataSourcesAccessGate.blocked || 0} blocked`
        : "Data Sources access gate has not been evaluated."
    }),
    createKpiCard({
      accentColor: dataSourcesAccessReviewSummary.blocked || dataSourcesAccessReviewSummary.high
        ? "var(--danger)"
        : dataSourcesAccessReviewCount
          ? "var(--warning)"
          : "var(--success)",
      label: "Source Access Queue",
      value: String(dataSourcesAccessReviewCount),
      detail: `${dataSourcesAccessReviewSummary.blocked || 0} blocked | ${dataSourcesAccessReviewSummary.medium || 0} medium | ${dataSourcesAccessReviewSummary.methodCount || 0} method(s)`
    }),
    createKpiCard({
      accentColor: (dataSourcesAccessValidationRunbookSummary.blocked || summary.dataSourcesAccessValidationBlockedCount)
        ? "var(--danger)"
        : (dataSourcesAccessValidationRunbookSummary.review || summary.dataSourcesAccessValidationReviewCount)
          ? "var(--warning)"
          : "var(--success)",
      label: "Source Access Methods",
      value: String(dataSourcesAccessValidationRunbookSummary.methodCount || summary.dataSourcesAccessValidationMethodCount || 0),
      detail: `${dataSourcesAccessValidationRunbookSummary.sourceCount || summary.dataSourcesAccessValidationSourceCount || 0} source(s) covered by the non-secret validation runbook`
    }),
    createKpiCard({
      accentColor: (dataSourcesAccessValidationEvidenceCoverageSummary.blocked || summary.dataSourcesAccessValidationEvidenceCoverageBlockedCount || dataSourcesAccessValidationEvidenceCoverageSummary.highPriority || summary.dataSourcesAccessValidationEvidenceCoverageHighPriorityCount)
        ? "var(--danger)"
        : (dataSourcesAccessValidationEvidenceCoverageSummary.missing || summary.dataSourcesAccessValidationEvidenceCoverageMissingCount || dataSourcesAccessValidationEvidenceCoverageSummary.review || summary.dataSourcesAccessValidationEvidenceCoverageReviewCount)
          ? "var(--warning)"
          : "var(--success)",
      label: "Evidence Coverage",
      value: `${dataSourcesAccessValidationEvidenceCoverageSummary.coveragePercent ?? summary.dataSourcesAccessValidationEvidenceCoveragePercent ?? 0}%`,
      detail: `${dataSourcesAccessValidationEvidenceCoverageSummary.covered ?? summary.dataSourcesAccessValidationEvidenceCoverageCoveredCount ?? 0}/${dataSourcesAccessValidationEvidenceCoverageSummary.sourceCount ?? summary.dataSourcesAccessValidationEvidenceCoverageCount ?? 0} covered • ${dataSourcesAccessValidationEvidenceCoverageSummary.missing ?? summary.dataSourcesAccessValidationEvidenceCoverageMissingCount ?? 0} missing`
    }),
    createKpiCard({
      accentColor: summary.dataSourcesAccessValidationEvidenceBlockedCount
        ? "var(--danger)"
        : summary.dataSourcesAccessValidationEvidenceReviewCount
          ? "var(--warning)"
          : "var(--success)",
      label: "Source Evidence",
      value: `${summary.dataSourcesAccessValidationEvidenceValidatedCount || 0}/${summary.dataSourcesAccessValidationEvidenceCount || 0}`,
      detail: "Validated non-secret source-access evidence records"
    }),
    createKpiCard({
      accentColor: evidenceSnapshotDriftAccent,
      label: "Evidence Drift",
      value: evidenceSnapshotDriftSeverity.toUpperCase(),
      detail: `${summary.dataSourceAccessValidationEvidenceSnapshotCount || 0} snapshot(s) • drift score ${summary.dataSourceAccessValidationEvidenceSnapshotDriftScore || 0}`
    }),
    createKpiCard({
      accentColor: "var(--primary)",
      label: "Agent Ready",
      value: `${summary.agentReadyProjects}/${summary.agentReadinessItems}`,
      detail: "Projects ready for a supervised agent build pass"
    }),
    createKpiCard({
      accentColor: "var(--success)",
      label: "Work Orders",
      value: String(summary.agentWorkOrderSnapshotCount),
      detail: "Persisted Agent Work Order snapshots"
    }),
    createKpiCard({
      accentColor: "var(--primary)",
      label: "Execution Runs",
      value: `${summary.activeAgentWorkOrderRunCount}/${summary.agentWorkOrderRunCount}`,
      detail: `${executionMetrics.statusCounts.queued} queued | ${executionMetrics.statusCounts.running} running | ${executionMetrics.statusCounts.blocked} blocked | ${executionMetrics.archived || 0} archived`
    }),
    createKpiCard({
      accentColor: executionMetrics.staleActive || executionMetrics.statusCounts.failed ? "var(--warning)" : "var(--success)",
      label: "Execution Health",
      value: `${executionMetrics.completionRate}%`,
      detail: `${executionMetrics.staleActive} stale after ${executionMetrics.staleThresholdHours}h | ${executionMetrics.slaBreached || 0} SLA breached | ${executionMetrics.failureRate}% failure rate | ${executionMetrics.archived || 0} archived`
    }),
    createKpiCard({
      accentColor: "var(--primary)",
      label: "Profile History",
      value: String(governance.profileHistory.length),
      detail: "Recent ownership and lifecycle snapshots"
    })
  ]);
}

/**
 * @param {GovernancePayload} governance
 */
export function createGovernanceDeck(governance) {
  /**
   * @param {import("./dashboard-types.js").GovernanceActivity[]} items
   */
  function createActivityEntries(items) {
    return items.map((item) => createElement("div", {
      dataset: item.projectId ? { openAppId: encodeAppId(item.projectId) } : undefined,
      title: item.projectId ? "Open project workbench" : undefined,
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem",
        padding: "0.95rem 1rem",
        borderRadius: "0.9rem",
        border: "1px solid var(--border)",
        background: "color-mix(in srgb, var(--surface-hover) 48%, transparent 52%)"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          alignItems: "flex-start"
        }
      }, [
        createElement("div", {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem"
          }
        }, [
          createElement("div", {
            text: item.title,
            style: {
              fontWeight: "800",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: `${item.projectName} • ${item.kind}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.82rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }
          })
        ]),
        createTag(item.status || item.kind, {
          background: "var(--bg)",
          border: "1px solid var(--border)"
        })
      ]),
      item.detail
        ? createElement("div", {
            text: item.detail,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          })
        : null,
      createElement("div", {
        text: new Date(item.timestamp).toLocaleString(),
        style: {
          color: "var(--text-muted)",
          fontSize: "0.78rem"
        }
      })
    ]));
  }

  const workflowEntries = governance.workflowFocus.map((workflow) => createElement("div", {
    dataset: workflow.projectId ? { openAppId: encodeAppId(workflow.projectId) } : undefined,
    title: workflow.projectId ? "Open project workbench" : undefined,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.3rem"
    }
  }, [
    createElement("div", {
      text: workflow.title,
      style: {
        fontWeight: "700",
        color: "var(--text)"
      }
    }),
    createElement("div", {
      text: `${workflow.projectName || "Portfolio"} • ${workflow.phase} • ${workflow.status}`,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.84rem",
        lineHeight: "1.45"
      }
    })
  ]));

  const milestoneEntries = governance.milestoneFocus.map((milestone) => createElement("div", {
    dataset: milestone.projectId ? { openAppId: encodeAppId(milestone.projectId) } : undefined,
    title: milestone.projectId ? "Open project workbench" : undefined,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.3rem"
    }
  }, [
    createElement("div", {
      text: milestone.title,
      style: {
        fontWeight: "700",
        color: "var(--text)"
      }
    }),
    createElement("div", {
      text: `${milestone.projectName || "Portfolio"} • ${milestone.status}${milestone.targetDate ? ` • target ${milestone.targetDate}` : ""}`,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.84rem",
        lineHeight: "1.45"
      }
    })
  ]));

  const decisionEntries = governance.decisions.map((note) => createElement("div", {
    dataset: note.projectId ? { openAppId: encodeAppId(note.projectId) } : undefined,
    title: note.projectId ? "Open project workbench" : undefined,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.3rem"
    }
  }, [
    createElement("div", {
      text: note.title,
      style: {
        fontWeight: "700",
        color: "var(--text)"
      }
    }),
    createElement("div", {
      text: `${note.projectName || "Portfolio"} • ${new Date(note.updatedAt || note.createdAt).toLocaleString()}`,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.84rem",
        lineHeight: "1.45"
      }
    }),
    note.body
      ? createElement("div", {
          text: note.body,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.88rem",
            lineHeight: "1.5"
          }
        })
      : null
  ]));

  const profileEntries = governance.profiles.map((profile) => createElement("div", {
    dataset: profile.projectId ? { openAppId: encodeAppId(profile.projectId) } : undefined,
    title: profile.projectId ? "Open project workbench" : undefined,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.3rem"
    }
  }, [
    createElement("div", {
      text: profile.projectName,
      style: {
        fontWeight: "700",
        color: "var(--text)"
      }
    }),
    createElement("div", {
      text: `${profile.owner || "Owner not set"} • ${profile.status} • ${profile.lifecycle} • ${profile.tier}`,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.84rem",
        lineHeight: "1.45"
      }
    }),
    profile.summary
      ? createElement("div", {
          text: profile.summary,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.88rem",
            lineHeight: "1.5"
          }
        })
      : null
  ]));

  const historyEntries = governance.profileHistory.map((entry) => {
    const detailParts = [];
    if (entry.changeType === "created") {
      detailParts.push("Initial governance profile captured.");
    } else if (entry.changedFields.length) {
      detailParts.push(`Changed: ${entry.changedFields.join(", ")}`);
    }

    if (entry.previous && entry.next && entry.previous.owner !== entry.next.owner) {
      detailParts.push(`Owner ${entry.previous.owner || "unassigned"} -> ${entry.next.owner || "unassigned"}`);
    }
    if (entry.previous && entry.next && entry.previous.lifecycle !== entry.next.lifecycle) {
      detailParts.push(`Lifecycle ${entry.previous.lifecycle || "unset"} -> ${entry.next.lifecycle || "unset"}`);
    }
    if (entry.previous && entry.next && entry.previous.status !== entry.next.status) {
      detailParts.push(`Status ${entry.previous.status || "unset"} -> ${entry.next.status || "unset"}`);
    }

    return createElement("div", {
      dataset: entry.projectId ? { openAppId: encodeAppId(entry.projectId) } : undefined,
      title: entry.projectId ? "Open project workbench" : undefined,
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.3rem"
      }
    }, [
      createElement("div", {
        text: entry.projectName,
        style: {
          fontWeight: "700",
          color: "var(--text)"
        }
      }),
      createElement("div", {
        text: `${entry.changeType.toUpperCase()} • ${new Date(entry.changedAt).toLocaleString()}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        text: detailParts.join(" • ") || "Governance profile snapshot recorded.",
        style: {
          color: "var(--text-muted)",
          fontSize: "0.88rem",
          lineHeight: "1.5"
        }
      })
    ]);
  });

  const gapEntries = governance.unprofiledProjects.map((project) => createElement("div", {
    className: "governance-gap-card",
    dataset: { openAppId: encodeAppId(project.id) },
    title: "Open project workbench",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.6rem"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.3rem"
      }
    }, [
      createElement("div", {
        text: project.name,
        style: {
          fontWeight: "700",
          color: "var(--text)"
        }
      }),
      createElement("div", {
        text: `${project.category} • ${project.zone} • health ${project.qualityScore}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        text: `${project.findingCount} open findings • ${project.relPath}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      })
    ]),
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn",
        text: "Create Profile",
        attrs: { type: "button" },
        dataset: {
          governanceAction: "create-profile",
          projectId: encodeAppId(project.id),
          projectName: project.name
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn",
        text: "Create Task",
        attrs: { type: "button" },
        dataset: {
          governanceAction: "create-task",
          projectId: encodeAppId(project.id),
          projectName: project.name
        }
      })
    ])
  ]));
  const queueEntries = governance.actionQueue.map((item) => createElement("div", {
    className: "governance-gap-card",
    dataset: { openAppId: encodeAppId(item.projectId) },
    title: "Open project workbench",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.6rem"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: "0.8rem",
        alignItems: "flex-start"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.3rem"
        }
      }, [
        createElement("div", {
          text: item.title,
          style: {
            fontWeight: "700",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${item.projectName} • ${item.kind}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45",
            textTransform: "uppercase",
            letterSpacing: "0.05em"
          }
        })
      ]),
      createTag(item.priority.toUpperCase(), {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: item.priority === "high" ? "var(--danger)" : item.priority === "medium" ? "var(--warning)" : "var(--text-muted)"
      })
    ]),
    createElement("div", {
      text: item.detail,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn",
        text: item.actionLabel,
        attrs: { type: "button" },
        dataset: {
          governanceAction: item.actionType,
          projectId: encodeAppId(item.projectId),
          projectName: item.projectName
        }
      })
    ])
  ]));
  const suppressedQueueEntries = governance.queueSuppressions.map((item) => createElement("div", {
    className: "governance-gap-card",
    dataset: { openAppId: encodeAppId(item.projectId) },
    title: "Open project workbench",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.6rem",
      opacity: "0.86"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: "0.8rem",
        alignItems: "flex-start"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.3rem"
        }
      }, [
        createElement("div", {
          text: item.title,
          style: {
            fontWeight: "700",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${item.projectName} • ${item.kind}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45",
            textTransform: "uppercase",
            letterSpacing: "0.05em"
          }
        })
      ]),
      createTag("SUPPRESSED", {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: "var(--text-muted)"
      })
    ]),
    createElement("div", {
      text: item.reason,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    createElement("div", {
      text: `Suppressed ${new Date(item.suppressedAt).toLocaleString()}`,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.78rem"
      }
    }),
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn",
        text: "Restore",
        attrs: { type: "button" },
        dataset: {
          governanceAction: "restore-suppressed",
          queueItemId: item.id,
          projectId: encodeAppId(item.projectId),
          projectName: item.projectName
        }
      })
    ])
  ]));
  const operationEntries = governance.operationLog.map((operation) => {
    const totals = operation.details && typeof operation.details === "object" && "totals" in operation.details
      ? /** @type {Record<string, unknown>} */ (operation.details.totals)
      : {};
    const totalSummary = Object.entries(totals)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(" • ");

    return createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem",
        padding: "0.95rem 1rem",
        borderRadius: "0.9rem",
        border: "1px solid var(--border)",
        background: "color-mix(in srgb, var(--primary) 8%, var(--bg) 92%)"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          alignItems: "flex-start"
        }
      }, [
        createElement("div", {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem"
          }
        }, [
          createElement("div", {
            text: operation.summary,
            style: {
              fontWeight: "800",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: `${operation.actor || "workspace-audit"} • ${new Date(operation.createdAt).toLocaleString()}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.82rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(operation.type, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        })
      ]),
      totalSummary
        ? createElement("div", {
            text: totalSummary,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          })
      : null
    ]);
  });
  const workflowRunbookEntries = governance.workflowRunbook.map((item) => createElement("div", {
    className: "governance-gap-card",
    dataset: { openAppId: encodeAppId(item.projectId) },
    title: "Open project workbench",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.6rem"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: "0.8rem",
        alignItems: "flex-start"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.3rem"
        }
      }, [
        createElement("div", {
          text: item.title,
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${item.projectName} • ${item.phase} • ${item.status}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45",
            textTransform: "uppercase",
            letterSpacing: "0.05em"
          }
        })
      ]),
      createTag(item.readiness, {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: item.priority === "high" ? "var(--warning)" : "var(--text-muted)"
      })
    ]),
    createElement("div", {
      text: item.nextStep,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    createElement("div", {
      className: "tags"
    }, [
      createTag(`Updated ${new Date(item.updatedAt).toLocaleString()}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      }),
      ...(item.blockers.length
        ? item.blockers.map((blocker) => createTag(blocker, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: "var(--danger)"
          }))
        : [createTag("no blockers", {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: "var(--success)"
          })])
    ])
  ]));

  const agentSessionEntries = governance.agentSessions.map((session) => createElement("div", {
    className: "governance-gap-card",
    dataset: session.projectId ? { openAppId: encodeAppId(session.projectId) } : undefined,
    title: session.projectId ? "Open project workbench" : undefined,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.6rem"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: "0.8rem",
        alignItems: "flex-start"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.3rem"
        }
      }, [
        createElement("div", {
          text: session.title,
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${session.projectName || "Portfolio"} • ${new Date(session.updatedAt || session.createdAt).toLocaleString()}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      ]),
      createTag(session.status || "prepared", {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: "var(--text-muted)"
      })
    ]),
    session.summary
      ? createElement("div", {
          text: session.summary,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.88rem",
            lineHeight: "1.5"
          }
        })
      : null,
    createElement("div", {
      className: "tags"
    }, [
      createTag("handoff captured", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--success)"
      }),
      createTag(`${(session.handoffPack || "").length} chars`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      })
    ])
  ]));

  /**
   * @param {import("./dashboard-types.js").GovernanceAgentReadinessItem} item
   */
  function getAgentReadinessAction(item) {
    const firstBlocker = item.blockers[0] || "";
    if (firstBlocker === "profile missing") {
      return { action: "create-starter-pack", label: "Seed Starter Pack" };
    }
    if (firstBlocker === "owner missing") {
      return { action: "open-project", label: "Assign Owner" };
    }
    if (firstBlocker === "active workflow missing") {
      return { action: "create-workflow", label: "Create Workflow" };
    }
    if (firstBlocker.includes("open finding")) {
      return { action: "open-project", label: "Review Findings" };
    }
    if (firstBlocker === "open execution task missing") {
      return { action: "create-task", label: "Create Task" };
    }
    if (firstBlocker === "agent handoff missing") {
      return { action: "open-project", label: "Open Launchpad" };
    }
    return null;
  }

  const agentReadinessEntries = governance.agentReadinessMatrix.map((item) => createElement("div", {
    className: "governance-gap-card",
    dataset: item.projectId ? { openAppId: encodeAppId(item.projectId) } : undefined,
    title: item.projectId ? "Open project workbench" : undefined,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.6rem"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: "0.8rem",
        alignItems: "flex-start"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.3rem"
        }
      }, [
        createElement("div", {
          text: item.projectName,
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${item.owner || "Owner not set"} • ${item.lifecycle || "lifecycle unset"} • target ${item.targetState || "unset"}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      ]),
      createTag(`${item.status} ${item.score}`, {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: item.status === "ready" ? "var(--success)" : item.status === "needs-prep" ? "var(--warning)" : "var(--danger)"
      })
    ]),
    createElement("div", {
      text: item.nextStep,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    createElement("div", {
      className: "tags"
    }, [
      createTag(`${item.openFindingCount} findings`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.openFindingCount ? "var(--danger)" : "var(--success)"
      }),
      createTag(`${item.openTaskCount} tasks`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.openTaskCount ? "var(--success)" : "var(--warning)"
      }),
      createTag(`${item.activeWorkflowCount} workflows`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.activeWorkflowCount ? "var(--success)" : "var(--warning)"
      }),
      createTag(`${item.agentSessionCount} handoffs`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.agentSessionCount ? "var(--success)" : "var(--warning)"
      })
    ]),
    getAgentReadinessAction(item)
      ? createElement("div", {
          className: "governance-actions"
        }, [
          createElement("button", {
            className: "btn governance-action-btn readiness-action-btn",
            text: getAgentReadinessAction(item).label,
            attrs: { type: "button" },
            dataset: {
              governanceAction: getAgentReadinessAction(item).action,
              projectId: encodeAppId(item.projectId),
              projectName: item.projectName
            }
          })
        ])
      : null,
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn agent-work-order-run-btn",
        text: "Queue Run",
        attrs: { type: "button" },
        dataset: {
          agentWorkOrderRunProjectId: encodeAppId(item.projectId)
        }
      })
    ]),
    item.blockers.length
      ? createElement("div", {
          className: "tags"
        }, item.blockers.map((blocker) => createTag(blocker, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        })))
      : null
  ]));

  const agentWorkOrderSnapshotEntries = governance.agentWorkOrderSnapshots.map((snapshot) => createElement("div", {
    className: "governance-gap-card",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.6rem"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: "0.8rem",
        alignItems: "flex-start"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.3rem"
        }
      }, [
        createElement("div", {
          text: snapshot.title,
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${new Date(snapshot.createdAt).toLocaleString()} • ${snapshot.statusFilter}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      ]),
      createTag(`${snapshot.total} orders`, {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: "var(--text-muted)"
      })
    ]),
    createElement("div", {
      text: `Ready ${snapshot.readyCount} • Needs prep ${snapshot.needsPrepCount} • Blocked ${snapshot.blockedCount}`,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn work-order-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: {
          workOrderSnapshotId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn work-order-snapshot-queue-btn",
        text: "Queue Snapshot",
        attrs: { type: "button" },
        dataset: {
          workOrderSnapshotQueueId: snapshot.id
        }
      })
    ])
  ]));

  const agentExecutionSlaLedgerSnapshotEntries = (governance.agentExecutionSlaLedgerSnapshots || []).map((snapshot) => createElement("div", {
    className: "governance-gap-card",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.6rem"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: "0.8rem",
        alignItems: "flex-start"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.3rem"
        }
      }, [
        createElement("div", {
          text: snapshot.title,
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${new Date(snapshot.createdAt).toLocaleString()} • ${snapshot.stateFilter}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      ]),
      createTag(`${snapshot.total} records`, {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: "var(--text-muted)"
      })
    ]),
    createElement("div", {
      text: `Open ${snapshot.openCount} • Resolved ${snapshot.resolvedCount} • Available ${snapshot.available}`,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn sla-ledger-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: {
          slaLedgerSnapshotId: snapshot.id
        }
      })
    ])
  ]));

  const dataSourcesAccessReviewQueue = governance.dataSourcesAccessReviewQueue;
  const dataSourcesAccessReviewQueueItems = Array.isArray(dataSourcesAccessReviewQueue?.items)
    ? dataSourcesAccessReviewQueue.items
    : [];
  const dataSourcesAccessValidationRunbook = governance.dataSourcesAccessValidationRunbook;
  const dataSourcesAccessValidationRunbookMethods = Array.isArray(dataSourcesAccessValidationRunbook?.methods)
    ? dataSourcesAccessValidationRunbook.methods
    : [];
  const dataSourceAccessValidationEvidence = Array.isArray(governance.dataSourceAccessValidationEvidence)
    ? governance.dataSourceAccessValidationEvidence
    : [];
  const dataSourcesAccessTasks = Array.isArray(governance.dataSourcesAccessTasks)
    ? governance.dataSourcesAccessTasks
    : [];
  const dataSourcesAccessGatePayload = governance.dataSourcesAccessGate;
  const dataSourcesAccessGateReasons = Array.isArray(dataSourcesAccessGatePayload?.reasons)
    ? dataSourcesAccessGatePayload.reasons
    : [];
  const dataSourcesAccessGateDecision = dataSourcesAccessGatePayload?.decision || "not-evaluated";
  const dataSourcesAccessGateEntries = dataSourcesAccessGatePayload
    ? [
        createElement("div", {
          className: "governance-gap-card",
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem"
          }
        }, [
          createElement("div", {
            style: {
              display: "flex",
              justifyContent: "space-between",
              gap: "0.8rem",
              alignItems: "flex-start"
            }
          }, [
            createElement("div", {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem"
              }
            }, [
              createElement("div", {
                text: `Data Sources Access Gate: ${dataSourcesAccessGateDecision.toUpperCase()}`,
                style: {
                  fontWeight: "800",
                  color: "var(--text)"
                }
              }),
              createElement("div", {
                text: dataSourcesAccessGatePayload.generatedAt ? new Date(dataSourcesAccessGatePayload.generatedAt).toLocaleString() : "Live source-access gate",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.84rem",
                  lineHeight: "1.45"
                }
              })
            ]),
            createTag(dataSourcesAccessGateDecision.toUpperCase(), {
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: dataSourcesAccessGateDecision === "hold" ? "var(--danger)" : dataSourcesAccessGateDecision === "review" ? "var(--warning)" : "var(--success)"
            })
          ]),
          createElement("div", {
            text: dataSourcesAccessGatePayload.recommendedAction || "Evaluate Data Sources access before ingestion.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `Ready/review/blocked: ${dataSourcesAccessGatePayload.ready || 0}/${dataSourcesAccessGatePayload.review || 0}/${dataSourcesAccessGatePayload.blocked || 0} • Token/OAuth likely: ${dataSourcesAccessGatePayload.tokenLikely || 0} • Certificates: ${dataSourcesAccessGatePayload.certificateLikely || 0}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          }),
          dataSourcesAccessGateReasons.length
            ? createElement("div", {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                  padding: "0.7rem",
                  border: "1px solid var(--border)",
                  borderRadius: "0.85rem",
                  background: "color-mix(in srgb, var(--surface-hover) 45%, transparent 55%)"
                }
              }, [
                createElement("div", {
                  text: "Access gate reasons",
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.78rem",
                    fontWeight: "800",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase"
                  }
                }),
                ...dataSourcesAccessGateReasons.slice(0, 6).map((reason) => createElement("div", {
                  text: `${(reason.severity || "review").toUpperCase()}: ${reason.message || reason.code || "Review required."}`,
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.84rem",
                    lineHeight: "1.45"
                  }
                })),
                dataSourcesAccessGateReasons.length > 6
                  ? createElement("div", {
                      text: `${dataSourcesAccessGateReasons.length - 6} additional gate reason(s).`,
                      style: {
                        color: "var(--text-muted)",
                        fontSize: "0.8rem"
                      }
                    })
                  : null
              ])
            : null
        ])
      ]
    : [];
  const dataSourcesAccessReviewQueueEntries = dataSourcesAccessReviewQueueItems.map((item) => createElement("div", {
    className: "governance-gap-card",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.6rem"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: "0.8rem",
        alignItems: "flex-start"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.3rem"
        }
      }, [
        createElement("div", {
          text: item.title || `Review ${item.label || "source"} access`,
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${item.label || "Source"} • ${item.type || "source"} • ${item.accessMethod || "review-required"}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      ]),
      createElement("div", {
        style: {
          display: "flex",
          gap: "0.35rem",
          flexWrap: "wrap",
          justifyContent: "flex-end"
        }
      }, [
        createTag((item.priority || "normal").toUpperCase(), {
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: item.priority === "high" ? "var(--danger)" : item.priority === "medium" ? "var(--warning)" : "var(--text-muted)"
        }),
        createTag((item.status || "review").toUpperCase(), {
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: item.status === "blocked" ? "var(--danger)" : "var(--warning)"
        })
      ])
    ]),
    createElement("div", {
      text: item.action || "Review source access outside this app.",
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    createElement("div", {
      text: item.validation || "Confirm credentials, certificates, keys, and browser sessions outside this app.",
      style: {
        color: "var(--text-muted)",
        fontSize: "0.84rem",
        lineHeight: "1.45"
      }
    }),
    createElement("div", {
      className: "tags"
    }, [
      createTag(item.sourceHealth || "health unknown", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.sourceHealth === "blocked" ? "var(--danger)" : item.sourceHealth === "ready" ? "var(--success)" : "var(--warning)"
      }),
      createTag(item.sourceStatus || "status unknown", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      }),
      item.credentialHint
        ? createTag(item.credentialHint, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)"
          })
        : null
    ])
  ]));
  const dataSourcesAccessValidationRunbookEntries = dataSourcesAccessValidationRunbookMethods.map((method) => createElement("div", {
    className: "governance-gap-card",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.6rem"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: "0.8rem",
        alignItems: "flex-start"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.3rem"
        }
      }, [
        createElement("div", {
          text: method.title || method.accessMethod || "Access validation method",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${method.accessMethod || "review-required"} • ${(method.sources || []).length} source${(method.sources || []).length === 1 ? "" : "s"}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      ]),
      createTag(`${(method.sources || []).length} SOURCE${(method.sources || []).length === 1 ? "" : "S"}`, {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: "var(--primary)"
      })
    ]),
    createElement("div", {
      text: method.steps?.[0] || "Confirm access outside this app and record non-secret evidence.",
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    createElement("div", {
      className: "tags"
    }, [
      ...(method.commandHints || []).slice(0, 3).map((command) => createTag(command, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      }))
    ]),
    createElement("div", {
      text: method.evidence || "Record non-secret validation evidence.",
      style: {
        color: "var(--text-muted)",
        fontSize: "0.84rem",
        lineHeight: "1.45"
      }
    })
  ]));
  const dataSourcesAccessValidationEvidenceCoverageItems = Array.isArray(governance.dataSourcesAccessValidationEvidenceCoverage?.items)
    ? governance.dataSourcesAccessValidationEvidenceCoverage.items
    : [];
  const dataSourcesAccessValidationEvidenceCoverageEntries = dataSourcesAccessValidationEvidenceCoverageItems.map((item) => createElement("div", {
    className: "governance-gap-card",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.6rem"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: "0.8rem",
        alignItems: "flex-start"
      }
    }, [
      createElement("div", {}, [
        createElement("div", {
          text: item.label || item.sourceId || "Source evidence coverage",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${item.accessMethod || "review-required"} • latest evidence ${item.latestEvidenceStatus || "missing"}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            marginTop: "0.3rem"
          }
        })
      ]),
      createElement("div", {
        style: {
          display: "flex",
          gap: "0.35rem",
          flexWrap: "wrap",
          justifyContent: "flex-end"
        }
      }, [
        createTag((item.coverageStatus || "missing").toUpperCase(), {
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: item.coverageStatus === "blocked"
            ? "var(--danger)"
            : item.coverageStatus === "covered"
              ? "var(--success)"
              : "var(--warning)"
        }),
        createTag((item.priority || "medium").toUpperCase(), {
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: item.priority === "high" ? "var(--danger)" : item.priority === "medium" ? "var(--warning)" : "var(--text-muted)"
        })
      ])
    ]),
    createElement("div", {
      text: item.action || "Record non-secret validation evidence after confirming access outside this app.",
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    item.latestEvidenceSummary
      ? createElement("div", {
          text: `Evidence summary: ${item.latestEvidenceSummary}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      : null,
    item.sourceId
      ? createElement("div", {
          className: "governance-actions"
        }, [
          createElement("button", {
            className: "btn governance-action-btn source-access-evidence-validated-btn",
            text: item.coverageStatus === "covered" ? "Refresh Validated" : "Mark Validated",
            attrs: { type: "button" },
            dataset: {
              sourceAccessEvidenceAction: "validated",
              sourceId: item.sourceId,
              sourceLabel: item.label || item.sourceId,
              accessMethod: item.accessMethod || "review-required"
            }
          }),
          createElement("button", {
            className: "btn governance-action-btn source-access-evidence-review-btn",
            text: "Needs Review",
            attrs: { type: "button" },
            dataset: {
              sourceAccessEvidenceAction: "review",
              sourceId: item.sourceId,
              sourceLabel: item.label || item.sourceId,
              accessMethod: item.accessMethod || "review-required"
            }
          }),
          createElement("button", {
            className: "btn governance-action-btn source-access-evidence-blocked-btn",
            text: "Mark Blocked",
            attrs: { type: "button" },
            dataset: {
              sourceAccessEvidenceAction: "blocked",
              sourceId: item.sourceId,
              sourceLabel: item.label || item.sourceId,
              accessMethod: item.accessMethod || "review-required"
            }
          })
        ])
      : null
  ]));
  const dataSourceAccessValidationEvidenceEntries = dataSourceAccessValidationEvidence.map((evidence) => createElement("div", {
    className: "governance-gap-card",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.6rem"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: "0.8rem",
        alignItems: "flex-start"
      }
    }, [
      createElement("div", {}, [
        createElement("div", {
          text: evidence.sourceLabel || evidence.sourceId || "Source access evidence",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${evidence.accessMethod || "review-required"} • ${evidence.checkedAt ? new Date(evidence.checkedAt).toLocaleString() : "checked time not recorded"}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            marginTop: "0.3rem"
          }
        })
      ]),
      createTag((evidence.status || "review").toUpperCase(), {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: evidence.status === "blocked" ? "var(--danger)" : evidence.status === "validated" ? "var(--success)" : "var(--warning)"
      })
    ]),
    createElement("div", {
      text: evidence.evidence || "Non-secret evidence not provided.",
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    evidence.commandHint
      ? createElement("div", {
          text: `Command hint: ${evidence.commandHint}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      : null
  ]));
  const dataSourceAccessValidationEvidenceSnapshotEntries = (governance.dataSourceAccessValidationEvidenceSnapshots || []).map((snapshot) => createElement("div", {
    className: "governance-gap-card",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.6rem"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: "0.8rem",
        alignItems: "flex-start"
      }
    }, [
      createElement("div", {}, [
        createElement("div", {
          text: snapshot.title || "Data Sources Access Validation Evidence",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${new Date(snapshot.createdAt).toLocaleString()} • ${snapshot.statusFilter || "all"} • ${snapshot.total || 0} total`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            marginTop: "0.3rem"
          }
        })
      ]),
      createTag(`${snapshot.blockedCount || 0} BLOCKED`, {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: (snapshot.blockedCount || 0) > 0 ? "var(--danger)" : "var(--success)"
      })
    ]),
    createElement("div", {
      text: `${snapshot.validatedCount || 0} validated • ${snapshot.reviewCount || 0} review • ${snapshot.methodCount || 0} method(s) • ${snapshot.sourceCount || 0} source(s)`,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.84rem",
        lineHeight: "1.45"
      }
    }),
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn source-access-validation-evidence-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: {
          sourceAccessValidationEvidenceSnapshotId: snapshot.id
        }
      })
    ])
  ]));
  const dataSourceAccessValidationEvidenceSnapshotDiff = governance.dataSourceAccessValidationEvidenceSnapshotDiff;
  const dataSourceAccessValidationEvidenceSnapshotDiffEntries = dataSourceAccessValidationEvidenceSnapshotDiff
    ? [
        createElement("div", {
          className: "governance-gap-card",
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem"
          }
        }, [
          createElement("div", {
            style: {
              display: "flex",
              justifyContent: "space-between",
              gap: "0.8rem",
              alignItems: "flex-start"
            }
          }, [
            createElement("div", {}, [
              createElement("div", {
                text: dataSourceAccessValidationEvidenceSnapshotDiff.snapshotTitle || "No evidence snapshot",
                style: {
                  fontWeight: "800",
                  color: "var(--text)"
                }
              }),
              createElement("div", {
                text: dataSourceAccessValidationEvidenceSnapshotDiff.snapshotCreatedAt ? new Date(dataSourceAccessValidationEvidenceSnapshotDiff.snapshotCreatedAt).toLocaleString() : "No snapshot saved yet",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.84rem",
                  marginTop: "0.3rem"
                }
              })
            ]),
            createTag((dataSourceAccessValidationEvidenceSnapshotDiff.driftSeverity || "missing-snapshot").toUpperCase(), {
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: dataSourceAccessValidationEvidenceSnapshotDiff.driftSeverity === "high" || dataSourceAccessValidationEvidenceSnapshotDiff.driftSeverity === "missing-snapshot"
                ? "var(--danger)"
                : dataSourceAccessValidationEvidenceSnapshotDiff.driftSeverity === "none"
                  ? "var(--success)"
                  : "var(--warning)"
            })
          ]),
          createElement("div", {
            text: dataSourceAccessValidationEvidenceSnapshotDiff.recommendedAction || "Save a source-access validation evidence snapshot before comparing drift.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `${dataSourceAccessValidationEvidenceSnapshotDiff.driftScore || 0} drift score • ${(dataSourceAccessValidationEvidenceSnapshotDiff.driftItems || []).length} drift item(s)`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          })
        ])
      ]
    : [];
  const dataSourcesAccessTaskEntries = dataSourcesAccessTasks.map((task) => createElement("div", {
    className: "governance-gap-card",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.6rem"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: "0.8rem",
        alignItems: "flex-start"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.3rem"
        }
      }, [
        createElement("div", {
          text: task.title || "Source access review task",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${task.sourceLabel || "Source"} • ${task.sourceType || "source"} • ${task.accessMethod || "review-required"}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      ]),
      createElement("div", {
        style: {
          display: "flex",
          gap: "0.35rem",
          flexWrap: "wrap",
          justifyContent: "flex-end"
        }
      }, [
        createTag((task.priority || "low").toUpperCase(), {
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: task.priority === "high" ? "var(--danger)" : task.priority === "medium" ? "var(--warning)" : "var(--text-muted)"
        }),
        createTag((task.status || "open").toUpperCase(), {
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: ["done", "resolved", "closed", "cancelled", "archived"].includes(String(task.status || "").toLowerCase()) ? "var(--success)" : "var(--warning)"
        })
      ])
    ]),
    createElement("div", {
      text: task.description ? String(task.description).split("\n")[0] : "Track source access validation without storing secrets.",
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    (task.lastSourceAccessValidationEvidenceStatus || task.latestEvidenceStatus)
      ? createElement("div", {
          text: `Evidence sync: ${task.lastSourceAccessValidationEvidenceStatus || task.latestEvidenceStatus}${(task.lastSourceAccessValidationEvidenceAt || task.latestEvidenceAt) ? ` • ${new Date(task.lastSourceAccessValidationEvidenceAt || task.latestEvidenceAt).toLocaleString()}` : ""}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      : null,
    createElement("div", {
      className: "tags"
    }, [
      createTag(task.sourceAccessValidationEvidenceCoverageId || task.sourceAccessReviewId || "source-access-task", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      }),
      (task.coverageStatus || task.lastSourceAccessValidationEvidenceStatus || task.latestEvidenceStatus)
        ? createTag(`Evidence: ${task.coverageStatus || task.lastSourceAccessValidationEvidenceStatus || task.latestEvidenceStatus}`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: (task.coverageStatus || task.lastSourceAccessValidationEvidenceStatus || task.latestEvidenceStatus) === "covered" || (task.lastSourceAccessValidationEvidenceStatus || task.latestEvidenceStatus) === "validated" ? "var(--success)" : (task.coverageStatus || task.lastSourceAccessValidationEvidenceStatus || task.latestEvidenceStatus) === "blocked" ? "var(--danger)" : "var(--warning)"
          })
        : null,
      createTag(task.secretPolicy || "non-secret-metadata-only", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
          color: "var(--text-muted)"
      })
    ]),
    createElement("div", {
      className: "governance-actions"
    }, [
      task.status !== "resolved"
        ? createElement("button", {
            className: "btn governance-action-btn source-access-task-resolve-btn",
            text: "Resolve",
            attrs: { type: "button" },
            dataset: {
              sourceAccessTaskAction: "resolve",
              taskId: task.id
            }
          })
        : createElement("button", {
            className: "btn governance-action-btn source-access-task-reopen-btn",
            text: "Reopen",
            attrs: { type: "button" },
            dataset: {
              sourceAccessTaskAction: "reopen",
              taskId: task.id
            }
          }),
      task.status !== "blocked"
        ? createElement("button", {
            className: "btn governance-action-btn source-access-task-block-btn",
            text: "Block",
            attrs: { type: "button" },
            dataset: {
              sourceAccessTaskAction: "block",
              taskId: task.id
            }
          })
        : null
    ])
  ]));
  const dataSourcesAccessTaskLedgerSnapshotEntries = (governance.dataSourceAccessTaskLedgerSnapshots || []).map((snapshot) => createElement("div", {
    className: "governance-gap-card",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.6rem"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: "0.8rem",
        alignItems: "flex-start"
      }
    }, [
      createElement("div", {}, [
        createElement("div", {
          text: snapshot.title || "Data Sources Access Task Ledger",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${new Date(snapshot.createdAt).toLocaleString()} • ${snapshot.statusFilter || "all"} • ${snapshot.visibleCount || 0} visible`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            marginTop: "0.3rem"
          }
        })
      ]),
      createTag(`${snapshot.openCount || 0} OPEN`, {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: (snapshot.openCount || 0) > 0 ? "var(--warning)" : "var(--success)"
      })
    ]),
    createElement("div", {
      text: `${snapshot.total || 0} total source-access task(s) • ${snapshot.closedCount || 0} closed • ${snapshot.secretPolicy || "non-secret metadata only"}`,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.84rem",
        lineHeight: "1.45"
      }
    }),
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn source-access-task-ledger-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: {
          sourceAccessTaskLedgerSnapshotId: snapshot.id
        }
      })
    ])
  ]));

  const controlPlaneDecision = governance.agentControlPlaneDecision;
  const controlPlaneDecisionReasons = Array.isArray(controlPlaneDecision?.reasons) ? controlPlaneDecision.reasons : [];
  const controlPlaneDecisionColor = controlPlaneDecision?.decision === "hold"
    ? "var(--danger)"
    : controlPlaneDecision?.decision === "review"
      ? "var(--warning)"
      : "var(--success)";
  const agentControlPlaneDecisionEntries = controlPlaneDecision
    ? [
        createElement("div", {
          className: "governance-gap-card",
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem"
          }
        }, [
          createElement("div", {
            style: {
              display: "flex",
              justifyContent: "space-between",
              gap: "0.8rem",
              alignItems: "flex-start"
            }
          }, [
            createElement("div", {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem"
              }
            }, [
              createElement("div", {
                text: `Decision: ${(controlPlaneDecision.decision || "review").toUpperCase()}`,
                style: {
                  fontWeight: "800",
                  color: "var(--text)"
                }
              }),
              createElement("div", {
                text: controlPlaneDecision.generatedAt ? new Date(controlPlaneDecision.generatedAt).toLocaleString() : "Live control-plane decision",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.84rem",
                  lineHeight: "1.45"
                }
              })
            ]),
            createElement("div", {
              style: {
                display: "flex",
                gap: "0.35rem",
                flexWrap: "wrap",
                justifyContent: "flex-end"
              }
            }, [
              createTag((controlPlaneDecision.decision || "review").toUpperCase(), {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: controlPlaneDecisionColor
              }),
              createTag(`DRIFT ${(controlPlaneDecision.baselineDriftSeverity || "missing-baseline").toUpperCase()}`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: controlPlaneDecision.baselineDriftSeverity === "none" ? "var(--success)" : "var(--warning)"
              }),
              createTag(`READY ${controlPlaneDecision.agentReadyProjects || 0}/${controlPlaneDecision.agentReadinessItems || 0}`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: (controlPlaneDecision.agentReadyProjects || 0) > 0 ? "var(--success)" : "var(--warning)"
              }),
              createTag(`SOURCE TASKS ${controlPlaneDecision.dataSourcesAccessOpenTaskCount || 0}/${controlPlaneDecision.dataSourcesAccessTaskCount || 0}`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: (controlPlaneDecision.dataSourcesAccessOpenTaskCount || 0) > 0 ? "var(--warning)" : "var(--success)"
              }),
              createTag(`ACCESS METHODS ${controlPlaneDecision.dataSourcesAccessValidationMethodCount || 0}`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: (controlPlaneDecision.dataSourcesAccessValidationBlockedCount || 0) > 0 ? "var(--danger)" : (controlPlaneDecision.dataSourcesAccessValidationReviewCount || 0) > 0 ? "var(--warning)" : "var(--success)"
              }),
              createTag(`EVIDENCE ${controlPlaneDecision.dataSourcesAccessValidationEvidenceValidatedCount || 0}/${controlPlaneDecision.dataSourcesAccessValidationEvidenceCount || 0}`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: (controlPlaneDecision.dataSourcesAccessValidationEvidenceBlockedCount || 0) > 0 ? "var(--danger)" : (controlPlaneDecision.dataSourcesAccessValidationEvidenceReviewCount || 0) > 0 ? "var(--warning)" : "var(--success)"
              })
            ])
          ]),
          createElement("div", {
            text: controlPlaneDecision.recommendedAction || "Review the Agent Control Plane before the next supervised build.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `Baseline health: ${controlPlaneDecision.baselineHealth || "missing"} • Active runs: ${controlPlaneDecision.activeRuns || 0} • Stale: ${controlPlaneDecision.staleActiveRuns || 0} • SLA breached: ${controlPlaneDecision.slaBreachedRuns || 0} • Source access tasks: ${controlPlaneDecision.dataSourcesAccessOpenTaskCount || 0} open / ${controlPlaneDecision.dataSourcesAccessTaskCount || 0} total • Access methods: ${controlPlaneDecision.dataSourcesAccessValidationMethodCount || 0} • Evidence: ${controlPlaneDecision.dataSourcesAccessValidationEvidenceValidatedCount || 0}/${controlPlaneDecision.dataSourcesAccessValidationEvidenceCount || 0}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          controlPlaneDecisionReasons.length
            ? createElement("div", {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                  padding: "0.7rem",
                  border: "1px solid var(--border)",
                  borderRadius: "0.85rem",
                  background: "color-mix(in srgb, var(--surface-hover) 45%, transparent 55%)"
                }
              }, [
                createElement("div", {
                  text: "Decision reasons",
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.78rem",
                    fontWeight: "800",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase"
                  }
                }),
                ...controlPlaneDecisionReasons.slice(0, 6).map((reason) => createElement("div", {
                  text: `${(reason.severity || "review").toUpperCase()}: ${reason.message || reason.code || "Review required."}`,
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.84rem",
                    lineHeight: "1.45"
                  }
                })),
                controlPlaneDecisionReasons.length > 6
                  ? createElement("div", {
                      text: `${controlPlaneDecisionReasons.length - 6} additional decision reason(s).`,
                      style: {
                        color: "var(--text-muted)",
                        fontSize: "0.8rem"
                      }
                    })
                  : null
              ])
            : null,
          createElement("div", {
            className: "governance-actions"
          }, [
            createElement("button", {
              className: "btn governance-action-btn control-plane-decision-copy-btn",
              text: "Copy Decision",
              attrs: { type: "button" },
              dataset: {
                controlPlaneDecisionCopy: "true"
              }
            })
          ])
        ])
      ]
    : [];
  const releaseSummary = governance.releaseSummary;
  const releaseCheckpoints = Array.isArray(releaseSummary?.checkpoints) ? releaseSummary.checkpoints : [];
  const releaseCheckpointDrift = governance.releaseCheckpointDrift;
  const releaseDriftItems = Array.isArray(releaseCheckpointDrift?.driftItems) ? releaseCheckpointDrift.driftItems : [];
  const releaseDriftSeverity = releaseCheckpointDrift?.driftSeverity || "missing-checkpoint";
  const releaseDriftColor = releaseDriftSeverity === "high" || releaseDriftSeverity === "missing-checkpoint"
    ? "var(--danger)"
    : releaseDriftSeverity === "medium" || releaseDriftSeverity === "low"
      ? "var(--warning)"
      : "var(--success)";
  const releaseBuildGate = governance.releaseBuildGate;
  const releaseBuildGateReasons = Array.isArray(releaseBuildGate?.reasons) ? releaseBuildGate.reasons : [];
  const releaseBuildGateDecision = releaseBuildGate?.decision || "review";
  const releaseBuildGateColor = releaseBuildGateDecision === "hold"
    ? "var(--danger)"
    : releaseBuildGateDecision === "ready"
      ? "var(--success)"
      : "var(--warning)";
  const releaseLatestSmoke = releaseSummary?.latestSmokeCheck || null;
  const releaseStatus = releaseSummary?.summary?.status || "review";
  const releaseStatusColor = releaseStatus === "hold"
    ? "var(--danger)"
    : releaseStatus === "ready"
      ? "var(--success)"
      : "var(--warning)";
  const releaseSmokeStatus = releaseLatestSmoke?.status || "not-run";
  const releaseSmokeColor = releaseSmokeStatus === "pass"
    ? "var(--success)"
    : releaseSmokeStatus === "fail"
      ? "var(--danger)"
      : "var(--text-muted)";
  const releaseRecommendedAction = releaseStatus === "hold"
    ? "Hold release until failing deployment smoke checks or release blockers are resolved."
    : releaseStatus === "ready"
      ? "Release evidence is ready for the next supervised build checkpoint."
      : "Review release evidence before relying on this deployment checkpoint.";
  const releaseControlEntries = releaseSummary
    ? [
        createElement("div", {
          className: "governance-gap-card",
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem"
          }
        }, [
          createElement("div", {
            style: {
              display: "flex",
              justifyContent: "space-between",
              gap: "0.8rem",
              alignItems: "flex-start"
            }
          }, [
            createElement("div", {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem"
              }
            }, [
              createElement("div", {
                text: `Release Status: ${releaseStatus.toUpperCase()}`,
                style: {
                  fontWeight: "800",
                  color: "var(--text)"
                }
              }),
              createElement("div", {
                text: releaseSummary.generatedAt ? new Date(releaseSummary.generatedAt).toLocaleString() : "Live release control summary",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.84rem",
                  lineHeight: "1.45"
                }
              })
            ]),
            createElement("div", {
              style: {
                display: "flex",
                gap: "0.35rem",
                flexWrap: "wrap",
                justifyContent: "flex-end"
              }
            }, [
              createTag(releaseStatus.toUpperCase(), {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: releaseStatusColor
              }),
              createTag(releaseSummary.git?.dirty ? "DIRTY" : "CLEAN", {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: releaseSummary.git?.dirty ? "var(--warning)" : "var(--success)"
              }),
              createTag(`SMOKE ${releaseSmokeStatus.toUpperCase()}`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: releaseSmokeColor
              }),
              createTag(`${releaseSummary.summary?.releaseCheckpointCount || 0} CHECKPOINTS`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: "var(--text-muted)"
              }),
              createTag(`DRIFT ${releaseDriftSeverity.toUpperCase()}`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: releaseDriftColor
              }),
              createTag(`GATE ${releaseBuildGateDecision.toUpperCase()}`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: releaseBuildGateColor
              })
            ])
          ]),
          createElement("div", {
            text: releaseRecommendedAction,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `Git: ${releaseSummary.git?.available ? `${releaseSummary.git.branch || "unknown"} @ ${releaseSummary.git.commitShort || "unknown"} - ${releaseSummary.git.commitMessage || "no message"}` : `unavailable - ${releaseSummary.git?.error || "not reported"}`}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `Deployment smoke: ${releaseSummary.summary?.deploymentSmokeCheckPassCount || 0} pass / ${releaseSummary.summary?.deploymentSmokeCheckFailCount || 0} fail / ${releaseSummary.summary?.deploymentSmokeCheckCount || 0} total${releaseLatestSmoke?.checkedAt ? ` - latest ${new Date(releaseLatestSmoke.checkedAt).toLocaleString()}` : ""}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `Validation: ${releaseSummary.summary?.validationStatus || "scan-missing"}${releaseSummary.summary?.latestScanAt ? ` - latest scan ${new Date(releaseSummary.summary.latestScanAt).toLocaleString()}` : ""} - secret policy: non-secret release metadata only`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            className: "governance-actions"
          }, [
            createElement("button", {
              className: "btn governance-action-btn release-control-copy-btn",
              text: "Copy Release",
              attrs: { type: "button" },
              dataset: {
                releaseControlCopy: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn release-build-gate-copy-btn",
              text: "Copy Gate",
              attrs: { type: "button" },
              dataset: {
                releaseBuildGateCopy: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn release-checkpoint-drift-copy-btn",
              text: "Copy Drift",
              attrs: { type: "button" },
              dataset: {
                releaseCheckpointDriftCopy: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn release-checkpoint-save-btn",
              text: "Save Checkpoint",
              attrs: { type: "button" },
              dataset: {
                releaseCheckpointSave: "true"
              }
            })
          ])
        ]),
        releaseBuildGate
          ? createElement("div", {
              className: "governance-gap-card",
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem"
              }
            }, [
              createElement("div", {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.8rem",
                  alignItems: "flex-start"
                }
              }, [
                createElement("div", {}, [
                  createElement("div", {
                    text: "Release Build Gate",
                    style: {
                      fontWeight: "800",
                      color: "var(--text)"
                    }
                  }),
                  createElement("div", {
                    text: `${releaseBuildGateReasons.length} reason(s) | risk ${releaseBuildGate.riskScore || 0}`,
                    style: {
                      color: "var(--text-muted)",
                      fontSize: "0.84rem",
                      marginTop: "0.3rem"
                    }
                  })
                ]),
                createTag(releaseBuildGateDecision.toUpperCase(), {
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: releaseBuildGateColor
                })
              ]),
              createElement("div", {
                text: releaseBuildGate.recommendedAction || "Review release build gate evidence before continuing.",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.88rem",
                  lineHeight: "1.5"
                }
              }),
              releaseBuildGateReasons.length
                ? createElement("div", {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.35rem",
                      padding: "0.7rem",
                      border: "1px solid var(--border)",
                      borderRadius: "0.85rem",
                      background: "color-mix(in srgb, var(--surface-hover) 45%, transparent 55%)"
                    }
                  }, [
                    createElement("div", {
                      text: "Gate reasons",
                      style: {
                        color: "var(--text-muted)",
                        fontSize: "0.78rem",
                        fontWeight: "800",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase"
                      }
                    }),
                    ...releaseBuildGateReasons.slice(0, 6).map((reason) => createElement("div", {
                      text: `${reason.label || reason.code}: ${reason.message || "Review release gate evidence."} (${reason.severity || "review"})`,
                      style: {
                        color: "var(--text-muted)",
                        fontSize: "0.84rem",
                        lineHeight: "1.45"
                      }
                    }))
                  ])
                : null
            ])
          : null,
        releaseCheckpointDrift
          ? createElement("div", {
              className: "governance-gap-card",
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem"
              }
            }, [
              createElement("div", {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.8rem",
                  alignItems: "flex-start"
                }
              }, [
                createElement("div", {}, [
                  createElement("div", {
                    text: "Release Checkpoint Drift",
                    style: {
                      fontWeight: "800",
                      color: "var(--text)"
                    }
                  }),
                  createElement("div", {
                    text: releaseCheckpointDrift.hasSnapshot
                      ? `${releaseCheckpointDrift.snapshotTitle || "Release checkpoint"} | ${releaseCheckpointDrift.snapshotCreatedAt ? new Date(releaseCheckpointDrift.snapshotCreatedAt).toLocaleString() : "saved checkpoint"}`
                      : "No release checkpoint saved yet.",
                    style: {
                      color: "var(--text-muted)",
                      fontSize: "0.84rem",
                      marginTop: "0.3rem"
                    }
                  })
                ]),
                createTag(releaseDriftSeverity.toUpperCase(), {
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: releaseDriftColor
                })
              ]),
              createElement("div", {
                text: releaseCheckpointDrift.recommendedAction || "Save a release checkpoint before comparing drift.",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.88rem",
                  lineHeight: "1.5"
                }
              }),
              releaseDriftItems.length
                ? createElement("div", {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.35rem",
                      padding: "0.7rem",
                      border: "1px solid var(--border)",
                      borderRadius: "0.85rem",
                      background: "color-mix(in srgb, var(--surface-hover) 45%, transparent 55%)"
                    }
                  }, [
                    createElement("div", {
                      text: "Drift fields",
                      style: {
                        color: "var(--text-muted)",
                        fontSize: "0.78rem",
                        fontWeight: "800",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase"
                      }
                    }),
                    ...releaseDriftItems.slice(0, 6).map((item) => createElement("div", {
                      text: `${item.label || item.field}: ${item.before || "none"} -> ${item.current || "none"} (${item.severity || "review"})`,
                      style: {
                        color: "var(--text-muted)",
                        fontSize: "0.84rem",
                        lineHeight: "1.45"
                      }
                    }))
                  ])
                : null
            ])
          : null,
        ...releaseCheckpoints.slice(0, 5).map((checkpoint) => createElement("div", {
          className: "governance-gap-card",
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem"
          }
        }, [
          createElement("div", {
            style: {
              display: "flex",
              justifyContent: "space-between",
              gap: "0.8rem",
              alignItems: "flex-start"
            }
          }, [
            createElement("div", {}, [
              createElement("div", {
                text: checkpoint.title || "Release Checkpoint",
                style: {
                  fontWeight: "800",
                  color: "var(--text)"
                }
              }),
              createElement("div", {
                text: `${checkpoint.createdAt ? new Date(checkpoint.createdAt).toLocaleString() : "saved checkpoint"} | ${checkpoint.branch || "unknown"} @ ${checkpoint.commitShort || "unknown"}`,
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.84rem",
                  marginTop: "0.3rem"
                }
              })
            ]),
            createTag((checkpoint.status || "review").toUpperCase(), {
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: checkpoint.status === "hold" ? "var(--danger)" : checkpoint.status === "ready" ? "var(--success)" : "var(--warning)"
            })
          ]),
          createElement("div", {
            text: `${checkpoint.commitMessage || "No commit message"} | smoke ${checkpoint.deploymentSmokeCheckPassCount || 0} pass / ${checkpoint.deploymentSmokeCheckFailCount || 0} fail | validation ${checkpoint.validationStatus || "scan-missing"}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          checkpoint.notes
            ? createElement("div", {
                text: checkpoint.notes,
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.88rem",
                  lineHeight: "1.5"
                }
              })
            : null
        ]))
      ]
    : [];
  const agentControlPlaneDecisionSnapshotEntries = (governance.agentControlPlaneDecisionSnapshots || []).map((snapshot) => {
    const snapshotDecisionColor = snapshot.decision === "hold"
      ? "var(--danger)"
      : snapshot.decision === "review"
        ? "var(--warning)"
        : "var(--success)";
    return createElement("div", {
      className: "governance-gap-card"
    }, [
      createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          gap: "0.8rem",
          alignItems: "flex-start"
        }
      }, [
        createElement("div", {}, [
          createElement("div", {
            text: snapshot.title || "Agent Control Plane Decision",
            style: {
              fontWeight: "800",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: `${new Date(snapshot.createdAt).toLocaleString()} • drift ${snapshot.baselineDriftSeverity || "missing-baseline"}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.3rem"
            }
          })
        ]),
        createTag((snapshot.decision || "review").toUpperCase(), {
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: snapshotDecisionColor
        })
      ]),
      createElement("div", {
        text: snapshot.recommendedAction || "Review the Agent Control Plane before the next supervised build.",
        style: {
          color: "var(--text-muted)",
          fontSize: "0.88rem",
          lineHeight: "1.5",
          marginTop: "0.6rem"
        }
      }),
      createElement("div", {
        text: `${snapshot.reasonCount || 0} reason(s) • ready ${snapshot.agentReadyProjects || 0}/${snapshot.agentReadinessItems || 0} • stale ${snapshot.staleActiveRuns || 0} • SLA ${snapshot.slaBreachedRuns || 0}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45",
          marginTop: "0.45rem"
        }
      }),
      createElement("div", {
        className: "governance-actions",
        style: { marginTop: "0.7rem" }
      }, [
        createElement("button", {
          className: "btn governance-action-btn control-plane-decision-snapshot-copy-btn",
          text: "Copy Snapshot",
          attrs: { type: "button" },
          dataset: {
            controlPlaneDecisionSnapshotId: snapshot.id
          }
        })
      ])
    ]);
  });

  const controlPlaneBaselineStatus = governance.agentControlPlaneBaselineStatus;
  const controlPlaneBaselineDriftItems = Array.isArray(controlPlaneBaselineStatus?.driftItems) ? controlPlaneBaselineStatus.driftItems : [];
  const agentControlPlaneBaselineStatusEntries = controlPlaneBaselineStatus
    ? [
        createElement("div", {
          className: "governance-gap-card",
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem"
          }
        }, [
          createElement("div", {
            style: {
              display: "flex",
              justifyContent: "space-between",
              gap: "0.8rem",
              alignItems: "flex-start"
            }
          }, [
            createElement("div", {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem"
              }
            }, [
              createElement("div", {
                text: controlPlaneBaselineStatus.hasBaseline ? (controlPlaneBaselineStatus.title || "Agent Control Plane Baseline") : "No Control Plane baseline selected",
                style: {
                  fontWeight: "800",
                  color: "var(--text)"
                }
              }),
              createElement("div", {
                text: controlPlaneBaselineStatus.hasBaseline && controlPlaneBaselineStatus.createdAt
                  ? `${new Date(controlPlaneBaselineStatus.createdAt).toLocaleString()} • ${controlPlaneBaselineStatus.snapshotId}`
                  : `${controlPlaneBaselineStatus.snapshotCount} saved snapshot(s) available`,
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.84rem",
                  lineHeight: "1.45"
                }
              })
            ]),
            createElement("div", {
              style: {
                display: "flex",
                gap: "0.35rem",
                flexWrap: "wrap",
                justifyContent: "flex-end"
              }
            }, [
              createTag(controlPlaneBaselineStatus.hasBaseline ? "BASELINE SET" : "BASELINE MISSING", {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: controlPlaneBaselineStatus.hasBaseline ? "var(--success)" : "var(--warning)"
              }),
              createTag((controlPlaneBaselineStatus.freshness || "missing").toUpperCase(), {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: controlPlaneBaselineStatus.freshness === "stale" || controlPlaneBaselineStatus.freshness === "missing" ? "var(--warning)" : "var(--success)"
              }),
              createTag(`DRIFT ${controlPlaneBaselineStatus.driftScore || 0}`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: controlPlaneBaselineStatus.hasDrift ? "var(--warning)" : "var(--success)"
              }),
              createTag(`SEVERITY ${(controlPlaneBaselineStatus.driftSeverity || "missing-baseline").toUpperCase()}`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: ["none"].includes(controlPlaneBaselineStatus.driftSeverity || "") ? "var(--success)" : "var(--warning)"
              }),
              createTag(`HEALTH ${(controlPlaneBaselineStatus.health || "missing").toUpperCase()}`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: ["healthy"].includes(controlPlaneBaselineStatus.health || "") ? "var(--success)" : "var(--warning)"
              })
            ])
          ]),
          createElement("div", {
            text: controlPlaneBaselineStatus.hasBaseline
              ? `Freshness: ${controlPlaneBaselineStatus.freshness} • ${controlPlaneBaselineStatus.ageHours}h old • stale after ${controlPlaneBaselineStatus.freshnessThresholdHours}h`
              : `Freshness: missing • stale threshold ${controlPlaneBaselineStatus.freshnessThresholdHours}h`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: controlPlaneBaselineStatus.hasBaseline
              ? `Drift score: ${controlPlaneBaselineStatus.driftScore || 0} summary field change(s)${controlPlaneBaselineStatus.hasDrift ? " since the baseline was saved" : ""}`
              : "Drift score: unavailable until a baseline is selected.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `Drift severity: ${controlPlaneBaselineStatus.driftSeverity || "missing-baseline"} • ${controlPlaneBaselineStatus.driftRecommendedAction || "Save or mark an Agent Control Plane snapshot as baseline before using baseline-vs-live drift."}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `Baseline health: ${controlPlaneBaselineStatus.health || "missing"} • ${controlPlaneBaselineStatus.recommendedAction || "Select a baseline before relying on drift decisions."}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          controlPlaneBaselineStatus.hasBaseline && controlPlaneBaselineDriftItems.length
            ? createElement("div", {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                  padding: "0.7rem",
                  border: "1px solid var(--border)",
                  borderRadius: "0.85rem",
                  background: "color-mix(in srgb, var(--surface-hover) 45%, transparent 55%)"
                }
              }, [
                createElement("div", {
                  text: "Baseline drift fields",
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.78rem",
                    fontWeight: "800",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase"
                  }
                }),
                ...controlPlaneBaselineDriftItems.slice(0, 6).map((item) => createElement("div", {
                  text: `${item.label}: ${item.before} -> ${item.current} (${item.delta > 0 ? "+" : ""}${item.delta})`,
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.84rem",
                    lineHeight: "1.45"
                  }
                })),
                controlPlaneBaselineDriftItems.length > 6
                  ? createElement("div", {
                      text: `${controlPlaneBaselineDriftItems.length - 6} additional drift field(s).`,
                      style: {
                        color: "var(--text-muted)",
                        fontSize: "0.8rem"
                      }
                    })
                  : null
              ])
            : null,
          createElement("div", {
            text: controlPlaneBaselineStatus.hasBaseline
              ? "Baseline drift controls compare this selected handoff against the live Agent Control Plane."
              : "Use Save Baseline or mark a Control Plane snapshot as baseline before relying on baseline drift.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            className: "governance-actions"
          }, [
            createElement("button", {
              className: "btn governance-action-btn control-plane-baseline-refresh-btn",
              text: controlPlaneBaselineStatus.hasBaseline ? "Refresh Baseline" : "Save Baseline",
              attrs: { type: "button" },
              dataset: {
                controlPlaneBaselineRefresh: "true"
              }
            }),
            controlPlaneBaselineStatus.hasBaseline
              ? createElement("button", {
                  className: "btn governance-action-btn control-plane-baseline-clear-btn",
                  text: "Clear Baseline",
                  attrs: { type: "button" },
                  dataset: {
                    controlPlaneBaselineClear: "true"
                  }
                })
              : null
          ])
        ])
      ]
    : [];

  const agentControlPlaneSnapshotEntries = (governance.agentControlPlaneSnapshots || []).map((snapshot) => createElement("div", {
    className: "governance-gap-card",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.6rem"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: "0.8rem",
        alignItems: "flex-start"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.3rem"
        }
      }, [
        createElement("div", {
          text: snapshot.title,
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${new Date(snapshot.createdAt).toLocaleString()} • limit ${snapshot.limit}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      ]),
      createElement("div", {
        style: {
          display: "flex",
          gap: "0.35rem",
          flexWrap: "wrap",
          justifyContent: "flex-end"
        }
      }, [
        snapshot.isBaseline
          ? createTag("BASELINE", {
              border: "1px solid color-mix(in srgb, var(--success) 45%, var(--border) 55%)",
              background: "color-mix(in srgb, var(--success) 12%, var(--bg) 88%)",
              color: "var(--success)"
            })
          : null,
        createTag(`${snapshot.totalWorkOrders} orders`, {
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: "var(--text-muted)"
        })
      ])
    ]),
    createElement("div", {
      text: `${snapshot.totalExecutionRuns} execution run(s) • ${snapshot.totalSlaLedgerRecords} SLA record(s) • ${snapshot.totalSlaLedgerSnapshots} SLA snapshot(s)`,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn control-plane-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: {
          controlPlaneSnapshotId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn control-plane-snapshot-drift-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: {
          controlPlaneSnapshotDriftId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn control-plane-snapshot-baseline-btn",
        text: snapshot.isBaseline ? "Baseline" : "Mark Baseline",
        attrs: { type: "button" },
        dataset: {
          controlPlaneSnapshotBaselineId: snapshot.id
        }
      })
    ])
  ]));

  const executionMetrics = getAgentExecutionMetrics(governance);
  const agentExecutionMetricEntries = executionMetrics.total
    ? [
        {
          label: "Queue Split",
          value: `${executionMetrics.statusCounts.queued} queued / ${executionMetrics.statusCounts.running} running`,
          detail: `${executionMetrics.statusCounts.blocked} blocked, ${executionMetrics.statusCounts.passed} passed, ${executionMetrics.statusCounts.failed} failed`
        },
        {
          label: "Completion",
          value: `${executionMetrics.completionRate}% complete`,
          detail: `${executionMetrics.completed} completed out of ${executionMetrics.total} total Agent Work Order runs`
        },
        {
          label: "Stale Active Runs",
          value: String(executionMetrics.staleActive),
          detail: `Active runs older than ${executionMetrics.staleThresholdHours} hours and likely needing review`
        },
        {
          label: "SLA Breach Actions",
          value: String(executionMetrics.slaBreached || 0),
          detail: "Active runs with an unresolved SLA breach action"
        },
        {
          label: "SLA Resolution Throughput",
          value: `${executionMetrics.slaResolved || 0} resolved`,
          detail: `${executionMetrics.slaAverageResolutionHours || 0}h average resolution time`
        },
        {
          label: "Latest Execution Event",
          value: executionMetrics.latestEventStatus || "none",
          detail: executionMetrics.latestEventAt
            ? `${executionMetrics.latestEventProjectName}: ${executionMetrics.latestEventNote} (${new Date(executionMetrics.latestEventAt).toLocaleString()})`
            : "No execution events have been captured yet."
        }
      ].map((item) => createElement("div", {
        className: "governance-gap-card",
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.45rem"
        }
      }, [
        createElement("div", {
          text: item.label,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.78rem",
            fontWeight: "800",
            letterSpacing: "0.08em",
            textTransform: "uppercase"
          }
        }),
        createElement("div", {
          text: item.value,
          style: {
            color: "var(--text)",
            fontSize: "1rem",
            fontWeight: "900"
          }
        }),
        createElement("div", {
          text: item.detail,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      ]))
    : [];

  const slaLedgerEntries = (governance.agentExecutionSlaLedger || []).map((item) => createElement("div", {
    className: "governance-gap-card",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.55rem"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: "0.8rem",
        alignItems: "flex-start"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem"
        }
      }, [
        createElement("div", {
          text: item.projectName,
          style: {
            fontWeight: "900",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: item.title,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      ]),
      createTag(item.breachState === "resolved" ? "resolved" : "open breach", {
        border: `1px solid ${item.breachState === "resolved" ? "var(--success)" : "var(--danger)"}`,
        background: "var(--bg)",
        color: item.breachState === "resolved" ? "var(--success)" : "var(--danger)"
      })
    ]),
    createElement("div", {
      text: `Action ${item.action || "breached"} - status ${item.status} - ${item.durationHours || 0}h ${item.breachState === "resolved" ? "to resolve" : "open"}`,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    createElement("div", {
      text: `Breached ${new Date(item.breachedAt).toLocaleString()}${item.resolvedAt ? ` - Resolved ${new Date(item.resolvedAt).toLocaleString()}` : ""}`,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.82rem",
        lineHeight: "1.45"
      }
    }),
    createElement("div", {
      className: "tags"
    }, [
      createTag(`Escalations ${item.escalationCount || 0}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      }),
      createTag(`Resolutions ${item.resolutionCount || 0}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      })
    ])
  ]));

  const agentWorkOrderRunEntries = governance.agentWorkOrderRuns.map((run) => createElement("div", {
    className: "governance-gap-card",
    dataset: run.projectId ? { openAppId: encodeAppId(run.projectId) } : undefined,
    title: run.projectId ? "Open project workbench" : undefined,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.6rem"
    }
  }, [
    createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: "0.8rem",
        alignItems: "flex-start"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.3rem"
        }
      }, [
        createElement("div", {
          text: run.title,
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
      createElement("div", {
          text: `${run.projectName} • score ${run.readinessScore} • ${new Date(run.updatedAt || run.createdAt).toLocaleString()}${run.archivedAt ? ` • archived ${new Date(run.archivedAt).toLocaleString()}` : ""}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      ]),
      createTag(run.status, {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: run.status === "passed" ? "var(--success)" : run.status === "failed" ? "var(--danger)" : run.status === "running" ? "var(--warning)" : "var(--text-muted)"
      })
    ]),
    createElement("div", {
      text: run.objective,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    run.validationCommands.length
      ? createElement("div", {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "0.45rem",
            padding: "0.7rem",
            border: "1px dashed var(--border)",
            borderRadius: "0.85rem",
            background: "var(--bg)"
          }
        }, [
          createElement("div", {
            text: "Validation checklist",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.78rem",
              fontWeight: "800",
              letterSpacing: "0.08em",
              textTransform: "uppercase"
            }
          }),
          ...run.validationCommands.slice(0, 4).map((command) => createElement("code", {
            text: command,
            style: {
              color: "var(--text)",
              fontSize: "0.8rem",
              whiteSpace: "normal",
              wordBreak: "break-word"
            }
          })),
          run.validationCommands.length > 4
            ? createElement("div", {
                text: `${run.validationCommands.length - 4} additional validation command(s) retained in the run.`,
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.8rem"
                }
              })
            : null
        ])
      : null,
    createElement("div", {
      className: "tags"
    }, [
      createTag(run.readinessStatus || "readiness unset", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      }),
      createTag(`${run.blockers.length} blockers`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: run.blockers.length ? "var(--warning)" : "var(--success)"
      }),
      createTag(`${run.history?.length || 0} events`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      }),
      run.archivedAt
        ? createTag("archived", {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)"
          })
        : null,
      run.slaBreachedAt && !run.slaResolvedAt
        ? createTag(`SLA ${run.slaAction || "breached"} x${run.slaEscalationCount || 1}`, {
            background: "var(--bg)",
            border: "1px solid var(--danger)",
            color: "var(--danger)"
          })
        : null,
      run.slaResolvedAt
        ? createTag(`SLA resolved x${run.slaResolutionCount || 1}`, {
            background: "var(--bg)",
            border: "1px solid var(--success)",
            color: "var(--success)"
          })
        : null,
      isStaleAgentWorkOrderRun(run, executionMetrics.staleThresholdHours, executionMetrics.staleStatuses)
        ? createTag("stale active", {
            background: "var(--bg)",
            border: "1px solid var(--warning)",
            color: "var(--warning)"
          })
        : null
    ]),
    run.history?.length
      ? createElement("div", {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "0.45rem",
            padding: "0.7rem",
            border: "1px solid var(--border)",
            borderRadius: "0.85rem",
            background: "color-mix(in srgb, var(--surface-hover) 45%, transparent 55%)"
          }
        }, [
          createElement("div", {
            text: "Execution timeline",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.78rem",
              fontWeight: "800",
              letterSpacing: "0.08em",
              textTransform: "uppercase"
            }
          }),
          ...run.history.slice(0, 4).map((event) => createElement("div", {
            style: {
              display: "grid",
              gridTemplateColumns: "minmax(4.5rem, auto) 1fr",
              gap: "0.6rem",
              alignItems: "start"
            }
          }, [
            createTag(event.status || "event", {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: event.status === "passed" ? "var(--success)" : event.status === "failed" ? "var(--danger)" : event.status === "running" ? "var(--warning)" : "var(--text-muted)"
            }),
            createElement("div", {
              text: `${event.note}${event.previousStatus ? ` (${event.previousStatus} -> ${event.status})` : ""} • ${new Date(event.createdAt).toLocaleString()}`,
              style: {
                color: "var(--text-muted)",
                fontSize: "0.84rem",
                lineHeight: "1.45"
              }
            })
          ])),
          run.history.length > 4
            ? createElement("div", {
                text: `${run.history.length - 4} older event(s) retained in the run history.`,
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.8rem"
                }
              })
            : null
        ])
      : null,
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn agent-work-order-run-copy-btn",
        text: "Copy Brief",
        attrs: { type: "button" },
        dataset: {
          agentWorkOrderRunCopyId: run.id
        }
      }),
      ["queued", "running", "blocked"].includes(run.status)
        ? [
          run.status === "queued"
            ? createElement("button", {
                className: "btn governance-action-btn",
                text: "Start",
                attrs: { type: "button" },
                dataset: {
                  agentWorkOrderRunAction: "running",
                  agentWorkOrderRunId: run.id
                }
              })
            : null,
          run.status === "running"
            ? createElement("button", {
                className: "btn governance-action-btn",
                text: "Pass",
                attrs: { type: "button" },
                dataset: {
                  agentWorkOrderRunAction: "passed",
                  agentWorkOrderRunId: run.id
                }
              })
            : null,
          run.status === "running"
            ? createElement("button", {
                className: "btn governance-action-btn",
                text: "Fail",
                attrs: { type: "button" },
                dataset: {
                  agentWorkOrderRunAction: "failed",
                  agentWorkOrderRunId: run.id
                }
              })
            : null,
          run.status !== "blocked"
            ? createElement("button", {
                className: "btn governance-action-btn",
                text: "Block",
                attrs: { type: "button" },
                dataset: {
                  agentWorkOrderRunAction: "blocked",
                  agentWorkOrderRunId: run.id
                }
              })
            : null,
          run.status === "blocked"
            ? createElement("button", {
                className: "btn governance-action-btn agent-work-order-run-resume-btn",
                text: "Resume",
                attrs: { type: "button" },
                dataset: {
                  agentWorkOrderRunAction: "running",
                  agentWorkOrderRunId: run.id
                }
              })
            : null,
          createElement("button", {
            className: "btn governance-action-btn agent-work-order-run-cancel-btn",
            text: "Cancel",
            attrs: { type: "button" },
            dataset: {
              agentWorkOrderRunAction: "cancelled",
              agentWorkOrderRunId: run.id
            }
          })
        ]
        : [],
      ["failed", "cancelled"].includes(run.status) && !run.archivedAt
        ? createElement("button", {
            className: "btn governance-action-btn agent-work-order-run-retry-btn",
            text: "Retry",
            attrs: { type: "button" },
            dataset: {
              agentWorkOrderRunAction: "queued",
              agentWorkOrderRunId: run.id
            }
          })
        : null,
      ["passed", "failed", "cancelled"].includes(run.status) && !run.archivedAt
        ? createElement("button", {
            className: "btn governance-action-btn agent-work-order-run-archive-btn",
            text: "Archive",
            attrs: { type: "button" },
            dataset: {
              agentWorkOrderRunArchive: "true",
              agentWorkOrderRunId: run.id
            }
          })
        : null,
      run.archivedAt
        ? createElement("button", {
            className: "btn governance-action-btn agent-work-order-run-restore-btn",
            text: "Restore",
            attrs: { type: "button" },
            dataset: {
              agentWorkOrderRunArchive: "false",
              agentWorkOrderRunId: run.id
            }
          })
        : null
    ].flat())
  ]));

  return createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: "1rem",
      marginTop: "1rem"
    }
  }, [
    createListSection("Recent Activity", "Latest persisted notes, tasks, workflows, milestones, and findings.", createActivityEntries(governance.recentActivity)),
    createListSection("Action Queue", "Direct remediation items derived from governance gaps and incomplete portfolio state.", queueEntries),
    createListSection("Suppressed Queue", "Deferred queue items hidden from the active queue until restored.", suppressedQueueEntries),
    createListSection("Operation Log", "Recent Governance automation actions captured from bootstrap, execution, suppression, and restore flows.", operationEntries),
    createListSection("Workflow Runbook", "Supervised workflow and agent-readiness checkpoints derived from active project workflows.", workflowRunbookEntries),
    createListSection("Agent Sessions", "Prepared supervised agent handoff sessions captured from project workbenches.", agentSessionEntries),
    createListSection("Control Plane Decision Gate", "Ready/review/hold gate for supervised app-development build passes.", agentControlPlaneDecisionEntries),
    createListSection("Release Control", "Live non-secret Git, deployment smoke, validation, and saved release checkpoint state.", releaseControlEntries),
    createListSection("Data Sources Access Gate", "Ready/review/hold gate for source access before supervised ingestion and agent work.", dataSourcesAccessGateEntries),
    createListSection("Data Sources Access Review Queue", "Credential, certificate, SSH, and manual-access checks that can block supervised app-development ingestion.", dataSourcesAccessReviewQueueEntries),
    createListSection("Data Sources Access Validation Runbook", "Non-secret operator-side validation steps and command hints grouped by access method.", dataSourcesAccessValidationRunbookEntries),
    createListSection("Data Sources Access Validation Evidence Coverage", "Coverage queue showing which configured sources still need non-secret access-validation evidence.", dataSourcesAccessValidationEvidenceCoverageEntries),
    createListSection("Data Sources Access Validation Evidence", "Recorded non-secret proof that source-access checks were completed outside this app.", dataSourceAccessValidationEvidenceEntries),
    createListSection("Data Sources Access Validation Evidence Snapshots", "Persisted non-secret source-access validation evidence handoffs.", dataSourceAccessValidationEvidenceSnapshotEntries),
    createListSection("Data Sources Access Validation Evidence Snapshot Drift", "Latest saved evidence snapshot compared with the current non-secret evidence ledger.", dataSourceAccessValidationEvidenceSnapshotDiffEntries),
    createListSection("Data Sources Access Task Ledger", "Trackable Governance tasks created from source-access review queue items.", dataSourcesAccessTaskEntries),
    createListSection("Data Sources Access Task Ledger Snapshots", "Persisted non-secret source-access task ledger handoffs.", dataSourcesAccessTaskLedgerSnapshotEntries),
    createListSection("Control Plane Decision Snapshots", "Persisted ready/review/hold decision gates for audit and supervised-build handoff history.", agentControlPlaneDecisionSnapshotEntries),
    createListSection("Control Plane Baseline Status", "Current baseline selection state for baseline-vs-live drift workflows.", agentControlPlaneBaselineStatusEntries),
    createListSection("Control Plane Snapshots", "Persisted consolidated Agent Control Plane handoffs.", agentControlPlaneSnapshotEntries),
    createListSection("Agent Readiness Matrix", "Ranked project readiness for supervised agent build passes.", agentReadinessEntries),
    createListSection("Work Order Snapshots", "Persisted Agent Work Order exports created from readiness filters.", agentWorkOrderSnapshotEntries),
    createListSection("Agent Execution Metrics", "Portfolio-level Agent Work Order run health, status split, and latest execution event.", agentExecutionMetricEntries),
    createListSection("SLA Breach Ledger", "Recent open and resolved Agent Execution SLA breach lifecycle records.", slaLedgerEntries),
    createListSection("SLA Ledger Snapshots", "Persisted SLA Breach Ledger exports for external audit handoffs.", agentExecutionSlaLedgerSnapshotEntries),
    createListSection("Agent Execution Queue", "Queued and in-flight Agent Work Order runs with validation outcomes.", agentWorkOrderRunEntries),
    createListSection("Governance Gaps", "Important projects that still have no saved governance profile.", gapEntries),
    createListSection("Project Registry", "Persisted ownership, lifecycle, and target-state profiles across the portfolio.", profileEntries),
    createListSection("Profile History", "Recent ownership, lifecycle, and status changes captured over time.", historyEntries),
    createListSection("Decision Log", "Persisted decision notes that define portfolio direction.", decisionEntries),
    createListSection("Milestone Focus", "Upcoming or unresolved milestones that still need attention.", milestoneEntries),
    createListSection("Workflow Queue", "Active workflows currently moving through the delivery pipeline.", workflowEntries)
  ]);
}
