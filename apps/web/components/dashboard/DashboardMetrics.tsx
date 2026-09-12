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
import { Badge, type BadgeTone } from "../ui/Badge";
import { useWorkspace } from "../workspace/WorkspaceProvider";

type AttentionItem = {
  label: string;
  value: number | null;
  helper: string;
  href: string;
  action: string;
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

  if (analyticsQuery.isPending || reviewQueueQuery.isPending || accountsQuery.isPending || rulesQuery.isPending) {
    return (
      <div className="workspace-inline-state" aria-live="polite">
        <strong>Собираем рабочий обзор</strong>
        <p>Проверяем входящие, очередь модерации, подключения и правила автоматизации.</p>
      </div>
    );
  }

  if (analyticsQuery.error || !analyticsQuery.data) {
    return (
      <div className="workspace-inline-state workspace-inline-state-error" role="alert">
        <strong>Не удалось загрузить рабочий обзор</strong>
        <p>Обновите страницу. Если ошибка повторится, нужные очереди остаются доступны через меню кабинета.</p>
      </div>
    );
  }

  const analytics = analyticsQuery.data;
  const reviewTotal = reviewQueueQuery.data?.total ?? null;
  const accounts = accountsQuery.data ?? null;
  const rules = rulesQuery.data ?? null;
  const problemAccounts = accounts
    ? accounts.filter((account) => account.status === "error" || account.error_count > 0).length
    : null;
  const activeAccounts = accounts ? accounts.filter((account) => account.status === "active").length : null;
  const enabledRules = rules ? rules.items.filter((rule) => rule.is_enabled).length : null;

  const attentionItems: AttentionItem[] = [
    {
      label: "Без ответа",
      value: analytics.unanswered_messages,
      helper:
        analytics.unanswered_messages > 0
          ? "Обращения ждут ответа команды или подходящего правила."
          : "Очередь обращений без ответа пуста.",
      href: "/app/inbox",
      action: "Открыть входящие",
    },
    {
      label: "На модерации",
      value: reviewTotal,
      helper: reviewQueueQuery.error
        ? "Не удалось проверить очередь модерации."
        : reviewTotal && reviewTotal > 0
          ? "Ответы ждут проверки или решения сотрудника."
          : "Ответов, ожидающих проверки, сейчас нет.",
      href: "/app/review-queue",
      action: "Открыть модерацию",
    },
    {
      label: "Проблемы подключений",
      value: problemAccounts,
      helper: accountsQuery.error
        ? "Не удалось проверить состояние подключений."
        : problemAccounts && problemAccounts > 0
          ? "Есть кабинеты с ошибкой или неуспешной синхронизацией."
          : "Подключения не сообщают об ошибках.",
      href: "/app/integrations",
      action: "Проверить интеграции",
    },
    {
      label: "Негативные отзывы · 30 дней",
      value: analytics.negative_reviews,
      helper:
        analytics.negative_reviews > 0
          ? "Откройте входящие и проверьте обращения с низкой оценкой."
          : "За период негативных отзывов в сводке нет.",
      href: "/app/inbox",
      action: "Перейти к обращениям",
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
                    <Badge tone={attentionTone(item.value)}>{attentionLabel(item.value)}</Badge>
                  </div>
                  <p>{item.helper}</p>
                </div>
                <strong className="dashboard-attention-value">{formatOptionalNumber(item.value)}</strong>
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
              <dd>{rules ? `${formatNumber(enabledRules ?? 0)} из ${formatNumber(rules.total)}` : "—"}</dd>
              <small>{rulesQuery.error ? "Состояние правил недоступно" : "Правила, которые могут участвовать в обработке"}</small>
            </div>
            <div>
              <dt>Активные кабинеты</dt>
              <dd>{accounts ? `${formatNumber(activeAccounts ?? 0)} из ${formatNumber(accounts.length)}` : "—"}</dd>
              <small>{accountsQuery.error ? "Состояние подключений недоступно" : "Подключения со статусом «активно»"}</small>
            </div>
            <div>
              <dt>Ответов отправлено · 30 дней</dt>
              <dd>{formatNumber(analytics.replies_sent)}</dd>
              <small>{formatNumber(analytics.auto_replies_sent)} автоматически · {formatNumber(analytics.manual_replies_sent)} вручную</small>
            </div>
          </dl>

          <div className="dashboard-health-actions">
            <Link className="button button-secondary" href="/app/automation-rules">Открыть правила</Link>
            <Link className="button button-secondary" href="/app/integrations">Открыть интеграции</Link>
          </div>
        </aside>
      </section>

      <nav className="dashboard-quick-actions" aria-label="Быстрые рабочие действия">
        <Link className="dashboard-quick-action" href="/app/inbox">
          <span>Входящие</span>
          <strong>{formatNumber(analytics.new_messages)} новых за 30 дней</strong>
          <small>Отзывы, вопросы и сообщения →</small>
        </Link>
        <Link className="dashboard-quick-action" href="/app/review-queue">
          <span>Модерация</span>
          <strong>{formatOptionalNumber(reviewTotal)} ждут решения</strong>
          <small>Проверить и отправить ответы →</small>
        </Link>
        <Link className="dashboard-quick-action" href="/app/automation-rules">
          <span>Автоматизация</span>
          <strong>{rules ? `${formatNumber(enabledRules ?? 0)} правил включено` : "Состояние недоступно"}</strong>
          <small>Проверить логику автоответов →</small>
        </Link>
      </nav>
    </>
  );
}

function attentionTone(value: number | null): BadgeTone {
  if (value === null) return "neutral";
  return value > 0 ? "warning" : "success";
}

function attentionLabel(value: number | null): string {
  if (value === null) return "Нет данных";
  return value > 0 ? "Нужно действие" : "В порядке";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatOptionalNumber(value: number | null): string {
  return value === null ? "—" : formatNumber(value);
}
