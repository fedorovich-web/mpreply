import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { localeFromPathname, localeRequestHeader } from "./lib/i18n";

export function proxy(request: NextRequest) {
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
  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[a-zA-Z0-9]+$).*)"],
};
