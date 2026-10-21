import { localOnly } from "@/lib/server";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

// Lists the sub-folders of one folder. Only folders under the home directory are allowed.
export async function GET(request: Request) {
  const off = localOnly();
  if (off) return off;
  const home = await fs.realpath(os.homedir());
  const wanted = new URL(request.url).searchParams.get("path") || home;

  let dir: string;
  try {
    dir = await fs.realpath(path.resolve(wanted));
  } catch {
    return Response.json({ error: "Folder not found" }, { status: 404 });
  }
  if (dir !== home && !dir.startsWith(home + path.sep)) {
    return Response.json({ error: "Only folders inside your home directory can be browsed" }, { status: 403 });
  }

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return Response.json({ error: "Cannot read this folder" }, { status: 403 });
  }

  const dirs = (
    await Promise.all(
      entries
        .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
        .map(async (e) => {
          const full = path.join(dir, e.name);
          const isGit = await fs.stat(path.join(full, ".git")).then(() => true, () => false);
          return { name: e.name, path: full, isGit };
        }),
    )
  ).sort((a, b) => a.name.localeCompare(b.name));

  return Response.json({
    path: dir,
    parent: dir === home ? null : path.dirname(dir),
    dirs,
  });
}
