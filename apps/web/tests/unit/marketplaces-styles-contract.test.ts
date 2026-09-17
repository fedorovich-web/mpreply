import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "styles/marketplaces-approved.css"), "utf8");

function selectorBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`).exec(css);
  if (!match?.[1]) throw new Error(`Missing selector: ${selector}`);
  return match[1];
}

describe("marketplaces approved stylesheet", () => {
  it("targets the first feed row after the feed header instead of an impossible first-of-type", () => {
    expect(css).toContain(".marketplace-unified-feed-head + .marketplace-unified-row");
    expect(css).not.toContain(".marketplace-unified-row:first-of-type");
  });

  it("uses the violet MPReply brand for generic marketplace-page chrome", () => {
    const hero = selectorBlock(".public-root .public-subhero-marketplaces");
    expect(hero).toContain("rgb(81 72 232 / 10%)");
    expect(hero).toContain("rgb(99 91 255 / 7%)");
    expect(hero).not.toContain("rgb(37 99 235");
    expect(hero).not.toContain("rgb(14 165 233");

    expect(selectorBlock(".marketplace-unified-window-brand > span")).toContain(
      "background: var(--gradient-mpreply-action)",
    );
    expect(selectorBlock(".marketplace-unified-nav > span:first-of-type")).toContain(
      "background: var(--color-brand-soft)",
    );
    expect(selectorBlock(".marketplace-unified-nav > span:first-of-type")).toContain(
      "color: var(--color-brand-text-on-soft)",
    );
    expect(selectorBlock(".marketplace-unified-answer-actions strong")).toContain(
      "background: var(--color-brand-primary)",
    );
    expect(selectorBlock(".marketplace-unified-caption")).toContain("color: var(--color-brand-primary)");
  });

  it("preserves marketplace-specific source colors", () => {
    expect(selectorBlock(".marketplace-unified-source.is-wildberries .marketplace-unified-source-mark")).toContain(
      "background: linear-gradient(135deg, #8d1ad7, #cd22a4)",
    );
    expect(selectorBlock(".marketplace-unified-source.is-ozon .marketplace-unified-source-mark")).toContain(
      "background: #1268f4",
    );
    expect(selectorBlock(".marketplace-unified-source.is-yandex-market .marketplace-unified-source-mark")).toContain(
      "background: #ffd229",
    );
    expect(selectorBlock(".marketplace-unified-source.is-avito .marketplace-unified-source-mark")).toContain(
      "background: #edf4ff",
    );
    expect(selectorBlock(".marketplace-unified-source.is-avito .marketplace-unified-source-mark")).toContain(
      "color: #2169df",
    );
  });
});
