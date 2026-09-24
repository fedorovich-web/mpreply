"use client";

import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "../../lib/api/client";
import { adminOverviewSchema } from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

type AdminMetric = {
  label: string;
  value: string | number;
  helper: string;
  tone?: "warning";
  ratio?: number;
  ratioLabel?: string;
};

export function AdminOverviewWorkspace() {
  const { user } = useWorkspace();
  const overviewQuery = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => apiRequest("/api/admin/overview", adminOverviewSchema),
    enabled: user.is_superadmin,
  });

  if (!user.is_superadmin) {
    return (
      <div className="workspace-inline-state workspace-inline-state-error">
        <strong>Доступ запрещён</strong>
        <p>Системная панель доступна только внутреннему суперадминистратору MPReply.</p>
      </div>
    );
  }

  if (overviewQuery.isLoading) {
    return (
      <div className="workspace-inline-state">
        <strong>Загружаем системную панель</strong>
        <p>Получаем актуальные показатели организаций, пользователей, подписок и фоновых процессов.</p>
      </div>
    );
  }

  if (overviewQuery.error || !overviewQuery.data) {
    return (
      <div className="workspace-inline-state workspace-inline-state-error" role="alert">
        <strong>Не удалось загрузить системную панель</strong>
        <p>{overviewQuery.error instanceof Error ? overviewQuery.error.message : "Нет данных"}</p>
        <button className="button button-secondary button-compact" onClick={() => void overviewQuery.refetch()} type="button">
          Повторить
        </button>
      </div>
    );
  }

  const data = overviewQuery.data;
  const incidentCount = data.integration_failures_24h + data.replies_failed_24h;
  const hasIncidents = incidentCount > 0;
  const activeOrganizationRatio = ratioPercent(data.organizations_active, data.organizations_total);
  const subscriptionCoverage = ratioPercent(data.subscriptions_active, data.organizations_active);

  const incidentMetrics: AdminMetric[] = [
    {
      label: "Ошибки интеграций за 24 часа",
      value: data.integration_failures_24h,
      helper: data.integration_failures_24h > 0
        ? "Есть неуспешные события обмена с маркетплейсами"
        : "Неуспешных событий обмена не зафиксировано",
      tone: data.integration_failures_24h > 0 ? "warning" : undefined,
    },
    {
      label: "Неотправленные ответы за 24 часа",
      value: data.replies_failed_24h,
      helper: data.replies_failed_24h > 0
        ? "Есть ответы, завершившиеся ошибкой отправки"
        : "Ошибок отправки ответов не зафиксировано",
      tone: data.replies_failed_24h > 0 ? "warning" : undefined,
    },
  ];

  const productMetrics: AdminMetric[] = [
    {
      label: "Организации",
      value: data.organizations_total,
      helper: formatNumber(data.organizations_active) + " активных",
      ratio: activeOrganizationRatio ?? undefined,
      ratioLabel: activeOrganizationRatio === null ? undefined : activeOrganizationRatio + "% активны",
    },
    {
      label: "Пользователи",
      value: data.users_total,
      helper: "Все зарегистрированные аккаунты",
    },
    {
      label: "Активные подписки",
      value: data.subscriptions_active,
      helper: "Подписки, учтённые системой как активные",
      ratio: subscriptionCoverage ?? undefined,
      ratioLabel: subscriptionCoverage === null ? undefined : subscriptionCoverage + "% от активных организаций",
    },
  ];

  const usageMetrics: AdminMetric[] = [
    {
      label: "События использования · 30 дней",
      value: data.usage_events_30d,
      helper: "События, учтённые системой за период",
    },
    {
      label: "Оценка расходов на ИИ · 30 дней",
      value: formatUsd(data.ai_cost_estimate_30d),
      helper: "Оценка системных расходов за период",
    },
  ];

  return (
    <section className="admin-command-center" aria-label="Системные показатели MPReply">
      <div className="admin-command-head">
        <div className="admin-command-copy">
          <span className="admin-command-eyebrow">
            <span
              className={hasIncidents ? "admin-command-live-dot admin-command-live-dot-warning" : "admin-command-live-dot"}
              aria-hidden="true"
            />
            Операционный центр
          </span>
          <h2>{hasIncidents ? "Есть процессы, которые требуют внимания" : "Система работает без зафиксированных сбоев"}</h2>
          <p>
            Сводка строится только по фактическим данным системного API: активность организаций,
            подписки, использование, расходы ИИ и ошибки за последние 24 часа.
          </p>
        </div>

        <aside
          aria-live="polite"
          className={hasIncidents ? "admin-health-panel admin-health-panel-warning" : "admin-health-panel"}
          role="status"
        >
          <span>Состояние системы</span>
          <strong>{hasIncidents ? "Требует внимания" : "Стабильно"}</strong>
          <p>
            {hasIncidents
              ? formatNumber(incidentCount) + " событий требуют проверки"
              : "Ошибок интеграций и отправки ответов за 24 часа нет"}
          </p>
        </aside>
      </div>

      <div className="admin-kpi-strip" aria-label="Ключевые показатели">
        <AdminKpi label="Активные организации" value={formatNumber(data.organizations_active)} helper={"из " + formatNumber(data.organizations_total)} />
        <AdminKpi label="Пользователи" value={formatNumber(data.users_total)} helper="зарегистрировано" />
        <AdminKpi label="Активные подписки" value={formatNumber(data.subscriptions_active)} helper="по данным системы" />
        <AdminKpi label="ИИ · 30 дней" value={formatUsd(data.ai_cost_estimate_30d)} helper="оценка расходов" />
      </div>

      <div className="admin-overview-meta">
        <span>Последнее обновление</span>
        <strong>{formatDateTime(data.generated_at)}</strong>
      </div>

      <div className="admin-overview-body">
        <AdminMetricSection
          className={hasIncidents ? "admin-section-incidents admin-section-alert" : "admin-section-incidents"}
          eyebrow="Последние 24 часа"
          metrics={incidentMetrics}
          summary={formatNumber(incidentCount) + " событий"}
          title={hasIncidents ? "Что требует внимания сейчас" : "Инцидентов за 24 часа не зафиксировано"}
        />
        <AdminMetricSection
          className="admin-section-product"
          eyebrow="Продукт и доступ"
          metrics={productMetrics}
          title="Масштаб активного контура"
        />
        <AdminMetricSection
          className="admin-section-usage"
          eyebrow="Последние 30 дней"
          metrics={usageMetrics}
          title="Нагрузка и оценка расходов"
        />
      </div>
    </section>
  );
}

