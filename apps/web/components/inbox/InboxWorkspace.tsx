"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { ApiError, apiRequest, buildApiQuery } from "../../lib/api/client";
import {
  customerMessageListSchema,
  customerMessageSchema,
  manualReplyWorkflowSchema,
  type CustomerMessage,
} from "../../lib/api/schemas";
import { Badge, type BadgeTone } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { useWorkspace } from "../workspace/WorkspaceProvider";

type MarketplaceFilter = "all" | "wildberries" | "ozon" | "yandex_market" | "avito";
type AssignmentFilter = "all" | "mine";
type MessageTypeFilter = "all" | "review" | "question" | "chat";
type MessageStatusFilter = "all" | "needs_reply" | "ai_draft_ready" | "waiting_review" | "failed" | "escalated";
type RatingFilter = "all" | "negative" | "positive" | "no_rating";

type FilterState = {
  marketplace: MarketplaceFilter;
  assignment: AssignmentFilter;
  type: MessageTypeFilter;
  status: MessageStatusFilter;
  query: string;
  rating: RatingFilter;
};

type MessageUpdate = {
  messageId: string;
  status?: string;
  assignedTo?: string;
};

const writeRoles = new Set(["owner", "admin", "manager"]);
const marketplaceFilters: Array<{ value: MarketplaceFilter; label: string }> = [
  { value: "all", label: "Все" },
  { value: "wildberries", label: "Wildberries" },
  { value: "ozon", label: "Ozon" },
  { value: "yandex_market", label: "Яндекс Маркет" },
  { value: "avito", label: "Авито" },
];

const defaultFilters: FilterState = {
  marketplace: "all",
  assignment: "all",
  type: "all",
  status: "all",
  query: "",
  rating: "all",
};

