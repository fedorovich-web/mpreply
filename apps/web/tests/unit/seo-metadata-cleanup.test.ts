import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const seoSource = readFileSync(join(process.cwd(), "lib/seo.ts"), "utf8");

describe("public metadata helper", () => {
  it("indexes public pages by default but supports explicit draft noindex", () => {
    expect(seoSource).toContain("indexable?: boolean");
    expect(seoSource).toContain("indexable = true");
    expect(seoSource).toContain("robots: { index: indexable, follow: true }");
    expect(seoSource).not.toContain("noIndex");
  });
});
