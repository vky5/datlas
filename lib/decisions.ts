import { promises as fs } from "node:fs";
import path from "node:path";
import { parseDecision, type Project } from "./parse";
import type { Decision, Problem } from "./types";

// Reads a local .datlas/ folder from disk. The parsing itself is in parse.ts.
export async function readDecisions(dir: string, proj: Project, out: Decision[], problems: Problem[]) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".md") || e.name.toLowerCase() === "readme.md") continue;
    const file = path.join(dir, e.name);
    let raw: string;
    let mod: number;
    try {
      raw = await fs.readFile(file, "utf8");
      mod = (await fs.stat(file)).mtimeMs;
    } catch {
      problems.push({ path: file, project: proj.name, severity: "error", message: "Cannot read file" });
      continue;
    }
    const d = parseDecision(raw, file, mod, proj, problems);
    if (d) out.push(d);
  }
}
