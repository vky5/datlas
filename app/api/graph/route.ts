import { fail, resolveInHome, HttpError } from "@/lib/server";
import { scanDir } from "@/lib/scan";
import { decisionGraph } from "@/lib/graph";
import { renderD2Source } from "@/lib/render";

// The decision graph of one project. Body: { project, highlight?: string[] } — ids outside highlight are dimmed.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const root = await resolveInHome(String(body?.project ?? ""));
    const highlight = Array.isArray(body?.highlight) ? new Set<string>(body.highlight.map(String)) : null;
    const decisions = (await scanDir(root)).decisions.filter((d) => d.projectRoot === root);
    if (decisions.length === 0) return Response.json({ svg: null, empty: true });
    try {
      return Response.json({ svg: await renderD2Source(decisionGraph(decisions, root, highlight)) });
    } catch (e) {
      throw new HttpError(422, e instanceof Error ? e.message : String(e));
    }
  } catch (e) {
    return fail(e);
  }
}
