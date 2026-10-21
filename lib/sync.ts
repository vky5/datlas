"use client";

import { latestCommit, readDatlas, GitHubError, type RepoFile } from "./github";
import { getCopy, putCopy, type RepoCopy } from "./copy";
import { analyze, parseDecision } from "./parse";
import { fileKey, repoRoot } from "./repoKey";
import type { Decision, Problem } from "./types";

// Brings one repo's copy up to date. First asks whether the commit moved (one call, using the stored etag);
// if it did, fetches the file list and downloads only files whose sha isn't in the copy yet.
// Installed repos go through the server, which holds the login; public ones go straight to GitHub.

const inflight = new Map<string, Promise<RepoCopy>>();

export function syncRepo(owner: string, repo: string, via: RepoCopy["via"]): Promise<RepoCopy> {
  const root = repoRoot(owner, repo);
  let p = inflight.get(root);
  if (!p) {
    p = doSync(owner, repo, via).finally(() => inflight.delete(root));
    inflight.set(root, p);
  }
  return p;
}

async function doSync(owner: string, repo: string, via: RepoCopy["via"]): Promise<RepoCopy> {
  const root = repoRoot(owner, repo);
  const prev = await getCopy(root);
  // A copy fetched the other way may be missing files this way can see, so its etag can't be trusted here.
  const usable = prev && prev.via === via ? prev : null;
  const texts = new Map((prev?.files ?? []).map((f) => [f.sha, f.text]));

  let next: Omit<RepoCopy, "syncedAt"> | null;
  if (via === "installation") {
    const res = await fetch("/api/gh/datlas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, repo, etag: usable?.etag ?? undefined, known: [...texts.keys()].slice(0, 1000) }),
    });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) throw new GitHubError(b.kind ?? (res.status === 401 ? "unauthorized" : "failed"), b.error ?? `Sync failed (${res.status})`, b.resetAt ? new Date(b.resetAt) : null);
    next = b.unchanged
      ? null
      : { root, owner, repo, via, commit: b.commit, etag: b.etag, files: (b.files as { path: string; sha: string; text?: string }[]).map((f) => ({ ...f, text: f.text ?? texts.get(f.sha) ?? "" })) };
  } else {
    const head = await latestCommit({ owner, repo }, { etag: usable?.etag ?? undefined });
    next = head && { root, owner, repo, via, commit: head.commit, etag: head.etag, files: await readDatlas({ owner, repo }, head.commit, { known: texts }) };
  }

  const copy: RepoCopy = { ...(next ?? usable!), syncedAt: Date.now() };
  await putCopy(copy);
  return copy;
}

// The copy's files as decisions, with keys like "gh:owner/repo/.datlas/x.md". GitHub has no per-file
// modified time, so `mod` is the sync time: a new sync makes open decisions reload from the copy.
export function parseCopy(c: RepoCopy): { decisions: Decision[]; problems: Problem[] } {
  const proj = { root: c.root, name: c.repo };
  const decisions: Decision[] = [];
  const problems: Problem[] = [];
  for (const f of c.files as RepoFile[]) {
    const d = parseDecision(f.text, fileKey(c.owner, c.repo, f.path), c.syncedAt, proj, problems);
    if (d) decisions.push(d);
  }
  analyze(decisions, problems);
  return { decisions, problems };
}
