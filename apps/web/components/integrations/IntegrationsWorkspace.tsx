"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { ApiError, apiRequest, buildApiQuery } from "../../lib/api/client";
import { marketplaceAccountListSchema } from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const marketplaceCatalog = [
  {
    key: "wildberries",
    name: "Wildberries",
    href: "/app/integrations/wildberries",
    description: "Отзывы и вопросы, синхронизация обращений, подготовка ответов и управление подключёнными кабинетами.",
  },
  {
    key: "ozon",
    name: "Ozon",
    href: "/app/integrations/ozon",
    description: "Обращения покупателей Ozon, синхронизация кабинета и работа с ответами в едином интерфейсе MPReply.",
  },
  {
    key: "yandex_market",
    name: "Яндекс Маркет",
    href: "/app/integrations/yandex-market",
    description: "Вопросы и обращения Яндекс Маркета с общей очередью, статусами и управлением ответами.",
  },
  {
    key: "avito",
    name: "Авито",
    href: "/app/integrations/avito",
    description: "Сообщения покупателей Авито, синхронизация чатов и управление подключением из MPReply.",
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
  const activeCount = accounts.filter((account) => account.status === "active").length;
  const problemCount = accounts.filter((account) => account.status === "error" || account.error_count > 0).length;
  const canManage = activeOrganization.current_user_role === "owner" || activeOrganization.current_user_role === "admin";

  return (
    <section className="integrations-workspace" aria-label="Интеграции маркетплейсов">
      <div className="integrations-summary-grid" aria-label="Сводка подключений">
        <SummaryMetric label="Подключений" value={accountsQuery.isPending ? "—" : String(accounts.length)} />
        <SummaryMetric label="Активных" value={accountsQuery.isPending ? "—" : String(activeCount)} />
        <SummaryMetric label="Требуют внимания" value={accountsQuery.isPending ? "—" : String(problemCount)} />
      </div>

      {accountsQuery.error ? (
        <div className="workspace-inline-state workspace-inline-state-error" role="alert">
          <strong>Не удалось загрузить подключения</strong>
          <p>{errorMessage(accountsQuery.error)}</p>
          <button className="button button-secondary button-compact" onClick={() => void accountsQuery.refetch()} type="button">
            Повторить
          </button>
        </div>
      ) : null}

      <div className="integration-catalog-grid" role="list">
        {marketplaceCatalog.map((marketplace) => {
          const connectedCount = accounts.filter((account) => account.marketplace === marketplace.key).length;
          const statusLabel = connectedCount > 0
            ? `${connectedCount} ${accountWord(connectedCount)}`
            : "Можно подключить";
          const actionLabel = canManage
            ? connectedCount > 0
              ? `Управлять ${marketplace.name}`
              : `Подключить ${marketplace.name}`
            : `Открыть ${marketplace.name}`;

          return (
            <article className="integration-market-card" key={marketplace.key} role="listitem">
              <div className="integration-market-card-topline">
                <div>
                  <span className="ui-badge ui-badge-success">Поддерживается</span>
                  <h2>{marketplace.name}</h2>
                </div>
                <span className="ui-badge ui-badge-success">{statusLabel}</span>
              </div>
              <p>{marketplace.description}</p>
              <Link className="button button-secondary" href={marketplace.href}>
                {actionLabel}
              </Link>
            </article>
          );
        })}
      </div>
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

function accountWord(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return "подключение";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "подключения";
  return "подключений";
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "Неизвестная ошибка";
}
