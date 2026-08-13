"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import { analyticsOverviewSchema, billingOverviewSchema } from "../../lib/api/schemas";
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
    return <div className="workspace-inline-state"><strong>Обновляем показатели</strong><p>Собираем текущие данные по кабинету.</p></div>;
  }
  if (analyticsQuery.error || billingQuery.error || !analyticsQuery.data || !billingQuery.data) {
    const error = analyticsQuery.error ?? billingQuery.error;
    return <div className="workspace-inline-state workspace-inline-state-error"><strong>Не удалось загрузить показатели</strong><p>{error instanceof Error ? error.message : "Нет данных"}</p></div>;
  }

  const analytics = analyticsQuery.data;
  const billing = billingQuery.data;
  const metrics = [
    { label: "Получено сообщений", value: formatNumber(analytics.total_messages), helper: `${formatNumber(analytics.new_messages)} новых` },
    { label: "Автоматических ответов", value: formatNumber(analytics.auto_replies_sent), helper: `${formatNumber(analytics.manual_replies_sent)} отправлено вручную` },
    { label: "Ждут ответа", value: formatNumber(analytics.unanswered_messages), helper: `${formatNumber(analytics.answered_messages)} уже отвечено` },
    { label: "Ответов подготовлено с ИИ", value: formatNumber(analytics.ai_drafts_generated), helper: formatAcceptance(analytics.ai_acceptance_rate) },
  ];

  return (
    <>
      <section className="dashboard-summary-band" aria-label="Краткая сводка">
        {metrics.map((metric) => (
          <div className="dashboard-summary-item" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong><p>{metric.helper}</p>
          </div>
        ))}
      </section>

      <section className="dashboard-evidence-grid" aria-label="Дополнительная информация">
        <article className="dashboard-evidence-panel">
          <div className="panel-heading"><h2>За последние 30 дней</h2><p>Результат работы с обращениями покупателей.</p></div>
          <div className="analytics-summary-list">
            <div className="analytics-summary-row"><span>Отправлено ответов</span><strong>{formatNumber(analytics.replies_sent)}</strong></div>
            <div className="analytics-summary-row"><span>Негативных отзывов</span><strong>{formatNumber(analytics.negative_reviews)}</strong></div>
            <div className="analytics-summary-row"><span>Среднее время ответа</span><strong>{formatDuration(analytics.average_response_seconds)}</strong></div>
          </div>
          <Link className="button button-secondary" href="/app/analytics">Открыть аналитику</Link>
        </article>

        <article className="dashboard-tariff-panel">
          <div className="panel-heading"><h2>Тариф</h2><strong>{billing.plan.name}</strong></div>
          <p>{billing.pricing_finalized ? "Стоимость тарифа зафиксирована." : "Стоимость тарифа ещё не опубликована. Доступные лимиты показаны в разделе тарифа."}</p>
          <Link className="button button-secondary" href="/app/billing">Открыть тариф</Link>
        </article>
      </section>
    </>
  );
}

function formatNumber(value: number): string { return new Intl.NumberFormat("ru-RU").format(value); }
function formatAcceptance(value: number | null): string { return value === null ? "Пока нет отправленных ответов с ИИ" : `${Math.round(value * 100)}% дошли до отправки`; }
function formatDuration(value: number | null): string {
  if (value === null) return "—";
  if (value < 60) return `${Math.round(value)} сек`;
  if (value < 3600) return `${Math.round(value / 60)} мин`;
  return `${(value / 3600).toFixed(1)} ч`;
}
