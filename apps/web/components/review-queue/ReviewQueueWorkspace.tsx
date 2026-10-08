"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { ApiError, apiRequest, buildApiQuery } from "../../lib/api/client";
import type { Locale } from "../../lib/i18n";
import {
  manualReplySendSchema,
  manualReplyWorkflowSchema,
  replySchema,
  reviewQueueListSchema,
  type ReviewQueueItem,
} from "../../lib/api/schemas";
import { Badge, type BadgeTone } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const writeRoles = new Set(["owner", "admin", "manager"]);
const reviewQueuePageSize = 20;

const statusLabels: Record<Locale, Record<string, string>> = {
  ru: {
    draft: "Черновик",
    manual_review_required: "Требует правок",
    waiting_review: "На проверке",
    approved: "Одобрено",
    queued: "В очереди",
    sending: "Отправляется",
    sent: "Отправлено",
  },
  en: {
    draft: "Draft",
    manual_review_required: "Needs changes",
    waiting_review: "Needs review",
    approved: "Approved",
    queued: "Queued",
    sending: "Sending",
    sent: "Sent",
  },
};

const attentionReasonLabels: Record<Locale, Record<string, string>> = {
  ru: {
    missing_product_context: "Не хватает контекста товара для уверенного ответа.",
    low_confidence: "Черновик требует ручной проверки перед отправкой.",
    risky_promise: "В тексте есть обещание результата, которое нужно проверить.",
    medical_or_legal_claim: "В тексте есть медицинская или юридическая формулировка, требующая проверки.",
    personal_data_exposure: "В тексте могут быть персональные контактные данные.",
    unclear_customer_issue: "Недостаточно ясно, какой вопрос покупателя нужно решить.",
    needs_manual_review: "Ответ помечен для ручной проверки.",
    sensitive_topic: "Тема обращения требует ручного решения.",
    unsafe_instruction: "В тексте обнаружена потенциально небезопасная формулировка.",
    policy_violation: "Ответ требует проверки на соответствие правилам.",
    negative_review: "Низкая оценка покупателя требует особенно внимательного ответа.",
  },
  en: {
    missing_product_context: "There is not enough product context for a confident reply.",
    low_confidence: "The draft needs manual review before sending.",
    risky_promise: "The draft contains a promise that should be checked before sending.",
    medical_or_legal_claim: "The draft includes medical or legal wording that requires review.",
    personal_data_exposure: "The draft may contain personal contact information.",
    unclear_customer_issue: "It is not clear enough which customer issue needs to be resolved.",
    needs_manual_review: "The reply has been marked for manual review.",
    sensitive_topic: "This customer message needs a person to make the final decision.",
    unsafe_instruction: "Potentially unsafe wording was detected in the draft.",
    policy_violation: "The reply needs a policy review.",
    negative_review: "A low customer rating calls for a more careful reply.",
  },
};

