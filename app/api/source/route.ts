import { promises as fs } from "node:fs";
import { fail, resolveDiagramFile } from "@/lib/server";

export async function GET(request: Request) {
  try {
    const file = await resolveDiagramFile(new URL(request.url).searchParams.get("path"));
    return new Response(await fs.readFile(file, "utf8"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (e) {
    return fail(e);
  }
}
