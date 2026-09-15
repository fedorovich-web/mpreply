import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const pricing = readFileSync(join(root, "app/pricing/page.tsx"), "utf8");
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");
const finalCss = readFileSync(join(root, "styles/public-mockup-final-details.css"), "utf8");

describe("final approved render details", () => {
  it("loads the last visual override after all public mockup layers", () => {
    expect(layout).toContain('import "../styles/public-mockup-final-details.css"');
  });

  it("keeps the pricing helper details from the approved mockup", () => {
    expect(pricing).toContain("pricing-hero-note");
    expect(pricing).toContain("pricing-custom-icon");
    expect(pricing).toContain('name="shield-check"');
    expect(pricing).toContain('href="/help"');
    expect(pricing).toContain("Все вопросы");
    expect(pricing).not.toContain("<strong>{marketplace.name}</strong>");
    expect(finalCss).toContain(".pricing-hero-note");
    expect(finalCss).toContain(".pricing-custom-icon");
  });

  it("renders the features benefit group as the soft rounded panel from the mockup", () => {
    expect(features).toContain("features-benefit-grid");
    expect(finalCss).toContain(":has(.features-benefit-grid)");
  });
});
