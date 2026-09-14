import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workspace = readFileSync(join(root, "components/billing/BillingWorkspace.tsx"), "utf8");
const page = readFileSync(join(root, "app/app/billing/page.tsx"), "utf8");

describe("billing and limits dashboard", () => {
  it("keeps plan and usage on the live tenant-scoped billing overview", () => {
    expect(workspace).toContain('buildApiQuery("/api/billing/overview"');
    expect(workspace).toContain("organization_id: activeOrganization.id");
    expect(workspace).toContain("data.usage.map");
  });

  it("preserves existing price fallback until billing is connected on the domain", () => {
    expect(workspace).toContain("data.pricing_finalized");
    expect(workspace).toContain(': "—"');
    expect(workspace).not.toContain("Цена не задана");
  });

  it("treats a zero finite limit as fully consumed instead of 0% used", () => {
    expect(workspace).toContain("item.limit === 0 ? 100");
    expect(workspace).not.toContain("item.limit && item.limit > 0");
  });

  it("keeps the existing current-plan framing without premature billing messaging", () => {
    expect(page).toContain("Текущий тариф и использование");
    expect(page).toContain("Проверяйте доступные лимиты, текущий расход и параметры тарифа");
    expect(page).not.toContain("Цена отображается только когда она задана");
  });
});