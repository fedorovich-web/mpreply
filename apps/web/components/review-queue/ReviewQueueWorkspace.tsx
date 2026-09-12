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
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { Badge, type BadgeTone } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";

const statusLabels: Record<string, string> = {
  draft: "Черновик",
  manual_review_required: "Требует правок",
  waiting_review: "На проверке",
  approved: "Одобрено",
  queued: "В очереди",
  sending: "Отправляется",
  sent: "Отправлено",
};

export function ReviewQueueWorkspace() {
  const queryClient = useQueryClient();
  const { activeOrganization } = useWorkspace();
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
    await queryClient.invalidateQueries({ queryKey: ["review-queue", activeOrganization.id] });
    await queryClient.invalidateQueries({ queryKey: ["messages", activeOrganization.id] });
  };

  if (queueQuery.isPending) {
    return (
      <QueueState
        title="Загружаем очередь проверки"
        description="Получаем ответы, которые требуют проверки перед отправкой."
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

        <div className="review-queue-stack">
          {items.map((item) => (
            <button
              className={item.reply.id === selected?.reply.id ? "review-queue-card review-queue-card-active" : "review-queue-card"}
              key={item.reply.id}
              onClick={() => setSelectedId(item.reply.id)}
              type="button"
            >
              <span className="review-queue-card-topline">
                <Badge tone="info">{marketplaceLabel(item.message.marketplace)}</Badge>
                <Badge tone={replyStatusTone(item.reply.status)}>{statusLabels[item.reply.status] ?? item.reply.status}</Badge>
              </span>
              <strong>{item.message.product?.name ?? "Товар без карточки"}</strong>
              <span>{item.message.customer_text}</span>
              <small>
                {messageTypeLabel(item.message.type)} · {item.message.rating ? `${item.message.rating}★` : "без оценки"}
              </small>
            </button>
          ))}
        </div>
      </aside>

      {selected ? (
        <ReviewEditor
          item={selected}
          key={`${selected.reply.id}:${selected.reply.revision}:${selected.reply.status}`}
          onChanged={invalidateQueue}
        />
      ) : null}
    </section>
  );
}

function ReviewEditor({ item, onChanged }: { item: ReviewQueueItem; onChanged: () => Promise<void> }) {
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

  return (
    <article className="review-editor-card">
      <div className="panel-heading panel-heading-row">
        <div>
          <span className="panel-kicker">Редактор ответа</span>
          <strong>{item.message.product?.name ?? "Товар без карточки"}</strong>
        </div>
        <Badge tone={replyStatusTone(item.reply.status)}>
          {statusLabels[item.reply.status] ?? item.reply.status}
        </Badge>
      </div>

      <section className="review-context-card">
        <span>Покупатель</span>
        <p>{item.message.customer_text}</p>
      </section>

      <label className="review-editor-field">
        <span>Ответ покупателю</span>
        <textarea
          disabled={!isEditable(item.reply.status) || isMutating}
          maxLength={12000}
          onChange={(event) => setDraftText(event.target.value)}
          value={draftText}
        />
      </label>

      <div className="review-safety-block">
        <span>Проверка ответа · {safetyDecisionLabel(item.safety.decision)}</span>
        {item.safety.flags.length > 0 ? (
          <Badge tone={safetyTone(item.safety.decision)}>Нужна дополнительная проверка</Badge>
        ) : (
          <p>Проверка не обнаружила причин для блокировки. Перед отправкой ответ проверяется ещё раз.</p>
        )}
        {item.safety.reasons.length > 0 ? (
          <ul className="review-safety-reasons">
            {item.safety.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        ) : null}
      </div>

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

      {item.reply.status === "waiting_review" ? (
        <label className="review-editor-field review-rejection-field">
          <span>Причина возврата на доработку</span>
          <textarea
            maxLength={1000}
            minLength={3}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Укажите, что именно нужно исправить"
            value={rejectionReason}
          />
        </label>
      ) : null}

      {activeError ? <p className="form-error" role="alert">{errorMessage(activeError)}</p> : null}

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
              {submitMutation.isPending ? "Отправляем..." : "Отправить на проверку"}
            </button>
          </>
        ) : null}

        {item.reply.status === "waiting_review" ? (
          <>
            <button className="button button-primary" disabled={isMutating} onClick={() => approveMutation.mutate()} type="button">
              {approveMutation.isPending ? "Одобряем..." : "Одобрить"}
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

function replyStatusTone(status: string): BadgeTone {
  if (status === "approved") return "success";
  if (status === "waiting_review" || status === "manual_review_required") return "warning";
  return "neutral";
}

function safetyTone(decision: string): BadgeTone {
  if (decision === "block") return "danger";
  if (decision === "manual_review") return "warning";
  return "success";
}

function safetyDecisionLabel(decision: string): string {
  if (decision === "block") return "нельзя отправлять";
  if (decision === "manual_review") return "нужна проверка";
  return "можно продолжить";
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
  if (value === "message") return "Сообщение";
  return value;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "Неизвестная ошибка";
}
