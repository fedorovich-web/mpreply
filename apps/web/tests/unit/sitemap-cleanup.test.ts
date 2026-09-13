import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sitemapSource = readFileSync(join(process.cwd(), "app/sitemap.ts"), "utf8");

describe("public sitemap", () => {
  it("does not fabricate a current last-modified timestamp for every public route", () => {
    expect(sitemapSource).not.toContain("new Date()");
    expect(sitemapSource).not.toContain("lastModified:");
  });
});
