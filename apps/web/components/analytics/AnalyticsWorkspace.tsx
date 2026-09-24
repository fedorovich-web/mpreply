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
import type { Locale } from "../../lib/i18n";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const dayOptions = [7, 30, 90] as const;
type DayOption = (typeof dayOptions)[number];
const analyticsCopy = {
  ru: {
    workspace: "Рабочее пространство",
    refreshing: "Обновляем данные…",
    periodAria: "Период аналитики",
    period: "Период",
    days: "дней",
    loadingDescription: "Собираем обращения и ответы за выбранный период.",
    loadingTitle: "Загружаем аналитику",
    retry: "Повторить",
    loadErrorDescription: "Не удалось получить основные показатели. Проверьте соединение и повторите попытку.",
    loadErrorTitle: "Аналитика временно недоступна",
    metricsAria: "Ключевые показатели",
    newForPeriod: "новых за период",
    totalMessages: "Всего обращений",
    alreadyHandled: "уже обработано",
    needsReply: "Требуют ответа",
    automatic: "автоматически",
    afterReview: "вручную",
    repliesSent: "Ответов отправлено",
    responseTimeHelper: "От обращения до отправки ответа",
    averageResponse: "Среднее время ответа",
    dynamics: "Динамика",
    dailyMessages: "Обращения и ответы по дням",
    legend: "Легенда",
    imported: "Получено",
    answered: "Отвечено",
    loadingDynamics: "Загружаем динамику…",
    dynamicsError: "Не удалось загрузить динамику обращений.",
    dynamicsAria: "Динамика обращений по дням",
    importedLower: "получено",
    answeredLower: "отвечено",
    noMessages: "За выбранный период обращений пока нет.",
    processing: "Обработка",
    replyFlow: "Что происходит с ответами",
    answeredMessages: "Отвечено на обращения",
    sentAutomatically: "Отправлено автоматически",
    sentAfterReview: "Отправлено вручную",
    aiDrafts: "Подготовлено черновиков с ИИ",
    aiDraftsSent: "Доля черновиков с ИИ, дошедших до отправки",
    negativeReviews: "Негативные отзывы",
    marketplaces: "Площадки",
    marketplaceVolume: "Где больше обращений",
    loadingMarketplaces: "Загружаем данные по площадкам…",
    marketplacesError: "Не удалось загрузить данные по площадкам.",
    marketplace: "Площадка",
    messages: "Обращения",
    handled: "Обработано",
    syncFailures: "Сбои обновления",
    noMarketplaceData: "Данные по площадкам появятся после получения обращений.",
    products: "Товары",
    productsTitle: "Товары с наибольшим числом обращений",
    loadingProducts: "Загружаем данные по товарам…",
    productsError: "Не удалось загрузить данные по товарам.",
    sku: "Артикул",
    noSku: "Артикул не указан",
    negativeCount: "Негативных отзывов",
    noProducts: "Данные по товарам появятся, когда обращения будут связаны с товарами.",
    team: "Команда",
    teamTitle: "Ответы за выбранный период",
    loadingTeam: "Загружаем данные по команде…",
    teamError: "Не удалось загрузить данные по команде.",
    repliesSentLower: "отправлено ответов",
    noTeamData: "За выбранный период команда ещё не отправляла ответы.",
    mainRefreshError: "Не удалось обновить основные показатели. Показаны последние доступные данные.",
    refresh: "Обновить",
    panelRefreshError: "Не удалось обновить. Показаны последние доступные данные.",
    seconds: "сек",
    minutes: "мин",
    hours: "ч",
    yandex: "Яндекс Маркет",
    avito: "Авито",
  },
  en: {
    workspace: "Workspace",
    refreshing: "Refreshing data…",
    periodAria: "Analytics period",
    period: "Period",
    days: "days",
    loadingDescription: "Collecting customer messages and replies for the selected period.",
    loadingTitle: "Loading analytics",
    retry: "Retry",
    loadErrorDescription: "Could not load the main metrics. Check your connection and try again.",
    loadErrorTitle: "Analytics is temporarily unavailable",
    metricsAria: "Key metrics",
    newForPeriod: "new in period",
    totalMessages: "Total customer messages",
    alreadyHandled: "already handled",
    needsReply: "Need a reply",
    automatic: "automatically",
    afterReview: "manually",
    repliesSent: "Replies sent",
    responseTimeHelper: "From customer message to sent reply",
    averageResponse: "Average response time",
    dynamics: "Activity",
    dailyMessages: "Customer messages and replies by day",
    legend: "Legend",
    imported: "Received",
    answered: "Answered",
    loadingDynamics: "Loading daily activity…",
    dynamicsError: "Could not load daily customer-message activity.",
    dynamicsAria: "Customer-message activity by day",
    importedLower: "received",
    answeredLower: "answered",
    noMessages: "There were no customer messages in the selected period.",
    processing: "Reply handling",
    replyFlow: "What happens to replies",
    answeredMessages: "Customer messages answered",
    sentAutomatically: "Sent automatically",
    sentAfterReview: "Sent manually",
    aiDrafts: "AI drafts prepared",
    aiDraftsSent: "AI draft send-through rate",
    negativeReviews: "Negative reviews",
    marketplaces: "Marketplaces",
    marketplaceVolume: "Where customer-message volume is highest",
    loadingMarketplaces: "Loading marketplace data…",
    marketplacesError: "Could not load marketplace data.",
    marketplace: "Marketplace",
    messages: "Messages",
    handled: "Handled",
    syncFailures: "Sync failures",
    noMarketplaceData: "Marketplace data will appear after customer messages are received.",
    products: "Products",
    productsTitle: "Products with the most customer messages",
    loadingProducts: "Loading product data…",
    productsError: "Could not load product data.",
    sku: "SKU",
    noSku: "SKU not provided",
    negativeCount: "Negative reviews",
    noProducts: "Product data will appear when customer messages are linked to products.",
    team: "Team",
    teamTitle: "Replies during the selected period",
    loadingTeam: "Loading team data…",
    teamError: "Could not load team data.",
    repliesSentLower: "replies sent",
    noTeamData: "The team has not sent any replies during the selected period.",
    mainRefreshError: "Could not refresh the main metrics. Showing the latest available data.",
    refresh: "Refresh",
    panelRefreshError: "Could not refresh. Showing the latest available data.",
    seconds: "sec",
    minutes: "min",
    hours: "hr",
    yandex: "Yandex Market",
    avito: "Avito",
  },
} as const;

