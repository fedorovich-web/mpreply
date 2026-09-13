import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const marketingCss = readFileSync(join(process.cwd(), "styles/marketing-site.css"), "utf8");

describe("marketing site foundation", () => {
  it("keeps shared public brand, header, button and footer styling", () => {
    expect(marketingCss).toContain(".public-root {");
    expect(marketingCss).toContain("--color-brand-primary: #2563eb");
    expect(marketingCss).toContain(".public-root .public-header {");
    expect(marketingCss).toContain(".public-root .button-primary {");
    expect(marketingCss).toContain(".public-root .public-footer {");
  });

  it("does not keep retired public UI selectors", () => {
    for (const retiredSelector of [
      "homepage-hero-product",
      "homepage-hero-feed",
      "homepage-hero-draft",
      "homepage-ai-orbit",
      "homepage-process-flow",
      "homepage-process-step",
      "homepage-outcomes",
      "homepage-faq-layout",
      "theme-toggle",
      "button-ghost",
      "public-brand-copy small",
      ".public-root .public-nav a::after",
      ".public-root .public-footer-logo .public-brand-mark",
    ]) {
      expect(marketingCss).not.toContain(retiredSelector);
    }
  });
});
