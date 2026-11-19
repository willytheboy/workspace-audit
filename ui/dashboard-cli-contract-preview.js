// @ts-check

import { createElement, createPanelNotice, createTag } from "./dashboard-components.js";

/** @typedef {{ activeProjectId: string, scopeMode: "project" | "portfolio" }} PreviewScope */
/** @typedef {import("./dashboard-types.js").CliBridgeRunnerDryRunPayload} DryRunPayload */

const DECISION_LABELS = { ready: "Ready", review: "Review required", hold: "On hold" };
const DECISION_COLORS = { ready: "var(--success)", review: "var(--warning)", hold: "var(--danger)" };

/** @param {DryRunPayload} payload */
function renderContract(payload) {
  const order = payload.selectedWorkOrder;
  const workingDirectory = payload.commandEnvelope.workingDirectory;
  const reasons = [...payload.reasons].sort((left, right) =>
    Number(right.severity === "hold") - Number(left.severity === "hold")
  );
  /** @type {Array<[string, "ready" | "review"]>} */
  const gates = [
    ["Target audit", payload.targetBaselineAuditGate.decision],
    ["Audit run evidence", payload.auditBaselineRunGate.decision],
    [`Alert drift tasks (${payload.alertBaselineDriftTaskGate.openTaskCount} open)`, payload.alertBaselineDriftTaskGate.decision]
  ];

  return [
    createPanelNotice({
      title: DECISION_LABELS[payload.dryRunDecision],
      message: payload.dryRunDecision === "ready"
        ? "Confirm the working folder and validation commands before copying the handoff."
        : payload.recommendedAction,
      tone: DECISION_COLORS[payload.dryRunDecision]
    }),
    createElement("div", { className: "tags" }, gates.map(([label, decision]) =>
      createTag(`${label}: ${decision}`, { color: DECISION_COLORS[decision] })
    )),
    ...(reasons.length ? [createElement("details", { className: "setup-modal-helper" }, [
      createElement("summary", { text: `Readiness checks (${reasons.length})` }),
      createElement("ul", { style: { paddingInlineStart: "1.25rem" } }, reasons.map((reason) =>
        createElement("li", { text: `${DECISION_LABELS[reason.severity] || "Check"}: ${reason.message}` })
      ))
    ])] : []),
    createElement("p", { className: "setup-modal-helper" }, [
      "Working folder: ",
      createElement("code", { text: workingDirectory })
    ]),
    createElement("p", { className: "setup-modal-helper", text: order.objective }),
    createElement("div", { className: "setup-modal-helper" }, [
      createElement("strong", { text: "Validation commands" }),
      order.validationCommands.length
        ? createElement("ul", { style: { paddingInlineStart: "1.25rem" } }, order.validationCommands.map((command) =>
            createElement("li", {}, [createElement("code", { text: command })])
          ))
        : createElement("p", { text: "Check the project Launchpad for validation commands." })
    ])
  ];
}

/**
 * @param {{
 *   run: import("./dashboard-types.js").PersistedAgentWorkOrderRun,
 *   getScope: () => PreviewScope,
 *   fetchDryRun: (options: PreviewScope & { runId: string, runner: "codex" | "claude" }) => Promise<DryRunPayload>,
 *   copyText: (text: string) => Promise<void>
 * }} options
 */
