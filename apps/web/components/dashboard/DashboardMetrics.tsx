"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import { analyticsOverviewSchema, billingOverviewSchema } from "../../lib/api/schemas";
import { Badge, type BadgeTone } from "../ui/Badge";
import { useWorkspace } from "../workspace/WorkspaceProvider";

type OverviewMetric = {
  label: string;
  value: string;
  helper: string;
  badge: string;
  tone: BadgeTone;
};

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
    return (
      <div className="workspace-inline-state">
        <strong>Загружаем рабочий обзор</strong>
        <p>Получаем очередь обращений, ответы и данные по текущему тарифу.</p>
      </div>
    );
  }

  if (analyticsQuery.error || billingQuery.error || !analyticsQuery.data || !billingQuery.data) {
    return (
      <div className="workspace-inline-state workspace-inline-state-error">
        <strong>Не удалось загрузить рабочий обзор</strong>
        <p>Обновите страницу. Если ошибка повторится, откройте нужный раздел через меню кабинета.</p>
      </div>
    );
  }

  const analytics = analyticsQuery.data;
  const billing = billingQuery.data;
  const metrics: OverviewMetric[] = [
    {
      label: "Все обращения",
      value: formatNumber(analytics.total_messages),
      helper: `${formatNumber(analytics.new_messages)} новых за 30 дней`,
      badge: "30 дней",
      tone: "neutral",
    },
    {
      label: "Ответы отправлены",
      value: formatNumber(analytics.replies_sent),
      helper: `${formatNumber(analytics.auto_replies_sent)} автоматически · ${formatNumber(analytics.manual_replies_sent)} вручную`,
      badge: "Обработано",
      tone: "success",
    },
    {
      label: "Без ответа",
      value: formatNumber(analytics.unanswered_messages),
      helper: analytics.unanswered_messages > 0 ? "Нужны действия команды или правила автоматизации" : "Очередь без ответа пуста",
      badge: analytics.unanswered_messages > 0 ? "Требует внимания" : "Очередь чиста",
      tone: analytics.unanswered_messages > 0 ? "warning" : "success",
    },
    {
      label: "Черновики с ИИ",
      value: formatNumber(analytics.ai_drafts_generated),
      helper: formatAcceptance(analytics.ai_acceptance_rate),
      badge: "Подготовка ответов",
      tone: "info",
    },
  ];

  return (
    <>
      <section className="dashboard-cards dashboard-cards-4" aria-label="Ключевые показатели">
        {metrics.map((metric) => (
          <article className="metric-card metric-card-rich" key={metric.label}>
            <div className="metric-card-header">
              <span>{metric.label}</span>
              <Badge tone={metric.tone}>{metric.badge}</Badge>
            </div>
            <strong>{metric.value}</strong>
            <p>{metric.helper}</p>
          </article>
        ))}
      </section>

      <section className="dashboard-panel-grid" aria-label="Рабочие действия">
        <article className="dashboard-panel">
          <div className="panel-heading">
            <span className="panel-kicker">Сейчас</span>
            <strong>Очередь и внимание команды</strong>
          </div>
          <div className="analytics-summary-list">
            <div className="analytics-summary-row">
              <span>Новые обращения</span>
              <strong>{formatNumber(analytics.new_messages)}</strong>
            </div>
            <div className="analytics-summary-row">
              <span>Без ответа</span>
              <strong>{formatNumber(analytics.unanswered_messages)}</strong>
            </div>
            <div className="analytics-summary-row">
              <span>Негативные отзывы</span>
              <strong>{formatNumber(analytics.negative_reviews)}</strong>
            </div>
          </div>
          <Link className="button button-secondary" href="/app/inbox">Открыть обращения</Link>
        </article>

        <article className="dashboard-panel dashboard-panel-accent">
          <div className="panel-heading">
            <span className="panel-kicker">Тариф и использование</span>
            <strong>{billing.plan.name}</strong>
          </div>
          <p>
            {billing.pricing_finalized
              ? "Проверьте текущие лимиты и использование тарифа."
              : "Текущие лимиты и использование доступны в разделе тарифа."}
          </p>
          <Link className="button button-secondary" href="/app/billing">Открыть тариф и лимиты</Link>
        </article>
      </section>
    </>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatAcceptance(value: number | null): string {
  return value === null ? "Пока нет данных по отправленным черновикам" : `${Math.round(value * 100)}% черновиков дошли до отправки`;
}
