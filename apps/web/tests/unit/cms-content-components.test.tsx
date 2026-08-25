import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CMSContentArticle } from "../../components/public-site/CMSContentArticle";
import { CMSContentCard } from "../../components/public-site/CMSContentCard";
import type { CMSContentDetail } from "../../lib/cms/schema";

const content = {
  _status: "published",
  authorName: "Редакция MPReply",
  body: {
    root: {
      children: [{ type: "paragraph", children: [{ type: "text", text: "Содержание материала", format: 0 }] }],
      type: "root",
      version: 1,
    },
  },
  category: { name: "Отзывы", slug: "reviews" },
  cover: null,
  createdAt: "2026-08-24T08:00:00.000Z",
  editorialState: "approved",
  excerpt: "Практический порядок ответа.",
  id: "4f78cdb5-7c2f-41ce-924d-5d9d7d60d4ba",
  kind: "article",
  marketplaces: ["wildberries"],
  publishedAt: "2026-08-25T08:00:00.000Z",
  seo: { canonical: null, description: "Описание", noindex: false, title: "SEO title" },
  slug: "negative-review-guide",
  title: "Как отвечать на негативные отзывы",
  updatedAt: "2026-08-25T08:00:00.000Z",
} satisfies CMSContentDetail;

describe("CMS public content components", () => {
  it("renders a linked content card using the validated route", () => {
    const { body: _body, ...summary } = content;
    void _body;
    render(<CMSContentCard content={summary} headingLevel={3} />);

    expect(screen.getByRole("heading", { level: 3, name: content.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `Читать: ${content.title}` })).toHaveAttribute(
      "href",
      "/blog/negative-review-guide",
    );
  });

  it("renders one article H1 and the allowlisted body", () => {
    render(<CMSContentArticle content={content} />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(content.title);
    expect(screen.getByText("Содержание материала")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Блог" })).toHaveAttribute("href", "/blog");
  });
});
