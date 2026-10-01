"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { ApiError, apiRequest, buildApiQuery } from "../../lib/api/client";
import type { Locale } from "../../lib/i18n";
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

const precedence: Record<Locale, readonly string[]> = {
  ru: [
    "Режим ответов по умолчанию",
    "Настройки выбранного кабинета маркетплейса",
    "Подходящее правило с самым высоким приоритетом",
    "Проверка данных о товаре и качества ответа",
    "Проверка перед автоматической отправкой",
  ],
  en: [
    "Default reply mode",
    "Settings for the selected marketplace account",
    "Highest-priority matching rule",
    "Product-context and reply-quality checks",
    "Final check before automatic sending",
  ],
};

const filterLabels: Record<Locale, Record<RuleFilter, string>> = {
  ru: { all: "Все", enabled: "Включённые", disabled: "Выключенные" },
  en: { all: "All", enabled: "Enabled", disabled: "Disabled" },
};

const automationCopy = {
  ru: {
    created: "Правило создано.", saved: "Изменения сохранены.", enabledSuccess: "Правило включено.", disabledSuccess: "Правило выключено.",
    manageAria: "Управление правилами", toolbarCopy: "Правила применяются по приоритету. Перед автоматической отправкой MPReply проверяет, можно ли безопасно отправить ответ.",
    refreshing: "Обновляем...", refreshRules: "Обновить правила", createRule: "Создать правило", readOnly: "Только просмотр: изменять правила могут владелец и администраторы.",
    summaryAria: "Сводка правил", filteredRules: "Правил по фильтру", enabledInList: "Включено в списке", accessMode: "Режим доступа", management: "Управление", viewOnly: "Просмотр",
    filterAria: "Фильтр правил", loadingRules: "Загружаем правила", loadingRulesDescription: "Получаем актуальные правила автоматизации для вашей компании.",
    loadRulesError: "Не удалось загрузить правила", rulesUnavailable: "Правила временно недоступны. Попробуйте ещё раз.", retrying: "Повторяем...", retry: "Повторить",
    refreshError: "Не удалось обновить правила", staleRules: "Показываем ранее загруженные правила. Можно продолжать работу или попробовать ещё раз.",
    rulesAria: "Правила автоматизации", noRules: "Правил пока нет", noRulesAll: "Создайте первое правило, чтобы управлять автоматическими ответами и ответами с проверкой.",
    noRulesFiltered: "В этой выборке правил нет. Измените фильтр или создайте новое правило.", createFirstRule: "Создать первое правило", enabled: "Включено", disabled: "Выключено",
    priority: "Приоритет", saveError: "Не удалось сохранить правило. Проверьте данные и попробуйте ещё раз.", disableConfirm: "Выключить правило",
    chooseRule: "Выберите правило", chooseRuleDescription: "Здесь появятся условия, способ отправки и ограничения выбранного правила.", changeError: "Не удалось изменить правило. Попробуйте ещё раз.",
    precedenceEyebrow: "Приоритет решений", precedenceTitle: "Как MPReply выбирает режим ответа", safetyEyebrow: "Проверка перед отправкой", safetyTitle: "Автоответ не отправляется вслепую",
    safetyDescription: "Перед отправкой MPReply проверяет готовый ответ. Если не хватает данных о товаре, ИИ не уверен в ответе или затронута тема, которая требует внимания, обращение передаётся человеку или автоматическая отправка останавливается.",
    decisionsAria: "Возможные решения проверки", allow: "Можно отправить", needsReview: "Нужна проверка", block: "Не отправлять", mode: "Режим", messageTypes: "Тип обращений",
    marketplace: "Маркетплейс", rating: "Рейтинг", confidence: "Насколько уверенным должен быть ответ", limits: "Лимиты", extraReviewAria: "Когда правило требует дополнительной проверки",
    manualReviewFlag: "Передавать человеку, если ответ требует дополнительного внимания", missingContextFlag: "Не отправлять автоматически, если не хватает данных о товаре",
    lowConfidenceFlag: "Не отправлять автоматически, если ИИ не уверен в ответе", includeKeywords: "Если встречаются слова", excludeKeywords: "Не применять при словах",
    sensitiveTopics: "Темы, которые всегда нужно проверять", edit: "Редактировать", saving: "Сохраняем...", disable: "Выключить", enable: "Включить",
    editorAria: "Редактор правила автоматизации", newRule: "Новое правило", editing: "Редактирование", editorTitle: "Настройте, когда и как отвечать", name: "Название",
    priorityHint: "Чем выше число, тем раньше проверяется правило.", auto: "Автоматически", semiAuto: "С проверкой перед отправкой", allMessageTypes: "Отзывы, вопросы и сообщения",
    onlyReviews: "Только отзывы", onlyQuestions: "Только вопросы", onlyChats: "Только сообщения покупателей", allMarketplaces: "Все поддерживаемые", yandex: "Яндекс Маркет", avito: "Авито",
    ratingFrom: "Рейтинг от", ratingTo: "Рейтинг до", hourlyLimit: "Лимит в час", dailyLimit: "Лимит в день", includePlaceholder: "доставка, упаковка",
    includeHint: "Правило применяется только к обращениям с этими словами.", excludePlaceholder: "возврат, компенсация", excludeHint: "Если встречается одно из этих слов, правило не применяется.",
    sensitivePlaceholder: "медицина, юридические обещания", safetyLegend: "Когда не отправлять автоматически", missingContextShort: "Если не хватает данных о товаре",
    lowConfidenceShort: "Если ИИ не уверен в ответе", ruleEnabled: "Правило включено", saveChanges: "Сохранить изменения", cancel: "Отмена", reviews: "Отзывы", questions: "Вопросы",
    chats: "Сообщения покупателей", from: "от", to: "до", any: "Любой", hourShort: "час", dayShort: "день", noSeparateLimit: "Без отдельного лимита",
    unauthorized: "Сессия истекла. Войдите снова.", forbidden: "Недостаточно прав для этого действия.", notFound: "Правило не найдено. Обновите список и попробуйте снова.",
    conflict: "Правило уже изменилось. Обновите список и повторите действие.", invalid: "Проверьте заполненные поля и попробуйте снова.", rateLimit: "Слишком много действий подряд. Подождите немного и попробуйте снова.",
  },
  en: {
    created: "Rule created.", saved: "Changes saved.", enabledSuccess: "Rule enabled.", disabledSuccess: "Rule disabled.",
    manageAria: "Automation rule management", toolbarCopy: "Rules are evaluated by priority. Before an automatic reply is sent, MPReply checks whether the prepared reply can be sent safely.",
    refreshing: "Refreshing...", refreshRules: "Refresh rules", createRule: "Create rule", readOnly: "View only: only owners and administrators can change automation rules.",
    summaryAria: "Rule summary", filteredRules: "Rules in filter", enabledInList: "Enabled in list", accessMode: "Access mode", management: "Management", viewOnly: "View only",
    filterAria: "Rule filter", loadingRules: "Loading rules", loadingRulesDescription: "Loading the current automation rules for your workspace.",
    loadRulesError: "Could not load rules", rulesUnavailable: "Automation rules are temporarily unavailable. Try again.", retrying: "Retrying...", retry: "Retry",
    refreshError: "Could not refresh rules", staleRules: "Showing previously loaded rules. You can continue working or try refreshing again.",
    rulesAria: "Automation rules", noRules: "No rules yet", noRulesAll: "Create your first rule to control automatic replies and review-before-send workflows.",
    noRulesFiltered: "There are no rules in this filter. Change the filter or create a new rule.", createFirstRule: "Create first rule", enabled: "Enabled", disabled: "Disabled",
    priority: "Priority", saveError: "Could not save the rule. Check the fields and try again.", disableConfirm: "Disable rule",
    chooseRule: "Choose a rule", chooseRuleDescription: "The selected rule's conditions, sending mode, and limits will appear here.", changeError: "Could not change the rule. Try again.",
    precedenceEyebrow: "Decision order", precedenceTitle: "How MPReply selects the reply mode", safetyEyebrow: "Check before sending", safetyTitle: "Automatic replies are not sent blindly",
    safetyDescription: "Before sending, MPReply checks the prepared reply. If product context is missing, confidence is too low, or the topic needs attention, the message is routed to a person or automatic sending stops.",
    decisionsAria: "Possible check outcomes", allow: "Can send", needsReview: "Needs review", block: "Do not send", mode: "Mode", messageTypes: "Message types",
    marketplace: "Marketplace", rating: "Rating", confidence: "Required reply confidence", limits: "Limits", extraReviewAria: "When the rule requires extra review",
    manualReviewFlag: "Route to a person when the reply needs additional attention", missingContextFlag: "Do not send automatically when product context is missing",
    lowConfidenceFlag: "Do not send automatically when AI confidence is low", includeKeywords: "Apply when these words appear", excludeKeywords: "Do not apply when these words appear",
    sensitiveTopics: "Topics that always require review", edit: "Edit", saving: "Saving...", disable: "Disable", enable: "Enable",
    editorAria: "Automation rule editor", newRule: "New rule", editing: "Editing", editorTitle: "Configure when and how MPReply should reply", name: "Name",
    priorityHint: "Higher numbers are evaluated earlier.", auto: "Automatic", semiAuto: "Review before sending", allMessageTypes: "Reviews, questions, and customer messages",
    onlyReviews: "Reviews only", onlyQuestions: "Questions only", onlyChats: "Customer messages only", allMarketplaces: "All supported marketplaces", yandex: "Yandex Market", avito: "Avito",
    ratingFrom: "Minimum rating", ratingTo: "Maximum rating", hourlyLimit: "Hourly limit", dailyLimit: "Daily limit", includePlaceholder: "delivery, packaging",
    includeHint: "The rule applies only when the customer message contains one of these terms.", excludePlaceholder: "return, compensation", excludeHint: "The rule does not apply when one of these terms appears.",
    sensitivePlaceholder: "medical, legal promises", safetyLegend: "When automatic sending must stop", missingContextShort: "When product context is missing",
    lowConfidenceShort: "When AI confidence is low", ruleEnabled: "Rule enabled", saveChanges: "Save changes", cancel: "Cancel", reviews: "Reviews", questions: "Questions",
    chats: "Customer messages", from: "from", to: "to", any: "Any", hourShort: "hour", dayShort: "day", noSeparateLimit: "No separate limit",
    unauthorized: "Your session expired. Log in again.", forbidden: "You do not have permission for this action.", notFound: "The rule could not be found. Refresh the list and try again.",
    conflict: "The rule has already changed. Refresh the list and try again.", invalid: "Check the completed fields and try again.", rateLimit: "Too many actions in a short time. Wait a moment and try again.",
  },
} as const;

