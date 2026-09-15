"use client";

import { useQuery } from "@tanstack/react-query";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import { billingOverviewSchema } from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const metricLabels: Record<string, string> = {
  ai_drafts_monthly: "Черновики ИИ за период",
  replies_sent_monthly: "Отправленные ответы",
  marketplace_accounts: "Подключённые кабинеты",
  members: "Участники организации",
};

export function BillingWorkspace() {
  const { activeOrganization } = useWorkspace();
  const billingQuery = useQuery({
    queryKey: ["billing", "overview", activeOrganization.id],
    queryFn: () => apiRequest(buildApiQuery("/api/billing/overview", { organization_id: activeOrganization.id }), billingOverviewSchema),
  });

  if (billingQuery.isLoading) return <BillingState title="Загружаем тариф" description="Получаем план, usage и текущий период." />;
  if (billingQuery.error) return <BillingState title="Не удалось загрузить billing" description={errorMessage(billingQuery.error)} error />;
  if (!billingQuery.data) return <BillingState title="Нет данных" description="Billing overview вернул пустой ответ." />;

  const data = billingQuery.data;
  return (
    <section className="billing-workspace">
      <article className="billing-plan-card">
        <div className="billing-plan-heading">
          <div><span className="panel-kicker">Текущий тариф</span><h2>{data.plan.name}</h2><p>Код тарифа: <code>{data.plan.code}</code></p></div>
          <span className={data.subscription?.status === "active" ? "billing-status billing-status-active" : "billing-status"}>{data.subscription?.status ?? "fallback"}</span>
        </div>
        <div className="billing-price-state">
          <strong>{data.pricing_finalized && data.plan.price_month_minor !== null ? formatPrice(data.plan.price_month_minor, data.plan.currency) : "Цена ещё не зафиксирована"}</strong>
          <p>Коммерческие цены и overage не выдумываются до завершения unit economics. Схема уже готова для подключения платёжного провайдера.</p>
        </div>
        <dl className="billing-meta-grid">
          <div><dt>Период usage</dt><dd>{formatDate(data.usage_period_start)} — {formatDate(data.usage_period_end)}</dd></div>
          <div><dt>Провайдер</dt><dd>{data.subscription?.provider ?? "Не подключён"}</dd></div>
          <div><dt>Автопродление</dt><dd>{data.subscription?.cancel_at_period_end ? "Будет отключено" : "Не запрошено"}</dd></div>
        </dl>
      </article>

      <section className="billing-usage-grid" aria-label="Использование лимитов">
        {data.usage.map((item) => {
          const percent = item.limit && item.limit > 0 ? Math.min((item.used / item.limit) * 100, 100) : 0;
          return (
            <article className="billing-usage-card" key={item.metric}>
              <div className="billing-usage-heading"><span>{metricLabels[item.metric] ?? item.metric}</span><strong>{formatNumber(item.used)}{item.limit !== null ? ` / ${formatNumber(item.limit)}` : ""}</strong></div>
              {item.limit !== null ? <div className="billing-progress" aria-label={`${Math.round(percent)}% лимита использовано`}><span style={{ width: `${percent}%` }} /></div> : <div className="billing-unlimited">Коммерческий лимит не задан</div>}
              <p>{item.limit === null ? "До финализации тарифа hard limit не применяется." : item.allowed ? `Осталось: ${formatNumber(item.remaining ?? 0)}` : "Лимит исчерпан."}</p>
            </article>
          );
        })}
      </section>

      <article className="billing-foundation-note">
        <span className="panel-kicker">Платёжный контур</span>
        <h2>Что уже заложено</h2>
        <p>Основа для тарифов и подписок: расчётный период, лимиты использования, кабинеты маркетплейсов и число участников организации. Подключение платёжного провайдера будет выполнено отдельно.</p>
      </article>
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
