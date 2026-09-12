"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState } from "react";

import { ApiError, apiRequest, buildApiQuery } from "../../lib/api/client";
import {
  customerMessageListSchema,
  customerMessageSchema,
  manualReplyWorkflowSchema,
  type CustomerMessage,
} from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { Badge, type BadgeTone } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";

type FilterState = {
  type: "all" | "review" | "question" | "chat";
  status: "all" | "needs_reply" | "ai_draft_ready" | "waiting_review" | "failed" | "escalated";
  query: string;
  rating: "all" | "negative" | "positive" | "no_rating";
};

const defaultFilters: FilterState = {
  type: "all",
  status: "all",
  query: "",
  rating: "all",
};

const messageStatusLabels: Record<string, string> = {
  new: "Новое",
  imported: "Получено",
  needs_reply: "Нужен ответ",
  ai_draft_ready: "Черновик готов",
  waiting_review: "На проверке",
  needs_manual_check: "Нужна проверка",
  approved: "Одобрено",
  sending: "Отправляется",
  answered: "Отвечено",
  failed: "Ошибка",
  escalated: "Передано менеджеру",
  archived: "Архив",
  blocked_by_marketplace: "Заблокировано маркетплейсом",
};

const messageTypeLabels: Record<string, string> = {
  review: "Отзыв",
  question: "Вопрос",
  chat: "Сообщение",
};

const priorityLabels: Record<string, string> = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий",
  urgent: "Срочный",
};

