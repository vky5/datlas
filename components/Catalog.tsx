"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { Folder, Search } from "./icons";
import { ago, effectiveStatus, type Entry, type Project } from "@/lib/workspace";

// First screen: one card per project that has something in it, plus search across every project.
export function Catalog({ projects, scanning, onProject, onEntry }: {
  projects: Project[];
  scanning: boolean;
  onProject: (root: string) => void;
  onEntry: (root: string, key: string) => void;
}) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "/" && !(ev.target instanceof HTMLInputElement)) {
        ev.preventDefault();
        ref.current?.focus();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const needle = q.trim().toLowerCase();
  const shownProjects = needle ? projects.filter((p) => `${p.name} ${p.where}`.toLowerCase().includes(needle)) : projects;
  const hits = useMemo(() => {
    if (!needle) return [];
    const out: { p: Project; e: Entry }[] = [];
    for (const p of projects)
      for (const e of p.entries)
        if (`${e.title} ${e.tags.join(" ")}`.toLowerCase().includes(needle)) out.push({ p, e });
    return out.slice(0, 50);
  }, [projects, needle]);

  return (
    <main className="catalog">
      <div className="catalog-head">
        <h1>Projects</h1>
        <label className="search wide">
          <Search />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects and decisions" aria-label="Search projects and decisions" />
        </label>
      </div>

      {projects.length === 0 && (
        <p className="muted">{scanning ? "Scanning your folders…" : "No decisions or diagram files found in your folders yet. Decisions live in a project's .atlas/ folder."}</p>
      )}

      {shownProjects.length > 0 && (
        <div className="cards">
          {shownProjects.map((p) => (
            <button key={p.root} className="card-btn" onClick={() => onProject(p.root)} title={p.root}>
              <span className="card-top">
                <Folder />
                <b>{p.name}</b>
                <span className="muted small">{ago(p.lastMod)}</span>
              </span>
              <span className="card-where">{p.where}</span>
              <span className="card-counts">
                {p.decisions > 0 && <span>{p.decisions} decision{p.decisions === 1 ? "" : "s"}</span>}
                {p.files > 0 && <span>{p.files} diagram file{p.files === 1 ? "" : "s"}</span>}
              </span>
              {p.decisions > 0 && (
                <span className="status-bar" aria-hidden="true">
                  {(["accepted", "proposed", "rejected", "superseded"] as const).map((s) =>
                    p.status[s] ? <i key={s} className={s} style={{ flex: p.status[s] }} /> : null,
                  )}
                </span>
              )}
              {p.latest && (
                <span className="card-latest">
                  <span className="muted">Latest:</span> {p.latest.title}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {needle && shownProjects.length === 0 && hits.length === 0 && <p className="muted">Nothing matches “{q}”.</p>}

      {hits.length > 0 && (
        <section className="hits">
          <h2>Decisions and diagrams matching “{q}”</h2>
          <ul>
            {hits.map(({ p, e }) => {
              const st = e.kind === "decision" ? effectiveStatus(e.d) : null;
              return (
                <li key={e.key}>
                  <button className="row" onClick={() => onEntry(p.root, e.key)}>
                    {e.kind === "decision" ? <span className={"seq " + st}>{e.d.seq}</span> : <span className="seq file">·</span>}
                    <span className="row-main">
                      <span className="row-title">{e.title}</span>
                      <span className="row-sub">{p.name} · {e.kind === "decision" ? `${e.d.level === "story" ? "Story" : "Detail"} · ${st}` : "diagram file"}</span>
                    </span>
                    <span className="row-date">{e.date}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
