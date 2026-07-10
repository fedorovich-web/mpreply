"use client";

import { useMemo, useState } from "react";

import { Badge } from "../ui/Badge";

type ReviewStatus = "draft" | "waiting_review" | "approved";

type ReviewItem = {
  id: string;
  marketplace: string;
  type: "Отзыв" | "Вопрос";
  rating: number | null;
  product: string;
  customerText: string;
  replyText: string;
  status: ReviewStatus;
  revision: number;
  safetyFlags: string[];
};

const initialItems: ReviewItem[] = [
  {
    id: "review-01",
    marketplace: "Wildberries",
    type: "Отзыв",
    rating: 2,
    product: "Увлажнитель Air Mini",
    customerText: "Пришёл быстро, но внутри коробки была вода. Это нормально?",
    replyText:
      "Спасибо за отзыв. Небольшие следы влаги могут появиться после заводской проверки устройства. Перед использованием полностью просушите резервуар и следуйте инструкции.",
    status: "waiting_review",
    revision: 3,
    safetyFlags: ["negative_review", "needs_manual_review"],
  },
  {
    id: "review-02",
    marketplace: "Wildberries",
    type: "Вопрос",
    rating: null,
    product: "Кабель USB-C 100W",
    customerText: "Подойдёт для MacBook Pro 14 и будет ли заряжать на полной мощности?",
    replyText:
      "Кабель поддерживает мощность до 100 Вт при использовании совместимого блока питания и устройства. Для конкретной модели MacBook Pro рекомендуем сверить требования адаптера питания.",
    status: "draft",
    revision: 1,
    safetyFlags: [],
  },
];

const statusLabels: Record<ReviewStatus, string> = {
  draft: "Черновик",
  waiting_review: "На проверке",
  approved: "Одобрено",
};

export function ReviewQueueWorkspace() {
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState(initialItems[0]?.id ?? "");
  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? items[0], [items, selectedId]);

  function updateReplyText(value: string) {
    if (!selected) return;
    setItems((current) =>
      current.map((item) =>
        item.id === selected.id
          ? { ...item, replyText: value, revision: item.revision + 1, status: "draft" }
          : item,
      ),
    );
  }

  function setStatus(status: ReviewStatus) {
    if (!selected) return;
    setItems((current) => current.map((item) => (item.id === selected.id ? { ...item, status } : item)));
  }

  return (
    <section className="review-queue-workspace" aria-label="Очередь ручной проверки">
      <aside className="review-queue-list" aria-label="Обращения на проверке">
        <div className="panel-heading panel-heading-row">
          <div>
            <span className="panel-kicker">{items.length} обращения</span>
            <strong>Semi-auto queue</strong>
          </div>
          <Badge tone="warning">Sprint 10</Badge>
        </div>

        <div className="review-queue-stack">
          {items.map((item) => (
            <button
              className={item.id === selected?.id ? "review-queue-card review-queue-card-active" : "review-queue-card"}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              type="button"
            >
              <span className="review-queue-card-topline">
                <Badge tone="info">{item.marketplace}</Badge>
                <Badge tone={item.status === "approved" ? "success" : item.status === "waiting_review" ? "warning" : "neutral"}>
                  {statusLabels[item.status]}
                </Badge>
              </span>
              <strong>{item.product}</strong>
              <span>{item.customerText}</span>
              <small>
                {item.type} · {item.rating ? `${item.rating}★` : "без оценки"} · rev {item.revision}
              </small>
            </button>
          ))}
        </div>
      </aside>

      {selected ? (
        <article className="review-editor-card">
          <div className="panel-heading panel-heading-row">
            <div>
              <span className="panel-kicker">Reply editor</span>
              <strong>{selected.product}</strong>
            </div>
            <Badge tone={selected.status === "approved" ? "success" : selected.status === "waiting_review" ? "warning" : "neutral"}>
              {statusLabels[selected.status]}
            </Badge>
          </div>

          <section className="review-context-card">
            <span>Покупатель</span>
            <p>{selected.customerText}</p>
          </section>

          <label className="review-editor-field">
            <span>Ответ</span>
            <textarea
              disabled={selected.status === "approved"}
              onChange={(event) => updateReplyText(event.target.value)}
              value={selected.replyText}
            />
          </label>

          <div className="review-safety-block">
            <span>SafetyGate</span>
            {selected.safetyFlags.length > 0 ? (
              <div className="review-flag-list">
                {selected.safetyFlags.map((flag) => (
                  <Badge key={flag} tone="warning">{flag}</Badge>
                ))}
              </div>
            ) : (
              <p>Блокирующих флагов нет. Текст всё равно проверяется повторно перед одобрением и отправкой.</p>
            )}
          </div>

          <div className="review-workflow-track" aria-label="Статусы workflow">
            {(["draft", "waiting_review", "approved"] as const).map((status) => (
              <div className={selected.status === status ? "review-workflow-step review-workflow-step-active" : "review-workflow-step"} key={status}>
                <span aria-hidden="true" />
                <strong>{statusLabels[status]}</strong>
              </div>
            ))}
          </div>

          <div className="detail-actions review-editor-actions">
            {selected.status === "draft" ? (
              <button className="button button-primary" onClick={() => setStatus("waiting_review")} type="button">
                Отправить на проверку
              </button>
            ) : null}
            {selected.status === "waiting_review" ? (
              <>
                <button className="button button-primary" onClick={() => setStatus("approved")} type="button">
                  Одобрить
                </button>
                <button className="button button-secondary" onClick={() => setStatus("draft")} type="button">
                  Вернуть на доработку
                </button>
              </>
            ) : null}
            {selected.status === "approved" ? (
              <button className="button button-primary" type="button">
                Отправить в маркетплейс
              </button>
            ) : null}
          </div>

          <p className="review-api-note">
            Production API contract: create draft → PATCH with optimistic revision → submit-review → approve/reject → send.
            Marketplace execution reuses the idempotent worker pipeline from Sprint 7.
          </p>
        </article>
      ) : null}
    </section>
  );
}
