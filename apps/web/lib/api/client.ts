import type { ZodType } from "zod";

const localDevelopmentApiBaseUrl = "http://localhost:8000";
const csrfHeaderValue = "1";
const csrfProtectedMethods = new Set(["DELETE", "PATCH", "POST", "PUT"]);

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

export class ApiError extends Error {
  readonly status: number;
  readonly requestId: string | null;
  readonly kind: "request" | "invalid-response" | "session-expired" | "session-refresh-unavailable";

  constructor(
    message: string,
    status: number,
    requestId: string | null = null,
    kind: ApiError["kind"] = "request",
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
    this.kind = kind;
  }
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

type SessionRefreshResult = "refreshed" | "expired" | "unavailable";

let refreshInFlight: Promise<SessionRefreshResult> | null = null;

function resolveApiBaseUrl(configuredValue: string | undefined): string {
  const configuredOrigin = configuredValue?.trim();
  if (!configuredOrigin && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is required in production");
  }
  const value = configuredOrigin || localDevelopmentApiBaseUrl;
  const url = new URL(value);
  const isLocalDevelopment =
    url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  const isProductionOrigin = url.protocol === "https:" && url.port === "";
  if (
    (!isProductionOrigin && !isLocalDevelopment) ||
    url.username !== "" ||
    url.password !== "" ||
    (url.pathname !== "" && url.pathname !== "/") ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must be an HTTPS origin or a local development origin");
  }
  return url.origin;
}

export async function apiRequest<T>(
  path: string,
  schema: ZodType<T>,
  options: ApiRequestOptions = {},
): Promise<T> {
  const apiBaseUrl = resolveApiBaseUrl(configuredApiBaseUrl);
  const normalizedPath = normalizePath(path);
  const headers = new Headers(options.headers);
  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }
  if (csrfProtectedMethods.has((options.method ?? "GET").toUpperCase())) {
    headers.set("X-CSRF-Token", csrfHeaderValue);
  }

  const requestInit: RequestInit = {
    ...options,
    body,
    credentials: "include",
    headers,
    cache: "no-store",
  };

  let response = await fetch(`${apiBaseUrl}${normalizedPath}`, requestInit);
  if (response.status === 401 && shouldAttemptSessionRefresh(normalizedPath)) {
    const refreshResult = await refreshSession();
    if (refreshResult === "unavailable") {
      throw new ApiError(
        "Не удалось проверить сессию. Повторите попытку позже.",
        response.status,
        response.headers.get("x-request-id"),
        "session-refresh-unavailable",
      );
    }
    if (refreshResult === "expired") {
      throw new ApiError(
        "Сессия истекла. Войдите снова.",
        response.status,
        response.headers.get("x-request-id"),
        "session-expired",
      );
    }

    response = await fetch(`${apiBaseUrl}${normalizedPath}`, requestInit);
    if (response.status === 401) {
      throw new ApiError(
        "Сессия истекла. Войдите снова.",
        response.status,
        response.headers.get("x-request-id"),
        "session-expired",
      );
    }
  }

  const requestId = response.headers.get("x-request-id");
  const payload: unknown = await readJson(response);

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(payload, response.status), response.status, requestId);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(`Некорректный ответ API (${response.status})`, 502, requestId, "invalid-response");
  }

  return parsed.data;
}

export function buildApiQuery(path: string, params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${normalizePath(path)}?${query}` : normalizePath(path);
}

function shouldAttemptSessionRefresh(path: string): boolean {
  if (!path.startsWith("/api/auth/")) return true;
  return path === "/api/auth/me" || path === "/api/auth/change-password";
}

async function refreshSession(): Promise<SessionRefreshResult> {
  if (refreshInFlight !== null) return refreshInFlight;

  const apiBaseUrl = resolveApiBaseUrl(configuredApiBaseUrl);
  const refreshRequest = fetch(`${apiBaseUrl}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-Token": csrfHeaderValue },
    cache: "no-store",
  })
    .then((response): SessionRefreshResult => {
      if (response.ok) return "refreshed";
      return response.status === 401 ? "expired" : "unavailable";
    })
    .catch((): SessionRefreshResult => "unavailable")
    .finally(() => {
      if (refreshInFlight === refreshRequest) {
        refreshInFlight = null;
      }
    });

  refreshInFlight = refreshRequest;
  return refreshRequest;
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractErrorMessage(payload: unknown, status: number): string {
  if (typeof payload === "object" && payload !== null && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail) && detail.length > 0) return "Проверьте заполнение полей и повторите запрос.";
  }

  if (typeof payload === "string" && payload.trim()) return payload;
  if (status === 401) return "Сессия истекла. Войдите снова.";
  if (status === 403) return "Недостаточно прав для этой операции.";
  if (status === 404) return "Запрошенный ресурс не найден.";
  if (status === 409) return "Данные изменились. Обновите страницу и повторите действие.";
  return `Ошибка API (${status})`;
}
