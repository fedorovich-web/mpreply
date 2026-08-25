import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CMSRichText } from "../../lib/cms/lexical";

describe("CMS rich text renderer", () => {
  it("renders only allowlisted structural nodes and safe links", () => {
    render(
      <CMSRichText
        document={{
          root: {
            type: "root",
            version: 1,
            children: [
              { type: "heading", tag: "h2", children: [{ type: "text", text: "Порядок ответа", format: 1 }] },
              { type: "paragraph", children: [{ type: "text", text: "Сначала проверьте факты.", format: 0 }] },
              {
                type: "list",
                listType: "bullet",
                children: [{ type: "listitem", children: [{ type: "text", text: "Не обещайте лишнего", format: 0 }] }],
              },
              {
                type: "paragraph",
                children: [
                  {
                    type: "link",
                    fields: { url: "https://example.com/guide", newTab: true },
                    children: [{ type: "text", text: "Источник", format: 0 }],
                  },
                ],
              },
              { type: "script", children: [{ type: "text", text: "alert(1)", format: 0 }] },
            ],
          },
        }}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Порядок ответа" })).toBeInTheDocument();
    expect(screen.getByRole("list")).toHaveTextContent("Не обещайте лишнего");
    expect(screen.getByRole("link", { name: "Источник" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByText("alert(1)")).not.toBeInTheDocument();
  });

  it("drops unsafe link protocols while preserving their visible text", () => {
    render(
      <CMSRichText
        document={{
          root: {
            type: "root",
            version: 1,
            children: [
              {
                type: "paragraph",
                children: [
                  {
                    type: "link",
                    fields: { url: "javascript:alert(1)" },
                    children: [{ type: "text", text: "Опасная ссылка", format: 0 }],
                  },
                ],
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getByText("Опасная ссылка")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
