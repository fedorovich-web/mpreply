import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workspace = readFileSync(join(root, "components/billing/BillingWorkspace.tsx"), "utf8");
const page = readFileSync(join(root, "app/app/billing/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const styles = readFileSync(join(root, "styles/dashboard-billing-approved.css"), "utf8");

describe("billing and limits dashboard", () => {
  it("keeps plan and usage on the live tenant-scoped billing overview", () => {
    expect(workspace).toContain('buildApiQuery("/api/billing/overview"');
    expect(workspace).toContain("organization_id: activeOrganization.id");
    expect(workspace).toContain("data.usage.map");
  });

  it("preserves the price fallback until pricing is finalized", () => {
    expect(workspace).toContain("data.pricing_finalized");
    expect(workspace).toContain(': "—"');
    expect(workspace).not.toContain("Цена не задана");
  });

  it("keeps failures recoverable and never exposes raw backend errors", () => {
    expect(workspace).toContain("actionLabel={t.retry}");
    expect(workspace).toContain('retry: "Повторить"');
    expect(workspace).toContain('retry: "Retry"');
    expect(workspace).toContain("billingQuery.refetch()");
    expect(workspace).toContain("Показана последняя доступная информация");
    expect(workspace).not.toContain("error.message");
  });

  it("does not expose internal metric keys to sellers", () => {
    expect(workspace).toContain('ai_drafts_monthly: "Черновики с ИИ"');
    expect(workspace).toContain('replies_sent_monthly: "Отправленные ответы"');
    expect(workspace).toContain('marketplace_accounts: "Подключённые кабинеты"');
    expect(workspace).toContain('members: "Участники команды"');
    expect(workspace).not.toContain("metricLabels[item.metric] ?? item.metric");
  });

  it("treats a zero finite limit as fully consumed instead of 0% used", () => {
    expect(workspace).toContain("item.limit === 0");
    expect(workspace).toContain("? 100");
  });

  it("uses the approved dense authenticated-product hierarchy", () => {
    expect(page).toContain("<h1>Тариф и лимиты</h1>");
    expect(workspace).toContain("billing-overview-grid");
    expect(workspace).toContain("billing-summary-card");
    expect(workspace).toContain("billing-section");
    expect(layout).toContain('import "../styles/dashboard-billing-approved.css"');
    expect(styles).toContain(".billing-page");
    expect(styles).toContain(".billing-usage-grid");
    expect(styles).toContain("@media (max-width: 520px)");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
