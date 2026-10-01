import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getMarketplaceDetailContent } from "../../lib/marketplace-detail-content";
import { getMarketplaceDetailContentEn } from "../../lib/marketplace-detail-content-en";
import type { MarketplaceKey } from "../../lib/site-config";

const root = process.cwd();
const landing = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");
const detailHeroStyles = readFileSync(join(root, "styles/public-detail-hero-fidelity.css"), "utf8");
const keys: MarketplaceKey[] = ["wildberries", "ozon", "yandex-market", "avito"];
const locales = [getMarketplaceDetailContent, getMarketplaceDetailContentEn];

describe("marketplace detail content contract", () => {
  it("defines distinct seller content for every supported marketplace in both locales", () => {
    for (const getContent of locales) {
      const pages = keys.map(getContent);
      expect(new Set(pages.map((page) => page.heroTitle)).size).toBe(keys.length);
      expect(new Set(pages.map((page) => page.heroDescription)).size).toBe(keys.length);
      expect(new Set(pages.map((page) => page.sampleMessage)).size).toBe(keys.length);
      expect(new Set(pages.map((page) => page.finalTitle)).size).toBe(keys.length);
      for (const page of pages) {
        expect(page.tools.length).toBeGreaterThanOrEqual(4);
        expect(page.steps).toHaveLength(4);
        expect(page.faq.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("uses product context for marketplace questions and listing context for Avito", () => {
    for (const getContent of locales) {
      for (const key of keys) {
        const page = getContent(key);
        expect(page.sampleVisual).toBe(key === "avito" ? "listing" : "product");
        for (const value of [page.sampleType, page.sampleMessage, page.sampleContext, page.sampleReply]) {
          expect(value.trim().length).toBeGreaterThan(0);
        }
      }
    }
    expect(getMarketplaceDetailContent("wildberries").sampleMessage).toContain("25 см");
    expect(getMarketplaceDetailContent("avito").sampleMessage).toMatch(/объявление/i);
    expect(landing).toContain("getMarketplaceDetailContent(marketplace.key)");
    expect(landing).toContain("getMarketplaceDetailContentEn(marketplace.key)");
  });

  it("keeps marketplace-specific samples bound to the code-driven renderer", () => {
    for (const field of ["sampleType", "sampleMessage", "sampleContext", "sampleReply"]) {
      expect(landing).toContain(`detailContent.${field}`);
    }
    expect(landing).not.toContain("Здравствуйте! Когда будет поставка этого товара?");
    expect(landing).not.toContain("Арт. 12345678");
  });

  it("keeps the approved product crop scoped to Wildberries", () => {
    expect(landing).toContain("detailContent.sampleVisual");
    expect(landing).toContain('marketplace.key === "wildberries" && sampleVisual === "product"');
    expect(landing).toContain("is-${marketplace.key}");
    expect(detailHeroStyles).toContain(".detail-product-thumb.is-product.is-wildberries");
    expect(detailHeroStyles).toContain('url("/images/mockups/product-shoe.webp")');
    expect(detailHeroStyles).toContain(".detail-product-thumb.is-product:not(.is-wildberries)");
  });

  it("keeps one active queue with unique sidebar labels per marketplace", () => {
    for (const getContent of locales) {
      for (const key of keys) {
        const items = getContent(key).sidebarItems;
        expect(items.filter((item) => item.active)).toHaveLength(1);
        expect(new Set(items.map((item) => item.label)).size).toBe(items.length);
        for (const item of items) {
          if (item.count !== undefined) expect(item.count).toBeGreaterThanOrEqual(0);
        }
      }
    }
    expect(landing).toContain("detailContent.sidebarItems.map");
    expect(landing).not.toContain("Отзывы <b>6</b>");
  });

  it("preserves the approved trial and both automatic and review workflows", () => {
    for (const key of keys) {
      const ru = getMarketplaceDetailContent(key);
      const en = getMarketplaceDetailContentEn(key);
      expect(ru.trustItems).toContain("14 дней бесплатно");
      expect(JSON.stringify(ru)).toMatch(/автоматическ|автоматиз/i);
      expect(JSON.stringify(ru)).toMatch(/проверк/i);
      expect(JSON.stringify(en)).toMatch(/14.day/i);
      expect(JSON.stringify(en)).toMatch(/automat/i);
      expect(JSON.stringify(en)).toMatch(/review/i);
    }
    expect(getMarketplaceDetailContent("wildberries").finalDescription).toContain("350 ИИ-ответов");
  });

  it("preserves owner-approved Wildberries templates and quality controls without certifying runtime", () => {
    const wb = JSON.stringify(getMarketplaceDetailContent("wildberries"));
    expect(wb).toContain("Создавайте и сохраняйте шаблоны ответов");
    expect(wb).toContain("Проверка тональности, грамотности и соответствия правилам Wildberries");
    expect(wb).not.toMatch(/aggregateRating|reviewCount|99[,.]9%/);
  });
});
