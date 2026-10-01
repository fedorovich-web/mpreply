import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { getMarketplaceDetailContent } from "../../lib/marketplace-detail-content";
import { getMarketplaceDetailContentEn } from "../../lib/marketplace-detail-content-en";

const root = process.cwd();
const detail = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const decorative = readFileSync(join(root, "styles/public-mockup-decorative-fidelity.css"), "utf8");
const finalCss = readFileSync(join(root, "styles/public-mockup-final-details.css"), "utf8");
const heroCss = readFileSync(join(root, "styles/public-detail-hero-fidelity.css"), "utf8");
const publicIcon = readFileSync(join(root, "components/public-site/PublicIcon.tsx"), "utf8");
const keys = ["wildberries", "ozon", "yandex-market", "avito"] as const;

describe("approved marketplace detail visual", () => {
  it("uses original Russian hero artwork and preserves the English live product window", () => {
    expect(detail).toContain('locale === "ru" ?');
    expect(detail).toContain("src={approvedHero.src}");
    expect(detail).toContain("width={approvedHero.width}");
    expect(detail).toContain("height={approvedHero.height}");
    expect(detail).toContain("unoptimized");
    expect(detail).toContain("PublicBrandMark");
    expect(detail).toContain("detail-app-brand");
    expect(detail).toContain("detail-app-window");
  });
  it("decodes each marketplace hero at its declared dimensions", async () => {
    for (const [asset, width, height] of [
      ["04-wildberries-hero-corrected.avif", 1736, 906],
      ["hero-ozon.avif", 1000, 563],
      ["hero-yandex-market.avif", 1000, 563],
      ["hero-avito.avif", 1000, 563],
    ] as const) {
      expect(detail).toContain("/images/approved/" + asset);
      const image = sharp(join(root, "public/images/approved", asset));
      expect(await image.metadata(), asset).toMatchObject({ width, height, compression: "av1" });
      await expect(image.raw().toBuffer(), asset).resolves.toBeInstanceOf(Buffer);
    }
  });
  it("keeps marketplace-specific annotations and sample context in the locale content", () => {
    for (const field of ["heroNote", "sampleType", "sampleContext", "sampleMessage"]) expect(detail).toContain("detailContent." + field);
    expect(decorative).toContain(".detail-hero-note");
    for (const key of keys) {
      for (const content of [getMarketplaceDetailContent(key), getMarketplaceDetailContentEn(key)]) {
        expect(content.heroNote).not.toBe("");
        expect(content.sampleContext).not.toBe("");
        expect(content.sampleReply).not.toBe("");
      }
    }
  });
  it("renders live FAQ rows with supplied semantic icons", () => {
    expect(detail).toContain("detailContent.faq.map");
    expect(detail).toContain("<details key={item.question}>");
    expect(detail).toContain('<summary className="detail-faq-summary">');
    expect(detail).toContain("<PublicIcon name={item.icon} />");
    expect(detail).toContain("<p>{item.answer}</p>");
    expect(finalCss).toContain(".detail-faq-icon");
    for (const key of keys) expect(getMarketplaceDetailContent(key).faq.length).toBeGreaterThanOrEqual(3);
  });
  it("preserves compact FAQ rows and the approved filled status icon", () => {
    for (const css of ["min-height: 46px", "width: 28px", "height: 28px", "details:nth-of-type(3) .detail-faq-icon > .public-icon-image", "details:nth-of-type(3) .detail-faq-icon::before", "content: '✓'", "border-radius: 999px"]) expect(heroCss).toContain(css);
  });
  it("scopes the Wildberries context-row geometry to its explicit page key", () => {
    expect(detail).toContain("marketplace-detail-page is-");
    expect(heroCss).toContain(".marketplace-detail-page.is-wildberries .detail-question > p");
    expect(heroCss).not.toContain(':has(.marketplace-detail-logo[src$="/wildberries.webp"])');
  });
  it("uses locale content for CTA terms without a support-hours badge", () => {
    expect(detail).toContain("detailContent.trustItems.map");
    for (const key of keys) expect(getMarketplaceDetailContent(key).trustItems.join(" ")).not.toMatch(/Поддержка.*(?:ежедневно|24\/7|09:00)/);
  });
  it("uses the shared play action and catalog-driven marketplace imagery", () => {
    expect(publicIcon).toContain('if (name === "play")');
    expect(detail).toContain('name="play"');
    expect(detail).toContain("src={logo.compactSrc}");
    for (const asset of ["01-wildberries.avif", "02-ozon.avif", "03-yandex-market.avif", "04-avito.avif"]) expect(detail).toContain(asset);
    expect(detail).toContain("/images/brands/avito-sign-logo.svg");
    expect(detail).not.toContain("marketplace-detail-logo-small");
  });
  it("renders marketplace-specific sidebar and sample visuals from detail content", () => {
    expect(detail).toContain("detailContent.sidebarItems.map");
    expect(detail).toContain("sampleVisualIcons[sampleVisual]");
    expect(detail).toContain("useApprovedProductCrop");
    expect(heroCss).toContain('background-image: url("/images/mockups/product-shoe.webp")');
    expect(heroCss).toContain("background-size: cover");
    expect(heroCss).not.toContain("linear-gradient(145deg, #d7e4f7, #8797af)");
  });
  it("loads the active detail geometry and keeps the dotted connector", () => {
    expect(layout).toContain('import "../styles/public-detail-hero-fidelity.css"');
    expect(heroCss).toContain(".detail-market-card::after");
    expect(heroCss).toContain("border-bottom: 2px dashed");
    expect(heroCss).toContain("@media (max-width: 720px)");
  });
});
