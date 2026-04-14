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
 * @param {GovernancePayload} governance
 * @param {string} runId
 * @param {string} targetAction
 */
function getLatestExecutionResultCheckpoint(governance, runId, targetAction) {
  return (governance.agentExecutionResultCheckpoints || [])
    .filter((checkpoint) => checkpoint.runId === runId && checkpoint.targetAction === targetAction)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] || null;
}

/**
 * @param {string} status
 */
function getExecutionCheckpointStatusColor(status) {
  if (status === "approved") return "var(--success)";
  if (status === "dismissed") return "var(--text-muted)";
  if (status === "deferred") return "var(--warning)";
  return "var(--danger)";
}

/**
 * @param {import("./dashboard-types.js").PersistedAgentWorkOrderRun} run
 * @param {string} targetAction
 * @param {"approved" | "needs-review" | "deferred" | "dismissed"} status
 * @param {string} label
 */
function createExecutionResultCheckpointButton(run, targetAction, status, label) {
  return createElement("button", {
    className: `btn governance-action-btn agent-execution-result-checkpoint-${status}-btn`,
    text: label,
    attrs: { type: "button" },
    dataset: {
      agentExecutionResultCheckpointRunId: run.id,
      agentExecutionResultCheckpointTargetAction: targetAction,
      agentExecutionResultCheckpointStatus: status
    }
  });
}

/**
 * @param {import("./dashboard-types.js").PersistedAgentWorkOrderRun} run
 * @param {GovernancePayload} governance
 * @param {import("./dashboard-types.js").GovernanceAgentExecutionMetrics} executionMetrics
 */
function createExecutionResultCheckpointPanel(run, governance, executionMetrics) {
  const actions = [];
  if (["failed", "cancelled"].includes(run.status) && !run.archivedAt) {
    actions.push(["retry", "Retry"]);
  }
  if (["passed", "failed", "cancelled"].includes(run.status) && !run.archivedAt) {
    actions.push(["archive", "Archive"]);
    actions.push(["retention", "Retention"]);
    actions.push(["baseline-refresh", "Baseline"]);
  }
  if (run.slaBreachedAt && !run.slaResolvedAt && !run.archivedAt) {
    actions.push(["resolve-sla", "Resolve SLA"]);
    if (!actions.some(([targetAction]) => targetAction === "baseline-refresh")) {
      actions.push(["baseline-refresh", "Baseline"]);
    }
  } else if (isStaleAgentWorkOrderRun(run, executionMetrics.staleThresholdHours, executionMetrics.staleStatuses) && !run.archivedAt) {
    actions.push(["baseline-refresh", "Baseline"]);
  }
  if (!actions.length) return null;

  return createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.55rem",
      padding: "0.75rem",
      border: "1px solid var(--border)",
      borderRadius: "0.85rem",
      background: "color-mix(in srgb, var(--surface-hover) 55%, transparent 45%)"
    }
  }, [
    createElement("div", {
      text: "Execution result checkpoints",
      style: {
        color: "var(--text-muted)",
        fontSize: "0.78rem",
        fontWeight: "800",
        letterSpacing: "0.08em",
        textTransform: "uppercase"
      }
    }),
    ...actions.map(([targetAction, label]) => {
      const checkpoint = getLatestExecutionResultCheckpoint(governance, run.id, targetAction);
      const status = checkpoint?.status || "needs-review";
      return createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.45rem",
          paddingTop: "0.45rem",
          borderTop: "1px solid var(--border)"
        }
      }, [
        createElement("div", {
          style: {
            display: "flex",
            justifyContent: "space-between",
            gap: "0.7rem",
            alignItems: "center"
          }
        }, [
          createElement("div", {
            text: `${label} gate`,
            style: {
              color: "var(--text)",
              fontWeight: "800",
              fontSize: "0.86rem"
            }
          }),
          createTag(status, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: getExecutionCheckpointStatusColor(status)
          })
        ]),
        checkpoint?.createdAt
          ? createElement("div", {
              text: `${checkpoint.reviewer || "operator"} • ${new Date(checkpoint.createdAt).toLocaleString()}${checkpoint.note ? ` • ${checkpoint.note}` : ""}`,
              style: {
                color: "var(--text-muted)",
                fontSize: "0.8rem",
                lineHeight: "1.4"
              }
            })
          : createElement("div", {
              text: "No checkpoint recorded yet. Approval is required before this action can be finalized.",
              style: {
                color: "var(--text-muted)",
                fontSize: "0.8rem",
                lineHeight: "1.4"
              }
            }),
        createElement("div", {
          className: "governance-actions"
        }, [
          createExecutionResultCheckpointButton(run, targetAction, "approved", "Approve"),
          createExecutionResultCheckpointButton(run, targetAction, "needs-review", "Review"),
          createExecutionResultCheckpointButton(run, targetAction, "deferred", "Defer"),
          createExecutionResultCheckpointButton(run, targetAction, "dismissed", "Dismiss")
        ])
      ]);
    })
  ]);
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
  const checkpointSummary = "sourceAccessCheckpoints" in source ? source.sourceAccessCheckpoints : null;
  const checkpointTotal = checkpointSummary?.total || 0;
  const checkpointUnresolved = checkpointSummary?.unresolved || 0;
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
        : null,
      checkpointSummary
        ? createElement("div", {
            text: `Source checkpoints: ${checkpointUnresolved} unresolved / ${checkpointTotal} total${checkpointTotal ? ` | ${checkpointSummary.approved || 0} approved | ${checkpointSummary.dismissed || 0} dismissed` : ""}`,
            style: {
              color: checkpointUnresolved ? "var(--warning)" : checkpointTotal ? "var(--success)" : "var(--text-muted)",
              fontSize: "0.78rem",
              marginTop: "0.25rem",
              maxWidth: "44rem"
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
      }),
      createElement("button", {
        className: "btn governance-action-btn data-source-summary-snapshot-drift-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: {
          sourceSummarySnapshotDriftId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn data-source-summary-snapshot-drift-task-btn",
        text: "Track Drift",
        attrs: { type: "button" },
        dataset: {
          sourceSummarySnapshotDriftTaskId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn data-source-summary-snapshot-drift-accept-btn",
        text: "Accept Drift",
        attrs: { type: "button" },
        dataset: {
          sourceSummarySnapshotDriftAcceptId: snapshot.id
        }
      })
    ])
  ]);
}

/**
 * @param {import("./dashboard-types.js").PersistedDataSourcesAccessValidationWorkflowSnapshot} snapshot
 */
