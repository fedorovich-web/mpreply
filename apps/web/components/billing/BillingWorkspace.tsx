"use client";

import { useQuery } from "@tanstack/react-query";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import { billingOverviewSchema } from "../../lib/api/schemas";
import type { Locale } from "../../lib/i18n";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const metricLabels: Record<Locale, Record<string, string>> = {
  ru: {
    ai_drafts_monthly: "Черновики с ИИ",
    replies_sent_monthly: "Отправленные ответы",
    marketplace_accounts: "Подключённые кабинеты",
    members: "Участники команды",
  },
  en: {
    ai_drafts_monthly: "AI drafts",
    replies_sent_monthly: "Replies sent",
    marketplace_accounts: "Connected seller accounts",
    members: "Team members",
  },
};

const billingCopy = {
  ru: {
    loadingDescription: "Получаем текущий тариф, расчётный период и использование лимитов.",
    loadingTitle: "Загружаем тариф",
    retry: "Повторить",
    loadErrorDescription: "Не удалось получить данные о тарифе. Проверьте соединение и повторите попытку.",
    loadErrorTitle: "Тариф временно недоступен",
    noDataDescription: "Обновите страницу или обратитесь в поддержку, если данные не появятся.",
    noDataTitle: "Нет данных о тарифе",
    refreshError: "Не удалось обновить данные. Показана последняя доступная информация.",
    refresh: "Обновить",
    currentPlan: "Текущий тариф",
    monthlyPrice: "Стоимость в месяц",
    periodNote: "Лимиты ниже относятся к текущему расчётному периоду.",
    billingPeriod: "Расчётный период",
    planStatus: "Состояние тарифа",
    renewal: "Продление",
    usage: "Использование",
    workspaceLimits: "Лимиты рабочего пространства",
    usageDescription: "Здесь учитываются только показатели, которые действительно ограничиваются или отслеживаются текущим тарифом.",
    metrics: "Показателей",
    limitReached: "Лимит достигнут",
    unlimited: "Без отдельного лимита",
    currentPeriod: "Текущий период",
    limitUsage: "Использование лимитов",
    usedPercent: "лимита использовано",
    used: "использовано",
    remaining: "Осталось",
    unlimitedDescription: "Текущий тариф не задаёт отдельное ограничение для этого показателя.",
    genericMetric: "Лимит тарифа",
    active: "Активен",
    trialing: "Пробный период",
    expired: "Период закончился",
    pastDue: "Требуется оплата",
    canceled: "Отменён",
    noSubscription: "Без подписки",
    notApplicable: "Не применяется",
    endsAtPeriod: "Отключится в конце периода",
    renewalEnabled: "Включено",
  },
  en: {
    loadingDescription: "Loading the current plan, billing period, and limit usage.",
    loadingTitle: "Loading plan",
    retry: "Retry",
    loadErrorDescription: "Could not load plan data. Check your connection and try again.",
    loadErrorTitle: "Plan data is temporarily unavailable",
    noDataDescription: "Refresh the page or contact support if the plan data does not appear.",
    noDataTitle: "No plan data available",
    refreshError: "Could not refresh the data. Showing the latest available information.",
    refresh: "Refresh",
    currentPlan: "Current plan",
    monthlyPrice: "Monthly price",
    periodNote: "The limits below apply to the current billing period.",
    billingPeriod: "Billing period",
    planStatus: "Plan status",
    renewal: "Renewal",
    usage: "Usage",
    workspaceLimits: "Workspace limits",
    usageDescription: "Only metrics that are actually limited or tracked by the current plan are shown here.",
    metrics: "Tracked metrics",
    limitReached: "Limit reached",
    unlimited: "No separate limit",
    currentPeriod: "Current period",
    limitUsage: "Limit usage",
    usedPercent: "of limit used",
    used: "used",
    remaining: "Remaining",
    unlimitedDescription: "The current plan does not set a separate limit for this metric.",
    genericMetric: "Plan limit",
    active: "Active",
    trialing: "Trial",
    expired: "Period ended",
    pastDue: "Payment required",
    canceled: "Canceled",
    noSubscription: "No subscription",
    notApplicable: "Not applicable",
    endsAtPeriod: "Ends after the current period",
    renewalEnabled: "Enabled",
  },
} as const;

