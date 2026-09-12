"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import { marketplaceAccountListSchema } from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const marketplaceCatalog = [
  {
    key: "wildberries",
    name: "Wildberries",
    href: "/app/integrations/wildberries",
    available: true,
    description: "Отзывы, вопросы и сообщения покупателей в общей очереди с контекстом, подготовкой ответа и контролем отправки.",
  },
  {
    key: "ozon",
    name: "Ozon",
    href: null,
    available: false,
    description: "Поддержка обращений покупателей Ozon запланирована в том же рабочем процессе MPReply.",
  },
  {
    key: "yandex_market",
    name: "Яндекс Маркет",
    href: null,
    available: false,
    description: "Поддержка обращений Яндекс Маркета запланирована с едиными статусами, очередью и правилами обработки.",
  },
  {
    key: "avito",
    name: "Авито",
    href: null,
    available: false,
    description: "Поддержка сообщений и обращений покупателей Авито запланирована для единой очереди MPReply.",
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
        <SummaryMetric label="Подключено кабинетов" value={accountsQuery.isPending ? "—" : String(accounts.length)} />
        <SummaryMetric label="Работают нормально" value={accountsQuery.isPending ? "—" : String(activeCount)} />
        <SummaryMetric label="Требуют внимания" value={accountsQuery.isPending ? "—" : String(problemCount)} />
      </div>

      {accountsQuery.error ? (
        <div className="workspace-inline-state workspace-inline-state-error" role="alert">
          <strong>Не удалось загрузить подключения</strong>
          <p>Повторите загрузку. Сохранённые подключения останутся без изменений.</p>
          <button className="button button-secondary button-compact" onClick={() => void accountsQuery.refetch()} type="button">
            Повторить
          </button>
        </div>
      ) : null}

      <div className="integration-catalog-grid" role="list">
        {marketplaceCatalog.map((marketplace) => {
          const marketplaceAccounts = accounts.filter((account) => account.marketplace === marketplace.key);
          const connectedCount = marketplaceAccounts.length;
          const hasProblem = marketplaceAccounts.some((account) => account.status === "error" || account.error_count > 0);
          const hasActive = marketplaceAccounts.some((account) => account.status === "active");
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
                  <span className={`ui-badge ${marketplace.available ? "ui-badge-info" : "ui-badge-neutral"}`}>
                    {marketplace.available ? "Интеграция готова" : "В разработке"}
                  </span>
                  <h2>{marketplace.name}</h2>
                </div>
                {marketplace.available ? (
                  <span className={`ui-badge ui-badge-${connectionState.tone}`}>{connectionState.label}</span>
                ) : null}
              </div>
              <p>{marketplace.description}</p>
              {marketplace.available && marketplace.href ? (
                <Link className="button button-secondary" href={marketplace.href}>
                  {actionLabel}
                </Link>
              ) : (
                <span className="integration-unavailable-note">Подключение пока недоступно</span>
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

function accountWord(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return "подключение";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "подключения";
  return "подключений";
}
