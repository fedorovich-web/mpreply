import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "styles/pricing-demo-approved.css"), "utf8");

function selectorBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`).exec(css);
  if (!match?.[1]) throw new Error(`Missing selector: ${selector}`);
  return match[1];
}

describe("pricing and demo styles", () => {
  it("uses the defined muted surface token", () => {
    expect(css).not.toContain("var(--color-bg-muted)");
    expect(css).toContain("var(--color-surface-muted)");
  });

  it("uses violet MPReply decoration instead of the retired blue and cyan public glow", () => {
    const hero = selectorBlock(".public-root .public-subhero-pricing,\\n.public-root .public-subhero-demo");
    expect(hero).toContain("rgb(81 72 232 / 10%)");
    expect(hero).toContain("rgb(99 91 255 / 7%)");
    expect(hero).not.toContain("rgb(37 99 235");
    expect(hero).not.toContain("rgb(14 165 233");
    expect(hero).toContain("linear-gradient(180deg, #fff 0%, #fcfbff 100%)");
  });

  it("keeps pricing and demo brand controls token-driven", () => {
    expect(selectorBlock(".pricing-plan-head-mark")).toContain("background: var(--gradient-public-blue)");
    expect(selectorBlock(".pricing-plan-track > span")).toContain("var(--color-brand-primary)");
    expect(selectorBlock(".demo-product-window-head > div > span")).toContain("background: var(--gradient-public-blue)");
    expect(selectorBlock(".demo-product-draft-head > span")).toContain("color: var(--color-brand-primary)");
  });
});
