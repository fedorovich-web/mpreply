import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

const home = source("app/page.tsx");
const homeWorkspace = source("components/public-site/HomeWorkspaceTabs.tsx");
const features = source("app/features/page.tsx");
const marketplaces = source("app/marketplaces/page.tsx");
const pricing = source("app/pricing/page.tsx");
const demo = source("app/demo/page.tsx");
const help = source("app/help/page.tsx");
const contacts = source("app/contacts/page.tsx");
const shell = source("components/public-site/PublicShell.tsx");
const siteConfig = source("lib/site-config.ts");

describe("public internal link graph contract", () => {
  it("keeps every primary public route globally discoverable", () => {
    for (const route of ["/features", "/marketplaces", "/pricing", "/demo", "/help", "/contacts"]) {
      expect(siteConfig).toContain(`href: \"${route}\"`);
      expect(shell).toContain(`href=\"${route}\"`);
    }

    expect(shell).toContain('href="/privacy"');
    expect(shell).toContain('href="/terms"');
  });

  it("connects the core commercial journey with contextual links", () => {
    expect(home).toContain("<HomeWorkspaceTabs />");
    expect(homeWorkspace).toContain('href="/features"');
    expect(home).toContain("href={marketplace.path}");

    expect(features).toContain('href="/marketplaces"');

    expect(marketplaces).toContain("href={integration.path}");
    expect(marketplaces).toContain('href="/pricing"');
    expect(marketplaces).not.toContain("Подробнее <span");

    expect(pricing).toContain("href={marketplace.path}");
    expect(demo).toContain('href="/marketplaces"');
  });

  it("keeps support and contact routes connected to useful next steps", () => {
    for (const route of ["/marketplaces", "/features", "/demo", "/contacts"]) {
      expect(help).toContain(route);
    }

    expect(contacts).toContain('href="/demo"');
    expect(contacts).toContain('href="/marketplaces"');
  });

  it("does not emit retired FAQPage structured data on the help route", () => {
    expect(help).not.toContain('"@type": "FAQPage"');
    expect(help).not.toContain("<JsonLd data={faqSchema} />");
  });
});
