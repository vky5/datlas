"use client";

import { Card, StatusBar } from "./Card";
import { External, GitHub } from "./icons";
import type { GitHubState } from "@/lib/account";
import type { GitHubData } from "@/lib/githubData";
import { repoRoot } from "@/lib/repoKey";
import { ago, plural, type Project } from "@/lib/workspace";

// The repos the datlas GitHub App may read. Picking repos happens on GitHub's own page; this links there.
export function GitHubSection({ state, data, projects, onOpen }: { state: GitHubState; data: GitHubData; projects: Project[]; onOpen: (root: string) => void }) {
  if (state.status === "loading") return null;
  if (state.status === "out") {
    return (
      <section className="gh">
        <div className="gh-head">
          <h2>GitHub</h2>
        </div>
        <p className="muted">Log in to see the repos you&apos;ve given datlas access to, including private ones.</p>
        <p><a className="btn" href="/api/auth/login"><GitHub /> Log in with GitHub</a></p>
      </section>
    );
  }
  const repos = state.repos ?? [];
  return (
    <section className="gh">
      <div className="gh-head">
        <h2>GitHub</h2>
        <span className="muted small">{plural(repos.length, "repo")} datlas can read</span>
        <span className="grow" />
        <a className="btn" href={`https://github.com/settings/installations/${state.installation}`} target="_blank" rel="noreferrer"><External /> Choose repos</a>
      </div>
      {state.error && <p className="error-text">{state.error}</p>}
      {state.repos && repos.length === 0 && <p className="muted">No repos selected yet. Use “Choose repos” to pick which ones datlas may read.</p>}
      {repos.length > 0 && (
        <div className="cards">
          {repos.map((r) => {
            const root = repoRoot(r.owner, r.repo);
            const p = projects.find((x) => x.root === root);
            const copy = data.copies[root];
            const sync = data.sync[root];
            const paused = data.pausedUntil[copy?.via ?? "installation"] > 0;
            const error = sync?.error && (!sync.limited || paused) ? sync.error : null;
            const systems = p ? new Set(p.entries.flatMap((e) => (e.kind === "decision" ? [e.d.system.split("/")[0] || "unsorted"] : []))).size : 0;
            return (
              <Card key={root} title={r.repo} hint={`Open ${r.owner}/${r.repo}`} aside={<span className="muted small">{r.private ? "private" : "public"}</span>} onClick={() => onOpen(root)}>
                <span className="card-where">{r.owner}/{r.repo}</span>
                {p ? (
                  <>
                    <span className="card-counts">
                      <span>{plural(systems, "system")}</span>
                      <span>{plural(p.decisions, "decision")}</span>
                    </span>
                    <StatusBar counts={p.status} />
                  </>
                ) : copy ? (
                  <span className="muted small">No .datlas/ folder at the repo root</span>
                ) : null}
                {error ? (
                  <span className="error-text small">{error}</span>
                ) : (
                  <span className="muted small">{sync?.syncing ? "Syncing…" : copy ? `Synced ${ago(copy.syncedAt)}` : "Not synced yet"}</span>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