export function AnalyticsWorkspace() {
  const { activeOrganization, locale } = useWorkspace();
  const t = analyticsCopy[locale];
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
          <span className="panel-kicker">{t.workspace}</span>
          <strong>{activeOrganization.name}</strong>
        </div>

        <div className="analytics-toolbar-controls">
          {isRefreshing ? <span aria-live="polite" className="analytics-refresh-state">{t.refreshing}</span> : null}
          <div className="analytics-period-control" aria-label={t.periodAria}>
            <span>{t.period}</span>
            <div className="analytics-period-options">
              {dayOptions.map((option) => (
                <button
                  aria-pressed={days === option}
                  className={days === option ? "analytics-period-option analytics-period-option-active" : "analytics-period-option"}
                  key={option}
                  onClick={() => setDays(option)}
                  type="button"
                >
                  {option} {t.days}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {overviewQuery.error && overviewQuery.data ? (
        <DataNotice onRetry={retryAnalytics} text={t.mainRefreshError} actionLabel={t.refresh} />
      ) : null}

      {overviewQuery.isLoading && !overviewQuery.data ? (
        <WorkspaceState
          description={t.loadingDescription}
          title={t.loadingTitle}
        />
      ) : null}

      {overviewQuery.error && !overviewQuery.data ? (
        <WorkspaceState
          actionLabel={t.retry}
          description={t.loadErrorDescription}
          onAction={retryAnalytics}
          title={t.loadErrorTitle}
          tone="error"
        />
      ) : null}

      {overviewQuery.data ? (
        <>
          <section className="analytics-metric-grid" aria-label={t.metricsAria}>
            <Metric
              helper={`${formatNumber(overviewQuery.data.new_messages, locale)} ${t.newForPeriod}`}
              label={t.totalMessages}
              value={formatNumber(overviewQuery.data.total_messages, locale)}
            />
            <Metric
              helper={`${formatNumber(overviewQuery.data.answered_messages, locale)} ${t.alreadyHandled}`}
              label={t.needsReply}
              tone={overviewQuery.data.unanswered_messages > 0 ? "warning" : "default"}
              value={formatNumber(overviewQuery.data.unanswered_messages, locale)}
            />
            <Metric
              helper={`${formatNumber(overviewQuery.data.auto_replies_sent, locale)} ${t.automatic} · ${formatNumber(overviewQuery.data.manual_replies_sent, locale)} ${t.afterReview}`}
              label={t.repliesSent}
              value={formatNumber(overviewQuery.data.replies_sent, locale)}
            />
            <Metric
              helper={t.responseTimeHelper}
              label={t.averageResponse}
              value={formatDuration(overviewQuery.data.average_response_seconds, locale)}
            />
          </section>

          <section className="analytics-panel-grid">
            <article className="analytics-panel analytics-panel-wide">
              <div className="analytics-panel-heading">
                <div>
                  <span className="panel-kicker">{t.dynamics}</span>
                  <h2>{t.dailyMessages}</h2>
                </div>
                <div className="analytics-legend" aria-label={t.legend}>
                  <span><i className="legend-dot legend-imported" />{t.imported}</span>
                  <span><i className="legend-dot legend-answered" />{t.answered}</span>
                </div>
              </div>

              {messagesQuery.error && messagesQuery.data ? <PanelNotice text={t.panelRefreshError} /> : null}
              {messagesQuery.isLoading && !messagesQuery.data ? <PanelState text={t.loadingDynamics} /> : null}
              {messagesQuery.error && !messagesQuery.data ? <PanelState text={t.dynamicsError} /> : null}
              {messagesQuery.data && hasMessageActivity ? (
                <div className="analytics-bars" aria-label={t.dynamicsAria}>
                  {messagePoints.map((point) => (
                    <div
                      className="analytics-bar-column"
                      key={point.date}
                      title={`${formatDate(point.date, locale)}: ${point.imported} ${t.importedLower}, ${point.answered} ${t.answeredLower}`}
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
                      <small>{formatDay(point.date, locale)}</small>
                    </div>
                  ))}
                </div>
              ) : null}
              {messagesQuery.data && !hasMessageActivity ? <EmptyData text={t.noMessages} /> : null}
            </article>

            <article className="analytics-panel">
              <div className="analytics-panel-heading">
                <div>
                  <span className="panel-kicker">{t.processing}</span>
                  <h2>{t.replyFlow}</h2>
                </div>
              </div>
              <div className="analytics-summary-list">
                <SummaryRow label={t.answeredMessages} value={formatNumber(overviewQuery.data.answered_messages, locale)} />
                <SummaryRow label={t.sentAutomatically} value={formatNumber(overviewQuery.data.auto_replies_sent, locale)} />
                <SummaryRow label={t.sentAfterReview} value={formatNumber(overviewQuery.data.manual_replies_sent, locale)} />
                <SummaryRow label={t.aiDrafts} value={formatNumber(overviewQuery.data.ai_drafts_generated, locale)} />
                <SummaryRow label={t.aiDraftsSent} value={formatAcceptance(overviewQuery.data.ai_acceptance_rate)} />
                <SummaryRow
                  label={t.negativeReviews}
                  value={formatNumber(overviewQuery.data.negative_reviews, locale)}
                  tone={overviewQuery.data.negative_reviews > 0 ? "danger" : "default"}
                />
              </div>
            </article>
          </section>

          <section className="analytics-panel-grid analytics-panel-grid-even">
            <article className="analytics-panel">
              <div className="analytics-panel-heading">
                <div>
                  <span className="panel-kicker">{t.marketplaces}</span>
                  <h2>{t.marketplaceVolume}</h2>
                </div>
              </div>

              {marketplacesQuery.error && marketplacesQuery.data ? <PanelNotice text={t.panelRefreshError} /> : null}
              {marketplacesQuery.isLoading && !marketplacesQuery.data ? <PanelState text={t.loadingMarketplaces} /> : null}
              {marketplacesQuery.error && !marketplacesQuery.data ? <PanelState text={t.marketplacesError} /> : null}
              {marketplacesQuery.data?.items.length ? (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>{t.marketplace}</th>
                        <th>{t.messages}</th>
                        <th>{t.handled}</th>
                        <th>{t.syncFailures}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marketplacesQuery.data.items.map((item) => (
                        <tr key={item.marketplace}>
                          <td>{marketplaceLabel(item.marketplace, locale)}</td>
                          <td>{formatNumber(item.messages, locale)}</td>
                          <td>{formatNumber(item.answered, locale)}</td>
                          <td>{formatNumber(item.failed_integration_events, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {marketplacesQuery.data && !marketplacesQuery.data.items.length ? (
                <EmptyData text={t.noMarketplaceData} />
              ) : null}
            </article>

            <article className="analytics-panel">
              <div className="analytics-panel-heading">
                <div>
                  <span className="panel-kicker">{t.products}</span>
                  <h2>{t.productsTitle}</h2>
                </div>
              </div>

              {productsQuery.error && productsQuery.data ? <PanelNotice text={t.panelRefreshError} /> : null}
              {productsQuery.isLoading && !productsQuery.data ? <PanelState text={t.loadingProducts} /> : null}
              {productsQuery.error && !productsQuery.data ? <PanelState text={t.productsError} /> : null}
              {productsQuery.data?.items.length ? (
                <div className="analytics-product-list">
                  {productsQuery.data.items.slice(0, 8).map((item) => (
                    <div className="analytics-product-row" key={item.product_id}>
                      <div>
                        <strong>{item.name}</strong>
                        <small>{item.sku ? `${t.sku}: ${item.sku}` : t.noSku}</small>
                      </div>
                      <div>
                        <span>{formatNumber(item.messages, locale)}</span>
                        <small>{t.negativeCount}: {formatNumber(item.negative_reviews, locale)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {productsQuery.data && !productsQuery.data.items.length ? (
                <EmptyData text={t.noProducts} />
              ) : null}
            </article>
          </section>

          <article className="analytics-panel analytics-team-panel">
            <div className="analytics-panel-heading">
              <div>
                <span className="panel-kicker">{t.team}</span>
                <h2>{t.teamTitle}</h2>
              </div>
            </div>

            {teamQuery.error && teamQuery.data ? <PanelNotice text={t.panelRefreshError} /> : null}
            {teamQuery.isLoading && !teamQuery.data ? <PanelState text={t.loadingTeam} /> : null}
            {teamQuery.error && !teamQuery.data ? <PanelState text={t.teamError} /> : null}
            {teamQuery.data?.items.length ? (
              <div className="analytics-team-list">
                {teamQuery.data.items.slice(0, 8).map((item) => (
                  <div className="analytics-team-row" key={item.user_id}>
                    <div>
                      <strong>{item.name || item.email}</strong>
                      {item.name ? <small>{item.email}</small> : null}
                    </div>
                    <div>
                      <strong>{formatNumber(item.replies_sent, locale)}</strong>
                      <small>{t.repliesSentLower}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {teamQuery.data && !teamQuery.data.items.length ? (
              <EmptyData text={t.noTeamData} />
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

function DataNotice({ onRetry, text, actionLabel }: { onRetry: () => void; text: string; actionLabel: string }) {
  return (
    <div className="analytics-data-notice" role="status">
      <span>{text}</span>
      <button onClick={onRetry} type="button">{actionLabel}</button>
    </div>
  );
}

function PanelNotice({ text }: { text: string }) {
  return <p className="analytics-panel-notice">{text}</p>;
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

function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU").format(value);
}

function formatAcceptance(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function formatDuration(value: number | null, locale: Locale): string {
  const t = analyticsCopy[locale];
  if (value === null) return "—";
  if (value < 60) return `${Math.round(value)} ${t.seconds}`;
  if (value < 3600) return `${Math.round(value / 60)} ${t.minutes}`;
  return `${(value / 3600).toFixed(1)} ${t.hours}`;
}

function formatDay(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", { day: "2-digit", month: "short", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function marketplaceLabel(value: string, locale: Locale): string {
  const t = analyticsCopy[locale];
  const labels: Record<string, string> = {
    wildberries: "Wildberries",
    ozon: "Ozon",
    yandex_market: t.yandex,
    avito: t.avito,
  };
  return labels[value] ?? value;
}
