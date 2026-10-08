import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const publicShell = readFileSync(join(root, "components/public-site/PublicShell.tsx"), "utf8");
const footer = readFileSync(join(root, "components/public-site/PublicFooter.tsx"), "utf8");
const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");
const product = readFileSync(join(root, "../../PRODUCT.md"), "utf8");
const publicBrief = readFileSync(join(root, "../../docs/product/public-site-master-brief.md"), "utf8");

const publicNavigationSources = `${footer}\n${publicShell}\n${siteConfig}`;

describe("public no-blog contract", () => {
  it("does not expose a blog label or route in public navigation", () => {
    expect(publicNavigationSources).not.toContain("Блог");
    expect(publicNavigationSources).not.toContain('href="/blog"');
    expect(publicNavigationSources).not.toContain('{ href: "/blog"');
  });

  it("keeps help as support/FAQ rather than an editorial blog substitute", () => {
    expect(siteConfig).toContain('{ href: "/help", label: "Помощь" }');
    expect(footer).toContain('<Link href={path("/help")}>{labels.help}</Link>');
    expect(footer).not.toContain("База знаний");
    expect(footer).not.toContain("help#faq");
  });

  it("records that MPReply has no public blog in product truth", () => {
    expect(product).toContain("MPReply has no public blog");
    expect(publicBrief).toContain("MPReply has no public blog");
    expect(publicBrief).not.toContain("unless the user explicitly approves");
  });
});
