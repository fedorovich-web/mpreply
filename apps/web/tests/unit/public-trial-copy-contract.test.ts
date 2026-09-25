import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

const publicConversionSources = [
  source("app/page.tsx"),
  source("app/en/page.tsx"),
  source("app/features/page.tsx"),
  source("app/marketplaces/page.tsx"),
  source("app/demo/page.tsx"),
  source("app/pricing/page.tsx"),
  source("lib/marketplace-detail-content.ts"),
];

const combined = publicConversionSources.join("\n");

describe("public trial copy contract", () => {
  it("keeps the approved 14-day trial presentation", () => {
    expect(combined).toContain("14 дней");
  });

  it("does not add unsupported trial or payment conditions", () => {
    for (const unsupportedClaim of [
      "Без карты",
      "Никаких рисков",
      "Полный доступ",
      "ко всем возможностям",
      "No card required",
      "Quick setup",
    ]) {
      expect(combined).not.toContain(unsupportedClaim);
    }
  });

  it("keeps the approved pricing facts intact", () => {
    const pricing = source("app/pricing/page.tsx");
    for (const fact of ["490 ₽", "990 ₽", "1 990 ₽", "-20%", "14 дней"]) {
      expect(pricing).toContain(fact);
    }
  });
});
