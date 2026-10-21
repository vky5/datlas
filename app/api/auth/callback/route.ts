import { NextResponse, type NextRequest } from "next/server";
import { appSlug, currentUser, exchangeCode, userInstallations } from "@/lib/githubApp";
import { SESSION_COOKIE, SESSION_SECONDS, STATE_COOKIE, cookieOptions, encodeSession, sameString, siteUrl } from "@/lib/session";

const problem = (status: number, message: string) => new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

// GitHub sends the browser here after login, and after installing the App.
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  if (p.get("error")) return problem(400, `GitHub login was cancelled: ${p.get("error_description") ?? p.get("error")}`);

  // A login started from GitHub's install page carries no state of ours, so it can't be trusted.
  // Start a proper one instead: GitHub returns at once, since the App is already approved.
  const state = p.get("state");
  if (!state) return NextResponse.redirect(siteUrl(request, "/api/auth/login"));
  const expected = request.cookies.get(STATE_COOKIE)?.value;
  const code = p.get("code");
  if (!code || !expected || !sameString(state, expected)) return problem(400, "This login expired or was started in another browser. Start again from datlas.");

  try {
    const userToken = await exchangeCode(code, siteUrl(request, "/api/auth/callback"));
    const user = await currentUser(userToken);
    // Personal accounts only: the installation must be on the user's own account, not one they merely see.
    const own = (await userInstallations(userToken)).find((i) => i.account.id === user.id);
    if (!own) return NextResponse.redirect(`https://github.com/apps/${await appSlug()}/installations/new`);

    const res = NextResponse.redirect(siteUrl(request, "/"));
    const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    res.cookies.set(SESSION_COOKIE, encodeSession({ uid: user.id, login: user.login, inst: own.id, exp }), cookieOptions(request, SESSION_SECONDS));
    res.cookies.set(STATE_COOKIE, "", cookieOptions(request, 0));
    return res;
  } catch (e) {
    return problem(502, `Login failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
