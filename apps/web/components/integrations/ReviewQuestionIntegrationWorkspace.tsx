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

export type ReviewQuestionIntegrationConfig = {
  marketplace: "yandex_market" | "ozon";
  marketplaceName: string;
  marketplaceGenitive: string;
  workspaceClassName: string;
  idPrefix: string;
  sellerIdLabel: string;
  sellerIdInputMode?: "numeric" | "text";
  sellerIdPattern?: string;
  sellerIdMaxLength: number;
  sellerIdPlaceholder?: string;
  isSellerIdValid: (value: string) => boolean;
  sellerIdUpdateMode: "inline" | "replace";
  hiddenSellerIdNotice?: string;
  showCredentialExpiry?: boolean;
  emptyValidatedScopesMessage?: string;
  showEventErrorCode?: boolean;
  credentialsLabel: string;
  accountPlaceholder: string;
  createNotice: string;
  scopeLabels: Record<string, string>;
  errorLabels: Record<string, string>;
};

export function ReviewQuestionIntegrationWorkspace({ config }: { config: ReviewQuestionIntegrationConfig }) {
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
    () => (accountsQuery.data ?? []).filter((account) => account.marketplace === config.marketplace),
    [accountsQuery.data, config.marketplace],
  );
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null;

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/marketplace-accounts", marketplaceAccountSchema, {
        method: "POST",
        body: {
          organization_id: activeOrganization.id,
          marketplace: config.marketplace,
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
      setNotice({ tone: "success", message: config.createNotice });
      return queryClient.invalidateQueries({ queryKey: ["marketplace-accounts", activeOrganization.id] });
    },
  });

  return (
    <section className={`wildberries-workspace ${config.workspaceClassName}`} aria-label={`Управление подключениями ${config.marketplaceGenitive}`}>
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
        <section className="integration-account-panel" aria-labelledby={`${config.idPrefix}-account-list-title`}>
          <div className="panel-heading panel-heading-row">
            <div>
              <strong id={`${config.idPrefix}-account-list-title`}>Кабинеты {config.marketplaceGenitive}</strong>
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
              description={canManage ? `Создайте первый кабинет ${config.marketplaceGenitive} в форме ниже.` : `В этой организации ещё нет кабинетов ${config.marketplaceGenitive}.`}
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
              aria-label={`Новое подключение ${config.marketplaceGenitive}`}
              onSubmit={(event) => {
                event.preventDefault();
                if (
                  displayName.trim().length >= 2 &&
                  config.isSellerIdValid(sellerId) &&
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
                  placeholder={config.accountPlaceholder}
                  required
                  value={displayName}
                />
              </label>
              <label>
                {config.sellerIdLabel}
                <input
                  inputMode={config.sellerIdInputMode}
                  maxLength={config.sellerIdMaxLength}
                  onChange={(event) => setSellerId(event.target.value)}
                  pattern={config.sellerIdPattern}
                  placeholder={config.sellerIdPlaceholder}
                  required
                  value={sellerId}
                />
              </label>
              <label>
                {config.credentialsLabel}
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
                  !config.isSellerIdValid(sellerId) ||
                  credentials.length < 8
                }
                type="submit"
              >
                {createMutation.isPending ? "Сохраняем..." : "Добавить кабинет"}
              </button>
            </form>
          ) : null}
        </section>

        <section className="integration-account-detail" aria-labelledby={`${config.idPrefix}-account-detail-title`}>
          {selectedAccount ? (
            <AccountDetail
              key={selectedAccount.id}
              account={selectedAccount}
              canManage={canManage}
              config={config}
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
  config,
  organizationId,
  onNotice,
}: {
  account: MarketplaceAccount;
  canManage: boolean;
  config: ReviewQuestionIntegrationConfig;
  organizationId: string;
  onNotice: (notice: Notice | null) => void;
}) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(account.display_name);
  const [sellerId, setSellerId] = useState(account.seller_id ?? "");
  const [responseMode, setResponseMode] = useState<ResponseMode>(normalizeResponseMode(account.default_response_mode));
  const [replacementSellerId, setReplacementSellerId] = useState("");
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
          ...(config.sellerIdUpdateMode === "inline" ? { seller_id: emptyToNull(sellerId) } : {}),
          default_response_mode: responseMode,
        },
      }),
    onSuccess: async () => {
      onNotice({ tone: "success", message: "Настройки кабинета обновлены." });
      return invalidate();
    },
  });

  const replaceSellerIdMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}`, marketplaceAccountSchema, {
        method: "PATCH",
        body: { seller_id: replacementSellerId.trim() },
      }),
    onSuccess: () => {
      setReplacementSellerId("");
      onNotice({ tone: "warning", message: "Client ID заменён. Перед синхронизацией повторно проверьте подключение." });
      return invalidate();
    },
  });

  const validateMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}/validate`, marketplaceAccountValidateSchema, { method: "POST" }),
    onSuccess: async (result) => {
      onNotice({
        tone: result.error_code ? "warning" : "success",
        message: result.error_code
          ? friendlyIntegrationError(config, result.error_code, result.error_message_safe ?? "Проверка завершилась с ошибкой.")
          : result.error_message_safe ?? "API-ключ успешно проверен.",
      });
      return invalidate();
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
          result.error_code
            ? friendlyIntegrationError(config, result.error_code, result.error_message_safe ?? "Синхронизация завершилась с ошибкой.")
            : result.error_message_safe ??
              `Синхронизация завершена: новых ${imported}, обновлено ${updated}, пропущено ${result.skipped}.`,
      });
      return invalidate();
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
      return invalidate();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}/revoke-credentials`, marketplaceAccountActionSchema, { method: "POST" }),
    onSuccess: async () => {
      onNotice({ tone: "warning", message: "Ключ отозван, подключение отключено." });
      return invalidate();
    },
  });

  const busy = updateMutation.isPending || replaceSellerIdMutation.isPending || validateMutation.isPending || syncMutation.isPending || rotateMutation.isPending || revokeMutation.isPending;
  const mutationError = localError ?? updateMutation.error ?? replaceSellerIdMutation.error ?? validateMutation.error ?? syncMutation.error ?? rotateMutation.error ?? revokeMutation.error;

  return (
    <div className="integration-detail-stack">
      <div className="integration-detail-heading">
        <div>
          <h2 id={`${config.idPrefix}-account-detail-title`}>{account.display_name}</h2>
        </div>
        <StatusBadge account={account} />
      </div>

      {config.hiddenSellerIdNotice ? <p className="integration-empty-copy">{config.hiddenSellerIdNotice}</p> : null}

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
        <AccountOverviewPanel config={config} overview={overviewQuery.data} />
      ) : null}

      {canManage ? (
        <>
          <form
            className="settings-form integration-detail-form"
            aria-label={`Настройки кабинета ${config.marketplaceName}`}
            onSubmit={(event) => {
              event.preventDefault();
              setLocalError(null);
              if (
                displayName.trim().length >= 2 &&
                (config.sellerIdUpdateMode === "replace" || config.isSellerIdValid(sellerId))
              ) {
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
            {config.sellerIdUpdateMode === "inline" ? (
              <label>
                {config.sellerIdLabel}
                <input
                  inputMode={config.sellerIdInputMode}
                  maxLength={config.sellerIdMaxLength}
                  onChange={(event) => setSellerId(event.target.value)}
                  pattern={config.sellerIdPattern}
                  placeholder={config.sellerIdPlaceholder}
                  required
                  value={sellerId}
                />
              </label>
            ) : null}
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
              disabled={
                busy ||
                displayName.trim().length < 2 ||
                (config.sellerIdUpdateMode === "inline" && !config.isSellerIdValid(sellerId))
              }
              type="submit"
            >
              {updateMutation.isPending ? "Сохраняем..." : "Сохранить настройки"}
            </button>
          </form>

          {config.sellerIdUpdateMode === "replace" ? (
            <form
              className="settings-form integration-rotate-form"
              aria-label={`Замена ${config.sellerIdLabel} ${config.marketplaceName}`}
              onSubmit={(event) => {
                event.preventDefault();
                setLocalError(null);
                if (config.isSellerIdValid(replacementSellerId)) replaceSellerIdMutation.mutate();
              }}
            >
              <div className="panel-heading">
                <strong>Заменить {config.sellerIdLabel}</strong>
              </div>
              <label>
                Новый {config.sellerIdLabel}
                <input
                  autoComplete="off"
                  inputMode={config.sellerIdInputMode}
                  maxLength={config.sellerIdMaxLength}
                  onChange={(event) => setReplacementSellerId(event.target.value)}
                  pattern={config.sellerIdPattern}
                  placeholder={config.sellerIdPlaceholder}
                  required
                  value={replacementSellerId}
                />
              </label>
              <button className="button button-secondary" disabled={busy || !config.isSellerIdValid(replacementSellerId)} type="submit">
                {replaceSellerIdMutation.isPending ? "Заменяем..." : `Заменить ${config.sellerIdLabel}`}
              </button>
            </form>
          ) : null}

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
            aria-label={`Замена API-ключа ${config.marketplaceName}`}
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

function AccountOverviewPanel({
  config,
  overview,
}: {
  config: ReviewQuestionIntegrationConfig;
  overview: MarketplaceAccountOverview;
}) {
  const nextRunAt = earliestDateTime(overview.sync_states.map((state) => state.next_run_at));
  const expiresAt = config.showCredentialExpiry ? safeMetadataString(overview.account.scopes_json, "expires_at") : null;

  return (
    <div className="integration-overview-stack">
      <section className={`integration-health-banner integration-health-banner-${overview.health_status}`} aria-labelledby={`${config.idPrefix}-health-section-title`}>
        <div>
          <h3 id={`${config.idPrefix}-health-section-title`}>Состояние подключения</h3>
          <h4>{healthStatusLabel(overview.health_status)}</h4>
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
        {expiresAt ? <HealthItem label="Срок действия ключа" value={formatDateTime(expiresAt)} /> : null}
      </dl>

      <ScopesPanel
        config={config}
        isValidated={overview.account.scopes_json.validated === true}
        scopes={overview.scopes}
      />
      <SyncStreamsPanel idPrefix={config.idPrefix} states={overview.sync_states} />
      <SyncJobsPanel idPrefix={config.idPrefix} jobs={overview.recent_jobs} />
      <IntegrationEventsPanel config={config} events={overview.recent_events} />
    </div>
  );
}

function ScopesPanel({
  config,
  isValidated,
  scopes,
}: {
  config: ReviewQuestionIntegrationConfig;
  isValidated: boolean;
  scopes: string[];
}) {
  const labels = Array.from(new Set(scopes.map((scope) => config.scopeLabels[scope] ?? scope)));
  return (
    <section className="integration-observability-panel" aria-labelledby={`${config.idPrefix}-scopes-title`}>
      <div className="panel-heading panel-heading-row">
        <div>
          <h3 id={`${config.idPrefix}-scopes-title`}>Права</h3>
          <span>Разрешения API-ключа</span>
        </div>
        <span className="ui-badge">{labels.length}</span>
      </div>
      {labels.length > 0 ? (
        <div className="integration-scope-list" role="list">
          {labels.map((label) => (
            <span className="ui-badge ui-badge-neutral" key={label} role="listitem">
              {label}
            </span>
          ))}
        </div>
      ) : (
        <p className="integration-empty-copy">
          {isValidated && config.emptyValidatedScopesMessage
            ? config.emptyValidatedScopesMessage
            : "Разрешения появятся после успешной проверки API-ключа."}
        </p>
      )}
    </section>
  );
}

function SyncStreamsPanel({ idPrefix, states }: { idPrefix: string; states: MarketplaceSyncState[] }) {
  return (
    <section className="integration-observability-panel" aria-labelledby={`${idPrefix}-streams-title`}>
      <div className="panel-heading panel-heading-row">
        <div>
          <h3 id={`${idPrefix}-streams-title`}>Синхронизация</h3>
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

function SyncJobsPanel({ idPrefix, jobs }: { idPrefix: string; jobs: MarketplaceSyncJobSummary[] }) {
  return (
    <section className="integration-observability-panel" aria-labelledby={`${idPrefix}-sync-history-title`}>
      <div className="panel-heading panel-heading-row">
        <div>
          <strong id={`${idPrefix}-sync-history-title`}>История синхронизаций</strong>
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

function IntegrationEventsPanel({
  config,
  events,
}: {
  config: ReviewQuestionIntegrationConfig;
  events: MarketplaceIntegrationEventSummary[];
}) {
  return (
    <section className="integration-observability-panel" aria-labelledby={`${config.idPrefix}-events-title`}>
      <div className="panel-heading panel-heading-row">
        <div>
          <strong id={`${config.idPrefix}-events-title`}>События интеграции</strong>
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
                <p className="integration-error-copy">{friendlyIntegrationError(config, event.error_code, event.error_message_safe)}</p>
              ) : (
                <p>{formatEventDetails(event.details)}</p>
              )}
              {event.error_code && config.showEventErrorCode !== false ? <code>{event.error_code}</code> : null}
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
    .filter(([key, value]) => isAllowedEventDetailKey(key) && (typeof value === "string" || typeof value === "number" || typeof value === "boolean"))
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

function friendlyIntegrationError(config: ReviewQuestionIntegrationConfig, code: string | null, fallback: string): string {
  return code ? config.errorLabels[code] ?? fallback : fallback;
}

function safeMetadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isAllowedEventDetailKey(key: string): boolean {
  return ["count", "pages_processed", "error_type", "credentials_status"].includes(key.toLowerCase());
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
