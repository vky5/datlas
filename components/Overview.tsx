"use client";

import { Card, StatusBar } from "./Card";
import { plural, type Entry, type Project } from "@/lib/workspace";
import { countStatus, isCurrent } from "@/lib/status";
import { folderEntries, type Folder } from "@/lib/tree";

// What a project contains, at a glance: one card per system.
export function Overview({ project, folders, onFolder }: { project: Project; folders: Folder[]; onFolder: (f: Folder) => void }) {
  const decisions = project.entries.flatMap((e) => (e.kind === "decision" ? [e.d] : []));
  const current = decisions.filter(isCurrent).length;
  const systems = folders.filter((f) => f.kind === "system").length;

  return (
    <div className="overview fade-in">
      <header>
        <h1>{project.name}</h1>
        <p className="muted">
          {plural(systems, "system")} · {plural(current, "current decision")}
          {decisions.length > current && ` · ${decisions.length - current} in history`}
          {project.files > 0 && ` · ${plural(project.files, "diagram file")}`}
        </p>
      </header>
      <div className="cards">
        {folders.map((f) => {
          const items = folderEntries(f);
          const decs = items.filter((e): e is Entry & { kind: "decision" } => e.kind === "decision");
          const live = decs.filter((e) => isCurrent(e.d));
          const stories = live.filter((e) => e.d.level === "story").length;
          const latest = [...(live.length ? live : items)].sort((a, b) => b.date.localeCompare(a.date))[0];
          return (
            <Card key={f.key} title={f.name} quiet={f.kind !== "system"} color={f.hue} onClick={() => onFolder(f)}>
              <span className="card-counts">
                {f.kind === "files" ? (
                  <span>{plural(items.length, "file")}</span>
                ) : (
                  <>
                    <span>{plural(stories, "story", "stories")}</span>
                    <span>{plural(live.length - stories, "detail")}</span>
                    {decs.length > live.length && <span className="muted">{decs.length - live.length} in history</span>}
                  </>
                )}
              </span>
              {f.subs.length > 0 && <span className="card-where">{f.subs.map((s) => s.name).join(" · ")}</span>}
              {decs.length > 0 && <StatusBar counts={countStatus(decs.map((e) => e.d))} />}
              {latest && <span className="card-latest"><span className="muted">Latest:</span> {latest.title}</span>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
