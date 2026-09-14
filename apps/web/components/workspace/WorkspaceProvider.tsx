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

const ACTIVE_ORGANIZATION_KEY = "respio.activeOrganizationId";

type WorkspaceContextValue = {
  user: User;
  organizations: Organization[];
  activeOrganization: Organization;
  setActiveOrganizationId: (organizationId: string) => void;
  logout: () => Promise<void>;
  isLoggingOut: boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [activeOrganizationId, setActiveOrganizationIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACTIVE_ORGANIZATION_KEY);
  });

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
    if (!(userQuery.error instanceof ApiError) || userQuery.error.kind !== "session-expired") return;
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
    onSuccess: async () => {
      window.localStorage.removeItem(ACTIVE_ORGANIZATION_KEY);
      queryClient.clear();
      router.replace("/auth/login");
    },
  });

  function setActiveOrganizationId(organizationId: string) {
    if (!organizationsQuery.data?.some((organization) => organization.id === organizationId)) return;
    window.localStorage.setItem(ACTIVE_ORGANIZATION_KEY, organizationId);
    setActiveOrganizationIdState(organizationId);
  }

  if (userQuery.isPending || (userQuery.isSuccess && organizationsQuery.isPending)) {
    return <WorkspaceBootState title="Загружаем workspace" description="Проверяем сессию и доступные организации." />;
  }

  if (userQuery.error) {
    if (userQuery.error instanceof ApiError && userQuery.error.kind === "session-expired") {
      return <WorkspaceBootState title="Сессия завершена" description="Перенаправляем на страницу входа." />;
    }
    return (
      <WorkspaceBootState
        title="Не удалось загрузить сессию"
        description={errorMessage(userQuery.error)}
        actionLabel="Повторить"
        onAction={() => void userQuery.refetch()}
      />
    );
  }

  if (organizationsQuery.error) {
    return (
      <WorkspaceBootState
        title="Не удалось загрузить организации"
        description={errorMessage(organizationsQuery.error)}
        actionLabel="Повторить"
        onAction={() => void organizationsQuery.refetch()}
      />
    );
  }

  if (!userQuery.data) {
    return <WorkspaceBootState title="Нет данных сессии" description="Повторите вход в аккаунт." />;
  }

  if (!organizationsQuery.data || organizationsQuery.data.length === 0) {
    return <WorkspaceOnboarding user={userQuery.data} />;
  }

  if (!activeOrganization) {
    return <WorkspaceBootState title="Выбираем workspace" description="Подготавливаем рабочее пространство." />;
  }

  return (
    <WorkspaceContext.Provider
      value={{
        user: userQuery.data,
        organizations: organizationsQuery.data,
        activeOrganization,
        setActiveOrganizationId,
        logout: async () => {
          await logoutMutation.mutateAsync();
        },
        isLoggingOut: logoutMutation.isPending,
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
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/organizations", organizationSchema, {
        method: "POST",
        body: { name: name.trim() },
      }),
    onSuccess: async (organization) => {
      window.localStorage.setItem(ACTIVE_ORGANIZATION_KEY, organization.id);
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });

  return (
    <main className="workspace-onboarding-page">
      <section className="workspace-onboarding-card" aria-labelledby="workspace-onboarding-title">
        <p className="eyebrow">Первый workspace</p>
        <h1 id="workspace-onboarding-title">Создайте организацию</h1>
        <p>
          Аккаунт <strong>{user.email}</strong> уже создан. Теперь нужен workspace для интеграций,
          обращений и правил автоответов.
        </p>
        <form
          className="workspace-onboarding-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length >= 2) createMutation.mutate();
          }}
        >
          <label>
            Название организации
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
            {createMutation.isPending ? "Создаём..." : "Создать workspace"}
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
  return error instanceof Error ? error.message : "Неизвестная ошибка";
}
