import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const mockupCss = readFileSync(join(root, "styles/public-mockup-fidelity.css"), "utf8");
const spacingCss = readFileSync(join(root, "styles/public-section-spacing.css"), "utf8");
const tuningCss = readFileSync(join(root, "styles/public-mockup-render-tuning.css"), "utf8");
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");
const marketplaces = readFileSync(join(root, "app/marketplaces/page.tsx"), "utf8");
const marketplaceLanding = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");
const pricing = readFileSync(join(root, "app/pricing/page.tsx"), "utf8");
const demo = readFileSync(join(root, "app/demo/page.tsx"), "utf8");
const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");
const publicIconPath = join(root, "components/public-site/PublicIcon.tsx");
const publicIcon = existsSync(publicIconPath) ? readFileSync(publicIconPath, "utf8") : "";
const brandFidelityPath = join(root, "styles/public-mockup-brand-fidelity.css");
const brandFidelityCss = existsSync(brandFidelityPath) ? readFileSync(brandFidelityPath, "utf8") : "";

describe("approved public mockup fidelity", () => {
  it("adds exactly 15px to the render-derived public section rhythm", () => {
    expect(layout).toContain('import "../styles/public-mockup-fidelity.css"');
    expect(layout).toContain('import "../styles/public-section-spacing.css"');
    expect(layout).toContain('import "../styles/public-mockup-render-tuning.css"');
    expect(mockupCss).toContain("--public-section-padding-extra: 15px");
    expect(spacingCss).toContain(".public-cta-section");
    expect(tuningCss).toContain("--mockup-section-base-spacing: 38px");
    expect(tuningCss).toContain("calc(var(--mockup-section-base-spacing) + var(--public-section-padding-extra))");
    for (const hero of [".mockup-hero", ".marketplace-detail-mockup-hero", ".pricing-mockup-hero", ".demo-mockup-hero"]) {
      expect(tuningCss).toContain(hero);
    }
  });

  it("keeps render-scale desktop typography and container proportions", () => {
    expect(tuningCss).toContain("--container-max-width: 1120px");
    expect(tuningCss).toContain("--public-header-height: 56px");
    expect(tuningCss).toContain("clamp(2.35rem, 3.8vw, 3.25rem)");
    expect(tuningCss).toContain("clamp(1.85rem, 2.6vw, 2.45rem)");
  });

  it("uses the approved MPReply violet gradient on mockup pages without turquoise", () => {
    expect(existsSync(brandFidelityPath)).toBe(true);
    expect(layout).toContain('import "../styles/public-mockup-brand-fidelity.css"');
    for (const color of ["#5148e8", "#635bff", "#5964ff"]) expect(brandFidelityCss.toLowerCase()).toContain(color);
    expect(brandFidelityCss.toLowerCase()).not.toContain("#0ea5e9");
    expect(brandFidelityCss).toContain("linear-gradient(110deg");
    expect(brandFidelityCss).toContain(".public-root:has(.mockup-page)");
  });

  it("keeps the full approved header navigation", () => {
    for (const route of ["/features", "/marketplaces", "/pricing", "/demo", "/help", "/contacts"]) {
      expect(siteConfig).toContain(`href: "${route}"`);
    }
  });

  it("keeps public claims inside current product truth", () => {
    expect(marketplaceLanding).not.toContain("Поддержка 24/7");
    expect(pricing).not.toContain("до 5 маркетплейсов");
    expect(pricing).toContain("до 4 маркетплейсов");
    expect(pricing).toContain("Поддерживаем ключевые маркетплейсы");
  });

  it("uses one reusable polished SVG icon component instead of unicode glyph icons", () => {
    expect(existsSync(publicIconPath)).toBe(true);
    for (const name of ["inbox", "sparkles", "shield-check", "lightning", "document", "chart", "users", "clock", "sync", "link", "gear", "send", "star"]) {
      expect(publicIcon).toContain(`\"${name}\"`);
    }
    for (const page of [features, marketplaces, marketplaceLanding, demo]) {
      expect(page).toContain("PublicIcon");
    }
    for (const glyph of ["✉", "✦", "ϟ", "▤", "▥", "◷", "⚙", "↻"]) {
      expect(features).not.toContain(glyph);
      expect(marketplaces).not.toContain(glyph);
      expect(marketplaceLanding).not.toContain(glyph);
      expect(demo).not.toContain(glyph);
    }
  });

  it("implements the approved features composition rather than the old generic capability stack", () => {
    expect(features).toContain("features-mockup-hero");
    expect(features).toContain("features-tool-grid");
    expect(features).toContain("features-workflow");
    expect(features).toContain("features-benefit-grid");
    expect(features).toContain("Все возможности MPReply для работы с обращениями покупателей");
    for (const label of [
      "Единая очередь обращений",
      "AI-подготовка ответов",
      "Контроль качества",
      "Автоответы и сценарии",
      "Шаблоны ответов",
      "Аналитика",
      "Командная работа",
      "История действий",
    ]) expect(features).toContain(label);
  });

  it("uses real marketplace logo assets and benefit icon chips on features", () => {
    for (const asset of ["wildberries.webp", "ozon.webp", "yandex-market.webp", "avito.webp"]) {
      expect(features).toContain(asset);
    }
    expect(features).not.toContain("WB · Ozon · M · Avito");
    expect(features).toContain("features-benefit-icon");
  });

  it("implements the approved marketplaces composition with four real logo assets", () => {
    expect(marketplaces).toContain("marketplaces-mockup-hero");
    expect(marketplaces).toContain("marketplace-logo-grid");
    expect(marketplaces).toContain("marketplace-benefits-grid");
    expect(marketplaces).toContain("marketplace-connect-steps");
    for (const asset of ["wildberries.webp", "ozon.webp", "yandex-market.webp", "avito.webp"]) expect(marketplaces).toContain(asset);
  });

  it("implements the approved marketplace detail composition", () => {
    expect(marketplaceLanding).toContain("marketplace-detail-mockup-hero");
    expect(marketplaceLanding).toContain("marketplace-detail-tools");
    expect(marketplaceLanding).toContain("marketplace-detail-steps");
    expect(marketplaceLanding).toContain("marketplace-detail-benefits");
    expect(marketplaceLanding).toContain("marketplace-detail-faq");
    for (const label of ["Единая очередь обращений", "AI-черновик ответа", "Контроль качества", "История действий"]) {
      expect(marketplaceLanding).toContain(label);
    }
  });

  it("implements pricing as coded plan cards, not a raster pricing image", () => {
    expect(pricing).toContain("pricing-mockup-hero");
    expect(pricing).toContain("pricing-card-grid");
    expect(pricing).toContain("pricing-comparison");
    expect(pricing).toContain("pricing-faq");
    expect(pricing).toContain("Простые и выгодные тарифы");
    expect(pricing).toContain("Ежегодно · -20%");
    for (const price of ["490 ₽", "990 ₽", "1 990 ₽"]) expect(pricing).toContain(price);
    for (const plan of ["Старт", "Профессиональный", "Бизнес"]) expect(pricing).toContain(plan);
  });

  it("implements the approved demo story and exact journey structure", () => {
    expect(demo).toContain("demo-mockup-hero");
    expect(demo).toContain("demo-journey");
    expect(demo).toContain("demo-scenarios");
    expect(demo).toContain("demo-process");
    expect(demo).toContain("demo-team-tools");
    expect(demo).toContain("Посмотрите, как MPReply ведёт обращение от получения до ответа");
    expect(demo).toContain("Попробуйте разные сценарии");
    expect(demo).toContain("Одно обращение — весь процесс наглядно");
    expect(demo).toContain("Что увидит ваша команда");
    for (const label of ["Получение обращения", "Анализ контекста", "AI-черновик", "Проверка и отправка"]) {
      expect(demo).toContain(label);
    }
  });
});
