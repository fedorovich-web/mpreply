import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("API configuration safety", () => {
  it("can render public components without configuration but blocks a production request", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", undefined);
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = await import("../../lib/api/client");
    await expect(client.apiRequest("/api/contact", z.object({ message: z.string() }), { method: "POST" }))
      .rejects.toThrow("NEXT_PUBLIC_API_BASE_URL is required in production");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks an invalid API origin before sending any data", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://example.com");
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = await import("../../lib/api/client");
    await expect(client.apiRequest("/api/contact", z.object({ message: z.string() }), { method: "POST" }))
      .rejects.toThrow("must be an HTTPS origin");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
