"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";

import { ApiError, apiRequest, buildApiQuery } from "../../lib/api/client";
import type { Locale } from "../../lib/i18n";
import {
  marketplaceAccountActionSchema,
  marketplaceAccountListSchema,
  marketplaceAccountSchema,
  marketplaceAccountValidateSchema,
  marketplaceSyncSchema,
  type MarketplaceAccount,
} from "../../lib/api/schemas";
import { hasCurrentIntegrationProblem } from "../../lib/marketplace-account-health";
import { useWorkspace } from "../workspace/WorkspaceProvider";

type ResponseMode = "inherit" | "auto" | "semi_auto";
export type MarketplaceIntegrationKey = "wildberries" | "ozon" | "yandex_market" | "avito";

type Notice = {
  tone: "success" | "warning";
  message: string;
};

type MarketplaceIntegrationWorkspaceProps = {
  marketplace: MarketplaceIntegrationKey;
  marketplaceName: string;
  credentialLabel: string;
  placeholder: string;
};
const integrationCopy = {
  ru: {
    wbCredential: "Ключ доступа Wildberries",
    wbPlaceholder: "Например, WB — основной магазин",
    added: "Кабинет добавлен. Проверьте подключение перед первым обновлением данных.",
    manageAria: "Управление подключениями",
    secureTitle: "Данные для подключения защищены",
    secureText: "После сохранения значение скрывается. Полные данные для доступа повторно не показываются.",
    readOnlyTitle: "Только просмотр",
    readOnlyText: "Для вашей роли доступен просмотр подключений. Изменять настройки, данные для доступа и обновлять обращения нельзя.",
    connectedAccounts: "Подключённые кабинеты",
    accounts: "Кабинеты",
    refreshing: "Обновляем...",
    refreshList: "Обновить список",
    refreshError: "Не удалось обновить список кабинетов",
    stale: "Показываем ранее загруженные данные.",
    retrying: "Повторяем...",
    retry: "Повторить",
    loadingDescription: "Получаем подключённые кабинеты.",
    loadingTitle: "Загружаем подключения",
    unavailable: "Подключения временно недоступны. Попробуйте ещё раз.",
    loadError: "Не удалось загрузить подключения",
    emptyTitle: "Подключений пока нет",
    emptyManage: "Добавьте первый кабинет",
    emptyReadOnly: "Для вашей компании ещё нет подключённых кабинетов",
    access: "Доступ",
    newConnectionAria: "Новое подключение",
    newConnection: "Новое подключение",
    addAccount: "Добавить кабинет",
    displayName: "Название подключения",
    sellerId: "Идентификатор продавца",
    optional: "необязательно",
    responseMode: "Режим ответов",
    inherit: "Использовать общие настройки",
    auto: "Автоматическая отправка",
    semiAuto: "С подтверждением сотрудника",
    addError: "Не удалось добавить кабинет. Проверьте данные и попробуйте ещё раз.",
    saving: "Сохраняем...",
    add: "Добавить кабинет",
    connectionStateAria: "Состояние подключения",
    noSelectionTitle: "Кабинет не выбран",
    noSelectionEmpty: "После подключения здесь появятся состояние доступа, обновление данных и настройки.",
    noSelectionChoose: "Выберите кабинет из списка.",
    settingsSaved: "Настройки кабинета сохранены.",
    validateFailed: "Не удалось подтвердить доступ к кабинету. Проверьте данные для подключения.",
    works: "Подключение работает.",
    syncSuccessPrefix: "Данные обновлены",
    newMessages: "новых обращений",
    updated: "обновлено",
    skipped: "без изменений",
    syncFailed: "Не удалось полностью обновить данные. Проверьте подключение и попробуйте ещё раз.",
    credentialsRotated: "Данные для подключения заменены. Проверьте подключение перед следующим обновлением.",
    revokedNotice: "Подключение отключено. Новые обращения из этого кабинета больше не будут загружаться.",
    selectedAccount: "Выбранный кабинет",
    accessState: "Состояние доступа",
    connectionData: "Данные подключения",
    lastSuccess: "Последнее успешное обновление",
    lastError: "Последняя ошибка",
    settingsAria: "Настройки кабинета",
    settings: "Настройки",
    accountSettings: "Настройки кабинета",
    name: "Название",
    saveSettings: "Сохранить настройки",
    actionsAria: "Действия с подключением",
    validating: "Проверяем...",
    validate: "Проверить подключение",
    syncing: "Обновляем...",
    sync: "Обновить данные",
    newCredentialsAria: "Новые данные для подключения",
    accessEyebrow: "Доступ",
    rotateTitle: "Обновить данные для подключения",
    saveNewCredentials: "Сохранить новые данные",
    disconnectTitle: "Отключить кабинет",
    disconnectText: "MPReply перестанет получать новые обращения из этого кабинета. Для повторного подключения понадобятся новые данные доступа.",
    disconnectConfirm: "Отключить этот кабинет от MPReply?",
    disconnecting: "Отключаем...",
    disconnect: "Отключить кабинет",
    actionError: "Не удалось выполнить действие. Проверьте подключение и попробуйте ещё раз.",
    adminOnlyTitle: "Настройки доступны владельцу и администратору",
    adminOnlyText: "Для вашей роли доступен просмотр состояния подключения. Изменение настроек и данных доступа недоступно.",
    unauthorized: "Сессия истекла. Войдите снова.",
    forbidden: "Недостаточно прав для этого действия.",
    notFound: "Подключение не найдено. Обновите список и попробуйте снова.",
    conflict: "Данные подключения уже изменились. Обновите страницу и повторите действие.",
    invalid: "Проверьте введённые данные и попробуйте снова.",
    rateLimit: "Слишком много действий подряд. Подождите немного и попробуйте снова.",
    revoked: "Доступ отозван",
    error: "Ошибка",
    attention: "Требует внимания",
    connected: "Подключено",
    disabled: "Отключено",
    needsCheck: "Нужна проверка",
    valid: "Проверен",
    pendingValidation: "Ожидает проверки",
    invalidCredential: "Недействителен",
    never: "Ещё не было",
    dateUnavailable: "Дата недоступна",
  },
  en: {
    wbCredential: "Wildberries access key",
    wbPlaceholder: "For example, WB — main store",
    added: "Seller account added. Validate the connection before the first data sync.",
    manageAria: "Manage marketplace connections",
    secureTitle: "Connection credentials are protected",
    secureText: "After saving, the value is hidden. Full access credentials are not shown again.",
    readOnlyTitle: "View only",
    readOnlyText: "Your role can view connections but cannot change settings, replace credentials, or sync customer messages.",
    connectedAccounts: "Connected seller accounts",
    accounts: "Seller accounts",
    refreshing: "Refreshing...",
    refreshList: "Refresh list",
    refreshError: "Could not refresh seller accounts",
    stale: "Showing previously loaded data.",
    retrying: "Retrying...",
    retry: "Retry",
    loadingDescription: "Loading connected seller accounts.",
    loadingTitle: "Loading connections",
    unavailable: "Marketplace connections are temporarily unavailable. Try again.",
    loadError: "Could not load connections",
    emptyTitle: "No connections yet",
    emptyManage: "Add the first seller account",
    emptyReadOnly: "Your workspace does not have a connected seller account for",
    access: "Access",
    newConnectionAria: "New connection",
    newConnection: "New connection",
    addAccount: "Add seller account",
    displayName: "Connection name",
    sellerId: "Seller identifier",
    optional: "optional",
    responseMode: "Reply mode",
    inherit: "Use workspace defaults",
    auto: "Automatic sending",
    semiAuto: "Review before sending",
    addError: "Could not add the seller account. Check the details and try again.",
    saving: "Saving...",
    add: "Add seller account",
    connectionStateAria: "Connection state",
    noSelectionTitle: "No seller account selected",
    noSelectionEmpty: "After connecting an account, access state, data sync, and settings will appear here.",
    noSelectionChoose: "Choose a seller account from the list.",
    settingsSaved: "Seller-account settings saved.",
    validateFailed: "Could not confirm access to the seller account. Check the connection credentials.",
    works: "Connection is working.",
    syncSuccessPrefix: "Data updated",
    newMessages: "new customer messages",
    updated: "updated",
    skipped: "unchanged",
    syncFailed: "The data sync did not complete successfully. Check the connection and try again.",
    credentialsRotated: "Connection credentials replaced. Validate the connection before the next sync.",
    revokedNotice: "Connection disabled. New customer messages from this seller account will no longer be loaded.",
    selectedAccount: "Selected seller account",
    accessState: "Access status",
    connectionData: "Connection credentials",
    lastSuccess: "Last successful sync",
    lastError: "Last error",
    settingsAria: "Seller-account settings",
    settings: "Settings",
    accountSettings: "Seller-account settings",
    name: "Name",
    saveSettings: "Save settings",
    actionsAria: "Connection actions",
    validating: "Checking...",
    validate: "Validate connection",
    syncing: "Syncing...",
    sync: "Sync data",
    newCredentialsAria: "New connection credentials",
    accessEyebrow: "Access",
    rotateTitle: "Replace connection credentials",
    saveNewCredentials: "Save new credentials",
    disconnectTitle: "Disconnect seller account",
    disconnectText: "MPReply will stop receiving new customer messages from this seller account. New access credentials will be required to reconnect it.",
    disconnectConfirm: "Disconnect this seller account from MPReply?",
    disconnecting: "Disconnecting...",
    disconnect: "Disconnect seller account",
    actionError: "The action could not be completed. Check the connection and try again.",
    adminOnlyTitle: "Settings are available to owners and administrators",
    adminOnlyText: "Your role can view connection status, but cannot change settings or access credentials.",
    unauthorized: "Your session expired. Log in again.",
    forbidden: "You do not have permission for this action.",
    notFound: "The connection could not be found. Refresh the list and try again.",
    conflict: "The connection data has already changed. Refresh the page and try again.",
    invalid: "Check the entered data and try again.",
    rateLimit: "Too many actions in a short time. Wait a moment and try again.",
    revoked: "Access revoked",
    error: "Error",
    attention: "Needs attention",
    connected: "Connected",
    disabled: "Disabled",
    needsCheck: "Needs validation",
    valid: "Validated",
    pendingValidation: "Waiting for validation",
    invalidCredential: "Invalid",
    never: "Never",
    dateUnavailable: "Date unavailable",
  },
} as const;

