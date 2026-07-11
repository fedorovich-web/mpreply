"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import { analyticsOverviewSchema, billingOverviewSchema } from "../../lib/api/schemas";
import { Badge } from "../ui/Badge";
import { useWorkspace } from "../workspace/WorkspaceProvider";

export function DashboardMetrics() {
  const { activeOrganization } = useWorkspace();
  const analyticsQuery = useQuery({
    queryKey: ["analytics", "overview", activeOrganization.id, 30],
    queryFn: () => apiRequest(buildApiQuery("/api/analytics/overview", { organization_id: activeOrganization.id, days: 30 }), analyticsOverviewSchema),
  });
  const billingQuery = useQuery({
    queryKey: ["billing", "overview", activeOrganization.id],
    queryFn: () => apiRequest(buildApiQuery("/api/billing/overview", { organization_id: activeOrganization.id }), billingOverviewSchema),
  });

  if (analyticsQuery.isLoading || billingQuery.isLoading) {
    return <div className="workspace-inline-state"><strong>Загружаем dashboard</strong><p>Получаем live metrics и текущий plan usage.</p></div>;
  }
  if (analyticsQuery.error || billingQuery.error || !analyticsQuery.data || !billingQuery.data) {
    const error = analyticsQuery.error ?? billingQuery.error;
    return <div className="workspace-inline-state workspace-inline-state-error"><strong>Dashboard недоступен</strong><p>{error instanceof Error ? error.message : "Нет данных"}</p></div>;
  }

  const analytics = analyticsQuery.data;
  const billing = billingQuery.data;
  const metrics = [
    { label: "Обращения · 30 дней", value: formatNumber(analytics.total_messages), helper: `${analytics.new_messages} новых`, badge: "live" },
    { label: "Автоответы", value: formatNumber(analytics.auto_replies_sent), helper: `${analytics.manual_replies_sent} manual`, badge: "auto" },
    { label: "Нужен ответ", value: formatNumber(analytics.unanswered_messages), helper: `${analytics.answered_messages} уже отвечено`, badge: "queue" },
    { label: "AI drafts", value: formatNumber(analytics.ai_drafts_generated), helper: formatAcceptance(analytics.ai_acceptance_rate), badge: "AI" },
  ];

  return (
    <>
      <section className="dashboard-cards dashboard-cards-4" aria-label="Ключевые показатели">
        {metrics.map((metric) => (
          <article className="metric-card metric-card-rich" key={metric.label}>
            <div className="metric-card-header"><span>{metric.label}</span><Badge tone="neutral">{metric.badge}</Badge></div>
            <strong>{metric.value}</strong><p>{metric.helper}</p>
          </article>
        ))}
      </section>

      <section className="dashboard-panel-grid" aria-label="Операционные панели">
        <article className="dashboard-panel">
          <div className="panel-heading"><span className="panel-kicker">Live workspace</span><strong>Текущая нагрузка</strong></div>
          <div className="analytics-summary-list">
            <div className="analytics-summary-row"><span>Отправлено ответов</span><strong>{formatNumber(analytics.replies_sent)}</strong></div>
            <div className="analytics-summary-row"><span>Негативных отзывов</span><strong>{formatNumber(analytics.negative_reviews)}</strong></div>
            <div className="analytics-summary-row"><span>Среднее время ответа</span><strong>{formatDuration(analytics.average_response_seconds)}</strong></div>
          </div>
          <Link className="button button-secondary" href="/app/analytics">Открыть аналитику</Link>
        </article>

        <article className="dashboard-panel dashboard-panel-accent">
          <div className="panel-heading"><span className="panel-kicker">Current plan</span><strong>{billing.plan.name}</strong></div>
          <p>{billing.pricing_finalized ? "Коммерческая цена зафиксирована." : "Коммерческая цена пока не зафиксирована. Billing schema и usage evaluation уже работают."}</p>
          <Link className="button button-secondary" href="/app/billing">Тариф и usage</Link>
        </article>
      </section>
    </>
  );
}

function formatNumber(value: number): string { return new Intl.NumberFormat("ru-RU").format(value); }
function formatAcceptance(value: number | null): string { return value === null ? "Пока нет отправленных AI-ответов" : `${Math.round(value * 100)}% дошли до отправки`; }
function formatDuration(value: number | null): string {
  if (value === null) return "—";
  if (value < 60) return `${Math.round(value)} сек`;
  if (value < 3600) return `${Math.round(value / 60)} мин`;
  return `${(value / 3600).toFixed(1)} ч`;
}
