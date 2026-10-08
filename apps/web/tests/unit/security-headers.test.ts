import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "../../proxy";

afterEach(() => vi.unstubAllEnvs());

describe("page security boundary", () => {
  it("replaces a supplied nonce, binds scripts to a fresh nonce and preserves the locale", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.mpreply.ru");
    const response = proxy(new NextRequest("https://app.mpreply.ru/en/auth/register", {
      headers: { "x-nonce": "attacker", "Content-Security-Policy": "script-src *" },
    }));
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(nonce).not.toBe("attacker");
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("script-src *");
    expect(csp).toContain("connect-src 'self' https://api.mpreply.ru");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    const again = proxy(new NextRequest("https://app.mpreply.ru/en/auth/register"));
    expect(again.headers.get("Content-Security-Policy")).not.toBe(csp);
  });

  it("permits local development tools without weakening production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000");
    const csp = proxy(new NextRequest("http://localhost:3000/")).headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("http://localhost:8000");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});
