"use client";

import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "../../lib/api/client";
import { adminOverviewSchema } from "../../lib/api/schemas";
import type { Locale } from "../../lib/i18n";
import { useWorkspace } from "../workspace/WorkspaceProvider";

type AdminMetric = {
  label: string;
  value: string | number;
  helper: string;
  tone?: "warning";
  ratio?: number;
  ratioLabel?: string;
};
const adminCopy = {
  ru: {
    deniedDescription: "Системная панель доступна только внутреннему суперадминистратору MPReply.",
    deniedTitle: "Нет доступа к системной панели",
    loadingDescription: "Получаем актуальные показатели организаций, пользователей, подписок и фоновых процессов.",
    loadingTitle: "Загружаем системную сводку",
    retrying: "Обновляем...",
    retry: "Повторить",
    refresh: "Обновить",
    refreshError: "Не удалось обновить системные данные. Показана последняя доступная сводка.",
    errorDescription: "Системные данные сейчас недоступны. Проверьте соединение и повторите попытку.",
    errorTitle: "Не удалось загрузить системную сводку",
    integrationFailures: "Ошибки интеграций за 24 часа",
    integrationSome: "Есть неуспешные события обмена с маркетплейсами",
    integrationNone: "Неуспешных событий обмена не зафиксировано",
    failedReplies: "Неотправленные ответы за 24 часа",
    repliesSome: "Есть ответы, завершившиеся ошибкой отправки",
    repliesNone: "Ошибок отправки ответов не зафиксировано",
    organizations: "Организации",
    activeLower: "активных",
    activePercent: "активны",
    users: "Пользователи",
    allAccounts: "Все зарегистрированные аккаунты",
    activeSubscriptions: "Активные подписки",
    subscriptionsHelper: "Подписки, учтённые системой как активные",
    ofActiveOrganizations: "от активных организаций",
    usageEvents: "События использования · 30 дней",
    usageHelper: "События, учтённые системой за период",
    aiCost: "Оценка расходов на ИИ · 30 дней",
    aiCostHelper: "Оценка системных расходов за период",
    systemMetricsAria: "Системные показатели MPReply",
    operationsCenter: "Операционный центр",
    incidentsTitle: "Есть процессы, которые требуют внимания",
    healthyTitle: "Система работает без зафиксированных сбоев",
    intro: "Здесь собраны ключевые показатели продукта: активность организаций, подписки, использование, расходы ИИ и ошибки за последние 24 часа.",
    systemState: "Состояние системы",
    attention: "Требует внимания",
    stable: "Стабильно",
    noIncidents: "Ошибок интеграций и отправки ответов за 24 часа нет",
    kpiAria: "Ключевые показатели",
    activeOrganizations: "Активные организации",
    of: "из",
    registered: "зарегистрировано",
    systemData: "по данным системы",
    ai30: "ИИ · 30 дней",
    costEstimate: "оценка расходов",
    lastUpdated: "Последнее обновление",
    last24: "Последние 24 часа",
    attentionNow: "Что требует внимания сейчас",
    noIncidentsTitle: "Инцидентов за 24 часа не зафиксировано",
    productAccess: "Продукт и доступ",
    activeScope: "Масштаб активного контура",
    last30: "Последние 30 дней",
    loadAndCost: "Нагрузка и оценка расходов",
    stateData: "Системные данные",
    loadError: "Ошибка загрузки",
    permissions: "Права доступа",
  },
  en: {
    deniedDescription: "The system console is available only to the internal MPReply super administrator.",
    deniedTitle: "No access to the system console",
    loadingDescription: "Loading current organization, user, subscription, and background-process metrics.",
    loadingTitle: "Loading system overview",
    retrying: "Refreshing...",
    retry: "Retry",
    refresh: "Refresh",
    refreshError: "Could not refresh system data. Showing the latest available overview.",
    errorDescription: "System data is currently unavailable. Check your connection and try again.",
    errorTitle: "Could not load the system overview",
    integrationFailures: "Integration failures · 24 hours",
    integrationSome: "Some marketplace exchange events failed",
    integrationNone: "No failed marketplace exchange events were recorded",
    failedReplies: "Failed reply deliveries · 24 hours",
    repliesSome: "Some replies ended with a delivery error",
    repliesNone: "No reply-delivery errors were recorded",
    organizations: "Organizations",
    activeLower: "active",
    activePercent: "active",
    users: "Users",
    allAccounts: "All registered accounts",
    activeSubscriptions: "Active subscriptions",
    subscriptionsHelper: "Subscriptions currently counted by the system as active",
    ofActiveOrganizations: "of active organizations",
    usageEvents: "Usage events · 30 days",
    usageHelper: "Events recorded by the system during the period",
    aiCost: "Estimated AI cost · 30 days",
    aiCostHelper: "Estimated system cost for the period",
    systemMetricsAria: "MPReply system metrics",
    operationsCenter: "Operations center",
    incidentsTitle: "Some processes need attention",
    healthyTitle: "No recorded system incidents",
    intro: "This view combines key product metrics: organization activity, subscriptions, usage, AI cost, and failures during the last 24 hours.",
    systemState: "System state",
    attention: "Needs attention",
    stable: "Stable",
    noIncidents: "No integration or reply-delivery failures were recorded during the last 24 hours",
    kpiAria: "Key metrics",
    activeOrganizations: "Active organizations",
    of: "of",
    registered: "registered",
    systemData: "system data",
    ai30: "AI · 30 days",
    costEstimate: "estimated cost",
    lastUpdated: "Last updated",
    last24: "Last 24 hours",
    attentionNow: "What needs attention now",
    noIncidentsTitle: "No incidents recorded in the last 24 hours",
    productAccess: "Product and access",
    activeScope: "Active product footprint",
    last30: "Last 30 days",
    loadAndCost: "Usage and estimated cost",
    stateData: "System data",
    loadError: "Loading error",
    permissions: "Access permissions",
  },
} as const;