function AdminKpi({ helper, label, value }: { helper: string; label: string; value: string }) {
  return (
    <article className="admin-kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  );
}

function AdminMetricSection({
  className,
  eyebrow,
  metrics,
  summary,
  title,
}: {
  className: string;
  eyebrow: string;
  metrics: AdminMetric[];
  summary?: string;
  title: string;
}) {
  return (
    <section className={"admin-section " + className}>
      <header className="admin-section-heading">
        <span>{eyebrow}</span>
        <h3>{title}</h3>
        {summary ? <strong className="admin-section-summary">{summary}</strong> : null}
      </header>
      <div className="admin-overview-grid">
        {metrics.map((metric) => (
          <AdminMetricCard metric={metric} key={metric.label} />
        ))}
      </div>
    </section>
  );
}

function AdminMetricCard({ metric }: { metric: AdminMetric }) {
  return (
    <article
      className={metric.tone === "warning" ? "admin-metric-card admin-metric-card-warning" : "admin-metric-card"}
    >
      <div className="admin-metric-card-copy">
        <span>{metric.label}</span>
        <strong>{typeof metric.value === "number" ? formatNumber(metric.value) : metric.value}</strong>
        <p>{metric.helper}</p>
      </div>
      {metric.ratio !== undefined && metric.ratioLabel ? (
        <div className="admin-metric-progress">
          <div className="admin-metric-progress-track" aria-hidden="true">
            <span style={{ width: Math.min(metric.ratio, 100) + "%" }} />
          </div>
          <small>{metric.ratioLabel}</small>
        </div>
      ) : null}
    </article>
  );
}

function ratioPercent(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((part / total) * 100);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
