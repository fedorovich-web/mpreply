import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const tokens = readFileSync(join(root, "styles/tokens.css"), "utf8");
const publicCss = readFileSync(join(root, "styles/public-site.css"), "utf8");
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");
const marketplaces = readFileSync(join(root, "app/marketplaces/page.tsx"), "utf8");
const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");

describe("approved public mockup fidelity", () => {
  it("adds exactly 15px to public section vertical rhythm", () => {
    expect(tokens).toContain("--public-section-padding-extra: 15px");
    expect(publicCss).toContain("calc(var(--public-section-spacing) + var(--public-section-padding-extra))");
    expect(publicCss).toContain("calc(var(--space-16) + var(--public-section-padding-extra))");
  });

  it("keeps the full approved header navigation", () => {
    for (const route of ["/features", "/marketplaces", "/pricing", "/demo", "/help", "/contacts"]) {
      expect(siteConfig).toContain(`href: "${route}"`);
    }
  });

  it("implements the approved features composition rather than the old generic capability stack", () => {
    expect(features).toContain("features-mockup-hero");
    expect(features).toContain("features-tool-grid");
    expect(features).toContain("features-workflow");
    expect(features).toContain("features-benefit-grid");
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

  it("implements the approved marketplaces composition with four ready integrations", () => {
    expect(marketplaces).toContain("marketplaces-mockup-hero");
    expect(marketplaces).toContain("marketplace-logo-grid");
    expect(marketplaces).toContain("marketplace-benefits-grid");
    expect(marketplaces).toContain("marketplace-connect-steps");
    for (const name of ["Wildberries", "Ozon", "Яндекс Маркет", "Авито"]) expect(marketplaces).toContain(name);
  });
});
