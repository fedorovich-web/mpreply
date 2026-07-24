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
    badge: "MVP adapter",
    description: "Подключение кабинетов, проверка ключа, ручная синхронизация отзывов и вопросов.",
    available: true,
    href: "/app/integrations/wildberries",
  },
  {
    key: "ozon",
    name: "Ozon",
    badge: "Planned",
    description: "Production adapter ещё не реализован и не объявляется готовым.",
    available: false,
    href: null,
  },
  {
    key: "yandex_market",
    name: "Яндекс Маркет",
    badge: "Partner API",
    description: "Business ID + Api-Key, отзывы, вопросы, ответы, ручная и плановая синхронизация.",
    available: true,
    href: "/app/integrations/yandex-market",
  },
  {
    key: "avito",
    name: "Авито",
    badge: "Planned",
    description: "Не включается в production до реализации и проверки реального adapter.",
    available: false,
    href: null,
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
          const statusLabel = marketplace.available
            ? connectedCount > 0
              ? `${connectedCount} ${accountWord(connectedCount)}`
              : "Можно подключить"
            : "Пока недоступно";

          return (
            <article className="integration-market-card" key={marketplace.key} role="listitem">
              <div className="integration-market-card-topline">
                <div>
                  <span className="ui-badge">{marketplace.badge}</span>
                  <h2>{marketplace.name}</h2>
                </div>
                <span className={`ui-badge ${marketplace.available ? "ui-badge-success" : "ui-badge-warning"}`}>
                  {statusLabel}
                </span>
              </div>
              <p>{marketplace.description}</p>
              {marketplace.available ? (
                <Link className="button button-secondary" href={marketplace.href}>
                  {activeOrganization.current_user_role === "owner" || activeOrganization.current_user_role === "admin"
                    ? connectedCount > 0
                      ? "Управлять подключениями"
                      : `Подключить ${marketplace.name}`
                    : "Просмотреть подключения"}
                </Link>
              ) : (
                <span className="integration-unavailable-note">Без ложного обещания production readiness.</span>
              )}
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
