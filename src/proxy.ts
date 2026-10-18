import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  decideAccess,
  getAccessMode,
  getUsername,
} from "@/lib/access-control";

// Access gate. Next.js 16 renamed the middleware convention to `proxy`.
//
// Default (local) mode keeps the loopback-only guard from earlier milestones.
// Opt-in deployment mode authenticates every request with a shared token and
// fails closed when that token is absent. The decision logic lives in
// src/lib/access-control.ts so it can be unit tested without the Next runtime.

export function proxy(request: NextRequest) {
  const decision = decideAccess({
    mode: getAccessMode(process.env),
    hostHeader: request.headers.get("host"),
    authorizationHeader: request.headers.get("authorization"),
    token: process.env.DOMAIN_RADAR_ACCESS_TOKEN,
    username: getUsername(process.env),
  });

  if (decision.ok) {
    return NextResponse.next();
  }

  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  if (decision.challenge) {
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
