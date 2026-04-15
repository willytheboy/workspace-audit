import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FIXTURE_CONFIG = {
  MAX_SCAN_DEPTH: 4,
  IGNORE_DIRS: [
    ".git", ".github", ".idea", ".next", ".nuxt", ".output",
    ".pytest_cache", ".turbo", ".venv", ".vscode", "__pycache__",
    "build", "coverage", "dist", "node_modules", "out", "target", "tmp", "vendor", "venv"
  ],
  ROOT_INFRA_DIRS: [".claude", "PROCESS", "runtime", "shared", "templates"],
  SKIP_PATH_PREFIXES: ["archive/legacy-migrations"],
  GENERIC_COMPONENT_NAMES: [
    "api", "app", "apps", "backend", "client", "clients", "common", "components",
    "core", "docs", "frontend", "infra", "lib", "libs", "scripts", "server",
    "service", "services", "shared", "src", "test", "tests", "types", "ui", "utils"
  ],
  STANDALONE_CHILD_NAMES: ["dashboard", "mobile", "portal", "website"],
  MANIFEST_FILES: ["package.json", "requirements.txt", "pyproject.toml", "Cargo.toml", "go.mod", "composer.json", "pom.xml"],
  LOCK_FILES: ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"],
  CONFIG_NAMES: ["vite.config.js", "vite.config.ts", "next.config.js", "next.config.ts", "tsconfig.json", "tailwind.config.js", "tailwind.config.ts"],
  DOC_EXTENSIONS: [".md", ".txt"],
  CATEGORY_RULES: [
    { category: "General Workspace", keywords: ["app", "project"] },
    { category: "AI / Agents", keywords: ["agent", "ai"] }
  ],
  FRAMEWORK_PATTERNS: [
    ["react", "React"],
    ["vite", "Vite"],
    ["express", "Express"]
  ],
  STOP_WORDS: ["and", "app", "for", "the", "workspace"]
};

const FIXTURE_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <!-- INJECT_DATA_HERE -->
  <script type="module" src="./app.js"></script>
</body>
</html>
`;

export async function createFixtureWorkspace() {
  const baseDir = await mkdtemp(join(tmpdir(), "workspace-audit-"));
  const workspaceRoot = join(baseDir, "workspace");
  const appDir = join(baseDir, "workspace-audit");

  await mkdir(workspaceRoot, { recursive: true });
  await mkdir(appDir, { recursive: true });

  await writeFile(join(appDir, "audit.config.json"), JSON.stringify(FIXTURE_CONFIG, null, 2));
  await writeFile(join(appDir, "template.html"), FIXTURE_TEMPLATE);
  await writeFile(join(appDir, "styles.css"), "body { background: #111827; color: #e5e7eb; }\n");
  await writeFile(join(appDir, "app.js"), "console.log('fixture app shell');\n");

  const projectDir = join(workspaceRoot, "alpha-app");
  await mkdir(join(projectDir, "src"), { recursive: true });

  await writeFile(join(projectDir, "package.json"), JSON.stringify({
    name: "alpha-app",
    description: "Alpha app for audit testing",
    scripts: {
      dev: "vite",
      test: "node --test"
    },
    dependencies: {
      react: "^19.0.0"
    },
    devDependencies: {
      vite: "^7.0.0"
    }
  }, null, 2));

  await writeFile(join(projectDir, "README.md"), "# Alpha App\nA small fixture app.\n");
  await writeFile(join(projectDir, "vite.config.js"), "export default {};\n");
  await writeFile(join(projectDir, "src", "index.js"), "export const answer = 42;\n");
  await writeFile(join(projectDir, "src", "index.test.js"), "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('fixture', () => assert.equal(1, 1));\n");

  const frontendDir = join(projectDir, "frontend");
  await mkdir(frontendDir, { recursive: true });
  await writeFile(join(frontendDir, "package.json"), JSON.stringify({
    name: "alpha-frontend",
    scripts: {
      dev: "vite --host 0.0.0.0",
      build: "vite build"
    },
    dependencies: {
      react: "^19.0.0"
    },
    devDependencies: {
      vite: "^7.0.0"
    }
  }, null, 2));

  const skippedDir = join(workspaceRoot, "archive", "legacy-migrations", "ignored-app");
  await mkdir(skippedDir, { recursive: true });
  await writeFile(join(skippedDir, "package.json"), JSON.stringify({ name: "ignored-app" }, null, 2));

  return { appDir, baseDir, workspaceRoot };
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}
