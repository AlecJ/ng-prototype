import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../src", import.meta.url).pathname;
const files = listFiles(root).filter((file) => /\.(ts|tsx)$/.test(file));
const failures = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const rel = relative(root, file);
  if (/from\s+["'](?:neuroglancer|.*neuroglancer\/src)/.test(text)) {
    failures.push(`${rel} imports Neuroglancer code`);
  }
  if (rel.endsWith(".tsx") && !rel.startsWith("client/")) {
    if (/from\s+["']\.\.\/(worker|precomputed|webgpu)\//.test(text)) {
      failures.push(`${rel} imports visualization internals directly`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}