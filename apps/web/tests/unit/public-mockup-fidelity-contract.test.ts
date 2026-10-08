import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const layout = read("app/layout.tsx");
const spacing = read("styles/public-section-spacing.css");
const tuning = read("styles/public-mockup-render-tuning.css");
const tokens = read("styles/tokens.css");
const brand = read("styles/public-mockup-brand-fidelity.css");
const blue = read("styles/public-inner-blue-reference.css");
const features = read("app/features/page.tsx");
const marketplaces = read("app/marketplaces/page.tsx");
const detail = read("components/public-site/MarketplaceLanding.tsx");
const pricing = read("app/pricing/page.tsx");
const demo = read("app/demo/page.tsx");
const siteConfig = read("lib/site-config.ts");
const icon = read("components/public-site/PublicIcon.tsx");

describe("approved public composition and shared architecture", () => {
  it("applies the final common section rhythm after legacy fidelity layers", () => {
    expect(layout).toContain('import "../styles/public-mockup-fidelity.css"');
    expect(layout).toContain('import "../styles/public-mockup-render-tuning.css"');
    expect(layout.indexOf('import "../styles/public-section-spacing.css"')).toBeGreaterThan(layout.indexOf('import "../styles/public-mockup-render-tuning.css"'));
    expect(spacing).toContain("--public-section-padding-block: 96px");
    expect(spacing).toContain("--public-section-padding-block: 80px");
    expect(spacing).toContain("--public-section-padding-block: 64px");
    expect(spacing).toContain("padding-block: var(--public-section-padding-block)");
    for (const route of [".mockup-page > section", ".contacts-render-page > section", ".not-found-render-page > section", ".faq-page > section", ".legal-approved-layout"]) expect(spacing).toContain(route);
    expect(spacing).not.toContain("calc(");
  });
  it("uses the shared 1240px container rather than a page-specific width override", () => {
    expect(tokens).toContain("--container-max-width: 1240px");
    expect(tuning).not.toMatch(/--container-max-width\s*:/);
    expect(tuning).toContain("clamp(2.2rem, 2.9vw, 2.4rem)");
    expect(tuning).toContain("clamp(1.85rem, 2.6vw, 2.45rem)");
  });
  it("keeps both public brand layers on the canonical blue family", () => {
    expect(layout.indexOf('import "../styles/public-inner-blue-reference.css"')).toBeGreaterThan(layout.indexOf('import "../styles/public-mockup-brand-fidelity.css"'));
    for (const css of [brand, blue]) {
      expect(css).toContain("#0b68f6");
      expect(css).not.toMatch(/#(?:5148e8|635bff|5964ff)/i);
    }
  });
  it("keeps the full current public header navigation", () => {
    for (const route of ["/features", "/marketplaces", "/pricing", "/demo", "/help", "/contacts"]) expect(siteConfig).toContain('href: "' + route + '"');
  });
  it("keeps common chrome on every commercial composition", () => {
    for (const page of [features, marketplaces, detail, pricing]) {
      expect(page).toContain("PublicShell");
      expect(page).not.toContain("HomeApprovedShell");
      expect(page).not.toContain("mockup-eyebrow");
    }
    expect(existsSync(join(root, "components/public-site/HomeApprovedShell.tsx"))).toBe(false);
  });
  it("uses one reusable supplied icon component with the approved play vector", () => {
    for (const name of ["inbox", "sparkles", "shield-check", "lightning", "document", "chart", "users", "clock", "sync", "link", "gear", "send", "star"]) expect(icon).toContain('"' + name + '"');
    expect(icon).toContain("iconSources[name]");
    expect(icon).toContain('<circle cx="12" cy="12" r="9" />');
    for (const page of [features, marketplaces, detail]) {
      expect(page).toContain("PublicIcon");
      for (const glyph of ["✉", "✦", "ϟ", "▤", "▥", "◷", "⚙", "↻"]) expect(page).not.toContain(glyph);
    }
  });
  it("preserves the approved features composition with live tool, process and benefit cards", () => {
    for (const section of ["features-mockup-hero", "features-tool-grid", "features-workflow", "features-benefit-grid"]) expect(features).toContain(section);
    expect(features).toContain("Все возможности MPReply для работы с обращениями покупателей");
    expect(features).toContain("tools.map");
    expect(features).toContain("<h3>{tool.title}</h3>");
    expect(features).toContain("features-benefit-icon");
  });
  it("uses the supplied marketplace identity artwork on features and integrations", () => {
    for (const page of [features, marketplaces]) {
      for (const asset of ["01-wildberries.avif", "02-ozon.avif", "03-yandex-market.avif", "04-avito.avif"]) expect(page).toContain("/images/icons/final/" + asset);
    }
    expect(features).not.toContain("WB · Ozon · M · Avito");
  });
  it("preserves the marketplaces composition and real integration destinations", () => {
    for (const section of ["marketplaces-mockup-hero", "marketplace-logo-grid", "marketplace-benefits-grid", "marketplace-connect-steps"]) expect(marketplaces).toContain(section);
    expect(marketplaces).toContain('src="/images/approved/03-marketplaces-hero.avif"');
    expect(marketplaces).toContain("href={integration.path}");
  });
  it("uses marketplace-specific detail content for each coded section", () => {
    for (const section of ["marketplace-detail-mockup-hero", "marketplace-detail-tools", "marketplace-detail-steps", "marketplace-detail-benefits", "marketplace-detail-faq"]) expect(detail).toContain(section);
    expect(detail).toContain("getMarketplaceDetailContent(marketplace.key)");
    for (const field of ["tools", "steps", "benefits", "faq"]) expect(detail).toContain("detailContent." + field + ".map");
  });
  it("keeps pricing plans, comparison and FAQ in real HTML", () => {
    for (const section of ["pricing-mockup-hero", "pricing-card-grid", "pricing-comparison", "pricing-faq"]) expect(pricing).toContain(section);
    for (const price of ["1 290 ₽", "3 490 ₽", "6 990 ₽"]) expect(pricing).toContain(price);
    for (const plan of ["Старт", "Команда", "Бизнес", "Корпоративный"]) expect(pricing).toContain(plan);
    expect(pricing).toContain("При ежегодной оплате действует скидка 20%");
    expect(pricing).toContain("<table>");
  });
  it("opens the real readonly cabinet instead of the retired fictional demo story", () => {
    expect(demo).toContain('<DemoEntry locale="ru" />');
    expect(demo).toContain("robots: { index: false, follow: false }");
    expect(demo).not.toMatch(/demo-journey|demo-scenarios|demo-process|demo-team-tools/);
  });
});
