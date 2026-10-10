import { execFile } from "node:child_process";

export async function GET() {
  const d2 = await new Promise<string | null>((resolve) => {
    execFile("d2", ["--version"], { timeout: 5000 }, (err, stdout) => resolve(err ? null : stdout.trim()));
  });
  return Response.json({ d2 });
}
