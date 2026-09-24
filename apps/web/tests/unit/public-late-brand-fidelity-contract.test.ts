import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const brandCss = readFileSync(join(root, "styles/public-mockup-brand-fidelity.css"), "utf8");
const blueCss = readFileSync(join(root, "styles/public-inner-blue-reference.css"), "utf8");

describe("late public brand normalization", () => {
  it("loads both blue brand layers in the intended cascade order", () => {
    const brandImport = 'import "../styles/public-mockup-brand-fidelity.css";';
    const blueImport = 'import "../styles/public-inner-blue-reference.css";';
    expect(layout.indexOf(brandImport)).toBeGreaterThan(-1);
    expect(layout.indexOf(blueImport)).toBeGreaterThan(layout.indexOf(brandImport));
    for (const source of [brandCss, blueCss]) {
      expect(source).toContain("#0b68f6");
      expect(source.toLowerCase()).not.toContain("#5148e8");
    }
  });

  it("normalizes live demo accents without retaining retired renderer selectors", () => {
    expect(brandCss).toContain(".demo-scenario-popular");
    expect(blueCss).toContain(".demo-story-review-bubble");
    for (const retired of [
      ".features-draft-card",
      ".detail-cta-bar",
      ".demo-cta-bar",
      ".pricing-toggle",
      ".pricing-popular",
      ".pricing-market-chip",
      ".pricing-card.is-popular",
    ]) {
      expect(brandCss).not.toContain(retired);
      expect(blueCss).not.toContain(retired);
    }
  });
});
