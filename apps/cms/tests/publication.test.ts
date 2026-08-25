import { describe, expect, it } from "vitest";

import {
  assertPublicationAllowed,
  createRevalidationSignature,
} from "../src/hooks/revalidateContent";

describe("CMS publication policy", () => {
  it("rejects publication by editors", () => {
    expect(() =>
      assertPublicationAllowed({
        data: { _status: "published", editorialState: "approved" },
        user: { role: "editor" },
      }),
    ).toThrow("Only CMS administrators can publish content");
  });

  it("rejects publication before editorial approval", () => {
    expect(() =>
      assertPublicationAllowed({
        data: { _status: "published", editorialState: "in_review" },
        user: { role: "admin" },
      }),
    ).toThrow("Content must be approved before publication");
  });

  it("allows an approved administrator publication", () => {
    expect(() =>
      assertPublicationAllowed({
        data: { _status: "published", editorialState: "approved" },
        user: { role: "admin" },
      }),
    ).not.toThrow();
  });

  it("signs the exact timestamp and JSON body", () => {
    expect(createRevalidationSignature("secret", "1724580000", '{"id":"entry-1"}')).toBe(
      "sha256=0b9b496a8d6e95be04824bc667a5b4f82c13805095f3193ecb405143ce37e501",
    );
  });
});
