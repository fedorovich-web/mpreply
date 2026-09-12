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

type Notice = {
  tone: "success" | "warning";
  message: string;
};

export function WildberriesIntegrationWorkspace() {
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
    () => (accountsQuery.data ?? []).filter((account) => account.marketplace === "wildberries"),
    [accountsQuery.data],
  );
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null;

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/marketplace-accounts", marketplaceAccountSchema, {
        method: "POST",
        body: {
          organization_id: activeOrganization.id,
          marketplace: "wildberries",
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
      setNotice({ tone: "success", message: "Кабинет добавлен. Проверьте подключение перед первой синхронизацией." });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-accounts", activeOrganization.id] });
    },
  });

  return (
    <section className="wildberries-workspace" aria-label="Управление подключениями Wildberries">
      <div className="integration-security-strip" role="note">
        <strong>API-ключ защищён</strong>
        <span>После сохранения полный ключ больше не показывается. В кабинете остаётся только скрытая маска.</span>
      </div>

      {!canManage ? (
        <div className="workspace-inline-state">
          <strong>Только просмотр</strong>
          <p>Для вашей роли доступно состояние подключений. Изменение настроек, ключей и запуск синхронизации недоступны.</p>
        </div>
      ) : null}

      {notice ? (
        <p className={`integration-notice integration-notice-${notice.tone}`} aria-live="polite">
          {notice.message}
        </p>
      ) : null}

      <div className="wildberries-layout">
        <section className="integration-account-panel" aria-labelledby="wb-account-list-title">
          <div className="panel-heading panel-heading-row">
            <div>
              <span className="panel-kicker">Подключённые кабинеты</span>
              <strong id="wb-account-list-title">Кабинеты Wildberries</strong>
            </div>
            <span className="ui-badge">{accounts.length}</span>
          </div>

          {accountsQuery.isPending ? (
            <WorkspaceState title="Загружаем подключения" description="Получаем кабинеты текущего рабочего пространства." />
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
              description={canManage ? "Добавьте первый кабинет Wildberries в форме ниже." : "В этом рабочем пространстве ещё нет кабинетов Wildberries."}
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
              aria-label="Новое подключение Wildberries"
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
                  placeholder="Например, WB — основной магазин"
                  required
                  value={displayName}
                />
              </label>
              <label>
                Seller ID <span className="field-optional">необязательно</span>
                <input maxLength={255} onChange={(event) => setSellerId(event.target.value)} value={sellerId} />
              </label>
              <label>
                API-ключ Wildberries
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
              {createMutation.error ? <FormError error={createMutation.error} /> : null}
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

        <section className="integration-account-detail" aria-labelledby="wb-account-detail-title">
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
              description={accounts.length === 0 ? "После подключения здесь появятся состояние доступа, синхронизация и настройки." : "Выберите кабинет слева."}
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
        message: result.error_message_safe ?? (result.error_code ? "Не удалось подтвердить доступ к кабинету." : "Подключение работает."),
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
          `Синхронизация завершена: новых обращений ${imported}, обновлено ${updated}, без изменений ${result.skipped}.`,
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
      onNotice({ tone: "success", message: "API-ключ заменён. Проверьте подключение перед следующей синхронизацией." });
      await invalidate();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/marketplace-accounts/${account.id}/revoke-credentials`, marketplaceAccountActionSchema, { method: "POST" }),
    onSuccess: async () => {
      onNotice({ tone: "warning", message: "API-ключ отозван. Кабинет больше не синхронизируется." });
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
          <h2 id="wb-account-detail-title">{account.display_name}</h2>
        </div>
        <StatusBadge account={account} />
      </div>

      <dl className="integration-health-grid">
        <HealthItem label="Состояние доступа" value={credentialsStatusLabel(account.credentials_status)} />
        <HealthItem label="Сохранённый ключ" value={account.credentials_masked} />
        <HealthItem label="Последняя синхронизация" value={formatDateTime(account.last_success_sync_at)} />
        <HealthItem label="Ошибки синхронизации" value={String(account.error_count)} />
      </dl>

      {canManage ? (
        <>
          <form
            className="settings-form integration-detail-form"
            aria-label="Настройки кабинета Wildberries"
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
              Seller ID <span className="field-optional">необязательно</span>
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
              {syncMutation.isPending ? "Синхронизируем..." : "Синхронизировать сейчас"}
            </button>
          </div>

          <form
            className="settings-form integration-rotate-form"
            aria-label="Замена API-ключа Wildberries"
            onSubmit={(event) => {
              event.preventDefault();
              setLocalError(null);
              if (newCredentials.length >= 8) rotateMutation.mutate();
            }}
          >
            <div className="panel-heading">
              <span className="panel-kicker">API-ключ</span>
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
              <strong>Отключить доступ</strong>
              <p>API-ключ будет отозван, и кабинет перестанет синхронизироваться. Для повторного подключения понадобится новый ключ.</p>
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
              {revokeMutation.isPending ? "Отключаем..." : "Отозвать ключ"}
            </button>
          </div>

          {mutationError ? <FormError error={mutationError} /> : null}
        </>
      ) : (
        <div className="workspace-inline-state">
          <strong>Настройки доступны владельцу и администратору</strong>
          <p>Для вашей роли доступен просмотр состояния подключения. Изменение настроек и API-ключа недоступно.</p>
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
  if (error instanceof ApiError) return error.message;
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

function formatDateTime(value: string | null): string {
  if (!value) return "Ещё не было";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
