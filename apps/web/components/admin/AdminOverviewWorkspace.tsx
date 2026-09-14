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
        <p>Системная сводка доступна только внутреннему суперадминистратору MPReply.</p>
      </div>
    );
  }

  if (overviewQuery.isLoading) {
    return (
      <div className="workspace-inline-state">
        <strong>Загружаем системную сводку</strong>
        <p>Получаем актуальные показатели организаций, пользователей и фоновых процессов.</p>
      </div>
    );
  }

  if (overviewQuery.error || !overviewQuery.data) {
    return (
      <div className="workspace-inline-state workspace-inline-state-error" role="alert">
        <strong>Не удалось загрузить системную сводку</strong>
        <p>{overviewQuery.error instanceof Error ? overviewQuery.error.message : "Нет данных"}</p>
        <button className="button button-secondary button-compact" onClick={() => void overviewQuery.refetch()} type="button">
          Повторить
        </button>
      </div>
    );
  }

  const data = overviewQuery.data;
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
      helper: `${formatNumber(data.organizations_active)} активных`,
    },
    {
      label: "Пользователи",
      value: data.users_total,
      helper: "Все зарегистрированные аккаунты",
    },
    {
      label: "Активные подписки",
      value: data.subscriptions_active,
      helper: "Активные и пробные подписки",
    },
  ];
  const usageMetrics: AdminMetric[] = [
    {
      label: "События использования · 30 дней",
      value: data.usage_events_30d,
      helper: "Учтённые события потребления лимитов",
    },
    {
      label: "Оценка расходов на ИИ · 30 дней",
      value: formatUsd(data.ai_cost_estimate_30d),
      helper: "Расчёт по сохранённым ИИ-черновикам",
    },
  ];

  return (
    <section className="admin-overview" aria-label="Системные показатели MPReply">
      <div className="admin-overview-meta">
        <span>Состояние системы</span>
        <strong>Данные на {formatDateTime(data.generated_at)}</strong>
      </div>

      <div className="admin-overview-body">
        <AdminMetricSection
          className="admin-section-incidents"
          eyebrow="Последние 24 часа"
          metrics={incidentMetrics}
          title="Что требует внимания сейчас"
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

function AdminMetricSection({
  className,
  eyebrow,
  metrics,
  title,
}: {
  className: string;
  eyebrow: string;
  metrics: AdminMetric[];
  title: string;
}) {
  return (
    <section className={`admin-section ${className}`}>
      <header className="admin-section-heading">
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </header>
      <div className="admin-overview-grid">
        {metrics.map((metric) => (
          <article
            className={metric.tone === "warning" ? "admin-overview-card admin-overview-card-warning" : "admin-overview-card"}
            key={metric.label}
          >
            <span>{metric.label}</span>
            <strong>{typeof metric.value === "number" ? formatNumber(metric.value) : metric.value}</strong>
            <p>{metric.helper}</p>
          </article>
        ))}
      </div>
    </section>
  );
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