export function openCliContractPreview({ run, getScope, fetchDryRun, copyText }) {
  const titleId = "cli-contract-preview-title";
  const projectName = run.projectName || run.projectId;
  const dialog = createElement("dialog", {
    attrs: { "aria-labelledby": titleId },
    style: {
      width: "min(38rem, calc(100% - 2rem))",
      maxHeight: "calc(100% - 2rem)",
      margin: "auto",
      padding: "1.3rem",
      background: "var(--surface)",
      color: "var(--text)",
      border: "1px solid var(--border)",
      borderRadius: "1rem",
      overflow: "auto",
      overflowWrap: "anywhere"
    }
  });
  const runnerSelect = createElement("select", { className: "setup-modal-input" }, [
    createElement("option", { text: "Codex CLI", attrs: { value: "codex" } }),
    createElement("option", { text: "Claude CLI", attrs: { value: "claude" } })
  ]);
  runnerSelect.value = run.cliBridgeRunner === "claude" ? "claude" : "codex";
  const status = createElement("p", { className: "setup-modal-helper", attrs: { role: "status" } });
  const body = createElement("div", { className: "setup-modal-body" });
  const closeButton = createElement("button", { className: "btn", text: "Close", attrs: { type: "button" } });
  const refreshButton = createElement("button", { className: "btn", text: "Refresh preview", attrs: { type: "button" } });
  const copyButton = createElement("button", { className: "btn btn-primary", text: "Copy CLI contract", attrs: { type: "button" } });
  copyButton.hidden = true;

  /** @type {{ scope: PreviewScope, markdown: string } | null} */
  let copyableContract = null;

  /** @param {PreviewScope} previous */
  function scopeMatches(previous) {
    const current = getScope();
    return current.activeProjectId === previous.activeProjectId && current.scopeMode === previous.scopeMode;
  }

  async function refresh() {
    copyableContract = null;
    copyButton.hidden = true;
    body.replaceChildren();
    const scope = getScope();
    if (scope.scopeMode === "project" && scope.activeProjectId !== run.projectId) {
      status.textContent = `Select ${projectName} in Active project scope, then reopen this preview. If the project is missing, refresh the audit or queue a work order for a listed project.`;
      return;
    }

    runnerSelect.disabled = refreshButton.disabled = true;
    status.textContent = "Checking work order readiness...";
    const runner = runnerSelect.value === "claude" ? "claude" : "codex";
    try {
      const payload = await fetchDryRun({ ...scope, runner, runId: run.id });
      if (!dialog.open) return;
      if (!scopeMatches(scope)) {
        status.textContent = "The active scope changed. Refresh the preview to use the current scope.";
        return;
      }
      if (payload.runner !== runner
          || payload.selectedWorkOrder.sourceType !== "agent-work-order-run"
          || payload.selectedWorkOrder.id !== run.id
          || payload.selectedWorkOrder.projectId !== run.projectId
          || payload.scopeContext.scopeMode !== scope.scopeMode
          || payload.scopeContext.activeProjectId !== scope.activeProjectId) {
        status.textContent = "Refresh Governance and reopen this work order to get a matching contract.";
        return;
      }

      status.textContent = `${payload.commandEnvelope.label} preview updated.`;
      body.replaceChildren(...renderContract(payload));
      if (payload.scopeContext.scopeReady && payload.dryRunDecision === "ready" && payload.markdown) {
        copyableContract = { scope, markdown: payload.markdown };
        copyButton.hidden = false;
      }
    } catch (error) {
      if (dialog.open) status.textContent = `Could not load the preview. ${error instanceof Error ? error.message : "Try again."}`;
    } finally {
      runnerSelect.disabled = refreshButton.disabled = false;
    }
  }

  copyButton.onclick = async () => {
    if (!copyableContract) return;
    if (!scopeMatches(copyableContract.scope)) {
      await refresh();
      return;
    }
    copyButton.disabled = runnerSelect.disabled = refreshButton.disabled = true;
    try {
      await copyText(copyableContract.markdown);
      status.textContent = "CLI contract copied.";
    } catch (error) {
      status.textContent = `Could not copy the contract. ${error instanceof Error ? error.message : "Try again."}`;
    } finally {
      copyButton.disabled = runnerSelect.disabled = refreshButton.disabled = false;
    }
  };
  runnerSelect.onchange = refresh;
  refreshButton.onclick = refresh;
  closeButton.onclick = () => dialog.close();
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.append(createElement("div", { className: "setup-modal-body" }, [
    createElement("header", { className: "setup-modal-header" }, [
      createElement("div", {}, [
        createElement("h2", { className: "setup-modal-title", text: "CLI contract preview", attrs: { id: titleId } }),
        createElement("p", { className: "setup-modal-helper", text: `${projectName} / ${run.title}` })
      ]),
      closeButton
    ]),
    createElement("label", { className: "setup-modal-helper" }, ["Runner", runnerSelect]),
    status,
    body,
    createElement("div", { className: "governance-actions" }, [refreshButton, copyButton])
  ]));
  document.body.append(dialog);
  dialog.showModal();
  void refresh();
}
