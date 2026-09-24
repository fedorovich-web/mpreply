import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workspace = readFileSync(join(root, "components/admin/AdminOverviewWorkspace.tsx"), "utf8");
const page = readFileSync(join(root, "app/app/admin/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const styles = readFileSync(join(root, "styles/dashboard-admin-approved.css"), "utf8");

describe("superadmin dashboard", () => {
  it("keeps access gated by the authenticated superadmin flag and live API", () => {
    expect(workspace).toContain("enabled: user.is_superadmin");
    expect(workspace).toContain('apiRequest("/api/admin/overview"');
    expect(workspace).toContain("if (!user.is_superadmin)");
  });

  it("uses MPReply product language rather than legacy Respio copy", () => {
    expect(page).toContain("Системная панель MPReply");
    expect(page).not.toContain("Respio");
    expect(workspace).not.toContain("Respio");
    expect(workspace).not.toContain("active + trialing");
    expect(workspace).not.toContain("usage ledger");
  });

  it("uses the approved blue SaaS composition instead of a plain metrics table", () => {
    expect(page).toContain("admin-page-hero");
    expect(workspace).toContain("admin-command-center");
    expect(workspace).toContain("admin-kpi-strip");
    expect(workspace).toContain("admin-health-panel");
    expect(workspace).toContain("admin-metric-card");
    expect(styles).toContain(".admin-page-hero");
    expect(styles).toContain(".admin-command-center");
    expect(styles).toContain(".admin-kpi-strip");
    expect(styles).toContain(".admin-health-panel");
  });

  it("keeps current incidents before product scale and 30-day usage", () => {
    expect(workspace).toContain("admin-section-incidents");
    expect(workspace).toContain("admin-section-product");
    expect(workspace).toContain("admin-section-usage");
    expect(workspace.indexOf("admin-section-incidents")).toBeLessThan(workspace.indexOf("admin-section-product"));
    expect(workspace.indexOf("admin-section-product")).toBeLessThan(workspace.indexOf("admin-section-usage"));
    expect(workspace).toContain("Ошибки интеграций за 24 часа");
    expect(workspace).toContain("Неотправленные ответы за 24 часа");
    expect(workspace).toContain("Организации");
    expect(workspace).toContain("Пользователи");
  });

  it("derives status only from the existing overview payload instead of fake admin data", () => {
    expect(workspace).toContain("integration_failures_24h");
    expect(workspace).toContain("replies_failed_24h");
    expect(workspace).toContain("organizations_active");
    expect(workspace).toContain("subscriptions_active");
    expect(workspace).not.toContain("/api/admin/organizations");
    expect(workspace).not.toContain("/api/admin/users");
    expect(workspace).not.toContain("/api/admin/subscriptions");
  });

  it("keeps the overview error recoverable without leaving the page", () => {
    expect(workspace).toContain("overviewQuery.refetch()");
    expect(workspace).toContain("Повторить");
  });

  it("loads a scoped responsive admin layer without introducing a second palette", () => {
    expect(layout).toContain('import "../styles/dashboard-admin-approved.css"');
    expect(styles).toContain(".admin-page");
    expect(styles).toContain(".admin-section-incidents");
    expect(styles).toContain(".admin-section-product");
    expect(styles).toContain(".admin-section-usage");
    expect(styles).toContain("@media (max-width: 520px)");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
