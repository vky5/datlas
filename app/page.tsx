"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Catalog } from "@/components/Catalog";
import { FoldersPanel } from "@/components/FoldersPanel";
import { GitHubSection } from "@/components/GitHubSection";
import { ProjectView } from "@/components/ProjectView";
import { Diagram, Folder, GitHub, Refresh } from "@/components/icons";
import { useGitHub } from "@/lib/account";
import { ago, summarizeProjects, useWorkspace } from "@/lib/workspace";
import { useGitHubData } from "@/lib/githubData";
import { isGitHubKey, parseKey } from "@/lib/repoKey";

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
  const ghData = useGitHubData(gh.state, gh.refresh);
  const entries = useMemo(() => [...ws.entries, ...ghData.entries], [ws.entries, ghData.entries]);
  const problems = useMemo(() => [...ws.problems, ...ghData.problems], [ws.problems, ghData.problems]);
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

  const projects = useMemo(() => summarizeProjects(entries, ws.saved), [entries, ws.saved]);
  // An old-style link names only the file; find its project once the scan has it.
  const projectRoot = route.project ?? (route.entry ? entries.find((e) => e.key === route.entry)?.projectRoot ?? null : null);
  const project = projects.find((p) => p.root === projectRoot) ?? null;

  // A GitHub project is synced every time it is opened: one call when nothing changed.
  const ghRoot = projectRoot && isGitHubKey(projectRoot) ? projectRoot : null;
  const ghCopy = ghRoot ? ghData.copies[ghRoot] : undefined;
  const ghSync = ghRoot ? ghData.sync[ghRoot] : undefined;
  const ghVia = ghRoot ? ghData.copies[ghRoot]?.via ?? "installation" : "installation";
  const ghPaused = ghData.pausedUntil[ghVia] > 0 ? new Date(ghData.pausedUntil[ghVia]) : null;
  const syncOpen = useCallback(
    (force = false) => {
      const k = ghRoot && parseKey(ghRoot);
      if (k) ghData.syncOne(k.owner, k.repo, ghVia, force);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ghRoot, ghVia, ghData.syncOne],
  );
  useEffect(() => {
    if (ghData.loaded) syncOpen();
  }, [ghData.loaded, syncOpen]);

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
      const root = entries.find((e) => e.key === key)?.projectRoot ?? projectRoot;
      const r = { project: root, entry: key };
      writeRoute(r, root !== projectRoot);
      setRoute(r);
    },
    [entries, projectRoot],
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

  // First run: no folders saved. A GitHub project can still be open, so that wins.
  const needsFolders = ws.loaded && ws.saved.length === 0 && !projectRoot;
  const lost = projectRoot && !ghRoot && !project && !ws.scanning && ws.loaded;

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
            {ghRoot && (
              <>
                <span className="muted small">{ghSync?.syncing ? "syncing…" : ghCopy ? `synced ${ago(ghCopy.syncedAt)}` : ""}</span>
                {ghSync?.error && !ghSync.limited && <span className="error-text small">{ghSync.error}</span>}
                {ghPaused && <span className="warn-text small">GitHub rate limit reached; sync resumes at {ghPaused.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
                <button className="icon" onClick={() => syncOpen(true)} disabled={ghSync?.syncing || !!ghPaused} aria-label="Sync from GitHub" title={ghPaused ? "Paused until GitHub's rate limit refills" : "Sync from GitHub"}><Refresh /></button>
              </>
            )}
          </nav>
        ) : (
          <span className="muted small">
            {projects.length} project{projects.length === 1 ? "" : "s"} · {ws.decisions.length + ghData.entries.length} decision{ws.decisions.length + ghData.entries.length === 1 ? "" : "s"} · {ws.diagrams.length} diagram file{ws.diagrams.length === 1 ? "" : "s"}
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
          <GitHubSection state={gh.state} data={ghData} projects={projects} onOpen={(root) => goProject(root)} />
          <h2>Folders on this computer</h2>
          <p className="muted">Pick the folders that hold your projects. datlas finds decisions in each project&apos;s <code>.datlas/</code> folder and any <code>.d2</code> or <code>.mmd</code> diagram files.</p>
          <FoldersPanel ws={ws} intro={false} />
        </main>
      ) : project ? (
        <ProjectView
          project={project}
          all={entries}
          problems={problems}
          selected={route.entry}
          onOpen={openEntry}
          view={route.view}
          onView={showProject}
        />
      ) : ghRoot ? (
        <main className="catalog">
          {ghSync?.error ? (
            <p className="error-text">{ghSync.error}</p>
          ) : ghCopy && !ghSync?.syncing ? (
            <p className="muted">{parseKey(ghRoot)!.owner}/{parseKey(ghRoot)!.repo} has no decisions in a .datlas/ folder at its root.</p>
          ) : (
            <p className="muted">Syncing {parseKey(ghRoot)!.owner}/{parseKey(ghRoot)!.repo}…</p>
          )}
          <p><button className="btn" onClick={goHome}>Back to projects</button></p>
        </main>
      ) : lost ? (
        <main className="catalog">
          <p className="muted">That project isn&apos;t in your folders any more.</p>
          <p><button className="btn" onClick={goHome}>Back to projects</button></p>
        </main>
      ) : projectRoot ? (
        <main className="catalog"><p className="muted">Scanning…</p></main>
      ) : (
        <Catalog projects={projects} scanning={ws.scanning} onProject={(root) => goProject(root)} onEntry={(root, key) => goProject(root, key)}>
          <GitHubSection state={gh.state} data={ghData} projects={projects} onOpen={(root) => goProject(root)} />
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
