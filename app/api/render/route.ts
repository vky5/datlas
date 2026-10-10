import { execFile } from "node:child_process";
import path from "node:path";
import { fail, resolveDiagramFile, HttpError } from "@/lib/server";
import { D2_ARGS } from "@/lib/render";

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
  return new Promise<Response>((resolve) => {
    execFile("d2", [...D2_ARGS, file, "-"], { maxBuffer: 50e6, timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        const missing = (err as NodeJS.ErrnoException).code === "ENOENT";
        resolve(Response.json({ error: missing ? "d2 is not installed or not on PATH" : String(stderr || err.message) }, { status: 422 }));
      } else {
        resolve(new Response(stdout, { headers: { "Content-Type": "image/svg+xml", "X-Compile-Ms": String(Date.now() - started) } }));
      }
    });
  });
}
