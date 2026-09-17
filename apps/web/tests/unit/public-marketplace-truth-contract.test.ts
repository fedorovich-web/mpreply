import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");

const hub = read("app/marketplaces/page.tsx");
const detail = read("lib/marketplace-detail-content.ts");
const siteConfig = read("lib/site-config.ts");
const wbPage = read("app/marketplaces/wildberries/page.tsx");
const ozonPage = read("app/marketplaces/ozon/page.tsx");
const yandexPage = read("app/marketplaces/yandex-market/page.tsx");
const avitoPage = read("app/marketplaces/avito/page.tsx");

const forbiddenAcrossPublicMarketplaceCopy = [
  "со всех маркетплейсов",
  "четыре готовые интеграции",
  "Интеграция готова",
  "Смотреть видео",
  "точные и персонализированные ответы",
  "настраивайте роли",
  "контролируйте нагрузку",
  "Шаблоны ответов",
  'label: "Шаблоны"',
  'label: "Команда"',
] as const;

describe("public marketplace truth contract", () => {
  it("does not claim runtime certification or unsupported generic capabilities", () => {
    const publicCopy = `${hub}\n${detail}\n${siteConfig}`;
    for (const phrase of forbiddenAcrossPublicMarketplaceCopy) {
      expect(publicCopy).not.toContain(phrase);
    }
    expect(hub).not.toContain("Сообщения и отзывы");
  });

  it("keeps Wildberries scoped to the adapter-verified reviews and questions workflow", () => {
    expect(detail).toContain('heroTitle: "Отзывы и вопросы Wildberries — в одном рабочем процессе"');
    expect(detail).not.toContain("отзывы, вопросы и сообщения Wildberries");
    expect(wbPage).toContain("Отзывы и вопросы Wildberries");
  });

  it("keeps Ozon and Yandex channel-neutral until runtime channel certification is available", () => {
    expect(detail).toContain('heroTitle: "Обращения Ozon — без постоянных переключений"');
    expect(detail).toContain('heroTitle: "Обращения Яндекс Маркета — в единой очереди"');
    expect(ozonPage).not.toContain("отзывы, вопросы и чаты");
    expect(yandexPage).not.toContain("Отзывы, вопросы и чаты");
  });

  it("uses a neutral product-surface status instead of a readiness badge", () => {
    expect(siteConfig).toContain('const marketplaceStatusLabel = "Интеграция MPReply"');
    expect(siteConfig).not.toContain('const marketplaceStatusLabel = "Интеграция готова"');
  });

  it("keeps the Avito public scenario qualified as supported buyer dialogs", () => {
    expect(avitoPage).toContain("поддерживаемые диалоги");
    expect(hub).toContain("Сообщения покупателей");
    expect(hub).not.toContain("Сообщения и отзывы");
  });
});
