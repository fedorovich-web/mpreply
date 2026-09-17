import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const content = readFileSync(join(root, "lib/marketplace-detail-content.ts"), "utf8");
const landing = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");

describe("marketplace detail content contract", () => {
  it("defines distinct content for every supported marketplace", () => {
    for (const key of ["wildberries", "ozon", "yandex-market", "avito"]) {
      expect(content).toContain(`${key}:`);
    }

    for (const heading of [
      "Отзывы и вопросы Wildberries — в одном рабочем процессе",
      "Отзывы, вопросы и чаты Ozon — без постоянных переключений",
      "Отзывы, вопросы и чаты Яндекс Маркета — в единой очереди",
      "Сообщения покупателей Авито — в общем рабочем пространстве",
    ]) {
      expect(content).toContain(heading);
    }
  });

  it("uses marketplace-specific communication scenarios instead of a name-substitution template", () => {
    expect(content).toContain("Ждут ответа");
    expect(content).toContain("Отзывы и вопросы");
    expect(content).toContain("чаты по заказам и возвратам");
    expect(content).toContain("диалоги по объявлениям");

    expect(landing).toContain("getMarketplaceDetailContent(marketplace.key)");
    expect(landing).not.toContain("Работайте с обращениями {marketplace.name} быстрее");
  });

  it("keeps public claims within the approved product and trial boundary", () => {
    for (const unsupportedClaim of [
      "Без карты",
      "Быстрое подключение",
      "лучших результатов",
      "Смотреть видео",
      "просто и безопасно",
    ]) {
      expect(landing).not.toContain(unsupportedClaim);
      expect(content).not.toContain(unsupportedClaim);
    }

    expect(content).toContain("14 дней");
    expect(content).toContain("автоматически или после проверки");
  });

  it("keeps the renderer shared and typed by marketplace key", () => {
    expect(content).toContain("Record<MarketplaceKey, MarketplaceDetailContent>");
    expect(content).toContain("export function getMarketplaceDetailContent");
    expect(landing).toContain("const detailContent = getMarketplaceDetailContent(marketplace.key)");
  });
});
