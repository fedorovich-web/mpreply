import { describe, expect, it } from "vitest";

import { Categories } from "../src/collections/Categories";
import { Content } from "../src/collections/Content";
import { Media } from "../src/collections/Media";
import { Users } from "../src/collections/Users";

describe("CMS collection contracts", () => {
  it("enables scheduled drafts and keeps content routes structured", () => {
    expect(Content.slug).toBe("content");
    expect(Content.versions).toMatchObject({
      drafts: { schedulePublish: true },
    });

    const fieldNames = Content.fields.map((field) =>
      "name" in field ? field.name : undefined,
    );
    expect(fieldNames).toEqual(
      expect.arrayContaining(["slug", "title", "excerpt", "body", "kind", "editorialState", "seo"]),
    );
  });

  it("accepts only raster editorial image formats", () => {
    expect(Media.upload).toMatchObject({
      mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
      staticDir: "uploads",
    });
  });

  it("keeps taxonomy administration and CMS authentication explicit", () => {
    expect(Categories.slug).toBe("categories");
    expect(Users.auth).toBeTruthy();

    const role = Users.fields.find((field) => "name" in field && field.name === "role");
    expect(role).toMatchObject({ defaultValue: "editor", required: true });
    expect(role).toMatchObject({
      options: expect.arrayContaining([
        expect.objectContaining({ value: "service" }),
      ]),
    });
  });
});