const messageStatusLabels: Record<string, string> = {
  new: "Новое",
  imported: "Получено",
  needs_reply: "Нужен ответ",
  auto_rule_matched: "Правило найдено",
  auto_reply_pending: "Готовится автоответ",
  ai_draft_ready: "Черновик готов",
  safety_blocked: "Нужна проверка",
  waiting_review: "На проверке",
  needs_manual_check: "Нужна проверка",
  approved: "Одобрено",
  sending: "Отправляется",
  answered: "Отвечено",
  auto_reply_sent: "Отвечено автоматически",
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

class ManualReviewSubmissionError extends Error {
  readonly replyId: string;

  constructor(replyId: string, cause: unknown) {
    super(`Черновик создан, но не удалось передать его на проверку: ${errorMessage(cause)}`);
    this.name = "ManualReviewSubmissionError";
    this.replyId = replyId;
  }
}

export function InboxWorkspace() {
  const queryClient = useQueryClient();
  const { activeOrganization, user } = useWorkspace();
  const canManageMessages = writeRoles.has(activeOrganization.current_user_role);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [selectedId, setSelectedId] = useState("");
  const [restoredOrganizationId, setRestoredOrganizationId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(filters.query.trim());

  useEffect(() => {
    const restored = readStoredFilters(activeOrganization.id);
    setFilters(restored ?? defaultFilters);
    setSelectedId("");
    setRestoredOrganizationId(activeOrganization.id);
  }, [activeOrganization.id]);

  useEffect(() => {
    if (restoredOrganizationId !== activeOrganization.id) return;
    persistFilters(activeOrganization.id, filters);
  }, [activeOrganization.id, filters, restoredOrganizationId]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.marketplace !== "all") count += 1;
    if (filters.assignment !== "all") count += 1;
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
      marketplace: filters.marketplace === "all" ? undefined : filters.marketplace,
      type: filters.type === "all" ? undefined : filters.type,
      status: filters.status === "all" ? undefined : filters.status,
      assigned_to: filters.assignment === "mine" ? user.id : undefined,
      rating_min: ratingMin,
      rating_max: ratingMax,
      search: deferredQuery || undefined,
      page: 1,
      page_size: 100,
    });
  }, [
    activeOrganization.id,
    deferredQuery,
    filters.assignment,
    filters.marketplace,
    filters.rating,
    filters.status,
    filters.type,
    user.id,
  ]);

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
  const displayedTotal = filters.rating === "no_rating" ? visibleMessages.length : messagesQuery.data?.total ?? 0;

  const updateMutation = useMutation({
    mutationFn: ({ messageId, status, assignedTo }: MessageUpdate) =>
      apiRequest(`/api/messages/${messageId}`, customerMessageSchema, {
        method: "PATCH",
        body: {
          ...(status ? { status } : {}),
          ...(assignedTo ? { assigned_to: assignedTo } : {}),
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["messages", activeOrganization.id] });
    },
  });

  const manualDraftMutation = useMutation({
    mutationFn: async ({ messageId, replyText }: { messageId: string; replyText: string }) => {
      const draft = await apiRequest("/api/replies/manual", manualReplyWorkflowSchema, {
        method: "POST",
        body: { message_id: messageId, reply_text: replyText.trim() },
      });

      try {
        return await apiRequest(`/api/replies/${draft.reply.id}/submit-review`, manualReplyWorkflowSchema, {
          method: "POST",
        });
      } catch (error) {
        throw new ManualReviewSubmissionError(draft.reply.id, error);
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["review-queue", activeOrganization.id] }),
        queryClient.invalidateQueries({ queryKey: ["messages", activeOrganization.id] }),
      ]);
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
        <div className="panel-heading panel-heading-row inbox-filter-heading">
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

        <label className="field-group inbox-search-field">
          <span>Поиск</span>
          <input
            aria-label="Поиск по обращениям"
            onChange={(event) => updateFilter("query", event.target.value)}
            placeholder="Товар, SKU или текст"
            type="search"
            value={filters.query}
          />
        </label>

        <FilterGroup label="Площадка">
          {marketplaceFilters.map((option) => (
            <FilterButton
              active={filters.marketplace === option.value}
              key={option.value}
              onClick={() => updateFilter("marketplace", option.value)}
            >
              {option.label}
            </FilterButton>
          ))}
        </FilterGroup>

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

        <FilterGroup label="Ответственный">
          <FilterButton active={filters.assignment === "all"} onClick={() => updateFilter("assignment", "all")}>Все</FilterButton>
          <FilterButton active={filters.assignment === "mine"} onClick={() => updateFilter("assignment", "mine")}>Назначено мне</FilterButton>
        </FilterGroup>

        <FilterGroup label="Оценка">
          <FilterButton active={filters.rating === "all"} onClick={() => updateFilter("rating", "all")}>Все</FilterButton>
          <FilterButton active={filters.rating === "negative"} onClick={() => updateFilter("rating", "negative")}>1–3 звезды</FilterButton>
          <FilterButton active={filters.rating === "positive"} onClick={() => updateFilter("rating", "positive")}>4–5 звёзд</FilterButton>
          <FilterButton active={filters.rating === "no_rating"} onClick={() => updateFilter("rating", "no_rating")}>Без оценки</FilterButton>
        </FilterGroup>
      </aside>

      <section className="inbox-list-panel" aria-label="Список обращений">
        <div className="panel-heading panel-heading-row inbox-list-heading">
          <div>
            <span className="panel-kicker">{displayedTotal} обращений</span>
            <strong>{activeFilterCount > 0 ? "Результаты фильтра" : "Все обращения"}</strong>
          </div>
          <button
            className="button button-secondary button-compact"
            disabled={messagesQuery.isFetching}
            onClick={() => void messagesQuery.refetch()}
            type="button"
          >
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
          <div className="message-stack" role="list">
            {visibleMessages.map((message) => (
              <div key={message.id} role="listitem">
                <MessageCard
                  isSelected={selectedMessage?.id === message.id}
                  message={message}
                  onSelect={() => setSelectedId(message.id)}
                />
              </div>
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
            canManage={canManageMessages}
            createDraftError={
              manualDraftMutation.variables?.messageId === selectedMessage.id ? manualDraftMutation.error : null
            }
            currentUserId={user.id}
            draftRecoveryNeeded={
              manualDraftMutation.variables?.messageId === selectedMessage.id &&
              manualDraftMutation.error instanceof ManualReviewSubmissionError
            }
            draftSubmissionSucceeded={
              manualDraftMutation.variables?.messageId === selectedMessage.id && manualDraftMutation.isSuccess
            }
            error={updateMutation.variables?.messageId === selectedMessage.id ? updateMutation.error : null}
            isCreatingDraft={
              manualDraftMutation.variables?.messageId === selectedMessage.id && manualDraftMutation.isPending
            }
            isUpdating={updateMutation.isPending}
            key={selectedMessage.id}
            message={selectedMessage}
            onArchive={() => updateMutation.mutate({ messageId: selectedMessage.id, status: "archived" })}
            onCreateDraft={(replyText) => manualDraftMutation.mutate({ messageId: selectedMessage.id, replyText })}
            onEscalate={() => updateMutation.mutate({ messageId: selectedMessage.id, status: "escalated" })}
            onTake={() => updateMutation.mutate({ messageId: selectedMessage.id, assignedTo: user.id })}
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
    <button
      aria-pressed={isSelected}
      className={isSelected ? "message-card message-card-selected" : "message-card"}
      onClick={onSelect}
      type="button"
    >
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
  currentUserId,
  canManage,
  isUpdating,
  error,
  isCreatingDraft,
  createDraftError,
  draftSubmissionSucceeded,
  draftRecoveryNeeded,
  onArchive,
  onEscalate,
  onTake,
  onCreateDraft,
}: {
  message: CustomerMessage;
  currentUserId: string;
  canManage: boolean;
  isUpdating: boolean;
  error: unknown;
  isCreatingDraft: boolean;
  createDraftError: unknown;
  draftSubmissionSucceeded: boolean;
  draftRecoveryNeeded: boolean;
  onArchive: () => void;
  onEscalate: () => void;
  onTake: () => void;
  onCreateDraft: (replyText: string) => void;
}) {
  const [replyText, setReplyText] = useState("");
  const canCreateDraft = canManage && !draftSubmissionSucceeded && !draftRecoveryNeeded && ![
    "waiting_review",
    "needs_manual_check",
    "safety_blocked",
    "answered",
    "approved",
    "auto_reply_pending",
    "sending",
    "archived",
    "duplicate",
    "skipped",
    "auto_reply_sent",
    "blocked_by_marketplace",
  ].includes(message.status);
  const isAssignedToCurrentUser = message.assigned_to === currentUserId;

  return (
    <div className="message-detail-card">
      <div className="panel-heading panel-heading-row inbox-detail-heading">
        <div>
          <span className="panel-kicker">{messageTypeLabels[message.type] ?? "Обращение"}</span>
          <strong>{message.product?.name ?? "Товар без карточки"}</strong>
        </div>
        <Badge tone={statusTone(message.status)}>{messageStatusLabels[message.status] ?? message.status}</Badge>
      </div>

      <div className="inbox-next-step" aria-live="polite">
        <span>Следующий шаг</span>
        <strong>{nextStepLabel(message.status)}</strong>
      </div>

      <div className="detail-grid">
        <DetailItem label="Маркетплейс" value={marketplaceLabel(message.marketplace)} />
        <DetailItem label="Тип" value={messageTypeLabels[message.type] ?? message.type} />
        <DetailItem label="Приоритет" value={priorityLabels[message.priority] ?? message.priority} />
        <DetailItem label="Ответственный" value={assignmentLabel(message.assigned_to, currentUserId)} />
      </div>

      <section className="detail-section inbox-customer-context">
        <span>Покупатель</span>
        <p>{message.customer_display_name || "Имя не передано маркетплейсом"}</p>
        {message.rating ? <small>Оценка: {message.rating} из 5</small> : null}
      </section>

      <section className="detail-section inbox-message-context">
        <span>Обращение</span>
        <p>{message.customer_text}</p>
      </section>

      <section className="detail-section inbox-product-context">
        <span>Контекст товара</span>
        <p>
          {message.product
            ? [message.product.name, message.product.sku ? `SKU ${message.product.sku}` : null, message.product.brand].filter(Boolean).join(" · ")
            : "Товар не привязан к обращению."}
        </p>
      </section>

      {message.status === "waiting_review" ? (
        <div className="inbox-review-handoff">
          <div>
            <span className="panel-kicker">Ответ уже на проверке</span>
            <strong>Продолжите работу в разделе «На проверке»</strong>
          </div>
          <Link className="button button-primary" href="/app/review-queue">Открыть очередь проверки</Link>
        </div>
      ) : null}

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
          <small>После отправки ответ попадёт в раздел «На проверке», где его можно проверить и отправить.</small>
          <button
            className="button button-primary"
            disabled={isCreatingDraft || replyText.trim().length === 0}
            onClick={() => onCreateDraft(replyText)}
            type="button"
          >
            {isCreatingDraft ? "Передаём..." : "Передать на проверку"}
          </button>
        </label>
      ) : null}

      {draftSubmissionSucceeded ? (
        <div className="inbox-review-handoff" role="status">
          <div>
            <span className="panel-kicker">Ответ передан на проверку</span>
            <strong>Черновик сохранён и находится в разделе «На проверке»</strong>
          </div>
          <Link className="button button-primary" href="/app/review-queue">Открыть очередь проверки</Link>
        </div>
      ) : null}

      {draftRecoveryNeeded && createDraftError ? (
        <div className="inbox-review-handoff" role="alert">
          <div>
            <span className="panel-kicker">Черновик уже сохранён</span>
            <strong>{errorMessage(createDraftError)}</strong>
            <p>Не создавайте второй ответ: продолжите работу с существующим черновиком в очереди проверки.</p>
          </div>
          <Link className="button button-secondary" href="/app/review-queue">Открыть очередь проверки</Link>
        </div>
      ) : createDraftError ? (
        <p className="form-error" role="alert">{errorMessage(createDraftError)}</p>
      ) : null}

      {!canManage ? (
        <p className="inbox-readonly-note">
          Ваша роль позволяет просматривать обращения, но не менять ответственного, статус или черновик ответа.
        </p>
      ) : null}

      {error ? <p className="form-error" role="alert">{errorMessage(error)}</p> : null}

      {canManage ? (
        <div className="detail-actions inbox-detail-actions">
          {!isAssignedToCurrentUser ? (
            <button className="button button-secondary" disabled={isUpdating} onClick={onTake} type="button">
              Взять себе
            </button>
          ) : null}
          <button className="button button-secondary" disabled={isUpdating || message.status === "escalated"} onClick={onEscalate} type="button">
            Передать менеджеру
          </button>
          <button className="button button-secondary" disabled={isUpdating || message.status === "archived"} onClick={onArchive} type="button">
            Архивировать
          </button>
        </div>
      ) : null}
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
      {actionLabel && onAction ? (
        <button className="button button-secondary button-compact" onClick={onAction} type="button">{actionLabel}</button>
      ) : null}
    </div>
  );
}

