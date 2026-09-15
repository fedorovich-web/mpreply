import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const demo = readFileSync(join(root, "app/demo/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const publicIcon = readFileSync(join(root, "components/public-site/PublicIcon.tsx"), "utf8");
const decorativeCssPath = join(root, "styles/public-mockup-decorative-fidelity.css");
const decorativeCss = existsSync(decorativeCssPath) ? readFileSync(decorativeCssPath, "utf8") : "";
const finalCss = readFileSync(join(root, "styles/public-mockup-final-details.css"), "utf8");

describe("approved demo journey visual", () => {
  it("shows all four ready marketplace logos in the first journey step", () => {
    expect(demo).toContain("demo-journey-marketplaces");
    for (const asset of ["wildberries.webp", "ozon.webp", "yandex-market.webp", "avito.webp"]) {
      expect(demo).toContain(asset);
    }
  });

  it("uses the message bubble icon and render-accurate team tool tones", () => {
    expect(publicIcon).toContain('"message"');
    expect(demo).toContain('["message", "Получение обращения"');
    expect(demo).toContain('["users", "purple", "Единая очередь обращений"');
    expect(demo).toContain('["document", "blue", "Шаблоны ответов"');
  });

  it("uses status icons instead of numbered circles in the large process timeline", () => {
    expect(publicIcon).toContain('"search"');
    expect(demo).toContain("demo-process-event-icon");
    expect(demo).toContain('["message", "green", "Получено"');
    expect(demo).toContain('["search", "blue", "Анализ"');
    expect(demo).toContain('["sparkles", "purple", "AI-черновик"');
    expect(demo).toContain('["users", "purple", "Ожидает"');
    expect(demo).toContain('["shield-check", "green", "Отправлено"');
    expect(finalCss).toContain(".demo-process-event-icon.green");
    expect(finalCss).toContain(".demo-process-event-icon.purple");
  });

  it("matches the approved full-process message and ready-answer cards", () => {
    expect(demo).toContain("12 мар 2024, 14:32");
    expect(demo).toContain("demo-process-buyer-message");
    expect(demo).toContain("Открыть в маркетплейсе");
    expect(demo).toContain("Готовый ответ");
    expect(demo).toContain("Посмотреть полностью");
    expect(demo).not.toContain("detail-product-row");
    expect(finalCss).toContain(".demo-process-buyer-message");
  });

  it("keeps scenario cards to logo, type, body copy and link like the render", () => {
    expect(demo).toContain("Примеры из реальной практики");
    expect(demo).toContain("Покупатель оставил отзыв на товар. Посмотрите, как MPReply помогает корректно и вежливо ответить.");
    expect(demo).toContain("Покупатель задаёт вопрос о товаре, доставке или наличии. Посмотрите, как MPReply формирует точный ответ.");
    expect(demo).toContain("Личное сообщение от покупателя. Посмотрите, как MPReply учитывает контекст и историю клиента.");
    expect(demo).not.toContain("scenario.title");
  });

  it("uses dedicated decorative fidelity styles", () => {
    expect(existsSync(decorativeCssPath)).toBe(true);
    expect(layout).toContain('import "../styles/public-mockup-decorative-fidelity.css"');
    expect(decorativeCss).toContain(".demo-journey-marketplaces");
    expect(decorativeCss).toContain(".demo-journey-marketplace-chip");
  });
});
