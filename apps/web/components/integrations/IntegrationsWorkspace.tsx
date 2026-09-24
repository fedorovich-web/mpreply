"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import { marketplaceAccountListSchema } from "../../lib/api/schemas";
import { hasCurrentIntegrationProblem } from "../../lib/marketplace-account-health";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const marketplaceCatalog = [
  {
    key: "wildberries",
    name: "Wildberries",
    href: "/app/integrations/wildberries",
    description: "Отзывы, вопросы и сообщения покупателей в общей очереди с контекстом, подготовкой ответа и контролем отправки.",
  },
  {
    key: "ozon",
    name: "Ozon",
    href: "/app/integrations/ozon",
    description: "Обращения покупателей Ozon, подключённые кабинеты и ответы в том же рабочем процессе, что и на других площадках.",
  },
  {
    key: "yandex_market",
    name: "Яндекс Маркет",
    href: "/app/integrations/yandex-market",
    description: "Отзывы, вопросы и сообщения Яндекс Маркета с едиными статусами, очередью и правилами обработки.",
  },
  {
    key: "avito",
    name: "Авито",
    href: "/app/integrations/avito",
    description: "Сообщения и обращения покупателей Авито в общей очереди MPReply с едиными правилами обработки и ответами.",
  },
] as const;

export function IntegrationsWorkspace() {
  const { activeOrganization } = useWorkspace();
  const accountsQuery = useQuery({
    queryKey: ["marketplace-accounts", activeOrganization.id],
    queryFn: () =>
      apiRequest(
        buildApiQuery("/api/marketplace-accounts", { organization_id: activeOrganization.id }),
        marketplaceAccountListSchema,
      ),
  });

  const accounts = accountsQuery.data ?? [];
  const activeCount = accounts.filter(isHealthyConnection).length;
  const problemCount = accounts.filter(needsConnectionAttention).length;
  const canManage = activeOrganization.current_user_role === "owner" || activeOrganization.current_user_role === "admin";

  return (
    <section className="integrations-workspace" aria-label="Интеграции маркетплейсов">
      <div className="integrations-summary-grid" aria-label="Сводка подключений">
        <SummaryMetric label="Подключённых кабинетов" value={accountsQuery.data ? String(accounts.length) : "—"} />
        <SummaryMetric label="Работают нормально" value={accountsQuery.data ? String(activeCount) : "—"} />
        <SummaryMetric label="Требуют внимания" value={accountsQuery.data ? String(problemCount) : "—"} />
      </div>

      <div className="integration-overview-actions">
        {accountsQuery.data ? (
          <button
            className="button button-secondary button-compact"
            disabled={accountsQuery.isFetching}
            onClick={() => void accountsQuery.refetch()}
            type="button"
          >
            {accountsQuery.isFetching ? "Обновляем..." : "Обновить подключения"}
          </button>
        ) : null}
      </div>

      {accountsQuery.isPending && !accountsQuery.data ? (
        <div className="integration-overview-state" aria-busy="true" aria-live="polite" role="status">
          <strong>Загружаем подключения</strong>
          <p>Проверяем подключённые кабинеты маркетплейсов.</p>
        </div>
      ) : accountsQuery.error && !accountsQuery.data ? (
        <div className="integration-overview-state integration-overview-state-error" role="alert">
          <strong>Не удалось загрузить подключения</strong>
          <p>Подключения временно недоступны. Попробуйте ещё раз.</p>
          <button
            className="button button-secondary button-compact"
            disabled={accountsQuery.isFetching}
            onClick={() => void accountsQuery.refetch()}
            type="button"
          >
            {accountsQuery.isFetching ? "Повторяем..." : "Повторить"}
          </button>
        </div>
      ) : accountsQuery.data ? (
        <>
          {accountsQuery.error && accountsQuery.data ? (
            <div className="integration-refresh-error" role="alert">
              <div>
                <strong>Не удалось обновить подключения</strong>
                <p>Показываем ранее загруженные данные. Можно продолжать работу или попробовать ещё раз.</p>
              </div>
              <button
                className="button button-secondary button-compact"
                disabled={accountsQuery.isFetching}
                onClick={() => void accountsQuery.refetch()}
                type="button"
              >
                {accountsQuery.isFetching ? "Повторяем..." : "Повторить"}
              </button>
            </div>
          ) : null}

          <div className="integration-catalog-grid" role="list">
        {marketplaceCatalog.map((marketplace) => {
          const marketplaceAccounts = accounts.filter((account) => account.marketplace === marketplace.key);
          const connectedCount = marketplaceAccounts.length;
          const hasProblem = marketplaceAccounts.some(needsConnectionAttention);
          const hasActive = marketplaceAccounts.some(isHealthyConnection);
          const connectionState = getConnectionState({ connectedCount, hasActive, hasProblem });
          const actionLabel = canManage
            ? connectedCount > 0
              ? `Управлять ${marketplace.name}`
              : `Подключить ${marketplace.name}`
            : `Открыть ${marketplace.name}`;

          return (
            <article className="integration-market-card" key={marketplace.key} role="listitem">
              <div className="integration-market-card-topline">
                <div>
                  <span className="ui-badge ui-badge-info">Подключение доступно</span>
                  <h2>{marketplace.name}</h2>
                </div>
                <span className={`ui-badge ui-badge-${connectionState.tone}`}>{connectionState.label}</span>
              </div>
              <p>{marketplace.description}</p>
              <Link className="button button-secondary" href={marketplace.href}>
                {actionLabel}
              </Link>
            </article>
          );
        })}
          </div>
        </>
      ) : null}
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="integration-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function getConnectionState({
  connectedCount,
  hasActive,
  hasProblem,
}: {
  connectedCount: number;
  hasActive: boolean;
  hasProblem: boolean;
}): { label: string; tone: "neutral" | "success" | "warning" } {
  if (hasProblem) {
    return { label: "Требует внимания", tone: "warning" };
  }
  if (hasActive) {
    return { label: `${connectedCount} ${accountWord(connectedCount)}`, tone: "success" };
  }
  if (connectedCount > 0) {
    return { label: "Настройка не завершена", tone: "warning" };
  }
  return { label: "Не подключено", tone: "neutral" };
}

function isHealthyConnection(account: {
  status: string;
  credentials_status: string;
  last_success_sync_at: string | null;
  last_error_sync_at: string | null;
}): boolean {
  return account.status === "active"
    && account.credentials_status === "valid"
    && !hasCurrentIntegrationProblem(account);
}

function needsConnectionAttention(account: {
  status: string;
  credentials_status: string;
  last_success_sync_at: string | null;
  last_error_sync_at: string | null;
}): boolean {
  return account.status === "error"
    || account.credentials_status === "invalid"
    || account.credentials_status === "revoked"
    || hasCurrentIntegrationProblem(account);
}

function accountWord(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return "подключение";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "подключения";
  return "подключений";
}