export function WildberriesIntegrationWorkspace() {
  const { locale } = useWorkspace();
  const t = integrationCopy[locale];
  return (
    <MarketplaceIntegrationWorkspace
      credentialLabel={t.wbCredential}
      marketplace="wildberries"
      marketplaceName="Wildberries"
      placeholder={t.wbPlaceholder}
    />
  );
}

export function MarketplaceIntegrationWorkspace({
  marketplace,
  marketplaceName,
  credentialLabel,
  placeholder,
}: MarketplaceIntegrationWorkspaceProps) {
  const { activeOrganization, locale } = useWorkspace();
  const t = integrationCopy[locale];
  const canManage = activeOrganization.current_user_role === "owner" || activeOrganization.current_user_role === "admin";
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [credentials, setCredentials] = useState("");
  const [responseMode, setResponseMode] = useState<ResponseMode>("inherit");
  const [notice, setNotice] = useState<Notice | null>(null);
  const detailPanelRef = useRef<HTMLElement>(null);
  const listTitleId = `integration-${marketplace}-account-list-title`;
  const detailTitleId = `integration-${marketplace}-account-detail-title`;

  const accountsQuery = useQuery({
    queryKey: ["marketplace-accounts", activeOrganization.id],
    queryFn: () =>
      apiRequest(
        buildApiQuery("/api/marketplace-accounts", { organization_id: activeOrganization.id }),
        marketplaceAccountListSchema,
      ),
  });

  const accounts = useMemo(
    () => (accountsQuery.data ?? []).filter((account) => account.marketplace === marketplace),
    [accountsQuery.data, marketplace],
  );
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null;

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/marketplace-accounts", marketplaceAccountSchema, {
        method: "POST",
        body: {
          organization_id: activeOrganization.id,
          marketplace,
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
      setNotice({ tone: "success", message: t.added });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-accounts", activeOrganization.id] });
    },
  });

  function selectAccount(accountId: string) {
    setSelectedAccountId(accountId);
    if (!window.matchMedia("(max-width: 1000px)").matches) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.requestAnimationFrame(() => {
      detailPanelRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  return (
    <section className="wildberries-workspace" aria-label={`${t.manageAria} ${marketplaceName}`}>
      <div className="integration-security-strip" role="note">
        <strong>{t.secureTitle}</strong>
        <span>{t.secureText}</span>
      </div>

      {!canManage ? (
        <div className="workspace-inline-state">
          <strong>{t.readOnlyTitle}</strong>
          <p>{t.readOnlyText}</p>
        </div>
      ) : null}

      {notice ? (
        <p className={`integration-notice integration-notice-${notice.tone}`} aria-live="polite">
          {notice.message}
        </p>
      ) : null}

      <div className="wildberries-layout">
        <section className="integration-account-panel" aria-labelledby={listTitleId}>
          <div className="panel-heading panel-heading-row">
            <div>
              <span className="panel-kicker">{t.connectedAccounts}</span>
              <strong id={listTitleId}>{t.accounts} {marketplaceName}</strong>
            </div>
            <div className="integration-account-heading-actions">
              <span className="ui-badge">{accounts.length}</span>
              {accountsQuery.data ? (
                <button
                  className="button button-secondary button-compact"
                  disabled={accountsQuery.isFetching}
                  onClick={() => void accountsQuery.refetch()}
                  type="button"
                >
                  {accountsQuery.isFetching ? t.refreshing : t.refreshList}
                </button>
              ) : null}
            </div>
          </div>

          {accountsQuery.error && accountsQuery.data ? (
            <div className="integration-refresh-error integration-refresh-error-embedded" role="alert">
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

          {accountsQuery.isPending && !accountsQuery.data ? (
            <WorkspaceState
              description={t.loadingDescription}
              title={t.loadingTitle}
              tone="loading"
            />
          ) : accountsQuery.error && !accountsQuery.data ? (
            <WorkspaceState
              actionDisabled={accountsQuery.isFetching}
              actionLabel={accountsQuery.isFetching ? t.retrying : t.retry}
              description={userErrorMessage(accountsQuery.error, t.unavailable, locale)}
              onAction={() => void accountsQuery.refetch()}
              title={t.loadError}
              tone="error"
            />
          ) : accounts.length === 0 ? (
            <WorkspaceState
              title={t.emptyTitle}
              description={canManage ? `${t.emptyManage} ${marketplaceName}.` : `${t.emptyReadOnly} ${marketplaceName}.`}
              tone="empty"
            />
          ) : (
            <div className="integration-account-list" role="list">
              {accounts.map((account) => (
                <div key={account.id} role="listitem">
                  <button
                    aria-pressed={selectedAccount?.id === account.id}
                    className={`integration-account-button${selectedAccount?.id === account.id ? " integration-account-button-active" : ""}`}
                    onClick={() => selectAccount(account.id)}
                    type="button"
                  >
                    <span>
                      <strong>{account.display_name}</strong>
                      <small>{t.access}: {account.credentials_masked}</small>
                    </span>
                    <StatusBadge account={account} locale={locale} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {canManage ? (
            <form
              className="settings-form integration-create-form"
              aria-label={`${t.newConnectionAria} ${marketplaceName}`}
              onSubmit={(event) => {
                event.preventDefault();
                if (displayName.trim().length >= 2 && credentials.length >= 8) createMutation.mutate();
              }}
            >
              <div className="panel-heading">
                <span className="panel-kicker">{t.newConnection}</span>
                <strong>{t.addAccount}</strong>
              </div>
              <label>
                {t.displayName}
                <input
                  maxLength={255}
                  minLength={2}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder={placeholder}
                  required
                  value={displayName}
                />
              </label>
              <label>
                {t.sellerId} <span className="field-optional">{t.optional}</span>
                <input maxLength={255} onChange={(event) => setSellerId(event.target.value)} value={sellerId} />
              </label>
              <label>
                {credentialLabel}
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
                {t.responseMode}
                <select onChange={(event) => setResponseMode(event.target.value as ResponseMode)} value={responseMode}>
                  <option value="inherit">{t.inherit}</option>
                  <option value="auto">{t.auto}</option>
                  <option value="semi_auto">{t.semiAuto}</option>
                </select>
              </label>
              {createMutation.error ? (
                <FormError error={createMutation.error} fallback={t.addError} locale={locale} />
              ) : null}
              <button
                className="button button-primary"
                disabled={createMutation.isPending || displayName.trim().length < 2 || credentials.length < 8}
                type="submit"
              >
                {createMutation.isPending ? t.saving : t.add}
              </button>
            </form>
          ) : null}
        </section>

        <section
          aria-label={selectedAccount ? undefined : `${t.connectionStateAria} ${marketplaceName}`}
          aria-labelledby={selectedAccount ? detailTitleId : undefined}
          ref={detailPanelRef}
          className="integration-account-detail"
        >
          {selectedAccount ? (
            <AccountDetail
              key={selectedAccount.id}
              account={selectedAccount}
              canManage={canManage}
              credentialLabel={credentialLabel}
              detailTitleId={detailTitleId}
              marketplaceName={marketplaceName}
              organizationId={activeOrganization.id}
              onNotice={setNotice}
              locale={locale}
            />
          ) : (
            <WorkspaceState
              title={t.noSelectionTitle}
              description={accounts.length === 0 ? t.noSelectionEmpty : t.noSelectionChoose}
              tone="neutral"
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
  credentialLabel,
  detailTitleId,
  marketplaceName,
  organizationId,
  onNotice,
  locale,
}: {
  account: MarketplaceAccount;
  canManage: boolean;
  credentialLabel: string;
  detailTitleId: string;
  marketplaceName: string;
  organizationId: string;
  onNotice: (notice: Notice | null) => void;
  locale: Locale;
}) {
  const t = integrationCopy[locale];
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(account.display_name);
  const [sellerId, setSellerId] = useState(account.seller_id ?? "");
  const [responseMode, setResponseMode] = useState<ResponseMode>(normalizeResponseMode(account.default_response_mode));
  const [newCredentials, setNewCredentials] = useState("");
  const [localError, setLocalError] = useState<unknown>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["marketplace-accounts", organizationId] });

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
      onNotice({ tone: "success", message: t.settingsSaved });
      await invalidate();
    },
  });

  const validateMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}/validate`, marketplaceAccountValidateSchema, { method: "POST" }),
    onSuccess: async (result) => {
      onNotice({
        tone: result.error_code ? "warning" : "success",
        message: result.error_code ? t.validateFailed : t.works,
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
          result.status === "success"
            ? `${t.syncSuccessPrefix}: ${t.newMessages} ${imported}, ${t.updated} ${updated}, ${t.skipped} ${result.skipped}.`
            : t.syncFailed,
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
      onNotice({ tone: "success", message: t.credentialsRotated });
      await invalidate();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}/revoke-credentials`, marketplaceAccountActionSchema, { method: "POST" }),
    onSuccess: async () => {
      onNotice({ tone: "warning", message: t.revokedNotice });
      await invalidate();
    },
  });

  const busy = updateMutation.isPending || validateMutation.isPending || syncMutation.isPending || rotateMutation.isPending || revokeMutation.isPending;
  const mutationError = localError ?? updateMutation.error ?? validateMutation.error ?? syncMutation.error ?? rotateMutation.error ?? revokeMutation.error;

  return (
    <div className="integration-detail-stack">
      <div className="integration-detail-heading">
        <div>
          <span className="panel-kicker">{t.selectedAccount}</span>
          <h2 id={detailTitleId}>{account.display_name}</h2>
        </div>
        <StatusBadge account={account} locale={locale} />
      </div>

      <dl className="integration-health-grid">
        <HealthItem label={t.accessState} value={credentialsStatusLabel(account.credentials_status, locale)} />
        <HealthItem label={t.connectionData} value={account.credentials_masked} />
        <HealthItem label={t.lastSuccess} value={formatDateTime(account.last_success_sync_at, locale)} />
        <HealthItem label={t.lastError} value={formatDateTime(account.last_error_sync_at, locale)} />
      </dl>

      {canManage ? (
        <>
          <form
            className="settings-form integration-detail-form"
            aria-label={`${t.settingsAria} ${marketplaceName}`}
            onSubmit={(event) => {
              event.preventDefault();
              setLocalError(null);
              if (displayName.trim().length >= 2) updateMutation.mutate();
            }}
          >
            <div className="panel-heading">
              <span className="panel-kicker">{t.settings}</span>
              <strong>{t.accountSettings}</strong>
            </div>
            <label>
              {t.name}
              <input maxLength={255} minLength={2} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
            </label>
            <label>
              {t.sellerId} <span className="field-optional">{t.optional}</span>
              <input maxLength={255} onChange={(event) => setSellerId(event.target.value)} value={sellerId} />
            </label>
            <label>
              {t.responseMode}
              <select onChange={(event) => setResponseMode(event.target.value as ResponseMode)} value={responseMode}>
                <option value="inherit">{t.inherit}</option>
                <option value="auto">{t.auto}</option>
                <option value="semi_auto">{t.semiAuto}</option>
              </select>
            </label>
            <button className="button button-secondary" disabled={busy || displayName.trim().length < 2} type="submit">
              {updateMutation.isPending ? t.saving : t.saveSettings}
            </button>
          </form>

          <div className="integration-action-grid" aria-label={t.actionsAria}>
            <button className="button button-primary" disabled={busy || account.credentials_status === "revoked"} onClick={() => validateMutation.mutate()} type="button">
              {validateMutation.isPending ? t.validating : t.validate}
            </button>
            <button className="button button-secondary" disabled={busy || account.credentials_status !== "valid"} onClick={() => syncMutation.mutate()} type="button">
              {syncMutation.isPending ? t.syncing : t.sync}
            </button>
          </div>

          <form
            className="settings-form integration-rotate-form"
            aria-label={`${t.newCredentialsAria} ${marketplaceName}`}
            onSubmit={(event) => {
              event.preventDefault();
              setLocalError(null);
              if (newCredentials.length >= 8) rotateMutation.mutate();
            }}
          >
            <div className="panel-heading">
              <span className="panel-kicker">{t.accessEyebrow}</span>
              <strong>{t.rotateTitle}</strong>
            </div>
            <label>
              {credentialLabel}
              <input autoComplete="off" minLength={8} onChange={(event) => setNewCredentials(event.target.value)} required type="password" value={newCredentials} />
            </label>
            <button className="button button-secondary" disabled={busy || newCredentials.length < 8} type="submit">
              {rotateMutation.isPending ? t.saving : t.saveNewCredentials}
            </button>
          </form>

          <div className="integration-danger-zone">
            <div>
              <strong>{t.disconnectTitle}</strong>
              <p>{t.disconnectText}</p>
            </div>
            <button
              className="button button-danger"
              disabled={busy || account.credentials_status === "revoked"}
              onClick={() => {
                setLocalError(null);
                if (window.confirm(t.disconnectConfirm)) revokeMutation.mutate();
              }}
              type="button"
            >
              {revokeMutation.isPending ? t.disconnecting : t.disconnect}
            </button>
          </div>

          {mutationError ? (
            <FormError error={mutationError} fallback={t.actionError} locale={locale} />
          ) : null}
        </>
      ) : (
        <div className="workspace-inline-state">
          <strong>{t.adminOnlyTitle}</strong>
          <p>{t.adminOnlyText}</p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ account, locale }: { account: MarketplaceAccount; locale: Locale }) {
  const hasProblem = hasCurrentIntegrationProblem(account);
  const tone = account.status === "error" || account.credentials_status === "revoked"
    ? "ui-badge-danger"
    : hasProblem
      ? "ui-badge-warning"
      : account.status === "active" && account.credentials_status === "valid"
        ? "ui-badge-success"
        : "ui-badge-warning";
  return <span className={`ui-badge ${tone}`}>{accountStatusLabel(account, locale)}</span>;
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
  actionDisabled = false,
  actionLabel,
  description,
  onAction,
  title,
  tone,
}: {
  actionDisabled?: boolean;
  actionLabel?: string;
  description: string;
  onAction?: () => void;
  title: string;
  tone: "empty" | "error" | "loading" | "neutral";
}) {
  return (
    <div
      aria-busy={tone === "loading"}
      aria-live="polite"
      className={"integration-workspace-state integration-workspace-state-" + tone}
      role={tone === "error" ? "alert" : "status"}
    >
      <strong>{title}</strong>
      <p>{description}</p>
      {actionLabel && onAction ? (
        <button
          className="button button-secondary button-compact"
          disabled={actionDisabled}
          onClick={onAction}
          type="button"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function FormError({ error, fallback, locale }: { error: unknown; fallback: string; locale: Locale }) {
  return <p className="form-error" role="alert">{userErrorMessage(error, fallback, locale)}</p>;
}

function userErrorMessage(error: unknown, fallback: string, locale: Locale): string {
  const t = integrationCopy[locale];
  if (error instanceof ApiError) {
    if (error.status === 401) return t.unauthorized;
    if (error.status === 403) return t.forbidden;
    if (error.status === 404) return t.notFound;
    if (error.status === 409) return t.conflict;
    if (error.status === 422) return t.invalid;
    if (error.status === 429) return t.rateLimit;
    return fallback;
  }
  return fallback;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeResponseMode(value: string): ResponseMode {
  return value === "auto" || value === "semi_auto" ? value : "inherit";
}

function accountStatusLabel(account: MarketplaceAccount, locale: Locale): string {
  const t = integrationCopy[locale];
  if (account.credentials_status === "revoked") return t.revoked;
  if (account.status === "error") return t.error;
  if (hasCurrentIntegrationProblem(account)) return t.attention;
  if (account.status === "active" && account.credentials_status === "valid") return t.connected;
  if (account.status === "disabled") return t.disabled;
  return t.needsCheck;
}

function credentialsStatusLabel(value: string, locale: Locale): string {
  const t = integrationCopy[locale];
  const labels: Record<string, string> = {
    valid: t.valid,
    pending_validation: t.pendingValidation,
    revoked: t.revoked,
    invalid: t.invalidCredential,
  };
  return labels[value] ?? t.needsCheck;
}

function formatDateTime(value: string | null, locale: Locale): string {
  const t = integrationCopy[locale];
  if (!value) return t.never;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t.dateUnavailable;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
