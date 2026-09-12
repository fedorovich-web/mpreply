import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workspace = readFileSync(join(root, "components/billing/BillingWorkspace.tsx"), "utf8");
const page = readFileSync(join(root, "app/app/billing/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const styles = readFileSync(join(root, "styles/dashboard-billing-approved.css"), "utf8");

describe("billing and limits dashboard", () => {
  it("keeps plan and usage on the live tenant-scoped billing overview", () => {
    expect(workspace).toContain('buildApiQuery("/api/billing/overview"');
    expect(workspace).toContain("organization_id: activeOrganization.id");
    expect(workspace).toContain("data.usage.map");
  });

  it("does not invent pricing or payment actions", () => {
    expect(workspace).toContain("data.pricing_finalized");
    expect(workspace).toContain("Цена не задана");
    expect(workspace).not.toContain("Сменить тариф");
    expect(workspace).not.toContain("Оплатить");
    expect(workspace).not.toContain("checkout");
  });

  it("frames the page around current plan facts and limits", () => {
    expect(page).toContain("Контролируйте тариф и лимиты без скрытых расчётов");
    expect(page).toContain("Цена отображается только когда она задана в текущем тарифе");
  });

  it("uses a scoped responsive billing layer without a second palette", () => {
    expect(layout).toContain('import "../styles/dashboard-billing-approved.css"');
    expect(styles).toContain(".billing-page");
    expect(styles).toContain(".billing-plan-card");
    expect(styles).toContain(".billing-usage-grid");
    expect(styles).toContain(".billing-progress");
    expect(styles).toContain("@media (max-width: 520px)");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
