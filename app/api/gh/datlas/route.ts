import { latestCommit, readDatlas } from "@/lib/github";
import { withInstallation } from "@/lib/installation";

// Reads one installed repo's .datlas/ for the browser, which keeps the copy; nothing is stored here.
// Body: { owner, repo, etag?, known?: sha[] }. Unchanged since etag: { unchanged: true }.
// Files whose sha is in `known` come back without text.

const OWNER = /^[A-Za-z0-9-]{1,39}$/;
const REPO = /^(?!\.\.?$)[A-Za-z0-9._-]{1,100}$/;
const SHA = /^[0-9a-f]{40}$/;
const SKIPPED = "\0known";

export async function POST(request: Request) {
  const b = await request.json().catch(() => null);
  const owner = String(b?.owner ?? "");
  const repo = String(b?.repo ?? "");
  // They go into GitHub API paths, so nothing like "../app" may get through.
  if (!OWNER.test(owner) || !REPO.test(repo)) return Response.json({ error: "Not a valid owner/repo" }, { status: 400 });
  const known: unknown[] = Array.isArray(b?.known) ? b.known : [];
  if (known.length > 1000 || !known.every((s) => typeof s === "string" && SHA.test(s))) return Response.json({ error: "known must be up to 1000 file shas" }, { status: 400 });
  const etag = typeof b?.etag === "string" ? b.etag : undefined;

  return withInstallation(request, async (token) => {
    const head = await latestCommit({ owner, repo }, { token, etag });
    if (!head) return { unchanged: true };
    const files = await readDatlas({ owner, repo }, head.commit, { token, known: new Map(known.map((s) => [s as string, SKIPPED])) });
    return { commit: head.commit, etag: head.etag, files: files.map((f) => (f.text === SKIPPED ? { path: f.path, sha: f.sha } : f)) };
  });
}