export function AdminOverviewWorkspace() {
  const { user, locale } = useWorkspace();
  const t = adminCopy[locale];
  const overviewQuery = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => apiRequest("/api/admin/overview", adminOverviewSchema),
    enabled: user.is_superadmin,
  });

  if (!user.is_superadmin) {
    return (
      <AdminOverviewState
        description={t.deniedDescription}
        title={t.deniedTitle}
        tone="denied"
        locale={locale}
      />
    );
  }

  if (overviewQuery.isLoading && !overviewQuery.data) {
    return (
      <AdminOverviewState
        description={t.loadingDescription}
        title={t.loadingTitle}
        tone="loading"
        locale={locale}
      />
    );
  }

  if (overviewQuery.error && !overviewQuery.data) {
    return (
      <AdminOverviewState
        actionDisabled={overviewQuery.isFetching}
        actionLabel={overviewQuery.isFetching ? t.retrying : t.retry}
        description={t.errorDescription}
        onAction={() => void overviewQuery.refetch()}
        title={t.errorTitle}
        tone="error"
        locale={locale}
      />
    );
  }

  const data = overviewQuery.data;
  const incidentCount = data.integration_failures_24h + data.replies_failed_24h;
  const hasIncidents = incidentCount > 0;
  const activeOrganizationRatio = ratioPercent(data.organizations_active, data.organizations_total);
  const subscriptionCoverage = ratioPercent(data.subscriptions_active, data.organizations_active);

  const incidentMetrics: AdminMetric[] = [
    {
      label: t.integrationFailures,
      value: data.integration_failures_24h,
      helper: data.integration_failures_24h > 0
        ? t.integrationSome
        : t.integrationNone,
      tone: data.integration_failures_24h > 0 ? "warning" : undefined,
    },
    {
      label: t.failedReplies,
      value: data.replies_failed_24h,
      helper: data.replies_failed_24h > 0
        ? t.repliesSome
        : t.repliesNone,
      tone: data.replies_failed_24h > 0 ? "warning" : undefined,
    },
  ];

  const productMetrics: AdminMetric[] = [
    {
      label: t.organizations,
      value: data.organizations_total,
      helper: formatNumber(data.organizations_active, locale) + " " + t.activeLower,
      ratio: activeOrganizationRatio ?? undefined,
      ratioLabel: activeOrganizationRatio === null ? undefined : activeOrganizationRatio + "% " + t.activePercent,
    },
    {
      label: t.users,
      value: data.users_total,
      helper: t.allAccounts,
    },
    {
      label: t.activeSubscriptions,
      value: data.subscriptions_active,
      helper: t.subscriptionsHelper,
      ratio: subscriptionCoverage ?? undefined,
      ratioLabel: subscriptionCoverage === null ? undefined : subscriptionCoverage + "% " + t.ofActiveOrganizations,
    },
  ];

  const usageMetrics: AdminMetric[] = [
    {
      label: t.usageEvents,
      value: data.usage_events_30d,
      helper: t.usageHelper,
    },
    {
      label: t.aiCost,
      value: formatUsd(data.ai_cost_estimate_30d, locale),
      helper: t.aiCostHelper,
    },
  ];

  return (
    <section className="admin-command-center" aria-label={t.systemMetricsAria}>
      <div className="admin-command-head">
        <div className="admin-command-copy">
          <span className="admin-command-eyebrow">
            <span
              className={hasIncidents ? "admin-command-live-dot admin-command-live-dot-warning" : "admin-command-live-dot"}
              aria-hidden="true"
            />
            {t.operationsCenter}
          </span>
          <h2>{hasIncidents ? t.incidentsTitle : t.healthyTitle}</h2>
          <p>
            {t.intro}
          </p>
        </div>

        <aside
          aria-live="polite"
          className={hasIncidents ? "admin-health-panel admin-health-panel-warning" : "admin-health-panel"}
          role="status"
        >
          <span>{t.systemState}</span>
          <strong>{hasIncidents ? t.attention : t.stable}</strong>
          <p>
            {hasIncidents
              ? formatIncidentReview(incidentCount, locale)
              : t.noIncidents}
          </p>
        </aside>
      </div>

      <div className="admin-kpi-strip" aria-label={t.kpiAria}>
        <AdminKpi label={t.activeOrganizations} value={formatNumber(data.organizations_active, locale)} helper={t.of + " " + formatNumber(data.organizations_total, locale)} />
        <AdminKpi label={t.users} value={formatNumber(data.users_total, locale)} helper={t.registered} />
        <AdminKpi label={t.activeSubscriptions} value={formatNumber(data.subscriptions_active, locale)} helper={t.systemData} />
        <AdminKpi label={t.ai30} value={formatUsd(data.ai_cost_estimate_30d, locale)} helper={t.costEstimate} />
      </div>

      <div className="admin-overview-meta">
        <div className="admin-overview-meta-copy">
          <span>{t.lastUpdated}</span>
          <strong>{formatDateTime(data.generated_at, locale)}</strong>
        </div>
        <button
          className="button button-secondary button-compact"
          disabled={overviewQuery.isFetching}
          onClick={() => void overviewQuery.refetch()}
          type="button"
        >
          {overviewQuery.isFetching ? t.retrying : t.refresh}
        </button>
      </div>

      {overviewQuery.error ? (
        <div aria-live="polite" className="admin-refresh-notice" role="status">
          <span>{t.refreshError}</span>
          <button
            className="button button-secondary button-compact"
            disabled={overviewQuery.isFetching}
            onClick={() => void overviewQuery.refetch()}
            type="button"
          >
            {overviewQuery.isFetching ? t.retrying : t.retry}
          </button>
        </div>
      ) : null}

      <div className="admin-overview-body">
        <AdminMetricSection
          className={hasIncidents ? "admin-section-incidents admin-section-alert" : "admin-section-incidents"}
          eyebrow={t.last24}
          metrics={incidentMetrics}
          locale={locale}
          summary={formatEventCount(incidentCount, locale)}
          title={hasIncidents ? t.attentionNow : t.noIncidentsTitle}
        />
        <AdminMetricSection
          className="admin-section-product"
          eyebrow={t.productAccess}
          metrics={productMetrics}
          locale={locale}
          title={t.activeScope}
        />
        <AdminMetricSection
          className="admin-section-usage"
          eyebrow={t.last30}
          metrics={usageMetrics}
          locale={locale}
          title={t.loadAndCost}
        />
      </div>
    </section>
  );
}

