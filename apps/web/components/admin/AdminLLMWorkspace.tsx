"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { apiRequest } from "../../lib/api/client";
import {
  type LLMModelRoutes,
  type OpenRouterCatalog,
  openRouterCatalogSchema,
  openRouterConfigurationSchema,
} from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const endpoint = "/api/admin/llm/openrouter";

const routeFields: Array<{
  key: keyof LLMModelRoutes;
  label: string;
  helper: string;
}> = [
  { key: "review_model", label: "Обычные отзывы", helper: "Отзывы с оценкой 3–5 и без оценки." },
  { key: "negative_review_model", label: "Негативные отзывы", helper: "Отзывы с оценкой 1–2." },
  { key: "question_model", label: "Вопросы покупателей", helper: "Вопросы о товаре и заказе." },
  { key: "chat_model", label: "Чаты Авито", helper: "Диалоги покупателей в Авито." },
  { key: "safety_retry_model", label: "Повтор после проверки", helper: "Вторая попытка при исправимых рисках или низкой уверенности." },
  { key: "fallback_model", label: "Резервная модель", helper: "Вторая попытка при временной ошибке основной модели." },
];

export function AdminLLMWorkspace() {
  const { user } = useWorkspace();
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [editedRoutes, setEditedRoutes] = useState<LLMModelRoutes | null>(null);
  const [catalog, setCatalog] = useState<OpenRouterCatalog | null>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const configurationQuery = useQuery({
    queryKey: ["admin", "llm", "openrouter"],
    queryFn: () => apiRequest(endpoint, openRouterConfigurationSchema),
    enabled: user.is_superadmin,
  });

  const routes = editedRoutes ?? configurationQuery.data?.routes ?? null;

  const validateMutation = useMutation({
    mutationFn: () => apiRequest(`${endpoint}/validate`, openRouterCatalogSchema, {
      method: "POST",
      body: { api_key: apiKey.trim() },
    }),
    onSuccess: (result) => {
      setCatalog(result);
      setNotice("Ключ принят. Список доступных моделей обновлён.");
    },
    onError: () => setNotice(null),
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest(`${endpoint}/models/refresh`, openRouterCatalogSchema, { method: "POST" }),
    onSuccess: (result) => {
      setCatalog(result);
      setNotice("Список доступных моделей обновлён.");
    },
    onError: () => setNotice(null),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!routes) throw new Error("Маршруты моделей не загружены.");
      const key = apiKey.trim();
      return apiRequest(endpoint, openRouterConfigurationSchema, {
        method: "PUT",
        body: { ...(key ? { api_key: key } : {}), routes },
      });
    },
    onSuccess: (result) => {
      setApiKey("");
      setNotice("Конфигурация сохранена. Новый ключ удалён из поля.");
      queryClient.setQueryData(["admin", "llm", "openrouter"], result);
    },
    onError: () => setNotice(null),
  });

  const disableMutation = useMutation({
    mutationFn: () => apiRequest(`${endpoint}/disable`, openRouterConfigurationSchema, { method: "POST" }),
    onSuccess: (result) => {
      setApiKey("");
      setNotice("Генерация через OpenRouter отключена.");
      queryClient.setQueryData(["admin", "llm", "openrouter"], result);
    },
    onError: () => setNotice(null),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest(`${endpoint}/key`, openRouterConfigurationSchema, { method: "DELETE" }),
    onSuccess: (result) => {
      setApiKey("");
      setCatalog(null);
      setNotice("Локальная копия ключа удалена. В OpenRouter ключ не отозван.");
      queryClient.setQueryData(["admin", "llm", "openrouter"], result);
    },
    onError: () => setNotice(null),
  });

  const mutationError = validateMutation.error
    ?? refreshMutation.error
    ?? saveMutation.error
    ?? disableMutation.error
    ?? deleteMutation.error;
  const isMutating = validateMutation.isPending
    || refreshMutation.isPending
    || saveMutation.isPending
    || disableMutation.isPending
    || deleteMutation.isPending;

  const filteredCatalog = useMemo(() => {
    if (!catalog) return [];
    const normalized = search.trim().toLocaleLowerCase("ru-RU");
    if (!normalized) return catalog.items;
    return catalog.items.filter((item) =>
      item.id.toLocaleLowerCase("ru-RU").includes(normalized)
      || item.name.toLocaleLowerCase("ru-RU").includes(normalized));
  }, [catalog, search]);

  if (!user.is_superadmin) {
    return <div className="workspace-inline-state workspace-inline-state-error"><strong>Доступ запрещён</strong><p>Настройки моделей доступны только внутреннему superadmin.</p></div>;
  }
  if (configurationQuery.isLoading) {
    return <div className="workspace-inline-state"><strong>Загружаем конфигурацию моделей</strong><p>Проверяем сохранённое состояние без чтения ключа.</p></div>;
  }
  if (configurationQuery.error || !configurationQuery.data) {
    return <div className="workspace-inline-state workspace-inline-state-error"><strong>Не удалось загрузить конфигурацию</strong><p>{errorMessage(configurationQuery.error)}</p></div>;
  }

  const configuration = configurationQuery.data;
  const canSave = Boolean(routes)
    && !isMutating
    && (configuration.source !== "none" || apiKey.trim().length >= 16);

  return (
    <section className="admin-llm-workspace" aria-label="Конфигурация OpenRouter">
      <section className="admin-llm-panel">
        <div className="admin-llm-section admin-llm-summary">
          <div className="admin-llm-heading">
            <div>
              <h2>Состояние провайдера</h2>
              <p>Ключ хранится только на backend в зашифрованном виде. Полное значение API не возвращает.</p>
            </div>
            <span className={`ui-badge ${configuration.state === "active" ? "ui-badge-success" : "ui-badge-warning"}`}>
              {stateLabel(configuration.state)}
            </span>
          </div>
          <dl className="admin-llm-meta">
            <div><dt>Источник</dt><dd>{sourceLabel(configuration.source)}</dd></div>
            <div><dt>Отпечаток</dt><dd>{configuration.credential_fingerprint_masked ?? "Нет сохранённого ключа"}</dd></div>
            <div><dt>Последняя проверка</dt><dd>{formatDate(configuration.validated_at)}</dd></div>
          </dl>
        </div>

        <div className="admin-llm-section">
          <div className="admin-llm-heading">
            <div><h2>API-ключ OpenRouter</h2><p>Используйте обычный ключ для генерации. Ключи управления и создания других ключей не принимаются.</p></div>
          </div>
          <div className="admin-llm-key-row">
            <label className="admin-llm-field">
              <span>Новый inference-ключ OpenRouter</span>
              <input
                autoComplete="new-password"
                disabled={isMutating}
                maxLength={512}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Оставьте пустым, чтобы сохранить текущий ключ"
                spellCheck={false}
                type="password"
                value={apiKey}
              />
            </label>
            <button
              className="button button-secondary"
              disabled={isMutating || apiKey.trim().length < 16}
              onClick={() => validateMutation.mutate()}
              type="button"
            >
              {validateMutation.isPending ? "Проверяем..." : "Проверить ключ и модели"}
            </button>
          </div>
        </div>

        <div className="admin-llm-section">
          <div className="admin-llm-heading admin-llm-catalog-heading">
            <div>
              <h2>Маршруты моделей</h2>
              <p>Для одной генерации выполняется не больше двух вызовов: сценарная модель и один резервный маршрут.</p>
            </div>
            <button
              className="button button-secondary button-compact"
              disabled={isMutating || configuration.source === "none" || configuration.state === "disabled"}
              onClick={() => refreshMutation.mutate()}
              type="button"
            >
              {refreshMutation.isPending ? "Обновляем..." : "Обновить модели"}
            </button>
          </div>

          <label className="admin-llm-field admin-llm-search">
            <span>Поиск по каталогу</span>
            <input
              disabled={!catalog}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Название или ID модели"
              type="search"
              value={search}
            />
          </label>
          <p className="admin-llm-catalog-count">
            {catalog ? `Доступно моделей: ${filteredCatalog.length}` : "Обновите каталог или проверьте новый ключ, чтобы увидеть доступные модели."}
          </p>

          {routes ? (
            <div className="admin-llm-routes">
              {routeFields.map((field) => (
                <label className="admin-llm-route" key={field.key}>
                  <span>{field.label}</span>
                  <select
                    disabled={isMutating}
                    onChange={(event) => setEditedRoutes((current) => ({
                      ...(current ?? routes),
                      [field.key]: event.target.value,
                    }))}
                    value={routes[field.key]}
                  >
                    {modelOptions(filteredCatalog, routes[field.key]).map((model) => (
                      <option key={model.id} value={model.id}>{model.name === model.id ? model.id : `${model.name} · ${model.id}`}</option>
                    ))}
                  </select>
                  <small>{field.helper}</small>
                </label>
              ))}
            </div>
          ) : <div className="workspace-inline-state"><strong>Маршруты не настроены</strong><p>Проверьте ключ и выберите модели для всех сценариев.</p></div>}

          <div className="admin-llm-actions">
            <button className="button button-primary" disabled={!canSave} onClick={() => saveMutation.mutate()} type="button">
              {saveMutation.isPending ? "Сохраняем..." : "Сохранить маршруты"}
            </button>
          </div>
        </div>

        <div className="admin-llm-section admin-llm-danger-zone">
          <div className="admin-llm-heading">
            <div>
              <h2>Отключение и удаление</h2>
              <p>Удаление локальной копии не отзывает ключ в OpenRouter. Для полного отзыва удалите ключ отдельно в кабинете провайдера.</p>
            </div>
          </div>
          <div className="admin-llm-actions">
            <button
              className="button button-secondary"
              disabled={isMutating || configuration.state === "disabled"}
              onClick={() => {
                if (window.confirm("Отключить генерацию через OpenRouter для всего сервиса?")) disableMutation.mutate();
              }}
              type="button"
            >Отключить генерацию</button>
            <button
              className="button button-danger"
              disabled={isMutating || configuration.source !== "database"}
              onClick={() => {
                if (window.confirm("Удалить локальную копию ключа? Ключ в OpenRouter останется действующим.")) deleteMutation.mutate();
              }}
              type="button"
            >Удалить локальный ключ</button>
          </div>
        </div>
      </section>

      {notice ? <p className="admin-llm-notice" role="status">{notice}</p> : null}
      {mutationError ? <p className="form-error" role="alert">{errorMessage(mutationError)}</p> : null}
    </section>
  );
}

function modelOptions(catalog: OpenRouterCatalog["items"], currentId: string) {
  const current = catalog.find((item) => item.id === currentId) ?? {
    id: currentId,
    name: currentId,
    input_modalities: ["text"],
    output_modalities: ["text"],
    context_length: null,
    prompt_price: null,
    completion_price: null,
    expiration_date: null,
  };
  return [current, ...catalog.filter((item) => item.id !== currentId)];
}

function stateLabel(state: "active" | "disabled" | "unconfigured") {
  if (state === "active") return "Активен";
  if (state === "disabled") return "Отключён";
  return "Не настроен";
}

function sourceLabel(source: "database" | "environment" | "none") {
  if (source === "database") return "Ключ из админки";
  if (source === "environment") return "Ключ из окружения";
  return "Ключ не настроен";
}

function formatDate(value: string | null) {
  if (!value) return "Не проверялся";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Неизвестная ошибка";
}
