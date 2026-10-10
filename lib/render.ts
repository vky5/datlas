import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";

// Light theme only: authors set their own box colours, and D2's dark theme puts light text on those light fills.
const ARGS = ["--layout=elk", "--pad", "30", "--theme", "0"];

// Rendered SVGs, kept in memory. Same input -> same SVG, so a repeat view skips d2 entirely.
const MAX_CACHED = 300;
const cache = new Map<string, Promise<string>>();
function cached(key: string, make: () => Promise<string>): Promise<string> {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key); // move to the newest end
    cache.set(key, hit);
    return hit;
  }
  const p = make();
  p.catch(() => cache.delete(key)); // never keep failures; the file may be fixed next time
  cache.set(key, p);
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  return p;
}

function runD2(args: string[], stdin?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile("d2", [...ARGS, ...args], { maxBuffer: 50e6, timeout: 30000 }, (err, stdout, stderr) => {
      if (!err) return resolve(stdout);
      const missing = (err as NodeJS.ErrnoException).code === "ENOENT";
      reject(new Error(missing ? "d2 is not installed or not on PATH" : String(stderr || err.message)));
    });
    if (stdin !== undefined) child.stdin?.end(stdin);
  });
}

// D2 source embedded in a decision file.
export function renderD2Source(source: string): Promise<string> {
  return cached("src:" + createHash("sha1").update(source).digest("hex"), () => runD2(["-", "-"], source));
}

// A .d2 file, rendered by path so its relative imports still resolve. Keyed by modified time, so an edit re-renders.
export async function renderD2File(file: string): Promise<string> {
  const { mtimeMs } = await fs.stat(file);
  return cached(`file:${file}:${mtimeMs}`, () => runD2([file, "-"]));
}
