import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const blue = readFileSync(join(root, "styles/public-inner-blue-reference.css"), "utf8");

describe("public inner blue completeness contract", () => {
  it("covers live late-fidelity surfaces that previously retained lavender chrome", () => {
    for (const selector of [
      ".mockup-page .public-section:has(.features-benefit-grid)",
      ".mockup-page .demo-story-review-bubble",
      ".mockup-page .demo-process-avatar",
      ".mockup-page .demo-process-buyer-message p",
    ]) {
      expect(blue).toContain(selector);
    }
  });

  it("does not retain selectors for pricing widgets removed from the current renderer", () => {
    for (const selector of [
      ".pricing-final-review",
      ".pricing-final-answer",
      ".pricing-custom-icon",
      ".pricing-hero-note",
      ".pricing-toggle",
      ".pricing-popular",
      ".pricing-final-sparkle",
      ".pricing-final-logo-chip",
      ".pricing-market-chip",
      ".pricing-faq-heading",
    ]) {
      expect(blue).not.toContain(selector);
    }
  });

  it("uses the canonical homepage blue family for live inner-page surfaces", () => {
    for (const value of ["#dceafa", "#eaf4ff", "#eef6ff", "#f7fbff", "rgb(11 104 246 / 10%)"]) {
      expect(blue).toContain(value);
    }
  });

  it("does not reintroduce the legacy violet family into the canonical inner layer", () => {
    for (const value of ["#5148e8", "#443bcf", "#635bff", "#5964ff", "#6d37eb", "#4338ca", "#8b5cf6", "#4f46e5", "#e6e4ff", "#f1efff", "#e7e5ff"]) {
      expect(blue.toLowerCase()).not.toContain(value);
    }
  });
});
