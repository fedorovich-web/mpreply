import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const detail = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");
const decorativeCss = readFileSync(join(root, "styles/public-mockup-decorative-fidelity.css"), "utf8");

describe("approved marketplace detail hero visual", () => {
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
});
