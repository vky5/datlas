"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Card, StatusBar } from "./Card";
import { EntryRow, describe } from "./EntryRow";
import { Search } from "./icons";
import { ago, plural, type Entry, type Project } from "@/lib/workspace";

// First screen: one card per project that has something in it, plus search across every project.
export function Catalog({ projects, scanning, onProject, onEntry, children }: {
  projects: Project[];
  scanning: boolean;
  onProject: (root: string) => void;
  onEntry: (root: string, key: string) => void;
  children?: ReactNode; // shown under the local projects (the GitHub section)
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
        <p className="muted">{scanning ? "Scanning your folders…" : "No decisions or diagram files found in your folders yet. Decisions live in a project's .datlas/ folder."}</p>
      )}

      {shownProjects.length > 0 && (
        <div className="cards">
          {shownProjects.map((p) => {
            const systems = new Set(p.entries.flatMap((e) => (e.kind === "decision" ? [e.d.system.split("/")[0] || "unsorted"] : []))).size;
            return (
              <Card key={p.root} title={p.name} hint={p.root} aside={<span className="muted small">{ago(p.lastMod)}</span>} onClick={() => onProject(p.root)}>
                <span className="card-where">{p.where}</span>
                <span className="card-counts">
                  {p.decisions > 0 && <span>{plural(systems, "system")}</span>}
                  {p.decisions > 0 && <span>{plural(p.decisions, "decision")}</span>}
                  {p.files > 0 && <span>{plural(p.files, "diagram file")}</span>}
                </span>
                {p.decisions > 0 && <StatusBar counts={p.status} />}
                {p.latest && (
                  <span className="card-latest"><span className="muted">Latest:</span> {p.latest.title}</span>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {needle && shownProjects.length === 0 && hits.length === 0 && <p className="muted">Nothing matches “{q}”.</p>}

      {hits.length > 0 && (
        <section className="hits">
          <h2>Decisions and diagrams matching “{q}”</h2>
          <ul>
            {hits.map(({ p, e }) => (
              <li key={e.key}>
                <EntryRow
                  entry={e}
                  sub={`${p.name} · ${describe(e)}`}
                  aside={e.kind === "decision" ? e.d.system || "unsorted" : undefined}
                  onOpen={(key) => onEntry(p.root, key)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      {!needle && children}
    </main>
  );
}
