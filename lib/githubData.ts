"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GitHubState } from "./account";
import { allCopies, deleteCopy, type RepoCopy } from "./copy";
import { repoRoot } from "./repoKey";
import { GitHubError } from "./github";
import { parseCopy, syncRepo } from "./sync";
import type { Problem } from "./types";
import type { Entry } from "./workspace";

// limited: the error was GitHub's rate limit, so it stops mattering once the pause ends.
export type RepoSync = { syncing: boolean; error: string | null; limited?: boolean };

// Automatic syncs (on load, on returning to the tab, on opening a repo) skip a repo checked this recently.
// The Sync button always checks.
const MIN_GAP_MS = 60_000;

// GitHub repos as entries, from the browser's copy. Logged in: every installed repo is synced on load and
// whenever the repo list is fetched again (tab regains focus). Logged out: copies read through the login are
// deleted, so an expired login doesn't leave private decisions readable.
export function useGitHubData(state: GitHubState, onSignedOut: () => void) {
  const [copies, setCopies] = useState<Record<string, RepoCopy>>({});
  const [sync, setSync] = useState<Record<string, RepoSync>>({});
  const [loaded, setLoaded] = useState(false);
  // GitHub's limit is per token (the installation's, or a visitor's 60 an hour), so a pause covers every repo read that way.
  const [pausedUntil, setPausedUntil] = useState<Record<RepoCopy["via"], number>>({ installation: 0, public: 0 });
  const checked = useRef(new Map<string, number>());

  useEffect(() => {
    allCopies().then((list) => {
      setCopies(Object.fromEntries(list.map((c) => [c.root, c])));
      setLoaded(true);
    });
  }, []);

  const pausedRef = useRef(pausedUntil);
  pausedRef.current = pausedUntil;

  // A pause is cleared (set to 0) when it ends, so rendering only checks "> 0" and never reads the clock;
  // Next pre-renders this page at build time and refuses Date.now() there.
  useEffect(() => {
    const next = Math.min(...Object.values(pausedUntil).filter((t) => t > 0));
    if (!Number.isFinite(next)) return;
    const t = setTimeout(() => setPausedUntil((p) => ({ installation: p.installation > Date.now() ? p.installation : 0, public: p.public > Date.now() ? p.public : 0 })), Math.max(0, next - Date.now()) + 500);
    return () => clearTimeout(t);
  }, [pausedUntil]);

  const syncOne = useCallback(
    async (owner: string, repo: string, via: RepoCopy["via"] = "installation", force = false) => {
      const root = repoRoot(owner, repo);
      const now = Date.now();
      if (pausedRef.current[via] > now) return;
      if (!force && now - (checked.current.get(root) ?? 0) < MIN_GAP_MS) return;
      checked.current.set(root, now);
      setSync((s) => ({ ...s, [root]: { syncing: true, error: s[root]?.error ?? null } }));
      try {
        const c = await syncRepo(owner, repo, via);
        setCopies((x) => ({ ...x, [root]: c }));
        setSync((s) => ({ ...s, [root]: { syncing: false, error: null } }));
      } catch (e) {
        if (e instanceof GitHubError && e.kind === "rate-limited") {
          // Without a reset time from GitHub, wait a minute before trying again.
          setPausedUntil((p) => ({ ...p, [via]: e.resetAt?.getTime() ?? Date.now() + 60_000 }));
        }
        // The server answers 401 when the login expired or the App was removed; the account state must follow.
        if (e instanceof GitHubError && e.kind === "unauthorized" && via === "installation") onSignedOut();
        const limited = e instanceof GitHubError && e.kind === "rate-limited";
        setSync((s) => ({ ...s, [root]: { syncing: false, error: e instanceof Error ? e.message : String(e), limited } }));
      }
    },
    [onSignedOut],
  );

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

  return { loaded, copies, sync, entries, problems, syncOne, pausedUntil };
}
export type GitHubData = ReturnType<typeof useGitHubData>;
