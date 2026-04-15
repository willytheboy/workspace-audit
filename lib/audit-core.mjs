import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { createWorkspaceAuditStore } from "./workspace-audit-store.mjs";

const SOURCE_LANGUAGE_MAP = new Map([
  [".cjs", "JavaScript"], [".css", "CSS"], [".cs", "C#"], [".go", "Go"],
  [".html", "HTML"], [".java", "Java"], [".js", "JavaScript"], [".jsx", "React JSX"],
  [".json", "JSON"], [".kt", "Kotlin"], [".mjs", "JavaScript"], [".php", "PHP"],
  [".py", "Python"], [".rs", "Rust"], [".scss", "SCSS"], [".sql", "SQL"],
  [".swift", "Swift"], [".ts", "TypeScript"], [".tsx", "React TSX"], [".vue", "Vue"],
  [".yml", "YAML"], [".yaml", "YAML"]
]);

const SOURCE_CODE_LANGUAGES = new Set([
  "C#", "CSS", "Go", "HTML", "Java", "JavaScript", "Kotlin", "PHP", "Python",
  "React JSX", "React TSX", "Rust", "SCSS", "SQL", "Swift", "TypeScript", "Vue"
]);

export function resolveDefaultAuditPaths(appDir) {
  const resolvedAppDir = path.resolve(appDir);
  return {
    appDir: resolvedAppDir,
    rootDir: path.resolve(resolvedAppDir, ".."),
    outputDir: resolvedAppDir,
    configPath: path.join(resolvedAppDir, "audit.config.json"),
    templatePath: path.join(resolvedAppDir, "template.html")
  };
}

async function safeReadDir(dirPath) {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function safeReadFile(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function safeStat(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

function getGitLastModified(dirPath) {
  try {
    const output = execSync("git log -1 --format=%cd --date=iso-strict", {
      cwd: dirPath,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000
    });
    const dateStr = output.toString().trim();
    return dateStr ? new Date(dateStr).getTime() : null;
  } catch {
    return null;
  }
}

function humanizeName(rawName) {
  const stripped = rawName
    .replace(/^\d+(?:[_-]\d+)?[_-]?/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!stripped) {
    return rawName;
  }

  return stripped.split(" ").map((part) => {
    if (/^[A-Z0-9]{2,}$/.test(part)) return part;
    if (/^(ai|crm|fnb|api|ui|ux)$/i.test(part)) return part.toUpperCase();
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join(" ");
}

function normalizeText(text) {
  return text.toLowerCase().replace(/[`*_>#]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(text, stopWords) {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token && token.length > 2 && !stopWords.has(token));
}

function jaccard(aValues, bValues) {
  const a = new Set(aValues);
  const b = new Set(bValues);
  if (!a.size && !b.size) return 0;

  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection += 1;
  }

  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function scoreFreshness(daysOld) {
  if (daysOld <= 7) return 100;
  if (daysOld <= 30) return 85;
  if (daysOld <= 90) return 65;
  if (daysOld <= 180) return 40;
  return 18;
}

function detectLanguage(fileName) {
  return SOURCE_LANGUAGE_MAP.get(path.extname(fileName).toLowerCase()) || "";
}

function detectFrameworksFromNames(names, frameworkPatterns, targetSet) {
  const lowerNames = names.map((name) => name.toLowerCase());
  for (const [pattern, label] of frameworkPatterns) {
    if (lowerNames.some((name) => name.includes(pattern))) {
      targetSet.add(label);
    }
  }
}

async function readPackageInfo(packagePath) {
  const raw = await safeReadFile(packagePath);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return {
      name: parsed.name || "",
      description: parsed.description || "",
      dependencies: Object.keys(parsed.dependencies || {}),
      devDependencies: Object.keys(parsed.devDependencies || {}),
      scripts: Object.keys(parsed.scripts || {}),
      scriptCommands: Object.entries(parsed.scripts || {}).map(([name, command]) => ({
        name,
        command: String(command || "")
      })),
      keywords: parsed.keywords || []
    };
  } catch {
    return null;
  }
}

async function readReadmeSummary(readmePath) {
  const raw = await safeReadFile(readmePath);
  if (!raw) return { title: "", summary: "" };

  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let title = "";
  let summary = "";

  for (const line of lines) {
    if (!title && line.startsWith("#")) {
      title = line.replace(/^#+\s*/, "").trim();
      continue;
    }
    if (!summary && !line.startsWith("#") && !line.startsWith("|") && !line.startsWith("```") && !line.startsWith("- ") && !line.startsWith("* ")) {
      summary = line;
      break;
    }
  }

  return { title, summary };
}

async function readRequirements(requirementsPath) {
  const raw = await safeReadFile(requirementsPath);
  if (!raw) return [];

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/[<>=!~]/)[0].trim())
    .filter(Boolean);
}

async function maybeCountLines(filePath, extension, textExtensions) {
  if (!textExtensions.has(extension)) return 0;

  const stats = await safeStat(filePath);
  if (!stats || stats.size > 1_250_000) return 0;

  const raw = await safeReadFile(filePath);
  return raw ? raw.split(/\r?\n/).length : 0;
}

async function loadAuditAssets({ configPath, templatePath, outputDir }) {
  try {
    const [configRaw, template] = await Promise.all([
      fs.readFile(configPath, "utf8"),
      fs.readFile(templatePath, "utf8")
    ]);
    return { config: JSON.parse(configRaw), template };
  } catch (error) {
    throw new Error(`Error loading config or template from ${outputDir}: ${error.message}`);
  }
}

function injectPayloadIntoTemplate(template, payload) {
  const serializedPayload = JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

  return template.replace(
    "<!-- INJECT_DATA_HERE -->",
    `<script id="workspace-audit-bootstrap" type="application/json">${serializedPayload}</script>`
  );
}

/**
 * @param {Array<{
 *   id: string,
 *   name: string,
 *   relPath: string,
 *   zone: string,
 *   category: string,
 *   qualityScore: number,
 *   freshnessScore: number,
 *   docsFiles: number,
 *   testFiles: number,
 *   sourceFiles: number,
 *   sourceLines: number,
 *   daysOld: number,
 *   frameworks?: string[],
 *   warnings?: unknown[]
 * }>} projects
 */
function buildProjectSnapshots(projects) {
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    relPath: project.relPath,
    zone: project.zone,
    category: project.category,
    qualityScore: project.qualityScore,
    freshnessScore: project.freshnessScore,
    docsFiles: project.docsFiles,
    testFiles: project.testFiles,
    sourceFiles: project.sourceFiles,
    sourceLines: project.sourceLines,
    daysOld: project.daysOld,
    frameworks: Array.isArray(project.frameworks) ? project.frameworks.slice(0, 8) : [],
    warningsCount: Array.isArray(project.warnings) ? project.warnings.length : 0
  }));
}

