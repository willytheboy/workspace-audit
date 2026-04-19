// @ts-check

import { encodeAppId, getColor } from "./dashboard-utils.js";

/**
 * @typedef {import("./dashboard-types.js").AuditProject} AuditProject
 * @typedef {import("./dashboard-types.js").AuditSummary} AuditSummary
 * @typedef {import("./dashboard-types.js").DashboardRuntimeState} DashboardRuntimeState
 * @typedef {import("./dashboard-types.js").GovernancePayload} GovernancePayload
 * @typedef {import("./dashboard-types.js").MutationScopeInventoryItem} MutationScopeInventoryItem
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
    targetBaselineCaptured: governance.summary.agentExecutionTargetBaselineCapturedCount || 0,
    targetBaselineMissing: governance.summary.agentExecutionTargetBaselineMissingCount || 0,
    targetBaselineHealthy: governance.summary.agentExecutionTargetBaselineHealthyCount || 0,
    targetBaselineStale: governance.summary.agentExecutionTargetBaselineStaleCount || 0,
    targetBaselineDrifted: governance.summary.agentExecutionTargetBaselineDriftedCount || 0,
    targetBaselineDriftReviewRequired: governance.summary.agentExecutionTargetBaselineDriftReviewRequiredCount || 0,
    targetBaselineReviewRequired: governance.summary.agentExecutionTargetBaselineReviewRequiredCount || 0,
    targetBaselineUncheckpointedDriftRuns: governance.summary.agentExecutionTargetBaselineUncheckpointedDriftRunCount || 0,
    targetBaselineUncheckpointedDriftItems: governance.summary.agentExecutionTargetBaselineUncheckpointedDriftItemCount || 0,
    auditBaselineCaptured: governance.summary.agentExecutionTargetBaselineAuditBaselineCapturedCount || 0,
    auditBaselineMissing: governance.summary.agentExecutionTargetBaselineAuditBaselineMissingCount || 0,
    auditBaselineHealthy: governance.summary.agentExecutionTargetBaselineAuditBaselineHealthyCount || 0,
    auditBaselineStale: governance.summary.agentExecutionTargetBaselineAuditBaselineStaleCount || 0,
    auditBaselineDrifted: governance.summary.agentExecutionTargetBaselineAuditBaselineDriftedCount || 0,
    auditBaselineDriftReviewRequired: governance.summary.agentExecutionTargetBaselineAuditBaselineDriftReviewRequiredCount || 0,
    auditBaselineReviewRequired: governance.summary.agentExecutionTargetBaselineAuditBaselineReviewRequiredCount || 0,
    auditBaselineUncheckpointedDriftRuns: governance.summary.agentExecutionTargetBaselineAuditBaselineUncheckpointedDriftRunCount || 0,
    auditBaselineUncheckpointedDriftItems: governance.summary.agentExecutionTargetBaselineAuditBaselineUncheckpointedDriftItemCount || 0,
    alertBaselineCaptured: governance.summary.agentExecutionRegressionAlertBaselineCapturedCount || 0,
    alertBaselineMissing: governance.summary.agentExecutionRegressionAlertBaselineMissingCount || 0,
    alertBaselineHealthy: governance.summary.agentExecutionRegressionAlertBaselineHealthyCount || 0,
    alertBaselineStale: governance.summary.agentExecutionRegressionAlertBaselineStaleCount || 0,
    alertBaselineDrifted: governance.summary.agentExecutionRegressionAlertBaselineDriftedCount || 0,
    alertBaselineDriftReviewRequired: governance.summary.agentExecutionRegressionAlertBaselineDriftReviewRequiredCount || 0,
    alertBaselineReviewRequired: governance.summary.agentExecutionRegressionAlertBaselineReviewRequiredCount || 0,
    alertBaselineRefreshGateReview: governance.summary.agentExecutionRegressionAlertBaselineRefreshGateReviewCount || 0,
    alertBaselineRefreshGateHold: governance.summary.agentExecutionRegressionAlertBaselineRefreshGateHoldCount || 0,
    alertBaselineUncheckpointedDriftRuns: governance.summary.agentExecutionRegressionAlertBaselineUncheckpointedDriftRunCount || 0,
    alertBaselineUncheckpointedDriftItems: governance.summary.agentExecutionRegressionAlertBaselineUncheckpointedDriftItemCount || 0,
    alertBaselineOpenEscalatedCheckpointRuns: governance.summary.agentExecutionRegressionAlertBaselineOpenEscalatedCheckpointRunCount || 0,
    alertBaselineOpenEscalatedCheckpoints: governance.summary.agentExecutionRegressionAlertBaselineOpenEscalatedCheckpointCount || 0,
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
  const alertSummary = scanDiff.alertSummary || { total: 0, high: 0, medium: 0, low: 0 };
  const alertAccent = alertSummary.high
    ? "var(--danger)"
    : alertSummary.medium
      ? "var(--warning)"
      : "var(--success)";
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
    }),
    createKpiCard({
      accentColor: alertAccent,
      label: "Regression Alerts",
      value: String(alertSummary.total || 0),
      detail: `${alertSummary.high || 0} high • ${alertSummary.medium || 0} medium • ${alertSummary.low || 0} low`
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
    const alerts = scanDiff.alerts || [];
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
      }),
      ...(alerts.length
        ? [createListSection("Health Regression Alerts", scanDiff.recommendedAction || "Workspace-level regression alerts from the latest scan summary.", alerts.map((alert) => createElement("div", {
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
              text: alert.title,
              style: {
                fontWeight: "800",
                color: "var(--text)"
              }
            }),
            createElement("div", {
              text: alert.detail,
              style: {
                color: "var(--text-muted)",
                fontSize: "0.86rem",
                lineHeight: "1.45"
              }
            })
          ])))]
        : [])
    ]);
  }

  const alertEntries = (scanDiff.alerts || []).map((alert) => createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.45rem",
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
        gap: "0.75rem",
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
          text: alert.title,
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: alert.projectName || alert.kind,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.8rem",
            fontFamily: alert.relPath ? "var(--font-mono)" : "inherit"
          }
        })
      ]),
      createTag(String(alert.severity || "low").toUpperCase(), {
        border: "1px solid var(--border)",
        background: alert.severity === "high"
          ? "color-mix(in srgb, var(--danger) 14%, transparent 86%)"
          : alert.severity === "medium"
            ? "color-mix(in srgb, var(--warning) 16%, transparent 84%)"
            : "color-mix(in srgb, var(--success) 14%, transparent 86%)"
      })
    ]),
    createElement("div", {
      text: alert.detail,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.86rem",
        lineHeight: "1.45"
      }
    }),
    createElement("div", {
      text: alert.recommendedAction,
      style: {
        color: "var(--text)",
        fontSize: "0.82rem",
        lineHeight: "1.45"
      }
    })
  ]));

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
    createListSection("Health Regression Alerts", scanDiff.recommendedAction || "Regression triage from scan-to-scan movement.", alertEntries),
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
  const convergenceTaskCount = summary.convergenceTaskCount || 0;
  const openConvergenceTaskCount = summary.convergenceOpenTaskCount || 0;
  const regressionAlertTaskCount = summary.regressionAlertTaskCount || 0;
  const regressionAlertOpenTaskCount = summary.regressionAlertOpenTaskCount || 0;
  const mutationScopeSummary = governance.mutationScopeInventory?.summary || {};
  const mutationScopeRelevant = mutationScopeSummary.scopeRelevant || 0;
  const mutationScopeGuarded = mutationScopeSummary.guarded || 0;
  const mutationScopeUnguarded = mutationScopeSummary.unguarded || 0;
  const mutationScopeCoverage = mutationScopeRelevant
    ? Math.round((mutationScopeGuarded / mutationScopeRelevant) * 100)
    : 0;
  const scanRegressionSummary = governance.scanDiff?.alertSummary || { total: 0, high: 0, medium: 0, low: 0 };
  const regressionAlertCount = scanRegressionSummary.total
    + (dataSourcesAccessGateDecision && !["ready", "not-evaluated"].includes(dataSourcesAccessGateDecision) ? 1 : 0)
    + (releaseBuildGateDecision && !["ready", "not-evaluated"].includes(releaseBuildGateDecision) ? 1 : 0)
    + (mutationScopeUnguarded ? 1 : 0)
    + (decision && decision !== "ready" ? 1 : 0);
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
      detail: `${summary.ownedProfiles} assigned owners; ${summary.governanceScopeProfileCount || 0}/${summary.governanceScopeProjectCount || 0} scoped app-dev projects profiled`
    }),
    createKpiCard({
      accentColor: (summary.governanceScopeProfileGapCount || 0) ? "var(--warning)" : "var(--success)",
      label: "Profile Coverage",
      value: `${summary.governanceScopeProfileCoveragePercent || 0}%`,
      detail: `${summary.governanceScopeProfileGapCount || 0} scoped app-dev gaps; ${summary.governanceScopeExcludedProjectCount || 0} non-target projects excluded`
    }),
    createKpiCard({
      accentColor: (summary.governanceProfileTestTargetMissingCount || 0) || (summary.governanceProfileTestTargetNeedsGrowthCount || 0) ? "var(--warning)" : "var(--success)",
      label: "Test Targets",
      value: `${summary.governanceProfileTestTargetMetCount || 0}/${summary.governanceProfileTargetCount || 0}`,
      detail: `${summary.governanceProfileTestTargetMissingCount || 0} missing, ${summary.governanceProfileTestTargetNeedsGrowthCount || 0} need growth, ${summary.governanceProfileMissingTestFileCount || 0} target test files outstanding, ${summary.governanceProfileTargetMissingTaskCount || 0} target tasks missing`
    }),
    createKpiCard({
      accentColor: "var(--warning)",
      label: "Governance Gaps",
      value: String(summary.governanceScopeProfileGapCount ?? governance.unprofiledProjects.length),
      detail: "App-development scoped projects without a saved governance profile"
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
      accentColor: mutationScopeUnguarded ? "var(--danger)" : mutationScopeRelevant ? "var(--success)" : "var(--primary)",
      label: "Mutation Guard",
      value: `${mutationScopeCoverage}%`,
      detail: `${mutationScopeGuarded}/${mutationScopeRelevant} guarded scope-relevant mutation routes; ${mutationScopeUnguarded} unguarded`
    }),
    createKpiCard({
      accentColor: regressionAlertCount
        ? (scanRegressionSummary.high || mutationScopeUnguarded || releaseBuildGateDecision === "hold" || dataSourcesAccessGateDecision === "hold" ? "var(--danger)" : "var(--warning)")
        : "var(--success)",
      label: "Alert Center",
      value: String(regressionAlertCount),
      detail: `${scanRegressionSummary.high || 0} scan high | ${scanRegressionSummary.medium || 0} scan medium | source ${dataSourcesAccessGateDecision} | release ${releaseBuildGateDecision}`
    }),
    createKpiCard({
      accentColor: regressionAlertOpenTaskCount ? "var(--warning)" : regressionAlertTaskCount ? "var(--success)" : "var(--primary)",
      label: "Alert Tasks",
      value: `${regressionAlertOpenTaskCount}/${regressionAlertTaskCount}`,
      detail: `${summary.regressionAlertTaskLedgerSnapshotCount || 0} snapshot(s) | baseline ${summary.regressionAlertTaskLedgerBaselineHealth || "missing"}`
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
      accentColor: openConvergenceTaskCount ? "var(--warning)" : convergenceTaskCount ? "var(--success)" : "var(--primary)",
      label: "Convergence Tasks",
      value: `${openConvergenceTaskCount}/${convergenceTaskCount}`,
      detail: "Open review tasks created from confirmed, merge, or needs-review overlap pairs"
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
      accentColor: (summary.cliBridgeRunnerDryRunSnapshotCount || 0) ? "var(--success)" : "var(--primary)",
      label: "CLI Dry Runs",
      value: String(summary.cliBridgeRunnerDryRunSnapshotCount || 0),
      detail: "Saved non-secret Codex and Claude runner dry-run contracts"
    }),
    createKpiCard({
      accentColor: (summary.cliBridgeRunTraceSnapshotCount || 0) ? "var(--success)" : "var(--primary)",
      label: "CLI Trace Snapshots",
      value: String(summary.cliBridgeRunTraceSnapshotCount || 0),
      detail: "Saved non-secret trace packs from CLI-linked Agent Execution runs"
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
  const summary = governance.summary || {};

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

  const profileTargetEntries = (governance.profileTargets || []).map((item) => createElement("div", {
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
          text: item.projectName,
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `Tests ${item.currentTestFiles}/${item.targetTestFiles} target • ${item.missingTestFiles} missing • runtime ${item.runtimeStatus} • tasks ${item.taskMissingCount ? `${item.taskMissingCount} missing` : "tracked"}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        }),
        createElement("div", {
          text: item.action,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      ]),
      createElement("div", {
        className: "tags",
        style: {
          justifyContent: "flex-end"
        }
      }, [
        createTag(item.testStatus || "missing", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: item.testStatus === "met" ? "var(--success)" : "var(--warning)"
        }),
        createTag(`scope ${item.scopeScore || 0}`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        createTag(item.testTaskStatus || (item.testTaskMissing ? "test task missing" : "test task ok"), {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: item.testTaskMissing ? "var(--warning)" : "var(--text-muted)"
        })
      ])
    ])
  ]));

  const profileTargetTaskEntries = (governance.profileTargetTasks || []).map((task) => createElement("div", {
    className: "governance-gap-card",
    dataset: { openAppId: encodeAppId(task.projectId) },
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
          text: task.title,
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${task.projectName || task.projectId || "Portfolio"} • ${task.governanceProfileTargetKind || "target"} • missing tests ${task.governanceProfileMissingTestFiles || 0}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      ]),
      createElement("div", {
        className: "tags",
        style: {
          justifyContent: "flex-end"
        }
      }, [
        createTag(task.status || "open", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: task.status === "open" ? "var(--warning)" : "var(--text-muted)"
        }),
        createTag(task.priority || "medium", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: task.priority === "high" ? "var(--danger)" : "var(--text-muted)"
        })
      ])
    ])
  ]));

  const profileTargetTaskSnapshotEntries = (governance.governanceProfileTargetTaskLedgerSnapshots || []).map((snapshot) => createElement("div", {
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
          text: snapshot.title || "Governance Profile Target Task Ledger",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${snapshot.visible || 0} visible • ${snapshot.openCount || 0} open • ${snapshot.missingTestFiles || 0} missing tests • ${snapshot.projectCount || 0} projects`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      ]),
      createElement("div", {
        className: "tags",
        style: {
          justifyContent: "flex-end"
        }
      }, [
        createTag(snapshot.statusFilter || "all", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        createTag(new Date(snapshot.createdAt || Date.now()).toLocaleDateString(), {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        })
      ])
    ])
  ]));
  const profileTargetTaskSnapshotDiff = governance.governanceProfileTargetTaskLedgerSnapshotDiff;
  const profileTargetTaskDriftCheckpointLedger = governance.governanceProfileTargetTaskLedgerDriftCheckpointLedger;
  const profileTargetTaskLedgerBaselineStatus = governance.governanceProfileTargetTaskLedgerBaselineStatus;
  const profileTargetTaskDriftItems = Array.isArray(profileTargetTaskSnapshotDiff?.driftItems)
    ? profileTargetTaskSnapshotDiff.driftItems
    : [];
  const profileTargetTaskDriftCheckpointFilter = ["all", "uncheckpointed", "confirmed", "deferred", "escalated"].includes(governance.profileTargetTaskLedgerDriftCheckpointFilter)
    ? governance.profileTargetTaskLedgerDriftCheckpointFilter
    : "all";
  const profileTargetTaskDriftCheckpointByField = new Map();
  if (profileTargetTaskSnapshotDiff?.snapshotId) {
    (profileTargetTaskDriftCheckpointLedger?.items || []).forEach((checkpoint) => {
      if (checkpoint.snapshotId !== profileTargetTaskSnapshotDiff.snapshotId) return;
      const field = checkpoint.field || "";
      if (!field) return;
      profileTargetTaskDriftCheckpointByField.set(field, checkpoint);
    });
  }
  const profileTargetTaskDriftRecords = profileTargetTaskDriftItems.map((item) => {
    const field = item.field || item.label || "";
    const checkpoint = profileTargetTaskDriftCheckpointByField.get(field);
    return {
      item,
      field,
      checkpoint,
      checkpointStatus: checkpoint?.decision || "uncheckpointed"
    };
  });
  const profileTargetTaskDriftCheckpointCounts = profileTargetTaskDriftRecords.reduce((counts, record) => {
    counts.all += 1;
    if (record.checkpointStatus === "confirmed") counts.confirmed += 1;
    else if (record.checkpointStatus === "deferred") counts.deferred += 1;
    else if (record.checkpointStatus === "escalated") counts.escalated += 1;
    else counts.uncheckpointed += 1;
    return counts;
  }, { all: 0, uncheckpointed: 0, confirmed: 0, deferred: 0, escalated: 0 });
  const profileTargetTaskVisibleDriftRecords = profileTargetTaskDriftCheckpointFilter === "all"
    ? profileTargetTaskDriftRecords
    : profileTargetTaskDriftRecords.filter((record) => record.checkpointStatus === profileTargetTaskDriftCheckpointFilter);
  const profileTargetTaskDriftFilterOptions = [
    ["all", "All"],
    ["uncheckpointed", "Uncheckpointed"],
    ["confirmed", "Confirmed"],
    ["deferred", "Deferred"],
    ["escalated", "Escalated"]
  ];
  const profileTargetTaskLedgerBaselineStatusEntries = profileTargetTaskLedgerBaselineStatus ? [
    createElement("div", {
      className: "governance-gap-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem"
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
            text: profileTargetTaskLedgerBaselineStatus.hasBaseline
              ? (profileTargetTaskLedgerBaselineStatus.title || "Governance Profile Target Task Ledger Baseline")
              : "No Governance Profile Target Task baseline saved",
            style: {
              fontWeight: "800",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: profileTargetTaskLedgerBaselineStatus.hasBaseline
              ? `${profileTargetTaskLedgerBaselineStatus.createdAt ? new Date(profileTargetTaskLedgerBaselineStatus.createdAt).toLocaleString() : "created date missing"} | ${profileTargetTaskLedgerBaselineStatus.snapshotId || "snapshot id missing"}`
              : `${profileTargetTaskLedgerBaselineStatus.snapshotCount || 0} saved target task snapshot(s) available`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.3rem",
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
          createTag(profileTargetTaskLedgerBaselineStatus.hasBaseline ? "BASELINE SET" : "BASELINE MISSING", {
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: profileTargetTaskLedgerBaselineStatus.hasBaseline ? "var(--success)" : "var(--warning)"
          }),
          createTag((profileTargetTaskLedgerBaselineStatus.freshness || "missing").toUpperCase(), {
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: profileTargetTaskLedgerBaselineStatus.freshness === "fresh" ? "var(--success)" : "var(--warning)"
          }),
          createTag(`DRIFT ${profileTargetTaskLedgerBaselineStatus.driftScore || 0}`, {
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: profileTargetTaskLedgerBaselineStatus.hasDrift ? "var(--warning)" : "var(--success)"
          }),
          createTag(`HEALTH ${(profileTargetTaskLedgerBaselineStatus.health || "missing").toUpperCase()}`, {
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: profileTargetTaskLedgerBaselineStatus.health === "healthy" ? "var(--success)" : "var(--warning)"
          })
        ])
      ]),
      createElement("div", {
        text: profileTargetTaskLedgerBaselineStatus.hasBaseline
          ? `Freshness: ${profileTargetTaskLedgerBaselineStatus.ageHours || 0}h old | stale after ${profileTargetTaskLedgerBaselineStatus.freshnessThresholdHours || 24}h | status filter ${profileTargetTaskLedgerBaselineStatus.statusFilter || "all"}`
          : `Freshness: missing | stale threshold ${profileTargetTaskLedgerBaselineStatus.freshnessThresholdHours || 24}h`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.88rem",
          lineHeight: "1.5"
        }
      }),
      createElement("div", {
        text: `Baseline health: ${profileTargetTaskLedgerBaselineStatus.health || "missing"} | ${profileTargetTaskLedgerBaselineStatus.recommendedAction || "Save a Governance profile target task ledger snapshot before relying on target-task drift gates."}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.88rem",
          lineHeight: "1.5"
        }
      }),
      createElement("div", {
        text: `Checkpoint coverage: ${profileTargetTaskLedgerBaselineStatus.checkpointedDriftItemCount || 0}/${profileTargetTaskLedgerBaselineStatus.driftItemCount || 0} drift item(s) checkpointed | ${profileTargetTaskLedgerBaselineStatus.uncheckpointedDriftItemCount || 0} unresolved`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.88rem",
          lineHeight: "1.5"
        }
      }),
      profileTargetTaskLedgerBaselineStatus.driftItems?.length
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
              text: "Baseline drift checkpoint coverage",
              style: {
                color: "var(--text-muted)",
                fontSize: "0.78rem",
                fontWeight: "800",
                letterSpacing: "0.08em",
                textTransform: "uppercase"
              }
            }),
            ...profileTargetTaskLedgerBaselineStatus.driftItems.slice(0, 6).map((item) => createElement("div", {
              text: `${item.label || item.field}: ${item.before} -> ${item.current} | ${item.checkpointStatus || "uncheckpointed"}`,
              style: {
                color: "var(--text-muted)",
                fontSize: "0.84rem",
                lineHeight: "1.45"
              }
            }))
          ])
        : null,
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn governance-profile-target-task-ledger-baseline-status-copy-btn",
          text: "Copy Baseline Status",
          attrs: { type: "button" },
          dataset: { governanceProfileTargetTaskLedgerBaselineStatusCopy: "true" }
        })
      ])
    ])
  ] : [];
  const profileTargetTaskSnapshotDiffEntries = profileTargetTaskSnapshotDiff ? [
    createElement("div", {
      className: "governance-gap-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem"
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
            text: profileTargetTaskSnapshotDiff.snapshotTitle || "Governance Profile Target Task Ledger Snapshot Drift",
            style: {
              fontWeight: "800",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: profileTargetTaskSnapshotDiff.recommendedAction || "Save or refresh the profile target task snapshot before the next supervised build.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createElement("div", {
          className: "tags",
          style: {
            justifyContent: "flex-end"
          }
        }, [
          createTag(profileTargetTaskSnapshotDiff.driftSeverity || "missing-snapshot", {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: profileTargetTaskSnapshotDiff.driftSeverity === "high" ? "var(--danger)" : profileTargetTaskSnapshotDiff.driftSeverity === "medium" ? "var(--warning)" : "var(--text-muted)"
          }),
          createTag(`score ${profileTargetTaskSnapshotDiff.driftScore || 0}`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)"
          })
        ])
      ]),
      createElement("div", {
        text: `${profileTargetTaskVisibleDriftRecords.length}/${profileTargetTaskDriftItems.length} drift item(s) shown | ${profileTargetTaskDriftCheckpointCounts.confirmed} confirmed, ${profileTargetTaskDriftCheckpointCounts.deferred} deferred, ${profileTargetTaskDriftCheckpointCounts.escalated} escalated, ${profileTargetTaskDriftCheckpointCounts.uncheckpointed} uncheckpointed | created ${profileTargetTaskSnapshotDiff.snapshotCreatedAt ? new Date(profileTargetTaskSnapshotDiff.snapshotCreatedAt).toLocaleString() : "not recorded"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      profileTargetTaskDriftItems.length
        ? createElement("div", {
            className: "governance-actions"
          }, profileTargetTaskDriftFilterOptions.map(([filter, label]) => createElement("button", {
            className: "btn governance-action-btn governance-profile-target-task-ledger-drift-checkpoint-filter-btn",
            text: `${label} (${profileTargetTaskDriftCheckpointCounts[filter] || 0})`,
            attrs: { type: "button" },
            dataset: {
              governanceProfileTargetTaskLedgerDriftCheckpointFilter: filter
            },
            style: {
              borderColor: profileTargetTaskDriftCheckpointFilter === filter ? "var(--primary)" : "var(--border)",
              color: profileTargetTaskDriftCheckpointFilter === filter ? "var(--primary)" : "var(--text)",
              fontWeight: profileTargetTaskDriftCheckpointFilter === filter ? "800" : "600"
            }
          })))
        : null,
      createElement("div", {
        style: {
          display: "grid",
          gap: "0.4rem"
        }
      }, [
        ...profileTargetTaskVisibleDriftRecords.slice(0, 6).map(({ item, field, checkpoint, checkpointStatus }) => createElement("div", {
          className: "governance-gap-card",
          style: {
            padding: "0.7rem",
            background: "var(--panel-soft)"
          }
        }, [
          createElement("div", {
            text: item.label || item.field || "Profile target task drift",
            style: {
              fontWeight: "700",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: `${item.before ?? "missing"} -> ${item.current ?? "missing"}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.82rem",
              lineHeight: "1.45"
            }
          }),
          checkpoint ? createElement("div", {
            style: {
              display: "flex",
              flexWrap: "wrap",
              gap: "0.45rem",
              alignItems: "center",
              color: "var(--text-muted)",
              fontSize: "0.78rem",
              lineHeight: "1.4"
            }
          }, [
            createTag(`CHECKPOINT ${String(checkpointStatus || "tracked").toUpperCase()}`, {
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: checkpointStatus === "escalated" ? "var(--danger)" : checkpointStatus === "deferred" ? "var(--warning)" : "var(--success)"
            }),
            createElement("span", {
              text: `${checkpoint.status || "open"} / ${checkpoint.priority || "normal"} | ${checkpoint.updatedAt || checkpoint.createdAt || "not recorded"}`
            })
          ]) : createElement("div", {
            text: "Checkpoint: not recorded",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.78rem"
            }
          }),
          createElement("div", {
            className: "governance-actions",
            style: {
              marginTop: "0.5rem"
            }
          }, [
            createElement("button", {
              className: "btn governance-action-btn governance-profile-target-task-ledger-drift-item-confirm-btn",
              text: checkpoint ? "Update Confirm" : "Confirm",
              attrs: { type: "button" },
              dataset: {
                governanceProfileTargetTaskLedgerDriftSnapshotId: profileTargetTaskSnapshotDiff.snapshotId || "latest",
                governanceProfileTargetTaskLedgerDriftItemField: field || "",
                governanceProfileTargetTaskLedgerDriftItemDecision: "confirmed"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn governance-profile-target-task-ledger-drift-item-defer-btn",
              text: checkpoint ? "Update Defer" : "Defer",
              attrs: { type: "button" },
              dataset: {
                governanceProfileTargetTaskLedgerDriftSnapshotId: profileTargetTaskSnapshotDiff.snapshotId || "latest",
                governanceProfileTargetTaskLedgerDriftItemField: field || "",
                governanceProfileTargetTaskLedgerDriftItemDecision: "deferred"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn governance-profile-target-task-ledger-drift-item-escalate-btn",
              text: checkpoint ? "Update Escalate" : "Escalate",
              attrs: { type: "button" },
              dataset: {
                governanceProfileTargetTaskLedgerDriftSnapshotId: profileTargetTaskSnapshotDiff.snapshotId || "latest",
                governanceProfileTargetTaskLedgerDriftItemField: field || "",
                governanceProfileTargetTaskLedgerDriftItemDecision: "escalated"
              }
            })
          ])
        ])),
        !profileTargetTaskVisibleDriftRecords.length
          ? createElement("div", {
              text: `No ${profileTargetTaskDriftCheckpointFilter} profile target task drift checkpoints match the current filter.`,
              style: {
                color: "var(--text-muted)",
                fontSize: "0.82rem",
                lineHeight: "1.45"
              }
            })
          : null
      ]),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn governance-profile-target-task-ledger-drift-checkpoint-ledger-copy-btn",
          text: "Copy Checkpoint Ledger",
          attrs: { type: "button" },
          dataset: { governanceProfileTargetTaskLedgerDriftCheckpointLedgerCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn governance-profile-target-task-ledger-baseline-refresh-btn",
          text: "Accept Live Baseline",
          attrs: { type: "button" },
          dataset: { governanceProfileTargetTaskLedgerBaselineRefresh: "true" }
        })
      ])
    ])
  ] : [];

  const profileTargetTaskDriftCheckpointLedgerEntries = profileTargetTaskDriftCheckpointLedger ? [
    createElement("div", {
      className: "governance-gap-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem"
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
            text: "Profile target task drift checkpoint ledger",
            style: {
              fontWeight: "800",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: `${profileTargetTaskDriftCheckpointLedger.summary?.total || 0} checkpoint task(s) | ${profileTargetTaskDriftCheckpointLedger.summary?.open || 0} open | ${profileTargetTaskDriftCheckpointLedger.summary?.escalated || 0} escalated`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.3rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createElement("div", {
          className: "governance-actions",
          style: {
            justifyContent: "flex-end"
          }
        }, [
          createElement("button", {
            className: "btn governance-action-btn governance-profile-target-task-ledger-drift-checkpoint-ledger-copy-btn",
            text: "Copy All",
            attrs: { type: "button" },
            dataset: { governanceProfileTargetTaskLedgerDriftCheckpointLedgerCopy: "all" }
          }),
          createElement("button", {
            className: "btn governance-action-btn governance-profile-target-task-ledger-drift-checkpoint-ledger-copy-btn",
            text: "Copy Open",
            attrs: { type: "button" },
            dataset: { governanceProfileTargetTaskLedgerDriftCheckpointLedgerCopy: "open" }
          }),
          createElement("button", {
            className: "btn governance-action-btn governance-profile-target-task-ledger-drift-checkpoint-ledger-copy-btn",
            text: "Copy Closed",
            attrs: { type: "button" },
            dataset: { governanceProfileTargetTaskLedgerDriftCheckpointLedgerCopy: "closed" }
          })
        ])
      ]),
      createElement("div", {
        style: {
          display: "grid",
          gap: "0.45rem"
        }
      }, [
        ...(profileTargetTaskDriftCheckpointLedger.items || []).slice(0, 6).map((item) => createElement("div", {
          className: "governance-gap-card",
          style: {
            padding: "0.7rem",
            background: "var(--panel-soft)"
          }
        }, [
          createElement("div", {
            text: item.title || "Profile target task drift checkpoint",
            style: {
              fontWeight: "700",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: `${item.decision || "tracked"} | ${item.field || item.label || "field not recorded"} | ${item.status || "open"} / ${item.priority || "normal"}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.82rem",
              lineHeight: "1.45"
            }
          }),
          createElement("div", {
            text: `${item.before || "none"} -> ${item.current || "none"} | snapshot ${item.snapshotTitle || item.snapshotId || "not recorded"}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.82rem",
              lineHeight: "1.45"
            }
          })
        ])),
        !(profileTargetTaskDriftCheckpointLedger.items || []).length
          ? createElement("div", {
              text: "No profile target task drift checkpoints have been recorded yet.",
              style: {
                color: "var(--text-muted)",
                fontSize: "0.82rem",
                lineHeight: "1.45"
              }
            })
          : null
      ])
    ])
  ] : [];

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
        text: `${project.category} • ${project.zone} • health ${project.qualityScore} • app-dev scope ${project.governanceScopeScore || 0}`,
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
      }),
      createElement("div", {
        text: `Scope evidence: ${(project.governanceScopeReasons || []).slice(0, 3).join(", ") || "app-development target"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.8rem",
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
  const mutationScopeInventory = governance.mutationScopeInventory || null;
  const mutationScopeSummary = mutationScopeInventory?.summary || {
    total: 0,
    scopeRelevant: 0,
    guarded: 0,
    unguarded: 0,
    utility: 0,
    methodCounts: {},
    categoryCounts: {}
  };
  const mutationScopeCoverage = mutationScopeSummary.scopeRelevant
    ? Math.round((mutationScopeSummary.guarded / mutationScopeSummary.scopeRelevant) * 100)
    : 0;
  const mutationCategoryRows = Object.entries(mutationScopeSummary.categoryCounts || {})
    .sort(([, left], [, right]) => Number(right) - Number(left))
    .slice(0, 8);
  const guardedMutationRoutes = (mutationScopeInventory?.items || [])
    .filter((item) => item.scopeRelevant && item.guarded)
    .slice(0, 10);
  const unguardedMutationRoutes = mutationScopeInventory?.unguarded || [];
  const mutationScopeAuditEntries = mutationScopeInventory ? [
    createElement("div", {
      className: "governance-gap-card mutation-scope-audit-summary-card",
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
          gap: "0.75rem",
          alignItems: "flex-start"
        }
      }, [
        createElement("div", {}, [
          createElement("div", {
            text: "Mutation guard coverage",
            style: {
              color: "var(--text)",
              fontWeight: "900",
              fontSize: "1.02rem"
            }
          }),
          createElement("div", {
            text: `${mutationScopeSummary.guarded}/${mutationScopeSummary.scopeRelevant} scope-relevant mutation routes are guarded by active project or portfolio scope.`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.86rem",
              lineHeight: "1.45",
              marginTop: "0.25rem"
            }
          })
        ]),
        createTag(`${mutationScopeCoverage}% guarded`, {
          background: "var(--bg)",
          border: `1px solid ${unguardedMutationRoutes.length ? "var(--danger)" : "var(--success)"}`,
          color: unguardedMutationRoutes.length ? "var(--danger)" : "var(--success)"
        })
      ]),
      createElement("div", {
        className: "tags"
      }, [
        createTag(`${mutationScopeSummary.total} mutation routes`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        createTag(`${mutationScopeSummary.utility} utility routes`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        createTag(`${mutationScopeSummary.unguarded} unguarded`, {
          background: "var(--bg)",
          border: `1px solid ${mutationScopeSummary.unguarded ? "var(--danger)" : "var(--success)"}`,
          color: mutationScopeSummary.unguarded ? "var(--danger)" : "var(--success)"
        })
      ]),
      createElement("div", {
        text: `Last generated ${mutationScopeInventory.generatedAt ? new Date(mutationScopeInventory.generatedAt).toLocaleString() : "unknown"} using ${mutationScopeInventory.protocolVersion || "mutation-scope-inventory.v1"}.`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.82rem",
          lineHeight: "1.45"
        }
      })
    ]),
    createElement("div", {
      className: "governance-gap-card mutation-scope-category-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem"
      }
    }, [
      createElement("div", {
        text: "Mutation route categories",
        style: {
          color: "var(--text)",
          fontWeight: "900",
          fontSize: "1.02rem"
        }
      }),
      createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))",
          gap: "0.5rem"
        }
      }, mutationCategoryRows.length ? mutationCategoryRows.map(([category, count]) => createElement("div", {
        style: {
          padding: "0.65rem",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          background: "var(--bg)"
        }
      }, [
        createElement("div", {
          text: category,
          style: {
            color: "var(--text)",
            fontWeight: "800",
            fontSize: "0.86rem"
          }
        }),
        createElement("div", {
          text: `${count} route(s)`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.8rem",
            marginTop: "0.2rem"
          }
        })
      ])) : [
        createElement("div", {
          text: "No mutation categories detected.",
          style: {
            color: "var(--text-muted)",
            fontSize: "0.86rem"
          }
        })
      ])
    ]),
    ...(unguardedMutationRoutes.length
      ? unguardedMutationRoutes.slice(0, 8).map((item) => createElement("div", {
          className: "governance-gap-card mutation-scope-unguarded-card",
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "0.45rem",
            borderColor: "color-mix(in srgb, var(--danger) 45%, var(--border) 55%)"
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
            createElement("div", {
              text: `${item.method} ${item.route}`,
              style: {
                color: "var(--text)",
                fontWeight: "900",
                fontSize: "0.92rem"
              }
            }),
            createTag("unguarded", {
              background: "var(--bg)",
              border: "1px solid var(--danger)",
              color: "var(--danger)"
            })
          ]),
          createElement("div", {
            text: item.recommendedAction || "Add an active project or portfolio mutation scope guard before this route can write.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          })
        ]))
      : [
          createElement("div", {
            className: "governance-gap-card mutation-scope-zero-unguarded-card",
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "0.45rem",
              borderColor: "color-mix(in srgb, var(--success) 45%, var(--border) 55%)"
            }
          }, [
            createElement("div", {
              text: "Zero unguarded scope-relevant mutation routes",
              style: {
                color: "var(--text)",
                fontWeight: "900",
                fontSize: "1rem"
              }
            }),
            createElement("div", {
              text: "The server-side scanner currently finds every scope-relevant POST, PATCH, and DELETE mutation route protected by explicit project or portfolio scope.",
              style: {
                color: "var(--text-muted)",
                fontSize: "0.84rem",
                lineHeight: "1.45"
              }
            })
          ])
        ]),
    createElement("div", {
      className: "governance-gap-card mutation-scope-guarded-sample-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem"
      }
    }, [
      createElement("div", {
        text: "Guarded route sample",
        style: {
          color: "var(--text)",
          fontWeight: "900",
          fontSize: "1.02rem"
        }
      }),
      ...guardedMutationRoutes.map((item) => createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          gap: "0.75rem",
          padding: "0.55rem 0",
          borderTop: "1px solid var(--border)"
        }
      }, [
        createElement("div", {
          text: `${item.method} ${item.route}`,
          style: {
            color: "var(--text)",
            fontWeight: "750",
            fontSize: "0.84rem",
            lineHeight: "1.35"
          }
        }),
        createTag(item.guardKind || "scope guard", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--success)"
        })
      ]))
    ])
  ] : [];
  const scanDiff = governance.scanDiff || null;
  const regressionAlertBaselineStatus = governance.regressionAlertTaskLedgerBaselineStatus || null;
  const regressionAlertSnapshotBaselineStatus = governance.agentExecutionRegressionAlertBaselineLedgerBaselineStatus || null;
  const regressionAlertItems = [
    ...(scanDiff?.alerts || []).map((alert) => ({
      source: "scan",
      severity: alert.severity || "low",
      title: alert.title,
      detail: alert.detail,
      recommendedAction: alert.recommendedAction || scanDiff?.recommendedAction || "Review the latest scan movement before continuing.",
      projectId: alert.projectId || "",
      meta: alert.projectName || alert.kind || "Scan regression"
    }))
  ];
  if (scanDiff?.totals?.qualityDelta < 0 && !(scanDiff.alerts || []).some((alert) => alert.kind === "workspace-quality-regression")) {
    regressionAlertItems.push({
      source: "scan",
      severity: "medium",
      title: "Workspace health score declined",
      detail: `Average quality moved ${scanDiff.totals.qualityDelta} between the latest two scans.`,
      recommendedAction: scanDiff.recommendedAction || "Triage projects with the largest quality drops before the next unattended build cycle.",
      projectId: "",
      meta: "Portfolio scan"
    });
  }
  if (dataSourcesAccessGateDecision && !["ready", "not-evaluated"].includes(dataSourcesAccessGateDecision)) {
    regressionAlertItems.push({
      source: "data-sources",
      severity: dataSourcesAccessGateDecision === "hold" ? "high" : "medium",
      title: "Data Sources access gate is not ready",
      detail: `${dataSourcesAccessGate?.ready || 0} ready, ${dataSourcesAccessGate?.review || 0} review, ${dataSourcesAccessGate?.blocked || 0} blocked source access item(s).`,
      recommendedAction: dataSourcesAccessGate?.recommendedAction || "Resolve external-only credentials, certificates, SSH, VPN, or browser-session requirements before ingestion.",
      projectId: "",
      meta: "Source access gate"
    });
  }
  if (releaseBuildGateDecision && !["ready", "not-evaluated"].includes(releaseBuildGateDecision)) {
    regressionAlertItems.push({
      source: "release",
      severity: releaseBuildGateDecision === "hold" ? "high" : "medium",
      title: "Release Build Gate is not ready",
      detail: `${releaseBuildGate?.reasons?.length || 0} reason(s), ${releaseBuildGate?.actions?.length || 0} action(s), risk score ${releaseBuildGate?.riskScore || 0}.`,
      recommendedAction: releaseBuildGate?.recommendedAction || "Collect release evidence, run validation, and resolve non-ready release actions.",
      projectId: "",
      meta: "Release control"
    });
  }
  if (mutationScopeSummary.unguarded) {
    regressionAlertItems.push({
      source: "mutation-scope",
      severity: "high",
      title: "Unguarded mutation route detected",
      detail: `${mutationScopeSummary.unguarded} scope-relevant mutation route(s) are not protected by active project or portfolio scope.`,
      recommendedAction: "Stop autonomous mutation work until every scope-relevant route has a server-side scope guard.",
      projectId: "",
      meta: "Mutation guard"
    });
  }
  if (regressionAlertSnapshotBaselineStatus && !["healthy", "missing"].includes(regressionAlertSnapshotBaselineStatus.health || "")) {
    regressionAlertItems.push({
      source: "regression-alert-snapshot-baseline",
      severity: ["drifted", "drift-review-required"].includes(regressionAlertSnapshotBaselineStatus.health || "") ? "high" : "medium",
      title: "Accepted Regression Alert baseline snapshot needs review",
      detail: `Accepted alert-baseline snapshot health is ${regressionAlertSnapshotBaselineStatus.health || "missing"} with freshness ${regressionAlertSnapshotBaselineStatus.freshness || "missing"}, drift score ${regressionAlertSnapshotBaselineStatus.driftScore || 0}, and ${regressionAlertSnapshotBaselineStatus.uncheckpointedDriftItemCount || 0} uncheckpointed drift item(s).`,
      recommendedAction: regressionAlertSnapshotBaselineStatus.recommendedAction || regressionAlertSnapshotBaselineStatus.driftRecommendedAction || "Review, checkpoint, or refresh the accepted Regression Alert baseline snapshot before unattended build work.",
      projectId: "",
      meta: `Snapshot ${regressionAlertSnapshotBaselineStatus.snapshotId || "not-selected"}`
    });
  }
  if (regressionAlertSnapshotBaselineStatus?.health === "missing") {
    regressionAlertItems.push({
      source: "regression-alert-snapshot-baseline",
      severity: "medium",
      title: "Accepted Regression Alert baseline snapshot is missing",
      detail: `${regressionAlertSnapshotBaselineStatus.snapshotCount || 0} saved Agent Execution Regression Alert baseline ledger snapshot(s) are available.`,
      recommendedAction: regressionAlertSnapshotBaselineStatus.recommendedAction || "Save or select an accepted Regression Alert baseline snapshot before relying on alert-baseline gates.",
      projectId: "",
      meta: "Accepted snapshot missing"
    });
  }
  if (regressionAlertBaselineStatus && !["healthy", "missing"].includes(regressionAlertBaselineStatus.health || "")) {
    regressionAlertItems.push({
      source: "regression-alert-baseline",
      severity: regressionAlertBaselineStatus.refreshGateDecision === "hold" || regressionAlertBaselineStatus.health === "drifted" ? "high" : "medium",
      title: "Regression Alert task ledger baseline needs review",
      detail: `Baseline health is ${regressionAlertBaselineStatus.health || "missing"} with drift score ${regressionAlertBaselineStatus.driftScore || 0}, ${regressionAlertBaselineStatus.uncheckpointedDriftItemCount || 0} uncheckpointed drift item(s), and ${regressionAlertBaselineStatus.openEscalatedCheckpointCount || 0} open escalated checkpoint(s).`,
      recommendedAction: regressionAlertBaselineStatus.refreshGateRecommendedAction || regressionAlertBaselineStatus.recommendedAction || "Review Regression Alert task ledger baseline drift before continuing unattended build work.",
      projectId: "",
      meta: `Refresh gate ${regressionAlertBaselineStatus.refreshGateDecision || "review"}`
    });
  }
  if (regressionAlertBaselineStatus?.health === "missing") {
    regressionAlertItems.push({
      source: "regression-alert-baseline",
      severity: "medium",
      title: "Regression Alert task ledger baseline is missing",
      detail: `${regressionAlertBaselineStatus.snapshotCount || 0} saved Regression Alert remediation task ledger snapshot(s) are available.`,
      recommendedAction: regressionAlertBaselineStatus.refreshGateRecommendedAction || "Save the current Regression Alert remediation task ledger as the first baseline before unattended cycles.",
      projectId: "",
      meta: "Baseline missing"
    });
  }
  if (decision && decision !== "ready") {
    regressionAlertItems.push({
      source: "control-plane",
      severity: decision === "hold" ? "high" : "medium",
      title: "Agent Control Plane decision is not ready",
      detail: `Current decision is ${decision}; baseline health is ${governance.agentControlPlaneDecision?.baselineHealth || summary.agentControlPlaneBaselineHealth || "missing"}.`,
      recommendedAction: governance.agentControlPlaneDecision?.recommendedAction || "Review the Agent Control Plane before the next supervised build.",
      projectId: "",
      meta: "Agent control plane"
    });
  }
  const severityRank = { high: 0, medium: 1, low: 2 };
  const sortedRegressionAlerts = regressionAlertItems
    .sort((left, right) => (severityRank[left.severity] ?? 3) - (severityRank[right.severity] ?? 3))
    .slice(0, 14);
  const regressionAlertCenterSummaryEntry = createElement("div", {
    className: "governance-gap-card regression-alert-center-summary-card",
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
          text: "Regression alert handoff",
          style: {
            color: "var(--text)",
            fontWeight: "900",
            fontSize: "1.02rem"
          }
        }),
        createElement("div", {
          text: "Copy a no-secret alert pack for operator review, Codex handoff, or Claude handoff before the next autonomous build slice.",
          style: {
            color: "var(--text-muted)",
            fontSize: "0.86rem",
            lineHeight: "1.45",
            marginTop: "0.25rem"
          }
        })
      ]),
      createTag(`${sortedRegressionAlerts.length} visible`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: sortedRegressionAlerts.length ? "var(--warning)" : "var(--success)"
      })
    ]),
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn regression-alert-center-copy-btn",
        text: "Copy Alert Pack",
        attrs: { type: "button" },
        dataset: { regressionAlertCenterCopy: "true" }
      })
    ])
  ]);
  const regressionAlertEntryCards = sortedRegressionAlerts.length
    ? sortedRegressionAlerts.map((alert) => {
        const accent = alert.severity === "high"
          ? "var(--danger)"
          : alert.severity === "medium"
            ? "var(--warning)"
            : "var(--success)";
        return createElement("div", {
          className: "governance-gap-card regression-alert-center-card",
          dataset: alert.projectId ? { openAppId: encodeAppId(alert.projectId) } : undefined,
          title: alert.projectId ? "Open project workbench" : undefined,
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            borderColor: `color-mix(in srgb, ${accent} 38%, var(--border) 62%)`
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
                text: alert.title,
                style: {
                  color: "var(--text)",
                  fontWeight: "900",
                  fontSize: "0.96rem"
                }
              }),
              createElement("div", {
                text: `${alert.source} | ${alert.meta}`,
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.78rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginTop: "0.2rem"
                }
              })
            ]),
            createTag(String(alert.severity).toUpperCase(), {
              background: "var(--bg)",
              border: `1px solid ${accent}`,
              color: accent
            })
          ]),
          createElement("div", {
            text: alert.detail,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          }),
          createElement("div", {
            text: alert.recommendedAction,
            style: {
              color: "var(--text)",
              fontSize: "0.82rem",
              lineHeight: "1.45"
            }
          }),
          createElement("div", {
            className: "governance-actions"
          }, [
            createElement("button", {
              className: "btn governance-action-btn regression-alert-task-btn",
              text: "Create Task",
              attrs: { type: "button" },
              dataset: {
                regressionAlertTask: "true",
                alertTitle: alert.title || "Regression alert",
                alertDetail: alert.detail || "",
                alertAction: alert.recommendedAction || "Review and resolve this regression alert.",
                alertSeverity: alert.severity || "medium",
                alertSource: alert.source || "governance",
                alertProjectId: alert.projectId || "",
                alertProjectName: alert.meta || "Portfolio Control Plane"
              }
            })
          ])
        ]);
      })
    : [
        createElement("div", {
          className: "governance-gap-card regression-alert-center-clear-card",
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "0.45rem",
            borderColor: "color-mix(in srgb, var(--success) 45%, var(--border) 55%)"
          }
        }, [
          createElement("div", {
            text: "No active regression alerts",
            style: {
              color: "var(--text)",
              fontWeight: "900",
              fontSize: "1rem"
            }
          }),
          createElement("div", {
            text: "Scan movement, Data Sources access gate, Release Build Gate, Control Plane decision, accepted Regression Alert baseline snapshot, Regression Alert task baseline, and mutation-scope guard coverage are currently clear or not-evaluated.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          })
        ])
      ];
  const regressionAlertSnapshotBaselineStatusEntry = regressionAlertSnapshotBaselineStatus
    ? [
      createElement("div", {
        className: "governance-gap-card regression-alert-snapshot-baseline-status-card",
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.65rem",
          borderColor: `color-mix(in srgb, ${
            regressionAlertSnapshotBaselineStatus.health === "healthy"
              ? "var(--success)"
              : regressionAlertSnapshotBaselineStatus.health === "stale"
                ? "var(--warning)"
                : "var(--danger)"
          } 32%, var(--border) 68%)`
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
              text: "Accepted Regression Alert baseline snapshot",
              style: {
                color: "var(--text)",
                fontWeight: "900",
                fontSize: "0.98rem"
              }
            }),
            createElement("div", {
              text: regressionAlertSnapshotBaselineStatus.hasBaseline
                ? `${regressionAlertSnapshotBaselineStatus.title || regressionAlertSnapshotBaselineStatus.snapshotId || "Accepted alert-baseline snapshot"} | ${regressionAlertSnapshotBaselineStatus.stateFilter || "review"} | ${regressionAlertSnapshotBaselineStatus.ageHours || 0}h old`
                : `${regressionAlertSnapshotBaselineStatus.snapshotCount || 0} saved alert-baseline snapshot(s) available; none accepted yet.`,
              style: {
                color: "var(--text-muted)",
                fontSize: "0.84rem",
                lineHeight: "1.45",
                marginTop: "0.2rem"
              }
            })
          ]),
          createTag((regressionAlertSnapshotBaselineStatus.health || "missing").toUpperCase(), {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: regressionAlertSnapshotBaselineStatus.health === "healthy"
              ? "var(--success)"
              : regressionAlertSnapshotBaselineStatus.health === "stale"
                ? "var(--warning)"
                : "var(--danger)"
          })
        ]),
        createElement("div", {
          className: "tags"
        }, [
          createTag((regressionAlertSnapshotBaselineStatus.freshness || "missing").toUpperCase(), {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: regressionAlertSnapshotBaselineStatus.freshness === "fresh" ? "var(--success)" : "var(--warning)"
          }),
          createTag(`drift ${regressionAlertSnapshotBaselineStatus.driftScore || 0}`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: regressionAlertSnapshotBaselineStatus.hasDrift ? "var(--warning)" : "var(--success)"
          }),
          createTag(`${regressionAlertSnapshotBaselineStatus.checkpointedDriftItemCount || 0}/${regressionAlertSnapshotBaselineStatus.driftItemCount || 0} checkpointed`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: (regressionAlertSnapshotBaselineStatus.uncheckpointedDriftItemCount || 0) > 0 ? "var(--warning)" : "var(--success)"
          }),
          createTag(`${regressionAlertSnapshotBaselineStatus.snapshotCount || 0} snapshots`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: regressionAlertSnapshotBaselineStatus.snapshotCount > 0 ? "var(--success)" : "var(--warning)"
          })
        ]),
        createElement("div", {
          text: regressionAlertSnapshotBaselineStatus.recommendedAction || regressionAlertSnapshotBaselineStatus.driftRecommendedAction || "Save or refresh the accepted alert-baseline snapshot before relying on unattended Regression Alert gates.",
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
            className: "btn governance-action-btn regression-alert-baseline-ledger-baseline-status-copy-btn",
            text: "Copy Snapshot Status",
            attrs: { type: "button" },
            dataset: { regressionAlertBaselineLedgerBaselineStatusCopy: "true" }
          })
        ])
      ])
    ]
    : [];
  const regressionAlertCenterEntries = [
    regressionAlertCenterSummaryEntry,
    ...regressionAlertSnapshotBaselineStatusEntry,
    ...regressionAlertEntryCards
  ];
  const regressionAlertTaskSummary = governance.summary || {};
  const regressionAlertTaskEntries = [
    createElement("div", {
      className: "governance-gap-card regression-alert-task-ledger-control-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
      }
    }, [
      createElement("div", {
        text: "Regression alert task ledger export",
        style: {
          color: "var(--text)",
          fontWeight: "900"
        }
      }),
      createElement("div", {
        text: `${regressionAlertTaskSummary.regressionAlertOpenTaskCount || 0} open / ${regressionAlertTaskSummary.regressionAlertTaskCount || 0} total. Copy or save a non-secret alert remediation baseline before unattended build cycles.`,
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
          className: "btn governance-action-btn regression-alert-task-ledger-copy-btn",
          text: "Copy Open",
          attrs: { type: "button" },
          dataset: { regressionAlertTaskLedgerCopy: "open" }
        }),
        createElement("button", {
          className: "btn governance-action-btn regression-alert-task-ledger-copy-btn",
          text: "Copy Closed",
          attrs: { type: "button" },
          dataset: { regressionAlertTaskLedgerCopy: "closed" }
        }),
        createElement("button", {
          className: "btn governance-action-btn regression-alert-task-ledger-copy-btn",
          text: "Copy All",
          attrs: { type: "button" },
          dataset: { regressionAlertTaskLedgerCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn regression-alert-task-ledger-snapshot-save-btn",
          text: "Save Snapshot",
          attrs: { type: "button" },
          dataset: { regressionAlertTaskLedgerSnapshotSave: "true" }
        }),
        createElement("button", {
          className: "btn governance-action-btn regression-alert-task-ledger-drift-copy-btn",
          text: "Copy Drift",
          attrs: { type: "button" },
          dataset: { regressionAlertTaskLedgerDriftCopy: "latest" }
        })
      ])
    ]),
    ...(governance.regressionAlertTasks || []).map((task) => {
    const isClosedTask = ["done", "resolved", "closed", "cancelled", "archived"].includes(String(task.status || "").toLowerCase());
    const statusColor = isClosedTask
      ? "var(--success)"
      : task.status === "blocked"
        ? "var(--danger)"
        : "var(--warning)";
    return createElement("div", {
      className: "governance-gap-card regression-alert-task-ledger-card",
      dataset: task.projectId ? { openAppId: encodeAppId(task.projectId) } : undefined,
      title: task.projectId ? "Open project workbench" : undefined,
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
            text: task.title || "Regression alert task",
            style: {
              fontWeight: "800",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: `${task.projectName || "Portfolio Control Plane"} | ${task.updatedAt ? `updated ${new Date(task.updatedAt).toLocaleString()}` : `created ${task.createdAt ? new Date(task.createdAt).toLocaleString() : "unknown"}`}`,
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
            color: statusColor
          })
        ])
      ]),
      createElement("div", {
        text: task.description ? String(task.description).split("\n")[0] : "Track Regression Alert Center remediation without storing secrets.",
        style: {
          color: "var(--text-muted)",
          fontSize: "0.88rem",
          lineHeight: "1.5"
        }
      }),
      createElement("div", {
        className: "tags"
      }, [
        createTag("Regression Alert Center", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        createTag(task.secretPolicy || "non-secret-alert-metadata-only", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        })
      ]),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn regression-alert-task-status-btn",
          text: isClosedTask ? "Reopen" : "Resolve",
          attrs: { type: "button" },
          dataset: {
            regressionAlertTaskStatus: isClosedTask ? "open" : "resolved",
            taskId: task.id || ""
          }
        })
      ])
    ]);
  })];
  const regressionAlertTaskLedgerBaselineStatus = governance.regressionAlertTaskLedgerBaselineStatus || null;
  const regressionAlertTaskLedgerBaselineRefreshAllowed = regressionAlertTaskLedgerBaselineStatus?.refreshAllowed !== false;
  const regressionAlertTaskLedgerBaselineRefreshTitle = regressionAlertTaskLedgerBaselineRefreshAllowed
    ? "Refresh the saved Regression Alert remediation task ledger baseline from the current live ledger."
    : regressionAlertTaskLedgerBaselineStatus?.refreshGateRecommendedAction || "Resolve Regression Alert remediation task ledger refresh gate holds before accepting drift.";
  const regressionAlertTaskLedgerSnapshotEntries = (governance.regressionAlertTaskLedgerSnapshots || []).map((snapshot) => createElement("div", {
    className: "governance-gap-card regression-alert-task-ledger-snapshot-card",
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
          text: snapshot.title || "Regression Alert Remediation Task Ledger",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${snapshot.createdAt ? new Date(snapshot.createdAt).toLocaleString() : "saved snapshot"} | ${snapshot.statusFilter || "all"} | limit ${snapshot.limit || 100}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            marginTop: "0.3rem"
          }
        })
      ]),
      createTag(`${snapshot.openCount || 0}/${snapshot.total || 0} open`, {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: (snapshot.openCount || 0) ? "var(--warning)" : "var(--success)"
      })
    ]),
    createElement("div", {
      text: `${snapshot.visibleCount || 0} visible | ${snapshot.projectTaskCount || 0} project task(s) | ${snapshot.portfolioTaskCount || 0} portfolio task(s)`,
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
        className: "btn governance-action-btn regression-alert-task-ledger-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: { regressionAlertTaskLedgerSnapshotId: snapshot.id || "" }
      }),
      createElement("button", {
        className: "btn governance-action-btn regression-alert-task-ledger-snapshot-drift-copy-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: { regressionAlertTaskLedgerSnapshotDriftId: snapshot.id || "" }
      }),
      createElement("button", {
        className: "btn governance-action-btn regression-alert-task-ledger-snapshot-refresh-btn",
        text: regressionAlertTaskLedgerBaselineRefreshAllowed ? "Refresh Baseline" : "Gate Hold",
        title: regressionAlertTaskLedgerBaselineRefreshTitle,
        attrs: {
          type: "button",
          ...(regressionAlertTaskLedgerBaselineRefreshAllowed ? {} : { disabled: "true" })
        },
        dataset: {
          regressionAlertTaskLedgerSnapshotRefreshId: snapshot.id || "latest",
          regressionAlertTaskLedgerSnapshotRefreshStatus: snapshot.statusFilter || "all"
        }
      })
    ])
  ]));
  const regressionAlertTaskLedgerSnapshotDiff = governance.regressionAlertTaskLedgerSnapshotDiff || null;
  const regressionAlertTaskLedgerSnapshotDriftItems = Array.isArray(regressionAlertTaskLedgerSnapshotDiff?.driftItems)
    ? regressionAlertTaskLedgerSnapshotDiff.driftItems
    : [];
  const regressionAlertTaskLedgerSnapshotDiffEntries = regressionAlertTaskLedgerSnapshotDiff
    ? [
      createElement("div", {
        className: "governance-gap-card regression-alert-task-ledger-snapshot-drift-card",
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
              text: regressionAlertTaskLedgerSnapshotDiff.snapshotTitle || "Regression Alert Remediation Task Snapshot Drift",
              style: {
                fontWeight: "800",
                color: "var(--text)"
              }
            }),
            createElement("div", {
              text: regressionAlertTaskLedgerSnapshotDiff.snapshotCreatedAt
                ? `snapshot ${new Date(regressionAlertTaskLedgerSnapshotDiff.snapshotCreatedAt).toLocaleString()} | checked ${regressionAlertTaskLedgerSnapshotDiff.generatedAt ? new Date(regressionAlertTaskLedgerSnapshotDiff.generatedAt).toLocaleString() : "now"}`
                : "No saved snapshot baseline is available yet.",
              style: {
                color: "var(--text-muted)",
                fontSize: "0.84rem",
                marginTop: "0.3rem"
              }
            })
          ]),
          createTag(String(regressionAlertTaskLedgerSnapshotDiff.driftSeverity || "missing-snapshot").toUpperCase(), {
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: regressionAlertTaskLedgerSnapshotDiff.hasDrift ? "var(--warning)" : "var(--success)"
          })
        ]),
        createElement("div", {
          text: regressionAlertTaskLedgerSnapshotDiff.recommendedAction || "Save a Regression Alert remediation task ledger snapshot before unattended cycles.",
          style: {
            color: "var(--text-muted)",
            fontSize: "0.88rem",
            lineHeight: "1.5"
          }
        }),
        createElement("div", {
          className: "tags"
        }, [
          createTag(`${regressionAlertTaskLedgerSnapshotDiff.driftScore || 0} drift score`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: regressionAlertTaskLedgerSnapshotDiff.hasDrift ? "var(--warning)" : "var(--success)"
          }),
          createTag(`${regressionAlertTaskLedgerSnapshotDriftItems.length} drift item(s)`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: regressionAlertTaskLedgerSnapshotDriftItems.length ? "var(--warning)" : "var(--success)"
          })
        ]),
        ...regressionAlertTaskLedgerSnapshotDriftItems.slice(0, 8).map((item) => createElement("div", {
          className: "governance-gap-card regression-alert-task-ledger-snapshot-drift-item-card",
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem"
          }
        }, [
          createElement("div", {
            text: item.label || item.field || "Regression Alert remediation task ledger drift",
            style: {
              color: "var(--text)",
              fontWeight: "800"
            }
          }),
          createElement("div", {
            text: `${item.before ?? "none"} -> ${item.current ?? "none"}${item.delta ? ` (${item.delta})` : ""}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          }),
          item.checkpointDecision ? createTag(`${item.checkpointDecision} / ${item.checkpointStatus || "open"}`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: item.checkpointDecision === "confirmed" ? "var(--success)" : item.checkpointDecision === "escalated" ? "var(--danger)" : "var(--warning)"
          }) : null,
          createElement("div", {
            className: "governance-actions"
          }, [
            createElement("button", {
              className: "btn governance-action-btn regression-alert-task-ledger-drift-checkpoint-btn",
              text: "Confirm",
              attrs: { type: "button" },
              dataset: {
                regressionAlertTaskLedgerDriftSnapshotId: regressionAlertTaskLedgerSnapshotDiff.snapshotId || "latest",
                regressionAlertTaskLedgerDriftStatus: regressionAlertTaskLedgerSnapshotDiff.status || "all",
                regressionAlertTaskLedgerDriftField: item.field || "",
                regressionAlertTaskLedgerDriftDecision: "confirmed"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn regression-alert-task-ledger-drift-checkpoint-btn",
              text: "Defer",
              attrs: { type: "button" },
              dataset: {
                regressionAlertTaskLedgerDriftSnapshotId: regressionAlertTaskLedgerSnapshotDiff.snapshotId || "latest",
                regressionAlertTaskLedgerDriftStatus: regressionAlertTaskLedgerSnapshotDiff.status || "all",
                regressionAlertTaskLedgerDriftField: item.field || "",
                regressionAlertTaskLedgerDriftDecision: "deferred"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn regression-alert-task-ledger-drift-checkpoint-btn",
              text: "Escalate",
              attrs: { type: "button" },
              dataset: {
                regressionAlertTaskLedgerDriftSnapshotId: regressionAlertTaskLedgerSnapshotDiff.snapshotId || "latest",
                regressionAlertTaskLedgerDriftStatus: regressionAlertTaskLedgerSnapshotDiff.status || "all",
                regressionAlertTaskLedgerDriftField: item.field || "",
                regressionAlertTaskLedgerDriftDecision: "escalated"
              }
            })
          ])
        ]))
      ])
    ]
    : [];
  const regressionAlertTaskLedgerDriftCheckpointLedger = governance.regressionAlertTaskLedgerDriftCheckpointLedger || null;
  const regressionAlertTaskLedgerDriftCheckpointSummary = regressionAlertTaskLedgerDriftCheckpointLedger?.summary || {
    total: 0,
    visible: 0,
    open: 0,
    closed: 0,
    confirmed: 0,
    deferred: 0,
    escalated: 0,
    openEscalated: 0
  };
  const regressionAlertTaskLedgerDriftCheckpointLedgerEntries = regressionAlertTaskLedgerDriftCheckpointLedger ? [
    createElement("div", {
      className: "governance-gap-card regression-alert-task-ledger-drift-checkpoint-ledger-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
      }
    }, [
      createElement("div", {
        text: "Regression Alert task ledger drift checkpoint ledger",
        style: {
          color: "var(--text)",
          fontWeight: "850"
        }
      }),
      createElement("div", {
        text: `${regressionAlertTaskLedgerDriftCheckpointSummary.visible || 0} visible | ${regressionAlertTaskLedgerDriftCheckpointSummary.open || 0} open | ${regressionAlertTaskLedgerDriftCheckpointSummary.closed || 0} closed | ${regressionAlertTaskLedgerDriftCheckpointSummary.openEscalated || 0} open escalated`,
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
          className: "btn governance-action-btn regression-alert-task-ledger-drift-checkpoint-ledger-copy-btn",
          text: "Copy All",
          attrs: { type: "button" },
          dataset: { regressionAlertTaskLedgerDriftCheckpointLedgerCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn regression-alert-task-ledger-drift-checkpoint-ledger-copy-btn",
          text: "Copy Open",
          attrs: { type: "button" },
          dataset: { regressionAlertTaskLedgerDriftCheckpointLedgerCopy: "open" }
        }),
        createElement("button", {
          className: "btn governance-action-btn regression-alert-task-ledger-drift-checkpoint-ledger-copy-btn",
          text: "Copy Closed",
          attrs: { type: "button" },
          dataset: { regressionAlertTaskLedgerDriftCheckpointLedgerCopy: "closed" }
        })
      ])
    ]),
    ...(regressionAlertTaskLedgerDriftCheckpointLedger.items || []).slice(0, 8).map((item) => createElement("div", {
      className: "governance-gap-card regression-alert-task-ledger-drift-checkpoint-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem"
      }
    }, [
      createElement("div", {
        text: item.title || item.regressionAlertTaskLedgerDriftLabel || "Regression Alert remediation task ledger drift checkpoint",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: `${item.regressionAlertTaskLedgerSnapshotTitle || item.regressionAlertTaskLedgerSnapshotId || "Snapshot not recorded"} | ${item.regressionAlertTaskLedgerStatusFilter || "all"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        text: `${item.regressionAlertTaskLedgerDriftBefore || "missing"} -> ${item.regressionAlertTaskLedgerDriftCurrent || "missing"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createTag(`${item.regressionAlertTaskLedgerDriftDecision || "deferred"} / ${item.status || "open"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.regressionAlertTaskLedgerDriftDecision === "confirmed" ? "var(--success)" : item.regressionAlertTaskLedgerDriftDecision === "escalated" ? "var(--danger)" : "var(--warning)"
      }),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn regression-alert-task-ledger-drift-checkpoint-task-btn",
          text: "Resolve",
          attrs: { type: "button" },
          dataset: {
            regressionAlertTaskLedgerDriftCheckpointTaskId: item.id || "",
            regressionAlertTaskLedgerDriftCheckpointTaskStatus: "resolved"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn regression-alert-task-ledger-drift-checkpoint-task-btn",
          text: "Reopen",
          attrs: { type: "button" },
          dataset: {
            regressionAlertTaskLedgerDriftCheckpointTaskId: item.id || "",
            regressionAlertTaskLedgerDriftCheckpointTaskStatus: "open"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn regression-alert-task-ledger-drift-checkpoint-task-btn",
          text: "Block",
          attrs: { type: "button" },
          dataset: {
            regressionAlertTaskLedgerDriftCheckpointTaskId: item.id || "",
            regressionAlertTaskLedgerDriftCheckpointTaskStatus: "blocked"
          }
        })
      ])
    ]))
  ] : [];
  const regressionAlertTaskLedgerBaselineStatusEntries = regressionAlertTaskLedgerBaselineStatus
    ? [
      createElement("div", {
        className: "governance-gap-card regression-alert-task-ledger-baseline-status-card",
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
            gap: "0.8rem",
            alignItems: "flex-start"
          }
        }, [
          createElement("div", {}, [
            createElement("div", {
              text: regressionAlertTaskLedgerBaselineStatus.hasBaseline
                ? (regressionAlertTaskLedgerBaselineStatus.title || "Regression Alert Task Ledger Baseline")
                : "No Regression Alert task ledger baseline selected",
              style: {
                color: "var(--text)",
                fontWeight: "900",
                fontSize: "1.02rem"
              }
            }),
            createElement("div", {
              text: regressionAlertTaskLedgerBaselineStatus.hasBaseline && regressionAlertTaskLedgerBaselineStatus.createdAt
                ? `${new Date(regressionAlertTaskLedgerBaselineStatus.createdAt).toLocaleString()} | ${regressionAlertTaskLedgerBaselineStatus.status || "all"}`
                : `${regressionAlertTaskLedgerBaselineStatus.snapshotCount || 0} saved Regression Alert task ledger snapshot(s) available`,
              style: {
                color: "var(--text-muted)",
                fontSize: "0.86rem",
                lineHeight: "1.45",
                marginTop: "0.25rem"
              }
            })
          ]),
          createTag((regressionAlertTaskLedgerBaselineStatus.health || "missing").toUpperCase(), {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: regressionAlertTaskLedgerBaselineStatus.health === "healthy"
              ? "var(--success)"
              : regressionAlertTaskLedgerBaselineStatus.health === "drifted" || regressionAlertTaskLedgerBaselineStatus.health === "missing"
                ? "var(--danger)"
                : "var(--warning)"
          })
        ]),
        createElement("div", {
          className: "tags"
        }, [
          createTag(regressionAlertTaskLedgerBaselineStatus.hasBaseline ? "BASELINE SET" : "BASELINE MISSING", {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: regressionAlertTaskLedgerBaselineStatus.hasBaseline ? "var(--success)" : "var(--warning)"
          }),
          createTag((regressionAlertTaskLedgerBaselineStatus.freshness || "missing").toUpperCase(), {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: regressionAlertTaskLedgerBaselineStatus.freshness === "fresh" ? "var(--success)" : "var(--warning)"
          }),
          createTag(`drift ${regressionAlertTaskLedgerBaselineStatus.driftScore || 0}`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: regressionAlertTaskLedgerBaselineStatus.hasDrift ? "var(--warning)" : "var(--success)"
          }),
          createTag(`${regressionAlertTaskLedgerBaselineStatus.checkpointedDriftItemCount || 0}/${regressionAlertTaskLedgerBaselineStatus.driftItemCount || 0} checkpointed`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: (regressionAlertTaskLedgerBaselineStatus.uncheckpointedDriftItemCount || 0) > 0 ? "var(--warning)" : "var(--success)"
          }),
          createTag(`${regressionAlertTaskLedgerBaselineStatus.openEscalatedCheckpointCount || 0} open escalated`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: (regressionAlertTaskLedgerBaselineStatus.openEscalatedCheckpointCount || 0) > 0 ? "var(--danger)" : "var(--success)"
          }),
          createTag(`refresh ${regressionAlertTaskLedgerBaselineStatus.refreshGateDecision || "hold"}`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: regressionAlertTaskLedgerBaselineStatus.refreshGateDecision === "ready"
              ? "var(--success)"
              : regressionAlertTaskLedgerBaselineStatus.refreshGateDecision === "hold"
                ? "var(--danger)"
                : "var(--warning)"
          })
        ]),
        createElement("div", {
          text: regressionAlertTaskLedgerBaselineStatus.recommendedAction || "Save a Regression Alert remediation task ledger snapshot before relying on alert baselines.",
          style: {
            color: "var(--text-muted)",
            fontSize: "0.86rem",
            lineHeight: "1.45"
          }
        }),
        createElement("div", {
          text: `Refresh gate: ${regressionAlertTaskLedgerBaselineStatus.refreshGateDecision || "hold"} | ${regressionAlertTaskLedgerBaselineStatus.refreshGateRecommendedAction || "Review Regression Alert remediation task ledger drift before refreshing the baseline."}`,
          style: {
            color: regressionAlertTaskLedgerBaselineStatus.refreshGateDecision === "hold" ? "var(--danger)" : "var(--text-muted)",
            fontSize: "0.86rem",
            lineHeight: "1.45"
          }
        }),
        createElement("div", {
          text: `Refresh reasons: ${(regressionAlertTaskLedgerBaselineStatus.refreshGateReasons || []).slice(0, 3).join(" | ") || "No refresh gate reasons recorded."}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.82rem",
            lineHeight: "1.45"
          }
        }),
        createElement("div", {
          className: "governance-actions"
        }, [
          createElement("button", {
            className: "btn governance-action-btn regression-alert-task-ledger-baseline-status-copy-btn",
            text: "Copy Baseline Status",
            attrs: { type: "button" },
            dataset: {
              regressionAlertTaskLedgerBaselineStatusCopy: "true"
            }
          }),
          createElement("button", {
            className: "btn governance-action-btn regression-alert-task-ledger-snapshot-refresh-btn",
            text: regressionAlertTaskLedgerBaselineStatus.refreshAllowed
              ? (regressionAlertTaskLedgerBaselineStatus.hasBaseline ? "Refresh Baseline" : "Save Baseline")
              : "Gate Hold",
            title: regressionAlertTaskLedgerBaselineRefreshTitle,
            attrs: {
              type: "button",
              ...(regressionAlertTaskLedgerBaselineStatus.refreshAllowed ? {} : { disabled: "true" })
            },
            dataset: {
              regressionAlertTaskLedgerSnapshotRefreshId: regressionAlertTaskLedgerBaselineStatus.snapshotId || "latest",
              regressionAlertTaskLedgerSnapshotRefreshStatus: regressionAlertTaskLedgerBaselineStatus.status || "all"
            }
          })
        ])
      ])
    ]
    : [];
  const convergenceReviewLedger = governance.convergenceCandidates || null;
  const convergenceReviewCandidates = convergenceReviewLedger?.candidates || [];
  const convergenceReviewSummary = convergenceReviewLedger?.summary || {
    total: 0,
    reviewed: 0,
    unreviewed: 0,
    confirmedOverlap: 0,
    notRelated: 0,
    needsReview: 0,
    mergeCandidate: 0
  };
  const convergenceOperatorProposalQueue = governance.convergenceOperatorProposalQueue || null;
  const convergenceOperatorProposalSummary = convergenceOperatorProposalQueue?.summary || {
    total: 0,
    visible: 0,
    active: 0,
    reviewRequired: 0,
    taskReady: 0,
    taskTracked: 0,
    blocked: 0,
    completed: 0,
    suppressed: 0,
    highConfidence: 0
  };
  const convergenceOperatorProposalQueueEntries = convergenceOperatorProposalQueue ? [
    createElement("div", {
      className: "governance-gap-card convergence-operator-proposal-queue-summary-card",
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
            text: "Operator proposal review queue",
            style: {
              color: "var(--text)",
              fontWeight: "900",
              fontSize: "1.02rem"
            }
          }),
          createElement("div", {
            text: "User-contributed overlap candidates with AI due diligence, task state, and direct triage actions.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.86rem",
              lineHeight: "1.45",
              marginTop: "0.25rem"
            }
          })
        ]),
        createTag(`${convergenceOperatorProposalSummary.active || 0} active`, {
          background: "var(--bg)",
          border: "1px solid var(--primary)",
          color: "var(--primary)"
        })
      ]),
      createElement("div", {
        className: "tags"
      }, [
        createTag(`${convergenceOperatorProposalSummary.reviewRequired || 0} review`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceOperatorProposalSummary.reviewRequired || 0) ? "var(--warning)" : "var(--text-muted)"
        }),
        createTag(`${convergenceOperatorProposalSummary.taskReady || 0} task ready`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceOperatorProposalSummary.taskReady || 0) ? "var(--success)" : "var(--text-muted)"
        }),
        createTag(`${convergenceOperatorProposalSummary.taskTracked || 0} tracked`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceOperatorProposalSummary.taskTracked || 0) ? "var(--success)" : "var(--text-muted)"
        }),
        createTag(`${convergenceOperatorProposalSummary.suppressed || 0} suppressed`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceOperatorProposalSummary.suppressed || 0) ? "var(--danger)" : "var(--text-muted)"
        })
      ]),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-operator-proposal-queue-copy-btn",
          text: "Copy Active",
          attrs: { type: "button" },
          dataset: { convergenceOperatorProposalQueueCopy: "active" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-operator-proposal-queue-copy-btn",
          text: "Copy All",
          attrs: { type: "button" },
          dataset: { convergenceOperatorProposalQueueCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-operator-proposal-queue-copy-btn",
          text: "Copy Suppressed",
          attrs: { type: "button" },
          dataset: { convergenceOperatorProposalQueueCopy: "suppressed" }
        })
      ])
    ]),
    ...(convergenceOperatorProposalQueue.items || []).slice(0, 16).map((item) => {
      const statusColor = item.queueStatus === "suppressed"
        ? "var(--danger)"
        : item.queueStatus === "blocked" || item.queueStatus === "review-required"
          ? "var(--warning)"
          : "var(--success)";
      return createElement("div", {
        className: "governance-gap-card convergence-operator-proposal-queue-item-card",
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
            gap: "0.75rem",
            alignItems: "flex-start"
          }
        }, [
          createElement("div", {}, [
            createElement("div", {
              text: `${item.leftLabel || item.leftName || item.leftId} -> ${item.rightLabel || item.rightName || item.rightId}`,
              style: {
                color: "var(--text)",
                fontWeight: "900",
                fontSize: "0.96rem"
              }
            }),
            createElement("div", {
              text: item.recommendedAction || "Review operator-contributed overlap evidence before assimilation.",
              style: {
                color: "var(--text-muted)",
                fontSize: "0.84rem",
                lineHeight: "1.45",
                marginTop: "0.25rem"
              }
            })
          ]),
          createTag(`${item.score || 0}%`, {
            background: "var(--bg)",
            border: "1px solid var(--primary)",
            color: "var(--primary)"
          })
        ]),
        createElement("div", {
          className: "tags"
        }, [
          createTag((item.queueStatus || "review-required").replaceAll("-", " "), {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: statusColor
          }),
          createTag((item.reviewStatus || "unreviewed").replaceAll("-", " "), {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)"
          }),
          createTag(`${item.openTaskCount || 0} open task(s)`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: (item.openTaskCount || 0) ? "var(--success)" : "var(--text-muted)"
          })
        ]),
        item.generatedInsight
          ? createElement("div", {
              text: `AI insight: ${item.generatedInsight}`,
              style: {
                color: "var(--text-muted)",
                fontSize: "0.84rem",
                lineHeight: "1.45"
              }
            })
          : null,
        item.reviewNote
          ? createElement("div", {
              text: item.reviewNote,
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
            className: "btn governance-action-btn convergence-operator-proposal-action-btn",
            text: "Confirm",
            attrs: { type: "button" },
            dataset: {
              convergenceOperatorProposalActionPairId: item.pairId || "",
              convergenceOperatorProposalAction: "confirmed-overlap"
            }
          }),
          createElement("button", {
            className: "btn governance-action-btn convergence-operator-proposal-action-btn",
            text: "Needs Review",
            attrs: { type: "button" },
            dataset: {
              convergenceOperatorProposalActionPairId: item.pairId || "",
              convergenceOperatorProposalAction: "needs-review"
            }
          }),
          createElement("button", {
            className: "btn governance-action-btn convergence-operator-proposal-action-btn",
            text: "Merge",
            attrs: { type: "button" },
            dataset: {
              convergenceOperatorProposalActionPairId: item.pairId || "",
              convergenceOperatorProposalAction: "merge-candidate"
            }
          }),
          createElement("button", {
            className: "btn governance-action-btn convergence-operator-proposal-action-btn",
            text: "Not Related",
            attrs: { type: "button" },
            dataset: {
              convergenceOperatorProposalActionPairId: item.pairId || "",
              convergenceOperatorProposalAction: "not-related"
            }
          }),
          item.queueStatus !== "suppressed" ? createElement("button", {
            className: "btn governance-action-btn convergence-review-task-btn",
            text: "Track Task",
            attrs: { type: "button" },
            dataset: { convergenceReviewTaskPairId: item.pairId || "" }
          }) : null,
          createElement("button", {
            className: "btn governance-action-btn convergence-due-diligence-pack-copy-btn",
            text: "Copy Pack",
            attrs: { type: "button" },
            dataset: { convergenceDueDiligencePairId: item.pairId || "" }
          }),
          createElement("button", {
            className: "btn governance-action-btn convergence-assimilation-blueprint-copy-btn",
            text: "Copy Blueprint",
            attrs: { type: "button" },
            dataset: { convergenceAssimilationBlueprintPairId: item.pairId || "" }
          }),
          createElement("button", {
            className: "btn governance-action-btn convergence-assimilation-work-order-draft-btn",
            text: "Copy Codex Draft",
            attrs: { type: "button" },
            dataset: {
              convergenceAssimilationWorkOrderPairId: item.pairId || "",
              convergenceAssimilationWorkOrderRunner: "codex"
            }
          }),
          createElement("button", {
            className: "btn governance-action-btn convergence-assimilation-work-order-draft-btn",
            text: "Copy Claude Draft",
            attrs: { type: "button" },
            dataset: {
              convergenceAssimilationWorkOrderPairId: item.pairId || "",
              convergenceAssimilationWorkOrderRunner: "claude"
            }
          }),
          createElement("button", {
            className: "btn governance-action-btn convergence-assimilation-work-order-run-btn",
            text: "Queue Codex Run",
            attrs: { type: "button" },
            dataset: {
              convergenceAssimilationWorkOrderRunPairId: item.pairId || "",
              convergenceAssimilationWorkOrderRunRunner: "codex"
            }
          }),
          createElement("button", {
            className: "btn governance-action-btn convergence-assimilation-work-order-run-btn",
            text: "Queue Claude Run",
            attrs: { type: "button" },
            dataset: {
              convergenceAssimilationWorkOrderRunPairId: item.pairId || "",
              convergenceAssimilationWorkOrderRunRunner: "claude"
            }
          })
        ])
      ]);
    })
  ] : [];
  const convergenceReviewLedgerEntries = convergenceReviewLedger ? [
    createElement("div", {
      className: "governance-gap-card convergence-review-ledger-summary-card",
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
            text: "Convergence review ledger",
            style: {
              color: "var(--text)",
              fontWeight: "900",
              fontSize: "1.02rem"
            }
          }),
          createElement("div", {
            text: "Portfolio-level view of auto-detected overlaps, operator-contributed proposals, and hidden Not Related decisions.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.86rem",
              lineHeight: "1.45",
              marginTop: "0.25rem"
            }
          })
        ]),
        createTag(`${convergenceReviewSummary.total || 0} pair(s)`, {
          background: "var(--bg)",
          border: "1px solid var(--primary)",
          color: "var(--primary)"
        })
      ]),
      createElement("div", {
        className: "tags"
      }, [
        createTag(`${convergenceReviewSummary.unreviewed || 0} unreviewed`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceReviewSummary.unreviewed || 0) ? "var(--warning)" : "var(--text-muted)"
        }),
        createTag(`${convergenceReviewSummary.confirmedOverlap || 0} confirmed`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--success)"
        }),
        createTag(`${convergenceReviewSummary.mergeCandidate || 0} merge`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--success)"
        }),
        createTag(`${convergenceReviewSummary.notRelated || 0} not related`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceReviewSummary.notRelated || 0) ? "var(--danger)" : "var(--text-muted)"
        })
      ]),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-review-ledger-copy-btn",
          text: "Copy Active",
          attrs: { type: "button" },
          dataset: { convergenceReviewLedgerCopy: "active" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-review-ledger-copy-btn",
          text: "Copy Not Related",
          attrs: { type: "button" },
          dataset: { convergenceReviewLedgerCopy: "not-related" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-review-ledger-copy-btn",
          text: "Copy All",
          attrs: { type: "button" },
          dataset: { convergenceReviewLedgerCopy: "all" }
        })
      ])
    ]),
    ...convergenceReviewCandidates.slice(0, 24).map((candidate) => {
      const candidateReasons = Array.isArray(candidate.reasons) ? candidate.reasons : [];
      const leftLabel = candidate.leftLabel || candidate.leftName || candidate.leftId;
      const rightLabel = candidate.rightLabel || candidate.rightName || candidate.rightId;
      const statusColor = candidate.reviewStatus === "not-related"
        ? "var(--danger)"
        : candidate.reviewStatus === "confirmed-overlap" || candidate.reviewStatus === "merge-candidate"
          ? "var(--success)"
          : "var(--warning)";
      return createElement("div", {
        className: "governance-gap-card convergence-review-ledger-item-card",
        dataset: candidate.leftId ? { openAppId: encodeAppId(candidate.leftId) } : undefined,
        title: candidate.leftId ? "Open left project workbench" : undefined,
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
            gap: "0.75rem",
            alignItems: "flex-start"
          }
        }, [
          createElement("div", {}, [
            createElement("div", {
              text: `${leftLabel} -> ${rightLabel}`,
              style: {
                color: "var(--text)",
                fontWeight: "900",
                fontSize: "0.96rem"
              }
            }),
            createElement("div", {
              text: candidateReasons.length ? candidateReasons.join(" | ") : "No reasons recorded.",
              style: {
                color: "var(--text-muted)",
                fontSize: "0.84rem",
                lineHeight: "1.45",
                marginTop: "0.25rem"
              }
            })
          ]),
          createTag(`${candidate.score}%`, {
            background: "var(--bg)",
            border: "1px solid var(--primary)",
            color: "var(--primary)"
          })
        ]),
        createElement("div", {
          className: "tags"
        }, [
          createTag((candidate.reviewStatus || "unreviewed").replaceAll("-", " "), {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: statusColor
          }),
          candidate.operatorProposed
            ? createTag("operator contributed", {
                background: "var(--bg)",
                border: "1px solid var(--border)",
                color: "var(--primary)"
              })
            : createTag("auto detected", {
                background: "var(--bg)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)"
              }),
          candidate.reviewedAt
            ? createTag(`reviewed ${new Date(candidate.reviewedAt).toLocaleString()}`, {
                background: "var(--bg)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)"
              })
            : null
        ]),
        candidate.generatedInsight
          ? createElement("div", {
              text: `AI insight: ${candidate.generatedInsight}`,
              style: {
                color: "var(--text-muted)",
                fontSize: "0.84rem",
                lineHeight: "1.45"
              }
            })
          : null,
        candidate.reviewNote
          ? createElement("div", {
              text: candidate.reviewNote,
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
          candidate.reviewStatus !== "not-related" ? createElement("button", {
            className: "btn governance-action-btn convergence-review-task-btn",
            text: "Track Task",
            attrs: { type: "button" },
            dataset: { convergenceReviewTaskPairId: candidate.pairId || "" }
          }) : null,
          createElement("button", {
            className: "btn governance-action-btn convergence-due-diligence-pack-copy-btn",
            text: "Copy Pack",
            attrs: { type: "button" },
            dataset: { convergenceDueDiligencePairId: candidate.pairId || "" }
          }),
          createElement("button", {
            className: "btn governance-action-btn convergence-assimilation-blueprint-copy-btn",
            text: "Copy Blueprint",
            attrs: { type: "button" },
            dataset: { convergenceAssimilationBlueprintPairId: candidate.pairId || "" }
          }),
          createElement("button", {
            className: "btn governance-action-btn convergence-assimilation-work-order-draft-btn",
            text: "Copy Codex Draft",
            attrs: { type: "button" },
            dataset: {
              convergenceAssimilationWorkOrderPairId: candidate.pairId || "",
              convergenceAssimilationWorkOrderRunner: "codex"
            }
          }),
          createElement("button", {
            className: "btn governance-action-btn convergence-assimilation-work-order-draft-btn",
            text: "Copy Claude Draft",
            attrs: { type: "button" },
            dataset: {
              convergenceAssimilationWorkOrderPairId: candidate.pairId || "",
              convergenceAssimilationWorkOrderRunner: "claude"
            }
          }),
          createElement("button", {
            className: "btn governance-action-btn convergence-assimilation-work-order-run-btn",
            text: "Queue Codex Run",
            attrs: { type: "button" },
            dataset: {
              convergenceAssimilationWorkOrderRunPairId: candidate.pairId || "",
              convergenceAssimilationWorkOrderRunRunner: "codex"
            }
          }),
          createElement("button", {
            className: "btn governance-action-btn convergence-assimilation-work-order-run-btn",
            text: "Queue Claude Run",
            attrs: { type: "button" },
            dataset: {
              convergenceAssimilationWorkOrderRunPairId: candidate.pairId || "",
              convergenceAssimilationWorkOrderRunRunner: "claude"
            }
          }),
          candidate.leftId ? createElement("button", {
            className: "btn governance-action-btn",
            text: "Open Left",
            attrs: { type: "button" },
            dataset: { openAppId: encodeAppId(candidate.leftId) }
          }) : null,
          candidate.rightId ? createElement("button", {
            className: "btn governance-action-btn",
            text: "Open Right",
            attrs: { type: "button" },
            dataset: { openAppId: encodeAppId(candidate.rightId) }
          }) : null
        ])
      ]);
    })
  ] : [];
  const convergenceAssimilationRunLedger = governance.convergenceAssimilationRunLedger || null;
  const convergenceAssimilationRunSummary = convergenceAssimilationRunLedger?.summary || {
    total: 0,
    visible: 0,
    open: 0,
    closed: 0,
    active: 0,
    archived: 0,
    codex: 0,
    claude: 0,
    pairCount: 0
  };
  const convergenceAssimilationRunEntries = convergenceAssimilationRunLedger ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-run-ledger-summary-card",
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
            text: "Convergence assimilation run ledger",
            style: {
              color: "var(--text)",
              fontWeight: "900",
              fontSize: "1.02rem"
            }
          }),
          createElement("div", {
            text: "Agent Work Order runs queued from convergence assimilation drafts.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.86rem",
              lineHeight: "1.45",
              marginTop: "0.25rem"
            }
          })
        ]),
        createTag(`${convergenceAssimilationRunSummary.visible || 0} visible`, {
          background: "var(--bg)",
          border: "1px solid var(--primary)",
          color: "var(--primary)"
        })
      ]),
      createElement("div", { className: "tags" }, [
        createTag(`${convergenceAssimilationRunSummary.open || 0} open`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceAssimilationRunSummary.open || 0) ? "var(--warning)" : "var(--text-muted)"
        }),
        createTag(`${convergenceAssimilationRunSummary.closed || 0} closed`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceAssimilationRunSummary.closed || 0) ? "var(--success)" : "var(--text-muted)"
        }),
        createTag(`${convergenceAssimilationRunSummary.codex || 0} codex`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        createTag(`${convergenceAssimilationRunSummary.claude || 0} claude`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        })
      ]),
      createElement("div", { className: "governance-actions" }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-run-ledger-copy-btn",
          text: "Copy All Runs",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunLedgerCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-run-ledger-copy-btn",
          text: "Copy Open Runs",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunLedgerCopy: "open" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-run-ledger-copy-btn",
          text: "Copy Closed Runs",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunLedgerCopy: "closed" }
        })
      ])
    ]),
    ...(convergenceAssimilationRunLedger.runs || []).slice(0, 16).map((run) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-run-ledger-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.55rem"
      }
    }, [
      createElement("div", {
        text: run.title || "Convergence assimilation run",
        style: {
          color: "var(--text)",
          fontWeight: "900",
          fontSize: "0.96rem"
        }
      }),
      createElement("div", {
        text: run.objective || "No objective recorded.",
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", { className: "tags" }, [
        createTag(run.status || "queued", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: ["passed", "done", "resolved"].includes(run.status || "") ? "var(--success)" : "var(--warning)"
        }),
        createTag(run.convergenceAssimilationRunner || "runner", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        createTag(run.convergencePairId || "pair", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        run.convergenceAssimilationResultStatus ? createTag(`result: ${run.convergenceAssimilationResultStatus}`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: run.convergenceAssimilationResultStatus === "passed" ? "var(--success)" : "var(--warning)"
        }) : null,
        run.convergenceAssimilationResultAt ? createTag(`result ${new Date(run.convergenceAssimilationResultAt).toLocaleString()}`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }) : null
      ]),
      run.convergenceAssimilationResultSummary ? createElement("div", {
        text: `Latest result: ${run.convergenceAssimilationResultSummary}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.82rem",
          lineHeight: "1.45"
        }
      }) : null,
      createElement("div", { className: "governance-actions" }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-run-trace-copy-btn",
          text: "Copy Trace Pack",
          attrs: run.id ? { type: "button" } : { type: "button", disabled: "disabled", "aria-disabled": "true" },
          dataset: { convergenceAssimilationRunTraceId: run.id || "" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-run-result-btn",
          text: "Record Result",
          attrs: run.id ? { type: "button" } : { type: "button", disabled: "disabled", "aria-disabled": "true" },
          dataset: { convergenceAssimilationRunResultId: run.id || "" }
        })
      ])
    ]))
  ] : [];
  const convergenceAssimilationResultLedger = governance.convergenceAssimilationResultLedger || null;
  const convergenceAssimilationResultSummary = convergenceAssimilationResultLedger?.summary || {
    total: 0,
    visible: 0,
    passed: 0,
    failed: 0,
    blocked: 0,
    needsReview: 0,
    cancelled: 0,
    codex: 0,
    claude: 0,
    pairCount: 0
  };
  const convergenceAssimilationResultEntries = convergenceAssimilationResultLedger ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-result-ledger-summary-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem"
      }
    }, [
      createElement("div", {
        text: "Convergence assimilation result ledger",
        style: {
          color: "var(--text)",
          fontWeight: "900",
          fontSize: "1.02rem"
        }
      }),
      createElement("div", {
        text: `${convergenceAssimilationResultSummary.visible || 0} visible / ${convergenceAssimilationResultSummary.total || 0} total result(s). Copy non-secret runner outcomes for review, checkpoints, or follow-up build planning.`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.86rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", { className: "tags" }, [
        createTag(`${convergenceAssimilationResultSummary.passed || 0} passed`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceAssimilationResultSummary.passed || 0) ? "var(--success)" : "var(--text-muted)"
        }),
        createTag(`${convergenceAssimilationResultSummary.failed || 0} failed`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceAssimilationResultSummary.failed || 0) ? "var(--danger)" : "var(--text-muted)"
        }),
        createTag(`${convergenceAssimilationResultSummary.blocked || 0} blocked`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceAssimilationResultSummary.blocked || 0) ? "var(--warning)" : "var(--text-muted)"
        }),
        createTag(`${convergenceAssimilationResultSummary.needsReview || 0} review`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceAssimilationResultSummary.needsReview || 0) ? "var(--warning)" : "var(--text-muted)"
        })
      ]),
      createElement("div", { className: "governance-actions" }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-result-ledger-copy-btn",
          text: "Copy Results",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationResultLedgerCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-result-ledger-copy-btn",
          text: "Copy Passed",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationResultLedgerCopy: "passed" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-result-ledger-copy-btn",
          text: "Copy Blocked",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationResultLedgerCopy: "blocked" }
        })
      ])
    ]),
    ...(convergenceAssimilationResultLedger.results || []).slice(0, 16).map((result) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-result-ledger-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.55rem"
      }
    }, [
      createElement("div", {
        text: `${result.projectName || result.projectId || "Convergence run"} result`,
        style: {
          color: "var(--text)",
          fontWeight: "900",
          fontSize: "0.96rem"
        }
      }),
      createElement("div", {
        text: result.summary || "No summary recorded.",
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", { className: "tags" }, [
        createTag(result.status || "needs-review", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: result.status === "passed" ? "var(--success)" : result.status === "failed" ? "var(--danger)" : "var(--warning)"
        }),
        createTag(result.runner || "runner", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        createTag(result.pairId || "pair", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        })
      ]),
      result.validationSummary ? createElement("div", {
        text: `Validation: ${result.validationSummary}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.82rem",
          lineHeight: "1.45"
        }
      }) : null,
      createElement("div", { className: "governance-actions" }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-result-checkpoint-btn",
          text: "Confirm",
          attrs: result.id ? { type: "button" } : { type: "button", disabled: "disabled", "aria-disabled": "true" },
          dataset: {
            convergenceAssimilationResultCheckpointId: result.id || "",
            convergenceAssimilationResultCheckpointDecision: "confirmed"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-result-checkpoint-btn",
          text: "Defer",
          attrs: result.id ? { type: "button" } : { type: "button", disabled: "disabled", "aria-disabled": "true" },
          dataset: {
            convergenceAssimilationResultCheckpointId: result.id || "",
            convergenceAssimilationResultCheckpointDecision: "deferred"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-result-checkpoint-btn",
          text: "Escalate",
          attrs: result.id ? { type: "button" } : { type: "button", disabled: "disabled", "aria-disabled": "true" },
          dataset: {
            convergenceAssimilationResultCheckpointId: result.id || "",
            convergenceAssimilationResultCheckpointDecision: "escalated"
          }
        })
      ])
    ]))
  ] : [];
  const convergenceAssimilationResultCheckpointLedger = governance.convergenceAssimilationResultCheckpointLedger || null;
  const convergenceAssimilationResultCheckpointSummary = convergenceAssimilationResultCheckpointLedger?.summary || {
    total: 0,
    visible: 0,
    open: 0,
    closed: 0,
    confirmed: 0,
    deferred: 0,
    escalated: 0,
    openEscalated: 0
  };
  const convergenceAssimilationResultCheckpointEntries = convergenceAssimilationResultCheckpointLedger ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-result-checkpoint-ledger-summary-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
      }
    }, [
      createElement("div", {
        text: "Convergence assimilation result checkpoint ledger",
        style: {
          color: "var(--text)",
          fontWeight: "900"
        }
      }),
      createElement("div", {
        text: `${convergenceAssimilationResultCheckpointSummary.open || 0} open / ${convergenceAssimilationResultCheckpointSummary.total || 0} checkpoint(s). Export operator decisions on captured runner results.`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.86rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", { className: "tags" }, [
        createTag(`${convergenceAssimilationResultCheckpointSummary.confirmed || 0} confirmed`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceAssimilationResultCheckpointSummary.confirmed || 0) ? "var(--success)" : "var(--text-muted)"
        }),
        createTag(`${convergenceAssimilationResultCheckpointSummary.deferred || 0} deferred`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceAssimilationResultCheckpointSummary.deferred || 0) ? "var(--warning)" : "var(--text-muted)"
        }),
        createTag(`${convergenceAssimilationResultCheckpointSummary.escalated || 0} escalated`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceAssimilationResultCheckpointSummary.escalated || 0) ? "var(--danger)" : "var(--text-muted)"
        })
      ]),
      createElement("div", { className: "governance-actions" }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-result-checkpoint-ledger-copy-btn",
          text: "Copy All",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationResultCheckpointLedgerCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-result-checkpoint-ledger-copy-btn",
          text: "Copy Open",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationResultCheckpointLedgerCopy: "open" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-result-checkpoint-ledger-copy-btn",
          text: "Copy Closed",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationResultCheckpointLedgerCopy: "closed" }
        })
      ])
    ]),
    ...(convergenceAssimilationResultCheckpointLedger.items || []).slice(0, 12).map((item) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-result-checkpoint-ledger-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.55rem"
      }
    }, [
      createElement("div", {
        text: item.title || "Convergence assimilation result checkpoint",
        style: {
          color: "var(--text)",
          fontWeight: "900",
          fontSize: "0.95rem"
        }
      }),
      createElement("div", { className: "tags" }, [
        createTag(item.convergenceAssimilationResultCheckpointDecision || "deferred", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: item.convergenceAssimilationResultCheckpointDecision === "confirmed" ? "var(--success)" : item.convergenceAssimilationResultCheckpointDecision === "escalated" ? "var(--danger)" : "var(--warning)"
        }),
        createTag(item.status || "open", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: ["resolved", "done", "closed"].includes(item.status || "") ? "var(--success)" : "var(--warning)"
        }),
        createTag(item.convergenceAssimilationRunResultId || "result", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        })
      ]),
      item.convergenceAssimilationResultCheckpointNote ? createElement("div", {
        text: item.convergenceAssimilationResultCheckpointNote,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.82rem",
          lineHeight: "1.45"
        }
      }) : null
    ]))
  ] : [];
  const convergenceAssimilationReadinessGate = governance.convergenceAssimilationReadinessGate || null;
  const convergenceAssimilationReadinessSummary = convergenceAssimilationReadinessGate?.summary || {};
  const convergenceAssimilationReadinessEntries = convergenceAssimilationReadinessGate ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-readiness-gate-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem"
      }
    }, [
      createElement("div", {
        text: "Convergence assimilation readiness gate",
        style: {
          color: "var(--text)",
          fontWeight: "900",
          fontSize: "1.02rem"
        }
      }),
      createElement("div", { className: "tags" }, [
        createTag(convergenceAssimilationReadinessGate.decision || "review", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: convergenceAssimilationReadinessGate.decision === "ready" ? "var(--success)" : convergenceAssimilationReadinessGate.decision === "hold" ? "var(--danger)" : "var(--warning)"
        }),
        createTag(`${convergenceAssimilationReadinessSummary.runCount || 0} runs`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        createTag(`${convergenceAssimilationReadinessSummary.resultCount || 0} results`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        createTag(`${convergenceAssimilationReadinessSummary.openCheckpointCount || 0} open checkpoints`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceAssimilationReadinessSummary.openCheckpointCount || 0) ? "var(--warning)" : "var(--text-muted)"
        })
      ]),
      createElement("div", {
        text: convergenceAssimilationReadinessGate.recommendedAction || "Review convergence assimilation readiness.",
        style: {
          color: "var(--text-muted)",
          fontSize: "0.86rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", { className: "governance-actions" }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-readiness-gate-copy-btn",
          text: "Copy Gate",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationReadinessGateCopy: "true" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-cli-contract-copy-btn",
          text: "Copy Codex Contract",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationCliContractRunner: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-cli-contract-copy-btn",
          text: "Copy Claude Contract",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationCliContractRunner: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-operator-playbook-copy-btn",
          text: "Copy Playbook",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationOperatorPlaybookCopy: "true" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-session-packet-copy-btn",
          text: "Copy Codex Packet",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationSessionPacketRunner: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-session-packet-copy-btn",
          text: "Copy Claude Packet",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationSessionPacketRunner: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-session-packet-save-btn",
          text: "Save Codex Packet",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationSessionPacketSaveRunner: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-session-packet-save-btn",
          text: "Save Claude Packet",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationSessionPacketSaveRunner: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-session-packet-drift-copy-btn",
          text: "Copy Codex Drift",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationSessionPacketDriftCopy: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-session-packet-drift-copy-btn",
          text: "Copy Claude Drift",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationSessionPacketDriftCopy: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-command-queue-copy-btn",
          text: "Copy Codex Queue",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerCommandQueueRunner: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-command-queue-copy-btn",
          text: "Copy Claude Queue",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerCommandQueueRunner: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-result-replay-copy-btn",
          text: "Copy Codex Replay",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerResultReplayRunner: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-result-replay-copy-btn",
          text: "Copy Claude Replay",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerResultReplayRunner: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launchpad-gate-copy-btn",
          text: "Copy Codex Launch Gate",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchpadGateRunner: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launchpad-gate-copy-btn",
          text: "Copy Claude Launch Gate",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchpadGateRunner: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launchpad-gate-save-btn",
          text: "Save Codex Launch Gate",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchpadGateSaveRunner: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launchpad-gate-save-btn",
          text: "Save Claude Launch Gate",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchpadGateSaveRunner: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launchpad-gate-drift-copy-btn",
          text: "Copy Codex Launch Drift",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchpadGateDriftCopy: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launchpad-gate-drift-copy-btn",
          text: "Copy Claude Launch Drift",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchpadGateDriftCopy: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launchpad-gate-drift-checkpoint-ledger-copy-btn",
          text: "Copy Launch Checkpoints",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedgerCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launchpad-gate-drift-checkpoint-ledger-copy-btn",
          text: "Copy Open Launch Checkpoints",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedgerCopy: "open" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-authorization-pack-copy-btn",
          text: "Copy Codex Launch Pack",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchAuthorizationPackRunner: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-authorization-pack-copy-btn",
          text: "Copy Claude Launch Pack",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchAuthorizationPackRunner: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-authorization-pack-save-btn",
          text: "Save Codex Launch Pack",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchAuthorizationPackSaveRunner: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-authorization-pack-save-btn",
          text: "Save Claude Launch Pack",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchAuthorizationPackSaveRunner: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-authorization-pack-drift-copy-btn",
          text: "Copy Codex Launch Pack Drift",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchAuthorizationPackDriftCopy: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-authorization-pack-drift-copy-btn",
          text: "Copy Claude Launch Pack Drift",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchAuthorizationPackDriftCopy: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-authorization-pack-drift-checkpoint-ledger-copy-btn",
          text: "Copy Launch Pack Checkpoints",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedgerCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-authorization-pack-drift-checkpoint-ledger-copy-btn",
          text: "Copy Open Launch Pack Checkpoints",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedgerCopy: "open" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-control-board-copy-btn",
          text: "Copy Codex Launch Board",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchControlBoardRunner: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-control-board-copy-btn",
          text: "Copy Claude Launch Board",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchControlBoardRunner: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-control-board-save-btn",
          text: "Save Codex Launch Board",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchControlBoardSaveRunner: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-control-board-save-btn",
          text: "Save Claude Launch Board",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchControlBoardSaveRunner: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-control-board-drift-copy-btn",
          text: "Copy Codex Launch Board Drift",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchControlBoardDriftCopy: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-control-board-drift-copy-btn",
          text: "Copy Claude Launch Board Drift",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchControlBoardDriftCopy: "claude" }
        })
      ])
    ]),
    ...(convergenceAssimilationReadinessGate.reasons || []).slice(0, 8).map((reason) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-readiness-reason-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem"
      }
    }, [
      createElement("div", {
        text: reason.message || reason.code || "Readiness review required.",
        style: {
          color: "var(--text)",
          fontWeight: "800",
          fontSize: "0.92rem"
        }
      }),
      createTag(reason.severity || "review", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: reason.severity === "hold" ? "var(--danger)" : "var(--warning)"
      })
    ]))
  ] : [];
  const convergenceAssimilationSessionPacketSnapshotEntries = (governance.convergenceAssimilationSessionPacketSnapshots || []).map((snapshot) => createElement("div", {
    className: "governance-gap-card convergence-assimilation-session-packet-snapshot-card",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.65rem"
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
          text: snapshot.title || "Convergence Assimilation Session Packet",
          style: {
            color: "var(--text)",
            fontWeight: "850"
          }
        }),
        createElement("div", {
          text: `${new Date(snapshot.createdAt).toLocaleString()} | ${snapshot.runner || "codex"} | ${snapshot.protocolVersion || "session-packet"}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            marginTop: "0.28rem"
          }
        })
      ]),
      createTag(snapshot.readinessDecision || "review", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: snapshot.readinessDecision === "ready" ? "var(--success)" : snapshot.readinessDecision === "hold" ? "var(--danger)" : "var(--warning)"
      })
    ]),
    createElement("div", {
      text: `${snapshot.runCount || 0} run(s) | ${snapshot.resultCount || 0} result(s) | ${snapshot.checkpointCount || 0} checkpoint(s) | ${snapshot.recommendedAction || "Review this session packet before execution."}`,
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
        className: "btn governance-action-btn convergence-assimilation-session-packet-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: { convergenceAssimilationSessionPacketSnapshotId: snapshot.id }
      }),
      createElement("button", {
        className: "btn governance-action-btn convergence-assimilation-session-packet-snapshot-drift-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: { convergenceAssimilationSessionPacketSnapshotDriftId: snapshot.id }
      })
    ])
  ]));
  const convergenceAssimilationRunnerLaunchpadGateSnapshotEntries = (governance.convergenceAssimilationRunnerLaunchpadGateSnapshots || []).map((snapshot) => createElement("div", {
    className: "governance-gap-card convergence-assimilation-runner-launchpad-gate-snapshot-card",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.65rem"
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
          text: snapshot.title || "Convergence Assimilation Runner Launchpad Gate",
          style: {
            color: "var(--text)",
            fontWeight: "850"
          }
        }),
        createElement("div", {
          text: `${new Date(snapshot.createdAt).toLocaleString()} | ${snapshot.runner || "codex"} | ${snapshot.protocolVersion || "launchpad-gate"}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            marginTop: "0.28rem"
          }
        })
      ]),
      createTag(snapshot.decision || "review", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: snapshot.decision === "ready" ? "var(--success)" : snapshot.decision === "hold" ? "var(--danger)" : "var(--warning)"
      })
    ]),
    createElement("div", {
      text: `${snapshot.reasonCount || 0} reason(s) | readiness ${snapshot.readinessDecision || "review"} | packet drift ${snapshot.packetDriftSeverity || "missing-snapshot"} (${snapshot.packetDriftScore || 0}) | ${snapshot.openDriftCheckpointCount || 0} open drift checkpoint(s)`,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.84rem",
        lineHeight: "1.45"
      }
    }),
    createElement("div", {
      text: snapshot.recommendedAction || "Review this launchpad gate before runner execution.",
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
        className: "btn governance-action-btn convergence-assimilation-runner-launchpad-gate-snapshot-copy-btn",
        text: "Copy Launch Gate",
        attrs: { type: "button" },
        dataset: { convergenceAssimilationRunnerLaunchpadGateSnapshotId: snapshot.id }
      }),
      createElement("button", {
        className: "btn governance-action-btn convergence-assimilation-runner-launchpad-gate-snapshot-drift-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: { convergenceAssimilationRunnerLaunchpadGateSnapshotDriftId: snapshot.id }
      })
    ])
  ]));
  const convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotEntries = (governance.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshots || []).map((snapshot) => createElement("div", {
    className: "governance-gap-card convergence-assimilation-runner-launch-authorization-pack-snapshot-card",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.65rem"
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
          text: snapshot.title || "Convergence Assimilation Runner Launch Authorization Pack",
          style: {
            color: "var(--text)",
            fontWeight: "850"
          }
        }),
        createElement("div", {
          text: `${new Date(snapshot.createdAt).toLocaleString()} | ${snapshot.runner || "codex"} | ${snapshot.protocolVersion || "launch-authorization-pack"}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            marginTop: "0.28rem"
          }
        })
      ]),
      createTag(snapshot.authorizationStatus || snapshot.decision || "review-required", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: snapshot.decision === "ready" ? "var(--success)" : snapshot.decision === "hold" ? "var(--danger)" : "var(--warning)"
      })
    ]),
    createElement("div", {
      text: `launch ${snapshot.launchpadDecision || "review"} | readiness ${snapshot.readinessDecision || "review"} | launch drift ${snapshot.launchpadSnapshotDriftSeverity || "missing-snapshot"} (${snapshot.launchpadSnapshotDriftScore || 0}) | ${snapshot.openLaunchpadDriftCheckpointCount || 0} open checkpoint(s)`,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.84rem",
        lineHeight: "1.45"
      }
    }),
    createElement("div", {
      text: snapshot.recommendedAction || "Review this launch authorization pack before runner execution.",
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
        className: "btn governance-action-btn convergence-assimilation-runner-launch-authorization-pack-snapshot-copy-btn",
        text: "Copy Launch Pack",
        attrs: { type: "button" },
        dataset: { convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotId: snapshot.id }
      }),
      createElement("button", {
        className: "btn governance-action-btn convergence-assimilation-runner-launch-authorization-pack-snapshot-drift-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: { convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDriftId: snapshot.id }
      })
    ])
  ]));
  const convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff = governance.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff || null;
  const convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiffEntries = convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-authorization-pack-snapshot-drift-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
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
            text: convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.hasSnapshot ? (convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.snapshotTitle || "Latest launch authorization pack snapshot") : "No launch authorization pack snapshot",
            style: {
              color: "var(--text)",
              fontWeight: "850"
            }
          }),
          createElement("div", {
            text: convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.recommendedAction || "Save a launch authorization pack snapshot before comparing drift.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.28rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.driftSeverity || "missing-snapshot", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.driftSeverity === "high" ? "var(--danger)" : convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.driftSeverity === "none" ? "var(--success)" : "var(--warning)"
        })
      ]),
      createElement("div", {
        text: `${convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.driftScore || 0} drift score | ${(convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.driftItems || []).length} drift item(s) | ${convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.runner || "runner unset"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      })
    ]),
    ...(convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.driftItems || []).slice(0, 8).map((item) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-authorization-pack-snapshot-drift-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem"
      }
    }, [
      createElement("div", {
        text: item.label || item.field || "Launch authorization pack drift",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: `${item.before ?? "missing"} -> ${item.current ?? "missing"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      item.checkpointDecision ? createTag(`${item.checkpointDecision} / ${item.checkpointStatus || "open"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.checkpointDecision === "confirmed" ? "var(--success)" : item.checkpointDecision === "escalated" ? "var(--danger)" : "var(--warning)"
      }) : null,
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-authorization-pack-drift-checkpoint-btn",
          text: "Confirm",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchAuthorizationPackDriftSnapshotId: convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchAuthorizationPackDriftRunner: convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.runner || "codex",
            convergenceAssimilationRunnerLaunchAuthorizationPackDriftField: item.field || "",
            convergenceAssimilationRunnerLaunchAuthorizationPackDriftDecision: "confirmed"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-authorization-pack-drift-checkpoint-btn",
          text: "Defer",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchAuthorizationPackDriftSnapshotId: convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchAuthorizationPackDriftRunner: convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.runner || "codex",
            convergenceAssimilationRunnerLaunchAuthorizationPackDriftField: item.field || "",
            convergenceAssimilationRunnerLaunchAuthorizationPackDriftDecision: "deferred"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-authorization-pack-drift-checkpoint-btn",
          text: "Escalate",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchAuthorizationPackDriftSnapshotId: convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchAuthorizationPackDriftRunner: convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiff.runner || "codex",
            convergenceAssimilationRunnerLaunchAuthorizationPackDriftField: item.field || "",
            convergenceAssimilationRunnerLaunchAuthorizationPackDriftDecision: "escalated"
          }
        })
      ])
    ].filter(Boolean)))
  ] : [];
  const convergenceAssimilationRunnerLaunchpadGateSnapshotDiff = governance.convergenceAssimilationRunnerLaunchpadGateSnapshotDiff || null;
  const convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger = governance.convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger || null;
  const convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointSummary = convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger?.summary || {
    total: 0,
    visible: 0,
    open: 0,
    closed: 0,
    confirmed: 0,
    deferred: 0,
    escalated: 0
  };
  const convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedgerEntries = convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-authorization-pack-drift-checkpoint-ledger-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
      }
    }, [
      createElement("div", {
        text: "Launch authorization pack drift checkpoint ledger",
        style: {
          color: "var(--text)",
          fontWeight: "850"
        }
      }),
      createElement("div", {
        text: `${convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointSummary.visible || 0} visible | ${convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointSummary.open || 0} open | ${convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointSummary.closed || 0} closed | ${convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointSummary.escalated || 0} escalated`,
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
          className: "btn governance-action-btn convergence-assimilation-runner-launch-authorization-pack-drift-checkpoint-ledger-copy-btn",
          text: "Copy All",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedgerCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-authorization-pack-drift-checkpoint-ledger-copy-btn",
          text: "Copy Open",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedgerCopy: "open" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-authorization-pack-drift-checkpoint-ledger-copy-btn",
          text: "Copy Closed",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedgerCopy: "closed" }
        })
      ])
    ]),
    ...(convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedger.items || []).slice(0, 8).map((item) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-authorization-pack-drift-checkpoint-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem"
      }
    }, [
      createElement("div", {
        text: item.title || item.convergenceAssimilationRunnerLaunchAuthorizationPackDriftLabel || "Launch authorization pack drift checkpoint",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: `${item.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotTitle || item.convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotId || "Snapshot not recorded"} | ${item.convergenceAssimilationRunnerLaunchAuthorizationPackRunner || "codex"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        text: `${item.convergenceAssimilationRunnerLaunchAuthorizationPackDriftBefore || "missing"} -> ${item.convergenceAssimilationRunnerLaunchAuthorizationPackDriftCurrent || "missing"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createTag(`${item.convergenceAssimilationRunnerLaunchAuthorizationPackDriftDecision || "deferred"} / ${item.status || "open"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.convergenceAssimilationRunnerLaunchAuthorizationPackDriftDecision === "confirmed" ? "var(--success)" : item.convergenceAssimilationRunnerLaunchAuthorizationPackDriftDecision === "escalated" ? "var(--danger)" : "var(--warning)"
      })
    ]))
  ] : [];
  const convergenceAssimilationRunnerLaunchControlBoard = governance.convergenceAssimilationRunnerLaunchControlBoard || null;
  const convergenceAssimilationRunnerLaunchControlBoardEntries = convergenceAssimilationRunnerLaunchControlBoard ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-control-board-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
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
            text: `${convergenceAssimilationRunnerLaunchControlBoard.runner || "codex"} launch control board`,
            style: {
              color: "var(--text)",
              fontWeight: "850"
            }
          }),
          createElement("div", {
            text: convergenceAssimilationRunnerLaunchControlBoard.recommendedAction || "Resolve runner launch conditions before starting a CLI session.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.28rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(convergenceAssimilationRunnerLaunchControlBoard.launchStatus || "review-required", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: convergenceAssimilationRunnerLaunchControlBoard.launchDecision === "ready" ? "var(--success)" : convergenceAssimilationRunnerLaunchControlBoard.launchDecision === "hold" ? "var(--danger)" : "var(--warning)"
        })
      ]),
      createElement("div", {
        text: `${convergenceAssimilationRunnerLaunchControlBoard.openCheckpointCount || 0} open checkpoint(s) | ${convergenceAssimilationRunnerLaunchControlBoard.escalatedCheckpointCount || 0} escalated | ${convergenceAssimilationRunnerLaunchControlBoard.authorizationStatus || "review-required"}`,
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
          className: "btn governance-action-btn convergence-assimilation-runner-launch-control-board-copy-btn",
          text: "Copy Board",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchControlBoardRunner: convergenceAssimilationRunnerLaunchControlBoard.runner || "codex" }
        })
      ])
    ]),
    ...(convergenceAssimilationRunnerLaunchControlBoard.reasons || []).slice(0, 8).map((reason) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-control-board-reason-card",
      text: reason,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.86rem",
        lineHeight: "1.45"
      }
    }))
  ] : [];
  const convergenceAssimilationRunnerLaunchControlBoardSnapshotEntries = (governance.convergenceAssimilationRunnerLaunchControlBoardSnapshots || []).map((snapshot) => createElement("div", {
    className: "governance-gap-card convergence-assimilation-runner-launch-control-board-snapshot-card",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.65rem"
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
          text: snapshot.title || "Convergence Assimilation Runner Launch Control Board",
          style: {
            color: "var(--text)",
            fontWeight: "850"
          }
        }),
        createElement("div", {
          text: `${new Date(snapshot.createdAt).toLocaleString()} | ${snapshot.runner || "codex"} | ${snapshot.launchStatus || "review-required"}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            marginTop: "0.25rem"
          }
        })
      ]),
      createTag(snapshot.launchDecision || "review", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: snapshot.launchDecision === "ready" ? "var(--success)" : snapshot.launchDecision === "hold" ? "var(--danger)" : "var(--warning)"
      })
    ]),
    createElement("div", {
      text: `${snapshot.openCheckpointCount || 0} open checkpoint(s) | ${snapshot.escalatedCheckpointCount || 0} escalated | ${snapshot.authorizationStatus || "review-required"}`,
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
        className: "btn governance-action-btn convergence-assimilation-runner-launch-control-board-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: { convergenceAssimilationRunnerLaunchControlBoardSnapshotId: snapshot.id }
      }),
      createElement("button", {
        className: "btn governance-action-btn convergence-assimilation-runner-launch-control-board-snapshot-drift-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: { convergenceAssimilationRunnerLaunchControlBoardSnapshotDriftId: snapshot.id }
      })
    ])
  ]));
  const convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff = governance.convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff || null;
  const convergenceAssimilationRunnerLaunchControlBoardSnapshotDiffEntries = convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-control-board-snapshot-drift-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
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
            text: convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.hasSnapshot ? (convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.snapshotTitle || "Latest launch control board snapshot") : "No launch control board snapshot",
            style: {
              color: "var(--text)",
              fontWeight: "850"
            }
          }),
          createElement("div", {
            text: convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.recommendedAction || "Save a launch control board snapshot before comparing drift.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.28rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.driftSeverity || "missing-snapshot", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.driftSeverity === "high" ? "var(--danger)" : convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.driftSeverity === "none" ? "var(--success)" : "var(--warning)"
        })
      ]),
      createElement("div", {
        text: `${convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.driftScore || 0} drift score | ${(convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.driftItems || []).length} drift item(s) | ${convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.runner || "runner unset"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      })
    ]),
    ...(convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.driftItems || []).slice(0, 8).map((item) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-control-board-snapshot-drift-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem"
      }
    }, [
      createElement("div", {
        text: item.label || item.field || "Launch control board drift",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: `${item.before ?? "missing"} -> ${item.current ?? "missing"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      item.checkpointDecision ? createTag(`${item.checkpointDecision} / ${item.checkpointStatus || "open"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.checkpointDecision === "confirmed" ? "var(--success)" : item.checkpointDecision === "escalated" ? "var(--danger)" : "var(--warning)"
      }) : null,
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-control-board-drift-checkpoint-btn",
          text: "Confirm",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchControlBoardDriftSnapshotId: convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchControlBoardDriftRunner: convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.runner || "codex",
            convergenceAssimilationRunnerLaunchControlBoardDriftField: item.field || "",
            convergenceAssimilationRunnerLaunchControlBoardDriftDecision: "confirmed"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-control-board-drift-checkpoint-btn",
          text: "Defer",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchControlBoardDriftSnapshotId: convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchControlBoardDriftRunner: convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.runner || "codex",
            convergenceAssimilationRunnerLaunchControlBoardDriftField: item.field || "",
            convergenceAssimilationRunnerLaunchControlBoardDriftDecision: "deferred"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-control-board-drift-checkpoint-btn",
          text: "Escalate",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchControlBoardDriftSnapshotId: convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchControlBoardDriftRunner: convergenceAssimilationRunnerLaunchControlBoardSnapshotDiff.runner || "codex",
            convergenceAssimilationRunnerLaunchControlBoardDriftField: item.field || "",
            convergenceAssimilationRunnerLaunchControlBoardDriftDecision: "escalated"
          }
        })
      ])
    ].filter(Boolean)))
  ] : [];
  const convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointLedger = governance.convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointLedger || null;
  const convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointSummary = convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointLedger?.summary || {
    total: 0,
    visible: 0,
    open: 0,
    closed: 0,
    confirmed: 0,
    deferred: 0,
    escalated: 0
  };
  const convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointLedgerEntries = convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointLedger ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-control-board-drift-checkpoint-ledger-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
      }
    }, [
      createElement("div", {
        text: "Launch control board drift checkpoint ledger",
        style: {
          color: "var(--text)",
          fontWeight: "850"
        }
      }),
      createElement("div", {
        text: `${convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointSummary.visible || 0} visible | ${convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointSummary.open || 0} open | ${convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointSummary.closed || 0} closed | ${convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointSummary.escalated || 0} escalated`,
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
          className: "btn governance-action-btn convergence-assimilation-runner-launch-control-board-drift-checkpoint-ledger-copy-btn",
          text: "Copy All",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointLedgerCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-control-board-drift-checkpoint-ledger-copy-btn",
          text: "Copy Open",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointLedgerCopy: "open" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-control-board-drift-checkpoint-ledger-copy-btn",
          text: "Copy Closed",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointLedgerCopy: "closed" }
        })
      ])
    ]),
    ...(convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointLedger.items || []).slice(0, 8).map((item) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-control-board-drift-checkpoint-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem"
      }
    }, [
      createElement("div", {
        text: item.title || item.convergenceAssimilationRunnerLaunchControlBoardDriftLabel || "Launch control board drift checkpoint",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: `${item.convergenceAssimilationRunnerLaunchControlBoardSnapshotTitle || item.convergenceAssimilationRunnerLaunchControlBoardSnapshotId || "Snapshot not recorded"} | ${item.convergenceAssimilationRunnerLaunchControlBoardRunner || "codex"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        text: `${item.convergenceAssimilationRunnerLaunchControlBoardDriftBefore || "missing"} -> ${item.convergenceAssimilationRunnerLaunchControlBoardDriftCurrent || "missing"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createTag(`${item.convergenceAssimilationRunnerLaunchControlBoardDriftDecision || "deferred"} / ${item.status || "open"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.convergenceAssimilationRunnerLaunchControlBoardDriftDecision === "confirmed" ? "var(--success)" : item.convergenceAssimilationRunnerLaunchControlBoardDriftDecision === "escalated" ? "var(--danger)" : "var(--warning)"
      })
    ]))
  ] : [];
  const convergenceAssimilationRunnerLaunchExecutionPacket = governance.convergenceAssimilationRunnerLaunchExecutionPacket || null;
  const convergenceAssimilationRunnerLaunchExecutionPacketEntries = convergenceAssimilationRunnerLaunchExecutionPacket ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-execution-packet-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
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
            text: "Launch execution packet",
            style: {
              color: "var(--text)",
              fontWeight: "850"
            }
          }),
          createElement("div", {
            text: convergenceAssimilationRunnerLaunchExecutionPacket.recommendedAction || "Review the launch execution packet before runner start.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.28rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(convergenceAssimilationRunnerLaunchExecutionPacket.launchDecision || "review", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: convergenceAssimilationRunnerLaunchExecutionPacket.launchDecision === "ready" ? "var(--success)" : convergenceAssimilationRunnerLaunchExecutionPacket.launchDecision === "hold" ? "var(--danger)" : "var(--warning)"
        })
      ]),
      createElement("div", {
        text: `${convergenceAssimilationRunnerLaunchExecutionPacket.runner || "codex"} | ${convergenceAssimilationRunnerLaunchExecutionPacket.executionMode || "operator-supervised-review-packet"} | ${(convergenceAssimilationRunnerLaunchExecutionPacket.preflightChecks || []).length} preflight check(s)`,
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
          className: "btn governance-action-btn convergence-assimilation-runner-launch-execution-packet-copy-btn",
          text: "Copy Codex Packet",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchExecutionPacketRunner: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-execution-packet-copy-btn",
          text: "Copy Claude Packet",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchExecutionPacketRunner: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-execution-packet-save-btn",
          text: "Save Codex Snapshot",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchExecutionPacketSaveRunner: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-execution-packet-save-btn",
          text: "Save Claude Snapshot",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchExecutionPacketSaveRunner: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-execution-packet-drift-copy-btn",
          text: "Copy Latest Drift",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchExecutionPacketDriftCopy: convergenceAssimilationRunnerLaunchExecutionPacket.runner || "codex" }
        })
      ])
    ]),
    ...(convergenceAssimilationRunnerLaunchExecutionPacket.preflightChecks || []).slice(0, 8).map((item) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-execution-packet-preflight-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem"
      }
    }, [
      createElement("div", {
        text: item.title || item.id || "Launch preflight check",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: item.action || "Review before runner start.",
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createTag(item.status || "review", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.status === "ready" ? "var(--success)" : item.status === "blocked" || item.status === "hold" ? "var(--danger)" : "var(--warning)"
      })
    ]))
  ] : [];
  const convergenceAssimilationRunnerLaunchExecutionPacketSnapshotEntries = (governance.convergenceAssimilationRunnerLaunchExecutionPacketSnapshots || []).map((snapshot) => createElement("div", {
    className: "governance-gap-card convergence-assimilation-runner-launch-execution-packet-snapshot-card",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.5rem"
    }
  }, [
    createElement("div", {
      text: snapshot.title || "Convergence Assimilation Runner Launch Execution Packet",
      style: {
        color: "var(--text)",
        fontWeight: "800"
      }
    }),
    createElement("div", {
      text: `${snapshot.runner || "codex"} | ${snapshot.launchDecision || "review"} | ${snapshot.launchStatus || "review-required"} | ${snapshot.preflightCheckCount || 0} check(s) | ${snapshot.commandCount || 0} command(s)`,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.84rem",
        lineHeight: "1.45"
      }
    }),
    createElement("div", {
      text: snapshot.recommendedAction || "Review this launch execution packet before runner start.",
      style: {
        color: "var(--text-muted)",
        fontSize: "0.84rem",
        lineHeight: "1.45"
      }
    }),
    createElement("button", {
      className: "btn governance-action-btn convergence-assimilation-runner-launch-execution-packet-snapshot-copy-btn",
      text: "Copy Snapshot",
      attrs: { type: "button" },
      dataset: { convergenceAssimilationRunnerLaunchExecutionPacketSnapshotId: snapshot.id || "" }
    }),
    createElement("button", {
      className: "btn governance-action-btn convergence-assimilation-runner-launch-execution-packet-snapshot-drift-copy-btn",
      text: "Copy Drift",
      attrs: { type: "button" },
      dataset: { convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDriftId: snapshot.id || "" }
    })
  ]));
  const convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff = governance.convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff || null;
  const convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiffEntries = convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-execution-packet-snapshot-drift-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
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
            text: convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff.hasSnapshot ? (convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff.snapshotTitle || "Latest launch execution packet snapshot") : "No launch execution packet snapshot",
            style: {
              color: "var(--text)",
              fontWeight: "850"
            }
          }),
          createElement("div", {
            text: convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff.recommendedAction || "Save a launch execution packet snapshot before comparing drift.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.28rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff.driftSeverity || "missing-snapshot", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff.driftSeverity === "high" ? "var(--danger)" : convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff.driftSeverity === "none" ? "var(--success)" : "var(--warning)"
        })
      ]),
      createElement("div", {
        text: `${convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff.driftScore || 0} drift score | ${(convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff.driftItems || []).length} drift item(s) | ${convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff.runner || "runner unset"}`,
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
          className: "btn governance-action-btn convergence-assimilation-runner-launch-execution-packet-snapshot-refresh-btn",
          text: "Refresh Snapshot",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchExecutionPacketSnapshotRefreshId: convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchExecutionPacketSnapshotRefreshRunner: convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff.runner || "codex"
          }
        })
      ])
    ]),
    ...(convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff.driftItems || []).slice(0, 8).map((item) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-execution-packet-snapshot-drift-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem"
      }
    }, [
      createElement("div", {
        text: item.label || item.field || "Launch execution packet drift",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: `${item.before ?? "missing"} -> ${item.current ?? "missing"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      item.checkpointDecision ? createTag(`${item.checkpointDecision} / ${item.checkpointStatus || "open"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.checkpointDecision === "confirmed" ? "var(--success)" : item.checkpointDecision === "escalated" ? "var(--danger)" : "var(--warning)"
      }) : null,
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-execution-packet-drift-checkpoint-btn",
          text: "Confirm",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchExecutionPacketDriftSnapshotId: convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchExecutionPacketDriftRunner: convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff.runner || "codex",
            convergenceAssimilationRunnerLaunchExecutionPacketDriftField: item.field || "",
            convergenceAssimilationRunnerLaunchExecutionPacketDriftDecision: "confirmed"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-execution-packet-drift-checkpoint-btn",
          text: "Defer",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchExecutionPacketDriftSnapshotId: convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchExecutionPacketDriftRunner: convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff.runner || "codex",
            convergenceAssimilationRunnerLaunchExecutionPacketDriftField: item.field || "",
            convergenceAssimilationRunnerLaunchExecutionPacketDriftDecision: "deferred"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-execution-packet-drift-checkpoint-btn",
          text: "Escalate",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchExecutionPacketDriftSnapshotId: convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchExecutionPacketDriftRunner: convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiff.runner || "codex",
            convergenceAssimilationRunnerLaunchExecutionPacketDriftField: item.field || "",
            convergenceAssimilationRunnerLaunchExecutionPacketDriftDecision: "escalated"
          }
        })
      ])
    ]))
  ] : [];
  const convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointLedger = governance.convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointLedger || null;
  const convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointSummary = convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointLedger?.summary || {
    total: 0,
    visible: 0,
    open: 0,
    closed: 0,
    confirmed: 0,
    deferred: 0,
    escalated: 0
  };
  const convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointLedgerEntries = convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointLedger ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-execution-packet-drift-checkpoint-ledger-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
      }
    }, [
      createElement("div", {
        text: "Launch execution packet drift checkpoint ledger",
        style: {
          color: "var(--text)",
          fontWeight: "850"
        }
      }),
      createElement("div", {
        text: `${convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointSummary.visible || 0} visible | ${convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointSummary.open || 0} open | ${convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointSummary.closed || 0} closed | ${convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointSummary.escalated || 0} escalated`,
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
          className: "btn governance-action-btn convergence-assimilation-runner-launch-execution-packet-drift-checkpoint-ledger-copy-btn",
          text: "Copy All",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointLedgerCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-execution-packet-drift-checkpoint-ledger-copy-btn",
          text: "Copy Open",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointLedgerCopy: "open" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-execution-packet-drift-checkpoint-ledger-copy-btn",
          text: "Copy Closed",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointLedgerCopy: "closed" }
        })
      ])
    ]),
    ...(convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointLedger.items || []).slice(0, 8).map((item) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-execution-packet-drift-checkpoint-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem"
      }
    }, [
      createElement("div", {
        text: item.title || item.convergenceAssimilationRunnerLaunchExecutionPacketDriftLabel || "Launch execution packet drift checkpoint",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: `${item.convergenceAssimilationRunnerLaunchExecutionPacketSnapshotTitle || item.convergenceAssimilationRunnerLaunchExecutionPacketSnapshotId || "Snapshot not recorded"} | ${item.convergenceAssimilationRunnerLaunchExecutionPacketRunner || "codex"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        text: `${item.convergenceAssimilationRunnerLaunchExecutionPacketDriftBefore || "missing"} -> ${item.convergenceAssimilationRunnerLaunchExecutionPacketDriftCurrent || "missing"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createTag(`${item.convergenceAssimilationRunnerLaunchExecutionPacketDriftDecision || "deferred"} / ${item.status || "open"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.convergenceAssimilationRunnerLaunchExecutionPacketDriftDecision === "confirmed" ? "var(--success)" : item.convergenceAssimilationRunnerLaunchExecutionPacketDriftDecision === "escalated" ? "var(--danger)" : "var(--warning)"
      })
    ]))
  ] : [];
  const convergenceAssimilationRunnerLaunchStackStatus = governance.convergenceAssimilationRunnerLaunchStackStatus || null;
  const convergenceAssimilationRunnerLaunchStackSummary = convergenceAssimilationRunnerLaunchStackStatus?.summary || {
    total: 0,
    ready: 0,
    review: 0,
    hold: 0
  };
  const convergenceAssimilationRunnerLaunchStackRemediationPack = governance.convergenceAssimilationRunnerLaunchStackRemediationPack || null;
  const convergenceAssimilationRunnerLaunchStackRemediationPackSummary = convergenceAssimilationRunnerLaunchStackRemediationPack?.summary || {
    totalStages: 0,
    readyStages: 0,
    reviewStages: 0,
    holdStages: 0,
    nonReadyStages: 0,
    openTasks: 0,
    highPriorityTasks: 0,
    openCheckpoints: 0,
    openEscalatedCheckpoints: 0
  };
  const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraft = governance.convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraft || null;
  const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraftItems = convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraft?.workItems || [];
  const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedger = governance.convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedger || null;
  const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerSummary = convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedger?.summary || {
    total: 0,
    visible: 0,
    open: 0,
    closed: 0,
    active: 0,
    archived: 0,
    codex: 0,
    claude: 0,
    workItems: 0
  };
  const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerRuns = convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedger?.runs || [];
  const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedger = governance.convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedger || null;
  const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerSummary = convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedger?.summary || {
    total: 0,
    visible: 0,
    passed: 0,
    failed: 0,
    blocked: 0,
    needsReview: 0,
    cancelled: 0,
    codex: 0,
    claude: 0,
    workItems: 0
  };
  const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerResults = convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedger?.results || [];
  const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedger = governance.convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedger || null;
  const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSummary = convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedger?.summary || {
    total: 0,
    open: 0,
    closed: 0,
    visible: 0,
    codex: 0,
    claude: 0,
    failed: 0,
    blocked: 0,
    needsReview: 0,
    high: 0,
    medium: 0,
    low: 0,
    normal: 0
  };
  const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerItems = convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedger?.items || [];
  const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshots = governance.convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshots || [];
  const convergenceAssimilationRunnerLaunchStackActionTaskLedger = governance.convergenceAssimilationRunnerLaunchStackActionTaskLedger || null;
  const convergenceAssimilationRunnerLaunchStackActionTaskLedgerSummary = convergenceAssimilationRunnerLaunchStackActionTaskLedger?.summary || {
    total: 0,
    open: 0,
    closed: 0,
    visible: 0,
    codex: 0,
    claude: 0,
    high: 0,
    medium: 0,
    low: 0,
    normal: 0
  };
  const convergenceAssimilationRunnerLaunchStackStatusEntries = convergenceAssimilationRunnerLaunchStackStatus ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-status-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
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
            text: "Runner launch stack status",
            style: {
              color: "var(--text)",
              fontWeight: "850"
            }
          }),
          createElement("div", {
            text: convergenceAssimilationRunnerLaunchStackStatus.recommendedAction || "Review launch stack before runner start.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.28rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(convergenceAssimilationRunnerLaunchStackStatus.decision || "review", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: convergenceAssimilationRunnerLaunchStackStatus.decision === "ready" ? "var(--success)" : convergenceAssimilationRunnerLaunchStackStatus.decision === "hold" ? "var(--danger)" : "var(--warning)"
        })
      ]),
      createElement("div", {
        text: `${convergenceAssimilationRunnerLaunchStackStatus.runner || "codex"} | ${convergenceAssimilationRunnerLaunchStackSummary.ready || 0} ready | ${convergenceAssimilationRunnerLaunchStackSummary.review || 0} review | ${convergenceAssimilationRunnerLaunchStackSummary.hold || 0} hold`,
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
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-status-copy-btn",
          text: "Copy Codex Stack",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackStatusRunner: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-status-copy-btn",
          text: "Copy Claude Stack",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackStatusRunner: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-pack-copy-btn",
          text: "Copy Codex Remediation",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackRemediationPackRunner: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-pack-copy-btn",
          text: "Copy Claude Remediation",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackRemediationPackRunner: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-action-tasks-btn",
          text: "Track Codex Tasks",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackActionTasksRunner: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-action-tasks-btn",
          text: "Track Claude Tasks",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackActionTasksRunner: "claude" }
        })
      ])
    ]),
    ...(convergenceAssimilationRunnerLaunchStackStatus.stages || []).slice(0, 12).map((stage) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-stage-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem"
      }
    }, [
      createElement("div", {
        text: stage.title || stage.id || "Launch stack stage",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: stage.detail || "No detail recorded.",
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        text: stage.action || "Review before runner start.",
        style: {
          color: "var(--text-muted)",
          fontSize: "0.82rem",
          lineHeight: "1.45"
        }
      }),
      createTag(stage.status || "review", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: stage.status === "ready" ? "var(--success)" : stage.status === "hold" ? "var(--danger)" : "var(--warning)"
      }),
      stage.status !== "ready" ? createElement("button", {
        className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-stage-task-btn",
        text: "Track Stage",
        attrs: { type: "button" },
        dataset: {
          convergenceAssimilationRunnerLaunchStackStageTaskRunner: convergenceAssimilationRunnerLaunchStackStatus.runner || "codex",
          convergenceAssimilationRunnerLaunchStackStageTaskId: stage.id || ""
        }
      }) : null
    ]))
  ] : [];
  const convergenceAssimilationRunnerLaunchStackRemediationPackEntries = convergenceAssimilationRunnerLaunchStackRemediationPack ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-remediation-pack-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
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
            text: "Launch stack remediation pack",
            style: {
              color: "var(--text)",
              fontWeight: "850"
            }
          }),
          createElement("div", {
            text: convergenceAssimilationRunnerLaunchStackRemediationPack.recommendedAction || "Copy this non-secret pack into a supervised runner session before remediation.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.28rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(convergenceAssimilationRunnerLaunchStackRemediationPack.decision || "review", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: convergenceAssimilationRunnerLaunchStackRemediationPack.decision === "ready" ? "var(--success)" : convergenceAssimilationRunnerLaunchStackRemediationPack.decision === "hold" ? "var(--danger)" : "var(--warning)"
        })
      ]),
      createElement("div", {
        text: `${convergenceAssimilationRunnerLaunchStackRemediationPack.runner || "codex"} | ${convergenceAssimilationRunnerLaunchStackRemediationPackSummary.nonReadyStages || 0} non-ready stages | ${convergenceAssimilationRunnerLaunchStackRemediationPackSummary.openTasks || 0} open tasks | ${convergenceAssimilationRunnerLaunchStackRemediationPackSummary.openEscalatedCheckpoints || 0} escalated checkpoints`,
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
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-pack-copy-btn",
          text: "Copy Codex Pack",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackRemediationPackRunner: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-pack-copy-btn",
          text: "Copy Claude Pack",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackRemediationPackRunner: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-pack-snapshot-save-btn",
          text: "Save Pack Snapshot",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotRunner: convergenceAssimilationRunnerLaunchStackRemediationPack.runner || "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-pack-snapshot-drift-btn",
          text: "Copy Latest Drift",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDriftId: "latest",
            convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDriftRunner: convergenceAssimilationRunnerLaunchStackRemediationPack.runner || "codex"
          }
        })
      ])
    ]),
    ...(convergenceAssimilationRunnerLaunchStackRemediationPack.nonReadyStages || []).slice(0, 8).map((stage) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-remediation-stage-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.38rem"
      }
    }, [
      createElement("div", {
        text: stage.title || stage.id || "Launch stack remediation stage",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: stage.action || "Review before runner start.",
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createTag(stage.status || "review", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: stage.status === "hold" ? "var(--danger)" : "var(--warning)"
      })
    ]))
  ] : [];
  const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraftEntries = convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraft ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-remediation-work-order-draft-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
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
            text: "Launch stack remediation work-order draft",
            style: {
              color: "var(--text)",
              fontWeight: "850"
            }
          }),
          createElement("div", {
            text: convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraft.recommendedAction || "Copy this non-executing draft into a supervised Codex or Claude remediation session.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.28rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraft.draftDecision || "review", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraft.draftDecision === "ready" ? "var(--success)" : convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraft.draftDecision === "hold" ? "var(--danger)" : "var(--warning)"
        })
      ]),
      createElement("div", {
        text: `${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraft.runner || "codex"} | ${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraft.executionMode || "non-executing"} | ${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraftItems.length} work item(s)`,
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
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-draft-btn",
          text: "Copy Codex Draft",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraftRunner: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-draft-btn",
          text: "Copy Claude Draft",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraftRunner: "claude" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-run-btn",
          text: "Queue Codex Work-Order",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunRunner: "codex" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-run-btn",
          text: "Queue Claude Work-Order",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunRunner: "claude" }
        })
      ])
    ]),
    ...convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraftItems.slice(0, 8).map((item) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-remediation-work-order-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.38rem"
      }
    }, [
      createElement("div", {
        text: item.title || "Remediation work item",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: item.action || item.detail || "Review before runner handoff.",
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        className: "tags"
      }, [
        createTag(item.priority || "normal", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: item.priority === "high" ? "var(--danger)" : item.priority === "medium" ? "var(--warning)" : "var(--text-muted)"
        }),
        createTag(item.sourceType || "work-item", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--primary)"
        })
      ])
    ]))
  ] : [];
  const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerEntries = convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedger ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-remediation-work-order-run-ledger-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
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
            text: "Launch stack remediation work-order run ledger",
            style: {
              color: "var(--text)",
              fontWeight: "850"
            }
          }),
          createElement("div", {
            text: "Queued non-executing Codex and Claude remediation handoffs tracked as supervised agent work-order runs.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.28rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(`${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerSummary.visible || 0} visible`, {
          background: "var(--bg)",
          border: "1px solid var(--primary)",
          color: "var(--primary)"
        })
      ]),
      createElement("div", {
        className: "tags"
      }, [
        createTag(`${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerSummary.open || 0} open`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerSummary.open || 0) ? "var(--warning)" : "var(--text-muted)"
        }),
        createTag(`${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerSummary.closed || 0} closed`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--success)"
        }),
        createTag(`${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerSummary.codex || 0} codex`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--primary)"
        }),
        createTag(`${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerSummary.claude || 0} claude`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--primary)"
        }),
        createTag(`${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerSummary.workItems || 0} work items`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        })
      ]),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-run-ledger-copy-btn",
          text: "Copy All",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerStatus: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-run-ledger-copy-btn",
          text: "Copy Open",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerStatus: "open" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-run-ledger-copy-btn",
          text: "Copy Closed",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerStatus: "closed" }
        })
      ])
    ]),
    ...convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerRuns.slice(0, 8).map((run) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-remediation-work-order-run-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.38rem"
      }
    }, [
      createElement("div", {
        text: run.title || "Launch stack remediation work order",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: run.notes || run.objective || "No notes recorded.",
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        className: "tags"
      }, [
        createTag(run.status || "queued", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: ["done", "resolved", "closed", "cancelled", "archived", "passed", "failed"].includes(String(run.status || "").toLowerCase()) ? "var(--success)" : "var(--warning)"
        }),
        createTag(run.convergenceAssimilationRunnerLaunchStackRemediationRunner || run.runtime || "runner", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--primary)"
        }),
        createTag(`${run.convergenceAssimilationRunnerLaunchStackRemediationWorkItemCount || 0} item(s)`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        })
      ]),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-result-btn",
          text: "Record Passed",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultRunId: run.id || "",
            convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultStatus: "passed"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-result-btn",
          text: "Record Blocked",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultRunId: run.id || "",
            convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultStatus: "blocked"
          }
        })
      ])
    ]))
  ] : [];
  const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerEntries = convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedger ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-remediation-work-order-result-ledger-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
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
            text: "Launch stack remediation work-order result ledger",
            style: {
              color: "var(--text)",
              fontWeight: "850"
            }
          }),
          createElement("div", {
            text: "Non-secret Codex and Claude remediation outcomes captured after supervised work-order runs.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.28rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(`${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerSummary.visible || 0} visible`, {
          background: "var(--bg)",
          border: "1px solid var(--primary)",
          color: "var(--primary)"
        })
      ]),
      createElement("div", {
        className: "tags"
      }, [
        createTag(`${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerSummary.passed || 0} passed`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--success)"
        }),
        createTag(`${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerSummary.blocked || 0} blocked`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerSummary.blocked || 0) ? "var(--danger)" : "var(--text-muted)"
        }),
        createTag(`${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerSummary.needsReview || 0} review`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerSummary.needsReview || 0) ? "var(--warning)" : "var(--text-muted)"
        }),
        createTag(`${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerSummary.workItems || 0} work items`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        })
      ]),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-result-ledger-copy-btn",
          text: "Copy All",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerStatus: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-result-ledger-copy-btn",
          text: "Copy Passed",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerStatus: "passed" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-result-ledger-copy-btn",
          text: "Copy Blocked",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerStatus: "blocked" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-result-tasks-btn",
          text: "Track Result Tasks",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTasksStatus: "all" }
        })
      ])
    ]),
    ...convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerResults.slice(0, 8).map((result) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-remediation-work-order-result-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.38rem"
      }
    }, [
      createElement("div", {
        text: `${result.projectName || result.projectId || "Workspace Audit Pro"}: ${result.status || "needs-review"}`,
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: result.summary || result.validationSummary || "No result summary recorded.",
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        className: "tags"
      }, [
        createTag(result.runner || "runner", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--primary)"
        }),
        createTag(`${result.workItemCount || 0} item(s)`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        createTag(result.createdAt ? new Date(result.createdAt).toLocaleString() : "recorded", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        })
      ])
    ]))
  ] : [];
  const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerEntries = convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedger ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-remediation-work-order-result-task-ledger-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
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
            text: "Launch stack remediation result follow-up task ledger",
            style: {
              color: "var(--text)",
              fontWeight: "850"
            }
          }),
          createElement("div", {
            text: `${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSummary.open || 0} open | ${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSummary.closed || 0} closed | ${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSummary.blocked || 0} blocked | ${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSummary.needsReview || 0} review`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.28rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(`${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSummary.visible || 0} visible`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSummary.open ? "var(--warning)" : "var(--success)"
        })
      ]),
      createElement("div", {
        className: "tags"
      }, [
        createTag(`${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSummary.codex || 0} codex`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--primary)"
        }),
        createTag(`${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSummary.claude || 0} claude`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--primary)"
        }),
        createTag(`${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSummary.high || 0} high`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSummary.high ? "var(--danger)" : "var(--text-muted)"
        }),
        createTag(`${convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSummary.medium || 0} medium`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--warning)"
        })
      ]),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-result-task-ledger-copy-btn",
          text: "Copy All Tasks",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerRunner: "all",
            convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerStatus: "all"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-result-task-ledger-copy-btn",
          text: "Copy Open Codex",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerRunner: "codex",
            convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerStatus: "open"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-result-task-ledger-copy-btn",
          text: "Copy Open Claude",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerRunner: "claude",
            convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerStatus: "open"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-result-task-ledger-snapshot-save-btn",
          text: "Save Ledger Snapshot",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotRunner: "all",
            convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotStatus: "all"
          }
        })
      ])
    ]),
    ...convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerItems.slice(0, 10).map((task) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-remediation-work-order-result-task-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.38rem"
      }
    }, [
      createElement("div", {
        text: task.title || "Launch stack remediation result follow-up task",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: `${task.runner || "runner"} | ${task.resultStatus || "needs-review"} | ${task.status || "open"} | ${task.priority || "normal"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        text: task.nextAction || task.resultSummary || task.validationSummary || "Review this remediation result follow-up task before the next runner handoff.",
        style: {
          color: "var(--text-muted)",
          fontSize: "0.82rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-result-task-ledger-task-btn",
          text: "Resolve",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerTaskId: task.id,
            convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerTaskStatus: "resolved"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-result-task-ledger-task-btn",
          text: "Reopen",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerTaskId: task.id,
            convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerTaskStatus: "open"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-result-task-ledger-task-btn",
          text: "Block",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerTaskId: task.id,
            convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerTaskStatus: "blocked"
          }
        })
      ])
    ]))
  ] : [];
  const convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotEntries = convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshots.slice(0, 8).map((snapshot) => createElement("div", {
    className: "governance-gap-card convergence-assimilation-runner-launch-stack-remediation-work-order-result-task-ledger-snapshot-card",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.5rem"
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
          text: snapshot.title || "Result Follow-Up Task Ledger Snapshot",
          style: {
            color: "var(--text)",
            fontWeight: "850"
          }
        }),
        createElement("div", {
          text: `${snapshot.runner || "all"} | ${snapshot.statusFilter || "all"} | ${snapshot.openCount || 0} open | ${snapshot.closedCount || 0} closed`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            marginTop: "0.28rem",
            lineHeight: "1.45"
          }
        })
      ]),
      createTag(`${snapshot.visibleCount || 0} captured`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: snapshot.openCount ? "var(--warning)" : "var(--success)"
      })
    ]),
    createElement("div", {
      className: "tags"
    }, [
      createTag(`${snapshot.blockedCount || 0} blocked`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: snapshot.blockedCount ? "var(--danger)" : "var(--text-muted)"
      }),
      createTag(`${snapshot.needsReviewCount || 0} review`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: snapshot.needsReviewCount ? "var(--warning)" : "var(--text-muted)"
      }),
      createTag(snapshot.createdAt ? new Date(snapshot.createdAt).toLocaleString() : "saved", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      })
    ]),
    createElement("button", {
      className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-work-order-result-task-ledger-snapshot-copy-btn",
      text: "Copy Snapshot",
      attrs: { type: "button" },
      dataset: { convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotId: snapshot.id }
    })
  ]));
  const convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff = governance.convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff || null;
  const convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffEntries = convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-remediation-pack-snapshot-drift-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
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
            text: convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.hasSnapshot ? (convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.snapshotTitle || "Latest launch stack remediation pack snapshot") : "No launch stack remediation pack snapshot",
            style: {
              color: "var(--text)",
              fontWeight: "850"
            }
          }),
          createElement("div", {
            text: convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.recommendedAction || "Save a remediation pack snapshot before comparing drift.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.28rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.driftSeverity || "missing-snapshot", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.driftSeverity === "high" ? "var(--danger)" : convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.driftSeverity === "none" ? "var(--success)" : "var(--warning)"
        })
      ]),
      createElement("div", {
        text: `${convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.driftScore || 0} drift score | ${(convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.driftItems || []).length} drift item(s) | ${convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.runner || "codex"}`,
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
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-pack-snapshot-drift-btn",
          text: "Copy Drift",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDriftId: convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDriftRunner: convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.runner || "codex"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-pack-snapshot-refresh-btn",
          text: "Accept Drift",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotRefreshId: convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotRefreshRunner: convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.runner || "codex"
          }
        })
      ])
    ]),
    ...(convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.driftItems || []).slice(0, 8).map((item) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-remediation-pack-drift-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem"
      }
    }, [
      createElement("div", {
        text: item.label || item.field || "Launch stack remediation drift",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: `${item.before ?? "missing"} -> ${item.current ?? "missing"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      item.checkpointDecision ? createTag(`${item.checkpointDecision} / ${item.checkpointStatus || "open"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.checkpointDecision === "confirmed" ? "var(--success)" : item.checkpointDecision === "escalated" ? "var(--danger)" : "var(--warning)"
      }) : null,
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-pack-drift-checkpoint-btn",
          text: "Confirm",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackRemediationPackDriftSnapshotId: convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchStackRemediationPackDriftRunner: convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.runner || "codex",
            convergenceAssimilationRunnerLaunchStackRemediationPackDriftField: item.field || "",
            convergenceAssimilationRunnerLaunchStackRemediationPackDriftDecision: "confirmed"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-pack-drift-checkpoint-btn",
          text: "Defer",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackRemediationPackDriftSnapshotId: convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchStackRemediationPackDriftRunner: convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.runner || "codex",
            convergenceAssimilationRunnerLaunchStackRemediationPackDriftField: item.field || "",
            convergenceAssimilationRunnerLaunchStackRemediationPackDriftDecision: "deferred"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-pack-drift-checkpoint-btn",
          text: "Escalate",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackRemediationPackDriftSnapshotId: convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchStackRemediationPackDriftRunner: convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiff.runner || "codex",
            convergenceAssimilationRunnerLaunchStackRemediationPackDriftField: item.field || "",
            convergenceAssimilationRunnerLaunchStackRemediationPackDriftDecision: "escalated"
          }
        })
      ])
    ]))
  ] : [];
  const convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedger = governance.convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedger || null;
  const convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointSummary = convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedger?.summary || {
    total: 0,
    visible: 0,
    open: 0,
    closed: 0,
    confirmed: 0,
    deferred: 0,
    escalated: 0
  };
  const convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerEntries = convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedger ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-remediation-pack-drift-checkpoint-ledger-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
      }
    }, [
      createElement("div", {
        text: "Launch stack remediation pack drift checkpoint ledger",
        style: {
          color: "var(--text)",
          fontWeight: "850"
        }
      }),
      createElement("div", {
        text: `${convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointSummary.visible || 0} visible | ${convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointSummary.open || 0} open | ${convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointSummary.closed || 0} closed | ${convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointSummary.openEscalated || 0} open escalated`,
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
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-pack-drift-checkpoint-ledger-copy-btn",
          text: "Copy All",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-pack-drift-checkpoint-ledger-copy-btn",
          text: "Copy Open",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerCopy: "open" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-pack-drift-checkpoint-ledger-copy-btn",
          text: "Copy Closed",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerCopy: "closed" }
        })
      ])
    ]),
    ...(convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedger.items || []).slice(0, 8).map((item) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-remediation-pack-drift-checkpoint-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem"
      }
    }, [
      createElement("div", {
        text: item.title || item.convergenceAssimilationRunnerLaunchStackRemediationPackDriftLabel || "Launch stack remediation pack drift checkpoint",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: `${item.convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotTitle || item.convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotId || "Snapshot not recorded"} | ${item.convergenceAssimilationRunnerLaunchStackRemediationPackRunner || "codex"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        text: `${item.convergenceAssimilationRunnerLaunchStackRemediationPackDriftBefore || "missing"} -> ${item.convergenceAssimilationRunnerLaunchStackRemediationPackDriftCurrent || "missing"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createTag(`${item.convergenceAssimilationRunnerLaunchStackRemediationPackDriftDecision || "deferred"} / ${item.status || "open"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.convergenceAssimilationRunnerLaunchStackRemediationPackDriftDecision === "confirmed" ? "var(--success)" : item.convergenceAssimilationRunnerLaunchStackRemediationPackDriftDecision === "escalated" ? "var(--danger)" : "var(--warning)"
      }),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-pack-drift-checkpoint-task-btn",
          text: "Resolve",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointTaskId: item.id || "",
            convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointTaskStatus: "resolved"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-pack-drift-checkpoint-task-btn",
          text: "Reopen",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointTaskId: item.id || "",
            convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointTaskStatus: "open"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-pack-drift-checkpoint-task-btn",
          text: "Block",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointTaskId: item.id || "",
            convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointTaskStatus: "blocked"
          }
        })
      ])
    ]))
  ] : [];
  const convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotEntries = (governance.convergenceAssimilationRunnerLaunchStackRemediationPackSnapshots || []).map((snapshot) => createElement("div", {
    className: "governance-gap-card convergence-assimilation-runner-launch-stack-remediation-pack-snapshot-card",
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
          text: snapshot.title || "Launch Stack Remediation Pack",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${new Date(snapshot.createdAt).toLocaleString()} | ${snapshot.runner || "codex"} | ${snapshot.nonReadyStages || 0} non-ready | ${snapshot.openTasks || 0} open task(s)`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            marginTop: "0.3rem",
            lineHeight: "1.45"
          }
        })
      ]),
      createTag(snapshot.decision || "review", {
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: snapshot.decision === "ready" ? "var(--success)" : snapshot.decision === "hold" ? "var(--danger)" : "var(--warning)"
      })
    ]),
    createElement("div", {
      text: `${snapshot.openCheckpoints || 0} open checkpoint(s) | ${snapshot.openEscalatedCheckpoints || 0} open escalated | ${snapshot.secretPolicy || "non-secret remediation pack metadata only"}`,
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
        className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-pack-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: { convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotId: snapshot.id }
      }),
      createElement("button", {
        className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-remediation-pack-snapshot-drift-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: {
          convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDriftId: snapshot.id,
          convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDriftRunner: snapshot.runner || "codex"
        }
      })
    ])
  ]));
  const convergenceAssimilationRunnerLaunchStackActionTaskLedgerEntries = convergenceAssimilationRunnerLaunchStackActionTaskLedger ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-action-task-ledger-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
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
            text: "Launch stack action task ledger",
            style: {
              color: "var(--text)",
              fontWeight: "850"
            }
          }),
          createElement("div", {
            text: `${convergenceAssimilationRunnerLaunchStackActionTaskLedgerSummary.open || 0} open | ${convergenceAssimilationRunnerLaunchStackActionTaskLedgerSummary.closed || 0} closed | ${convergenceAssimilationRunnerLaunchStackActionTaskLedgerSummary.codex || 0} codex | ${convergenceAssimilationRunnerLaunchStackActionTaskLedgerSummary.claude || 0} claude`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.28rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(`${convergenceAssimilationRunnerLaunchStackActionTaskLedgerSummary.visible || 0} visible`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: convergenceAssimilationRunnerLaunchStackActionTaskLedgerSummary.open ? "var(--warning)" : "var(--success)"
        })
      ]),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-action-task-ledger-copy-btn",
          text: "Copy All Tasks",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerRunner: "all",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerStatus: "all"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-action-task-ledger-copy-btn",
          text: "Copy Open Codex",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerRunner: "codex",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerStatus: "open"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-action-task-ledger-copy-btn",
          text: "Copy Open Claude",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerRunner: "claude",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerStatus: "open"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-action-task-ledger-snapshot-save-btn",
          text: "Save Ledger Snapshot",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotRunner: "all",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotStatus: "all"
          }
        })
      ])
    ]),
    ...(convergenceAssimilationRunnerLaunchStackActionTaskLedger.items || []).slice(0, 10).map((task) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-action-task-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.38rem"
      }
    }, [
      createElement("div", {
        text: task.title || "Launch stack action task",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: `${task.runner || "codex"} | ${task.stageTitle || task.stageId || "stage"} | ${task.stageStatus || "review"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        text: task.stageAction || "Review this launch stack stage before runner start.",
        style: {
          color: "var(--text-muted)",
          fontSize: "0.82rem",
          lineHeight: "1.45"
        }
      }),
      createTag(task.status || "open", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: task.status === "resolved" || task.status === "closed" ? "var(--success)" : task.status === "blocked" ? "var(--danger)" : "var(--warning)"
      })
    ]))
  ] : [];
  const convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotEntries = (governance.convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshots || []).map((snapshot) => createElement("div", {
    className: "governance-gap-card convergence-assimilation-runner-launch-stack-action-task-ledger-snapshot-card",
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
          text: snapshot.title || "Launch Stack Action Task Ledger",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${new Date(snapshot.createdAt).toLocaleString()} | ${snapshot.runner || "all"} | ${snapshot.statusFilter || "all"} | ${snapshot.visibleCount || 0} visible`,
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
      text: `${snapshot.total || 0} total launch stack task(s) | ${snapshot.closedCount || 0} closed | ${snapshot.codexCount || 0} codex | ${snapshot.claudeCount || 0} claude | ${snapshot.secretPolicy || "non-secret launch stack action task metadata only"}`,
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
        className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-action-task-ledger-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: { convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotId: snapshot.id }
      }),
      createElement("button", {
        className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-action-task-ledger-snapshot-drift-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: { convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDriftId: snapshot.id }
      })
    ])
  ]));
  const convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff = governance.convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff || null;
  const convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffEntries = convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-action-task-ledger-snapshot-drift-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
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
            text: convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.hasSnapshot ? (convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.snapshotTitle || "Latest launch stack task ledger snapshot") : "No launch stack task ledger snapshot",
            style: {
              color: "var(--text)",
              fontWeight: "850"
            }
          }),
          createElement("div", {
            text: convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.recommendedAction || "Save a launch stack action task ledger snapshot before comparing drift.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.28rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.driftSeverity || "missing-snapshot", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.driftSeverity === "high" ? "var(--danger)" : convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.driftSeverity === "none" ? "var(--success)" : "var(--warning)"
        })
      ]),
      createElement("div", {
        text: `${convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.driftScore || 0} drift score | ${(convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.driftItems || []).length} drift item(s) | ${convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.runner || "all"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", { className: "governance-actions" }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-action-task-ledger-drift-copy-btn",
          text: "Copy Latest Drift",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDriftId: convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.snapshotId || "latest" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-action-task-ledger-snapshot-refresh-btn",
          text: "Accept Drift",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotRefreshId: convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotRefreshRunner: convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.runner || "all",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotRefreshStatus: convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.status || "all"
          }
        })
      ])
    ]),
    ...(convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.driftItems || []).slice(0, 8).map((item) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-action-task-ledger-drift-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem"
      }
    }, [
      createElement("div", {
        text: item.label || item.field || "Launch stack action task ledger drift",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: `${item.before ?? "missing"} -> ${item.current ?? "missing"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      item.checkpointDecision ? createTag(`${item.checkpointDecision} / ${item.checkpointStatus || "open"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.checkpointDecision === "confirmed" ? "var(--success)" : item.checkpointDecision === "escalated" ? "var(--danger)" : "var(--warning)"
      }) : null,
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-action-task-ledger-drift-checkpoint-btn",
          text: "Confirm",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftSnapshotId: convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftRunner: convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.runner || "all",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftStatus: convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.status || "all",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftField: item.field || "",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftDecision: "confirmed"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-action-task-ledger-drift-checkpoint-btn",
          text: "Defer",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftSnapshotId: convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftRunner: convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.runner || "all",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftStatus: convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.status || "all",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftField: item.field || "",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftDecision: "deferred"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-action-task-ledger-drift-checkpoint-btn",
          text: "Escalate",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftSnapshotId: convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftRunner: convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.runner || "all",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftStatus: convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiff.status || "all",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftField: item.field || "",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftDecision: "escalated"
          }
        })
      ])
    ]))
  ] : [];
  const convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedger = governance.convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedger || null;
  const convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointSummary = convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedger?.summary || {
    total: 0,
    visible: 0,
    open: 0,
    closed: 0,
    confirmed: 0,
    deferred: 0,
    escalated: 0
  };
  const convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedgerEntries = convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedger ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-action-task-ledger-drift-checkpoint-ledger-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
      }
    }, [
      createElement("div", {
        text: "Launch stack action task ledger drift checkpoint ledger",
        style: {
          color: "var(--text)",
          fontWeight: "850"
        }
      }),
      createElement("div", {
        text: `${convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointSummary.visible || 0} visible | ${convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointSummary.open || 0} open | ${convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointSummary.closed || 0} closed | ${convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointSummary.openEscalated || 0} open escalated`,
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
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-action-task-ledger-drift-checkpoint-ledger-copy-btn",
          text: "Copy All",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedgerCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-action-task-ledger-drift-checkpoint-ledger-copy-btn",
          text: "Copy Open",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedgerCopy: "open" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-action-task-ledger-drift-checkpoint-ledger-copy-btn",
          text: "Copy Closed",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedgerCopy: "closed" }
        })
      ])
    ]),
    ...(convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedger.items || []).slice(0, 8).map((item) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launch-stack-action-task-ledger-drift-checkpoint-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem"
      }
    }, [
      createElement("div", {
        text: item.title || item.convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftLabel || "Launch stack action task ledger drift checkpoint",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: `${item.convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotTitle || item.convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotId || "Snapshot not recorded"} | ${item.convergenceAssimilationRunnerLaunchStackActionTaskLedgerRunner || "all"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        text: `${item.convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftBefore || "missing"} -> ${item.convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCurrent || "missing"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createTag(`${item.convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftDecision || "deferred"} / ${item.status || "open"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftDecision === "confirmed" ? "var(--success)" : item.convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftDecision === "escalated" ? "var(--danger)" : "var(--warning)"
      }),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-action-task-ledger-drift-checkpoint-task-btn",
          text: "Resolve",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointTaskId: item.id || "",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointTaskStatus: "resolved"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-action-task-ledger-drift-checkpoint-task-btn",
          text: "Reopen",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointTaskId: item.id || "",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointTaskStatus: "open"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launch-stack-action-task-ledger-drift-checkpoint-task-btn",
          text: "Block",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointTaskId: item.id || "",
            convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointTaskStatus: "blocked"
          }
        })
      ])
    ]))
  ] : [];
  const convergenceAssimilationRunnerLaunchpadGateSnapshotDiffEntries = convergenceAssimilationRunnerLaunchpadGateSnapshotDiff ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launchpad-gate-snapshot-drift-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
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
            text: convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.hasSnapshot ? (convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.snapshotTitle || "Latest launchpad gate snapshot") : "No launchpad gate snapshot",
            style: {
              color: "var(--text)",
              fontWeight: "850"
            }
          }),
          createElement("div", {
            text: convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.recommendedAction || "Save a launchpad gate snapshot before comparing drift.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.28rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.driftSeverity || "missing-snapshot", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.driftSeverity === "high" ? "var(--danger)" : convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.driftSeverity === "none" ? "var(--success)" : "var(--warning)"
        })
      ]),
      createElement("div", {
        text: `${convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.driftScore || 0} drift score | ${(convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.driftItems || []).length} drift item(s) | ${convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.runner || "runner unset"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      })
    ]),
    ...(convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.driftItems || []).slice(0, 8).map((item) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launchpad-gate-snapshot-drift-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem"
      }
    }, [
      createElement("div", {
        text: item.label || item.field || "Launchpad gate drift",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: `${item.before ?? "missing"} -> ${item.current ?? "missing"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      item.checkpointDecision ? createTag(`${item.checkpointDecision} / ${item.checkpointStatus || "open"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.checkpointDecision === "confirmed" ? "var(--success)" : item.checkpointDecision === "escalated" ? "var(--danger)" : "var(--warning)"
      }) : null,
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launchpad-gate-drift-checkpoint-btn",
          text: "Confirm",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchpadGateDriftSnapshotId: convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchpadGateDriftRunner: convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.runner || "codex",
            convergenceAssimilationRunnerLaunchpadGateDriftField: item.field || "",
            convergenceAssimilationRunnerLaunchpadGateDriftDecision: "confirmed"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launchpad-gate-drift-checkpoint-btn",
          text: "Defer",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchpadGateDriftSnapshotId: convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchpadGateDriftRunner: convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.runner || "codex",
            convergenceAssimilationRunnerLaunchpadGateDriftField: item.field || "",
            convergenceAssimilationRunnerLaunchpadGateDriftDecision: "deferred"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launchpad-gate-drift-checkpoint-btn",
          text: "Escalate",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationRunnerLaunchpadGateDriftSnapshotId: convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationRunnerLaunchpadGateDriftRunner: convergenceAssimilationRunnerLaunchpadGateSnapshotDiff.runner || "codex",
            convergenceAssimilationRunnerLaunchpadGateDriftField: item.field || "",
            convergenceAssimilationRunnerLaunchpadGateDriftDecision: "escalated"
          }
        })
      ])
    ].filter(Boolean)))
  ] : [];
  const convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger = governance.convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger || null;
  const convergenceAssimilationRunnerLaunchpadGateDriftCheckpointSummary = convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger?.summary || {
    total: 0,
    visible: 0,
    open: 0,
    closed: 0,
    confirmed: 0,
    deferred: 0,
    escalated: 0
  };
  const convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedgerEntries = convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launchpad-gate-drift-checkpoint-ledger-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
      }
    }, [
      createElement("div", {
        text: "Launchpad gate drift checkpoint ledger",
        style: {
          color: "var(--text)",
          fontWeight: "850"
        }
      }),
      createElement("div", {
        text: `${convergenceAssimilationRunnerLaunchpadGateDriftCheckpointSummary.visible || 0} visible | ${convergenceAssimilationRunnerLaunchpadGateDriftCheckpointSummary.open || 0} open | ${convergenceAssimilationRunnerLaunchpadGateDriftCheckpointSummary.closed || 0} closed | ${convergenceAssimilationRunnerLaunchpadGateDriftCheckpointSummary.escalated || 0} escalated`,
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
          className: "btn governance-action-btn convergence-assimilation-runner-launchpad-gate-drift-checkpoint-ledger-copy-btn",
          text: "Copy All",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedgerCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launchpad-gate-drift-checkpoint-ledger-copy-btn",
          text: "Copy Open",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedgerCopy: "open" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-runner-launchpad-gate-drift-checkpoint-ledger-copy-btn",
          text: "Copy Closed",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedgerCopy: "closed" }
        })
      ])
    ]),
    ...(convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedger.items || []).slice(0, 8).map((item) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-runner-launchpad-gate-drift-checkpoint-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem"
      }
    }, [
      createElement("div", {
        text: item.title || item.convergenceAssimilationRunnerLaunchpadGateDriftLabel || "Launchpad gate drift checkpoint",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: `${item.convergenceAssimilationRunnerLaunchpadGateSnapshotTitle || item.convergenceAssimilationRunnerLaunchpadGateSnapshotId || "Snapshot not recorded"} | ${item.convergenceAssimilationRunnerLaunchpadGateRunner || "codex"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        text: `${item.convergenceAssimilationRunnerLaunchpadGateDriftBefore || "missing"} -> ${item.convergenceAssimilationRunnerLaunchpadGateDriftCurrent || "missing"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createTag(`${item.convergenceAssimilationRunnerLaunchpadGateDriftDecision || "deferred"} / ${item.status || "open"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.convergenceAssimilationRunnerLaunchpadGateDriftDecision === "confirmed" ? "var(--success)" : item.convergenceAssimilationRunnerLaunchpadGateDriftDecision === "escalated" ? "var(--danger)" : "var(--warning)"
      })
    ]))
  ] : [];
  const convergenceAssimilationSessionPacketSnapshotDiff = governance.convergenceAssimilationSessionPacketSnapshotDiff || null;
  const convergenceAssimilationSessionPacketSnapshotDiffEntries = convergenceAssimilationSessionPacketSnapshotDiff ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-session-packet-snapshot-drift-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
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
            text: convergenceAssimilationSessionPacketSnapshotDiff.hasSnapshot ? (convergenceAssimilationSessionPacketSnapshotDiff.snapshotTitle || "Latest session packet snapshot") : "No session packet snapshot",
            style: {
              color: "var(--text)",
              fontWeight: "850"
            }
          }),
          createElement("div", {
            text: convergenceAssimilationSessionPacketSnapshotDiff.recommendedAction || "Save a session packet snapshot before comparing drift.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.28rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(convergenceAssimilationSessionPacketSnapshotDiff.driftSeverity || "missing-snapshot", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: convergenceAssimilationSessionPacketSnapshotDiff.driftSeverity === "high" ? "var(--danger)" : convergenceAssimilationSessionPacketSnapshotDiff.driftSeverity === "none" ? "var(--success)" : "var(--warning)"
        })
      ]),
      createElement("div", {
        text: `${convergenceAssimilationSessionPacketSnapshotDiff.driftScore || 0} drift score | ${(convergenceAssimilationSessionPacketSnapshotDiff.driftItems || []).length} drift item(s) | ${convergenceAssimilationSessionPacketSnapshotDiff.runner || "runner unset"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      })
    ]),
    ...(convergenceAssimilationSessionPacketSnapshotDiff.driftItems || []).slice(0, 8).map((item) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-session-packet-snapshot-drift-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem"
      }
    }, [
      createElement("div", {
        text: item.label || item.field || "Session packet drift",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: `${item.before ?? "missing"} -> ${item.current ?? "missing"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      item.checkpointDecision ? createTag(`${item.checkpointDecision} / ${item.checkpointStatus || "open"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.checkpointDecision === "confirmed" ? "var(--success)" : item.checkpointDecision === "escalated" ? "var(--danger)" : "var(--warning)"
      }) : null,
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-session-packet-drift-checkpoint-btn",
          text: "Confirm",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationSessionPacketDriftSnapshotId: convergenceAssimilationSessionPacketSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationSessionPacketDriftRunner: convergenceAssimilationSessionPacketSnapshotDiff.runner || "codex",
            convergenceAssimilationSessionPacketDriftField: item.field || "",
            convergenceAssimilationSessionPacketDriftDecision: "confirmed"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-session-packet-drift-checkpoint-btn",
          text: "Defer",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationSessionPacketDriftSnapshotId: convergenceAssimilationSessionPacketSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationSessionPacketDriftRunner: convergenceAssimilationSessionPacketSnapshotDiff.runner || "codex",
            convergenceAssimilationSessionPacketDriftField: item.field || "",
            convergenceAssimilationSessionPacketDriftDecision: "deferred"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-session-packet-drift-checkpoint-btn",
          text: "Escalate",
          attrs: { type: "button" },
          dataset: {
            convergenceAssimilationSessionPacketDriftSnapshotId: convergenceAssimilationSessionPacketSnapshotDiff.snapshotId || "latest",
            convergenceAssimilationSessionPacketDriftRunner: convergenceAssimilationSessionPacketSnapshotDiff.runner || "codex",
            convergenceAssimilationSessionPacketDriftField: item.field || "",
            convergenceAssimilationSessionPacketDriftDecision: "escalated"
          }
        })
      ])
    ].filter(Boolean)))
  ] : [];
  const convergenceAssimilationSessionPacketDriftCheckpointLedger = governance.convergenceAssimilationSessionPacketDriftCheckpointLedger || null;
  const convergenceAssimilationSessionPacketDriftCheckpointSummary = convergenceAssimilationSessionPacketDriftCheckpointLedger?.summary || {
    total: 0,
    visible: 0,
    open: 0,
    closed: 0,
    confirmed: 0,
    deferred: 0,
    escalated: 0
  };
  const convergenceAssimilationSessionPacketDriftCheckpointLedgerEntries = convergenceAssimilationSessionPacketDriftCheckpointLedger ? [
    createElement("div", {
      className: "governance-gap-card convergence-assimilation-session-packet-drift-checkpoint-ledger-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
      }
    }, [
      createElement("div", {
        text: "Session packet drift checkpoint ledger",
        style: {
          color: "var(--text)",
          fontWeight: "900"
        }
      }),
      createElement("div", {
        text: `${convergenceAssimilationSessionPacketDriftCheckpointSummary.open || 0} open / ${convergenceAssimilationSessionPacketDriftCheckpointSummary.total || 0} checkpoint(s). Export decisions before refreshing CLI handoff snapshots.`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.86rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", { className: "tags" }, [
        createTag(`${convergenceAssimilationSessionPacketDriftCheckpointSummary.confirmed || 0} confirmed`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceAssimilationSessionPacketDriftCheckpointSummary.confirmed || 0) ? "var(--success)" : "var(--text-muted)"
        }),
        createTag(`${convergenceAssimilationSessionPacketDriftCheckpointSummary.deferred || 0} deferred`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceAssimilationSessionPacketDriftCheckpointSummary.deferred || 0) ? "var(--warning)" : "var(--text-muted)"
        }),
        createTag(`${convergenceAssimilationSessionPacketDriftCheckpointSummary.escalated || 0} escalated`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (convergenceAssimilationSessionPacketDriftCheckpointSummary.escalated || 0) ? "var(--danger)" : "var(--text-muted)"
        })
      ]),
      createElement("div", { className: "governance-actions" }, [
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-session-packet-drift-checkpoint-ledger-copy-btn",
          text: "Copy All",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationSessionPacketDriftCheckpointLedgerCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-session-packet-drift-checkpoint-ledger-copy-btn",
          text: "Copy Open",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationSessionPacketDriftCheckpointLedgerCopy: "open" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-assimilation-session-packet-drift-checkpoint-ledger-copy-btn",
          text: "Copy Closed",
          attrs: { type: "button" },
          dataset: { convergenceAssimilationSessionPacketDriftCheckpointLedgerCopy: "closed" }
        })
      ])
    ]),
    ...(convergenceAssimilationSessionPacketDriftCheckpointLedger.items || []).slice(0, 12).map((item) => createElement("div", {
      className: "governance-gap-card convergence-assimilation-session-packet-drift-checkpoint-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.42rem"
      }
    }, [
      createElement("div", {
        text: item.title || item.convergenceAssimilationSessionPacketDriftLabel || "Session packet drift checkpoint",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", { className: "tags" }, [
        createTag(item.convergenceAssimilationSessionPacketDriftDecision || "deferred", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: item.convergenceAssimilationSessionPacketDriftDecision === "confirmed" ? "var(--success)" : item.convergenceAssimilationSessionPacketDriftDecision === "escalated" ? "var(--danger)" : "var(--warning)"
        }),
        createTag(item.status || "open", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: item.status === "resolved" ? "var(--success)" : item.status === "blocked" ? "var(--danger)" : "var(--warning)"
        }),
        createTag(item.convergenceAssimilationSessionPacketRunner || "codex", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        })
      ]),
      createElement("div", {
        text: `${item.convergenceAssimilationSessionPacketDriftLabel || item.convergenceAssimilationSessionPacketDriftField || "field"}: ${item.convergenceAssimilationSessionPacketDriftBefore || "missing"} -> ${item.convergenceAssimilationSessionPacketDriftCurrent || "missing"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      })
    ]))
  ] : [];
  const convergenceTaskSummary = governance.summary || {};
  const convergenceTaskEntries = [
    createElement("div", {
      className: "governance-gap-card convergence-review-task-ledger-control-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
      }
    }, [
      createElement("div", {
        text: "Convergence task ledger export",
        style: {
          color: "var(--text)",
          fontWeight: "900"
        }
      }),
      createElement("div", {
        text: `${convergenceTaskSummary.convergenceOpenTaskCount || 0} open / ${convergenceTaskSummary.convergenceTaskCount || 0} total. Copy a non-secret task handoff for operator review or future CLI runner assimilation.`,
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
          className: "btn governance-action-btn convergence-task-ledger-copy-btn",
          text: "Copy Open",
          attrs: { type: "button" },
          dataset: { convergenceTaskLedgerCopy: "open" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-task-ledger-copy-btn",
          text: "Copy Closed",
          attrs: { type: "button" },
          dataset: { convergenceTaskLedgerCopy: "closed" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-task-ledger-copy-btn",
          text: "Copy All",
          attrs: { type: "button" },
          dataset: { convergenceTaskLedgerCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-task-ledger-snapshot-save-btn",
          text: "Save Snapshot",
          attrs: { type: "button" },
          dataset: { convergenceTaskLedgerSnapshotSave: "true" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-task-ledger-drift-copy-btn",
          text: "Copy Drift",
          attrs: { type: "button" },
          dataset: { convergenceTaskLedgerDriftCopy: "latest" }
        })
      ])
    ]),
    ...(governance.convergenceTasks || []).map((task) => createElement("div", {
    className: "governance-gap-card convergence-review-task-card",
    dataset: task.convergenceLeftId ? { openAppId: encodeAppId(task.convergenceLeftId) } : undefined,
    title: task.convergenceLeftId ? "Open left project workbench" : undefined,
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
          text: task.title || "Convergence review task",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${task.convergencePairId || "convergence-pair"} | status ${(task.convergenceReviewStatus || "needs-review").toUpperCase()} | score ${task.convergenceScore || 0}%`,
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
      text: task.description ? String(task.description).split("\n")[0] : "Track convergence review evidence without storing credentials, keys, certificates, cookies, or browser sessions.",
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    createElement("div", {
      className: "tags"
    }, [
      createTag(task.convergenceOperatorProposed ? "operator proposed" : "auto detected", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: task.convergenceOperatorProposed ? "var(--primary)" : "var(--text-muted)"
      }),
      createTag(task.convergenceRecommendation || "needs-review", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      }),
      createTag(task.secretPolicy || "non-secret-convergence-review-evidence-only", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      })
    ]),
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn convergence-task-confirm-btn",
        text: "Confirm",
        attrs: { type: "button" },
        dataset: {
          convergenceTaskCheckpointAction: "confirm",
          taskId: task.id || ""
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn convergence-task-defer-btn",
        text: "Defer",
        attrs: { type: "button" },
        dataset: {
          convergenceTaskCheckpointAction: "defer",
          taskId: task.id || ""
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn convergence-task-escalate-btn",
        text: "Escalate",
        attrs: { type: "button" },
        dataset: {
          convergenceTaskCheckpointAction: "escalate",
          taskId: task.id || ""
        }
      }),
      task.convergenceLeftId ? createElement("button", {
        className: "btn governance-action-btn",
        text: "Open Left",
        attrs: { type: "button" },
        dataset: { openAppId: encodeAppId(task.convergenceLeftId) }
      }) : null,
      task.convergenceRightId ? createElement("button", {
        className: "btn governance-action-btn",
        text: "Open Right",
        attrs: { type: "button" },
        dataset: { openAppId: encodeAppId(task.convergenceRightId) }
      }) : null
    ])
  ]))
  ];
  const convergenceTaskLedgerSnapshotDiff = governance.convergenceTaskLedgerSnapshotDiff || null;
  const convergenceTaskLedgerDriftItems = Array.isArray(convergenceTaskLedgerSnapshotDiff?.driftItems)
    ? convergenceTaskLedgerSnapshotDiff.driftItems
    : [];
  const convergenceTaskLedgerDriftCheckpointFilter = ["all", "uncheckpointed", "confirmed", "deferred", "escalated"].includes(governance.convergenceTaskLedgerDriftCheckpointFilter)
    ? governance.convergenceTaskLedgerDriftCheckpointFilter
    : "all";
  const convergenceTaskLedgerDriftCheckpointByField = new Map();
  if (convergenceTaskLedgerSnapshotDiff?.snapshotId) {
    (governance.convergenceTasks || []).forEach((task) => {
      if (task.convergenceTaskLedgerDriftSnapshotId !== convergenceTaskLedgerSnapshotDiff.snapshotId) return;
      const field = task.convergenceTaskLedgerDriftField || "";
      if (!field) return;
      convergenceTaskLedgerDriftCheckpointByField.set(field, task);
    });
  }
  const convergenceTaskLedgerDriftRecords = convergenceTaskLedgerDriftItems.map((item) => {
    const field = item.field || item.label || "";
    const checkpoint = convergenceTaskLedgerDriftCheckpointByField.get(field);
    const checkpointStatus = checkpoint?.convergenceTaskLedgerDriftCheckpointStatus || checkpoint?.convergenceTaskLedgerDriftDecision || "";
    return {
      item,
      field,
      checkpoint,
      checkpointStatus: checkpointStatus || "uncheckpointed"
    };
  });
  const convergenceTaskLedgerDriftCheckpointCounts = convergenceTaskLedgerDriftRecords.reduce((counts, record) => {
    counts.all += 1;
    if (record.checkpointStatus === "confirmed") counts.confirmed += 1;
    else if (record.checkpointStatus === "deferred") counts.deferred += 1;
    else if (record.checkpointStatus === "escalated") counts.escalated += 1;
    else counts.uncheckpointed += 1;
    return counts;
  }, { all: 0, uncheckpointed: 0, confirmed: 0, deferred: 0, escalated: 0 });
  const convergenceTaskLedgerVisibleDriftRecords = convergenceTaskLedgerDriftCheckpointFilter === "all"
    ? convergenceTaskLedgerDriftRecords
    : convergenceTaskLedgerDriftRecords.filter((record) => record.checkpointStatus === convergenceTaskLedgerDriftCheckpointFilter);
  const convergenceTaskLedgerDriftFilterOptions = [
    ["all", "All"],
    ["uncheckpointed", "Uncheckpointed"],
    ["confirmed", "Confirmed"],
    ["deferred", "Deferred"],
    ["escalated", "Escalated"]
  ];
  const convergenceTaskLedgerSnapshotDiffEntries = convergenceTaskLedgerSnapshotDiff ? [
    createElement("div", {
      className: "governance-gap-card convergence-task-ledger-drift-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem"
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
            text: "Latest Convergence task ledger drift",
            style: {
              fontWeight: "800",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: convergenceTaskLedgerSnapshotDiff.hasSnapshot
              ? `${convergenceTaskLedgerSnapshotDiff.snapshotTitle || "Convergence Review Task Ledger"} | score ${convergenceTaskLedgerSnapshotDiff.driftScore || 0}`
              : "No convergence task ledger snapshot has been saved yet.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.3rem"
            }
          })
        ]),
        createTag((convergenceTaskLedgerSnapshotDiff.driftSeverity || "missing-snapshot").toUpperCase(), {
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: convergenceTaskLedgerSnapshotDiff.driftSeverity === "none" ? "var(--success)" : convergenceTaskLedgerSnapshotDiff.driftSeverity === "high" || convergenceTaskLedgerSnapshotDiff.driftSeverity === "missing-snapshot" ? "var(--danger)" : "var(--warning)"
        })
      ]),
      createElement("div", {
        text: convergenceTaskLedgerSnapshotDiff.recommendedAction || "Save a Convergence Review task ledger snapshot before drift comparisons.",
        style: {
          color: "var(--text-muted)",
          fontSize: "0.88rem",
          lineHeight: "1.5"
        }
      }),
      createElement("div", {
        text: `${convergenceTaskLedgerSnapshotDiff.driftScore || 0} drift score | ${convergenceTaskLedgerVisibleDriftRecords.length}/${convergenceTaskLedgerDriftItems.length} drift item(s) shown | ${convergenceTaskLedgerDriftCheckpointCounts.confirmed} confirmed, ${convergenceTaskLedgerDriftCheckpointCounts.deferred} deferred, ${convergenceTaskLedgerDriftCheckpointCounts.escalated} escalated, ${convergenceTaskLedgerDriftCheckpointCounts.uncheckpointed} uncheckpointed`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      convergenceTaskLedgerDriftItems.length
        ? createElement("div", {
            className: "governance-actions"
          }, convergenceTaskLedgerDriftFilterOptions.map(([filter, label]) => createElement("button", {
            className: "btn governance-action-btn convergence-task-ledger-drift-checkpoint-filter-btn",
            text: `${label} (${convergenceTaskLedgerDriftCheckpointCounts[filter] || 0})`,
            attrs: { type: "button" },
            dataset: {
              convergenceTaskLedgerDriftCheckpointFilter: filter
            },
            style: {
              borderColor: convergenceTaskLedgerDriftCheckpointFilter === filter ? "var(--primary)" : "var(--border)",
              color: convergenceTaskLedgerDriftCheckpointFilter === filter ? "var(--primary)" : "var(--text)",
              fontWeight: convergenceTaskLedgerDriftCheckpointFilter === filter ? "800" : "600"
            }
          })))
        : null,
      convergenceTaskLedgerDriftItems.length
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
              text: "Convergence task ledger drift fields",
              style: {
                color: "var(--text-muted)",
                fontSize: "0.78rem",
                fontWeight: "800",
                letterSpacing: "0.08em",
                textTransform: "uppercase"
              }
            }),
            ...convergenceTaskLedgerVisibleDriftRecords.slice(0, 8).map((record) => {
              const { item, field, checkpoint, checkpointStatus } = record;
              return createElement("div", {
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
                  text: `${item.label || item.field || "Convergence task drift"}: ${item.before ?? "none"} -> ${item.current ?? "none"} (${item.delta >= 0 ? "+" : ""}${item.delta ?? 0})`,
                  style: {
                    color: "var(--text)",
                    fontSize: "0.84rem",
                    fontWeight: "700",
                    lineHeight: "1.45"
                  }
                }),
                checkpoint ? createElement("div", {
                  style: {
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.45rem",
                    alignItems: "center",
                    color: "var(--text-muted)",
                    fontSize: "0.78rem",
                    lineHeight: "1.4"
                  }
                }, [
                  createTag(`CHECKPOINT ${String(checkpointStatus || "tracked").toUpperCase()}`, {
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: checkpointStatus === "escalated" ? "var(--danger)" : checkpointStatus === "deferred" ? "var(--warning)" : "var(--success)"
                  }),
                  createElement("span", {
                    text: `${checkpoint.status || "open"} / ${checkpoint.priority || "medium"} | ${checkpoint.updatedAt || checkpoint.createdAt || "not recorded"}`
                  })
                ]) : createElement("div", {
                  text: "Checkpoint: not recorded",
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.78rem"
                  }
                }),
                createElement("div", {
                  className: "governance-actions"
                }, [
                  createElement("button", {
                    className: "btn governance-action-btn convergence-task-ledger-drift-item-confirm-btn",
                    text: checkpoint ? "Update Confirm" : "Confirm",
                    attrs: { type: "button" },
                    dataset: {
                      convergenceTaskLedgerDriftItemField: field,
                      convergenceTaskLedgerDriftItemDecision: "confirmed"
                    }
                  }),
                  createElement("button", {
                    className: "btn governance-action-btn convergence-task-ledger-drift-item-defer-btn",
                    text: checkpoint ? "Update Defer" : "Defer",
                    attrs: { type: "button" },
                    dataset: {
                      convergenceTaskLedgerDriftItemField: field,
                      convergenceTaskLedgerDriftItemDecision: "deferred"
                    }
                  }),
                  createElement("button", {
                    className: "btn governance-action-btn convergence-task-ledger-drift-item-escalate-btn",
                    text: checkpoint ? "Update Escalate" : "Escalate",
                    attrs: { type: "button" },
                    dataset: {
                      convergenceTaskLedgerDriftItemField: field,
                      convergenceTaskLedgerDriftItemDecision: "escalated"
                    }
                  })
                ])
              ]);
            }),
            !convergenceTaskLedgerVisibleDriftRecords.length
              ? createElement("div", {
                  text: `No ${convergenceTaskLedgerDriftCheckpointFilter} drift item checkpoints match the current filter.`,
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.82rem",
                    lineHeight: "1.45"
                  }
                })
              : null,
            convergenceTaskLedgerVisibleDriftRecords.length > 8
              ? createElement("div", {
                  text: `${convergenceTaskLedgerVisibleDriftRecords.length - 8} additional filtered drift item(s).`,
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
          className: "btn governance-action-btn convergence-task-ledger-drift-copy-btn",
          text: "Copy Drift",
          attrs: { type: "button" },
          dataset: { convergenceTaskLedgerDriftCopy: "latest" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-task-ledger-drift-checkpoint-ledger-copy-btn",
          text: "Copy Checkpoint Ledger",
          attrs: { type: "button" },
          dataset: { convergenceTaskLedgerDriftCheckpointLedgerCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn convergence-task-ledger-baseline-refresh-btn",
          text: "Accept Live Baseline",
          attrs: { type: "button" },
          dataset: { convergenceTaskLedgerBaselineRefresh: "true" }
        })
      ])
    ])
  ] : [];
  const convergenceTaskLedgerSnapshotEntries = (governance.convergenceTaskLedgerSnapshots || []).map((snapshot) => createElement("div", {
    className: "governance-gap-card convergence-task-ledger-snapshot-card",
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
          text: snapshot.title || "Convergence Review Task Ledger",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${new Date(snapshot.createdAt).toLocaleString()} | ${snapshot.statusFilter || "all"} | ${snapshot.visibleCount || 0} visible | ${snapshot.pairCount || 0} pair(s)`,
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
      text: `${snapshot.total || 0} total convergence task(s) | ${snapshot.closedCount || 0} closed | ${snapshot.operatorProposedCount || 0} operator-proposed | ${snapshot.secretPolicy || "non-secret convergence task metadata only"}`,
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
        className: "btn governance-action-btn convergence-task-ledger-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: { convergenceTaskLedgerSnapshotId: snapshot.id }
      }),
      createElement("button", {
        className: "btn governance-action-btn convergence-task-ledger-snapshot-drift-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: { convergenceTaskLedgerSnapshotDriftId: snapshot.id }
      })
    ])
  ]));
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

  const cliBridgeHandoffLedgerEntries = [
    createElement("div", {
      className: "governance-gap-card cli-bridge-handoff-ledger-card",
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
          gap: "0.75rem",
          alignItems: "flex-start"
        }
      }, [
        createElement("div", {}, [
          createElement("div", {
            text: "App-owned CLI handoff mailbox",
            style: {
              color: "var(--text)",
              fontWeight: "900",
              fontSize: "1.02rem"
            }
          }),
          createElement("div", {
            text: "Non-secret handoffs between Codex CLI, Claude CLI, Workspace Audit Pro, and the operator. This ledger records communication without direct agent-to-agent free chat.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.86rem",
              lineHeight: "1.45",
              marginTop: "0.25rem"
            }
          })
        ]),
        createTag(`${governance.summary.cliBridgeHandoffCount || 0} handoff(s)`, {
          background: "var(--bg)",
          border: "1px solid var(--primary)",
          color: "var(--primary)"
        })
      ]),
      createElement("div", {
        className: "tags"
      }, [
        createTag(`Review queue ${governance.summary.cliBridgeHandoffReviewQueueCount || 0}`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (governance.summary.cliBridgeHandoffReviewQueueCount || 0) ? "var(--warning)" : "var(--success)"
        }),
        createTag(`Needs review ${governance.summary.cliBridgeHandoffNeedsReviewCount || 0}`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (governance.summary.cliBridgeHandoffNeedsReviewCount || 0) ? "var(--warning)" : "var(--success)"
        }),
        createTag(`Accepted ${governance.summary.cliBridgeHandoffAcceptedCount || 0}`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--success)"
        }),
        createTag(`Rejected ${governance.summary.cliBridgeHandoffRejectedCount || 0}`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (governance.summary.cliBridgeHandoffRejectedCount || 0) ? "var(--danger)" : "var(--text-muted)"
        }),
        createTag(`Escalated ${governance.summary.cliBridgeHandoffEscalatedCount || 0}`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (governance.summary.cliBridgeHandoffEscalatedCount || 0) ? "var(--danger)" : "var(--text-muted)"
        })
      ]),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-handoff-ledger-copy-btn",
          text: "Copy Handoff Ledger",
          attrs: { type: "button" },
          dataset: {
            cliBridgeHandoffLedgerCopy: "true",
            cliBridgeHandoffLedgerStatus: "all"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-handoff-ledger-copy-btn",
          text: "Copy Needs Review",
          attrs: { type: "button" },
          dataset: {
            cliBridgeHandoffLedgerCopy: "true",
            cliBridgeHandoffLedgerStatus: "needs-review"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-handoff-ledger-copy-btn",
          text: "Copy Accepted",
          attrs: { type: "button" },
          dataset: {
            cliBridgeHandoffLedgerCopy: "true",
            cliBridgeHandoffLedgerStatus: "accepted"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-handoff-ledger-copy-btn",
          text: "Copy Rejected",
          attrs: { type: "button" },
          dataset: {
            cliBridgeHandoffLedgerCopy: "true",
            cliBridgeHandoffLedgerStatus: "rejected"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-runner-result-capture-btn",
          text: "Record Codex Result",
          attrs: { type: "button" },
          dataset: {
            cliBridgeRunnerResultCapture: "codex"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-runner-result-capture-btn",
          text: "Record Claude Result",
          attrs: { type: "button" },
          dataset: {
            cliBridgeRunnerResultCapture: "claude"
          }
        })
      ])
    ]),
    ...(governance.cliBridgeHandoffs || []).map((handoff) => createElement("div", {
      className: "governance-gap-card cli-bridge-handoff-ledger-item-card",
      dataset: handoff.projectId ? { openAppId: encodeAppId(handoff.projectId) } : undefined,
      title: handoff.projectId ? "Open project workbench" : undefined,
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
            text: handoff.title || "CLI Bridge Handoff",
            style: {
              fontWeight: "800",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: `${handoff.sourceRunner || "operator"} -> ${handoff.targetRunner || "operator"} | ${handoff.projectName || handoff.projectId || "Portfolio"} | ${new Date(handoff.updatedAt || handoff.createdAt).toLocaleString()}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(handoff.status || "needs-review", {
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: handoff.status === "accepted" ? "var(--success)" : handoff.status === "rejected" ? "var(--danger)" : "var(--warning)"
        })
      ]),
      createElement("div", {
        text: handoff.summary || "No handoff summary recorded.",
        style: {
          color: "var(--text-muted)",
          fontSize: "0.88rem",
          lineHeight: "1.5"
        }
      }),
      createElement("div", {
        className: "tags"
      }, [
        createTag(handoff.resultType || "handoff", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        handoff.workOrderRunId
          ? createTag(`run ${handoff.workOrderRunId}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--primary)"
            })
          : null,
        handoff.followUpWorkOrderRunId
          ? createTag(`follow-up ${handoff.followUpWorkOrderRunStatus || "queued"} ${handoff.followUpWorkOrderRunner || "runner"}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--success)"
            })
          : null,
        createTag(`${(handoff.changedFiles || []).length} changed file(s)`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (handoff.changedFiles || []).length ? "var(--warning)" : "var(--text-muted)"
        }),
        createTag(`audit ${handoff.targetBaselineAuditLedgerBaselineHealth || "missing"}/${handoff.targetBaselineAuditLedgerBaselineFreshness || "missing"}`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: handoff.targetBaselineAuditLedgerBaselineHealth === "healthy"
            ? "var(--success)"
            : handoff.targetBaselineAuditLedgerBaselineHealth === "missing"
              ? "var(--danger)"
              : "var(--warning)"
        }),
        createTag(`audit drift ${handoff.targetBaselineAuditLedgerBaselineDriftSeverity || "missing-snapshot"}:${handoff.targetBaselineAuditLedgerBaselineDriftScore || 0}`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: (handoff.targetBaselineAuditLedgerBaselineDriftScore || 0) > 0 ? "var(--warning)" : "var(--text-muted)"
        })
      ]),
      handoff.targetBaselineAuditLedgerBaselineRecommendedAction
        ? createElement("div", {
            text: `Audit baseline action: ${handoff.targetBaselineAuditLedgerBaselineRecommendedAction}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          })
        : null,
      handoff.nextAction
        ? createElement("div", {
            text: `Next action: ${handoff.nextAction}`,
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
          className: "btn governance-action-btn cli-bridge-handoff-review-btn",
          text: "Accept Result",
          attrs: { type: "button" },
          dataset: {
            cliBridgeHandoffReview: "accept",
            cliBridgeHandoffId: handoff.id || ""
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-handoff-review-btn",
          text: "Reject Result",
          attrs: { type: "button" },
          dataset: {
            cliBridgeHandoffReview: "reject",
            cliBridgeHandoffId: handoff.id || ""
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-handoff-review-btn",
          text: "Escalate",
          attrs: { type: "button" },
          dataset: {
            cliBridgeHandoffReview: "escalate",
            cliBridgeHandoffId: handoff.id || ""
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-handoff-work-order-draft-btn",
          text: "Copy Work-Order Draft",
          attrs: { type: "button" },
          dataset: {
            cliBridgeHandoffWorkOrderDraft: handoff.id || "",
            cliBridgeHandoffWorkOrderRunner: handoff.targetRunner === "codex" || handoff.targetRunner === "claude"
              ? handoff.targetRunner
              : handoff.sourceRunner === "codex"
                ? "claude"
                : "codex"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-handoff-work-order-run-btn",
          text: handoff.followUpWorkOrderRunId ? "Run Queued" : "Queue Work-Order Run",
          attrs: handoff.followUpWorkOrderRunId
            ? { type: "button", disabled: "disabled", "aria-disabled": "true" }
            : { type: "button" },
          dataset: {
            cliBridgeHandoffWorkOrderRun: handoff.id || "",
            cliBridgeHandoffWorkOrderRunner: handoff.targetRunner === "codex" || handoff.targetRunner === "claude"
              ? handoff.targetRunner
              : handoff.sourceRunner === "codex"
                ? "claude"
                : "codex"
          }
        })
      ])
  ]))
  ];

  const cliBridgeRunnerDryRunSnapshotEntries = (governance.cliBridgeRunnerDryRunSnapshots || []).map((snapshot) => createElement("div", {
    className: "governance-gap-card cli-bridge-runner-dry-run-snapshot-card",
    dataset: snapshot.selectedWorkOrderProjectId ? { openAppId: encodeAppId(snapshot.selectedWorkOrderProjectId) } : undefined,
    title: snapshot.selectedWorkOrderProjectId ? "Open project workbench" : undefined,
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
          text: snapshot.title || "CLI Bridge Runner Dry Run",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${snapshot.selectedWorkOrderProjectName || snapshot.selectedWorkOrderProjectId || "Portfolio"} | ${new Date(snapshot.createdAt).toLocaleString()}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      ]),
      createTag(snapshot.dryRunDecision || "review", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: snapshot.dryRunDecision === "ready" ? "var(--success)" : snapshot.dryRunDecision === "hold" ? "var(--danger)" : "var(--warning)"
      })
    ]),
    createElement("div", {
      text: snapshot.recommendedAction || "Review the dry-run contract before supervised CLI execution.",
      style: {
        color: "var(--text-muted)",
        fontSize: "0.88rem",
        lineHeight: "1.5"
      }
    }),
    createElement("div", {
      className: "tags"
    }, [
      createTag(snapshot.runner || "runner", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--primary)"
      }),
      createTag(`work order ${snapshot.selectedWorkOrderId || "fallback"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      }),
      createTag(`scope ${snapshot.scopeMode || "project"} / ${snapshot.activeProjectName || snapshot.activeProjectId || "none"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: snapshot.scopeReady ? "var(--success)" : "var(--danger)"
      }),
      createTag(`reasons ${snapshot.reasonCount || 0}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: (snapshot.reasonCount || 0) ? "var(--warning)" : "var(--success)"
      }),
      createTag(`target ${snapshot.targetBaselineAuditGateDecision || snapshot.targetBaselineAuditGate?.decision || "review"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: (snapshot.targetBaselineAuditGateDecision || snapshot.targetBaselineAuditGate?.decision) === "ready" ? "var(--success)" : "var(--warning)"
      }),
      createTag(`audit runs ${snapshot.auditBaselineRunGateDecision || snapshot.auditBaselineRunGate?.decision || "review"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: (snapshot.auditBaselineRunGateDecision || snapshot.auditBaselineRunGate?.decision) === "ready" ? "var(--success)" : "var(--warning)"
      }),
      createTag(`alert drift ${snapshot.alertBaselineDriftTaskGateDecision || snapshot.alertBaselineDriftTaskGate?.decision || "review"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: (snapshot.alertBaselineDriftTaskGateDecision || snapshot.alertBaselineDriftTaskGate?.decision) === "ready" ? "var(--success)" : "var(--warning)"
      })
    ]),
    createElement("div", {
      text: `Alert drift tasks: ${snapshot.alertBaselineDriftTaskGateOpenTaskCount ?? snapshot.alertBaselineDriftTaskGate?.openTaskCount ?? 0} open / ${snapshot.alertBaselineDriftTaskGateTaskCount ?? snapshot.alertBaselineDriftTaskGate?.taskCount ?? 0} total`,
      style: {
        color: "var(--text-muted)",
        fontSize: "0.82rem",
        lineHeight: "1.45"
      }
    }),
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn cli-bridge-runner-dry-run-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: {
          cliBridgeRunnerDryRunSnapshotCopyId: snapshot.id || ""
        }
      })
    ])
  ]));

  const cliBridgeRunnerDryRunSnapshotBaselineStatus = governance.cliBridgeRunnerDryRunSnapshotBaselineStatus;
  const cliBridgeRunnerDryRunSnapshotBaselineStatusEntries = cliBridgeRunnerDryRunSnapshotBaselineStatus
    ? [
        createElement("div", {
          className: "governance-gap-card cli-bridge-runner-dry-run-baseline-status-card",
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
              gap: "0.8rem",
              alignItems: "flex-start"
            }
          }, [
            createElement("div", {}, [
              createElement("div", {
                text: cliBridgeRunnerDryRunSnapshotBaselineStatus.hasBaseline
                  ? (cliBridgeRunnerDryRunSnapshotBaselineStatus.title || "CLI Bridge Runner Dry-Run Baseline")
                  : "No CLI bridge runner dry-run baseline selected",
                style: {
                  color: "var(--text)",
                  fontWeight: "900",
                  fontSize: "1.02rem"
                }
              }),
              createElement("div", {
                text: cliBridgeRunnerDryRunSnapshotBaselineStatus.hasBaseline && cliBridgeRunnerDryRunSnapshotBaselineStatus.createdAt
                  ? `${new Date(cliBridgeRunnerDryRunSnapshotBaselineStatus.createdAt).toLocaleString()} | ${cliBridgeRunnerDryRunSnapshotBaselineStatus.runner || "codex"} | ${cliBridgeRunnerDryRunSnapshotBaselineStatus.selectedWorkOrderProjectName || cliBridgeRunnerDryRunSnapshotBaselineStatus.selectedWorkOrderId || "fallback"}`
                  : `${cliBridgeRunnerDryRunSnapshotBaselineStatus.snapshotCount || 0} saved dry-run snapshot(s) available`,
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.86rem",
                  lineHeight: "1.45",
                  marginTop: "0.25rem"
                }
              })
            ]),
            createTag((cliBridgeRunnerDryRunSnapshotBaselineStatus.health || "missing").toUpperCase(), {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeRunnerDryRunSnapshotBaselineStatus.health === "healthy"
                ? "var(--success)"
                : cliBridgeRunnerDryRunSnapshotBaselineStatus.health === "drifted" || cliBridgeRunnerDryRunSnapshotBaselineStatus.health === "missing"
                  ? "var(--danger)"
                  : "var(--warning)"
            })
          ]),
          createElement("div", {
            className: "tags"
          }, [
            createTag(cliBridgeRunnerDryRunSnapshotBaselineStatus.hasBaseline ? "BASELINE SET" : "BASELINE MISSING", {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeRunnerDryRunSnapshotBaselineStatus.hasBaseline ? "var(--success)" : "var(--warning)"
            }),
            createTag((cliBridgeRunnerDryRunSnapshotBaselineStatus.freshness || "missing").toUpperCase(), {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeRunnerDryRunSnapshotBaselineStatus.freshness === "fresh" ? "var(--success)" : "var(--warning)"
            }),
            createTag(`drift ${cliBridgeRunnerDryRunSnapshotBaselineStatus.driftScore || 0}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeRunnerDryRunSnapshotBaselineStatus.hasDrift ? "var(--warning)" : "var(--success)"
            }),
            createTag((cliBridgeRunnerDryRunSnapshotBaselineStatus.driftSeverity || "missing-baseline").toUpperCase(), {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeRunnerDryRunSnapshotBaselineStatus.driftSeverity === "none" ? "var(--success)" : "var(--warning)"
            })
          ]),
          createElement("div", {
            text: cliBridgeRunnerDryRunSnapshotBaselineStatus.hasBaseline
              ? `Freshness: ${cliBridgeRunnerDryRunSnapshotBaselineStatus.ageHours || 0}h old | stale after ${cliBridgeRunnerDryRunSnapshotBaselineStatus.freshnessThresholdHours || 24}h`
              : `Freshness: missing | stale threshold ${cliBridgeRunnerDryRunSnapshotBaselineStatus.freshnessThresholdHours || 24}h`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `Baseline health: ${cliBridgeRunnerDryRunSnapshotBaselineStatus.health || "missing"} | ${cliBridgeRunnerDryRunSnapshotBaselineStatus.recommendedAction || "Save a CLI bridge runner dry-run snapshot before relying on runner baseline drift."}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `Drift action: ${cliBridgeRunnerDryRunSnapshotBaselineStatus.driftRecommendedAction || "Save a CLI bridge runner dry-run snapshot before comparing drift."}`,
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
              className: "btn governance-action-btn cli-bridge-runner-dry-run-baseline-status-copy-btn",
              text: "Copy Baseline Status",
              attrs: { type: "button" },
              dataset: {
                cliBridgeRunnerDryRunBaselineStatusCopy: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-runner-dry-run-baseline-status-refresh-btn",
              text: "Refresh Codex Baseline",
              attrs: { type: "button" },
              dataset: {
                cliBridgeRunnerDryRunSnapshot: "codex"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-runner-dry-run-baseline-status-refresh-btn",
              text: "Refresh Claude Baseline",
              attrs: { type: "button" },
              dataset: {
                cliBridgeRunnerDryRunSnapshot: "claude"
              }
            })
          ])
        ])
      ]
    : [];

  const cliBridgeRunnerDryRunSnapshotLifecycleLedger = governance.cliBridgeRunnerDryRunSnapshotLifecycleLedger;
  const cliBridgeRunnerDryRunSnapshotLifecycleLedgerItems = cliBridgeRunnerDryRunSnapshotLifecycleLedger?.items || [];
  const cliBridgeRunnerDryRunSnapshotLifecycleLedgerEntries = cliBridgeRunnerDryRunSnapshotLifecycleLedger
    ? [
        createElement("div", {
          className: "governance-gap-card cli-bridge-runner-dry-run-lifecycle-ledger-card",
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
              gap: "0.8rem",
              alignItems: "flex-start"
            }
          }, [
            createElement("div", {}, [
              createElement("div", {
                text: "Dry-run baseline lifecycle ledger",
                style: {
                  color: "var(--text)",
                  fontWeight: "900",
                  fontSize: "1.02rem"
                }
              }),
              createElement("div", {
                text: cliBridgeRunnerDryRunSnapshotLifecycleLedgerItems.length
                  ? `Latest: ${cliBridgeRunnerDryRunSnapshotLifecycleLedger.summary?.latestTitle || cliBridgeRunnerDryRunSnapshotLifecycleLedger.summary?.latestSnapshotId || "saved baseline"}`
                  : "No saved Codex or Claude dry-run baseline lifecycle records matched this view.",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.86rem",
                  lineHeight: "1.45",
                  marginTop: "0.25rem"
                }
              })
            ]),
            createTag(`${cliBridgeRunnerDryRunSnapshotLifecycleLedger.summary?.visible || 0} visible`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: (cliBridgeRunnerDryRunSnapshotLifecycleLedger.summary?.visible || 0) ? "var(--success)" : "var(--warning)"
            })
          ]),
          createElement("div", {
            className: "tags"
          }, [
            createTag(`total ${cliBridgeRunnerDryRunSnapshotLifecycleLedger.summary?.total || 0}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)"
            }),
            createTag(`codex ${cliBridgeRunnerDryRunSnapshotLifecycleLedger.summary?.codex || 0}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--primary)"
            }),
            createTag(`claude ${cliBridgeRunnerDryRunSnapshotLifecycleLedger.summary?.claude || 0}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--primary)"
            }),
            createTag(`accepted drift ${cliBridgeRunnerDryRunSnapshotLifecycleLedger.summary?.acceptedDrift || 0}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: (cliBridgeRunnerDryRunSnapshotLifecycleLedger.summary?.acceptedDrift || 0) ? "var(--warning)" : "var(--success)"
            })
          ]),
          cliBridgeRunnerDryRunSnapshotLifecycleLedgerItems.length
            ? createElement("div", {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.45rem"
                }
              }, cliBridgeRunnerDryRunSnapshotLifecycleLedgerItems.slice(0, 6).map((item) => createElement("div", {
                className: "governance-gap-card",
                dataset: item.selectedWorkOrderProjectId ? { openAppId: encodeAppId(item.selectedWorkOrderProjectId) } : undefined,
                title: item.selectedWorkOrderProjectId ? "Open project workbench" : undefined,
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.45rem",
                  padding: "0.7rem",
                  background: "var(--bg)"
                }
              }, [
                createElement("div", {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.6rem",
                    alignItems: "flex-start"
                  }
                }, [
                  createElement("div", {
                    text: item.title || "CLI Bridge Runner Dry Run",
                    style: {
                      color: "var(--text)",
                      fontWeight: "800"
                    }
                  }),
                  createTag(item.lifecycleAction || "snapshot-saved", {
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: item.lifecycleAction === "accepted-drift-baseline" ? "var(--warning)" : "var(--success)"
                  })
                ]),
                createElement("div", {
                  text: `${item.runner || "runner"} | ${item.dryRunDecision || "review"} | ${item.createdAt ? new Date(item.createdAt).toLocaleString() : "saved"} | ${item.selectedWorkOrderProjectName || item.selectedWorkOrderId || "Portfolio"}`,
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.84rem",
                    lineHeight: "1.45"
                  }
                }),
                createElement("div", {
                  text: `Gates: target ${item.targetBaselineAuditGateDecision || "review"} | audit runs ${item.auditBaselineRunGateDecision || "review"} | alert drift ${item.alertBaselineDriftTaskGateDecision || "review"} | reasons ${item.reasonCount || 0}`,
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.82rem",
                    lineHeight: "1.45"
                  }
                }),
                createElement("div", {
                  className: "governance-actions"
                }, [
                  createElement("button", {
                    className: "btn governance-action-btn cli-bridge-runner-dry-run-lifecycle-ledger-item-task-btn",
                    text: "Track Item",
                    attrs: { type: "button" },
                    dataset: {
                      cliBridgeRunnerDryRunLifecycleLedgerItemTaskId: item.snapshotId || ""
                    }
                  })
                ])
              ])))
            : null,
          createElement("div", {
            className: "governance-actions"
          }, [
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-runner-dry-run-lifecycle-ledger-copy-btn",
              text: "Copy All",
              attrs: { type: "button" },
              dataset: {
                cliBridgeRunnerDryRunLifecycleLedgerCopy: "true",
                cliBridgeRunnerDryRunLifecycleLedgerRunner: "all"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-runner-dry-run-lifecycle-ledger-task-btn",
              text: "Track All",
              attrs: { type: "button" },
              dataset: {
                cliBridgeRunnerDryRunLifecycleLedgerTask: "all"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-runner-dry-run-lifecycle-ledger-copy-btn",
              text: "Copy Codex",
              attrs: { type: "button" },
              dataset: {
                cliBridgeRunnerDryRunLifecycleLedgerCopy: "true",
                cliBridgeRunnerDryRunLifecycleLedgerRunner: "codex"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-runner-dry-run-lifecycle-ledger-task-btn",
              text: "Track Codex",
              attrs: { type: "button" },
              dataset: {
                cliBridgeRunnerDryRunLifecycleLedgerTask: "codex"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-runner-dry-run-lifecycle-ledger-copy-btn",
              text: "Copy Claude",
              attrs: { type: "button" },
              dataset: {
                cliBridgeRunnerDryRunLifecycleLedgerCopy: "true",
                cliBridgeRunnerDryRunLifecycleLedgerRunner: "claude"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-runner-dry-run-lifecycle-ledger-task-btn",
              text: "Track Claude",
              attrs: { type: "button" },
              dataset: {
                cliBridgeRunnerDryRunLifecycleLedgerTask: "claude"
              }
            })
          ])
        ])
      ]
    : [];

  const cliBridgeRunnerDryRunSnapshotDiffActionId = governance.cliBridgeRunnerDryRunSnapshotDiff?.snapshotId || "latest";
  const cliBridgeRunnerDryRunSnapshotDiffEntries = governance.cliBridgeRunnerDryRunSnapshotDiff
    ? [
        createElement("div", {
          className: "governance-gap-card cli-bridge-runner-dry-run-snapshot-drift-card",
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
                text: `Dry-run drift: ${governance.cliBridgeRunnerDryRunSnapshotDiff.snapshotTitle || governance.cliBridgeRunnerDryRunSnapshotDiff.snapshotId || "latest snapshot"}`,
                style: {
                  fontWeight: "800",
                  color: "var(--text)"
                }
              }),
              createElement("div", {
                text: governance.cliBridgeRunnerDryRunSnapshotDiff.recommendedAction || "Save a CLI bridge runner dry-run snapshot before comparing drift.",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.84rem",
                  lineHeight: "1.45"
                }
              })
            ]),
            createTag(governance.cliBridgeRunnerDryRunSnapshotDiff.driftSeverity || "missing-snapshot", {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: governance.cliBridgeRunnerDryRunSnapshotDiff.driftSeverity === "high" || governance.cliBridgeRunnerDryRunSnapshotDiff.driftSeverity === "missing-snapshot"
                ? "var(--danger)"
                : governance.cliBridgeRunnerDryRunSnapshotDiff.driftSeverity === "none"
                  ? "var(--success)"
                  : "var(--warning)"
            })
          ]),
          createElement("div", {
            className: "tags"
          }, [
            createTag(`runner ${governance.cliBridgeRunnerDryRunSnapshotDiff.runner || "codex"}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--primary)"
            }),
            createTag(`score ${governance.cliBridgeRunnerDryRunSnapshotDiff.driftScore || 0}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: governance.cliBridgeRunnerDryRunSnapshotDiff.hasDrift ? "var(--warning)" : "var(--success)"
            }),
            createTag(`${(governance.cliBridgeRunnerDryRunSnapshotDiff.driftItems || []).length} item(s)`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: (governance.cliBridgeRunnerDryRunSnapshotDiff.driftItems || []).length ? "var(--warning)" : "var(--success)"
            })
          ]),
          (governance.cliBridgeRunnerDryRunSnapshotDiff.driftItems || []).length
            ? createElement("div", {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.45rem"
                }
              }, governance.cliBridgeRunnerDryRunSnapshotDiff.driftItems.slice(0, 6).map((item) => createElement("div", {
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
                  text: `${item.label || item.field}: ${item.before ?? ""} -> ${item.current ?? ""}`,
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
                    className: "btn governance-action-btn cli-bridge-runner-dry-run-snapshot-drift-item-confirm-btn",
                    text: "Confirm",
                    attrs: { type: "button" },
                    dataset: {
                      cliBridgeRunnerDryRunSnapshotDriftItemField: item.field || item.label || "",
                      cliBridgeRunnerDryRunSnapshotDriftItemDecision: "confirmed"
                    }
                  }),
                  createElement("button", {
                    className: "btn governance-action-btn cli-bridge-runner-dry-run-snapshot-drift-item-defer-btn",
                    text: "Defer",
                    attrs: { type: "button" },
                    dataset: {
                      cliBridgeRunnerDryRunSnapshotDriftItemField: item.field || item.label || "",
                      cliBridgeRunnerDryRunSnapshotDriftItemDecision: "deferred"
                    }
                  }),
                  createElement("button", {
                    className: "btn governance-action-btn cli-bridge-runner-dry-run-snapshot-drift-item-escalate-btn",
                    text: "Escalate",
                    attrs: { type: "button" },
                    dataset: {
                      cliBridgeRunnerDryRunSnapshotDriftItemField: item.field || item.label || "",
                      cliBridgeRunnerDryRunSnapshotDriftItemDecision: "escalated"
                    }
                  })
                ])
              ])))
            : null,
          createElement("div", {
            className: "governance-actions"
          }, [
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-runner-dry-run-snapshot-diff-copy-btn",
              text: "Copy Drift",
              attrs: { type: "button" },
              dataset: {
                cliBridgeRunnerDryRunSnapshotDiffCopy: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-runner-dry-run-snapshot-drift-task-btn",
              text: "Track Drift",
              attrs: { type: "button" },
              dataset: {
                cliBridgeRunnerDryRunSnapshotDriftTaskId: cliBridgeRunnerDryRunSnapshotDiffActionId
              }
            }),
            governance.cliBridgeRunnerDryRunSnapshotDiff.status === "ready"
              ? createElement("button", {
                  className: "btn governance-action-btn cli-bridge-runner-dry-run-snapshot-drift-accept-btn",
                  text: "Accept Drift",
                  attrs: { type: "button" },
                  dataset: {
                    cliBridgeRunnerDryRunSnapshotDriftAcceptId: cliBridgeRunnerDryRunSnapshotDiffActionId
                  }
                })
              : null
          ])
        ])
      ]
    : [];

  const cliBridgeRunTraceSnapshotEntries = (governance.cliBridgeRunTraceSnapshots || []).map((snapshot) => createElement("div", {
    className: "governance-gap-card cli-bridge-run-trace-snapshot-card",
    dataset: snapshot.projectId ? { openAppId: encodeAppId(snapshot.projectId) } : undefined,
    title: snapshot.projectId ? "Open project workbench" : undefined,
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
          text: snapshot.title || "CLI Bridge Run Trace",
          style: {
            fontWeight: "800",
            color: "var(--text)"
          }
        }),
        createElement("div", {
          text: `${snapshot.projectName || snapshot.projectId || "Portfolio"} | ${new Date(snapshot.createdAt).toLocaleString()}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            lineHeight: "1.45"
          }
        })
      ]),
      createTag(snapshot.traceDecision || "review", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: snapshot.traceDecision === "ready" ? "var(--success)" : snapshot.traceDecision === "hold" ? "var(--danger)" : "var(--warning)"
      })
    ]),
    createElement("div", {
      className: "tags"
    }, [
      createTag(`run ${snapshot.runId || "unknown"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--primary)"
      }),
      createTag(`${snapshot.relatedHandoffCount || 0} handoff(s)`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: (snapshot.relatedHandoffCount || 0) ? "var(--success)" : "var(--warning)"
      }),
      createTag(`target ${snapshot.profileTargetTaskLedgerBaselineHealth || "missing"}/${snapshot.profileTargetTaskLedgerBaselineFreshness || "missing"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: snapshot.profileTargetTaskLedgerBaselineHealth === "healthy" ? "var(--success)" : snapshot.profileTargetTaskLedgerBaselineHealth === "missing" ? "var(--danger)" : "var(--warning)"
      }),
      createTag(`audit ${snapshot.targetBaselineAuditLedgerBaselineHealth || "missing"}/${snapshot.targetBaselineAuditLedgerBaselineFreshness || "missing"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: snapshot.targetBaselineAuditLedgerBaselineHealth === "healthy" ? "var(--success)" : snapshot.targetBaselineAuditLedgerBaselineHealth === "missing" ? "var(--danger)" : "var(--warning)"
      }),
      snapshot.latestCliBridgeResultHandoffId
        ? createTag(`result ${snapshot.latestCliBridgeResultHandoffId}`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)"
          })
        : null,
      snapshot.latestCliBridgeReviewHandoffId
        ? createTag(`review ${snapshot.latestCliBridgeReviewHandoffId}`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)"
          })
        : null
    ]),
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn cli-bridge-run-trace-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: {
          cliBridgeRunTraceSnapshotCopyId: snapshot.id || ""
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn cli-bridge-run-trace-snapshot-drift-copy-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: {
          cliBridgeRunTraceSnapshotDriftId: snapshot.id || ""
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn cli-bridge-run-trace-snapshot-drift-task-btn",
        text: "Track Drift",
        attrs: { type: "button" },
        dataset: {
          cliBridgeRunTraceSnapshotDriftTaskId: snapshot.id || ""
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn cli-bridge-run-trace-snapshot-drift-accept-btn",
        text: "Accept Drift",
        attrs: snapshot.runId ? { type: "button" } : { type: "button", disabled: "disabled", "aria-disabled": "true" },
        dataset: {
          cliBridgeRunTraceSnapshotDriftAcceptId: snapshot.id || ""
        }
      })
    ])
  ]));

  const cliBridgeRunTraceSnapshotBaselineStatus = governance.cliBridgeRunTraceSnapshotBaselineStatus;
  const cliBridgeRunTraceSnapshotBaselineStatusEntries = cliBridgeRunTraceSnapshotBaselineStatus
    ? [
        createElement("div", {
          className: "governance-gap-card cli-bridge-run-trace-baseline-status-card",
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
              gap: "0.8rem",
              alignItems: "flex-start"
            }
          }, [
            createElement("div", {}, [
              createElement("div", {
                text: cliBridgeRunTraceSnapshotBaselineStatus.hasBaseline
                  ? (cliBridgeRunTraceSnapshotBaselineStatus.title || "CLI Bridge Run Trace Baseline")
                  : "No CLI bridge trace baseline selected",
                style: {
                  color: "var(--text)",
                  fontWeight: "900",
                  fontSize: "1.02rem"
                }
              }),
              createElement("div", {
                text: cliBridgeRunTraceSnapshotBaselineStatus.hasBaseline && cliBridgeRunTraceSnapshotBaselineStatus.createdAt
                  ? `${new Date(cliBridgeRunTraceSnapshotBaselineStatus.createdAt).toLocaleString()} | run ${cliBridgeRunTraceSnapshotBaselineStatus.runId || "unknown"}`
                  : `${cliBridgeRunTraceSnapshotBaselineStatus.snapshotCount || 0} saved trace snapshot(s) available`,
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.86rem",
                  lineHeight: "1.45",
                  marginTop: "0.25rem"
                }
              })
            ]),
            createTag((cliBridgeRunTraceSnapshotBaselineStatus.health || "missing").toUpperCase(), {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeRunTraceSnapshotBaselineStatus.health === "healthy"
                ? "var(--success)"
                : cliBridgeRunTraceSnapshotBaselineStatus.health === "drifted" || cliBridgeRunTraceSnapshotBaselineStatus.health === "missing"
                  ? "var(--danger)"
                  : "var(--warning)"
            })
          ]),
          createElement("div", {
            className: "tags"
          }, [
            createTag(cliBridgeRunTraceSnapshotBaselineStatus.hasBaseline ? "BASELINE SET" : "BASELINE MISSING", {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeRunTraceSnapshotBaselineStatus.hasBaseline ? "var(--success)" : "var(--warning)"
            }),
            createTag((cliBridgeRunTraceSnapshotBaselineStatus.freshness || "missing").toUpperCase(), {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeRunTraceSnapshotBaselineStatus.freshness === "fresh" ? "var(--success)" : "var(--warning)"
            }),
            createTag(`drift ${cliBridgeRunTraceSnapshotBaselineStatus.driftScore || 0}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeRunTraceSnapshotBaselineStatus.hasDrift ? "var(--warning)" : "var(--success)"
            }),
            createTag((cliBridgeRunTraceSnapshotBaselineStatus.driftSeverity || "missing-baseline").toUpperCase(), {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeRunTraceSnapshotBaselineStatus.driftSeverity === "none" ? "var(--success)" : "var(--warning)"
            })
          ]),
          createElement("div", {
            text: cliBridgeRunTraceSnapshotBaselineStatus.hasBaseline
              ? `Freshness: ${cliBridgeRunTraceSnapshotBaselineStatus.ageHours || 0}h old | stale after ${cliBridgeRunTraceSnapshotBaselineStatus.freshnessThresholdHours || 24}h`
              : `Freshness: missing | stale threshold ${cliBridgeRunTraceSnapshotBaselineStatus.freshnessThresholdHours || 24}h`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `Baseline health: ${cliBridgeRunTraceSnapshotBaselineStatus.health || "missing"} | ${cliBridgeRunTraceSnapshotBaselineStatus.recommendedAction || "Save a CLI bridge run trace snapshot before relying on trace baseline drift."}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `Drift action: ${cliBridgeRunTraceSnapshotBaselineStatus.driftRecommendedAction || "Save a CLI bridge run trace snapshot before comparing drift."}`,
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
              className: "btn governance-action-btn cli-bridge-run-trace-baseline-status-copy-btn",
              text: "Copy Baseline Status",
              attrs: { type: "button" },
              dataset: {
                cliBridgeRunTraceBaselineStatusCopy: "true"
              }
            })
          ])
        ])
      ]
    : [];

  const cliBridgeRunTraceSnapshotLifecycleLedger = governance.cliBridgeRunTraceSnapshotLifecycleLedger;
  const cliBridgeRunTraceSnapshotLifecycleLedgerItems = cliBridgeRunTraceSnapshotLifecycleLedger?.items || [];
  const cliBridgeRunTraceSnapshotLifecycleLedgerEntries = cliBridgeRunTraceSnapshotLifecycleLedger
    ? [
        createElement("div", {
          className: "governance-gap-card cli-bridge-run-trace-lifecycle-ledger-card",
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
              gap: "0.8rem",
              alignItems: "flex-start"
            }
          }, [
            createElement("div", {}, [
              createElement("div", {
                text: "Run trace lifecycle ledger",
                style: {
                  color: "var(--text)",
                  fontWeight: "900",
                  fontSize: "1.02rem"
                }
              }),
              createElement("div", {
                text: cliBridgeRunTraceSnapshotLifecycleLedgerItems.length
                  ? `Latest: ${cliBridgeRunTraceSnapshotLifecycleLedger.summary?.latestTitle || cliBridgeRunTraceSnapshotLifecycleLedger.summary?.latestSnapshotId || "saved trace"}`
                  : "No saved CLI bridge run trace lifecycle records matched this view.",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.86rem",
                  lineHeight: "1.45",
                  marginTop: "0.25rem"
                }
              })
            ]),
            createTag(`${cliBridgeRunTraceSnapshotLifecycleLedger.summary?.visible || 0} visible`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: (cliBridgeRunTraceSnapshotLifecycleLedger.summary?.visible || 0) ? "var(--success)" : "var(--warning)"
            })
          ]),
          createElement("div", {
            className: "tags"
          }, [
            createTag(`total ${cliBridgeRunTraceSnapshotLifecycleLedger.summary?.total || 0}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)"
            }),
            createTag(`ready ${cliBridgeRunTraceSnapshotLifecycleLedger.summary?.ready || 0}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--success)"
            }),
            createTag(`review ${cliBridgeRunTraceSnapshotLifecycleLedger.summary?.review || 0}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--warning)"
            }),
            createTag(`accepted drift ${cliBridgeRunTraceSnapshotLifecycleLedger.summary?.acceptedDrift || 0}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: (cliBridgeRunTraceSnapshotLifecycleLedger.summary?.acceptedDrift || 0) ? "var(--warning)" : "var(--success)"
            })
          ]),
          cliBridgeRunTraceSnapshotLifecycleLedgerItems.length
            ? createElement("div", {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.45rem"
                }
              }, cliBridgeRunTraceSnapshotLifecycleLedgerItems.slice(0, 6).map((item) => createElement("div", {
                className: "governance-gap-card",
                dataset: item.projectId ? { openAppId: encodeAppId(item.projectId) } : undefined,
                title: item.projectId ? "Open project workbench" : undefined,
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.45rem",
                  padding: "0.7rem",
                  background: "var(--bg)"
                }
              }, [
                createElement("div", {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.6rem",
                    alignItems: "flex-start"
                  }
                }, [
                  createElement("div", {
                    text: item.title || "CLI Bridge Run Trace",
                    style: {
                      color: "var(--text)",
                      fontWeight: "800"
                    }
                  }),
                  createTag(item.lifecycleAction || "snapshot-saved", {
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: item.lifecycleAction === "accepted-drift-baseline" ? "var(--warning)" : "var(--success)"
                  })
                ]),
                createElement("div", {
                  text: `${item.traceDecision || "review"} | ${item.createdAt ? new Date(item.createdAt).toLocaleString() : "saved"} | ${item.projectName || item.projectId || "Portfolio"} | run ${item.runId || "unknown"}`,
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.84rem",
                    lineHeight: "1.45"
                  }
                }),
                createElement("div", {
                  text: `Baselines: profile ${item.profileTargetTaskLedgerBaselineHealth || "missing"} | audit ${item.targetBaselineAuditLedgerBaselineHealth || "missing"} | handoffs ${item.relatedHandoffCount || 0}`,
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.82rem",
                    lineHeight: "1.45"
                  }
                }),
                createElement("div", {
                  className: "governance-actions"
                }, [
                  createElement("button", {
                    className: "btn governance-action-btn cli-bridge-run-trace-lifecycle-ledger-item-task-btn",
                    text: "Track Item",
                    attrs: { type: "button" },
                    dataset: {
                      cliBridgeRunTraceLifecycleLedgerItemTaskId: item.snapshotId || ""
                    }
                  })
                ])
              ])))
            : null,
          createElement("div", {
            className: "governance-actions"
          }, [
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-run-trace-lifecycle-ledger-copy-btn",
              text: "Copy Trace Ledger",
              attrs: { type: "button" },
              dataset: {
                cliBridgeRunTraceLifecycleLedgerCopy: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-run-trace-lifecycle-ledger-task-btn",
              text: "Track Trace Ledger",
              attrs: { type: "button" },
              dataset: {
                cliBridgeRunTraceLifecycleLedgerTask: "true"
              }
            })
          ])
        ])
      ]
    : [];

  const cliBridgeLifecycleStackStatus = governance.cliBridgeLifecycleStackStatus;
  const cliBridgeLifecycleStackStatusColor = cliBridgeLifecycleStackStatus?.decision === "ready"
    ? "var(--success)"
    : cliBridgeLifecycleStackStatus?.decision === "hold"
      ? "var(--danger)"
      : "var(--warning)";
  const cliBridgeLifecycleStackStatusEntries = cliBridgeLifecycleStackStatus
    ? [
        createElement("div", {
          className: "governance-gap-card cli-bridge-lifecycle-stack-status-card",
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
              gap: "0.8rem",
              alignItems: "flex-start"
            }
          }, [
            createElement("div", {}, [
              createElement("div", {
                text: "CLI bridge lifecycle stack",
                style: {
                  color: "var(--text)",
                  fontWeight: "900",
                  fontSize: "1.02rem"
                }
              }),
              createElement("div", {
                text: cliBridgeLifecycleStackStatus.recommendedAction || "Review CLI bridge lifecycle status before runner work.",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.86rem",
                  lineHeight: "1.45",
                  marginTop: "0.25rem"
                }
              })
            ]),
            createTag((cliBridgeLifecycleStackStatus.decision || "review").toUpperCase(), {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeLifecycleStackStatusColor
            })
          ]),
          createElement("div", {
            className: "tags"
          }, [
            createTag(`ready ${cliBridgeLifecycleStackStatus.readyCount || 0}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--success)"
            }),
            createTag(`review ${cliBridgeLifecycleStackStatus.reviewCount || 0}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--warning)"
            }),
            createTag(`hold ${cliBridgeLifecycleStackStatus.holdCount || 0}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: (cliBridgeLifecycleStackStatus.holdCount || 0) ? "var(--danger)" : "var(--text-muted)"
            }),
            createTag(cliBridgeLifecycleStackStatus.handoffGate?.allowed ? "HANDOFF ALLOWED" : "HANDOFF BLOCKED", {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeLifecycleStackStatus.handoffGate?.allowed ? "var(--success)" : "var(--danger)"
            })
          ]),
          createElement("div", {
            text: `Handoff gate: ${cliBridgeLifecycleStackStatus.handoffGate?.decision || "review"} | ${cliBridgeLifecycleStackStatus.handoffGate?.recommendedAction || "Review CLI bridge lifecycle status before runner work."}`,
            style: {
              color: cliBridgeLifecycleStackStatus.handoffGate?.allowed ? "var(--text-muted)" : "var(--warning)",
              fontSize: "0.86rem",
              lineHeight: "1.45"
            }
          }),
          createElement("div", {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "0.45rem"
            }
          }, (cliBridgeLifecycleStackStatus.stages || []).map((stage) => createElement("div", {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
              padding: "0.65rem",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              background: "var(--bg)"
            }
          }, [
            createElement("div", {
              style: {
                display: "flex",
                justifyContent: "space-between",
                gap: "0.6rem",
                alignItems: "flex-start"
              }
            }, [
              createElement("div", {
                text: stage.label || stage.id || "Lifecycle stage",
                style: {
                  color: "var(--text)",
                  fontWeight: "800"
                }
              }),
              createTag(stage.decision || "review", {
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: stage.decision === "ready" ? "var(--success)" : stage.decision === "hold" ? "var(--danger)" : "var(--warning)"
              })
            ]),
            createElement("div", {
              text: stage.detail || "No detail recorded.",
              style: {
                color: "var(--text-muted)",
                fontSize: "0.84rem",
                lineHeight: "1.45"
              }
            }),
            createElement("div", {
              text: `Action: ${stage.action || "Review before continuing."}`,
              style: {
                color: "var(--text-muted)",
                fontSize: "0.82rem",
                lineHeight: "1.45"
              }
            })
          ]))),
          createElement("div", {
            className: "governance-actions"
          }, [
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-lifecycle-stack-status-copy-btn",
              text: "Copy Stack Status",
              attrs: { type: "button" },
              dataset: {
                cliBridgeLifecycleStackStatusCopy: "true"
              }
            })
          ])
        ])
      ]
    : [];

  const cliBridgeLifecycleStackRemediationPack = governance.cliBridgeLifecycleStackRemediationPack;
  const cliBridgeLifecycleStackRemediationPackEntries = cliBridgeLifecycleStackRemediationPack
    ? [
        createElement("div", {
          className: "governance-gap-card cli-bridge-lifecycle-stack-remediation-pack-card",
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
              gap: "0.8rem",
              alignItems: "flex-start"
            }
          }, [
            createElement("div", {}, [
              createElement("div", {
                text: "CLI bridge lifecycle remediation pack",
                style: {
                  color: "var(--text)",
                  fontWeight: "900",
                  fontSize: "1.02rem"
                }
              }),
              createElement("div", {
                text: cliBridgeLifecycleStackRemediationPack.recommendedAction || "Review CLI bridge lifecycle remediation before runner work.",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.86rem",
                  lineHeight: "1.45",
                  marginTop: "0.25rem"
                }
              })
            ]),
            createTag(cliBridgeLifecycleStackRemediationPack.readyToRun ? "READY" : "REMEDIATE", {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeLifecycleStackRemediationPack.readyToRun ? "var(--success)" : "var(--warning)"
            })
          ]),
          createElement("div", {
            className: "tags"
          }, [
            createTag(`${cliBridgeLifecycleStackRemediationPack.nonReadyCount || 0} non-ready`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: (cliBridgeLifecycleStackRemediationPack.nonReadyCount || 0) ? "var(--warning)" : "var(--success)"
            }),
            createTag(`${cliBridgeLifecycleStackRemediationPack.workItemCount || 0} work item(s)`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: (cliBridgeLifecycleStackRemediationPack.workItemCount || 0) ? "var(--primary)" : "var(--text-muted)"
            })
          ]),
          (cliBridgeLifecycleStackRemediationPack.workItems || []).length
            ? createElement("div", {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.45rem"
                }
              }, cliBridgeLifecycleStackRemediationPack.workItems.slice(0, 6).map((item) => createElement("div", {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                  padding: "0.65rem",
                  border: "1px solid var(--border)",
                  borderRadius: "0.75rem",
                  background: "var(--bg)"
                }
              }, [
                createElement("div", {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.6rem",
                    alignItems: "flex-start"
                  }
                }, [
                  createElement("div", {
                    text: item.title || item.id || "CLI bridge lifecycle work item",
                    style: {
                      color: "var(--text)",
                      fontWeight: "800"
                    }
                  }),
                  createTag(item.priority || "medium", {
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: item.priority === "high" ? "var(--danger)" : "var(--warning)"
                  })
                ]),
                createElement("div", {
                  text: item.recommendedAction || "Review and resolve before continuing.",
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.84rem",
                    lineHeight: "1.45"
                  }
                }),
                createElement("div", {
                  text: item.runnerHint || "Operator-supervised CLI bridge work only.",
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.82rem",
                    lineHeight: "1.45"
                  }
                }),
                createElement("div", {
                  className: "governance-actions"
                }, [
                  createElement("button", {
                    className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-item-task-btn",
                    text: "Track Item",
                    attrs: { type: "button" },
                    dataset: {
                      cliBridgeLifecycleStackRemediationItemTaskId: item.id || ""
                    }
                  })
                ])
              ])))
            : createElement("div", {
                text: "No remediation work items are required for the current lifecycle stack.",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.86rem",
                  lineHeight: "1.45"
                }
              }),
          createElement("div", {
            className: "governance-actions"
          }, [
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-pack-copy-btn",
              text: "Copy Remediation Pack",
              attrs: { type: "button" },
              dataset: {
                cliBridgeLifecycleStackRemediationPackCopy: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-pack-task-btn",
              text: "Track Pack",
              attrs: { type: "button" },
              dataset: {
                cliBridgeLifecycleStackRemediationPackTask: "true"
              }
            })
          ])
        ])
      ]
    : [];

  const cliBridgeLifecycleHandoffPacket = governance.cliBridgeLifecycleHandoffPacket;
  const cliBridgeLifecycleHandoffPacketColor = cliBridgeLifecycleHandoffPacket?.packetDecision === "ready"
    ? "var(--success)"
    : cliBridgeLifecycleHandoffPacket?.packetDecision === "hold"
      ? "var(--danger)"
      : "var(--warning)";
  const cliBridgeLifecycleHandoffPacketEntries = cliBridgeLifecycleHandoffPacket
    ? [
        createElement("div", {
          className: "governance-gap-card cli-bridge-lifecycle-handoff-packet-card",
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
              gap: "0.8rem",
              alignItems: "flex-start"
            }
          }, [
            createElement("div", {}, [
              createElement("div", {
                text: "CLI bridge lifecycle handoff packet",
                style: {
                  color: "var(--text)",
                  fontWeight: "900",
                  fontSize: "1.02rem"
                }
              }),
              createElement("div", {
                text: cliBridgeLifecycleHandoffPacket.recommendedAction || "Review CLI bridge lifecycle handoff packet before runner work.",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.86rem",
                  lineHeight: "1.45",
                  marginTop: "0.25rem"
                }
              })
            ]),
            createTag((cliBridgeLifecycleHandoffPacket.packetDecision || "review").toUpperCase(), {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeLifecycleHandoffPacketColor
            })
          ]),
          createElement("div", {
            className: "tags"
          }, [
            createTag(cliBridgeLifecycleHandoffPacket.readyToLaunch ? "READY TO LAUNCH" : "LAUNCH BLOCKED", {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeLifecycleHandoffPacket.readyToLaunch ? "var(--success)" : "var(--danger)"
            }),
            createTag(`runner ${cliBridgeLifecycleHandoffPacket.runner || "all"}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--primary)"
            }),
            createTag(`scope ${cliBridgeLifecycleHandoffPacket.scopeContext?.scopeMode || "project"} / ${cliBridgeLifecycleHandoffPacket.scopeContext?.activeProjectName || cliBridgeLifecycleHandoffPacket.scopeContext?.activeProjectId || "none"}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeLifecycleHandoffPacket.scopeContext?.scopeReady ? "var(--success)" : "var(--danger)"
            }),
            createTag(`${cliBridgeLifecycleHandoffPacket.remediationPack?.workItemCount || 0} work item(s)`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: (cliBridgeLifecycleHandoffPacket.remediationPack?.workItemCount || 0) ? "var(--warning)" : "var(--success)"
            }),
            createTag(`baseline ${cliBridgeLifecycleHandoffPacket.remediationTaskLedgerBaselineStatus?.health || "missing"}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeLifecycleHandoffPacket.remediationTaskLedgerBaselineStatus?.health === "healthy" ? "var(--success)" : "var(--warning)"
            })
          ]),
          createElement("div", {
            text: `Handoff gate: ${cliBridgeLifecycleHandoffPacket.handoffGate?.decision || "review"} | ${cliBridgeLifecycleHandoffPacket.handoffGate?.recommendedAction || "Review CLI bridge lifecycle status before runner work."}`,
            style: {
              color: cliBridgeLifecycleHandoffPacket.readyToLaunch ? "var(--text-muted)" : "var(--warning)",
              fontSize: "0.86rem",
              lineHeight: "1.45"
            }
          }),
          createElement("div", {
            text: `Bridge context: ${cliBridgeLifecycleHandoffPacket.bridgeContext?.bridgeDecision || "review"} | executable work orders ${cliBridgeLifecycleHandoffPacket.bridgeContext?.executableWorkOrderCount || 0} | refresh gate ${cliBridgeLifecycleHandoffPacket.remediationTaskLedgerBaselineStatus?.refreshGateDecision || "hold"}`,
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
              className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-copy-btn",
              text: "Copy Packet",
              attrs: { type: "button" },
              dataset: {
                cliBridgeLifecycleHandoffPacketRunner: cliBridgeLifecycleHandoffPacket.runner || "all"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-copy-btn",
              text: "Copy Codex Packet",
              attrs: { type: "button" },
              dataset: {
                cliBridgeLifecycleHandoffPacketRunner: "codex"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-copy-btn",
              text: "Copy Claude Packet",
              attrs: { type: "button" },
              dataset: {
                cliBridgeLifecycleHandoffPacketRunner: "claude"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-snapshot-btn",
              text: "Save Snapshot",
              attrs: { type: "button" },
              dataset: {
                cliBridgeLifecycleHandoffPacketSnapshotRunner: cliBridgeLifecycleHandoffPacket.runner || "all"
              }
            })
          ])
        ])
      ]
    : [];

  const cliBridgeLifecycleHandoffPacketBaselineStatus = governance.cliBridgeLifecycleHandoffPacketBaselineStatus || null;
  const cliBridgeLifecycleHandoffPacketBaselineRefreshAllowed = cliBridgeLifecycleHandoffPacketBaselineStatus?.refreshAllowed !== false;
  const cliBridgeLifecycleHandoffPacketBaselineRefreshDecision = cliBridgeLifecycleHandoffPacketBaselineStatus?.refreshGateDecision || "review";
  const cliBridgeLifecycleHandoffPacketBaselineRefreshTitle = cliBridgeLifecycleHandoffPacketBaselineRefreshAllowed
    ? "Accept the current live lifecycle handoff packet as the refreshed reusable baseline."
    : cliBridgeLifecycleHandoffPacketBaselineStatus?.refreshGateRecommendedAction || "Resolve lifecycle handoff packet refresh gate holds before accepting drift.";

  const cliBridgeLifecycleHandoffPacketSnapshotEntries = (governance.cliBridgeLifecycleHandoffPacketSnapshots || []).slice(0, 8).map((snapshot) => createElement("div", {
    className: "governance-gap-card cli-bridge-lifecycle-handoff-packet-snapshot-card",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.65rem"
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
          text: snapshot.title || "CLI bridge lifecycle handoff packet snapshot",
          style: {
            color: "var(--text)",
            fontWeight: "850"
          }
        }),
        createElement("div", {
          text: `${snapshot.runner || "all"} | ${snapshot.createdAt ? new Date(snapshot.createdAt).toLocaleString() : "saved"} | ${snapshot.recommendedAction || "Review packet before runner work."}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            marginTop: "0.28rem",
            lineHeight: "1.45"
          }
        })
      ]),
      createTag(snapshot.packetDecision || "review", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: snapshot.packetDecision === "ready" ? "var(--success)" : snapshot.packetDecision === "hold" ? "var(--danger)" : "var(--warning)"
      })
    ]),
    createElement("div", {
      className: "tags"
    }, [
      createTag(snapshot.readyToLaunch ? "launch allowed" : "launch blocked", {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: snapshot.readyToLaunch ? "var(--success)" : "var(--danger)"
      }),
      createTag(`${snapshot.remediationWorkItemCount || 0} work item(s)`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: (snapshot.remediationWorkItemCount || 0) ? "var(--warning)" : "var(--success)"
      }),
      createTag(`scope ${snapshot.scopeMode || "project"} / ${snapshot.activeProjectName || snapshot.activeProjectId || "none"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: snapshot.scopeReady ? "var(--success)" : "var(--danger)"
      }),
      createTag(`baseline ${snapshot.remediationBaselineHealth || "missing"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: snapshot.remediationBaselineHealth === "healthy" ? "var(--success)" : "var(--warning)"
      }),
      createTag(`bridge ${snapshot.bridgeDecision || "review"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: snapshot.bridgeDecision === "ready" ? "var(--success)" : snapshot.bridgeDecision === "hold" ? "var(--danger)" : "var(--warning)"
      })
    ]),
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: {
          cliBridgeLifecycleHandoffPacketSnapshotCopyId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-snapshot-diff-copy-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: {
          cliBridgeLifecycleHandoffPacketSnapshotDriftId: snapshot.id,
          cliBridgeLifecycleHandoffPacketSnapshotDriftRunner: snapshot.runner || "all"
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-snapshot-refresh-btn",
        text: cliBridgeLifecycleHandoffPacketBaselineRefreshAllowed ? "Refresh Baseline" : "Gate Hold",
        title: cliBridgeLifecycleHandoffPacketBaselineRefreshTitle,
        attrs: {
          type: "button",
          ...(cliBridgeLifecycleHandoffPacketBaselineRefreshAllowed ? {} : { disabled: "true" })
        },
        dataset: {
          cliBridgeLifecycleHandoffPacketSnapshotRefreshId: snapshot.id,
          cliBridgeLifecycleHandoffPacketSnapshotRefreshRunner: snapshot.runner || "all"
        }
      })
    ])
  ]));

  const cliBridgeLifecycleHandoffPacketSnapshotDiff = governance.cliBridgeLifecycleHandoffPacketSnapshotDiff || null;
  const cliBridgeLifecycleHandoffPacketSnapshotDiffEntries = cliBridgeLifecycleHandoffPacketSnapshotDiff
    ? [
        createElement("div", {
          className: "governance-gap-card cli-bridge-lifecycle-handoff-packet-snapshot-drift-card",
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "0.7rem"
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
                text: cliBridgeLifecycleHandoffPacketSnapshotDiff.hasSnapshot
                  ? (cliBridgeLifecycleHandoffPacketSnapshotDiff.snapshotTitle || "Latest lifecycle handoff packet snapshot")
                  : "No lifecycle handoff packet snapshot",
                style: {
                  color: "var(--text)",
                  fontWeight: "850"
                }
              }),
              createElement("div", {
                text: cliBridgeLifecycleHandoffPacketSnapshotDiff.recommendedAction || "Save a CLI bridge lifecycle handoff packet snapshot before comparing drift.",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.84rem",
                  marginTop: "0.28rem",
                  lineHeight: "1.45"
                }
              })
            ]),
            createTag(cliBridgeLifecycleHandoffPacketSnapshotDiff.driftSeverity || "missing-snapshot", {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeLifecycleHandoffPacketSnapshotDiff.driftSeverity === "high" || cliBridgeLifecycleHandoffPacketSnapshotDiff.driftSeverity === "missing-snapshot"
                ? "var(--danger)"
                : cliBridgeLifecycleHandoffPacketSnapshotDiff.driftSeverity === "none"
                  ? "var(--success)"
                  : "var(--warning)"
            })
          ]),
          createElement("div", {
            text: `${cliBridgeLifecycleHandoffPacketSnapshotDiff.driftScore || 0} drift score | ${(cliBridgeLifecycleHandoffPacketSnapshotDiff.driftItems || []).length} drift item(s) | runner ${cliBridgeLifecycleHandoffPacketSnapshotDiff.runner || "all"}`,
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
              className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-snapshot-diff-copy-btn",
              text: "Copy Latest Drift",
              attrs: { type: "button" },
              dataset: {
                cliBridgeLifecycleHandoffPacketSnapshotDriftId: cliBridgeLifecycleHandoffPacketSnapshotDiff.snapshotId || "latest",
                cliBridgeLifecycleHandoffPacketSnapshotDriftRunner: cliBridgeLifecycleHandoffPacketSnapshotDiff.runner || "all"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-snapshot-refresh-btn",
              text: cliBridgeLifecycleHandoffPacketSnapshotDiff.hasSnapshot
                ? (cliBridgeLifecycleHandoffPacketBaselineRefreshAllowed ? "Accept Drift" : "Gate Hold")
                : (cliBridgeLifecycleHandoffPacketBaselineRefreshAllowed ? "Save Baseline" : "Gate Hold"),
              title: cliBridgeLifecycleHandoffPacketBaselineRefreshTitle,
              attrs: {
                type: "button",
                ...(cliBridgeLifecycleHandoffPacketBaselineRefreshAllowed ? {} : { disabled: "true" })
              },
              dataset: {
                cliBridgeLifecycleHandoffPacketSnapshotRefreshId: cliBridgeLifecycleHandoffPacketSnapshotDiff.snapshotId || "latest",
                cliBridgeLifecycleHandoffPacketSnapshotRefreshRunner: cliBridgeLifecycleHandoffPacketSnapshotDiff.runner || "all"
              }
            })
          ])
        ]),
        ...(cliBridgeLifecycleHandoffPacketSnapshotDiff.driftItems || []).slice(0, 8).map((item) => createElement("div", {
          className: "governance-gap-card cli-bridge-lifecycle-handoff-packet-snapshot-drift-item-card",
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem"
          }
        }, [
          createElement("div", {
            text: item.label || item.field || "Lifecycle handoff packet drift",
            style: {
              color: "var(--text)",
              fontWeight: "800"
            }
          }),
          createElement("div", {
            text: `${item.before ?? "missing"} -> ${item.current ?? "missing"}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          }),
          item.checkpointDecision ? createTag(`${item.checkpointDecision} / ${item.checkpointStatus || "open"}`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: item.checkpointDecision === "confirmed" ? "var(--success)" : item.checkpointDecision === "escalated" ? "var(--danger)" : "var(--warning)"
          }) : null,
          createElement("div", {
            className: "governance-actions"
          }, [
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-drift-checkpoint-btn",
              text: "Confirm",
              attrs: { type: "button" },
              dataset: {
                cliBridgeLifecycleHandoffPacketDriftSnapshotId: cliBridgeLifecycleHandoffPacketSnapshotDiff.snapshotId || "latest",
                cliBridgeLifecycleHandoffPacketDriftRunner: cliBridgeLifecycleHandoffPacketSnapshotDiff.runner || "all",
                cliBridgeLifecycleHandoffPacketDriftField: item.field || "",
                cliBridgeLifecycleHandoffPacketDriftDecision: "confirmed"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-drift-checkpoint-btn",
              text: "Defer",
              attrs: { type: "button" },
              dataset: {
                cliBridgeLifecycleHandoffPacketDriftSnapshotId: cliBridgeLifecycleHandoffPacketSnapshotDiff.snapshotId || "latest",
                cliBridgeLifecycleHandoffPacketDriftRunner: cliBridgeLifecycleHandoffPacketSnapshotDiff.runner || "all",
                cliBridgeLifecycleHandoffPacketDriftField: item.field || "",
                cliBridgeLifecycleHandoffPacketDriftDecision: "deferred"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-drift-checkpoint-btn",
              text: "Escalate",
              attrs: { type: "button" },
              dataset: {
                cliBridgeLifecycleHandoffPacketDriftSnapshotId: cliBridgeLifecycleHandoffPacketSnapshotDiff.snapshotId || "latest",
                cliBridgeLifecycleHandoffPacketDriftRunner: cliBridgeLifecycleHandoffPacketSnapshotDiff.runner || "all",
                cliBridgeLifecycleHandoffPacketDriftField: item.field || "",
                cliBridgeLifecycleHandoffPacketDriftDecision: "escalated"
              }
            })
          ])
        ]))
      ]
    : [];

  const cliBridgeLifecycleHandoffPacketDriftCheckpointLedger = governance.cliBridgeLifecycleHandoffPacketDriftCheckpointLedger || null;
  const cliBridgeLifecycleHandoffPacketDriftCheckpointSummary = cliBridgeLifecycleHandoffPacketDriftCheckpointLedger?.summary || {
    total: 0,
    visible: 0,
    open: 0,
    closed: 0,
    confirmed: 0,
    deferred: 0,
    escalated: 0,
    openEscalated: 0
  };
  const cliBridgeLifecycleHandoffPacketDriftCheckpointLedgerEntries = cliBridgeLifecycleHandoffPacketDriftCheckpointLedger ? [
    createElement("div", {
      className: "governance-gap-card cli-bridge-lifecycle-handoff-packet-drift-checkpoint-ledger-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
      }
    }, [
      createElement("div", {
        text: "CLI bridge handoff packet drift checkpoint ledger",
        style: {
          color: "var(--text)",
          fontWeight: "850"
        }
      }),
      createElement("div", {
        text: `${cliBridgeLifecycleHandoffPacketDriftCheckpointSummary.visible || 0} visible | ${cliBridgeLifecycleHandoffPacketDriftCheckpointSummary.open || 0} open | ${cliBridgeLifecycleHandoffPacketDriftCheckpointSummary.closed || 0} closed | ${cliBridgeLifecycleHandoffPacketDriftCheckpointSummary.openEscalated || 0} open escalated`,
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
          className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-drift-checkpoint-ledger-copy-btn",
          text: "Copy All",
          attrs: { type: "button" },
          dataset: { cliBridgeLifecycleHandoffPacketDriftCheckpointLedgerCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-drift-checkpoint-ledger-copy-btn",
          text: "Copy Open",
          attrs: { type: "button" },
          dataset: { cliBridgeLifecycleHandoffPacketDriftCheckpointLedgerCopy: "open" }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-drift-checkpoint-ledger-copy-btn",
          text: "Copy Closed",
          attrs: { type: "button" },
          dataset: { cliBridgeLifecycleHandoffPacketDriftCheckpointLedgerCopy: "closed" }
        })
      ])
    ]),
    ...(cliBridgeLifecycleHandoffPacketDriftCheckpointLedger.items || []).slice(0, 8).map((item) => createElement("div", {
      className: "governance-gap-card cli-bridge-lifecycle-handoff-packet-drift-checkpoint-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem"
      }
    }, [
      createElement("div", {
        text: item.title || item.cliBridgeLifecycleHandoffPacketDriftLabel || "CLI bridge handoff packet drift checkpoint",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: `${item.cliBridgeLifecycleHandoffPacketSnapshotTitle || item.cliBridgeLifecycleHandoffPacketSnapshotId || "Snapshot not recorded"} | runner ${item.cliBridgeLifecycleHandoffPacketRunner || "all"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        text: `${item.cliBridgeLifecycleHandoffPacketDriftBefore || "missing"} -> ${item.cliBridgeLifecycleHandoffPacketDriftCurrent || "missing"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createTag(`${item.cliBridgeLifecycleHandoffPacketDriftDecision || "deferred"} / ${item.status || "open"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.cliBridgeLifecycleHandoffPacketDriftDecision === "confirmed" ? "var(--success)" : item.cliBridgeLifecycleHandoffPacketDriftDecision === "escalated" ? "var(--danger)" : "var(--warning)"
      }),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-drift-checkpoint-task-btn",
          text: "Resolve",
          attrs: { type: "button" },
          dataset: {
            cliBridgeLifecycleHandoffPacketDriftCheckpointTaskId: item.id || "",
            cliBridgeLifecycleHandoffPacketDriftCheckpointTaskStatus: "resolved"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-drift-checkpoint-task-btn",
          text: "Reopen",
          attrs: { type: "button" },
          dataset: {
            cliBridgeLifecycleHandoffPacketDriftCheckpointTaskId: item.id || "",
            cliBridgeLifecycleHandoffPacketDriftCheckpointTaskStatus: "open"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-drift-checkpoint-task-btn",
          text: "Block",
          attrs: { type: "button" },
          dataset: {
            cliBridgeLifecycleHandoffPacketDriftCheckpointTaskId: item.id || "",
            cliBridgeLifecycleHandoffPacketDriftCheckpointTaskStatus: "blocked"
          }
        })
      ])
    ]))
  ] : [];

  const cliBridgeLifecycleHandoffPacketBaselineStatusEntries = cliBridgeLifecycleHandoffPacketBaselineStatus
    ? [
        createElement("div", {
          className: "governance-gap-card cli-bridge-lifecycle-handoff-packet-baseline-status-card",
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
              gap: "0.8rem",
              alignItems: "flex-start"
            }
          }, [
            createElement("div", {}, [
              createElement("div", {
                text: cliBridgeLifecycleHandoffPacketBaselineStatus.hasBaseline
                  ? (cliBridgeLifecycleHandoffPacketBaselineStatus.title || "CLI Bridge Handoff Packet Baseline")
                  : "No CLI bridge handoff packet baseline selected",
                style: {
                  color: "var(--text)",
                  fontWeight: "900",
                  fontSize: "1.02rem"
                }
              }),
              createElement("div", {
                text: cliBridgeLifecycleHandoffPacketBaselineStatus.hasBaseline && cliBridgeLifecycleHandoffPacketBaselineStatus.createdAt
                  ? `${new Date(cliBridgeLifecycleHandoffPacketBaselineStatus.createdAt).toLocaleString()} | runner ${cliBridgeLifecycleHandoffPacketBaselineStatus.runner || "all"}`
                  : `${cliBridgeLifecycleHandoffPacketBaselineStatus.snapshotCount || 0} saved lifecycle handoff packet snapshot(s) available`,
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.86rem",
                  lineHeight: "1.45",
                  marginTop: "0.25rem"
                }
              })
            ]),
            createTag((cliBridgeLifecycleHandoffPacketBaselineStatus.reuseGateDecision || "hold").toUpperCase(), {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeLifecycleHandoffPacketBaselineStatus.reuseGateDecision === "ready"
                ? "var(--success)"
                : cliBridgeLifecycleHandoffPacketBaselineStatus.reuseGateDecision === "hold"
                  ? "var(--danger)"
                  : "var(--warning)"
            })
          ]),
          createElement("div", {
            className: "tags"
          }, [
            createTag(`health ${cliBridgeLifecycleHandoffPacketBaselineStatus.health || "missing"}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeLifecycleHandoffPacketBaselineStatus.health === "healthy" ? "var(--success)" : cliBridgeLifecycleHandoffPacketBaselineStatus.health === "missing" || cliBridgeLifecycleHandoffPacketBaselineStatus.health === "drifted" ? "var(--danger)" : "var(--warning)"
            }),
            createTag(`freshness ${cliBridgeLifecycleHandoffPacketBaselineStatus.freshness || "missing"}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeLifecycleHandoffPacketBaselineStatus.freshness === "fresh" ? "var(--success)" : "var(--warning)"
            }),
            createTag(`drift ${cliBridgeLifecycleHandoffPacketBaselineStatus.driftSeverity || "missing-baseline"}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeLifecycleHandoffPacketBaselineStatus.driftSeverity === "none" ? "var(--success)" : cliBridgeLifecycleHandoffPacketBaselineStatus.driftSeverity === "high" || cliBridgeLifecycleHandoffPacketBaselineStatus.driftSeverity === "missing-baseline" ? "var(--danger)" : "var(--warning)"
            }),
            createTag(`${cliBridgeLifecycleHandoffPacketBaselineStatus.checkpointedDriftItemCount || 0}/${cliBridgeLifecycleHandoffPacketBaselineStatus.driftItemCount || 0} checkpointed`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: (cliBridgeLifecycleHandoffPacketBaselineStatus.uncheckpointedDriftItemCount || 0) ? "var(--warning)" : "var(--success)"
            }),
            createTag(`refresh ${cliBridgeLifecycleHandoffPacketBaselineRefreshDecision}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeLifecycleHandoffPacketBaselineRefreshDecision === "ready"
                ? "var(--success)"
                : cliBridgeLifecycleHandoffPacketBaselineRefreshDecision === "hold"
                  ? "var(--danger)"
                  : "var(--warning)"
            })
          ]),
          createElement("div", {
            text: cliBridgeLifecycleHandoffPacketBaselineStatus.refreshGateRecommendedAction || cliBridgeLifecycleHandoffPacketBaselineStatus.reuseGateRecommendedAction || cliBridgeLifecycleHandoffPacketBaselineStatus.recommendedAction || "Review lifecycle handoff packet baseline before reuse.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.86rem",
              lineHeight: "1.45"
            }
          }),
          createElement("div", {
            className: "governance-actions"
          }, [
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-baseline-status-copy-btn",
              text: "Copy Baseline Status",
              attrs: { type: "button" },
              dataset: {
                cliBridgeLifecycleHandoffPacketBaselineStatusCopy: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-lifecycle-handoff-packet-snapshot-refresh-btn",
              text: cliBridgeLifecycleHandoffPacketBaselineStatus.hasBaseline
                ? (cliBridgeLifecycleHandoffPacketBaselineRefreshAllowed ? "Refresh Baseline" : "Gate Hold")
                : (cliBridgeLifecycleHandoffPacketBaselineRefreshAllowed ? "Save Baseline" : "Gate Hold"),
              title: cliBridgeLifecycleHandoffPacketBaselineRefreshTitle,
              attrs: {
                type: "button",
                ...(cliBridgeLifecycleHandoffPacketBaselineRefreshAllowed ? {} : { disabled: "true" })
              },
              dataset: {
                cliBridgeLifecycleHandoffPacketSnapshotRefreshId: cliBridgeLifecycleHandoffPacketBaselineStatus.snapshotId || "latest",
                cliBridgeLifecycleHandoffPacketSnapshotRefreshRunner: cliBridgeLifecycleHandoffPacketBaselineStatus.runner || "all"
              }
            })
          ])
        ])
      ]
    : [];

  const cliBridgeLifecycleStackRemediationTaskLedger = governance.cliBridgeLifecycleStackRemediationTaskLedger;
  const cliBridgeLifecycleStackRemediationTaskLedgerItems = cliBridgeLifecycleStackRemediationTaskLedger?.items || [];
  const cliBridgeLifecycleStackRemediationTaskLedgerEntries = cliBridgeLifecycleStackRemediationTaskLedger
    ? [
        createElement("div", {
          className: "governance-gap-card cli-bridge-lifecycle-stack-remediation-task-ledger-card",
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
              gap: "0.8rem",
              alignItems: "flex-start"
            }
          }, [
            createElement("div", {}, [
              createElement("div", {
                text: "CLI bridge lifecycle remediation task ledger",
                style: {
                  color: "var(--text)",
                  fontWeight: "900",
                  fontSize: "1.02rem"
                }
              }),
              createElement("div", {
                text: cliBridgeLifecycleStackRemediationTaskLedgerItems.length
                  ? `Latest: ${cliBridgeLifecycleStackRemediationTaskLedger.summary?.latestTitle || cliBridgeLifecycleStackRemediationTaskLedger.summary?.latestTaskId || "task"}`
                  : "No CLI bridge lifecycle remediation tasks matched this view.",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.86rem",
                  lineHeight: "1.45",
                  marginTop: "0.25rem"
                }
              })
            ]),
            createTag(`${cliBridgeLifecycleStackRemediationTaskLedger.summary?.open || 0} open`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: (cliBridgeLifecycleStackRemediationTaskLedger.summary?.open || 0) ? "var(--warning)" : "var(--success)"
            })
          ]),
          createElement("div", {
            className: "tags"
          }, [
            createTag(`total ${cliBridgeLifecycleStackRemediationTaskLedger.summary?.total || 0}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)"
            }),
            createTag(`high ${cliBridgeLifecycleStackRemediationTaskLedger.summary?.high || 0}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: (cliBridgeLifecycleStackRemediationTaskLedger.summary?.high || 0) ? "var(--danger)" : "var(--text-muted)"
            }),
            createTag(`visible ${cliBridgeLifecycleStackRemediationTaskLedger.summary?.visible || 0}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: (cliBridgeLifecycleStackRemediationTaskLedger.summary?.visible || 0) ? "var(--primary)" : "var(--text-muted)"
            })
          ]),
          cliBridgeLifecycleStackRemediationTaskLedgerItems.length
            ? createElement("div", {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.45rem"
                }
              }, cliBridgeLifecycleStackRemediationTaskLedgerItems.slice(0, 6).map((item) => createElement("div", {
                className: "governance-gap-card",
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                  padding: "0.65rem",
                  background: "var(--bg)"
                }
              }, [
                createElement("div", {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.6rem",
                    alignItems: "flex-start"
                  }
                }, [
                  createElement("div", {
                    text: item.title || item.id || "CLI bridge lifecycle remediation task",
                    style: {
                      color: "var(--text)",
                      fontWeight: "800"
                    }
                  }),
                  createTag(item.status || "open", {
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: item.status === "closed" ? "var(--success)" : "var(--warning)"
                  })
                ]),
                createElement("div", {
                  text: `${item.priority || "medium"} | stage ${item.stageId || "pack"} | updated ${item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "unknown"}`,
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "0.84rem",
                    lineHeight: "1.45"
                  }
                })
              ])))
            : null,
          createElement("div", {
            className: "governance-actions"
          }, [
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-task-ledger-copy-btn",
              text: "Copy Task Ledger",
              attrs: { type: "button" },
              dataset: {
                cliBridgeLifecycleStackRemediationTaskLedgerCopy: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-task-ledger-snapshot-btn",
              text: "Save Snapshot",
              attrs: { type: "button" },
              dataset: {
                cliBridgeLifecycleStackRemediationTaskLedgerSnapshot: "true"
              }
            })
          ])
        ])
      ]
    : [];

  const cliBridgeLifecycleStackRemediationTaskLedgerBaselineRefreshAllowed = governance.cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus?.refreshAllowed !== false;
  const cliBridgeLifecycleStackRemediationTaskLedgerBaselineRefreshDecision = governance.cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus?.refreshGateDecision || "review";
  const cliBridgeLifecycleStackRemediationTaskLedgerBaselineRefreshTitle = cliBridgeLifecycleStackRemediationTaskLedgerBaselineRefreshAllowed
    ? "Refresh the saved remediation task ledger baseline from the current live ledger."
    : governance.cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus?.refreshGateRecommendedAction || "Resolve remediation task ledger refresh gate holds before accepting drift.";

  const cliBridgeLifecycleStackRemediationTaskLedgerSnapshotEntries = (governance.cliBridgeLifecycleStackRemediationTaskLedgerSnapshots || []).slice(0, 8).map((snapshot) => createElement("div", {
    className: "governance-gap-card cli-bridge-lifecycle-stack-remediation-task-ledger-snapshot-card",
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
          text: snapshot.title || "CLI bridge lifecycle remediation task ledger snapshot",
          style: {
            color: "var(--text)",
            fontWeight: "850"
          }
        }),
        createElement("div", {
          text: `${snapshot.statusFilter || "all"} | ${snapshot.createdAt ? new Date(snapshot.createdAt).toLocaleString() : "saved"} | ${snapshot.latestTitle || snapshot.latestTaskId || "no latest task"}`,
          style: {
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            marginTop: "0.28rem",
            lineHeight: "1.45"
          }
        })
      ]),
      createTag(`${snapshot.openCount || 0} open`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: snapshot.openCount ? "var(--warning)" : "var(--success)"
      })
    ]),
    createElement("div", {
      className: "tags"
    }, [
      createTag(`total ${snapshot.total || 0}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)"
      }),
      createTag(`visible ${snapshot.visibleCount || 0}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: (snapshot.visibleCount || 0) ? "var(--primary)" : "var(--text-muted)"
      }),
      createTag(`high ${snapshot.highCount || 0}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: snapshot.highCount ? "var(--danger)" : "var(--text-muted)"
      })
    ]),
    createElement("div", {
      text: snapshot.secretPolicy || "Non-secret CLI bridge lifecycle remediation task metadata only.",
      style: {
        color: "var(--text-muted)",
        fontSize: "0.82rem",
        lineHeight: "1.45"
      }
    }),
    createElement("div", {
      className: "governance-actions"
    }, [
      createElement("button", {
        className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-task-ledger-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: {
          cliBridgeLifecycleStackRemediationTaskLedgerSnapshotCopyId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-task-ledger-snapshot-diff-copy-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: {
          cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDriftId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-task-ledger-snapshot-refresh-btn",
        text: cliBridgeLifecycleStackRemediationTaskLedgerBaselineRefreshAllowed ? "Refresh Baseline" : "Gate Hold",
        title: cliBridgeLifecycleStackRemediationTaskLedgerBaselineRefreshTitle,
        attrs: {
          type: "button",
          ...(cliBridgeLifecycleStackRemediationTaskLedgerBaselineRefreshAllowed ? {} : { disabled: "true" })
        },
        dataset: {
          cliBridgeLifecycleStackRemediationTaskLedgerSnapshotRefreshId: snapshot.id,
          cliBridgeLifecycleStackRemediationTaskLedgerSnapshotRefreshStatus: snapshot.statusFilter || "all"
        }
      })
    ])
  ]));

  const cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff = governance.cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff || null;
  const cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiffEntries = cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff
    ? [
        createElement("div", {
          className: "governance-gap-card cli-bridge-lifecycle-stack-remediation-task-ledger-snapshot-drift-card",
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "0.7rem"
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
                text: cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.hasSnapshot
                  ? (cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.snapshotTitle || "Latest remediation task ledger snapshot")
                  : "No remediation task ledger snapshot",
                style: {
                  color: "var(--text)",
                  fontWeight: "850"
                }
              }),
              createElement("div", {
                text: cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.recommendedAction || "Save a remediation task ledger snapshot before comparing drift.",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.84rem",
                  marginTop: "0.28rem",
                  lineHeight: "1.45"
                }
              })
            ]),
            createTag(cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.driftSeverity || "missing-snapshot", {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.driftSeverity === "high" || cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.driftSeverity === "missing-snapshot"
                ? "var(--danger)"
                : cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.driftSeverity === "none"
                  ? "var(--success)"
                  : "var(--warning)"
            })
          ]),
          createElement("div", {
            text: `${cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.driftScore || 0} drift score | ${(cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.driftItems || []).length} drift item(s) | ${cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.status || "all"}`,
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
              className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-task-ledger-snapshot-diff-copy-btn",
              text: "Copy Latest Drift",
              attrs: { type: "button" },
              dataset: {
                cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDriftId: cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.snapshotId || "latest"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-task-ledger-snapshot-refresh-btn",
              text: cliBridgeLifecycleStackRemediationTaskLedgerBaselineRefreshAllowed
                ? (cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.hasSnapshot ? "Accept Drift" : "Save Baseline")
                : "Gate Hold",
              title: cliBridgeLifecycleStackRemediationTaskLedgerBaselineRefreshTitle,
              attrs: {
                type: "button",
                ...(cliBridgeLifecycleStackRemediationTaskLedgerBaselineRefreshAllowed ? {} : { disabled: "true" })
              },
              dataset: {
                cliBridgeLifecycleStackRemediationTaskLedgerSnapshotRefreshId: cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.snapshotId || "latest",
                cliBridgeLifecycleStackRemediationTaskLedgerSnapshotRefreshStatus: cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.status || "all"
              }
            })
          ])
        ]),
        ...(cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.driftItems || []).slice(0, 8).map((item) => createElement("div", {
          className: "governance-gap-card cli-bridge-lifecycle-stack-remediation-task-ledger-snapshot-drift-item-card",
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem"
          }
        }, [
          createElement("div", {
            text: item.label || item.field || "Remediation task ledger drift",
            style: {
              color: "var(--text)",
              fontWeight: "800"
            }
          }),
          createElement("div", {
            text: `${item.before ?? "missing"} -> ${item.current ?? "missing"}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              lineHeight: "1.45"
            }
          }),
          item.checkpointDecision ? createTag(`${item.checkpointDecision} / ${item.checkpointStatus || "open"}`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: item.checkpointDecision === "confirmed" ? "var(--success)" : item.checkpointDecision === "escalated" ? "var(--danger)" : "var(--warning)"
          }) : null,
          createElement("div", {
            className: "governance-actions"
          }, [
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-task-ledger-drift-checkpoint-btn",
              text: "Confirm",
              attrs: { type: "button" },
              dataset: {
                cliBridgeLifecycleStackRemediationTaskLedgerDriftSnapshotId: cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.snapshotId || "latest",
                cliBridgeLifecycleStackRemediationTaskLedgerDriftStatus: cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.status || "all",
                cliBridgeLifecycleStackRemediationTaskLedgerDriftField: item.field || "",
                cliBridgeLifecycleStackRemediationTaskLedgerDriftDecision: "confirmed"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-task-ledger-drift-checkpoint-btn",
              text: "Defer",
              attrs: { type: "button" },
              dataset: {
                cliBridgeLifecycleStackRemediationTaskLedgerDriftSnapshotId: cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.snapshotId || "latest",
                cliBridgeLifecycleStackRemediationTaskLedgerDriftStatus: cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.status || "all",
                cliBridgeLifecycleStackRemediationTaskLedgerDriftField: item.field || "",
                cliBridgeLifecycleStackRemediationTaskLedgerDriftDecision: "deferred"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-task-ledger-drift-checkpoint-btn",
              text: "Escalate",
              attrs: { type: "button" },
              dataset: {
                cliBridgeLifecycleStackRemediationTaskLedgerDriftSnapshotId: cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.snapshotId || "latest",
                cliBridgeLifecycleStackRemediationTaskLedgerDriftStatus: cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiff.status || "all",
                cliBridgeLifecycleStackRemediationTaskLedgerDriftField: item.field || "",
                cliBridgeLifecycleStackRemediationTaskLedgerDriftDecision: "escalated"
              }
            })
          ])
        ]))
      ]
    : [];

  const cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedger = governance.cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedger || null;
  const cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointSummary = cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedger?.summary || {
    total: 0,
    visible: 0,
    open: 0,
    closed: 0,
    confirmed: 0,
    deferred: 0,
    escalated: 0,
    openEscalated: 0
  };
  const cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedgerEntries = cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedger ? [
    createElement("div", {
      className: "governance-gap-card cli-bridge-lifecycle-stack-remediation-task-ledger-drift-checkpoint-ledger-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem"
      }
    }, [
      createElement("div", {
        text: "CLI bridge remediation task ledger drift checkpoint ledger",
        style: {
          color: "var(--text)",
          fontWeight: "850"
        }
      }),
      createElement("div", {
        text: `${cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointSummary.visible || 0} visible | ${cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointSummary.open || 0} open | ${cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointSummary.closed || 0} closed | ${cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointSummary.openEscalated || 0} open escalated`,
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
          className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-task-ledger-drift-checkpoint-ledger-copy-btn",
          text: "Copy All",
          attrs: { type: "button" },
          dataset: { cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedgerCopy: "all" }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-task-ledger-drift-checkpoint-ledger-copy-btn",
          text: "Copy Open",
          attrs: { type: "button" },
          dataset: { cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedgerCopy: "open" }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-task-ledger-drift-checkpoint-ledger-copy-btn",
          text: "Copy Closed",
          attrs: { type: "button" },
          dataset: { cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedgerCopy: "closed" }
        })
      ])
    ]),
    ...(cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedger.items || []).slice(0, 8).map((item) => createElement("div", {
      className: "governance-gap-card cli-bridge-lifecycle-stack-remediation-task-ledger-drift-checkpoint-item-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem"
      }
    }, [
      createElement("div", {
        text: item.title || item.cliBridgeLifecycleStackRemediationTaskLedgerDriftLabel || "CLI bridge remediation task ledger drift checkpoint",
        style: {
          color: "var(--text)",
          fontWeight: "800"
        }
      }),
      createElement("div", {
        text: `${item.cliBridgeLifecycleStackRemediationTaskLedgerSnapshotTitle || item.cliBridgeLifecycleStackRemediationTaskLedgerSnapshotId || "Snapshot not recorded"} | ${item.cliBridgeLifecycleStackRemediationTaskLedgerStatusFilter || "all"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createElement("div", {
        text: `${item.cliBridgeLifecycleStackRemediationTaskLedgerDriftBefore || "missing"} -> ${item.cliBridgeLifecycleStackRemediationTaskLedgerDriftCurrent || "missing"}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      }),
      createTag(`${item.cliBridgeLifecycleStackRemediationTaskLedgerDriftDecision || "deferred"} / ${item.status || "open"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.cliBridgeLifecycleStackRemediationTaskLedgerDriftDecision === "confirmed" ? "var(--success)" : item.cliBridgeLifecycleStackRemediationTaskLedgerDriftDecision === "escalated" ? "var(--danger)" : "var(--warning)"
      }),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-task-ledger-drift-checkpoint-task-btn",
          text: "Resolve",
          attrs: { type: "button" },
          dataset: {
            cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointTaskId: item.id || "",
            cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointTaskStatus: "resolved"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-task-ledger-drift-checkpoint-task-btn",
          text: "Reopen",
          attrs: { type: "button" },
          dataset: {
            cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointTaskId: item.id || "",
            cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointTaskStatus: "open"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-task-ledger-drift-checkpoint-task-btn",
          text: "Block",
          attrs: { type: "button" },
          dataset: {
            cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointTaskId: item.id || "",
            cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointTaskStatus: "blocked"
          }
        })
      ])
    ]))
  ] : [];

  const cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus = governance.cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus || null;
  const cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusEntries = cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus
    ? [
        createElement("div", {
          className: "governance-gap-card cli-bridge-lifecycle-stack-remediation-task-ledger-baseline-status-card",
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
              gap: "0.8rem",
              alignItems: "flex-start"
            }
          }, [
            createElement("div", {}, [
              createElement("div", {
                text: cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.hasBaseline
                  ? (cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.title || "CLI Bridge Remediation Task Ledger Baseline")
                  : "No CLI bridge remediation task ledger baseline selected",
                style: {
                  color: "var(--text)",
                  fontWeight: "900",
                  fontSize: "1.02rem"
                }
              }),
              createElement("div", {
                text: cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.hasBaseline && cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.createdAt
                  ? `${new Date(cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.createdAt).toLocaleString()} | ${cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.status || "all"}`
                  : `${cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.snapshotCount || 0} saved remediation task ledger snapshot(s) available`,
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.86rem",
                  lineHeight: "1.45",
                  marginTop: "0.25rem"
                }
              })
            ]),
            createTag((cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.health || "missing").toUpperCase(), {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.health === "healthy"
                ? "var(--success)"
                : cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.health === "drifted" || cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.health === "missing"
                  ? "var(--danger)"
                  : "var(--warning)"
            })
          ]),
          createElement("div", {
            className: "tags"
          }, [
            createTag(cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.hasBaseline ? "BASELINE SET" : "BASELINE MISSING", {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.hasBaseline ? "var(--success)" : "var(--warning)"
            }),
            createTag((cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.freshness || "missing").toUpperCase(), {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.freshness === "fresh" ? "var(--success)" : "var(--warning)"
            }),
            createTag(`drift ${cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.driftScore || 0}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.hasDrift ? "var(--warning)" : "var(--success)"
            }),
            createTag(`${cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.checkpointedDriftItemCount || 0}/${cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.driftItemCount || 0} checkpointed`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: (cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.uncheckpointedDriftItemCount || 0) > 0 ? "var(--warning)" : "var(--success)"
            }),
            createTag(`${cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.openEscalatedCheckpointCount || 0} open escalated`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: (cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.openEscalatedCheckpointCount || 0) > 0 ? "var(--danger)" : "var(--success)"
            }),
            createTag(`refresh ${cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.refreshGateDecision || "hold"}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.refreshGateDecision === "ready"
                ? "var(--success)"
                : cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.refreshGateDecision === "hold"
                  ? "var(--danger)"
                  : "var(--warning)"
            })
          ]),
          createElement("div", {
            text: cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.hasBaseline
              ? `Freshness: ${cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.ageHours || 0}h old | stale after ${cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.freshnessThresholdHours || 24}h`
              : `Freshness: missing | stale threshold ${cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.freshnessThresholdHours || 24}h`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `Baseline health: ${cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.health || "missing"} | ${cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.recommendedAction || "Save a CLI bridge lifecycle remediation task ledger snapshot before relying on remediation baselines."}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `Drift action: ${cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.driftRecommendedAction || "Save a CLI bridge lifecycle remediation task ledger snapshot before comparing drift."}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `Refresh gate: ${cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.refreshGateDecision || "hold"} | ${cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.refreshGateRecommendedAction || "Review remediation task ledger drift before refreshing the baseline."}`,
            style: {
              color: cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.refreshGateDecision === "hold" ? "var(--danger)" : "var(--text-muted)",
              fontSize: "0.88rem",
              lineHeight: "1.5"
            }
          }),
          createElement("div", {
            text: `Refresh reasons: ${(cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.refreshGateReasons || []).slice(0, 3).join(" | ") || "No refresh gate reasons recorded."}`,
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
              className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-task-ledger-baseline-status-copy-btn",
              text: "Copy Baseline Status",
              attrs: { type: "button" },
              dataset: {
                cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusCopy: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-lifecycle-stack-remediation-task-ledger-snapshot-refresh-btn",
              text: cliBridgeLifecycleStackRemediationTaskLedgerBaselineRefreshAllowed
                ? (cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.hasBaseline ? "Refresh Baseline" : "Save Baseline")
                : "Gate Hold",
              title: cliBridgeLifecycleStackRemediationTaskLedgerBaselineRefreshTitle,
              attrs: {
                type: "button",
                ...(cliBridgeLifecycleStackRemediationTaskLedgerBaselineRefreshAllowed ? {} : { disabled: "true" })
              },
              dataset: {
                cliBridgeLifecycleStackRemediationTaskLedgerSnapshotRefreshId: cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.snapshotId || "latest",
                cliBridgeLifecycleStackRemediationTaskLedgerSnapshotRefreshStatus: cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatus.status || "all"
              }
            })
          ])
        ])
      ]
    : [];

  const cliBridgeRunTraceSnapshotDiffActionId = governance.cliBridgeRunTraceSnapshotDiff?.snapshotId || "latest";
  const cliBridgeRunTraceSnapshotDiffEntries = governance.cliBridgeRunTraceSnapshotDiff
    ? [
        createElement("div", {
          className: "governance-gap-card cli-bridge-run-trace-snapshot-drift-card",
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
              gap: "0.75rem",
              alignItems: "flex-start"
            }
          }, [
            createElement("div", {}, [
              createElement("div", {
                text: `Trace drift: ${governance.cliBridgeRunTraceSnapshotDiff.snapshotTitle || governance.cliBridgeRunTraceSnapshotDiff.snapshotId || "latest snapshot"}`,
                style: {
                  color: "var(--text)",
                  fontWeight: "900",
                  fontSize: "1.02rem"
                }
              }),
              createElement("div", {
                text: governance.cliBridgeRunTraceSnapshotDiff.recommendedAction || "Save a CLI bridge run trace snapshot before comparing drift.",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.86rem",
                  lineHeight: "1.45",
                  marginTop: "0.25rem"
                }
              })
            ]),
            createTag(governance.cliBridgeRunTraceSnapshotDiff.driftSeverity || "missing-snapshot", {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: governance.cliBridgeRunTraceSnapshotDiff.driftSeverity === "high" || governance.cliBridgeRunTraceSnapshotDiff.driftSeverity === "missing-snapshot"
                ? "var(--danger)"
                : governance.cliBridgeRunTraceSnapshotDiff.driftSeverity === "none"
                  ? "var(--success)"
                  : "var(--warning)"
            })
          ]),
          createElement("div", {
            className: "tags"
          }, [
            createTag(`score ${governance.cliBridgeRunTraceSnapshotDiff.driftScore || 0}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: governance.cliBridgeRunTraceSnapshotDiff.hasDrift ? "var(--warning)" : "var(--success)"
            }),
            createTag(`${(governance.cliBridgeRunTraceSnapshotDiff.driftItems || []).length} item(s)`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: (governance.cliBridgeRunTraceSnapshotDiff.driftItems || []).length ? "var(--warning)" : "var(--success)"
            }),
            createTag(`run ${governance.cliBridgeRunTraceSnapshotDiff.runId || "unknown"}`, {
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--primary)"
            })
          ]),
          governance.cliBridgeRunTraceSnapshotDiff.driftItems?.length
            ? createElement("div", {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.45rem"
                }
              }, governance.cliBridgeRunTraceSnapshotDiff.driftItems.slice(0, 6).map((item) => createElement("div", {
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
                  text: `${item.label || item.field}: ${item.before ?? ""} -> ${item.current ?? ""}`,
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
                    className: "btn governance-action-btn cli-bridge-run-trace-snapshot-drift-item-confirm-btn",
                    text: "Confirm",
                    attrs: { type: "button" },
                    dataset: {
                      cliBridgeRunTraceSnapshotDriftItemField: item.field || item.label || "",
                      cliBridgeRunTraceSnapshotDriftItemDecision: "confirmed"
                    }
                  }),
                  createElement("button", {
                    className: "btn governance-action-btn cli-bridge-run-trace-snapshot-drift-item-defer-btn",
                    text: "Defer",
                    attrs: { type: "button" },
                    dataset: {
                      cliBridgeRunTraceSnapshotDriftItemField: item.field || item.label || "",
                      cliBridgeRunTraceSnapshotDriftItemDecision: "deferred"
                    }
                  }),
                  createElement("button", {
                    className: "btn governance-action-btn cli-bridge-run-trace-snapshot-drift-item-escalate-btn",
                    text: "Escalate",
                    attrs: { type: "button" },
                    dataset: {
                      cliBridgeRunTraceSnapshotDriftItemField: item.field || item.label || "",
                      cliBridgeRunTraceSnapshotDriftItemDecision: "escalated"
                    }
                  })
                ])
              ])))
            : createElement("div", {
                text: "No live trace drift detected against the saved snapshot.",
                style: {
                  color: "var(--text-muted)",
                  fontSize: "0.84rem"
                }
              }),
          createElement("div", {
            className: "governance-actions"
          }, [
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-run-trace-snapshot-diff-copy-btn",
              text: "Copy Trace Drift",
              attrs: { type: "button" },
              dataset: {
                cliBridgeRunTraceSnapshotDiffCopy: "true"
              }
            }),
            createElement("button", {
              className: "btn governance-action-btn cli-bridge-run-trace-snapshot-drift-task-btn",
              text: "Track Drift",
              attrs: { type: "button" },
              dataset: {
                cliBridgeRunTraceSnapshotDriftTaskId: cliBridgeRunTraceSnapshotDiffActionId
              }
            }),
            governance.cliBridgeRunTraceSnapshotDiff.runId
              ? createElement("button", {
                  className: "btn governance-action-btn cli-bridge-run-trace-snapshot-drift-accept-btn",
                  text: "Accept Drift",
                  attrs: { type: "button" },
                  dataset: {
                    cliBridgeRunTraceSnapshotDriftAcceptId: cliBridgeRunTraceSnapshotDiffActionId
                  }
                })
              : null
          ])
        ])
      ]
    : [];

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

  const agentExecutionTargetBaselineAuditLedgerSnapshotEntries = (governance.agentExecutionTargetBaselineAuditLedgerSnapshots || []).map((snapshot) => createElement("div", {
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
          text: `${new Date(snapshot.createdAt).toLocaleString()} - ${snapshot.stateFilter}`,
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
      text: `Review ${snapshot.reviewCount || 0} - Missing ${snapshot.missingCount || 0} - Healthy ${snapshot.healthyCount || 0} - Stale ${snapshot.staleCount || 0} - Drift ${snapshot.driftCount || 0}`,
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
        className: "btn governance-action-btn target-baseline-audit-ledger-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: {
          targetBaselineAuditLedgerSnapshotId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn target-baseline-audit-ledger-snapshot-drift-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: {
          targetBaselineAuditLedgerSnapshotDriftId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn target-baseline-audit-ledger-snapshot-drift-task-btn",
        text: "Track Drift",
        attrs: { type: "button" },
        dataset: {
          targetBaselineAuditLedgerSnapshotDriftTaskId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn target-baseline-audit-ledger-snapshot-drift-checkpoint-btn",
        text: "Confirm Drift",
        attrs: { type: "button" },
        dataset: {
          targetBaselineAuditLedgerSnapshotDriftCheckpointId: snapshot.id,
          targetBaselineAuditLedgerSnapshotDriftCheckpointDecision: "confirmed"
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn target-baseline-audit-ledger-snapshot-drift-checkpoint-btn",
        text: "Defer Drift",
        attrs: { type: "button" },
        dataset: {
          targetBaselineAuditLedgerSnapshotDriftCheckpointId: snapshot.id,
          targetBaselineAuditLedgerSnapshotDriftCheckpointDecision: "deferred"
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn target-baseline-audit-ledger-snapshot-drift-checkpoint-btn",
        text: "Escalate Drift",
        attrs: { type: "button" },
        dataset: {
          targetBaselineAuditLedgerSnapshotDriftCheckpointId: snapshot.id,
          targetBaselineAuditLedgerSnapshotDriftCheckpointDecision: "escalated"
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn target-baseline-audit-ledger-snapshot-refresh-btn",
        text: "Refresh Snapshot",
        attrs: { type: "button" },
        dataset: {
          targetBaselineAuditLedgerSnapshotRefreshId: snapshot.id
        }
      })
    ])
  ]));

  const agentExecutionRegressionAlertBaselineLedgerSnapshotEntries = (governance.agentExecutionRegressionAlertBaselineLedgerSnapshots || []).map((snapshot) => createElement("div", {
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
          text: `${new Date(snapshot.createdAt).toLocaleString()} - ${snapshot.stateFilter}`,
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
      text: `Review ${snapshot.reviewCount || 0} - Missing ${snapshot.missingCount || 0} - Healthy ${snapshot.healthyCount || 0} - Stale ${snapshot.staleCount || 0} - Drift ${snapshot.driftCount || 0} - Hold ${snapshot.holdCount || 0} - Escalated ${snapshot.openEscalatedCheckpointCount || 0}`,
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
        className: "btn governance-action-btn regression-alert-baseline-ledger-snapshot-copy-btn",
        text: "Copy Snapshot",
        attrs: { type: "button" },
        dataset: {
          regressionAlertBaselineLedgerSnapshotId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn regression-alert-baseline-ledger-snapshot-drift-btn",
        text: "Copy Drift",
        attrs: { type: "button" },
        dataset: {
          regressionAlertBaselineLedgerSnapshotDriftId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn regression-alert-baseline-ledger-snapshot-drift-task-btn",
        text: "Track Drift",
        attrs: { type: "button" },
        dataset: {
          regressionAlertBaselineLedgerSnapshotDriftTaskId: snapshot.id
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn regression-alert-baseline-ledger-snapshot-drift-checkpoint-btn",
        text: "Confirm Drift",
        attrs: { type: "button" },
        dataset: {
          regressionAlertBaselineLedgerSnapshotDriftCheckpointId: snapshot.id,
          regressionAlertBaselineLedgerSnapshotDriftCheckpointDecision: "confirmed"
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn regression-alert-baseline-ledger-snapshot-drift-checkpoint-btn",
        text: "Defer Drift",
        attrs: { type: "button" },
        dataset: {
          regressionAlertBaselineLedgerSnapshotDriftCheckpointId: snapshot.id,
          regressionAlertBaselineLedgerSnapshotDriftCheckpointDecision: "deferred"
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn regression-alert-baseline-ledger-snapshot-drift-checkpoint-btn",
        text: "Escalate Drift",
        attrs: { type: "button" },
        dataset: {
          regressionAlertBaselineLedgerSnapshotDriftCheckpointId: snapshot.id,
          regressionAlertBaselineLedgerSnapshotDriftCheckpointDecision: "escalated"
        }
      }),
      createElement("button", {
        className: "btn governance-action-btn regression-alert-baseline-ledger-snapshot-refresh-btn",
        text: "Refresh Snapshot",
        attrs: { type: "button" },
        dataset: {
          regressionAlertBaselineLedgerSnapshotRefreshId: snapshot.id
        }
      })
    ])
  ]));

  const agentExecutionTargetBaselineAuditLedgerDriftCheckpointLedger = governance.agentExecutionTargetBaselineAuditLedgerDriftCheckpointLedger || null;
  const agentExecutionTargetBaselineAuditLedgerDriftCheckpointEntries = agentExecutionTargetBaselineAuditLedgerDriftCheckpointLedger ? [
    createElement("div", {
      className: "governance-gap-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem"
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
            text: "Target baseline audit drift checkpoint ledger",
            style: {
              fontWeight: "800",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: `${agentExecutionTargetBaselineAuditLedgerDriftCheckpointLedger.summary?.total || 0} checkpoint task(s) | ${agentExecutionTargetBaselineAuditLedgerDriftCheckpointLedger.summary?.open || 0} open | ${agentExecutionTargetBaselineAuditLedgerDriftCheckpointLedger.summary?.escalated || 0} escalated`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.3rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(`${agentExecutionTargetBaselineAuditLedgerDriftCheckpointLedger.summary?.confirmed || 0} confirmed`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--success)"
        })
      ]),
      createElement("div", {
        style: {
          display: "grid",
          gap: "0.45rem"
        }
      }, [
        ...(agentExecutionTargetBaselineAuditLedgerDriftCheckpointLedger.items || []).slice(0, 6).map((item) => createElement("div", {
          className: "governance-gap-card",
          style: {
            padding: "0.7rem",
            background: "var(--panel-soft)"
          }
        }, [
          createElement("div", {
            text: item.title || "Target baseline audit drift checkpoint",
            style: {
              fontWeight: "700",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: `${item.decision || "tracked"} | ${item.field || item.label || "field not recorded"} | ${item.status || "open"} / ${item.priority || "normal"}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.82rem",
              lineHeight: "1.45"
            }
          }),
          createElement("div", {
            text: `${item.before || "none"} -> ${item.current || "none"} | snapshot ${item.snapshotTitle || item.snapshotId || "not recorded"}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.82rem",
              lineHeight: "1.45"
            }
          })
        ])),
        !(agentExecutionTargetBaselineAuditLedgerDriftCheckpointLedger.items || []).length
          ? createElement("div", {
              text: "No target baseline audit drift checkpoints have been recorded yet.",
              style: {
                color: "var(--text-muted)",
                fontSize: "0.82rem",
                lineHeight: "1.45"
              }
            })
          : null
      ])
    ])
  ] : [];
  const agentExecutionRegressionAlertBaselineLedgerDriftCheckpointLedger = governance.agentExecutionRegressionAlertBaselineLedgerDriftCheckpointLedger || null;
  const agentExecutionRegressionAlertBaselineLedgerDriftCheckpointEntries = agentExecutionRegressionAlertBaselineLedgerDriftCheckpointLedger ? [
    createElement("div", {
      className: "governance-gap-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem"
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
            text: "Regression alert baseline drift checkpoint ledger",
            style: {
              fontWeight: "800",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: `${agentExecutionRegressionAlertBaselineLedgerDriftCheckpointLedger.summary?.total || 0} checkpoint task(s) | ${agentExecutionRegressionAlertBaselineLedgerDriftCheckpointLedger.summary?.open || 0} open | ${agentExecutionRegressionAlertBaselineLedgerDriftCheckpointLedger.summary?.escalated || 0} escalated`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.3rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(`${agentExecutionRegressionAlertBaselineLedgerDriftCheckpointLedger.summary?.confirmed || 0} confirmed`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--success)"
        })
      ]),
      createElement("div", {
        style: {
          display: "grid",
          gap: "0.45rem"
        }
      }, [
        ...(agentExecutionRegressionAlertBaselineLedgerDriftCheckpointLedger.items || []).slice(0, 6).map((item) => createElement("div", {
          className: "governance-gap-card",
          style: {
            padding: "0.7rem",
            background: "var(--panel-soft)"
          }
        }, [
          createElement("div", {
            text: item.title || "Regression alert baseline drift checkpoint",
            style: {
              fontWeight: "700",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: `${item.decision || "tracked"} | ${item.field || item.label || "field not recorded"} | ${item.status || "open"} / ${item.priority || "normal"}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.82rem",
              lineHeight: "1.45"
            }
          }),
          createElement("div", {
            text: `${item.before || "none"} -> ${item.current || "none"} | snapshot ${item.snapshotTitle || item.snapshotId || "not recorded"}`,
            style: {
              color: "var(--text-muted)",
              fontSize: "0.82rem",
              lineHeight: "1.45"
            }
          })
        ])),
        !(agentExecutionRegressionAlertBaselineLedgerDriftCheckpointLedger.items || []).length
          ? createElement("div", {
              text: "No regression alert baseline drift checkpoints have been recorded yet.",
              style: {
                color: "var(--text-muted)",
                fontSize: "0.82rem",
                lineHeight: "1.45"
              }
            })
          : null
      ])
    ])
  ] : [];
  const agentExecutionRegressionAlertBaselineLedgerBaselineStatus = governance.agentExecutionRegressionAlertBaselineLedgerBaselineStatus || null;
  const agentExecutionRegressionAlertBaselineLedgerBaselineStatusEntries = agentExecutionRegressionAlertBaselineLedgerBaselineStatus ? [
    createElement("div", {
      className: "governance-gap-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem"
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
            text: "Regression alert baseline snapshot baseline",
            style: {
              fontWeight: "800",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: agentExecutionRegressionAlertBaselineLedgerBaselineStatus.recommendedAction || "Save a Regression Alert baseline snapshot before relying on alert-baseline drift gates.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.3rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(agentExecutionRegressionAlertBaselineLedgerBaselineStatus.health || "missing", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: agentExecutionRegressionAlertBaselineLedgerBaselineStatus.health === "healthy" ? "var(--success)" : agentExecutionRegressionAlertBaselineLedgerBaselineStatus.health === "stale" ? "var(--warning)" : "var(--danger)"
        })
      ]),
      createElement("div", {
        text: agentExecutionRegressionAlertBaselineLedgerBaselineStatus.hasBaseline
          ? `Snapshot ${agentExecutionRegressionAlertBaselineLedgerBaselineStatus.title || agentExecutionRegressionAlertBaselineLedgerBaselineStatus.snapshotId || "baseline"} | ${agentExecutionRegressionAlertBaselineLedgerBaselineStatus.freshness || "missing"} | drift ${agentExecutionRegressionAlertBaselineLedgerBaselineStatus.driftSeverity || "none"} / score ${agentExecutionRegressionAlertBaselineLedgerBaselineStatus.driftScore || 0} | checkpoints ${agentExecutionRegressionAlertBaselineLedgerBaselineStatus.checkpointedDriftItemCount || 0}/${agentExecutionRegressionAlertBaselineLedgerBaselineStatus.driftItemCount || 0}`
          : `No Regression Alert baseline snapshot saved. Snapshots available: ${agentExecutionRegressionAlertBaselineLedgerBaselineStatus.snapshotCount || 0}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.86rem",
          lineHeight: "1.5"
        }
      }),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn regression-alert-baseline-ledger-baseline-status-copy-btn",
          text: "Copy Baseline Status",
          attrs: { type: "button" },
          dataset: { regressionAlertBaselineLedgerBaselineStatusCopy: "true" }
        })
      ])
    ])
  ] : [];
  const agentExecutionRegressionAlertBaselineDriftTasks = governance.agentExecutionRegressionAlertBaselineDriftTasks || [];
  const agentExecutionRegressionAlertBaselineDriftTaskSummary = governance.summary || {};
  const agentExecutionRegressionAlertBaselineDriftTaskEntries = [
    createElement("div", {
      className: "governance-gap-card agent-execution-regression-alert-baseline-drift-task-summary-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem"
      }
    }, [
      createElement("div", {
        text: "Regression Alert baseline drift tasks",
        style: {
          fontWeight: "800",
          color: "var(--text)"
        }
      }),
      createElement("div", {
        text: `${agentExecutionRegressionAlertBaselineDriftTaskSummary.agentExecutionRegressionAlertBaselineDriftOpenTaskCount || 0} open / ${agentExecutionRegressionAlertBaselineDriftTaskSummary.agentExecutionRegressionAlertBaselineDriftTaskCount || 0} total drift task(s).`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.84rem",
          lineHeight: "1.45"
        }
      })
    ]),
    ...(agentExecutionRegressionAlertBaselineDriftTasks.length
      ? agentExecutionRegressionAlertBaselineDriftTasks.map((task) => {
          const isClosedTask = ["done", "resolved", "closed", "cancelled", "archived"].includes(String(task.status || "").toLowerCase());
          const statusColor = isClosedTask
            ? "var(--success)"
            : task.status === "blocked"
              ? "var(--danger)"
              : "var(--warning)";
          return createElement("div", {
            className: "governance-gap-card agent-execution-regression-alert-baseline-drift-task-card",
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
                  text: task.title || "Regression Alert baseline drift task",
                  style: {
                    fontWeight: "800",
                    color: "var(--text)"
                  }
                }),
                createElement("div", {
                  text: `${task.projectName || "Agent Execution Regression Alert Baseline"} | ${task.updatedAt ? `updated ${new Date(task.updatedAt).toLocaleString()}` : `created ${task.createdAt ? new Date(task.createdAt).toLocaleString() : "unknown"}`}`,
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
                  color: statusColor
                })
              ])
            ]),
            createElement("div", {
              text: task.description ? String(task.description).split("\n")[0] : "Track Regression Alert baseline snapshot drift before unattended agent work.",
              style: {
                color: "var(--text-muted)",
                fontSize: "0.88rem",
                lineHeight: "1.5"
              }
            }),
            createElement("div", {
              className: "tags"
            }, [
              createTag("Alert Baseline Drift", {
                background: "var(--bg)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)"
              }),
              createTag("non-secret-drift-context-only", {
                background: "var(--bg)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)"
              })
            ]),
            createElement("div", {
              className: "governance-actions"
            }, [
              createElement("button", {
                className: "btn governance-action-btn agent-execution-regression-alert-baseline-drift-task-status-btn",
                text: isClosedTask ? "Reopen" : "Resolve",
                attrs: { type: "button" },
                dataset: {
                  regressionAlertTaskStatus: isClosedTask ? "open" : "resolved",
                  taskId: task.id || ""
                }
              }),
              !isClosedTask
                ? createElement("button", {
                    className: "btn governance-action-btn agent-execution-regression-alert-baseline-drift-task-block-btn",
                    text: "Block",
                    attrs: { type: "button" },
                    dataset: {
                      regressionAlertTaskStatus: "blocked",
                      taskId: task.id || ""
                    }
                  })
                : null
            ])
          ]);
        })
      : [
          createElement("div", {
            className: "governance-gap-card agent-execution-regression-alert-baseline-drift-task-empty-card",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.86rem",
              lineHeight: "1.45"
            },
            text: "No Regression Alert baseline snapshot drift tasks have been tracked yet."
          })
        ])
  ];
  const agentExecutionTargetBaselineAuditLedgerBaselineStatus = governance.agentExecutionTargetBaselineAuditLedgerBaselineStatus || null;
  const agentExecutionTargetBaselineAuditLedgerBaselineStatusEntries = agentExecutionTargetBaselineAuditLedgerBaselineStatus ? [
    createElement("div", {
      className: "governance-gap-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem"
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
            text: "Target baseline audit snapshot baseline",
            style: {
              fontWeight: "800",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: agentExecutionTargetBaselineAuditLedgerBaselineStatus.recommendedAction || "Save a target-baseline audit snapshot before relying on execution baseline drift gates.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.84rem",
              marginTop: "0.3rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(agentExecutionTargetBaselineAuditLedgerBaselineStatus.health || "missing", {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: agentExecutionTargetBaselineAuditLedgerBaselineStatus.health === "healthy" ? "var(--success)" : agentExecutionTargetBaselineAuditLedgerBaselineStatus.health === "stale" ? "var(--warning)" : "var(--danger)"
        })
      ]),
      createElement("div", {
        text: agentExecutionTargetBaselineAuditLedgerBaselineStatus.hasBaseline
          ? `Snapshot ${agentExecutionTargetBaselineAuditLedgerBaselineStatus.title || agentExecutionTargetBaselineAuditLedgerBaselineStatus.snapshotId || "baseline"} | ${agentExecutionTargetBaselineAuditLedgerBaselineStatus.freshness || "missing"} | drift ${agentExecutionTargetBaselineAuditLedgerBaselineStatus.driftSeverity || "none"} / score ${agentExecutionTargetBaselineAuditLedgerBaselineStatus.driftScore || 0} | checkpoints ${agentExecutionTargetBaselineAuditLedgerBaselineStatus.checkpointedDriftItemCount || 0}/${agentExecutionTargetBaselineAuditLedgerBaselineStatus.driftItemCount || 0}`
          : `No target-baseline audit baseline snapshot saved. Snapshots available: ${agentExecutionTargetBaselineAuditLedgerBaselineStatus.snapshotCount || 0}`,
        style: {
          color: "var(--text-muted)",
          fontSize: "0.86rem",
          lineHeight: "1.5"
        }
      }),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn target-baseline-audit-ledger-baseline-status-copy-btn",
          text: "Copy Baseline Status",
          attrs: { type: "button" },
          dataset: { targetBaselineAuditLedgerBaselineStatusCopy: "true" }
        })
      ])
    ])
  ] : [];

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
      text: `Evidence coverage: ${item.evidenceCoverageStatus || "missing"} | latest: ${item.latestEvidenceStatus || "missing"} | ${item.evidenceAction || "Record non-secret validation evidence after confirming access outside this app."}`,
      style: {
        color: item.evidenceCoverageStatus === "covered" ? "var(--success)" : item.evidenceCoverageStatus === "blocked" ? "var(--danger)" : "var(--warning)",
        fontSize: "0.84rem",
        lineHeight: "1.45"
      }
    }),
    createElement("div", {
      className: "tags"
    }, [
      createTag(`evidence ${item.evidenceCoverageStatus || "missing"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: item.evidenceCoverageStatus === "covered" ? "var(--success)" : item.evidenceCoverageStatus === "blocked" ? "var(--danger)" : "var(--warning)"
      }),
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
  const controlPlaneProfileTargetBaselineHealth = controlPlaneDecision?.profileTargetTaskLedgerBaselineHealth || "missing";
  const controlPlaneProfileTargetBaselineFreshness = controlPlaneDecision?.profileTargetTaskLedgerBaselineFreshness || "missing";
  const controlPlaneProfileTargetBaselineUncheckpointedDriftCount = controlPlaneDecision?.profileTargetTaskLedgerBaselineUncheckpointedDriftCount || 0;
  const controlPlaneTargetBaselineAuditHealth = controlPlaneDecision?.targetBaselineAuditLedgerBaselineHealth || "missing";
  const controlPlaneTargetBaselineAuditFreshness = controlPlaneDecision?.targetBaselineAuditLedgerBaselineFreshness || "missing";
  const controlPlaneTargetBaselineAuditUncheckpointedDriftCount = controlPlaneDecision?.targetBaselineAuditLedgerBaselineUncheckpointedDriftCount || 0;
  const controlPlaneRegressionAlertSnapshotBaselineHealth = controlPlaneDecision?.regressionAlertBaselineLedgerBaselineHealth || "missing";
  const controlPlaneRegressionAlertSnapshotBaselineFreshness = controlPlaneDecision?.regressionAlertBaselineLedgerBaselineFreshness || "missing";
  const controlPlaneRegressionAlertSnapshotBaselineUncheckpointedDriftCount = controlPlaneDecision?.regressionAlertBaselineLedgerBaselineUncheckpointedDriftCount || 0;
  const controlPlaneRegressionAlertBaselineHealth = controlPlaneDecision?.regressionAlertTaskLedgerBaselineHealth || "missing";
  const controlPlaneRegressionAlertBaselineRefreshGate = controlPlaneDecision?.regressionAlertTaskLedgerBaselineRefreshGateDecision || "ready";
  const controlPlaneRegressionAlertBaselineUncheckpointedDriftCount = controlPlaneDecision?.regressionAlertTaskLedgerBaselineUncheckpointedDriftCount || 0;
  const controlPlaneRegressionAlertBaselineOpenEscalatedCount = controlPlaneDecision?.regressionAlertTaskLedgerBaselineOpenEscalatedCheckpointCount || 0;
  const controlPlaneAuditBaselineRunReviewCount = controlPlaneDecision?.agentExecutionTargetBaselineAuditBaselineReviewRequiredCount || 0;
  const controlPlaneAuditBaselineRunHealthyCount = controlPlaneDecision?.agentExecutionTargetBaselineAuditBaselineHealthyCount || 0;
  const controlPlaneAuditBaselineRunMissingCount = controlPlaneDecision?.agentExecutionTargetBaselineAuditBaselineMissingCount || 0;
  const controlPlaneAuditBaselineRunCapturedCount = controlPlaneDecision?.agentExecutionTargetBaselineAuditBaselineCapturedCount || 0;
  const controlPlaneAlertBaselineRunReviewCount = controlPlaneDecision?.agentExecutionRegressionAlertBaselineReviewRequiredCount || 0;
  const controlPlaneAlertBaselineRunHealthyCount = controlPlaneDecision?.agentExecutionRegressionAlertBaselineHealthyCount || 0;
  const controlPlaneAlertBaselineRunMissingCount = controlPlaneDecision?.agentExecutionRegressionAlertBaselineMissingCount || 0;
  const controlPlaneAlertBaselineRunCapturedCount = controlPlaneDecision?.agentExecutionRegressionAlertBaselineCapturedCount || 0;
  const controlPlaneAlertBaselineDriftTaskCount = controlPlaneDecision?.agentExecutionRegressionAlertBaselineDriftTaskCount || 0;
  const controlPlaneAlertBaselineDriftOpenTaskCount = controlPlaneDecision?.agentExecutionRegressionAlertBaselineDriftOpenTaskCount || 0;
  const controlPlaneAlertBaselineDriftClosedTaskCount = controlPlaneDecision?.agentExecutionRegressionAlertBaselineDriftClosedTaskCount || 0;
  const controlPlaneProfileTargetBaselineColor = controlPlaneProfileTargetBaselineHealth === "healthy"
    ? "var(--success)"
    : controlPlaneProfileTargetBaselineHealth === "missing" || controlPlaneProfileTargetBaselineHealth === "drift-review-required"
      ? "var(--danger)"
      : "var(--warning)";
  const controlPlaneTargetBaselineAuditColor = controlPlaneTargetBaselineAuditHealth === "healthy"
    ? "var(--success)"
    : controlPlaneTargetBaselineAuditHealth === "missing" || controlPlaneTargetBaselineAuditHealth === "drift-review-required"
      ? "var(--danger)"
      : "var(--warning)";
  const controlPlaneRegressionAlertSnapshotBaselineColor = controlPlaneRegressionAlertSnapshotBaselineHealth === "healthy"
    ? "var(--success)"
    : controlPlaneRegressionAlertSnapshotBaselineHealth === "missing" || controlPlaneRegressionAlertSnapshotBaselineHealth === "drift-review-required"
      ? "var(--danger)"
      : "var(--warning)";
  const controlPlaneAlertBaselineDriftTaskColor = controlPlaneAlertBaselineDriftOpenTaskCount > 0
    ? "var(--warning)"
    : "var(--success)";
  const controlPlaneRegressionAlertBaselineColor = controlPlaneRegressionAlertBaselineRefreshGate === "hold" || controlPlaneRegressionAlertBaselineOpenEscalatedCount > 0
    ? "var(--danger)"
    : controlPlaneRegressionAlertBaselineHealth === "healthy" && controlPlaneRegressionAlertBaselineRefreshGate === "ready"
      ? "var(--success)"
      : "var(--warning)";
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
              createTag(`TARGET BASELINE ${controlPlaneProfileTargetBaselineHealth.toUpperCase()}`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: controlPlaneProfileTargetBaselineColor
              }),
              createTag(`AUDIT BASELINE ${controlPlaneTargetBaselineAuditHealth.toUpperCase()}`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: controlPlaneTargetBaselineAuditColor
              }),
              createTag(`ALERT SNAPSHOT ${controlPlaneRegressionAlertSnapshotBaselineHealth.toUpperCase()}`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: controlPlaneRegressionAlertSnapshotBaselineColor
              }),
              createTag(`ALERT DRIFT TASKS ${controlPlaneAlertBaselineDriftOpenTaskCount}/${controlPlaneAlertBaselineDriftTaskCount}`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: controlPlaneAlertBaselineDriftTaskColor
              }),
              createTag(`REGRESSION ALERT TASK ${controlPlaneRegressionAlertBaselineHealth.toUpperCase()}`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: controlPlaneRegressionAlertBaselineColor
              }),
              createTag(`AUDIT RUNS ${controlPlaneAuditBaselineRunReviewCount} REVIEW`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: controlPlaneAuditBaselineRunReviewCount > 0 ? "var(--warning)" : "var(--success)"
              }),
              createTag(`ALERT RUNS ${controlPlaneAlertBaselineRunReviewCount} REVIEW`, {
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: controlPlaneAlertBaselineRunReviewCount > 0 ? "var(--warning)" : "var(--success)"
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
            text: `Baseline health: ${controlPlaneDecision.baselineHealth || "missing"} • Target baseline: ${controlPlaneProfileTargetBaselineHealth} / ${controlPlaneProfileTargetBaselineFreshness} / ${controlPlaneProfileTargetBaselineUncheckpointedDriftCount} uncheckpointed • Audit baseline: ${controlPlaneTargetBaselineAuditHealth} / ${controlPlaneTargetBaselineAuditFreshness} / ${controlPlaneTargetBaselineAuditUncheckpointedDriftCount} uncheckpointed • Alert snapshot baseline: ${controlPlaneRegressionAlertSnapshotBaselineHealth} / ${controlPlaneRegressionAlertSnapshotBaselineFreshness} / ${controlPlaneRegressionAlertSnapshotBaselineUncheckpointedDriftCount} uncheckpointed • Alert baseline drift tasks: ${controlPlaneAlertBaselineDriftOpenTaskCount} open / ${controlPlaneAlertBaselineDriftTaskCount} total / ${controlPlaneAlertBaselineDriftClosedTaskCount} closed • Regression Alert task baseline: ${controlPlaneRegressionAlertBaselineHealth} / refresh ${controlPlaneRegressionAlertBaselineRefreshGate} / ${controlPlaneRegressionAlertBaselineUncheckpointedDriftCount} uncheckpointed / ${controlPlaneRegressionAlertBaselineOpenEscalatedCount} escalated • Audit run capture: ${controlPlaneAuditBaselineRunReviewCount} review / ${controlPlaneAuditBaselineRunHealthyCount} healthy / ${controlPlaneAuditBaselineRunMissingCount} missing / ${controlPlaneAuditBaselineRunCapturedCount} captured • Alert run capture: ${controlPlaneAlertBaselineRunReviewCount} review / ${controlPlaneAlertBaselineRunHealthyCount} healthy / ${controlPlaneAlertBaselineRunMissingCount} missing / ${controlPlaneAlertBaselineRunCapturedCount} captured • Release gate: ${controlPlaneReleaseBuildGateDecision} risk ${controlPlaneDecision.releaseBuildGateRiskScore || controlPlaneReleaseBuildGate?.riskScore || 0} • Active runs: ${controlPlaneDecision.activeRuns || 0} • Stale: ${controlPlaneDecision.staleActiveRuns || 0} • SLA breached: ${controlPlaneDecision.slaBreachedRuns || 0} • Source access tasks: ${controlPlaneDecision.dataSourcesAccessOpenTaskCount || 0} open / ${controlPlaneDecision.dataSourcesAccessTaskCount || 0} total • Access methods: ${controlPlaneDecision.dataSourcesAccessValidationMethodCount || 0} • Evidence: ${controlPlaneDecision.dataSourcesAccessValidationEvidenceValidatedCount || 0}/${controlPlaneDecision.dataSourcesAccessValidationEvidenceCount || 0}`,
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
          label: "Target Baseline Audit",
          value: `${executionMetrics.targetBaselineReviewRequired || 0} review / ${executionMetrics.targetBaselineHealthy || 0} healthy`,
          detail: `${executionMetrics.targetBaselineCaptured || 0} captured, ${executionMetrics.targetBaselineMissing || 0} missing, ${executionMetrics.targetBaselineUncheckpointedDriftItems || 0} uncheckpointed drift item(s)`
        },
        {
          label: "Audit Snapshot Baseline",
          value: `${executionMetrics.auditBaselineReviewRequired || 0} review / ${executionMetrics.auditBaselineHealthy || 0} healthy`,
          detail: `${executionMetrics.auditBaselineCaptured || 0} captured, ${executionMetrics.auditBaselineMissing || 0} missing, ${executionMetrics.auditBaselineUncheckpointedDriftItems || 0} uncheckpointed drift item(s)`
        },
        {
          label: "Regression Alert Baseline",
          value: `${executionMetrics.alertBaselineReviewRequired || 0} review / ${executionMetrics.alertBaselineHealthy || 0} healthy`,
          detail: `${executionMetrics.alertBaselineCaptured || 0} captured, ${executionMetrics.alertBaselineMissing || 0} missing, ${executionMetrics.alertBaselineRefreshGateHold || 0} hold gate(s), ${executionMetrics.alertBaselineOpenEscalatedCheckpoints || 0} escalated checkpoint(s)`
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

  const agentExecutionTargetBaselineAuditLedgerEntries = [
    createElement("div", {
      className: "governance-gap-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem"
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
            text: "Target Baseline Audit Ledger",
            style: {
              fontWeight: "900",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: "Copy the no-secret run-level checklist for missing, stale, drifted, and healthy profile target baseline captures.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.86rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(`${executionMetrics.targetBaselineReviewRequired || 0} review`, {
          border: `1px solid ${(executionMetrics.targetBaselineReviewRequired || 0) > 0 ? "var(--warning)" : "var(--success)"}`,
          background: "var(--bg)",
          color: (executionMetrics.targetBaselineReviewRequired || 0) > 0 ? "var(--warning)" : "var(--success)"
        })
      ]),
      createElement("div", {
        className: "tags"
      }, [
        createTag(`${executionMetrics.targetBaselineMissing || 0} missing`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        createTag(`${executionMetrics.targetBaselineStale || 0} stale`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        createTag(`${(executionMetrics.targetBaselineDrifted || 0) + (executionMetrics.targetBaselineDriftReviewRequired || 0)} drift`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        createTag(`${executionMetrics.targetBaselineUncheckpointedDriftItems || 0} uncheckpointed drift item(s)`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        })
      ]),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn agent-execution-target-baseline-audit-ledger-copy-btn",
          text: "Copy Review Ledger",
          attrs: { type: "button" },
          dataset: {
            agentExecutionTargetBaselineAuditLedgerCopy: "review"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn agent-execution-target-baseline-audit-ledger-copy-all-btn",
          text: "Copy All",
          attrs: { type: "button" },
          dataset: {
            agentExecutionTargetBaselineAuditLedgerCopy: "all"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn agent-execution-target-baseline-audit-ledger-snapshot-save-btn",
          text: "Save Snapshot",
          attrs: { type: "button" },
          dataset: {
            agentExecutionTargetBaselineAuditLedgerSnapshotSave: "review"
          }
        })
      ])
    ])
  ];

  const agentExecutionRegressionAlertBaselineLedgerEntries = [
    createElement("div", {
      className: "governance-gap-card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem"
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
            text: "Regression Alert Baseline Ledger",
            style: {
              fontWeight: "900",
              color: "var(--text)"
            }
          }),
          createElement("div", {
            text: "Copy the no-secret run-level checklist for missing, stale, drifted, held, and healthy Regression Alert baseline captures.",
            style: {
              color: "var(--text-muted)",
              fontSize: "0.86rem",
              lineHeight: "1.45"
            }
          })
        ]),
        createTag(`${executionMetrics.alertBaselineReviewRequired || 0} review`, {
          border: `1px solid ${(executionMetrics.alertBaselineReviewRequired || 0) > 0 ? "var(--warning)" : "var(--success)"}`,
          background: "var(--bg)",
          color: (executionMetrics.alertBaselineReviewRequired || 0) > 0 ? "var(--warning)" : "var(--success)"
        })
      ]),
      createElement("div", {
        className: "tags"
      }, [
        createTag(`${executionMetrics.alertBaselineMissing || 0} missing`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        createTag(`${executionMetrics.alertBaselineStale || 0} stale`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        createTag(`${(executionMetrics.alertBaselineDrifted || 0) + (executionMetrics.alertBaselineDriftReviewRequired || 0)} drift`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        createTag(`${executionMetrics.alertBaselineRefreshGateHold || 0} hold`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        }),
        createTag(`${executionMetrics.alertBaselineOpenEscalatedCheckpoints || 0} escalated checkpoint(s)`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)"
        })
      ]),
      createElement("div", {
        className: "governance-actions"
      }, [
        createElement("button", {
          className: "btn governance-action-btn agent-execution-regression-alert-baseline-ledger-copy-btn",
          text: "Copy Review Ledger",
          attrs: { type: "button" },
          dataset: {
            agentExecutionRegressionAlertBaselineLedgerCopy: "review"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn agent-execution-regression-alert-baseline-ledger-copy-all-btn",
          text: "Copy All",
          attrs: { type: "button" },
          dataset: {
            agentExecutionRegressionAlertBaselineLedgerCopy: "all"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn agent-execution-regression-alert-baseline-ledger-snapshot-save-btn",
          text: "Save Snapshot",
          attrs: { type: "button" },
          dataset: {
            agentExecutionRegressionAlertBaselineLedgerSnapshotSave: "review"
          }
        })
      ])
    ])
  ];

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
    createElement("div", {
      text: `Profile target baseline: ${run.profileTargetTaskLedgerBaselineHealth || "missing"} / ${run.profileTargetTaskLedgerBaselineFreshness || "missing"} | drift ${run.profileTargetTaskLedgerBaselineDriftSeverity || "missing-snapshot"} | ${run.profileTargetTaskLedgerBaselineUncheckpointedDriftCount || 0} uncheckpointed drift item(s) | captured ${run.profileTargetTaskLedgerBaselineCapturedAt ? new Date(run.profileTargetTaskLedgerBaselineCapturedAt).toLocaleString() : "not captured"}`,
      style: {
        color: run.profileTargetTaskLedgerBaselineHealth === "healthy" && run.profileTargetTaskLedgerBaselineFreshness === "fresh" ? "var(--success)" : "var(--warning)",
        fontSize: "0.84rem",
        lineHeight: "1.45"
      }
    }),
    createElement("div", {
      text: `Target baseline audit snapshot: ${run.targetBaselineAuditLedgerBaselineHealth || "missing"} / ${run.targetBaselineAuditLedgerBaselineFreshness || "missing"} | drift ${run.targetBaselineAuditLedgerBaselineDriftSeverity || "missing-snapshot"} | ${run.targetBaselineAuditLedgerBaselineUncheckpointedDriftCount || 0} uncheckpointed drift item(s) | captured ${run.targetBaselineAuditLedgerBaselineCapturedAt ? new Date(run.targetBaselineAuditLedgerBaselineCapturedAt).toLocaleString() : "not captured"}`,
      style: {
        color: run.targetBaselineAuditLedgerBaselineHealth === "healthy" && run.targetBaselineAuditLedgerBaselineFreshness === "fresh" ? "var(--success)" : "var(--warning)",
        fontSize: "0.84rem",
        lineHeight: "1.45"
      }
    }),
    createElement("div", {
      text: `Regression Alert baseline: ${run.regressionAlertTaskLedgerBaselineHealth || "missing"} / ${run.regressionAlertTaskLedgerBaselineFreshness || "missing"} | refresh ${run.regressionAlertTaskLedgerBaselineRefreshGateDecision || "ready"} | drift ${run.regressionAlertTaskLedgerBaselineDriftSeverity || "missing-baseline"} | ${run.regressionAlertTaskLedgerBaselineUncheckpointedDriftCount || 0} uncheckpointed / ${run.regressionAlertTaskLedgerBaselineOpenEscalatedCheckpointCount || 0} escalated | captured ${run.regressionAlertTaskLedgerBaselineCapturedAt ? new Date(run.regressionAlertTaskLedgerBaselineCapturedAt).toLocaleString() : "not captured"}`,
      style: {
        color: run.regressionAlertTaskLedgerBaselineRefreshGateDecision === "hold" || (run.regressionAlertTaskLedgerBaselineOpenEscalatedCheckpointCount || 0) > 0
          ? "var(--danger)"
          : run.regressionAlertTaskLedgerBaselineHealth === "healthy" && run.regressionAlertTaskLedgerBaselineRefreshGateDecision === "ready"
            ? "var(--success)"
            : "var(--warning)",
        fontSize: "0.84rem",
        lineHeight: "1.45"
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
      createTag(`target ${run.profileTargetTaskLedgerBaselineHealth || "missing"}/${run.profileTargetTaskLedgerBaselineFreshness || "missing"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: run.profileTargetTaskLedgerBaselineHealth === "healthy" ? "var(--success)" : run.profileTargetTaskLedgerBaselineHealth === "missing" ? "var(--danger)" : "var(--warning)"
      }),
      createTag(`audit ${run.targetBaselineAuditLedgerBaselineHealth || "missing"}/${run.targetBaselineAuditLedgerBaselineFreshness || "missing"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: run.targetBaselineAuditLedgerBaselineHealth === "healthy" ? "var(--success)" : run.targetBaselineAuditLedgerBaselineHealth === "missing" ? "var(--danger)" : "var(--warning)"
      }),
      createTag(`alert ${run.regressionAlertTaskLedgerBaselineHealth || "missing"}/${run.regressionAlertTaskLedgerBaselineRefreshGateDecision || "ready"}`, {
        background: "var(--bg)",
        border: "1px solid var(--border)",
        color: run.regressionAlertTaskLedgerBaselineRefreshGateDecision === "hold" ? "var(--danger)" : run.regressionAlertTaskLedgerBaselineHealth === "healthy" ? "var(--success)" : "var(--warning)"
      }),
      run.agentPolicyId
        ? createTag(`policy ${run.agentPolicyCheckpointStatus || "needs-review"}`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: run.agentPolicyCheckpointStatus === "approved" ? "var(--success)" : "var(--warning)"
          })
        : null,
      run.cliBridgeHandoffId
        ? createTag(`CLI bridge ${run.cliBridgeRunner || "runner"}`, {
            background: "var(--bg)",
            border: "1px solid var(--primary)",
            color: "var(--primary)"
          })
        : null,
      run.cliBridgeHandoffId
        ? createTag(`handoff ${run.cliBridgeHandoffId}`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)"
          })
        : null,
      run.cliBridgeDraftDecision
        ? createTag(`draft ${run.cliBridgeDraftDecision}`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: run.cliBridgeDraftDecision === "ready" ? "var(--success)" : run.cliBridgeDraftDecision === "hold" ? "var(--danger)" : "var(--warning)"
          })
        : null,
      run.latestCliBridgeResultHandoffId
        ? createTag(`CLI result ${run.latestCliBridgeResultStatus || "needs-review"} ${run.latestCliBridgeResultRunner || "runner"}`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: run.latestCliBridgeResultStatus === "changed" || run.latestCliBridgeResultStatus === "ready" ? "var(--success)" : run.latestCliBridgeResultStatus === "failed" || run.latestCliBridgeResultStatus === "blocked" ? "var(--danger)" : "var(--warning)"
          })
        : null,
      run.latestCliBridgeResultHandoffId
        ? createTag(`result handoff ${run.latestCliBridgeResultHandoffId}`, {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)"
          })
        : null,
      run.latestCliBridgeReviewHandoffId
        ? createTag(`CLI review ${run.latestCliBridgeReviewAction || "needs-review"} ${run.latestCliBridgeReviewStatus || ""}`.trim(), {
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: run.latestCliBridgeReviewStatus === "accepted" ? "var(--success)" : run.latestCliBridgeReviewStatus === "rejected" ? "var(--danger)" : "var(--warning)"
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
      !run.archivedAt && (
        run.profileTargetTaskLedgerBaselineHealth !== "healthy"
          || run.profileTargetTaskLedgerBaselineFreshness !== "fresh"
          || (run.profileTargetTaskLedgerBaselineUncheckpointedDriftCount || 0) > 0
      )
        ? createElement("button", {
            className: "btn governance-action-btn agent-work-order-run-target-baseline-refresh-btn",
            text: "Refresh Target",
            attrs: { type: "button" },
            dataset: {
              agentWorkOrderRunTargetBaselineRefreshId: run.id
            }
          })
        : null,
      !run.archivedAt && (
        run.targetBaselineAuditLedgerBaselineHealth !== "healthy"
          || run.targetBaselineAuditLedgerBaselineFreshness !== "fresh"
          || (run.targetBaselineAuditLedgerBaselineUncheckpointedDriftCount || 0) > 0
      )
        ? createElement("button", {
            className: "btn governance-action-btn agent-work-order-run-target-baseline-audit-refresh-btn",
            text: "Refresh Audit",
            attrs: { type: "button" },
            dataset: {
              agentWorkOrderRunTargetBaselineAuditRefreshId: run.id
            }
          })
        : null,
      !run.archivedAt && (
        run.regressionAlertTaskLedgerBaselineHealth !== "healthy"
          || run.regressionAlertTaskLedgerBaselineRefreshGateDecision !== "ready"
          || (run.regressionAlertTaskLedgerBaselineUncheckpointedDriftCount || 0) > 0
          || (run.regressionAlertTaskLedgerBaselineOpenEscalatedCheckpointCount || 0) > 0
      )
        ? createElement("button", {
            className: "btn governance-action-btn agent-work-order-run-regression-alert-baseline-refresh-btn",
            text: "Refresh Alert",
            attrs: { type: "button" },
            dataset: {
              agentWorkOrderRunRegressionAlertBaselineRefreshId: run.id
            }
          })
        : null,
      run.cliBridgeHandoffId
        ? createElement("button", {
            className: "btn governance-action-btn cli-bridge-runner-contract-copy-btn",
            text: "Copy CLI Contract",
            attrs: { type: "button" },
            dataset: {
              cliBridgeRunnerContractRunId: run.id,
              cliBridgeRunnerContractRunner: run.cliBridgeRunner || "codex"
            }
          })
        : null,
      run.cliBridgeHandoffId || run.latestCliBridgeResultHandoffId || run.latestCliBridgeReviewHandoffId
        ? createElement("button", {
            className: "btn governance-action-btn cli-bridge-run-trace-copy-btn",
            text: "Copy CLI Trace",
            attrs: { type: "button" },
            dataset: {
              cliBridgeRunTraceId: run.id
            }
          })
        : null,
      run.cliBridgeHandoffId || run.latestCliBridgeResultHandoffId || run.latestCliBridgeReviewHandoffId
        ? createElement("button", {
            className: "btn governance-action-btn cli-bridge-run-trace-snapshot-btn",
            text: "Save CLI Trace",
            attrs: { type: "button" },
            dataset: {
              cliBridgeRunTraceSnapshotRunId: run.id
            }
          })
        : null,
      run.cliBridgeHandoffId
        ? createElement("button", {
            className: "btn governance-action-btn cli-bridge-runner-result-run-capture-btn",
            text: "Record CLI Result",
            attrs: { type: "button" },
            dataset: {
              cliBridgeRunnerResultRunId: run.id,
              cliBridgeRunnerResultRunner: run.cliBridgeRunner || "codex"
            }
          })
        : null,
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
  if (controlPlaneProfileTargetBaselineHealth !== "healthy") {
    cliRunnerGateReasons.push({ severity: "review", message: `Profile target task baseline is ${controlPlaneProfileTargetBaselineHealth}.` });
  }
  if (controlPlaneTargetBaselineAuditHealth !== "healthy" || controlPlaneTargetBaselineAuditFreshness !== "fresh" || controlPlaneTargetBaselineAuditUncheckpointedDriftCount > 0) {
    cliRunnerGateReasons.push({
      severity: "review",
      message: `Target baseline audit is ${controlPlaneTargetBaselineAuditHealth}/${controlPlaneTargetBaselineAuditFreshness} with ${controlPlaneTargetBaselineAuditUncheckpointedDriftCount} uncheckpointed drift item(s).`
    });
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
  if ((executionMetrics.targetBaselineReviewRequired || 0) > 0) {
    cliRunnerGateReasons.push({ severity: "review", message: `${executionMetrics.targetBaselineReviewRequired} Agent Execution run(s) were queued against a missing, stale, or drifted profile target task baseline.` });
  }
  if ((executionMetrics.auditBaselineReviewRequired || 0) > 0) {
    cliRunnerGateReasons.push({ severity: "review", message: `${executionMetrics.auditBaselineReviewRequired} Agent Execution run(s) have missing, stale, or drifted target-baseline audit snapshot baseline evidence.` });
  }
  if ((executionMetrics.alertBaselineReviewRequired || 0) > 0) {
    cliRunnerGateReasons.push({ severity: "review", message: `${executionMetrics.alertBaselineReviewRequired} Agent Execution run(s) have missing, stale, drifted, or held Regression Alert baseline evidence.` });
  }
  if (controlPlaneAlertBaselineDriftOpenTaskCount > 0) {
    cliRunnerGateReasons.push({ severity: "review", message: `${controlPlaneAlertBaselineDriftOpenTaskCount} Regression Alert baseline drift task(s) must be resolved, blocked, or explicitly deferred before unattended CLI work.` });
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
        createTag(`Target ${controlPlaneProfileTargetBaselineHealth}/${controlPlaneProfileTargetBaselineFreshness}`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: controlPlaneProfileTargetBaselineColor
        }),
        createTag(`Audit ${controlPlaneTargetBaselineAuditHealth}/${controlPlaneTargetBaselineAuditFreshness}`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: controlPlaneTargetBaselineAuditColor
        }),
        createTag(`Alert drift tasks ${controlPlaneAlertBaselineDriftOpenTaskCount}/${controlPlaneAlertBaselineDriftTaskCount}`, {
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: controlPlaneAlertBaselineDriftTaskColor
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
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-runner-dry-run-copy-btn",
          text: "Copy Codex Dry Run",
          attrs: { type: "button" },
          dataset: {
            cliBridgeRunnerDryRun: "codex"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-runner-dry-run-snapshot-btn",
          text: "Save Codex Dry Run",
          attrs: { type: "button" },
          dataset: {
            cliBridgeRunnerDryRunSnapshot: "codex"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-runner-dry-run-copy-btn",
          text: "Copy Claude Dry Run",
          attrs: { type: "button" },
          dataset: {
            cliBridgeRunnerDryRun: "claude"
          }
        }),
        createElement("button", {
          className: "btn governance-action-btn cli-bridge-runner-dry-run-snapshot-btn",
          text: "Save Claude Dry Run",
          attrs: { type: "button" },
          dataset: {
            cliBridgeRunnerDryRunSnapshot: "claude"
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
    createListSection("Regression Alert Center", "Unified operator alerts from scan movement, source access, release gates, control-plane state, and mutation-scope coverage.", regressionAlertCenterEntries),
    createListSection("Regression Alert Remediation Tasks", "Compact ledger of tasks created from Regression Alert Center alerts.", regressionAlertTaskEntries),
    createListSection("Regression Alert Remediation Task Snapshots", "Saved non-secret baselines and drift reports for alert remediation task handoffs.", [...regressionAlertTaskLedgerSnapshotDiffEntries, ...regressionAlertTaskLedgerSnapshotEntries]),
    createListSection("Regression Alert Remediation Task Drift Checkpoints", "Operator decisions made against alert remediation task ledger drift before refreshing baselines.", regressionAlertTaskLedgerDriftCheckpointLedgerEntries),
    createListSection("Regression Alert Remediation Task Baseline Status", "Freshness, drift, checkpoint coverage, and refresh gate for the alert remediation task ledger baseline.", regressionAlertTaskLedgerBaselineStatusEntries),
    createListSection("Mutation Scope Audit Feed", "Live scanner feed for guarded and unguarded server mutation routes before autonomous build actions run.", mutationScopeAuditEntries),
    createListSection("Operator Proposal Review Queue", "User-contributed convergence proposals with AI due diligence, task state, and direct triage controls.", convergenceOperatorProposalQueueEntries),
    createListSection("Convergence Review Ledger", "Portfolio-level audit surface for auto-detected overlaps, operator proposals, and hidden Not Related decisions.", convergenceReviewLedgerEntries),
    createListSection("Convergence Assimilation Runs", "Queued Codex and Claude Agent Work Order runs created from convergence assimilation drafts.", convergenceAssimilationRunEntries),
    createListSection("Convergence Assimilation Results", "Non-secret Codex and Claude assimilation results captured back into Workspace Audit Pro.", convergenceAssimilationResultEntries),
    createListSection("Convergence Assimilation Result Checkpoints", "Operator decisions on captured assimilation results before follow-up implementation.", convergenceAssimilationResultCheckpointEntries),
    createListSection("Convergence Assimilation Readiness Gate", "Ready/review/hold gate for continuing supervised convergence implementation.", convergenceAssimilationReadinessEntries),
    createListSection("Convergence Assimilation Session Packet Snapshots", "Persisted non-secret Codex and Claude session packets for auditable CLI handoffs.", convergenceAssimilationSessionPacketSnapshotEntries),
    createListSection("Convergence Assimilation Runner Launchpad Gate Snapshots", "Persisted non-secret launchpad gate decisions for repeatable Codex and Claude execution handoffs.", convergenceAssimilationRunnerLaunchpadGateSnapshotEntries),
    createListSection("Convergence Assimilation Runner Launch Authorization Pack Snapshots", "Persisted non-secret launch authorization packs for repeatable Codex and Claude runner starts.", convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotEntries),
    createListSection("Convergence Assimilation Runner Launch Authorization Pack Snapshot Drift", "Latest saved launch authorization pack compared with current launch gate, packet, queue, and replay state.", convergenceAssimilationRunnerLaunchAuthorizationPackSnapshotDiffEntries),
    createListSection("Convergence Assimilation Runner Launch Authorization Pack Drift Checkpoints", "Operator decisions made against launch authorization pack drift before runner launch.", convergenceAssimilationRunnerLaunchAuthorizationPackDriftCheckpointLedgerEntries),
    createListSection("Convergence Assimilation Runner Launch Control Board", "Single runner-start decision combining launch authorization pack state and unresolved checkpoint ledger decisions.", convergenceAssimilationRunnerLaunchControlBoardEntries),
    createListSection("Convergence Assimilation Runner Launch Control Board Snapshots", "Persisted launch control board decisions for repeatable Codex and Claude runner-start baselines.", convergenceAssimilationRunnerLaunchControlBoardSnapshotEntries),
    createListSection("Convergence Assimilation Runner Launch Control Board Snapshot Drift", "Latest saved launch control board compared with current runner-start state.", convergenceAssimilationRunnerLaunchControlBoardSnapshotDiffEntries),
    createListSection("Convergence Assimilation Runner Launch Control Board Drift Checkpoints", "Operator decisions made against launch control board drift before runner launch.", convergenceAssimilationRunnerLaunchControlBoardDriftCheckpointLedgerEntries),
    createListSection("Convergence Assimilation Runner Launch Execution Packet", "Copyable runner-start handoff combining launch board, authorization, command queue, replay checklist, and drift decisions.", convergenceAssimilationRunnerLaunchExecutionPacketEntries),
    createListSection("Convergence Assimilation Runner Launch Execution Packet Snapshots", "Persisted runner-start handoffs for auditable Codex and Claude launch baselines.", convergenceAssimilationRunnerLaunchExecutionPacketSnapshotEntries),
    createListSection("Convergence Assimilation Runner Launch Execution Packet Snapshot Drift", "Latest saved runner-start handoff compared with current live launch execution packet.", convergenceAssimilationRunnerLaunchExecutionPacketSnapshotDiffEntries),
    createListSection("Convergence Assimilation Runner Launch Execution Packet Drift Checkpoints", "Operator decisions made against launch execution packet drift before CLI handoff reuse.", convergenceAssimilationRunnerLaunchExecutionPacketDriftCheckpointLedgerEntries),
    createListSection("Convergence Assimilation Runner Launch Stack Status", "Single ready/review/hold rollup for Codex and Claude launch handoff safety.", convergenceAssimilationRunnerLaunchStackStatusEntries),
    createListSection("Convergence Assimilation Runner Launch Stack Remediation Pack", "Copyable Codex and Claude remediation handoff for non-ready stack stages, open tasks, and unresolved checkpoint drift.", convergenceAssimilationRunnerLaunchStackRemediationPackEntries),
    createListSection("Convergence Assimilation Runner Launch Stack Remediation Work-Order Draft", "Non-executing Codex and Claude work-order prompts generated from the current remediation pack.", convergenceAssimilationRunnerLaunchStackRemediationWorkOrderDraftEntries),
    createListSection("Convergence Assimilation Runner Launch Stack Remediation Work-Order Run Ledger", "Queued Codex and Claude launch stack remediation handoffs tracked as supervised agent work-order runs.", convergenceAssimilationRunnerLaunchStackRemediationWorkOrderRunLedgerEntries),
    createListSection("Convergence Assimilation Runner Launch Stack Remediation Work-Order Result Ledger", "Non-secret Codex and Claude remediation outcomes captured after supervised work-order runs.", convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultLedgerEntries),
    createListSection("Convergence Assimilation Runner Launch Stack Remediation Work-Order Result Follow-Up Task Ledger", "Trackable Governance tasks created from blocked, failed, or needs-review remediation outcomes.", convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerEntries),
    createListSection("Convergence Assimilation Runner Launch Stack Remediation Work-Order Result Follow-Up Task Ledger Snapshots", "Persisted remediation result follow-up task baselines for later drift comparison.", convergenceAssimilationRunnerLaunchStackRemediationWorkOrderResultTaskLedgerSnapshotEntries),
    createListSection("Convergence Assimilation Runner Launch Stack Remediation Pack Snapshots", "Persisted Codex and Claude remediation pack baselines for later launch stack drift comparison.", convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotEntries),
    createListSection("Convergence Assimilation Runner Launch Stack Remediation Pack Snapshot Drift", "Latest saved launch stack remediation pack compared with current live runner remediation state.", convergenceAssimilationRunnerLaunchStackRemediationPackSnapshotDiffEntries),
    createListSection("Convergence Assimilation Runner Launch Stack Remediation Pack Drift Checkpoints", "Operator decisions made against launch stack remediation pack drift before runner handoff reuse.", convergenceAssimilationRunnerLaunchStackRemediationPackDriftCheckpointLedgerEntries),
    createListSection("Convergence Assimilation Runner Launch Stack Action Task Ledger", "Trackable Governance tasks created from non-ready launch stack stages.", convergenceAssimilationRunnerLaunchStackActionTaskLedgerEntries),
    createListSection("Convergence Assimilation Runner Launch Stack Action Task Ledger Snapshots", "Persisted launch stack action task baselines for repeatable runner remediation handoffs.", convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotEntries),
    createListSection("Convergence Assimilation Runner Launch Stack Action Task Ledger Snapshot Drift", "Latest saved launch stack action task ledger compared with the current live remediation task state.", convergenceAssimilationRunnerLaunchStackActionTaskLedgerSnapshotDiffEntries),
    createListSection("Convergence Assimilation Runner Launch Stack Action Task Ledger Drift Checkpoints", "Operator decisions made against launch stack action task ledger drift before runner remediation handoff reuse.", convergenceAssimilationRunnerLaunchStackActionTaskLedgerDriftCheckpointLedgerEntries),
    createListSection("Convergence Assimilation Runner Launchpad Gate Snapshot Drift", "Latest saved launchpad gate compared with current readiness, packet drift, and checkpoint state.", convergenceAssimilationRunnerLaunchpadGateSnapshotDiffEntries),
    createListSection("Convergence Assimilation Runner Launchpad Gate Drift Checkpoints", "Operator decisions made against launchpad gate drift before runner launch.", convergenceAssimilationRunnerLaunchpadGateDriftCheckpointLedgerEntries),
    createListSection("Convergence Assimilation Session Packet Snapshot Drift", "Latest saved session packet compared with current live convergence assimilation handoff state.", convergenceAssimilationSessionPacketSnapshotDiffEntries),
    createListSection("Convergence Assimilation Session Packet Drift Checkpoints", "Operator decisions made against session packet drift before refreshing CLI handoffs.", convergenceAssimilationSessionPacketDriftCheckpointLedgerEntries),
    createListSection("Convergence Review Tasks", "Trackable tasks created from confirmed, merge-candidate, or needs-review overlap pairs.", convergenceTaskEntries),
    createListSection("Convergence Review Task Ledger Snapshots", "Persisted non-secret baselines and drift handoffs for convergence task follow-up work.", [...convergenceTaskLedgerSnapshotDiffEntries, ...convergenceTaskLedgerSnapshotEntries]),
    createListSection("Task Seeding Checkpoints", "Operator decisions for generated task batches before or instead of creating task records.", taskSeedingCheckpointEntries),
    createListSection("Task Update Audit Ledger", "Recent non-secret Governance task lifecycle update operations with operator checkpoints.", governanceTaskUpdateLedgerEntries),
    createListSection("Task Update Audit Ledger Snapshots", "Persisted non-secret Governance task update audit ledger handoffs.", [...governanceTaskUpdateLedgerSnapshotDiffEntries, ...governanceTaskUpdateLedgerSnapshotEntries]),
    createListSection("Vibe Coder Operating Guide", "Step-by-step operating cycle for safe app debugging, build validation, local relaunch, and supervised agent work.", vibeCoderOperatingGuideEntries),
    createListSection("CLI Runner Readiness Gate", "Readiness signal for a future supervised Codex CLI / Claude CLI work-order runner prototype.", cliRunnerReadinessEntries),
    createListSection("CLI Bridge Architecture", "Recommended non-executing integration path for Codex CLI and Claude CLI through app-owned work orders and sanitized handoffs.", cliBridgeArchitectureEntries),
    createListSection("CLI Bridge Handoff Ledger", "App-owned non-secret mailbox for Codex, Claude, operator, and Workspace Audit handoff summaries.", cliBridgeHandoffLedgerEntries),
    createListSection("CLI Bridge Runner Dry Run Snapshots", "Persisted non-secret Codex and Claude dry-run contracts before supervised CLI execution.", cliBridgeRunnerDryRunSnapshotEntries),
    createListSection("CLI Bridge Runner Dry Run Baseline Status", "Freshness, health, and drift state for the latest saved CLI bridge runner dry-run baseline.", cliBridgeRunnerDryRunSnapshotBaselineStatusEntries),
    createListSection("CLI Bridge Runner Dry Run Baseline Lifecycle Ledger", "Copyable audit trail for saved, refreshed, and accepted Codex or Claude dry-run baselines.", cliBridgeRunnerDryRunSnapshotLifecycleLedgerEntries),
    createListSection("CLI Bridge Runner Dry Run Snapshot Drift", "Latest saved Codex or Claude dry-run contract compared with the current live dry-run gate.", cliBridgeRunnerDryRunSnapshotDiffEntries),
    createListSection("CLI Bridge Run Trace Snapshots", "Persisted non-secret trace packs from CLI-linked Agent Execution runs.", cliBridgeRunTraceSnapshotEntries),
    createListSection("CLI Bridge Run Trace Baseline Status", "Freshness, health, and drift state for the latest saved CLI bridge trace baseline.", cliBridgeRunTraceSnapshotBaselineStatusEntries),
    createListSection("CLI Bridge Run Trace Lifecycle Ledger", "Copyable audit trail for saved and accepted CLI bridge run trace baselines.", cliBridgeRunTraceSnapshotLifecycleLedgerEntries),
    createListSection("CLI Bridge Lifecycle Stack Status", "Single ready/review/hold rollup for dry-run and run-trace lifecycle evidence.", cliBridgeLifecycleStackStatusEntries),
    createListSection("CLI Bridge Lifecycle Stack Remediation Pack", "Copyable operator handoff for non-ready dry-run and run-trace lifecycle stages.", cliBridgeLifecycleStackRemediationPackEntries),
    createListSection("CLI Bridge Lifecycle Handoff Packet", "Copyable non-secret launch brief that combines lifecycle gate, remediation, baseline, and runner instructions.", cliBridgeLifecycleHandoffPacketEntries),
    createListSection("CLI Bridge Lifecycle Handoff Packet Snapshots", "Persisted non-secret launch briefs for repeatable Codex CLI and Claude CLI handoff review.", [...cliBridgeLifecycleHandoffPacketSnapshotDiffEntries, ...cliBridgeLifecycleHandoffPacketSnapshotEntries]),
    createListSection("CLI Bridge Lifecycle Handoff Packet Drift Checkpoints", "Operator decisions made against handoff packet drift before Codex or Claude launch packet reuse.", cliBridgeLifecycleHandoffPacketDriftCheckpointLedgerEntries),
    createListSection("CLI Bridge Lifecycle Handoff Packet Baseline Status", "Freshness, drift health, checkpoint coverage, and reuse gate for the latest saved handoff packet baseline.", cliBridgeLifecycleHandoffPacketBaselineStatusEntries),
    createListSection("CLI Bridge Lifecycle Stack Remediation Task Ledger", "Copyable audit trail for remediation tasks created from lifecycle stack work items.", cliBridgeLifecycleStackRemediationTaskLedgerEntries),
    createListSection("CLI Bridge Lifecycle Stack Remediation Task Ledger Snapshots", "Persisted non-secret task ledger baselines for repeatable CLI bridge lifecycle remediation handoffs.", cliBridgeLifecycleStackRemediationTaskLedgerSnapshotEntries),
    createListSection("CLI Bridge Lifecycle Stack Remediation Task Ledger Snapshot Drift", "Latest saved remediation task ledger snapshot compared with the current live remediation follow-up ledger.", cliBridgeLifecycleStackRemediationTaskLedgerSnapshotDiffEntries),
    createListSection("CLI Bridge Lifecycle Stack Remediation Task Ledger Drift Checkpoints", "Operator decisions made against remediation task ledger drift before CLI bridge handoff reuse.", cliBridgeLifecycleStackRemediationTaskLedgerDriftCheckpointLedgerEntries),
    createListSection("CLI Bridge Lifecycle Stack Remediation Task Ledger Baseline Status", "Freshness, drift health, and checkpoint coverage for the latest saved remediation task ledger baseline.", cliBridgeLifecycleStackRemediationTaskLedgerBaselineStatusEntries),
    createListSection("CLI Bridge Run Trace Snapshot Drift", "Latest saved CLI bridge run trace snapshot compared with the current live trace state.", cliBridgeRunTraceSnapshotDiffEntries),
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
    createListSection("Agent Execution Target Baseline Audit Ledger", "No-secret copyable checklist for run baseline capture health before unattended CLI execution.", agentExecutionTargetBaselineAuditLedgerEntries),
    createListSection("Agent Execution Regression Alert Baseline Ledger", "No-secret copyable checklist for alert-baseline capture health before unattended CLI execution.", agentExecutionRegressionAlertBaselineLedgerEntries),
    createListSection("Agent Execution Regression Alert Baseline Ledger Snapshots", "Persisted alert-baseline ledgers for external handoff and build evidence.", agentExecutionRegressionAlertBaselineLedgerSnapshotEntries),
    createListSection("Agent Execution Regression Alert Baseline Status", "Freshness, drift health, and checkpoint coverage for the accepted alert-baseline snapshot.", agentExecutionRegressionAlertBaselineLedgerBaselineStatusEntries),
    createListSection("Agent Execution Regression Alert Baseline Drift Tasks", "Trackable Governance tasks created from accepted alert-baseline snapshot drift.", agentExecutionRegressionAlertBaselineDriftTaskEntries),
    createListSection("Agent Execution Regression Alert Baseline Drift Checkpoints", "Operator decisions made against alert-baseline snapshot drift before refreshing execution baselines.", agentExecutionRegressionAlertBaselineLedgerDriftCheckpointEntries),
    createListSection("Agent Execution Target Baseline Audit Baseline Status", "Freshness, drift health, and checkpoint coverage for the accepted target-baseline audit snapshot.", agentExecutionTargetBaselineAuditLedgerBaselineStatusEntries),
    createListSection("Agent Execution Target Baseline Audit Drift Checkpoints", "Operator decisions made against target-baseline audit snapshot drift before refreshing execution baselines.", agentExecutionTargetBaselineAuditLedgerDriftCheckpointEntries),
    createListSection("Agent Execution Target Baseline Audit Ledger Snapshots", "Persisted target-baseline audit ledgers for external handoff and build evidence.", agentExecutionTargetBaselineAuditLedgerSnapshotEntries),
    createListSection("SLA Breach Ledger", "Recent open and resolved Agent Execution SLA breach lifecycle records.", slaLedgerEntries),
    createListSection("SLA Ledger Snapshots", "Persisted SLA Breach Ledger exports for external audit handoffs.", agentExecutionSlaLedgerSnapshotEntries),
    createListSection("Agent Execution Queue", "Queued and in-flight Agent Work Order runs with validation outcomes.", agentWorkOrderRunEntries),
    createListSection("Governance Gaps", "App-development scoped projects that still have no saved governance profile.", gapEntries),
    createListSection("Project Registry", "Persisted ownership, lifecycle, and target-state profiles across the portfolio.", profileEntries),
    createListSection("Governance Profile Targets", "Scan-derived test coverage and runtime targets for scoped app-development profiles.", profileTargetEntries),
    createListSection("Governance Profile Target Tasks", "Deduplicated task ledger for profile test coverage and runtime target gaps.", profileTargetTaskEntries),
    createListSection("Governance Profile Target Task Baseline Status", "Freshness, drift health, and checkpoint coverage for the accepted profile target task baseline.", profileTargetTaskLedgerBaselineStatusEntries),
    createListSection("Governance Profile Target Task Snapshot Drift", "Latest saved profile target task baseline compared with current live profile target tasks.", profileTargetTaskSnapshotDiffEntries),
    createListSection("Governance Profile Target Task Drift Checkpoints", "Operator decisions made against profile target task ledger drift before refreshing the accepted baseline.", profileTargetTaskDriftCheckpointLedgerEntries),
    createListSection("Governance Profile Target Task Snapshots", "Saved baselines for the profile target task ledger.", profileTargetTaskSnapshotEntries),
    createListSection("Profile History", "Recent ownership, lifecycle, and status changes captured over time.", historyEntries),
    createListSection("Decision Log", "Persisted decision notes that define portfolio direction.", decisionEntries),
    createListSection("Milestone Focus", "Upcoming or unresolved milestones that still need attention.", milestoneEntries),
    createListSection("Workflow Queue", "Active workflows currently moving through the delivery pipeline.", workflowEntries)
  ]);
}
