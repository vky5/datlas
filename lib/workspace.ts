"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LOCAL_FILES } from "./mode";
import { parseKey } from "./repoKey";
import { countStatus, type Status } from "./status";
import type { Decision, DiagramFile, Problem, ScanResult } from "./types";

const STORAGE_KEY = "directories";
const SCAN_CACHE = "scanCache";

function readSaved(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}

export function useWorkspace() {
  const [saved, setSaved] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [scans, setScans] = useState<Record<string, ScanResult>>({});
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (LOCAL_FILES) setSaved(readSaved());
    setLoaded(true);
  }, []);

  const rescan = useCallback(async (dirs: string[]) => {
    if (dirs.length === 0) {
      setScans({});
      return;
    }
    // Show the last scan right away, then replace it with a fresh one.
    const cacheId = JSON.stringify(dirs);
    try {
      const cached = JSON.parse(localStorage.getItem(SCAN_CACHE) ?? "null");
      if (cached?.id === cacheId) setScans((prev) => (Object.keys(prev).length ? prev : cached.scans));
    } catch {}
    setScanning(true);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directories: dirs }),
      });
      const list: ScanResult[] = await res.json();
      const fresh = Object.fromEntries(list.map((s) => [s.path, s]));
      setScans(fresh);
      try {
        const json = JSON.stringify({ id: cacheId, scans: fresh });
        if (json.length < 2_000_000) localStorage.setItem(SCAN_CACHE, json);
        else localStorage.removeItem(SCAN_CACHE);
      } catch {}
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    if (loaded) rescan(saved);
  }, [loaded, saved, rescan]);

  const persist = (next: string[]) => {
    setSaved(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {} // storage blocked: choices still work until reload
  };

  const diagrams: DiagramFile[] = useMemo(
    () => saved.flatMap((d) => scans[d]?.diagrams ?? []).filter((d, i, all) => all.findIndex((x) => x.path === d.path) === i).sort((a, b) => b.mod - a.mod),
    [saved, scans],
  );

  const decisions: Decision[] = useMemo(
    () => saved.flatMap((d) => scans[d]?.decisions ?? []).filter((d, i, all) => all.findIndex((x) => x.path === d.path) === i),
    [saved, scans],
  );
  const problems: Problem[] = useMemo(
    () => saved.flatMap((d) => scans[d]?.problems ?? []).filter((p, i, all) => all.findIndex((x) => x.path === p.path && x.message === p.message) === i),
    [saved, scans],
  );

  // Decisions and loose diagram files, as one list.
  const entries: Entry[] = useMemo(
    () => [
      ...decisions.map((d): Entry => ({ kind: "decision", key: d.path, title: d.title, date: d.date, tags: d.tags, project: d.project, projectRoot: d.projectRoot, d })),
      ...diagrams.map((f): Entry => ({ kind: "file", key: f.path, title: f.name, date: new Date(f.mod).toISOString().slice(0, 10), tags: [], project: f.project, projectRoot: f.projectRoot, f })),
    ],
    [decisions, diagrams],
  );

  return {
    saved, loaded, scans, scanning, diagrams, decisions, problems, entries,
    add: (dir: string) => !saved.includes(dir) && persist([...saved, dir]),
    remove: (dir: string) => persist(saved.filter((d) => d !== dir)),
    rescan: () => rescan(saved),
  };
}
export type Workspace = ReturnType<typeof useWorkspace>;

type EntryBase = { key: string; title: string; date: string; tags: string[]; project: string; projectRoot: string };
export type Entry = (EntryBase & { kind: "decision"; d: Decision }) | (EntryBase & { kind: "file"; f: DiagramFile });

export function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 14) return `${d}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function bytes(n: number): string {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

export const base = (p: string) => p.split("/").filter(Boolean).pop() ?? p;

// plural(3, "story", "stories") -> "3 stories"
export const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export type Project = {
  root: string;
  name: string;
  where: string; // path shown under the name, relative to the saved folder that contains it
  entries: Entry[];
  decisions: number;
  files: number;
  lastMod: number;
  latest: Entry | null; // newest decision, or newest file if there are no decisions
  status: Record<Status, number>;
};

const entryMod = (e: Entry) => (e.kind === "decision" ? e.d.mod : e.f.mod);

// One card per project that actually contains something; newest change first.
export function summarizeProjects(entries: Entry[], saved: string[]): Project[] {
  const m = new Map<string, Entry[]>();
  for (const e of entries) m.set(e.projectRoot, [...(m.get(e.projectRoot) ?? []), e]);
  return [...m.entries()]
    .map(([root, items]) => {
      const container = saved.filter((s) => root === s || root.startsWith(s + "/")).sort((a, b) => b.length - a.length)[0];
      const gh = parseKey(root);
      const where = gh ? `${gh.owner}/${gh.repo}` : container ? (root === container ? base(root) : base(container) + root.slice(container.length)) : root;
      const decs = items.filter((e): e is Entry & { kind: "decision" } => e.kind === "decision");
      const status = countStatus(decs.map((e) => e.d));
      const pool = decs.length ? decs : items;
      const latest = pool.reduce<Entry | null>((a, e) => (!a || entryMod(e) > entryMod(a) ? e : a), null);
      return {
        root,
        name: items[0].project,
        where,
        entries: items,
        decisions: decs.length,
        files: items.length - decs.length,
        lastMod: Math.max(...items.map(entryMod)),
        latest,
        status,
      };
    })
    .sort((a, b) => b.lastMod - a.lastMod);
}
