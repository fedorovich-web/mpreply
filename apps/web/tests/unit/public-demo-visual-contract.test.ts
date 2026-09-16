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

  it("uses the approved status icons in the large process timeline", () => {
    for (const icon of ["download", "search", "sparkles", "users", "check-circle"]) {
      expect(publicIcon).toContain(`"${icon}"`);
    }
    expect(demo).toContain("demo-process-event-icon");
    expect(demo).toContain('["download", "green", "Получено"');
    expect(demo).toContain('["search", "blue", "Анализ"');
    expect(demo).toContain('["sparkles", "purple", "AI-черновик"');
    expect(demo).toContain('["users", "purple", "Ожидает"');
    expect(demo).toContain('["check-circle", "green", "Отправлено"');
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

  it("renders the popular scenario badge inline instead of reusing pricing positioning", () => {
    expect(demo).toContain("demo-scenario-popular");
    expect(demo).not.toContain('<span className="pricing-popular">Популярный</span>');
    expect(finalCss).toContain(".demo-scenario-popular");
  });

  it("matches the hero cards labels and hierarchy from the approved render", () => {
    expect(demo).toContain("demo-story-meta");
    expect(demo).toContain("Покупатель");
    expect(demo).toContain("5 мин назад");
    expect(demo).toContain("Предлагает ответ");
    expect(demo).toContain("Проверяете и отправляете");
    expect(demo).toContain("Отличный ответ!");
    expect(finalCss).toContain(".demo-story-meta");
    expect(finalCss).toContain(".demo-story-review-avatar");
  });

  it("left-aligns the first-step marketplace icons and uses the play icon in the demo action", () => {
    expect(publicIcon).toContain('"play"');
    expect(demo).toContain('name="play"');
    expect(finalCss).toContain(".demo-journey-marketplaces");
    expect(finalCss).toContain("margin-left: 0");
  });

  it("uses dedicated decorative fidelity styles", () => {
    expect(existsSync(decorativeCssPath)).toBe(true);
    expect(layout).toContain('import "../styles/public-mockup-decorative-fidelity.css"');
    expect(decorativeCss).toContain(".demo-journey-marketplaces");
    expect(decorativeCss).toContain(".demo-journey-marketplace-chip");
  });
});
