import { fail, resolveInHome, HttpError } from "@/lib/server";
import { scanDir } from "@/lib/scan";
import type { ScanResult } from "@/lib/types";

// Requests for the same folder that arrive while a scan is running share it (dev mode fires effects twice).
const inflight = new Map<string, Promise<ScanResult>>();
function scanShared(dir: string) {
  let p = inflight.get(dir);
  if (!p) {
    p = scanDir(dir).finally(() => inflight.delete(dir));
    inflight.set(dir, p);
  }
  return p;
}

// The browser sends the folders it saved; the server keeps nothing.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const dirs: unknown = body?.directories;
    if (!Array.isArray(dirs) || dirs.some((d) => typeof d !== "string")) {
      throw new HttpError(400, "directories must be an array of paths");
    }
    const results: ScanResult[] = await Promise.all(
      (dirs as string[]).slice(0, 50).map(async (d) => {
        try {
          return await scanShared(await resolveInHome(d));
        } catch (e) {
          const message = e instanceof HttpError ? e.message : "Cannot read this folder";
          return { path: d, ok: false, error: message, diagrams: [], decisions: [], problems: [], notes: [] };
        }
      }),
    );
    return Response.json(results);
  } catch (e) {
    return fail(e);
  }
}
