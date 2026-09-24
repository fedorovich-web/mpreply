"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { ApiError, apiRequest } from "../../lib/api/client";
import {
  messageResponseSchema,
  organizationListSchema,
  organizationSchema,
  type Organization,
  type User,
  userSchema,
} from "../../lib/api/schemas";
import { PublicBrandMark } from "../public-site/PublicBrandMark";

const ACTIVE_ORGANIZATION_KEY = "mpreply.activeOrganizationId";
const LEGACY_ACTIVE_ORGANIZATION_KEY = "respio.activeOrganizationId";

function readStoredActiveOrganizationId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const current = window.localStorage.getItem(ACTIVE_ORGANIZATION_KEY);
    if (current !== null) return current;

    const legacy = window.localStorage.getItem(LEGACY_ACTIVE_ORGANIZATION_KEY);
    if (legacy === null) return null;

    try {
      window.localStorage.setItem(ACTIVE_ORGANIZATION_KEY, legacy);
      window.localStorage.removeItem(LEGACY_ACTIVE_ORGANIZATION_KEY);
    } catch {
      // Keep the legacy value usable even when storage writes are unavailable.
    }
    return legacy;
  } catch {
    return null;
  }
}

function storeActiveOrganizationId(organizationId: string) {
  try {
    window.localStorage.setItem(ACTIVE_ORGANIZATION_KEY, organizationId);
    window.localStorage.removeItem(LEGACY_ACTIVE_ORGANIZATION_KEY);
  } catch {
    // Organization switching must still work for the current session without storage.
  }
}

function clearStoredActiveOrganizationId() {
  try {
    window.localStorage.removeItem(ACTIVE_ORGANIZATION_KEY);
  } catch {
    // Logout must continue even when storage is unavailable.
  }
  try {
    window.localStorage.removeItem(LEGACY_ACTIVE_ORGANIZATION_KEY);
  } catch {
    // Logout must continue even when legacy storage is unavailable.
  }
}

