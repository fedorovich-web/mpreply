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
    queryFn: () => apiRequest(buildApiQuery("/api/billing/overview", { organization_id: activeOrganization.id }), billingOverviewSchema),
  });

  if (billingQuery.isLoading) return <BillingState title="Загружаем тариф" description="Получаем текущий тариф, лимиты и расчётный период." />;
  if (billingQuery.error) return <BillingState title="Не удалось загрузить тариф" description={errorMessage(billingQuery.error)} error />;
  if (!billingQuery.data) return <BillingState title="Нет данных о тарифе" description="Информация о тарифе пока недоступна." />;

  const data = billingQuery.data;
  return (
    <section className="billing-workspace">
      <article className="billing-plan-card">
        <div className="billing-plan-heading">
          <div>
            <span className="panel-kicker">Текущий тариф</span>
            <h2>{data.plan.name}</h2>
          </div>
          <span className={data.subscription?.status === "active" ? "billing-status billing-status-active" : "billing-status"}>
            {subscriptionStatusLabel(data.subscription?.status)}
          </span>
        </div>
        <div className="billing-price-state">
          <strong>{data.pricing_finalized && data.plan.price_month_minor !== null ? formatPrice(data.plan.price_month_minor, data.plan.currency) : "Стоимость уточняется"}</strong>
          <p>
            Если стоимость тарифа ещё не утверждена, MPReply не показывает выдуманную цену. Здесь появятся финальная стоимость и условия после их публикации.
          </p>
        </div>
        <dl className="billing-meta-grid">
          <div><dt>Расчётный период</dt><dd>{formatDate(data.usage_period_start)} — {formatDate(data.usage_period_end)}</dd></div>
          <div><dt>Платёжная система</dt><dd>{data.subscription?.provider ?? "Не подключена"}</dd></div>
          <div><dt>Автопродление</dt><dd>{data.subscription?.cancel_at_period_end ? "Будет отключено" : "Включено"}</dd></div>
        </dl>
      </article>

      <section className="billing-usage-grid" aria-label="Использование лимитов">
        {data.usage.map((item) => {
          const percent = item.limit && item.limit > 0 ? Math.min((item.used / item.limit) * 100, 100) : 0;
          return (
            <article className="billing-usage-card" key={item.metric}>
              <div className="billing-usage-heading">
                <span>{metricLabels[item.metric] ?? item.metric}</span>
                <strong>{formatNumber(item.used)}{item.limit !== null ? ` / ${formatNumber(item.limit)}` : ""}</strong>
              </div>
              {item.limit !== null ? (
                <div className="billing-progress" aria-label={`${Math.round(percent)}% лимита использовано`}>
                  <span style={{ width: `${percent}%` }} />
                </div>
              ) : (
                <div className="billing-unlimited">Лимит не установлен</div>
              )}
              <p>
                {item.limit === null
                  ? "Для этого показателя отдельный лимит пока не задан."
                  : item.allowed
                    ? `Осталось: ${formatNumber(item.remaining ?? 0)}`
                    : "Лимит исчерпан."}
              </p>
            </article>
          );
        })}
      </section>

      <article className="billing-foundation-note">
        <span className="panel-kicker">Лимиты и использование</span>
        <h2>Все показатели тарифа — в одном месте</h2>
        <p>
          Следите за количеством подготовленных черновиков, отправленных ответов, подключённых кабинетов и участников команды. Данные обновляются по текущему расчётному периоду.
        </p>
      </article>
    </section>
  );
}

function BillingState({ title, description, error = false }: { title: string; description: string; error?: boolean }) {
  return <div className={error ? "workspace-inline-state workspace-inline-state-error" : "workspace-inline-state"}><strong>{title}</strong><p>{description}</p></div>;
}

function subscriptionStatusLabel(status: string | null | undefined): string {
  if (status === "active") return "Активен";
  if (status === "trialing") return "Пробный период";
  if (status === "past_due") return "Нужна оплата";
  if (status === "canceled") return "Отменён";
  return "Без подписки";
}

function formatNumber(value: number): string { return new Intl.NumberFormat("ru-RU").format(value); }
function formatDate(value: string): string { return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)); }
function formatPrice(minor: number, currency: string): string { return new Intl.NumberFormat("ru-RU", { style: "currency", currency }).format(minor / 100); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : "Неизвестная ошибка"; }
