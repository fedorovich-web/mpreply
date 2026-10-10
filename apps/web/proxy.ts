import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { localeFromPathname, localeRequestHeader } from "./lib/i18n";
import { resolveDomainRoute } from "./lib/domain-routing";

export function proxy(request: NextRequest) {
  const publicOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://mpreply.ru";
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "https://app.mpreply.ru";
  const route = resolveDomainRoute(request.nextUrl, publicOrigin, appOrigin);
  const isAppHost = request.nextUrl.hostname === new URL(appOrigin).hostname;

  if (route.kind === "redirect") {
    const response = NextResponse.redirect(route.destination, 307);
    if (isAppHost) response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  if (route.kind === "robots") {
    return new NextResponse("User-agent: *\nDisallow: /\n", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }
  if (route.kind === "not_found") {
    return new NextResponse(null, { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow" } });
  }

  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const development = process.env.NODE_ENV === "development";
  const configuredApi = process.env.NEXT_PUBLIC_API_BASE_URL;
  const apiOrigin = configuredApi ? new URL(configuredApi).origin : development ? "http://localhost:8000" : "";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // React controls use style attributes; script execution remains nonce-bound.
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ""}${development ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(!development ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(localeRequestHeader, localeFromPathname(request.nextUrl.pathname));
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  if (isAppHost) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/robots.txt", "/sitemap.xml", "/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[a-zA-Z0-9]+$).*)"],
};
