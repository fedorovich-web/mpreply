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

export function AvitoIntegrationWorkspace() {
  const { activeOrganization } = useWorkspace();
  const queryClient = useQueryClient();
  const canManage = activeOrganization.current_user_role === "owner" || activeOrganization.current_user_role === "admin";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [userId, setUserId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [responseMode, setResponseMode] = useState<ResponseMode>("inherit");
  const [notice, setNotice] = useState<string | null>(null);

  const accountsQuery = useQuery({
    queryKey: ["marketplace-accounts", activeOrganization.id],
    queryFn: () =>
      apiRequest(
        buildApiQuery("/api/marketplace-accounts", { organization_id: activeOrganization.id }),
        marketplaceAccountListSchema,
      ),
  });
  const accounts = useMemo(
    () => (accountsQuery.data ?? []).filter((candidate) => candidate.marketplace === "avito"),
    [accountsQuery.data],
  );

  const selectedAccount = accounts.find((candidate) => candidate.id === selectedId) ?? accounts[0] ?? null;
  const effectiveSelectedId = selectedAccount?.id ?? null;

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/marketplace-accounts", marketplaceAccountSchema, {
        method: "POST",
        body: {
          organization_id: activeOrganization.id,
          marketplace: "avito",
          display_name: displayName.trim(),
          seller_id: userId.trim(),
          credentials: encodeAvitoClientCredentials(clientId, clientSecret),
          default_response_mode: responseMode,
        },
      }),
    onSuccess: (created) => {
      setSelectedId(created.id);
      setUserId("");
      setClientId("");
      setClientSecret("");
      setNotice("Подключение создано. Перед синхронизацией проверьте данные Авито.");
      return queryClient.invalidateQueries({ queryKey: ["marketplace-accounts", activeOrganization.id] });
    },
  });

  const validUserId = /^[1-9][0-9]*$/.test(userId.trim());
  const canSubmit =
    displayName.trim().length >= 2 && validUserId && clientId.trim().length > 0 && clientSecret.trim().length > 0;

  return (
    <section className="wildberries-workspace avito-workspace" aria-label="Подключения Авито">
      <div className="integration-security-strip" role="note">
        <strong>Данные доступа хранятся защищённо</strong>
        <span>После сохранения в кабинете видна только маска, а не Client ID, Client Secret или ID пользователя.</span>
      </div>

      {!canManage ? (
        <div className="workspace-inline-state">
          <strong>Только просмотр</strong>
          <p>Изменять подключения могут владелец и администратор организации.</p>
        </div>
      ) : null}

      {notice ? <p className="integration-notice integration-notice-success" role="status">{notice}</p> : null}

      <div className="wildberries-layout">
        <section className="integration-account-panel" aria-labelledby="avito-account-list-title">
          <div className="panel-heading panel-heading-row">
            <strong id="avito-account-list-title">Кабинеты Авито</strong>
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
            <WorkspaceState title="Подключений пока нет" description="После подключения здесь появятся состояние и безопасные действия." />
          ) : (
            <div className="integration-account-list" role="list">
              {accounts.map((candidate) => (
                <div key={candidate.id} role="listitem">
                  <button
                    aria-pressed={candidate.id === effectiveSelectedId}
                    className={`integration-account-button${candidate.id === effectiveSelectedId ? " integration-account-button-active" : ""}`}
                    onClick={() => setSelectedId(candidate.id)}
                    type="button"
                  >
                    <span>
                      <strong>{candidate.display_name}</strong>
                      <small>{candidate.credentials_masked}</small>
                    </span>
                    <span className={`ui-badge ${accountStatusTone(candidate)}`}>{accountStatusLabel(candidate)}</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {canManage ? (
            <form
              aria-label="Новое подключение Авито"
              className="settings-form integration-create-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (canSubmit) createMutation.mutate();
              }}
            >
              <div className="panel-heading"><strong>Добавить кабинет</strong></div>
              <label>
                Название подключения
                <input maxLength={255} minLength={2} onChange={(event) => setDisplayName(event.target.value)} placeholder="Например, основной кабинет Авито" required value={displayName} />
              </label>
              <label>
                ID пользователя Авито
                <input inputMode="numeric" maxLength={255} onChange={(event) => setUserId(event.target.value)} pattern="[1-9][0-9]*" placeholder="Числовой ID пользователя" required value={userId} />
              </label>
              <label>
                Client ID
                <input autoComplete="off" onChange={(event) => setClientId(event.target.value)} required type="password" value={clientId} />
              </label>
              <label>
                Client Secret
                <input autoComplete="new-password" onChange={(event) => setClientSecret(event.target.value)} required type="password" value={clientSecret} />
              </label>
              <label>
                Режим ответов
                <select onChange={(event) => setResponseMode(event.target.value as ResponseMode)} value={responseMode}>
                  <option value="inherit">Наследовать настройки организации</option>
                  <option value="auto">Автоматический</option>
                  <option value="semi_auto">С подтверждением</option>
                </select>
              </label>
              {createMutation.error ? <p className="form-error" role="alert">{errorMessage(createMutation.error)}</p> : null}
              <button className="button button-primary" disabled={!canSubmit || createMutation.isPending} type="submit">
                {createMutation.isPending ? "Добавляем…" : "Добавить кабинет"}
              </button>
            </form>
          ) : null}
        </section>

        <section className="integration-account-detail" aria-labelledby="avito-account-detail-title">
          {selectedAccount ? (
            <AvitoAccountDetail
              account={selectedAccount}
              canManage={canManage}
              key={selectedAccount.id}
              onNotice={setNotice}
              organizationId={activeOrganization.id}
            />
          ) : (
            <WorkspaceState title="Кабинет не выбран" description="Выберите кабинет слева или создайте новое подключение." />
          )}
        </section>
      </div>
    </section>
  );
}

