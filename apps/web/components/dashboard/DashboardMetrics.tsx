"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import {
  analyticsOverviewSchema,
  automationRuleListSchema,
  customerMessageListSchema,
  marketplaceAccountListSchema,
  marketplaceAnalyticsSchema,
  reviewQueueListSchema,
  teamAnalyticsSchema,
  type CustomerMessage,
} from "../../lib/api/schemas";
import { localizedPath, type Locale } from "../../lib/i18n";
import { hasCurrentIntegrationProblem } from "../../lib/marketplace-account-health";
import { Badge, type BadgeTone } from "../ui/Badge";
import { useWorkspace } from "../workspace/WorkspaceProvider";

type DashboardDataState = "ready" | "loading" | "error";

const kpiIcons = {
  messages: "/images/mockups/features-icons/01-unified-inbox.webp",
  reply: "/images/mockups/features-icons/04-auto-replies-lightning.webp",
  review: "/images/mockups/features-icons/03-quality-shield.webp",
  time: "/images/mockups/wildberries-icons/05-analytics.webp",
} as const;

const dashboardCopy = {
  ru: {
    loadingTitle: "Собираем рабочий обзор",
    loadingDescription: "Получаем обращения и ключевые показатели за последние 30 дней.",
    retrying: "Повторяем...",
    retry: "Повторить",
    unavailableTitle: "Рабочий обзор недоступен",
    unavailableDescription: "Основную сводку сейчас получить не удалось. Рабочие разделы по-прежнему доступны через меню кабинета.",
    totalMessages: "Всего обращений",
    totalMessagesHelper: "за последние 30 дней",
    needsReply: "Требуют ответа",
    needsReplyHelper: "ждут следующего шага",
    needsReview: "На проверке",
    needsReviewHelper: "ответов ждут решения",
    averageResponse: "Среднее время ответа",
    averageResponseHelper: "от обращения до отправки",
    attention: "Требуют внимания",
    attentionDescription: "Свежие обращения, которым нужен ответ",
    allMessages: "Все обращения",
    loadingMessages: "Загружаем обращения…",
    messagesError: "Не удалось загрузить обращения.",
    noMessages: "Сейчас нет обращений со статусом «Нужен ответ».",
    customer: "Покупатель",
    message: "Сообщение",
    product: "Товар",
    time: "Время",
    status: "Статус",
    customerUnknown: "Покупатель",
    noProduct: "Без карточки товара",
    aiKicker: "Ответы с ИИ",
    aiTitle: "Подготовьте ответ с контекстом",
    aiDescription: "Выберите обращение, задайте тон и добавьте важные факты. MPReply подготовит черновик для проверки.",
    openAi: "Открыть Ответы с ИИ",
    quickActions: "Быстрые действия",
    reviewQueue: "Очередь проверки",
    reviewQueueAction: "Проверить ответы",
    automation: "Автоматизация",
    automationAction: "Настроить правила",
    integrations: "Интеграции",
    integrationsAction: "Проверить подключения",
    checking: "Проверяем…",
    unavailable: "Недоступно",
    rulesEnabled: "правил включено",
    accountsActive: "кабинетов работают",
    marketplaces: "Площадки",
    marketplaceTitle: "Обращения по площадкам",
    allMarketplaces: "Вся аналитика",
    loadingMarketplaces: "Загружаем площадки…",
    marketplacesError: "Не удалось загрузить данные по площадкам.",
    noMarketplaceData: "Данные появятся после получения обращений.",
    team: "Команда",
    teamTitle: "Активность команды",
    teamAnalytics: "Подробнее",
    loadingTeam: "Загружаем данные команды…",
    teamError: "Не удалось загрузить данные команды.",
    noTeamData: "За период команда ещё не отправляла ответы.",
    messagesCount: "обращений",
    repliesSent: "ответов",
    replyQuality: "Обработка",
    replyMixTitle: "Как отправляются ответы",
    autoShare: "автоматически",
    automatic: "Автоматически",
    afterReview: "После проверки",
    totalSent: "Всего отправлено",
    newStatus: "Новое",
    importedStatus: "Получено",
    needsReplyStatus: "Нужен ответ",
    aiDraftStatus: "Черновик готов",
    reviewStatus: "На проверке",
    approvedStatus: "Одобрено",
    sendingStatus: "Отправляется",
    answeredStatus: "Отвечено",
    failedStatus: "Ошибка",
    escalatedStatus: "У менеджера",
    archivedStatus: "Архив",
    autoSentStatus: "Отвечено автоматически",
    seconds: "сек",
    minutes: "мин",
    hours: "ч",
    yandex: "Яндекс Маркет",
    avito: "Авито",
    workData: "Рабочие данные",
    loadError: "Ошибка загрузки",
  },
  en: {
    loadingTitle: "Building your workspace overview",
    loadingDescription: "Loading customer messages and key metrics for the last 30 days.",
    retrying: "Retrying...",
    retry: "Retry",
    unavailableTitle: "Workspace overview is unavailable",
    unavailableDescription: "The main summary could not be loaded. You can still open working sections from the navigation.",
    totalMessages: "Total messages",
    totalMessagesHelper: "during the last 30 days",
    needsReply: "Need a reply",
    needsReplyHelper: "waiting for the next step",
    needsReview: "Needs review",
    needsReviewHelper: "replies waiting for a decision",
    averageResponse: "Average response time",
    averageResponseHelper: "from message to sent reply",
    attention: "Needs attention",
    attentionDescription: "Recent customer messages waiting for a reply",
    allMessages: "All messages",
    loadingMessages: "Loading messages…",
    messagesError: "Could not load customer messages.",
    noMessages: "There are no customer messages with the “Needs reply” status right now.",
    customer: "Customer",
    message: "Message",
    product: "Product",
    time: "Time",
    status: "Status",
    customerUnknown: "Customer",
    noProduct: "No linked product",
    aiKicker: "AI replies",
    aiTitle: "Prepare a reply with context",
    aiDescription: "Choose a customer message, set the tone, and add verified facts. MPReply prepares a draft for review.",
    openAi: "Open AI replies",
    quickActions: "Quick actions",
    reviewQueue: "Review queue",
    reviewQueueAction: "Review replies",
    automation: "Automation",
    automationAction: "Manage rules",
    integrations: "Integrations",
    integrationsAction: "Check connections",
    checking: "Checking…",
    unavailable: "Unavailable",
    rulesEnabled: "rules enabled",
    accountsActive: "seller accounts working",
    marketplaces: "Marketplaces",
    marketplaceTitle: "Messages by marketplace",
    allMarketplaces: "View analytics",
    loadingMarketplaces: "Loading marketplaces…",
    marketplacesError: "Could not load marketplace data.",
    noMarketplaceData: "Data will appear after customer messages are received.",
    team: "Team",
    teamTitle: "Team activity",
    teamAnalytics: "View details",
    loadingTeam: "Loading team data…",
    teamError: "Could not load team data.",
    noTeamData: "The team has not sent replies during this period.",
    messagesCount: "messages",
    repliesSent: "replies",
    replyQuality: "Handling",
    replyMixTitle: "How replies are sent",
    autoShare: "automatic",
    automatic: "Automatic",
    afterReview: "After review",
    totalSent: "Total sent",
    newStatus: "New",
    importedStatus: "Received",
    needsReplyStatus: "Needs reply",
    aiDraftStatus: "Draft ready",
    reviewStatus: "Needs review",
    approvedStatus: "Approved",
    sendingStatus: "Sending",
    answeredStatus: "Answered",
    failedStatus: "Error",
    escalatedStatus: "Escalated",
    archivedStatus: "Archived",
    autoSentStatus: "Sent automatically",
    seconds: "sec",
    minutes: "min",
    hours: "hr",
    yandex: "Yandex Market",
    avito: "Avito",
    workData: "Workspace data",
    loadError: "Loading error",
  },
} as const;

