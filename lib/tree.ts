import { isCurrent as current, type Entry } from "./workspace";

// The project sidebar: one folder per system, current decisions first, history on demand.
export type Row = { entry: Entry; nested: boolean; note?: string };
export type Folder = {
  key: string; // stable id for open/closed state: "sys:processors", "sys:processors/build", "unsorted", "files"
  name: string;
  kind: "system" | "unsorted" | "files";
  current: Row[];
  history: Row[];
  subs: Folder[];
};

type Dec = Entry & { kind: "decision" };
const isCurrent = (e: Dec) => current(e.d);
const byDate = (a: Entry, b: Entry) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title);

// Stories in date order, each followed by the details that realize it; details whose story is elsewhere go last.
function arrange(decs: Dec[], all: Dec[]): Row[] {
  const stories = decs.filter((e) => e.d.level === "story").sort(byDate);
  const details = decs.filter((e) => e.d.level === "detail").sort(byDate);
  const placed = new Set<string>();
  const rows: Row[] = [];
  for (const s of stories) {
    rows.push({ entry: s, nested: false });
    for (const d of details)
      if (!placed.has(d.key) && d.d.realizes.includes(s.d.id)) {
        rows.push({ entry: d, nested: true });
        placed.add(d.key);
      }
  }
  for (const d of details) {
    if (placed.has(d.key)) continue;
    const story = all.find((x) => x.d.level === "story" && d.d.realizes.includes(x.d.id));
    rows.push({ entry: d, nested: false, note: story ? `part of “${story.title}”` : "not linked to a story" });
  }
  return rows;
}

function historyRows(decs: Dec[], all: Dec[]): Row[] {
  return decs.sort(byDate).map((e) => {
    const by = e.d.supersededBy.map((id) => all.find((x) => x.d.id === id)?.title).filter(Boolean);
    return { entry: e, nested: false, note: by.length ? `replaced by “${by[0]}”` : undefined };
  });
}

function folderFor(key: string, name: string, kind: Folder["kind"], decs: Dec[], all: Dec[]): Folder {
  return {
    key,
    name,
    kind,
    current: arrange(decs.filter(isCurrent), all),
    history: historyRows(decs.filter((e) => !isCurrent(e)), all),
    subs: [],
  };
}

export function buildTree(entries: Entry[], allInProject: Entry[]): Folder[] {
  const all = allInProject.filter((e): e is Dec => e.kind === "decision");
  const decs = entries.filter((e): e is Dec => e.kind === "decision");
  const files = entries.filter((e) => e.kind === "file");

  const tops = new Map<string, Dec[]>();
  for (const e of decs) {
    const top = e.d.system.split("/")[0];
    tops.set(top, [...(tops.get(top) ?? []), e]);
  }
  const folders: Folder[] = [];
  for (const [top, items] of [...tops.entries()].filter(([t]) => t).sort(([a], [b]) => a.localeCompare(b))) {
    const direct = items.filter((e) => !e.d.system.includes("/"));
    const f = folderFor("sys:" + top, top, "system", direct, all);
    const subs = new Map<string, Dec[]>();
    for (const e of items.filter((e) => e.d.system.includes("/"))) subs.set(e.d.system, [...(subs.get(e.d.system) ?? []), e]);
    f.subs = [...subs.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([sys, list]) => folderFor("sys:" + sys, sys.split("/")[1], "system", list, all));
    folders.push(f);
  }
  const unsorted = tops.get("");
  if (unsorted?.length) folders.push(folderFor("unsorted", "Unsorted", "unsorted", unsorted, all));
  if (files.length)
    folders.push({
      key: "files",
      name: "Diagram files",
      kind: "files",
      current: files.sort((a, b) => (b.kind === "file" && a.kind === "file" ? b.f.mod - a.f.mod : 0)).map((entry) => ({ entry, nested: false })),
      history: [],
      subs: [],
    });
  return folders;
}

// Everything in a folder, including its sub-folders.
export function folderEntries(f: Folder): Entry[] {
  return [...f.current, ...f.history, ...f.subs.flatMap((s) => [...s.current, ...s.history])].map((r) => r.entry);
}