function AdminOverviewState({
  actionDisabled = false,
  actionLabel,
  description,
  onAction,
  title,
  tone,
  locale,
}: {
  actionDisabled?: boolean;
  actionLabel?: string;
  description: string;
  onAction?: () => void;
  title: string;
  tone: "denied" | "error" | "loading";
  locale: Locale;
}) {
  const t = adminCopy[locale];
  const eyebrow = tone === "loading" ? t.stateData : tone === "error" ? t.loadError : t.permissions;

  return (
    <section
      aria-busy={tone === "loading"}
      aria-live="polite"
      className={"admin-overview-state admin-overview-state-" + tone}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className="admin-overview-state-mark" aria-hidden="true" />
      <div className="admin-overview-state-copy">
        <span>{eyebrow}</span>
        <strong>{title}</strong>
        <p>{description}</p>
        {actionLabel && onAction ? (
          <button
            className="button button-secondary button-compact"
            disabled={actionDisabled}
            onClick={onAction}
            type="button"
          >
            {actionLabel}
          </button>
        ) : null}
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
  locale,
}: {
  className: string;
  eyebrow: string;
  metrics: AdminMetric[];
  summary?: string;
  title: string;
  locale: Locale;
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
          <AdminMetricCard metric={metric} key={metric.label} locale={locale} />
        ))}
      </div>
    </section>
  );
}

function AdminMetricCard({ metric, locale }: { metric: AdminMetric; locale: Locale }) {
  return (
    <article
      className={metric.tone === "warning" ? "admin-metric-card admin-metric-card-warning" : "admin-metric-card"}
    >
      <div className="admin-metric-card-copy">
        <span>{metric.label}</span>
        <strong>{typeof metric.value === "number" ? formatNumber(metric.value, locale) : metric.value}</strong>
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

function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU").format(value);
}

function formatEventCount(value: number, locale: Locale): string {
  const formatted = formatNumber(value, locale);
  if (locale === "en") return `${formatted} ${value === 1 ? "event" : "events"}`;

  const mod10 = value % 10;
  const mod100 = value % 100;
  const word = mod10 === 1 && mod100 !== 11
    ? "событие"
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
      ? "события"
      : "событий";
  return `${formatted} ${word}`;
}

function formatIncidentReview(value: number, locale: Locale): string {
  const count = formatEventCount(value, locale);
  if (locale === "en") return `${count} ${value === 1 ? "needs" : "need"} review`;
  return `${count} ${value === 1 ? "требует" : "требуют"} проверки`;
}

function formatUsd(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value);
}

function formatDateTime(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
