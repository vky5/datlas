"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { EntryRow, describe } from "./EntryRow";
import { EntryView } from "./EntryView";
import { GraphView } from "./GraphView";
import { Overview } from "./Overview";
import { Chevron, Search } from "./icons";
import { base, plural, type Entry, type Project } from "@/lib/workspace";
import { buildTree, type Folder } from "@/lib/tree";
import type { Problem } from "@/lib/types";

// The keys of a folder and its parent that hold the given entry, so selecting something can open its path.
function pathTo(folders: Folder[], key: string): string[] {
  for (const f of folders) {
    if ([...f.current, ...f.history].some((r) => r.entry.key === key)) return [f.key];
    const inner = pathTo(f.subs, key);
    if (inner.length) return [f.key, ...inner];
  }
  return [];
}

// One project: a tree of systems on the left, the overview or one decision on the right.
export function ProjectView({ project, all, problems, selected, view, onOpen, onView }: {
  project: Project;
  all: Entry[];
  problems: Problem[];
  selected: string | null;
  view?: "graph";
  onOpen: (key: string) => void;
  onView: (view?: "graph") => void;
}) {
  const [tag, setTag] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Set<string>>(new Set());
  const [showProblems, setShowProblems] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef<HTMLElement>(null);
  const storeKey = "open:" + project.root;

  // Which folders are open is remembered per project in this browser. Everything starts closed: the closed tree is the index.
  useEffect(() => {
    setTag(null);
    setQ("");
    setShowProblems(false);
    setHistory(new Set());
    try {
      setOpen(new Set(JSON.parse(localStorage.getItem(storeKey) ?? "[]")));
    } catch {
      setOpen(new Set());
    }
  }, [storeKey]);
  const updateOpen = useCallback(
    (fn: (prev: Set<string>) => Set<string>) =>
      setOpen((prev) => {
        const next = fn(prev);
        try {
          localStorage.setItem(storeKey, JSON.stringify([...next]));
        } catch {}
        return next;
      }),
    [storeKey],
  );
  const toggle = (key: string) =>
    updateOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleHistory = (key: string) =>
    setHistory((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const tags = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of project.entries) for (const t of e.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [project.entries]);

  // "#config" in the search box filters by tag (prefix match); other words match titles and system names.
  const typedTag = q.trim().startsWith("#") ? q.trim().slice(1).toLowerCase() : null;
  const activeTag = typedTag ?? tag;
  const words = typedTag !== null ? "" : q.trim().toLowerCase();
  const filtering = !!activeTag || !!words;
  const matches = useMemo(
    () =>
      project.entries.filter(
        (e) =>
          (!activeTag || e.tags.some((t) => (typedTag !== null ? t.startsWith(activeTag) : t === activeTag))) &&
          (!words || `${e.title} ${e.kind === "decision" ? e.d.system : ""}`.toLowerCase().includes(words)),
      ),
    [project.entries, activeTag, typedTag, words],
  );
  const folders = useMemo(() => buildTree(matches, project.entries), [matches, project.entries]);
  const fullTree = useMemo(() => buildTree(project.entries, project.entries), [project.entries]);

  // Selecting something opens the folders on its path once. After that, the folder toggle is yours.
  useEffect(() => {
    if (!selected) return;
    const keys = pathTo(fullTree, selected);
    if (keys.some((k) => !open.has(k))) updateOpen((prev) => new Set([...prev, ...keys]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, fullTree]);

  // While filtering, every folder with a match is open and history is included, so results are never hidden.
  const isOpen = (f: Folder) => filtering || open.has(f.key);
  const showsHistory = (f: Folder) => filtering || history.has(f.key);

  // Rows in screen order, for ↑/↓.
  const visible = useMemo(() => {
    const out: Entry[] = [];
    const walk = (f: Folder) => {
      if (!isOpen(f)) return;
      out.push(...f.current.map((r) => r.entry));
      f.subs.forEach(walk);
      if (showsHistory(f)) out.push(...f.history.map((r) => r.entry));
    };
    folders.forEach(walk);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders, open, history, filtering]);

  const projectProblems = problems.filter((p) => p.path.startsWith(project.root + "/"));
  const errors = projectProblems.filter((p) => p.severity === "error").length;
  const current = project.entries.find((e) => e.key === selected) ?? null;

  useEffect(() => {
    viewRef.current?.scrollTo({ top: 0 });
    if (selected) document.querySelector(`[data-key="${CSS.escape(selected)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  // Keyboard: ↑/↓ or j/k move through the list, / jumps to search, Esc leaves it.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey || document.querySelector(".sheet")) return;
      const typing = ev.target instanceof HTMLInputElement;
      if (typing) {
        if (ev.key === "Escape") (ev.target as HTMLInputElement).blur();
        if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
      }
      if (ev.key === "/") {
        ev.preventDefault();
        searchRef.current?.focus();
        return;
      }
      const step = ev.key === "ArrowDown" || ev.key === "j" ? 1 : ev.key === "ArrowUp" || ev.key === "k" ? -1 : 0;
      if (!step || visible.length === 0) return;
      ev.preventDefault();
      const i = visible.findIndex((e) => e.key === selected);
      onOpen(visible[Math.max(0, Math.min(visible.length - 1, i < 0 ? 0 : i + step))].key);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [visible, selected, onOpen]);

  // From the overview: open that system and show its first decision.
  const openFolder = (f: Folder) => {
    updateOpen((prev) => new Set(prev).add(f.key));
    const first = f.current[0] ?? f.subs[0]?.current[0] ?? f.history[0];
    if (first) onOpen(first.entry.key);
  };

  const renderFolder = (f: Folder, sub = false) => {
    const opened = isOpen(f);
    const total = f.current.length + f.subs.reduce((n, s) => n + s.current.length, 0);
    const rows = (list: Folder["current"]) => (
      <ul className="rows">
        {list.map((r) => (
          <li key={r.entry.key}>
            <EntryRow entry={r.entry} sub={describe(r.entry) + (r.note ? ` · ${r.note}` : "")} nested={r.nested} selected={r.entry.key === selected} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    );
    return (
      <section key={f.key} className={"folder" + (sub ? " sub" : "") + (opened ? "" : " closed") + (f.kind !== "system" ? " quiet" : "")} style={{ "--hue": f.hue } as CSSProperties}>
        <button className="folder-head" onClick={() => toggle(f.key)} aria-expanded={opened} disabled={filtering}>
          <Chevron />
          <span className="swatch" aria-hidden="true" />
          <span className="grow">{f.name}</span>
          <span className="count">{total}</span>
        </button>
        <div className="collapse">
          <div>
            {rows(f.current)}
            {f.subs.map((s) => renderFolder(s, true))}
            {f.history.length > 0 && showsHistory(f) && rows(f.history)}
            {f.history.length > 0 && !filtering && (
              <button className="history-toggle" onClick={() => toggleHistory(f.key)}>
                {showsHistory(f) ? "Hide history" : `Show history (${f.history.length})`}
              </button>
            )}
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="body">
      <aside className="list">
        <div className="views" role="tablist" aria-label="Project view">
          <button role="tab" aria-selected={!current && !view} className={!current && !view ? "on" : ""} onClick={() => onView()}>Overview</button>
          <button role="tab" aria-selected={!current && view === "graph"} className={!current && view === "graph" ? "on" : ""} onClick={() => onView("graph")}>Graph</button>
        </div>
        <label className="search">
          <Search />
          <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${project.name}, or #tag`} aria-label={`Search ${project.name}`} />
        </label>
        {tags.length > 0 && (
          <div className="tags">
            {tags.map(([t, n]) => (
              <button key={t} className={"tag" + (activeTag === t ? " on" : "")} onClick={() => { setQ(""); setTag(tag === t ? null : t); }}>
                #{t} <span>{n}</span>
              </button>
            ))}
          </div>
        )}
        {filtering && (
          <p className="filter-note">
            {plural(matches.length, "match", "matches")}{activeTag ? ` for #${activeTag}` : ""}
            <button onClick={() => { setQ(""); setTag(null); }}>Clear</button>
          </p>
        )}

        <nav className="tree" aria-label="Systems">
          {folders.length === 0 ? <p className="muted pad">Nothing matches.</p> : folders.map((f) => renderFolder(f))}
        </nav>

        {projectProblems.length > 0 && (
          <div className={"problems" + (errors ? " has-errors" : "")}>
            <button onClick={() => setShowProblems((v) => !v)} aria-expanded={showProblems}>
              ⚠ {plural(projectProblems.length, "note")} about these files {showProblems ? "▴" : "▾"}
            </button>
            {showProblems && (
              <ul>
                {projectProblems.map((p, i) => (
                  <li key={i} className={p.severity}>
                    {p.message}
                    <small>.datlas/{base(p.path)}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </aside>

      <main className="view" ref={viewRef}>
        {current ? (
          <EntryView entry={current} all={all} onOpen={onOpen} onTag={(t) => { setQ(""); setTag(t); }} onSystem={() => onView()} />
        ) : view === "graph" ? (
          <GraphView
            project={project}
            tag={activeTag}
            highlight={filtering ? matches.flatMap((e) => (e.kind === "decision" ? [e.d.id] : [])) : null}
            onOpen={onOpen}
          />
        ) : (
          <Overview project={project} folders={fullTree} onFolder={openFolder} />
        )}
      </main>
    </div>
  );
}