function AvitoAccountDetail({
  account,
  canManage,
  onNotice,
  organizationId,
}: {
  account: MarketplaceAccount;
  canManage: boolean;
  onNotice: (notice: string | null) => void;
  organizationId: string;
}) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(account.display_name);
  const [responseMode, setResponseMode] = useState<ResponseMode>(normalizeResponseMode(account.default_response_mode));
  const [replacementUserId, setReplacementUserId] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [newClientSecret, setNewClientSecret] = useState("");
  const overviewQuery = useQuery({
    queryKey: ["marketplace-account-overview", account.id],
    queryFn: () =>
      apiRequest(
        buildApiQuery(`/api/marketplace-accounts/${account.id}/overview`, { jobs_limit: 10, events_limit: 20 }),
        marketplaceAccountOverviewSchema,
      ),
    staleTime: 15_000,
  });
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["marketplace-accounts", organizationId] }),
      queryClient.invalidateQueries({ queryKey: ["marketplace-account-overview", account.id] }),
    ]);
  const latestJobFailed = overviewQuery.data?.recent_jobs[0]?.status === "failed";

  const updateMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}`, marketplaceAccountSchema, {
        method: "PATCH",
        body: { display_name: displayName.trim(), default_response_mode: responseMode },
      }),
    onSuccess: () => {
      onNotice("Настройки кабинета обновлены.");
      return invalidate();
    },
  });
  const replaceUserIdMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}`, marketplaceAccountSchema, {
        method: "PATCH",
        body: { seller_id: replacementUserId.trim() },
      }),
    onSuccess: () => {
      setReplacementUserId("");
      onNotice("ID пользователя заменён. Перед синхронизацией повторно проверьте подключение.");
      return invalidate();
    },
  });
  const validateMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}/validate`, marketplaceAccountValidateSchema, { method: "POST" }),
    onSuccess: (result) => {
      onNotice(
        result.error_code
          ? friendlyAvitoError(result.error_code)
          : "Данные подключения успешно проверены.",
      );
      return invalidate();
    },
  });
  const syncMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}/sync`, marketplaceSyncSchema, { method: "POST" }),
    onSuccess: (result) => {
      onNotice(result.error_code ? friendlyAvitoError(result.error_code) : "Синхронизация чатов завершена.");
      return invalidate();
    },
  });
  const rotateMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}/rotate-credentials`, marketplaceAccountActionSchema, {
        method: "POST",
        body: { credentials: encodeAvitoClientCredentials(newClientId, newClientSecret) },
      }),
    onSuccess: () => {
      setNewClientId("");
      setNewClientSecret("");
      onNotice("Данные доступа заменены. Перед синхронизацией повторно проверьте подключение.");
      return invalidate();
    },
  });
  const revokeMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}/revoke-credentials`, marketplaceAccountActionSchema, { method: "POST" }),
    onSuccess: () => {
      onNotice("Доступ отозван, подключение отключено.");
      return invalidate();
    },
  });
  const busy =
    updateMutation.isPending ||
    replaceUserIdMutation.isPending ||
    validateMutation.isPending ||
    syncMutation.isPending ||
    rotateMutation.isPending ||
    revokeMutation.isPending;
  const mutationError =
    updateMutation.error ??
    replaceUserIdMutation.error ??
    validateMutation.error ??
    syncMutation.error ??
    rotateMutation.error ??
    revokeMutation.error;
  const validReplacementUserId = /^[1-9][0-9]*$/.test(replacementUserId.trim());
  const validRotation = newClientId.trim().length > 0 && newClientSecret.trim().length > 0;

  return (
    <div className="integration-detail-stack">
      <div className="integration-detail-heading">
        <div>
          <h2 id="avito-account-detail-title">{account.display_name}</h2>
        </div>
        <span className={`ui-badge ${accountStatusTone(account)}`}>{accountStatusLabel(account)}</span>
      </div>
      <p className="integration-empty-copy">
        ID пользователя Авито хранится защищённо и не отображается. При необходимости замените его отдельной операцией.
      </p>

      {overviewQuery.isPending ? (
        <WorkspaceState title="Загружаем состояние интеграции" description="Получаем состояние чатов и историю операций." />
      ) : overviewQuery.error ? (
        <WorkspaceState
          title="Не удалось загрузить состояние интеграции"
          description={errorMessage(overviewQuery.error)}
          actionLabel="Повторить"
          onAction={() => void overviewQuery.refetch()}
        />
      ) : overviewQuery.data ? (
        <AvitoOverviewPanel overview={overviewQuery.data} />
      ) : null}

      {canManage ? (
        <>
          <form
            aria-label="Настройки кабинета Авито"
            className="settings-form integration-detail-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (displayName.trim().length >= 2) updateMutation.mutate();
            }}
          >
            <div className="panel-heading"><strong>Настройки кабинета</strong></div>
            <label>
              Название
              <input maxLength={255} minLength={2} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
            </label>
            <label>
              Режим ответов
              <select onChange={(event) => setResponseMode(event.target.value as ResponseMode)} value={responseMode}>
                <option value="inherit">Наследовать настройки организации</option>
                <option value="auto">Автоматический</option>
                <option value="semi_auto">С подтверждением</option>
              </select>
            </label>
            <button className="button button-secondary" disabled={busy || displayName.trim().length < 2} type="submit">
              {updateMutation.isPending ? "Сохраняем…" : "Сохранить настройки"}
            </button>
          </form>

          <form
            aria-label="Замена ID пользователя Авито"
            className="settings-form integration-rotate-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (validReplacementUserId) replaceUserIdMutation.mutate();
            }}
          >
            <div className="panel-heading"><strong>Заменить ID пользователя</strong></div>
            <label>
              Новый ID пользователя Авито
              <input
                autoComplete="off"
                inputMode="numeric"
                maxLength={255}
                onChange={(event) => setReplacementUserId(event.target.value)}
                pattern="[1-9][0-9]*"
                required
                value={replacementUserId}
              />
            </label>
            <button className="button button-secondary" disabled={busy || !validReplacementUserId} type="submit">
              {replaceUserIdMutation.isPending ? "Заменяем…" : "Заменить ID"}
            </button>
          </form>

          <div className="integration-action-grid" aria-label="Действия с подключением">
            <button
              className="button button-primary"
              disabled={busy || account.credentials_status === "revoked"}
              onClick={() => validateMutation.mutate()}
              type="button"
            >
              {validateMutation.isPending ? "Проверяем…" : "Проверить подключение"}
            </button>
            <button
              className="button button-secondary"
              disabled={busy || account.credentials_status !== "valid"}
              onClick={() => syncMutation.mutate()}
              type="button"
            >
              {syncMutation.isPending ? "Синхронизируем…" : latestJobFailed ? "Повторить синхронизацию" : "Синхронизировать сейчас"}
            </button>
          </div>

          <form
            aria-label="Замена данных доступа Авито"
            className="settings-form integration-rotate-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (validRotation) rotateMutation.mutate();
            }}
          >
            <div className="panel-heading"><strong>Заменить данные доступа</strong></div>
            <label>
              Новый Client ID
              <input autoComplete="off" onChange={(event) => setNewClientId(event.target.value)} required type="password" value={newClientId} />
            </label>
            <label>
              Новый Client Secret
              <input autoComplete="new-password" onChange={(event) => setNewClientSecret(event.target.value)} required type="password" value={newClientSecret} />
            </label>
            <button className="button button-secondary" disabled={busy || !validRotation} type="submit">
              {rotateMutation.isPending ? "Заменяем…" : "Заменить данные доступа"}
            </button>
          </form>

          <div className="integration-danger-zone">
            <div>
              <strong>Отозвать доступ</strong>
              <p>Подключение будет отключено. Исходные данные доступа не возвращаются и не показываются.</p>
            </div>
            <button
              className="button button-danger"
              disabled={busy || account.credentials_status === "revoked"}
              onClick={() => {
                if (window.confirm("Отозвать данные доступа и отключить это подключение?")) revokeMutation.mutate();
              }}
              type="button"
            >
              {revokeMutation.isPending ? "Отзываем…" : "Отозвать доступ"}
            </button>
          </div>
          {mutationError ? <p className="form-error" role="alert">{errorMessage(mutationError)}</p> : null}
        </>
      ) : null}
    </div>
  );
}

