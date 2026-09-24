"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { ApiError, apiRequest, buildApiQuery } from "../../lib/api/client";
import { localizedPath, type Locale } from "../../lib/i18n";
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
const toneOptions: Record<Locale, ReadonlyArray<{ value: Tone; label: string }>> = {
  ru: [
    { value: "neutral", label: "Нейтральный" },
    { value: "friendly", label: "Доброжелательный" },
    { value: "formal", label: "Официальный" },
    { value: "apologetic", label: "Эмпатичный / с извинением" },
  ],
  en: [
    { value: "neutral", label: "Neutral" },
    { value: "friendly", label: "Friendly" },
    { value: "formal", label: "Formal" },
    { value: "apologetic", label: "Empathetic / apologetic" },
  ],
};

const aiCopy = {
  ru: {
    chooseFirst: "Сначала выберите обращение.",
    changedMessage: "Выбранное обращение изменилось. Повторно откройте нужное обращение.",
    workflow: "Рабочий процесс",
    workflowTitle: "Обращение → черновик → проверка",
    workflowDescription: "Контекст обращения, настройки ответа и готовый текст остаются рядом — без переключения между экранами.",
    canGenerate: "Можно готовить ответы",
    readOnly: "Только просмотр",
    step1: "Шаг 1",
    chooseMessage: "Выберите обращение",
    refreshing: "Обновляем...",
    refreshMessages: "Обновить обращения",
    refreshError: "Не удалось обновить обращения",
    staleMessages: "Показываем ранее загруженные обращения. Можно продолжать работу или попробовать обновить ещё раз.",
    retrying: "Повторяем...",
    retry: "Повторить",
    loadingMessagesDescription: "Получаем отзывы, вопросы и сообщения покупателей.",
    loadingMessages: "Загружаем обращения",
    loadMessagesFallback: "Не удалось загрузить обращения.",
    loadMessagesTitle: "Не удалось загрузить обращения",
    emptyMessagesDescription: "После подключения маркетплейса здесь появятся отзывы, вопросы и сообщения, для которых можно подготовить ответ.",
    emptyMessagesTitle: "Обращений пока нет",
    pagesAria: "Страницы обращений для подготовки ответа",
    previousPage: "Предыдущая страница обращений",
    back: "Назад",
    page: "Страница",
    of: "из",
    nextPage: "Следующая страница обращений",
    next: "Далее",
    step2: "Шаг 2",
    contextStyle: "Контекст и стиль",
    settingsAria: "Настройки подготовки черновика ответа",
    tone: "Тон ответа",
    brandRules: "Как должен звучать ответ",
    brandPlaceholder: "Например: обращаться на Вы, не обещать скидки, не использовать эмодзи",
    facts: "Факты для ответа",
    factsPlaceholder: "Комплектация, гарантия, доставка или другие факты, которые важно учесть",
    generateFallback: "Не удалось подготовить ответ. Попробуйте ещё раз.",
    generating: "Готовим ответ...",
    generate: "Подготовить черновик",
    readonlyNote: "С вашим уровнем доступа можно просматривать готовые варианты, но нельзя создавать новые.",
    chooseFirstDescription: "Сначала выберите отзыв, вопрос или сообщение в списке.",
    step3: "Шаг 3",
    reviewDraft: "Проверьте готовый ответ",
    noSelectionDescription: "Готовый вариант появится после выбора обращения.",
    noSelectionTitle: "Нет выбранного обращения",
    loadingDraftsDescription: "Получаем ранее подготовленные варианты для этого обращения.",
    loadingDraftsTitle: "Загружаем готовые варианты",
    loadDraftsFallback: "Не удалось загрузить готовые варианты.",
    loadDraftsTitle: "Не удалось загрузить готовые варианты",
    noDraftDescription: "Подготовьте первый вариант ответа для выбранного обращения.",
    noDraftTitle: "Готовых вариантов ещё нет",
    noProduct: "Без карточки товара",
    marketplace: "Маркетплейс",
    type: "Тип",
    product: "Товар",
    noProductContext: "Контекст товара отсутствует",
    replyForReview: "Ответ для проверки",
    editHint: "Отредактируйте текст при необходимости, затем передайте его в раздел «На проверке».",
    needsReview: "Нужна дополнительная проверка",
    passed: "Проверка пройдена",
    done: "Готово",
    submitted: "Ответ передан на проверку",
    openReviewQueue: "Открыть очередь проверки",
    draftSavedNotSubmitted: "Ответ сохранён, но пока не передан на проверку",
    handoffFallback: "Не удалось передать ответ на проверку. Попробуйте ещё раз.",
    submitting: "Передаём...",
    tryAgain: "Попробовать ещё раз",
    submitFallback: "Не удалось сохранить ответ. Попробуйте ещё раз.",
    generatingVariant: "Готовим вариант...",
    regenerate: "Подготовить другой вариант",
    submitReview: "Передать на проверку",
    yandex: "Яндекс Маркет",
    avito: "Авито",
    review: "Отзыв",
    question: "Вопрос",
    chat: "Сообщение",
    confidenceReview: "Проверьте внимательнее",
    confidenceReady: "Черновик готов",
    unauthorized: "Сессия истекла. Войдите снова.",
    forbidden: "Недостаточно прав для этого действия.",
    notFound: "Нужные данные не найдены. Обновите страницу и попробуйте снова.",
    conflict: "Данные изменились. Обновите страницу и повторите действие.",
    invalid: "Проверьте введённые данные и попробуйте снова.",
    rateLimit: "Слишком много действий подряд. Подождите немного и попробуйте снова.",
  },
  en: {
    chooseFirst: "Choose a customer message first.",
    changedMessage: "The selected customer message changed. Open the message you want to work with again.",
    workflow: "Workflow",
    workflowTitle: "Customer message → draft → review",
    workflowDescription: "Keep customer context, reply settings, and the prepared text together without switching between screens.",
    canGenerate: "Drafting enabled",
    readOnly: "View only",
    step1: "Step 1",
    chooseMessage: "Choose a customer message",
    refreshing: "Refreshing...",
    refreshMessages: "Refresh messages",
    refreshError: "Could not refresh customer messages",
    staleMessages: "Showing previously loaded messages. You can continue working or try refreshing again.",
    retrying: "Retrying...",
    retry: "Retry",
    loadingMessagesDescription: "Loading reviews, questions, and customer messages.",
    loadingMessages: "Loading messages",
    loadMessagesFallback: "Could not load customer messages.",
    loadMessagesTitle: "Could not load customer messages",
    emptyMessagesDescription: "After a marketplace is connected, supported reviews, questions, and messages that can receive a drafted reply will appear here.",
    emptyMessagesTitle: "No customer messages yet",
    pagesAria: "Customer-message pages for reply drafting",
    previousPage: "Previous customer-message page",
    back: "Back",
    page: "Page",
    of: "of",
    nextPage: "Next customer-message page",
    next: "Next",
    step2: "Step 2",
    contextStyle: "Context and reply style",
    settingsAria: "Reply-draft settings",
    tone: "Reply tone",
    brandRules: "How the reply should sound",
    brandPlaceholder: "For example: use a professional tone, do not promise discounts, avoid emoji",
    facts: "Facts to use in the reply",
    factsPlaceholder: "Package contents, warranty, delivery, or other verified facts the reply should use",
    generateFallback: "Could not prepare a reply. Try again.",
    generating: "Preparing reply...",
    generate: "Prepare draft",
    readonlyNote: "Your access level can view prepared replies but cannot generate new ones.",
    chooseFirstDescription: "Choose a review, question, or customer message from the list first.",
    step3: "Step 3",
    reviewDraft: "Review the prepared reply",
    noSelectionDescription: "A prepared reply will appear after you choose a customer message.",
    noSelectionTitle: "No customer message selected",
    loadingDraftsDescription: "Loading previously prepared drafts for this customer message.",
    loadingDraftsTitle: "Loading prepared drafts",
    loadDraftsFallback: "Could not load prepared drafts.",
    loadDraftsTitle: "Could not load prepared drafts",
    noDraftDescription: "Prepare the first reply draft for the selected customer message.",
    noDraftTitle: "No prepared drafts yet",
    noProduct: "No linked product",
    marketplace: "Marketplace",
    type: "Type",
    product: "Product",
    noProductContext: "Product context unavailable",
    replyForReview: "Reply for review",
    editHint: "Edit the text if needed, then submit it to the review queue.",
    needsReview: "Additional review required",
    passed: "Checks passed",
    done: "Done",
    submitted: "Reply submitted for review",
    openReviewQueue: "Open review queue",
    draftSavedNotSubmitted: "Reply saved but not yet submitted for review",
    handoffFallback: "Could not submit the reply for review. Try again.",
    submitting: "Submitting...",
    tryAgain: "Try again",
    submitFallback: "Could not save the reply. Try again.",
    generatingVariant: "Preparing another draft...",
    regenerate: "Prepare another draft",
    submitReview: "Submit for review",
    yandex: "Yandex Market",
    avito: "Avito",
    review: "Review",
    question: "Question",
    chat: "Message",
    confidenceReview: "Review carefully",
    confidenceReady: "Draft ready",
    unauthorized: "Your session expired. Log in again.",
    forbidden: "You do not have permission for this action.",
    notFound: "The required data could not be found. Refresh the page and try again.",
    conflict: "The data changed. Refresh the page and try again.",
    invalid: "Check the entered data and try again.",
    rateLimit: "Too many actions in a short time. Wait a moment and try again.",
  },
} as const;

