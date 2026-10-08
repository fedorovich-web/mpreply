import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workspace = readFileSync(join(root, "components/analytics/AnalyticsWorkspace.tsx"), "utf8");
const page = readFileSync(join(root, "app/app/analytics/page.tsx"), "utf8");
const layout = readFileSync(join(root, "styles/dashboard.ts"), "utf8");
const styles = readFileSync(join(root, "styles/dashboard-analytics-approved.css"), "utf8");

describe("analytics operational dashboard", () => {
  it("keeps every visible metric on live tenant-scoped analytics endpoints", () => {
    expect(workspace).toContain('buildApiQuery("/api/analytics/overview"');
    expect(workspace).toContain('buildApiQuery("/api/analytics/messages"');
    expect(workspace).toContain('buildApiQuery("/api/analytics/marketplaces"');
    expect(workspace).toContain('buildApiQuery("/api/analytics/products"');
    expect(workspace).toContain('buildApiQuery("/api/analytics/team"');
    expect(workspace).toContain("organization_id: activeOrganization.id");
  });

  it("keeps analytics failures recoverable without exposing raw backend errors", () => {
    expect(workspace).toContain("function retryAnalytics()");
    expect(workspace).toContain("overviewQuery.refetch()");
    expect(workspace).toContain("messagesQuery.refetch()");
    expect(workspace).toContain("marketplacesQuery.refetch()");
    expect(workspace).toContain("productsQuery.refetch()");
    expect(workspace).toContain("teamQuery.refetch()");
    expect(workspace).toContain("actionLabel={t.retry}");
    expect(workspace).toContain('retry: "Повторить"');
    expect(workspace).toContain('retry: "Retry"');
    expect(workspace).toContain("Показаны последние доступные данные");
    expect(workspace).not.toContain("error.message");
  });

  it("keeps operational metrics seller-facing instead of exposing AI diagnostics", () => {
    expect(workspace).toContain("Всего обращений");
    expect(workspace).toContain("Требуют ответа");
    expect(workspace).toContain("Среднее время ответа");
    expect(workspace).toContain("Негативные отзывы");
    expect(workspace).toContain('afterReview: "вручную"');
    expect(workspace).toContain('sentAfterReview: "Отправлено вручную"');
    expect(workspace).toContain('aiDraftsSent: "Доля черновиков с ИИ, дошедших до отправки"');
    expect(workspace).not.toContain("tokens_input");
    expect(workspace).not.toContain("average_latency_ms");
    expect(workspace).not.toContain("cost_estimate");
  });

  it("uses the approved dense authenticated-product hierarchy", () => {
    expect(page).toContain("<h1>Аналитика</h1>");
    expect(page).toContain("Следите за обращениями, скоростью ответов, площадками и товарами");
    expect(workspace).toContain("analytics-metric-grid");
    expect(workspace).toContain("analytics-panel-grid");
    expect(workspace).toContain("analytics-period-options");
  });

  it("uses a scoped responsive analytics layer without a second palette", () => {
    expect(layout).toContain('import "./dashboard-analytics-approved.css"');
    expect(styles).toContain(".analytics-page");
    expect(styles).toContain(".analytics-metric-grid");
    expect(styles).toContain(".analytics-panel-grid");
    expect(styles).toContain(".analytics-table");
    expect(styles).toContain("@media (max-width: 520px)");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
