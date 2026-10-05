"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import { marketplaceAccountListSchema } from "../../lib/api/schemas";
import { localizedPath, type Locale } from "../../lib/i18n";
import { hasCurrentIntegrationProblem } from "../../lib/marketplace-account-health";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const marketplaceCatalog = {
  ru: [
    {
      key: "wildberries",
      name: "Wildberries",
      icon: "/images/icons/final/01-wildberries.avif",
      href: "/app/integrations/wildberries",
      description: "Отзывы и вопросы Wildberries в общей очереди с контекстом, подготовкой ответа и контролем отправки.",
    },
    {
      key: "ozon",
      name: "Ozon",
      icon: "/images/icons/final/02-ozon.avif",
      href: "/app/integrations/ozon",
      description: "Отзывы и вопросы Ozon: синхронизация, подготовка ответа и отправка через подключённый кабинет.",
    },
    {
      key: "yandex_market",
      name: "Яндекс Маркет",
      icon: "/images/icons/final/03-yandex-market.avif",
      href: "/app/integrations/yandex-market",
      description: "Отзывы и вопросы Яндекс Маркета с едиными статусами, очередью и безопасной отправкой ответов.",
    },
    {
      key: "avito",
      name: "Авито",
      icon: "/images/icons/final/04-avito.avif",
      href: "/app/integrations/avito",
      description: "Чаты и отзывы Авито в общей очереди MPReply: подготовка ответов и контроль отправки.",
    },
  ],
  en: [
    {
      key: "wildberries",
      name: "Wildberries",
      icon: "/images/icons/final/01-wildberries.avif",
      href: "/app/integrations/wildberries",
      description: "Bring Wildberries reviews and questions into the shared MPReply workflow with context and reply controls.",
    },
    {
      key: "ozon",
      name: "Ozon",
      icon: "/images/icons/final/02-ozon.avif",
      href: "/app/integrations/ozon",
      description: "Sync Ozon reviews and questions, prepare replies, and send them through the connected seller account.",
    },
    {
      key: "yandex_market",
      name: "Yandex Market",
      icon: "/images/icons/final/03-yandex-market.avif",
      href: "/app/integrations/yandex-market",
      description: "Sync Yandex Market reviews and questions with consistent status, queueing, and safe reply execution.",
    },
    {
      key: "avito",
      name: "Avito",
      icon: "/images/icons/final/04-avito.avif",
      href: "/app/integrations/avito",
      description: "Bring Avito chats and reviews into the shared MPReply queue, prepare replies, and send them back to buyers.",
    },
  ],
} satisfies Record<Locale, ReadonlyArray<{ key: "wildberries" | "ozon" | "yandex_market" | "avito"; name: string; icon: string; href: string; description: string }>>;

const integrationsCopy = {
  ru: {
    workspaceAria: "Интеграции маркетплейсов",
    summaryAria: "Сводка подключений",
    connected: "Подключённых кабинетов",
    healthy: "Работают нормально",
    attention: "Требуют внимания",
    refreshing: "Обновляем...",
    refresh: "Обновить подключения",
    loading: "Загружаем подключения",
    loadingDescription: "Проверяем подключённые кабинеты маркетплейсов.",
    loadError: "Не удалось загрузить подключения",
    unavailable: "Подключения временно недоступны. Попробуйте ещё раз.",
    retrying: "Повторяем...",
    retry: "Повторить",
    refreshError: "Не удалось обновить подключения",
    stale: "Показываем ранее загруженные данные. Можно продолжать работу или попробовать ещё раз.",
    manage: "Управлять",
    connect: "Подключить",
    open: "Открыть",
    available: "Подключение доступно",
    stateAttention: "Требует внимания",
    connectedLoadingAttention: "Подключён · загрузка требует внимания",
    incomplete: "Настройка не завершена",
    disconnected: "Не подключено",
    one: "подключение",
    few: "подключения",
    many: "подключений",
  },
  en: {
    workspaceAria: "Marketplace integrations",
    summaryAria: "Connection summary",
    connected: "Connected seller accounts",
    healthy: "Working normally",
    attention: "Need attention",
    refreshing: "Refreshing...",
    refresh: "Refresh connections",
    loading: "Loading connections",
    loadingDescription: "Checking connected marketplace seller accounts.",
    loadError: "Could not load connections",
    unavailable: "Marketplace connections are temporarily unavailable. Try again.",
    retrying: "Retrying...",
    retry: "Retry",
    refreshError: "Could not refresh connections",
    stale: "Showing previously loaded data. You can continue working or try refreshing again.",
    manage: "Manage",
    connect: "Connect",
    open: "Open",
    available: "Connection available",
    stateAttention: "Needs attention",
    connectedLoadingAttention: "Connected · loading needs attention",
    incomplete: "Setup incomplete",
    disconnected: "Not connected",
    one: "connection",
    few: "connections",
    many: "connections",
  },
} as const;

