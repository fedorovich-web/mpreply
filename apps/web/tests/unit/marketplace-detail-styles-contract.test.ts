import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "styles/marketplace-detail-approved.css"), "utf8");

function selectorBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`).exec(css);
  if (!match?.[1]) throw new Error(`Missing selector: ${selector}`);
  return match[1];
}

describe("marketplace detail approved stylesheet", () => {
  it("sizes only the decorative review icon, not the review copy wrapper", () => {
    expect(css).toContain(".marketplace-detail-review > span[aria-hidden='true']");
    expect(css).not.toContain(".marketplace-detail-review > span {");
  });

  it("uses violet MPReply chrome around marketplace-specific content", () => {
    const hero = selectorBlock(".public-root .public-subhero-marketplace-detail");
    expect(hero).toContain("rgb(81 72 232 / 9%)");
    expect(hero).toContain("rgb(99 91 255 / 7%)");
    expect(hero).not.toContain("rgb(37 99 235");
    expect(hero).not.toContain("rgb(14 165 233");

    expect(selectorBlock(".marketplace-detail-window-head > small")).toContain(
      "background: var(--color-brand-soft)",
    );
    expect(selectorBlock(".marketplace-detail-window-head > small")).toContain(
      "color: var(--color-brand-text-on-soft)",
    );
    expect(selectorBlock(".marketplace-detail-draft-head > span")).toContain(
      "background: var(--color-brand-soft)",
    );
    expect(selectorBlock(".marketplace-detail-draft-actions strong")).toContain(
      "background: var(--color-brand-primary)",
    );
  });

  it("preserves marketplace-specific accent variables", () => {
    expect(selectorBlock(".marketplace-detail-scene.is-wildberries")).toContain("--marketplace-accent: #a61acb");
    expect(selectorBlock(".marketplace-detail-scene.is-ozon")).toContain("--marketplace-accent: #1268f4");
    expect(selectorBlock(".marketplace-detail-scene.is-yandex-market")).toContain("--marketplace-accent: #f4bd00");
    expect(selectorBlock(".marketplace-detail-scene.is-avito")).toContain("--marketplace-accent: #3b82f6");
  });
});
