import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_STORE = {
  version: 31,
  sources: [],
  deploymentSmokeChecks: [],
  releaseCheckpoints: [],
  releaseTaskLedgerSnapshots: [],
  dataSourceHealthSnapshots: [],
  governanceTaskUpdateLedgerSnapshots: [],
  dataSourceAccessTaskLedgerSnapshots: [],
  agentControlPlaneDecisionTaskLedgerSnapshots: [],
  agentExecutionResultTaskLedgerSnapshots: [],
  dataSourceAccessValidationEvidence: [],
  dataSourceAccessValidationEvidenceSnapshots: [],
  dataSourceAccessValidationWorkflowSnapshots: [],
  convergenceReviews: [],
  findings: [],
  tasks: [],
  workflows: [],
  notes: [],
  milestones: [],
  projectProfiles: [],
  projectProfileHistory: [],
  queueSuppressions: [],
  governanceOperations: [],
  taskSeedingCheckpoints: [],
  scriptRuns: [],
  agentSessions: [],
  agentControlPlaneSnapshots: [],
  agentControlPlaneBaselineSnapshotId: "",
  agentControlPlaneDecisionSnapshots: [],
  agentPolicyCheckpoints: [],
  agentExecutionResultCheckpoints: [],
  agentWorkOrderSnapshots: [],
  agentExecutionSlaLedgerSnapshots: [],
  agentWorkOrderRuns: [],
  cliBridgeHandoffs: [],
  cliBridgeRunTraceSnapshots: [],
  governanceExecutionViews: [],
  governanceExecutionPolicy: {
    staleThresholdHours: 24,
    staleStatuses: ["queued", "running", "blocked"],
    terminalStatuses: ["passed", "failed", "cancelled"]
  },
  scanRuns: [],
  meta: {
    lastFindingsRefreshAt: null
  }
};

const STORE_KEYS = ["version", "sources", "deploymentSmokeChecks", "releaseCheckpoints", "releaseTaskLedgerSnapshots", "dataSourceHealthSnapshots", "governanceTaskUpdateLedgerSnapshots", "dataSourceAccessTaskLedgerSnapshots", "agentControlPlaneDecisionTaskLedgerSnapshots", "agentExecutionResultTaskLedgerSnapshots", "dataSourceAccessValidationEvidence", "dataSourceAccessValidationEvidenceSnapshots", "dataSourceAccessValidationWorkflowSnapshots", "convergenceReviews", "findings", "tasks", "workflows", "notes", "milestones", "projectProfiles", "projectProfileHistory", "queueSuppressions", "governanceOperations", "taskSeedingCheckpoints", "scriptRuns", "agentSessions", "agentControlPlaneSnapshots", "agentControlPlaneBaselineSnapshotId", "agentControlPlaneDecisionSnapshots", "agentPolicyCheckpoints", "agentExecutionResultCheckpoints", "agentWorkOrderSnapshots", "agentExecutionSlaLedgerSnapshots", "agentWorkOrderRuns", "cliBridgeHandoffs", "cliBridgeRunTraceSnapshots", "governanceExecutionViews", "governanceExecutionPolicy", "scanRuns", "meta"];

/**
 * @param {unknown} parsed
 */
