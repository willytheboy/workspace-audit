import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createWorkspaceAuditServer } from "./lib/workspace-audit-server.mjs";

const PORT = Number.parseInt(process.env.PORT, 10) || 3042;
const APP_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(APP_DIR, "..");
const PUBLIC_DIR = APP_DIR;

const server = createWorkspaceAuditServer({
  rootDir: ROOT_DIR,
  publicDir: PUBLIC_DIR
});

server.listen(PORT, () => {
  console.log("\nWorkspace Audit Live Server is running!");
  console.log(`Open your browser to: http://localhost:${PORT}`);
  console.log(`Serving data from: ${PUBLIC_DIR}\n`);
});
