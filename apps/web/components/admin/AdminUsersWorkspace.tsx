"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";

import { ApiError, apiRequest } from "../../lib/api/client";
import type { Locale } from "../../lib/i18n";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const pageSize = 20;
const usersKey = ["admin", "users"] as const;
const userSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string().nullable(),
  status: z.string(),
  is_superadmin: z.boolean(),
  email_verified_at: z.string().nullable(),
  created_at: z.string(),
});
const usersSchema = z.object({ items: z.array(userSchema), total: z.number().int().nonnegative() });

type User = z.infer<typeof userSchema>;
type UserPage = z.infer<typeof usersSchema>;
type Action = "block" | "unblock" | "revoke_sessions";
type Selection = { user: User; action: Action };

const copy = {
  ru: {
    title: "Пользователи",
    search: "Имя или email",
    find: "Найти",
    clear: "Сбросить",
    previous: "Назад",
    next: "Далее",
    pages: "Страницы списка пользователей",
    range: (first: string, last: string, total: string) => `${first}–${last} из ${total}`,
    loading: "Загружаем пользователей…",
    loadError: "Не удалось загрузить пользователей.",
    retry: "Повторить",
    empty: "Зарегистрированных пользователей пока нет.",
    noMatches: "По этому запросу ничего не найдено.",
    active: "Активен",
    blocked: "Заблокирован",
    demo: "Демо",
    inactive: "Неактивен",
    superadmin: "Суперадминистратор",
    unverified: "Email не подтверждён",
    registered: "Регистрация",
    protected: "Защищённый аккаунт",
    cancel: "Отмена",
    saving: "Выполняем…",
    actionError: "Не удалось выполнить действие. Повторите попытку.",
    accessError: "Недостаточно прав для этого действия.",
    changedError: "Данные пользователя изменились. Закройте окно и обновите список.",
    expiredError: "Срок действия вашей сессии истёк. Войдите снова.",
    block: {
      label: "Заблокировать",
      title: "Заблокировать пользователя?",
      description: "Пользователь потеряет доступ к кабинету. Все его сеансы завершатся.",
      success: "Пользователь заблокирован.",
    },
    unblock: {
      label: "Разблокировать",
      title: "Разблокировать пользователя?",
      description: "Пользователь снова сможет войти в кабинет.",
      success: "Пользователь разблокирован.",
    },
    revoke_sessions: {
      label: "Завершить сеансы",
      title: "Завершить все сеансы пользователя?",
      description: "Пользователю потребуется войти заново на всех устройствах.",
      success: "Все сеансы завершены.",
    },
  },
  en: {
    title: "Users",
    search: "Name or email",
    find: "Search",
    clear: "Clear",
    previous: "Previous",
    next: "Next",
    pages: "User list pages",
    range: (first: string, last: string, total: string) => `${first}–${last} of ${total}`,
    loading: "Loading users…",
    loadError: "Could not load users.",
    retry: "Retry",
    empty: "There are no registered users yet.",
    noMatches: "No users match this search.",
    active: "Active",
    blocked: "Blocked",
    demo: "Demo",
    inactive: "Inactive",
    superadmin: "Superadmin",
    unverified: "Email unverified",
    registered: "Registered",
    protected: "Protected account",
    cancel: "Cancel",
    saving: "Applying…",
    actionError: "Could not complete this action. Try again.",
    accessError: "You do not have permission for this action.",
    changedError: "This user’s details have changed. Close the dialog and refresh the list.",
    expiredError: "Your session has expired. Sign in again.",
    block: {
      label: "Block",
      title: "Block this user?",
      description: "The user will lose access to their workspace. All of their sessions will end.",
      success: "User blocked.",
    },
    unblock: {
      label: "Unblock",
      title: "Unblock this user?",
      description: "The user will be able to sign in to their workspace again.",
      success: "User unblocked.",
    },
    revoke_sessions: {
      label: "End sessions",
      title: "End all sessions for this user?",
      description: "The user will need to sign in again on every device.",
      success: "All sessions ended.",
    },
  },
} as const;

