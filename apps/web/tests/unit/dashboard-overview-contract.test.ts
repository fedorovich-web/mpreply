import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const dashboard = readFileSync(join(root, "components/dashboard/DashboardMetrics.tsx"), "utf8");
const page = readFileSync(join(root, "app/app/dashboard/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const styles = readFileSync(join(root, "styles/dashboard-overview-approved.css"), "utf8");

describe("dashboard operational overview", () => {
  it("uses real operational sources instead of centering billing or vanity metrics", () => {
    expect(dashboard).toContain("analyticsOverviewSchema");
    expect(dashboard).toContain("reviewQueueListSchema");
    expect(dashboard).toContain("marketplaceAccountListSchema");
    expect(dashboard).toContain("automationRuleListSchema");
    expect(dashboard).toContain('"/api/replies/review-queue"');
    expect(dashboard).toContain('"/api/marketplace-accounts"');
    expect(dashboard).toContain('"/api/automation-rules"');
    expect(dashboard).not.toContain("billingOverviewSchema");
  });

  it("does not count an account with sync errors as an active healthy connection", () => {
    expect(dashboard).toContain('account.status === "active" && account.error_count === 0');
    expect(dashboard).toContain('account.status === "error" || account.error_count > 0');
  });

  it("puts unanswered work, review decisions and integration health before aggregate reporting", () => {
    expect(page).toContain("Очереди, проверки и состояние автоматизации");
    expect(dashboard).toContain("dashboard-attention-panel");
    expect(dashboard).toContain("Без ответа");
    expect(dashboard).toContain("На проверке");
    expect(dashboard).toContain("Проблемы подключений");
    expect(dashboard).toContain("dashboard-health-panel");
    expect(dashboard).toContain("Включено правил");
    expect(dashboard).toContain('href="/app/inbox"');
    expect(dashboard).toContain('href="/app/review-queue"');
    expect(dashboard).toContain('href="/app/integrations"');
    expect(dashboard).toContain('href="/app/automation-rules"');
    expect(dashboard).not.toContain("На модерации");
    expect(dashboard).not.toContain("Открыть входящие");
    expect(dashboard).not.toContain("Открыть модерацию");
  });

  it("uses the approved product labels in quick actions", () => {
    expect(dashboard).toContain("Обращения");
    expect(dashboard).toContain("На проверке");
    expect(dashboard).toContain("Автоматизация");
    expect(dashboard).not.toContain(">Входящие<");
    expect(dashboard).not.toContain(">Модерация<");
  });

  it("loads a scoped responsive overview style layer without a second palette", () => {
    expect(layout).toContain('import "../styles/dashboard-overview-approved.css"');
    expect(styles).toContain(".dashboard-operational-grid");
    expect(styles).toContain(".dashboard-attention-row");
    expect(styles).toContain(".dashboard-health-list");
    expect(styles).toContain(".dashboard-quick-actions");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});