function normalizeStore(parsed) {
  const objectValue = parsed && typeof parsed === "object" ? parsed : {};
  return {
    ...DEFAULT_STORE,
    ...objectValue,
    meta: {
      ...DEFAULT_STORE.meta,
      ...(objectValue.meta && typeof objectValue.meta === "object" ? objectValue.meta : {})
    },
    sources: Array.isArray(objectValue.sources) ? objectValue.sources : [],
    deploymentSmokeChecks: Array.isArray(objectValue.deploymentSmokeChecks) ? objectValue.deploymentSmokeChecks : [],
    releaseCheckpoints: Array.isArray(objectValue.releaseCheckpoints) ? objectValue.releaseCheckpoints : [],
    releaseTaskLedgerSnapshots: Array.isArray(objectValue.releaseTaskLedgerSnapshots) ? objectValue.releaseTaskLedgerSnapshots : [],
    dataSourceHealthSnapshots: Array.isArray(objectValue.dataSourceHealthSnapshots) ? objectValue.dataSourceHealthSnapshots : [],
    governanceTaskUpdateLedgerSnapshots: Array.isArray(objectValue.governanceTaskUpdateLedgerSnapshots) ? objectValue.governanceTaskUpdateLedgerSnapshots : [],
    dataSourceAccessTaskLedgerSnapshots: Array.isArray(objectValue.dataSourceAccessTaskLedgerSnapshots) ? objectValue.dataSourceAccessTaskLedgerSnapshots : [],
    agentControlPlaneDecisionTaskLedgerSnapshots: Array.isArray(objectValue.agentControlPlaneDecisionTaskLedgerSnapshots) ? objectValue.agentControlPlaneDecisionTaskLedgerSnapshots : [],
    agentExecutionResultTaskLedgerSnapshots: Array.isArray(objectValue.agentExecutionResultTaskLedgerSnapshots) ? objectValue.agentExecutionResultTaskLedgerSnapshots : [],
    dataSourceAccessValidationEvidence: Array.isArray(objectValue.dataSourceAccessValidationEvidence) ? objectValue.dataSourceAccessValidationEvidence : [],
    dataSourceAccessValidationEvidenceSnapshots: Array.isArray(objectValue.dataSourceAccessValidationEvidenceSnapshots) ? objectValue.dataSourceAccessValidationEvidenceSnapshots : [],
    dataSourceAccessValidationWorkflowSnapshots: Array.isArray(objectValue.dataSourceAccessValidationWorkflowSnapshots) ? objectValue.dataSourceAccessValidationWorkflowSnapshots : [],
    convergenceReviews: Array.isArray(objectValue.convergenceReviews) ? objectValue.convergenceReviews : [],
    findings: Array.isArray(objectValue.findings) ? objectValue.findings : [],
    tasks: Array.isArray(objectValue.tasks) ? objectValue.tasks : [],
    workflows: Array.isArray(objectValue.workflows) ? objectValue.workflows : [],
    notes: Array.isArray(objectValue.notes) ? objectValue.notes : [],
    milestones: Array.isArray(objectValue.milestones) ? objectValue.milestones : [],
    projectProfiles: Array.isArray(objectValue.projectProfiles) ? objectValue.projectProfiles : [],
    projectProfileHistory: Array.isArray(objectValue.projectProfileHistory) ? objectValue.projectProfileHistory : [],
    queueSuppressions: Array.isArray(objectValue.queueSuppressions) ? objectValue.queueSuppressions : [],
    governanceOperations: Array.isArray(objectValue.governanceOperations) ? objectValue.governanceOperations : [],
    taskSeedingCheckpoints: Array.isArray(objectValue.taskSeedingCheckpoints) ? objectValue.taskSeedingCheckpoints : [],
    scriptRuns: Array.isArray(objectValue.scriptRuns) ? objectValue.scriptRuns : [],
    agentSessions: Array.isArray(objectValue.agentSessions) ? objectValue.agentSessions : [],
    agentControlPlaneSnapshots: Array.isArray(objectValue.agentControlPlaneSnapshots) ? objectValue.agentControlPlaneSnapshots : [],
    agentControlPlaneBaselineSnapshotId: typeof objectValue.agentControlPlaneBaselineSnapshotId === "string" ? objectValue.agentControlPlaneBaselineSnapshotId : "",
    agentControlPlaneDecisionSnapshots: Array.isArray(objectValue.agentControlPlaneDecisionSnapshots) ? objectValue.agentControlPlaneDecisionSnapshots : [],
    agentPolicyCheckpoints: Array.isArray(objectValue.agentPolicyCheckpoints) ? objectValue.agentPolicyCheckpoints : [],
    agentExecutionResultCheckpoints: Array.isArray(objectValue.agentExecutionResultCheckpoints) ? objectValue.agentExecutionResultCheckpoints : [],
    agentWorkOrderSnapshots: Array.isArray(objectValue.agentWorkOrderSnapshots) ? objectValue.agentWorkOrderSnapshots : [],
    agentExecutionSlaLedgerSnapshots: Array.isArray(objectValue.agentExecutionSlaLedgerSnapshots) ? objectValue.agentExecutionSlaLedgerSnapshots : [],
    agentWorkOrderRuns: Array.isArray(objectValue.agentWorkOrderRuns) ? objectValue.agentWorkOrderRuns : [],
    cliBridgeHandoffs: Array.isArray(objectValue.cliBridgeHandoffs) ? objectValue.cliBridgeHandoffs : [],
    cliBridgeRunTraceSnapshots: Array.isArray(objectValue.cliBridgeRunTraceSnapshots) ? objectValue.cliBridgeRunTraceSnapshots : [],
    governanceExecutionViews: Array.isArray(objectValue.governanceExecutionViews) ? objectValue.governanceExecutionViews : [],
    governanceExecutionPolicy: objectValue.governanceExecutionPolicy && typeof objectValue.governanceExecutionPolicy === "object"
      ? {
          ...DEFAULT_STORE.governanceExecutionPolicy,
          ...objectValue.governanceExecutionPolicy,
          staleStatuses: Array.isArray(objectValue.governanceExecutionPolicy.staleStatuses) ? objectValue.governanceExecutionPolicy.staleStatuses : DEFAULT_STORE.governanceExecutionPolicy.staleStatuses,
          terminalStatuses: Array.isArray(objectValue.governanceExecutionPolicy.terminalStatuses) ? objectValue.governanceExecutionPolicy.terminalStatuses : DEFAULT_STORE.governanceExecutionPolicy.terminalStatuses
        }
      : DEFAULT_STORE.governanceExecutionPolicy,
    scanRuns: Array.isArray(objectValue.scanRuns) ? objectValue.scanRuns : []
  };
}

