import assert from "node:assert/strict";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { generateAudit } from "../lib/audit-core.mjs";
import { createFixtureWorkspace, readJson } from "./test-helpers.mjs";

export async function auditCoreTest() {
  const { appDir, workspaceRoot } = await createFixtureWorkspace();
  const result = await generateAudit({
    rootDir: workspaceRoot,
    outputDir: appDir,
    now: "2026-04-10T12:00:00.000Z"
  });

  assert.equal(result.projectCount, 1);
  assert.equal(result.payload.summary.totalApps, 1);

  const inventory = await readJson(join(appDir, "inventory.json"));
  assert.equal(inventory.projects.length, 1);
  assert.equal(inventory.projects[0].name, "Alpha App");
  assert.deepEqual(inventory.projects[0].scripts.sort(), ["dev", "test"]);
  assert.ok(inventory.projects[0].runtimeSurfaces.some((surface) => surface.cwd.endsWith("alpha-app")));
  assert.ok(inventory.projects[0].runtimeSurfaces.some((surface) => surface.cwd.endsWith(join("alpha-app", "frontend"))));
  assert.ok(inventory.projects[0].launchCommands.some((command) => command.cwd.endsWith(join("alpha-app", "frontend")) && command.name === "build"));
  assert.ok(inventory.projects[0].frameworks.includes("React"));
  assert.ok(inventory.projects[0].frameworks.includes("Vite"));

  const history = await readJson(join(appDir, "history", "inventory-2026-04-10.json"));
  assert.equal(history.totalApps, 1);

  const html = await readFile(join(appDir, "index.html"), "utf8");
  assert.match(html, /<script type="module" src="\.\/*app\.js"><\/script>/);
}
