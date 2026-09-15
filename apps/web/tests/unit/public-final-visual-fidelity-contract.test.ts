import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pricing = readFileSync(join(root, "app/pricing/page.tsx"), "utf8");
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");
const decorativeCss = readFileSync(join(root, "styles/public-mockup-decorative-fidelity.css"), "utf8");

describe("final approved render details", () => {
  it("keeps the pricing helper details from the approved mockup", () => {
    expect(pricing).toContain("pricing-hero-note");
    expect(pricing).toContain("pricing-custom-icon");
    expect(pricing).toContain('name="shield-check"');
    expect(pricing).toContain('href="/help"');
    expect(pricing).toContain("Все вопросы");
    expect(decorativeCss).toContain(".pricing-hero-note");
    expect(decorativeCss).toContain(".pricing-custom-icon");
  });

  it("renders the features benefit group as the soft rounded panel from the mockup", () => {
    expect(features).toContain("features-benefits-section");
    expect(decorativeCss).toContain(".features-benefits-section");
  });
});
