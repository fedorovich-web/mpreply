"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import {
  analyticsOverviewSchema,
  marketplaceAnalyticsSchema,
  messageAnalyticsSchema,
  productAnalyticsSchema,
  teamAnalyticsSchema,
} from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const dayOptions = [7, 30, 90] as const;
type DayOption = (typeof dayOptions)[number];

export function AnalyticsWorkspace() {
  const { activeOrganization } = useWorkspace();
  const [days, setDays] = useState<DayOption>(30);
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
  const teamQuery = useQuery({
    queryKey: ["analytics", "team", activeOrganization.id, days],
    queryFn: () => apiRequest(buildApiQuery("/api/analytics/team", queryBase), teamAnalyticsSchema),
  });

  const messagePoints = messagesQuery.data?.points ?? [];
  const hasMessageActivity = messagePoints.some((point) => point.imported > 0 || point.answered > 0);
  const maxDaily = useMemo(
    () => Math.max(1, ...messagePoints.flatMap((point) => [point.imported, point.answered])),
    [messagePoints],
  );
  const isRefreshing = [overviewQuery, messagesQuery, marketplacesQuery, productsQuery, teamQuery].some(
    (query) => query.isFetching,
  );

  function retryAnalytics() {
    void Promise.all([
      overviewQuery.refetch(),
      messagesQuery.refetch(),
      marketplacesQuery.refetch(),
      productsQuery.refetch(),
      teamQuery.refetch(),
    ]);
  }

  return (
    <section className="analytics-workspace">
      <div className="analytics-toolbar">
        <div>
          <span className="panel-kicker">Рабочее пространство</span>
          <strong>{activeOrganization.name}</strong>
        </div>

        <div className="analytics-toolbar-controls">
          {isRefreshing ? <span className="analytics-refresh-state">Обновляем данные…</span> : null}
          <div className="analytics-period-control" aria-label="Период аналитики">
            <span>Период</span>
            <div className="analytics-period-options">
              {dayOptions.map((option) => (
                <button
                  aria-pressed={days === option}
                  className={days === option ? "analytics-period-option analytics-period-option-active" : "analytics-period-option"}
                  key={option}
                  onClick={() => setDays(option)}
                  type="button"
                >
                  {option} дней
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {overviewQuery.error && overviewQuery.data ? (
        <DataNotice onRetry={retryAnalytics} />
      ) : null}

      {overviewQuery.isLoading && !overviewQuery.data ? (
        <WorkspaceState
          description="Собираем обращения и ответы за выбранный период."
          title="Загружаем аналитику"
        />
      ) : null}

      {overviewQuery.error && !overviewQuery.data ? (
        <WorkspaceState
          actionLabel="Повторить"
          description="Не удалось получить основные показатели. Проверьте соединение и повторите попытку."
          onAction={retryAnalytics}
          title="Аналитика временно недоступна"
          tone="error"
        />
      ) : null}

      {overviewQuery.data ? (
        <>
          <section className="analytics-metric-grid" aria-label="Ключевые показатели">
            <Metric
              helper={`${formatNumber(overviewQuery.data.new_messages)} новых за период`}
              label="Всего обращений"
              value={formatNumber(overviewQuery.data.total_messages)}
            />
            <Metric
              helper={`${formatNumber(overviewQuery.data.answered_messages)} уже обработано`}
              label="Требуют ответа"
              tone={overviewQuery.data.unanswered_messages > 0 ? "warning" : "default"}
              value={formatNumber(overviewQuery.data.unanswered_messages)}
            />
            <Metric
              helper={`${formatNumber(overviewQuery.data.auto_replies_sent)} автоматически · ${formatNumber(overviewQuery.data.manual_replies_sent)} после проверки`}
              label="Ответов отправлено"
              value={formatNumber(overviewQuery.data.replies_sent)}
            />
            <Metric
              helper="От обращения до отправки ответа"
              label="Среднее время ответа"
              value={formatDuration(overviewQuery.data.average_response_seconds)}
            />
          </section>

          <section className="analytics-panel-grid">
            <article className="analytics-panel analytics-panel-wide">
              <div className="analytics-panel-heading">
                <div>
                  <span className="panel-kicker">Динамика</span>
                  <h2>Обращения и ответы по дням</h2>
                </div>
                <div className="analytics-legend" aria-label="Легенда">
                  <span><i className="legend-dot legend-imported" />Получено</span>
                  <span><i className="legend-dot legend-answered" />Отвечено</span>
                </div>
              </div>

              {messagesQuery.error && messagesQuery.data ? <PanelNotice /> : null}
              {messagesQuery.isLoading && !messagesQuery.data ? <PanelState text="Загружаем динамику…" /> : null}
              {messagesQuery.error && !messagesQuery.data ? <PanelState text="Не удалось загрузить динамику обращений." /> : null}
              {messagesQuery.data && hasMessageActivity ? (
                <div className="analytics-bars" aria-label="Динамика обращений по дням">
                  {messagePoints.map((point) => (
                    <div
                      className="analytics-bar-column"
                      key={point.date}
                      title={`${formatDate(point.date)}: ${point.imported} получено, ${point.answered} отвечено`}
                    >
                      <div className="analytics-bar-stack">
                        <span
                          className="analytics-bar analytics-bar-imported"
                          style={{ height: `${Math.max((point.imported / maxDaily) * 100, point.imported ? 6 : 0)}%` }}
                        />
                        <span
                          className="analytics-bar analytics-bar-answered"
                          style={{ height: `${Math.max((point.answered / maxDaily) * 100, point.answered ? 6 : 0)}%` }}
                        />
                      </div>
                      <small>{formatDay(point.date)}</small>
                    </div>
                  ))}
                </div>
              ) : null}
              {messagesQuery.data && !hasMessageActivity ? <EmptyData text="За выбранный период обращений пока нет." /> : null}
            </article>

            <article className="analytics-panel">
              <div className="analytics-panel-heading">
                <div>
                  <span className="panel-kicker">Обработка</span>
                  <h2>Что происходит с ответами</h2>
                </div>
              </div>
              <div className="analytics-summary-list">
                <SummaryRow label="Отвечено на обращения" value={formatNumber(overviewQuery.data.answered_messages)} />
                <SummaryRow label="Отправлено автоматически" value={formatNumber(overviewQuery.data.auto_replies_sent)} />
                <SummaryRow label="Отправлено после проверки" value={formatNumber(overviewQuery.data.manual_replies_sent)} />
                <SummaryRow label="Подготовлено черновиков с ИИ" value={formatNumber(overviewQuery.data.ai_drafts_generated)} />
                <SummaryRow label="Черновики с ИИ, дошедшие до отправки" value={formatAcceptance(overviewQuery.data.ai_acceptance_rate)} />
                <SummaryRow
                  label="Негативные отзывы"
                  value={formatNumber(overviewQuery.data.negative_reviews)}
                  tone={overviewQuery.data.negative_reviews > 0 ? "danger" : "default"}
                />
              </div>
            </article>
          </section>

          <section className="analytics-panel-grid analytics-panel-grid-even">
            <article className="analytics-panel">
              <div className="analytics-panel-heading">
                <div>
                  <span className="panel-kicker">Площадки</span>
                  <h2>Где больше обращений</h2>
                </div>
              </div>

              {marketplacesQuery.error && marketplacesQuery.data ? <PanelNotice /> : null}
              {marketplacesQuery.isLoading && !marketplacesQuery.data ? <PanelState text="Загружаем данные по площадкам…" /> : null}
              {marketplacesQuery.error && !marketplacesQuery.data ? <PanelState text="Не удалось загрузить данные по площадкам." /> : null}
              {marketplacesQuery.data?.items.length ? (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Площадка</th>
                        <th>Обращения</th>
                        <th>Обработано</th>
                        <th>Сбои обновления</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marketplacesQuery.data.items.map((item) => (
                        <tr key={item.marketplace}>
                          <td>{marketplaceLabel(item.marketplace)}</td>
                          <td>{formatNumber(item.messages)}</td>
                          <td>{formatNumber(item.answered)}</td>
                          <td>{formatNumber(item.failed_integration_events)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {marketplacesQuery.data && !marketplacesQuery.data.items.length ? (
                <EmptyData text="Данные по площадкам появятся после получения обращений." />
              ) : null}
            </article>

            <article className="analytics-panel">
              <div className="analytics-panel-heading">
                <div>
                  <span className="panel-kicker">Товары</span>
                  <h2>Товары с наибольшим числом обращений</h2>
                </div>
              </div>

              {productsQuery.error && productsQuery.data ? <PanelNotice /> : null}
              {productsQuery.isLoading && !productsQuery.data ? <PanelState text="Загружаем данные по товарам…" /> : null}
              {productsQuery.error && !productsQuery.data ? <PanelState text="Не удалось загрузить данные по товарам." /> : null}
              {productsQuery.data?.items.length ? (
                <div className="analytics-product-list">
                  {productsQuery.data.items.slice(0, 8).map((item) => (
                    <div className="analytics-product-row" key={item.product_id}>
                      <div>
                        <strong>{item.name}</strong>
                        <small>{item.sku ? `Артикул: ${item.sku}` : "Артикул не указан"}</small>
                      </div>
                      <div>
                        <span>{formatNumber(item.messages)}</span>
                        <small>Негативных отзывов: {formatNumber(item.negative_reviews)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {productsQuery.data && !productsQuery.data.items.length ? (
                <EmptyData text="Данные по товарам появятся, когда обращения будут связаны с товарами." />
              ) : null}
            </article>
          </section>

          <article className="analytics-panel analytics-team-panel">
            <div className="analytics-panel-heading">
              <div>
                <span className="panel-kicker">Команда</span>
                <h2>Ответы за выбранный период</h2>
              </div>
            </div>

            {teamQuery.error && teamQuery.data ? <PanelNotice /> : null}
            {teamQuery.isLoading && !teamQuery.data ? <PanelState text="Загружаем данные по команде…" /> : null}
            {teamQuery.error && !teamQuery.data ? <PanelState text="Не удалось загрузить данные по команде." /> : null}
            {teamQuery.data?.items.length ? (
              <div className="analytics-team-list">
                {teamQuery.data.items.slice(0, 8).map((item) => (
                  <div className="analytics-team-row" key={item.user_id}>
                    <div>
                      <strong>{item.name || item.email}</strong>
                      {item.name ? <small>{item.email}</small> : null}
                    </div>
                    <div>
                      <strong>{formatNumber(item.replies_sent)}</strong>
                      <small>отправлено ответов</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {teamQuery.data && !teamQuery.data.items.length ? (
              <EmptyData text="За выбранный период команда ещё не отправляла ответы." />
            ) : null}
          </article>
        </>
      ) : null}
    </section>
  );
}

function Metric({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "default" | "warning";
}) {
  return (
    <article className={`analytics-metric analytics-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  );
}

function SummaryRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className={`analytics-summary-row analytics-summary-row-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DataNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="analytics-data-notice" role="status">
      <span>Не удалось обновить основные показатели. Показаны последние доступные данные.</span>
      <button onClick={onRetry} type="button">Обновить</button>
    </div>
  );
}

function PanelNotice() {
  return <p className="analytics-panel-notice">Не удалось обновить. Показаны последние доступные данные.</p>;
}

function PanelState({ text }: { text: string }) {
  return <p className="analytics-panel-state">{text}</p>;
}

function EmptyData({ text }: { text: string }) {
  return <p className="analytics-empty">{text}</p>;
}

function WorkspaceState({
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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatAcceptance(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function formatDuration(value: number | null): string {
  if (value === null) return "—";
  if (value < 60) return `${Math.round(value)} сек`;
  if (value < 3600) return `${Math.round(value / 60)} мин`;
  return `${(value / 3600).toFixed(1)} ч`;
}

function formatDay(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function marketplaceLabel(value: string): string {
  const labels: Record<string, string> = {
    wildberries: "Wildberries",
    ozon: "Ozon",
    yandex_market: "Яндекс Маркет",
    avito: "Авито",
  };
  return labels[value] ?? value;
}
