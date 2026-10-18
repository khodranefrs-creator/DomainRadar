import { NextResponse } from "next/server";
import { timingSafeEqualStrings } from "@/lib/access-control";
import { SESSION_COOKIE, createSession } from "@/lib/session";

// Exchanges the shared access token for a signed session cookie. Reachable
// without a session (see isAuthExemptPath), but only a correct token yields a
// cookie; everything else stays gated. Accepts JSON or form bodies so the plain
// HTML form works without JavaScript.
export async function POST(request: Request) {
  const token = process.env.DOMAIN_RADAR_ACCESS_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "Access is not configured on the server." },
      { status: 503 },
    );
  }

  let password = "";
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      password?: unknown;
    } | null;
    password = typeof body?.password === "string" ? body.password : "";
  } else {
    const form = await request.formData().catch(() => null);
    password = form ? String(form.get("password") ?? "") : "";
  }

  if (!timingSafeEqualStrings(password, token)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const { value, maxAge } = await createSession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return response;
}
