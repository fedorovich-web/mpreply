import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const shell = readFileSync(join(root, "components/public-site/PublicShell.tsx"), "utf8");
const header = readFileSync(join(root, "components/public-site/PublicHeader.tsx"), "utf8");
const brandMarkPath = join(root, "components/public-site/PublicBrandMark.tsx");
const brandMark = existsSync(brandMarkPath) ? readFileSync(brandMarkPath, "utf8") : "";
const marketingCss = readFileSync(join(root, "styles/marketing-site.css"), "utf8");
const homepageCss = readFileSync(join(root, "styles/homepage-approved.css"), "utf8");

describe("public shell cleanup", () => {
  it("does not render fake social controls or decorative social placeholders", () => {
    expect(shell).not.toContain("public-footer-socials");
    expect(shell).not.toContain("<span>➤</span>");
    expect(shell).not.toContain("<span>◉</span>");
    expect(shell).not.toContain("<span>VK</span>");
    expect(homepageCss).not.toContain(".public-footer-socials");
  });

  it("does not label contact fallbacks as company pages that do not exist", () => {
    expect(shell).not.toContain(">Компания<");
    expect(shell).not.toContain(">О нас<");
    expect(shell).not.toContain(">Партнёрам<");
  });

  it("renders the guaranteed support email without an unreachable null branch", () => {
    expect(shell).toContain('href={`mailto:${siteConfig.contactEmail}`}');
    expect(shell).not.toContain("siteConfig.contactEmail ?");
  });

  it("links footer help entries to the sections they name", () => {
    expect(shell).toContain('<Link href="/help#start">База знаний</Link>');
    expect(shell).toContain('<Link href="/help#faq">FAQ</Link>');
  });

  it("does not keep unreachable hash handling in route-only header navigation", () => {
    expect(header).not.toContain('href.includes("#")');
  });

  it("does not retain selectors for the retired footer markup", () => {
    expect(shell).not.toContain("public-footer-grid");
    expect(shell).not.toContain("public-footer-topline");
    expect(marketingCss).not.toContain(".public-footer-grid");
    expect(marketingCss).not.toContain(".public-footer-topline");
  });

  it("uses one shared brand-mark component in the public header and footer", () => {
    expect(existsSync(brandMarkPath)).toBe(true);
    expect(brandMark).toContain('className="public-brand-mark"');
    expect(brandMark).toContain('className="public-brand-glyph"');
    expect(header).toContain('import { PublicBrandMark } from "./PublicBrandMark"');
    expect(shell).toContain('import { PublicBrandMark } from "./PublicBrandMark"');
    expect(header).toContain("<PublicBrandMark />");
    expect(shell).toContain("<PublicBrandMark />");
    expect(header).not.toContain("function BrandMark");
    expect(shell).not.toContain("function FooterBrandMark");
  });

  it("sizes the desktop footer for the brand plus three real link columns", () => {
    expect(homepageCss).toMatch(/\.public-root \.public-footer-main\s*\{[\s\S]*?grid-template-columns:\s*minmax\(15rem, 1\.45fr\) repeat\(3, minmax\(7rem, 0\.8fr\)\);/);
  });
});