export function InboxWorkspace() {
  const queryClient = useQueryClient();
  const { activeOrganization } = useWorkspace();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [selectedId, setSelectedId] = useState("");
  const deferredQuery = useDeferredValue(filters.query.trim());

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.type !== "all") count += 1;
    if (filters.status !== "all") count += 1;
    if (filters.rating !== "all") count += 1;
    if (filters.query.trim()) count += 1;
    return count;
  }, [filters]);

  const queryPath = useMemo(() => {
    const ratingMin = filters.rating === "positive" ? 4 : undefined;
    const ratingMax = filters.rating === "negative" ? 3 : undefined;
    return buildApiQuery("/api/messages", {
      organization_id: activeOrganization.id,
      type: filters.type === "all" ? undefined : filters.type,
      status: filters.status === "all" ? undefined : filters.status,
      rating_min: ratingMin,
      rating_max: ratingMax,
      search: deferredQuery || undefined,
      page: 1,
      page_size: 100,
    });
  }, [activeOrganization.id, deferredQuery, filters.rating, filters.status, filters.type]);

  const messagesQuery = useQuery({
    queryKey: ["messages", activeOrganization.id, queryPath],
    queryFn: () => apiRequest(queryPath, customerMessageListSchema),
  });

  const visibleMessages = useMemo(() => {
    const items = messagesQuery.data?.items ?? [];
    if (filters.rating !== "no_rating") return items;
    return items.filter((message) => message.rating === null);
  }, [filters.rating, messagesQuery.data?.items]);

  const selectedMessage = visibleMessages.find((message) => message.id === selectedId) ?? visibleMessages[0] ?? null;

  const updateMutation = useMutation({
    mutationFn: ({ messageId, status }: { messageId: string; status: string }) =>
      apiRequest(`/api/messages/${messageId}`, customerMessageSchema, {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["messages", activeOrganization.id] });
    },
  });

  const manualDraftMutation = useMutation({
    mutationFn: ({ messageId, replyText }: { messageId: string; replyText: string }) =>
      apiRequest("/api/replies/manual", manualReplyWorkflowSchema, {
        method: "POST",
        body: { message_id: messageId, reply_text: replyText.trim() },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["review-queue", activeOrganization.id] });
      await queryClient.invalidateQueries({ queryKey: ["messages", activeOrganization.id] });
    },
  });

  function updateFilter<TKey extends keyof FilterState>(key: TKey, value: FilterState[TKey]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters(defaultFilters);
  }

  return (
    <section className="inbox-workspace" aria-label="Рабочая область обращений">
      <aside className="inbox-filters-panel" aria-label="Фильтры обращений">
        <div className="panel-heading panel-heading-row">
          <div>
            <span className="panel-kicker">Фильтры</span>
            <strong>Очередь обращений</strong>
          </div>
          {activeFilterCount > 0 ? (
            <button className="button button-secondary button-compact" onClick={resetFilters} type="button">
              Сбросить · {activeFilterCount}
            </button>
          ) : null}
        </div>

        <label className="field-group">
          <span>Поиск</span>
          <input
            aria-label="Поиск по обращениям"
            onChange={(event) => updateFilter("query", event.target.value)}
            placeholder="Товар, SKU или текст"
            type="search"
            value={filters.query}
          />
        </label>

        <FilterGroup label="Тип обращения">
          <FilterButton active={filters.type === "all"} onClick={() => updateFilter("type", "all")}>Все</FilterButton>
          <FilterButton active={filters.type === "review"} onClick={() => updateFilter("type", "review")}>Отзывы</FilterButton>
          <FilterButton active={filters.type === "question"} onClick={() => updateFilter("type", "question")}>Вопросы</FilterButton>
          <FilterButton active={filters.type === "chat"} onClick={() => updateFilter("type", "chat")}>Сообщения</FilterButton>
        </FilterGroup>

        <FilterGroup label="Статус">
          <FilterButton active={filters.status === "all"} onClick={() => updateFilter("status", "all")}>Все</FilterButton>
          <FilterButton active={filters.status === "needs_reply"} onClick={() => updateFilter("status", "needs_reply")}>Нужен ответ</FilterButton>
          <FilterButton active={filters.status === "ai_draft_ready"} onClick={() => updateFilter("status", "ai_draft_ready")}>Черновик готов</FilterButton>
          <FilterButton active={filters.status === "waiting_review"} onClick={() => updateFilter("status", "waiting_review")}>На проверке</FilterButton>
          <FilterButton active={filters.status === "failed"} onClick={() => updateFilter("status", "failed")}>Ошибки</FilterButton>
          <FilterButton active={filters.status === "escalated"} onClick={() => updateFilter("status", "escalated")}>У менеджера</FilterButton>
        </FilterGroup>

        <FilterGroup label="Оценка">
          <FilterButton active={filters.rating === "all"} onClick={() => updateFilter("rating", "all")}>Все</FilterButton>
          <FilterButton active={filters.rating === "negative"} onClick={() => updateFilter("rating", "negative")}>1–3 звезды</FilterButton>
          <FilterButton active={filters.rating === "positive"} onClick={() => updateFilter("rating", "positive")}>4–5 звёзд</FilterButton>
          <FilterButton active={filters.rating === "no_rating"} onClick={() => updateFilter("rating", "no_rating")}>Без оценки</FilterButton>
        </FilterGroup>
      </aside>

      <section className="inbox-list-panel" aria-label="Список обращений">
        <div className="panel-heading panel-heading-row">
          <div>
            <span className="panel-kicker">{messagesQuery.data?.total ?? 0} обращений</span>
            <strong>{activeFilterCount > 0 ? "Результаты фильтра" : "Все входящие"}</strong>
          </div>
          <button className="button button-secondary button-compact" disabled={messagesQuery.isFetching} onClick={() => void messagesQuery.refetch()} type="button">
            {messagesQuery.isFetching ? "Обновляем..." : "Обновить"}
          </button>
        </div>

        {messagesQuery.isPending ? (
          <InboxState title="Загружаем обращения" description="Получаем обращения из подключённых маркетплейсов." />
        ) : messagesQuery.error ? (
          <InboxState
            title="Не удалось загрузить обращения"
            description={errorMessage(messagesQuery.error)}
            actionLabel="Повторить"
            onAction={() => void messagesQuery.refetch()}
          />
        ) : visibleMessages.length > 0 ? (
          <div className="message-stack">
            {visibleMessages.map((message) => (
              <MessageCard
                isSelected={selectedMessage?.id === message.id}
                key={message.id}
                message={message}
                onSelect={() => setSelectedId(message.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            description={activeFilterCount > 0 ? "Сбросьте часть фильтров или измените поиск." : "Новые обращения появятся здесь после синхронизации подключённых площадок."}
            title={activeFilterCount > 0 ? "По выбранным условиям ничего не найдено" : "В очереди пока нет обращений"}
          />
        )}
      </section>

      <aside className="inbox-detail-panel" aria-label="Карточка выбранного обращения">
        {selectedMessage ? (
          <MessageDetail
            createDraftError={manualDraftMutation.error}
            isCreatingDraft={manualDraftMutation.isPending}
            error={updateMutation.error}
            isUpdating={updateMutation.isPending}
            key={selectedMessage.id}
            message={selectedMessage}
            onArchive={() => updateMutation.mutate({ messageId: selectedMessage.id, status: "archived" })}
            onCreateDraft={(replyText) => manualDraftMutation.mutate({ messageId: selectedMessage.id, replyText })}
            onEscalate={() => updateMutation.mutate({ messageId: selectedMessage.id, status: "escalated" })}
          />
        ) : (
          <EmptyState description="Выберите обращение из списка, чтобы увидеть контекст и действия." title="Обращение не выбрано" />
        )}
      </aside>
    </section>
  );
}

function FilterGroup({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="filter-group">
      <span>{label}</span>
      <div className="filter-chip-list">{children}</div>
    </div>
  );
}

function FilterButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button aria-pressed={active} className={active ? "filter-chip filter-chip-active" : "filter-chip"} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function MessageCard({ isSelected, message, onSelect }: { isSelected: boolean; message: CustomerMessage; onSelect: () => void }) {
  return (
    <button className={isSelected ? "message-card message-card-selected" : "message-card"} onClick={onSelect} type="button">
      <span className="message-card-topline">
        <Badge tone="info">{marketplaceLabel(message.marketplace)}</Badge>
        <Badge tone={statusTone(message.status)}>{messageStatusLabels[message.status] ?? message.status}</Badge>
      </span>
      <span className="message-card-title">{message.product?.name ?? "Товар без карточки"}</span>
      <span className="message-card-text">{message.customer_text}</span>
      <span className="message-card-meta">
        <span>{messageTypeLabels[message.type] ?? message.type}</span>
        <span>{message.rating ? `${message.rating}★` : "без оценки"}</span>
        <span>{formatDate(message.marketplace_created_at)}</span>
      </span>
    </button>
  );
}

function MessageDetail({
  message,
  isUpdating,
  error,
  isCreatingDraft,
  createDraftError,
  onArchive,
  onEscalate,
  onCreateDraft,
}: {
  message: CustomerMessage;
  isUpdating: boolean;
  error: unknown;
  isCreatingDraft: boolean;
  createDraftError: unknown;
  onArchive: () => void;
  onEscalate: () => void;
  onCreateDraft: (replyText: string) => void;
}) {
  const [replyText, setReplyText] = useState("");
  const canCreateDraft = !["answered", "approved", "sending", "archived", "duplicate", "skipped"].includes(message.status);

  return (
    <div className="message-detail-card">
      <div className="panel-heading panel-heading-row">
        <div>
          <span className="panel-kicker">{messageTypeLabels[message.type] ?? "Обращение"}</span>
          <strong>{message.product?.name ?? "Товар без карточки"}</strong>
        </div>
        <Badge tone={statusTone(message.status)}>{messageStatusLabels[message.status] ?? message.status}</Badge>
      </div>

      <div className="detail-grid">
        <DetailItem label="Маркетплейс" value={marketplaceLabel(message.marketplace)} />
        <DetailItem label="Тип" value={messageTypeLabels[message.type] ?? message.type} />
        <DetailItem label="Приоритет" value={priorityLabels[message.priority] ?? message.priority} />
        <DetailItem label="Оценка" value={message.rating ? `${message.rating} из 5` : "—"} />
      </div>

      <section className="detail-section">
        <span>Покупатель</span>
        <p>{message.customer_display_name || "Имя не передано маркетплейсом"}</p>
      </section>

      <section className="detail-section">
        <span>Обращение</span>
        <p>{message.customer_text}</p>
      </section>

      <section className="detail-section">
        <span>Контекст товара</span>
        <p>
          {message.product
            ? [message.product.name, message.product.sku ? `SKU ${message.product.sku}` : null, message.product.brand].filter(Boolean).join(" · ")
            : "Товар не привязан к обращению."}
        </p>
      </section>

      {canCreateDraft ? (
        <label className="review-editor-field inbox-manual-draft-field">
          <span>Ответ для проверки</span>
          <textarea
            disabled={isCreatingDraft}
            maxLength={12000}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder="Введите ответ или отредактируйте подготовленный текст"
            value={replyText}
          />
          <button
            className="button button-primary"
            disabled={isCreatingDraft || replyText.trim().length === 0}
            onClick={() => onCreateDraft(replyText)}
            type="button"
          >
            {isCreatingDraft ? "Сохраняем..." : "Передать на проверку"}
          </button>
        </label>
      ) : null}

      {createDraftError ? <p className="form-error" role="alert">{errorMessage(createDraftError)}</p> : null}
      {error ? <p className="form-error" role="alert">{errorMessage(error)}</p> : null}

      <div className="detail-actions">
        <button className="button button-primary" disabled={isUpdating || message.status === "escalated"} onClick={onEscalate} type="button">
          Передать менеджеру
        </button>
        <button className="button button-secondary" disabled={isUpdating || message.status === "archived"} onClick={onArchive} type="button">
          Архивировать
        </button>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InboxState({
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
      {actionLabel && onAction ? <button className="button button-secondary button-compact" onClick={onAction} type="button">{actionLabel}</button> : null}
    </div>
  );
}

function marketplaceLabel(value: string): string {
  const labels: Record<string, string> = {
    wildberries: "Wildberries",
    ozon: "Ozon",
    yandex_market: "Яндекс Маркет",
    avito: "Авито",
  };
  return labels[value] ?? value;
}

function statusTone(status: string): BadgeTone {
  if (["failed", "blocked_by_marketplace", "safety_blocked"].includes(status)) return "danger";
  if (["waiting_review", "needs_manual_check", "escalated"].includes(status)) return "warning";
  if (["answered", "approved", "auto_reply_sent"].includes(status)) return "success";
  return "neutral";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "Неизвестная ошибка";
}
