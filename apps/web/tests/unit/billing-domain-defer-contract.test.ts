import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");
const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

const product = read("PRODUCT.md");
const billingWorkspace = read("apps/web/components/billing/BillingWorkspace.tsx");
const billingPage = read("apps/web/app/app/billing/page.tsx");

describe("billing rollout boundary", () => {
  it("documents that payment-provider billing work waits for the production domain", () => {
    expect(product).toContain("production domain");
    expect(product).toContain("payment-provider wiring is deferred");
    expect(product).toContain("do not redesign the billing/payment flow");
  });

  it("preserves the existing billing boundary without inventing checkout actions", () => {
    expect(billingWorkspace).toContain("data.pricing_finalized");
    expect(billingWorkspace).toContain(': "—"');
    expect(billingWorkspace).not.toMatch(/checkout|оплатить сейчас|перейти к оплате/i);
    expect(billingPage).toContain("Тариф и лимиты");
  });
});
