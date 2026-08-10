import type { Route } from "@playwright/test";

export const DEFAULT_PLAYWRIGHT_ORIGIN = "http://127.0.0.1:3120";

export function mockApiCorsHeaders(requestOrigin?: string) {
  const origin =
    requestOrigin?.trim() ||
    process.env.PLAYWRIGHT_BASE_URL ||
    DEFAULT_PLAYWRIGHT_ORIGIN;

  return {
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-origin": origin,
    "content-type": "application/json",
  };
}

export function fulfillMockApiJson(
  route: Route,
  body: unknown,
  status = 200,
) {
  return route.fulfill({
    status,
    headers: mockApiCorsHeaders(route.request().headers()["origin"]),
    body: JSON.stringify(body),
  });
}
