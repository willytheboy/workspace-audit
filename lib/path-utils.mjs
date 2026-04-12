import { isAbsolute, relative } from "node:path";

export function isWithin(baseDir, targetPath) {
  const rel = relative(baseDir, targetPath);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