export function AdminUsersWorkspace() {
  const { user, locale } = useWorkspace();
  if (!user.is_superadmin) return null;
  return <AdminUsersPanel key={user.id} locale={locale} />;
}

function AdminUsersPanel({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [notice, setNotice] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const number = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const users = useQuery({
    queryKey: [...usersKey, query, offset],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset), q: query });
      return apiRequest(`/api/admin/users?${params}`, usersSchema, { signal });
    },
  });

  useEffect(() => {
    if (!selection && triggerRef.current) {
      const trigger = triggerRef.current;
      (trigger.isConnected ? trigger : headingRef.current)?.focus();
      triggerRef.current = null;
    }
  }, [selection]);
  const mutate = useMutation({
    mutationFn: ({ user, action }: Selection) => apiRequest(`/api/admin/users/${user.id}/actions`, userSchema, {
      method: "POST",
      body: { action },
    }),
    onSuccess: (updated, { action, user }) => {
      queryClient.setQueriesData<UserPage>({ queryKey: usersKey }, (page) => page && ({
        ...page,
        items: page.items.map((item) => item.id === updated.id ? updated : item),
      }));
      void queryClient.invalidateQueries({ queryKey: usersKey });
      setNotice(`${t[action].success} ${user.email}`);
      setSelection(null);
    },
  });

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = search.trim();
    if (value === query && offset === 0) void users.refetch();
    setQuery(value);
    setOffset(0);
    setNotice("");
  }

  function clearSearch() {
    searchRef.current?.focus();
    setSearch("");
    setQuery("");
    setOffset(0);
    setNotice("");
  }

  function changePage(nextOffset: number) {
    headingRef.current?.focus();
    setOffset(nextOffset);
  }

  function select(user: User, action: Action, trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    mutate.reset();
    setNotice("");
    setSelection({ user, action });
  }

  function dismiss() {
    if (mutate.error instanceof ApiError && [403, 404, 409].includes(mutate.error.status)) {
      void users.refetch();
    }
    setSelection(null);
  }

  const data = users.data;
  const first = data?.items.length ? offset + 1 : 0;
  const last = data?.items.length ? offset + data.items.length : 0;

  return (
    <section className="admin-users" id="admin-users" aria-labelledby="admin-users-title">
      <h2 id="admin-users-title" ref={headingRef} tabIndex={-1}>{t.title}</h2>
      <form className="admin-users-search" onSubmit={submitSearch}>
        <label htmlFor="admin-users-search">{t.search}</label>
        <div className="admin-users-search-controls">
          <input
            id="admin-users-search"
            maxLength={320}
            onChange={(event) => setSearch(event.target.value)}
            ref={searchRef}
            type="search"
            value={search}
          />
          <button className="button button-primary button-compact" type="submit">{t.find}</button>
          {search || query ? <button className="button button-secondary button-compact" onClick={clearSearch} type="button">{t.clear}</button> : null}
        </div>
      </form>

      {notice ? <p className="admin-users-notice" role="status">{notice}</p> : null}
      {users.isFetching ? <p className="admin-users-message" role="status">{t.loading}</p> : null}
      {users.error ? (
        <div className="admin-users-message admin-users-error" role="alert">
          <span>{t.loadError}</span>
          <button className="button button-secondary button-compact" disabled={users.isFetching} onClick={() => void users.refetch()} type="button">
            {t.retry}
          </button>
        </div>
      ) : null}
      {data?.items.length ? (
        <ul className="admin-users-list" role="list">
          {data.items.map((user) => {
            const status = user.status === "active" || user.status === "blocked" || user.status === "demo" ? user.status : "inactive";
            return (
              <li className="admin-users-row" key={user.id}>
                <div className="admin-users-identity" id={`admin-user-${user.id}`}>
                  {user.name ? <strong>{user.name}</strong> : null}
                  <span>{user.email}</span>
                  {user.is_superadmin ? <small>{t.superadmin}</small> : null}
                </div>
                <div className="admin-users-account-state">
                  <span className={`admin-users-status admin-users-status-${status}`}>{t[status]}</span>
                  {!user.email_verified_at ? <small>{t.unverified}</small> : null}
                </div>
                <div className="admin-users-date">
                  <small>{t.registered}</small>
                  <time dateTime={user.created_at}>{date.format(new Date(user.created_at))}</time>
                </div>
                <div className="admin-users-row-actions">
                  {user.is_superadmin || status === "demo" ? <span>{t.protected}</span> : (
                    <>
                      {status === "active" || status === "blocked" ? (
                        <button
                          aria-describedby={`admin-user-${user.id}`}
                          className="button button-secondary button-compact"
                          onClick={(event) => select(user, status === "active" ? "block" : "unblock", event.currentTarget)}
                          type="button"
                        >
                          {status === "active" ? t.block.label : t.unblock.label}
                        </button>
                      ) : null}
                      {status !== "blocked" ? (
                        <button
                          aria-describedby={`admin-user-${user.id}`}
                          className="button button-secondary button-compact"
                          onClick={(event) => select(user, "revoke_sessions", event.currentTarget)}
                          type="button"
                        >
                          {t.revoke_sessions.label}
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : data && !offset ? <p className="admin-users-message" role="status">{query ? t.noMatches : t.empty}</p> : null}
      {data && (data.total > 0 || offset > 0) ? (
        <nav aria-label={t.pages} className="admin-users-pagination">
          <span role="status">{t.range(number.format(first), number.format(last), number.format(data.total))}</span>
          <div>
            <button className="button button-secondary button-compact" disabled={offset === 0} onClick={() => changePage(offset - pageSize)} type="button">
              {t.previous}
            </button>
            <button
              className="button button-secondary button-compact"
              disabled={offset + pageSize >= data.total}
              onClick={() => changePage(offset + pageSize)}
              type="button"
            >
              {t.next}
            </button>
          </div>
        </nav>
      ) : null}

      {selection ? (
        <AdminUserActionDialog
          error={mutate.error}
          locale={locale}
          onConfirm={() => mutate.mutate(selection)}
          onDismiss={dismiss}
          pending={mutate.isPending}
          selection={selection}
        />
      ) : null}
    </section>
  );
}

function AdminUserActionDialog({ error, locale, onConfirm, onDismiss, pending, selection }: {
  error: Error | null;
  locale: Locale;
  onConfirm: () => void;
  onDismiss: () => void;
  pending: boolean;
  selection: Selection;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const t = copy[locale];
  const { action, user } = selection;
  const actionCopy = t[action];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  function close() {
    if (pending) return;
    dialogRef.current?.close();
    onDismiss();
  }

  const errorStatus = error instanceof ApiError ? error.status : undefined;
  let errorText: string = t.actionError;
  if (errorStatus === 401) errorText = t.expiredError;
  if (errorStatus === 403) errorText = t.accessError;
  if (errorStatus === 404 || errorStatus === 409) errorText = t.changedError;

  return (
    <dialog
      aria-describedby="admin-user-action-description"
      aria-labelledby="admin-user-action-title"
      className="admin-users-dialog"
      onCancel={(event) => { event.preventDefault(); close(); }}
      ref={dialogRef}
    >
      <h3 id="admin-user-action-title">{actionCopy.title}</h3>
      <div id="admin-user-action-description">
        <strong>{user.email}</strong>
        <p>{actionCopy.description}</p>
      </div>
      {error ? <p className="admin-users-error" role="alert">{errorText}</p> : null}
      <div className="admin-users-dialog-actions">
        <button className="button button-secondary" disabled={pending} onClick={close} type="button">{t.cancel}</button>
        <button
          className={action === "unblock" ? "button button-primary" : "button button-danger"}
          disabled={pending}
          onClick={onConfirm}
          type="button"
        >
          {pending ? t.saving : actionCopy.label}
        </button>
      </div>
    </dialog>
  );
}
