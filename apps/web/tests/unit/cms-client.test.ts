import { describe, expect, it, vi } from "vitest";

import {
  CMSNotFoundError,
  CMSUnavailableError,
  createCMSClient,
} from "../../lib/cms/client";
import type { CMSRuntimeConfig } from "../../lib/cms/config";

const config: CMSRuntimeConfig = {
  apiUrl: "https://cms.mpreply.ru",
  readToken: "server-only-token",
  requestTimeoutMs: 1200,
};

const publishedDocument = {
  id: "4f78cdb5-7c2f-41ce-924d-5d9d7d60d4ba",
  slug: "negative-review-guide",
  title: "Как отвечать на негативные отзывы",
  excerpt: "Практический порядок ответа.",
  body: { root: { children: [], type: "root", version: 1 } },
  kind: "article",
  category: { id: "category-1", name: "Отзывы", slug: "reviews" },
  marketplaces: ["wildberries"],
  cover: null,
  authorName: null,
  editorialState: "approved",
  seo: { title: "Негативные отзывы", description: "Практический порядок ответа.", canonical: null, noindex: false },
  publishedAt: "2026-08-25T08:00:00.000Z",
  createdAt: "2026-08-24T08:00:00.000Z",
  updatedAt: "2026-08-25T08:00:00.000Z",
  _status: "published",
};

describe("CMS server client", () => {
  it("requests only approved published content with a server authorization header", async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher.mockResolvedValue(Response.json({ docs: [publishedDocument], totalDocs: 1 }));
    const client = createCMSClient(config, fetcher);

    const result = await client.listPublishedContent("article");

    expect(result).toHaveLength(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toContain("where%5B_status%5D%5Bequals%5D=published");
    expect(String(url)).toContain("where%5BeditorialState%5D%5Bequals%5D=approved");
    expect(init?.headers).toMatchObject({ authorization: "Bearer server-only-token" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("classifies an authoritative empty detail response as not found", async () => {
    const client = createCMSClient(config, async () => Response.json({ docs: [], totalDocs: 0 }));

    await expect(client.getPublishedContent("article", "missing")).rejects.toBeInstanceOf(CMSNotFoundError);
  });

  it("classifies transport failures without exposing provider details", async () => {
    const client = createCMSClient(config, async () => {
      throw new Error("database hostname and internal stack");
    });

    await expect(client.listPublishedContent()).rejects.toEqual(
      new CMSUnavailableError("CMS is temporarily unavailable"),
    );
  });
});
