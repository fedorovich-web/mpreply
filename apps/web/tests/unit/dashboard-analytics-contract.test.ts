import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workspace = readFileSync(join(root, "components/analytics/AnalyticsWorkspace.tsx"), "utf8");
const page = readFileSync(join(root, "app/app/analytics/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const styles = readFileSync(join(root, "styles/dashboard-analytics-approved.css"), "utf8");

describe("analytics operational dashboard", () => {
  it("keeps every visible metric on live tenant-scoped analytics endpoints", () => {
    expect(workspace).toContain('buildApiQuery("/api/analytics/overview"');
    expect(workspace).toContain('buildApiQuery("/api/analytics/messages"');
    expect(workspace).toContain('buildApiQuery("/api/analytics/marketplaces"');
    expect(workspace).toContain('buildApiQuery("/api/analytics/products"');
    expect(workspace).toContain('buildApiQuery("/api/analytics/ai-usage"');
    expect(workspace).toContain("organization_id: activeOrganization.id");
  });

  it("keeps analytics failures recoverable without leaving the page", () => {
    expect(workspace).toContain("function retryAnalytics()");
    expect(workspace).toContain("overviewQuery.refetch()");
    expect(workspace).toContain("messagesQuery.refetch()");
    expect(workspace).toContain("marketplacesQuery.refetch()");
    expect(workspace).toContain("productsQuery.refetch()");
    expect(workspace).toContain("aiUsageQuery.refetch()");
    expect(workspace).toContain('actionLabel="Повторить"');
    expect(workspace).toContain("onAction={retryAnalytics}");
  });

  it("does not report zero safety flags when AI usage analytics failed", () => {
    expect(workspace).toContain('aiUsageQuery.error ? "—" : formatNumber(aiUsageQuery.data?.safety_flagged_drafts ?? 0)');
  });

  it("keeps operational metrics seller-facing instead of exposing AI diagnostics", () => {
    expect(workspace).toContain("Обращения");
    expect(workspace).toContain("Без ответа");
    expect(workspace).toContain("Среднее время ответа");
    expect(workspace).toContain("Негативные отзывы");
    expect(workspace).not.toContain("tokens_input");
    expect(workspace).not.toContain("average_latency_ms");
    expect(workspace).not.toContain("cost_estimate");
  });

  it("frames the page as real operational data, not a decorative BI dashboard", () => {
    expect(page).toContain("Понимайте, где обращения требуют внимания");
    expect(page).toContain("Все показатели рассчитываются по данным текущего рабочего пространства");
  });

  it("uses a scoped responsive analytics layer without a second palette", () => {
    expect(layout).toContain('import "../styles/dashboard-analytics-approved.css"');
    expect(styles).toContain(".analytics-page");
    expect(styles).toContain(".analytics-metric-grid");
    expect(styles).toContain(".analytics-panel-grid");
    expect(styles).toContain(".analytics-table");
    expect(styles).toContain("@media (max-width: 520px)");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
