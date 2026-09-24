"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ApiError, apiRequest, buildApiQuery } from "../../lib/api/client";
import {
  marketplaceAccountActionSchema,
  marketplaceAccountListSchema,
  marketplaceAccountSchema,
  marketplaceAccountValidateSchema,
  marketplaceSyncSchema,
  type MarketplaceAccount,
} from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

type ResponseMode = "inherit" | "auto" | "semi_auto";
export type MarketplaceKey = "wildberries" | "ozon" | "yandex_market" | "avito";

const marketplaceDetails = {
  wildberries: { name: "Wildberries", accountLabel: "Seller ID", accountRequired: false, numericAccount: false },
  ozon: { name: "Ozon", accountLabel: "Client ID Ozon", accountRequired: true, numericAccount: false },
  yandex_market: { name: "Яндекс Маркет", accountLabel: "Business ID Яндекс Маркета", accountRequired: true, numericAccount: true },
  avito: { name: "Авито", accountLabel: "ID аккаунта Авито для чатов", accountRequired: false, numericAccount: true },
} as const;

type Notice = {
  tone: "success" | "warning";
  message: string;
};

export function MarketplaceIntegrationWorkspace({ marketplace }: { marketplace: MarketplaceKey }) {
  const details = marketplaceDetails[marketplace];
  const { activeOrganization } = useWorkspace();
  const canManage = activeOrganization.current_user_role === "owner" || activeOrganization.current_user_role === "admin";
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [credentials, setCredentials] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
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
    () => (accountsQuery.data ?? []).filter((account) => account.marketplace === marketplace),
    [accountsQuery.data, marketplace],
  );
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null;
  const accountIdReady = validAccountId(marketplace, sellerId);
  const credentialReady = marketplace === "avito" ? clientId.trim().length > 0 && clientSecret.trim().length > 0 : credentials.length >= 8;

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/marketplace-accounts", marketplaceAccountSchema, {
        method: "POST",
        body: {
          organization_id: activeOrganization.id,
          marketplace,
          display_name: displayName.trim(),
          credentials: marketplace === "avito" ? JSON.stringify({ version: 1, client_id: clientId.trim(), client_secret: clientSecret.trim() }) : credentials,
          seller_id: emptyToNull(sellerId),
          default_response_mode: responseMode,
        },
      }),
    onSuccess: async (account) => {
      setSelectedAccountId(account.id);
      setDisplayName("");
      setSellerId("");
      setCredentials("");
      setClientId("");
      setClientSecret("");
      setResponseMode("inherit");
      setNotice({ tone: "success", message: "Подключение создано. Перед синхронизацией проверьте доступ к API." });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-accounts", activeOrganization.id] });
    },
  });

  return (
    <section className="marketplace-workspace" aria-label={`Управление подключениями ${details.name}`}>
      <div className="integration-security-strip" role="note">
        <strong>Данные доступа остаются на сервере</strong>
        <span>После сохранения браузер получает только маску отпечатка, без исходных данных доступа.</span>
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

      <div className="marketplace-layout">
        <section className="integration-account-panel" aria-labelledby="marketplace-account-list-title">
          <div className="panel-heading panel-heading-row">
            <div>
              <span className="panel-kicker">Кабинеты</span>
              <strong id="marketplace-account-list-title">Кабинеты {details.name}</strong>
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
              description={canManage ? `Создайте первый кабинет ${details.name} в форме ниже.` : `В этой организации ещё нет кабинетов ${details.name}.`}
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
              aria-label={`Новое подключение ${details.name}`}
              onSubmit={(event) => {
                event.preventDefault();
                if (displayName.trim().length >= 2 && accountIdReady && credentialReady) createMutation.mutate();
              }}
            >
              <div className="panel-heading">
                <span className="panel-kicker">Новый кабинет</span>
                <strong>Добавить кабинет</strong>
              </div>
              <label>
                Название подключения
                <input
                  maxLength={255}
                  minLength={2}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder={`${details.name} — основной кабинет`}
                  required
                  value={displayName}
                />
              </label>
              <label>
                {details.accountLabel} {!details.accountRequired ? <span className="field-optional">необязательно</span> : null}
                <input maxLength={marketplace === "avito" ? 20 : 255} onChange={(event) => setSellerId(event.target.value)} required={details.accountRequired} value={sellerId} />
              </label>
              {marketplace === "avito" ? (
                <>
                  <label>Client ID Авито<input autoComplete="off" maxLength={4096} onChange={(event) => setClientId(event.target.value)} required value={clientId} /></label>
                  <label>Client Secret Авито<input autoComplete="off" maxLength={4096} onChange={(event) => setClientSecret(event.target.value)} required type="password" value={clientSecret} /></label>
                </>
              ) : (
                <label>
                  API-ключ {details.name}
                  <input autoComplete="off" minLength={8} onChange={(event) => setCredentials(event.target.value)} required type="password" value={credentials} />
                </label>
              )}
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
                disabled={createMutation.isPending || displayName.trim().length < 2 || !accountIdReady || !credentialReady}
                type="submit"
              >
                {createMutation.isPending ? "Сохраняем..." : "Добавить кабинет"}
              </button>
            </form>
          ) : null}
        </section>

        <section className="integration-account-detail" aria-labelledby="marketplace-account-detail-title">
          {selectedAccount ? (
            <AccountDetail
              key={selectedAccount.id}
              account={selectedAccount}
              marketplace={marketplace}
              marketplaceName={details.name}
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
  marketplace,
  marketplaceName,
  canManage,
  organizationId,
  onNotice,
}: {
  account: MarketplaceAccount;
  marketplace: MarketplaceKey;
  marketplaceName: string;
  canManage: boolean;
  organizationId: string;
  onNotice: (notice: Notice | null) => void;
}) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(account.display_name);
  const [sellerId, setSellerId] = useState(account.seller_id ?? "");
  const [responseMode, setResponseMode] = useState<ResponseMode>(account.default_response_mode);
  const [newCredentials, setNewCredentials] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [newClientSecret, setNewClientSecret] = useState("");
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
    onSuccess: async (updatedAccount) => {
      const referenceChanged = updatedAccount.seller_id !== account.seller_id;
      onNotice({
        tone: referenceChanged ? "warning" : "success",
        message: referenceChanged
          ? "ID кабинета изменён. Проверьте доступ заново перед синхронизацией и отправкой."
          : "Настройки кабинета обновлены.",
      });
      await invalidate();
    },
  });

  const validateMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}/validate`, marketplaceAccountValidateSchema, { method: "POST" }),
    onSuccess: async (result) => {
      onNotice({
        tone: result.error_code ? "warning" : "success",
        message: result.error_message_safe ?? (result.error_code ? "Проверка завершилась с ошибкой." : marketplace === "avito" ? "Чтение API проверено. Отправка не проверена." : "Доступ к API подтверждён."),
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
        body: { credentials: marketplace === "avito" ? JSON.stringify({ version: 1, client_id: newClientId.trim(), client_secret: newClientSecret.trim() }) : newCredentials },
      }),
    onSuccess: async () => {
      setNewCredentials("");
      setNewClientId("");
      setNewClientSecret("");
      onNotice({ tone: "success", message: "Данные доступа заменены. Перед следующей синхронизацией выполните проверку." });
      await invalidate();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}/revoke-credentials`, marketplaceAccountActionSchema, { method: "POST" }),
    onSuccess: async () => {
      onNotice({ tone: "warning", message: "Доступ отозван, подключение отключено." });
      await invalidate();
    },
  });

  const busy = updateMutation.isPending || validateMutation.isPending || syncMutation.isPending || rotateMutation.isPending || revokeMutation.isPending;
  const accountIdReady = validAccountId(marketplace, sellerId);
  const mutationError = updateMutation.error ?? validateMutation.error ?? syncMutation.error ?? rotateMutation.error ?? revokeMutation.error;
  const scopes = account.scopes_json.scopes;
  const hasReadScope = (scope: string) =>
    account.status === "active" && account.credentials_status === "valid" && Array.isArray(scopes) && scopes.includes(scope);

  return (
    <div className="integration-detail-stack">
      <div className="integration-detail-heading">
        <div>
          <span className="panel-kicker">Выбранный кабинет</span>
          <h2 id="marketplace-account-detail-title">{account.display_name}</h2>
        </div>
        <StatusBadge account={account} />
      </div>

      <dl className="integration-health-grid">
        <HealthItem label="Доступ" value={credentialsStatusLabel(account.credentials_status)} />
        {marketplace === "avito" ? (
          <>
            <HealthItem label="Отзывы" value={hasReadScope("reviews:read") ? "Чтение доступно" : "Доступ не подтверждён"} />
            <HealthItem label="Чаты" value={hasReadScope("chats:read") ? "Чтение доступно" : "Доступ не подтверждён"} />
            <HealthItem label="Отправка" value={account.scopes_json.write_verification === "not_probed" ? "Не проверена на реальном аккаунте" : "Нет подтверждения права отправки"} />
          </>
        ) : null}
        <HealthItem label="Маска" value={account.credentials_masked} />
        <HealthItem label="Последняя успешная синхронизация" value={formatDateTime(account.last_success_sync_at)} />
        <HealthItem label="Ошибок" value={String(account.error_count)} />
      </dl>

      {canManage ? (
        <>
          <form
            className="settings-form integration-detail-form"
            aria-label={`Настройки кабинета ${marketplaceName}`}
            onSubmit={(event) => {
              event.preventDefault();
              if (displayName.trim().length >= 2 && accountIdReady) updateMutation.mutate();
            }}
          >
            <div className="panel-heading">
              <span className="panel-kicker">Настройки</span>
              <strong>Настройки кабинета</strong>
            </div>
            <label>
              Название
              <input maxLength={255} minLength={2} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
            </label>
            <label>
              {marketplaceDetails[marketplace].accountLabel} {!marketplaceDetails[marketplace].accountRequired ? <span className="field-optional">необязательно</span> : null}
              <input maxLength={marketplace === "avito" ? 20 : 255} onChange={(event) => setSellerId(event.target.value)} required={marketplaceDetails[marketplace].accountRequired} value={sellerId} />
            </label>
            <label>
              Режим ответов
              <select onChange={(event) => setResponseMode(event.target.value as ResponseMode)} value={responseMode}>
                <option value="inherit">Наследовать настройки организации</option>
                <option value="auto">Автоматический</option>
                <option value="semi_auto">С подтверждением</option>
              </select>
            </label>
            <button className="button button-secondary" disabled={busy || displayName.trim().length < 2 || !accountIdReady} type="submit">
              {updateMutation.isPending ? "Сохраняем..." : "Сохранить настройки"}
            </button>
          </form>

          <div className="integration-action-grid" aria-label="Действия с подключением">
            <button className="button button-primary" disabled={busy || account.credentials_status === "revoked"} onClick={() => validateMutation.mutate()} type="button">
              {validateMutation.isPending ? "Проверяем..." : "Проверить доступ"}
            </button>
            <button className="button button-secondary" disabled={busy || account.credentials_status !== "valid"} onClick={() => syncMutation.mutate()} type="button">
              {syncMutation.isPending ? "Синхронизируем..." : "Синхронизировать сейчас"}
            </button>
          </div>

          <form
            className="settings-form integration-rotate-form"
            aria-label={`Замена доступа к API ${marketplaceName}`}
            onSubmit={(event) => {
              event.preventDefault();
              if (marketplace === "avito" ? newClientId.trim().length > 0 && newClientSecret.trim().length > 0 : newCredentials.length >= 8) rotateMutation.mutate();
            }}
          >
            <div className="panel-heading">
              <span className="panel-kicker">Доступ к API</span>
              <strong>Заменить данные доступа</strong>
            </div>
            {marketplace === "avito" ? (
              <>
                <label>Новый Client ID Авито<input autoComplete="off" maxLength={4096} onChange={(event) => setNewClientId(event.target.value)} required value={newClientId} /></label>
                <label>Новый Client Secret Авито<input autoComplete="off" maxLength={4096} onChange={(event) => setNewClientSecret(event.target.value)} required type="password" value={newClientSecret} /></label>
              </>
            ) : (
              <label>Новый API-ключ<input autoComplete="off" minLength={8} onChange={(event) => setNewCredentials(event.target.value)} required type="password" value={newCredentials} /></label>
            )}
            <button className="button button-secondary" disabled={busy || (marketplace === "avito" ? !newClientId.trim() || !newClientSecret.trim() : newCredentials.length < 8)} type="submit">
              {rotateMutation.isPending ? "Заменяем..." : "Заменить доступ"}
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
                if (window.confirm("Отозвать доступ к API и отключить это подключение?")) revokeMutation.mutate();
              }}
              type="button"
            >
              {revokeMutation.isPending ? "Отзываем..." : "Отозвать доступ"}
            </button>
          </div>

          {mutationError ? <FormError error={mutationError} /> : null}
        </>
      ) : (
        <div className="workspace-inline-state">
          <strong>Управление недоступно для этой роли</strong>
          <p>Изменять данные доступа и запускать синхронизацию могут только владелец и администратор организации.</p>
        </div>
      )}
    </div>
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

function validAccountId(marketplace: MarketplaceKey, value: string): boolean {
  const details = marketplaceDetails[marketplace];
  if (value.trim().length === 0) return !details.accountRequired;
  if (details.numericAccount) return /^[1-9]\d*$/.test(value) && (marketplace !== "avito" || value.length <= 20);
  return true;
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

function formatDateTime(value: string | null): string {
  if (!value) return "Ещё не было";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(date);
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
