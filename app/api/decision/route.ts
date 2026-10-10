import { promises as fs } from "node:fs";
import { fail, resolveAtlasFile } from "@/lib/server";
import { extractDiagram, splitDoc } from "@/lib/atlas";
import { renderD2Source } from "@/lib/render";

// One decision: its written reasoning plus the diagram (D2 rendered here, Mermaid as source).
export async function GET(request: Request) {
  try {
    const file = await resolveAtlasFile(new URL(request.url).searchParams.get("path"));
    const doc = splitDoc(await fs.readFile(file, "utf8"));
    if (!doc) return Response.json({ error: "Missing or invalid front matter" }, { status: 422 });
    const { lang, source, text } = extractDiagram(doc.body);
    let svg: string | null = null;
    let error: string | null = null;
    if (lang === "d2" && source) {
      try {
        svg = await renderD2Source(source);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    }
    return Response.json({ text, lang, source, svg, error });
  } catch (e) {
    return fail(e);
  }
}
