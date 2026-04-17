// @ts-check

import { bindAppLaunchers, getColor } from "./dashboard-utils.js";
import {
  createConvergenceFilterCard,
  createConvergenceProposalCard,
  createMetricBarCard,
  createMetricValueCard,
  createScriptButton,
  createSimilarCard,
  createStackTags,
  createWarningItem,
  createWorkbenchEmptyState,
  createWorkbenchEntry,
  createWorkbenchLaunchCard
} from "./dashboard-modal-components.js";

const WORKFLOW_PHASE_SEQUENCE = ["brief", "planning", "approval", "implementation", "review", "done"];

/**
 * @typedef {import("./dashboard-types.js").AuditPayload} AuditPayload
 * @typedef {import("./dashboard-types.js").AuditProject} AuditProject
 * @typedef {import("./dashboard-types.js").PersistedFinding} PersistedFinding
 * @typedef {import("./dashboard-types.js").PersistedTask} PersistedTask
 * @typedef {import("./dashboard-types.js").PersistedWorkflow} PersistedWorkflow
 * @typedef {import("./dashboard-types.js").PersistedScriptRun} PersistedScriptRun
 * @typedef {import("./dashboard-types.js").PersistedAgentSession} PersistedAgentSession
 * @typedef {import("./dashboard-types.js").PersistedNote} PersistedNote
 * @typedef {import("./dashboard-types.js").PersistedMilestone} PersistedMilestone
 * @typedef {import("./dashboard-types.js").PersistedProjectProfile} PersistedProjectProfile
 * @typedef {import("./dashboard-types.js").PersistedProjectProfileHistory} PersistedProjectProfileHistory
 * @typedef {import("./dashboard-types.js").ConvergenceCandidate} ConvergenceCandidate
 */

/**
 * @param {{
 *   getData: () => AuditPayload,
 *   api: {
 *     openInCursor: (relPath: string) => Promise<unknown>,
 *     fetchFindings: (projectId?: string) => Promise<PersistedFinding[]>,
 *     refreshFindings: () => Promise<{ success: true, findings: PersistedFinding[] }>,
 *     fetchTasks: (projectId?: string) => Promise<PersistedTask[]>,
 *     createTask: (payload: { title: string, description?: string, priority?: string, status?: string, projectId?: string, projectName?: string, activeProjectId?: string, scopeMode?: "project" | "portfolio" }) => Promise<unknown>,
 *     updateTask: (taskId: string, payload: Partial<PersistedTask> & { activeProjectId?: string, scopeMode?: "project" | "portfolio" }) => Promise<unknown>,
 *     fetchWorkflows: (projectId?: string) => Promise<PersistedWorkflow[]>,
 *     createWorkflow: (payload: { title: string, brief?: string, status?: string, phase?: string, projectId?: string, projectName?: string }) => Promise<unknown>,
 *     updateWorkflow: (workflowId: string, payload: Partial<PersistedWorkflow>) => Promise<unknown>,
 *     fetchScriptRuns: (projectId?: string) => Promise<PersistedScriptRun[]>,
 *     fetchAgentSessions: (projectId?: string) => Promise<PersistedAgentSession[]>,
 *     createAgentSession: (payload: { projectId: string, projectName: string, relPath: string, title: string, summary?: string, handoffPack: string, status?: string }) => Promise<unknown>,
 *     fetchNotes: (projectId?: string) => Promise<PersistedNote[]>,
 *     createNote: (payload: { title: string, body?: string, kind?: string, projectId?: string, projectName?: string }) => Promise<unknown>,
 *     updateNote: (noteId: string, payload: Partial<PersistedNote>) => Promise<unknown>,
 *     fetchMilestones: (projectId?: string) => Promise<PersistedMilestone[]>,
 *     createMilestone: (payload: { title: string, detail?: string, status?: string, targetDate?: string, projectId?: string, projectName?: string }) => Promise<unknown>,
 *     updateMilestone: (milestoneId: string, payload: Partial<PersistedMilestone>) => Promise<unknown>,
 *     fetchProjectProfiles: (projectId?: string) => Promise<PersistedProjectProfile[]>,
 *     fetchProjectProfileHistory: (projectId?: string) => Promise<PersistedProjectProfileHistory[]>,
 *     saveProjectProfile: (payload: { projectId: string, projectName: string, owner?: string, status?: string, lifecycle?: string, tier?: string, targetState?: string, summary?: string }) => Promise<unknown>,
 *     fetchConvergenceCandidates: (filters?: { projectId?: string, status?: string, includeNotRelated?: boolean }) => Promise<import("./dashboard-types.js").ConvergenceCandidatesPayload>,
 *     saveConvergenceReview: (payload: { leftId: string, rightId: string, leftName?: string, rightName?: string, score?: number, reasons?: string[], status: string, note?: string }) => Promise<unknown>,
 *     proposeConvergenceOverlap: (payload: { leftId: string, rightId: string, operatorContext?: string, reviewer?: string, status?: string }) => Promise<{ success: true, review: import("./dashboard-types.js").ConvergenceReview, candidates: ConvergenceCandidate[] }>
 *   }
 * }} options
 */
