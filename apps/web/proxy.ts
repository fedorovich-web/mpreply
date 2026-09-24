import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { localeFromPathname, localeRequestHeader } from "./lib/i18n";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(localeRequestHeader, localeFromPathname(request.nextUrl.pathname));

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