const reviewCopy = {
  ru: {
    loadingDescription: "Получаем ответы, которые требуют решения перед отправкой.",
    loadingTitle: "Загружаем очередь проверки",
    retrying: "Повторяем...",
    retry: "Повторить",
    loadErrorTitle: "Не удалось загрузить очередь проверки",
    previousPage: "Предыдущая страница",
    previousDescription: "Вернитесь на предыдущую страницу очереди.",
    noMoreTitle: "На этой странице больше нет ответов",
    emptyTitle: "На проверке ничего нет",
    emptyDescription: "Здесь появятся ответы, которые нужно проверить, исправить или подтвердить перед отправкой.",
    workspaceAria: "Очередь ручной проверки",
    listAria: "Обращения на проверке",
    replies: "ответов",
    refreshing: "Обновляем...",
    refresh: "Обновить",
    refreshError: "Не удалось обновить очередь проверки",
    staleData: "Показываем последнюю успешно загруженную версию очереди.",
    noProduct: "Товар без карточки",
    noRating: "без оценки",
    pagesAria: "Страницы очереди проверки",
    previous: "Назад",
    page: "Страница",
    of: "из",
    nextPage: "Следующая страница",
    next: "Далее",
    replyForReview: "Ответ на проверке",
    customerMessage: "Обращение покупателя",
    productContext: "Контекст товара",
    customerReply: "Ответ покупателю",
    attentionReason: "Причина внимания",
    decisionStatus: "Статус решения",
    whyAttention: "Почему требуется внимание",
    workflowAria: "Этапы проверки ответа",
    nextStep: "Что произойдёт дальше",
    rejectionReason: "Причина возврата на доработку",
    rejectionPlaceholder: "Укажите, что именно нужно исправить",
    readOnly: "Ваша роль позволяет просматривать очередь и контекст ответа, но не редактировать, одобрять, возвращать или отправлять ответы.",
    saving: "Сохраняем...",
    save: "Сохранить правки",
    submitting: "Передаём...",
    submit: "Передать на проверку",
    approving: "Одобряем...",
    approve: "Одобрить ответ",
    rejecting: "Возвращаем...",
    reject: "Вернуть на доработку",
    queueing: "Ставим в очередь...",
    send: "Отправить в маркетплейс",
    blockSummary: "Ответ нельзя отправлять в текущем виде. Проверьте причину и исправьте текст перед следующим шагом.",
    manualSummary: "Ответ требует решения сотрудника перед отправкой покупателю.",
    waitingSummary: "Черновик подготовлен и ждёт одобрения или возврата на доработку.",
    approvedSummary: "Ответ уже одобрен. Осталось подтвердить отправку в маркетплейс.",
    draftSummary: "Черновик сохранён и ещё не передан сотруднику на проверку.",
    saveFirst: "Сначала сохраните изменения. После этого ответ можно передать на проверку.",
    submitNext: "Передайте сохранённый ответ на проверку, чтобы сотрудник мог принять решение.",
    reviewDecision: "Одобрите ответ для отправки или верните его на доработку с понятной причиной.",
    sendApproved: "Поставьте одобренный ответ в очередь отправки маркетплейса.",
    statusNext: "Статус обновится после следующего действия.",
    sku: "Артикул",
    yandex: "Яндекс Маркет",
    avito: "Авито",
    review: "Отзыв",
    question: "Вопрос",
    chat: "Сообщение",
    blockedAtSend: "Ответ нельзя отправить в текущем виде. Верните его на доработку и проверьте текст.",
    blockedApproval: "Ответ нельзя одобрить в текущем виде. Верните его на доработку и исправьте текст.",
    staleReply: "Ответ уже изменился. Обновите очередь и повторите действие.",
    staleStatus: "Статус ответа уже изменился. Обновите очередь перед следующим действием.",
    unauthorized: "Сессия истекла. Войдите снова.",
    forbidden: "Недостаточно прав для этого действия.",
    notFound: "Нужные данные не найдены. Обновите очередь и попробуйте снова.",
    conflict: "Данные уже изменились. Обновите очередь и повторите действие.",
    invalid: "Проверьте данные ответа и попробуйте снова.",
    rateLimit: "Слишком много действий подряд. Подождите немного и попробуйте снова.",
    genericError: "Не удалось выполнить действие. Проверьте соединение и попробуйте снова.",
  },
  en: {
    loadingDescription: "Loading replies that need a decision before they can be sent.",
    loadingTitle: "Loading the review queue",
    retrying: "Retrying...",
    retry: "Retry",
    loadErrorTitle: "Could not load the review queue",
    previousPage: "Previous page",
    previousDescription: "Return to the previous page of the queue.",
    noMoreTitle: "There are no more replies on this page",
    emptyTitle: "Nothing needs review right now",
    emptyDescription: "Replies that need to be checked, edited, or approved before sending will appear here.",
    workspaceAria: "Manual review queue",
    listAria: "Replies waiting for review",
    replies: "replies",
    refreshing: "Refreshing...",
    refresh: "Refresh",
    refreshError: "Could not refresh the review queue",
    staleData: "Showing the latest successfully loaded version of the queue.",
    noProduct: "No linked product",
    noRating: "no rating",
    pagesAria: "Review queue pages",
    previous: "Back",
    page: "Page",
    of: "of",
    nextPage: "Next page",
    next: "Next",
    replyForReview: "Reply under review",
    customerMessage: "Customer message",
    productContext: "Product context",
    customerReply: "Reply to customer",
    attentionReason: "Reason for attention",
    decisionStatus: "Decision status",
    whyAttention: "Why this needs attention",
    workflowAria: "Reply review stages",
    nextStep: "What happens next",
    rejectionReason: "Reason for sending back for changes",
    rejectionPlaceholder: "Explain what needs to be changed",
    readOnly: "Your role can view the review queue and reply context, but cannot edit, approve, return, or send replies.",
    saving: "Saving...",
    save: "Save changes",
    submitting: "Submitting...",
    submit: "Submit for review",
    approving: "Approving...",
    approve: "Approve reply",
    rejecting: "Sending back...",
    reject: "Return for changes",
    queueing: "Queueing...",
    send: "Send to marketplace",
    blockSummary: "This reply cannot be sent as it is. Review the reason and update the text before the next step.",
    manualSummary: "This reply needs a teammate's decision before it can be sent to the customer.",
    waitingSummary: "The draft is ready and waiting for approval or a return for changes.",
    approvedSummary: "The reply is approved. The remaining step is to queue it for marketplace delivery.",
    draftSummary: "The draft is saved but has not yet been submitted for team review.",
    saveFirst: "Save your changes first. Then the reply can be submitted for review.",
    submitNext: "Submit the saved reply for review so a teammate can make the final decision.",
    reviewDecision: "Approve the reply for sending or return it with a clear reason for changes.",
    sendApproved: "Queue the approved reply for marketplace delivery.",
    statusNext: "The status will update after the next action.",
    sku: "SKU",
    yandex: "Yandex Market",
    avito: "Avito",
    review: "Review",
    question: "Question",
    chat: "Message",
    blockedAtSend: "This reply cannot be sent as it is. Return it for changes and review the text.",
    blockedApproval: "This reply cannot be approved as it is. Return it for changes and update the text.",
    staleReply: "The reply has already changed. Refresh the queue and try again.",
    staleStatus: "The reply status has already changed. Refresh the queue before the next action.",
    unauthorized: "Your session expired. Log in again.",
    forbidden: "You do not have permission for this action.",
    notFound: "The required data could not be found. Refresh the queue and try again.",
    conflict: "The data has already changed. Refresh the queue and try again.",
    invalid: "Check the reply data and try again.",
    rateLimit: "Too many actions in a short time. Wait a moment and try again.",
    genericError: "The action could not be completed. Check your connection and try again.",
  },
} as const;

