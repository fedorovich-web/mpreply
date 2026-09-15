import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const shell = readFileSync(join(root, "components/public-site/PublicShell.tsx"), "utf8");
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");
const marketplaces = readFileSync(join(root, "app/marketplaces/page.tsx"), "utf8");
const detail = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");
const demo = readFileSync(join(root, "app/demo/page.tsx"), "utf8");
const pricing = readFileSync(join(root, "app/pricing/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");

describe("approved public footer variants", () => {
  it("provides the compact render footer without replacing the default footer globally", () => {
    expect(shell).toContain('footerVariant?: "default" | "compact"');
    expect(shell).toContain("public-footer-compact");
    expect(shell).toContain("Ближе к вашим клиентам");
  });

  it("uses compact footer on the four compact-footer mockups", () => {
    for (const page of [features, marketplaces, detail, demo]) {
      expect(page).toContain('<PublicShell footerVariant="compact">');
    }
  });

  it("keeps pricing on the full footer render", () => {
    expect(pricing).toContain("<PublicShell>");
    expect(pricing).not.toContain('footerVariant="compact"');
  });

  it("loads compact footer styling after the public fidelity layers", () => {
    expect(layout).toContain('import "../styles/public-compact-footer.css"');
  });
});