export function createDashboardModal({ getData, api }) {
  /** @type {AuditProject | null} */
  let currentProject = null;
  /** @type {"overview" | "findings" | "tasks" | "workflow" | "memory" | "launchpad"} */
  let activeTab = "overview";
  /** @type {EventSource | null} */
  let currentTerminalSource = null;
  let workbenchLoading = false;
  let workbenchError = "";
  /** @type {PersistedFinding[]} */
  let findings = [];
  /** @type {PersistedTask[]} */
  let tasks = [];
  /** @type {PersistedWorkflow[]} */
  let workflows = [];
  /** @type {PersistedScriptRun[]} */
  let scriptRuns = [];
  /** @type {PersistedAgentSession[]} */
  let agentSessions = [];
  /** @type {PersistedNote[]} */
  let notes = [];
  /** @type {PersistedMilestone[]} */
  let milestones = [];
  /** @type {PersistedProjectProfile | null} */
  let projectProfile = null;
  /** @type {PersistedProjectProfileHistory[]} */
  let profileHistory = [];
  /** @type {ConvergenceCandidate[]} */
  let convergenceCandidates = [];

  /**
   * @param {AuditProject | null} [project]
   */
  function createProjectScopeOptions(project = currentProject) {
    return {
      activeProjectId: project?.id || "",
      scopeMode: "project"
    };
  }
  /** @type {"active" | "needs-review" | "not-related" | "all"} */
  let convergenceFilter = "active";

  const overlay = /** @type {HTMLElement} */ (document.getElementById("app-modal"));
  const tabButtons = /** @type {NodeListOf<HTMLButtonElement>} */ (overlay.querySelectorAll("[data-workbench-tab]"));
  const panels = /** @type {NodeListOf<HTMLElement>} */ (overlay.querySelectorAll("[data-workbench-panel]"));
  const terminal = /** @type {HTMLElement} */ (document.getElementById("modal-terminal"));
  const taskForm = /** @type {HTMLFormElement} */ (document.getElementById("workbench-task-form"));
  const workflowForm = /** @type {HTMLFormElement} */ (document.getElementById("workbench-workflow-form"));
  const noteForm = /** @type {HTMLFormElement} */ (document.getElementById("workbench-note-form"));
  const milestoneForm = /** @type {HTMLFormElement} */ (document.getElementById("workbench-milestone-form"));
  const profileForm = /** @type {HTMLFormElement} */ (document.getElementById("workbench-profile-form"));

  /**
   * @param {string} phase
   */
  function getNextWorkflowPhase(phase) {
    const currentIndex = WORKFLOW_PHASE_SEQUENCE.indexOf(phase);
    if (currentIndex === -1 || currentIndex === WORKFLOW_PHASE_SEQUENCE.length - 1) {
      return null;
    }
    return WORKFLOW_PHASE_SEQUENCE[currentIndex + 1];
  }

  function resetTerminalSource() {
    if (currentTerminalSource) {
      currentTerminalSource.close();
      currentTerminalSource = null;
    }
  }

  /**
   * @param {string | undefined | null} value
   */
  function formatDate(value) {
    if (!value) return "Unknown";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  }

  /**
   * @param {string} text
   * @param {string} [tone]
   */
  function createHeaderTag(text, tone = "var(--text-muted)") {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = text;
    tag.style.color = tone;
    tag.style.borderColor = `${tone}55`;
    tag.style.background = "var(--bg)";
    return tag;
  }

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
      } catch (error) {
        alert(error instanceof Error ? error.message : "Action failed.");
      } finally {
        button.disabled = false;
      }
    });
    return button;
  }

  /**
   * @param {string} text
   */
  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  /**
   * @param {AuditProject} project
   */
  function buildAgentHandoffPack(project) {
    const launchCommands = Array.isArray(project.launchCommands) ? project.launchCommands : [];
    const runtimeSurfaces = Array.isArray(project.runtimeSurfaces) ? project.runtimeSurfaces : [];
    const runtimeLines = launchCommands.length
      ? launchCommands.map((command) => `- ${command.label || command.name}: ${command.run || command.command} (cwd: ${command.cwd || project.relPath})`).join("\n")
      : runtimeSurfaces.length
        ? runtimeSurfaces.map((surface) => `- ${surface.label || surface.type}: ${surface.cwd || project.relPath}`).join("\n")
        : project.scripts?.length
          ? project.scripts.map((script) => `- npm run ${script}`).join("\n")
          : "- No package scripts detected.";
    const lines = [
      `# Agent Handoff Pack: ${project.name}`,
      "",
      "## Project",
      `- ID: ${project.id}`,
      `- Path: ${project.relPath}`,
      `- Category: ${project.category}`,
      `- Zone: ${project.zone}`,
      `- Health: ${project.qualityScore}`,
      `- Freshness: ${project.freshnessScore}`,
      `- Readiness: ${project.readinessScore}`,
      `- Source files: ${project.sourceFiles}`,
      `- Source lines: ${project.sourceLines}`,
      `- Description: ${project.description || "No description captured."}`,
      "",
      "## Runtime Surface",
      runtimeLines,
      "",
      "## Stack",
      [...project.frameworks, ...project.languages].length
        ? [...project.frameworks, ...project.languages].map((item) => `- ${item}`).join("\n")
        : "- Stack not identified.",
      "",
      "## Governance Profile",
      projectProfile
        ? [
            `- Owner: ${projectProfile.owner || "unassigned"}`,
            `- Status: ${projectProfile.status}`,
            `- Lifecycle: ${projectProfile.lifecycle}`,
            `- Tier: ${projectProfile.tier}`,
            `- Target state: ${projectProfile.targetState}`,
            `- Summary: ${projectProfile.summary || "No summary captured."}`
          ].join("\n")
        : "- No governance profile captured.",
      "",
      "## Findings",
      findings.length
        ? findings.map((finding) => `- [${finding.severity}] ${finding.title}: ${finding.detail} (${finding.status})`).join("\n")
        : "- No persisted findings linked to this project.",
      "",
      "## Open Tasks",
      tasks.length
        ? tasks.map((task) => `- [${task.priority}/${task.status}] ${task.title}: ${task.description || "No description."}`).join("\n")
        : "- No persisted tasks linked to this project.",
      "",
      "## Workflows",
      workflows.length
        ? workflows.map((workflow) => `- [${workflow.phase}/${workflow.status}] ${workflow.title}: ${workflow.brief || "No brief."}`).join("\n")
        : "- No persisted workflows linked to this project.",
      "",
      "## Notes And Decisions",
      notes.length
        ? notes.map((note) => `- [${note.kind}] ${note.title}: ${note.body || "No body."}`).join("\n")
        : "- No notes or decisions linked to this project.",
      "",
      "## Milestones",
      milestones.length
        ? milestones.map((milestone) => `- [${milestone.status}] ${milestone.title}${milestone.targetDate ? ` target ${milestone.targetDate}` : ""}: ${milestone.detail || "No detail."}`).join("\n")
        : "- No milestones linked to this project.",
      "",
      "## Recent Script Runs",
      scriptRuns.length
        ? scriptRuns.slice(0, 5).map((run) => `- npm run ${run.script}${run.cwd ? ` in ${run.cwd}` : ""}: ${run.status}${run.exitCode == null ? "" : `, exit ${run.exitCode}`} (${formatDate(run.endedAt || run.startedAt)})`).join("\n")
        : "- No launchpad script runs recorded.",
      "",
      "## Suggested Agent Instructions",
      "- Treat this as a supervised app-development task.",
      "- Read the project path before editing.",
      "- Prefer the existing scripts and workflow phase.",
      "- Do not touch unrelated projects.",
      "- Run validation and report exact commands and outcomes."
    ];

    return lines.join("\n");
  }

  function syncTabs() {
    tabButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.workbenchTab === activeTab);
    });
    panels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.workbenchPanel === activeTab);
    });
  }

  /**
   * @param {AuditProject} project
   */
  function renderHeader(project) {
    document.getElementById("modal-title").textContent = project.name;
    document.getElementById("modal-path").textContent = project.relPath;
    document.getElementById("modal-desc").textContent = project.description || "No description available.";

    const badge = /** @type {HTMLElement} */ (document.getElementById("modal-score-badge"));
    const scoreColor = getColor(project.qualityScore);
    badge.textContent = `Health ${project.qualityScore}`;
    badge.style.color = scoreColor;
    badge.style.borderColor = `${scoreColor}55`;
    badge.style.background = `${scoreColor}15`;

    const headerTags = document.getElementById("modal-header-tags");
    const tags = [
      createHeaderTag(project.zone.toUpperCase(), "var(--primary)"),
      createHeaderTag(project.category),
      createHeaderTag(`${project.sourceFiles} files`),
      createHeaderTag(`${project.sourceLines.toLocaleString()} LOC`)
    ];
    if (projectProfile) {
      if (projectProfile.owner) {
        tags.push(createHeaderTag(`Owner: ${projectProfile.owner}`, "var(--success)"));
      }
      tags.push(createHeaderTag(`Status: ${projectProfile.status}`, "var(--warning)"));
      tags.push(createHeaderTag(`Tier: ${projectProfile.tier}`, "var(--text-muted)"));
    }
    headerTags.replaceChildren(...tags);

    const openButton = /** @type {HTMLButtonElement} */ (document.getElementById("modal-vscode-btn"));
    openButton.onclick = async () => {
      try {
        await api.openInCursor(project.relPath);
      } catch {
        alert("Could not open in Cursor. Ensure the live server is running locally.");
      }
    };
  }

  /**
   * @param {AuditProject} project
   */
  function hasConvergenceCandidate(project) {
    return getMergedConvergenceCandidates(project)
      .some((candidate) => candidate.reviewStatus !== "not-related");
  }

  /**
   * @param {string} leftId
   * @param {string} rightId
   */
  function createConvergencePairKey(leftId, rightId) {
    return [String(leftId || "").trim(), String(rightId || "").trim()]
      .sort()
      .join("__converges_with__");
  }

  /**
   * @param {ConvergenceCandidate} candidate
   * @param {string} projectId
   * @param {string} targetId
   */
  function isConvergenceCandidateForPair(candidate, projectId, targetId) {
    return (candidate.leftId === projectId && candidate.rightId === targetId)
      || (candidate.rightId === projectId && candidate.leftId === targetId);
  }

  /**
   * @param {string} projectId
   * @param {string} targetId
   */
  function removeConvergenceCandidate(projectId, targetId) {
    convergenceCandidates = convergenceCandidates.filter((candidate) =>
      !isConvergenceCandidateForPair(candidate, projectId, targetId)
    );
  }

  /**
   * @param {AuditProject} project
   * @returns {ConvergenceCandidate[]}
   */
  function getMergedConvergenceCandidates(project) {
    const candidateMap = new Map();
    const notRelatedPairs = new Set();

    for (const candidate of convergenceCandidates) {
      if (!candidate.leftId || !candidate.rightId) continue;
      const pairId = candidate.pairId || createConvergencePairKey(candidate.leftId, candidate.rightId);
      if (candidate.reviewStatus === "not-related") {
        notRelatedPairs.add(pairId);
      }
      if (candidate.leftId === project.id || candidate.rightId === project.id) {
        candidateMap.set(pairId, candidate);
      }
    }

    for (const similar of Array.isArray(project.similarApps) ? project.similarApps : []) {
      if (!similar.id || similar.id === project.id) continue;
      const pairId = createConvergencePairKey(project.id, similar.id);
      if (notRelatedPairs.has(pairId) || candidateMap.has(pairId)) continue;
      candidateMap.set(pairId, {
        pairId,
        leftId: project.id,
        rightId: similar.id,
        leftName: project.name,
        rightName: similar.name,
        score: similar.score,
        reasons: Array.isArray(similar.reasons) ? similar.reasons : [],
        reviewStatus: "unreviewed",
        reviewId: "",
        reviewNote: "",
        reviewedAt: "",
        reviewer: "",
        reviewSource: "auto-detected-convergence",
        operatorProposed: false,
        generatedInsight: "Auto-detected from workspace similarity analysis. Confirm, mark Not Related, Needs Review, or Merge.",
        assimilationRecommendation: "",
        secretPolicy: "Non-secret convergence review metadata only."
      });
    }

    return [...candidateMap.values()];
  }

  /**
   * @param {ConvergenceCandidate[]} candidates
   */
  function getConvergenceFilterCounts(candidates) {
    return {
      active: candidates.filter((candidate) => candidate.reviewStatus !== "not-related").length,
      needsReview: candidates.filter((candidate) => ["needs-review", "unreviewed"].includes(candidate.reviewStatus || "unreviewed")).length,
      notRelated: candidates.filter((candidate) => candidate.reviewStatus === "not-related").length,
      all: candidates.length
    };
  }

  /**
   * @param {ConvergenceCandidate[]} candidates
   */
  function filterConvergenceCandidates(candidates) {
    if (convergenceFilter === "all") return candidates;
    if (convergenceFilter === "not-related") {
      return candidates.filter((candidate) => candidate.reviewStatus === "not-related");
    }
    if (convergenceFilter === "needs-review") {
      return candidates.filter((candidate) => ["needs-review", "unreviewed"].includes(candidate.reviewStatus || "unreviewed"));
    }
    return candidates.filter((candidate) => candidate.reviewStatus !== "not-related");
  }

  /**
   * @param {HTMLElement} container
   */
  function bindConvergenceFilterControls(container) {
    container.querySelectorAll("[data-convergence-filter]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const nextFilter = element.dataset.convergenceFilter || "active";
        if (!["active", "needs-review", "not-related", "all"].includes(nextFilter)) return;
        convergenceFilter = /** @type {"active" | "needs-review" | "not-related" | "all"} */ (nextFilter);
        renderWorkbench();
      });
    });
  }

  function getConvergenceEmptyState() {
    if (convergenceFilter === "not-related") {
      return {
        title: "No hidden Not Related candidates",
        message: "Pairs you mark Not Related will appear here for audit and can be restored by selecting Confirm, Needs Review, or Merge."
      };
    }
    if (convergenceFilter === "needs-review") {
      return {
        title: "No pending convergence reviews",
        message: "Auto-detected and operator-contributed pairs that still need classification will appear here."
      };
    }
    if (convergenceFilter === "all") {
      return {
        title: "No convergence candidates",
        message: "No auto-detected or operator-contributed convergence pairs are available for this project."
      };
    }
    return {
      title: "No active convergence candidates",
      message: "Reviewed pairs marked Not Related are hidden from Active. Use the Not Related filter to audit or restore them."
    };
  }

  /**
   * @param {AuditProject} project
   */
  function renderOverview(project) {
    const stackContainer = document.getElementById("modal-stack");
    stackContainer.replaceChildren(createStackTags([...project.frameworks, ...project.languages]));

    const metricsContainer = document.getElementById("modal-metrics");
    metricsContainer.replaceChildren(
      createMetricBarCard({
        label: "Freshness",
        score: project.freshnessScore,
        detail: `Updated ${project.daysOld} days ago`
      }),
      createMetricBarCard({
        label: "Documentation",
        score: project.docsScore,
        detail: `${project.docsFiles} doc files`
      }),
      createMetricBarCard({
        label: "Tests",
        score: project.testingScore,
        detail: `${project.testFiles} test files`
      }),
      createMetricBarCard({
        label: "Readiness",
        score: project.readinessScore,
        detail: "Configs, scripts, and runtime surface"
      }),
      createMetricValueCard({
        label: "Code Volume",
        value: String(project.sourceFiles),
        detail: "Source files"
      }),
      createMetricValueCard({
        label: "Line Count",
        value: project.sourceLines.toLocaleString(),
        detail: "Estimated source lines"
      })
    );

    const warningsSection = /** @type {HTMLElement} */ (document.getElementById("modal-warnings-section"));
    const warningsContainer = document.getElementById("modal-warnings");
    if (project.warnings?.length) {
      warningsSection.hidden = false;
      const warningFragment = document.createDocumentFragment();
      for (const warning of project.warnings) {
        warningFragment.append(createWarningItem(warning));
      }
      warningsContainer.replaceChildren(warningFragment);
    } else {
      warningsSection.hidden = true;
      warningsContainer.replaceChildren();
    }

    const similarContainer = document.getElementById("modal-similar");
    const proposalCard = createConvergenceProposalCard(project, getData().projects || []);
    const mergedConvergenceCandidates = getMergedConvergenceCandidates(project);
    const filterCard = createConvergenceFilterCard({
      activeFilter: convergenceFilter,
      counts: getConvergenceFilterCounts(mergedConvergenceCandidates)
    });
    if (workbenchLoading) {
      similarContainer.replaceChildren(proposalCard, filterCard, createWorkbenchEmptyState(
        "Loading convergence review",
        "Active overlap candidates are being refreshed from the persisted review ledger."
      ));
    } else if (mergedConvergenceCandidates.length || project.similarApps?.length) {
      const similarFragment = document.createDocumentFragment();
      const visibleSimilarCandidates = filterConvergenceCandidates(mergedConvergenceCandidates)
        .map((candidate) => {
          const isLeftProject = candidate.leftId === project.id;
          const similar = {
            id: isLeftProject ? candidate.rightId : candidate.leftId,
            name: isLeftProject ? candidate.rightName : candidate.leftName,
            label: isLeftProject
              ? candidate.rightLabel || candidate.rightName
              : candidate.leftLabel || candidate.leftName,
            score: candidate.score,
            reasons: candidate.reasons
          };
          return {
            similar,
            reviewStatus: candidate.reviewStatus || "unreviewed",
            reviewNote: candidate.reviewNote || "",
            reviewSource: candidate.reviewSource || "",
            generatedInsight: candidate.generatedInsight || "",
            assimilationRecommendation: candidate.assimilationRecommendation || ""
          };
        })
        .filter((item) => item.similar.id && item.similar.id !== project.id);

      for (const item of visibleSimilarCandidates) {
        const { similar, reviewStatus, reviewNote, reviewSource, generatedInsight, assimilationRecommendation } = item;
        similarFragment.append(createSimilarCard(similar, {
          reviewStatus,
          reviewNote,
          reviewSource: reviewSource || "",
          generatedInsight: generatedInsight || "",
          assimilationRecommendation: assimilationRecommendation || ""
        }));
      }
      if (visibleSimilarCandidates.length) {
        similarContainer.replaceChildren(proposalCard, filterCard, similarFragment);
        bindAppLaunchers(similarContainer, openModal);
        bindConvergenceReviewControls(similarContainer, project);
      } else {
        const emptyState = getConvergenceEmptyState();
        similarContainer.replaceChildren(proposalCard, filterCard, createWorkbenchEmptyState(
          emptyState.title,
          emptyState.message
        ));
      }
    } else {
      similarContainer.replaceChildren(proposalCard, filterCard, createWorkbenchEmptyState(
        "No strong convergence detected",
        "This project does not currently have a high-confidence overlap cluster in the portfolio."
      ));
    }
    bindConvergenceFilterControls(similarContainer);
    bindConvergenceProposalControls(similarContainer, project);
  }

  /**
   * @param {HTMLElement} container
   * @param {AuditProject} project
   */
  function bindConvergenceReviewControls(container, project) {
    container.querySelectorAll("[data-convergence-action]").forEach((element) => {
      if (!(element instanceof HTMLButtonElement)) return;
      element.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const targetId = element.dataset.convergenceTargetId || "";
        const status = element.dataset.convergenceAction || "needs-review";
        let similar = project.similarApps?.find((item) => item.id === targetId);
        if (!similar) {
          const candidate = getMergedConvergenceCandidates(project).find((item) => isConvergenceCandidateForPair(item, project.id, targetId));
          if (candidate) {
            const isLeftProject = candidate.leftId === project.id;
            similar = {
              id: isLeftProject ? candidate.rightId : candidate.leftId,
              name: isLeftProject ? candidate.rightName : candidate.leftName,
              label: isLeftProject
                ? candidate.rightLabel || candidate.rightName
                : candidate.leftLabel || candidate.leftName,
              score: candidate.score,
              reasons: candidate.reasons
            };
          }
        }
        if (!similar) return;
        const originalLabel = element.textContent || "";
        element.disabled = true;
        element.textContent = "Saving...";
        void handleConvergenceReview(project, similar, status).catch((error) => {
          alert(error instanceof Error ? error.message : "Convergence review failed.");
          element.disabled = false;
          element.textContent = originalLabel;
        });
      });
    });
  }

  /**
   * @param {HTMLElement} container
   * @param {AuditProject} project
   */
  function bindConvergenceProposalControls(container, project) {
    const form = container.querySelector("[data-convergence-proposal-form]");
    if (!(form instanceof HTMLFormElement)) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void handleConvergenceProposal(project, form).catch((error) => {
        const status = form.querySelector("[data-convergence-proposal-status]");
        if (status instanceof HTMLElement) {
          status.textContent = error instanceof Error ? error.message : "Convergence proposal failed.";
        } else {
          alert(error instanceof Error ? error.message : "Convergence proposal failed.");
        }
      });
    });
  }

  /**
   * @param {AuditProject} project
   * @param {{ id: string, name: string, score: number, reasons: string[] }} similar
   * @param {string} status
   */
  async function handleConvergenceReview(project, similar, status) {
    await api.saveConvergenceReview({
      leftId: project.id,
      rightId: similar.id,
      leftName: project.name,
      rightName: similar.name,
      score: similar.score,
      reasons: similar.reasons,
      status,
      note: status === "not-related"
        ? "Marked not related by operator from the project workbench."
        : "Reviewed from the project workbench."
    });
    if (!currentProject || currentProject.id !== project.id) return;
    if (status === "not-related") {
      removeConvergenceCandidate(project.id, similar.id);
      renderWorkbench();
    }
    await api.refreshFindings();
    findings = await api.fetchFindings(project.id);
    const convergence = await api.fetchConvergenceCandidates({ projectId: project.id, status: "all", includeNotRelated: true });
    if (!currentProject || currentProject.id !== project.id) return;
    convergenceCandidates = convergence.candidates || [];
    renderWorkbench();
  }

  /**
   * @param {AuditProject} project
   * @param {HTMLFormElement} form
   */
  async function handleConvergenceProposal(project, form) {
    const formData = new FormData(form);
    const targetId = String(formData.get("targetId") || "").trim();
    const operatorContext = String(formData.get("operatorContext") || "").trim();
    if (!targetId) throw new Error("Select a project to compare.");

    const button = form.querySelector("button[type='submit']");
    const statusElement = form.querySelector("[data-convergence-proposal-status]");
    if (button instanceof HTMLButtonElement) {
      button.disabled = true;
      button.textContent = "Running...";
    }
    if (statusElement instanceof HTMLElement) {
      statusElement.textContent = "Running non-secret due diligence.";
    }

    try {
      const result = await api.proposeConvergenceOverlap({
        leftId: project.id,
        rightId: targetId,
        operatorContext,
        reviewer: "operator"
      });
      if (!currentProject || currentProject.id !== project.id) return;
      convergenceCandidates = result.candidates || (await api.fetchConvergenceCandidates({ projectId: project.id, status: "all", includeNotRelated: true })).candidates || [];
      if (statusElement instanceof HTMLElement) {
        statusElement.textContent = `Saved ${result.review.status.replaceAll("-", " ")} at ${result.review.score}%.`;
      }
      form.reset();
      renderWorkbench();
    } finally {
      if (button instanceof HTMLButtonElement) {
        button.disabled = false;
        button.textContent = "Run Due Diligence";
      }
    }
  }

  /**
   * @param {AuditProject} project
   */
  function renderGovernanceProfile(project) {
    const ownerInput = /** @type {HTMLInputElement} */ (document.getElementById("workbench-profile-owner"));
    const statusInput = /** @type {HTMLSelectElement} */ (document.getElementById("workbench-profile-status"));
    const lifecycleInput = /** @type {HTMLSelectElement} */ (document.getElementById("workbench-profile-lifecycle"));
    const tierInput = /** @type {HTMLSelectElement} */ (document.getElementById("workbench-profile-tier"));
    const targetInput = /** @type {HTMLSelectElement} */ (document.getElementById("workbench-profile-target"));
    const summaryInput = /** @type {HTMLTextAreaElement} */ (document.getElementById("workbench-profile-summary"));
    const summaryCard = document.getElementById("workbench-profile-summary-card");
    const historyList = document.getElementById("workbench-profile-history-list");

    ownerInput.value = projectProfile?.owner || "";
    statusInput.value = projectProfile?.status || "unassigned";
    lifecycleInput.value = projectProfile?.lifecycle || "active";
    tierInput.value = projectProfile?.tier || "supporting";
    targetInput.value = projectProfile?.targetState || "stabilize";
    summaryInput.value = projectProfile?.summary || "";

    if (workbenchLoading) {
      summaryCard.replaceChildren(createWorkbenchEmptyState(
        "Loading governance profile",
        "Reading persisted ownership and lifecycle metadata for this project."
      ));
      historyList.replaceChildren(createWorkbenchEmptyState(
        "Loading profile history",
        "Reading governance changes for this project."
      ));
      return;
    }

    if (workbenchError) {
      summaryCard.replaceChildren(createWorkbenchEmptyState("Workbench load failed", workbenchError));
      historyList.replaceChildren(createWorkbenchEmptyState("Workbench load failed", workbenchError));
      return;
    }

    if (!projectProfile) {
      summaryCard.replaceChildren(createWorkbenchEmptyState(
        "No governance profile",
        `Assign an owner and governance target for ${project.name} to bring it into the portfolio control layer.`
      ));
    } else {
      summaryCard.replaceChildren(createWorkbenchEntry({
        title: projectProfile.projectName || project.name,
        subtitle: projectProfile.owner || "Owner not set",
        detail: projectProfile.summary || "No governance note captured yet.",
        accentColor: projectProfile.status === "blocked"
          ? "var(--danger)"
          : projectProfile.status === "active"
            ? "var(--primary)"
            : projectProfile.status === "retired"
              ? "var(--text-muted)"
              : "var(--warning)",
        badges: [
          { text: projectProfile.status.toUpperCase(), tone: "var(--warning)" },
          { text: projectProfile.lifecycle.toUpperCase(), tone: "var(--primary)" },
          { text: projectProfile.tier.toUpperCase(), tone: "var(--text-muted)" },
          { text: `TARGET ${projectProfile.targetState.toUpperCase()}`, tone: "var(--success)" }
        ],
        meta: [
          `Updated: ${formatDate(projectProfile.updatedAt)}`,
          `Project path: ${project.relPath}`
        ]
      }));
    }

    if (!profileHistory.length) {
      historyList.replaceChildren(createWorkbenchEmptyState(
        "No profile history yet",
        `Governance changes for ${project.name} will appear here once the profile is created or updated.`
      ));
      return;
    }

    const historyFragment = document.createDocumentFragment();
    for (const entry of profileHistory) {
      const detailParts = [];
      if (entry.changeType === "created") {
        detailParts.push("Initial governance profile captured.");
      } else if (entry.changedFields.length) {
        detailParts.push(`Changed fields: ${entry.changedFields.join(", ")}`);
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

      historyFragment.append(createWorkbenchEntry({
        title: `${entry.projectName} governance ${entry.changeType}`,
        subtitle: formatDate(entry.changedAt),
        detail: detailParts.join(" • ") || "Governance profile snapshot recorded.",
        accentColor: entry.changeType === "created" ? "var(--primary)" : "var(--warning)",
        badges: [
          { text: entry.changeType.toUpperCase(), tone: entry.changeType === "created" ? "var(--primary)" : "var(--warning)" }
        ],
        meta: [
          `Target: ${entry.next.targetState}`,
          `Tier: ${entry.next.tier}`
        ]
      }));
    }

    historyList.replaceChildren(historyFragment);
  }

  /**
   * @param {AuditProject} project
   */
  function renderFindings(project) {
    const findingsList = document.getElementById("workbench-findings-list");
    if (workbenchLoading) {
      findingsList.replaceChildren(createWorkbenchEmptyState(
        "Loading findings",
        "Reading persisted findings and project-linked portfolio signals."
      ));
      return;
    }

    if (workbenchError) {
      findingsList.replaceChildren(createWorkbenchEmptyState("Workbench load failed", workbenchError));
      return;
    }

    if (findings.length) {
      const fragment = document.createDocumentFragment();
      for (const finding of findings) {
        const tone = finding.severity === "high"
          ? "var(--danger)"
          : finding.severity === "medium"
            ? "var(--warning)"
            : "var(--primary)";
        fragment.append(createWorkbenchEntry({
          title: finding.title,
          subtitle: finding.projectName || project.name,
          detail: finding.detail,
          accentColor: tone,
          badges: [
            { text: finding.severity.toUpperCase(), tone },
            { text: finding.status.toUpperCase(), tone: "var(--text-muted)" }
          ],
          meta: [
            `Category: ${finding.category}`,
            `Created: ${formatDate(finding.createdAt)}`
          ]
        }));
      }
      findingsList.replaceChildren(fragment);
      return;
    }

    if (project.warnings?.length) {
      const fallback = document.createDocumentFragment();
      for (const warning of project.warnings) {
        fallback.append(createWorkbenchEntry({
          title: warning.type === "danger" ? "Inline high-risk warning" : "Inline project warning",
          subtitle: project.name,
          detail: warning.message,
          accentColor: warning.type === "danger" ? "var(--danger)" : "var(--warning)",
          badges: [{ text: "LOCAL SIGNAL", tone: "var(--primary)" }],
          meta: ["Derived from the current project snapshot"]
        }));
      }
      findingsList.replaceChildren(fallback);
      return;
    }

    findingsList.replaceChildren(createWorkbenchEmptyState(
      "No project findings",
      "This project has no persisted findings yet. Refresh findings after new scans or broader portfolio changes."
    ));
  }

  /**
   * @param {AuditProject} project
   */
  function renderTasks(project) {
    const tasksList = document.getElementById("workbench-tasks-list");
    if (workbenchLoading) {
      tasksList.replaceChildren(createWorkbenchEmptyState(
        "Loading tasks",
        "Reading project-linked tasks from persistent storage."
      ));
      return;
    }

    if (workbenchError) {
      tasksList.replaceChildren(createWorkbenchEmptyState("Workbench load failed", workbenchError));
      return;
    }

    if (!tasks.length) {
      tasksList.replaceChildren(createWorkbenchEmptyState(
        "No tasks recorded",
        `Create the first tracked action for ${project.name}.`
      ));
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const task of tasks) {
      const isDone = task.status === "done";
      fragment.append(createWorkbenchEntry({
        title: task.title,
        subtitle: task.projectName || project.name,
        detail: task.description || "No task description captured.",
        accentColor: isDone ? "var(--success)" : "var(--primary)",
        badges: [
          { text: task.priority.toUpperCase(), tone: task.priority === "high" ? "var(--danger)" : task.priority === "medium" ? "var(--warning)" : "var(--primary)" },
          { text: task.status.toUpperCase(), tone: isDone ? "var(--success)" : "var(--text-muted)" }
        ],
        meta: [
          `Created: ${formatDate(task.createdAt)}`,
          `Updated: ${formatDate(task.updatedAt)}`
        ],
        actions: [
          createActionButton(isDone ? "Reopen" : "Mark Done", async () => {
            await api.updateTask(task.id, {
              status: isDone ? "open" : "done",
              ...createProjectScopeOptions(project)
            });
            if (currentProject?.id === project.id) {
              await loadWorkbenchState(project);
            }
          })
        ]
      }));
    }

    tasksList.replaceChildren(fragment);
  }

  /**
   * @param {AuditProject} project
   */
  function renderWorkflows(project) {
    const workflowsList = document.getElementById("workbench-workflows-list");
    if (workbenchLoading) {
      workflowsList.replaceChildren(createWorkbenchEmptyState(
        "Loading workflows",
        "Reading project-linked workflow records from persistent storage."
      ));
      return;
    }

    if (workbenchError) {
      workflowsList.replaceChildren(createWorkbenchEmptyState("Workbench load failed", workbenchError));
      return;
    }

    if (!workflows.length) {
      workflowsList.replaceChildren(createWorkbenchEmptyState(
        "No workflow stream",
        `Create a workflow to track the brief, integration, or review path for ${project.name}.`
      ));
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const workflow of workflows) {
      const statusTone = workflow.status === "done"
        ? "var(--success)"
        : workflow.status === "active" || workflow.status === "approved"
          ? "var(--primary)"
          : "var(--warning)";
      const nextPhase = getNextWorkflowPhase(workflow.phase);
      /** @type {Node[]} */
      const actions = [];

      if (workflow.phase === "approval" && workflow.status !== "awaiting-approval" && workflow.status !== "approved" && workflow.status !== "done") {
        actions.push(createActionButton("Request Approval", async () => {
          await api.updateWorkflow(workflow.id, { status: "awaiting-approval" });
          if (currentProject?.id === project.id) {
            await loadWorkbenchState(project);
          }
        }));
      }

      if (workflow.phase === "approval" && workflow.status === "awaiting-approval") {
        actions.push(createActionButton("Approve", async () => {
          await api.updateWorkflow(workflow.id, { status: "approved" });
          if (currentProject?.id === project.id) {
            await loadWorkbenchState(project);
          }
        }, "btn-primary"));
      }

      if (workflow.phase === "review" && workflow.status !== "in-review" && workflow.status !== "done") {
        actions.push(createActionButton("Set In Review", async () => {
          await api.updateWorkflow(workflow.id, { status: "in-review" });
          if (currentProject?.id === project.id) {
            await loadWorkbenchState(project);
          }
        }));
      }

      if (nextPhase && workflow.status !== "done") {
        actions.push(createActionButton(`Advance to ${nextPhase}`, async () => {
          await api.updateWorkflow(workflow.id, {
            phase: nextPhase,
            status: nextPhase === "approval"
              ? "awaiting-approval"
              : nextPhase === "review"
                ? "in-review"
                : nextPhase === "done"
                  ? "done"
                  : "active"
          });
          if (currentProject?.id === project.id) {
            await loadWorkbenchState(project);
          }
        }));
      }

      if (workflow.status !== "active" && workflow.status !== "done" && workflow.phase !== "approval") {
        actions.push(createActionButton("Set Active", async () => {
          await api.updateWorkflow(workflow.id, { status: "active" });
          if (currentProject?.id === project.id) {
            await loadWorkbenchState(project);
          }
        }));
      }

      if (workflow.status !== "done") {
        actions.push(createActionButton("Mark Done", async () => {
          await api.updateWorkflow(workflow.id, { status: "done", phase: "done" });
          if (currentProject?.id === project.id) {
            await loadWorkbenchState(project);
          }
        }));
      }

      if (workflow.status === "done" && workflow.phase === "done") {
        actions.push(createActionButton("Reopen", async () => {
          await api.updateWorkflow(workflow.id, { status: "active", phase: "implementation" });
          if (currentProject?.id === project.id) {
            await loadWorkbenchState(project);
          }
        }));
      }

      fragment.append(createWorkbenchEntry({
        title: workflow.title,
        subtitle: workflow.projectName || project.name,
        detail: workflow.brief || "No workflow brief captured.",
        accentColor: statusTone,
        badges: [
          { text: workflow.phase.toUpperCase(), tone: "var(--text-muted)" },
          { text: workflow.status.toUpperCase(), tone: statusTone }
        ],
        meta: [
          `Created: ${formatDate(workflow.createdAt)}`,
          `Updated: ${formatDate(workflow.updatedAt)}`
        ],
        actions
      }));
    }

    workflowsList.replaceChildren(fragment);
  }

  /**
   * @param {AuditProject} project
   */
  function renderMemory(project) {
    const notesList = document.getElementById("workbench-notes-list");
    const milestonesList = document.getElementById("workbench-milestones-list");

    if (workbenchLoading) {
      notesList.replaceChildren(createWorkbenchEmptyState(
        "Loading memory",
        "Reading notes and decision records from persistent storage."
      ));
      milestonesList.replaceChildren(createWorkbenchEmptyState(
        "Loading milestones",
        "Reading project-linked milestones from persistent storage."
      ));
      return;
    }

    if (workbenchError) {
      notesList.replaceChildren(createWorkbenchEmptyState("Workbench load failed", workbenchError));
      milestonesList.replaceChildren(createWorkbenchEmptyState("Workbench load failed", workbenchError));
      return;
    }

    if (!notes.length) {
      notesList.replaceChildren(createWorkbenchEmptyState(
        "No project memory",
        `Create the first durable note, decision, or context record for ${project.name}.`
      ));
    } else {
      const noteFragment = document.createDocumentFragment();
      for (const note of notes) {
        const tone = note.kind === "decision"
          ? "var(--primary)"
          : note.kind === "context"
            ? "var(--warning)"
            : "var(--border)";
        noteFragment.append(createWorkbenchEntry({
          title: note.title,
          subtitle: note.projectName || project.name,
          detail: note.body || "No note body captured.",
          accentColor: tone,
          badges: [{ text: note.kind.toUpperCase(), tone: note.kind === "note" ? "var(--text-muted)" : tone }],
          meta: [
            `Created: ${formatDate(note.createdAt)}`,
            `Updated: ${formatDate(note.updatedAt)}`
          ]
        }));
      }
      notesList.replaceChildren(noteFragment);
    }

    if (!milestones.length) {
      milestonesList.replaceChildren(createWorkbenchEmptyState(
        "No milestones tracked",
        `Create the first milestone to track a target or completion point for ${project.name}.`
      ));
      return;
    }

    const milestoneFragment = document.createDocumentFragment();
    for (const milestone of milestones) {
      const statusTone = milestone.status === "done"
        ? "var(--success)"
        : milestone.status === "active"
          ? "var(--primary)"
          : "var(--warning)";
      milestoneFragment.append(createWorkbenchEntry({
        title: milestone.title,
        subtitle: milestone.projectName || project.name,
        detail: milestone.detail || "No milestone detail captured.",
        accentColor: statusTone,
        badges: [{ text: milestone.status.toUpperCase(), tone: statusTone }],
        meta: [
          milestone.targetDate ? `Target: ${milestone.targetDate}` : "Target: Not set",
          `Updated: ${formatDate(milestone.updatedAt)}`
        ],
        actions: milestone.status === "done"
          ? []
          : [
              createActionButton("Set Active", async () => {
                await api.updateMilestone(milestone.id, { status: "active" });
                if (currentProject?.id === project.id) {
                  await loadWorkbenchState(project);
                }
              }),
              createActionButton("Mark Done", async () => {
                await api.updateMilestone(milestone.id, { status: "done" });
                if (currentProject?.id === project.id) {
                  await loadWorkbenchState(project);
                }
              })
            ]
      }));
    }

    milestonesList.replaceChildren(milestoneFragment);
  }

  /**
   * @param {AuditProject} project
   */
  function renderLaunchpad(project) {
    const launchGrid = document.getElementById("workbench-launch-grid");
    const scriptsSection = /** @type {HTMLElement} */ (document.getElementById("modal-scripts-section"));
    const scriptsList = document.getElementById("modal-scripts-list");
    const runtimeSurfaces = Array.isArray(project.runtimeSurfaces) ? project.runtimeSurfaces : [];
    const launchCommands = Array.isArray(project.launchCommands) ? project.launchCommands : [];
    const runnablePackageCommands = launchCommands.filter((command) => String(command.run || "").startsWith("npm run "));
    const rootScriptCommands = project.scripts?.length
      ? project.scripts.map((script) => ({
          name: script,
          label: script,
          cwd: project.relPath,
          run: `npm run ${script}`
        }))
      : [];
    const runnableCommands = runnablePackageCommands.length ? runnablePackageCommands : rootScriptCommands;

    const openCard = createWorkbenchLaunchCard({
      title: "Source access",
      copy: "Open the project root in Cursor and jump directly into implementation."
    });
    openCard.append(createActionButton("Open Project", async () => {
      await api.openInCursor(project.relPath);
    }, "btn-primary"));

    const signalsCard = createWorkbenchLaunchCard({
      title: "Execution state",
      copy: `${findings.length} findings, ${tasks.length} tasks, ${workflows.length} workflows, ${notes.length} notes, and ${milestones.length} milestones are linked to this project.`
    });

    const stackCard = createWorkbenchLaunchCard({
      title: "Runtime surface",
      copy: launchCommands.length
        ? `${launchCommands.length} launch hint(s) across ${runtimeSurfaces.length || 1} runtime surface(s).`
        : runtimeSurfaces.length
          ? `${runtimeSurfaces.length} runtime surface(s) detected. Add package scripts or launch commands to make them runnable.`
          : "No package scripts or runtime surfaces were detected for this project."
    });
    for (const surface of runtimeSurfaces.slice(0, 4)) {
      const surfaceEntry = document.createElement("div");
      surfaceEntry.textContent = `${surface.label || surface.type} • ${surface.cwd || project.relPath}`;
      surfaceEntry.style.fontSize = "0.78rem";
      surfaceEntry.style.color = "var(--text-muted)";
      surfaceEntry.style.marginTop = "0.45rem";
      stackCard.append(surfaceEntry);
    }

    const overlapCard = createWorkbenchLaunchCard({
      title: "Convergence signal",
      copy: project.similarApps?.[0]
        ? `Strongest overlap: ${project.similarApps[0].name} at ${project.similarApps[0].score}%`
        : "No high-confidence overlap partner was detected yet."
    });

    const latestRun = scriptRuns[0];
    const runHistoryCard = createWorkbenchLaunchCard({
      title: "Execution history",
      copy: latestRun
        ? `${scriptRuns.length} recorded run(s). Latest: npm run ${latestRun.script} finished as ${latestRun.status}.`
        : "No launchpad script runs have been recorded for this project yet."
    });
    for (const run of scriptRuns.slice(0, 3)) {
      const runEntry = document.createElement("div");
      runEntry.textContent = `${run.script}${run.cwd ? ` in ${run.cwd}` : ""} • ${run.status}${run.exitCode == null ? "" : ` • exit ${run.exitCode}`} • ${formatDate(run.endedAt || run.startedAt)}`;
      runEntry.style.fontSize = "0.78rem";
      runEntry.style.color = run.status === "success"
        ? "var(--success)"
        : run.status === "failed"
          ? "var(--danger)"
          : run.status === "running"
            ? "var(--primary)"
            : "var(--text-muted)";
      runEntry.style.marginTop = "0.45rem";
      runHistoryCard.append(runEntry);
    }

    const agentHandoffCard = createWorkbenchLaunchCard({
      title: "Agent handoff pack",
      copy: "Copy a compact build context for supervised AI/agent work, including health, scripts, governance, tasks, workflows, notes, milestones, and recent script runs."
    });
    const handoffButton = createActionButton("Copy Handoff Pack", async () => {
      const handoffPack = buildAgentHandoffPack(project);
      await api.createAgentSession({
        projectId: project.id,
        projectName: project.name,
        relPath: project.relPath,
        title: `Agent handoff for ${project.name}`,
        summary: `${findings.length} findings, ${tasks.length} tasks, ${workflows.length} workflows, ${scriptRuns.length} recent script runs.`,
        handoffPack,
        status: "prepared"
      });
      await copyText(handoffPack);
      if (currentProject?.id === project.id) {
        await loadWorkbenchState(project);
      }
    }, "btn-primary");
    agentHandoffCard.append(handoffButton);
    for (const session of agentSessions.slice(0, 3)) {
      const sessionEntry = document.createElement("div");
      sessionEntry.textContent = `${session.title} • ${session.status} • ${formatDate(session.createdAt)}`;
      sessionEntry.style.fontSize = "0.78rem";
      sessionEntry.style.color = "var(--text-muted)";
      sessionEntry.style.marginTop = "0.45rem";
      agentHandoffCard.append(sessionEntry);
    }

    launchGrid.replaceChildren(openCard, signalsCard, stackCard, agentHandoffCard, runHistoryCard, overlapCard);

    terminal.textContent ||= "";
    resetTerminalSource();

    if (runnableCommands.length) {
      scriptsSection.hidden = false;
      const scriptsFragment = document.createDocumentFragment();
      for (const command of runnableCommands) {
        scriptsFragment.append(createScriptButton(command.name, {
          label: command.label || command.name,
          cwd: command.cwd || project.relPath
        }));
      }
      scriptsList.replaceChildren(scriptsFragment);
      scriptsList.querySelectorAll("button").forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        button.onclick = () => {
          resetTerminalSource();
          const cwd = button.dataset.cwd || project.relPath;
          terminal.textContent += `\n--- Starting: npm run ${button.dataset.script} in ${cwd} ---\n`;
          terminal.scrollTop = terminal.scrollHeight;
          const source = new EventSource(`/api/run?script=${encodeURIComponent(button.dataset.script ?? "")}&path=${encodeURIComponent(project.relPath)}&cwd=${encodeURIComponent(cwd)}`);
          currentTerminalSource = source;
          source.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === "start") terminal.textContent += `${message.data}\n`;
            else if (message.type === "stdout") terminal.textContent += `${message.data}\n`;
            else if (message.type === "stderr") terminal.textContent += `[ERR] ${message.data}\n`;
            else if (message.type === "done" || message.type === "error") {
              terminal.textContent += `\n--- ${message.data} ---\n`;
              source.close();
              if (currentProject?.id === project.id) {
                void loadWorkbenchState(project);
              }
            }
            terminal.scrollTop = terminal.scrollHeight;
          };
        };
      });
    } else {
      scriptsSection.hidden = true;
      scriptsList.replaceChildren();
      terminal.textContent = "";
    }
  }

  function renderWorkbench() {
    if (!currentProject) return;
    renderHeader(currentProject);
    renderOverview(currentProject);
    renderGovernanceProfile(currentProject);
    renderFindings(currentProject);
    renderTasks(currentProject);
    renderWorkflows(currentProject);
    renderMemory(currentProject);
    renderLaunchpad(currentProject);
    syncTabs();
  }

  /**
   * @param {AuditProject} project
   */
  async function loadWorkbenchState(project) {
    workbenchLoading = true;
    workbenchError = "";
    renderWorkbench();

    try {
      const [nextFindings, nextTasks, nextWorkflows, nextScriptRuns, nextAgentSessions, nextNotes, nextMilestones, nextProfiles, nextProfileHistory, nextConvergence] = await Promise.all([
        api.fetchFindings(project.id),
        api.fetchTasks(project.id),
        api.fetchWorkflows(project.id),
        api.fetchScriptRuns(project.id),
        api.fetchAgentSessions(project.id),
        api.fetchNotes(project.id),
        api.fetchMilestones(project.id),
        api.fetchProjectProfiles(project.id),
        api.fetchProjectProfileHistory(project.id),
        api.fetchConvergenceCandidates({ projectId: project.id, status: "all", includeNotRelated: true })
      ]);

      if (!currentProject || currentProject.id !== project.id) {
        return;
      }

      findings = nextFindings;
      tasks = nextTasks;
      workflows = nextWorkflows;
      scriptRuns = nextScriptRuns;
      agentSessions = nextAgentSessions;
      notes = nextNotes;
      milestones = nextMilestones;
      projectProfile = nextProfiles[0] || null;
      profileHistory = nextProfileHistory;
      convergenceCandidates = nextConvergence.candidates || [];
      workbenchLoading = false;
      workbenchError = "";
      renderWorkbench();
    } catch (error) {
      if (!currentProject || currentProject.id !== project.id) {
        return;
      }
      workbenchLoading = false;
      workbenchError = error instanceof Error ? error.message : "Workbench data failed to load.";
      renderWorkbench();
    }
  }

  async function handleRefreshProjectFindings() {
    if (!currentProject) return;
    await api.refreshFindings();
    await loadWorkbenchState(currentProject);
  }

  async function handleTaskSubmit(event) {
    event.preventDefault();
    if (!currentProject) return;

    const titleInput = /** @type {HTMLInputElement} */ (document.getElementById("workbench-task-title"));
    const descriptionInput = /** @type {HTMLTextAreaElement} */ (document.getElementById("workbench-task-description"));
    const priorityInput = /** @type {HTMLSelectElement} */ (document.getElementById("workbench-task-priority"));

    await api.createTask({
      title: titleInput.value,
      description: descriptionInput.value,
      priority: priorityInput.value,
      status: "open",
      projectId: currentProject.id,
      projectName: currentProject.name,
      ...createProjectScopeOptions(currentProject)
    });

    taskForm.reset();
    priorityInput.value = "medium";
    await loadWorkbenchState(currentProject);
  }

  async function handleWorkflowSubmit(event) {
    event.preventDefault();
    if (!currentProject) return;

    const titleInput = /** @type {HTMLInputElement} */ (document.getElementById("workbench-workflow-title"));
    const briefInput = /** @type {HTMLTextAreaElement} */ (document.getElementById("workbench-workflow-brief"));
    const phaseInput = /** @type {HTMLSelectElement} */ (document.getElementById("workbench-workflow-phase"));
    const statusInput = /** @type {HTMLSelectElement} */ (document.getElementById("workbench-workflow-status"));

    await api.createWorkflow({
      title: titleInput.value,
      brief: briefInput.value,
      phase: phaseInput.value,
      status: statusInput.value,
      projectId: currentProject.id,
      projectName: currentProject.name
    });

    workflowForm.reset();
    phaseInput.value = "implementation";
    statusInput.value = "draft";
    await loadWorkbenchState(currentProject);
  }

  async function handleNoteSubmit(event) {
    event.preventDefault();
    if (!currentProject) return;

    const titleInput = /** @type {HTMLInputElement} */ (document.getElementById("workbench-note-title"));
    const bodyInput = /** @type {HTMLTextAreaElement} */ (document.getElementById("workbench-note-body"));
    const kindInput = /** @type {HTMLSelectElement} */ (document.getElementById("workbench-note-kind"));

    await api.createNote({
      title: titleInput.value,
      body: bodyInput.value,
      kind: kindInput.value,
      projectId: currentProject.id,
      projectName: currentProject.name
    });

    noteForm.reset();
    kindInput.value = "note";
    await loadWorkbenchState(currentProject);
  }

  async function handleMilestoneSubmit(event) {
    event.preventDefault();
    if (!currentProject) return;

    const titleInput = /** @type {HTMLInputElement} */ (document.getElementById("workbench-milestone-title"));
    const detailInput = /** @type {HTMLTextAreaElement} */ (document.getElementById("workbench-milestone-detail"));
    const statusInput = /** @type {HTMLSelectElement} */ (document.getElementById("workbench-milestone-status"));
    const dateInput = /** @type {HTMLInputElement} */ (document.getElementById("workbench-milestone-date"));

    await api.createMilestone({
      title: titleInput.value,
      detail: detailInput.value,
      status: statusInput.value,
      targetDate: dateInput.value,
      projectId: currentProject.id,
      projectName: currentProject.name
    });

    milestoneForm.reset();
    statusInput.value = "planned";
    await loadWorkbenchState(currentProject);
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    if (!currentProject) return;

    const ownerInput = /** @type {HTMLInputElement} */ (document.getElementById("workbench-profile-owner"));
    const statusInput = /** @type {HTMLSelectElement} */ (document.getElementById("workbench-profile-status"));
    const lifecycleInput = /** @type {HTMLSelectElement} */ (document.getElementById("workbench-profile-lifecycle"));
    const tierInput = /** @type {HTMLSelectElement} */ (document.getElementById("workbench-profile-tier"));
    const targetInput = /** @type {HTMLSelectElement} */ (document.getElementById("workbench-profile-target"));
    const summaryInput = /** @type {HTMLTextAreaElement} */ (document.getElementById("workbench-profile-summary"));

    await api.saveProjectProfile({
      projectId: currentProject.id,
      projectName: currentProject.name,
      owner: ownerInput.value,
      status: statusInput.value,
      lifecycle: lifecycleInput.value,
      tier: tierInput.value,
      targetState: targetInput.value,
      summary: summaryInput.value
    });

    await loadWorkbenchState(currentProject);
  }

  /**
   * @param {string} id
   */
  function openModal(id) {
    const data = getData();
    const project = data.projects.find((item) => item.id === id);
    if (!project) return;

    currentProject = project;
    activeTab = "overview";
    workbenchLoading = true;
    workbenchError = "";
    findings = [];
    tasks = [];
    workflows = [];
    notes = [];
    milestones = [];
    projectProfile = null;
    profileHistory = [];
    convergenceCandidates = [];
    convergenceFilter = "active";
    terminal.textContent = "";
    overlay.classList.add("active");
    renderWorkbench();
    void loadWorkbenchState(project);
  }

  function closeModal() {
    overlay.classList.remove("active");
    resetTerminalSource();
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = /** @type {"overview" | "findings" | "tasks" | "workflow" | "memory" | "launchpad"} */ (button.dataset.workbenchTab || "overview");
      syncTabs();
    });
  });

  taskForm.addEventListener("submit", (event) => {
    void handleTaskSubmit(event).catch((error) => {
      alert(error instanceof Error ? error.message : "Task save failed.");
    });
  });

  workflowForm.addEventListener("submit", (event) => {
    void handleWorkflowSubmit(event).catch((error) => {
      alert(error instanceof Error ? error.message : "Workflow save failed.");
    });
  });

  noteForm.addEventListener("submit", (event) => {
    void handleNoteSubmit(event).catch((error) => {
      alert(error instanceof Error ? error.message : "Note save failed.");
    });
  });

  milestoneForm.addEventListener("submit", (event) => {
    void handleMilestoneSubmit(event).catch((error) => {
      alert(error instanceof Error ? error.message : "Milestone save failed.");
    });
  });

  profileForm.addEventListener("submit", (event) => {
    void handleProfileSubmit(event).catch((error) => {
      alert(error instanceof Error ? error.message : "Profile save failed.");
    });
  });

  document.getElementById("workbench-refresh-findings").addEventListener("click", () => {
    void handleRefreshProjectFindings().catch((error) => {
      alert(error instanceof Error ? error.message : "Findings refresh failed.");
    });
  });

  document.getElementById("clear-term-btn").addEventListener("click", () => {
    terminal.textContent = "";
  });

  return { closeModal, openModal };
}
