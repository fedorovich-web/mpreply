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

  it("uses concise MPReply product language rather than legacy or developer-facing copy", () => {
    expect(page).toContain("<h1>Администрирование</h1>");
    expect(page).toContain("состояние продукта, организаций, подписок и фоновых процессов");
    expect(page).not.toContain("Respio");
    expect(page).not.toContain("Только superadmin");
    expect(workspace).not.toContain("Respio");
    expect(workspace).not.toContain("Сводка строится только по фактическим данным системного API");
    expect(workspace).not.toContain("active + trialing");
    expect(workspace).not.toContain("usage ledger");
  });

  it("uses the approved authenticated composition without a decorative fake preview", () => {
    expect(page).toContain("admin-page-header");
    expect(page).not.toContain("admin-page-hero-preview");
    expect(page).not.toContain("admin-page-preview-activity");
    expect(workspace).toContain("admin-command-center");
    expect(workspace).toContain("admin-kpi-strip");
    expect(workspace).toContain("admin-health-panel");
    expect(workspace).toContain("admin-metric-card");
    expect(styles).toContain(".admin-command-center");
    expect(styles).toContain(".admin-kpi-strip");
    expect(styles).toContain(".admin-health-panel");
  });

  it("keeps current incidents first and makes their live state immediately scannable", () => {
    expect(workspace).toContain("admin-section-incidents");
    expect(workspace).toContain("admin-section-product");
    expect(workspace).toContain("admin-section-usage");
    expect(workspace.indexOf("admin-section-incidents")).toBeLessThan(workspace.indexOf("admin-section-product"));
    expect(workspace.indexOf("admin-section-product")).toBeLessThan(workspace.indexOf("admin-section-usage"));
    expect(workspace).toContain("Ошибки интеграций за 24 часа");
    expect(workspace).toContain("Неотправленные ответы за 24 часа");
    expect(workspace).toContain("Инцидентов за 24 часа не зафиксировано");
    expect(workspace).toContain("admin-command-live-dot-warning");
    expect(workspace).toContain("admin-section-alert");
    expect(workspace).toContain('role="status"');
    expect(workspace).toContain('aria-live="polite"');
    expect(styles).toContain(".admin-command-live-dot-warning");
    expect(styles).toContain(".admin-section-alert");
  });

  it("derives status only from the existing overview payload instead of fake admin data", () => {
    expect(workspace).toContain("integration_failures_24h");
    expect(workspace).toContain("replies_failed_24h");
    expect(workspace).toContain("organizations_active");
    expect(workspace).toContain("subscriptions_active");
    expect(workspace).not.toContain("/api/admin/organizations");
    expect(workspace).not.toContain("/api/admin/users");
    expect(workspace).not.toContain("/api/admin/subscriptions");
    expect(workspace).not.toContain("Активные и пробные подписки");
    expect(workspace).not.toContain("включая пробные");
    expect(workspace).not.toContain("сохранённым ИИ-черновикам");
  });

  it("does not silently clamp derived ratios shown to the administrator", () => {
    expect(workspace).toContain("function ratioPercent");
    expect(workspace).toContain("Math.round((part / total) * 100)");
    expect(workspace).toContain("Math.min(metric.ratio, 100)");
    expect(workspace).not.toContain("Math.min(100, Math.round((part / total) * 100))");
  });

  it("keeps stale admin data visible when a background refresh fails", () => {
    expect(workspace).toContain("overviewQuery.error && !overviewQuery.data");
    expect(workspace).toContain("overviewQuery.error ? (");
    expect(workspace).toContain("admin-refresh-notice");
    expect(workspace).toContain('refreshError: "Не удалось обновить системные данные');
    expect(workspace).toContain("overviewQuery.refetch()");
    expect(styles).toContain(".admin-refresh-notice");
  });

  it("formats event counts and USD values for the active locale", () => {
    expect(workspace).toContain("function formatEventCount");
    expect(workspace).toContain("function formatIncidentReview");
    expect(workspace).toContain('value === 1 ? "event" : "events"');
    expect(workspace).toContain('locale === "en" ? "en-US" : "ru-RU"');
    expect(workspace).toContain("formatUsd(data.ai_cost_estimate_30d, locale)");
  });

  it("uses dedicated accessible loading, access and recoverable error states", () => {
    expect(workspace).toContain("function AdminOverviewState");
    expect(workspace).toContain('tone="denied"');
    expect(workspace).toContain('tone="loading"');
    expect(workspace).toContain('tone="error"');
    expect(workspace).toContain('aria-busy={tone === "loading"}');
    expect(workspace).toContain('role={tone === "error" ? "alert" : "status"}');
    expect(workspace).toContain("overviewQuery.isFetching");
    expect(workspace).toContain("actionLabel={overviewQuery.isFetching ? t.retrying : t.retry}");
    expect(workspace).toContain('retrying: "Повторяем..."');
    expect(workspace).toContain('retry: "Retry"');
    expect(workspace).toContain("disabled={overviewQuery.isFetching}");
    expect(styles).toContain(".admin-overview-state");
    expect(styles).toContain(".admin-overview-state-loading");
    expect(styles).toContain(".admin-overview-state-error");
    expect(styles).toContain(".admin-overview-state-denied");
  });

  it("loads a scoped responsive admin layer without introducing a second palette", () => {
    expect(layout).toContain('import "../styles/dashboard-admin-approved.css"');
    expect(styles).toContain(".admin-page");
    expect(styles).toContain(".admin-section-incidents");
    expect(styles).not.toContain(".admin-page-hero");
    expect(styles).not.toContain(".admin-page-preview");
    expect(styles).toContain(".admin-section-product");
    expect(styles).toContain(".admin-section-usage");
    expect(styles).toContain("@media (max-width: 520px)");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
