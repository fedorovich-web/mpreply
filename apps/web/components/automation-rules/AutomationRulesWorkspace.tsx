"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { ApiError, apiRequest, buildApiQuery } from "../../lib/api/client";
import {
  automationRuleActionSchema,
  automationRuleListSchema,
  automationRuleSchema,
  type AutomationRule,
} from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

type RuleFilter = "all" | "enabled" | "disabled";
type EditorMode = "create" | "edit";

type RuleEditorState = {
  name: string;
  priority: string;
  mode: "auto" | "semi_auto";
  appliesTo: "all" | "review" | "question" | "chat";
  marketplace: "" | "wildberries" | "ozon" | "yandex_market" | "avito";
  minRating: string;
  maxRating: string;
  includeKeywords: string;
  excludeKeywords: string;
  sensitiveTopics: string;
  dailyLimit: string;
  hourlyLimit: string;
  confidenceThreshold: string;
  requireManualReviewOnFlags: boolean;
  stopOnMissingProductContext: boolean;
  stopOnLowConfidence: boolean;
  isEnabled: boolean;
};

const precedence = [
  "Режим ответов по умолчанию",
  "Настройки выбранного кабинета маркетплейса",
  "Подходящее правило с самым высоким приоритетом",
  "Проверка данных о товаре и качества ответа",
  "Проверка перед автоматической отправкой",
];

const filterLabels: Record<RuleFilter, string> = {
  all: "Все",
  enabled: "Включённые",
  disabled: "Выключенные",
};

export function AutomationRulesWorkspace() {
  const { activeOrganization } = useWorkspace();

  return (
    <AutomationRulesWorkspaceContent
      key={activeOrganization.id}
      organizationId={activeOrganization.id}
      organizationName={activeOrganization.name}
      role={activeOrganization.current_user_role}
    />
  );
}

