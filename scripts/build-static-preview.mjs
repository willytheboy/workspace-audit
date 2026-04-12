import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const publicDir = join(appDir, "public");

const files = [
  "app.js",
  "index.html",
  "inventory.json",
  "styles.css"
];

await rm(publicDir, { recursive: true, force: true });
await mkdir(publicDir, { recursive: true });

for (const file of files) {
  await cp(join(appDir, file), join(publicDir, file));
}

await cp(join(appDir, "ui"), join(publicDir, "ui"), {
  recursive: true
});

console.log(`Static Vercel preview written to ${publicDir}`);