/**
 * @param {{
 *   generatedAt?: string,
 *   summary?: Record<string, unknown>,
 *   projects?: Array<{
 *     id: string,
 *     name: string,
 *     relPath: string,
 *     zone: string,
 *     category: string,
 *     qualityScore: number,
 *     freshnessScore: number,
 *     docsFiles: number,
 *     testFiles: number,
 *     sourceFiles: number,
 *     sourceLines: number,
 *     daysOld: number,
 *     frameworks?: string[],
 *     warnings?: unknown[]
 *   }>
 * }} payload
 */
function createScanRun(payload) {
  const generatedAt = String(payload.generatedAt || new Date().toISOString());
  return {
    id: `scan-${generatedAt.replace(/[^0-9A-Za-z]/g, "").toLowerCase()}`,
    generatedAt,
    summary: payload.summary || {},
    projects: buildProjectSnapshots(Array.isArray(payload.projects) ? payload.projects : [])
  };
}

export async function generateAudit(options = {}) {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const outputDir = path.resolve(options.outputDir ?? process.cwd());
  const configPath = path.resolve(options.configPath ?? path.join(outputDir, "audit.config.json"));
  const templatePath = path.resolve(options.templatePath ?? path.join(outputDir, "template.html"));
  const now = options.now ? new Date(options.now) : new Date();
  const currentTimeMs = now.getTime();

  const { config, template } = await loadAuditAssets({ configPath, templatePath, outputDir });
  const maxScanDepth = Number.parseInt(options.maxScanDepth, 10) || config.MAX_SCAN_DEPTH || 5;

  const ignoreDirs = new Set(config.IGNORE_DIRS || []);
  const rootInfraDirs = new Set(config.ROOT_INFRA_DIRS || []);
  const skipPathPrefixes = config.SKIP_PATH_PREFIXES || [];
  const genericComponentNames = new Set(config.GENERIC_COMPONENT_NAMES || []);
  const standaloneChildNames = new Set(config.STANDALONE_CHILD_NAMES || []);
  const manifestFiles = new Set(config.MANIFEST_FILES || []);
  const lockFiles = new Set(config.LOCK_FILES || []);
  const configNames = new Set(config.CONFIG_NAMES || []);
  const docExtensions = new Set(config.DOC_EXTENSIONS || []);
  const stopWords = new Set(config.STOP_WORDS || []);
  const categoryRules = config.CATEGORY_RULES || [];
  const frameworkPatterns = config.FRAMEWORK_PATTERNS || [];
  const textExtensions = new Set([...SOURCE_LANGUAGE_MAP.keys(), ".md", ".mdx", ".toml", ".txt"]);

  function relativeToRoot(filePath) {
    const rel = path.relative(rootDir, filePath);
    return rel === "" ? "." : rel;
  }

  function segmentDepth(relativePath) {
    if (!relativePath || relativePath === ".") return 0;
    return relativePath.split(path.sep).filter(Boolean).length;
  }

  function shouldSkipPath(relPath) {
    const normalized = relPath.split(path.sep).join("/");
    return skipPathPrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
  }

  function isIgnoredDirectory(name, parentRel = ".") {
    const lowerName = name.toLowerCase();
    if (ignoreDirs.has(name) || name.startsWith(".")) return true;
    if (["examples", "playground", "samples"].includes(lowerName) || lowerName.includes("reference")) return true;
    if (["legacy", "_archive", "archives", "backup", "backups", "old", "merged_originals"].includes(lowerName) && parentRel !== ".") return true;
    if (lowerName === "apps" && segmentDepth(parentRel) >= 2) return true;
    if (lowerName === "projects" && segmentDepth(parentRel) >= 2) return true;
    return false;
  }

  function looksLikeReadme(name) {
    return /^README(?:\.[^.]+)?$/i.test(name);
  }

  function looksLikeLockFile(name) {
    return lockFiles.has(name);
  }

  function looksLikeConfig(name) {
    if (configNames.has(name)) return true;
    return name === ".env"
      || name.startsWith(".env.")
      || name.startsWith("vite.config.")
      || name.startsWith("next.config.")
      || name.endsWith(".config.js")
      || name.endsWith(".config.ts");
  }

  function looksLikeManifest(name) {
    if (manifestFiles.has(name)) return true;
    return name.endsWith(".csproj") || name.endsWith(".sln") || name === "build.gradle";
  }

  function listDirectSignals(dirPath, fileEntries) {
    const signal = { hasReadme: false, manifestCount: 0, lockCount: 0, configCount: 0, directFiles: [] };
    for (const entry of fileEntries) {
      const { name } = entry;
      if (looksLikeReadme(name)) {
        signal.hasReadme = true;
        signal.directFiles.push(name);
      }
      if (looksLikeManifest(name)) {
        signal.manifestCount += 1;
        signal.directFiles.push(name);
      }
      if (looksLikeLockFile(name)) signal.lockCount += 1;
      if (looksLikeConfig(name)) signal.configCount += 1;
    }
    const dirName = path.basename(dirPath).toLowerCase();
    signal.componentLikely = genericComponentNames.has(dirName);
    signal.strong = signal.hasReadme || signal.manifestCount > 0 || signal.configCount > 0;
    return signal;
  }

  async function hasImmediateNestedSignal(dirPath) {
    const rel = relativeToRoot(dirPath);
    const entries = await safeReadDir(dirPath);
    for (const entry of entries) {
      if (!entry.isDirectory() || isIgnoredDirectory(entry.name, rel)) continue;
      const childPath = path.join(dirPath, entry.name);
      if (shouldSkipPath(relativeToRoot(childPath))) continue;
      const childEntries = await safeReadDir(childPath);
      const childFiles = childEntries.filter((item) => item.isFile());
      const signal = listDirectSignals(childPath, childFiles);
      if (signal.strong) return true;
    }
    return false;
  }

  function detectZone(relPath) {
    const normalized = relPath.split(path.sep).join("/");
    if (normalized.startsWith("active/")) return "active";
    if (normalized.startsWith("archive/") || normalized.startsWith("projects/archived/")) return "archived";
    if (normalized.startsWith("projects/deployed/")) return "deployed";
    if (normalized.startsWith("TEST/") || normalized.startsWith("temp-")) return "sandbox";
    return "workspace";
  }

  function looksLikeProjectRoot(relPath, signal) {
    if (!signal.strong) return false;
    const parts = relPath.split(path.sep).filter(Boolean);
    const depth = parts.length;
    const dirName = parts.at(-1)?.toLowerCase() || "";
    const zone = detectZone(relPath);

    if (depth === 1) return !rootInfraDirs.has(dirName);
    if (depth <= 2) return true;
    if (zone === "active" && depth <= 3 && !signal.componentLikely) return true;
    if ((zone === "archived" || zone === "deployed") && depth <= 4 && !signal.componentLikely) return true;
    return !signal.componentLikely && (signal.hasReadme || signal.manifestCount > 1 || signal.configCount > 1);
  }

  async function scanCandidates(currentDir, depth = 0, candidates = []) {
    if (depth > maxScanDepth) return candidates;
    if (currentDir !== rootDir && shouldSkipPath(relativeToRoot(currentDir))) return candidates;

    const entries = await safeReadDir(currentDir);
    const files = entries.filter((entry) => entry.isFile());
    const rel = relativeToRoot(currentDir);
    const directories = entries.filter((entry) => entry.isDirectory() && !isIgnoredDirectory(entry.name, rel));

    if (currentDir !== rootDir) {
      let signal = listDirectSignals(currentDir, files);
      if (!signal.strong && segmentDepth(rel) <= 2 && detectZone(rel) !== "archived" && await hasImmediateNestedSignal(currentDir)) {
        signal = { ...signal, strong: true };
      }
      if (looksLikeProjectRoot(rel, signal)) {
        candidates.push({
          dirPath: currentDir,
          relPath: rel,
          depth: segmentDepth(rel),
          signal,
          displayName: humanizeName(path.basename(currentDir))
        });
      }
    }

    for (const entry of directories) {
      await scanCandidates(path.join(currentDir, entry.name), depth + 1, candidates);
    }
    return candidates;
  }

  function dedupeCandidates(candidates) {
    const kept = [];
    const sorted = [...candidates].sort((a, b) => a.depth - b.depth || a.relPath.localeCompare(b.relPath));

    for (const candidate of sorted) {
      const ancestor = kept
        .filter((item) => candidate.relPath.startsWith(`${item.relPath}${path.sep}`))
        .sort((a, b) => b.depth - a.depth)[0];

      if (!ancestor) {
        kept.push(candidate);
        continue;
      }

      const candidateName = candidate.displayName.toLowerCase();
      const ancestorName = ancestor.displayName.toLowerCase();
      const nameSimilarity = jaccard(tokenize(candidateName, stopWords), tokenize(ancestorName, stopWords));
      const baseName = path.basename(candidate.dirPath).toLowerCase();

      if (genericComponentNames.has(baseName) || nameSimilarity > 0.6) continue;
      if (candidate.depth - ancestor.depth <= 1 && candidate.signal.manifestCount === 1 && !candidate.signal.hasReadme && !standaloneChildNames.has(baseName)) continue;
      kept.push(candidate);
    }

    return kept;
  }

  async function collectProjectMetrics(project, allProjectRoots) {
    const nestedProjectRoots = new Set(allProjectRoots.filter((rootPath) => rootPath !== project.dirPath && rootPath.startsWith(`${project.dirPath}${path.sep}`)));
    const stats = {
      totalFiles: 0,
      sourceFiles: 0,
      sourceLines: 0,
      testFiles: 0,
      docsFiles: 0,
      configFiles: 0,
      manifestFiles: 0,
      lockFiles: 0,
      ciFiles: 0,
      dockerFiles: 0,
      packageJsonFiles: 0,
      readmeFiles: 0,
      totalBytes: 0,
      sourceBytes: 0,
      lastModifiedMs: 0,
      languages: new Map(),
      frameworks: new Set(),
      rawKeywords: new Set(),
      rootPackage: null,
      readmeInfo: null,
      nestedManifestNames: [],
      runtimeSurfaces: [],
      runtimeSurfaceKeys: new Set()
    };

    const gitLastModified = getGitLastModified(project.dirPath);
    if (gitLastModified) stats.lastModifiedMs = gitLastModified;

    function createRuntimeCwd(runtimePath) {
      return runtimePath ? path.join(project.relPath, runtimePath) : project.relPath;
    }

    function addRuntimeSurface(surface) {
      const key = `${surface.type}:${surface.path || "."}:${surface.packageName || ""}`;
      if (stats.runtimeSurfaceKeys.has(key)) return;
      stats.runtimeSurfaceKeys.add(key);
      stats.runtimeSurfaces.push(surface);
    }

    async function walk(currentDir) {
      const entries = await safeReadDir(currentDir);
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (isIgnoredDirectory(entry.name, relativeToRoot(currentDir)) || shouldSkipPath(relativeToRoot(fullPath)) || nestedProjectRoots.has(fullPath)) continue;
          await walk(fullPath);
          continue;
        }
        if (!entry.isFile()) continue;

        const fileStats = await safeStat(fullPath);
        if (!fileStats) continue;

        stats.totalFiles += 1;
        stats.totalBytes += fileStats.size;
        if (!gitLastModified) stats.lastModifiedMs = Math.max(stats.lastModifiedMs, fileStats.mtimeMs);

        const extension = path.extname(entry.name).toLowerCase();
        const language = detectLanguage(entry.name);
        const rel = path.relative(project.dirPath, fullPath);

        if (looksLikeReadme(entry.name)) {
          stats.readmeFiles += 1;
          stats.docsFiles += 1;
          if (!stats.readmeInfo) stats.readmeInfo = await readReadmeSummary(fullPath);
        } else if (docExtensions.has(extension)) {
          stats.docsFiles += 1;
        }

        if (looksLikeManifest(entry.name)) {
          stats.manifestFiles += 1;
          stats.nestedManifestNames.push(rel);
        }
        if (looksLikeLockFile(entry.name)) stats.lockFiles += 1;
        if (looksLikeConfig(entry.name)) stats.configFiles += 1;
        if (rel.startsWith(".github")) stats.ciFiles += 1;
        if (entry.name.startsWith("docker-compose") || rel.includes("Dockerfile")) stats.dockerFiles += 1;
        if (/(^|[/.])(test|tests|__tests__|spec)\b/i.test(rel) || /\.(test|spec)\.[^.]+$/i.test(entry.name)) stats.testFiles += 1;

        if (language) stats.languages.set(language, (stats.languages.get(language) || 0) + 1);
        if (SOURCE_CODE_LANGUAGES.has(language)) {
          stats.sourceFiles += 1;
          stats.sourceBytes += fileStats.size;
          stats.sourceLines += await maybeCountLines(fullPath, extension, textExtensions);
        }

        if (entry.name === "package.json") {
          stats.packageJsonFiles += 1;
          const packageInfo = await readPackageInfo(fullPath);
          if (packageInfo) {
            if (fullPath === path.join(project.dirPath, "package.json")) stats.rootPackage = packageInfo;
            detectFrameworksFromNames([...packageInfo.dependencies, ...packageInfo.devDependencies, ...packageInfo.scripts], frameworkPatterns, stats.frameworks);
            for (const keyword of packageInfo.keywords || []) stats.rawKeywords.add(keyword);
            if (packageInfo.scripts.length) {
              const packageRelDir = path.dirname(rel);
              const runtimePath = packageRelDir === "." ? "" : packageRelDir;
              const cwd = createRuntimeCwd(runtimePath);
              addRuntimeSurface({
                type: "package",
                label: runtimePath ? `${runtimePath} package scripts` : "Root package scripts",
                path: runtimePath,
                cwd,
                packageName: packageInfo.name,
                scripts: packageInfo.scripts,
                commands: packageInfo.scriptCommands.map((script) => ({
                  name: script.name,
                  command: script.command,
                  run: `npm run ${script.name}`,
                  cwd,
                  label: runtimePath ? `${runtimePath}: ${script.name}` : script.name
                }))
              });
            }
          }
        } else if (entry.name === "requirements.txt") {
          const requirements = await readRequirements(fullPath);
          detectFrameworksFromNames(requirements, frameworkPatterns, stats.frameworks);
          for (const requirement of requirements) stats.rawKeywords.add(requirement);
          const requirementsRelDir = path.dirname(rel);
          const runtimePath = requirementsRelDir === "." ? "" : requirementsRelDir;
          const cwd = createRuntimeCwd(runtimePath);
          addRuntimeSurface({
            type: "python",
            label: runtimePath ? `${runtimePath} Python requirements` : "Root Python requirements",
            path: runtimePath,
            cwd,
            packageName: "",
            scripts: [],
            commands: [{
              name: "install",
              command: "pip install -r requirements.txt",
              run: "pip install -r requirements.txt",
              cwd,
              label: runtimePath ? `${runtimePath}: install requirements` : "install requirements"
            }]
          });
        } else if (entry.name === "Cargo.toml") {
          stats.frameworks.add("Rust");
        } else if (entry.name === "go.mod") {
          stats.frameworks.add("Go");
        } else if (entry.name.startsWith("docker-compose")) {
          stats.frameworks.add("Docker Compose");
          const composeRelDir = path.dirname(rel);
          const runtimePath = composeRelDir === "." ? "" : composeRelDir;
          const cwd = createRuntimeCwd(runtimePath);
          addRuntimeSurface({
            type: "docker-compose",
            label: runtimePath ? `${runtimePath} Docker Compose` : "Root Docker Compose",
            path: runtimePath,
            cwd,
            packageName: "",
            scripts: [],
            commands: [{
              name: "compose-up",
              command: "docker compose up --build",
              run: "docker compose up --build",
              cwd,
              label: runtimePath ? `${runtimePath}: docker compose up` : "docker compose up"
            }]
          });
        } else if (entry.name.startsWith("vite.config.")) {
          stats.frameworks.add("Vite");
        } else if (entry.name.startsWith("next.config.")) {
          stats.frameworks.add("Next.js");
        } else if (entry.name === "tauri.conf.json") {
          stats.frameworks.add("Tauri");
        }
      }
    }

    await walk(project.dirPath);

    const lastModified = stats.lastModifiedMs ? new Date(stats.lastModifiedMs) : now;
    const daysOld = Math.max(0, Math.round((currentTimeMs - lastModified.getTime()) / 86_400_000));
    const testingScore = Math.min(100, Math.round((stats.sourceFiles ? stats.testFiles / stats.sourceFiles : 0) * 230));
    const docsScore = Math.min(100, Math.round((stats.readmeFiles ? 24 : 0) + (stats.sourceFiles ? stats.docsFiles / stats.sourceFiles : 0) * 160));
    const readinessScore = Math.min(100, (stats.readmeFiles ? 18 : 0) + Math.min(16, stats.lockFiles * 6) + Math.min(18, stats.frameworks.size * 4) + Math.min(10, stats.ciFiles * 4) + Math.min(12, stats.dockerFiles * 6) + (stats.sourceFiles > 0 ? 16 : 0));
    const qualityScore = Math.max(12, Math.min(100, Math.round(
      0.34 * scoreFreshness(daysOld)
      + 0.22 * testingScore
      + 0.18 * docsScore
      + 0.16 * readinessScore
      + Math.min(10, stats.frameworks.size * 2)
      + Math.min(10, stats.lockFiles * 2)
      + (stats.readmeFiles ? 6 : -6)
    )));

    const displayName = stats.rootPackage?.name?.split("/").pop() || stats.readmeInfo?.title || project.displayName;
    const description = stats.rootPackage?.description || stats.readmeInfo?.summary || `Project rooted at ${project.relPath}`;

    const dominantLanguages = [...stats.languages.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([language]) => language);

    detectFrameworksFromNames(dominantLanguages, frameworkPatterns, stats.frameworks);
    for (const language of dominantLanguages) {
      if (language.startsWith("React")) stats.frameworks.add("React");
      if (language === "Python") stats.frameworks.add("Python");
      if (language === "Rust") stats.frameworks.add("Rust");
    }

    const categorySource = `${displayName} ${description} ${project.relPath} ${[...stats.rawKeywords].join(" ")} ${[...stats.frameworks].join(" ")}`.toLowerCase();
    let category = "General Workspace";
    let bestCategoryScore = 0;

    for (const rule of categoryRules) {
      const score = rule.keywords.reduce((total, keyword) => total + (categorySource.includes(keyword) ? 1 : 0), 0);
      if (score > bestCategoryScore) {
        bestCategoryScore = score;
        category = rule.category;
      }
    }

    if (detectZone(project.relPath) === "sandbox" && bestCategoryScore < 2) {
      category = "Sandbox / Prototype";
    }

    const warnings = [];
    if (stats.sourceFiles > 50 && stats.testFiles === 0) warnings.push({ type: "danger", message: `High complexity (${stats.sourceFiles} source files) but 0 test files detected.` });
    if (stats.lockFiles > 1) warnings.push({ type: "warning", message: `Multiple lockfiles detected (${stats.lockFiles}). This can cause CI/CD issues.` });
    if (stats.frameworks.has("React") && !stats.frameworks.has("Vite") && !stats.frameworks.has("Next.js") && !stats.frameworks.has("Expo")) warnings.push({ type: "info", message: "React detected without a modern bundler (Vite/Next/Expo). Consider migrating from CRA." });
    if (stats.readmeFiles === 0) warnings.push({ type: "warning", message: "No README.md found. Add documentation for better maintainability." });
    if (daysOld > 365) warnings.push({ type: "info", message: `Project hasn't been updated in over a year (${daysOld} days).` });

    return {
      id: project.relPath.replaceAll(path.sep, "__"),
      name: humanizeName(displayName),
      dirName: path.basename(project.dirPath),
      relPath: project.relPath,
      absPath: project.dirPath,
      zone: detectZone(project.relPath),
      category,
      description,
      frameworks: [...stats.frameworks].sort(),
      languages: dominantLanguages,
      keywords: [...new Set([
        ...tokenize(displayName, stopWords),
        ...tokenize(description, stopWords),
        ...tokenize(project.relPath.replaceAll(path.sep, " "), stopWords),
        ...[...stats.rawKeywords].flatMap((value) => tokenize(value, stopWords))
      ])].sort(),
      lastModifiedIso: lastModified.toISOString(),
      lastModifiedLabel: lastModified.toISOString().slice(0, 10),
      daysOld,
      qualityScore,
      freshnessScore: scoreFreshness(daysOld),
      testingScore,
      docsScore,
      readinessScore,
      sourceFiles: stats.sourceFiles,
      sourceLines: stats.sourceLines,
      testFiles: stats.testFiles,
      docsFiles: stats.docsFiles,
      configFiles: stats.configFiles,
      manifestFiles: stats.manifestFiles,
      lockFiles: stats.lockFiles,
      ciFiles: stats.ciFiles,
      dockerFiles: stats.dockerFiles,
      totalFiles: stats.totalFiles,
      totalBytes: stats.totalBytes,
      nestedManifestSample: stats.nestedManifestNames.slice(0, 10),
      warnings,
      scripts: stats.rootPackage ? stats.rootPackage.scripts : [],
      runtimeSurfaces: stats.runtimeSurfaces.slice(0, 20),
      runtimeSurfaceCount: stats.runtimeSurfaces.length,
      launchCommands: stats.runtimeSurfaces
        .flatMap((surface) => Array.isArray(surface.commands) ? surface.commands : [])
        .slice(0, 30),
      packageName: stats.rootPackage ? stats.rootPackage.name : null,
      deps: stats.rootPackage ? [...stats.rootPackage.dependencies, ...stats.rootPackage.devDependencies] : []
    };
  }

  function buildSimilarities(projects) {
    const pairs = [];

    for (let i = 0; i < projects.length; i += 1) {
      for (let j = i + 1; j < projects.length; j += 1) {
        const left = projects[i];
        const right = projects[j];

        let isDirectDep = false;
        if (left.packageName && right.deps.includes(left.packageName)) isDirectDep = true;
        if (right.packageName && left.deps.includes(right.packageName)) isDirectDep = true;

        if (isDirectDep) {
          pairs.push({
            leftId: left.id,
            rightId: right.id,
            leftName: left.name,
            rightName: right.name,
            score: 100,
            reasons: ["Direct Monorepo/Workspace Dependency"]
          });
          continue;
        }

        const score =
          0.46 * jaccard([...left.frameworks, ...left.languages], [...right.frameworks, ...right.languages])
          + 0.34 * jaccard(left.keywords, right.keywords)
          + 0.14 * (left.category === right.category ? 1 : 0)
          + 0.06 * (1 - Math.min(1, Math.abs(left.qualityScore - right.qualityScore) / 100));

        if (score < 0.16) continue;

        const sharedTech = [...new Set([...left.frameworks, ...left.languages])]
          .filter((item) => right.frameworks.includes(item) || right.languages.includes(item))
          .slice(0, 4);

        const reasons = [];
        if (left.category === right.category) reasons.push(left.category);
        if (sharedTech.length) reasons.push(sharedTech.join(", "));

        pairs.push({
          leftId: left.id,
          rightId: right.id,
          leftName: left.name,
          rightName: right.name,
          score: Math.round(score * 100),
          reasons
        });
      }
    }

    const similarById = new Map(projects.map((project) => [project.id, []]));
    for (const pair of pairs.sort((a, b) => b.score - a.score)) {
      similarById.get(pair.leftId).push({ name: pair.rightName, id: pair.rightId, score: pair.score, reasons: pair.reasons });
      similarById.get(pair.rightId).push({ name: pair.leftName, id: pair.leftId, score: pair.score, reasons: pair.reasons });
    }

    for (const project of projects) {
      project.similarApps = similarById.get(project.id).slice(0, 4);
    }

    return pairs.slice(0, 24);
  }

  function summarize(projects, overlaps) {
    const summary = { totalApps: projects.length, zoneCounts: {}, categoryCounts: {}, avgQuality: 0, totalSource: 0, totalTests: 0 };
    let totalQuality = 0;

    for (const project of projects) {
      summary.zoneCounts[project.zone] = (summary.zoneCounts[project.zone] || 0) + 1;
      summary.categoryCounts[project.category] = (summary.categoryCounts[project.category] || 0) + 1;
      totalQuality += project.qualityScore;
      summary.totalSource += project.sourceFiles;
      summary.totalTests += project.testFiles;
    }

    summary.avgQuality = projects.length ? Math.round(totalQuality / projects.length) : 0;
    summary.testCoverageSignal = summary.totalSource ? Math.round((summary.totalTests / summary.totalSource) * 100) : 0;
    summary.newest = [...projects].sort((a, b) => a.daysOld - b.daysOld)[0] || null;
    summary.strongest = overlaps[0] || null;
    summary.mostComplex = [...projects].sort((a, b) => b.sourceFiles - a.sourceFiles)[0] || null;
    return summary;
  }

  const rawCandidates = await scanCandidates(rootDir);
  const projects = dedupeCandidates(rawCandidates);
  const enrichedProjects = [];
  const allProjectRoots = projects.map((project) => project.dirPath);

  for (const project of projects) {
    const enriched = await collectProjectMetrics(project, allProjectRoots);
    if (enriched.sourceFiles > 0 || enriched.manifestFiles > 0 || enriched.docsFiles > 0) {
      enrichedProjects.push(enriched);
    }
  }

  enrichedProjects.sort((a, b) => a.name.localeCompare(b.name));

  const crossChecks = buildSimilarities(enrichedProjects);
  const generatedAt = now.toISOString();
  const payload = {
    generatedAt,
    rootDir,
    meta: {
      zoneOptions: [...new Set(enrichedProjects.map((project) => project.zone))].sort(),
      categoryOptions: [...new Set(enrichedProjects.map((project) => project.category))].sort()
    },
    summary: summarize(enrichedProjects, crossChecks),
    crossChecks,
    projects: enrichedProjects
  };

  const outputJson = path.join(outputDir, "inventory.json");
  const outputHtml = path.join(outputDir, "index.html");
  const historyDir = path.join(outputDir, "history");
  const historyPath = path.join(historyDir, `inventory-${generatedAt.slice(0, 10)}.json`);
  const existingInventoryRaw = await safeReadFile(outputJson);
  let existingInventory = null;
  if (existingInventoryRaw) {
    try {
      existingInventory = JSON.parse(existingInventoryRaw);
    } catch {
      existingInventory = null;
    }
  }

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputJson, JSON.stringify(payload, null, 2));
  await fs.mkdir(historyDir, { recursive: true });
  await fs.writeFile(historyPath, JSON.stringify(payload.summary, null, 2));
  const store = createWorkspaceAuditStore(outputDir);
  const nextScanRun = createScanRun(payload);
  await store.updateStore((current) => ({
    ...current,
    scanRuns: [
      nextScanRun,
      ...current.scanRuns
        .map((scanRun) => {
          if (
            existingInventory?.generatedAt
            && scanRun.generatedAt === existingInventory.generatedAt
            && (!Array.isArray(scanRun.projects) || !scanRun.projects.length)
          ) {
            return {
              ...scanRun,
              projects: buildProjectSnapshots(Array.isArray(existingInventory.projects) ? existingInventory.projects : [])
            };
          }
          return scanRun;
        })
        .filter((scanRun) => scanRun.generatedAt !== nextScanRun.generatedAt)
    ].slice(0, 120)
  }));

  await fs.writeFile(outputHtml, injectPayloadIntoTemplate(template, payload));

  return {
    generatedAt,
    rootDir,
    outputDir,
    outputHtml,
    outputJson,
    historyPath,
    projectCount: payload.summary.totalApps,
    payload
  };
}
