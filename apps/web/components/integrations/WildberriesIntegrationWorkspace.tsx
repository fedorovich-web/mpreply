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

type SellerIdMode = "optional" | "required" | "positive-integer";
type CredentialMode = "single" | "avito-client-credentials";

type MarketplaceIntegrationWorkspaceProps = {
  marketplace: MarketplaceIntegrationKey;
  marketplaceName: string;
  credentialLabel: string;
  secondaryCredentialLabel?: string;
  credentialMode?: CredentialMode;
  placeholder: string;
  sellerIdLabel?: string;
  sellerIdMode?: SellerIdMode;
  sellerIdPlaceholder?: string;
  sellerIdHiddenAfterSave?: boolean;
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
    managerTitle: "Можно обновлять обращения",
    managerText: "Для вашей роли доступно обновление обращений. Настройки кабинета и данные для доступа может изменить владелец или администратор.",
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
    storedIdentifier: "Сохранённое значение скрыто. Оставьте поле пустым, если менять его не нужно.",
    permissions: "Подтверждённые права",
    notValidated: "Ещё не проверены",
    noPermissions: "Права не подтверждены",
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
    validationRateLimited: "Wildberries временно ограничил проверку. Повторите позже.",
    validationRateLimitedPreserved: "Wildberries временно ограничил проверку. Доступ сохранён, повторите позже.",
    works: "Подключение работает.",
    syncSuccessPrefix: "Данные обновлены",
    newMessages: "новых обращений",
    updated: "обновлено",
    syncFailed: "Не удалось полностью обновить данные. Проверьте подключение и попробуйте ещё раз.",
    syncRateLimited: "Wildberries временно ограничил загрузку. MPReply продолжит обновление после окончания указанной площадкой паузы.",
    syncInProgress: "Другое обновление этого кабинета уже выполняется. Подождите и попробуйте снова.",
    syncPartial: "Часть данных загружена. Обновление продолжится автоматически.",
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
    syncReviewsQuestions: "Загрузить отзывы и вопросы",
    newCredentialsAria: "Новые данные для подключения",
    accessEyebrow: "Доступ",
    rotateTitle: "Обновить данные для подключения",
    saveNewCredentials: "Сохранить новые данные",
    disconnectTitle: "Отключить кабинет",
    disconnectText: "MPReply перестанет получать новые обращения из этого кабинета. Для повторного подключения понадобятся новые данные доступа.",
    disconnectConfirm: "Отключить этот кабинет от MPReply?",
    disconnecting: "Отключаем...",
    disconnect: "Отключить кабинет",
    deleteTitle: "Удалить кабинет",
    deleteText: "Кабинет исчезнет из списка, данные доступа будут удалены, обновления и автоматизация остановятся. История обращений и оплат сохранится. Для подключения понадобится заново добавить кабинет.",
    deleteConfirm: "Удалить кабинет «{name}»? Данные доступа будут удалены. История обращений и оплат сохранится.",
    deleting: "Удаляем...",
    deleteAccount: "Удалить кабинет",
    deletedNotice: "Кабинет удалён. История обращений сохранена.",
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
    managerTitle: "You can sync customer messages",
    managerText: "Your role can sync customer messages. Only an owner or administrator can change account settings and credentials.",
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
    storedIdentifier: "The saved value is hidden. Leave this field empty unless you want to replace it.",
    permissions: "Validated permissions",
    notValidated: "Not validated yet",
    noPermissions: "No permissions confirmed",
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
    validationRateLimited: "Wildberries temporarily limited validation. Try again later.",
    validationRateLimitedPreserved: "Wildberries temporarily limited validation. Your saved access is preserved; try again later.",
    works: "Connection is working.",
    syncSuccessPrefix: "Data updated",
    newMessages: "new customer messages",
    updated: "updated",
    syncFailed: "The data sync did not complete successfully. Check the connection and try again.",
    syncRateLimited: "Wildberries temporarily limited data loading. MPReply will resume after the marketplace's waiting period.",
    syncInProgress: "Another sync for this seller account is already running. Wait for it to finish, then try again.",
    syncPartial: "Some data has loaded. The remaining data will sync automatically.",
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
    syncReviewsQuestions: "Load reviews and questions",
    newCredentialsAria: "New connection credentials",
    accessEyebrow: "Access",
    rotateTitle: "Replace connection credentials",
    saveNewCredentials: "Save new credentials",
    disconnectTitle: "Disconnect seller account",
    disconnectText: "MPReply will stop receiving new customer messages from this seller account. New access credentials will be required to reconnect it.",
    disconnectConfirm: "Disconnect this seller account from MPReply?",
    disconnecting: "Disconnecting...",
    disconnect: "Disconnect seller account",
    deleteTitle: "Delete seller account",
    deleteText: "The account will disappear from connections, its credentials will be deleted, and sync and automation will stop. Message and payment history will remain. Reconnecting requires adding a new account.",
    deleteConfirm: "Delete seller account ‘{name}’? Its credentials will be deleted. Message and payment history will remain.",
    deleting: "Deleting...",
    deleteAccount: "Delete seller account",
    deletedNotice: "Seller account deleted. Message history retained.",
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
  secondaryCredentialLabel,
  credentialMode = "single",
  placeholder,
  sellerIdLabel,
  sellerIdMode = "optional",
  sellerIdPlaceholder,
  sellerIdHiddenAfterSave = false,
}: MarketplaceIntegrationWorkspaceProps) {
  const { activeOrganization, locale } = useWorkspace();
  const t = integrationCopy[locale];
  const canManage = activeOrganization.current_user_role === "owner" || activeOrganization.current_user_role === "admin";
  const canSync = canManage || activeOrganization.current_user_role === "manager";
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [credentials, setCredentials] = useState("");
  const [secondaryCredentials, setSecondaryCredentials] = useState("");
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
  const createSellerIdValid = sellerIdIsValid(sellerId, sellerIdMode);
  const createCredentialsValid = credentialsAreValid(credentials, secondaryCredentials, credentialMode);

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/marketplace-accounts", marketplaceAccountSchema, {
        method: "POST",
        body: {
          organization_id: activeOrganization.id,
          marketplace,
          display_name: displayName.trim(),
          credentials: encodeCredentials(credentials, secondaryCredentials, credentialMode),
          seller_id: emptyToNull(sellerId),
          default_response_mode: responseMode,
        },
      }),
    onSuccess: async (account) => {
      setSelectedAccountId(account.id);
      setDisplayName("");
      setSellerId("");
      setCredentials("");
      setSecondaryCredentials("");
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
          <strong>{canSync ? t.managerTitle : t.readOnlyTitle}</strong>
          <p>{canSync ? t.managerText : t.readOnlyText}</p>
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
                if (displayName.trim().length >= 2 && createSellerIdValid && createCredentialsValid) createMutation.mutate();
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
                {sellerIdLabel ?? t.sellerId}{" "}
                {sellerIdMode === "optional" ? <span className="field-optional">{t.optional}</span> : null}
                <input
                  inputMode={sellerIdMode === "positive-integer" ? "numeric" : "text"}
                  maxLength={255}
                  onChange={(event) => setSellerId(event.target.value)}
                  pattern={sellerIdMode === "positive-integer" ? "[1-9][0-9]*" : undefined}
                  placeholder={sellerIdPlaceholder}
                  required={sellerIdMode !== "optional"}
                  value={sellerId}
                />
              </label>
              <label>
                {credentialLabel}
                <input
                  autoComplete="off"
                  minLength={credentialMode === "single" ? 8 : undefined}
                  onChange={(event) => setCredentials(event.target.value)}
                  required
                  type="password"
                  value={credentials}
                />
              </label>
              {credentialMode === "avito-client-credentials" && secondaryCredentialLabel ? (
                <label>
                  {secondaryCredentialLabel}
                  <input
                    autoComplete="new-password"
                    onChange={(event) => setSecondaryCredentials(event.target.value)}
                    required
                    type="password"
                    value={secondaryCredentials}
                  />
                </label>
              ) : null}
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
                disabled={createMutation.isPending || displayName.trim().length < 2 || !createSellerIdValid || !createCredentialsValid}
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
              canSync={canSync}
              credentialLabel={credentialLabel}
              credentialMode={credentialMode}
              detailTitleId={detailTitleId}
              marketplaceName={marketplaceName}
              organizationId={activeOrganization.id}
              onNotice={setNotice}
              locale={locale}
              secondaryCredentialLabel={secondaryCredentialLabel}
              sellerIdHiddenAfterSave={sellerIdHiddenAfterSave}
              sellerIdLabel={sellerIdLabel ?? t.sellerId}
              sellerIdMode={sellerIdMode}
              sellerIdPlaceholder={sellerIdPlaceholder}
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
  canSync,
  credentialLabel,
  credentialMode,
  detailTitleId,
  marketplaceName,
  organizationId,
  onNotice,
  locale,
  secondaryCredentialLabel,
  sellerIdHiddenAfterSave,
  sellerIdLabel,
  sellerIdMode,
  sellerIdPlaceholder,
}: {
  account: MarketplaceAccount;
  canManage: boolean;
  canSync: boolean;
  credentialLabel: string;
  credentialMode: CredentialMode;
  detailTitleId: string;
  marketplaceName: string;
  organizationId: string;
  onNotice: (notice: Notice | null) => void;
  locale: Locale;
  secondaryCredentialLabel?: string;
  sellerIdHiddenAfterSave: boolean;
  sellerIdLabel: string;
  sellerIdMode: SellerIdMode;
  sellerIdPlaceholder?: string;
}) {
  const t = integrationCopy[locale];
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(account.display_name);
  const [sellerId, setSellerId] = useState(sellerIdHiddenAfterSave ? "" : account.seller_id ?? "");
  const [responseMode, setResponseMode] = useState<ResponseMode>(normalizeResponseMode(account.default_response_mode));
  const [newCredentials, setNewCredentials] = useState("");
  const [newSecondaryCredentials, setNewSecondaryCredentials] = useState("");
  const [localError, setLocalError] = useState<unknown>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["marketplace-accounts", organizationId] });

  const updateMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}`, marketplaceAccountSchema, {
        method: "PATCH",
        body: {
          display_name: displayName.trim(),
          ...(!sellerIdHiddenAfterSave || sellerId.trim() ? { seller_id: emptyToNull(sellerId) } : {}),
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
        message:
          result.error_code === "rate_limited"
            ? result.status === "active" && result.credentials_status === "valid"
              ? t.validationRateLimitedPreserved
              : t.validationRateLimited
            : result.error_code
              ? t.validateFailed
              : t.works,
      });
      await invalidate();
    },
  });

  const syncMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}/sync`, marketplaceSyncSchema, { method: "POST" }),
    onSuccess: async (result) => {
      const imported = result.imported_reviews + result.imported_questions + result.imported_chats;
      const updated = result.updated_reviews + result.updated_questions + result.updated_chats;
      let message: string;
      if (result.status === "success") {
        message = `${t.syncSuccessPrefix}: ${t.newMessages} ${imported}, ${t.updated} ${updated}.`;
      } else if (result.status === "in_progress") {
        message = t.syncInProgress;
      } else if (result.status === "partial") {
        message = t.syncPartial;
      } else {
        message = result.error_code === "rate_limited" && account.marketplace === "wildberries" ? t.syncRateLimited : t.syncFailed;
      }
      onNotice({
        tone: result.status === "success" ? "success" : "warning",
        message,
      });
      await invalidate();
    },
  });

  const rotateMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}/rotate-credentials`, marketplaceAccountActionSchema, {
        method: "POST",
        body: { credentials: encodeCredentials(newCredentials, newSecondaryCredentials, credentialMode) },
      }),
    onSuccess: async () => {
      setNewCredentials("");
      setNewSecondaryCredentials("");
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

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}`, marketplaceAccountActionSchema, { method: "DELETE" }),
    onSuccess: async () => {
      queryClient.setQueryData<MarketplaceAccount[]>(["marketplace-accounts", organizationId], (previous) => previous?.filter((item) => item.id !== account.id));
      onNotice({ tone: "success", message: t.deletedNotice });
      await invalidate();
    },
  });

  const busy = updateMutation.isPending || validateMutation.isPending || syncMutation.isPending || rotateMutation.isPending || revokeMutation.isPending || deleteMutation.isPending;
  const mutationError = localError ?? updateMutation.error ?? validateMutation.error ?? syncMutation.error ?? rotateMutation.error ?? revokeMutation.error ?? deleteMutation.error;
  const detailSellerIdValid =
    sellerIdHiddenAfterSave && sellerId.trim().length === 0 ? true : sellerIdIsValid(sellerId, sellerIdMode);
  const rotationCredentialsValid = credentialsAreValid(
    newCredentials,
    newSecondaryCredentials,
    credentialMode,
  );
  const syncAction = (
    <button className="button button-secondary" disabled={busy || account.credentials_status !== "valid"} onClick={() => syncMutation.mutate()} type="button">
      {syncMutation.isPending ? t.syncing : account.marketplace === "wildberries" ? t.syncReviewsQuestions : t.sync}
    </button>
  );
  const connectionActions = (
    <div className="integration-action-grid" aria-label={t.actionsAria}>
      {canManage ? (
        <button className="button button-primary" disabled={busy || account.credentials_status === "revoked"} onClick={() => validateMutation.mutate()} type="button">
          {validateMutation.isPending ? t.validating : t.validate}
        </button>
      ) : null}
      {syncAction}
    </div>
  );

  return (
    <div className="integration-detail-stack">
      <div className="integration-detail-heading">
        <div>
          <span className="panel-kicker">{t.selectedAccount}</span>
          <h2 id={detailTitleId}>{account.display_name}</h2>
        </div>
        <StatusBadge account={account} locale={locale} />
      </div>

      {canSync && account.marketplace === "wildberries" ? connectionActions : null}

      <dl className="integration-health-grid">
        <HealthItem label={t.accessState} value={credentialsStatusLabel(account.credentials_status, locale)} />
        {hasCurrentIntegrationProblem(account) ? (
          <HealthItem label={locale === "ru" ? "Загрузка" : "Loading"}
            value={account.sync_error_code === "rate_limited"
              ? locale === "ru" ? "Ожидание разрешения маркетплейса" : "Waiting for the marketplace"
              : locale === "ru" ? "Загрузка требует внимания" : "Loading needs attention"} />
        ) : null}
        <HealthItem label={t.connectionData} value={account.credentials_masked} />
        <HealthItem label={t.lastSuccess} value={formatDateTime(account.last_success_sync_at, locale)} />
        <HealthItem label={t.lastError} value={formatDateTime(account.last_error_sync_at, locale)} />
        {hasCurrentIntegrationProblem(account) && account.sync_error_code === "rate_limited" && account.sync_next_retry_at ? (
          <HealthItem label={locale === "ru" ? "Загрузка продолжится автоматически" : "Loading resumes automatically"}
            value={formatDateTime(account.sync_next_retry_at, locale)} />
        ) : null}
        <HealthItem label={t.permissions} value={formatValidatedScopes(account.scopes_json, locale)} />
      </dl>

      {canManage ? (
        <>
          <form
            className="settings-form integration-detail-form"
            aria-label={`${t.settingsAria} ${marketplaceName}`}
            onSubmit={(event) => {
              event.preventDefault();
              setLocalError(null);
              if (displayName.trim().length >= 2 && detailSellerIdValid) updateMutation.mutate();
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
              {sellerIdLabel}{" "}
              {sellerIdMode === "optional" || sellerIdHiddenAfterSave ? (
                <span className="field-optional">{t.optional}</span>
              ) : null}
              <input
                inputMode={sellerIdMode === "positive-integer" ? "numeric" : "text"}
                maxLength={255}
                onChange={(event) => setSellerId(event.target.value)}
                pattern={sellerIdMode === "positive-integer" ? "[1-9][0-9]*" : undefined}
                placeholder={sellerIdPlaceholder}
                required={!sellerIdHiddenAfterSave && sellerIdMode !== "optional"}
                value={sellerId}
              />
              {sellerIdHiddenAfterSave ? <small>{t.storedIdentifier}</small> : null}
            </label>
            <label>
              {t.responseMode}
              <select onChange={(event) => setResponseMode(event.target.value as ResponseMode)} value={responseMode}>
                <option value="inherit">{t.inherit}</option>
                <option value="auto">{t.auto}</option>
                <option value="semi_auto">{t.semiAuto}</option>
              </select>
            </label>
            <button className="button button-secondary" disabled={busy || displayName.trim().length < 2 || !detailSellerIdValid} type="submit">
              {updateMutation.isPending ? t.saving : t.saveSettings}
            </button>
          </form>

          {account.marketplace !== "wildberries" ? connectionActions : null}

          <form
            className="settings-form integration-rotate-form"
            aria-label={`${t.newCredentialsAria} ${marketplaceName}`}
            onSubmit={(event) => {
              event.preventDefault();
              setLocalError(null);
              if (rotationCredentialsValid) rotateMutation.mutate();
            }}
          >
            <div className="panel-heading">
              <span className="panel-kicker">{t.accessEyebrow}</span>
              <strong>{t.rotateTitle}</strong>
            </div>
            <label>
              {credentialLabel}
              <input
                autoComplete="off"
                minLength={credentialMode === "single" ? 8 : undefined}
                onChange={(event) => setNewCredentials(event.target.value)}
                required
                type="password"
                value={newCredentials}
              />
            </label>
            {credentialMode === "avito-client-credentials" && secondaryCredentialLabel ? (
              <label>
                {secondaryCredentialLabel}
                <input
                  autoComplete="new-password"
                  onChange={(event) => setNewSecondaryCredentials(event.target.value)}
                  required
                  type="password"
                  value={newSecondaryCredentials}
                />
              </label>
            ) : null}
            <button className="button button-secondary" disabled={busy || !rotationCredentialsValid} type="submit">
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

          <div className="integration-danger-zone integration-delete-zone">
            <div>
              <strong>{t.deleteTitle}</strong>
              <p>{t.deleteText}</p>
            </div>
            <button
              className="button button-danger"
              disabled={busy}
              onClick={() => {
                setLocalError(null);
                if (window.confirm(t.deleteConfirm.replace("{name}", account.display_name))) deleteMutation.mutate();
              }}
              type="button"
            >
              {deleteMutation.isPending ? t.deleting : t.deleteAccount}
            </button>
          </div>

          {mutationError ? (
            <FormError error={mutationError} fallback={t.actionError} locale={locale} />
          ) : null}
        </>
      ) : (
        <>
          {canSync && account.marketplace !== "wildberries" ? connectionActions : null}
          <div className="workspace-inline-state">
            <strong>{t.adminOnlyTitle}</strong>
            <p>{t.adminOnlyText}</p>
          </div>
          {mutationError ? <FormError error={mutationError} fallback={t.actionError} locale={locale} /> : null}
        </>
      )}
    </div>
  );
}

function StatusBadge({ account, locale }: { account: MarketplaceAccount; locale: Locale }) {
  const tone = account.status === "error" || account.credentials_status === "revoked" || account.credentials_status === "invalid"
    ? "ui-badge-danger"
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

function sellerIdIsValid(value: string, mode: SellerIdMode): boolean {
  const trimmed = value.trim();
  if (mode === "optional") return trimmed.length === 0 || trimmed.length <= 255;
  if (mode === "required") return trimmed.length > 0 && trimmed.length <= 255;
  return /^[1-9][0-9]*$/.test(trimmed) && trimmed.length <= 255;
}

function credentialsAreValid(primary: string, secondary: string, mode: CredentialMode): boolean {
  if (mode === "avito-client-credentials") {
    return primary.trim().length > 0 && secondary.trim().length > 0;
  }
  return primary.length >= 8;
}

function encodeCredentials(primary: string, secondary: string, mode: CredentialMode): string {
  if (mode === "avito-client-credentials") {
    return JSON.stringify({ version: 1, client_id: primary.trim(), client_secret: secondary.trim() });
  }
  return primary;
}

function formatValidatedScopes(scopesJson: Record<string, unknown>, locale: Locale): string {
  const t = integrationCopy[locale];
  const scopes = scopesJson.scopes;
  if (Array.isArray(scopes)) {
    const values = [...new Set(scopes.filter((scope): scope is string => typeof scope === "string" && scope.length > 0))];
    if (values.length > 0) return values.join(", ");
  }
  return scopesJson.validated === true ? t.noPermissions : t.notValidated;
}

function normalizeResponseMode(value: string): ResponseMode {
  return value === "auto" || value === "semi_auto" ? value : "inherit";
}

function accountStatusLabel(account: MarketplaceAccount, locale: Locale): string {
  const t = integrationCopy[locale];
  if (account.credentials_status === "revoked") return t.revoked;
  if (account.status === "error") return t.error;
  if (account.status === "active" && account.credentials_status === "valid") return t.connected;
  if (hasCurrentIntegrationProblem(account)) {
    return t.attention;
  }
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
