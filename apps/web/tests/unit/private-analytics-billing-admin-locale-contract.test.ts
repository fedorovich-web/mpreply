import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const analytics = readFileSync(join(root, "components/analytics/AnalyticsWorkspace.tsx"), "utf8");
const billing = readFileSync(join(root, "components/billing/BillingWorkspace.tsx"), "utf8");
const admin = readFileSync(join(root, "components/admin/AdminOverviewWorkspace.tsx"), "utf8");

describe("analytics, billing, and admin locale separation", () => {
  it("keeps analytics on the same tenant-scoped live endpoints", () => {
    for (const endpoint of [
      "/api/analytics/overview",
      "/api/analytics/messages",
      "/api/analytics/marketplaces",
      "/api/analytics/products",
      "/api/analytics/team",
    ]) {
      expect(analytics).toContain(endpoint);
    }
    expect(analytics).toContain("const { activeOrganization, locale } = useWorkspace()");
    expect(analytics).toContain('locale === "en" ? "en-US" : "ru-RU"');
  });

  it("keeps billing on the same live overview while localizing plan presentation", () => {
    expect(billing).toContain('buildApiQuery("/api/billing/overview"');
    expect(billing).toContain("const { activeOrganization, locale } = useWorkspace()");
    expect(billing).toContain('active: "Active"');
    expect(billing).toContain('active: "Активен"');
    expect(billing).toContain('locale === "en" ? "en-US" : "ru-RU"');
  });

  it("keeps admin access and system data on the same superadmin API", () => {
    expect(admin).toContain("enabled: user.is_superadmin");
    expect(admin).toContain('apiRequest("/api/admin/overview"');
    expect(admin).toContain("const { user, locale } = useWorkspace()");
    expect(admin).toContain('operationsCenter: "Operations center"');
    expect(admin).toContain('operationsCenter: "Операционный центр"');
  });
});