function AvitoOverviewPanel({ overview }: { overview: MarketplaceAccountOverview }) {
  const authentication = safeMetadataString(overview.account.scopes_json, "authentication");
  const authenticationLabel = authentication === "client_credentials"
    ? "Client ID и Client Secret"
    : authentication === "access_token"
      ? "Старое подключение по access token"
      : "Не определён";
  const nextRunAt = earliestDateTime(overview.sync_states.map((state) => state.next_run_at));

  return (
    <div className="integration-overview-stack">
      <section className={`integration-health-banner integration-health-banner-${overview.health_status}`} aria-labelledby="avito-health-title">
        <div>
          <h3 id="avito-health-title">Состояние подключения</h3>
          <h4>{healthStatusLabel(overview.health_status)}</h4>
        </div>
        <ul>{overview.health_reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      </section>
      <dl className="integration-health-grid">
        <HealthItem label="Доступ" value={credentialsStatusLabel(overview.account.credentials_status)} />
        <HealthItem label="Маска" value={overview.account.credentials_masked} />
        <HealthItem label="Способ авторизации" value={authenticationLabel} />
        <HealthItem label="Последняя успешная синхронизация" value={formatDateTime(overview.account.last_success_sync_at)} />
        <HealthItem label="Последняя ошибка" value={formatDateTime(overview.account.last_error_sync_at)} />
        <HealthItem label="Следующий плановый запуск" value={formatDateTime(nextRunAt)} />
      </dl>
      <AvitoScopesPanel isValidated={overview.account.scopes_json.validated === true} scopes={overview.scopes} />
      <SyncStreamsPanel states={overview.sync_states} />
      <SyncJobsPanel jobs={overview.recent_jobs} />
      <IntegrationEventsPanel events={overview.recent_events} />
    </div>
  );
}

function AvitoScopesPanel({ isValidated, scopes }: { isValidated: boolean; scopes: string[] }) {
  const hasChatAccess = scopes.includes("fetch_chats");
  return (
    <section className="integration-observability-panel" aria-labelledby="avito-scopes-title">
      <div className="panel-heading panel-heading-row">
        <div><h3 id="avito-scopes-title">Доступ</h3><span>Разрешения Messenger</span></div>
        <span className="ui-badge">{hasChatAccess ? 1 : 0}</span>
      </div>
      {hasChatAccess ? (
        <div className="integration-scope-list" role="list">
          <span className="ui-badge ui-badge-neutral" role="listitem">Доступ к чатам</span>
        </div>
      ) : (
        <p className="integration-empty-copy">
          {isValidated ? "Проверка завершена, но доступ к чатам не подтверждён." : "Доступ появится после успешной проверки подключения."}
        </p>
      )}
    </section>
  );
}

function SyncStreamsPanel({ states }: { states: MarketplaceSyncState[] }) {
  return (
    <section className="integration-observability-panel" aria-labelledby="avito-streams-title">
      <div className="panel-heading panel-heading-row">
        <div><h3 id="avito-streams-title">Синхронизация</h3><span>Состояние потоков</span></div>
        <span className="ui-badge">{states.length}</span>
      </div>
      {states.length > 0 ? (
        <div className="integration-stream-list">
          {states.map((state) => (
            <article className="integration-stream-card" key={state.id}>
              <div className="integration-history-heading">
                <strong>{state.stream === "chats" ? "Синхронизация чатов" : state.stream}</strong>
                <span className={`ui-badge ${statusTone(state.status)}`}>{jobStatusLabel(state.status)}</span>
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
      ) : <p className="integration-empty-copy">Поток чатов появится после успешной проверки подключения.</p>}
    </section>
  );
}

function SyncJobsPanel({ jobs }: { jobs: MarketplaceSyncJobSummary[] }) {
  return (
    <section className="integration-observability-panel" aria-labelledby="avito-jobs-title">
      <div className="panel-heading panel-heading-row">
        <strong id="avito-jobs-title">История синхронизаций</strong>
        <span className="ui-badge">{jobs.length}</span>
      </div>
      {jobs.length > 0 ? (
        <ol className="integration-history-list">
          {jobs.map((job) => (
            <li key={job.id}>
              <div className="integration-history-heading">
                <strong>{job.job_type === "manual_sync" ? "Ручная синхронизация" : job.job_type}</strong>
                <span className={`ui-badge ${statusTone(job.status)}`}>{jobStatusLabel(job.status)}</span>
              </div>
              <p>{formatSyncStats(job.stats)}</p>
              {job.error_message_safe ? <p className="integration-error-copy">{job.error_message_safe}</p> : null}
              <time dateTime={job.finished_at ?? job.created_at}>{formatDateTime(job.finished_at ?? job.created_at)}</time>
            </li>
          ))}
        </ol>
      ) : <p className="integration-empty-copy">Ручных синхронизаций ещё не было.</p>}
    </section>
  );
}

function IntegrationEventsPanel({ events }: { events: MarketplaceIntegrationEventSummary[] }) {
  return (
    <section className="integration-observability-panel" aria-labelledby="avito-events-title">
      <div className="panel-heading panel-heading-row">
        <strong id="avito-events-title">События интеграции</strong>
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
              {event.error_code ? (
                <p className="integration-error-copy">{friendlyAvitoError(event.error_code)}</p>
              ) : event.status === "failed" && event.error_message_safe ? (
                <p className="integration-error-copy">{event.error_message_safe}</p>
              ) : (
                <p>{formatEventDetails(event.details)}</p>
              )}
              <time dateTime={event.created_at}>{formatDateTime(event.created_at)}</time>
            </li>
          ))}
        </ol>
      ) : <p className="integration-empty-copy">События появятся после проверки или синхронизации.</p>}
    </section>
  );
}

