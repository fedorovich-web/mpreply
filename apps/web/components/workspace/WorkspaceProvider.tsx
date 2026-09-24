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
import { localizedPath, type Locale } from "../../lib/i18n";
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
  locale: Locale;
  user: User;
  organizations: Organization[];
  activeOrganization: Organization;
  setActiveOrganizationId: (organizationId: string) => void;
  logout: () => void;
  isLoggingOut: boolean;
  logoutError: string | null;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const workspaceCopy = {
  ru: {
    opening: "Открываем кабинет",
    loadingAccount: "Загружаем аккаунт и рабочие пространства.",
    loginAgain: "Нужно войти снова",
    redirectLogin: "Перенаправляем на страницу входа.",
    openFailed: "Не удалось открыть кабинет",
    openFailedDescription: "Повторите загрузку. Если ошибка сохранится, войдите в аккаунт заново.",
    retry: "Повторить",
    orgsFailed: "Не удалось загрузить рабочие пространства",
    orgsFailedDescription: "Повторите попытку. Данные аккаунта останутся без изменений.",
    accountFailed: "Не удалось открыть аккаунт",
    accountFailedDescription: "Повторите вход в MPReply.",
    openingWorkspace: "Открываем рабочее пространство",
    preparingWorkspace: "Подготавливаем данные организации.",
    logoutFailed: "Не удалось выйти. Проверьте соединение и попробуйте ещё раз.",
    firstStep: "Первый шаг",
    createWorkspace: "Создайте рабочее пространство",
    onboardingText: (email: string) =>
      <>Аккаунт <strong>{email}</strong> готов. Назовите магазин, бренд или команду — после этого перейдём к подключению маркетплейсов.</>,
    readyIntegrations: "Готовые интеграции",
    yandex: "Яндекс Маркет",
    avito: "Авито",
    integrationsCount: "4 готовые интеграции",
    workspaceName: "Название рабочего пространства",
    workspacePlaceholder: "Например, Seller Group",
    creating: "Создаём...",
    createAndConnect: "Создать и подключить маркетплейсы",
  },
  en: {
    opening: "Opening your workspace",
    loadingAccount: "Loading your account and workspaces.",
    loginAgain: "Please log in again",
    redirectLogin: "Redirecting to the login page.",
    openFailed: "Could not open the workspace",
    openFailedDescription: "Try loading again. If the issue continues, log in again.",
    retry: "Retry",
    orgsFailed: "Could not load workspaces",
    orgsFailedDescription: "Try again. Your account data will not be changed.",
    accountFailed: "Could not open the account",
    accountFailedDescription: "Log in to MPReply again.",
    openingWorkspace: "Opening the workspace",
    preparingWorkspace: "Preparing organization data.",
    logoutFailed: "Could not log out. Check your connection and try again.",
    firstStep: "First step",
    createWorkspace: "Create your workspace",
    onboardingText: (email: string) =>
      <>Your account <strong>{email}</strong> is ready. Name the store, brand, or team, then continue to marketplace connections.</>,
    readyIntegrations: "Marketplace integrations",
    yandex: "Yandex Market",
    avito: "Avito",
    integrationsCount: "4 marketplace integrations",
    workspaceName: "Workspace name",
    workspacePlaceholder: "For example, Seller Group",
    creating: "Creating...",
    createAndConnect: "Create workspace and connect marketplaces",
  },
} as const;

