import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const demo = readFileSync(join(root, "app/demo/page.tsx"), "utf8");

describe("approved demo compact marketplace assets", () => {
  it("uses compact WebP marketplace marks from the approved render", () => {
    for (const asset of [
      "wildberries-compact.webp",
      "ozon-compact.webp",
      "yandex-market-compact.webp",
      "avito-compact.webp",
    ]) {
      expect(demo).toContain(asset);
    }

    expect(demo).toContain("compactSrc");
    expect(demo).toContain("demo-marketplace-compact");
  });
});