function filterStorageKey(organizationId: string): string {
  return `mpreply.inbox.filters.${organizationId}`;
}

function readStoredFilters(organizationId: string): FilterState | null {
  try {
    return readPersistedFilters(window.localStorage.getItem(filterStorageKey(organizationId)));
  } catch {
    return null;
  }
}

function persistFilters(organizationId: string, filters: FilterState) {
  try {
    window.localStorage.setItem(filterStorageKey(organizationId), JSON.stringify(filters));
  } catch {
    // Filter persistence is optional; the current queue must remain usable without browser storage.
  }
}

function readPersistedFilters(raw: string | null): FilterState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<FilterState>;
    if (!isOneOf(value.marketplace, ["all", "wildberries", "ozon", "yandex_market", "avito"])) return null;
    if (!isOneOf(value.assignment, ["all", "mine"])) return null;
    if (!isOneOf(value.type, ["all", "review", "question", "chat"])) return null;
    if (!isOneOf(value.status, ["all", "needs_reply", "ai_draft_ready", "waiting_review", "failed", "escalated"])) return null;
    if (!isOneOf(value.rating, ["all", "negative", "positive", "no_rating"])) return null;
    if (typeof value.query !== "string") return null;
    return value as FilterState;
  } catch {
    return null;
  }
}

