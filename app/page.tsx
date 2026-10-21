"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Catalog } from "@/components/Catalog";
import { FoldersPanel } from "@/components/FoldersPanel";
import { GitHubSection } from "@/components/GitHubSection";
import { ProjectView } from "@/components/ProjectView";
import { Diagram, Folder, GitHub, Refresh } from "@/components/icons";
import { useGitHub } from "@/lib/account";
import { summarizeProjects, useWorkspace } from "@/lib/workspace";

// The URL hash holds where you are: "#project=<root>&entry=<file>". Empty hash = the project list.
// view "graph" shows the project's decision graph instead of its overview (only when no entry is open).
type Route = { project: string | null; entry: string | null; view?: "graph" };
function readRoute(): Route {
  const h = location.hash.slice(1);
  if (!h) return { project: null, entry: null };
  if (!h.includes("=")) return { project: null, entry: decodeURIComponent(h) }; // links from before projects existed
  const p = new URLSearchParams(h);
  return { project: p.get("project"), entry: p.get("entry"), view: p.get("view") === "graph" ? "graph" : undefined };
}
function writeRoute(r: Route, push: boolean) {
  const p = new URLSearchParams();
  if (r.project) p.set("project", r.project);
  if (r.entry) p.set("entry", r.entry);
  else if (r.view) p.set("view", r.view);
  const url = p.toString() ? "#" + p.toString() : location.pathname;
  if (push) history.pushState(null, "", url);
  else history.replaceState(null, "", url);
}

export default function Home() {
  const ws = useWorkspace();
  const gh = useGitHub();
  const [route, setRoute] = useState<Route>({ project: null, entry: null });
  const [foldersOpen, setFoldersOpen] = useState(false);

  useEffect(() => {
    const sync = () => setRoute(readRoute());
    sync();
    addEventListener("popstate", sync);
    addEventListener("hashchange", sync);
    return () => {
      removeEventListener("popstate", sync);
      removeEventListener("hashchange", sync);
    };
  }, []);

  const projects = useMemo(() => summarizeProjects(ws.entries, ws.saved), [ws.entries, ws.saved]);
  // An old-style link names only the file; find its project once the scan has it.
  const projectRoot = route.project ?? (route.entry ? ws.entries.find((e) => e.key === route.entry)?.projectRoot ?? null : null);
  const project = projects.find((p) => p.root === projectRoot) ?? null;

  // Changing project adds a history step (Back returns to the list); picking an item inside it does not.
  const goHome = useCallback(() => {
    writeRoute({ project: null, entry: null }, true);
    setRoute({ project: null, entry: null });
  }, []);
  const goProject = useCallback((root: string, entry: string | null = null) => {
    writeRoute({ project: root, entry }, true);
    setRoute({ project: root, entry });
  }, []);
  const openEntry = useCallback(
    (key: string) => {
      const root = ws.entries.find((e) => e.key === key)?.projectRoot ?? projectRoot;
      const r = { project: root, entry: key };
      writeRoute(r, root !== projectRoot);
      setRoute(r);
    },
    [ws.entries, projectRoot],
  );

  // The current project's overview, or its graph. Replaces the history step: it is a tab, not a new place.
  const showProject = useCallback(
    (view?: "graph") => {
      if (!projectRoot) return;
      const r: Route = { project: projectRoot, entry: null, view };
      writeRoute(r, false);
      setRoute(r);
    },
    [projectRoot],
  );

  const needsFolders = ws.loaded && ws.saved.length === 0;
  const lost = projectRoot && !project && !ws.scanning && ws.loaded;

  return (
    <div className="app">
      <header className="top">
        <button className="brand" onClick={goHome} title="All projects"><Diagram /> datlas</button>
        {project ? (
          <nav className="crumbs" aria-label="Breadcrumb">
            <button onClick={goHome}>Projects</button>
            <span aria-hidden="true">/</span>
            <button className="crumb-here" title="This project's systems" onClick={() => showProject()}>{project.name}</button>
            <span className="muted small">{project.where}</span>
          </nav>
        ) : (
          <span className="muted small">
            {projects.length} project{projects.length === 1 ? "" : "s"} · {ws.decisions.length} decision{ws.decisions.length === 1 ? "" : "s"} · {ws.diagrams.length} diagram file{ws.diagrams.length === 1 ? "" : "s"}
          </span>
        )}
        <span className="grow" />
        <button className="icon" onClick={ws.rescan} aria-label="Rescan folders" title="Rescan folders"><Refresh /></button>
        <button className="btn" onClick={() => setFoldersOpen(true)}><Folder /> Folders</button>
        {gh.state.status === "out" && <a className="btn" href="/api/auth/login"><GitHub /> Log in with GitHub</a>}
        {gh.state.status === "in" && (
          <span className="account">
            <span className="muted small">@{gh.state.login}</span>
            <button className="btn" onClick={gh.logout}>Log out</button>
          </span>
        )}
      </header>

      {needsFolders ? (
        <main className="onboard">
          <h1>See your architecture decisions in one place</h1>
          <GitHubSection state={gh.state} />
          <h2>Folders on this computer</h2>
          <p className="muted">Pick the folders that hold your projects. datlas finds decisions in each project&apos;s <code>.datlas/</code> folder and any <code>.d2</code> or <code>.mmd</code> diagram files.</p>
          <FoldersPanel ws={ws} intro={false} />
        </main>
      ) : project ? (
        <ProjectView
          project={project}
          all={ws.entries}
          problems={ws.problems}
          selected={route.entry}
          onOpen={openEntry}
          view={route.view}
          onView={showProject}
        />
      ) : lost ? (
        <main className="catalog">
          <p className="muted">That project isn&apos;t in your folders any more.</p>
          <p><button className="btn" onClick={goHome}>Back to projects</button></p>
        </main>
      ) : projectRoot ? (
        <main className="catalog"><p className="muted">Scanning…</p></main>
      ) : (
        <Catalog projects={projects} scanning={ws.scanning} onProject={(root) => goProject(root)} onEntry={(root, key) => goProject(root, key)}>
          <GitHubSection state={gh.state} />
        </Catalog>
      )}

      {foldersOpen && (
        <div className="sheet-backdrop" onClick={() => setFoldersOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Folders">
            <FoldersPanel ws={ws} onClose={() => setFoldersOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
