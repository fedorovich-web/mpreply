import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const decorativeCss = readFileSync(join(root, "styles/public-mockup-decorative-fidelity.css"), "utf8");
const blueCss = readFileSync(join(root, "styles/public-inner-blue-reference.css"), "utf8");
const publicIcon = readFileSync(join(root, "components/public-site/PublicIcon.tsx"), "utf8");
const sidebarCssPath = join(root, "styles/public-features-sidebar-fidelity.css");
const sidebarCss = existsSync(sidebarCssPath) ? readFileSync(sidebarCssPath, "utf8") : "";

describe("approved features hero console", () => {
  it("uses the sidebar plus unified queue composition from the current renderer", () => {
    expect(features).toContain("features-app-sidebar");
    expect(features).toContain("features-app-brand");
    expect(features).toContain("PublicBrandMark");
    expect(features).toContain("features-app-main");
    expect(features).not.toContain("features-draft-pane");
    expect(features).not.toContain("features-draft-card");
  });

  it("keeps the grounded handwritten annotations", () => {
    expect(features).toContain("features-hero-note-primary");
    expect(features).toContain("Все обращения");
    expect(features).toContain("features-hero-note-ai");
    expect(features).toContain("Ответы с контекстом");
    expect(features).not.toContain("Быстрые и точные ответы");
    expect(decorativeCss).toContain(".features-hero-note-primary");
    expect(decorativeCss).toContain(".features-hero-note-ai");
  });

  it("uses compact WebP marketplace marks from the approved render", () => {
    for (const asset of [
      "wildberries-compact.webp",
      "ozon-compact.webp",
      "yandex-market-compact.webp",
      "avito-compact.webp",
    ]) expect(features).toContain(asset);
    expect(features).toContain("CompactMarketplaceLogo");
  });

  it("uses current icon-led sidebar navigation", () => {
    expect(existsSync(sidebarCssPath)).toBe(true);
    expect(layout).toContain('import "../styles/public-features-sidebar-fidelity.css"');
    for (const icon of ["inbox", "message", "chart", "lightning", "shield-check"]) {
      expect(features).toContain(`name="${icon}"`);
      expect(publicIcon).toContain(`"${icon}"`);
    }
    expect(features).not.toContain(">Шаблоны</span>");
    expect(sidebarCss).toContain(".features-app-nav-item");
  });

  it("uses the canonical final blue layer after older fidelity layers", () => {
    const brandImport = 'import "../styles/public-mockup-brand-fidelity.css";';
    const blueImport = 'import "../styles/public-inner-blue-reference.css";';
    expect(layout.indexOf(blueImport)).toBeGreaterThan(layout.indexOf(brandImport));
    expect(blueCss).toContain(".public-root:not(.homepage-reference-root)");
    expect(blueCss).toContain(".mockup-page .features-app-nav strong");
    expect(blueCss).toContain("#0b68f6");
  });
});
