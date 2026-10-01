import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const approvedCss = readFileSync(join(root, "styles/homepage-approved.css"), "utf8");
const page = readFileSync(join(root, "app/page.tsx"), "utf8");
const workspaceSource = readFileSync(
  join(root, "components/public-site/HomeWorkspaceTabs.tsx"),
  "utf8",
);

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

  it("routes MPReply homepage accents through the authoritative blue brand tokens", () => {
    const rootBlock = selectorBlock(".public-root");
    expect(rootBlock).toContain("--homepage-brand: var(--color-brand-primary)");
    expect(rootBlock).toContain("--homepage-brand-hover: var(--color-brand-primary-hover)");
    expect(rootBlock).toContain("--homepage-brand-soft: var(--color-brand-soft)");
    expect(rootBlock).toContain("--homepage-brand-text-on-soft: var(--color-brand-text-on-soft)");

    expect(selectorBlock(".public-root .public-brand-mark")).toContain("background: var(--gradient-mpreply-action)");
    expect(selectorBlock(".homepage-hero-copy h1 span")).toContain("color: var(--homepage-brand)");
    expect(selectorBlock(".homepage-feature-layout .homepage-workspace-tab[aria-selected='true']")).toContain(
      "color: var(--homepage-brand)",
    );
    expect(selectorBlock(".homepage-workspace-filter.is-active")).toContain("color: var(--homepage-brand)");
    expect(selectorBlock(".homepage-workspace-answer-actions a")).toContain("background: var(--homepage-brand)");
    expect(selectorBlock(".homepage-process-number-circle")).toContain("background: var(--homepage-brand)");
    expect(selectorBlock(".homepage-process-card-icon")).toContain("color: var(--homepage-brand)");
    expect(selectorBlock(".homepage-process-switches i.is-on")).toContain("background: var(--homepage-brand)");
    expect(selectorBlock(".homepage-result-card > span")).toContain("color: var(--homepage-brand)");
    expect(selectorBlock(".public-root .public-login-link")).toContain("color: var(--homepage-brand-text-on-soft)");
  });

  it("does not keep retired blue or cyan MPReply answer tones", () => {
    expect(approvedCss).not.toContain("#24a9d8");
    expect(approvedCss).not.toContain(".homepage-workspace-answer-dot.is-cyan");
    expect(approvedCss).not.toContain(".homepage-workspace-answer-dot.is-blue");
    expect(selectorBlock(".homepage-workspace-answer-dot.is-violet")).toContain(
      "border-color: var(--homepage-brand)",
    );
    expect(workspaceSource).toContain('type WorkspaceTone = "green" | "violet"');
    expect(workspaceSource).not.toContain('tone: "blue"');
    expect(workspaceSource).not.toContain('tone: "cyan"');
  });

  it("keeps supplied marketplace identity artwork without CSS letter-logo gradients", () => {
    for (const asset of ["01-wildberries.avif", "02-ozon.avif", "03-yandex-market.avif", "04-avito.avif"]) {
      expect(page).toContain("/images/icons/final/" + asset);
    }
    expect(selectorBlock(".homepage-marketplace-logo")).toContain("place-items: center");
    for (const selector of [".homepage-marketplace-logo-wildberries", ".homepage-marketplace-logo-ozon", ".homepage-marketplace-logo-yandex-market", ".homepage-marketplace-logo-avito"]) {
      expect(approvedCss).not.toContain(selector + " {");
    }
    expect(approvedCss).toContain(".homepage-process-marketplaces img");
  });
});
