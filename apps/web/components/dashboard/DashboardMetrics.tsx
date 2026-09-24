"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import {
  analyticsOverviewSchema,
  automationRuleListSchema,
  marketplaceAccountListSchema,
  reviewQueueListSchema,
} from "../../lib/api/schemas";
import { localizedPath, type Locale } from "../../lib/i18n";
import { hasCurrentIntegrationProblem } from "../../lib/marketplace-account-health";
import { Badge, type BadgeTone } from "../ui/Badge";
import { useWorkspace } from "../workspace/WorkspaceProvider";

type DashboardDataState = "ready" | "loading" | "error";

type AttentionItem = {
  label: string;
  value: number | null;
  helper: string;
  href: string;
  action: string;
  state: DashboardDataState;
};

const dashboardCopy = {
  ru: {
    loadingTitle: "Собираем рабочий обзор",
    loadingDescription: "Получаем обращения и ключевые показатели за последние 30 дней.",
    retrying: "Повторяем...",
    retry: "Повторить",
    unavailableTitle: "Рабочий обзор недоступен",
    unavailableDescription: "Основную сводку сейчас получить не удалось. Рабочие разделы по-прежнему доступны через меню кабинета.",
    noReply: "Без ответа",
    noReplySome: "Обращения ждут ответа команды или подходящего правила.",
    noReplyNone: "Очередь обращений без ответа пуста.",
    openMessages: "Открыть обращения",
    review: "На проверке",
    reviewChecking: "Проверяем очередь ответов.",
    reviewError: "Не удалось проверить очередь ответов.",
    reviewSome: "Ответы ждут проверки или решения сотрудника.",
    reviewNone: "Ответов, ожидающих проверки, сейчас нет.",
    openReview: "Открыть очередь проверки",
    connectionProblems: "Проблемы подключений",
    connectionChecking: "Проверяем состояние подключений.",
    connectionError: "Не удалось проверить состояние подключений.",
    connectionSome: "Есть кабинеты, где не удалось обновить данные или требуется проверить подключение.",
    connectionNone: "Подключения не сообщают об ошибках.",
    checkIntegrations: "Проверить интеграции",
    negative: "Негативные отзывы · 30 дней",
    negativeSome: "Откройте обращения и проверьте отзывы с низкой оценкой.",
    negativeNone: "За период негативных отзывов в сводке нет.",
    goMessages: "Перейти к обращениям",
    operational: "Операционный обзор",
    attention: "Требует внимания",
    queues: "Очереди, где нужен следующий шаг",
    current: "Актуальное состояние",
    healthAria: "Состояние автоматизации и подключений",
    workState: "Состояние работы",
    automationConnections: "Автоматизация и подключения",
    enabledRules: "Включено правил",
    checkingRules: "Проверяем состояние правил",
    rulesUnavailable: "Состояние правил недоступно",
    rulesHelper: "Правила, которые могут участвовать в обработке",
    activeAccounts: "Активные кабинеты",
    checkingConnections: "Проверяем состояние подключений",
    connectionsUnavailable: "Состояние подключений недоступно",
    connectionsHelper: "Подключения работают без проблем с последним обновлением",
    replies30: "Ответов отправлено · 30 дней",
    automatic: "автоматически",
    manual: "вручную",
    openAutomation: "Открыть автоматизацию",
    openIntegrations: "Открыть интеграции",
    quickAria: "Быстрые рабочие действия",
    messages: "Обращения",
    newStates: "в новых статусах · 30 дней",
    messagesHelper: "Отзывы, вопросы и сообщения →",
    reviewHelper: "Проверить и отправить ответы →",
    automation: "Автоматизация",
    automationHelper: "Проверить логику автоответов →",
    workData: "Рабочие данные",
    loadError: "Ошибка загрузки",
    checking: "Проверяем",
    unavailable: "Недоступно",
    noData: "Нет данных",
    actionNeeded: "Нужно действие",
    okay: "В порядке",
    outOf: "из",
    checkingQueue: "Проверяем очередь",
    statusUnavailable: "Состояние недоступно",
    waitingDecision: "ждут решения",
    checkingRulesShort: "Проверяем правила",
    rulesEnabled: "правил включено",
  },
  en: {
    loadingTitle: "Building your workspace overview",
    loadingDescription: "Loading customer messages and key metrics for the last 30 days.",
    retrying: "Retrying...",
    retry: "Retry",
    unavailableTitle: "Workspace overview is unavailable",
    unavailableDescription: "The main summary could not be loaded. You can still open the working sections from the navigation.",
    noReply: "Needs reply",
    noReplySome: "Customer messages are waiting for the team or an applicable automation rule.",
    noReplyNone: "There are no customer messages waiting for a reply.",
    openMessages: "Open messages",
    review: "Needs review",
    reviewChecking: "Checking the review queue.",
    reviewError: "Could not check the review queue.",
    reviewSome: "Replies are waiting for team review or a decision.",
    reviewNone: "There are no replies waiting for review.",
    openReview: "Open review queue",
    connectionProblems: "Connection issues",
    connectionChecking: "Checking marketplace connections.",
    connectionError: "Could not check marketplace connections.",
    connectionSome: "Some seller accounts need attention or the latest update did not complete.",
    connectionNone: "No current connection issues are reported.",
    checkIntegrations: "Check integrations",
    negative: "Negative reviews · 30 days",
    negativeSome: "Open messages and review low-rated customer feedback.",
    negativeNone: "No negative reviews are present in the summary for this period.",
    goMessages: "Go to messages",
    operational: "Operational overview",
    attention: "Needs attention",
    queues: "Queues that need a next step",
    current: "Current state",
    healthAria: "Automation and connection status",
    workState: "Workflow health",
    automationConnections: "Automation and integrations",
    enabledRules: "Enabled rules",
    checkingRules: "Checking automation rules",
    rulesUnavailable: "Rule status is unavailable",
    rulesHelper: "Rules currently available for message handling",
    activeAccounts: "Active seller accounts",
    checkingConnections: "Checking marketplace connections",
    connectionsUnavailable: "Connection status is unavailable",
    connectionsHelper: "Connections are working without a current update issue",
    replies30: "Replies sent · 30 days",
    automatic: "automatically",
    manual: "after review",
    openAutomation: "Open automation",
    openIntegrations: "Open integrations",
    quickAria: "Quick workspace actions",
    messages: "Messages",
    newStates: "in new states · 30 days",
    messagesHelper: "Reviews, questions, and messages →",
    reviewHelper: "Review and send replies →",
    automation: "Automation",
    automationHelper: "Review automation logic →",
    workData: "Workspace data",
    loadError: "Loading error",
    checking: "Checking",
    unavailable: "Unavailable",
    noData: "No data",
    actionNeeded: "Action needed",
    okay: "All good",
    outOf: "of",
    checkingQueue: "Checking queue",
    statusUnavailable: "Status unavailable",
    waitingDecision: "waiting for a decision",
    checkingRulesShort: "Checking rules",
    rulesEnabled: "rules enabled",
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
  const reviewQueueSummary = {
    state: reviewQueueQuery.isPending ? "loading" : reviewQueueQuery.error || !reviewQueueQuery.data ? "error" : "ready",
    value: reviewQueueQuery.data?.total ?? null,
  } satisfies { state: DashboardDataState; value: number | null };

  const accountsSummary = {
    state: accountsQuery.isPending ? "loading" : accountsQuery.error || !accountsQuery.data ? "error" : "ready",
    active: accountsQuery.data
      ? accountsQuery.data.filter((account) => account.status === "active" && !hasCurrentIntegrationProblem(account)).length
      : null,
    problem: accountsQuery.data ? accountsQuery.data.filter(hasCurrentIntegrationProblem).length : null,
    total: accountsQuery.data?.length ?? null,
  } satisfies { active: number | null; problem: number | null; state: DashboardDataState; total: number | null };

  const rulesSummary = {
    state: rulesQuery.isPending ? "loading" : rulesQuery.error || !rulesQuery.data ? "error" : "ready",
    enabled: rulesQuery.data ? rulesQuery.data.items.filter((rule) => rule.is_enabled).length : null,
    total: rulesQuery.data?.total ?? null,
  } satisfies { enabled: number | null; state: DashboardDataState; total: number | null };

  const attentionItems: AttentionItem[] = [
    {
      label: t.noReply,
      value: analytics.unanswered_messages,
      helper: analytics.unanswered_messages > 0 ? t.noReplySome : t.noReplyNone,
      href: path("/app/inbox"),
      action: t.openMessages,
      state: "ready",
    },
    {
      label: t.review,
      value: reviewQueueSummary.value,
      helper:
        reviewQueueSummary.state === "loading"
          ? t.reviewChecking
          : reviewQueueSummary.state === "error"
            ? t.reviewError
            : reviewQueueSummary.value !== null && reviewQueueSummary.value > 0
              ? t.reviewSome
              : t.reviewNone,
      href: path("/app/review-queue"),
      action: t.openReview,
      state: reviewQueueSummary.state,
    },
    {
      label: t.connectionProblems,
      value: accountsSummary.problem,
      helper:
        accountsSummary.state === "loading"
          ? t.connectionChecking
          : accountsSummary.state === "error"
            ? t.connectionError
            : accountsSummary.problem !== null && accountsSummary.problem > 0
              ? t.connectionSome
              : t.connectionNone,
      href: path("/app/integrations"),
      action: t.checkIntegrations,
      state: accountsSummary.state,
    },
    {
      label: t.negative,
      value: analytics.negative_reviews,
      helper: analytics.negative_reviews > 0 ? t.negativeSome : t.negativeNone,
      href: path("/app/inbox"),
      action: t.goMessages,
      state: "ready",
    },
  ];

  return (
    <>
      <section className="dashboard-operational-grid" aria-label={t.operational}>
        <article className="dashboard-attention-panel">
          <header className="dashboard-overview-panel-heading">
            <div>
              <span className="panel-kicker">{t.attention}</span>
              <h2>{t.queues}</h2>
            </div>
            <span className="dashboard-period">{t.current}</span>
          </header>

          <div className="dashboard-attention-list">
            {attentionItems.map((item) => (
              <div className="dashboard-attention-row" key={item.label}>
                <div className="dashboard-attention-copy">
                  <div className="dashboard-attention-title">
                    <strong>{item.label}</strong>
                    <Badge tone={attentionTone(item.value, item.state)}>{attentionLabel(item.value, item.state, locale)}</Badge>
                  </div>
                  <p>{item.helper}</p>
                </div>
                <strong className="dashboard-attention-value">{formatAttentionValue(item.value, item.state, locale)}</strong>
                <Link className="dashboard-row-action" href={item.href}>{item.action} →</Link>
              </div>
            ))}
          </div>
        </article>

        <aside className="dashboard-health-panel" aria-label={t.healthAria}>
          <div className="dashboard-overview-panel-heading">
            <div>
              <span className="panel-kicker">{t.workState}</span>
              <h2>{t.automationConnections}</h2>
            </div>
          </div>

          <dl className="dashboard-health-list">
            <div>
              <dt>{t.enabledRules}</dt>
              <dd>{formatHealthRatio(rulesSummary.enabled, rulesSummary.total, rulesSummary.state, locale)}</dd>
              <small>
                {rulesSummary.state === "loading"
                  ? t.checkingRules
                  : rulesSummary.state === "error"
                    ? t.rulesUnavailable
                    : t.rulesHelper}
              </small>
            </div>
            <div>
              <dt>{t.activeAccounts}</dt>
              <dd>{formatHealthRatio(accountsSummary.active, accountsSummary.total, accountsSummary.state, locale)}</dd>
              <small>
                {accountsSummary.state === "loading"
                  ? t.checkingConnections
                  : accountsSummary.state === "error"
                    ? t.connectionsUnavailable
                    : t.connectionsHelper}
              </small>
            </div>
            <div>
              <dt>{t.replies30}</dt>
              <dd>{formatNumber(analytics.replies_sent, locale)}</dd>
              <small>{formatNumber(analytics.auto_replies_sent, locale)} {t.automatic} · {formatNumber(analytics.manual_replies_sent, locale)} {t.manual}</small>
            </div>
          </dl>

          <div className="dashboard-health-actions">
            <Link className="button button-secondary" href={path("/app/automation-rules")}>{t.openAutomation}</Link>
            <Link className="button button-secondary" href={path("/app/integrations")}>{t.openIntegrations}</Link>
          </div>
        </aside>
      </section>

      <nav className="dashboard-quick-actions" aria-label={t.quickAria}>
        <Link className="dashboard-quick-action" href={path("/app/inbox")}>
          <span>{t.messages}</span>
          <strong>{formatNumber(analytics.new_messages, locale)} {t.newStates}</strong>
          <small>{t.messagesHelper}</small>
        </Link>
        <Link className="dashboard-quick-action" href={path("/app/review-queue")}>
          <span>{t.review}</span>
          <strong>{quickActionReviewCopy(reviewQueueSummary.value, reviewQueueSummary.state, locale)}</strong>
          <small>{t.reviewHelper}</small>
        </Link>
        <Link className="dashboard-quick-action" href={path("/app/automation-rules")}>
          <span>{t.automation}</span>
          <strong>{quickActionRulesCopy(rulesSummary.enabled, rulesSummary.state, locale)}</strong>
          <small>{t.automationHelper}</small>
        </Link>
      </nav>
    </>
  );
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

function attentionTone(value: number | null, state: DashboardDataState): BadgeTone {
  if (state === "loading") return "neutral";
  if (state === "error") return "danger";
  if (value === null) return "neutral";
  return value > 0 ? "warning" : "success";
}

function attentionLabel(value: number | null, state: DashboardDataState, locale: Locale): string {
  const t = dashboardCopy[locale];
  if (state === "loading") return t.checking;
  if (state === "error") return t.unavailable;
  if (value === null) return t.noData;
  return value > 0 ? t.actionNeeded : t.okay;
}

function formatAttentionValue(value: number | null, state: DashboardDataState, locale: Locale): string {
  if (state === "loading") return "…";
  if (state === "error") return "—";
  return value === null ? "—" : formatNumber(value, locale);
}

function formatHealthRatio(part: number | null, total: number | null, state: DashboardDataState, locale: Locale): string {
  if (state === "loading") return "…";
  if (state === "error" || part === null || total === null) return "—";
  return `${formatNumber(part, locale)} ${dashboardCopy[locale].outOf} ${formatNumber(total, locale)}`;
}

function quickActionReviewCopy(value: number | null, state: DashboardDataState, locale: Locale): string {
  const t = dashboardCopy[locale];
  if (state === "loading") return t.checkingQueue;
  if (state === "error" || value === null) return t.statusUnavailable;
  return `${formatNumber(value, locale)} ${t.waitingDecision}`;
}

function quickActionRulesCopy(enabled: number | null, state: DashboardDataState, locale: Locale): string {
  const t = dashboardCopy[locale];
  if (state === "loading") return t.checkingRulesShort;
  if (state === "error" || enabled === null) return t.statusUnavailable;
  return `${formatNumber(enabled, locale)} ${t.rulesEnabled}`;
}

function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU").format(value);
}
