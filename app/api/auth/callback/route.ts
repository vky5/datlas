import { NextResponse, type NextRequest } from "next/server";
import { appSlug, currentUser, exchangeCode, pickInstallation, userInstallations } from "@/lib/githubApp";
import { SESSION_COOKIE, SESSION_SECONDS, STATE_COOKIE, cookieOptions, encodeSession, sameString, siteUrl } from "@/lib/session";

const problem = (status: number, message: string) => new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Shown when the App is installed only on organizations: without it, datlas would send the user to the install page
// again and again with no reason given.
function orgsOnly(orgs: string[], installUrl: string, home: string) {
  const names = orgs.map((o) => `<b>${esc(o)}</b>`).join(", ");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>datlas: personal accounts only</title>
<style>body{margin:0;background:#080706;color:#f0eeeb;font:15px/1.6 system-ui,sans-serif}main{max-width:560px;margin:12vh auto;padding:0 16px}
h1{font-size:22px}p{color:#9b9893}b{color:#f0eeeb}a{color:#f2a618}.btn{display:inline-block;margin-right:12px;padding:6px 14px;border:1px solid rgba(255,255,255,.15);border-radius:6px;text-decoration:none}</style></head>
<body><main><h1>datlas works with personal accounts only</h1>
<p>The datlas GitHub App is installed on ${names}, but not on your own account. Organization installs aren't supported yet.</p>
<p>Install it on your personal account and pick the repos to read. You'll come back here logged in.</p>
<p><a class="btn" href="${esc(installUrl)}">Install on my account</a><a class="btn" href="${esc(home)}">Back to datlas</a></p></main></body></html>`;
  return new Response(html, { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

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
    const choice = pickInstallation(user.id, await userInstallations(userToken));
    if (choice.kind !== "own") {
      const installUrl = `https://github.com/apps/${await appSlug()}/installations/new`;
      return choice.kind === "none" ? NextResponse.redirect(installUrl) : orgsOnly(choice.orgs, installUrl, siteUrl(request, "/"));
    }
    const own = { id: choice.id };

    const res = NextResponse.redirect(siteUrl(request, "/"));
    const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    res.cookies.set(SESSION_COOKIE, encodeSession({ uid: user.id, login: user.login, inst: own.id, exp }), cookieOptions(request, SESSION_SECONDS));
    res.cookies.set(STATE_COOKIE, "", cookieOptions(request, 0));
    return res;
  } catch (e) {
    return problem(502, `Login failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