export function IntegrationsWorkspace() {
  const { activeOrganization, locale } = useWorkspace();
  const t = integrationsCopy[locale];
  const catalog = marketplaceCatalog[locale];
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
    <section className="integrations-workspace" aria-label={t.workspaceAria}>
      <div className="integrations-summary-grid" aria-label={t.summaryAria}>
        <SummaryMetric label={t.connected} value={accountsQuery.data ? String(accounts.length) : "—"} />
        <SummaryMetric label={t.healthy} value={accountsQuery.data ? String(activeCount) : "—"} />
        <SummaryMetric label={t.attention} value={accountsQuery.data ? String(problemCount) : "—"} />
      </div>

      <div className="integration-overview-actions">
        {accountsQuery.data ? (
          <button
            className="button button-secondary button-compact"
            disabled={accountsQuery.isFetching}
            onClick={() => void accountsQuery.refetch()}
            type="button"
          >
            {accountsQuery.isFetching ? t.refreshing : t.refresh}
          </button>
        ) : null}
      </div>

      {accountsQuery.isPending && !accountsQuery.data ? (
        <div className="integration-overview-state" aria-busy="true" aria-live="polite" role="status">
          <strong>{t.loading}</strong>
          <p>{t.loadingDescription}</p>
        </div>
      ) : accountsQuery.error && !accountsQuery.data ? (
        <div className="integration-overview-state integration-overview-state-error" role="alert">
          <strong>{t.loadError}</strong>
          <p>{t.unavailable}</p>
          <button
            className="button button-secondary button-compact"
            disabled={accountsQuery.isFetching}
            onClick={() => void accountsQuery.refetch()}
            type="button"
          >
            {accountsQuery.isFetching ? t.retrying : t.retry}
          </button>
        </div>
      ) : accountsQuery.data ? (
        <>
          {accountsQuery.error && accountsQuery.data ? (
            <div className="integration-refresh-error" role="alert">
              <div>
                <strong>{t.refreshError}</strong>
                <p>{t.stale}</p>
              </div>
              <button
                className="button button-secondary button-compact"
                disabled={accountsQuery.isFetching}
                onClick={() => void accountsQuery.refetch()}
                type="button"
              >
                {accountsQuery.isFetching ? t.retrying : t.retry}
              </button>
            </div>
          ) : null}

          <div className="integration-catalog-grid" role="list">
        {catalog.map((marketplace) => {
          const marketplaceAccounts = accounts.filter((account) => account.marketplace === marketplace.key);
          const connectedCount = marketplaceAccounts.length;
          const hasProblem = marketplaceAccounts.some(needsConnectionAttention);
          const hasActive = marketplaceAccounts.some(isHealthyConnection);
          const hasValidAccess = marketplaceAccounts.every((account) => account.status === "active" && account.credentials_status === "valid");
          const connectionState = getConnectionState({ connectedCount, hasActive, hasProblem, hasValidAccess }, locale);
          const actionLabel = canManage
            ? connectedCount > 0
              ? `${t.manage} ${marketplace.name}`
              : `${t.connect} ${marketplace.name}`
            : `${t.open} ${marketplace.name}`;

          return (
            <article className="integration-market-card" key={marketplace.key} role="listitem">
              <div className="integration-market-card-topline">
                <div className="integration-market-card-identity">
                  <Image
                    alt=""
                    className="integration-market-logo"
                    height={64}
                    src={marketplace.icon}
                    width={64}
                    unoptimized
                  />
                  <div className="integration-market-card-title">
                  <span className="ui-badge ui-badge-info">{t.available}</span>
                  <h2>{marketplace.name}</h2>
                  </div>
                </div>
                <span className={`ui-badge ui-badge-${connectionState.tone}`}>{connectionState.label}</span>
              </div>
              <p>{marketplace.description}</p>
              <Link className="button button-secondary" href={localizedPath(locale, marketplace.href)}>
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
  hasValidAccess,
}: {
  connectedCount: number;
  hasActive: boolean;
  hasProblem: boolean;
  hasValidAccess: boolean;
}, locale: Locale): { label: string; tone: "neutral" | "success" | "warning" } {
  const t = integrationsCopy[locale];
  if (hasProblem) {
    return { label: hasValidAccess ? t.connectedLoadingAttention : t.stateAttention, tone: "warning" };
  }
  if (hasActive) {
    return { label: `${connectedCount} ${accountWord(connectedCount, locale)}`, tone: "success" };
  }
  if (connectedCount > 0) {
    return { label: t.incomplete, tone: "warning" };
  }
  return { label: t.disconnected, tone: "neutral" };
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

function accountWord(value: number, locale: Locale): string {
  const t = integrationsCopy[locale];
  if (locale === "en") return value === 1 ? t.one : t.many;
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return t.one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return t.few;
  return t.many;
}
