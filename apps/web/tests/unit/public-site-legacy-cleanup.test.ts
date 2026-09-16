import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const publicCss = readFileSync(join(process.cwd(), "styles/public-site.css"), "utf8");

describe("public site shared stylesheet", () => {
  it("keeps live shared public route primitives", () => {
    for (const selector of [
      ".public-subhero",
      ".capability-stack",
      ".product-console",
      ".operations-live-dot",
      ".public-mobile-navigation",
      ".public-footer",
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
