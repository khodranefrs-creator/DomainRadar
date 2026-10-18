import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Local-only guard. The dev/start scripts bind to 127.0.0.1, and this proxy
// refuses requests whose Host header is not loopback — defense in depth against
// accidental exposure if the bind address is ever changed.
//
// Next.js 16 renamed the middleware convention to `proxy`.

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function proxy(request: NextRequest) {
  const hostHeader = request.headers.get("host") ?? "";
  const hostname = hostHeader.split(":")[0].toLowerCase();
  if (!ALLOWED_HOSTS.has(hostname)) {
    return new NextResponse("Forbidden: Domain Radar is local-only.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
