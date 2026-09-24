import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workspace = readFileSync(join(root, "components/workspace/WorkspaceProvider.tsx"), "utf8");
const shell = readFileSync(join(root, "components/app-shell/AppShell.tsx"), "utf8");
const metrics = readFileSync(join(root, "components/dashboard/DashboardMetrics.tsx"), "utf8");
const enLayout = readFileSync(join(root, "app/en/app/layout.tsx"), "utf8");
const enDashboard = readFileSync(join(root, "app/en/app/dashboard/page.tsx"), "utf8");

describe("private RU/EN foundation", () => {
  it("stores locale in the workspace context without duplicating API state", () => {
    expect(workspace).toContain("locale: Locale");
    expect(workspace).toContain('locale = "ru"');
    expect(workspace).toContain('router.replace(localizedPath(locale, "/auth/login"))');
    expect(enLayout).toContain('<WorkspaceProvider locale="en">');
  });

  it("localizes the persistent app shell and equivalent route links", () => {
    expect(shell).toContain("navDefinitions");
    expect(shell).toContain("localizedPath(locale, item.href)");
    expect(shell).toContain("basePathFromLocalizedPath(pathname)");
    expect(shell).toContain("otherLocale.toUpperCase()");
    expect(shell).toContain('label: "Overview"');
    expect(shell).toContain('label: "Обзор"');
  });

  it("uses the same live dashboard queries with locale-specific copy and formatting", () => {
    expect(metrics).toContain('buildApiQuery("/api/analytics/overview"');
    expect(metrics).toContain('buildApiQuery("/api/replies/review-queue"');
    expect(metrics).toContain("dashboardCopy[locale]");
    expect(metrics).toContain('locale === "en" ? "en-US" : "ru-RU"');
    expect(enDashboard).toContain("<h1>Overview</h1>");
  });
});
