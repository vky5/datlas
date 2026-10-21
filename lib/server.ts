import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { LOCAL_FILES } from "./mode";

// Every route that touches the disk starts with this: with local folders off (hosted), it doesn't exist.
export const localOnly = () => (LOCAL_FILES ? null : Response.json({ error: "Not found" }, { status: 404 }));

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function fail(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  return Response.json({ error: "Unexpected server error" }, { status: 500 });
}

export async function home() {
  return fs.realpath(os.homedir());
}

// Resolves a path and refuses anything outside the home directory (symlinks included).
export async function resolveInHome(p: string): Promise<string> {
  const h = await home();
  let r: string;
  try {
    r = await fs.realpath(path.resolve(p));
  } catch {
    throw new HttpError(404, "Not found");
  }
  if (r !== h && !r.startsWith(h + path.sep)) {
    throw new HttpError(403, "Only paths inside your home directory are allowed");
  }
  return r;
}

export const DIAGRAM_EXT: Record<string, "d2" | "mmd"> = { ".d2": "d2", ".mmd": "mmd", ".mermaid": "mmd" };

export async function resolveDiagramFile(p: string | null) {
  if (!p) throw new HttpError(400, "path is required");
  const file = await resolveInHome(p);
  if (!DIAGRAM_EXT[path.extname(file).toLowerCase()]) throw new HttpError(400, "Not a diagram file");
  return file;
}

// A decision file: a .md directly inside a .datlas folder under home.
export async function resolveDecisionFile(p: string | null) {
  if (!p) throw new HttpError(400, "path is required");
  const file = await resolveInHome(p);
  if (path.extname(file).toLowerCase() !== ".md" || path.basename(path.dirname(file)) !== ".datlas") {
    throw new HttpError(400, "Not a decision file");
  }
  return file;
}
