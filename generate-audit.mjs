import { parseArgs } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateAudit, resolveDefaultAuditPaths } from "./lib/audit-core.mjs";

const args = parseArgs({
  options: {
    dir: { type: "string", short: "d" },
    depth: { type: "string" },
    help: { type: "boolean", short: "h" }
  },
  allowPositionals: true
});

if (args.values.help) {
  console.log("Usage: node generate-audit.mjs [dir] [options]");
  console.log("Options:");
  console.log("  -d, --dir     Root directory to scan (default: parent of workspace-audit)");
  console.log("  --depth       Maximum scan depth (default: config or 5)");
  process.exit(0);
}

const appDir = dirname(fileURLToPath(import.meta.url));
const defaults = resolveDefaultAuditPaths(appDir);
const rootDir = resolve(args.positionals[0] || args.values.dir || defaults.rootDir);

async function main() {
  console.log(`Starting scan in ${rootDir}...`);
  const result = await generateAudit({
    rootDir,
    outputDir: defaults.outputDir,
    configPath: defaults.configPath,
    templatePath: defaults.templatePath,
    maxScanDepth: args.values.depth
  });

  console.log(`Found ${result.payload.projects.length} distinct projects. Collecting metrics (this might take a moment)...`);
  console.log(JSON.stringify({
    generatedAt: result.generatedAt,
    outputHtml: "workspace-audit\\index.html",
    outputJson: "workspace-audit\\inventory.json",
    totalApps: result.projectCount
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
