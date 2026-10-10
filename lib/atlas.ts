import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { Decision, Problem } from "./types";

const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const FENCE = /```(d2|mermaid|mmd)[^\n]*\n([\s\S]*?)\n```/;
const LEVELS = ["story", "detail"] as const;
const STATUSES = ["proposed", "accepted", "rejected"] as const;

type Project = { root: string; name: string };

export function splitDoc(raw: string): { meta: Record<string, unknown>; body: string } | null {
  const m = raw.match(FRONT);
  if (!m) return null;
  try {
    const meta = YAML.parse(m[1]);
    return { meta: meta && typeof meta === "object" ? meta : {}, body: m[2] };
  } catch {
    return null;
  }
}

// Pulls the first d2/mermaid block out of the body; the rest is the written reasoning.
export function extractDiagram(body: string) {
  const m = body.match(FENCE);
  if (!m) return { lang: null, source: null, text: body.trim() };
  const text = body
    .replace(m[0], "")
    .replace(/^##\s+Diagram\s*$/im, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { lang: m[1] === "d2" ? ("d2" as const) : ("mermaid" as const), source: m[2], text };
}

const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : v == null || v === "" ? [] : [String(v)]);
// Accepts "YYYY-MM-DD" or "YYYY-MM-DD HH:MM" (a time orders decisions made on the same day).
const dateStr = (v: unknown) =>
  v instanceof Date ? v.toISOString().slice(0, 16).replace("T", " ").replace(/ 00:00$/, "") : v == null ? "" : String(v).trim().replace("T", " ").slice(0, 16);

async function parseDecision(file: string, proj: Project, problems: Problem[]): Promise<Decision | null> {
  const bad = (message: string, severity: Problem["severity"] = "error") =>
    problems.push({ path: file, project: proj.name, severity, message });
  let raw: string;
  let mod = 0;
  try {
    raw = await fs.readFile(file, "utf8");
    mod = (await fs.stat(file)).mtimeMs;
  } catch {
    bad("Cannot read file");
    return null;
  }
  const doc = splitDoc(raw);
  if (!doc) {
    bad("Missing or invalid front matter (needs a --- block at the top)");
    return null;
  }
  const m = doc.meta;
  const id = m.id == null ? "" : String(m.id);
  if (!id) {
    bad("Missing id");
    return null;
  }
  const level = String(m.level ?? "");
  const status = String(m.status ?? "");
  const date = dateStr(m.date);
  if (!LEVELS.includes(level as never)) bad(`${id}: level must be story or detail, got "${level}"`);
  if (!STATUSES.includes(status as never)) bad(`${id}: status must be proposed, accepted or rejected, got "${status}"`);
  if (!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(date)) bad(`${id}: date must be YYYY-MM-DD or YYYY-MM-DD HH:MM, got "${date}"`);
  if (!m.title) bad(`${id}: missing title`, "warning");
  const system = m.system == null ? "" : String(m.system).trim().toLowerCase().replace(/\s+/g, "-").replace(/^\/+|\/+$/g, "");
  if (!system) bad(`${id}: no system, so it shows under Unsorted. Add a line like "system: processors".`, "warning");
  else if (system.split("/").length > 2) bad(`${id}: system "${system}" has more than one "/"; only one sub-level is shown`, "warning");
  const tags = list(m.tags).map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (tags.length === 0) bad(`${id}: no tags, so it appears in no timeline`, "warning");
  const realizes = list(m.realizes);
  if (level === "story" && realizes.length) bad(`${id}: a story should not realize anything; only details point up`, "warning");
  if (level === "detail" && realizes.length === 0) bad(`${id}: detail does not say which story it realizes`, "warning");
  return {
    id,
    title: m.title ? String(m.title) : id,
    level: LEVELS.includes(level as never) ? (level as Decision["level"]) : "story",
    system: system.split("/").slice(0, 2).join("/"),
    status: STATUSES.includes(status as never) ? (status as Decision["status"]) : "proposed",
    date,
    tags,
    realizes,
    supersedes: list(m.supersedes),
    supersededBy: [],
    detailedBy: [],
    mod,
    path: file,
    projectRoot: proj.root,
    project: proj.name,
  };
}

export async function readAtlas(dir: string, proj: Project, out: Decision[], problems: Problem[]) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".md") || e.name.toLowerCase() === "readme.md") continue;
    const d = await parseDecision(path.join(dir, e.name), proj, problems);
    if (d) out.push(d);
  }
}

// Likely typo of the same feature. Tags that differ only in numbers (v1/v2, phase1/phase2) are distinct on purpose.
function close(a: string, b: string) {
  if (a.replace(/\d+/g, "") === b.replace(/\d+/g, "")) return false;
  if (Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 2) return false;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length] <= 2;
}

// Cross-file checks and computed links, within one project.
export function analyze(decisions: Decision[], problems: Problem[]) {
  const byProject = new Map<string, Decision[]>();
  for (const d of decisions) byProject.set(d.projectRoot, [...(byProject.get(d.projectRoot) ?? []), d]);
  for (const items of byProject.values()) {
    const byId = new Map<string, Decision>();
    for (const d of items) {
      if (byId.has(d.id)) problems.push({ path: d.path, project: d.project, severity: "error", message: `Duplicate id ${d.id} (also in ${path.basename(byId.get(d.id)!.path)})` });
      else byId.set(d.id, d);
    }
    for (const d of items) {
      for (const ref of d.supersedes) {
        const t = byId.get(ref);
        if (!t) problems.push({ path: d.path, project: d.project, severity: "error", message: `${d.id}: supersedes unknown id ${ref}` });
        else if (ref === d.id) problems.push({ path: d.path, project: d.project, severity: "error", message: `${d.id}: supersedes itself` });
        else t.supersededBy.push(d.id);
      }
      for (const ref of d.realizes) {
        const t = byId.get(ref);
        if (!t) problems.push({ path: d.path, project: d.project, severity: "error", message: `${d.id}: realizes unknown id ${ref}` });
        else {
          if (t.level !== "story") problems.push({ path: d.path, project: d.project, severity: "warning", message: `${d.id}: realizes ${ref}, which is not a story` });
          t.detailedBy.push(d.id);
        }
      }
    }
    const systems = [...new Set(items.map((d) => d.system).filter(Boolean))];
    for (let i = 0; i < systems.length; i++)
      for (let j = i + 1; j < systems.length; j++)
        if (close(systems[i], systems[j])) {
          const first = items.find((d) => d.system === systems[j])!;
          problems.push({ path: first.path, project: first.project, severity: "warning", message: `Systems "${systems[i]}" and "${systems[j]}" look like the same thing` });
        }

    const tags = [...new Set(items.flatMap((d) => d.tags))];
    for (let i = 0; i < tags.length; i++)
      for (let j = i + 1; j < tags.length; j++)
        if (close(tags[i], tags[j])) {
          const first = items.find((d) => d.tags.includes(tags[j]))!;
          problems.push({ path: first.path, project: first.project, severity: "warning", message: `Tags "${tags[i]}" and "${tags[j]}" look like the same feature` });
        }
  }
}
