import { NextResponse } from "next/server";
import { GitHubError } from "./github";
import { AppError, forgetToken, installationToken } from "./githubApp";
import { SESSION_COOKIE, cookieOptions, getSession } from "./session";

const STATUS: Record<GitHubError["kind"], number> = { "not-found": 404, empty: 409, "rate-limited": 429, unauthorized: 401, failed: 502 };

// Runs `read` with the logged-in user's installation token and turns every failure into a JSON error.
// A rejected token is replaced once; if no new one can be made, the App is gone and the login is cleared.
export async function withInstallation(request: Request, read: (token: string) => Promise<unknown>): Promise<Response> {
  const s = await getSession();
  if (!s) return Response.json({ error: "Log in with GitHub first" }, { status: 401 });
  try {
    let body;
    try {
      body = await read(await installationToken(s.inst));
    } catch (e) {
      if (!(e instanceof GitHubError && e.kind === "unauthorized")) throw e;
      forgetToken(s.inst);
      body = await read(await installationToken(s.inst));
    }
    return Response.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    // 404: uninstalled. 403: suspended.
    if (e instanceof AppError && (e.status === 404 || e.status === 403)) {
      forgetToken(s.inst);
      const res = NextResponse.json({ error: "The datlas App is no longer installed on your account. Log in again." }, { status: 401 });
      res.cookies.set(SESSION_COOKIE, "", cookieOptions(request, 0));
      return res;
    }
    if (e instanceof GitHubError) return Response.json({ error: e.message, kind: e.kind, resetAt: e.resetAt }, { status: STATUS[e.kind] });
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
