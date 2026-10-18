import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decideAccess, getAccessMode, getUsername } from "@/lib/access-control";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Access gate. Next.js 16 renamed the middleware convention to `proxy`.
//
// - Local mode (default): loopback-only guard, unchanged.
// - Deployment mode: a valid session cookie (set once by /login) or HTTP Basic
//   credentials grant access. Unauthenticated pages redirect to /login — with no
//   WWW-Authenticate header, so the browser never shows a Basic-auth prompt —
//   and unauthenticated /api requests get a plain 401. The decision logic lives
//   in src/lib/access-control.ts and is unit tested there.

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const mode = getAccessMode(process.env);
  const token = process.env.DOMAIN_RADAR_ACCESS_TOKEN;

  let sessionValid = false;
  if (mode === "deployment" && token) {
    const cookie = request.cookies.get(SESSION_COOKIE)?.value ?? null;
    sessionValid = await verifySession(cookie, token);
  }

  const decision = decideAccess({
    mode,
    hostHeader: request.headers.get("host"),
    authorizationHeader: request.headers.get("authorization"),
    token,
    username: getUsername(process.env),
    sessionValid,
    pathname,
  });

  if (decision.ok) {
    return NextResponse.next();
  }

  const isApi = pathname.startsWith("/api/");

  // Send anonymous page visitors to the login form (deployment mode only, so
  // local mode keeps returning the plain loopback 403 and never redirects).
  if (mode === "deployment" && !isApi && (decision.status === 401 || decision.status === 403)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname && pathname !== "/login") {
      url.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(url);
  }

  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  // Only challenge API clients. Sending WWW-Authenticate for a page would
  // re-introduce the browser Basic-auth prompt we are removing.
  if (isApi && decision.challenge) {
    headers.set("WWW-Authenticate", decision.challenge);
  }
  return new NextResponse(decision.message, {
    status: decision.status,
    headers,
  });
}

export const config = {
  matcher: "/:path*",
};
