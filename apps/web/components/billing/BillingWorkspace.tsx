"use client";

import { useQuery } from "@tanstack/react-query";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import { billingOverviewSchema } from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const metricLabels: Record<string, string> = {
  ai_drafts_monthly: "Ответы с ИИ за период",
  replies_sent_monthly: "Отправленные ответы",
  marketplace_accounts: "Подключённые кабинеты",
  members: "Сотрудники",
};

export function BillingWorkspace() {
  const { activeOrganization } = useWorkspace();
  const billingQuery = useQuery({
    queryKey: ["billing", "overview", activeOrganization.id],
    queryFn: () => apiRequest(buildApiQuery("/api/billing/overview", { organization_id: activeOrganization.id }), billingOverviewSchema),
  });

  if (billingQuery.isLoading) return <BillingState title="Загружаем тариф" description="Получаем тариф, лимиты и текущий период." />;
  if (billingQuery.error) return <BillingState title="Не удалось загрузить тариф" description={errorMessage(billingQuery.error)} error />;
  if (!billingQuery.data) return <BillingState title="Нет данных" description="Информация о тарифе пока недоступна." />;

  const data = billingQuery.data;
  return (
    <section className="billing-workspace">
      <article className="billing-plan-card">
        <div className="billing-plan-heading">
          <div><h2>Текущий тариф</h2><strong>{data.plan.name}</strong></div>
          <span className={data.subscription?.status === "active" ? "billing-status billing-status-active" : "billing-status"}>{data.subscription?.status === "active" ? "Активен" : "Без подписки"}</span>
        </div>
        <div className="billing-price-state">
          <strong>{data.pricing_finalized && data.plan.price_month_minor !== null ? formatPrice(data.plan.price_month_minor, data.plan.currency) : "Цена ещё не опубликована"}</strong>
          <p>{data.pricing_finalized ? "Стоимость указана для текущего расчётного периода." : "Стоимость появится здесь после публикации тарифа."}</p>
        </div>
        <dl className="billing-meta-grid">
          <div><dt>Расчётный период</dt><dd>{formatDate(data.usage_period_start)} — {formatDate(data.usage_period_end)}</dd></div>
          <div><dt>Подписка</dt><dd>{data.subscription?.status === "active" ? "Активна" : "Не оформлена"}</dd></div>
          <div><dt>Автопродление</dt><dd>{data.subscription?.cancel_at_period_end ? "Будет отключено" : "Не запрошено"}</dd></div>
        </dl>
      </article>

      <section className="billing-usage-grid" aria-label="Использование лимитов">
        {data.usage.map((item) => {
          const percent = item.limit && item.limit > 0 ? Math.min((item.used / item.limit) * 100, 100) : 0;
          return (
            <article className="billing-usage-card" key={item.metric}>
              <div className="billing-usage-heading"><span>{metricLabels[item.metric] ?? item.metric}</span><strong>{formatNumber(item.used)}{item.limit !== null ? ` / ${formatNumber(item.limit)}` : ""}</strong></div>
              {item.limit !== null ? <div className="billing-progress" aria-label={`${Math.round(percent)}% лимита использовано`}><span style={{ width: `${percent}%` }} /></div> : <div className="billing-unlimited">Лимит не задан</div>}
              <p>{item.limit === null ? "Ограничение для этого показателя не установлено." : item.allowed ? `Осталось: ${formatNumber(item.remaining ?? 0)}` : "Лимит исчерпан."}</p>
            </article>
          );
        })}
      </section>

    </section>
  );
}

function BillingState({ title, description, error = false }: { title: string; description: string; error?: boolean }) {
  return <div className={error ? "workspace-inline-state workspace-inline-state-error" : "workspace-inline-state"}><strong>{title}</strong><p>{description}</p></div>;
}
function formatNumber(value: number): string { return new Intl.NumberFormat("ru-RU").format(value); }
function formatDate(value: string): string { return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)); }
function formatPrice(minor: number, currency: string): string { return new Intl.NumberFormat("ru-RU", { style: "currency", currency }).format(minor / 100); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : "Неизвестная ошибка"; }
