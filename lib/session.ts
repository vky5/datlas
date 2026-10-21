import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// The login lives in one signed, HttpOnly cookie: who the user is and which installation they own.
// Signed so an edited cookie (say, someone else's installation id) is rejected. No GitHub token is kept.

export const SESSION_COOKIE = "datlas_session";
export const STATE_COOKIE = "datlas_oauth_state";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;

// uid: GitHub's numeric user id, which survives a username change. login is for display only. exp: unix seconds.
export type Session = { uid: number; login: string; inst: number; exp: number };

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set in .env.local");
  return s;
}

const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

export function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function encodeSession(s: Session): string {
  const data = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function decodeSession(value: string | undefined): Session | null {
  const [data, sig, extra] = value?.split(".") ?? [];
  if (!data || !sig || extra !== undefined || !sameString(sig, sign(data))) return null;
  try {
    const s = JSON.parse(Buffer.from(data, "base64url").toString());
    if (typeof s.uid !== "number" || typeof s.inst !== "number" || typeof s.login !== "string" || typeof s.exp !== "number") return null;
    return s.exp > Date.now() / 1000 ? s : null;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  return decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
}

// The address the browser used. Not request.url: Next rewrites its host (127.0.0.1 becomes localhost),
// and GitHub needs the callback to match the registered one exactly. x-forwarded-* is set by hosting proxies.
export function siteUrl(request: Request, path: string): string {
  const h = request.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? new URL(request.url).protocol.slice(0, -1);
  return host ? `${proto}://${host}${path}` : new URL(path, request.url).toString();
}

// Secure only over https, so the cookie still works on http://127.0.0.1 in development.
export const cookieOptions = (request: Request, maxAge: number) => ({
  httpOnly: true,
  secure: siteUrl(request, "/").startsWith("https:"),
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});
