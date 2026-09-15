import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const detail = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");
const decorativeCss = readFileSync(join(root, "styles/public-mockup-decorative-fidelity.css"), "utf8");
const finalCss = readFileSync(join(root, "styles/public-mockup-final-details.css"), "utf8");

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

  it("matches the icon-led FAQ rows from the approved render", () => {
    expect(detail).toContain("detail-faq-summary");
    expect(detail).toContain("detail-faq-icon");
    expect(detail).toContain('["link", `Как подключить ${marketplace.name}?`');
    expect(detail).toContain('["users", "Можно ли добавить несколько сотрудников?"');
    expect(detail).toContain('["shield-check", "Обновляются ли статусы обращений?"');
    expect(finalCss).toContain(".detail-faq-summary");
    expect(finalCss).toContain(".detail-faq-icon");
  });
});
