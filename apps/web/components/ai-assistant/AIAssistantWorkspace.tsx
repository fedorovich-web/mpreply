"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ApiError, apiRequest, buildApiQuery } from "../../lib/api/client";
import {
  aiDraftListSchema,
  aiDraftSchema,
  customerMessageListSchema,
  type AIDraft,
  type CustomerMessage,
} from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { Badge, type BadgeTone } from "../ui/Badge";

const writeRoles = new Set(["owner", "admin", "manager"]);
const toneOptions = [
  { value: "neutral", label: "Нейтральный" },
  { value: "friendly", label: "Доброжелательный" },
  { value: "formal", label: "Официальный" },
  { value: "apologetic", label: "Эмпатичный / с извинением" },
] as const;

type Tone = (typeof toneOptions)[number]["value"];

export function AIAssistantWorkspace() {
  const { activeOrganization } = useWorkspace();
  const queryClient = useQueryClient();
  const canGenerate = writeRoles.has(activeOrganization.current_user_role);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [tone, setTone] = useState<Tone>("neutral");
  const [brandRules, setBrandRules] = useState("");
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [latestDraft, setLatestDraft] = useState<AIDraft | null>(null);

  const messagesQuery = useQuery({
    queryKey: ["ai-assistant", "messages", activeOrganization.id],
    queryFn: () =>
      apiRequest(
        buildApiQuery("/api/messages", {
          organization_id: activeOrganization.id,
          page: 1,
          page_size: 50,
        }),
        customerMessageListSchema,
      ),
  });

  const selectedMessage = useMemo(() => {
    const items = messagesQuery.data?.items ?? [];
    if (items.length === 0) return null;
    return items.find((message) => message.id === selectedMessageId) ?? items[0] ?? null;
  }, [messagesQuery.data?.items, selectedMessageId]);

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
      await queryClient.invalidateQueries({
        queryKey: ["ai-assistant", "drafts", activeOrganization.id, selectedMessage?.id],
      });
    },
  });

  const displayedDraft = latestDraft?.message_id === selectedMessage?.id
    ? latestDraft
    : draftsQuery.data?.items[0] ?? null;

  function selectMessage(messageId: string) {
    setSelectedMessageId(messageId);
    setLatestDraft(null);
    generateMutation.reset();
  }

  return (
    <section className="ai-workspace" aria-labelledby="ai-workspace-title">
      <header className="ai-workspace-toolbar">
        <div>
          <p className="eyebrow">Подготовка ответа</p>
          <h2 id="ai-workspace-title">Обращение → черновик → проверка</h2>
          <p>
            Выберите обращение, задайте тон и добавьте нужный контекст. MPReply подготовит ответ и отметит, если его стоит дополнительно проверить.
          </p>
        </div>
        <Badge tone={canGenerate ? "success" : "neutral"}>
          {canGenerate ? "Можно создавать ответы" : "Только просмотр"}
        </Badge>
      </header>

      <div className="ai-workspace-grid">
        <section className="ai-panel ai-message-panel" aria-labelledby="ai-message-list-title">
          <div className="panel-heading panel-heading-row">
            <div>
              <span className="panel-kicker">Выберите обращение</span>
              <strong id="ai-message-list-title">Обращения</strong>
            </div>
            {messagesQuery.data ? <Badge>{messagesQuery.data.total}</Badge> : null}
          </div>

          {messagesQuery.isPending ? (
            <AIState title="Загружаем обращения" description="Получаем отзывы, вопросы и сообщения покупателей." />
          ) : messagesQuery.error ? (
            <AIState
              title="Не удалось загрузить обращения"
              description={errorMessage(messagesQuery.error)}
              actionLabel="Повторить"
              onAction={() => void messagesQuery.refetch()}
            />
          ) : !messagesQuery.data || messagesQuery.data.items.length === 0 ? (
            <AIState
              title="Обращений пока нет"
              description="После синхронизации здесь появятся отзывы, вопросы и сообщения, для которых можно подготовить ответ."
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
        </section>

        <section className="ai-panel ai-generate-panel" aria-labelledby="ai-generate-title">
          <div className="panel-heading">
            <span className="panel-kicker">Настройки ответа</span>
            <strong id="ai-generate-title">Новый черновик</strong>
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
                  Правила бренда
                  <textarea
                    disabled={!canGenerate || generateMutation.isPending}
                    maxLength={2000}
                    onChange={(event) => setBrandRules(event.target.value)}
                    placeholder="Например: обращаться на Вы, не обещать скидки, не использовать эмодзи"
                    value={brandRules}
                  />
                </label>
                <label>
                  Контекст базы знаний
                  <textarea
                    disabled={!canGenerate || generateMutation.isPending}
                    maxLength={4000}
                    onChange={(event) => setKnowledgeBase(event.target.value)}
                    placeholder="Факты о товаре, гарантии, комплектации или правилах поддержки"
                    value={knowledgeBase}
                  />
                </label>
                {generateMutation.error ? (
                  <p className="form-error" role="alert">
                    {errorMessage(generateMutation.error)}
                    {generateMutation.error instanceof ApiError && generateMutation.error.requestId
                      ? ` · код запроса ${generateMutation.error.requestId}`
                      : ""}
                  </p>
                ) : null}
                {canGenerate ? (
                  <button className="button button-primary" disabled={generateMutation.isPending} type="submit">
                    {generateMutation.isPending ? "Готовим ответ..." : "Подготовить черновик"}
                  </button>
                ) : (
                  <p className="ai-readonly-note">
                    Роль {roleLabel(activeOrganization.current_user_role)} может просматривать историю, но не создавать новые черновики.
                  </p>
                )}
              </form>
            </>
          ) : (
            <AIState title="Выберите обращение" description="Сначала выберите отзыв, вопрос или сообщение в списке слева." />
          )}
        </section>

        <section className="ai-panel ai-result-panel" aria-labelledby="ai-result-title">
          <div className="panel-heading panel-heading-row">
            <div>
              <span className="panel-kicker">Готовый вариант</span>
              <strong id="ai-result-title">Черновик и проверка</strong>
            </div>
            {displayedDraft ? <Badge tone={draftTone(displayedDraft)}>{confidenceLabel(displayedDraft)}</Badge> : null}
          </div>

          {!selectedMessage ? (
            <AIState title="Нет выбранного обращения" description="Результат появится после выбора обращения." />
          ) : draftsQuery.isPending && !displayedDraft ? (
            <AIState title="Загружаем историю" description="Получаем предыдущие черновики для этого обращения." />
          ) : draftsQuery.error && !displayedDraft ? (
            <AIState
              title="Не удалось загрузить черновики"
              description={errorMessage(draftsQuery.error)}
              actionLabel="Повторить"
              onAction={() => void draftsQuery.refetch()}
            />
          ) : displayedDraft ? (
            <DraftResult draft={displayedDraft} />
          ) : (
            <AIState title="Черновиков ещё нет" description="Подготовьте первый ответ для выбранного обращения." />
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

function DraftResult({ draft }: { draft: AIDraft }) {
  const needsReview = draft.safety_flags_json.length > 0;

  return (
    <div className="ai-draft-result" aria-live="polite">
      <div className="ai-draft-copy">
        <p>{draft.draft_text}</p>
      </div>

      <div className="ai-draft-flags">
        <Badge tone={needsReview ? "warning" : "success"}>
          {needsReview ? "Нужна дополнительная проверка" : "Проверка пройдена"}
        </Badge>
      </div>
    </div>
  );
}

function AIState({
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

function roleLabel(value: string): string {
  const labels: Record<string, string> = {
    owner: "владельца",
    admin: "администратора",
    manager: "менеджера",
    viewer: "наблюдателя",
  };
  return labels[value] ?? value;
}

function draftTone(draft: AIDraft): BadgeTone {
  if (draft.safety_flags_json.length > 0) return "warning";
  if (draft.confidence_score !== null && draft.confidence_score < 0.75) return "warning";
  return "success";
}

function confidenceLabel(draft: AIDraft): string {
  if (draft.confidence_score === null) return "Уверенность не рассчитана";
  return `Уверенность ${Math.round(draft.confidence_score * 100)}%`;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "Неизвестная ошибка";
}
