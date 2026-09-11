import type { ZodType } from "zod";

const fallbackApiBaseUrl = "http://localhost:8000";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || fallbackApiBaseUrl).replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly requestId: string | null;

  constructor(message: string, status: number, requestId: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
  }
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

let refreshInFlight: Promise<boolean> | null = null;

export async function apiRequest<T>(
  path: string,
  schema: ZodType<T>,
  options: ApiRequestOptions = {},
): Promise<T> {
  const normalizedPath = normalizePath(path);
  const headers = new Headers(options.headers);
  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const requestInit: RequestInit = {
    ...options,
    body,
    credentials: "include",
    headers,
    cache: "no-store",
  };

  let response = await fetch(`${API_BASE_URL}${normalizedPath}`, requestInit);
  if (response.status === 401 && shouldAttemptSessionRefresh(normalizedPath)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await fetch(`${API_BASE_URL}${normalizedPath}`, requestInit);
    }
  }

  const requestId = response.headers.get("x-request-id");
  const payload: unknown = await readJson(response);

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(payload, response.status), response.status, requestId);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(`Некорректный ответ API (${response.status})`, 502, requestId);
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

async function refreshSession(): Promise<boolean> {
  if (refreshInFlight !== null) return refreshInFlight;

  const refreshRequest = fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  })
    .then((response) => response.ok)
    .catch(() => false)
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
