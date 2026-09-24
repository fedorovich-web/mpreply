import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const dashboard = readFileSync(join(root, "components/dashboard/DashboardMetrics.tsx"), "utf8");
const page = readFileSync(join(root, "app/app/dashboard/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const styles = readFileSync(join(root, "styles/dashboard-overview-approved.css"), "utf8");

describe("dashboard overview", () => {
  it("keeps the approved composition on live operational sources", () => {
    for (const endpoint of [
      "/api/analytics/overview",
      "/api/messages",
      "/api/replies/review-queue",
      "/api/marketplace-accounts",
      "/api/automation-rules",
      "/api/analytics/marketplaces",
      "/api/analytics/team",
    ]) {
      expect(dashboard).toContain(endpoint);
    }

    expect(dashboard).toContain("customerMessageListSchema");
    expect(dashboard).toContain("marketplaceAnalyticsSchema");
    expect(dashboard).toContain("teamAnalyticsSchema");
    expect(dashboard).not.toContain("billingOverviewSchema");
  });

  it("matches the approved KPI → queue → side actions → lower insights hierarchy", () => {
    expect(dashboard).toContain("dashboard-kpi-grid");
    expect(dashboard).toContain("dashboard-primary-grid");
    expect(dashboard).toContain("dashboard-messages-panel");
    expect(dashboard).toContain("dashboard-side-stack");
    expect(dashboard).toContain("dashboard-bottom-grid");
    expect(dashboard).toContain("dashboard-reply-donut");

    expect(styles).toContain(".dashboard-kpi-grid");
    expect(styles).toContain(".dashboard-primary-grid");
    expect(styles).toContain(".dashboard-message-table");
    expect(styles).toContain(".dashboard-side-stack");
    expect(styles).toContain(".dashboard-bottom-grid");
    expect(styles).toContain(".dashboard-reply-donut");
  });

  it("uses real seller-facing metrics instead of unsupported render-only numbers", () => {
    expect(dashboard).toContain("analytics.total_messages");
    expect(dashboard).toContain("analytics.unanswered_messages");
    expect(dashboard).toContain("reviewQueueQuery.data?.total");
    expect(dashboard).toContain("analytics.average_response_seconds");
    expect(dashboard).toContain("analytics.auto_replies_sent");
    expect(dashboard).toContain("analytics.manual_replies_sent");
    expect(dashboard).not.toMatch(/conversion|конверси|оценка ответов|rating score/i);
  });

  it("keeps the attention table on the real needs-reply message query", () => {
    expect(dashboard).toContain('buildApiQuery("/api/messages"');
    expect(dashboard).toContain('status: "needs_reply"');
    expect(dashboard).toContain("page_size: 5");
    expect(dashboard).toContain("message.customer_display_name");
    expect(dashboard).toContain("message.customer_text");
    expect(dashboard).toContain("message.product?.name");
    expect(dashboard).toContain("message.marketplace_created_at");
  });

  it("keeps marketplace health truthful and all private links locale-aware", () => {
    expect(dashboard).toContain('import { hasCurrentIntegrationProblem } from "../../lib/marketplace-account-health"');
    expect(dashboard).toContain("hasCurrentIntegrationProblem(account)");
    expect(dashboard).toContain("localizedPath(locale, value)");
    expect(dashboard).not.toMatch(/href="\/app\//);
    expect(dashboard).not.toContain("account.error_count > 0");
  });

  it("keeps the critical analytics failure recoverable and secondary panels progressive", () => {
    expect(dashboard).toContain("if (analyticsQuery.isPending)");
    expect(dashboard).toContain("analyticsQuery.refetch()");
    expect(dashboard).toContain("function DashboardOverviewState");
    expect(dashboard).toContain("function DashboardPanelState");
    expect(dashboard).toContain("needsReplyQuery.isPending");
    expect(dashboard).toContain("marketplacesQuery.isPending");
    expect(dashboard).toContain("teamQuery.isPending");
    expect(styles).toContain(".dashboard-overview-state-error");
    expect(styles).toContain(".dashboard-panel-state-error");
  });

  it("keeps RU and EN copy in the same live dashboard workflow", () => {
    expect(dashboard).toContain('totalMessages: "Всего обращений"');
    expect(dashboard).toContain('totalMessages: "Total messages"');
    expect(dashboard).toContain('aiTitle: "Подготовьте ответ с контекстом"');
    expect(dashboard).toContain('aiTitle: "Prepare a reply with context"');
    expect(dashboard).toContain('locale === "en" ? "en-US" : "ru-RU"');
  });

  it("keeps the approved raster icon policy and responsive product layer", () => {
    expect(page).toContain("<h1>Обзор</h1>");
    expect(layout).toContain('import "../styles/dashboard-overview-approved.css"');
    expect(dashboard).toContain("/images/mockups/features-icons/01-unified-inbox.webp");
    expect(dashboard).toContain("/images/mockups/features-icons/02-ai-sparkles.webp");
    expect(dashboard).not.toContain("<svg");
    expect(styles).toContain("@media (max-width: 1180px)");
    expect(styles).toContain("@media (max-width: 720px)");
    expect(styles).toContain("@media (max-width: 520px)");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
