import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const approvedCss = readFileSync(join(process.cwd(), "styles/homepage-approved.css"), "utf8");

function selectorBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`).exec(approvedCss);
  if (!match?.[1]) throw new Error(`Missing homepage selector: ${selector}`);
  return match[1];
}

describe("homepage approved stylesheet", () => {
  it("does not keep the retired CSS hero mockup", () => {
    for (const legacySelector of [
      "homepage-hero-glow",
      "homepage-hero-window",
      "homepage-hero-ai-card",
      "homepage-hero-handnote",
      "homepage-mini-brand",
      "homepage-mini-nav",
      "homepage-window-row",
      "homepage-window-toolbar",
      "homepage-window-type",
    ]) {
      expect(approvedCss).not.toContain(legacySelector);
    }
  });

  it("does not rely on important overrides for homepage geometry", () => {
    expect(approvedCss).not.toContain("!important");
  });

  it("routes MPReply homepage accents through the authoritative violet brand tokens", () => {
    const root = selectorBlock(".public-root");
    expect(root).toContain("--homepage-brand: var(--color-brand-primary)");
    expect(root).toContain("--homepage-brand-hover: var(--color-brand-primary-hover)");
    expect(root).toContain("--homepage-brand-soft: var(--color-brand-soft)");
    expect(root).toContain("--homepage-brand-text-on-soft: var(--color-brand-text-on-soft)");

    expect(selectorBlock(".public-root .public-brand-mark")).toContain("background: var(--gradient-mpreply-action)");
    expect(selectorBlock(".homepage-hero-copy h1 span")).toContain("color: var(--homepage-brand)");
    expect(selectorBlock(".homepage-kicker")).toContain("color: var(--homepage-brand)");
    expect(selectorBlock(".homepage-feature-layout .homepage-workspace-tab[aria-selected='true']")).toContain(
      "color: var(--homepage-brand)",
    );
    expect(selectorBlock(".homepage-workspace-filter.is-active")).toContain("color: var(--homepage-brand)");
    expect(selectorBlock(".homepage-workspace-answer-actions b")).toContain("background: var(--homepage-brand)");
    expect(selectorBlock(".homepage-process-number-circle")).toContain("background: var(--homepage-brand)");
    expect(selectorBlock(".homepage-process-card-icon")).toContain("color: var(--homepage-brand)");
    expect(selectorBlock(".homepage-process-switches i.is-on")).toContain("background: var(--homepage-brand)");
    expect(selectorBlock(".homepage-result-card > span")).toContain("color: var(--homepage-brand)");
    expect(selectorBlock(".homepage-cta-add")).toContain("background: var(--homepage-brand)");
    expect(selectorBlock(".public-footer-column a:hover")).toContain("color: var(--homepage-brand)");
  });

  it("preserves marketplace identity colors while the MPReply brand migrates", () => {
    expect(selectorBlock(".homepage-marketplace-logo-wildberries")).toContain(
      "background: linear-gradient(135deg, #8d1ad7, #cd22a4)",
    );
    expect(selectorBlock(".homepage-marketplace-logo-ozon")).toContain(
      "background: linear-gradient(135deg, #1266ff, #0053d7)",
    );
    expect(selectorBlock(".homepage-marketplace-logo-yandex-market")).toContain("background: #ffd229");
    expect(selectorBlock(".homepage-marketplace-logo-avito")).toContain("background: #edf4ff");
    expect(selectorBlock(".homepage-marketplace-logo-avito")).toContain("color: #2269dd");
    expect(selectorBlock(".homepage-process-marketplaces b:nth-child(2)")).toContain("background: #1268f4");
  });
});