type Tone = "neutral" | "friendly" | "formal" | "apologetic";
type ReviewHandoffState =
  | { status: "submitted" }
  | { status: "draft_created"; error: unknown; replyId: string };

export function AIAssistantWorkspace() {
  const { activeOrganization, locale } = useWorkspace();
  const t = aiCopy[locale];
  const localizedToneOptions = toneOptions[locale];
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
      if (!selectedMessage) throw new Error(t.chooseFirst);
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
        throw new Error(t.changedMessage);
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
          <p className="eyebrow">{t.workflow}</p>
          <h2 id="ai-workspace-title">{t.workflowTitle}</h2>
          <p>
            {t.workflowDescription}
          </p>
        </div>
        <Badge tone={canGenerate ? "success" : "neutral"}>
          {canGenerate ? t.canGenerate : t.readOnly}
        </Badge>
      </header>

      <div className="ai-workspace-grid">
        <section className="ai-panel ai-message-panel" aria-labelledby="ai-message-list-title">
          <div className="panel-heading panel-heading-row">
            <div>
              <span className="panel-kicker">{t.step1}</span>
              <strong id="ai-message-list-title">{t.chooseMessage}</strong>
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
                  {messagesQuery.isFetching ? t.refreshing : t.refreshMessages}
                </button>
              </div>
            ) : null}
          </div>

          {messagesQuery.error && messagesQuery.data ? (
            <div className="ai-refresh-error" role="alert">
              <div>
                <strong>{t.refreshError}</strong>
                <p>{t.staleMessages}</p>
              </div>
              <button
                className="button button-secondary button-compact"
                disabled={messagesQuery.isFetching}
                onClick={() => void messagesQuery.refetch()}
                type="button"
              >
                {messagesQuery.isFetching ? t.retrying : t.retry}
              </button>
            </div>
          ) : null}

          {messagesQuery.isPending && !messagesQuery.data ? (
            <AIState
              description={t.loadingMessagesDescription}
              title={t.loadingMessages}
              tone="loading"
            />
          ) : messagesQuery.error && !messagesQuery.data ? (
            <AIState
              actionDisabled={messagesQuery.isFetching}
              actionLabel={messagesQuery.isFetching ? t.retrying : t.retry}
              description={userErrorMessage(messagesQuery.error, t.loadMessagesFallback, locale)}
              onAction={() => void messagesQuery.refetch()}
              title={t.loadMessagesTitle}
              tone="error"
            />
          ) : !messagesQuery.data || messagesQuery.data.items.length === 0 ? (
            <AIState
              description={t.emptyMessagesDescription}
              title={t.emptyMessagesTitle}
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
                    locale={locale}
                  />
                </div>
              ))}
            </div>
          )}

          {messagesQuery.data && messageTotalPages > 1 ? (
            <nav className="ai-message-pagination" aria-label={t.pagesAria}>
              <button
                aria-label={t.previousPage}
                className="button button-secondary button-compact"
                disabled={messagePage <= 1 || messagesQuery.isFetching}
                onClick={() => changeMessagePage(Math.max(1, messagePage - 1))}
                type="button"
              >
                {t.back}
              </button>
              <span aria-live="polite">{t.page} {messagePage} {t.of} {messageTotalPages}</span>
              <button
                aria-label={t.nextPage}
                className="button button-secondary button-compact"
                disabled={messagePage >= messageTotalPages || messagesQuery.isFetching}
                onClick={() => changeMessagePage(Math.min(messageTotalPages, messagePage + 1))}
                type="button"
              >
                {t.next}
              </button>
            </nav>
          ) : null}
        </section>

        <section ref={generatePanelRef} className="ai-panel ai-generate-panel" aria-labelledby="ai-generate-title">
          <div className="panel-heading">
            <span className="panel-kicker">{t.step2}</span>
            <strong id="ai-generate-title">{t.contextStyle}</strong>
          </div>

          {selectedMessage ? (
            <>
              <MessageContext message={selectedMessage} locale={locale} />
              <form
                className="settings-form ai-form"
                aria-label={t.settingsAria}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (canGenerate) generateMutation.mutate();
                }}
              >
                <label>
                  {t.tone}
                  <select
                    disabled={!canGenerate || generateMutation.isPending}
                    onChange={(event) => setTone(event.target.value as Tone)}
                    value={tone}
                  >
                    {localizedToneOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {t.brandRules}
                  <textarea
                    disabled={!canGenerate || generateMutation.isPending}
                    maxLength={2000}
                    onChange={(event) => setBrandRules(event.target.value)}
                    placeholder={t.brandPlaceholder}
                    value={brandRules}
                  />
                </label>
                <label>
                  {t.facts}
                  <textarea
                    disabled={!canGenerate || generateMutation.isPending}
                    maxLength={4000}
                    onChange={(event) => setKnowledgeBase(event.target.value)}
                    placeholder={t.factsPlaceholder}
                    value={knowledgeBase}
                  />
                </label>
                {generateMutation.error ? (
                  <p className="form-error" role="alert">
                    {userErrorMessage(generateMutation.error, t.generateFallback, locale)}
                  </p>
                ) : null}
                {canGenerate ? (
                  <button className="button button-primary" disabled={generateMutation.isPending} type="submit">
                    {generateMutation.isPending ? t.generating : t.generate}
                  </button>
                ) : (
                  <p className="ai-readonly-note">
                    {t.readonlyNote}
                  </p>
                )}
              </form>
            </>
          ) : (
            <AIState
              description={t.chooseFirstDescription}
              title={t.chooseMessage}
              tone="neutral"
            />
          )}
        </section>

        <section className="ai-panel ai-result-panel" aria-labelledby="ai-result-title">
          <div className="panel-heading panel-heading-row">
            <div>
              <span className="panel-kicker">{t.step3}</span>
              <strong id="ai-result-title">{t.reviewDraft}</strong>
            </div>
            {displayedDraft ? <Badge tone={draftTone(displayedDraft)}>{confidenceLabel(displayedDraft, locale)}</Badge> : null}
          </div>

          {!selectedMessage ? (
            <AIState
              description={t.noSelectionDescription}
              title={t.noSelectionTitle}
              tone="neutral"
            />
          ) : draftsQuery.isPending && !displayedDraft ? (
            <AIState
              description={t.loadingDraftsDescription}
              title={t.loadingDraftsTitle}
              tone="loading"
            />
          ) : draftsQuery.error && !displayedDraft ? (
            <AIState
              actionDisabled={draftsQuery.isFetching}
              actionLabel={draftsQuery.isFetching ? t.retrying : t.retry}
              description={userErrorMessage(draftsQuery.error, t.loadDraftsFallback, locale)}
              onAction={() => void draftsQuery.refetch()}
              title={t.loadDraftsTitle}
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
              locale={locale}
            />
          ) : (
            <AIState
              description={t.noDraftDescription}
              title={t.noDraftTitle}
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
  locale,
}: {
  message: CustomerMessage;
  active: boolean;
  onSelect: () => void;
  locale: Locale;
}) {
  const t = aiCopy[locale];
  return (
    <button
      aria-pressed={active}
      className={`ai-message-button${active ? " ai-message-button-active" : ""}`}
      onClick={onSelect}
      type="button"
    >
      <span className="ai-message-meta">
        <Badge tone={message.type === "review" ? "info" : "neutral"}>{messageTypeLabel(message.type, locale)}</Badge>
        <span>{marketplaceLabel(message.marketplace, locale)}</span>
        {message.rating !== null ? <span>{message.rating} / 5</span> : null}
      </span>
      <strong>{message.product?.name ?? t.noProduct}</strong>
      <span className="ai-message-preview">{message.customer_text}</span>
    </button>
  );
}

