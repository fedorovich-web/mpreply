"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ApiError, apiRequest, buildApiQuery } from "../../lib/api/client";
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

const statusLabels: Record<string, string> = {
  draft: "Черновик",
  manual_review_required: "Требует правок",
  waiting_review: "На проверке",
  approved: "Одобрено",
  queued: "В очереди",
  sending: "Отправляется",
  sent: "Отправлено",
};

const attentionReasonLabels: Record<string, string> = {
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
};

export function ReviewQueueWorkspace() {
  const queryClient = useQueryClient();
  const { activeOrganization } = useWorkspace();
  const canManageReview = writeRoles.has(activeOrganization.current_user_role);
  const [selectedId, setSelectedId] = useState("");

  const queuePath = buildApiQuery("/api/replies/review-queue", {
    organization_id: activeOrganization.id,
    page: 1,
    page_size: 100,
  });

  const queueQuery = useQuery({
    queryKey: ["review-queue", activeOrganization.id],
    queryFn: () => apiRequest(queuePath, reviewQueueListSchema),
  });

  const items = queueQuery.data?.items ?? [];
  const selected = items.find((item) => item.reply.id === selectedId) ?? items[0] ?? null;

  const invalidateQueue = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["review-queue", activeOrganization.id] }),
      queryClient.invalidateQueries({ queryKey: ["messages", activeOrganization.id] }),
    ]);
  };

  if (queueQuery.isPending) {
    return (
      <QueueState
        title="Загружаем очередь проверки"
        description="Получаем ответы, которые требуют решения перед отправкой."
      />
    );
  }

  if (queueQuery.error) {
    return (
      <QueueState
        title="Не удалось загрузить очередь проверки"
        description={errorMessage(queueQuery.error)}
        actionLabel="Повторить"
        onAction={() => void queueQuery.refetch()}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="На проверке ничего нет"
        description="Здесь появятся ответы, которые нужно проверить, исправить или подтвердить перед отправкой."
      />
    );
  }

  return (
    <section className="review-queue-workspace" aria-label="Очередь ручной проверки">
      <aside className="review-queue-list" aria-label="Обращения на проверке">
        <div className="panel-heading panel-heading-row">
          <div>
            <span className="panel-kicker">{queueQuery.data.total} ответов</span>
            <strong>{activeOrganization.name}</strong>
          </div>
          <button
            className="button button-secondary button-compact"
            disabled={queueQuery.isFetching}
            onClick={() => void queueQuery.refetch()}
            type="button"
          >
            {queueQuery.isFetching ? "Обновляем..." : "Обновить"}
          </button>
        </div>

        <div className="review-queue-stack" role="list">
          {items.map((item) => (
            <div key={item.reply.id} role="listitem">
              <button
                aria-pressed={item.reply.id === selected?.reply.id}
                className={item.reply.id === selected?.reply.id ? "review-queue-card review-queue-card-active" : "review-queue-card"}
                onClick={() => setSelectedId(item.reply.id)}
                type="button"
              >
                <span className="review-queue-card-topline">
                  <Badge tone="info">{marketplaceLabel(item.message.marketplace)}</Badge>
                  <Badge tone={replyStatusTone(item.reply.status)}>{statusLabels[item.reply.status] ?? item.reply.status}</Badge>
                </span>
                <strong>{item.message.product?.name ?? "Товар без карточки"}</strong>
                <span>{item.message.customer_text}</span>
                <small className="review-queue-card-meta">
                  {messageTypeLabel(item.message.type)} · {item.message.rating ? `${item.message.rating}★` : "без оценки"}
                </small>
              </button>
            </div>
          ))}
        </div>
      </aside>

      {selected ? (
        <ReviewEditor
          canManage={canManageReview}
          item={selected}
          key={`${selected.reply.id}:${selected.reply.revision}:${selected.reply.status}`}
          onChanged={invalidateQueue}
        />
      ) : null}
    </section>
  );
}