function AutomationRulesWorkspaceContent({
  organizationId,
  organizationName,
  role,
}: {
  organizationId: string;
  organizationName: string;
  role: "owner" | "admin" | "manager" | "viewer";
}) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<RuleFilter>("all");
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode | null>(null);
  const [editor, setEditor] = useState<RuleEditorState>(() => emptyEditor());
  const [mutationSuccess, setMutationSuccess] = useState<string | null>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const canWrite = role === "owner" || role === "admin";

  const rulesQuery = useQuery({
    queryKey: ["automation-rules", organizationId, filter],
    queryFn: () =>
      apiRequest(
        buildApiQuery("/api/automation-rules", {
          organization_id: organizationId,
          is_enabled: filter === "all" ? null : filter === "enabled" ? "true" : "false",
        }),
        automationRuleListSchema,
      ),
  });

  const selectedRule =
    rulesQuery.data?.items.find((rule) => rule.id === selectedRuleId) ?? rulesQuery.data?.items[0] ?? null;

  async function refreshRules() {
    await queryClient.invalidateQueries({ queryKey: ["automation-rules", organizationId] });
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = editorPayload(editor, organizationId);
      if (editorMode === "edit" && selectedRule) {
        const updatePayload = { ...payload };
        delete (updatePayload as Partial<typeof payload>).organization_id;
        return apiRequest(`/api/automation-rules/${selectedRule.id}`, automationRuleSchema, {
          method: "PATCH",
          body: updatePayload,
        });
      }
      return apiRequest("/api/automation-rules", automationRuleSchema, {
        method: "POST",
        body: payload,
      });
    },
    onMutate: () => {
      setMutationSuccess(null);
    },
    onSuccess: async (rule) => {
      const successMessage = editorMode === "create" ? "Правило создано." : "Изменения сохранены.";
      setSelectedRuleId(rule.id);
      setEditorMode(null);
      if (!filterMatchesRuleState(filter, rule.is_enabled)) setFilter("all");
      setMutationSuccess(successMessage);
      await refreshRules();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ rule, enabled }: { rule: AutomationRule; enabled: boolean }) => {
      if (enabled) {
        return apiRequest(`/api/automation-rules/${rule.id}`, automationRuleSchema, {
          method: "PATCH",
          body: { is_enabled: true },
        });
      }
      return apiRequest(`/api/automation-rules/${rule.id}`, automationRuleActionSchema, {
        method: "DELETE",
      });
    },
    onMutate: () => {
      setMutationSuccess(null);
    },
    onSuccess: async (_result, variables) => {
      setSelectedRuleId(variables.rule.id);
      if (!filterMatchesRuleState(filter, variables.enabled)) setFilter("all");
      setMutationSuccess(variables.enabled ? "Правило включено." : "Правило выключено.");
      await refreshRules();
    },
  });

  const mutationError = saveMutation.error ?? toggleMutation.error;

  function scrollToDetailOnCompactLayout() {
    if (!window.matchMedia("(max-width: 1180px)").matches) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.requestAnimationFrame(() => {
      detailPanelRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  function startCreate() {
    setMutationSuccess(null);
    setEditor(emptyEditor());
    setEditorMode("create");
    scrollToDetailOnCompactLayout();
  }

  function startEdit(rule: AutomationRule) {
    setMutationSuccess(null);
    setSelectedRuleId(rule.id);
    setEditor(editorFromRule(rule));
    setEditorMode("edit");
    scrollToDetailOnCompactLayout();
  }

  function selectRule(rule: AutomationRule) {
    setMutationSuccess(null);
    setSelectedRuleId(rule.id);
    setEditorMode(null);
    scrollToDetailOnCompactLayout();
  }

  return (
    <div className="automation-workspace">
      <section className="automation-toolbar" aria-label="Управление правилами">
        <div>
          <p className="automation-toolbar-title">{organizationName}</p>
          <p className="automation-toolbar-copy">
            Правила применяются по приоритету. Перед автоматической отправкой MPReply проверяет, можно ли безопасно отправить ответ.
          </p>
        </div>
        <div className="automation-toolbar-actions">
          {rulesQuery.data ? (
            <button
              className="button button-secondary button-compact"
              disabled={rulesQuery.isFetching}
              onClick={() => void rulesQuery.refetch()}
              type="button"
            >
              {rulesQuery.isFetching ? "Обновляем..." : "Обновить правила"}
            </button>
          ) : null}
          {canWrite ? (
            <button className="button button-primary" onClick={startCreate} type="button">
              Создать правило
            </button>
          ) : null}
        </div>
        {!canWrite ? (
          <p className="automation-readonly-note" role="status">
            Только просмотр: изменять правила могут владелец и администраторы.
          </p>
        ) : null}
      </section>

      <section className="automation-summary" aria-label="Сводка правил">
        <article>
          <span>Правил по фильтру</span>
          <strong>{rulesQuery.data?.total ?? "—"}</strong>
        </article>
        <article>
          <span>Включено в списке</span>
          <strong>{rulesQuery.data?.items.filter((rule) => rule.is_enabled).length ?? "—"}</strong>
        </article>
        <article>
          <span>Режим доступа</span>
          <strong>{canWrite ? "Управление" : "Просмотр"}</strong>
        </article>
      </section>

      <div className="automation-filter-row" aria-label="Фильтр правил">
        {(Object.keys(filterLabels) as RuleFilter[]).map((value) => (
          <button
            aria-pressed={filter === value}
            className="automation-filter-button"
            key={value}
            onClick={() => {
              setMutationSuccess(null);
              setFilter(value);
              setSelectedRuleId(null);
              setEditorMode(null);
            }}
            type="button"
          >
            {filterLabels[value]}
          </button>
        ))}
      </div>

      {rulesQuery.isPending && !rulesQuery.data ? (
        <section className="automation-state" aria-busy="true" aria-live="polite" role="status">
          <h2>Загружаем правила</h2>
          <p>Получаем актуальные правила автоматизации для вашей компании.</p>
        </section>
      ) : rulesQuery.error && !rulesQuery.data ? (
        <section className="automation-state automation-state-error" role="alert">
          <h2>Не удалось загрузить правила</h2>
          <p>{userErrorMessage(rulesQuery.error, "Правила временно недоступны. Попробуйте ещё раз.")}</p>
          <button
            className="button button-secondary"
            disabled={rulesQuery.isFetching}
            onClick={() => void rulesQuery.refetch()}
            type="button"
          >
            {rulesQuery.isFetching ? "Повторяем..." : "Повторить"}
          </button>
        </section>
      ) : rulesQuery.data ? (
        <>
          {rulesQuery.error ? (
            <div className="automation-refresh-error" role="alert">
              <div>
                <strong>Не удалось обновить правила</strong>
                <p>Показываем ранее загруженные правила. Можно продолжать работу или попробовать ещё раз.</p>
              </div>
              <button
                className="button button-secondary button-compact"
                disabled={rulesQuery.isFetching}
                onClick={() => void rulesQuery.refetch()}
                type="button"
              >
                {rulesQuery.isFetching ? "Повторяем..." : "Повторить"}
              </button>
            </div>
          ) : null}
          <section className="automation-live-layout">
          <div className="automation-rule-list" aria-label="Правила автоматизации">
            {rulesQuery.data.items.length === 0 ? (
              <div className="automation-empty-state">
                <h2>Правил пока нет</h2>
                <p>
                  {filter === "all"
                    ? "Создайте первое правило, чтобы управлять автоматическими ответами и ответами с проверкой."
                    : "В этой выборке правил нет. Измените фильтр или создайте новое правило."}
                </p>
                {canWrite ? (
                  <button className="button button-secondary" onClick={startCreate} type="button">
                    Создать первое правило
                  </button>
                ) : null}
              </div>
            ) : (
              rulesQuery.data.items.map((rule) => (
                <button
                  aria-pressed={selectedRule?.id === rule.id}
                  className="automation-rule-row"
                  key={rule.id}
                  onClick={() => selectRule(rule)}
                  type="button"
                >
                  <span className="automation-rule-row-head">
                    <strong>{rule.name}</strong>
                    <span className={rule.is_enabled ? "automation-rule-status" : "automation-rule-status is-disabled"}>
                      {rule.is_enabled ? "Включено" : "Выключено"}
                    </span>
                  </span>
                  <span className="automation-rule-row-meta">
                    Приоритет {rule.priority} · {modeLabel(rule.mode)} · {appliesToLabel(rule.applies_to)}
                  </span>
                </button>
              ))
            )}
          </div>

          <div ref={detailPanelRef} className="automation-detail-panel">
            {editorMode ? (
              <RuleEditor
                error={mutationError ? userErrorMessage(mutationError, "Не удалось сохранить правило. Проверьте данные и попробуйте ещё раз.") : null}
                isPending={saveMutation.isPending}
                mode={editorMode}
                onCancel={() => setEditorMode(null)}
                onChange={setEditor}
                onSubmit={() => saveMutation.mutate()}
                state={editor}
              />
            ) : selectedRule ? (
              <RuleDetail
                canWrite={canWrite}
                isPending={toggleMutation.isPending}
                onEdit={() => startEdit(selectedRule)}
                onToggle={(enabled) => {
                  if (!enabled && !window.confirm(`Выключить правило «${selectedRule.name}»?`)) return;
                  toggleMutation.mutate({ rule: selectedRule, enabled });
                }}
                rule={selectedRule}
              />
            ) : (
              <div className="automation-empty-state">
                <h2>Выберите правило</h2>
                <p>Здесь появятся условия, способ отправки и ограничения выбранного правила.</p>
              </div>
            )}
          </div>
        </section>
        </>
      ) : null}

      {mutationError && !editorMode ? (
        <p className="automation-action-error" role="alert">
          {userErrorMessage(mutationError, "Не удалось изменить правило. Попробуйте ещё раз.")}
        </p>
      ) : null}
      {mutationSuccess && !mutationError && !editorMode ? (
        <p className="automation-action-success" role="status">{mutationSuccess}</p>
      ) : null}

      <section className="automation-detail-grid">
        <article className="ai-panel">
          <p className="eyebrow">Приоритет решений</p>
          <h2>Как MPReply выбирает режим ответа</h2>
          <ol className="automation-precedence-list">
            {precedence.map((item, index) => (
              <li key={item}>
                <span aria-hidden="true">{index + 1}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </article>

        <article className="ai-panel automation-safety-card">
          <p className="eyebrow">Проверка перед отправкой</p>
          <h2>Автоответ не отправляется вслепую</h2>
          <p>
            Перед отправкой MPReply проверяет готовый ответ. Если не хватает данных о товаре,
            ИИ не уверен в ответе или затронута тема, которая требует внимания, обращение
            передаётся человеку или автоматическая отправка останавливается.
          </p>
          <div className="automation-decision-row" aria-label="Возможные решения проверки">
            <span className="automation-decision automation-decision-allow">Можно отправить</span>
            <span className="automation-decision automation-decision-review">Нужна проверка</span>
            <span className="automation-decision automation-decision-block">Не отправлять</span>
          </div>
        </article>
      </section>
    </div>
  );
}

function RuleDetail({
  rule,
  canWrite,
  isPending,
  onEdit,
  onToggle,
}: {
  rule: AutomationRule;
  canWrite: boolean;
  isPending: boolean;
  onEdit: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <article className="automation-rule-detail" aria-labelledby={`automation-rule-${rule.id}`}>
      <header>
        <div>
          <span className={rule.is_enabled ? "automation-rule-status" : "automation-rule-status is-disabled"}>
            {rule.is_enabled ? "Включено" : "Выключено"}
          </span>
          <h2 id={`automation-rule-${rule.id}`}>{rule.name}</h2>
        </div>
        <span className="status-badge">Приоритет {rule.priority}</span>
      </header>

      <dl className="automation-rule-facts">
        <div><dt>Режим</dt><dd>{modeLabel(rule.mode)}</dd></div>
        <div><dt>Тип обращений</dt><dd>{appliesToLabel(rule.applies_to)}</dd></div>
        <div><dt>Маркетплейс</dt><dd>{marketplaceLabel(rule.marketplace)}</dd></div>
        <div><dt>Рейтинг</dt><dd>{ratingLabel(rule.min_rating, rule.max_rating)}</dd></div>
        <div><dt>Насколько уверенным должен быть ответ</dt><dd>{Math.round(rule.confidence_threshold * 100)}%</dd></div>
        <div><dt>Лимиты</dt><dd>{limitLabel(rule.hourly_limit, rule.daily_limit)}</dd></div>
      </dl>

      <div className="automation-safety-checklist" aria-label="Когда правило требует дополнительной проверки">
        <p className="automation-safety-item" data-active={rule.require_manual_review_on_flags}>
          Передавать человеку, если ответ требует дополнительного внимания
        </p>
        <p className="automation-safety-item" data-active={rule.stop_on_missing_product_context}>
          Не отправлять автоматически, если не хватает данных о товаре
        </p>
        <p className="automation-safety-item" data-active={rule.stop_on_low_confidence}>
          Не отправлять автоматически, если ИИ не уверен в ответе
        </p>
      </div>

      {rule.include_keywords.length || rule.exclude_keywords.length || rule.sensitive_topics.length ? (
        <div className="automation-keyword-groups">
          <KeywordList label="Если встречаются слова" values={rule.include_keywords} />
          <KeywordList label="Не применять при словах" values={rule.exclude_keywords} />
          <KeywordList label="Темы, которые всегда нужно проверять" values={rule.sensitive_topics} />
        </div>
      ) : null}

      {canWrite ? (
        <div className="automation-detail-actions">
          <button className="button button-secondary" onClick={onEdit} type="button">Редактировать</button>
          <button
            className="button button-secondary"
            disabled={isPending}
            onClick={() => onToggle(!rule.is_enabled)}
            type="button"
          >
            {isPending ? "Сохраняем..." : rule.is_enabled ? "Выключить" : "Включить"}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function RuleEditor({
  state,
  mode,
  isPending,
  error,
  onChange,
  onSubmit,
  onCancel,
}: {
  state: RuleEditorState;
  mode: EditorMode;
  isPending: boolean;
  error: string | null;
  onChange: (state: RuleEditorState) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const set = <K extends keyof RuleEditorState>(key: K, value: RuleEditorState[K]) =>
    onChange({ ...state, [key]: value });

  return (
    <form
      aria-label="Редактор правила автоматизации"
      className="automation-editor"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <header>
        <div>
          <p className="eyebrow">{mode === "create" ? "Новое правило" : "Редактирование"}</p>
          <h2>{mode === "create" ? "Настройте, когда и как отвечать" : state.name}</h2>
        </div>
      </header>

      <div className="automation-form-grid">
        <label className="automation-field automation-field-wide">
          Название
          <input minLength={2} maxLength={255} required value={state.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="automation-field">
          Приоритет
          <input min={0} max={10000} required type="number" value={state.priority} onChange={(e) => set("priority", e.target.value)} />
          <small>Чем выше число, тем раньше проверяется правило.</small>
        </label>
        <label className="automation-field">
          Режим
          <select value={state.mode} onChange={(e) => set("mode", e.target.value as RuleEditorState["mode"]) }>
            <option value="auto">Автоматически</option>
            <option value="semi_auto">С проверкой перед отправкой</option>
          </select>
        </label>
        <label className="automation-field">
          Тип обращений
          <select value={state.appliesTo} onChange={(e) => set("appliesTo", e.target.value as RuleEditorState["appliesTo"]) }>
            <option value="all">Отзывы, вопросы и сообщения</option>
            <option value="review">Только отзывы</option>
            <option value="question">Только вопросы</option>
            <option value="chat">Только сообщения покупателей</option>
          </select>
        </label>
        <label className="automation-field">
          Маркетплейс
          <select value={state.marketplace} onChange={(e) => set("marketplace", e.target.value as RuleEditorState["marketplace"]) }>
            <option value="">Все поддерживаемые</option>
            <option value="wildberries">Wildberries</option>
            <option value="ozon">Ozon</option>
            <option value="yandex_market">Яндекс Маркет</option>
            <option value="avito">Авито</option>
          </select>
        </label>
        <label className="automation-field">
          Рейтинг от
          <input min={1} max={5} type="number" value={state.minRating} onChange={(e) => set("minRating", e.target.value)} />
        </label>
        <label className="automation-field">
          Рейтинг до
          <input min={1} max={5} type="number" value={state.maxRating} onChange={(e) => set("maxRating", e.target.value)} />
        </label>
        <label className="automation-field">
          Насколько уверенным должен быть ответ
          <span className="automation-field-with-suffix">
            <input aria-label="Насколько уверенным должен быть ответ" min={0} max={100} step={1} required type="number" value={state.confidenceThreshold} onChange={(e) => set("confidenceThreshold", e.target.value)} />
            <span aria-hidden="true">%</span>
          </span>
        </label>
        <label className="automation-field">
          Лимит в час
          <input min={1} max={10000} type="number" value={state.hourlyLimit} onChange={(e) => set("hourlyLimit", e.target.value)} />
        </label>
        <label className="automation-field">
          Лимит в день
          <input min={1} max={100000} type="number" value={state.dailyLimit} onChange={(e) => set("dailyLimit", e.target.value)} />
        </label>
        <label className="automation-field automation-field-wide">
          Если встречаются слова
          <input placeholder="доставка, упаковка" value={state.includeKeywords} onChange={(e) => set("includeKeywords", e.target.value)} />
          <small>Правило применяется только к обращениям с этими словами.</small>
        </label>
        <label className="automation-field automation-field-wide">
          Не применять при словах
          <input placeholder="возврат, компенсация" value={state.excludeKeywords} onChange={(e) => set("excludeKeywords", e.target.value)} />
          <small>Если встречается одно из этих слов, правило не применяется.</small>
        </label>
        <label className="automation-field automation-field-wide">
          Темы, которые всегда нужно проверять
          <input placeholder="медицина, юридические обещания" value={state.sensitiveTopics} onChange={(e) => set("sensitiveTopics", e.target.value)} />
        </label>
      </div>

      <fieldset className="automation-safety-fieldset">
        <legend>Когда не отправлять автоматически</legend>
        <label><input checked={state.requireManualReviewOnFlags} onChange={(e) => set("requireManualReviewOnFlags", e.target.checked)} type="checkbox" /> Передавать человеку, если ответ требует дополнительного внимания</label>
        <label><input checked={state.stopOnMissingProductContext} onChange={(e) => set("stopOnMissingProductContext", e.target.checked)} type="checkbox" /> Если не хватает данных о товаре</label>
        <label><input checked={state.stopOnLowConfidence} onChange={(e) => set("stopOnLowConfidence", e.target.checked)} type="checkbox" /> Если ИИ не уверен в ответе</label>
        <label><input checked={state.isEnabled} onChange={(e) => set("isEnabled", e.target.checked)} type="checkbox" /> Правило включено</label>
      </fieldset>

      {error ? <p className="automation-action-error" role="alert">{error}</p> : null}

      <div className="automation-detail-actions">
        <button className="button button-primary" disabled={isPending || state.name.trim().length < 2} type="submit">
          {isPending ? "Сохраняем..." : mode === "create" ? "Создать правило" : "Сохранить изменения"}
        </button>
        <button className="button button-secondary" disabled={isPending} onClick={onCancel} type="button">Отмена</button>
      </div>
    </form>
  );
}

function KeywordList({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div>
      <span>{label}</span>
      <p>{values.join(", ")}</p>
    </div>
  );
}

function emptyEditor(): RuleEditorState {
  return {
    name: "",
    priority: "100",
    mode: "auto",
    appliesTo: "all",
    marketplace: "",
    minRating: "",
    maxRating: "",
    includeKeywords: "",
    excludeKeywords: "",
    sensitiveTopics: "",
    dailyLimit: "",
    hourlyLimit: "",
    confidenceThreshold: "80",
    requireManualReviewOnFlags: true,
    stopOnMissingProductContext: true,
    stopOnLowConfidence: true,
    isEnabled: true,
  };
}

function editorFromRule(rule: AutomationRule): RuleEditorState {
  return {
    name: rule.name,
    priority: String(rule.priority),
    mode: rule.mode,
    appliesTo: rule.applies_to,
    marketplace: rule.marketplace ?? "",
    minRating: numberToInput(rule.min_rating),
    maxRating: numberToInput(rule.max_rating),
    includeKeywords: rule.include_keywords.join(", "),
    excludeKeywords: rule.exclude_keywords.join(", "),
    sensitiveTopics: rule.sensitive_topics.join(", "),
    dailyLimit: numberToInput(rule.daily_limit),
    hourlyLimit: numberToInput(rule.hourly_limit),
    confidenceThreshold: String(Math.round(rule.confidence_threshold * 100)),
    requireManualReviewOnFlags: rule.require_manual_review_on_flags,
    stopOnMissingProductContext: rule.stop_on_missing_product_context,
    stopOnLowConfidence: rule.stop_on_low_confidence,
    isEnabled: rule.is_enabled,
  };
}

function editorPayload(state: RuleEditorState, organizationId: string) {
  return {
    organization_id: organizationId,
    name: state.name.trim(),
    priority: Number(state.priority),
    is_enabled: state.isEnabled,
    mode: state.mode,
    applies_to: state.appliesTo,
    marketplace: state.marketplace || null,
    min_rating: nullableNumber(state.minRating),
    max_rating: nullableNumber(state.maxRating),
    include_keywords: stringList(state.includeKeywords),
    exclude_keywords: stringList(state.excludeKeywords),
    sensitive_topics: stringList(state.sensitiveTopics),
    daily_limit: nullableNumber(state.dailyLimit),
    hourly_limit: nullableNumber(state.hourlyLimit),
    require_manual_review_on_flags: state.requireManualReviewOnFlags,
    stop_on_missing_product_context: state.stopOnMissingProductContext,
    stop_on_low_confidence: state.stopOnLowConfidence,
    confidence_threshold: Number(state.confidenceThreshold) / 100,
  };
}

function stringList(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLocaleLowerCase("ru-RU");
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function nullableNumber(value: string): number | null {
  return value.trim() ? Number(value) : null;
}

function numberToInput(value: number | null): string {
  return value === null ? "" : String(value);
}

function modeLabel(mode: AutomationRule["mode"]): string {
  return mode === "auto" ? "Автоматически" : "С проверкой перед отправкой";
}

function appliesToLabel(value: AutomationRule["applies_to"]): string {
  if (value === "review") return "Отзывы";
  if (value === "question") return "Вопросы";
  if (value === "chat") return "Сообщения покупателей";
  return "Отзывы, вопросы и сообщения";
}

function marketplaceLabel(value: AutomationRule["marketplace"]): string {
  if (value === "wildberries") return "Wildberries";
  if (value === "ozon") return "Ozon";
  if (value === "yandex_market") return "Яндекс Маркет";
  if (value === "avito") return "Авито";
  return "Все поддерживаемые";
}

function ratingLabel(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `${min}–${max}`;
  if (min !== null) return `от ${min}`;
  if (max !== null) return `до ${max}`;
  return "Любой";
}

function limitLabel(hourly: number | null, daily: number | null): string {
  const parts = [];
  if (hourly !== null) parts.push(`${hourly}/час`);
  if (daily !== null) parts.push(`${daily}/день`);
  return parts.length > 0 ? parts.join(" · ") : "Без отдельного лимита";
}

function filterMatchesRuleState(filter: RuleFilter, isEnabled: boolean): boolean {
  return filter === "all" || (filter === "enabled" && isEnabled) || (filter === "disabled" && !isEnabled);
}

function userErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Сессия истекла. Войдите снова.";
    if (error.status === 403) return "Недостаточно прав для этого действия.";
    if (error.status === 404) return "Правило не найдено. Обновите список и попробуйте снова.";
    if (error.status === 409) return "Правило уже изменилось. Обновите список и повторите действие.";
    if (error.status === 422) return "Проверьте заполненные поля и попробуйте снова.";
    if (error.status === 429) return "Слишком много действий подряд. Подождите немного и попробуйте снова.";
    return fallback;
  }
  return fallback;
}