export function AutomationRulesWorkspace() {
  const { activeOrganization, locale } = useWorkspace();

  return (
    <AutomationRulesWorkspaceContent
      key={activeOrganization.id}
      organizationId={activeOrganization.id}
      organizationName={activeOrganization.name}
      role={activeOrganization.current_user_role}
      locale={locale}
    />
  );
}

function AutomationRulesWorkspaceContent({
  organizationId,
  organizationName,
  role,
  locale,
}: {
  organizationId: string;
  organizationName: string;
  role: "owner" | "admin" | "manager" | "viewer";
  locale: Locale;
}) {
  const t = automationCopy[locale];
  const localizedPrecedence = precedence[locale];
  const localizedFilterLabels = filterLabels[locale];
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
      const successMessage = editorMode === "create" ? t.created : t.saved;
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
      setMutationSuccess(variables.enabled ? t.enabledSuccess : t.disabledSuccess);
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
      <section className="automation-toolbar" aria-label={t.manageAria}>
        <div>
          <p className="automation-toolbar-title">{organizationName}</p>
          <p className="automation-toolbar-copy">
            {t.toolbarCopy}
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
              {rulesQuery.isFetching ? t.refreshing : t.refreshRules}
            </button>
          ) : null}
          {canWrite ? (
            <button className="button button-primary" onClick={startCreate} type="button">
              {t.createRule}
            </button>
          ) : null}
        </div>
        {!canWrite ? (
          <p className="automation-readonly-note" role="status">
            {t.readOnly}
          </p>
        ) : null}
      </section>

      <section className="automation-summary" aria-label={t.summaryAria}>
        <article>
          <span>{t.filteredRules}</span>
          <strong>{rulesQuery.data?.total ?? "—"}</strong>
        </article>
        <article>
          <span>{t.enabledInList}</span>
          <strong>{rulesQuery.data?.items.filter((rule) => rule.is_enabled).length ?? "—"}</strong>
        </article>
        <article>
          <span>{t.accessMode}</span>
          <strong>{canWrite ? t.management : t.viewOnly}</strong>
        </article>
      </section>

      <div className="automation-filter-row" aria-label={t.filterAria}>
        {(Object.keys(localizedFilterLabels) as RuleFilter[]).map((value) => (
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
            {localizedFilterLabels[value]}
          </button>
        ))}
      </div>

      {rulesQuery.isPending && !rulesQuery.data ? (
        <section className="automation-state" aria-busy="true" aria-live="polite" role="status">
          <h2>{t.loadingRules}</h2>
          <p>{t.loadingRulesDescription}</p>
        </section>
      ) : rulesQuery.error && !rulesQuery.data ? (
        <section className="automation-state automation-state-error" role="alert">
          <h2>{t.loadRulesError}</h2>
          <p>{userErrorMessage(rulesQuery.error, t.rulesUnavailable, locale)}</p>
          <button
            className="button button-secondary"
            disabled={rulesQuery.isFetching}
            onClick={() => void rulesQuery.refetch()}
            type="button"
          >
            {rulesQuery.isFetching ? t.retrying : t.retry}
          </button>
        </section>
      ) : rulesQuery.data ? (
        <>
          {rulesQuery.error ? (
            <div className="automation-refresh-error" role="alert">
              <div>
                <strong>{t.refreshError}</strong>
                <p>{t.staleRules}</p>
              </div>
              <button
                className="button button-secondary button-compact"
                disabled={rulesQuery.isFetching}
                onClick={() => void rulesQuery.refetch()}
                type="button"
              >
                {rulesQuery.isFetching ? t.retrying : t.retry}
              </button>
            </div>
          ) : null}
          <section className="automation-live-layout">
          <div className="automation-rule-list" aria-label={t.rulesAria}>
            {rulesQuery.data.items.length === 0 ? (
              <div className="automation-empty-state">
                <h2>{t.noRules}</h2>
                <p>
                  {filter === "all"
                    ? t.noRulesAll
                    : t.noRulesFiltered}
                </p>
                {canWrite ? (
                  <button className="button button-secondary" onClick={startCreate} type="button">
                    {t.createFirstRule}
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
                      {rule.is_enabled ? t.enabled : t.disabled}
                    </span>
                  </span>
                  <span className="automation-rule-row-meta">
                    {t.priority} {rule.priority} · {modeLabel(rule.mode, locale)} · {appliesToLabel(rule.applies_to, locale)}
                  </span>
                </button>
              ))
            )}
          </div>

          <div ref={detailPanelRef} className="automation-detail-panel">
            {editorMode ? (
              <RuleEditor
                error={mutationError ? userErrorMessage(mutationError, t.saveError, locale) : null}
                isPending={saveMutation.isPending}
                mode={editorMode}
                onCancel={() => setEditorMode(null)}
                onChange={setEditor}
                onSubmit={() => saveMutation.mutate()}
                state={editor}
                locale={locale}
              />
            ) : selectedRule ? (
              <RuleDetail
                canWrite={canWrite}
                isPending={toggleMutation.isPending}
                onEdit={() => startEdit(selectedRule)}
                onToggle={(enabled) => {
                  if (!enabled && !window.confirm(`${t.disableConfirm} “${selectedRule.name}”?`)) return;
                  toggleMutation.mutate({ rule: selectedRule, enabled });
                }}
                rule={selectedRule}
                locale={locale}
              />
            ) : (
              <div className="automation-empty-state">
                <h2>{t.chooseRule}</h2>
                <p>{t.chooseRuleDescription}</p>
              </div>
            )}
          </div>
        </section>
        </>
      ) : null}

      {mutationError && !editorMode ? (
        <p className="automation-action-error" role="alert">
          {userErrorMessage(mutationError, t.changeError, locale)}
        </p>
      ) : null}
      {mutationSuccess && !mutationError && !editorMode ? (
        <p className="automation-action-success" role="status">{mutationSuccess}</p>
      ) : null}

      <section className="automation-detail-grid">
        <article className="ai-panel">
          <p className="eyebrow">{t.precedenceEyebrow}</p>
          <h2>{t.precedenceTitle}</h2>
          <ol className="automation-precedence-list">
            {localizedPrecedence.map((item, index) => (
              <li key={item}>
                <span aria-hidden="true">{index + 1}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </article>

        <article className="ai-panel automation-safety-card">
          <p className="eyebrow">{t.safetyEyebrow}</p>
          <h2>{t.safetyTitle}</h2>
          <p>
            {t.safetyDescription}
          </p>
          <div className="automation-decision-row" aria-label={t.decisionsAria}>
            <span className="automation-decision automation-decision-allow">{t.allow}</span>
            <span className="automation-decision automation-decision-review">{t.needsReview}</span>
            <span className="automation-decision automation-decision-block">{t.block}</span>
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
  locale,
}: {
  rule: AutomationRule;
  canWrite: boolean;
  isPending: boolean;
  onEdit: () => void;
  onToggle: (enabled: boolean) => void;
  locale: Locale;
}) {
  const t = automationCopy[locale];
  return (
    <article className="automation-rule-detail" aria-labelledby={`automation-rule-${rule.id}`}>
      <header>
        <div>
          <span className={rule.is_enabled ? "automation-rule-status" : "automation-rule-status is-disabled"}>
            {rule.is_enabled ? t.enabled : t.disabled}
          </span>
          <h2 id={`automation-rule-${rule.id}`}>{rule.name}</h2>
        </div>
        <span className="status-badge">{t.priority} {rule.priority}</span>
      </header>

      <dl className="automation-rule-facts">
        <div><dt>{t.mode}</dt><dd>{modeLabel(rule.mode, locale)}</dd></div>
        <div><dt>{t.messageTypes}</dt><dd>{appliesToLabel(rule.applies_to, locale)}</dd></div>
        <div><dt>{t.marketplace}</dt><dd>{marketplaceLabel(rule.marketplace, locale)}</dd></div>
        <div><dt>{t.rating}</dt><dd>{ratingLabel(rule.min_rating, rule.max_rating, locale)}</dd></div>
        <div><dt>{t.confidence}</dt><dd>{Math.round(rule.confidence_threshold * 100)}%</dd></div>
        <div><dt>{t.limits}</dt><dd>{limitLabel(rule.hourly_limit, rule.daily_limit, locale)}</dd></div>
      </dl>

      <div className="automation-safety-checklist" aria-label={t.extraReviewAria}>
        <p className="automation-safety-item" data-active={rule.require_manual_review_on_flags}>
          {t.manualReviewFlag}
        </p>
        <p className="automation-safety-item" data-active={rule.stop_on_missing_product_context}>
          {t.missingContextFlag}
        </p>
        <p className="automation-safety-item" data-active={rule.stop_on_low_confidence}>
          {t.lowConfidenceFlag}
        </p>
      </div>

      {rule.include_keywords.length || rule.exclude_keywords.length || rule.sensitive_topics.length ? (
        <div className="automation-keyword-groups">
          <KeywordList label={t.includeKeywords} values={rule.include_keywords} />
          <KeywordList label={t.excludeKeywords} values={rule.exclude_keywords} />
          <KeywordList label={t.sensitiveTopics} values={rule.sensitive_topics} />
        </div>
      ) : null}

      {canWrite ? (
        <div className="automation-detail-actions">
          <button className="button button-secondary" onClick={onEdit} type="button">{t.edit}</button>
          <button
            className="button button-secondary"
            disabled={isPending}
            onClick={() => onToggle(!rule.is_enabled)}
            type="button"
          >
            {isPending ? t.saving : rule.is_enabled ? t.disable : t.enable}
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
  locale,
}: {
  state: RuleEditorState;
  mode: EditorMode;
  isPending: boolean;
  error: string | null;
  onChange: (state: RuleEditorState) => void;
  onSubmit: () => void;
  onCancel: () => void;
  locale: Locale;
}) {
  const t = automationCopy[locale];
  const set = <K extends keyof RuleEditorState>(key: K, value: RuleEditorState[K]) =>
    onChange({ ...state, [key]: value });

  return (
    <form
      aria-label={t.editorAria}
      className="automation-editor"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <header>
        <div>
          <p className="eyebrow">{mode === "create" ? t.newRule : t.editing}</p>
          <h2>{mode === "create" ? t.editorTitle : state.name}</h2>
        </div>
      </header>

      <div className="automation-form-grid">
        <label className="automation-field automation-field-wide">
          {t.name}
          <input minLength={2} maxLength={255} required value={state.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="automation-field">
          {t.priority}
          <input min={0} max={10000} required type="number" value={state.priority} onChange={(e) => set("priority", e.target.value)} />
          <small>{t.priorityHint}</small>
        </label>
        <label className="automation-field">
          {t.mode}
          <select value={state.mode} onChange={(e) => set("mode", e.target.value as RuleEditorState["mode"]) }>
            <option value="auto">{t.auto}</option>
            <option value="semi_auto">{t.semiAuto}</option>
          </select>
        </label>
        <label className="automation-field">
          {t.messageTypes}
          <select value={state.appliesTo} onChange={(e) => set("appliesTo", e.target.value as RuleEditorState["appliesTo"]) }>
            <option value="all">{t.allMessageTypes}</option>
            <option value="review">{t.onlyReviews}</option>
            <option value="question">{t.onlyQuestions}</option>
            <option value="chat">{t.onlyChats}</option>
          </select>
        </label>
        <label className="automation-field">
          {t.marketplace}
          <select value={state.marketplace} onChange={(e) => set("marketplace", e.target.value as RuleEditorState["marketplace"]) }>
            <option value="">{t.allMarketplaces}</option>
            <option value="wildberries">Wildberries</option>
            <option value="ozon">Ozon</option>
            <option value="yandex_market">{t.yandex}</option>
            <option value="avito">{t.avito}</option>
          </select>
        </label>
        <label className="automation-field">
          {t.ratingFrom}
          <input min={1} max={5} type="number" value={state.minRating} onChange={(e) => set("minRating", e.target.value)} />
        </label>
        <label className="automation-field">
          {t.ratingTo}
          <input min={1} max={5} type="number" value={state.maxRating} onChange={(e) => set("maxRating", e.target.value)} />
        </label>
        <label className="automation-field">
          {t.confidence}
          <span className="automation-field-with-suffix">
            <input aria-label={t.confidence} min={0} max={100} step={1} required type="number" value={state.confidenceThreshold} onChange={(e) => set("confidenceThreshold", e.target.value)} />
            <span aria-hidden="true">%</span>
          </span>
        </label>
        <label className="automation-field">
          {t.hourlyLimit}
          <input min={1} max={10000} type="number" value={state.hourlyLimit} onChange={(e) => set("hourlyLimit", e.target.value)} />
        </label>
        <label className="automation-field">
          {t.dailyLimit}
          <input min={1} max={100000} type="number" value={state.dailyLimit} onChange={(e) => set("dailyLimit", e.target.value)} />
        </label>
        <label className="automation-field automation-field-wide">
          {t.includeKeywords}
          <input placeholder={t.includePlaceholder} value={state.includeKeywords} onChange={(e) => set("includeKeywords", e.target.value)} />
          <small>{t.includeHint}</small>
        </label>
        <label className="automation-field automation-field-wide">
          {t.excludeKeywords}
          <input placeholder={t.excludePlaceholder} value={state.excludeKeywords} onChange={(e) => set("excludeKeywords", e.target.value)} />
          <small>{t.excludeHint}</small>
        </label>
        <label className="automation-field automation-field-wide">
          {t.sensitiveTopics}
          <input placeholder={t.sensitivePlaceholder} value={state.sensitiveTopics} onChange={(e) => set("sensitiveTopics", e.target.value)} />
        </label>
      </div>

      <fieldset className="automation-safety-fieldset">
        <legend>{t.safetyLegend}</legend>
        <label><input checked={state.requireManualReviewOnFlags} onChange={(e) => set("requireManualReviewOnFlags", e.target.checked)} type="checkbox" /> {t.manualReviewFlag}</label>
        <label><input checked={state.stopOnMissingProductContext} onChange={(e) => set("stopOnMissingProductContext", e.target.checked)} type="checkbox" /> {t.missingContextShort}</label>
        <label><input checked={state.stopOnLowConfidence} onChange={(e) => set("stopOnLowConfidence", e.target.checked)} type="checkbox" /> {t.lowConfidenceShort}</label>
        <label><input checked={state.isEnabled} onChange={(e) => set("isEnabled", e.target.checked)} type="checkbox" /> {t.ruleEnabled}</label>
      </fieldset>

      {error ? <p className="automation-action-error" role="alert">{error}</p> : null}

      <div className="automation-detail-actions">
        <button className="button button-primary" disabled={isPending || state.name.trim().length < 2} type="submit">
          {isPending ? t.saving : mode === "create" ? t.createRule : t.saveChanges}
        </button>
        <button className="button button-secondary" disabled={isPending} onClick={onCancel} type="button">{t.cancel}</button>
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

function modeLabel(mode: AutomationRule["mode"], locale: Locale): string {
  const t = automationCopy[locale];
  return mode === "auto" ? t.auto : t.semiAuto;
}

function appliesToLabel(value: AutomationRule["applies_to"], locale: Locale): string {
  const t = automationCopy[locale];
  if (value === "review") return t.reviews;
  if (value === "question") return t.questions;
  if (value === "chat") return t.chats;
  return t.allMessageTypes;
}

function marketplaceLabel(value: AutomationRule["marketplace"], locale: Locale): string {
  const t = automationCopy[locale];
  if (value === "wildberries") return "Wildberries";
  if (value === "ozon") return "Ozon";
  if (value === "yandex_market") return t.yandex;
  if (value === "avito") return t.avito;
  return t.allMarketplaces;
}

function ratingLabel(min: number | null, max: number | null, locale: Locale): string {
  const t = automationCopy[locale];
  if (min !== null && max !== null) return `${min}–${max}`;
  if (min !== null) return `${t.from} ${min}`;
  if (max !== null) return `${t.to} ${max}`;
  return t.any;
}

function limitLabel(hourly: number | null, daily: number | null, locale: Locale): string {
  const t = automationCopy[locale];
  const parts = [];
  if (hourly !== null) parts.push(`${hourly}/${t.hourShort}`);
  if (daily !== null) parts.push(`${daily}/${t.dayShort}`);
  return parts.length > 0 ? parts.join(" · ") : t.noSeparateLimit;
}

function filterMatchesRuleState(filter: RuleFilter, isEnabled: boolean): boolean {
  return filter === "all" || (filter === "enabled" && isEnabled) || (filter === "disabled" && !isEnabled);
}

function userErrorMessage(error: unknown, fallback: string, locale: Locale): string {
  const t = automationCopy[locale];
  if (error instanceof ApiError) {
    if (error.status === 401) return t.unauthorized;
    if (error.status === 403) return t.forbidden;
    if (error.status === 404) return t.notFound;
    if (error.status === 409) return t.conflict;
    if (error.status === 422) return t.invalid;
    if (error.status === 429) return t.rateLimit;
    return fallback;
  }
  return fallback;
}
