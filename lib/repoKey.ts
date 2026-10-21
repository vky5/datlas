// GitHub files are keyed "gh:owner/repo/path". Owner and repo are lowercased because GitHub treats
// VKY5/Datlas and vky5/datlas as one repo; the path keeps its case, since git paths are case-sensitive.
// Local keys are absolute paths starting with "/", so the two never collide.

export const isGitHubKey = (key: string) => key.startsWith("gh:");
export const repoRoot = (owner: string, repo: string) => `gh:${owner.toLowerCase()}/${repo.toLowerCase()}`;
export const fileKey = (owner: string, repo: string, path: string) => `${repoRoot(owner, repo)}/${path}`;

export function parseKey(key: string): { owner: string; repo: string; path: string } | null {
  const m = key.match(/^gh:([^/]+)\/([^/]+)(?:\/(.*))?$/);
  return m ? { owner: m[1], repo: m[2], path: m[3] ?? "" } : null;
}
