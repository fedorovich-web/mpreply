import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const marketplaces = readFileSync(join(root, "app/marketplaces/page.tsx"), "utf8");
const decorativeCss = readFileSync(join(root, "styles/public-mockup-decorative-fidelity.css"), "utf8");

describe("approved marketplaces hero visual", () => {
  it("uses the real MPReply brand mark in the central hub", () => {
    expect(marketplaces).toContain("PublicBrandMark");
    expect(marketplaces).toContain("marketplace-hub-brand");
    expect(marketplaces).not.toContain('<div className="marketplace-hub-core">MPReply</div>');
  });

  it("keeps the handwritten annotations from the approved render", () => {
    expect(marketplaces).toContain("marketplace-hero-note-primary");
    expect(marketplaces).toContain("Все обращения");
    expect(marketplaces).toContain("в одном окне");
    expect(marketplaces).toContain("marketplace-hero-note-sales");
    expect(marketplaces).toContain("Больше продаж");
    expect(marketplaces).toContain("marketplace-cta-note");
    expect(decorativeCss).toContain(".marketplace-hero-note-primary");
    expect(decorativeCss).toContain(".marketplace-hero-note-sales");
    expect(decorativeCss).toContain(".marketplace-cta-note");
  });
});
