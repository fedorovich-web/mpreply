"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ApiError, apiRequest, buildApiQuery } from "../../lib/api/client";
import {
  marketplaceAccountActionSchema,
  marketplaceAccountListSchema,
  marketplaceAccountOverviewSchema,
  marketplaceAccountSchema,
  marketplaceAccountValidateSchema,
  marketplaceSyncSchema,
  type MarketplaceAccount,
  type MarketplaceAccountOverview,
  type MarketplaceIntegrationEventSummary,
  type MarketplaceSyncJobSummary,
  type MarketplaceSyncState,
} from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

type ResponseMode = "inherit" | "auto" | "semi_auto";

type Notice = {
  tone: "success" | "warning";
  message: string;
};

export function YandexMarketIntegrationWorkspace() {
  const { activeOrganization } = useWorkspace();
  const canManage = activeOrganization.current_user_role === "owner" || activeOrganization.current_user_role === "admin";
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [credentials, setCredentials] = useState("");
  const [responseMode, setResponseMode] = useState<ResponseMode>("inherit");
  const [notice, setNotice] = useState<Notice | null>(null);

  const accountsQuery = useQuery({
    queryKey: ["marketplace-accounts", activeOrganization.id],
    queryFn: () =>
      apiRequest(
        buildApiQuery("/api/marketplace-accounts", { organization_id: activeOrganization.id }),
        marketplaceAccountListSchema,
      ),
  });

  const accounts = useMemo(
    () => (accountsQuery.data ?? []).filter((account) => account.marketplace === "yandex_market"),
    [accountsQuery.data],
  );
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null;

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/marketplace-accounts", marketplaceAccountSchema, {
        method: "POST",
        body: {
          organization_id: activeOrganization.id,
          marketplace: "yandex_market",
          display_name: displayName.trim(),
          credentials,
          seller_id: emptyToNull(sellerId),
          default_response_mode: responseMode,
        },
      }),
    onSuccess: async (account) => {
      setSelectedAccountId(account.id);
      setDisplayName("");
      setSellerId("");
      setCredentials("");
      setResponseMode("inherit");
      setNotice({ tone: "success", message: "Подключение создано. Перед синхронизацией проверьте API-ключ." });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-accounts", activeOrganization.id] });
    },
  });

  return (
    <section className="wildberries-workspace yandex-market-workspace" aria-label="Управление подключениями Яндекс Маркета">
      <div className="integration-security-strip" role="note">
        <strong>API-ключ хранится защищённо</strong>
        <span>После сохранения в кабинете видна только маска, а не исходный ключ.</span>
      </div>

      {!canManage ? (
        <div className="workspace-inline-state">
          <strong>Только просмотр</strong>
          <p>Роль {roleLabel(activeOrganization.current_user_role)} может видеть состояние подключений, но не управлять ключами и синхронизацией.</p>
        </div>
      ) : null}

      {notice ? (
        <p className={`integration-notice integration-notice-${notice.tone}`} aria-live="polite">
          {notice.message}
        </p>
      ) : null}

      <div className="wildberries-layout">
        <section className="integration-account-panel" aria-labelledby="ym-account-list-title">
          <div className="panel-heading panel-heading-row">
            <div>
              <strong id="ym-account-list-title">Кабинеты Яндекс Маркета</strong>
            </div>
            <span className="ui-badge">{accounts.length}</span>
          </div>

          {accountsQuery.isPending ? (
            <WorkspaceState title="Загружаем подключения" description="Получаем кабинеты текущей организации." />
          ) : accountsQuery.error ? (
            <WorkspaceState
              title="Не удалось загрузить подключения"
              description={errorMessage(accountsQuery.error)}
              actionLabel="Повторить"
              onAction={() => void accountsQuery.refetch()}
            />
          ) : accounts.length === 0 ? (
            <WorkspaceState
              title="Подключений пока нет"
              description={canManage ? "Создайте первый кабинет Яндекс Маркета в форме ниже." : "В этой организации ещё нет кабинетов Яндекс Маркета."}
            />
          ) : (
            <div className="integration-account-list" role="list">
              {accounts.map((account) => (
                <div key={account.id} role="listitem">
                  <button
                    aria-pressed={selectedAccount?.id === account.id}
                    className={`integration-account-button${selectedAccount?.id === account.id ? " integration-account-button-active" : ""}`}
                    onClick={() => setSelectedAccountId(account.id)}
                    type="button"
                  >
                    <span>
                      <strong>{account.display_name}</strong>
                      <small>{account.credentials_masked}</small>
                    </span>
                    <StatusBadge account={account} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {canManage ? (
            <form
              className="settings-form integration-create-form"
              aria-label="Новое подключение Яндекс Маркета"
              onSubmit={(event) => {
                event.preventDefault();
                if (
                  displayName.trim().length >= 2 &&
                  /^[1-9][0-9]*$/.test(sellerId.trim()) &&
                  credentials.length >= 8
                ) createMutation.mutate();
              }}
            >
              <div className="panel-heading">
                <strong>Добавить кабинет</strong>
              </div>
              <label>
                Название подключения
                <input
                  maxLength={255}
                  minLength={2}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Например, основной кабинет Маркета"
                  required
                  value={displayName}
                />
              </label>
              <label>
                Business ID
                <input
                  inputMode="numeric"
                  maxLength={20}
                  onChange={(event) => setSellerId(event.target.value)}
                  pattern="[1-9][0-9]*"
                  required
                  value={sellerId}
                />
              </label>
              <label>
                API-ключ Яндекс Маркета
                <input
                  autoComplete="off"
                  minLength={8}
                  onChange={(event) => setCredentials(event.target.value)}
                  required
                  type="password"
                  value={credentials}
                />
              </label>
              <label>
                Режим ответов
                <select onChange={(event) => setResponseMode(event.target.value as ResponseMode)} value={responseMode}>
                  <option value="inherit">Наследовать настройки организации</option>
                  <option value="auto">Автоматический</option>
                  <option value="semi_auto">С подтверждением</option>
                </select>
              </label>
              {createMutation.error ? <FormError error={createMutation.error} /> : null}
              <button
                className="button button-primary"
                disabled={
                  createMutation.isPending ||
                  displayName.trim().length < 2 ||
                  !/^[1-9][0-9]*$/.test(sellerId.trim()) ||
                  credentials.length < 8
                }
                type="submit"
              >
                {createMutation.isPending ? "Сохраняем..." : "Добавить кабинет"}
              </button>
            </form>
          ) : null}
        </section>

        <section className="integration-account-detail" aria-labelledby="ym-account-detail-title">
          {selectedAccount ? (
            <AccountDetail
              key={selectedAccount.id}
              account={selectedAccount}
              canManage={canManage}
              organizationId={activeOrganization.id}
              onNotice={setNotice}
            />
          ) : (
            <WorkspaceState
              title="Кабинет не выбран"
              description={accounts.length === 0 ? "После подключения здесь появятся состояние ключа, синхронизация и безопасные действия." : "Выберите кабинет слева."}
            />
          )}
        </section>
      </div>
    </section>
  );
}

function AccountDetail({
  account,
  canManage,
  organizationId,
  onNotice,
}: {
  account: MarketplaceAccount;
  canManage: boolean;
  organizationId: string;
  onNotice: (notice: Notice | null) => void;
}) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(account.display_name);
  const [sellerId, setSellerId] = useState(account.seller_id ?? "");
  const [responseMode, setResponseMode] = useState<ResponseMode>(normalizeResponseMode(account.default_response_mode));
  const [newCredentials, setNewCredentials] = useState("");
  const [localError, setLocalError] = useState<unknown>(null);
  const overviewQuery = useQuery({
    queryKey: ["marketplace-account-overview", account.id],
    queryFn: () =>
      apiRequest(
        buildApiQuery(`/api/marketplace-accounts/${account.id}/overview`, { jobs_limit: 10, events_limit: 20 }),
        marketplaceAccountOverviewSchema,
      ),
    staleTime: 15_000,
  });
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["marketplace-accounts", organizationId] }),
      queryClient.invalidateQueries({ queryKey: ["marketplace-account-overview", account.id] }),
    ]);
  };
  const latestJobFailed = overviewQuery.data?.recent_jobs[0]?.status === "failed";

  const updateMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}`, marketplaceAccountSchema, {
        method: "PATCH",
        body: {
          display_name: displayName.trim(),
          seller_id: emptyToNull(sellerId),
          default_response_mode: responseMode,
        },
      }),
    onSuccess: async () => {
      onNotice({ tone: "success", message: "Настройки кабинета обновлены." });
      await invalidate();
    },
  });

  const validateMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}/validate`, marketplaceAccountValidateSchema, { method: "POST" }),
    onSuccess: async (result) => {
      onNotice({
        tone: result.error_code ? "warning" : "success",
        message: result.error_message_safe ?? (result.error_code ? "Проверка завершилась с ошибкой." : "API-ключ успешно проверен."),
      });
      await invalidate();
    },
  });

  const syncMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}/sync`, marketplaceSyncSchema, { method: "POST" }),
    onSuccess: async (result) => {
      const imported = result.imported_reviews + result.imported_questions;
      const updated = result.updated_reviews + result.updated_questions;
      onNotice({
        tone: result.status === "success" ? "success" : "warning",
        message:
          result.error_message_safe ??
          `Синхронизация завершена: новых ${imported}, обновлено ${updated}, пропущено ${result.skipped}.`,
      });
      await invalidate();
    },
  });

  const rotateMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}/rotate-credentials`, marketplaceAccountActionSchema, {
        method: "POST",
        body: { credentials: newCredentials },
      }),
    onSuccess: async () => {
      setNewCredentials("");
      onNotice({ tone: "success", message: "Ключ заменён. Перед следующей синхронизацией выполните проверку." });
      await invalidate();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}/revoke-credentials`, marketplaceAccountActionSchema, { method: "POST" }),
    onSuccess: async () => {
      onNotice({ tone: "warning", message: "Ключ отозван, подключение отключено." });
      await invalidate();
    },
  });

  const busy = updateMutation.isPending || validateMutation.isPending || syncMutation.isPending || rotateMutation.isPending || revokeMutation.isPending;
  const mutationError = localError ?? updateMutation.error ?? validateMutation.error ?? syncMutation.error ?? rotateMutation.error ?? revokeMutation.error;

  return (
    <div className="integration-detail-stack">
      <div className="integration-detail-heading">
        <div>
          <h2 id="ym-account-detail-title">{account.display_name}</h2>
        </div>
        <StatusBadge account={account} />
      </div>

      {overviewQuery.isPending ? (
        <WorkspaceState title="Загружаем состояние интеграции" description="Получаем потоки, историю синхронизаций и последние события." />
      ) : overviewQuery.error ? (
        <WorkspaceState
          title="Не удалось загрузить состояние интеграции"
          description={errorMessage(overviewQuery.error)}
          actionLabel="Повторить"
          onAction={() => void overviewQuery.refetch()}
        />
      ) : overviewQuery.data ? (
        <AccountOverviewPanel overview={overviewQuery.data} />
      ) : null}

      {canManage ? (
        <>
          <form
            className="settings-form integration-detail-form"
            aria-label="Настройки кабинета Яндекс Маркета"
            onSubmit={(event) => {
              event.preventDefault();
              setLocalError(null);
              if (displayName.trim().length >= 2 && /^[1-9][0-9]*$/.test(sellerId.trim())) {
                updateMutation.mutate();
              }
            }}
          >
            <div className="panel-heading">
              <strong>Настройки кабинета</strong>
            </div>
            <label>
              Название
              <input maxLength={255} minLength={2} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
            </label>
            <label>
              Business ID
              <input
                inputMode="numeric"
                maxLength={20}
                onChange={(event) => setSellerId(event.target.value)}
                pattern="[1-9][0-9]*"
                required
                value={sellerId}
              />
            </label>
            <label>
              Режим ответов
              <select onChange={(event) => setResponseMode(event.target.value as ResponseMode)} value={responseMode}>
                <option value="inherit">Наследовать настройки организации</option>
                <option value="auto">Автоматический</option>
                <option value="semi_auto">С подтверждением</option>
              </select>
            </label>
            <button
              className="button button-secondary"
              disabled={busy || displayName.trim().length < 2 || !/^[1-9][0-9]*$/.test(sellerId.trim())}
              type="submit"
            >
              {updateMutation.isPending ? "Сохраняем..." : "Сохранить настройки"}
            </button>
          </form>

          <div className="integration-action-grid" aria-label="Действия с подключением">
            <button className="button button-primary" disabled={busy || account.credentials_status === "revoked"} onClick={() => validateMutation.mutate()} type="button">
              {validateMutation.isPending ? "Проверяем..." : "Проверить ключ"}
            </button>
            <button className="button button-secondary" disabled={busy || account.credentials_status !== "valid"} onClick={() => syncMutation.mutate()} type="button">
              {syncMutation.isPending ? "Синхронизируем..." : latestJobFailed ? "Повторить синхронизацию" : "Синхронизировать сейчас"}
            </button>
          </div>

          <form
            className="settings-form integration-rotate-form"
            aria-label="Замена API-ключа Яндекс Маркета"
            onSubmit={(event) => {
              event.preventDefault();
              setLocalError(null);
              if (newCredentials.length >= 8) rotateMutation.mutate();
            }}
          >
            <div className="panel-heading">
              <strong>Заменить API-ключ</strong>
            </div>
            <label>
              Новый API-ключ
              <input autoComplete="off" minLength={8} onChange={(event) => setNewCredentials(event.target.value)} required type="password" value={newCredentials} />
            </label>
            <button className="button button-secondary" disabled={busy || newCredentials.length < 8} type="submit">
              {rotateMutation.isPending ? "Заменяем..." : "Заменить ключ"}
            </button>
          </form>

          <div className="integration-danger-zone">
            <div>
              <strong>Отозвать ключ</strong>
              <p>Подключение будет отключено. Исходный ключ не возвращается и не показывается.</p>
            </div>
            <button
              className="button button-danger"
              disabled={busy || account.credentials_status === "revoked"}
              onClick={() => {
                setLocalError(null);
                if (window.confirm("Отозвать API-ключ и отключить это подключение?")) revokeMutation.mutate();
              }}
              type="button"
            >
              {revokeMutation.isPending ? "Отзываем..." : "Отозвать ключ"}
            </button>
          </div>

          {mutationError ? <FormError error={mutationError} /> : null}
        </>
      ) : (
        <div className="workspace-inline-state">
          <strong>Управление недоступно для этой роли</strong>
          <p>Текущая роль позволяет просматривать состояние, но не менять настройки подключения.</p>
        </div>
      )}
    </div>
  );
}

function AccountOverviewPanel({ overview }: { overview: MarketplaceAccountOverview }) {
  const nextRunAt = earliestDateTime(overview.sync_states.map((state) => state.next_run_at));

  return (
    <div className="integration-overview-stack">
      <section className={`integration-health-banner integration-health-banner-${overview.health_status}`} aria-labelledby="ym-health-section-title">
        <div>
          <h3 id="ym-health-section-title">Состояние подключения</h3>
          <h4 id="ym-health-title">{healthStatusLabel(overview.health_status)}</h4>
        </div>
        <ul>
          {overview.health_reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      </section>

      <dl className="integration-health-grid">
        <HealthItem label="Ключ" value={credentialsStatusLabel(overview.account.credentials_status)} />
        <HealthItem label="Маска" value={overview.account.credentials_masked} />
        <HealthItem label="Последняя успешная синхронизация" value={formatDateTime(overview.account.last_success_sync_at)} />
        <HealthItem label="Последняя ошибка" value={formatDateTime(overview.account.last_error_sync_at)} />
        <HealthItem label="Следующий плановый запуск" value={formatDateTime(nextRunAt)} />
        <HealthItem label="Накоплено ошибок" value={String(overview.account.error_count)} />
      </dl>

      <ScopesPanel scopes={overview.scopes} />
      <SyncStreamsPanel states={overview.sync_states} />
      <SyncJobsPanel jobs={overview.recent_jobs} />
      <IntegrationEventsPanel events={overview.recent_events} />
    </div>
  );
}

function ScopesPanel({ scopes }: { scopes: string[] }) {
  return (
    <section className="integration-observability-panel" aria-labelledby="ym-scopes-title">
      <div className="panel-heading panel-heading-row">
        <div>
          <h3 id="ym-scopes-title">Права</h3>
          <span>Разрешения API-ключа</span>
        </div>
        <span className="ui-badge">{scopes.length}</span>
      </div>
      {scopes.length > 0 ? (
        <div className="integration-scope-list" role="list">
          {scopes.map((scope) => (
            <span className="ui-badge ui-badge-neutral" key={scope} role="listitem">
              {scopeLabel(scope)}
            </span>
          ))}
        </div>
      ) : (
        <p className="integration-empty-copy">Разрешения появятся после успешной проверки API-ключа.</p>
      )}
    </section>
  );
}

function SyncStreamsPanel({ states }: { states: MarketplaceSyncState[] }) {
  return (
    <section className="integration-observability-panel" aria-labelledby="ym-streams-title">
      <div className="panel-heading panel-heading-row">
        <div>
          <h3 id="ym-streams-title">Синхронизация</h3>
          <span>Состояние потоков</span>
        </div>
        <span className="ui-badge">{states.length}</span>
      </div>
      {states.length > 0 ? (
        <div className="integration-stream-list">
          {states.map((state) => (
            <article className="integration-stream-card" key={state.id}>
              <div className="integration-history-heading">
                <strong>{streamLabel(state.stream)}</strong>
                <span className={`ui-badge ${statusTone(state.status)}`}>{streamStatusLabel(state.status)}</span>
              </div>
              <dl className="integration-compact-meta">
                <HealthItem label="Последний успех" value={formatDateTime(state.last_success_at)} />
                <HealthItem label="Последняя ошибка" value={formatDateTime(state.last_error_at)} />
                <HealthItem label="Следующий запуск" value={formatDateTime(state.next_run_at)} />
                <HealthItem label="Ошибок подряд" value={String(state.consecutive_failures)} />
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <p className="integration-empty-copy">Потоки будут созданы после успешной проверки подключения.</p>
      )}
    </section>
  );
}

function SyncJobsPanel({ jobs }: { jobs: MarketplaceSyncJobSummary[] }) {
  return (
    <section className="integration-observability-panel" aria-labelledby="ym-sync-history-title">
      <div className="panel-heading panel-heading-row">
        <div>
          <strong id="ym-sync-history-title">История синхронизаций</strong>
        </div>
        <span className="ui-badge">{jobs.length}</span>
      </div>
      {jobs.length > 0 ? (
        <ol className="integration-history-list">
          {jobs.map((job) => (
            <li key={job.id}>
              <div className="integration-history-heading">
                <strong>{syncJobLabel(job.job_type)}</strong>
                <span className={`ui-badge ${statusTone(job.status)}`}>{jobStatusLabel(job.status)}</span>
              </div>
              <p>{formatSyncStats(job.stats)}</p>
              {job.error_message_safe ? <p className="integration-error-copy">{job.error_message_safe}</p> : null}
              <time dateTime={job.finished_at ?? job.created_at}>{formatDateTime(job.finished_at ?? job.created_at)}</time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="integration-empty-copy">Ручных синхронизаций ещё не было.</p>
      )}
    </section>
  );
}

function IntegrationEventsPanel({ events }: { events: MarketplaceIntegrationEventSummary[] }) {
  return (
    <section className="integration-observability-panel" aria-labelledby="ym-events-title">
      <div className="panel-heading panel-heading-row">
        <div>
          <strong id="ym-events-title">События интеграции</strong>
        </div>
        <span className="ui-badge">{events.length}</span>
      </div>
      {events.length > 0 ? (
        <ol className="integration-history-list">
          {events.map((event) => (
            <li key={event.id}>
              <div className="integration-history-heading">
                <strong>{eventTypeLabel(event.event_type)}</strong>
                <span className={`ui-badge ${statusTone(event.status)}`}>{jobStatusLabel(event.status)}</span>
              </div>
              {event.error_message_safe ? (
                <p className="integration-error-copy">{friendlyIntegrationError(event.error_code, event.error_message_safe)}</p>
              ) : (
                <p>{formatEventDetails(event.details)}</p>
              )}
              {event.error_code ? <code>{event.error_code}</code> : null}
              <time dateTime={event.created_at}>{formatDateTime(event.created_at)}</time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="integration-empty-copy">События появятся после проверки ключа или синхронизации.</p>
      )}
    </section>
  );
}

function StatusBadge({ account }: { account: MarketplaceAccount }) {
  const tone = account.status === "active" && account.credentials_status === "valid"
    ? "ui-badge-success"
    : account.status === "error" || account.credentials_status === "revoked"
      ? "ui-badge-danger"
      : "ui-badge-warning";
  return <span className={`ui-badge ${tone}`}>{accountStatusLabel(account)}</span>;
}

function HealthItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function WorkspaceState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="workspace-inline-state" aria-live="polite">
      <strong>{title}</strong>
      <p>{description}</p>
      {actionLabel && onAction ? (
        <button className="button button-secondary button-compact" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function FormError({ error }: { error: unknown }) {
  return <p className="form-error" role="alert">{errorMessage(error)}</p>;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.requestId ? `${error.message} · requestId ${error.requestId}` : error.message;
  }
  return error instanceof Error ? error.message : "Неизвестная ошибка";
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeResponseMode(value: string): ResponseMode {
  return value === "auto" || value === "semi_auto" ? value : "inherit";
}

function accountStatusLabel(account: MarketplaceAccount): string {
  if (account.credentials_status === "revoked") return "Ключ отозван";
  if (account.status === "active" && account.credentials_status === "valid") return "Активно";
  if (account.status === "error") return "Ошибка";
  if (account.status === "disabled") return "Отключено";
  return "Нужна проверка";
}

function credentialsStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    valid: "Проверен",
    pending_validation: "Ожидает проверки",
    revoked: "Отозван",
    invalid: "Недействителен",
  };
  return labels[value] ?? value;
}

function earliestDateTime(values: Array<string | null>): string | null {
  let earliest: { value: string; timestamp: number } | null = null;
  for (const value of values) {
    if (!value) continue;
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) continue;
    if (!earliest || timestamp < earliest.timestamp) earliest = { value, timestamp };
  }
  return earliest?.value ?? null;
}

function formatDateTime(value: string | null): string {
  if (!value) return "Ещё не было";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function healthStatusLabel(value: MarketplaceAccountOverview["health_status"]): string {
  const labels: Record<MarketplaceAccountOverview["health_status"], string> = {
    healthy: "Подключение работает",
    attention: "Требуется внимание",
    error: "Есть ошибки",
    disabled: "Подключение отключено",
  };
  return labels[value];
}

function scopeLabel(value: string): string {
  const labels: Record<string, string> = {
    ALL_METHODS: "Все методы",
    ALL_METHODS_READ_ONLY: "Все методы · только чтение",
    COMMUNICATION: "Общение с покупателями",
  };
  return labels[value] ?? value;
}

function streamLabel(value: string): string {
  const labels: Record<string, string> = {
    reviews: "Отзывы",
    questions: "Вопросы",
  };
  return labels[value] ?? value;
}

function streamStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    idle: "Ожидает запуска",
    leased: "Выполняется",
    error: "Ошибка",
    paused: "Приостановлен",
  };
  return labels[value] ?? value;
}

function jobStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    success: "Успешно",
    failed: "Ошибка",
    running: "Выполняется",
    idle: "Ожидает запуска",
    leased: "Выполняется",
    error: "Ошибка",
    paused: "Приостановлен",
  };
  return labels[value] ?? value;
}

function statusTone(value: string): string {
  if (value === "success" || value === "idle") return "ui-badge-success";
  if (value === "failed" || value === "error") return "ui-badge-danger";
  return "ui-badge-warning";
}

function syncJobLabel(value: string): string {
  return value === "manual_sync" ? "Ручная синхронизация" : value;
}

function eventTypeLabel(value: string): string {
  const labels: Record<string, string> = {
    "credentials.validate": "Проверка API-ключа",
    "sync.feedbacks": "Синхронизация отзывов",
    "sync.questions": "Синхронизация вопросов",
    "sync.unhandled_error": "Системная ошибка синхронизации",
  };
  return labels[value] ?? value;
}

function formatSyncStats(stats: Record<string, number>): string {
  const labels: Record<string, string> = {
    imported_reviews: "новых отзывов",
    imported_questions: "новых вопросов",
    updated_reviews: "обновлено отзывов",
    updated_questions: "обновлено вопросов",
    skipped: "пропущено",
  };
  const parts = Object.entries(stats)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${labels[key] ?? key}: ${value}`);
  return parts.length > 0 ? parts.join(" · ") : "Изменений нет";
}

