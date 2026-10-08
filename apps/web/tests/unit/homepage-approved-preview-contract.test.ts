import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const page = readFileSync(join(root, "app/page.tsx"), "utf8");
const shell = readFileSync(join(root, "components/public-site/PublicShell.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const referenceCss = readFileSync(join(root, "styles/homepage-reference-restore.css"), "utf8");
const visiblePage = page.replace(/<br\s*\/>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("approved homepage composition with shared public chrome", () => {
  it("keeps the approved headline, workspace and connected process as live content", () => {
    for (const text of ["Автоответы", "на отзывы, вопросы", "и сообщения", "покупателей", "Попробовать бесплатно", "14 дней бесплатно", "Как это работает", "Меньше рутины.", "Автоматизируйте", "коммуникацию с покупателями"]) expect(visiblePage).toContain(text);
    expect(page).toContain("<HomeWorkspaceTabs />");
    expect(page).toContain('className="homepage-horizontal-process"');
    expect(page.match(/className="homepage-horizontal-step"/g)).toHaveLength(4);
  });
  it("uses the supplied original hero and CTA artwork", () => {
    for (const asset of ["01-home-hero.avif", "04-marketplaces-cta.avif"]) {
      expect(page).toContain("/images/approved/" + asset);
      expect(existsSync(join(root, "public/images/approved", asset))).toBe(true);
    }
    expect(page).not.toContain("HomeHeroScene");
  });
  it("shows all four supported marketplaces", () => {
    expect(page).toContain('const homeMarketplaceKeys = ["wildberries", "ozon", "yandex-market", "avito"] as const;');
    expect(page).toContain("homeMarketplaces.map");
  });
  it("uses the common header and footer without restoring the retired homepage shell", () => {
    expect(page).toContain("<PublicShell home>");
    expect(shell).toContain("<PublicHeader locale={locale} />");
    expect(shell).toContain("<PublicFooter locale={locale} />");
    expect(existsSync(join(root, "components/public-site/HomeApprovedShell.tsx"))).toBe(false);
  });
  it("keeps the homepage blue reference layer after the shared mockup brand layer", () => {
    expect(referenceCss).toContain(".homepage-reference-root");
    expect(referenceCss).toContain("--homepage-brand: #0b68f6");
    expect(layout.indexOf('import "../styles/homepage-reference-restore.css";')).toBeGreaterThan(layout.indexOf('import "../styles/public-mockup-brand-fidelity.css";'));
  });
});
