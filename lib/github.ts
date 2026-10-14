// Reads a repo's .datlas/ folder from GitHub. No Node APIs: runs in the browser and on the server.

export type Repo = { owner: string; repo: string };
// sha: git's id for the file's content, so an unchanged file can be skipped by it.
export type RepoFile = { path: string; sha: string; text: string };
type Listed = { path: string; sha: string; size: number; download_url: string | null };
type Opts = { token?: string };

const API = "https://api.github.com";
const TIMEOUT_MS = 15000; // raw.githubusercontent.com has been seen to hang for over a minute
const PARALLEL = 6;
const MAX_FILE_BYTES = 1_000_000;

export class GitHubError extends Error {
  constructor(
    // not-found also covers private repos this token can't see: GitHub answers 404 for both.
    public kind: "not-found" | "empty" | "rate-limited" | "unauthorized" | "failed",
    message: string,
    public resetAt: Date | null = null,
  ) {
    super(message);
  }
}

const name = (r: Repo) => `${r.owner}/${r.repo}`;
const encodePath = (p: string) => p.split("/").map(encodeURIComponent).join("/");

async function request(url: string, opts: Opts, headers: Record<string, string> = {}): Promise<Response> {
  const h: Record<string, string> = { "X-GitHub-Api-Version": "2022-11-28", ...headers };
  if (opts.token) h.Authorization = `Bearer ${opts.token}`;
  try {
    return await fetch(url, { headers: h, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === "TimeoutError";
    throw new GitHubError("failed", timedOut ? `GitHub did not answer within ${TIMEOUT_MS / 1000}s` : "Could not reach GitHub");
  }
}

// Turns a failed response into a GitHubError. 404 is left to the caller, since it means different things.
async function failure(res: Response, what: string): Promise<GitHubError> {
  const reset = res.headers.get("x-ratelimit-reset");
  if ((res.status === 403 || res.status === 429) && (res.headers.get("x-ratelimit-remaining") === "0" || res.headers.has("retry-after"))) {
    const retry = res.headers.get("retry-after");
    const at = reset ? new Date(+reset * 1000) : retry ? new Date(Date.now() + +retry * 1000) : null;
    return new GitHubError("rate-limited", `GitHub rate limit reached${at ? `; it refills at ${at.toLocaleTimeString()}` : ""}`, at);
  }
  if (res.status === 401) return new GitHubError("unauthorized", "GitHub rejected the token");
  const body = await res.json().catch(() => null);
  return new GitHubError("failed", `${what}: GitHub answered ${res.status}${body?.message ? ` (${body.message})` : ""}`);
}

// The default branch's latest commit, or null if it hasn't changed since `etag`.
export async function latestCommit(r: Repo, opts: Opts & { etag?: string } = {}): Promise<{ commit: string; etag: string | null } | null> {
  const headers: Record<string, string> = { Accept: "application/vnd.github.sha" };
  if (opts.etag) headers["If-None-Match"] = opts.etag;
  const res = await request(`${API}/repos/${r.owner}/${r.repo}/commits/HEAD`, opts, headers);
  if (res.status === 304) return null;
  if (res.status === 404) throw new GitHubError("not-found", `${name(r)} doesn't exist or isn't visible to you`);
  if (res.status === 409) throw new GitHubError("empty", `${name(r)} has no commits yet`);
  if (!res.ok) throw await failure(res, `Reading ${name(r)}`);
  return { commit: (await res.text()).trim(), etag: res.headers.get("etag") };
}

// Markdown files directly inside `folder` at that commit, minus README.md. A missing folder is an empty list.
async function listFolder(r: Repo, commit: string, folder: string, opts: Opts): Promise<Listed[]> {
  const res = await request(`${API}/repos/${r.owner}/${r.repo}/contents/${encodePath(folder)}?ref=${commit}`, opts, { Accept: "application/vnd.github+json" });
  if (res.status === 404) return [];
  if (!res.ok) throw await failure(res, `Listing ${folder} in ${name(r)}`);
  const items = await res.json();
  if (!Array.isArray(items)) return []; // `folder` is a file, not a folder
  return items.filter((x) => x.type === "file" && x.name.endsWith(".md") && x.name.toLowerCase() !== "readme.md" && x.size <= MAX_FILE_BYTES);
}

// Without a token, the raw host: it doesn't use the API rate limit. With one, the API, which can read private repos.
async function download(r: Repo, commit: string, f: Listed, opts: Opts): Promise<string> {
  const res = opts.token || !f.download_url
    ? await request(`${API}/repos/${r.owner}/${r.repo}/contents/${encodePath(f.path)}?ref=${commit}`, opts, { Accept: "application/vnd.github.raw" })
    : await request(f.download_url, {});
  if (!res.ok) throw await failure(res, `Reading ${f.path} in ${name(r)}`);
  return res.text();
}

// `known` maps sha -> text from an earlier read; those files aren't downloaded again.
export async function readFolder(r: Repo, commit: string, folder: string, opts: Opts & { known?: Map<string, string> } = {}): Promise<RepoFile[]> {
  const listed = await listFolder(r, commit, folder, opts);
  const out: RepoFile[] = [];
  for (let i = 0; i < listed.length; i += PARALLEL) {
    const batch = listed.slice(i, i + PARALLEL);
    const texts = await Promise.all(batch.map((f) => opts.known?.get(f.sha) ?? download(r, commit, f, opts)));
    batch.forEach((f, j) => out.push({ path: f.path, sha: f.sha, text: texts[j] }));
  }
  return out;
}

export const readDatlas = (r: Repo, commit: string, opts: Opts & { known?: Map<string, string> } = {}) => readFolder(r, commit, ".datlas", opts);
