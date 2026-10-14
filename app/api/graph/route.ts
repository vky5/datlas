import { fail, resolveInHome } from "@/lib/server";
import { scanDir } from "@/lib/scan";
import { decisionGraph } from "@/lib/graph";

// The decision graph of one project, as D2 source for the browser to render.
// Body: { project, highlight?: string[] } — ids outside highlight are dimmed.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const root = await resolveInHome(String(body?.project ?? ""));
    const highlight = Array.isArray(body?.highlight) ? new Set<string>(body.highlight.map(String)) : null;
    const decisions = (await scanDir(root)).decisions.filter((d) => d.projectRoot === root);
    if (decisions.length === 0) return Response.json({ source: null, empty: true });
    return Response.json({ source: decisionGraph(decisions, root, highlight) });
  } catch (e) {
    return fail(e);
  }
}
