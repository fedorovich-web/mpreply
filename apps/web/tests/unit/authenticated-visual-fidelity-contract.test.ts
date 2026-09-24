import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const layout = read("app/layout.tsx");
const fidelity = read("styles/dashboard-final-fidelity.css");
const shell = read("components/app-shell/AppShell.tsx");

const pagePaths = [
  "app/app/dashboard/page.tsx",
  "app/app/inbox/page.tsx",
  "app/app/review-queue/page.tsx",
  "app/app/ai-assistant/page.tsx",
  "app/app/automation-rules/page.tsx",
  "app/app/integrations/page.tsx",
  "app/app/analytics/page.tsx",
  "app/app/billing/page.tsx",
  "app/app/admin/page.tsx",
];

describe("authenticated visual fidelity and responsive QA", () => {
  it("loads the final fidelity layer after page-specific dashboard styles", () => {
    expect(layout).toContain('import "../styles/dashboard-final-fidelity.css"');
    expect(layout.indexOf("dashboard-final-fidelity.css")).toBeGreaterThan(layout.indexOf("dashboard-admin-approved.css"));
  });

  it("keeps the persistent shell close to the approved dashboard composition", () => {
    expect(shell).toContain("app-sidebar-workspace");
    expect(shell).toContain("app-workspace-avatar");
    expect(fidelity).toContain(".app-sidebar-workspace");
    expect(fidelity).toContain(".app-logo strong");
    expect(fidelity).toContain(".app-topbar");
  });

  it("uses compact product headers rather than marketing hero chrome inside the app", () => {
    for (const path of pagePaths) {
      const page = read(path);
      expect(page).not.toContain("app-header-actions");
    }
    expect(read("app/app/dashboard/page.tsx")).toContain("<h1>Обзор</h1>");
    expect(read("app/app/inbox/page.tsx")).toContain("<h1>Обращения</h1>");
    expect(read("app/app/review-queue/page.tsx")).toContain("<h1>На проверке</h1>");
    expect(read("app/app/ai-assistant/page.tsx")).toContain("<h1>Ответы с ИИ</h1>");
    expect(read("app/app/automation-rules/page.tsx")).toContain("<h1>Автоматизация</h1>");
    expect(read("app/app/integrations/page.tsx")).toContain("<h1>Интеграции</h1>");
    expect(read("app/app/analytics/page.tsx")).toContain("<h1>Аналитика</h1>");
    expect(read("app/app/billing/page.tsx")).toContain("<h1>Тариф и лимиты</h1>");
    expect(read("app/app/admin/page.tsx")).toContain("<h1>Администрирование</h1>");
  });

  it("stacks multi-pane workspaces before the sidebar makes them overflow at tablet widths", () => {
    expect(fidelity).toContain("@media (max-width: 1120px)");
    expect(fidelity).toContain(".inbox-workspace");
    expect(fidelity).toContain(".review-queue-workspace");
    expect(fidelity).toContain(".ai-workspace-grid");
    expect(fidelity).toContain(".wildberries-layout");
    expect(fidelity).toContain("grid-template-columns: 1fr");
  });

  it("does not introduce a second hard-coded palette", () => {
    expect(fidelity).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
