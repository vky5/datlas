import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { DIAGRAM_EXT } from "./server";
import { analyze, readAtlas } from "./atlas";
import type { Decision, DiagramFile, Problem, ScanResult } from "./types";

const SKIP = new Set(["node_modules", "vendor", "dist", "build", "target", "__pycache__", "venv", "coverage", "bower_components", "Pods"]);
const PARALLEL = 32; // open folders at once; more gains little and risks running out of file handles
const MAX_FILES = 10000; // diagram files per saved folder
const MAX_DEPTH = 25; // folder levels below the saved folder

type Project = { root: string; name: string };

type Acc = { files: DiagramFile[]; decisions: Decision[]; problems: Problem[]; tooDeep: string[]; full: boolean };
type Run = <T>(fn: () => Promise<T>) => Promise<T>;

// Caps how many filesystem calls run at once.
function limiter(n: number): Run {
  let active = 0;
  const queue: (() => void)[] = [];
  return async (fn) => {
    if (active >= n) await new Promise<void>((r) => queue.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

// Sibling folders are walked in parallel. A slot is held only for the readdir/stat call, never while recursing.
async function walk(dir: string, proj: Project, depth: number, acc: Acc, run: Run): Promise<void> {
  if (acc.files.length >= MAX_FILES) {
    acc.full = true;
    return;
  }
  if (depth > MAX_DEPTH) {
    if (acc.tooDeep.length < 3) acc.tooDeep.push(dir);
    return;
  }
  // Synchronous on purpose: thousands of tiny awaits cost far more than the calls themselves (about 4x in dev mode).
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  if (entries.some((e) => e.name === ".git")) {
    proj = { root: dir, name: path.basename(dir) };
  }
  const here = proj;
  const jobs: Promise<void>[] = [];
  if (entries.some((e) => e.isDirectory() && e.name === ".atlas")) {
    jobs.push(run(() => readAtlas(path.join(dir, ".atlas"), here, acc.decisions, acc.problems)));
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
      // Outside any git repo, each top-level folder of the saved folder is its own project
      // (so ~/work/notes/x.d2 shows under "notes", not under the saved folder's name).
      const child = depth === 0 && here.root === dir && !entries.some((x) => x.name === ".git") ? { root: full, name: e.name } : here;
      jobs.push(walk(full, child, depth + 1, acc, run));
    } else if (e.isFile()) {
      const format = DIAGRAM_EXT[path.extname(e.name).toLowerCase()];
      if (!format) continue;
      jobs.push(
        run(async () => {
          let st;
          try {
            st = statSync(full);
          } catch {
            return;
          }
          if (!st) return;
          if (acc.files.length >= MAX_FILES) {
            acc.full = true;
            return;
          }
          acc.files.push({
            path: full,
            name: e.name,
            format,
            mod: st.mtimeMs,
            size: st.size,
            projectRoot: here.root,
            project: here.name,
          });
        }),
      );
    }
  }
  await Promise.all(jobs);
}

export async function scanDir(dir: string): Promise<ScanResult> {
  const acc: Acc = { files: [], decisions: [], problems: [], tooDeep: [], full: false };
  await walk(dir, { root: dir, name: path.basename(dir) }, 0, acc, limiter(PARALLEL));
  acc.files.sort((a, b) => b.mod - a.mod);
  acc.decisions.sort((a, b) => a.path.localeCompare(b.path)); // parallel walk finishes in any order; keep problems stable
  analyze(acc.decisions, acc.problems);
  const notes: string[] = [];
  if (acc.full) notes.push(`Stopped after ${MAX_FILES.toLocaleString()} diagram files; the rest of this folder was skipped.`);
  if (acc.tooDeep.length) notes.push(`Skipped folders more than ${MAX_DEPTH} levels deep, e.g. ${acc.tooDeep[0]}`);
  return { path: dir, ok: true, diagrams: acc.files, decisions: acc.decisions, problems: acc.problems, notes };
}
