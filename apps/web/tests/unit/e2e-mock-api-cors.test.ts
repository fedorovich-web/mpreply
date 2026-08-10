import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLAYWRIGHT_ORIGIN,
  mockApiCorsHeaders,
} from "../../e2e/helpers/mock-api-cors";

describe("Playwright mock API CORS contract", () => {
  it("echoes the browser request origin instead of a stale server default", () => {
    const headers = mockApiCorsHeaders("http://127.0.0.1:47821");

    expect(headers["access-control-allow-origin"]).toBe(
      "http://127.0.0.1:47821",
    );
    expect(headers["access-control-allow-credentials"]).toBe("true");
  });

  it("uses the same loopback fallback as the Playwright server", () => {
    const previousBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
    delete process.env.PLAYWRIGHT_BASE_URL;

    try {
      expect(mockApiCorsHeaders()["access-control-allow-origin"]).toBe(
        DEFAULT_PLAYWRIGHT_ORIGIN,
      );
      expect(DEFAULT_PLAYWRIGHT_ORIGIN).toBe("http://127.0.0.1:3120");
    } finally {
      if (previousBaseUrl === undefined) {
        delete process.env.PLAYWRIGHT_BASE_URL;
      } else {
        process.env.PLAYWRIGHT_BASE_URL = previousBaseUrl;
      }
    }
  });
});
