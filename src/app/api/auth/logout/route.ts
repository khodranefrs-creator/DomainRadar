import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// Clears the session cookie. Exempt from the gate so signing out always works.
export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