function isOneOf<TValue extends string>(value: unknown, allowed: readonly TValue[]): value is TValue {
  return typeof value === "string" && allowed.includes(value as TValue);
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

function assignmentLabel(assignedTo: string | null, currentUserId: string): string {
  if (!assignedTo) return "Не назначено";
  return assignedTo === currentUserId ? "Вы" : "Другой сотрудник";
}

function nextStepLabel(status: string): string {
  if (status === "waiting_review" || status === "needs_manual_check" || status === "safety_blocked") return "Проверить ответ перед отправкой";
  if (status === "failed" || status === "blocked_by_marketplace") return "Разобраться с ошибкой отправки";
  if (status === "answered" || status === "auto_reply_sent") return "Ответ уже отправлен";
  if (status === "archived") return "Обращение находится в архиве";
  if (status === "escalated") return "Менеджеру нужно принять решение";
  if (status === "ai_draft_ready") return "Проверить подготовленный черновик";
  return "Подготовить ответ или передать обращение";
}

function statusTone(status: string): BadgeTone {
  if (["failed", "blocked_by_marketplace", "safety_blocked"].includes(status)) return "danger";
  if (["waiting_review", "needs_manual_check", "escalated"].includes(status)) return "warning";
  if (["answered", "approved", "auto_reply_sent"].includes(status)) return "success";
  if (["needs_reply", "ai_draft_ready"].includes(status)) return "info";
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
