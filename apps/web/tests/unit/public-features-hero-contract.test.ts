import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const decorativeCss = readFileSync(join(root, "styles/public-mockup-decorative-fidelity.css"), "utf8");
const marketingPagesCss = readFileSync(join(root, "styles/marketing-pages.css"), "utf8");
const publicIcon = readFileSync(join(root, "components/public-site/PublicIcon.tsx"), "utf8");
const sidebarCssPath = join(root, "styles/public-features-sidebar-fidelity.css");
const sidebarCss = existsSync(sidebarCssPath) ? readFileSync(sidebarCssPath, "utf8") : "";

function selectorBlock(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`).exec(source);
  if (!match?.[1]) throw new Error(`Missing selector: ${selector}`);
  return match[1];
}

describe("approved features hero console", () => {
  it("uses the sidebar plus unified queue composition from the render", () => {
    expect(features).toContain("features-app-sidebar");
    expect(features).toContain("features-app-brand");
    expect(features).toContain("PublicBrandMark");
    expect(features).toContain("features-app-main");
    expect(features).not.toContain("features-draft-pane");
    expect(features).not.toContain("features-draft-card");
  });

  it("keeps both handwritten annotations from the approved hero", () => {
    expect(features).toContain("features-hero-note-primary");
    expect(features).toContain("Все обращения");
    expect(features).toContain("features-hero-note-ai");
    expect(features).toContain("Быстрые и точные ответы");
    expect(decorativeCss).toContain(".features-hero-note-primary");
    expect(decorativeCss).toContain(".features-hero-note-ai");
  });

  it("uses the compact marketplace marks from the approved render", () => {
    for (const asset of [
      "wildberries-compact.webp",
      "ozon-compact.webp",
      "yandex-market-compact.webp",
      "avito-compact.webp",
    ]) {
      expect(features).toContain(asset);
    }
    expect(features).toContain("CompactMarketplaceLogo");
  });

  it("uses the play icon in the secondary demo action", () => {
    expect(publicIcon).toContain('"play"');
    expect(features).toContain('name="play"');
  });

  it("uses icon-led sidebar navigation like the approved console", () => {
    expect(existsSync(sidebarCssPath)).toBe(true);
    expect(layout).toContain('import "../styles/public-features-sidebar-fidelity.css"');
    expect(features).toContain("features-app-nav-item");
    for (const icon of ["inbox", "star", "message", "chart", "document", "users"]) {
      expect(features).toContain(`name="${icon}"`);
    }
    expect(sidebarCss).toContain(".features-app-nav-item");
  });

  it("routes generic secondary-page accents through the violet MPReply brand", () => {
    const subhero = selectorBlock(marketingPagesCss, ".public-root .public-subhero");
    expect(subhero).toContain("rgb(81 72 232 / 9%)");
    expect(subhero).toContain("rgb(99 91 255 / 6%)");
    expect(subhero).not.toContain("rgb(14 165 233");
    expect(subhero).not.toContain("rgb(37 99 235");

    expect(selectorBlock(marketingPagesCss, ".features-hero-card-head strong")).toContain(
      "background: var(--color-brand-soft)",
    );
    expect(selectorBlock(marketingPagesCss, ".features-hero-card-head strong")).toContain(
      "color: var(--color-brand-text-on-soft)",
    );
    expect(selectorBlock(marketingPagesCss, ".features-hero-draft-title > span")).toContain(
      "color: var(--color-brand-primary)",
    );
    expect(selectorBlock(marketingPagesCss, ".features-hero-draft-actions b")).toContain(
      "background: var(--color-brand-primary)",
    );
    expect(selectorBlock(marketingPagesCss, ".public-root .public-cta-card")).toContain("rgb(99 91 255 / 28%)");
  });

  it("does not recolor marketplace identity marks during the secondary-page brand migration", () => {
    expect(selectorBlock(marketingPagesCss, ".features-hero-sources .is-wb")).toContain(
      "background: linear-gradient(135deg, #8d1ad7, #cd22a4)",
    );
    expect(selectorBlock(marketingPagesCss, ".features-hero-sources .is-ozon")).toContain("background: #1268f4");
    expect(selectorBlock(marketingPagesCss, ".features-hero-sources .is-market")).toContain("background: #ffd229");
    expect(selectorBlock(marketingPagesCss, ".features-hero-sources .is-avito")).toContain("background: #edf4ff");
    expect(selectorBlock(marketingPagesCss, ".features-hero-sources .is-avito")).toContain("color: #2169df");
  });
});