export function WorkspaceProvider({
  children,
  locale = "ru",
}: {
  children: React.ReactNode;
  locale?: Locale;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const labels = workspaceCopy[locale];
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
    router.replace(`${localizedPath(locale, "/auth/login")}${next}`);
  }, [locale, pathname, router, userQuery.error]);

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
      router.replace(localizedPath(locale, "/auth/login"));
    },
  });

  function setActiveOrganizationId(organizationId: string) {
    if (!organizationsQuery.data?.some((organization) => organization.id === organizationId)) return;
    storeActiveOrganizationId(organizationId);
    setActiveOrganizationIdState(organizationId);
  }

  if (userQuery.isPending || (userQuery.isSuccess && organizationsQuery.isPending)) {
    return <WorkspaceBootState title={labels.opening} description={labels.loadingAccount} />;
  }

  if (userQuery.error) {
    if (userQuery.error instanceof ApiError && userQuery.error.status === 401) {
      return <WorkspaceBootState title={labels.loginAgain} description={labels.redirectLogin} />;
    }
    return (
      <WorkspaceBootState
        title={labels.openFailed}
        description={labels.openFailedDescription}
        actionLabel={labels.retry}
        onAction={() => void userQuery.refetch()}
      />
    );
  }

  if (organizationsQuery.error) {
    return (
      <WorkspaceBootState
        title={labels.orgsFailed}
        description={labels.orgsFailedDescription}
        actionLabel={labels.retry}
        onAction={() => void organizationsQuery.refetch()}
      />
    );
  }

  if (!userQuery.data) {
    return <WorkspaceBootState title={labels.accountFailed} description={labels.accountFailedDescription} />;
  }

  if (!organizationsQuery.data || organizationsQuery.data.length === 0) {
    return <WorkspaceOnboarding user={userQuery.data} locale={locale} />;
  }

  if (!activeOrganization) {
    return <WorkspaceBootState title={labels.openingWorkspace} description={labels.preparingWorkspace} />;
  }

  return (
    <WorkspaceContext.Provider
      value={{
        locale,
        user: userQuery.data,
        organizations: organizationsQuery.data,
        activeOrganization,
        setActiveOrganizationId,
        logout: () => logoutMutation.mutate(),
        isLoggingOut: logoutMutation.isPending,
        logoutError: logoutMutation.error ? labels.logoutFailed : null,
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

function WorkspaceOnboarding({ user, locale }: { user: User; locale: Locale }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const labels = workspaceCopy[locale];
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
      router.replace(localizedPath(locale, "/app/integrations"));
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
          <p className="eyebrow">{labels.firstStep}</p>
          <h1 id="workspace-onboarding-title">{labels.createWorkspace}</h1>
          <p>{labels.onboardingText(user.email)}</p>
        </div>

        <div className="workspace-onboarding-marketplaces" aria-label={labels.readyIntegrations}>
          <div>
            <span>Wildberries</span>
            <span>Ozon</span>
            <span>{labels.yandex}</span>
            <span>{labels.avito}</span>
          </div>
          <small>{labels.integrationsCount}</small>
        </div>

        <form
          className="workspace-onboarding-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length >= 2) createMutation.mutate();
          }}
        >
          <label>
            {labels.workspaceName}
            <input
              autoComplete="organization"
              minLength={2}
              onChange={(event) => setName(event.target.value)}
              placeholder={labels.workspacePlaceholder}
              required
              value={name}
            />
          </label>
          {createMutation.error ? (
            <p className="form-error" role="alert">{errorMessage(createMutation.error, locale)}</p>
          ) : null}
          <button className="button button-primary" disabled={createMutation.isPending || name.trim().length < 2} type="submit">
            {createMutation.isPending ? labels.creating : labels.createAndConnect}
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

function errorMessage(error: unknown, locale: Locale): string {
  if (locale === "en") {
    if (error instanceof ApiError) {
      if (error.status === 401) return "Your session expired. Log in again.";
      if (error.status === 403) return "You do not have permission to create a workspace.";
      if (error.status === 409) return "A workspace with this name already exists. Change the name and try again.";
      if (error.status === 422) return "Check the workspace name.";
      if (error.status === 429) return "Too many attempts. Wait a moment and try again.";
    }
    return "Could not create the workspace. Check your connection and try again.";
  }

  if (error instanceof ApiError) {
    if (error.status === 401) return "Сессия истекла. Войдите снова.";
    if (error.status === 403) return "Недостаточно прав для создания рабочего пространства.";
    if (error.status === 409) return "Такое рабочее пространство уже существует. Измените название и попробуйте снова.";
    if (error.status === 422) return "Проверьте название рабочего пространства.";
    if (error.status === 429) return "Слишком много попыток подряд. Подождите немного и попробуйте снова.";
  }
  return "Не удалось создать рабочее пространство. Проверьте соединение и попробуйте снова.";
}