function ReviewEditor({
  item,
  canManage,
  onChanged,
}: {
  item: ReviewQueueItem;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
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
  const attentionReasons = reviewAttentionReasons(item);

  return (
    <article className="review-editor-card">
      <div className="panel-heading panel-heading-row">
        <div>
          <span className="panel-kicker">Ответ на проверке</span>
          <strong>{item.message.product?.name ?? "Товар без карточки"}</strong>
        </div>
        <Badge tone={replyStatusTone(item.reply.status)}>
          {statusLabels[item.reply.status] ?? item.reply.status}
        </Badge>
      </div>

      <div className="review-editor-context-grid">
        <section className="review-context-card">
          <span>Обращение покупателя</span>
          <p>{item.message.customer_text}</p>
        </section>
        <section className="review-product-context">
          <span>Контекст товара</span>
          <p>{item.message.product?.name ?? "Товар без карточки"}</p>
          <small>{productContextLabel(item)}</small>
        </section>
      </div>

      <label className="review-editor-field">
        <span>Ответ покупателю</span>
        <textarea
          disabled={!canEdit || isMutating}
          maxLength={12000}
          onChange={(event) => setDraftText(event.target.value)}
          value={draftText}
        />
      </label>

      <section className="review-attention-reason" aria-label="Причина внимания">
        <span>Почему требуется внимание</span>
        <p>{reviewAttentionSummary(item)}</p>
        {attentionReasons.length > 0 ? (
          <ul>
            {attentionReasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        ) : null}
      </section>

      <div className="review-workflow-track" role="group" aria-label="Этапы проверки ответа">
        {(["draft", "waiting_review", "approved"] as const).map((status) => {
          const active = workflowStep(item.reply.status) === status;
          return (
            <div className={active ? "review-workflow-step review-workflow-step-active" : "review-workflow-step"} key={status}>
              <span aria-hidden="true" />
              <strong>{statusLabels[status]}</strong>
            </div>
          );
        })}
      </div>

      <section className="review-next-step" aria-live="polite">
        <span>Что произойдёт дальше</span>
        <p>{reviewNextStep(item.reply.status, draftChanged)}</p>
      </section>

      {item.reply.status === "waiting_review" && canManage ? (
        <label className="review-editor-field review-rejection-field">
          <span>Причина возврата на доработку</span>
          <textarea
            disabled={isMutating}
            maxLength={1000}
            minLength={3}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Укажите, что именно нужно исправить"
            value={rejectionReason}
          />
        </label>
      ) : null}

      {!canManage ? (
        <p className="review-readonly-note">
          Ваша роль позволяет просматривать очередь и контекст ответа, но не редактировать, одобрять, возвращать или отправлять ответы.
        </p>
      ) : null}

      {activeError ? <p className="form-error" role="alert">{errorMessage(activeError)}</p> : null}

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
                {saveMutation.isPending ? "Сохраняем..." : "Сохранить правки"}
              </button>
              <button
                className="button button-primary"
                disabled={isMutating || draftText.trim().length === 0 || draftChanged}
                onClick={() => submitMutation.mutate()}
                type="button"
              >
                {submitMutation.isPending ? "Передаём..." : "Передать на проверку"}
              </button>
            </>
          ) : null}

          {item.reply.status === "waiting_review" ? (
            <>
              <button className="button button-primary" disabled={isMutating} onClick={() => approveMutation.mutate()} type="button">
                {approveMutation.isPending ? "Одобряем..." : "Одобрить ответ"}
              </button>
              <button
                className="button button-secondary"
                disabled={isMutating || rejectionReason.trim().length < 3}
                onClick={() => rejectMutation.mutate()}
                type="button"
              >
                {rejectMutation.isPending ? "Возвращаем..." : "Вернуть на доработку"}
              </button>
            </>
          ) : null}

          {item.reply.status === "approved" ? (
            <button className="button button-primary" disabled={isMutating} onClick={() => sendMutation.mutate()} type="button">
              {sendMutation.isPending ? "Ставим в очередь..." : "Отправить в маркетплейс"}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function QueueState({
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
        <button className="button button-secondary button-compact" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
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

function reviewAttentionSummary(item: ReviewQueueItem): string {
  if (item.safety.decision === "block") {
    return "Ответ нельзя отправлять в текущем виде. Проверьте причину и исправьте текст перед следующим шагом.";
  }
  if (item.reply.status === "manual_review_required" || item.safety.decision === "manual_review") {
    return "Ответ требует решения сотрудника перед отправкой покупателю.";
  }
  if (item.reply.status === "waiting_review") {
    return "Черновик подготовлен и ждёт одобрения или возврата на доработку.";
  }
  if (item.reply.status === "approved") {
    return "Ответ уже одобрен. Осталось подтвердить отправку в маркетплейс.";
  }
  return "Черновик сохранён и ещё не передан сотруднику на проверку.";
}

function reviewAttentionReasons(item: ReviewQueueItem): string[] {
  const reasons = item.safety.flags
    .map((flag) => attentionReasonLabels[flag])
    .filter((reason): reason is string => Boolean(reason));
  return Array.from(new Set(reasons));
}

function reviewNextStep(status: string, draftChanged: boolean): string {
  if (draftChanged) return "Сначала сохраните изменения. После этого ответ можно передать на проверку.";
  if (status === "draft" || status === "manual_review_required") {
    return "Передайте сохранённый ответ на проверку, чтобы сотрудник мог принять решение.";
  }
  if (status === "waiting_review") {
    return "Одобрите ответ для отправки или верните его на доработку с понятной причиной.";
  }
  if (status === "approved") return "Поставьте одобренный ответ в очередь отправки маркетплейса.";
  return "Статус обновится после следующего действия.";
}

function productContextLabel(item: ReviewQueueItem): string {
  const product = item.message.product;
  const details = [
    marketplaceLabel(item.message.marketplace),
    product?.sku ? `SKU ${product.sku}` : null,
    product?.brand ?? null,
  ].filter((value): value is string => Boolean(value));
  return details.join(" · ");
}

function replyStatusTone(status: string): BadgeTone {
  if (status === "approved") return "success";
  if (status === "waiting_review" || status === "manual_review_required") return "warning";
  return "neutral";
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

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "Неизвестная ошибка";
}
