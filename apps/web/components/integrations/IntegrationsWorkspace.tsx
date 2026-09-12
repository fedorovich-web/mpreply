"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import { marketplaceAccountListSchema } from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

type MarketplaceCatalogItem = {
  key: "wildberries" | "ozon" | "yandex_market" | "avito";
  name: string;
  href: string;
  description: string;
  readiness: "live" | "planned";
  detailsLabel: string;
};

const marketplaceCatalog: MarketplaceCatalogItem[] = [
  {
    key: "wildberries",
    name: "Wildberries",
    href: "/app/integrations/wildberries",
    description: "Отзывы, вопросы и сообщения покупателей в общей очереди с синхронизацией и отправкой ответов через MPReply.",
    readiness: "live",
    detailsLabel: "Wildberries",
  },
  {
    key: "ozon",
    name: "Ozon",
    href: "/app/integrations/ozon",
    description: "Интеграция запланирована после проверки актуальных API и сценариев production-отправки. Подключение и отправка пока недоступны.",
    readiness: "planned",
    detailsLabel: "Ozon",
  },
  {
    key: "yandex_market",
    name: "Яндекс Маркет",
    href: "/app/integrations/yandex-market",
    description: "Интеграция запланирована после проверки актуальных API и сценариев production-отправки. Подключение и отправка пока недоступны.",
    readiness: "planned",
    detailsLabel: "Яндекс Маркете",
  },
  {
    key: "avito",
    name: "Авито",
    href: "/app/integrations/avito",
    description: "Интеграция запланирована после проверки актуальных API и сценариев production-отправки. Подключение и отправка пока недоступны.",
    readiness: "planned",
    detailsLabel: "Авито",
  },
];

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
  const liveAccounts = accounts.filter((account) => account.marketplace === "wildberries");
  const activeCount = liveAccounts.filter((account) => account.status === "active").length;
  const problemCount = liveAccounts.filter((account) => account.status === "error" || account.error_count > 0).length;
  const canManage = activeOrganization.current_user_role === "owner" || activeOrganization.current_user_role === "admin";

  return (
    <section className="integrations-workspace" aria-label="Интеграции маркетплейсов">
      <div className="integrations-summary-grid" aria-label="Сводка доступных подключений">
        <SummaryMetric label="Подключений" value={accountsQuery.isPending ? "—" : String(liveAccounts.length)} />
        <SummaryMetric label="Активных" value={accountsQuery.isPending ? "—" : String(activeCount)} />
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
          const marketplaceAccounts = marketplace.readiness === "live"
            ? liveAccounts.filter((account) => account.marketplace === marketplace.key)
            : [];
          const connectedCount = marketplaceAccounts.length;
          const hasProblem = marketplaceAccounts.some((account) => account.status === "error" || account.error_count > 0);
          const hasActive = marketplaceAccounts.some((account) => account.status === "active");
          const connectionState = marketplace.readiness === "live"
            ? getConnectionState({ connectedCount, hasActive, hasProblem })
            : null;
          const actionLabel = marketplace.readiness === "live"
            ? canManage
              ? connectedCount > 0
                ? `Управлять ${marketplace.name}`
                : `Подключить ${marketplace.name}`
              : `Открыть ${marketplace.name}`
            : marketplace.key === "yandex_market"
              ? `Подробнее о ${marketplace.detailsLabel}`
              : `Подробнее об ${marketplace.detailsLabel}`;

          return (
            <article
              className={`integration-market-card integration-market-card-${marketplace.readiness}`}
              key={marketplace.key}
              role="listitem"
            >
              <div className="integration-market-card-topline">
                <div>
                  <span className={marketplace.readiness === "live" ? "ui-badge ui-badge-info" : "ui-badge"}>
                    {marketplace.readiness === "live" ? "Доступно сейчас" : "Планируется"}
                  </span>
                  <h2>{marketplace.name}</h2>
                </div>
                {connectionState ? (
                  <span className={`ui-badge ui-badge-${connectionState.tone}`}>{connectionState.label}</span>
                ) : null}
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