function formatEventDetails(details: Record<string, unknown>): string {
  const parts = Object.entries(details)
    .filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    .slice(0, 4)
    .map(([key, value]) => `${eventDetailLabel(key)}: ${String(value)}`);
  return parts.length > 0 ? parts.join(" · ") : "Событие зарегистрировано без дополнительных данных.";
}

function eventDetailLabel(value: string): string {
  const labels: Record<string, string> = {
    count: "обработано",
    pages_processed: "страниц",
    error_type: "тип ошибки",
    credentials_status: "состояние ключа",
  };
  return labels[value] ?? value;
}

function friendlyIntegrationError(code: string | null, fallback: string): string {
  const labels: Record<string, string> = {
    invalid_credentials: "API-ключ отклонён. Проверьте ключ и его разрешения.",
    insufficient_scope: "API-ключу не хватает разрешения «Общение с покупателями».",
    rate_limited: "Яндекс Маркет временно ограничил частоту запросов. Повторите синхронизацию позже.",
    sync_cursor_cycle: "Маркет вернул повторяющийся курсор. Синхронизация безопасно остановлена.",
    sync_page_limit_exceeded: "Синхронизация достигла защитного лимита страниц и была остановлена.",
    sync_unhandled_error: "Во время синхронизации произошла внутренняя ошибка. Повторите операцию или передайте requestId поддержке.",
  };
  return code ? labels[code] ?? fallback : fallback;
}

function roleLabel(value: string): string {
  const labels: Record<string, string> = {
    owner: "владельца",
    admin: "администратора",
    manager: "менеджера",
    viewer: "наблюдателя",
  };
  return labels[value] ?? value;
}
