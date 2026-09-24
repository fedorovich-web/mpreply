"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";

import { ApiError, apiRequest, buildApiQuery } from "../../lib/api/client";
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

export function WildberriesIntegrationWorkspace() {
  return (
    <MarketplaceIntegrationWorkspace
      credentialLabel="Ключ доступа Wildberries"
      marketplace="wildberries"
      marketplaceName="Wildberries"
      placeholder="Например, WB — основной магазин"
    />
  );
}

export function MarketplaceIntegrationWorkspace({
  marketplace,
  marketplaceName,
  credentialLabel,
  placeholder,
}: MarketplaceIntegrationWorkspaceProps) {
  const { activeOrganization } = useWorkspace();
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
      setNotice({ tone: "success", message: "Кабинет добавлен. Проверьте подключение перед первым обновлением данных." });
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
    <section className="wildberries-workspace" aria-label={`Управление подключениями ${marketplaceName}`}>
      <div className="integration-security-strip" role="note">
        <strong>Данные для подключения защищены</strong>
        <span>После сохранения значение скрывается. Полные данные для доступа повторно не показываются.</span>
      </div>

      {!canManage ? (
        <div className="workspace-inline-state">
          <strong>Только просмотр</strong>
          <p>Для вашей роли доступен просмотр подключений. Изменять настройки, данные для доступа и обновлять обращения нельзя.</p>
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
              <span className="panel-kicker">Подключённые кабинеты</span>
              <strong id={listTitleId}>Кабинеты {marketplaceName}</strong>
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
                  {accountsQuery.isFetching ? "Обновляем..." : "Обновить список"}
                </button>
              ) : null}
            </div>
          </div>

          {accountsQuery.error && accountsQuery.data ? (
            <div className="integration-refresh-error integration-refresh-error-embedded" role="alert">
              <div>
                <strong>Не удалось обновить список кабинетов</strong>
                <p>Показываем ранее загруженные данные.</p>
              </div>
              <button
                className="button button-secondary button-compact"
                disabled={accountsQuery.isFetching}
                onClick={() => void accountsQuery.refetch()}
                type="button"
              >
                {accountsQuery.isFetching ? "Повторяем..." : "Повторить"}
              </button>
            </div>
          ) : null}

          {accountsQuery.isPending && !accountsQuery.data ? (
            <WorkspaceState
              description="Получаем подключённые кабинеты."
              title="Загружаем подключения"
              tone="loading"
            />
          ) : accountsQuery.error && !accountsQuery.data ? (
            <WorkspaceState
              actionDisabled={accountsQuery.isFetching}
              actionLabel={accountsQuery.isFetching ? "Повторяем..." : "Повторить"}
              description={userErrorMessage(accountsQuery.error, "Подключения временно недоступны. Попробуйте ещё раз.")}
              onAction={() => void accountsQuery.refetch()}
              title="Не удалось загрузить подключения"
              tone="error"
            />
          ) : accounts.length === 0 ? (
            <WorkspaceState
              title="Подключений пока нет"
              description={canManage ? `Добавьте первый кабинет ${marketplaceName} в форме ниже.` : `Для вашей компании ещё нет подключённых кабинетов ${marketplaceName}.`}
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
                      <small>Доступ: {account.credentials_masked}</small>
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
              aria-label={`Новое подключение ${marketplaceName}`}
              onSubmit={(event) => {
                event.preventDefault();
                if (displayName.trim().length >= 2 && credentials.length >= 8) createMutation.mutate();
              }}
            >
              <div className="panel-heading">
                <span className="panel-kicker">Новое подключение</span>
                <strong>Добавить кабинет</strong>
              </div>
              <label>
                Название подключения
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
                Идентификатор продавца <span className="field-optional">необязательно</span>
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
                Режим ответов
                <select onChange={(event) => setResponseMode(event.target.value as ResponseMode)} value={responseMode}>
                  <option value="inherit">Использовать общие настройки</option>
                  <option value="auto">Автоматическая отправка</option>
                  <option value="semi_auto">С подтверждением сотрудника</option>
                </select>
              </label>
              {createMutation.error ? (
                <FormError error={createMutation.error} fallback="Не удалось добавить кабинет. Проверьте данные и попробуйте ещё раз." />
              ) : null}
              <button
                className="button button-primary"
                disabled={createMutation.isPending || displayName.trim().length < 2 || credentials.length < 8}
                type="submit"
              >
                {createMutation.isPending ? "Сохраняем..." : "Добавить кабинет"}
              </button>
            </form>
          ) : null}
        </section>

        <section
          aria-label={selectedAccount ? undefined : `Состояние подключения ${marketplaceName}`}
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
            />
          ) : (
            <WorkspaceState
              title="Кабинет не выбран"
              description={accounts.length === 0 ? "После подключения здесь появятся состояние доступа, обновление данных и настройки." : "Выберите кабинет из списка."}
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
}: {
  account: MarketplaceAccount;
  canManage: boolean;
  credentialLabel: string;
  detailTitleId: string;
  marketplaceName: string;
  organizationId: string;
  onNotice: (notice: Notice | null) => void;
}) {
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
      onNotice({ tone: "success", message: "Настройки кабинета сохранены." });
      await invalidate();
    },
  });

  const validateMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}/validate`, marketplaceAccountValidateSchema, { method: "POST" }),
    onSuccess: async (result) => {
      onNotice({
        tone: result.error_code ? "warning" : "success",
        message: result.error_code ? "Не удалось подтвердить доступ к кабинету. Проверьте данные для подключения." : "Подключение работает.",
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
            ? `Данные обновлены: новых обращений ${imported}, обновлено ${updated}, без изменений ${result.skipped}.`
            : "Не удалось полностью обновить данные. Проверьте подключение и попробуйте ещё раз.",
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
      onNotice({ tone: "success", message: "Данные для подключения заменены. Проверьте подключение перед следующим обновлением." });
      await invalidate();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}/revoke-credentials`, marketplaceAccountActionSchema, { method: "POST" }),
    onSuccess: async () => {
      onNotice({ tone: "warning", message: "Подключение отключено. Новые обращения из этого кабинета больше не будут загружаться." });
      await invalidate();
    },
  });

  const busy = updateMutation.isPending || validateMutation.isPending || syncMutation.isPending || rotateMutation.isPending || revokeMutation.isPending;
  const mutationError = localError ?? updateMutation.error ?? validateMutation.error ?? syncMutation.error ?? rotateMutation.error ?? revokeMutation.error;

  return (
    <div className="integration-detail-stack">
      <div className="integration-detail-heading">
        <div>
          <span className="panel-kicker">Выбранный кабинет</span>
          <h2 id={detailTitleId}>{account.display_name}</h2>
        </div>
        <StatusBadge account={account} />
      </div>

      <dl className="integration-health-grid">
        <HealthItem label="Состояние доступа" value={credentialsStatusLabel(account.credentials_status)} />
        <HealthItem label="Данные подключения" value={account.credentials_masked} />
        <HealthItem label="Последнее успешное обновление" value={formatDateTime(account.last_success_sync_at)} />
        <HealthItem label="Последняя ошибка" value={formatDateTime(account.last_error_sync_at)} />
      </dl>

      {canManage ? (
        <>
          <form
            className="settings-form integration-detail-form"
            aria-label={`Настройки кабинета ${marketplaceName}`}
            onSubmit={(event) => {
              event.preventDefault();
              setLocalError(null);
              if (displayName.trim().length >= 2) updateMutation.mutate();
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
              Идентификатор продавца <span className="field-optional">необязательно</span>
              <input maxLength={255} onChange={(event) => setSellerId(event.target.value)} value={sellerId} />
            </label>
            <label>
              Режим ответов
              <select onChange={(event) => setResponseMode(event.target.value as ResponseMode)} value={responseMode}>
                <option value="inherit">Использовать общие настройки</option>
                <option value="auto">Автоматическая отправка</option>
                <option value="semi_auto">С подтверждением сотрудника</option>
              </select>
            </label>
            <button className="button button-secondary" disabled={busy || displayName.trim().length < 2} type="submit">
              {updateMutation.isPending ? "Сохраняем..." : "Сохранить настройки"}
            </button>
          </form>

          <div className="integration-action-grid" aria-label="Действия с подключением">
            <button className="button button-primary" disabled={busy || account.credentials_status === "revoked"} onClick={() => validateMutation.mutate()} type="button">
              {validateMutation.isPending ? "Проверяем..." : "Проверить подключение"}
            </button>
            <button className="button button-secondary" disabled={busy || account.credentials_status !== "valid"} onClick={() => syncMutation.mutate()} type="button">
              {syncMutation.isPending ? "Обновляем..." : "Обновить данные"}
            </button>
          </div>

          <form
            className="settings-form integration-rotate-form"
            aria-label={`Новые данные для подключения ${marketplaceName}`}
            onSubmit={(event) => {
              event.preventDefault();
              setLocalError(null);
              if (newCredentials.length >= 8) rotateMutation.mutate();
            }}
          >
            <div className="panel-heading">
              <span className="panel-kicker">Доступ</span>
              <strong>Обновить данные для подключения</strong>
            </div>
            <label>
              {credentialLabel}
              <input autoComplete="off" minLength={8} onChange={(event) => setNewCredentials(event.target.value)} required type="password" value={newCredentials} />
            </label>
            <button className="button button-secondary" disabled={busy || newCredentials.length < 8} type="submit">
              {rotateMutation.isPending ? "Сохраняем..." : "Сохранить новые данные"}
            </button>
          </form>

          <div className="integration-danger-zone">
            <div>
              <strong>Отключить кабинет</strong>
              <p>MPReply перестанет получать новые обращения из этого кабинета. Для повторного подключения понадобятся новые данные доступа.</p>
            </div>
            <button
              className="button button-danger"
              disabled={busy || account.credentials_status === "revoked"}
              onClick={() => {
                setLocalError(null);
                if (window.confirm("Отключить этот кабинет от MPReply?")) revokeMutation.mutate();
              }}
              type="button"
            >
              {revokeMutation.isPending ? "Отключаем..." : "Отключить кабинет"}
            </button>
          </div>

          {mutationError ? (
            <FormError error={mutationError} fallback="Не удалось выполнить действие. Проверьте подключение и попробуйте ещё раз." />
          ) : null}
        </>
      ) : (
        <div className="workspace-inline-state">
          <strong>Настройки доступны владельцу и администратору</strong>
          <p>Для вашей роли доступен просмотр состояния подключения. Изменение настроек и данных доступа недоступно.</p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ account }: { account: MarketplaceAccount }) {
  const hasProblem = hasCurrentIntegrationProblem(account);
  const tone = account.status === "error" || account.credentials_status === "revoked"
    ? "ui-badge-danger"
    : hasProblem
      ? "ui-badge-warning"
      : account.status === "active" && account.credentials_status === "valid"
        ? "ui-badge-success"
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

function FormError({ error, fallback }: { error: unknown; fallback: string }) {
  return <p className="form-error" role="alert">{userErrorMessage(error, fallback)}</p>;
}

function userErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Сессия истекла. Войдите снова.";
    if (error.status === 403) return "Недостаточно прав для этого действия.";
    if (error.status === 404) return "Подключение не найдено. Обновите список и попробуйте снова.";
    if (error.status === 409) return "Данные подключения уже изменились. Обновите страницу и повторите действие.";
    if (error.status === 422) return "Проверьте введённые данные и попробуйте снова.";
    if (error.status === 429) return "Слишком много действий подряд. Подождите немного и попробуйте снова.";
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

function accountStatusLabel(account: MarketplaceAccount): string {
  if (account.credentials_status === "revoked") return "Доступ отозван";
  if (account.status === "error") return "Ошибка";
  if (hasCurrentIntegrationProblem(account)) return "Требует внимания";
  if (account.status === "active" && account.credentials_status === "valid") return "Подключено";
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
  if (Number.isNaN(date.getTime())) return "Дата недоступна";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
