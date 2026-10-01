import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const sitemapSource = readFileSync(join(root, "app/sitemap.ts"), "utf8");
const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");

describe("public sitemap", () => {
  it("does not fabricate a current last-modified timestamp for every public route", () => {
    expect(sitemapSource).not.toContain("new Date()");
    expect(sitemapSource).not.toContain("lastModified:");
  });

  it("excludes legal drafts until they are finalized", () => {
    expect(siteConfig).toContain("export const indexablePublicRoutes");
    expect(siteConfig).toContain('path !== "/privacy"');
    expect(siteConfig).toContain('path !== "/terms"');
    expect(sitemapSource).toContain("indexablePublicRoutes.flatMap");
    expect(sitemapSource).not.toContain("publicRoutes.flatMap");
  });
});
