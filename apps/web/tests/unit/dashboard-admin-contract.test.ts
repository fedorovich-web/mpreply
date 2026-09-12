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
    expect(page).toContain("Системная сводка MPReply");
    expect(page).not.toContain("Respio");
    expect(workspace).not.toContain("Respio");
    expect(workspace).not.toContain("active + trialing");
    expect(workspace).not.toContain("usage ledger");
  });

  it("groups system health metrics into readable operational cards", () => {
    expect(workspace).toContain("admin-overview-grid");
    expect(workspace).toContain("admin-overview-card");
    expect(workspace).toContain("Организации");
    expect(workspace).toContain("Пользователи");
    expect(workspace).toContain("Ошибки интеграций за 24 часа");
    expect(workspace).toContain("Неотправленные ответы за 24 часа");
  });

  it("loads a scoped responsive admin layer without introducing a second palette", () => {
    expect(layout).toContain('import "../styles/dashboard-admin-approved.css"');
    expect(styles).toContain(".admin-page");
    expect(styles).toContain(".admin-overview-grid");
    expect(styles).toContain(".admin-overview-card");
    expect(styles).toContain("@media (max-width: 520px)");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
