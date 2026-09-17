import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const page = readFileSync(join(root, "app/page.tsx"), "utf8");

const expectedCopy = [
  "ИИ для продавцов на маркетплейсах",
  "Автоответы",
  "на отзывы, вопросы",
  "и сообщения",
  "покупателей",
  "Собирайте обращения с Wildberries, Ozon и Яндекс Маркета в одном окне.",
  "Попробовать бесплатно",
  "14 дней бесплатно",
  "Без карты",
  "ПОДДЕРЖИВАЕМ ВЕДУЩИЕ МАРКЕТПЛЕЙСЫ",
  "3 маркетплейса",
  "1 единое окно",
  "-70%",
  "времени на ответы",
  "ВСЕ ОБРАЩЕНИЯ В ОДНОМ ОКНЕ",
  "Отзывы, вопросы и сообщения — в едином пространстве",
  "СИЛА СОВРЕМЕННЫХ ИИ",
  "Используем лучшие нейросети для точных и естественных ответов",
  "GPT-5.6",
  "Claude Sonnet 5",
  "Gemini 3.8",
  "DeepSeek V4.1 Flash",
  "ПРОСТОЙ И ПОНЯТНЫЙ ПРОЦЕСС",
  "Как это работает",
  "РЕАЛЬНЫЕ РЕЗУЛЬТАТЫ",
  "Меньше рутины.",
  "Больше времени",
  "на развитие бизнеса.",
  "до 70%",
  "AI-модели для точных ответов",
  "НАЧНИТЕ СЕГОДНЯ",
  "Автоматизируйте коммуникацию с покупателями",
  "Подключите маркетплейсы и попробуйте все возможности сервиса бесплатно в течение 14 дней.",
] as const;

describe("approved homepage preview contract", () => {
  it("keeps the copy shown in the approved homepage reference", () => {
    for (const text of expectedCopy) expect(page).toContain(text);
  });

  it("keeps the approved homepage artwork", () => {
    expect(page).toContain('/images/mpreply-hero-ui.webp');
    expect(page).toContain('/images/mpreply-cta-ui.webp');
    expect(page).not.toContain('HomeHeroScene');
  });

  it("keeps the homepage marketplace story at three platforms", () => {
    expect(page).toContain('const homeMarketplaceKeys = ["wildberries", "ozon", "yandex-market"] as const;');
    expect(page).not.toContain('const homeMarketplaceKeys = ["wildberries", "ozon", "yandex-market", "avito"]');
  });
});
