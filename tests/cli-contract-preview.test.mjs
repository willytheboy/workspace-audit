import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { createWorkspaceAuditServer } from "../lib/workspace-audit-server.mjs";
import { openCliContractPreview } from "../ui/dashboard-cli-contract-preview.js";
import { createFixtureWorkspace } from "./test-helpers.mjs";

const scope = { activeProjectId: "alpha-app", scopeMode: "project" };
const fixtureRun = { id: "run-alpha", projectId: "alpha-app", projectName: "Alpha App", title: "Fix the build" };

class TestElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.style = {};
    this.attributes = {};
    this.text = "";
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  set textContent(value) {
    this.text = value;
    this.children = [];
  }

  get textContent() {
    return [this.text, ...this.children.map((child) => typeof child === "string" ? child : child.textContent)].join(" ");
  }

  showModal() { this.open = true; }
  addEventListener() {}

  *elements() {
    yield this;
    for (const child of this.children) {
      if (child instanceof TestElement) yield* child.elements();
    }
  }
}

function renderPreview(t, { run = fixtureRun, getScope = () => scope, fetchDryRun, copyText = async () => assert.fail("Unexpected copy") }) {
  const documentBeforeTest = globalThis.document;
  const body = new TestElement("body");
  globalThis.document = {
    body,
    createElement: (tagName) => new TestElement(tagName),
    createTextNode: (value) => value
  };
  t.after(() => {
    if (documentBeforeTest) globalThis.document = documentBeforeTest;
    else delete globalThis.document;
  });

  openCliContractPreview({ run, getScope, fetchDryRun, copyText });
  const [dialog] = body.children;
  const elements = [...dialog.elements()];
  return {
    dialog,
    copyButton: elements.find((element) => element.tagName === "button" && element.textContent === "Copy CLI contract"),
    runnerSelect: elements.find((element) => element.tagName === "select")
  };
}

function readyContract({ runId, runner, ...requestedScope }) {
  return {
    runner,
    dryRunDecision: "ready",
    markdown: `Fixture ${runner} handoff for ${runId}`,
    reasons: [],
    selectedWorkOrder: {
      sourceType: "agent-work-order-run",
      id: runId,
      projectId: fixtureRun.projectId,
      objective: "Restore the fixture build",
      validationCommands: ["npm test"]
    },
    commandEnvelope: { label: "Codex CLI", workingDirectory: "alpha-app" },
    scopeContext: { ...requestedScope, scopeReady: true },
    targetBaselineAuditGate: { decision: "ready" },
    auditBaselineRunGate: { decision: "ready" },
    alertBaselineDriftTaskGate: { decision: "ready", openTaskCount: 0 }
  };
}

test("selected runner previews a real fixture work order and shows its readiness", async (t) => {
  const { appDir, workspaceRoot } = await createFixtureWorkspace();
  const server = createWorkspaceAuditServer({ rootDir: workspaceRoot, publicDir: appDir });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const runResponse = await fetch(`${baseUrl}/api/agent-work-order-runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...scope,
      projectId: fixtureRun.projectId,
      projectName: fixtureRun.projectName,
      title: fixtureRun.title,
      relPath: "alpha-app",
      objective: "Restore the fixture build",
      validationCommands: ["npm test"]
    })
  });
  assert.equal(runResponse.status, 200);
  const { run } = await runResponse.json();
  const previews = [];
  let resolveInitialRequest;
  const initialRequest = new Promise((resolve) => { resolveInitialRequest = resolve; });
  const { dialog, copyButton, runnerSelect } = renderPreview(t, {
    run,
    async fetchDryRun(options) {
      try {
        const response = await fetch(`${baseUrl}/api/cli-bridge/runner-dry-run?${new URLSearchParams(options)}`);
        assert.equal(response.status, 200);
        const contract = await response.json();
        previews.push(contract);
        return contract;
      } finally {
        resolveInitialRequest();
      }
    }
  });
  await initialRequest;
  await setImmediate();
  assert.ok(previews[0], dialog.textContent);
  assert.equal(previews[0].selectedWorkOrder.id, run.id);
  assert.equal(previews[0].scopeContext.guardDecision, "project-ready");
  assert.notEqual(previews[0].dryRunDecision, "ready");
  assert.match(dialog.textContent, /Readiness checks/);
  assert.match(dialog.textContent, /Alert drift tasks/);
  assert.match(dialog.textContent, /npm test/);
  assert.equal(copyButton.hidden, true);

  runnerSelect.value = "claude";
  await runnerSelect.onchange();
  assert.equal(previews[1].runner, "claude");
  assert.equal(previews[1].selectedWorkOrder.id, run.id);
  assert.match(dialog.textContent, /Claude CLI preview updated/);
  assert.equal(copyButton.hidden, true);
});

test("ready handoff copies the matching work order and refreshes if scope changes", async (t) => {
  let currentScope = scope;
  const copied = [];
  const { dialog, copyButton } = renderPreview(t, {
    getScope: () => currentScope,
    fetchDryRun: async (options) => readyContract(options),
    copyText: async (markdown) => { copied.push(markdown); }
  });
  await setImmediate();
  assert.equal(copyButton.hidden, false);
  await copyButton.onclick();
  assert.deepEqual(copied, ["Fixture codex handoff for run-alpha"]);

  currentScope = { ...scope, activeProjectId: "another-app" };
  await copyButton.onclick();
  assert.equal(copyButton.hidden, true);
  assert.equal(copied.length, 1);
  assert.match(dialog.textContent, /Select Alpha App in Active project scope/);
});

test("a fallback contract is rejected even when the server reports it ready", async (t) => {
  const { dialog, copyButton } = renderPreview(t, {
    fetchDryRun: async (options) => {
      const payload = readyContract({ ...options, runId: "fallback" });
      payload.selectedWorkOrder.sourceType = "readiness-work-order";
      return payload;
    }
  });
  await setImmediate();
  assert.match(dialog.textContent, /Refresh Governance and reopen this work order/);
  assert.doesNotMatch(dialog.textContent, /npm test/);
  assert.equal(copyButton.hidden, true);
  await copyButton.onclick();
});

test("a response from a previous scope is discarded", async (t) => {
  let currentScope = scope;
  let finishRequest;
  const { dialog, copyButton } = renderPreview(t, {
    getScope: () => currentScope,
    fetchDryRun: (options) => new Promise((resolve) => {
      finishRequest = () => resolve(readyContract(options));
    })
  });
  currentScope = { ...scope, activeProjectId: "another-app" };
  finishRequest();
  await setImmediate();
  assert.match(dialog.textContent, /active scope changed/);
  assert.doesNotMatch(dialog.textContent, /npm test/);
  assert.equal(copyButton.hidden, true);
});
