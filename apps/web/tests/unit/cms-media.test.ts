import { describe, expect, it, vi } from "vitest";

import { CMSMediaError, fetchCMSMedia } from "../../lib/cms/media";
import type { CMSRuntimeConfig } from "../../lib/cms/config";

const config: CMSRuntimeConfig = {
  apiUrl: "https://cms.mpreply.ru",
  readToken: "server-only-token",
  requestTimeoutMs: 1200,
};

describe("CMS media proxy", () => {
  it("fetches an allowlisted image with the server-only token", async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/webp" },
      }),
    );

    const media = await fetchCMSMedia("cover.webp", config, fetcher);

    expect(media.contentType).toBe("image/webp");
    expect(media.body.byteLength).toBe(3);
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ authorization: "Bearer server-only-token" });
  });

  it("rejects unsafe filenames and non-image provider responses", async () => {
    await expect(fetchCMSMedia("../secret", config)).rejects.toBeInstanceOf(CMSMediaError);
    await expect(
      fetchCMSMedia("cover.webp", config, async () => new Response("html", { headers: { "content-type": "text/html" } })),
    ).rejects.toBeInstanceOf(CMSMediaError);
  });
});