export function DashboardMetrics() {
  const { activeOrganization, locale } = useWorkspace();
  const t = dashboardCopy[locale];
  const path = (value: string) => localizedPath(locale, value);

  const analyticsQuery = useQuery({
    queryKey: ["analytics", "overview", activeOrganization.id, 30],
    queryFn: () =>
      apiRequest(
        buildApiQuery("/api/analytics/overview", { organization_id: activeOrganization.id, days: 30 }),
        analyticsOverviewSchema,
      ),
  });

  const needsReplyQuery = useQuery({
    queryKey: ["dashboard", "needs-reply", activeOrganization.id],
    queryFn: () =>
      apiRequest(
        buildApiQuery("/api/messages", {
          organization_id: activeOrganization.id,
          status: "needs_reply",
          page: 1,
          page_size: 5,
        }),
        customerMessageListSchema,
      ),
  });

  const reviewQueueQuery = useQuery({
    queryKey: ["dashboard", "review-queue-summary", activeOrganization.id],
    queryFn: () =>
      apiRequest(
        buildApiQuery("/api/replies/review-queue", {
          organization_id: activeOrganization.id,
          page: 1,
          page_size: 1,
        }),
        reviewQueueListSchema,
      ),
  });

  const accountsQuery = useQuery({
    queryKey: ["marketplace-accounts", activeOrganization.id],
    queryFn: () =>
      apiRequest(
        buildApiQuery("/api/marketplace-accounts", { organization_id: activeOrganization.id }),
        marketplaceAccountListSchema,
      ),
  });

  const rulesQuery = useQuery({
    queryKey: ["dashboard", "automation-rules-summary", activeOrganization.id],
    queryFn: () =>
      apiRequest(
        buildApiQuery("/api/automation-rules", { organization_id: activeOrganization.id }),
        automationRuleListSchema,
      ),
  });

  const marketplacesQuery = useQuery({
    queryKey: ["analytics", "marketplaces", activeOrganization.id, 30],
    queryFn: () =>
      apiRequest(
        buildApiQuery("/api/analytics/marketplaces", { organization_id: activeOrganization.id, days: 30 }),
        marketplaceAnalyticsSchema,
      ),
  });

  const teamQuery = useQuery({
    queryKey: ["analytics", "team", activeOrganization.id, 30],
    queryFn: () =>
      apiRequest(
        buildApiQuery("/api/analytics/team", { organization_id: activeOrganization.id, days: 30 }),
        teamAnalyticsSchema,
      ),
  });

  if (analyticsQuery.isPending) {
    return (
      <DashboardOverviewState
        description={t.loadingDescription}
        title={t.loadingTitle}
        tone="loading"
        locale={locale}
      />
    );
  }

  if (analyticsQuery.error || !analyticsQuery.data) {
    return (
      <DashboardOverviewState
        actionDisabled={analyticsQuery.isFetching}
        actionLabel={analyticsQuery.isFetching ? t.retrying : t.retry}
        description={t.unavailableDescription}
        onAction={() => void analyticsQuery.refetch()}
        title={t.unavailableTitle}
        tone="error"
        locale={locale}
      />
    );
  }

  const analytics = analyticsQuery.data;
  const reviewState = queryState(reviewQueueQuery.isPending, Boolean(reviewQueueQuery.error), Boolean(reviewQueueQuery.data));
  const accountsState = queryState(accountsQuery.isPending, Boolean(accountsQuery.error), Boolean(accountsQuery.data));
  const rulesState = queryState(rulesQuery.isPending, Boolean(rulesQuery.error), Boolean(rulesQuery.data));
  const activeAccounts = accountsQuery.data
    ? accountsQuery.data.filter((account) => account.status === "active" && !hasCurrentIntegrationProblem(account)).length
    : null;
  const enabledRules = rulesQuery.data ? rulesQuery.data.items.filter((rule) => rule.is_enabled).length : null;
  const reviewTotal = reviewQueueQuery.data?.total ?? null;
  const autoShare = analytics.replies_sent > 0
    ? Math.round((analytics.auto_replies_sent / analytics.replies_sent) * 100)
    : 0;

  return (
    <>
      <section className="dashboard-kpi-grid" aria-label={t.workData}>
        <DashboardKpi
          icon={kpiIcons.messages}
          label={t.totalMessages}
          value={formatNumber(analytics.total_messages, locale)}
          helper={t.totalMessagesHelper}
        />
        <DashboardKpi
          icon={kpiIcons.reply}
          label={t.needsReply}
          value={formatNumber(analytics.unanswered_messages, locale)}
          helper={t.needsReplyHelper}
          tone={analytics.unanswered_messages > 0 ? "warning" : "default"}
        />
        <DashboardKpi
          icon={kpiIcons.review}
          label={t.needsReview}
          value={formatStateValue(reviewTotal, reviewState, locale)}
          helper={reviewState === "loading" ? t.checking : reviewState === "error" ? t.unavailable : t.needsReviewHelper}
          tone={reviewState === "ready" && (reviewTotal ?? 0) > 0 ? "warning" : "default"}
        />
        <DashboardKpi
          icon={kpiIcons.time}
          label={t.averageResponse}
          value={formatDuration(analytics.average_response_seconds, locale)}
          helper={t.averageResponseHelper}
        />
      </section>

      <section className="dashboard-primary-grid">
        <article className="dashboard-messages-panel">
          <header className="dashboard-card-heading">
            <div>
              <span className="panel-kicker">{t.attention}</span>
              <h2>{t.attentionDescription}</h2>
            </div>
            <Link className="dashboard-card-link" href={path("/app/inbox")}>{t.allMessages} →</Link>
          </header>

          {needsReplyQuery.isPending && !needsReplyQuery.data ? (
            <DashboardPanelState text={t.loadingMessages} />
          ) : needsReplyQuery.error && !needsReplyQuery.data ? (
            <DashboardPanelState text={t.messagesError} tone="error" />
          ) : needsReplyQuery.data?.items.length ? (
            <div className="dashboard-message-table-wrap">
              <table className="dashboard-message-table">
                <thead>
                  <tr>
                    <th>{t.customer}</th>
                    <th>{t.message}</th>
                    <th>{t.product}</th>
                    <th>{t.time}</th>
                    <th>{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {needsReplyQuery.data.items.map((message) => (
                    <DashboardMessageRow key={message.id} message={message} locale={locale} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <DashboardPanelState text={t.noMessages} />
          )}
        </article>

        <aside className="dashboard-side-stack">
          <article className="dashboard-ai-card">
            <div className="dashboard-ai-heading">
              <span className="dashboard-ai-icon" aria-hidden="true">
                <Image alt="" height={24} src="/images/mockups/features-icons/02-ai-sparkles.webp" width={24} />
              </span>
              <div>
                <span className="panel-kicker">{t.aiKicker}</span>
                <h2>{t.aiTitle}</h2>
              </div>
            </div>
            <p>{t.aiDescription}</p>
            <Link className="button button-primary" href={path("/app/ai-assistant")}>{t.openAi}</Link>
          </article>

          <article className="dashboard-actions-card">
            <div className="dashboard-card-heading dashboard-card-heading-compact">
              <div>
                <span className="panel-kicker">{t.quickActions}</span>
              </div>
            </div>
            <div className="dashboard-action-list">
              <DashboardAction
                href={path("/app/review-queue")}
                label={t.reviewQueue}
                value={reviewState === "ready" ? `${formatNumber(reviewTotal ?? 0, locale)} · ${t.reviewQueueAction}` : reviewState === "loading" ? t.checking : t.unavailable}
              />
              <DashboardAction
                href={path("/app/automation-rules")}
                label={t.automation}
                value={rulesState === "ready" ? `${formatNumber(enabledRules ?? 0, locale)} ${t.rulesEnabled}` : rulesState === "loading" ? t.checking : t.unavailable}
              />
              <DashboardAction
                href={path("/app/integrations")}
                label={t.integrations}
                value={accountsState === "ready" ? `${formatNumber(activeAccounts ?? 0, locale)} ${t.accountsActive}` : accountsState === "loading" ? t.checking : t.unavailable}
              />
            </div>
          </article>
        </aside>
      </section>

      <section className="dashboard-bottom-grid">
        <article className="dashboard-insight-card">
          <header className="dashboard-card-heading">
            <div>
              <span className="panel-kicker">{t.marketplaces}</span>
              <h2>{t.marketplaceTitle}</h2>
            </div>
            <Link className="dashboard-card-link" href={path("/app/analytics")}>{t.allMarketplaces} →</Link>
          </header>
          {marketplacesQuery.isPending && !marketplacesQuery.data ? (
            <DashboardPanelState text={t.loadingMarketplaces} />
          ) : marketplacesQuery.error && !marketplacesQuery.data ? (
            <DashboardPanelState text={t.marketplacesError} tone="error" />
          ) : marketplacesQuery.data?.items.length ? (
            <div className="dashboard-ranked-list">
              {marketplacesQuery.data.items.slice(0, 4).map((item) => (
                <div className="dashboard-ranked-row" key={item.marketplace}>
                  <span className="dashboard-market-avatar" aria-hidden="true">{marketplaceInitial(item.marketplace)}</span>
                  <div>
                    <strong>{marketplaceLabel(item.marketplace, locale)}</strong>
                    <small>{formatNumber(item.messages, locale)} {t.messagesCount}</small>
                  </div>
                  <span>{formatNumber(item.answered, locale)}</span>
                </div>
              ))}
            </div>
          ) : (
            <DashboardPanelState text={t.noMarketplaceData} />
          )}
        </article>

        <article className="dashboard-insight-card">
          <header className="dashboard-card-heading">
            <div>
              <span className="panel-kicker">{t.team}</span>
              <h2>{t.teamTitle}</h2>
            </div>
            <Link className="dashboard-card-link" href={path("/app/analytics")}>{t.teamAnalytics} →</Link>
          </header>
          {teamQuery.isPending && !teamQuery.data ? (
            <DashboardPanelState text={t.loadingTeam} />
          ) : teamQuery.error && !teamQuery.data ? (
            <DashboardPanelState text={t.teamError} tone="error" />
          ) : teamQuery.data?.items.length ? (
            <div className="dashboard-ranked-list">
              {teamQuery.data.items.slice(0, 4).map((item) => (
                <div className="dashboard-ranked-row" key={item.user_id}>
                  <span className="dashboard-team-avatar" aria-hidden="true">{personInitials(item.name || item.email)}</span>
                  <div>
                    <strong>{item.name || item.email}</strong>
                    <small>{item.name ? item.email : t.repliesSent}</small>
                  </div>
                  <span>{formatNumber(item.replies_sent, locale)}</span>
                </div>
              ))}
            </div>
          ) : (
            <DashboardPanelState text={t.noTeamData} />
          )}
        </article>

        <article className="dashboard-insight-card dashboard-reply-mix-card">
          <header className="dashboard-card-heading">
            <div>
              <span className="panel-kicker">{t.replyQuality}</span>
              <h2>{t.replyMixTitle}</h2>
            </div>
          </header>

          <div className="dashboard-reply-mix">
            <div
              aria-label={`${autoShare}% ${t.autoShare}`}
              className="dashboard-reply-donut"
              style={{ "--dashboard-auto-share": `${autoShare}%` } as CSSProperties}
            >
              <span>
                <strong>{autoShare}%</strong>
                <small>{t.autoShare}</small>
              </span>
            </div>
            <dl className="dashboard-reply-breakdown">
              <div>
                <dt>{t.automatic}</dt>
                <dd>{formatNumber(analytics.auto_replies_sent, locale)}</dd>
              </div>
              <div>
                <dt>{t.afterReview}</dt>
                <dd>{formatNumber(analytics.manual_replies_sent, locale)}</dd>
              </div>
              <div>
                <dt>{t.totalSent}</dt>
                <dd>{formatNumber(analytics.replies_sent, locale)}</dd>
              </div>
            </dl>
          </div>
        </article>
      </section>
    </>
  );
}

function DashboardKpi({
  icon,
  label,
  value,
  helper,
  tone = "default",
}: {
  icon: string;
  label: string;
  value: string;
  helper: string;
  tone?: "default" | "warning";
}) {
  return (
    <article className={tone === "warning" ? "dashboard-kpi-card dashboard-kpi-card-warning" : "dashboard-kpi-card"}>
      <div className="dashboard-kpi-topline">
        <span className="dashboard-kpi-icon" aria-hidden="true">
          <Image alt="" height={24} src={icon} width={24} />
        </span>
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function DashboardMessageRow({ message, locale }: { message: CustomerMessage; locale: Locale }) {
  const t = dashboardCopy[locale];
  return (
    <tr>
      <td>
        <span className="dashboard-customer-cell">
          <span className="dashboard-customer-avatar" aria-hidden="true">
            {personInitials(message.customer_display_name || t.customerUnknown)}
          </span>
          <strong>{message.customer_display_name || t.customerUnknown}</strong>
        </span>
      </td>
      <td><span className="dashboard-message-preview">{message.customer_text}</span></td>
      <td>
        <span className="dashboard-product-cell">
          <span className="dashboard-product-mark" aria-hidden="true">{productInitial(message.product?.name)}</span>
          <span>
            <strong>{message.product?.name ?? t.noProduct}</strong>
            <small>{marketplaceLabel(message.marketplace, locale)}</small>
          </span>
        </span>
      </td>
      <td>{formatDateTime(message.marketplace_created_at, locale)}</td>
      <td><Badge tone={messageStatusTone(message.status)}>{messageStatusLabel(message.status, locale)}</Badge></td>
    </tr>
  );
}

function DashboardAction({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <Link className="dashboard-action-row" href={href}>
      <span>
        <strong>{label}</strong>
        <small>{value}</small>
      </span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}

function DashboardPanelState({ text, tone = "default" }: { text: string; tone?: "default" | "error" }) {
  return <p className={tone === "error" ? "dashboard-panel-state dashboard-panel-state-error" : "dashboard-panel-state"}>{text}</p>;
}

function DashboardOverviewState({
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
  tone: "error" | "loading";
  locale: Locale;
}) {
  const t = dashboardCopy[locale];
  return (
    <section
      aria-busy={tone === "loading"}
      aria-live="polite"
      className={"dashboard-overview-state dashboard-overview-state-" + tone}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className="dashboard-overview-state-mark" aria-hidden="true" />
      <div>
        <span>{tone === "loading" ? t.workData : t.loadError}</span>
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

function queryState(isPending: boolean, hasError: boolean, hasData: boolean): DashboardDataState {
  if (isPending && !hasData) return "loading";
  if (hasError && !hasData) return "error";
  return "ready";
}

function formatStateValue(value: number | null, state: DashboardDataState, locale: Locale): string {
  if (state === "loading") return "…";
  if (state === "error" || value === null) return "—";
  return formatNumber(value, locale);
}

function messageStatusLabel(status: string, locale: Locale): string {
  const t = dashboardCopy[locale];
  const labels: Record<string, string> = {
    new: t.newStatus,
    imported: t.importedStatus,
    needs_reply: t.needsReplyStatus,
    ai_draft_ready: t.aiDraftStatus,
    waiting_review: t.reviewStatus,
    needs_manual_check: t.reviewStatus,
    safety_blocked: t.reviewStatus,
    approved: t.approvedStatus,
    sending: t.sendingStatus,
    answered: t.answeredStatus,
    auto_reply_sent: t.autoSentStatus,
    failed: t.failedStatus,
    escalated: t.escalatedStatus,
    archived: t.archivedStatus,
  };
  return labels[status] ?? status;
}

function messageStatusTone(status: string): BadgeTone {
  if (["failed", "blocked_by_marketplace"].includes(status)) return "danger";
  if (["needs_reply", "waiting_review", "needs_manual_check", "safety_blocked", "escalated"].includes(status)) return "warning";
  if (["answered", "auto_reply_sent", "approved"].includes(status)) return "success";
  return "info";
}

function marketplaceLabel(value: string, locale: Locale): string {
  const t = dashboardCopy[locale];
  const labels: Record<string, string> = {
    wildberries: "Wildberries",
    ozon: "Ozon",
    yandex_market: t.yandex,
    avito: t.avito,
  };
  return labels[value] ?? value;
}

function marketplaceInitial(value: string): string {
  if (value === "wildberries") return "WB";
  if (value === "ozon") return "OZ";
  if (value === "yandex_market") return "YM";
  if (value === "avito") return "AV";
  return value.slice(0, 2).toUpperCase();
}

function personInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
}

function productInitial(value: string | null | undefined): string {
  const source = value?.trim();
  return source ? source.charAt(0).toUpperCase() : "•";
}

function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU").format(value);
}

function formatDuration(value: number | null, locale: Locale): string {
  const t = dashboardCopy[locale];
  if (value === null) return "—";
  if (value < 60) return `${Math.round(value)} ${t.seconds}`;
  if (value < 3600) return `${Math.round(value / 60)} ${t.minutes}`;
  return `${(value / 3600).toFixed(1)} ${t.hours}`;
}

function formatDateTime(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
