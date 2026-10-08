import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const shell = readFileSync(join(root, "components/public-site/PublicShell.tsx"), "utf8");
const footer = readFileSync(join(root, "components/public-site/PublicFooter.tsx"), "utf8");
const footerCss = readFileSync(join(root, "styles/public-compact-footer.css"), "utf8");

describe("shared public chrome", () => {
  it("uses one header and one footer for both homepage and inner routes", () => {
    expect(shell).toContain("<PublicHeader locale={locale} />");
    expect(shell).toContain("<PublicFooter locale={locale} />");
    expect(shell).toContain("homepage-reference-root");
    expect(footer).toContain('className="home-reference-footer"');
  });

  it("links each destination once in the visible footer group", () => {
    for (const route of ["/features", "/marketplaces", "/pricing", "/demo", "/help", "/contacts", "/privacy", "/terms"]) {
      expect(footer.match(new RegExp(`href=\\{path\\("${route}"\\)\\}`, "g"))).toHaveLength(1);
    }
    expect(footer).not.toContain("help#faq");
    expect(footer).not.toContain("help#start");
  });

  it("uses disclosure navigation only below the desktop breakpoint", () => {
    expect(footerCss).toContain("@media (max-width: 1100px)");
    expect(footerCss).toContain(".public-footer-disclosure[data-open='true']");
    expect(footerCss).not.toContain("public-footer-compact");
    expect(footerCss).not.toContain("public-footer-default");
    expect(footerCss).not.toContain("public-footer-pricing");
  });

  it("does not publish unverified office or social channels", () => {
    for (const forbidden of ["г. Майкоп", "ул. Чкалова", "09:00–18:00", ">ТГ<", ">VK<"]) {
      expect(footer).not.toContain(forbidden);
    }
  });
});
