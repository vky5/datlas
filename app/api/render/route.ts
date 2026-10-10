import path from "node:path";
import { fail, resolveDiagramFile, HttpError } from "@/lib/server";
import { renderD2File } from "@/lib/render";

// D2 files only. Mermaid is rendered in the browser.
export async function GET(request: Request) {
  let file: string;
  try {
    file = await resolveDiagramFile(new URL(request.url).searchParams.get("path"));
    if (path.extname(file).toLowerCase() !== ".d2") throw new HttpError(400, "Only .d2 files render on the server");
  } catch (e) {
    return fail(e);
  }
  const started = Date.now();
  try {
    const svg = await renderD2File(file);
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "X-Compile-Ms": String(Date.now() - started) } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 422 });
  }
}
