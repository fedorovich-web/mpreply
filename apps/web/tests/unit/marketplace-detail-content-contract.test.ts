import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const content = readFileSync(join(root, "lib/marketplace-detail-content.ts"), "utf8");
const landing = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");
const detailHeroStyles = readFileSync(join(root, "styles/public-detail-hero-fidelity.css"), "utf8");

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

  it("renders a distinct marketplace-specific sample inside the hero product UI", () => {
    for (const field of ["sampleType", "sampleMessage", "sampleContext", "sampleReply"]) {
      expect(content).toContain(`${field}: string`);
      expect(landing).toContain(`detailContent.${field}`);
    }

    for (const sampleType of [
      "Вопрос о товаре",
      "Отзыв покупателя",
      "Чат по заказу",
      "Сообщение по объявлению",
    ]) {
      expect(content).toContain(sampleType);
    }

    const normalizedContent = content.toLowerCase();
    for (const sampleFragment of [
      "на стопу 25 см",
      "хорошо упакован",
      "изменить адрес доставки",
      "объявление ещё актуально",
    ]) {
      expect(normalizedContent).toContain(sampleFragment.toLowerCase());
    }

    expect(landing).not.toContain("Здравствуйте! Когда будет поставка этого товара?");
    expect(landing).not.toContain("Арт. 12345678");
  });

  it("renders a context-specific visual instead of showing the shoe for every marketplace", () => {
    expect(content).toContain('sampleVisual: "product" | "review" | "order" | "listing"');
    for (const visual of ["product", "review", "order", "listing"]) {
      expect(content).toContain(`sampleVisual: "${visual}"`);
    }

    expect(landing).toContain("detailContent.sampleVisual");
    expect(landing).toContain("sampleVisualIcons");
    expect(detailHeroStyles).toContain(".detail-product-thumb.is-product");
    expect(detailHeroStyles).toContain('url("/images/mockups/product-shoe.webp")');
    expect(detailHeroStyles).toContain(".detail-product-thumb:not(.is-product)");
    expect(landing).not.toContain('<span className="detail-product-thumb" aria-hidden="true" />');
  });

  it("renders marketplace-specific sidebar composition and active queue", () => {
    expect(content).toContain("export type MarketplaceDetailSidebarItem");
    expect(content).toContain("sidebarItems: readonly MarketplaceDetailSidebarItem[]");
    expect(landing).toContain("detailContent.sidebarItems.map");
    expect(landing).toContain("item.active ? \"detail-sidebar-item is-active\" : \"detail-sidebar-item\"");

    for (const sidebarLabel of [
      'label: "Отзывы"',
      'label: "Вопросы"',
      'label: "Чаты"',
      'label: "Новые диалоги"',
    ]) {
      expect(content).toContain(sidebarLabel);
    }

    expect(content.match(/active: true/g)?.length).toBe(4);
    expect(landing).not.toContain("Отзывы <b>6</b>");
    expect(landing).not.toContain("Вопросы <b>8</b>");
    expect(landing).not.toContain("Сообщения <b>10</b>");
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
    expect(content).toMatch(/автоматически или после проверки/i);
  });

  it("keeps the renderer shared and typed by marketplace key", () => {
    expect(content).toContain("Record<MarketplaceKey, MarketplaceDetailContent>");
    expect(content).toContain("export function getMarketplaceDetailContent");
    expect(landing).toContain("const detailContent = getMarketplaceDetailContent(marketplace.key)");
  });
});