function HealthItem({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
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
      {actionLabel && onAction ? <button className="button button-secondary button-compact" onClick={onAction} type="button">{actionLabel}</button> : null}
    </div>
  );
}

function encodeAvitoClientCredentials(clientId: string, clientSecret: string): string {
  return JSON.stringify({ client_id: clientId.trim(), client_secret: clientSecret.trim() });
}

function accountStatusLabel(account: MarketplaceAccount): string {
  if (account.credentials_status === "revoked") return "Доступ отозван";
  if (account.status === "active" && account.credentials_status === "valid") return "Активно";
  if (account.status === "error") return "Есть ошибка";
  return "Нужна проверка";
}

function accountStatusTone(account: MarketplaceAccount): string {
  if (account.credentials_status === "revoked" || account.status === "error") return "ui-badge-danger";
  if (account.status === "active" && account.credentials_status === "valid") return "ui-badge-success";
  return "ui-badge-warning";
}

function normalizeResponseMode(value: string): ResponseMode {
  return value === "auto" || value === "semi_auto" ? value : "inherit";
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

function eventTypeLabel(value: string): string {
  const labels: Record<string, string> = {
    "credentials.validate": "Проверка данных доступа",
    "sync.chats": "Событие синхронизации чатов",
    "sync.unhandled_error": "Системная ошибка синхронизации",
  };
  return labels[value] ?? value;
}

function formatSyncStats(stats: Record<string, number>): string {
  const labels: Record<string, string> = {
    imported_chats: "новых чатов",
    imported_messages: "новых сообщений",
    updated_chats: "обновлено чатов",
    skipped: "пропущено",
  };
  const parts = Object.entries(stats)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${labels[key] ?? key}: ${value}`);
  return parts.length > 0 ? parts.join(" · ") : "Изменений нет";
}

function formatEventDetails(details: Record<string, unknown>): string {
  const parts: string[] = [];
  collectSafeEventDetails(details, parts, 0);
  return parts.length > 0 ? parts.join(" · ") : "Событие зарегистрировано без дополнительных данных.";
}

function collectSafeEventDetails(value: Record<string, unknown>, parts: string[], depth: number): void {
  if (depth > 2 || parts.length >= 4) return;
  for (const [key, candidate] of Object.entries(value)) {
    if (parts.length >= 4) return;
    if (isDisplayableMetadataValue(candidate) && isAllowedEventDetailKey(key)) {
      parts.push(`${eventDetailLabel(key)}: ${String(candidate)}`);
      continue;
    }
    if (isPlainMetadataRecord(candidate)) collectSafeEventDetails(candidate, parts, depth + 1);
  }
}

function eventDetailLabel(value: string): string {
  const labels: Record<string, string> = {
    count: "обработано",
    pages_processed: "страниц",
    error_type: "тип ошибки",
    credentials_status: "состояние доступа",
  };
  return labels[value] ?? value;
}

function friendlyAvitoError(code: string): string {
  const labels: Record<string, string> = {
    invalid_account_identifier: "ID пользователя Авито должен быть положительным числом.",
    invalid_credentials: "Client ID или Client Secret отклонены. Проверьте данные подключения.",
    insufficient_scope: "Подключению не хватает прав для работы с чатами Авито.",
    payment_required: "Для Messenger требуется доступ по условиям аккаунта Авито.",
    rate_limited: "Авито временно ограничил частоту запросов. Повторите операцию позже.",
    marketplace_unavailable: "Авито временно недоступен. Повторите операцию позже.",
    network_timeout: "Авито не ответил вовремя. Повторите операцию позже.",
    network_error: "Не удалось связаться с Авито. Повторите операцию позже.",
    malformed_payload: "Авито вернул ответ в неожиданном формате.",
    sync_page_limit_exceeded: "Синхронизация достигла защитного лимита страниц и была остановлена.",
    sync_pagination_checkpoint_invalid: "Синхронизация остановлена из-за некорректной точки продолжения. Повторите запуск.",
  };
  return labels[code] ?? "Операция Авито завершилась ошибкой. Повторите попытку или проверьте подключение.";
}

function safeMetadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isDisplayableMetadataValue(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isPlainMetadataRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAllowedEventDetailKey(key: string): boolean {
  return ["count", "pages_processed", "error_type", "credentials_status"].includes(key.toLowerCase());
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.requestId ? `${error.message} · requestId ${error.requestId}` : error.message;
  }
  return error instanceof Error ? error.message : "Неизвестная ошибка";
}
