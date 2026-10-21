"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GitHubState } from "./account";
import { allCopies, deleteCopy, type RepoCopy } from "./copy";
import { repoRoot } from "./repoKey";
import { parseCopy, syncRepo } from "./sync";
import type { Problem } from "./types";
import type { Entry } from "./workspace";

export type RepoSync = { syncing: boolean; error: string | null };

// GitHub repos as entries, from the browser's copy. Logged in: every installed repo is synced on load and
// whenever the repo list is fetched again (tab regains focus). Logged out: copies read through the login are
// deleted, so an expired login doesn't leave private decisions readable.
export function useGitHubData(state: GitHubState) {
  const [copies, setCopies] = useState<Record<string, RepoCopy>>({});
  const [sync, setSync] = useState<Record<string, RepoSync>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    allCopies().then((list) => {
      setCopies(Object.fromEntries(list.map((c) => [c.root, c])));
      setLoaded(true);
    });
  }, []);

  const syncOne = useCallback(async (owner: string, repo: string, via: RepoCopy["via"] = "installation") => {
    const root = repoRoot(owner, repo);
    setSync((s) => ({ ...s, [root]: { syncing: true, error: s[root]?.error ?? null } }));
    try {
      const c = await syncRepo(owner, repo, via);
      setCopies((x) => ({ ...x, [root]: c }));
      setSync((s) => ({ ...s, [root]: { syncing: false, error: null } }));
    } catch (e) {
      setSync((s) => ({ ...s, [root]: { syncing: false, error: e instanceof Error ? e.message : String(e) } }));
    }
  }, []);

  const drop = useCallback((roots: string[]) => {
    if (!roots.length) return;
    roots.forEach((r) => deleteCopy(r));
    setCopies((x) => Object.fromEntries(Object.entries(x).filter(([r]) => !roots.includes(r))));
  }, []);

  const repos = state.status === "in" ? state.repos : null;
  useEffect(() => {
    if (!loaded || state.status === "loading") return;
    const viaLogin = Object.values(copies).filter((c) => c.via === "installation").map((c) => c.root);
    if (state.status === "out") return drop(viaLogin);
    if (!repos) return;
    const allowed = new Set(repos.map((r) => repoRoot(r.owner, r.repo)));
    drop(viaLogin.filter((r) => !allowed.has(r))); // deselected on GitHub since the last visit
    for (const r of repos) syncOne(r.owner, r.repo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, state.status, repos, syncOne, drop]);

  const parsed = useMemo(() => Object.values(copies).map((c) => parseCopy(c)), [copies]);
  const entries: Entry[] = useMemo(
    () => parsed.flatMap((p) => p.decisions.map((d): Entry => ({ kind: "decision", key: d.path, title: d.title, date: d.date, tags: d.tags, project: d.project, projectRoot: d.projectRoot, d }))),
    [parsed],
  );
  const problems: Problem[] = useMemo(() => parsed.flatMap((p) => p.problems), [parsed]);

  return { loaded, copies, sync, entries, problems, syncOne };
}
export type GitHubData = ReturnType<typeof useGitHubData>;
