import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { resolveDomainRoute } from "../../lib/domain-routing";
import { proxy } from "../../proxy";

const publicOrigin = "https://mpreply.ru";
const appOrigin = "https://app.mpreply.ru";
const check = (url: string) => resolveDomainRoute(new URL(url), publicOrigin, appOrigin);

describe("canonical MPReply domain boundaries", () => {
  it("routes both app entry points to their locale-specific workspaces", () => {
    expect(check("https://app.mpreply.ru/")).toEqual({ kind: "redirect", destination: "https://app.mpreply.ru/app/dashboard" });
    expect(check("https://app.mpreply.ru/en")).toEqual({ kind: "redirect", destination: "https://app.mpreply.ru/en/app/dashboard" });
  });

  it("keeps login, registration, workspace, and locale routes on the app host", () => {
    for (const path of ["/auth/login", "/auth/register", "/app/account", "/en/auth/login", "/en/app/dashboard"]) {
      expect(check(appOrigin + path)).toEqual({ kind: "next" });
      expect(check(publicOrigin + path)).toEqual({ kind: "redirect", destination: appOrigin + path });
    }
  });

  it("returns public pages to the public host, preserving query strings", () => {
    expect(check(appOrigin + "/pricing?currency=RUB")).toEqual({
      kind: "redirect", destination: publicOrigin + "/pricing?currency=RUB",
    });
    expect(check(appOrigin + "/en/help")).toEqual({ kind: "redirect", destination: publicOrigin + "/en/help" });
    expect(check(publicOrigin + "/pricing")).toEqual({ kind: "next" });
  });

  it("does not redirect unknown deployment or local development hosts", () => {
    expect(check("http://localhost:3000/")).toEqual({ kind: "next" });
    expect(check("https://preview.example.test/app/dashboard")).toEqual({ kind: "next" });
  });

  it("never creates an attacker-controlled redirect host from a request path", () => {
    const result = check(appOrigin + "//evil.example.test/path");
    expect(result.kind).toBe("redirect");
    if (result.kind === "redirect") expect(new URL(result.destination).hostname).toBe("mpreply.ru");
  });

  it("blocks app indexing without blocking the public robots and sitemap", () => {
    expect(check(appOrigin + "/robots.txt")).toEqual({ kind: "robots" });
    expect(check(appOrigin + "/sitemap.xml")).toEqual({ kind: "not_found" });
    expect(check(publicOrigin + "/robots.txt")).toEqual({ kind: "next" });

    const robots = proxy(new NextRequest(appOrigin + "/robots.txt"));
    expect(robots.status).toBe(200);
    expect(robots.headers.get("Content-Type")).toContain("text/plain");
    expect(robots.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    const sitemap = proxy(new NextRequest(appOrigin + "/sitemap.xml"));
    expect(sitemap.status).toBe(404);
  });

  it("forbids indexing workspace pages and redirects public-host auth URLs", () => {
    const workspace = proxy(new NextRequest(appOrigin + "/app/dashboard"));
    expect(workspace.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    const auth = proxy(new NextRequest(publicOrigin + "/auth/login?next=%2Fapp%2Finbox"));
    expect(auth.status).toBe(307);
    expect(auth.headers.get("location")).toBe(appOrigin + "/auth/login?next=%2Fapp%2Finbox");
  });
});
