"use client";

import { useQuery } from "@tanstack/react-query";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import { billingOverviewSchema } from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const metricLabels: Record<string, string> = {
  ai_drafts_monthly: "Черновики с ИИ",
  replies_sent_monthly: "Отправленные ответы",
  marketplace_accounts: "Подключённые кабинеты",
  members: "Участники команды",
};

export function BillingWorkspace() {
  const { activeOrganization } = useWorkspace();
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
        description="Получаем текущий тариф, расчётный период и использование лимитов."
        title="Загружаем тариф"
      />
    );
  }

  if (billingQuery.error && !billingQuery.data) {
    return (
      <BillingState
        actionLabel="Повторить"
        description="Не удалось получить данные о тарифе. Проверьте соединение и повторите попытку."
        onAction={() => void billingQuery.refetch()}
        title="Тариф временно недоступен"
        tone="error"
      />
    );
  }

  if (!billingQuery.data) {
    return (
      <BillingState
        description="Обновите страницу или обратитесь в поддержку, если данные не появятся."
        title="Нет данных о тарифе"
      />
    );
  }

  const data = billingQuery.data;
  const price = data.pricing_finalized && data.plan.price_month_minor !== null
    ? formatPrice(data.plan.price_month_minor, data.plan.currency)
    : "—";

  return (
    <section className="billing-workspace">
      {billingQuery.error ? (
        <div className="billing-data-notice" role="status">
          <span>Не удалось обновить данные. Показана последняя доступная информация.</span>
          <button onClick={() => void billingQuery.refetch()} type="button">Обновить</button>
        </div>
      ) : null}

      <section className="billing-overview-grid">
        <article className="billing-plan-card">
          <div className="billing-plan-heading">
            <div>
              <span className="panel-kicker">Текущий тариф</span>
              <h2>{data.plan.name}</h2>
            </div>
            <span className={subscriptionStatusClass(data.subscription?.status)}>
              {subscriptionStatusLabel(data.subscription?.status)}
            </span>
          </div>

          <div className="billing-price-state">
            <span>Стоимость в месяц</span>
            <strong>{price}</strong>
            <p>Лимиты ниже относятся к текущему расчётному периоду.</p>
          </div>

          <dl className="billing-meta-grid">
            <div>
              <dt>Расчётный период</dt>
              <dd>{formatDate(data.usage_period_start)} — {formatDate(data.usage_period_end)}</dd>
            </div>
            <div>
              <dt>Состояние тарифа</dt>
              <dd>{subscriptionStatusLabel(data.subscription?.status)}</dd>
            </div>
            <div>
              <dt>Продление</dt>
              <dd>{renewalLabel(data.subscription)}</dd>
            </div>
          </dl>
        </article>

        <aside className="billing-summary-card">
          <span className="panel-kicker">Использование</span>
          <h2>Лимиты рабочего пространства</h2>
          <p>
            Здесь учитываются только показатели, которые действительно ограничиваются или отслеживаются текущим тарифом.
          </p>
          <div className="billing-summary-list">
            <SummaryItem label="Показателей" value={formatNumber(data.usage.length)} />
            <SummaryItem
              label="Лимит достигнут"
              tone={data.usage.some((item) => !item.allowed) ? "warning" : "default"}
              value={formatNumber(data.usage.filter((item) => !item.allowed).length)}
            />
            <SummaryItem
              label="Без отдельного лимита"
              value={formatNumber(data.usage.filter((item) => item.limit === null).length)}
            />
          </div>
        </aside>
      </section>

      <section className="billing-section" aria-labelledby="billing-usage-title">
        <div className="billing-section-heading">
          <div>
            <span className="panel-kicker">Текущий период</span>
            <h2 id="billing-usage-title">Использование лимитов</h2>
          </div>
          <span className="billing-period-label">
            {formatDate(data.usage_period_start)} — {formatDate(data.usage_period_end)}
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
                  <span>{metricLabel(item.metric)}</span>
                  <strong>
                    {formatNumber(item.used)}
                    {item.limit !== null ? ` / ${formatNumber(item.limit)}` : ""}
                  </strong>
                </div>

                {percent !== null ? (
                  <>
                    <div
                      aria-label={`${Math.round(percent)}% лимита использовано`}
                      className="billing-progress"
                    >
                      <span style={{ width: `${percent}%` }} />
                    </div>
                    <div className="billing-usage-caption">
                      <span>{Math.round(percent)}% использовано</span>
                      <span>{item.allowed ? `Осталось: ${formatNumber(item.remaining ?? 0)}` : "Лимит достигнут"}</span>
                    </div>
                  </>
                ) : (
                  <div className="billing-unlimited">
                    <strong>Без отдельного лимита</strong>
                    <span>Текущий тариф не задаёт отдельное ограничение для этого показателя.</span>
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

function metricLabel(metric: string): string {
  return metricLabels[metric] ?? "Лимит тарифа";
}

function subscriptionStatusLabel(status: string | null | undefined): string {
  if (status === "active") return "Активен";
  if (status === "trialing") return "Пробный период";
  if (status === "past_due") return "Требуется оплата";
  if (status === "canceled") return "Отменён";
  return "Без подписки";
}

function subscriptionStatusClass(status: string | null | undefined): string {
  if (status === "active" || status === "trialing") return "billing-status billing-status-active";
  if (status === "past_due") return "billing-status billing-status-warning";
  return "billing-status";
}

function renewalLabel(subscription: { cancel_at_period_end: boolean } | null | undefined): string {
  if (!subscription) return "Не применяется";
  return subscription.cancel_at_period_end ? "Отключится в конце периода" : "Включено";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatPrice(minor: number, currency: string): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
  }).format(minor / 100);
}
