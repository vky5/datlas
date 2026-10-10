"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EntryView, loadEntry } from "./EntryView";
import { Search } from "./icons";
import { base, effectiveStatus, type Entry, type Project } from "@/lib/workspace";
import type { Problem } from "@/lib/types";

// One project: its list (search and tags scoped to this project) and the reading pane.
export function ProjectView({ project, all, problems, selected, onOpen }: {
  project: Project;
  all: Entry[];
  problems: Problem[];
  selected: string | null;
  onOpen: (key: string) => void;
}) {
  const [tag, setTag] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [showProblems, setShowProblems] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef<HTMLElement>(null);

  // Filters belong to one project; start clean when switching.
  useEffect(() => {
    setTag(null);
    setQ("");
    setShowProblems(false);
  }, [project.root]);

  const tags = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of project.entries) for (const t of e.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [project.entries]);

  // Decisions in the order they were made (#1 first); loose diagram files after, newest first.
  const shown = useMemo(
    () =>
      project.entries
        .filter(
          (e) =>
            (!tag || e.tags.includes(tag)) &&
            (!q || `${e.title} ${e.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase())),
        )
        .sort((a, b) =>
          a.kind === "decision" && b.kind === "decision" ? a.d.seq - b.d.seq
          : a.kind === "decision" ? -1
          : b.kind === "decision" ? 1
          : b.f.mod - a.f.mod,
        ),
    [project.entries, tag, q],
  );
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
      if (!step || shown.length === 0) return;
      ev.preventDefault();
      const i = shown.findIndex((e) => e.key === selected);
      onOpen(shown[Math.max(0, Math.min(shown.length - 1, i < 0 ? 0 : i + step))].key);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [shown, selected, onOpen]);

  return (
    <div className="body">
      <aside className="list">
        <label className="search">
          <Search />
          <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${project.name}`} aria-label={`Search ${project.name}`} />
        </label>
        {tags.length > 0 && (
          <div className="tags">
            {tags.map(([t, n]) => (
              <button key={t} className={"tag" + (tag === t ? " on" : "")} onClick={() => setTag(tag === t ? null : t)}>
                #{t} <span>{n}</span>
              </button>
            ))}
          </div>
        )}
        {shown.length === 0 ? (
          <p className="muted pad">Nothing matches.</p>
        ) : (
          <ul className="timeline flat">
            {shown.map((e) => {
              const st = e.kind === "decision" ? effectiveStatus(e.d) : null;
              return (
                <li key={e.key}>
                  <button data-key={e.key} className={"row" + (e.key === selected ? " on" : "")} onClick={() => onOpen(e.key)} onMouseEnter={() => loadEntry(e)}>
                    {e.kind === "decision" ? <span className={"seq " + st} title={`#${e.d.seq} · ${st}`}>{e.d.seq}</span> : <span className="seq file" title="diagram file">·</span>}
                    <span className="row-main">
                      <span className="row-title">{e.title}</span>
                      <span className="row-sub">{e.kind === "decision" ? (e.d.level === "story" ? "Story" : "Detail") : `${e.f.format === "d2" ? "D2" : "Mermaid"} file`}</span>
                    </span>
                    <span className="row-date">{new Date(e.date.slice(0, 10) + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {projectProblems.length > 0 && (
          <div className={"problems" + (errors ? " has-errors" : "")}>
            <button onClick={() => setShowProblems((v) => !v)} aria-expanded={showProblems}>
              ⚠ {projectProblems.length} note{projectProblems.length === 1 ? "" : "s"} about these files {showProblems ? "▴" : "▾"}
            </button>
            {showProblems && (
              <ul>
                {projectProblems.map((p, i) => (
                  <li key={i} className={p.severity}>
                    {p.message}
                    <small>.atlas/{base(p.path)}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </aside>

      <main className="view" ref={viewRef}>
        {current ? (
          <EntryView entry={current} all={all} onOpen={onOpen} onTag={(t) => setTag(t)} />
        ) : (
          <div className="placeholder muted">
            <div>
              <p>Pick something on the left, or press <kbd>↓</kbd>.</p>
              <p className="small">Decisions are numbered in the order they were made.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