function MessageContext({ message, locale }: { message: CustomerMessage; locale: Locale }) {
  const t = aiCopy[locale];
  return (
    <div className="ai-message-context">
      <div>
        <span>{t.marketplace}</span>
        <strong>{marketplaceLabel(message.marketplace, locale)}</strong>
      </div>
      <div>
        <span>{t.type}</span>
        <strong>{messageTypeLabel(message.type, locale)}</strong>
      </div>
      <div>
        <span>{t.product}</span>
        <strong>{message.product?.name ?? t.noProductContext}</strong>
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
  locale,
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
  locale: Locale;
}) {
  const t = aiCopy[locale];
  const reviewQueuePath = localizedPath(locale, "/app/review-queue");
  const [replyText, setReplyText] = useState(draft.draft_text);
  const needsReview = draftNeedsReview(draft);
  const isLocked = handoff !== null;

  return (
    <div className="ai-draft-result" aria-live="polite">
      <label className="ai-draft-editor-field">
        <span>{t.replyForReview}</span>
        <textarea
          disabled={!canManage || isSubmitting || isLocked}
          maxLength={12000}
          onChange={(event) => setReplyText(event.target.value)}
          value={replyText}
        />
        {canManage && !isLocked ? (
          <small>{t.editHint}</small>
        ) : null}
      </label>

      <div className="ai-draft-flags">
        <Badge tone={needsReview ? "warning" : "success"}>
          {needsReview ? t.needsReview : t.passed}
        </Badge>
      </div>

      {handoff?.status === "submitted" ? (
        <div className="ai-review-handoff" role="status">
          <div>
            <span className="panel-kicker">{t.done}</span>
            <strong>{t.submitted}</strong>
          </div>
          <Link className="button button-primary" href={reviewQueuePath}>{t.openReviewQueue}</Link>
        </div>
      ) : null}

      {handoff?.status === "draft_created" ? (
        <div className="form-error ai-review-handoff" role="alert">
          <div>
            <strong>{t.draftSavedNotSubmitted}</strong>
            <span>{userErrorMessage(handoff.error, t.handoffFallback, locale)}</span>
          </div>
          <button
            className="button button-secondary"
            disabled={isRetryingReview}
            onClick={() => onRetryReview(handoff.replyId)}
            type="button"
          >
            {isRetryingReview ? t.submitting : t.tryAgain}
          </button>
        </div>
      ) : null}

      {submitError ? (
        <p className="form-error" role="alert">
          {userErrorMessage(submitError, t.submitFallback, locale)}
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
            {isGenerating ? t.generatingVariant : t.regenerate}
          </button>
          <button
            className="button button-primary"
            disabled={isGenerating || isSubmitting || replyText.trim().length === 0}
            onClick={() => onSubmit(replyText)}
            type="button"
          >
            {isSubmitting ? t.submitting : t.submitReview}
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

function marketplaceLabel(value: string, locale: Locale): string {
  const t = aiCopy[locale];
  const labels: Record<string, string> = {
    wildberries: "Wildberries",
    ozon: "Ozon",
    yandex_market: t.yandex,
    avito: t.avito,
  };
  return labels[value] ?? value;
}

function messageTypeLabel(value: string, locale: Locale): string {
  const t = aiCopy[locale];
  if (value === "review") return t.review;
  if (value === "question") return t.question;
  if (value === "chat") return t.chat;
  return value;
}

function draftNeedsReview(draft: AIDraft): boolean {
  return draft.safety_flags_json.length > 0 || (draft.confidence_score !== null && draft.confidence_score < 0.75);
}

function draftTone(draft: AIDraft): BadgeTone {
  return draftNeedsReview(draft) ? "warning" : "success";
}

function confidenceLabel(draft: AIDraft, locale: Locale): string {
  const t = aiCopy[locale];
  return draftNeedsReview(draft) ? t.confidenceReview : t.confidenceReady;
}

function userErrorMessage(error: unknown, fallback: string, locale: Locale): string {
  const t = aiCopy[locale];
  if (error instanceof ApiError) {
    if (error.status === 401) return t.unauthorized;
    if (error.status === 403) return t.forbidden;
    if (error.status === 404) return t.notFound;
    if (error.status === 409) return t.conflict;
    if (error.status === 422) return t.invalid;
    if (error.status === 429) return t.rateLimit;
    if (error.status >= 500) return fallback;
    return fallback;
  }
  return fallback;
}
