"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { ApiError, apiRequest, buildApiQuery } from "../../lib/api/client";
import {
  aiDraftListSchema,
  aiDraftSchema,
  customerMessageListSchema,
  manualReplyWorkflowSchema,
  type AIDraft,
  type CustomerMessage,
} from "../../lib/api/schemas";
import { Badge, type BadgeTone } from "../ui/Badge";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const writeRoles = new Set(["owner", "admin", "manager"]);
const aiMessagePageSize = 50;
const toneOptions = [
  { value: "neutral", label: "Нейтральный" },
  { value: "friendly", label: "Доброжелательный" },
  { value: "formal", label: "Официальный" },
  { value: "apologetic", label: "Эмпатичный / с извинением" },
] as const;

type Tone = (typeof toneOptions)[number]["value"];
type ReviewHandoffState =
  | { status: "submitted" }
  | { status: "draft_created"; error: unknown; replyId: string };

export function AIAssistantWorkspace() {
  const { activeOrganization } = useWorkspace();
  const queryClient = useQueryClient();
  const canGenerate = writeRoles.has(activeOrganization.current_user_role);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [messagePage, setMessagePage] = useState(1);
  const [tone, setTone] = useState<Tone>("neutral");
  const [brandRules, setBrandRules] = useState("");
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [latestDraft, setLatestDraft] = useState<AIDraft | null>(null);
  const [reviewHandoff, setReviewHandoff] = useState<ReviewHandoffState | null>(null);
  const generatePanelRef = useRef<HTMLElement>(null);

  const messagesQuery = useQuery({
    queryKey: ["ai-assistant", "messages", activeOrganization.id, messagePage],
    queryFn: () =>
      apiRequest(
        buildApiQuery("/api/messages", {
          organization_id: activeOrganization.id,
          page: messagePage,
          page_size: aiMessagePageSize,
        }),
        customerMessageListSchema,
      ),
  });

  const selectedMessage = useMemo(() => {
    const items = messagesQuery.data?.items ?? [];
    if (items.length === 0) return null;
    return items.find((message) => message.id === selectedMessageId) ?? items[0] ?? null;
  }, [messagesQuery.data?.items, selectedMessageId]);
  const messageTotalPages = messagesQuery.data
    ? Math.max(1, Math.ceil(messagesQuery.data.total / messagesQuery.data.page_size))
    : 1;

  const draftsQuery = useQuery({
    queryKey: ["ai-assistant", "drafts", activeOrganization.id, selectedMessage?.id],
    queryFn: () =>
      apiRequest(
        buildApiQuery("/api/ai/drafts", {
          organization_id: activeOrganization.id,
          message_id: selectedMessage?.id,
        }),
        aiDraftListSchema,
      ),
    enabled: Boolean(selectedMessage),
  });

  const invalidateReplyWork = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["review-queue", activeOrganization.id] }),
      queryClient.invalidateQueries({ queryKey: ["messages", activeOrganization.id] }),
      queryClient.invalidateQueries({ queryKey: ["ai-assistant", "messages", activeOrganization.id] }),
    ]);
  };

  const generateMutation = useMutation({
    mutationFn: () => {
      if (!selectedMessage) throw new Error("Сначала выберите обращение.");
      return apiRequest("/api/ai/drafts/generate", aiDraftSchema, {
        method: "POST",
        body: {
          message_id: selectedMessage.id,
          tone,
          brand_rules: emptyToNull(brandRules),
          knowledge_base: emptyToNull(knowledgeBase),
        },
      });
    },
    onSuccess: async (draft) => {
      setLatestDraft(draft);
      setReviewHandoff(null);
      await queryClient.invalidateQueries({
        queryKey: ["ai-assistant", "drafts", activeOrganization.id, selectedMessage?.id],
      });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ draft, replyText }: { draft: AIDraft; replyText: string }) => {
      if (!selectedMessage || selectedMessage.id !== draft.message_id) {
        throw new Error("Выбранное обращение изменилось. Повторно откройте нужное обращение.");
      }

      const created = await apiRequest("/api/replies/manual", manualReplyWorkflowSchema, {
        method: "POST",
        body: {
          message_id: selectedMessage.id,
          ai_draft_id: draft.id,
          reply_text: replyText.trim(),
        },
      });

      try {
        await apiRequest(`/api/replies/${created.reply.id}/submit-review`, manualReplyWorkflowSchema, {
          method: "POST",
        });
        return { status: "submitted" } as ReviewHandoffState;
      } catch (error) {
        return { status: "draft_created", error, replyId: created.reply.id } as ReviewHandoffState;
      }
    },
    onMutate: () => {
      setReviewHandoff(null);
    },
    onSuccess: async (handoff) => {
      setReviewHandoff(handoff);
      await invalidateReplyWork();
    },
  });

  const retryReviewMutation = useMutation({
    mutationFn: (replyId: string) =>
      apiRequest(`/api/replies/${replyId}/submit-review`, manualReplyWorkflowSchema, { method: "POST" }),
    onSuccess: async () => {
      setReviewHandoff({ status: "submitted" });
      await invalidateReplyWork();
    },
    onError: (error) => {
      setReviewHandoff((current) =>
        current?.status === "draft_created"
          ? { ...current, error }
          : current,
      );
    },
  });

  const displayedDraft = latestDraft?.message_id === selectedMessage?.id
    ? latestDraft
    : draftsQuery.data?.items[0] ?? null;

  function selectMessage(messageId: string) {
    setSelectedMessageId(messageId);
    setLatestDraft(null);
    setReviewHandoff(null);
    generateMutation.reset();
    reviewMutation.reset();
    retryReviewMutation.reset();

    if (!window.matchMedia("(max-width: 760px)").matches) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.requestAnimationFrame(() => {
      generatePanelRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  function changeMessagePage(nextPage: number) {
    setSelectedMessageId(null);
    setLatestDraft(null);
    setReviewHandoff(null);
    generateMutation.reset();
    reviewMutation.reset();
    retryReviewMutation.reset();
    setMessagePage(nextPage);
  }

  return (
    <section className="ai-workspace" aria-labelledby="ai-workspace-title">
      <header className="ai-workspace-toolbar">
        <div>
          <p className="eyebrow">Рабочий процесс</p>
          <h2 id="ai-workspace-title">Обращение → черновик → проверка</h2>
          <p>
            Контекст обращения, настройки ответа и готовый текст остаются рядом — без переключения между экранами.
          </p>
        </div>
        <Badge tone={canGenerate ? "success" : "neutral"}>
          {canGenerate ? "Можно готовить ответы" : "Только просмотр"}
        </Badge>
      </header>

      <div className="ai-workspace-grid">
        <section className="ai-panel ai-message-panel" aria-labelledby="ai-message-list-title">
          <div className="panel-heading panel-heading-row">
            <div>
              <span className="panel-kicker">Шаг 1</span>
              <strong id="ai-message-list-title">Выберите обращение</strong>
            </div>
            {messagesQuery.data ? (
              <div className="ai-message-heading-actions">
                <Badge>{messagesQuery.data.total}</Badge>
                <button
                  className="button button-secondary button-compact"
                  disabled={messagesQuery.isFetching}
                  onClick={() => void messagesQuery.refetch()}
                  type="button"
                >
                  {messagesQuery.isFetching ? "Обновляем..." : "Обновить обращения"}
                </button>
              </div>
            ) : null}
          </div>

          {messagesQuery.error && messagesQuery.data ? (
            <div className="ai-refresh-error" role="alert">
              <div>
                <strong>Не удалось обновить обращения</strong>
                <p>Показываем ранее загруженные обращения. Можно продолжать работу или попробовать обновить ещё раз.</p>
              </div>
              <button
                className="button button-secondary button-compact"
                disabled={messagesQuery.isFetching}
                onClick={() => void messagesQuery.refetch()}
                type="button"
              >
                {messagesQuery.isFetching ? "Повторяем..." : "Повторить"}
              </button>
            </div>
          ) : null}

          {messagesQuery.isPending && !messagesQuery.data ? (
            <AIState
              description="Получаем отзывы, вопросы и сообщения покупателей."
              title="Загружаем обращения"
              tone="loading"
            />
          ) : messagesQuery.error && !messagesQuery.data ? (
            <AIState
              actionDisabled={messagesQuery.isFetching}
              actionLabel={messagesQuery.isFetching ? "Повторяем..." : "Повторить"}
              description={userErrorMessage(messagesQuery.error, "Не удалось загрузить обращения.")}
              onAction={() => void messagesQuery.refetch()}
              title="Не удалось загрузить обращения"
              tone="error"
            />
          ) : !messagesQuery.data || messagesQuery.data.items.length === 0 ? (
            <AIState
              description="После подключения маркетплейса здесь появятся отзывы, вопросы и сообщения, для которых можно подготовить ответ."
              title="Обращений пока нет"
              tone="empty"
            />
          ) : (
            <div className="ai-message-list" role="list">
              {messagesQuery.data.items.map((message) => (
                <div key={message.id} role="listitem">
                  <MessageButton
                    active={selectedMessage?.id === message.id}
                    message={message}
                    onSelect={() => selectMessage(message.id)}
                  />
                </div>
              ))}
            </div>
          )}

          {messagesQuery.data && messageTotalPages > 1 ? (
            <nav className="ai-message-pagination" aria-label="Страницы обращений для подготовки ответа">
              <button
                aria-label="Предыдущая страница обращений"
                className="button button-secondary button-compact"
                disabled={messagePage <= 1 || messagesQuery.isFetching}
                onClick={() => changeMessagePage(Math.max(1, messagePage - 1))}
                type="button"
              >
                Назад
              </button>
              <span aria-live="polite">Страница {messagePage} из {messageTotalPages}</span>
              <button
                aria-label="Следующая страница обращений"
                className="button button-secondary button-compact"
                disabled={messagePage >= messageTotalPages || messagesQuery.isFetching}
                onClick={() => changeMessagePage(Math.min(messageTotalPages, messagePage + 1))}
                type="button"
              >
                Далее
              </button>
            </nav>
          ) : null}
        </section>

        <section ref={generatePanelRef} className="ai-panel ai-generate-panel" aria-labelledby="ai-generate-title">
          <div className="panel-heading">
            <span className="panel-kicker">Шаг 2</span>
            <strong id="ai-generate-title">Контекст и стиль</strong>
          </div>

          {selectedMessage ? (
            <>
              <MessageContext message={selectedMessage} />
              <form
                className="settings-form ai-form"
                aria-label="Настройки подготовки черновика ответа"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (canGenerate) generateMutation.mutate();
                }}
              >
                <label>
                  Тон ответа
                  <select
                    disabled={!canGenerate || generateMutation.isPending}
                    onChange={(event) => setTone(event.target.value as Tone)}
                    value={tone}
                  >
                    {toneOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Как должен звучать ответ
                  <textarea
                    disabled={!canGenerate || generateMutation.isPending}
                    maxLength={2000}
                    onChange={(event) => setBrandRules(event.target.value)}
                    placeholder="Например: обращаться на Вы, не обещать скидки, не использовать эмодзи"
                    value={brandRules}
                  />
                </label>
                <label>
                  Факты для ответа
                  <textarea
                    disabled={!canGenerate || generateMutation.isPending}
                    maxLength={4000}
                    onChange={(event) => setKnowledgeBase(event.target.value)}
                    placeholder="Комплектация, гарантия, доставка или другие факты, которые важно учесть"
                    value={knowledgeBase}
                  />
                </label>
                {generateMutation.error ? (
                  <p className="form-error" role="alert">
                    {userErrorMessage(generateMutation.error, "Не удалось подготовить ответ. Попробуйте ещё раз.")}
                  </p>
                ) : null}
                {canGenerate ? (
                  <button className="button button-primary" disabled={generateMutation.isPending} type="submit">
                    {generateMutation.isPending ? "Готовим ответ..." : "Подготовить черновик"}
                  </button>
                ) : (
                  <p className="ai-readonly-note">
                    С вашим уровнем доступа можно просматривать готовые варианты, но нельзя создавать новые.
                  </p>
                )}
              </form>
            </>
          ) : (
            <AIState
              description="Сначала выберите отзыв, вопрос или сообщение в списке."
              title="Выберите обращение"
              tone="neutral"
            />
          )}
        </section>

        <section className="ai-panel ai-result-panel" aria-labelledby="ai-result-title">
          <div className="panel-heading panel-heading-row">
            <div>
              <span className="panel-kicker">Шаг 3</span>
              <strong id="ai-result-title">Проверьте готовый ответ</strong>
            </div>
            {displayedDraft ? <Badge tone={draftTone(displayedDraft)}>{confidenceLabel(displayedDraft)}</Badge> : null}
          </div>

          {!selectedMessage ? (
            <AIState
              description="Готовый вариант появится после выбора обращения."
              title="Нет выбранного обращения"
              tone="neutral"
            />
          ) : draftsQuery.isPending && !displayedDraft ? (
            <AIState
              description="Получаем ранее подготовленные варианты для этого обращения."
              title="Загружаем готовые варианты"
              tone="loading"
            />
          ) : draftsQuery.error && !displayedDraft ? (
            <AIState
              actionDisabled={draftsQuery.isFetching}
              actionLabel={draftsQuery.isFetching ? "Повторяем..." : "Повторить"}
              description={userErrorMessage(draftsQuery.error, "Не удалось загрузить готовые варианты.")}
              onAction={() => void draftsQuery.refetch()}
              title="Не удалось загрузить готовые варианты"
              tone="error"
            />
          ) : displayedDraft ? (
            <DraftResult
              canManage={canGenerate}
              draft={displayedDraft}
              handoff={reviewHandoff}
              isGenerating={generateMutation.isPending}
              isRetryingReview={retryReviewMutation.isPending}
              isSubmitting={reviewMutation.isPending}
              key={displayedDraft.id}
              onRegenerate={() => generateMutation.mutate()}
              onRetryReview={(replyId) => retryReviewMutation.mutate(replyId)}
              onSubmit={(replyText) => reviewMutation.mutate({ draft: displayedDraft, replyText })}
              submitError={reviewMutation.error}
            />
          ) : (
            <AIState
              description="Подготовьте первый вариант ответа для выбранного обращения."
              title="Готовых вариантов ещё нет"
              tone="empty"
            />
          )}
        </section>
      </div>
    </section>
  );
}

function MessageButton({
  message,
  active,
  onSelect,
}: {
  message: CustomerMessage;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`ai-message-button${active ? " ai-message-button-active" : ""}`}
      onClick={onSelect}
      type="button"
    >
      <span className="ai-message-meta">
        <Badge tone={message.type === "review" ? "info" : "neutral"}>{messageTypeLabel(message.type)}</Badge>
        <span>{marketplaceLabel(message.marketplace)}</span>
        {message.rating !== null ? <span>{message.rating} / 5</span> : null}
      </span>
      <strong>{message.product?.name ?? "Без карточки товара"}</strong>
      <span className="ai-message-preview">{message.customer_text}</span>
    </button>
  );
}

