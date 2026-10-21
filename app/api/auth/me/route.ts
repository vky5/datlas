import { getSession } from "@/lib/session";

// Who is logged in, for the UI. The cookie itself is HttpOnly, so the page can't read it.
export async function GET() {
  const s = await getSession();
  return Response.json(s ? { login: s.login, installation: s.inst, expires: new Date(s.exp * 1000).toISOString() } : { login: null });
}
