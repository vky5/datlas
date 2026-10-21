import { promises as fs } from "node:fs";
import { fail, resolveDecisionFile } from "@/lib/server";
import { extractDiagram, splitDoc } from "@/lib/parse";

// One decision: its written reasoning plus the diagram source. The browser renders the diagram.
export async function GET(request: Request) {
  try {
    const file = await resolveDecisionFile(new URL(request.url).searchParams.get("path"));
    const doc = splitDoc(await fs.readFile(file, "utf8"));
    if (!doc) return Response.json({ error: "Missing or invalid front matter" }, { status: 422 });
    const { lang, source, text } = extractDiagram(doc.body);
    return Response.json({ text, lang, source });
  } catch (e) {
    return fail(e);
  }
}
