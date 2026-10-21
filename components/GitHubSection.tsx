"use client";

import { Card } from "./Card";
import { External, GitHub } from "./icons";
import type { GitHubState } from "@/lib/account";

// The repos the datlas GitHub App may read. Picking repos happens on GitHub's own page; this links there.
export function GitHubSection({ state }: { state: GitHubState }) {
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
        <span className="muted small">{repos.length} repo{repos.length === 1 ? "" : "s"} datlas can read</span>
        <span className="grow" />
        <a className="btn" href={`https://github.com/settings/installations/${state.installation}`} target="_blank" rel="noreferrer"><External /> Choose repos</a>
      </div>
      {state.error && <p className="error-text">{state.error}</p>}
      {state.repos && repos.length === 0 && <p className="muted">No repos selected yet. Use “Choose repos” to pick which ones datlas may read.</p>}
      {repos.length > 0 && (
        <>
          <div className="cards">
            {repos.map((r) => (
              <Card
                key={`${r.owner}/${r.repo}`}
                title={r.repo}
                hint={`Open ${r.owner}/${r.repo}/.datlas on GitHub`}
                aside={<span className="muted small">{r.private ? "private" : "public"}</span>}
                onClick={() => window.open(`https://github.com/${r.owner}/${r.repo}/tree/HEAD/.datlas`, "_blank", "noreferrer")}
              >
                <span className="card-where">{r.owner}/{r.repo}</span>
              </Card>
            ))}
          </div>
          <p className="muted small">Opening a repo shows its .datlas folder on GitHub for now. Reading its decisions here comes with sync.</p>
        </>
      )}
    </section>
  );
}