type WorkspaceContextValue = {
  user: User;
  organizations: Organization[];
  activeOrganization: Organization;
  setActiveOrganizationId: (organizationId: string) => void;
  logout: () => void;
  isLoggingOut: boolean;
  logoutError: string | null;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [activeOrganizationId, setActiveOrganizationIdState] = useState<string | null>(readStoredActiveOrganizationId);

  const userQuery = useQuery({
    queryKey: ["session", "me"],
    queryFn: () => apiRequest("/api/auth/me", userSchema),
  });

  const organizationsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: () => apiRequest("/api/organizations", organizationListSchema),
    enabled: userQuery.isSuccess,
  });

  useEffect(() => {
    if (!(userQuery.error instanceof ApiError) || userQuery.error.status !== 401) return;
    const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/auth/login${next}`);
  }, [pathname, router, userQuery.error]);

  const activeOrganization = useMemo(() => {
    if (!organizationsQuery.data || organizationsQuery.data.length === 0) return null;
    return (
      organizationsQuery.data.find((organization) => organization.id === activeOrganizationId) ??
      organizationsQuery.data[0] ??
      null
    );
  }, [activeOrganizationId, organizationsQuery.data]);

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("/api/auth/logout", messageResponseSchema, { method: "POST" }),
    onSuccess: () => {
      clearStoredActiveOrganizationId();
      queryClient.clear();
      router.replace("/auth/login");
    },
  });

  function setActiveOrganizationId(organizationId: string) {
    if (!organizationsQuery.data?.some((organization) => organization.id === organizationId)) return;
    storeActiveOrganizationId(organizationId);
    setActiveOrganizationIdState(organizationId);
  }

  if (userQuery.isPending || (userQuery.isSuccess && organizationsQuery.isPending)) {
    return <WorkspaceBootState title="Открываем кабинет" description="Загружаем аккаунт и рабочие пространства." />;
  }

  if (userQuery.error) {
    if (userQuery.error instanceof ApiError && userQuery.error.status === 401) {
      return <WorkspaceBootState title="Нужно войти снова" description="Перенаправляем на страницу входа." />;
    }
    return (
      <WorkspaceBootState
        title="Не удалось открыть кабинет"
        description="Повторите загрузку. Если ошибка сохранится, войдите в аккаунт заново."
        actionLabel="Повторить"
        onAction={() => void userQuery.refetch()}
      />
    );
  }

  if (organizationsQuery.error) {
    return (
      <WorkspaceBootState
        title="Не удалось загрузить рабочие пространства"
        description="Повторите попытку. Данные аккаунта останутся без изменений."
        actionLabel="Повторить"
        onAction={() => void organizationsQuery.refetch()}
      />
    );
  }

  if (!userQuery.data) {
    return <WorkspaceBootState title="Не удалось открыть аккаунт" description="Повторите вход в MPReply." />;
  }

  if (!organizationsQuery.data || organizationsQuery.data.length === 0) {
    return <WorkspaceOnboarding user={userQuery.data} />;
  }

  if (!activeOrganization) {
    return <WorkspaceBootState title="Открываем рабочее пространство" description="Подготавливаем данные организации." />;
  }

  return (
    <WorkspaceContext.Provider
      value={{
        user: userQuery.data,
        organizations: organizationsQuery.data,
        activeOrganization,
        setActiveOrganizationId,
        logout: () => logoutMutation.mutate(),
        isLoggingOut: logoutMutation.isPending,
        logoutError: logoutMutation.error ? "Не удалось выйти. Проверьте соединение и попробуйте ещё раз." : null,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return value;
}

function WorkspaceOnboarding({ user }: { user: User }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/organizations", organizationSchema, {
        method: "POST",
        body: { name: name.trim() },
      }),
    onSuccess: async (organization) => {
      storeActiveOrganizationId(organization.id);
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
      router.replace("/app/integrations");
    },
  });

  return (
    <main className="workspace-onboarding-page">
      <section className="workspace-onboarding-card" aria-labelledby="workspace-onboarding-title">
        <div className="workspace-onboarding-brand" aria-label="MPReply">
          <PublicBrandMark />
          <strong>MPReply</strong>
        </div>

        <div className="workspace-onboarding-copy">
          <p className="eyebrow">Первый шаг</p>
          <h1 id="workspace-onboarding-title">Создайте рабочее пространство</h1>
          <p>
            Аккаунт <strong>{user.email}</strong> готов. Назовите магазин, бренд или команду — после этого перейдём к подключению маркетплейсов.
          </p>
        </div>

        <div className="workspace-onboarding-marketplaces" aria-label="Готовые интеграции">
          <div>
            <span>Wildberries</span>
            <span>Ozon</span>
            <span>Яндекс Маркет</span>
            <span>Авито</span>
          </div>
          <small>4 готовые интеграции</small>
        </div>

        <form
          className="workspace-onboarding-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length >= 2) createMutation.mutate();
          }}
        >
          <label>
            Название рабочего пространства
            <input
              autoComplete="organization"
              minLength={2}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например, Seller Group"
              required
              value={name}
            />
          </label>
          {createMutation.error ? <p className="form-error" role="alert">{errorMessage(createMutation.error)}</p> : null}
          <button className="button button-primary" disabled={createMutation.isPending || name.trim().length < 2} type="submit">
            {createMutation.isPending ? "Создаём..." : "Создать и подключить маркетплейсы"}
          </button>
        </form>
      </section>
    </main>
  );
}

function WorkspaceBootState({
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
    <main className="workspace-boot-state">
      <section className="workspace-boot-card" aria-live="polite">
        <span className="workspace-boot-pulse" aria-hidden="true" />
        <h1>{title}</h1>
        <p>{description}</p>
        {actionLabel && onAction ? (
          <button className="button button-secondary" onClick={onAction} type="button">
            {actionLabel}
          </button>
        ) : null}
      </section>
    </main>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Сессия истекла. Войдите снова.";
    if (error.status === 403) return "Недостаточно прав для создания рабочего пространства.";
    if (error.status === 409) return "Такое рабочее пространство уже существует. Измените название и попробуйте снова.";
    if (error.status === 422) return "Проверьте название рабочего пространства.";
    if (error.status === 429) return "Слишком много попыток подряд. Подождите немного и попробуйте снова.";
  }
  return "Не удалось создать рабочее пространство. Проверьте соединение и попробуйте снова.";
}
