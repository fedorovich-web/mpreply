import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const publicCss = readFileSync(join(process.cwd(), "styles/public-site.css"), "utf8");

describe("public site shared stylesheet", () => {
  it("keeps live shared shell, help, legal and contact primitives", () => {
    for (const selector of [
      ".public-subhero",
      ".public-mobile-navigation",
      ".public-footer",
      ".public-cta-card",
      ".legal-hero",
      ".legal-warning",
      ".contact-path",
    ]) {
      expect(publicCss).toContain(selector);
    }
  });

  it("does not keep retired homepage, theme or generic FAQ CSS", () => {
    for (const retiredSelector of [
      ".theme-toggle",
      ".public-hero-flow",
      ".hero-flow-canvas",
      ".hero-proof-row",
      ".signal-flow",
      ".operations-panel",
      ".feature-grid-editorial",
      ".public-status-planned",
      ".readiness-summary-planned",
      ".integration-status-panel-planned",
      ".faq-item",
    ]) {
      expect(publicCss).not.toContain(retiredSelector);
    }
  });
});
