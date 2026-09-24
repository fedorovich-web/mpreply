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

export function DashboardMetrics() {
  const { activeOrganization } = useWorkspace();
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
        description="Получаем обращения и ключевые показатели за последние 30 дней."
        title="Собираем рабочий обзор"
        tone="loading"
      />
    );
  }

  if (analyticsQuery.error || !analyticsQuery.data) {
    return (
      <DashboardOverviewState
        actionDisabled={analyticsQuery.isFetching}
        actionLabel={analyticsQuery.isFetching ? "Повторяем..." : "Повторить"}
        description="Основную сводку сейчас получить не удалось. Рабочие разделы по-прежнему доступны через меню кабинета."
        onAction={() => void analyticsQuery.refetch()}
        title="Рабочий обзор недоступен"
        tone="error"
      />
    );
  }

  const analytics = analyticsQuery.data;

  const reviewQueueSummary: { state: DashboardDataState; value: number | null } = {
    state: reviewQueueQuery.isPending ? "loading" : reviewQueueQuery.error || !reviewQueueQuery.data ? "error" : "ready",
    value: reviewQueueQuery.data?.total ?? null,
  };

  const accountsSummary: {
    active: number | null;
    problem: number | null;
    state: DashboardDataState;
    total: number | null;
  } = {
    state: accountsQuery.isPending ? "loading" : accountsQuery.error || !accountsQuery.data ? "error" : "ready",
    active: accountsQuery.data
      ? accountsQuery.data.filter((account) => account.status === "active" && !hasCurrentIntegrationProblem(account)).length
      : null,
    problem: accountsQuery.data ? accountsQuery.data.filter(hasCurrentIntegrationProblem).length : null,
    total: accountsQuery.data?.length ?? null,
  };

  const rulesSummary: {
    enabled: number | null;
    state: DashboardDataState;
    total: number | null;
  } = {
    state: rulesQuery.isPending ? "loading" : rulesQuery.error || !rulesQuery.data ? "error" : "ready",
    enabled: rulesQuery.data ? rulesQuery.data.items.filter((rule) => rule.is_enabled).length : null,
    total: rulesQuery.data?.total ?? null,
  };

  const attentionItems: AttentionItem[] = [
    {
      label: "Без ответа",
      value: analytics.unanswered_messages,
      helper:
        analytics.unanswered_messages > 0
          ? "Обращения ждут ответа команды или подходящего правила."
          : "Очередь обращений без ответа пуста.",
      href: "/app/inbox",
      action: "Открыть обращения",
      state: "ready",
    },
    {
      label: "На проверке",
      value: reviewQueueSummary.value,
      helper:
        reviewQueueSummary.state === "loading"
          ? "Проверяем очередь ответов."
          : reviewQueueSummary.state === "error"
            ? "Не удалось проверить очередь ответов."
            : reviewQueueSummary.value !== null && reviewQueueSummary.value > 0
              ? "Ответы ждут проверки или решения сотрудника."
              : "Ответов, ожидающих проверки, сейчас нет.",
      href: "/app/review-queue",
      action: "Открыть очередь проверки",
      state: reviewQueueSummary.state,
    },
    {
      label: "Проблемы подключений",
      value: accountsSummary.problem,
      helper:
        accountsSummary.state === "loading"
          ? "Проверяем состояние подключений."
          : accountsSummary.state === "error"
            ? "Не удалось проверить состояние подключений."
            : accountsSummary.problem !== null && accountsSummary.problem > 0
              ? "Есть кабинеты, где не удалось обновить данные или требуется проверить подключение."
              : "Подключения не сообщают об ошибках.",
      href: "/app/integrations",
      action: "Проверить интеграции",
      state: accountsSummary.state,
    },
    {
      label: "Негативные отзывы · 30 дней",
      value: analytics.negative_reviews,
      helper:
        analytics.negative_reviews > 0
          ? "Откройте обращения и проверьте отзывы с низкой оценкой."
          : "За период негативных отзывов в сводке нет.",
      href: "/app/inbox",
      action: "Перейти к обращениям",
      state: "ready",
    },
  ];

  return (
    <>
      <section className="dashboard-operational-grid" aria-label="Операционный обзор">
        <article className="dashboard-attention-panel">
          <header className="dashboard-overview-panel-heading">
            <div>
              <span className="panel-kicker">Требует внимания</span>
              <h2>Очереди, где нужен следующий шаг</h2>
            </div>
            <span className="dashboard-period">Актуальное состояние</span>
          </header>

          <div className="dashboard-attention-list">
            {attentionItems.map((item) => (
              <div className="dashboard-attention-row" key={item.label}>
                <div className="dashboard-attention-copy">
                  <div className="dashboard-attention-title">
                    <strong>{item.label}</strong>
                    <Badge tone={attentionTone(item.value, item.state)}>{attentionLabel(item.value, item.state)}</Badge>
                  </div>
                  <p>{item.helper}</p>
                </div>
                <strong className="dashboard-attention-value">{formatAttentionValue(item.value, item.state)}</strong>
                <Link className="dashboard-row-action" href={item.href}>{item.action} →</Link>
              </div>
            ))}
          </div>
        </article>

        <aside className="dashboard-health-panel" aria-label="Состояние автоматизации и подключений">
          <div className="dashboard-overview-panel-heading">
            <div>
              <span className="panel-kicker">Состояние работы</span>
              <h2>Автоматизация и подключения</h2>
            </div>
          </div>

          <dl className="dashboard-health-list">
            <div>
              <dt>Включено правил</dt>
              <dd>{formatHealthRatio(rulesSummary.enabled, rulesSummary.total, rulesSummary.state)}</dd>
              <small>
                {rulesSummary.state === "loading"
                  ? "Проверяем состояние правил"
                  : rulesSummary.state === "error"
                    ? "Состояние правил недоступно"
                    : "Правила, которые могут участвовать в обработке"}
              </small>
            </div>
            <div>
              <dt>Активные кабинеты</dt>
              <dd>{formatHealthRatio(accountsSummary.active, accountsSummary.total, accountsSummary.state)}</dd>
              <small>
                {accountsSummary.state === "loading"
                  ? "Проверяем состояние подключений"
                  : accountsSummary.state === "error"
                    ? "Состояние подключений недоступно"
                    : "Подключения работают без проблем с последним обновлением"}
              </small>
            </div>
            <div>
              <dt>Ответов отправлено · 30 дней</dt>
              <dd>{formatNumber(analytics.replies_sent)}</dd>
              <small>{formatNumber(analytics.auto_replies_sent)} автоматически · {formatNumber(analytics.manual_replies_sent)} вручную</small>
            </div>
          </dl>

          <div className="dashboard-health-actions">
            <Link className="button button-secondary" href="/app/automation-rules">Открыть автоматизацию</Link>
            <Link className="button button-secondary" href="/app/integrations">Открыть интеграции</Link>
          </div>
        </aside>
      </section>

      <nav className="dashboard-quick-actions" aria-label="Быстрые рабочие действия">
        <Link className="dashboard-quick-action" href="/app/inbox">
          <span>Обращения</span>
          <strong>{formatNumber(analytics.new_messages)} в новых статусах · 30 дней</strong>
          <small>Отзывы, вопросы и сообщения →</small>
        </Link>
        <Link className="dashboard-quick-action" href="/app/review-queue">
          <span>На проверке</span>
          <strong>{quickActionReviewCopy(reviewQueueSummary.value, reviewQueueSummary.state)}</strong>
          <small>Проверить и отправить ответы →</small>
        </Link>
        <Link className="dashboard-quick-action" href="/app/automation-rules">
          <span>Автоматизация</span>
          <strong>{quickActionRulesCopy(rulesSummary.enabled, rulesSummary.state)}</strong>
          <small>Проверить логику автоответов →</small>
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
}: {
  actionDisabled?: boolean;
  actionLabel?: string;
  description: string;
  onAction?: () => void;
  title: string;
  tone: "error" | "loading";
}) {
  return (
    <section
      aria-busy={tone === "loading"}
      aria-live="polite"
      className={"dashboard-overview-state dashboard-overview-state-" + tone}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className="dashboard-overview-state-mark" aria-hidden="true" />
      <div>
        <span>{tone === "loading" ? "Рабочие данные" : "Ошибка загрузки"}</span>
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

function attentionLabel(value: number | null, state: DashboardDataState): string {
  if (state === "loading") return "Проверяем";
  if (state === "error") return "Недоступно";
  if (value === null) return "Нет данных";
  return value > 0 ? "Нужно действие" : "В порядке";
}

function formatAttentionValue(value: number | null, state: DashboardDataState): string {
  if (state === "loading") return "…";
  if (state === "error") return "—";
  return formatOptionalNumber(value);
}

function formatHealthRatio(part: number | null, total: number | null, state: DashboardDataState): string {
  if (state === "loading") return "…";
  if (state === "error" || part === null || total === null) return "—";
  return `${formatNumber(part)} из ${formatNumber(total)}`;
}

function quickActionReviewCopy(value: number | null, state: DashboardDataState): string {
  if (state === "loading") return "Проверяем очередь";
  if (state === "error" || value === null) return "Состояние недоступно";
  return `${formatNumber(value)} ждут решения`;
}

function quickActionRulesCopy(enabled: number | null, state: DashboardDataState): string {
  if (state === "loading") return "Проверяем правила";
  if (state === "error" || enabled === null) return "Состояние недоступно";
  return `${formatNumber(enabled)} правил включено`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatOptionalNumber(value: number | null): string {
  return value === null ? "—" : formatNumber(value);
}