export function ReviewQueueWorkspace() {
  const queryClient = useQueryClient();
  const { activeOrganization, locale } = useWorkspace();
  const t = reviewCopy[locale];
  const localizedStatusLabels = statusLabels[locale];
  const canManageReview = writeRoles.has(activeOrganization.current_user_role);
  const [selectedId, setSelectedId] = useState("");
  const [page, setPage] = useState(1);
  const editorPanelRef = useRef<HTMLDivElement>(null);

  const queuePath = buildApiQuery("/api/replies/review-queue", {
    organization_id: activeOrganization.id,
    page,
    page_size: reviewQueuePageSize,
  });

  const queueQuery = useQuery({
    queryKey: ["review-queue", activeOrganization.id, page],
    queryFn: () => apiRequest(queuePath, reviewQueueListSchema),
  });

  const items = queueQuery.data?.items ?? [];
  const selected = items.find((item) => item.reply.id === selectedId) ?? items[0] ?? null;
  const totalPages = queueQuery.data
    ? Math.max(1, Math.ceil(queueQuery.data.total / queueQuery.data.page_size))
    : 1;

  const invalidateQueue = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["review-queue", activeOrganization.id] }),
      queryClient.invalidateQueries({ queryKey: ["messages", activeOrganization.id] }),
    ]);
  };

  function selectReviewItem(replyId: string) {
    setSelectedId(replyId);
    if (!window.matchMedia("(max-width: 980px)").matches) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.requestAnimationFrame(() => {
      editorPanelRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  if (queueQuery.isPending && !queueQuery.data) {
    return (
      <QueueState
        description={t.loadingDescription}
        title={t.loadingTitle}
        tone="loading"
      />
    );
  }

  if (queueQuery.error && !queueQuery.data) {
    return (
      <QueueState
        actionDisabled={queueQuery.isFetching}
        actionLabel={queueQuery.isFetching ? t.retrying : t.retry}
        description={errorMessage(queueQuery.error, locale)}
        onAction={() => void queueQuery.refetch()}
        title={t.loadErrorTitle}
        tone="error"
      />
    );
  }

  if (items.length === 0 && page > 1) {
    return (
      <QueueState
        actionLabel={t.previousPage}
        description={t.previousDescription}
        onAction={() => setPage((current) => Math.max(1, current - 1))}
        title={t.noMoreTitle}
        tone="neutral"
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={t.emptyTitle}
        description={t.emptyDescription}
      />
    );
  }

  return (
    <section className="review-queue-workspace" aria-label={t.workspaceAria}>
      <aside className="review-queue-list" aria-label={t.listAria}>
        <div className="panel-heading panel-heading-row">
          <div>
            <span className="panel-kicker">{queueQuery.data.total} {t.replies}</span>
            <strong>{activeOrganization.name}</strong>
          </div>
          <button
            className="button button-secondary button-compact"
            disabled={queueQuery.isFetching}
            onClick={() => void queueQuery.refetch()}
            type="button"
          >
            {queueQuery.isFetching ? t.refreshing : t.refresh}
          </button>
        </div>

        {queueQuery.error && queueQuery.data ? (
          <div className="review-queue-refresh-error" role="alert">
            <div>
              <strong>{t.refreshError}</strong>
              <p>{t.staleData}</p>
            </div>
            <button
              className="button button-secondary button-compact"
              disabled={queueQuery.isFetching}
              onClick={() => void queueQuery.refetch()}
              type="button"
            >
              {queueQuery.isFetching ? t.retrying : t.retry}
            </button>
          </div>
        ) : null}

        <div className="review-queue-stack" role="list">
          {items.map((item) => (
            <div key={item.reply.id} role="listitem">
              <button
                aria-pressed={item.reply.id === selected?.reply.id}
                className={item.reply.id === selected?.reply.id ? "review-queue-card review-queue-card-active" : "review-queue-card"}
                onClick={() => selectReviewItem(item.reply.id)}
                type="button"
              >
                <span className="review-queue-card-topline">
                  <Badge tone="info">{marketplaceLabel(item.message.marketplace, locale)}</Badge>
                  <Badge tone={replyStatusTone(item.reply.status)}>{localizedStatusLabels[item.reply.status] ?? item.reply.status}</Badge>
                </span>
                <strong>{item.message.product?.name ?? t.noProduct}</strong>
                <span>{item.message.customer_text}</span>
                <small className="review-queue-card-meta">
                  {messageTypeLabel(item.message.type, locale)} · {item.message.rating ? `${item.message.rating}★` : t.noRating}
                </small>
              </button>
            </div>
          ))}
        </div>

        {totalPages > 1 ? (
          <nav className="review-queue-pagination" aria-label={t.pagesAria}>
            <button
              aria-label={t.previousPage}
              className="button button-secondary button-compact"
              disabled={page <= 1 || queueQuery.isFetching}
              onClick={() => {
                setSelectedId("");
                setPage((current) => Math.max(1, current - 1));
              }}
              type="button"
            >
              {t.previous}
            </button>
            <span aria-live="polite">{t.page} {page} {t.of} {totalPages}</span>
            <button
              aria-label={t.nextPage}
              className="button button-secondary button-compact"
              disabled={page >= totalPages || queueQuery.isFetching}
              onClick={() => {
                setSelectedId("");
                setPage((current) => Math.min(totalPages, current + 1));
              }}
              type="button"
            >
              {t.next}
            </button>
          </nav>
        ) : null}
      </aside>

      {selected ? (
        <div ref={editorPanelRef} className="review-editor-slot">
          <ReviewEditor
            canManage={canManageReview}
            item={selected}
            key={`${selected.reply.id}:${selected.reply.revision}:${selected.reply.status}`}
            onChanged={invalidateQueue}
            locale={locale}
          />
        </div>
      ) : null}
    </section>
  );
}

function ReviewEditor({
  item,
  canManage,
  onChanged,
  locale,
}: {
  item: ReviewQueueItem;
  canManage: boolean;
  onChanged: () => Promise<void>;
  locale: Locale;
}) {
  const t = reviewCopy[locale];
  const localizedStatusLabels = statusLabels[locale];
  const [draftText, setDraftText] = useState(item.reply.reply_text);
  const [rejectionReason, setRejectionReason] = useState(item.reply.rejection_reason ?? "");

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/replies/${item.reply.id}/draft`, manualReplyWorkflowSchema, {
        method: "PATCH",
        body: {
          reply_text: draftText.trim(),
          expected_revision: item.reply.revision,
        },
      }),
    onSuccess: onChanged,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/replies/${item.reply.id}/submit-review`, manualReplyWorkflowSchema, { method: "POST" }),
    onSuccess: onChanged,
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/replies/${item.reply.id}/approve`, manualReplyWorkflowSchema, { method: "POST" }),
    onSuccess: onChanged,
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/replies/${item.reply.id}/reject`, replySchema, {
        method: "POST",
        body: { reason: rejectionReason.trim() },
      }),
    onSuccess: onChanged,
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/replies/${item.reply.id}/send`, manualReplySendSchema, { method: "POST" }),
    onSuccess: onChanged,
  });

  const activeError = saveMutation.error ?? submitMutation.error ?? approveMutation.error ?? rejectMutation.error ?? sendMutation.error;
  const isMutating =
    saveMutation.isPending ||
    submitMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending ||
    sendMutation.isPending;
  const draftChanged = draftText !== item.reply.reply_text;
  const canEdit = canManage && isEditable(item.reply.status);
  const attentionReasons = reviewAttentionReasons(item, locale);

  return (
    <article className="review-editor-card">
      <div className="panel-heading panel-heading-row">
        <div>
          <span className="panel-kicker">{t.replyForReview}</span>
          <strong>{item.message.product?.name ?? t.noProduct}</strong>
        </div>
        <Badge tone={replyStatusTone(item.reply.status)}>
          {localizedStatusLabels[item.reply.status] ?? item.reply.status}
        </Badge>
      </div>

      <div className="review-editor-context-grid">
        <section className="review-context-card">
          <span>{t.customerMessage}</span>
          <p>{item.message.customer_text}</p>
        </section>
        <section className="review-product-context">
          <span>{t.productContext}</span>
          <p>{item.message.product?.name ?? t.noProduct}</p>
          <small>{productContextLabel(item, locale)}</small>
        </section>
      </div>

      <label className="review-editor-field">
        <span>{t.customerReply}</span>
        <textarea
          disabled={!canEdit || isMutating}
          maxLength={12000}
          onChange={(event) => setDraftText(event.target.value)}
          value={draftText}
        />
      </label>

      <section
        className={"review-attention-reason review-attention-reason-" + reviewAttentionTone(item)}
        aria-label={t.attentionReason}
      >
        <span>{item.reply.status === "approved" ? t.decisionStatus : t.whyAttention}</span>
        <p>{reviewAttentionSummary(item, locale)}</p>
        {attentionReasons.length > 0 ? (
          <ul>
            {attentionReasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        ) : null}
      </section>

      <div className="review-workflow-track" role="group" aria-label={t.workflowAria}>
        {(["draft", "waiting_review", "approved"] as const).map((status) => {
          const active = workflowStep(item.reply.status) === status;
          return (
            <div className={active ? "review-workflow-step review-workflow-step-active" : "review-workflow-step"} key={status}>
              <span aria-hidden="true" />
              <strong>{localizedStatusLabels[status]}</strong>
            </div>
          );
        })}
      </div>

      <section className="review-next-step" aria-live="polite">
        <span>{t.nextStep}</span>
        <p>{reviewNextStep(item.reply.status, draftChanged, locale)}</p>
      </section>

      {item.reply.status === "waiting_review" && canManage ? (
        <label className="review-editor-field review-rejection-field">
          <span>{t.rejectionReason}</span>
          <textarea
            disabled={isMutating}
            maxLength={1000}
            minLength={3}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder={t.rejectionPlaceholder}
            value={rejectionReason}
          />
        </label>
      ) : null}

      {!canManage ? (
        <p className="review-readonly-note">
          {t.readOnly}
        </p>
      ) : null}

      {activeError ? <p className="form-error" role="alert">{reviewActionErrorMessage(activeError, locale)}</p> : null}

      {canManage ? (
        <div className="detail-actions review-editor-actions">
          {isEditable(item.reply.status) ? (
            <>
              <button
                className="button button-secondary"
                disabled={isMutating || draftText.trim().length === 0 || !draftChanged}
                onClick={() => saveMutation.mutate()}
                type="button"
              >
                {saveMutation.isPending ? t.saving : t.save}
              </button>
              <button
                className="button button-primary"
                disabled={isMutating || draftText.trim().length === 0 || draftChanged}
                onClick={() => submitMutation.mutate()}
                type="button"
              >
                {submitMutation.isPending ? t.submitting : t.submit}
              </button>
            </>
          ) : null}

          {item.reply.status === "waiting_review" ? (
            <>
              <button className="button button-primary" disabled={isMutating} onClick={() => approveMutation.mutate()} type="button">
                {approveMutation.isPending ? t.approving : t.approve}
              </button>
              <button
                className="button button-secondary"
                disabled={isMutating || rejectionReason.trim().length < 3}
                onClick={() => rejectMutation.mutate()}
                type="button"
              >
                {rejectMutation.isPending ? t.rejecting : t.reject}
              </button>
            </>
          ) : null}

          {item.reply.status === "approved" ? (
            <button className="button button-primary" disabled={isMutating} onClick={() => sendMutation.mutate()} type="button">
              {sendMutation.isPending ? t.queueing : t.send}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function QueueState({
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
  tone: "error" | "loading" | "neutral";
}) {
  return (
    <section
      aria-busy={tone === "loading"}
      aria-live="polite"
      className={"review-queue-state review-queue-state-" + tone}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className="review-queue-state-mark" aria-hidden="true" />
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
    </section>
  );
}

function isEditable(status: string): boolean {
  return status === "draft" || status === "manual_review_required";
}

function workflowStep(status: string): "draft" | "waiting_review" | "approved" {
  if (status === "waiting_review") return "waiting_review";
  if (status === "approved") return "approved";
  return "draft";
}

function reviewAttentionTone(item: ReviewQueueItem): "danger" | "neutral" | "success" | "warning" {
  if (item.safety.decision === "block") return "danger";
  if (item.reply.status === "approved") return "success";
  if (item.reply.status === "waiting_review" || item.reply.status === "manual_review_required" || item.safety.decision === "manual_review") {
    return "warning";
  }
  return "neutral";
}

function reviewAttentionSummary(item: ReviewQueueItem, locale: Locale): string {
  const t = reviewCopy[locale];
  if (item.safety.decision === "block") {
    return t.blockSummary;
  }
  if (item.reply.status === "manual_review_required" || item.safety.decision === "manual_review") {
    return t.manualSummary;
  }
  if (item.reply.status === "waiting_review") {
    return t.waitingSummary;
  }
  if (item.reply.status === "approved") {
    return t.approvedSummary;
  }
  return t.draftSummary;
}

function reviewAttentionReasons(item: ReviewQueueItem, locale: Locale): string[] {
  const localizedReasons = attentionReasonLabels[locale];
  const reasons = item.safety.flags
    .map((flag) => localizedReasons[flag])
    .filter((reason): reason is string => Boolean(reason));
  return Array.from(new Set(reasons));
}

function reviewNextStep(status: string, draftChanged: boolean, locale: Locale): string {
  const t = reviewCopy[locale];
  if (draftChanged) return t.saveFirst;
  if (status === "draft" || status === "manual_review_required") {
    return t.submitNext;
  }
  if (status === "waiting_review") {
    return t.reviewDecision;
  }
  if (status === "approved") return t.sendApproved;
  return t.statusNext;
}

function productContextLabel(item: ReviewQueueItem, locale: Locale): string {
  const t = reviewCopy[locale];
  const product = item.message.product;
  const details = [
    marketplaceLabel(item.message.marketplace, locale),
    product?.sku ? `${t.sku}: ${product.sku}` : null,
    product?.brand ?? null,
  ].filter((value): value is string => Boolean(value));
  return details.join(" · ");
}

function replyStatusTone(status: string): BadgeTone {
  if (status === "approved") return "success";
  if (status === "waiting_review" || status === "manual_review_required") return "warning";
  return "neutral";
}

function marketplaceLabel(value: string, locale: Locale): string {
  const t = reviewCopy[locale];
  const labels: Record<string, string> = {
    wildberries: "Wildberries",
    ozon: "Ozon",
    yandex_market: t.yandex,
    avito: t.avito,
  };
  return labels[value] ?? value;
}

function messageTypeLabel(value: string, locale: Locale): string {
  const t = reviewCopy[locale];
  if (value === "review") return t.review;
  if (value === "question") return t.question;
  if (value === "chat") return t.chat;
  return value;
}

function reviewActionErrorMessage(error: unknown, locale: Locale): string {
  const t = reviewCopy[locale];
  const normalized = internalErrorMessage(error).toLowerCase();

  if (normalized.includes("safetygate blocked this reply at send time")) {
    return t.blockedAtSend;
  }
  if (normalized.includes("safetygate blocked this reply")) {
    return t.blockedApproval;
  }
  if (normalized.includes("stale reply revision")) {
    return t.staleReply;
  }
  if (
    normalized.includes("only replies waiting for review") ||
    normalized.includes("reply must be a draft") ||
    normalized.includes("reply must be approved")
  ) {
    return t.staleStatus;
  }

  return errorMessage(error, locale);
}

function internalErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "";
}

function errorMessage(error: unknown, locale: Locale): string {
  const t = reviewCopy[locale];
  if (error instanceof ApiError) {
    if (error.status === 401) return t.unauthorized;
    if (error.status === 403) return t.forbidden;
    if (error.status === 404) return t.notFound;
    if (error.status === 409) return t.conflict;
    if (error.status === 422) return t.invalid;
    if (error.status === 429) return t.rateLimit;
  }
  return t.genericError;
}
