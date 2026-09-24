"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { ApiError, apiRequest, buildApiQuery } from "../../lib/api/client";
import { marketplaceAccountListSchema } from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const marketplaceCatalog = [
  {
    key: "wildberries",
    slug: "wildberries",
    name: "Wildberries",
    description: "Отзывы и вопросы: подключение, проверка доступа и синхронизация.",
  },
  {
    key: "ozon",
    slug: "ozon",
    name: "Ozon",
    description: "Отзывы и вопросы: потребуется Client ID и API-ключ с нужными правами.",
  },
  {
    key: "yandex_market",
    slug: "yandex-market",
    name: "Яндекс Маркет",
    description: "Отзывы и вопросы: потребуется Business ID и ключ с доступом к общению с покупателями.",
  },
  {
    key: "avito",
    slug: "avito",
    name: "Авито",
    description: "Чаты: потребуется ID аккаунта, Client ID, Client Secret и доступ к API мессенджера.",
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
  const hasAccountData = accountsQuery.isSuccess;
  const activeCount = accounts.filter((account) => account.status === "active" && account.credentials_status === "valid").length;
  const problemCount = accounts.filter((account) => account.status === "error" || account.error_count > 0).length;

  return (
    <section className="integrations-workspace" aria-label="Интеграции маркетплейсов">
      <div className="integrations-summary-grid" aria-label="Сводка подключений">
        <SummaryMetric label="Подключений" value={hasAccountData ? String(accounts.length) : "—"} />
        <SummaryMetric label="Активных" value={hasAccountData ? String(activeCount) : "—"} />
        <SummaryMetric label="Требуют внимания" value={hasAccountData ? String(problemCount) : "—"} />
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
          const statusLabel = !hasAccountData ? "Состояние неизвестно" : connectedCount > 0 ? `${connectedCount} ${accountWord(connectedCount)}` : "Нет подключений";

          return (
            <article className="integration-market-card" key={marketplace.key} role="listitem">
              <div className="integration-market-card-topline">
                <div>
                  <span className="ui-badge">Доступно к подключению</span>
                  <h2>{marketplace.name}</h2>
                </div>
                <span className="ui-badge">
                  {statusLabel}
                </span>
              </div>
              <p>{marketplace.description}</p>
              <Link className="button button-secondary" href={`/app/integrations/${marketplace.slug}`}>
                {!hasAccountData ? "Открыть подключения" : activeOrganization.current_user_role === "owner" || activeOrganization.current_user_role === "admin"
                  ? connectedCount > 0
                    ? "Управлять подключениями"
                    : `Подключить ${marketplace.name}`
                  : "Просмотреть подключения"}
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
  if (error instanceof ApiError) {
    return error.requestId ? `${error.message} · requestId ${error.requestId}` : error.message;
  }
  return error instanceof Error ? error.message : "Неизвестная ошибка";
}
