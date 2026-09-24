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

  it("uses current sync health instead of cumulative error count for connection status", () => {
    expect(dashboard).toContain('import { hasCurrentIntegrationProblem } from "../../lib/marketplace-account-health"');
    expect(dashboard).toContain("hasCurrentIntegrationProblem(account)");
    expect(dashboard).not.toContain("account.error_count > 0");
  });

  it("renders the primary overview progressively without treating pending secondary queries as empty data", () => {
    expect(dashboard).toContain("if (analyticsQuery.isPending)");
    expect(dashboard).not.toContain("analyticsQuery.isPending || reviewQueueQuery.isPending");
    expect(dashboard).toContain('state: reviewQueueQuery.isPending ? "loading"');
    expect(dashboard).toContain('state: accountsQuery.isPending ? "loading"');
    expect(dashboard).toContain('state: rulesQuery.isPending ? "loading"');
    expect(dashboard).toContain('return "Проверяем"');
    expect(dashboard).not.toContain('reviewTotal && reviewTotal > 0');
    expect(dashboard).not.toContain('problemAccounts && problemAccounts > 0');
  });

  it("keeps the critical analytics failure recoverable in place", () => {
    expect(dashboard).toContain("function DashboardOverviewState");
    expect(dashboard).toContain("analyticsQuery.refetch()");
    expect(dashboard).toContain("analyticsQuery.isFetching");
    expect(dashboard).toContain('role={tone === "error" ? "alert" : "status"}');
    expect(styles).toContain(".dashboard-overview-state");
    expect(styles).toContain(".dashboard-overview-state-error");
  });

  it("puts unanswered work, review decisions and integration health before aggregate reporting", () => {
    expect(page).toContain("<h1>Обзор</h1>");
    expect(page).toContain("Следите за обращениями, очередью проверки, автоматизацией");
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