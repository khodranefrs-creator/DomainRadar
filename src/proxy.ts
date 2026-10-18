import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decideAccess, getAccessMode } from "@/lib/access-control";

// Access gate. Next.js 16 renamed the middleware convention to `proxy`.
//
// - Local mode (default): loopback-only guard.
// - Public mode (opt-in): the hosted deployment is openly accessible; every
//   request is served.
//
// The decision logic lives in src/lib/access-control.ts and is unit tested there.

export function proxy(request: NextRequest) {
  const decision = decideAccess({
    mode: getAccessMode(process.env),
    hostHeader: request.headers.get("host"),
  });

  if (decision.ok) {
    return NextResponse.next();
  }

  return new NextResponse(decision.message, {
    status: decision.status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: "/:path*",
};