function MessageContext({ message }: { message: CustomerMessage }) {
  return (
    <div className="ai-message-context">
      <div>
        <span>Маркетплейс</span>
        <strong>{marketplaceLabel(message.marketplace)}</strong>
      </div>
      <div>
        <span>Тип</span>
        <strong>{messageTypeLabel(message.type)}</strong>
      </div>
      <div>
        <span>Товар</span>
        <strong>{message.product?.name ?? "Контекст товара отсутствует"}</strong>
      </div>
      <blockquote>{message.customer_text}</blockquote>
    </div>
  );
}

function DraftResult({
  draft,
  canManage,
  isGenerating,
  isRetryingReview,
  isSubmitting,
  handoff,
  submitError,
  onRegenerate,
  onRetryReview,
  onSubmit,
}: {
  draft: AIDraft;
  canManage: boolean;
  isGenerating: boolean;
  isRetryingReview: boolean;
  isSubmitting: boolean;
  handoff: ReviewHandoffState | null;
  submitError: unknown;
  onRegenerate: () => void;
  onRetryReview: (replyId: string) => void;
  onSubmit: (replyText: string) => void;
}) {
  const [replyText, setReplyText] = useState(draft.draft_text);
  const needsReview = draftNeedsReview(draft);
  const isLocked = handoff !== null;

  return (
    <div className="ai-draft-result" aria-live="polite">
      <label className="ai-draft-editor-field">
        <span>Ответ для проверки</span>
        <textarea
          disabled={!canManage || isSubmitting || isLocked}
          maxLength={12000}
          onChange={(event) => setReplyText(event.target.value)}
          value={replyText}
        />
        {canManage && !isLocked ? (
          <small>Отредактируйте текст при необходимости, затем передайте его в раздел «На проверке».</small>
        ) : null}
      </label>

      <div className="ai-draft-flags">
        <Badge tone={needsReview ? "warning" : "success"}>
          {needsReview ? "Нужна дополнительная проверка" : "Проверка пройдена"}
        </Badge>
      </div>

      {handoff?.status === "submitted" ? (
        <div className="ai-review-handoff" role="status">
          <div>
            <span className="panel-kicker">Готово</span>
            <strong>Ответ передан на проверку</strong>
          </div>
          <Link className="button button-primary" href="/app/review-queue">Открыть очередь проверки</Link>
        </div>
      ) : null}

      {handoff?.status === "draft_created" ? (
        <div className="form-error ai-review-handoff" role="alert">
          <div>
            <strong>Ответ сохранён, но пока не передан на проверку</strong>
            <span>{userErrorMessage(handoff.error, "Не удалось передать ответ на проверку. Попробуйте ещё раз.")}</span>
          </div>
          <button
            className="button button-secondary"
            disabled={isRetryingReview}
            onClick={() => onRetryReview(handoff.replyId)}
            type="button"
          >
            {isRetryingReview ? "Передаём..." : "Попробовать ещё раз"}
          </button>
        </div>
      ) : null}

      {submitError ? (
        <p className="form-error" role="alert">
          {userErrorMessage(submitError, "Не удалось сохранить ответ. Попробуйте ещё раз.")}
        </p>
      ) : null}

      {canManage && !isLocked ? (
        <div className="ai-draft-actions">
          <button
            className="button button-secondary"
            disabled={isGenerating || isSubmitting}
            onClick={onRegenerate}
            type="button"
          >
            {isGenerating ? "Готовим вариант..." : "Подготовить другой вариант"}
          </button>
          <button
            className="button button-primary"
            disabled={isGenerating || isSubmitting || replyText.trim().length === 0}
            onClick={() => onSubmit(replyText)}
            type="button"
          >
            {isSubmitting ? "Передаём..." : "Передать на проверку"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AIState({
  actionDisabled = false,
  actionLabel,
  description,
  onAction,
  title,
  tone,
}: {
  actionDisabled?: boolean;
  actionLabel?: string;
  description: string;
  onAction?: () => void;
  title: string;
  tone: "empty" | "error" | "loading" | "neutral";
}) {
  return (
    <div
      aria-busy={tone === "loading"}
      aria-live="polite"
      className={"ai-state ai-state-" + tone}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className="ai-state-mark" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
        {actionLabel && onAction ? (
          <button
            className="button button-secondary button-compact"
            disabled={actionDisabled}
            onClick={onAction}
            type="button"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function messageTypeLabel(value: string): string {
  if (value === "review") return "Отзыв";
  if (value === "question") return "Вопрос";
  if (value === "chat") return "Сообщение";
  return value;
}

function draftNeedsReview(draft: AIDraft): boolean {
  return draft.safety_flags_json.length > 0 || (draft.confidence_score !== null && draft.confidence_score < 0.75);
}

function draftTone(draft: AIDraft): BadgeTone {
  return draftNeedsReview(draft) ? "warning" : "success";
}

function confidenceLabel(draft: AIDraft): string {
  return draftNeedsReview(draft) ? "Проверьте внимательнее" : "Черновик готов";
}

function userErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Сессия истекла. Войдите снова.";
    if (error.status === 403) return "Недостаточно прав для этого действия.";
    if (error.status === 404) return "Нужные данные не найдены. Обновите страницу и попробуйте снова.";
    if (error.status === 409) return "Данные изменились. Обновите страницу и повторите действие.";
    if (error.status === 422) return "Проверьте введённые данные и попробуйте снова.";
    if (error.status === 429) return "Слишком много действий подряд. Подождите немного и попробуйте снова.";
    if (error.status >= 500) return fallback;
    return fallback;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