export function BillingWorkspace() {
  const { activeOrganization, locale } = useWorkspace();
  const t = billingCopy[locale];
  const billingQuery = useQuery({
    queryKey: ["billing", "overview", activeOrganization.id],
    queryFn: () => apiRequest(
      buildApiQuery("/api/billing/overview", { organization_id: activeOrganization.id }),
      billingOverviewSchema,
    ),
  });

  if (billingQuery.isLoading && !billingQuery.data) {
    return (
      <BillingState
        description={t.loadingDescription}
        title={t.loadingTitle}
      />
    );
  }

  if (billingQuery.error && !billingQuery.data) {
    return (
      <BillingState
        actionLabel={t.retry}
        description={t.loadErrorDescription}
        onAction={() => void billingQuery.refetch()}
        title={t.loadErrorTitle}
        tone="error"
      />
    );
  }

  if (!billingQuery.data) {
    return (
      <BillingState
        description={t.noDataDescription}
        title={t.noDataTitle}
      />
    );
  }

  const data = billingQuery.data;
  const price = data.pricing_finalized && data.plan.price_month_minor !== null
    ? formatPrice(data.plan.price_month_minor, data.plan.currency, locale)
    : "—";

  return (
    <section className="billing-workspace">
      {billingQuery.error ? (
        <div aria-live="polite" className="billing-data-notice" role="status">
          <span>{t.refreshError}</span>
          <button onClick={() => void billingQuery.refetch()} type="button">{t.refresh}</button>
        </div>
      ) : null}

      <section className="billing-overview-grid">
        <article className="billing-plan-card">
          <div className="billing-plan-heading">
            <div>
              <span className="panel-kicker">{t.currentPlan}</span>
              <h2>{data.plan.name}</h2>
            </div>
            <span className={subscriptionStatusClass(data.subscription?.status)}>
              {subscriptionStatusLabel(data.subscription?.status, locale)}
            </span>
          </div>

          <div className="billing-price-state">
            <span>{t.monthlyPrice}</span>
            <strong>{price}</strong>
            <p>{t.periodNote}</p>
          </div>

          <dl className="billing-meta-grid">
            {data.reply_balance ? (
              <>
                <div>
                  <dt>{locale === "ru" ? "Доступно ИИ-ответов" : "AI replies available"}</dt>
                  <dd>{data.reply_balance.spendable.toLocaleString(locale === "ru" ? "ru-RU" : "en-US")}</dd>
                </div>
                <div>
                  <dt>{locale === "ru" ? "Оплаченный остаток" : "Paid reply balance"}</dt>
                  <dd>{data.reply_balance.paid_available.toLocaleString(locale === "ru" ? "ru-RU" : "en-US")}</dd>
                </div>
                {data.reply_balance.paid_available > 0 && !data.reply_balance.paid_entitled ? (
                  <div>
                    <dt>{locale === "ru" ? "Ответы сохранены" : "Your replies are saved"}</dt>
                    <dd>{locale === "ru" ? "Для использования нужен действующий оплаченный тариф." : "An active paid plan is required to use this balance."}</dd>
                  </div>
                ) : null}
                {data.reply_balance.trial_ends_at ? (
                  <div>
                    <dt>{locale === "ru" ? "Пробный период до" : "Trial ends on"}</dt>
                    <dd>{formatDate(data.reply_balance.trial_ends_at, locale)}</dd>
                  </div>
                ) : null}
              </>
            ) : null}
            <div>
              <dt>{t.billingPeriod}</dt>
              <dd>{formatDate(data.usage_period_start, locale)} — {formatDate(data.usage_period_end, locale)}</dd>
            </div>
            <div>
              <dt>{t.planStatus}</dt>
              <dd>{subscriptionStatusLabel(data.subscription?.status, locale)}</dd>
            </div>
            <div>
              <dt>{t.renewal}</dt>
              <dd>{renewalLabel(data.subscription, locale)}</dd>
            </div>
          </dl>
        </article>

        <aside className="billing-summary-card">
          <span className="panel-kicker">{t.usage}</span>
          <h2>{t.workspaceLimits}</h2>
          <p>
            {t.usageDescription}
          </p>
          <div className="billing-summary-list">
            <SummaryItem label={t.metrics} value={formatNumber(data.usage.length, locale)} />
            <SummaryItem
              label={t.limitReached}
              tone={data.usage.some((item) => !item.allowed) ? "warning" : "default"}
              value={formatNumber(data.usage.filter((item) => !item.allowed).length, locale)}
            />
            <SummaryItem
              label={t.unlimited}
              value={formatNumber(data.usage.filter((item) => item.limit === null).length, locale)}
            />
          </div>
        </aside>
      </section>

      <section className="billing-section" aria-labelledby="billing-usage-title">
        <div className="billing-section-heading">
          <div>
            <span className="panel-kicker">{t.currentPeriod}</span>
            <h2 id="billing-usage-title">{t.limitUsage}</h2>
          </div>
          <span className="billing-period-label">
            {formatDate(data.usage_period_start, locale)} — {formatDate(data.usage_period_end, locale)}
          </span>
        </div>

        <div className="billing-usage-grid">
          {data.usage.map((item) => {
            const percent = item.limit === null
              ? null
              : item.limit === 0
                ? 100
                : Math.min((item.used / item.limit) * 100, 100);
            const isNearLimit = percent !== null && percent >= 80;

            return (
              <article
                className={isNearLimit ? "billing-usage-card billing-usage-card-warning" : "billing-usage-card"}
                key={item.metric}
              >
                <div className="billing-usage-heading">
                  <span>{metricLabel(item.metric, locale)}</span>
                  <strong>
                    {formatNumber(item.used, locale)}
                    {item.limit !== null ? ` / ${formatNumber(item.limit, locale)}` : ""}
                  </strong>
                </div>

                {percent !== null ? (
                  <>
                    <div
                      aria-label={`${Math.round(percent)}% ${t.usedPercent}`}
                      className="billing-progress"
                    >
                      <span style={{ width: `${percent}%` }} />
                    </div>
                    <div className="billing-usage-caption">
                      <span>{Math.round(percent)}% {t.used}</span>
                      <span>{item.allowed ? `${t.remaining}: ${formatNumber(item.remaining ?? 0, locale)}` : t.limitReached}</span>
                    </div>
                  </>
                ) : (
                  <div className="billing-unlimited">
                    <strong>{t.unlimited}</strong>
                    <span>{t.unlimitedDescription}</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function BillingState({
  title,
  description,
  tone = "default",
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  tone?: "default" | "error";
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className={tone === "error" ? "workspace-inline-state workspace-inline-state-error" : "workspace-inline-state"}>
      <strong>{title}</strong>
      <p>{description}</p>
      {actionLabel && onAction ? (
        <button className="button button-secondary button-compact" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function SummaryItem({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className={tone === "warning" ? "billing-summary-item billing-summary-item-warning" : "billing-summary-item"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function metricLabel(metric: string, locale: Locale): string {
  return metricLabels[locale][metric] ?? billingCopy[locale].genericMetric;
}

function subscriptionStatusLabel(status: string | null | undefined, locale: Locale): string {
  const t = billingCopy[locale];
  if (status === "active") return t.active;
  if (status === "trialing") return t.trialing;
  if (status === "expired") return t.expired;
  if (status === "past_due") return t.pastDue;
  if (status === "canceled") return t.canceled;
  return t.noSubscription;
}

function subscriptionStatusClass(status: string | null | undefined): string {
  if (status === "active" || status === "trialing") return "billing-status billing-status-active";
  if (status === "past_due") return "billing-status billing-status-warning";
  return "billing-status";
}

function renewalLabel(
  subscription: { status: string; cancel_at_period_end: boolean; provider?: string | null } | null | undefined,
  locale: Locale,
): string {
  const t = billingCopy[locale];
  if (!subscription?.provider || subscription.status !== "active") return t.notApplicable;
  return subscription.cancel_at_period_end ? t.endsAtPeriod : t.renewalEnabled;
}

function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU").format(value);
}

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatPrice(minor: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU", {
    style: "currency",
    currency,
  }).format(minor / 100);
}
