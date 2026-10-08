import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getMarketplaceDetailContent } from "../../lib/marketplace-detail-content";
import { getMarketplaceDetailContentEn } from "../../lib/marketplace-detail-content-en";
import { getMarketplaceConfig, type MarketplaceKey } from "../../lib/site-config";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const keys: MarketplaceKey[] = ["wildberries", "ozon", "yandex-market", "avito"];
const hub = read("app/marketplaces/page.tsx");

describe("public marketplace product contract", () => {
  it("exposes all four supported marketplaces without planned-state messaging in both locales", () => {
    for (const locale of ["ru", "en"] as const) {
      for (const key of keys) {
        const config = getMarketplaceConfig(key, locale);
        expect(config.path).toBe(`${locale === "en" ? "/en" : ""}/marketplaces/${key}`);
        expect(config.statusLabel).toBe(locale === "en" ? "MPReply integration" : "Интеграция MPReply");
      }
    }
    expect(hub).not.toMatch(/Планируется|в разработке|production-ready|roadmap/i);
  });

  it("keeps public metadata focused on the marketplace's communication intent", () => {
    expect(read("app/marketplaces/wildberries/page.tsx")).toContain("Отзывы и вопросы Wildberries");
    expect(read("app/marketplaces/ozon/page.tsx")).toContain("поддерживаемые обращения Ozon");
    expect(read("app/marketplaces/yandex-market/page.tsx")).toContain("поддерживаемые обращения Яндекс Маркета");
    expect(read("app/marketplaces/avito/page.tsx")).toContain("поддерживаемые диалоги по объявлениям Авито");
  });

  it("preserves automatic handling and review-required exceptions for every marketplace", () => {
    for (const key of keys) {
      const ru = JSON.stringify(getMarketplaceDetailContent(key));
      const en = JSON.stringify(getMarketplaceDetailContentEn(key));
      expect(ru).toMatch(/автоматическ|автоматиз/i);
      expect(ru).toMatch(/проверк/i);
      expect(en).toMatch(/automat/i);
      expect(en).toMatch(/review/i);
    }
  });

  it("preserves the approved AI auto-reply label on the marketplace hub", () => {
    expect(hub).toContain("ИИ-автоответы");
    expect(read("app/en/marketplaces/page.tsx")).toContain("AI auto-replies with context");
  });

  it("keeps the Avito scenario connected to listing and conversation context", () => {
    const detail = getMarketplaceDetailContent("avito");
    expect(detail.sampleType).toBe("Сообщение по объявлению");
    expect(detail.sampleVisual).toBe("listing");
    expect(detail.tools.some((tool) => tool.title === "Диалоги по объявлениям")).toBe(true);
    expect(detail.sampleContext).toMatch(/объявлен/i);
  });
});
