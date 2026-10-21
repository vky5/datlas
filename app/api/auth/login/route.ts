import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { STATE_COOKIE, cookieOptions, siteUrl } from "@/lib/session";

// Starts GitHub login. The random state comes back in the callback and proves this browser started it.
export async function GET(request: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return new Response("GITHUB_CLIENT_ID is not set in .env.local", { status: 500 });
  const state = randomBytes(16).toString("base64url");
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", siteUrl(request, "/api/auth/callback"));
  url.searchParams.set("state", state);
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, cookieOptions(request, 10 * 60));
  return res;
}
