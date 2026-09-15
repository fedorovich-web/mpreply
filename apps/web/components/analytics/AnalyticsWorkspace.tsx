"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import {
  aiUsageAnalyticsSchema,
  analyticsOverviewSchema,
  marketplaceAnalyticsSchema,
  messageAnalyticsSchema,
  productAnalyticsSchema,
} from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const dayOptions = [7, 30, 90] as const;

export function AnalyticsWorkspace() {
  const { activeOrganization } = useWorkspace();
  const [days, setDays] = useState<number>(30);
  const queryBase = { organization_id: activeOrganization.id, days };

  const overviewQuery = useQuery({
    queryKey: ["analytics", "overview", activeOrganization.id, days],
    queryFn: () => apiRequest(buildApiQuery("/api/analytics/overview", queryBase), analyticsOverviewSchema),
  });
  const messagesQuery = useQuery({
    queryKey: ["analytics", "messages", activeOrganization.id, days],
    queryFn: () => apiRequest(buildApiQuery("/api/analytics/messages", queryBase), messageAnalyticsSchema),
  });
  const marketplacesQuery = useQuery({
    queryKey: ["analytics", "marketplaces", activeOrganization.id, days],
    queryFn: () => apiRequest(buildApiQuery("/api/analytics/marketplaces", queryBase), marketplaceAnalyticsSchema),
  });
  const productsQuery = useQuery({
    queryKey: ["analytics", "products", activeOrganization.id, days],
    queryFn: () => apiRequest(buildApiQuery("/api/analytics/products", queryBase), productAnalyticsSchema),
  });
  const aiUsageQuery = useQuery({
    queryKey: ["analytics", "ai-usage", activeOrganization.id, days],
    queryFn: () => apiRequest(buildApiQuery("/api/analytics/ai-usage", queryBase), aiUsageAnalyticsSchema),
  });

  const firstError = [overviewQuery.error, messagesQuery.error, marketplacesQuery.error, productsQuery.error, aiUsageQuery.error].find(Boolean);
  const isLoading = [overviewQuery, messagesQuery, marketplacesQuery, productsQuery, aiUsageQuery].some((query) => query.isLoading);
  const maxDaily = useMemo(() => {
    const points = messagesQuery.data?.points ?? [];
    return Math.max(1, ...points.flatMap((point) => [point.imported, point.answered]));
  }, [messagesQuery.data]);

  return (
    <section className="analytics-workspace">
      <div className="analytics-toolbar">
        <div>
          <span className="panel-kicker">Текущие показатели</span>
          <strong>{activeOrganization.name}</strong>
        </div>
        <label className="analytics-period-select">
          <span>Период</span>
          <select onChange={(event) => setDays(Number(event.target.value))} value={days}>
            {dayOptions.map((option) => <option key={option} value={option}>{option} дней</option>)}
          </select>
        </label>
      </div>

      {firstError ? <WorkspaceState title="Не удалось загрузить аналитику" description={errorMessage(firstError)} tone="error" /> : null}
      {isLoading && !overviewQuery.data ? <WorkspaceState title="Считаем показатели" description="Собираем данные по обращениям, ответам и использованию ИИ." /> : null}

      {overviewQuery.data ? (
        <>
          <section className="analytics-metric-grid" aria-label="Ключевые показатели">
            <Metric label="Обращения" value={formatNumber(overviewQuery.data.total_messages)} helper={`${overviewQuery.data.new_messages} новых`} />
            <Metric label="Без ответа" value={formatNumber(overviewQuery.data.unanswered_messages)} helper={`${overviewQuery.data.answered_messages} отвечено`} tone={overviewQuery.data.unanswered_messages > 0 ? "warning" : "default"} />
            <Metric label="Ответы отправлены" value={formatNumber(overviewQuery.data.replies_sent)} helper={`${overviewQuery.data.auto_replies_sent} auto · ${overviewQuery.data.manual_replies_sent} manual`} />
            <Metric label="Черновики ИИ" value={formatNumber(overviewQuery.data.ai_drafts_generated)} helper={formatAcceptance(overviewQuery.data.ai_acceptance_rate)} />
            <Metric label="Среднее время ответа" value={formatDuration(overviewQuery.data.average_response_seconds)} helper="От создания обращения до отправки" />
            <Metric label="Негативные отзывы" value={formatNumber(overviewQuery.data.negative_reviews)} helper="Оценка 1–2" tone={overviewQuery.data.negative_reviews > 0 ? "danger" : "default"} />
          </section>

          <section className="analytics-panel-grid">
            <article className="analytics-panel analytics-panel-wide">
              <div className="analytics-panel-heading">
                <div><span className="panel-kicker">Объём</span><h2>Обращения и ответы по дням</h2></div>
                <div className="analytics-legend"><span><i className="legend-dot legend-imported" />Импортировано</span><span><i className="legend-dot legend-answered" />Отвечено</span></div>
              </div>
              {messagesQuery.data?.points.length ? (
                <div className="analytics-bars" aria-label="Динамика обращений по дням">
                  {messagesQuery.data.points.map((point) => (
                    <div className="analytics-bar-column" key={point.date} title={`${point.date}: ${point.imported} импортировано, ${point.answered} отвечено`}>
                      <div className="analytics-bar-stack">
                        <span className="analytics-bar analytics-bar-imported" style={{ height: `${Math.max((point.imported / maxDaily) * 100, point.imported ? 6 : 0)}%` }} />
                        <span className="analytics-bar analytics-bar-answered" style={{ height: `${Math.max((point.answered / maxDaily) * 100, point.answered ? 6 : 0)}%` }} />
                      </div>
                      <small>{formatDay(point.date)}</small>
                    </div>
                  ))}
                </div>
              ) : <EmptyData text="За выбранный период обращений пока нет." />}
            </article>

            <article className="analytics-panel">
              <div className="analytics-panel-heading"><div><span className="panel-kicker">Расходы на ИИ</span><h2>Использование модели</h2></div></div>
              {aiUsageQuery.data ? (
                <div className="analytics-summary-list">
                  <SummaryRow label="Черновики" value={formatNumber(aiUsageQuery.data.drafts_generated)} />
                  <SummaryRow label="Input tokens" value={formatNumber(aiUsageQuery.data.tokens_input)} />
                  <SummaryRow label="Output tokens" value={formatNumber(aiUsageQuery.data.tokens_output)} />
                  <SummaryRow label="Оценка стоимости" value={formatUsd(aiUsageQuery.data.cost_estimate)} />
                  <SummaryRow label="Средняя latency" value={formatLatency(aiUsageQuery.data.average_latency_ms)} />
                  <SummaryRow label="Safety flags" value={formatNumber(aiUsageQuery.data.safety_flagged_drafts)} />
                </div>
              ) : <EmptyData text="Данных об использовании ИИ пока нет." />}
            </article>
          </section>

          <section className="analytics-panel-grid">
            <article className="analytics-panel">
              <div className="analytics-panel-heading"><div><span className="panel-kicker">Каналы</span><h2>Маркетплейсы</h2></div></div>
              {marketplacesQuery.data?.items.length ? (
                <div className="analytics-table-wrap">
                  <table className="analytics-table"><thead><tr><th>Канал</th><th>Обращения</th><th>Отвечено</th><th>Ошибки API</th></tr></thead><tbody>
                    {marketplacesQuery.data.items.map((item) => <tr key={item.marketplace}><td>{marketplaceLabel(item.marketplace)}</td><td>{formatNumber(item.messages)}</td><td>{formatNumber(item.answered)}</td><td>{formatNumber(item.failed_integration_events)}</td></tr>)}
                  </tbody></table>
                </div>
              ) : <EmptyData text="Нет данных по маркетплейсам." />}
            </article>

            <article className="analytics-panel">
              <div className="analytics-panel-heading"><div><span className="panel-kicker">Товары</span><h2>Товары с наибольшим потоком</h2></div></div>
              {productsQuery.data?.items.length ? (
                <div className="analytics-product-list">
                  {productsQuery.data.items.slice(0, 8).map((item) => (
                    <div className="analytics-product-row" key={item.product_id}>
                      <div><strong>{item.name}</strong><small>{item.sku ? `SKU ${item.sku}` : "Без SKU"}</small></div>
                      <div><span>{formatNumber(item.messages)}</span><small>{item.negative_reviews} негативных</small></div>
                    </div>
                  ))}
                </div>
              ) : <EmptyData text="Товарная аналитика появится после синхронизации." />}
            </article>
          </section>

          {aiUsageQuery.data?.models.length ? (
            <article className="analytics-panel">
              <div className="analytics-panel-heading"><div><span className="panel-kicker">Модели</span><h2>Использование ИИ-моделей</h2></div></div>
              <div className="analytics-table-wrap">
                <table className="analytics-table"><thead><tr><th>Модель</th><th>Черновики</th><th>Токены</th><th>Стоимость</th><th>Задержка</th></tr></thead><tbody>
                  {aiUsageQuery.data.models.map((model) => <tr key={model.model}><td>{model.model}</td><td>{formatNumber(model.drafts)}</td><td>{formatNumber(model.tokens_input + model.tokens_output)}</td><td>{formatUsd(model.cost_estimate)}</td><td>{formatLatency(model.average_latency_ms)}</td></tr>)}
                </tbody></table>
              </div>
            </article>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function Metric({ label, value, helper, tone = "default" }: { label: string; value: string; helper: string; tone?: "default" | "warning" | "danger" }) {
  return <article className={`analytics-metric analytics-metric-${tone}`}><span>{label}</span><strong>{value}</strong><p>{helper}</p></article>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="analytics-summary-row"><span>{label}</span><strong>{value}</strong></div>;
}

function EmptyData({ text }: { text: string }) {
  return <p className="analytics-empty">{text}</p>;
}

function WorkspaceState({ title, description, tone = "default" }: { title: string; description: string; tone?: "default" | "error" }) {
  return <div className={tone === "error" ? "workspace-inline-state workspace-inline-state-error" : "workspace-inline-state"}><strong>{title}</strong><p>{description}</p></div>;
}

function formatNumber(value: number): string { return new Intl.NumberFormat("ru-RU").format(value); }
function formatUsd(value: number): string { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(value); }
function formatLatency(value: number | null): string { return value === null ? "—" : `${Math.round(value)} мс`; }
function formatAcceptance(value: number | null): string { return value === null ? "Пока нет отправленных ответов ИИ" : `${Math.round(value * 100)}% дошли до отправки`; }
function formatDuration(value: number | null): string {
  if (value === null) return "—";
  if (value < 60) return `${Math.round(value)} сек`;
  if (value < 3600) return `${Math.round(value / 60)} мин`;
  return `${(value / 3600).toFixed(1)} ч`;
}
function formatDay(value: string): string { return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(`${value}T00:00:00Z`)); }
function marketplaceLabel(value: string): string {
  const labels: Record<string, string> = { wildberries: "Wildberries", ozon: "Ozon", yandex_market: "Яндекс Маркет", avito: "Авито" };
  return labels[value] ?? value;
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : "Неизвестная ошибка"; }
