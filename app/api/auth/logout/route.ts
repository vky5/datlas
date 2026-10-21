import { SESSION_COOKIE, cookieOptions } from "@/lib/session";
import { NextResponse } from "next/server";

// POST, so a link on another site can't log you out.
export async function POST(request: Request) {
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(SESSION_COOKIE, "", cookieOptions(request, 0));
  return res;
}
