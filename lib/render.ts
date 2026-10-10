import { execFile } from "node:child_process";

// Light theme only: authors set their own box colours, and D2's dark theme puts light text on those light fills.
export const D2_ARGS = ["--layout=elk", "--pad", "30", "--theme", "0"];
const ARGS = D2_ARGS;

// Renders D2 source passed on stdin.
export function renderD2Source(source: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile("d2", [...ARGS, "-", "-"], { maxBuffer: 50e6, timeout: 30000 }, (err, stdout, stderr) => {
      if (!err) return resolve(stdout);
      const missing = (err as NodeJS.ErrnoException).code === "ENOENT";
      reject(new Error(missing ? "d2 is not installed or not on PATH" : String(stderr || err.message)));
    });
    child.stdin?.end(source);
  });
}