export function createDataSourcesAccessValidationWorkflowSnapshotItem(snapshot) {
  const healthColor = snapshot.blockedCount > 0
    ? "var(--danger)"
    : snapshot.pendingCount > 0
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
        text: snapshot.title || "Data Sources Access Validation Workflow",
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
        text: `${snapshot.total} total | ${snapshot.readyCount} ready | ${snapshot.pendingCount} pending | ${snapshot.blockedCount} blocked | ${snapshot.missingEvidenceCount} missing evidence`,
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
        gap: "0.5rem",
        flexWrap: "wrap",
        justifyContent: "flex-end"
      }
    }, [
      createTag(snapshot.blockedCount > 0 ? "BLOCKED" : snapshot.pendingCount > 0 ? "PENDING" : "READY", {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: healthColor
      }),
      createTag(`${snapshot.externalAccessRequiredCount || 0} EXTERNAL`, {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: (snapshot.externalAccessRequiredCount || 0) > 0 ? "var(--warning)" : "var(--success)"
      }),
      createElement("button", {
        className: "btn governance-action-btn data-source-access-validation-workflow-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: {
          sourceAccessValidationWorkflowSnapshotId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn data-source-access-validation-workflow-snapshot-drift-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: {
          sourceAccessValidationWorkflowSnapshotDriftId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn data-source-access-validation-workflow-snapshot-drift-task-btn",
        text: "Track Drift",
        attrs: { type: "button" },
        dataset: {
          sourceAccessValidationWorkflowSnapshotDriftTaskId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn data-source-access-validation-workflow-snapshot-drift-accept-btn",
        text: "Accept Drift",
        attrs: { type: "button" },
        dataset: {
          sourceAccessValidationWorkflowSnapshotDriftAcceptId: snapshot.id
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
  const dataSourcesAccessTasks = Array.isArray(governance.dataSourcesAccessTasks)
    ? governance.dataSourcesAccessTasks
    : [];
  const dataSourcesAccessValidationWorkflowTaskCount = dataSourcesAccessTasks.filter((task) => task.sourceAccessValidationWorkflowId).length;
  const dataSourcesAccessValidationWorkflowOpenTaskCount = dataSourcesAccessTasks.filter((task) => {
    if (!task.sourceAccessValidationWorkflowId) return false;
    return !["done", "resolved", "closed", "cancelled", "archived"].includes(String(task.status || "").toLowerCase());
  }).length;
  const dataSourcesAccessValidationRunbookSummary = governance.dataSourcesAccessValidationRunbook?.summary || {};
  const dataSourcesAccessValidationEvidenceCoverageSummary = governance.dataSourcesAccessValidationEvidenceCoverage?.summary || {};
  const sourceAccessCheckpointCount = summary.sourceAccessCheckpointCount || 0;
  const sourceAccessCheckpointUnresolvedCount = summary.sourceAccessCheckpointUnresolvedCount || 0;
  const evidenceSnapshotDriftSeverity = summary.dataSourceAccessValidationEvidenceSnapshotDriftSeverity || "missing-snapshot";
  const evidenceSnapshotDriftAccent = evidenceSnapshotDriftSeverity === "high" || evidenceSnapshotDriftSeverity === "missing-snapshot"
    ? "var(--danger)"
    : evidenceSnapshotDriftSeverity === "medium" || evidenceSnapshotDriftSeverity === "low"
      ? "var(--warning)"
      : "var(--success)";
  const workflowSnapshotDriftSeverity = summary.dataSourceAccessValidationWorkflowSnapshotDriftSeverity || "missing-snapshot";
  const workflowSnapshotDriftAccent = workflowSnapshotDriftSeverity === "high" || workflowSnapshotDriftSeverity === "missing-snapshot"
    ? "var(--danger)"
    : workflowSnapshotDriftSeverity === "medium" || workflowSnapshotDriftSeverity === "low"
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
  const releaseControlTaskCount = summary.releaseControlTaskCount || 0;
  const releaseControlOpenTaskCount = summary.releaseControlOpenTaskCount || 0;
  const decisionTaskCount = summary.agentControlPlaneDecisionTaskCount || 0;
  const openDecisionTaskCount = summary.agentControlPlaneDecisionOpenTaskCount || 0;
  const executionResultTaskCount = summary.agentExecutionResultTaskCount || 0;
  const openExecutionResultTaskCount = summary.agentExecutionResultOpenTaskCount || 0;
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
      accentColor: openDecisionTaskCount ? "var(--warning)" : "var(--success)",
      label: "Decision Tasks",
      value: `${openDecisionTaskCount}/${decisionTaskCount}`,
      detail: "Open tasks created from Agent Control Plane decision reasons"
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
      accentColor: releaseControlOpenTaskCount ? "var(--warning)" : "var(--success)",
      label: "Release Tasks",
      value: `${releaseControlOpenTaskCount}/${releaseControlTaskCount}`,
      detail: "Open release-control tasks created from Release Build Gate actions"
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
      accentColor: sourceAccessCheckpointUnresolvedCount
        ? "var(--warning)"
        : sourceAccessCheckpointCount
          ? "var(--success)"
          : "var(--primary)",
      label: "Source Checkpoints",
      value: `${sourceAccessCheckpointUnresolvedCount}/${sourceAccessCheckpointCount}`,
      detail: `${summary.sourceAccessCheckpointDeferredCount || 0} deferred | ${summary.sourceAccessCheckpointNeedsReviewCount || 0} needs review | ${summary.sourceAccessCheckpointSources || 0} source(s)`
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
      accentColor: workflowSnapshotDriftAccent,
      label: "Workflow Drift",
      value: workflowSnapshotDriftSeverity.toUpperCase(),
      detail: `${summary.dataSourceAccessValidationWorkflowSnapshotCount || 0} snapshot(s) • ${summary.dataSourcesAccessValidationWorkflowReadyCount || 0}/${summary.dataSourcesAccessValidationWorkflowTotalCount || 0} ready • drift score ${summary.dataSourceAccessValidationWorkflowSnapshotDriftScore || 0}`
    }),
    createKpiCard({
      accentColor: dataSourcesAccessValidationWorkflowOpenTaskCount ? "var(--warning)" : "var(--success)",
      label: "Workflow Tasks",
      value: `${dataSourcesAccessValidationWorkflowOpenTaskCount}/${dataSourcesAccessValidationWorkflowTaskCount}`,
      detail: "Open source validation workflow tasks created from Governance or Sources seeding"
    }),
    createKpiCard({
      accentColor: "var(--primary)",
      label: "Agent Ready",
      value: `${summary.agentReadyProjects}/${summary.agentReadinessItems}`,
      detail: "Projects ready for a supervised agent build pass"
    }),
    createKpiCard({
      accentColor: summary.agentPolicyCheckpointUnresolvedCount ? "var(--warning)" : summary.agentPolicyCheckpointApprovedCount ? "var(--success)" : "var(--primary)",
      label: "Agent Policies",
      value: `${summary.agentPolicyExecutableCount || 0}/${summary.agentReadinessItems || 0}`,
      detail: `${summary.agentPolicyCheckpointUnresolvedCount || 0} unresolved / ${summary.agentPolicyCheckpointCount || 0} checkpoint(s) before queueing`
    }),
    createKpiCard({
      accentColor: summary.agentExecutionResultCheckpointRequiredCount ? "var(--warning)" : summary.agentExecutionResultCheckpointApprovedCount ? "var(--success)" : "var(--primary)",
      label: "Execution Gates",
      value: `${summary.agentExecutionResultCheckpointRequiredCount || 0}`,
      detail: `${summary.agentExecutionResultBaselineBlockedCount || 0} baseline blocker(s) • ${summary.agentExecutionResultCheckpointUnresolvedCount || 0}/${summary.agentExecutionResultCheckpointCount || 0} unresolved checkpoints`
    }),
    createKpiCard({
      accentColor: openExecutionResultTaskCount ? "var(--warning)" : executionResultTaskCount ? "var(--success)" : "var(--primary)",
      label: "Execution Tasks",
      value: `${openExecutionResultTaskCount}/${executionResultTaskCount}`,
      detail: "Follow-up tasks created from deferred execution-result gate checkpoints"
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
      }),
      createElement("button", {
        className: "btn governance-action-btn",
        text: "Not Actionable",
        attrs: { type: "button" },
        dataset: {
          governanceAction: "suppress-queue-item",
          queueItemId: item.id,
          queueKind: item.kind,
          queueTitle: item.title,
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
  const taskSeedingCheckpointStatusOrder = ["approved", "deferred", "dismissed", "needs-review"];
  const taskSeedingCheckpointStatusLabels = {
    approved: "Approved",
    deferred: "Deferred",
    dismissed: "Dismissed",
    "needs-review": "Needs Review"
  };
  const taskSeedingCheckpointStatusColors = {
    approved: "var(--success)",
    deferred: "var(--warning)",
    dismissed: "var(--danger)",
    "needs-review": "var(--text-muted)"
  };
  /**
   * @param {import("./dashboard-types.js").TaskSeedingCheckpoint} checkpoint
   */
  function getTaskSeedingCheckpointLifecycleStatus(checkpoint) {
    const status = checkpoint.status || "needs-review";
    return taskSeedingCheckpointStatusOrder.includes(status) ? status : "needs-review";
  }
  /**
   * @param {import("./dashboard-types.js").TaskSeedingCheckpoint} checkpoint
   */
  function createTaskSeedingCheckpointEntry(checkpoint) {
    const lifecycleStatus = getTaskSeedingCheckpointLifecycleStatus(checkpoint);
    return createElement("div", {
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
            text: checkpoint.title || "Generated task batch checkpoint",
            style: {
              fontWeight: "800",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: `${checkpoint.source || "governance"} - ${checkpoint.itemCount || 0} item(s) - ${checkpoint.createdAt ? new Date(checkpoint.createdAt).toLocaleString() : "saved checkpoint"}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.3rem"
            }
          })
        ]),
        createTag((taskSeedingCheckpointStatusLabels[lifecycleStatus] || lifecycleStatus).toUpperCase(), {
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: taskSeedingCheckpointStatusColors[lifecycleStatus] || "var(--text-muted)"
        })
      ]),
      checkpoint.note
        ? createElement("div", {
            text: checkpoint.note,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          })
        : null
    ]);
  }
  const taskSeedingCheckpointEntries = taskSeedingCheckpointStatusOrder.flatMap((status) => {
    const checkpoints = (governance.taskSeedingCheckpoints || []).filter((checkpoint) => getTaskSeedingCheckpointLifecycleStatus(checkpoint) === status);
    if (!checkpoints.length) return [];
    return [
      createElement("div", {
        className: "task-seeding-checkpoint-status-group",
        dataset: { taskSeedingCheckpointStatusGroup: status },
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.8rem",
          padding: "0.45rem 0.65rem",
          border: "1px solid var(--border)",
          borderRadius: "999px",
          background: "var(--surface-hover)"
        }
      }, [
        createElement("strong", {
          text: taskSeedingCheckpointStatusLabels[status],
          style: {
            color: "var(--text)",
            fontSize: "0.82rem",
            letterSpacing: "0.05em",
            textTransform: "uppercase"
          }
        }),
        createTag(`${checkpoints.length} checkpoint(s)`, {
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: taskSeedingCheckpointStatusColors[status] || "var(--text-muted)"
        })
      ]),
      ...checkpoints.map(createTaskSeedingCheckpointEntry)
    ];
  });
  const governanceTaskUpdateLedgerItems = Array.isArray(governance.governanceTaskUpdateLedger?.items)
    ? governance.governanceTaskUpdateLedger.items
    : [];
  const governanceTaskUpdateLedgerEntries = governanceTaskUpdateLedgerItems.map((item) => createElement("div", {
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
          text: item.title || item.taskId || "Governance task update audit row",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${item.projectName || item.projectId || "unassigned"} - ${item.previousStatus || "unset"} -> ${item.nextStatus || "unset"} - ${item.createdAt ? new Date(item.createdAt).toLocaleString() : "recorded update"}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            marginTop: "0.3rem"
          }
        })
      ]),
      createTag((item.type || "governance-task-updated").toUpperCase(), {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: item.previousStatus !== item.nextStatus ? "var(--warning)" : "var(--text-muted)"
      })
    ]),
    createElement("div", {
      text: item.updatedFields?.length
        ? `Changed fields: ${item.updatedFields.join(", ")}`
        : "Task lifecycle audit metadata captured without secrets.",
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
        className: "btn governance-action-btn governance-task-update-ledger-confirm-btn",
        text: "Confirm",
        attrs: { type: "button" },
        dataset: {
          governanceTaskUpdateLedgerCheckpointAction: "confirm",
          governanceTaskUpdateLedgerOperationId: item.operationId || ""
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn governance-task-update-ledger-defer-btn",
        text: "Defer",
        attrs: { type: "button" },
        dataset: {
          governanceTaskUpdateLedgerCheckpointAction: "defer",
          governanceTaskUpdateLedgerOperationId: item.operationId || ""
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn governance-task-update-ledger-escalate-btn",
        text: "Escalate",
        attrs: { type: "button" },
        dataset: {
          governanceTaskUpdateLedgerCheckpointAction: "escalate",
          governanceTaskUpdateLedgerOperationId: item.operationId || ""
        }
      })
    ])
  ]));
  const governanceTaskUpdateLedgerSnapshotDiff = governance.governanceTaskUpdateLedgerSnapshotDiff;
  const governanceTaskUpdateLedgerDriftItems = Array.isArray(governanceTaskUpdateLedgerSnapshotDiff?.driftItems)
    ? governanceTaskUpdateLedgerSnapshotDiff.driftItems
    : [];
  const governanceTaskUpdateLedgerSnapshotDiffEntries = governanceTaskUpdateLedgerSnapshotDiff
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
                text: governanceTaskUpdateLedgerSnapshotDiff.snapshotTitle || "No Governance task update audit snapshot",
                style: {
                  fontWeight: "800",
                  color: "var(--text)"
                }
              }),
              createElement("div", {
                text: governanceTaskUpdateLedgerSnapshotDiff.snapshotCreatedAt ? new Date(governanceTaskUpdateLedgerSnapshotDiff.snapshotCreatedAt).toLocaleString() : "No snapshot saved yet",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.84rem",
                  marginTop: "0.3rem"
                }
              })
            ]),
            createTag((governanceTaskUpdateLedgerSnapshotDiff.driftSeverity || "missing-snapshot").toUpperCase(), {
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: governanceTaskUpdateLedgerSnapshotDiff.driftSeverity === "high" || governanceTaskUpdateLedgerSnapshotDiff.driftSeverity === "missing-snapshot"
                ? "var(--danger)"
                : governanceTaskUpdateLedgerSnapshotDiff.driftSeverity === "none"
                  ? "var(--success)"
                  : "var(--warning)"
            })
          ]),
          createElement("div", {
            text: governanceTaskUpdateLedgerSnapshotDiff.recommendedAction || "Save a Governance task update audit ledger snapshot before comparing drift.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `${governanceTaskUpdateLedgerSnapshotDiff.driftScore || 0} drift score - ${governanceTaskUpdateLedgerDriftItems.length} drift item(s)`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          }),
          governanceTaskUpdateLedgerDriftItems.length
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
                  text: "Task update audit drift fields",
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.78rem",
                    fontWeight: "800",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase"
                  }
                }),
                ...governanceTaskUpdateLedgerDriftItems.slice(0, 8).map((item) => createElement("div", {
                  style: {
                    display: "grid",
                    gap: "0.5rem",
                    padding: "0.65rem",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    background: "var(--surface)"
                  }
                }, [
                  createElement("div", {
                    text: `${item.label || item.field || "Task update audit drift"}: ${item.before ?? "none"} -> ${item.current ?? "none"} (${item.delta >= 0 ? "+" : ""}${item.delta ?? 0})`,
                    style: {
                      color: "var(--text)",
                      fontSize: "0.84rem",
                      fontWeight: "700",
                      lineHeight: "1.45"
                    }
                  }),
                  createElement("div", {
                    className: "governance-actions"
                  }, [
                    createElement("button", {
                      className: "btn governance-action-btn governance-task-update-ledger-drift-item-confirm-btn",
                      text: "Confirm",
                      attrs: { type: "button" },
                      dataset: {
                        governanceTaskUpdateLedgerDriftItemField: item.field || item.label || "",
                        governanceTaskUpdateLedgerDriftItemDecision: "confirmed"
                      }
                    }),
                    createElement("button", {
                      className: "btn governance-action-btn governance-task-update-ledger-drift-item-defer-btn",
                      text: "Defer",
                      attrs: { type: "button" },
                      dataset: {
                        governanceTaskUpdateLedgerDriftItemField: item.field || item.label || "",
                        governanceTaskUpdateLedgerDriftItemDecision: "deferred"
                      }
                    }),
                    createElement("button", {
                      className: "btn governance-action-btn governance-task-update-ledger-drift-item-escalate-btn",
                      text: "Escalate",
                      attrs: { type: "button" },
                      dataset: {
                        governanceTaskUpdateLedgerDriftItemField: item.field || item.label || "",
                        governanceTaskUpdateLedgerDriftItemDecision: "escalated"
                      }
                    })
                  ])
                ])),
                governanceTaskUpdateLedgerDriftItems.length > 8
                  ? createElement("div", {
                      text: `${governanceTaskUpdateLedgerDriftItems.length - 8} additional drift item(s).`,
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
  const governanceTaskUpdateLedgerSnapshotEntries = (governance.governanceTaskUpdateLedgerSnapshots || []).map((snapshot) => createElement("div", {
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
          text: snapshot.title || "Governance Task Update Ledger",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${new Date(snapshot.createdAt).toLocaleString()} - ${snapshot.visibleCount || 0} visible - ${snapshot.statusChangeCount || 0} status change(s)`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            marginTop: "0.3rem"
          }
        })
      ]),
      createTag(`${snapshot.total || 0} TOTAL`, {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: (snapshot.statusChangeCount || 0) > 0 ? "var(--warning)" : "var(--success)"
      })
    ]),
    createElement("div", {
      text: `${snapshot.taskCount || 0} tracked task(s) - ${snapshot.projectCount || 0} tracked project(s) - ${snapshot.metadataUpdateCount || 0} metadata-only update(s) - ${snapshot.secretPolicy || "non-secret task lifecycle metadata only"}`,
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
        className: "btn governance-action-btn governance-task-update-ledger-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: {
          governanceTaskUpdateLedgerSnapshotId: snapshot.id
        }
      })
    ])
  ]));
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

  const agentReadinessEntries = governance.agentReadinessMatrix.map((item) => {
    const agentPolicy = item.agentPolicy || {
      policyId: item.projectId ? `agent-policy:${item.projectId}` : "",
      checkpointStatus: "needs-review",
      executable: false,
      role: "readiness-reviewer",
      runtime: "planning-only-agent",
      isolationMode: "read-only-planning",
      skillBundle: [],
      hookPolicy: [],
      recommendedAction: "Review generated managed-agent policy before queueing."
    };
    const policyStatus = agentPolicy.checkpointStatus || "needs-review";
    const policyColor = policyStatus === "approved"
      ? "var(--success)"
      : policyStatus === "dismissed"
        ? "var(--text-muted)"
        : policyStatus === "deferred"
          ? "var(--warning)"
          : "var(--danger)";
    const policySkills = (agentPolicy.skillBundle || []).join(", ") || "project-governance";
    const policyHooks = (agentPolicy.hookPolicy || []).join(", ") || "policy-checkpoint-required";
    const policyActionPayload = {
      agentPolicyId: agentPolicy.policyId || (item.projectId ? `agent-policy:${item.projectId}` : ""),
      agentPolicyProjectId: encodeAppId(item.projectId),
      agentPolicyProjectName: item.projectName,
      agentPolicyRelPath: item.relPath || "",
      agentPolicyRole: agentPolicy.role || "readiness-reviewer",
      agentPolicyRuntime: agentPolicy.runtime || "planning-only-agent",
      agentPolicyIsolationMode: agentPolicy.isolationMode || "read-only-planning",
      agentPolicySkillBundle: JSON.stringify(agentPolicy.skillBundle || []),
      agentPolicyHookPolicy: JSON.stringify(agentPolicy.hookPolicy || [])
    };

    return createElement("div", {
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
    createElement("div", {
      className: "governance-gap-card",
      style: {
        background: "rgba(148, 163, 184, 0.08)",
        borderStyle: "dashed"
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
            text: `Managed policy: ${agentPolicy.role || "readiness-reviewer"}`,
            style: {
              fontWeight: "800",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: `${agentPolicy.runtime || "planning-only-agent"} / ${agentPolicy.isolationMode || "read-only-planning"}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(`POLICY ${policyStatus.toUpperCase()}`, {
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: policyColor
        })
      ]),
      createElement("div", {
        text: agentPolicy.recommendedAction || "Review generated managed-agent policy before queueing.",
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        text: `Skills: ${policySkills} | Hooks: ${policyHooks}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.78rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn agent-policy-checkpoint-approve-btn",
          text: "Approve Policy",
          attrs: { type: "button" },
          dataset: {
            ...policyActionPayload,
            agentPolicyCheckpointStatus: "approved"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn agent-policy-checkpoint-review-btn",
          text: "Needs Review",
          attrs: { type: "button" },
          dataset: {
            ...policyActionPayload,
            agentPolicyCheckpointStatus: "needs-review"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn agent-policy-checkpoint-defer-btn",
          text: "Defer",
          attrs: { type: "button" },
          dataset: {
            ...policyActionPayload,
            agentPolicyCheckpointStatus: "deferred"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn agent-policy-checkpoint-dismiss-btn",
          text: "Dismiss",
          attrs: { type: "button" },
          dataset: {
            ...policyActionPayload,
            agentPolicyCheckpointStatus: "dismissed"
          }
        })
      ])
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
        text: agentPolicy.executable ? "Queue Run" : "Approve Policy First",
        attrs: agentPolicy.executable
          ? { type: "button" }
          : { type: "button", disabled: "disabled", "aria-disabled": "true" },
        title: agentPolicy.executable ? "Queue this approved generated managed-agent work order." : "Approve the generated managed-agent policy before queueing.",
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
  ]);
  });

  const agentPolicyCheckpointEntries = (governance.agentPolicyCheckpoints || []).map((checkpoint) => {
    const status = checkpoint.status || "needs-review";
    const statusColor = status === "approved"
      ? "var(--success)"
      : status === "dismissed"
        ? "var(--text-muted)"
        : status === "deferred"
          ? "var(--warning)"
          : "var(--danger)";
    return createElement("div", {
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
            text: checkpoint.projectName || checkpoint.projectId || "Managed agent policy",
            style: {
              fontWeight: "800",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: `${checkpoint.policyId || "policy-id-missing"} | ${checkpoint.role || "role unset"} | ${checkpoint.runtime || "runtime unset"}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(status.toUpperCase(), {
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: statusColor
        })
      ]),
      createElement("div", {
        text: `Isolation: ${checkpoint.isolationMode || "unset"} | Skills: ${(checkpoint.skillBundle || []).join(", ") || "none"} | Hooks: ${(checkpoint.hookPolicy || []).join(", ") || "none"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      checkpoint.note || checkpoint.reason
        ? createElement("div", {
            text: checkpoint.note || checkpoint.reason,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          })
        : null,
      createElement("div", {
        text: `${checkpoint.createdAt ? new Date(checkpoint.createdAt).toLocaleString() : "saved checkpoint"} | ${checkpoint.reviewer || "operator"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.78rem",
          lineHeight: "1.45"
        }
      })
    ]);
  });

  const agentExecutionResultCheckpointEntries = (governance.agentExecutionResultCheckpoints || []).map((checkpoint) => {
    const status = checkpoint.status || "needs-review";
    return createElement("div", {
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
            text: checkpoint.projectName || checkpoint.projectId || "Execution result checkpoint",
            style: {
              fontWeight: "800",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: `${checkpoint.targetAction || "baseline-refresh"} | ${checkpoint.runStatus || "status unset"} | ${checkpoint.runTitle || checkpoint.runId}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(status.toUpperCase(), {
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: getExecutionCheckpointStatusColor(status)
        })
      ]),
      checkpoint.note || checkpoint.reason
        ? createElement("div", {
            text: checkpoint.note || checkpoint.reason,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          })
        : null,
      createElement("div", {
        text: `${checkpoint.createdAt ? new Date(checkpoint.createdAt).toLocaleString() : "saved checkpoint"} | ${checkpoint.reviewer || "operator"} | ${checkpoint.secretPolicy || "Non-secret execution result metadata only."}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.78rem",
          lineHeight: "1.45"
        }
      })
    ]);
  });

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
      text: `Ready ${snapshot.readyCount} • Needs prep ${snapshot.needsPrepCount} • Blocked ${snapshot.blockedCount} • Policy approved ${snapshot.approvedPolicyCount || 0} • Executable ${snapshot.executableCount || 0}`,
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
  const dataSourcesAccessValidationWorkflowItems = Array.isArray(governance.dataSourcesAccessValidationWorkflow?.items)
    ? governance.dataSourcesAccessValidationWorkflow.items
    : [];
  const dataSourceAccessValidationEvidence = Array.isArray(governance.dataSourceAccessValidationEvidence)
    ? governance.dataSourceAccessValidationEvidence
    : [];
  const dataSourcesAccessTasks = Array.isArray(governance.dataSourcesAccessTasks)
    ? governance.dataSourcesAccessTasks
    : [];
  const dataSourcesAccessValidationWorkflowTasks = dataSourcesAccessTasks.filter((task) => task.sourceAccessValidationWorkflowId);
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
  const dataSourcesAccessValidationWorkflowEntries = dataSourcesAccessValidationWorkflowItems.map((item) => createElement("div", {
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
          text: item.label || item.sourceId || "Source validation workflow",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${item.stage || "review"} • ${item.accessMethod || "review-required"}`,
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
        createTag(String(item.status || "pending").toUpperCase(), {
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: item.status === "blocked" ? "var(--danger)" : item.status === "ready" ? "var(--success)" : "var(--warning)"
        }),
        createTag(String(item.priority || "medium").toUpperCase(), {
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: item.priority === "high" ? "var(--danger)" : item.priority === "medium" ? "var(--warning)" : "var(--text-muted)"
        })
      ])
    ]),
    createElement("div", {
      text: item.action || "Track the source access validation workflow without storing secrets.",
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    Array.isArray(item.blockerTypes) && item.blockerTypes.length
      ? createElement("div", {
          text: `Blockers: ${item.blockerTypes.join(", ")}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      : null,
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn source-validation-workflow-task-snapshot-btn",
        text: "Track + Snapshot",
        attrs: { type: "button" },
        dataset: {
          sourceValidationWorkflowTaskSnapshot: item.id || "",
          sourceValidationWorkflowTaskSnapshotRenderTarget: "governance"
        }
      })
    ])
  ]));
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
        : null,
      item.sourceAccessCheckpoints?.total
        ? createTag(`checkpoints ${item.sourceAccessCheckpoints.unresolved || 0}/${item.sourceAccessCheckpoints.total}`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: item.sourceAccessCheckpoints.unresolved ? "var(--warning)" : "var(--success)"
          })
        : null
    ]),
    createElement("div", {
      className: "governance-actions"
    }, [
      ...[
        ["approved", "Confirm Item"],
        ["deferred", "Defer Item"],
        ["dismissed", "Dismiss Item"]
      ].map(([status, label]) => createElement("button", {
        className: `btn governance-action-btn source-access-review-item-${status}-btn`,
        text: label,
        attrs: { type: "button" },
        dataset: {
          taskSeedingCheckpoint: "true",
          taskSeedingBatchId: item.id || `source-access-review:${item.sourceId || item.label || "source"}`,
          taskSeedingStatus: status,
          taskSeedingSource: "governance-data-sources-access-review-queue",
          taskSeedingTitle: item.title || `Source access review: ${item.label || item.sourceId || "Source"}`,
          taskSeedingItemCount: "1"
        }
      })),
      createElement("button", {
        className: "btn governance-action-btn source-access-review-task-snapshot-btn",
        text: "Track + Snapshot",
        attrs: { type: "button" },
        dataset: {
          sourceAccessReviewTaskSnapshot: item.id || "",
          sourceAccessReviewTaskSnapshotRenderTarget: "governance"
        }
      })
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
    }),
    createElement("div", {
      className: "governance-actions data-source-access-validation-runbook-checkpoints"
    }, [
      ...[
        ["approved", "Confirm"],
        ["deferred", "Defer"]
      ].map(([status, label]) => createElement("button", {
        className: `btn governance-action-btn data-source-access-validation-runbook-${status}-btn`,
        text: label,
        attrs: { type: "button" },
        dataset: {
          taskSeedingCheckpoint: "true",
          taskSeedingBatchId: `data-sources-access-validation-runbook:${method.accessMethod || "review-required"}`,
          taskSeedingStatus: status,
          taskSeedingSource: "governance-data-sources-access-validation-runbook",
          taskSeedingTitle: `Data Sources access validation runbook: ${method.accessMethod || method.title || "review-required"}`,
          taskSeedingItemCount: String((method.sources || []).length),
          taskSeedingNote: `Operator marked the Data Sources access validation runbook method ${method.accessMethod || method.title || "review-required"} as ${status}; non-secret runbook metadata only.`
        }
      })),
      createElement("button", {
        className: "btn governance-action-btn data-source-access-validation-runbook-task-btn",
        text: "Track Evidence Tasks",
        attrs: { type: "button" },
        dataset: {
          sourceAccessValidationRunbookTaskMethod: method.accessMethod || ""
        }
      })
    ])
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
        }),
        item.sourceAccessCheckpoints?.total
          ? createTag(`checkpoints ${item.sourceAccessCheckpoints.unresolved || 0}/${item.sourceAccessCheckpoints.total}`, {
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: item.sourceAccessCheckpoints.unresolved ? "var(--warning)" : "var(--success)"
            })
          : null
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
    createElement("div", {
      className: "governance-actions"
    }, [
      ...[
        ["approved", "Confirm Item"],
        ["deferred", "Defer Item"],
        ["dismissed", "Dismiss Item"]
      ].map(([status, label]) => createElement("button", {
        className: `btn governance-action-btn source-evidence-coverage-item-${status}-btn`,
        text: label,
        attrs: { type: "button" },
        dataset: {
          taskSeedingCheckpoint: "true",
          taskSeedingBatchId: item.id || `source-evidence-coverage:${item.sourceId || item.label || "source"}`,
          taskSeedingStatus: status,
          taskSeedingSource: "governance-data-sources-access-validation-evidence-coverage",
          taskSeedingTitle: `Source evidence coverage: ${item.label || item.sourceId || "Source"}`,
          taskSeedingItemCount: "1"
        }
      })),
      createElement("button", {
        className: "btn governance-action-btn source-evidence-coverage-task-snapshot-btn",
        text: "Track + Snapshot",
        attrs: { type: "button" },
        dataset: {
          sourceEvidenceCoverageTaskSnapshot: item.id || "",
          sourceEvidenceCoverageTaskSnapshotRenderTarget: "governance"
        }
      })
    ]),
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
      }),
      createElement("button", {
        className: "btn governance-action-btn source-access-validation-evidence-snapshot-drift-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: {
          sourceAccessValidationEvidenceSnapshotDriftId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn source-access-validation-evidence-snapshot-drift-task-btn",
        text: "Track Drift",
        attrs: { type: "button" },
        dataset: {
          sourceAccessValidationEvidenceSnapshotDriftTaskId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn source-access-validation-evidence-snapshot-drift-accept-btn",
        text: "Accept Drift",
        attrs: { type: "button" },
        dataset: {
          sourceAccessValidationEvidenceSnapshotDriftAcceptId: snapshot.id
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
  const dataSourceAccessValidationWorkflowSnapshotEntries = (governance.dataSourceAccessValidationWorkflowSnapshots || []).map((snapshot) => createElement("div", {
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
          text: snapshot.title || "Data Sources Access Validation Workflow",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${new Date(snapshot.createdAt).toLocaleString()} • ${snapshot.total || 0} workflow item(s)`,
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
      text: `${snapshot.readyCount || 0} ready • ${snapshot.pendingCount || 0} pending • ${snapshot.missingEvidenceCount || 0} missing evidence • ${snapshot.externalAccessRequiredCount || 0} external access required`,
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
        className: "btn governance-action-btn data-source-access-validation-workflow-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: {
          sourceAccessValidationWorkflowSnapshotId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn data-source-access-validation-workflow-snapshot-drift-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: {
          sourceAccessValidationWorkflowSnapshotDriftId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn data-source-access-validation-workflow-snapshot-drift-task-btn",
        text: "Track Drift",
        attrs: { type: "button" },
        dataset: {
          sourceAccessValidationWorkflowSnapshotDriftTaskId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn data-source-access-validation-workflow-snapshot-drift-accept-btn",
        text: "Accept Drift",
        attrs: { type: "button" },
        dataset: {
          sourceAccessValidationWorkflowSnapshotDriftAcceptId: snapshot.id
        }
      })
    ])
  ]));
  const dataSourceAccessValidationWorkflowSnapshotDiff = governance.dataSourceAccessValidationWorkflowSnapshotDiff;
  const dataSourceAccessValidationWorkflowSnapshotDiffEntries = dataSourceAccessValidationWorkflowSnapshotDiff
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
                text: dataSourceAccessValidationWorkflowSnapshotDiff.snapshotTitle || "No workflow snapshot",
                style: {
                  fontWeight: "800",
                  color: "var(--text)"
                }
              }),
              createElement("div", {
                text: dataSourceAccessValidationWorkflowSnapshotDiff.snapshotCreatedAt ? new Date(dataSourceAccessValidationWorkflowSnapshotDiff.snapshotCreatedAt).toLocaleString() : "No snapshot saved yet",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.84rem",
                  marginTop: "0.3rem"
                }
              })
            ]),
            createTag((dataSourceAccessValidationWorkflowSnapshotDiff.driftSeverity || "missing-snapshot").toUpperCase(), {
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: dataSourceAccessValidationWorkflowSnapshotDiff.driftSeverity === "high" || dataSourceAccessValidationWorkflowSnapshotDiff.driftSeverity === "missing-snapshot"
                ? "var(--danger)"
                : dataSourceAccessValidationWorkflowSnapshotDiff.driftSeverity === "none"
                  ? "var(--success)"
                  : "var(--warning)"
            })
          ]),
          createElement("div", {
            text: dataSourceAccessValidationWorkflowSnapshotDiff.recommendedAction || "Save a source-access validation workflow snapshot before comparing drift.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `${dataSourceAccessValidationWorkflowSnapshotDiff.driftScore || 0} drift score • ${(dataSourceAccessValidationWorkflowSnapshotDiff.driftItems || []).length} drift item(s)`,
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
      createElement("button", {
        className: "btn governance-action-btn source-access-task-confirm-btn",
        text: "Confirm",
        attrs: { type: "button" },
        dataset: {
          sourceAccessTaskCheckpointAction: "confirm",
          taskId: task.id || ""
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn source-access-task-defer-btn",
        text: "Defer",
        attrs: { type: "button" },
        dataset: {
          sourceAccessTaskCheckpointAction: "defer",
          taskId: task.id || ""
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn source-access-task-escalate-btn",
        text: "Escalate",
        attrs: { type: "button" },
        dataset: {
          sourceAccessTaskCheckpointAction: "escalate",
          taskId: task.id || ""
        }
      }),
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
  const dataSourcesAccessValidationWorkflowTaskEntries = dataSourcesAccessValidationWorkflowTasks.map((task) => createElement("div", {
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
          text: task.title || "Source validation workflow task",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${task.sourceLabel || "Source"} • ${task.workflowStage || "validation"} • ${task.accessMethod || "review-required"}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            marginTop: "0.3rem"
          }
        })
      ]),
      createTag((task.status || "open").toUpperCase(), {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: ["done", "resolved", "closed", "cancelled", "archived"].includes(String(task.status || "").toLowerCase()) ? "var(--success)" : task.status === "blocked" ? "var(--danger)" : "var(--warning)"
      })
    ]),
    createElement("div", {
      text: task.description ? String(task.description).split("\n")[0] : "Track the source access validation workflow without storing secrets.",
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    createElement("div", {
      className: "tags"
    }, [
      createTag(task.sourceAccessValidationWorkflowId || "source-access-validation-workflow", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      }),
      createTag(`Workflow: ${task.workflowStatus || "pending"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: task.workflowStatus === "ready" ? "var(--success)" : task.workflowStatus === "blocked" ? "var(--danger)" : "var(--warning)"
      }),
      createTag(`Evidence: ${task.latestEvidenceStatus || task.coverageStatus || "missing"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: (task.latestEvidenceStatus || task.coverageStatus) === "validated" || (task.latestEvidenceStatus || task.coverageStatus) === "covered" ? "var(--success)" : (task.latestEvidenceStatus || task.coverageStatus) === "blocked" ? "var(--danger)" : "var(--warning)"
      }),
      createTag(task.secretPolicy || "non-secret-validation-workflow-only", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      })
    ]),
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn source-validation-workflow-task-confirm-btn",
        text: "Confirm",
        attrs: { type: "button" },
        dataset: {
          sourceValidationWorkflowTaskCheckpointAction: "confirm",
          taskId: task.id || ""
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn source-validation-workflow-task-defer-btn",
        text: "Defer",
        attrs: { type: "button" },
        dataset: {
          sourceValidationWorkflowTaskCheckpointAction: "defer",
          taskId: task.id || ""
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn source-validation-workflow-task-escalate-btn",
        text: "Escalate",
        attrs: { type: "button" },
        dataset: {
          sourceValidationWorkflowTaskCheckpointAction: "escalate",
          taskId: task.id || ""
        }
      }),
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
  const dataSourcesAccessTaskLedgerSnapshotDiff = governance.dataSourceAccessTaskLedgerSnapshotDiff;
  const dataSourcesAccessTaskLedgerDriftItems = Array.isArray(dataSourcesAccessTaskLedgerSnapshotDiff?.driftItems)
    ? dataSourcesAccessTaskLedgerSnapshotDiff.driftItems
    : [];
  const dataSourcesAccessValidationWorkflowTaskLedgerDriftItems = dataSourcesAccessTaskLedgerDriftItems.filter((item) => {
    const category = String(item.category || "");
    const field = String(item.field || "");
    return category === "source-access-validation-workflow-task-ledger" || field.startsWith("source-access-validation-workflow-task");
  });
  const dataSourcesAccessValidationWorkflowTaskLedgerSnapshotDiffEntries = dataSourcesAccessTaskLedgerSnapshotDiff && dataSourcesAccessValidationWorkflowTaskLedgerDriftItems.length
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
                text: "Data Sources Validation Workflow Task Ledger Drift",
                style: {
                  fontWeight: "800",
                  color: "var(--text)"
                }
              }),
              createElement("div", {
                text: dataSourcesAccessTaskLedgerSnapshotDiff.snapshotTitle || "Latest source-access task ledger snapshot",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.84rem",
                  marginTop: "0.3rem"
                }
              })
            ]),
            createTag((dataSourcesAccessTaskLedgerSnapshotDiff.driftSeverity || "missing-snapshot").toUpperCase(), {
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: dataSourcesAccessTaskLedgerSnapshotDiff.driftSeverity === "high" || dataSourcesAccessTaskLedgerSnapshotDiff.driftSeverity === "missing-snapshot"
                ? "var(--danger)"
                : dataSourcesAccessTaskLedgerSnapshotDiff.driftSeverity === "none"
                  ? "var(--success)"
                  : "var(--warning)"
            })
          ]),
          createElement("div", {
            text: "Focused workflow-task drift derived from the shared Data Sources access task ledger; non-secret metadata only.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `${dataSourcesAccessValidationWorkflowTaskLedgerDriftItems.length} workflow task drift item(s) - ${dataSourcesAccessTaskLedgerSnapshotDiff.driftScore || 0} total ledger drift score`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          }),
          createElement("div", {
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
              text: "Validation workflow task drift fields",
              style: {
                color: "var(--text-muted)",
                fontSize: "0.78rem",
                fontWeight: "800",
                letterSpacing: "0.08em",
                textTransform: "uppercase"
              }
            }),
            ...dataSourcesAccessValidationWorkflowTaskLedgerDriftItems.slice(0, 8).map((item) => createElement("div", {
              style: {
                display: "grid",
                gap: "0.5rem",
                padding: "0.65rem",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                background: "var(--surface)"
              }
            }, [
              createElement("div", {
                text: `${item.label || item.field || "Validation workflow task drift"}: ${item.before ?? "none"} -> ${item.current ?? "none"} (${item.delta >= 0 ? "+" : ""}${item.delta ?? 0})`,
                style: {
                  color: "var(--text)",
                  fontSize: "0.84rem",
                  fontWeight: "700",
                  lineHeight: "1.45"
                }
              }),
              createElement("div", {
                className: "governance-actions"
              }, [
                createElement("button", {
                  className: "btn governance-action-btn source-validation-workflow-task-ledger-drift-item-confirm-btn",
                  text: "Confirm",
                  attrs: { type: "button" },
                  dataset: {
                    sourceValidationWorkflowTaskLedgerDriftItemField: item.field || item.label || "",
                    sourceValidationWorkflowTaskLedgerDriftItemDecision: "confirmed"
                  }
                }),
                createElement("button", {
                  className: "btn governance-action-btn source-validation-workflow-task-ledger-drift-item-defer-btn",
                  text: "Defer",
                  attrs: { type: "button" },
                  dataset: {
                    sourceValidationWorkflowTaskLedgerDriftItemField: item.field || item.label || "",
                    sourceValidationWorkflowTaskLedgerDriftItemDecision: "deferred"
                  }
                }),
                createElement("button", {
                  className: "btn governance-action-btn source-validation-workflow-task-ledger-drift-item-escalate-btn",
                  text: "Escalate",
                  attrs: { type: "button" },
                  dataset: {
                    sourceValidationWorkflowTaskLedgerDriftItemField: item.field || item.label || "",
                    sourceValidationWorkflowTaskLedgerDriftItemDecision: "escalated"
                  }
                })
              ])
            ])),
            dataSourcesAccessValidationWorkflowTaskLedgerDriftItems.length > 8
              ? createElement("div", {
                  text: `${dataSourcesAccessValidationWorkflowTaskLedgerDriftItems.length - 8} additional workflow task drift item(s).`,
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.8rem"
                  }
                })
              : null
          ])
        ])
      ]
    : [];
  const dataSourcesAccessTaskLedgerSnapshotDiffEntries = dataSourcesAccessTaskLedgerSnapshotDiff
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
                text: dataSourcesAccessTaskLedgerSnapshotDiff.snapshotTitle || "No source-access task snapshot",
                style: {
                  fontWeight: "800",
                  color: "var(--text)"
                }
              }),
              createElement("div", {
                text: dataSourcesAccessTaskLedgerSnapshotDiff.snapshotCreatedAt ? new Date(dataSourcesAccessTaskLedgerSnapshotDiff.snapshotCreatedAt).toLocaleString() : "No snapshot saved yet",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.84rem",
                  marginTop: "0.3rem"
                }
              })
            ]),
            createTag((dataSourcesAccessTaskLedgerSnapshotDiff.driftSeverity || "missing-snapshot").toUpperCase(), {
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: dataSourcesAccessTaskLedgerSnapshotDiff.driftSeverity === "high" || dataSourcesAccessTaskLedgerSnapshotDiff.driftSeverity === "missing-snapshot"
                ? "var(--danger)"
                : dataSourcesAccessTaskLedgerSnapshotDiff.driftSeverity === "none"
                  ? "var(--success)"
                  : "var(--warning)"
            })
          ]),
          createElement("div", {
            text: dataSourcesAccessTaskLedgerSnapshotDiff.recommendedAction || "Save a Data Sources access task ledger snapshot before comparing drift.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `${dataSourcesAccessTaskLedgerSnapshotDiff.driftScore || 0} drift score - ${dataSourcesAccessTaskLedgerDriftItems.length} drift item(s)`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          }),
          dataSourcesAccessTaskLedgerDriftItems.length
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
                  text: "Source-access task ledger drift fields",
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.78rem",
                    fontWeight: "800",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase"
                  }
                }),
                ...dataSourcesAccessTaskLedgerDriftItems.slice(0, 8).map((item) => createElement("div", {
                  style: {
                    display: "grid",
                    gap: "0.5rem",
                    padding: "0.65rem",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    background: "var(--surface)"
                  }
                }, [
                  createElement("div", {
                    text: `${item.label || item.field || "Source-access task drift"}: ${item.before ?? "none"} -> ${item.current ?? "none"} (${item.delta >= 0 ? "+" : ""}${item.delta ?? 0})`,
                    style: {
                      color: "var(--text)",
                      fontSize: "0.84rem",
                      fontWeight: "700",
                      lineHeight: "1.45"
                    }
                  }),
                  createElement("div", {
                    className: "governance-actions"
                  }, [
                    createElement("button", {
                      className: "btn governance-action-btn source-access-task-ledger-drift-item-confirm-btn",
                      text: "Confirm",
                      attrs: { type: "button" },
                      dataset: {
                        sourceAccessTaskLedgerDriftItemField: item.field || item.label || "",
                        sourceAccessTaskLedgerDriftItemDecision: "confirmed"
                      }
                    }),
                    createElement("button", {
                      className: "btn governance-action-btn source-access-task-ledger-drift-item-defer-btn",
                      text: "Defer",
                      attrs: { type: "button" },
                      dataset: {
                        sourceAccessTaskLedgerDriftItemField: item.field || item.label || "",
                        sourceAccessTaskLedgerDriftItemDecision: "deferred"
                      }
                    }),
                    createElement("button", {
                      className: "btn governance-action-btn source-access-task-ledger-drift-item-escalate-btn",
                      text: "Escalate",
                      attrs: { type: "button" },
                      dataset: {
                        sourceAccessTaskLedgerDriftItemField: item.field || item.label || "",
                        sourceAccessTaskLedgerDriftItemDecision: "escalated"
                      }
                    })
                  ])
                ])),
                dataSourcesAccessTaskLedgerDriftItems.length > 8
                  ? createElement("div", {
                      text: `${dataSourcesAccessTaskLedgerDriftItems.length - 8} additional drift item(s).`,
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
      }),
      createElement("button", {
        className: "btn governance-action-btn source-access-task-ledger-snapshot-drift-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: {
          sourceAccessTaskLedgerSnapshotDriftId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn source-access-task-ledger-snapshot-drift-task-btn",
        text: "Track Drift",
        attrs: { type: "button" },
        dataset: {
          sourceAccessTaskLedgerSnapshotDriftTaskId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn source-access-task-ledger-snapshot-drift-accept-btn",
        text: "Accept Drift",
        attrs: { type: "button" },
        dataset: {
          sourceAccessTaskLedgerSnapshotDriftAcceptId: snapshot.id
        }
      })
    ])
  ]));

  const controlPlaneDecision = governance.agentControlPlaneDecision;
  const controlPlaneDecisionReasons = Array.isArray(controlPlaneDecision?.reasons) ? controlPlaneDecision.reasons : [];
  const controlPlaneReleaseBuildGate = controlPlaneDecision?.releaseBuildGate || governance.releaseBuildGate;
  const controlPlaneReleaseBuildGateDecision = controlPlaneDecision?.releaseBuildGateDecision || controlPlaneReleaseBuildGate?.decision || "not-evaluated";
  const controlPlaneReleaseBuildGateColor = controlPlaneReleaseBuildGateDecision === "hold"
    ? "var(--danger)"
    : controlPlaneReleaseBuildGateDecision === "ready"
      ? "var(--success)"
      : "var(--warning)";
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
              createTag(`RELEASE GATE ${controlPlaneReleaseBuildGateDecision.toUpperCase()}`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: controlPlaneReleaseBuildGateColor
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
            text: `Baseline health: ${controlPlaneDecision.baselineHealth || "missing"} • Release gate: ${controlPlaneReleaseBuildGateDecision} risk ${controlPlaneDecision.releaseBuildGateRiskScore || controlPlaneReleaseBuildGate?.riskScore || 0} • Active runs: ${controlPlaneDecision.activeRuns || 0} • Stale: ${controlPlaneDecision.staleActiveRuns || 0} • SLA breached: ${controlPlaneDecision.slaBreachedRuns || 0} • Source access tasks: ${controlPlaneDecision.dataSourcesAccessOpenTaskCount || 0} open / ${controlPlaneDecision.dataSourcesAccessTaskCount || 0} total • Access methods: ${controlPlaneDecision.dataSourcesAccessValidationMethodCount || 0} • Evidence: ${controlPlaneDecision.dataSourcesAccessValidationEvidenceValidatedCount || 0}/${controlPlaneDecision.dataSourcesAccessValidationEvidenceCount || 0}`,
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
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    padding: "0.55rem",
                    border: "1px solid var(--border)",
                    borderRadius: "0.7rem",
                    background: "color-mix(in srgb, var(--bg) 70%, transparent 30%)"
                  }
                }, [
                  createElement("div", {
                    text: `${(reason.severity || "review").toUpperCase()}: ${reason.message || reason.code || "Review required."}`,
                    style: {
                      color: "var(--text-muted)",
                      fontSize: "0.84rem",
                      lineHeight: "1.45"
                    }
                  }),
                  createElement("button", {
                    className: "btn governance-action-btn control-plane-decision-reason-task-snapshot-btn",
                    text: "Track + Snapshot",
                    attrs: { type: "button" },
                    dataset: {
                      controlPlaneDecisionReasonTaskSnapshot: reason.code || ""
                    }
                  })
                ])),
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
            }),
            createElement("button", {
              className: "btn governance-action-btn control-plane-decision-tasks-btn",
              text: "Seed Decision Tasks",
              attrs: { type: "button" },
              dataset: {
                controlPlaneDecisionTasks: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn control-plane-decision-tasks-snapshot-btn",
              text: "Seed + Snapshot",
              attrs: { type: "button" },
              dataset: {
                controlPlaneDecisionTasksSnapshot: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn task-seeding-checkpoint-defer-btn",
              text: "Defer Batch",
              attrs: { type: "button" },
              dataset: {
                taskSeedingCheckpoint: "true",
                taskSeedingBatchId: "agent-control-plane-decision-tasks",
                taskSeedingStatus: "deferred",
                taskSeedingSource: "agent-control-plane-decision",
                taskSeedingTitle: "Agent Control Plane decision task batch",
                taskSeedingItemCount: String(controlPlaneDecisionReasons.length)
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn task-seeding-checkpoint-dismiss-btn",
              text: "Dismiss Batch",
              attrs: { type: "button" },
              dataset: {
                taskSeedingCheckpoint: "true",
                taskSeedingBatchId: "agent-control-plane-decision-tasks",
                taskSeedingStatus: "dismissed",
                taskSeedingSource: "agent-control-plane-decision",
                taskSeedingTitle: "Agent Control Plane decision task batch",
                taskSeedingItemCount: String(controlPlaneDecisionReasons.length)
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn control-plane-decision-task-ledger-copy-btn",
              text: "Copy Decision Tasks",
              attrs: { type: "button" },
              dataset: {
                controlPlaneDecisionTaskLedgerCopy: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn control-plane-decision-task-ledger-snapshot-save-btn",
              text: "Save Task Snapshot",
              attrs: { type: "button" },
              dataset: {
                controlPlaneDecisionTaskLedgerSnapshotSave: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn control-plane-decision-task-ledger-drift-copy-btn",
              text: "Copy Task Drift",
              attrs: { type: "button" },
              dataset: {
                controlPlaneDecisionTaskLedgerDriftCopy: "true"
              }
            })
          ])
        ])
      ]
    : [];
  const agentControlPlaneDecisionTaskEntries = (governance.agentControlPlaneDecisionTasks || []).map((task) => createElement("div", {
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
          text: task.title || "Control Plane decision task",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${task.agentControlPlaneDecisionReasonCode || "control-plane-decision"} | decision ${(task.agentControlPlaneDecision || "review").toUpperCase()}`,
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
        createTag((task.priority || "normal").toUpperCase(), {
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
      text: task.description ? String(task.description).split("\n")[0] : "Track Control Plane remediation without storing credentials, keys, certificates, cookies, or browser sessions.",
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    createElement("div", {
      className: "tags"
    }, [
      createTag(task.agentControlPlaneCommandHint || "control-plane-remediation", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      }),
      createTag(task.secretPolicy || "non-secret-control-plane-remediation-evidence-only", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      })
    ]),
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn control-plane-decision-task-confirm-btn",
        text: "Confirm",
        attrs: { type: "button" },
        dataset: {
          controlPlaneDecisionTaskCheckpointAction: "confirm",
          taskId: task.id || ""
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn control-plane-decision-task-defer-btn",
        text: "Defer",
        attrs: { type: "button" },
        dataset: {
          controlPlaneDecisionTaskCheckpointAction: "defer",
          taskId: task.id || ""
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn control-plane-decision-task-escalate-btn",
        text: "Escalate",
        attrs: { type: "button" },
        dataset: {
          controlPlaneDecisionTaskCheckpointAction: "escalate",
          taskId: task.id || ""
        }
      }),
      task.status !== "resolved"
        ? createElement("button", {
            className: "btn governance-action-btn control-plane-decision-task-resolve-btn",
            text: "Resolve",
            attrs: { type: "button" },
            dataset: {
              controlPlaneDecisionTaskAction: "resolve",
              taskId: task.id
            }
          })
        : createElement("button", {
            className: "btn governance-action-btn control-plane-decision-task-reopen-btn",
            text: "Reopen",
            attrs: { type: "button" },
            dataset: {
              controlPlaneDecisionTaskAction: "reopen",
              taskId: task.id
            }
          }),
      task.status !== "blocked"
        ? createElement("button", {
            className: "btn governance-action-btn control-plane-decision-task-block-btn",
            text: "Block",
            attrs: { type: "button" },
            dataset: {
              controlPlaneDecisionTaskAction: "block",
              taskId: task.id
            }
      })
        : null
    ])
  ]));
  const agentExecutionResultTaskLedgerControlEntries = [
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
            text: "Execution Result Task Ledger",
            style: {
              fontWeight: "800",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: "Export, snapshot, and compare deferred execution-result follow-up tasks without storing credentials or command output.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.3rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(`${summary.agentExecutionResultOpenTaskCount || 0} OPEN`, {
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: (summary.agentExecutionResultOpenTaskCount || 0) > 0 ? "var(--warning)" : "var(--success)"
        })
      ]),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn agent-execution-result-task-ledger-copy-btn",
          text: "Copy Execution Tasks",
          attrs: { type: "button" },
          dataset: {
            agentExecutionResultTaskLedgerCopy: "true"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn agent-execution-result-task-ledger-snapshot-save-btn",
          text: "Save Execution Snapshot",
          attrs: { type: "button" },
          dataset: {
            agentExecutionResultTaskLedgerSnapshotSave: "true"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn agent-execution-result-task-ledger-drift-copy-btn",
          text: "Copy Execution Drift",
          attrs: { type: "button" },
          dataset: {
            agentExecutionResultTaskLedgerDriftCopy: "true"
          }
        })
      ])
    ])
  ];
  const agentExecutionResultTaskEntries = (governance.agentExecutionResultTasks || []).map((task) => createElement("div", {
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
          text: task.title || "Execution result follow-up task",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${task.agentExecutionResultTargetAction || "execution-result"} | ${task.agentExecutionResultRunStatus || "status unset"} | ${task.agentExecutionResultRunTitle || task.agentExecutionResultRunId || "run"}`,
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
        createTag((task.priority || "normal").toUpperCase(), {
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
      text: task.description ? String(task.description).split("\n")[0] : "Track deferred execution-result gate handling without storing credentials, keys, certificates, cookies, browser sessions, or command output.",
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    createElement("div", {
      className: "tags"
    }, [
      createTag(task.agentExecutionResultCheckpointStatus || "deferred", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: getExecutionCheckpointStatusColor(task.agentExecutionResultCheckpointStatus || "deferred")
      }),
      createTag(task.secretPolicy || "non-secret-execution-result-follow-up-evidence-only", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      })
    ]),
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn agent-execution-result-task-confirm-btn",
        text: "Confirm",
        attrs: { type: "button" },
        dataset: {
          agentExecutionResultTaskCheckpointAction: "confirm",
          taskId: task.id || ""
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn agent-execution-result-task-defer-btn",
        text: "Defer",
        attrs: { type: "button" },
        dataset: {
          agentExecutionResultTaskCheckpointAction: "defer",
          taskId: task.id || ""
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn agent-execution-result-task-escalate-btn",
        text: "Escalate",
        attrs: { type: "button" },
        dataset: {
          agentExecutionResultTaskCheckpointAction: "escalate",
          taskId: task.id || ""
        }
      }),
      task.status !== "resolved"
        ? createElement("button", {
            className: "btn governance-action-btn agent-execution-result-task-resolve-btn",
            text: "Resolve",
            attrs: { type: "button" },
            dataset: {
              agentExecutionResultTaskAction: "resolve",
              taskId: task.id
            }
          })
        : createElement("button", {
            className: "btn governance-action-btn agent-execution-result-task-reopen-btn",
            text: "Reopen",
            attrs: { type: "button" },
            dataset: {
              agentExecutionResultTaskAction: "reopen",
              taskId: task.id
            }
          }),
      task.status !== "blocked"
        ? createElement("button", {
            className: "btn governance-action-btn agent-execution-result-task-block-btn",
            text: "Block",
            attrs: { type: "button" },
            dataset: {
              agentExecutionResultTaskAction: "block",
              taskId: task.id
            }
          })
        : null
    ])
  ]));
  const agentControlPlaneDecisionTaskLedgerSnapshotDiff = governance.agentControlPlaneDecisionTaskLedgerSnapshotDiff;
  const agentControlPlaneDecisionTaskLedgerDriftItems = Array.isArray(agentControlPlaneDecisionTaskLedgerSnapshotDiff?.driftItems)
    ? agentControlPlaneDecisionTaskLedgerSnapshotDiff.driftItems
    : [];
  const agentControlPlaneDecisionTaskLedgerSnapshotDiffEntries = agentControlPlaneDecisionTaskLedgerSnapshotDiff
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
                text: agentControlPlaneDecisionTaskLedgerSnapshotDiff.snapshotTitle || "No Control Plane decision task snapshot",
                style: {
                  fontWeight: "800",
                  color: "var(--text)"
                }
              }),
              createElement("div", {
                text: agentControlPlaneDecisionTaskLedgerSnapshotDiff.snapshotCreatedAt ? new Date(agentControlPlaneDecisionTaskLedgerSnapshotDiff.snapshotCreatedAt).toLocaleString() : "No snapshot saved yet",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.84rem",
                  marginTop: "0.3rem"
                }
              })
            ]),
            createTag((agentControlPlaneDecisionTaskLedgerSnapshotDiff.driftSeverity || "missing-snapshot").toUpperCase(), {
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: agentControlPlaneDecisionTaskLedgerSnapshotDiff.driftSeverity === "high" || agentControlPlaneDecisionTaskLedgerSnapshotDiff.driftSeverity === "missing-snapshot"
                ? "var(--danger)"
                : agentControlPlaneDecisionTaskLedgerSnapshotDiff.driftSeverity === "none"
                  ? "var(--success)"
                  : "var(--warning)"
            })
          ]),
          createElement("div", {
            text: agentControlPlaneDecisionTaskLedgerSnapshotDiff.recommendedAction || "Save a Control Plane decision task ledger snapshot before comparing drift.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `${agentControlPlaneDecisionTaskLedgerSnapshotDiff.driftScore || 0} drift score - ${agentControlPlaneDecisionTaskLedgerDriftItems.length} drift item(s)`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          }),
          agentControlPlaneDecisionTaskLedgerDriftItems.length
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
                  text: "Decision task ledger drift fields",
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.78rem",
                    fontWeight: "800",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase"
                  }
                }),
                ...agentControlPlaneDecisionTaskLedgerDriftItems.slice(0, 8).map((item) => createElement("div", {
                  style: {
                    display: "grid",
                    gap: "0.5rem",
                    padding: "0.65rem",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    background: "var(--surface)"
                  }
                }, [
                  createElement("div", {
                    text: `${item.label || item.field || "Control Plane decision task drift"}: ${item.before ?? "none"} -> ${item.current ?? "none"} (${item.delta >= 0 ? "+" : ""}${item.delta ?? 0})`,
                    style: {
                      color: "var(--text)",
                      fontSize: "0.84rem",
                      fontWeight: "700",
                      lineHeight: "1.45"
                    }
                  }),
                  createElement("div", {
                    className: "governance-actions"
                  }, [
                    createElement("button", {
                      className: "btn governance-action-btn control-plane-decision-task-ledger-drift-item-confirm-btn",
                      text: "Confirm",
                      attrs: { type: "button" },
                      dataset: {
                        controlPlaneDecisionTaskLedgerDriftItemField: item.field || item.label || "",
                        controlPlaneDecisionTaskLedgerDriftItemDecision: "confirmed"
                      }
                    }),
                    createElement("button", {
                      className: "btn governance-action-btn control-plane-decision-task-ledger-drift-item-defer-btn",
                      text: "Defer",
                      attrs: { type: "button" },
                      dataset: {
                        controlPlaneDecisionTaskLedgerDriftItemField: item.field || item.label || "",
                        controlPlaneDecisionTaskLedgerDriftItemDecision: "deferred"
                      }
                    }),
                    createElement("button", {
                      className: "btn governance-action-btn control-plane-decision-task-ledger-drift-item-escalate-btn",
                      text: "Escalate",
                      attrs: { type: "button" },
                      dataset: {
                        controlPlaneDecisionTaskLedgerDriftItemField: item.field || item.label || "",
                        controlPlaneDecisionTaskLedgerDriftItemDecision: "escalated"
                      }
                    })
                  ])
                ])),
                agentControlPlaneDecisionTaskLedgerDriftItems.length > 8
                  ? createElement("div", {
                      text: `${agentControlPlaneDecisionTaskLedgerDriftItems.length - 8} additional drift item(s).`,
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
  const agentControlPlaneDecisionTaskLedgerSnapshotEntries = (governance.agentControlPlaneDecisionTaskLedgerSnapshots || []).map((snapshot) => createElement("div", {
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
          text: snapshot.title || "Agent Control Plane Decision Task Ledger",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${new Date(snapshot.createdAt).toLocaleString()} - ${snapshot.statusFilter || "all"} - ${snapshot.visibleCount || 0} visible - ${snapshot.reasonCount || 0} reason(s)`,
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
      text: `${snapshot.total || 0} total Control Plane decision task(s) - ${snapshot.closedCount || 0} closed - ${snapshot.secretPolicy || "non-secret Control Plane task metadata only"}`,
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
        className: "btn governance-action-btn control-plane-decision-task-ledger-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: {
          controlPlaneDecisionTaskLedgerSnapshotId: snapshot.id
        }
      })
    ])
  ]));
  const agentExecutionResultTaskLedgerSnapshotDiff = governance.agentExecutionResultTaskLedgerSnapshotDiff;
  const agentExecutionResultTaskLedgerDriftItems = Array.isArray(agentExecutionResultTaskLedgerSnapshotDiff?.driftItems)
    ? agentExecutionResultTaskLedgerSnapshotDiff.driftItems
    : [];
  const agentExecutionResultTaskLedgerSnapshotDiffEntries = agentExecutionResultTaskLedgerSnapshotDiff
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
                text: agentExecutionResultTaskLedgerSnapshotDiff.snapshotTitle || "No execution-result task snapshot",
                style: {
                  fontWeight: "800",
                  color: "var(--text)"
                }
              }),
              createElement("div", {
                text: agentExecutionResultTaskLedgerSnapshotDiff.snapshotCreatedAt ? new Date(agentExecutionResultTaskLedgerSnapshotDiff.snapshotCreatedAt).toLocaleString() : "No snapshot saved yet",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.84rem",
                  marginTop: "0.3rem"
                }
              })
            ]),
            createTag((agentExecutionResultTaskLedgerSnapshotDiff.driftSeverity || "missing-snapshot").toUpperCase(), {
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: agentExecutionResultTaskLedgerSnapshotDiff.driftSeverity === "high" || agentExecutionResultTaskLedgerSnapshotDiff.driftSeverity === "missing-snapshot"
                ? "var(--danger)"
                : agentExecutionResultTaskLedgerSnapshotDiff.driftSeverity === "none"
                  ? "var(--success)"
                  : "var(--warning)"
            })
          ]),
          createElement("div", {
            text: agentExecutionResultTaskLedgerSnapshotDiff.recommendedAction || "Save an execution-result task ledger snapshot before comparing drift.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `${agentExecutionResultTaskLedgerSnapshotDiff.driftScore || 0} drift score - ${agentExecutionResultTaskLedgerDriftItems.length} drift item(s)`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          }),
          agentExecutionResultTaskLedgerDriftItems.length
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
                  text: "Execution-result task ledger drift fields",
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.78rem",
                    fontWeight: "800",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase"
                  }
                }),
                ...agentExecutionResultTaskLedgerDriftItems.slice(0, 8).map((item) => createElement("div", {
                  style: {
                    display: "grid",
                    gap: "0.5rem",
                    padding: "0.65rem",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    background: "var(--surface)"
                  }
                }, [
                  createElement("div", {
                    text: `${item.label || item.field || "Execution-result task drift"}: ${item.before ?? "none"} -> ${item.current ?? "none"} (${item.delta >= 0 ? "+" : ""}${item.delta ?? 0})`,
                    style: {
                      color: "var(--text)",
                      fontSize: "0.84rem",
                      fontWeight: "700",
                      lineHeight: "1.45"
                    }
                  }),
                  createElement("div", {
                    className: "governance-actions"
                  }, [
                    createElement("button", {
                      className: "btn governance-action-btn agent-execution-result-task-ledger-drift-item-confirm-btn",
                      text: "Confirm",
                      attrs: { type: "button" },
                      dataset: {
                        agentExecutionResultTaskLedgerDriftItemField: item.field || item.label || "",
                        agentExecutionResultTaskLedgerDriftItemDecision: "confirmed"
                      }
                    }),
                    createElement("button", {
                      className: "btn governance-action-btn agent-execution-result-task-ledger-drift-item-defer-btn",
                      text: "Defer",
                      attrs: { type: "button" },
                      dataset: {
                        agentExecutionResultTaskLedgerDriftItemField: item.field || item.label || "",
                        agentExecutionResultTaskLedgerDriftItemDecision: "deferred"
                      }
                    }),
                    createElement("button", {
                      className: "btn governance-action-btn agent-execution-result-task-ledger-drift-item-escalate-btn",
                      text: "Escalate",
                      attrs: { type: "button" },
                      dataset: {
                        agentExecutionResultTaskLedgerDriftItemField: item.field || item.label || "",
                        agentExecutionResultTaskLedgerDriftItemDecision: "escalated"
                      }
                    })
                  ])
                ])),
                agentExecutionResultTaskLedgerDriftItems.length > 8
                  ? createElement("div", {
                      text: `${agentExecutionResultTaskLedgerDriftItems.length - 8} additional drift item(s).`,
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
  const agentExecutionResultTaskLedgerSnapshotEntries = (governance.agentExecutionResultTaskLedgerSnapshots || []).map((snapshot) => createElement("div", {
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
          text: snapshot.title || "Agent Execution Result Task Ledger",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${new Date(snapshot.createdAt).toLocaleString()} - ${snapshot.statusFilter || "all"} - ${snapshot.visibleCount || 0} visible - ${snapshot.actionCount || 0} action(s)`,
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
      text: `${snapshot.total || 0} total execution-result task(s) - ${snapshot.closedCount || 0} closed - ${snapshot.secretPolicy || "non-secret execution-result task metadata only"}`,
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
        className: "btn governance-action-btn agent-execution-result-task-ledger-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: {
          agentExecutionResultTaskLedgerSnapshotId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn agent-execution-result-task-ledger-snapshot-drift-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: {
          agentExecutionResultTaskLedgerSnapshotDriftId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn agent-execution-result-task-ledger-snapshot-drift-task-btn",
        text: "Track Drift",
        attrs: { type: "button" },
        dataset: {
          agentExecutionResultTaskLedgerSnapshotDriftTaskId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn agent-execution-result-task-ledger-snapshot-drift-accept-btn",
        text: "Accept Drift",
        attrs: { type: "button" },
        dataset: {
          agentExecutionResultTaskLedgerSnapshotDriftAcceptId: snapshot.id
        }
      })
    ])
  ]));
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
  const releaseBuildGateActions = Array.isArray(releaseBuildGate?.actions) ? releaseBuildGate.actions : [];
  const releaseControlTasks = Array.isArray(governance.releaseControlTasks) ? governance.releaseControlTasks : [];
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
              className: "btn governance-action-btn release-build-gate-bootstrap-btn",
              text: "Bootstrap Local Evidence",
              attrs: { type: "button" },
              dataset: {
                releaseBuildGateBootstrap: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn release-build-gate-local-evidence-confirm-btn",
              text: "Confirm Local Evidence",
              attrs: { type: "button" },
              dataset: {
                releaseBuildGateLocalEvidenceCheckpoint: "confirmed"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn release-build-gate-local-evidence-defer-btn",
              text: "Defer Local Evidence",
              attrs: { type: "button" },
              dataset: {
                releaseBuildGateLocalEvidenceCheckpoint: "deferred"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn release-build-gate-local-evidence-task-btn",
              text: "Track Evidence Task",
              attrs: { type: "button" },
              dataset: {
                releaseBuildGateLocalEvidenceTask: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn release-build-gate-tasks-btn",
              text: "Seed Gate Tasks",
              attrs: { type: "button" },
              dataset: {
                releaseBuildGateTasks: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn release-build-gate-tasks-snapshot-btn",
              text: "Seed + Snapshot",
              attrs: { type: "button" },
              dataset: {
                releaseBuildGateTasksSnapshot: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn task-seeding-checkpoint-defer-btn",
              text: "Defer Batch",
              attrs: { type: "button" },
              dataset: {
                taskSeedingCheckpoint: "true",
                taskSeedingBatchId: "release-build-gate-action-tasks",
                taskSeedingStatus: "deferred",
                taskSeedingSource: "release-build-gate",
                taskSeedingTitle: "Release Build Gate action task batch",
                taskSeedingItemCount: String(releaseBuildGateActions.filter((action) => action.status !== "ready").length)
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn task-seeding-checkpoint-dismiss-btn",
              text: "Dismiss Batch",
              attrs: { type: "button" },
              dataset: {
                taskSeedingCheckpoint: "true",
                taskSeedingBatchId: "release-build-gate-action-tasks",
                taskSeedingStatus: "dismissed",
                taskSeedingSource: "release-build-gate",
                taskSeedingTitle: "Release Build Gate action task batch",
                taskSeedingItemCount: String(releaseBuildGateActions.filter((action) => action.status !== "ready").length)
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn release-task-ledger-copy-btn",
              text: "Copy Release Tasks",
              attrs: { type: "button" },
              dataset: {
                releaseTaskLedgerCopy: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn release-task-ledger-snapshot-save-btn",
              text: "Save Task Snapshot",
              attrs: { type: "button" },
              dataset: {
                releaseTaskLedgerSnapshotSave: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn release-task-ledger-drift-copy-btn",
              text: "Copy Task Drift",
              attrs: { type: "button" },
              dataset: {
                releaseTaskLedgerDriftCopy: "true"
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
                : null,
              releaseBuildGateActions.length
                ? createElement("div", {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.35rem",
                      padding: "0.7rem",
                      border: "1px solid var(--border)",
                      borderRadius: "0.85rem",
                      background: "color-mix(in srgb, var(--surface) 75%, transparent 25%)"
                    }
                  }, [
                    createElement("div", {
                      text: "Gate actions",
                      style: {
                        color: "var(--text-muted)",
                        fontSize: "0.78rem",
                        fontWeight: "800",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase"
                      }
                    }),
                    ...releaseBuildGateActions.slice(0, 6).map((action) => createElement("div", {
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "0.75rem",
                        padding: "0.55rem",
                        border: "1px solid var(--border)",
                        borderRadius: "0.7rem",
                        background: "color-mix(in srgb, var(--bg) 70%, transparent 30%)"
                      }
                    }, [
                      createElement("div", {
                        style: {
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.25rem",
                          minWidth: "0"
                        }
                      }, [
                        createElement("div", {
                          text: `${action.label || action.id}: ${action.description || "Review release gate evidence."}`,
                          style: {
                            color: "var(--text-muted)",
                            fontSize: "0.84rem",
                            lineHeight: "1.45"
                          }
                        }),
                        action.commandHint
                          ? createElement("div", {
                              text: action.commandHint,
                              style: {
                                color: "var(--text-muted)",
                                fontSize: "0.78rem",
                                lineHeight: "1.45",
                                overflowWrap: "anywhere"
                              }
                            })
                          : null
                      ]),
                      createElement("div", {
                        className: "governance-actions",
                        style: {
                          flex: "0 0 auto",
                          justifyContent: "flex-end"
                        }
                      }, [
                        createElement("button", {
                          className: "btn governance-action-btn release-build-gate-action-task-btn",
                          text: "Track Task",
                          attrs: { type: "button" },
                          dataset: {
                            releaseBuildGateActionTask: action.id || ""
                          }
                        }),
                        createElement("button", {
                          className: "btn governance-action-btn release-build-gate-action-task-snapshot-btn",
                          text: "Track + Snapshot",
                          attrs: { type: "button" },
                          dataset: {
                            releaseBuildGateActionTaskSnapshot: action.id || ""
                          }
                        }),
                        createElement("button", {
                          className: "btn governance-action-btn release-build-gate-action-accept-btn",
                          text: "Accept Risk",
                          attrs: { type: "button" },
                          dataset: {
                            releaseBuildGateActionCheckpoint: action.id || ""
                          }
                        })
                      ])
                    ]))
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
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "0.75rem",
                        padding: "0.55rem",
                        border: "1px solid var(--border)",
                        borderRadius: "0.7rem",
                        background: "color-mix(in srgb, var(--bg) 70%, transparent 30%)"
                      }
                    }, [
                      createElement("div", {
                        text: `${item.label || item.field}: ${item.before || "none"} -> ${item.current || "none"} (${item.severity || "review"})`,
                        style: {
                          color: "var(--text-muted)",
                          fontSize: "0.84rem",
                          lineHeight: "1.45"
                        }
                      }),
                      createElement("div", {
                        className: "governance-actions",
                        style: {
                          flex: "0 0 auto",
                          justifyContent: "flex-end"
                        }
                      }, [
                        createElement("button", {
                          className: "btn governance-action-btn release-checkpoint-drift-field-confirm-btn",
                          text: "Confirm",
                          attrs: { type: "button" },
                          dataset: {
                            releaseCheckpointDriftField: item.field || item.label || "",
                            releaseCheckpointDriftFieldDecision: "confirmed"
                          }
                        }),
                        createElement("button", {
                          className: "btn governance-action-btn release-checkpoint-drift-field-defer-btn",
                          text: "Defer",
                          attrs: { type: "button" },
                          dataset: {
                            releaseCheckpointDriftField: item.field || item.label || "",
                            releaseCheckpointDriftFieldDecision: "deferred"
                          }
                        }),
                        createElement("button", {
                          className: "btn governance-action-btn release-checkpoint-drift-field-task-btn",
                          text: "Track Task",
                          attrs: { type: "button" },
                          dataset: {
                            releaseCheckpointDriftFieldTask: item.field || item.label || ""
                          }
                        })
                      ])
                    ]))
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
            : null,
          createElement("div", {
            className: "governance-actions"
          }, [
            createElement("button", {
              className: "btn governance-action-btn release-control-checkpoint-confirm-btn",
              text: "Confirm",
              attrs: { type: "button" },
              dataset: {
                releaseControlCheckpointDecisionId: checkpoint.id || "",
                releaseControlCheckpointDecision: "confirmed"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn release-control-checkpoint-defer-btn",
              text: "Defer",
              attrs: { type: "button" },
              dataset: {
                releaseControlCheckpointDecisionId: checkpoint.id || "",
                releaseControlCheckpointDecision: "deferred"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn release-control-checkpoint-task-btn",
              text: "Track Task",
              attrs: { type: "button" },
              dataset: {
                releaseControlCheckpointTaskId: checkpoint.id || ""
              }
            })
          ])
        ]))
      ]
    : [];
  const releaseControlTaskEntries = releaseControlTasks.map((task) => createElement("div", {
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
          text: task.title || "Release Control task",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${task.releaseBuildGateActionId || "release-control"} | gate ${(task.releaseBuildGateDecision || "review").toUpperCase()} | risk ${task.releaseBuildGateRiskScore || 0}`,
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
        createTag((task.priority || "normal").toUpperCase(), {
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
      text: task.description ? String(task.description).split("\n")[0] : "Track release evidence without storing credentials, keys, certificates, cookies, or browser sessions.",
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    createElement("div", {
      className: "tags"
    }, [
      createTag(task.releaseBuildGateCommandHint || "manual-release-evidence", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      }),
      createTag(task.secretPolicy || "non-secret-release-control-evidence-only", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      })
    ]),
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn release-control-task-confirm-btn",
        text: "Confirm",
        attrs: { type: "button" },
        dataset: {
          releaseControlTaskCheckpointAction: "confirm",
          taskId: task.id || ""
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn release-control-task-defer-btn",
        text: "Defer",
        attrs: { type: "button" },
        dataset: {
          releaseControlTaskCheckpointAction: "defer",
          taskId: task.id || ""
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn release-control-task-escalate-btn",
        text: "Escalate",
        attrs: { type: "button" },
        dataset: {
          releaseControlTaskCheckpointAction: "escalate",
          taskId: task.id || ""
        }
      })
    ])
  ]));
  const releaseTaskLedgerSnapshotDiff = governance.releaseTaskLedgerSnapshotDiff;
  const releaseTaskLedgerSnapshotDriftItems = Array.isArray(releaseTaskLedgerSnapshotDiff?.driftItems)
    ? releaseTaskLedgerSnapshotDiff.driftItems
    : [];
  const releaseTaskLedgerSnapshotDiffEntries = releaseTaskLedgerSnapshotDiff
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
                text: releaseTaskLedgerSnapshotDiff.snapshotTitle || "No Release Control task ledger snapshot",
                style: {
                  fontWeight: "800",
                  color: "var(--text)"
                }
              }),
              createElement("div", {
                text: releaseTaskLedgerSnapshotDiff.snapshotCreatedAt ? new Date(releaseTaskLedgerSnapshotDiff.snapshotCreatedAt).toLocaleString() : "No snapshot saved yet",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.84rem",
                  marginTop: "0.3rem"
                }
              })
            ]),
            createTag((releaseTaskLedgerSnapshotDiff.driftSeverity || "missing-snapshot").toUpperCase(), {
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: releaseTaskLedgerSnapshotDiff.driftSeverity === "high" || releaseTaskLedgerSnapshotDiff.driftSeverity === "missing-snapshot"
                ? "var(--danger)"
                : releaseTaskLedgerSnapshotDiff.driftSeverity === "none"
                  ? "var(--success)"
                  : "var(--warning)"
            })
          ]),
          createElement("div", {
            text: releaseTaskLedgerSnapshotDiff.recommendedAction || "Save a Release Control task ledger snapshot before comparing drift.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `${releaseTaskLedgerSnapshotDiff.driftScore || 0} drift score - ${releaseTaskLedgerSnapshotDriftItems.length} drift item(s)`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          }),
          releaseTaskLedgerSnapshotDriftItems.length
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
                  text: "Task ledger drift fields",
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.78rem",
                    fontWeight: "800",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase"
                  }
                }),
                ...releaseTaskLedgerSnapshotDriftItems.slice(0, 8).map((item) => createElement("div", {
                  style: {
                    display: "grid",
                    gap: "0.5rem",
                    padding: "0.65rem",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    background: "var(--surface)"
                  }
                }, [
                  createElement("div", {
                    text: `${item.label || item.field || "Release Control task drift"}: ${item.before ?? "none"} -> ${item.current ?? "none"} (${item.delta >= 0 ? "+" : ""}${item.delta ?? 0})`,
                    style: {
                      color: "var(--text)",
                      fontSize: "0.84rem",
                      fontWeight: "700",
                      lineHeight: "1.45"
                    }
                  }),
                  createElement("div", {
                    className: "governance-actions"
                  }, [
                    createElement("button", {
                      className: "btn governance-action-btn release-task-ledger-drift-item-confirm-btn",
                      text: "Confirm",
                      attrs: { type: "button" },
                      dataset: {
                        releaseTaskLedgerDriftItemField: item.field || item.label || "",
                        releaseTaskLedgerDriftItemDecision: "confirmed"
                      }
                    }),
                    createElement("button", {
                      className: "btn governance-action-btn release-task-ledger-drift-item-defer-btn",
                      text: "Defer",
                      attrs: { type: "button" },
                      dataset: {
                        releaseTaskLedgerDriftItemField: item.field || item.label || "",
                        releaseTaskLedgerDriftItemDecision: "deferred"
                      }
                    }),
                    createElement("button", {
                      className: "btn governance-action-btn release-task-ledger-drift-item-escalate-btn",
                      text: "Escalate",
                      attrs: { type: "button" },
                      dataset: {
                        releaseTaskLedgerDriftItemField: item.field || item.label || "",
                        releaseTaskLedgerDriftItemDecision: "escalated"
                      }
                    })
                  ])
                ])),
                releaseTaskLedgerSnapshotDriftItems.length > 8
                  ? createElement("div", {
                      text: `${releaseTaskLedgerSnapshotDriftItems.length - 8} additional drift item(s).`,
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
  const releaseTaskLedgerSnapshotEntries = (governance.releaseTaskLedgerSnapshots || []).map((snapshot) => createElement("div", {
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
          text: snapshot.title || "Release Control Task Ledger",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${new Date(snapshot.createdAt).toLocaleString()} - ${snapshot.statusFilter || "all"} - ${snapshot.visibleCount || 0} visible`,
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
      text: `${snapshot.total || 0} total Release Control task(s) - ${snapshot.closedCount || 0} closed - ${snapshot.secretPolicy || "non-secret release-control task metadata only"}`,
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
        className: "btn governance-action-btn release-task-ledger-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: {
          releaseTaskLedgerSnapshotId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn release-task-ledger-snapshot-drift-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: {
          releaseTaskLedgerSnapshotDriftId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn release-task-ledger-snapshot-drift-task-btn",
        text: "Track Drift",
        attrs: { type: "button" },
        dataset: {
          releaseTaskLedgerSnapshotDriftTaskId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn release-task-ledger-snapshot-drift-accept-btn",
        text: "Accept Drift",
        attrs: { type: "button" },
        dataset: {
          releaseTaskLedgerSnapshotDriftAcceptId: snapshot.id
        }
      })
    ])
  ]));
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
        className: "btn governance-action-btn control-plane-snapshot-drift-task-btn",
        text: "Track Drift",
        attrs: { type: "button" },
        dataset: {
          controlPlaneSnapshotDriftTaskId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn control-plane-snapshot-drift-accept-btn",
        text: "Accept Drift",
        attrs: { type: "button" },
        dataset: {
          controlPlaneSnapshotDriftAcceptId: snapshot.id
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
    ]),
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn agent-execution-sla-ledger-item-confirm-btn",
        text: "Confirm",
        attrs: { type: "button" },
        dataset: {
          agentExecutionSlaLedgerItemId: item.id || "",
          agentExecutionSlaLedgerItemDecision: "confirm"
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn agent-execution-sla-ledger-item-defer-btn",
        text: "Defer",
        attrs: { type: "button" },
        dataset: {
          agentExecutionSlaLedgerItemId: item.id || "",
          agentExecutionSlaLedgerItemDecision: "defer"
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn agent-execution-sla-ledger-item-escalate-btn",
        text: "Escalate",
        attrs: { type: "button" },
        dataset: {
          agentExecutionSlaLedgerItemId: item.id || "",
          agentExecutionSlaLedgerItemDecision: "escalate"
        }
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
    run.agentPolicyId
      ? createElement("div", {
          text: `Agent policy: ${run.agentPolicyCheckpointStatus || "needs-review"} | ${run.agentRole || "role unset"} | ${run.runtime || "runtime unset"} / ${run.isolationMode || "isolation unset"} | skills ${(run.skillBundle || []).join(", ") || "none"}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      : null,
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
      run.agentPolicyId
        ? createTag(`policy ${run.agentPolicyCheckpointStatus || "needs-review"}`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: run.agentPolicyCheckpointStatus === "approved" ? "var(--success)" : "var(--warning)"
          })
        : null,
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
    createExecutionResultCheckpointPanel(run, governance, executionMetrics),
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
  const vibeCoderGuideSteps = [
    ["Capture intent", "Convert the request into a scoped objective, success criteria, and non-goals."],
    ["Check source readiness", "Use Data Sources to confirm repo access, health, and any external-only passwords, certificates, SSH, VPN, or browser-session requirements."],
    ["Read the control plane", "Use Governance and Agent Control Plane to decide ready, review, or hold before execution."],
    ["Generate a work order", "Define target repo, files in scope, expected changes, validation commands, acceptance criteria, and rollback plan."],
    ["Execute in small slices", "Run one implementation slice at a time and capture non-secret status, changed files, validation summaries, and blockers."],
    ["Validate and relaunch", "Run checks, rebuild, relaunch locally, smoke-check the app, then commit and push only validated milestone changes."]
  ];
  const vibeCoderOperatingGuideEntries = [
    createElement("div", {
      className: "governance-gap-card vibe-coder-operating-guide-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "0.75rem"
        }
      }, [
        createElement("div", {}, [
          createElement("div", {
            text: "Safe app-building cycle",
            style: {
              color: "var(--text)",
              fontWeight: "900",
              fontSize: "1.02rem"
            }
          }),
          createElement("div", {
            text: "A plain-language operating cycle for vibe coding with Workspace Audit Pro, Codex CLI, Claude CLI, and local validation gates.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.86rem",
              lineHeight: "1.45",
              marginTop: "0.25rem"
            }
          })
        ]),
        createTag("operator guide", {
          background: "var(--bg)",
          border: "1px solid var(--primary)",
          color: "var(--primary)"
        })
      ]),
      createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))",
          gap: "0.6rem"
        }
      }, vibeCoderGuideSteps.map(([label, detail], index) => createElement("div", {
        style: {
          padding: "0.7rem",
          border: "1px solid var(--border)",
          borderRadius: "0.85rem",
          background: "var(--bg)"
        }
      }, [
        createElement("div", {
          text: `${index + 1}. ${label}`,
          style: {
            color: "var(--text)",
            fontWeight: "900",
            fontSize: "0.88rem"
          }
        }),
        createElement("div", {
          text: detail,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.82rem",
            lineHeight: "1.45",
            marginTop: "0.3rem"
          }
        })
      ]))),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn vibe-coder-guide-copy-btn",
          text: "Copy Guide",
          attrs: { type: "button" },
          dataset: {
            vibeCoderGuideCopy: "true"
          }
        })
      ])
    ])
  ];
  const cliRunnerGateReasons = [];
  const controlPlaneGateDecision = controlPlaneDecision?.decision || "not-evaluated";
  if (!controlPlaneDecision) {
    cliRunnerGateReasons.push({ severity: "hold", message: "Agent Control Plane decision is not loaded yet." });
  }
  if (dataSourcesAccessGateDecision !== "ready") {
    cliRunnerGateReasons.push({ severity: dataSourcesAccessGateDecision === "hold" ? "hold" : "review", message: `Data Sources access gate is ${dataSourcesAccessGateDecision}.` });
  }
  if (controlPlaneGateDecision !== "ready") {
    cliRunnerGateReasons.push({ severity: controlPlaneGateDecision === "hold" ? "hold" : "review", message: `Agent Control Plane decision is ${controlPlaneGateDecision}.` });
  }
  if (releaseBuildGateDecision !== "ready") {
    cliRunnerGateReasons.push({ severity: releaseBuildGateDecision === "hold" ? "hold" : "review", message: `Release Build Gate is ${releaseBuildGateDecision}.` });
  }
  if ((executionMetrics.slaBreached || 0) > 0) {
    cliRunnerGateReasons.push({ severity: "hold", message: `${executionMetrics.slaBreached} unresolved Agent Execution SLA breach(es) need review.` });
  }
  if ((executionMetrics.staleActive || 0) > 0) {
    cliRunnerGateReasons.push({ severity: "review", message: `${executionMetrics.staleActive} stale active Agent Execution run(s) should be cleared before unattended CLI work.` });
  }
  const cliRunnerGateDecision = cliRunnerGateReasons.some((reason) => reason.severity === "hold")
    ? "hold"
    : cliRunnerGateReasons.length
      ? "review"
      : "ready";
  const cliRunnerGateColor = cliRunnerGateDecision === "ready"
    ? "var(--success)"
    : cliRunnerGateDecision === "hold"
      ? "var(--danger)"
      : "var(--warning)";
  const cliRunnerReadinessEntries = [
    createElement("div", {
      className: "governance-gap-card cli-runner-readiness-gate-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "0.75rem"
        }
      }, [
        createElement("div", {}, [
          createElement("div", {
            text: "Codex CLI / Claude CLI runner readiness",
            style: {
              color: "var(--text)",
              fontWeight: "900",
              fontSize: "1.02rem"
            }
          }),
          createElement("div", {
            text: "This gate keeps external agent execution guidance separate from actual CLI execution until source access, control-plane, release, and execution evidence are clean.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.86rem",
              lineHeight: "1.45",
              marginTop: "0.25rem"
            }
          })
        ]),
        createTag(cliRunnerGateDecision.toUpperCase(), {
          background: "var(--bg)",
          border: `1px solid ${cliRunnerGateColor}`,
          color: cliRunnerGateColor
        })
      ]),
      createElement("div", {
        text: cliRunnerGateDecision === "ready"
          ? "Ready for a supervised CLI runner prototype dry run. Keep commands bounded to work orders and preserve non-secret validation summaries only."
          : "Do not start unattended CLI runner execution yet. Clear the listed gates first, then rerun the readiness check.",
        style: {
          color: "var(--text-muted)",
          fontSize: "0.88rem",
          lineHeight: "1.5"
        }
      }),
      createElement("div", {
        className: "tags"
      }, [
        createTag(`Source ${dataSourcesAccessGateDecision}`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: dataSourcesAccessGateDecision === "ready" ? "var(--success)" : dataSourcesAccessGateDecision === "hold" ? "var(--danger)" : "var(--warning)"
        }),
        createTag(`Control ${controlPlaneGateDecision}`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: controlPlaneGateDecision === "ready" ? "var(--success)" : controlPlaneGateDecision === "hold" ? "var(--danger)" : "var(--warning)"
        }),
        createTag(`Release ${releaseBuildGateDecision}`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: releaseBuildGateDecision === "ready" ? "var(--success)" : releaseBuildGateDecision === "hold" ? "var(--danger)" : "var(--warning)"
        }),
        createTag(`SLA ${executionMetrics.slaBreached || 0}`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (executionMetrics.slaBreached || 0) ? "var(--danger)" : "var(--success)"
        }),
        createTag(`Stale ${executionMetrics.staleActive || 0}`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (executionMetrics.staleActive || 0) ? "var(--warning)" : "var(--success)"
        })
      ]),
      cliRunnerGateReasons.length
        ? createElement("div", {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
              padding: "0.7rem",
              border: "1px solid var(--border)",
              borderRadius: "0.85rem",
              background: "color-mix(in srgb, var(--surface-hover) 45%, transparent 55%)"
            }
          }, cliRunnerGateReasons.map((reason) => createElement("div", {
            text: `${reason.severity.toUpperCase()}: ${reason.message}`,
            style: {
              color: reason.severity === "hold" ? "var(--danger)" : "var(--warning)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          })))
        : null
    ])
  ];
  const cliBridgeArchitectureSteps = [
    ["App-owned broker", "Workspace Audit Pro owns the work order, readiness gate, validation plan, result ledger, and relaunch checkpoint. Codex CLI and Claude CLI never free-chat directly."],
    ["Shared context pack", "The app prepares a sanitized MCP-style context pack with target repo, source-access status, acceptance criteria, non-goals, and no secrets."],
    ["Runner adapters", "Use Codex SDK or codex exec for Codex work slices, and Claude Code SDK or claude -p for Claude work slices. Prefer SDKs when the app needs structured control and resumable threads."],
    ["Handoff protocol", "One runner returns plan/result JSON, the app validates it, then the app decides whether to create a sanitized follow-up work order for the other runner."],
    ["Validation loop", "Each accepted slice must pass checks, build, local smoke, relaunch, milestone note, git commit, and optional GitHub push before the next slice starts."]
  ];
  const cliBridgeArchitectureEntries = [
    createElement("div", {
      className: "governance-gap-card cli-bridge-architecture-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem"
      }
    }, [
      createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "0.75rem"
        }
      }, [
        createElement("div", {}, [
          createElement("div", {
            text: "Work-order broker, not agent-to-agent free chat",
            style: {
              color: "var(--text)",
              fontWeight: "900",
              fontSize: "1.02rem"
            }
          }),
          createElement("div", {
            text: "Recommended method for connecting Codex CLI and Claude CLI: the app becomes the control plane that creates bounded work orders, runs one adapter at a time, validates outputs, and records non-secret handoffs.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.86rem",
              lineHeight: "1.45",
              marginTop: "0.25rem"
            }
          })
        ]),
        createTag("bridge plan", {
          background: "var(--bg)",
          border: "1px solid var(--primary)",
          color: "var(--primary)"
        })
      ]),
      createElement("div", {
        className: "tags"
      }, [
        createTag("MCP context", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--primary)"
        }),
        createTag("SDK first", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--success)"
        }),
        createTag("subprocess fallback", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--warning)"
        }),
        createTag("no secrets", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--danger)"
        })
      ]),
      createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))",
          gap: "0.6rem"
        }
      }, cliBridgeArchitectureSteps.map(([label, detail], index) => createElement("div", {
        style: {
          padding: "0.7rem",
          border: "1px solid var(--border)",
          borderRadius: "0.85rem",
          background: "var(--bg)"
        }
      }, [
        createElement("div", {
          text: `${index + 1}. ${label}`,
          style: {
            color: "var(--text)",
            fontWeight: "900",
            fontSize: "0.88rem"
          }
        }),
        createElement("div", {
          text: detail,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.82rem",
            lineHeight: "1.45",
            marginTop: "0.3rem"
          }
        })
      ]))),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-context-copy-btn",
          text: "Copy Codex Context",
          attrs: { type: "button" },
          dataset: {
            cliBridgeContextRunner: "codex"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-context-copy-btn",
          text: "Copy Claude Context",
          attrs: { type: "button" },
          dataset: {
            cliBridgeContextRunner: "claude"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-context-copy-btn",
          text: "Copy Full Context",
          attrs: { type: "button" },
          dataset: {
            cliBridgeContextRunner: "all"
          }
        })
      ])
    ])
  ];

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
    createListSection("Task Seeding Checkpoints", "Operator decisions for generated task batches before or instead of creating task records.", taskSeedingCheckpointEntries),
    createListSection("Task Update Audit Ledger", "Recent non-secret Governance task lifecycle update operations with operator checkpoints.", governanceTaskUpdateLedgerEntries),
    createListSection("Task Update Audit Ledger Snapshots", "Persisted non-secret Governance task update audit ledger handoffs.", [...governanceTaskUpdateLedgerSnapshotDiffEntries, ...governanceTaskUpdateLedgerSnapshotEntries]),
    createListSection("Vibe Coder Operating Guide", "Step-by-step operating cycle for safe app debugging, build validation, local relaunch, and supervised agent work.", vibeCoderOperatingGuideEntries),
    createListSection("CLI Runner Readiness Gate", "Readiness signal for a future supervised Codex CLI / Claude CLI work-order runner prototype.", cliRunnerReadinessEntries),
    createListSection("CLI Bridge Architecture", "Recommended non-executing integration path for Codex CLI and Claude CLI through app-owned work orders and sanitized handoffs.", cliBridgeArchitectureEntries),
    createListSection("Workflow Runbook", "Supervised workflow and agent-readiness checkpoints derived from active project workflows.", workflowRunbookEntries),
    createListSection("Agent Sessions", "Prepared supervised agent handoff sessions captured from project workbenches.", agentSessionEntries),
    createListSection("Control Plane Decision Gate", "Ready/review/hold gate for supervised app-development build passes.", agentControlPlaneDecisionEntries),
    createListSection("Control Plane Decision Task Ledger", "Trackable Governance tasks created from Agent Control Plane decision reasons.", agentControlPlaneDecisionTaskEntries),
    createListSection("Execution Result Follow-up Tasks", "Trackable Governance tasks created when execution-result gate checkpoints are deferred.", [...agentExecutionResultTaskLedgerControlEntries, ...agentExecutionResultTaskEntries]),
    createListSection("Control Plane Decision Task Ledger Snapshots", "Persisted non-secret Control Plane decision task ledger handoffs.", [...agentControlPlaneDecisionTaskLedgerSnapshotDiffEntries, ...agentControlPlaneDecisionTaskLedgerSnapshotEntries]),
    createListSection("Execution Result Task Ledger Snapshots", "Persisted non-secret execution-result task ledger handoffs.", [...agentExecutionResultTaskLedgerSnapshotDiffEntries, ...agentExecutionResultTaskLedgerSnapshotEntries]),
    createListSection("Release Control", "Live non-secret Git, deployment smoke, validation, and saved release checkpoint state.", releaseControlEntries),
    createListSection("Release Control Task Ledger", "Trackable Governance tasks created from Release Build Gate actions.", releaseControlTaskEntries),
    createListSection("Release Control Task Ledger Snapshots", "Persisted non-secret Release Control task ledger handoffs.", [...releaseTaskLedgerSnapshotDiffEntries, ...releaseTaskLedgerSnapshotEntries]),
    createListSection("Data Sources Access Gate", "Ready/review/hold gate for source access before supervised ingestion and agent work.", dataSourcesAccessGateEntries),
    createListSection("Data Sources Access Review Queue", "Credential, certificate, SSH, and manual-access checks that can block supervised app-development ingestion.", dataSourcesAccessReviewQueueEntries),
    createListSection("Data Sources Access Validation Runbook", "Non-secret operator-side validation steps and command hints grouped by access method.", dataSourcesAccessValidationRunbookEntries),
    createListSection("Data Sources Access Validation Evidence Coverage", "Coverage queue showing which configured sources still need non-secret access-validation evidence.", dataSourcesAccessValidationEvidenceCoverageEntries),
    createListSection("Data Sources Access Validation Evidence", "Recorded non-secret proof that source-access checks were completed outside this app.", dataSourceAccessValidationEvidenceEntries),
    createListSection("Data Sources Access Validation Evidence Snapshots", "Persisted non-secret source-access validation evidence handoffs.", dataSourceAccessValidationEvidenceSnapshotEntries),
    createListSection("Data Sources Access Validation Evidence Snapshot Drift", "Latest saved evidence snapshot compared with the current non-secret evidence ledger.", dataSourceAccessValidationEvidenceSnapshotDiffEntries),
    createListSection("Data Sources Access Validation Workflow", "Pending, blocked, and ready source-access workflow blockers before task seeding.", dataSourcesAccessValidationWorkflowEntries),
    createListSection("Data Sources Access Validation Workflow Snapshots", "Persisted non-secret source-access validation workflow handoffs.", dataSourceAccessValidationWorkflowSnapshotEntries),
    createListSection("Data Sources Access Validation Workflow Snapshot Drift", "Latest saved workflow snapshot compared with the current source-access validation workflow.", dataSourceAccessValidationWorkflowSnapshotDiffEntries),
    createListSection("Data Sources Access Validation Workflow Tasks", "Workflow-seeded source-access tasks with their validation stage, evidence state, and lifecycle controls.", dataSourcesAccessValidationWorkflowTaskEntries),
    createListSection("Data Sources Access Task Ledger", "Trackable Governance tasks created from source-access review queue items.", dataSourcesAccessTaskEntries),
    createListSection("Data Sources Access Task Ledger Snapshots", "Persisted non-secret source-access task ledger handoffs.", [...dataSourcesAccessValidationWorkflowTaskLedgerSnapshotDiffEntries, ...dataSourcesAccessTaskLedgerSnapshotDiffEntries, ...dataSourcesAccessTaskLedgerSnapshotEntries]),
    createListSection("Control Plane Decision Snapshots", "Persisted ready/review/hold decision gates for audit and supervised-build handoff history.", agentControlPlaneDecisionSnapshotEntries),
    createListSection("Control Plane Baseline Status", "Current baseline selection state for baseline-vs-live drift workflows.", agentControlPlaneBaselineStatusEntries),
    createListSection("Control Plane Snapshots", "Persisted consolidated Agent Control Plane handoffs.", agentControlPlaneSnapshotEntries),
    createListSection("Agent Readiness Matrix", "Ranked project readiness for supervised agent build passes.", agentReadinessEntries),
    createListSection("Agent Policy Checkpoints", "Operator decisions for generated managed-agent role, runtime, skill, and hook policies before queueing.", agentPolicyCheckpointEntries),
    createListSection("Execution Result Checkpoints", "Operator decisions for retry, archive, retention, SLA resolution, and baseline-refresh result handling.", agentExecutionResultCheckpointEntries),
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