/**
 * @param {string} storeFile
 */
async function readJsonMirror(storeFile) {
  try {
    return JSON.parse(await readFile(storeFile, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * @param {DatabaseSync} db
 */
function initializeSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS state_entries (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

/**
 * @param {DatabaseSync} db
 */
function readStoreFromDb(db) {
  const rows = db.prepare("SELECT key, value FROM state_entries").all();
  if (!rows.length) {
    return null;
  }

  const parsed = {};
  for (const row of rows) {
    parsed[row.key] = JSON.parse(row.value);
  }
  return normalizeStore(parsed);
}

/**
 * @param {DatabaseSync} db
 * @param {ReturnType<typeof normalizeStore>} store
 */
function writeStoreToDb(db, store) {
  const upsert = db.prepare(`
    INSERT INTO state_entries (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const key of STORE_KEYS) {
      upsert.run(key, JSON.stringify(store[key]));
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * @param {string} baseDir
 */
export function createWorkspaceAuditStore(baseDir) {
  const storeFile = join(baseDir, "workspace-state.json");
  const dbFile = join(baseDir, "workspace-state.db");

  async function ensureParentDir() {
    await mkdir(dirname(storeFile), { recursive: true });
  }

  async function withDb(handler) {
    await ensureParentDir();
    const db = new DatabaseSync(dbFile);
    try {
      initializeSchema(db);
      return await handler(db);
    } finally {
      db.close();
    }
  }

  /**
   * @param {ReturnType<typeof normalizeStore>} store
   */
  async function writeJsonMirror(store) {
    await writeFile(storeFile, `${JSON.stringify(store, null, 2)}\n`);
  }

  async function readStore() {
    return withDb(async (db) => {
      const dbStore = readStoreFromDb(db);
      if (dbStore) {
        return dbStore;
      }

      const mirrored = await readJsonMirror(storeFile);
      if (mirrored) {
        const normalized = normalizeStore(mirrored);
        writeStoreToDb(db, normalized);
        await writeJsonMirror(normalized);
        return normalized;
      }

      return structuredClone(DEFAULT_STORE);
    });
  }

  /**
   * @param {ReturnType<typeof normalizeStore>} store
   */
  async function writeStore(store) {
    const normalized = normalizeStore(store);
    await withDb((db) => {
      writeStoreToDb(db, normalized);
    });
    await writeJsonMirror(normalized);
  }

  /**
   * @param {(store: ReturnType<typeof normalizeStore>) => ReturnType<typeof normalizeStore> | Promise<ReturnType<typeof normalizeStore>>} updater
   */
  async function updateStore(updater) {
    const current = await readStore();
    const updated = normalizeStore(await updater(current));
    await writeStore(updated);
    return updated;
  }

  return {
    dbFile,
    storeFile,
    readStore,
    writeStore,
    updateStore
  };
}
