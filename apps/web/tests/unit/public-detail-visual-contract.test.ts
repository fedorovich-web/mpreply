import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const detail = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const decorativeCss = readFileSync(join(root, "styles/public-mockup-decorative-fidelity.css"), "utf8");
const finalCss = readFileSync(join(root, "styles/public-mockup-final-details.css"), "utf8");
const publicIcon = readFileSync(join(root, "components/public-site/PublicIcon.tsx"), "utf8");
const heroCssPath = join(root, "styles/public-detail-hero-fidelity.css");
const heroCss = existsSync(heroCssPath) ? readFileSync(heroCssPath, "utf8") : "";

describe("approved marketplace detail visual", () => {
  it("uses the real MPReply brand mark inside the product window", () => {
    expect(detail).toContain("PublicBrandMark");
    expect(detail).toContain("detail-app-brand");
  });

  it("keeps the marketplace-specific handwritten hero note", () => {
    expect(detail).toContain("detail-hero-note");
    expect(detail).toContain("Все обращения");
    expect(detail).toContain("в одном окне");
    expect(decorativeCss).toContain(".detail-hero-note");
  });

  it("does not make unsupported timing, realtime or universal-coverage claims", () => {
    expect(detail).not.toMatch(/пару минут|несколько минут|в реальном времени/i);
    expect(detail).not.toContain("Все отзывы, вопросы и сообщения");
    expect(detail).not.toContain("обрабатывайте все обращения покупателей");
    expect(detail).toContain("Доступные отзывы, вопросы и сообщения");
    expect(detail).toContain("доступные обращения покупателей");
  });

  it("matches the icon-led FAQ rows from the approved render", () => {
    expect(detail).toContain("detail-faq-summary");
    expect(detail).toContain("detail-faq-icon");
    expect(detail).toContain('["link", `Как подключить ${marketplace.name}?`');
    expect(detail).toContain('["users", "Можно ли добавить несколько сотрудников?"');
    expect(detail).toContain("Обновляются ли статусы обращений?");
    expect(finalCss).toContain(".detail-faq-summary");
    expect(finalCss).toContain(".detail-faq-icon");
  });

  it("keeps FAQ rows compact like the approved Wildberries render", () => {
    expect(heroCss).toContain(".detail-faq-summary");
    expect(heroCss).toContain("min-height: 46px");
    expect(heroCss).toContain(".detail-faq-icon");
    expect(heroCss).toContain("width: 28px");
    expect(heroCss).toContain("height: 28px");
  });

  it("renders the status FAQ as the filled check-circle shown in the approved render", () => {
    expect(heroCss).toContain("details:nth-of-type(3) .detail-faq-icon > .public-icon-image");
    expect(heroCss).toContain("display: none");
    expect(heroCss).toContain("details:nth-of-type(3) .detail-faq-icon::before");
    expect(heroCss).toContain("content: '✓'");
    expect(heroCss).toContain("border-radius: 999px");
  });

  it("renders the buyer metadata with the soft user badge shown in the approved hero card", () => {
    expect(detail).toContain("Покупатель · 12 мин назад");
    expect(heroCss).toContain(".detail-market-message strong");
    expect(heroCss).toContain(".detail-market-message strong::before");
    expect(heroCss).toContain("border-radius: 8px");
    expect(heroCss).toContain("background-image:");
    expect(heroCss).toContain("radial-gradient");
  });

  it("keeps the approved Wildberries app question card free of the extra context row", () => {
    expect(detail).toContain("Контекст товара и обращения уже доступен в рабочем окне.");
    expect(heroCss).toContain(':has(.marketplace-detail-logo[src$="/wildberries.webp"]) .detail-question > p');
    expect(heroCss).toContain("display: none");
  });

  it("keeps the CTA support badge truthful and compact", () => {
    expect(detail).toContain("<span>Поддержка ежедневно</span>");
    expect(detail).not.toContain("Поддержка 24/7");
    expect(detail).not.toContain("<span>Поддержка ежедневно 09:00–18:00 МСК</span>");
  });

  it("uses the play icon in the secondary hero action", () => {
    expect(publicIcon).toContain('"play"');
    expect(detail).toContain('name="play"');
  });

  it("uses compact marketplace marks inside the app question card", () => {
    for (const asset of [
      "wildberries-compact.webp",
      "ozon-compact.webp",
      "yandex-market-compact.webp",
      "avito-compact.webp",
    ]) {
      expect(detail).toContain(asset);
    }
    expect(detail).toContain("marketplace-detail-compact-logo");
    expect(detail).not.toContain("marketplace-detail-logo-small");
    expect(detail).not.toContain("detail-cta-bar");
  });

  it("uses the approved bubble and archive sidebar navigation glyphs", () => {
    expect(existsSync(heroCssPath)).toBe(true);
    expect(layout).toContain('import "../styles/public-detail-hero-fidelity.css"');
    expect(detail).toContain("detail-sidebar-item");
    for (const icon of ["inbox", "message", "chart", "archive", "users"]) {
      expect(publicIcon).toContain(`"${icon}"`);
    }
    expect(detail).toContain('<span className="detail-sidebar-item"><PublicIcon name="message" />Отзывы <b>6</b></span>');
    expect(detail).not.toContain('<span className="detail-sidebar-item"><PublicIcon name="star" />Отзывы <b>6</b></span>');
    expect(detail).toContain('<span className="detail-sidebar-item"><PublicIcon name="archive" />Шаблоны</span>');
    expect(heroCss).toContain(".detail-sidebar-item");
  });

  it("uses the approved product thumbnail asset instead of the fake gradient placeholder", () => {
    expect(detail).toContain('className="detail-product-thumb"');
    expect(heroCss).toContain(".detail-product-thumb");
    expect(heroCss).toContain('background-image: url("/images/mockups/product-shoe.webp")');
    expect(heroCss).toContain("background-size: cover");
    expect(heroCss).not.toContain("linear-gradient(145deg, #d7e4f7, #8797af)");
  });

  it("keeps the marketplace logo card white and draws the dotted handoff path from the render", () => {
    expect(heroCss).toContain(".detail-market-logo");
    expect(heroCss).toContain("background: #fff");
    expect(heroCss).toContain(".detail-market-card::after");
    expect(heroCss).toContain("border-bottom: 2px dashed");
  });
});
