import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");
const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

const product = read("PRODUCT.md");
const dashboardPlan = read("docs/superpowers/plans/2026-09-12-mpreply-dashboard-admin-ux-redesign.md");
const billingWorkspace = read("apps/web/components/billing/BillingWorkspace.tsx");

describe("billing rollout boundary", () => {
  it("documents that payment-provider billing work waits for the production domain", () => {
    expect(product).toContain("production domain");
    expect(product).toContain("payment-provider wiring is deferred");
    expect(dashboardPlan).toContain("Billing implementation is deferred until the production domain is connected");
  });

  it("preserves the existing billing price fallback in this redesign branch", () => {
    expect(billingWorkspace).toContain("data.pricing_finalized");
    expect(billingWorkspace).toContain(': "—"');
    expect(billingWorkspace).not.toContain("Цена не задана");
  });
});
