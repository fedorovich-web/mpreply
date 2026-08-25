import { describe, expect, it } from "vitest";

import {
  contentKindLabel,
  contentPath,
  createContentMetadata,
  publicCMSMediaPath,
} from "../../lib/cms/presentation";
import type { CMSContentDetail } from "../../lib/cms/schema";

const content = {
  _status: "published",
  authorName: "Редакция MPReply",
  body: { root: { children: [], type: "root", version: 1 } },
  category: { name: "Отзывы", slug: "reviews" },
  cover: null,
  createdAt: "2026-08-24T08:00:00.000Z",
  editorialState: "approved",
  excerpt: "Практический порядок ответа.",
  id: "4f78cdb5-7c2f-41ce-924d-5d9d7d60d4ba",
  kind: "article",
  marketplaces: ["wildberries"],
  publishedAt: "2026-08-25T08:00:00.000Z",
  seo: {
    canonical: null,
    description: "Как подготовить корректный ответ на негативный отзыв.",
    noindex: false,
    title: "Ответы на негативные отзывы",
  },
  slug: "negative-review-guide",
  title: "Как отвечать на негативные отзывы",
  updatedAt: "2026-08-25T08:00:00.000Z",
} satisfies CMSContentDetail;

describe("CMS content presentation", () => {
  it("maps articles to blog and every resource kind to resources", () => {
    expect(contentPath("article", "negative-review-guide")).toBe("/blog/negative-review-guide");
    expect(contentPath("guide", "negative-review-guide")).toBe("/resources/negative-review-guide");
    expect(contentKindLabel("checklist")).toBe("Чек-лист");
  });

  it("builds canonical metadata from validated CMS SEO fields", () => {
    const metadata = createContentMetadata(content);

    expect(metadata.title).toBe("Ответы на негативные отзывы");
    expect(metadata.alternates?.canonical).toBe("/blog/negative-review-guide");
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });

  it("honors an explicit canonical and noindex flag", () => {
    const metadata = createContentMetadata({
      ...content,
      seo: { ...content.seo, canonical: "https://mpreply.ru/resources/canonical-guide", noindex: true },
    });

    expect(metadata.alternates?.canonical).toBe("https://mpreply.ru/resources/canonical-guide");
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it("maps a validated Payload media path to the local authenticated proxy", () => {
    expect(publicCMSMediaPath("/api/media/file/cover.webp")).toBe("/api/cms/media/cover.webp");
    expect(() => publicCMSMediaPath("https://attacker.example/cover.webp")).toThrow();
  });
});
