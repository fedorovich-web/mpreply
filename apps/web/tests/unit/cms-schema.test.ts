import { describe, expect, it } from "vitest";

import {
  parseContentDetail,
  parseContentList,
} from "../../lib/cms/schema";

const lexicalBody = {
  root: {
    children: [
      {
        children: [{ detail: 0, format: 0, mode: "normal", style: "", text: "Текст", type: "text", version: 1 }],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "paragraph",
        version: 1,
      },
    ],
    direction: "ltr",
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
};

const providerDocument = {
  id: "4f78cdb5-7c2f-41ce-924d-5d9d7d60d4ba",
  slug: "negative-review-guide",
  title: "Как отвечать на негативные отзывы",
  excerpt: "Практический порядок ответа без шаблонных обещаний.",
  body: lexicalBody,
  kind: "article",
  category: { id: "category-1", name: "Отзывы", slug: "reviews", internal: "drop" },
  marketplaces: ["wildberries", "ozon"],
  cover: {
    id: "media-1",
    url: "/api/media/file/cover.webp",
    alt: "Пример ответа на отзыв",
    width: 1200,
    height: 630,
    secretMetadata: "drop",
  },
  authorName: "Редакция MPReply",
  editorialState: "approved",
  seo: {
    title: "Ответы на негативные отзывы",
    description: "Как подготовить корректный ответ на негативный отзыв.",
    canonical: null,
    noindex: false,
  },
  publishedAt: "2026-08-25T08:00:00.000Z",
  createdAt: "2026-08-24T08:00:00.000Z",
  updatedAt: "2026-08-25T08:00:00.000Z",
  _status: "published",
  apiKey: "must-not-survive-projection",
};

describe("CMS response projection", () => {
  it("projects a published Payload document to the public detail contract", () => {
    const content = parseContentDetail(providerDocument);

    expect(content.slug).toBe("negative-review-guide");
    expect(content.category).toEqual({ name: "Отзывы", slug: "reviews" });
    expect(content.cover).toEqual({
      alt: "Пример ответа на отзыв",
      height: 630,
      url: "/api/media/file/cover.webp",
      width: 1200,
    });
    expect(content).not.toHaveProperty("apiKey");
    expect(content.category).not.toHaveProperty("internal");
  });

  it("rejects provider documents that are not both approved and published", () => {
    expect(() => parseContentDetail({ ...providerDocument, editorialState: "in_review" })).toThrow();
    expect(() => parseContentDetail({ ...providerDocument, _status: "draft" })).toThrow();
  });

  it("rejects cover URLs outside the Payload media-file route", () => {
    expect(() =>
      parseContentDetail({
        ...providerDocument,
        cover: { ...providerDocument.cover, url: "https://attacker.example/image.webp" },
      }),
    ).toThrow();
  });

  it("projects a bounded list response", () => {
    const list = parseContentList({ docs: [providerDocument], totalDocs: 1, providerDebug: true });

    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty("body");
  });
});
