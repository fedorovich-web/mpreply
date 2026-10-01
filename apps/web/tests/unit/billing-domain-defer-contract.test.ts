import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");
const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

const product = read("PRODUCT.md");
const billingWorkspace = read("apps/web/components/billing/BillingWorkspace.tsx");
const billingPage = read("apps/web/app/app/billing/page.tsx");

describe("billing launch-stage boundary", () => {
  it("documents authorized manual billing after the production domain became operational", () => {
    expect(product).toContain("production domain");
    expect(product).toContain("manual renewal and no automatic charges");
    expect(product).toContain("Checkout remains disabled until configuration");
  });

  it("preserves the existing tariff fallback while connecting the verified checkout", () => {
    expect(billingWorkspace).toContain("data.pricing_finalized");
    expect(billingWorkspace).toContain(': "—"');
    expect(billingWorkspace).toContain("<BillingCheckout />");
    expect(billingPage).toContain("Тариф и лимиты");
  });
});
