import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiRequest, buildApiQuery } from "../../lib/api/client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildApiQuery", () => {
  it("normalizes the path, serializes values and omits empty parameters", () => {
    expect(
      buildApiQuery("api/messages", {
        organization_id: "org-1",
        page: 2,
        status: "",
        marketplace: null,
        rating: undefined,
      }),
    ).toBe("/api/messages?organization_id=org-1&page=2");
  });
});

describe("apiRequest", () => {
  it.each(["/api/auth/identities", "/api/auth/yandex/link/start"])("refreshes an expired session for %s", async (path) => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "expired" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Session refreshed" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiRequest(path, z.object({ ok: z.boolean() }), path.endsWith("/start") ? { method: "POST", body: { locale: "ru" } } : {})).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[1][0]).toBe("http://localhost:8000/api/auth/refresh");
    expect(fetchMock.mock.calls[2][0]).toBe(`http://localhost:8000${path}`);
  });
  it("sends JSON with credentialed no-store requests and validates the response", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiRequest(
      "/api/example",
      z.object({ ok: z.boolean() }),
      { method: "POST", body: { value: 42 } },
    );

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request).toMatchObject({
      method: "POST",
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ value: 42 }),
    });
    expect(new Headers(request?.headers).get("content-type")).toBe("application/json");
    expect(new Headers(request?.headers).get("x-csrf-token")).toBe("1");
  });

  it("renews an expired access session once and retries the original request", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "expired" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Session refreshed" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiRequest("/api/protected", z.object({ ok: z.boolean() }));

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://localhost:8000/api/auth/refresh");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("x-csrf-token")).toBe("1");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("http://localhost:8000/api/protected");
  });

  it("shares one refresh across concurrent expired requests", async () => {
    let releaseRefresh: (() => void) | undefined;
    const refreshGate = new Promise<Response>((resolve) => {
      releaseRefresh = () => resolve(new Response(JSON.stringify({ message: "Session refreshed" }), { status: 200 }));
    });
    const attempts = new Map<string, number>();
    let refreshCalls = 0;
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/auth/refresh")) {
        refreshCalls += 1;
        return refreshGate;
      }

      const attempt = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, attempt);
      if (attempt === 1) {
        return new Response(JSON.stringify({ detail: "expired" }), { status: 401 });
      }
      return new Response(JSON.stringify({ url }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = apiRequest("/api/first", z.object({ url: z.string() }));
    const second = apiRequest("/api/second", z.object({ url: z.string() }));
    await vi.waitFor(() => expect(refreshCalls).toBe(1));
    releaseRefresh?.();

    await expect(Promise.all([first, second])).resolves.toEqual([
      { url: "http://localhost:8000/api/first" },
      { url: "http://localhost:8000/api/second" },
    ]);
    expect(refreshCalls).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("keeps refresh infrastructure failure distinct from an expired session", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "expired" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/api/protected", z.object({ ok: z.boolean() }))).rejects.toMatchObject({
      name: "ApiError",
      message: "Не удалось проверить сессию. Повторите попытку позже.",
      status: 401,
      kind: "session-refresh-unavailable",
    } satisfies Partial<ApiError>);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not attach a CSRF proof to safe requests", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/example", z.object({ ok: z.boolean() }));

    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has("x-csrf-token")).toBe(false);
  });

  it("preserves API status and request ID on backend errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: "Недостаточно прав" }), {
          status: 403,
          headers: { "x-request-id": "req-403" },
        }),
      ),
    );

    await expect(apiRequest("/api/protected", z.object({ ok: z.boolean() }))).rejects.toMatchObject({
      name: "ApiError",
      message: "Недостаточно прав",
      status: 403,
      requestId: "req-403",
    } satisfies Partial<ApiError>);
  });

  it("rejects payloads that violate the frontend API contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ unexpected: true }), { status: 200 })),
    );

    await expect(apiRequest("/api/example", z.object({ ok: z.boolean() }))).rejects.toMatchObject({
      name: "ApiError",
      status: 502,
    } satisfies Partial<ApiError>);
  });
});
