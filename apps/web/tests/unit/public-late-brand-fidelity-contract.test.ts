import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const brandCss = readFileSync(join(root, "styles/public-mockup-brand-fidelity.css"), "utf8");
const blueCss = readFileSync(join(root, "styles/public-inner-blue-reference.css"), "utf8");

describe("late public brand normalization", () => {
  it("loads the canonical blue guard after the historical mockup fidelity layer", () => {
    const brandImport = 'import "../styles/public-mockup-brand-fidelity.css";';
    const blueImport = 'import "../styles/public-inner-blue-reference.css";';
    expect(layout.indexOf(brandImport)).toBeGreaterThan(-1);
    expect(layout.indexOf(blueImport)).toBeGreaterThan(layout.indexOf(brandImport));
    expect(brandCss).toContain("#5148e8");
    expect(blueCss).toContain("#0b68f6");
  });

  it("normalizes live demo accents in the final cascade without retired pricing selectors", () => {
    expect(blueCss).toContain(".mockup-page .demo-scenario-popular");
    expect(blueCss).toContain(".mockup-page .demo-story-review-bubble");
    expect(blueCss).not.toContain(".pricing-final-review");
    expect(blueCss).not.toContain(".pricing-final-answer");
  });
});
