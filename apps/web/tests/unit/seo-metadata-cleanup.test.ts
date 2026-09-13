import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const seoSource = readFileSync(join(process.cwd(), "lib/seo.ts"), "utf8");

describe("public metadata helper", () => {
  it("does not keep an unused no-index branch in the public-page helper", () => {
    expect(seoSource).not.toContain("noIndex");
    expect(seoSource).toContain("robots: { index: true, follow: true }");
  });
});
