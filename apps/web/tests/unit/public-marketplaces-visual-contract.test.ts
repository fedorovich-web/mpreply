import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const marketplaces = readFileSync(join(root, "app/marketplaces/page.tsx"), "utf8");
const decorativeCss = readFileSync(join(root, "styles/public-mockup-decorative-fidelity.css"), "utf8");
const finalCss = readFileSync(join(root, "styles/public-mockup-final-details.css"), "utf8");
const publicIcon = readFileSync(join(root, "components/public-site/PublicIcon.tsx"), "utf8");

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
    expect(marketplaces).toContain("Одна очередь");
    expect(marketplaces).toContain("для команды");
    expect(marketplaces).toContain("marketplace-cta-note");
    expect(decorativeCss).toContain(".marketplace-hero-note-primary");
    expect(decorativeCss).toContain(".marketplace-hero-note-sales");
    expect(decorativeCss).toContain(".marketplace-cta-note");
  });

  it("uses four dotted connector arms like the approved hero", () => {
    for (const arm of ["l1", "l2", "l3", "l4"]) {
      expect(marketplaces).toContain(`marketplace-hub-line ${arm}`);
      expect(finalCss).toContain(`.marketplace-hub-line.${arm}`);
    }
  });

  it("uses separate logo and message cards for each marketplace", () => {
    expect(marketplaces).toContain("marketplace-hub-logo-card");
    expect(marketplaces).toContain("marketplace-hub-card-label");
    expect(marketplaces).toContain('name="message"');
    expect(marketplaces).toContain('name="inbox"');
    expect(finalCss).toContain(".marketplace-hub-logo-card");
    expect(finalCss).toContain(".marketplace-hub-card-label");
  });

  it("uses the circular brand check badges from the integration cards", () => {
    expect(finalCss).toContain(".marketplace-logo-card li::before");
    expect(finalCss).toContain("border-radius: 999px");
    expect(finalCss).toContain("background: var(--color-brand-soft)");
    expect(finalCss).toContain("color: var(--color-brand-primary)");
  });

  it("uses the play icon in the secondary hero action", () => {
    expect(publicIcon).toContain('"play"');
    expect(marketplaces).toContain('name="play"');
  });
});
