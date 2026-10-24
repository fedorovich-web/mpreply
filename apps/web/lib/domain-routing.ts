/**
 * Keep public pages and the authenticated workspace on separate canonical hosts.
 * Both hosts intentionally share a Next.js deployment; routing is host-aware.
 * Unknown hosts (localhost/staging) keep ordinary path-based routing.
 */
type DomainRoute =
  | { kind: "next" }
  | { kind: "redirect"; destination: string }
  | { kind: "robots" }
  | { kind: "not_found" };

const privatePath = /^\/(?:en\/)?(?:app|auth)(?:\/|$)/;

function destinationAt(origin: string, requestUrl: URL): string {
  const destination = new URL(origin);
  destination.pathname = requestUrl.pathname;
  destination.search = requestUrl.search;
  return destination.toString();
}

export function resolveDomainRoute(requestUrl: URL, publicOrigin: string, appOrigin: string): DomainRoute {
  const publicHost = new URL(publicOrigin).hostname;
  const appHost = new URL(appOrigin).hostname;
  const hostname = requestUrl.hostname;
  const pathname = requestUrl.pathname;

  if (hostname === appHost && hostname !== publicHost) {
    if (pathname === "/robots.txt") return { kind: "robots" };
    if (pathname === "/sitemap.xml") return { kind: "not_found" };
    if (pathname === "/" || pathname === "/en" || pathname === "/en/") {
      const dashboard = pathname.startsWith("/en") ? "/en/app/dashboard" : "/app/dashboard";
      return { kind: "redirect", destination: new URL(dashboard + requestUrl.search, appOrigin).toString() };
    }
    if (!privatePath.test(pathname)) {
      return { kind: "redirect", destination: destinationAt(publicOrigin, requestUrl) };
    }
  }

  if (hostname === publicHost && privatePath.test(pathname)) {
    return { kind: "redirect", destination: destinationAt(appOrigin, requestUrl) };
  }

  return { kind: "next" };
}
