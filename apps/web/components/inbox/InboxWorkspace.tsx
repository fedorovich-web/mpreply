"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { ApiError, apiRequest, buildApiQuery } from "../../lib/api/client";
import { localizedPath, type Locale } from "../../lib/i18n";
import {
  analyticsOverviewSchema,
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
const inboxPageSize = 8;
const marketplaceFilters: Record<Locale, Array<{ value: MarketplaceFilter; label: string }>> = {
  ru: [
    { value: "all", label: "Все" },
    { value: "wildberries", label: "Wildberries" },
    { value: "ozon", label: "Ozon" },
    { value: "yandex_market", label: "Яндекс Маркет" },
    { value: "avito", label: "Авито" },
  ],
  en: [
    { value: "all", label: "All" },
    { value: "wildberries", label: "Wildberries" },
    { value: "ozon", label: "Ozon" },
    { value: "yandex_market", label: "Yandex Market" },
    { value: "avito", label: "Avito" },
  ],
};

const defaultFilters: FilterState = {
  marketplace: "all",
  assignment: "all",
  type: "all",
  status: "all",
  query: "",
  rating: "all",
};

const messageStatusLabels: Record<Locale, Record<string, string>> = {
  ru: {
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
  },
  en: {
    new: "New",
    imported: "Received",
    needs_reply: "Needs reply",
    auto_rule_matched: "Rule matched",
    auto_reply_pending: "Automatic reply pending",
    ai_draft_ready: "Draft ready",
    safety_blocked: "Needs review",
    waiting_review: "Needs review",
    needs_manual_check: "Needs review",
    approved: "Approved",
    sending: "Sending",
    answered: "Answered",
    auto_reply_sent: "Sent automatically",
    failed: "Error",
    escalated: "Escalated",
    archived: "Archived",
    blocked_by_marketplace: "Blocked by marketplace",
  },
};

const messageTypeLabels: Record<Locale, Record<string, string>> = {
  ru: { review: "Отзыв", question: "Вопрос", chat: "Сообщение" },
  en: { review: "Review", question: "Question", chat: "Message" },
};

const priorityLabels: Record<Locale, Record<string, string>> = {
  ru: { low: "Низкий", normal: "Обычный", high: "Высокий", urgent: "Срочный" },
  en: { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" },
};

const inboxCopy = {
  ru: {
    draftSubmitFailed: "Черновик создан, но не удалось передать его на проверку",
    loadingCount: "Загружаем обращения",
    messagesCount: "Обращения",
    noRatingOnPage: "без оценки на странице",
    messagesSuffix: "обращений",
    workspaceAria: "Рабочая область обращений",
    filtersAria: "Фильтры обращений",
    filters: "Фильтры",
    queue: "Очередь обращений",
    reset: "Сбросить",
    search: "Поиск",
    searchAria: "Поиск по обращениям",
    searchPlaceholder: "Товар, артикул или текст",
    marketplace: "Площадка",
    messageType: "Тип обращения",
    all: "Все",
    reviews: "Отзывы",
    questions: "Вопросы",
    messages: "Сообщения",
    status: "Статус",
    needsReply: "Нужен ответ",
    draftReady: "Черновик готов",
    needsReview: "На проверке",
    errors: "Ошибки",
    withManager: "У менеджера",
    assignee: "Ответственный",
    assignedToMe: "Назначено мне",
    rating: "Оценка",
    negativeRating: "1–3 звезды",
    positiveRating: "4–5 звёзд",
    noRating: "Без оценки",
    listAria: "Список обращений",
    filterResults: "Результаты фильтра",
    allMessages: "Все обращения",
    refreshing: "Обновляем...",
    refresh: "Обновить",
    refreshError: "Не удалось обновить обращения",
    staleData: "Показываем последнюю успешно загруженную очередь.",
    retrying: "Повторяем...",
    retry: "Повторить",
    loadingDescription: "Получаем обращения из подключённых маркетплейсов.",
    loadingTitle: "Загружаем обращения",
    loadErrorTitle: "Не удалось загрузить обращения",
    noRatingPages: "Проверьте соседние страницы очереди — сервер не поддерживает отдельный фильтр по отсутствию оценки.",
    noRatingCurrent: "На текущей серверной выборке обращений без оценки нет.",
    noRatingTitle: "На этой странице обращений без оценки нет",
    filteredEmpty: "Сбросьте часть фильтров или измените поиск.",
    queueEmpty: "Новые обращения появятся здесь после получения данных с подключённых площадок.",
    filteredEmptyTitle: "По выбранным условиям ничего не найдено",
    queueEmptyTitle: "В очереди пока нет обращений",
    pagesAria: "Страницы обращений",
    previousPage: "Предыдущая страница",
    back: "Назад",
    page: "Страница",
    of: "из",
    nextPage: "Следующая страница",
    next: "Далее",
    detailAria: "Карточка выбранного обращения",
    selectMessage: "Выберите обращение из списка, чтобы увидеть контекст и действия.",
    noSelection: "Обращение не выбрано",
    noProduct: "Товар без карточки",
    unrated: "без оценки",
    genericMessage: "Обращение",
    nextStep: "Следующий шаг",
    marketplaceLabel: "Маркетплейс",
    typeLabel: "Тип",
    priorityLabel: "Приоритет",
    assigneeLabel: "Ответственный",
    customer: "Покупатель",
    noCustomerName: "Имя не передано маркетплейсом",
    ratingPrefix: "Оценка",
    message: "Обращение",
    productContext: "Контекст товара",
    sku: "Артикул",
    noProductContext: "Товар не привязан к обращению.",
    openReviewQueue: "Открыть очередь проверки",
    replyForReview: "Ответ для проверки",
    draftPlaceholder: "Введите ответ или отредактируйте подготовленный текст",
    draftHint: "После отправки ответ попадёт в раздел «На проверке», где его можно проверить и отправить.",
    submitting: "Передаём...",
    submitForReview: "Передать на проверку",
    submittedEyebrow: "Ответ передан на проверку",
    submittedTitle: "Черновик сохранён и находится в разделе «На проверке»",
    draftSaved: "Черновик уже сохранён",
    draftRecovery: "Не создавайте второй ответ: продолжите работу с существующим черновиком в очереди проверки.",
    readOnly: "Ваша роль позволяет просматривать обращения, но не менять ответственного, статус или черновик ответа.",
    take: "Взять себе",
    escalate: "Передать менеджеру",
    archive: "Архивировать",
    yandex: "Яндекс Маркет",
    avito: "Авито",
    unassigned: "Не назначено",
    you: "Вы",
    otherEmployee: "Другой сотрудник",
    stepReview: "Проверить ответ перед отправкой",
    stepApproved: "Ответ одобрен и ожидает отправки",
    stepAutoPending: "Автоответ поставлен в очередь",
    stepSending: "Ответ отправляется на маркетплейс",
    stepFailed: "Разобраться с ошибкой отправки",
    stepConnection: "Проверить подключение маркетплейса",
    stepSent: "Ответ уже отправлен",
    stepArchived: "Обращение находится в архиве",
    stepDuplicate: "Повторное обращение уже обработано",
    stepSkipped: "Обращение пропущено автоматизацией",
    stepEscalated: "Менеджеру нужно принять решение",
    stepDraft: "Проверить подготовленный черновик",
    stepRule: "Проверить обработку по найденному правилу",
    stepPrepare: "Подготовить ответ или передать обращение",
    approvedEyebrow: "Ответ одобрен",
    approvedTitle: "Продолжите отправку в разделе «На проверке»",
    manualEyebrow: "Нужна ручная проверка",
    manualTitle: "Проверьте ответ и причины остановки в разделе «На проверке»",
    reviewEyebrow: "Ответ уже на проверке",
    reviewTitle: "Продолжите работу в разделе «На проверке»",
    unauthorized: "Сессия истекла. Войдите снова.",
    forbidden: "Недостаточно прав для этого действия.",
    notFound: "Нужные данные не найдены. Обновите страницу и попробуйте снова.",
    conflict: "Данные уже изменились. Обновите страницу и повторите действие.",
    invalid: "Проверьте введённые данные и попробуйте снова.",
    rateLimit: "Слишком много действий подряд. Подождите немного и попробуйте снова.",
    genericError: "Не удалось выполнить действие. Проверьте соединение и попробуйте снова.",
    totalKpi: "Всего обращений",
    totalKpiHelper: "за последние 30 дней",
    unansweredKpi: "Требуют ответа",
    unansweredKpiHelper: "ждут следующего шага",
    sentKpi: "Ответов отправлено",
    sentKpiHelper: "за последние 30 дней",
    responseKpi: "Среднее время ответа",
    responseKpiHelper: "от обращения до отправки",
    filtersButton: "Фильтры",
    closeFilters: "Скрыть фильтры",
    tableCustomer: "Покупатель",
    tableMessage: "Обращение",
    tableProduct: "Товар",
    tableTime: "Время",
    tableStatus: "Статус",
    openMessage: "Открыть обращение",
    assistantEyebrow: "Ответы с ИИ",
    assistantTitle: "Помощник для ответа",
    assistantText: "Откройте обращение или перейдите в Ответы с ИИ, чтобы подготовить черновик с контекстом товара.",
    assistantAction: "Открыть Ответы с ИИ",
    quickActions: "Быстрые действия",
    reviewQueueAction: "Очередь проверки",
    automationAction: "Автоматизация",
    integrationsAction: "Интеграции",
    helpAction: "Центр помощи",
    noSelectionSide: "Выберите обращение в таблице, чтобы открыть контекст и действия.",
    seconds: "сек",
    minutes: "мин",
    hours: "ч",
  },
  en: {
    draftSubmitFailed: "The draft was created but could not be submitted for review",
    loadingCount: "Loading messages",
    messagesCount: "Messages",
    noRatingOnPage: "without a rating on this page",
    messagesSuffix: "messages",
    workspaceAria: "Customer-message workspace",
    filtersAria: "Message filters",
    filters: "Filters",
    queue: "Customer-message queue",
    reset: "Reset",
    search: "Search",
    searchAria: "Search customer messages",
    searchPlaceholder: "Product, SKU, or message text",
    marketplace: "Marketplace",
    messageType: "Message type",
    all: "All",
    reviews: "Reviews",
    questions: "Questions",
    messages: "Messages",
    status: "Status",
    needsReply: "Needs reply",
    draftReady: "Draft ready",
    needsReview: "Needs review",
    errors: "Errors",
    withManager: "Escalated",
    assignee: "Assignee",
    assignedToMe: "Assigned to me",
    rating: "Rating",
    negativeRating: "1–3 stars",
    positiveRating: "4–5 stars",
    noRating: "No rating",
    listAria: "Customer-message list",
    filterResults: "Filtered results",
    allMessages: "All messages",
    refreshing: "Refreshing...",
    refresh: "Refresh",
    refreshError: "Could not refresh customer messages",
    staleData: "Showing the latest successfully loaded queue.",
    retrying: "Retrying...",
    retry: "Retry",
    loadingDescription: "Loading customer messages from connected marketplaces.",
    loadingTitle: "Loading messages",
    loadErrorTitle: "Could not load customer messages",
    noRatingPages: "Check adjacent queue pages — the server does not provide a dedicated no-rating filter.",
    noRatingCurrent: "There are no unrated customer messages in the current server result.",
    noRatingTitle: "No unrated messages on this page",
    filteredEmpty: "Reset some filters or change the search query.",
    queueEmpty: "New customer messages will appear here after data is received from connected marketplaces.",
    filteredEmptyTitle: "Nothing matches the selected filters",
    queueEmptyTitle: "No customer messages yet",
    pagesAria: "Customer-message pages",
    previousPage: "Previous page",
    back: "Back",
    page: "Page",
    of: "of",
    nextPage: "Next page",
    next: "Next",
    detailAria: "Selected customer-message details",
    selectMessage: "Choose a customer message from the list to see its context and available actions.",
    noSelection: "No message selected",
    noProduct: "No linked product",
    unrated: "no rating",
    genericMessage: "Customer message",
    nextStep: "Next step",
    marketplaceLabel: "Marketplace",
    typeLabel: "Type",
    priorityLabel: "Priority",
    assigneeLabel: "Assignee",
    customer: "Customer",
    noCustomerName: "The marketplace did not provide a customer name",
    ratingPrefix: "Rating",
    message: "Customer message",
    productContext: "Product context",
    sku: "SKU",
    noProductContext: "No product is linked to this customer message.",
    openReviewQueue: "Open review queue",
    replyForReview: "Reply for review",
    draftPlaceholder: "Enter a reply or edit the prepared text",
    draftHint: "Submitting this reply moves it to the review queue, where the team can check and send it.",
    submitting: "Submitting...",
    submitForReview: "Submit for review",
    submittedEyebrow: "Reply submitted for review",
    submittedTitle: "The draft is saved and is now in the review queue",
    draftSaved: "Draft already saved",
    draftRecovery: "Do not create a second reply. Continue with the existing draft in the review queue.",
    readOnly: "Your role can view customer messages but cannot change the assignee, status, or reply draft.",
    take: "Assign to me",
    escalate: "Escalate to manager",
    archive: "Archive",
    yandex: "Yandex Market",
    avito: "Avito",
    unassigned: "Unassigned",
    you: "You",
    otherEmployee: "Another teammate",
    stepReview: "Review the reply before sending",
    stepApproved: "Reply approved and waiting to be sent",
    stepAutoPending: "Automatic reply is queued",
    stepSending: "Reply is being sent to the marketplace",
    stepFailed: "Resolve the sending error",
    stepConnection: "Check the marketplace connection",
    stepSent: "Reply already sent",
    stepArchived: "Customer message is archived",
    stepDuplicate: "Duplicate customer message already handled",
    stepSkipped: "Customer message skipped by automation",
    stepEscalated: "A manager needs to make a decision",
    stepDraft: "Review the prepared draft",
    stepRule: "Review the matched automation rule",
    stepPrepare: "Prepare a reply or escalate the customer message",
    approvedEyebrow: "Reply approved",
    approvedTitle: "Continue sending from the review queue",
    manualEyebrow: "Manual review required",
    manualTitle: "Review the reply and the reason it stopped in the review queue",
    reviewEyebrow: "Reply already in review",
    reviewTitle: "Continue working in the review queue",
    unauthorized: "Your session expired. Log in again.",
    forbidden: "You do not have permission for this action.",
    notFound: "The required data could not be found. Refresh the page and try again.",
    conflict: "The data has already changed. Refresh the page and try again.",
    invalid: "Check the entered data and try again.",
    rateLimit: "Too many actions in a short time. Wait a moment and try again.",
    genericError: "The action could not be completed. Check your connection and try again.",
    totalKpi: "Total messages",
    totalKpiHelper: "during the last 30 days",
    unansweredKpi: "Need a reply",
    unansweredKpiHelper: "waiting for the next step",
    sentKpi: "Replies sent",
    sentKpiHelper: "during the last 30 days",
    responseKpi: "Average response time",
    responseKpiHelper: "from message to sent reply",
    filtersButton: "Filters",
    closeFilters: "Hide filters",
    tableCustomer: "Customer",
    tableMessage: "Message",
    tableProduct: "Product",
    tableTime: "Time",
    tableStatus: "Status",
    openMessage: "Open message",
    assistantEyebrow: "AI replies",
    assistantTitle: "Reply assistant",
    assistantText: "Open a customer message or use AI replies to prepare a draft with product context.",
    assistantAction: "Open AI replies",
    quickActions: "Quick actions",
    reviewQueueAction: "Review queue",
    automationAction: "Automation",
    integrationsAction: "Integrations",
    helpAction: "Help center",
    noSelectionSide: "Choose a customer message in the table to open its context and actions.",
    seconds: "sec",
    minutes: "min",
    hours: "hr",
  },
} as const;

class ManualReviewSubmissionError extends Error {
  readonly replyId: string;

  constructor(replyId: string, cause: unknown, locale: Locale) {
    const t = inboxCopy[locale];
    super(`${t.draftSubmitFailed}: ${errorMessage(cause, locale)}`);
    this.name = "ManualReviewSubmissionError";
    this.replyId = replyId;
  }
}

export function InboxWorkspace() {
  const queryClient = useQueryClient();
  const { activeOrganization, user, locale } = useWorkspace();
  const t = inboxCopy[locale];
  const localizedMarketplaceFilters = marketplaceFilters[locale];
  const canManageMessages = writeRoles.has(activeOrganization.current_user_role);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [selectedId, setSelectedId] = useState("");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const detailPanelRef = useRef<HTMLElement>(null);
  const [restoredOrganizationId, setRestoredOrganizationId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(filters.query.trim());

  useEffect(() => {
    const restored = readStoredFilters(activeOrganization.id);
    setFilters(restored ?? defaultFilters);
    setSelectedId("");
    setPage(1);
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
      page,
      page_size: inboxPageSize,
    });
  }, [
    activeOrganization.id,
    deferredQuery,
    filters.assignment,
    filters.marketplace,
    filters.rating,
    filters.status,
    filters.type,
    page,
    user.id,
  ]);

  const messagesQuery = useQuery({
    queryKey: ["messages", activeOrganization.id, queryPath],
    queryFn: () => apiRequest(queryPath, customerMessageListSchema),
  });

  const analyticsQuery = useQuery({
    queryKey: ["analytics", "overview", activeOrganization.id, 30],
    queryFn: () =>
      apiRequest(
        buildApiQuery("/api/analytics/overview", { organization_id: activeOrganization.id, days: 30 }),
        analyticsOverviewSchema,
      ),
  });

  const visibleMessages = useMemo(() => {
    const items = messagesQuery.data?.items ?? [];
    if (filters.rating !== "no_rating") return items;
    return items.filter((message) => message.rating === null);
  }, [filters.rating, messagesQuery.data?.items]);

  const selectedMessage = visibleMessages.find((message) => message.id === selectedId) ?? null;
  const totalPages = messagesQuery.data
    ? Math.max(1, Math.ceil(messagesQuery.data.total / messagesQuery.data.page_size))
    : 1;
  const displayedCountLabel = !messagesQuery.data
    ? messagesQuery.isPending
      ? t.loadingCount
      : t.messagesCount
    : filters.rating === "no_rating"
      ? `${visibleMessages.length} ${t.noRatingOnPage}`
      : `${messagesQuery.data.total} ${t.messagesSuffix}`;

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
        throw new ManualReviewSubmissionError(draft.reply.id, error, locale);
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
    setSelectedId("");
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setSelectedId("");
    setPage(1);
    setFilters(defaultFilters);
  }

  function selectMessage(messageId: string) {
    setSelectedId(messageId);
    if (!window.matchMedia("(max-width: 820px)").matches) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.requestAnimationFrame(() => {
      detailPanelRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  return (
    <section className="inbox-workspace" aria-label={t.workspaceAria}>
      <section className="inbox-kpi-grid" aria-label={t.messagesCount}>
        <InboxKpi
          icon="/images/mockups/features-icons/01-unified-inbox.webp"
          label={t.totalKpi}
          value={analyticsQuery.data ? formatNumber(analyticsQuery.data.total_messages, locale) : "—"}
          helper={t.totalKpiHelper}
        />
        <InboxKpi
          icon="/images/mockups/features-icons/04-auto-replies-lightning.webp"
          label={t.unansweredKpi}
          value={analyticsQuery.data ? formatNumber(analyticsQuery.data.unanswered_messages, locale) : "—"}
          helper={t.unansweredKpiHelper}
        />
        <InboxKpi
          icon="/images/mockups/features-icons/03-quality-shield.webp"
          label={t.sentKpi}
          value={analyticsQuery.data ? formatNumber(analyticsQuery.data.replies_sent, locale) : "—"}
          helper={t.sentKpiHelper}
        />
        <InboxKpi
          icon="/images/mockups/wildberries-icons/05-analytics.webp"
          label={t.responseKpi}
          value={analyticsQuery.data ? formatDuration(analyticsQuery.data.average_response_seconds, locale) : "—"}
          helper={t.responseKpiHelper}
        />
      </section>

      <section className="inbox-toolbar" aria-label={t.filtersAria}>
        <div className="inbox-status-tabs" role="group" aria-label={t.status}>
          <FilterButton active={filters.status === "all"} onClick={() => updateFilter("status", "all")}>{t.all}</FilterButton>
          <FilterButton active={filters.status === "needs_reply"} onClick={() => updateFilter("status", "needs_reply")}>{t.needsReply}</FilterButton>
          <FilterButton active={filters.status === "ai_draft_ready"} onClick={() => updateFilter("status", "ai_draft_ready")}>{t.draftReady}</FilterButton>
          <FilterButton active={filters.status === "waiting_review"} onClick={() => updateFilter("status", "waiting_review")}>{t.needsReview}</FilterButton>
          <FilterButton active={filters.status === "failed"} onClick={() => updateFilter("status", "failed")}>{t.errors}</FilterButton>
          <FilterButton active={filters.status === "escalated"} onClick={() => updateFilter("status", "escalated")}>{t.withManager}</FilterButton>
        </div>

        <div className="inbox-toolbar-actions">
          <label className="inbox-toolbar-search">
            <span className="sr-only">{t.search}</span>
            <input
              aria-label={t.searchAria}
              onChange={(event) => updateFilter("query", event.target.value)}
              placeholder={t.searchPlaceholder}
              type="search"
              value={filters.query}
            />
          </label>
          <button
            aria-expanded={showFilters}
            className={showFilters || activeFilterCount > (filters.status === "all" ? 0 : 1) ? "button button-secondary button-compact inbox-filter-toggle inbox-filter-toggle-active" : "button button-secondary button-compact inbox-filter-toggle"}
            onClick={() => setShowFilters((value) => !value)}
            type="button"
          >
            {showFilters ? t.closeFilters : t.filtersButton}
            {activeFilterCount > 0 ? <span>{activeFilterCount}</span> : null}
          </button>
          {activeFilterCount > 0 ? (
            <button className="button button-secondary button-compact" onClick={resetFilters} type="button">
              {t.reset}
            </button>
          ) : null}
        </div>
      </section>

      {showFilters ? (
        <aside className="inbox-filter-drawer" aria-label={t.filtersAria}>
          <FilterGroup label={t.marketplace}>
            {localizedMarketplaceFilters.map((option) => (
              <FilterButton
                active={filters.marketplace === option.value}
                key={option.value}
                onClick={() => updateFilter("marketplace", option.value)}
              >
                {option.label}
              </FilterButton>
            ))}
          </FilterGroup>

          <FilterGroup label={t.messageType}>
            <FilterButton active={filters.type === "all"} onClick={() => updateFilter("type", "all")}>{t.all}</FilterButton>
            <FilterButton active={filters.type === "review"} onClick={() => updateFilter("type", "review")}>{t.reviews}</FilterButton>
            <FilterButton active={filters.type === "question"} onClick={() => updateFilter("type", "question")}>{t.questions}</FilterButton>
            <FilterButton active={filters.type === "chat"} onClick={() => updateFilter("type", "chat")}>{t.messages}</FilterButton>
          </FilterGroup>

          <FilterGroup label={t.assignee}>
            <FilterButton active={filters.assignment === "all"} onClick={() => updateFilter("assignment", "all")}>{t.all}</FilterButton>
            <FilterButton active={filters.assignment === "mine"} onClick={() => updateFilter("assignment", "mine")}>{t.assignedToMe}</FilterButton>
          </FilterGroup>

          <FilterGroup label={t.rating}>
            <FilterButton active={filters.rating === "all"} onClick={() => updateFilter("rating", "all")}>{t.all}</FilterButton>
            <FilterButton active={filters.rating === "negative"} onClick={() => updateFilter("rating", "negative")}>{t.negativeRating}</FilterButton>
            <FilterButton active={filters.rating === "positive"} onClick={() => updateFilter("rating", "positive")}>{t.positiveRating}</FilterButton>
            <FilterButton active={filters.rating === "no_rating"} onClick={() => updateFilter("rating", "no_rating")}>{t.noRating}</FilterButton>
          </FilterGroup>
        </aside>
      ) : null}

      <div className="inbox-content-grid">
        <section className="inbox-list-panel" aria-label={t.listAria}>
          <div className="panel-heading panel-heading-row inbox-list-heading">
            <div>
              <span className="panel-kicker">{displayedCountLabel}</span>
              <strong>{activeFilterCount > 0 ? t.filterResults : t.allMessages}</strong>
            </div>
            <button
              className="button button-secondary button-compact"
              disabled={messagesQuery.isFetching}
              onClick={() => void messagesQuery.refetch()}
              type="button"
            >
              {messagesQuery.isFetching ? t.refreshing : t.refresh}
            </button>
          </div>

          {messagesQuery.error && messagesQuery.data ? (
            <div className="inbox-refresh-error" role="alert">
              <div>
                <strong>{t.refreshError}</strong>
                <p>{t.staleData}</p>
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
            <InboxState description={t.loadingDescription} title={t.loadingTitle} tone="loading" />
          ) : messagesQuery.error && !messagesQuery.data ? (
            <InboxState
              actionDisabled={messagesQuery.isFetching}
              actionLabel={messagesQuery.isFetching ? t.retrying : t.retry}
              description={errorMessage(messagesQuery.error, locale)}
              onAction={() => void messagesQuery.refetch()}
              title={t.loadErrorTitle}
              tone="error"
            />
          ) : visibleMessages.length > 0 ? (
            <div className="inbox-table-wrap">
              <table className="inbox-message-table">
                <thead>
                  <tr>
                    <th>{t.tableCustomer}</th>
                    <th>{t.tableMessage}</th>
                    <th>{t.tableProduct}</th>
                    <th>{t.tableTime}</th>
                    <th>{t.tableStatus}</th>
                    <th><span className="sr-only">{t.openMessage}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMessages.map((message) => (
                    <MessageTableRow
                      isSelected={selectedMessage?.id === message.id}
                      key={message.id}
                      locale={locale}
                      message={message}
                      onSelect={() => selectMessage(message.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : filters.rating === "no_rating" && (messagesQuery.data?.total ?? 0) > 0 ? (
            <EmptyState
              description={totalPages > 1 ? t.noRatingPages : t.noRatingCurrent}
              title={t.noRatingTitle}
            />
          ) : (
            <EmptyState
              description={activeFilterCount > 0 ? t.filteredEmpty : t.queueEmpty}
              title={activeFilterCount > 0 ? t.filteredEmptyTitle : t.queueEmptyTitle}
            />
          )}

          {messagesQuery.data && totalPages > 1 ? (
            <nav className="inbox-pagination" aria-label={t.pagesAria}>
              <button
                aria-label={t.previousPage}
                className="button button-secondary button-compact"
                disabled={page <= 1 || messagesQuery.isFetching}
                onClick={() => {
                  setSelectedId("");
                  setPage((current) => Math.max(1, current - 1));
                }}
                type="button"
              >
                {t.back}
              </button>
              <span aria-live="polite">{t.page} {page} {t.of} {totalPages}</span>
              <button
                aria-label={t.nextPage}
                className="button button-secondary button-compact"
                disabled={page >= totalPages || messagesQuery.isFetching}
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
        </section>

        <aside ref={detailPanelRef} className="inbox-side-panel inbox-detail-panel" aria-label={t.detailAria}>
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
              locale={locale}
              message={selectedMessage}
              onArchive={() => updateMutation.mutate({ messageId: selectedMessage.id, status: "archived" })}
              onCreateDraft={(replyText) => manualDraftMutation.mutate({ messageId: selectedMessage.id, replyText })}
              onEscalate={() => updateMutation.mutate({ messageId: selectedMessage.id, status: "escalated" })}
              onTake={() => updateMutation.mutate({ messageId: selectedMessage.id, assignedTo: user.id })}
            />
          ) : (
            <InboxSideDefault locale={locale} />
          )}
        </aside>
      </div>
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

function InboxKpi({ icon, label, value, helper }: { icon: string; label: string; value: string; helper: string }) {
  return (
    <article className="inbox-kpi-card">
      <span className="inbox-kpi-icon" aria-hidden="true"><Image alt="" height={24} src={icon} width={24} /></span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{helper}</small>
      </div>
    </article>
  );
}

function MessageTableRow({
  isSelected,
  message,
  onSelect,
  locale,
}: {
  isSelected: boolean;
  message: CustomerMessage;
  onSelect: () => void;
  locale: Locale;
}) {
  const t = inboxCopy[locale];
  const localizedStatusLabels = messageStatusLabels[locale];
  return (
    <tr className={isSelected ? "inbox-table-row inbox-table-row-selected" : "inbox-table-row"}>
      <td>
        <span className="inbox-customer-cell">
          <span className="inbox-customer-avatar" aria-hidden="true">{personInitials(message.customer_display_name || t.customer)}</span>
          <strong>{message.customer_display_name || t.noCustomerName}</strong>
        </span>
      </td>
      <td><span className="inbox-table-message">{message.customer_text}</span></td>
      <td>
        <span className="inbox-product-cell">
          <span className="inbox-product-mark" aria-hidden="true">{productInitial(message.product?.name)}</span>
          <span>
            <strong>{message.product?.name ?? t.noProduct}</strong>
            <small>{marketplaceLabel(message.marketplace, locale)}</small>
          </span>
        </span>
      </td>
      <td>{formatDate(message.marketplace_created_at, locale)}</td>
      <td><Badge tone={statusTone(message.status)}>{localizedStatusLabels[message.status] ?? message.status}</Badge></td>
      <td>
        <button
          aria-label={`${t.openMessage}: ${message.product?.name ?? message.customer_display_name ?? t.genericMessage}`}
          aria-pressed={isSelected}
          className="inbox-row-open"
          onClick={onSelect}
          type="button"
        >
          <span aria-hidden="true">•••</span>
        </button>
      </td>
    </tr>
  );
}

function InboxSideDefault({ locale }: { locale: Locale }) {
  const t = inboxCopy[locale];
  return (
    <div className="inbox-side-default">
      <section className="inbox-assistant-card">
        <div className="inbox-assistant-heading">
          <span className="inbox-assistant-icon" aria-hidden="true">
            <Image alt="" height={24} src="/images/mockups/features-icons/02-ai-sparkles.webp" width={24} />
          </span>
          <div>
            <span className="panel-kicker">{t.assistantEyebrow}</span>
            <strong>{t.assistantTitle}</strong>
          </div>
        </div>
        <p>{t.assistantText}</p>
        <Link className="button button-primary" href={localizedPath(locale, "/app/ai-assistant")}>{t.assistantAction}</Link>
      </section>

      <section className="inbox-quick-card">
        <span className="panel-kicker">{t.quickActions}</span>
        <nav className="inbox-quick-links" aria-label={t.quickActions}>
          <Link href={localizedPath(locale, "/app/review-queue")}>{t.reviewQueueAction}<span aria-hidden="true">→</span></Link>
          <Link href={localizedPath(locale, "/app/automation-rules")}>{t.automationAction}<span aria-hidden="true">→</span></Link>
          <Link href={localizedPath(locale, "/app/integrations")}>{t.integrationsAction}<span aria-hidden="true">→</span></Link>
          <Link href={localizedPath(locale, "/help")}>{t.helpAction}<span aria-hidden="true">→</span></Link>
        </nav>
      </section>

      <p className="inbox-side-hint">{t.noSelectionSide}</p>
    </div>
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
  locale,
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
  locale: Locale;
}) {
  const t = inboxCopy[locale];
  const localizedStatusLabels = messageStatusLabels[locale];
  const localizedTypeLabels = messageTypeLabels[locale];
  const localizedPriorityLabels = priorityLabels[locale];
  const reviewQueuePath = localizedPath(locale, "/app/review-queue");
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
  const reviewHandoff = isReviewWorkflowStatus(message.status) ? reviewHandoffCopy(message.status, locale) : null;
  const canUseMessageActions = canManage && ![
    "approved",
    "auto_reply_pending",
    "sending",
    "answered",
    "auto_reply_sent",
    "archived",
    "duplicate",
    "skipped",
  ].includes(message.status);

  return (
    <div className="message-detail-card">
      <div className="panel-heading panel-heading-row inbox-detail-heading">
        <div>
          <span className="panel-kicker">{localizedTypeLabels[message.type] ?? t.genericMessage}</span>
          <strong>{message.product?.name ?? t.noProduct}</strong>
        </div>
        <Badge tone={statusTone(message.status)}>{localizedStatusLabels[message.status] ?? message.status}</Badge>
      </div>

      <div className={"inbox-next-step inbox-next-step-" + nextStepTone(message.status)} aria-live="polite">
        <span>{t.nextStep}</span>
        <strong>{nextStepLabel(message.status, locale)}</strong>
      </div>

      <div className="detail-grid">
        <DetailItem label={t.marketplaceLabel} value={marketplaceLabel(message.marketplace, locale)} />
        <DetailItem label={t.typeLabel} value={localizedTypeLabels[message.type] ?? message.type} />
        <DetailItem label={t.priorityLabel} value={localizedPriorityLabels[message.priority] ?? message.priority} />
        <DetailItem label={t.assigneeLabel} value={assignmentLabel(message.assigned_to, currentUserId, locale)} />
      </div>

      <section className="detail-section inbox-customer-context">
        <span>{t.customer}</span>
        <p>{message.customer_display_name || t.noCustomerName}</p>
        {message.rating ? <small>{t.ratingPrefix}: {message.rating} / 5</small> : null}
      </section>

      <section className="detail-section inbox-message-context">
        <span>{t.message}</span>
        <p>{message.customer_text}</p>
      </section>

      <section className="detail-section inbox-product-context">
        <span>{t.productContext}</span>
        <p>
          {message.product
            ? [message.product.name, message.product.sku ? `${t.sku}: ${message.product.sku}` : null, message.product.brand].filter(Boolean).join(" · ")
            : t.noProductContext}
        </p>
      </section>

      {reviewHandoff ? (
        <div className={message.status === "approved" ? "inbox-review-handoff inbox-review-handoff-success" : "inbox-review-handoff"}>
          <div>
            <span className="panel-kicker">{reviewHandoff.eyebrow}</span>
            <strong>{reviewHandoff.title}</strong>
          </div>
          <Link className="button button-primary" href={reviewQueuePath}>{t.openReviewQueue}</Link>
        </div>
      ) : null}

      {canCreateDraft ? (
        <label className="review-editor-field inbox-manual-draft-field">
          <span>{t.replyForReview}</span>
          <textarea
            disabled={isCreatingDraft}
            maxLength={12000}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder={t.draftPlaceholder}
            value={replyText}
          />
          <small>{t.draftHint}</small>
          <button
            className="button button-primary"
            disabled={isCreatingDraft || replyText.trim().length === 0}
            onClick={() => onCreateDraft(replyText)}
            type="button"
          >
            {isCreatingDraft ? t.submitting : t.submitForReview}
          </button>
        </label>
      ) : null}

      {draftSubmissionSucceeded ? (
        <div className="inbox-review-handoff" role="status">
          <div>
            <span className="panel-kicker">{t.submittedEyebrow}</span>
            <strong>{t.submittedTitle}</strong>
          </div>
          <Link className="button button-primary" href={reviewQueuePath}>{t.openReviewQueue}</Link>
        </div>
      ) : null}

      {draftRecoveryNeeded && createDraftError ? (
        <div className="inbox-review-handoff" role="alert">
          <div>
            <span className="panel-kicker">{t.draftSaved}</span>
            <strong>{errorMessage(createDraftError, locale)}</strong>
            <p>{t.draftRecovery}</p>
          </div>
          <Link className="button button-secondary" href={reviewQueuePath}>{t.openReviewQueue}</Link>
        </div>
      ) : createDraftError ? (
        <p className="form-error" role="alert">{errorMessage(createDraftError, locale)}</p>
      ) : null}

      {!canManage ? (
        <p className="inbox-readonly-note">
          {t.readOnly}
        </p>
      ) : null}

      {error ? <p className="form-error" role="alert">{errorMessage(error, locale)}</p> : null}

      {canUseMessageActions ? (
        <div className="detail-actions inbox-detail-actions">
          {!isAssignedToCurrentUser ? (
            <button className="button button-secondary" disabled={isUpdating} onClick={onTake} type="button">
              {t.take}
            </button>
          ) : null}
          <button className="button button-secondary" disabled={isUpdating || message.status === "escalated"} onClick={onEscalate} type="button">
            {t.escalate}
          </button>
          <button className="button button-secondary" disabled={isUpdating || message.status === "archived"} onClick={onArchive} type="button">
            {t.archive}
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
  tone: "error" | "loading";
}) {
  return (
    <div
      aria-busy={tone === "loading"}
      aria-live="polite"
      className={"inbox-list-state inbox-list-state-" + tone}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className="inbox-list-state-mark" aria-hidden="true" />
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

function marketplaceLabel(value: string, locale: Locale): string {
  const t = inboxCopy[locale];
  const labels: Record<string, string> = {
    wildberries: "Wildberries",
    ozon: "Ozon",
    yandex_market: t.yandex,
    avito: t.avito,
  };
  return labels[value] ?? value;
}

function assignmentLabel(assignedTo: string | null, currentUserId: string, locale: Locale): string {
  const t = inboxCopy[locale];
  if (!assignedTo) return t.unassigned;
  return assignedTo === currentUserId ? t.you : t.otherEmployee;
}

function nextStepLabel(status: string, locale: Locale): string {
  const t = inboxCopy[locale];
  if (status === "waiting_review" || status === "needs_manual_check" || status === "safety_blocked") return t.stepReview;
  if (status === "approved") return t.stepApproved;
  if (status === "auto_reply_pending") return t.stepAutoPending;
  if (status === "sending") return t.stepSending;
  if (status === "failed") return t.stepFailed;
  if (status === "blocked_by_marketplace") return t.stepConnection;
  if (status === "answered" || status === "auto_reply_sent") return t.stepSent;
  if (status === "archived") return t.stepArchived;
  if (status === "duplicate") return t.stepDuplicate;
  if (status === "skipped") return t.stepSkipped;
  if (status === "escalated") return t.stepEscalated;
  if (status === "ai_draft_ready") return t.stepDraft;
  if (status === "auto_rule_matched") return t.stepRule;
  return t.stepPrepare;
}

function nextStepTone(status: string): "danger" | "info" | "neutral" | "success" | "warning" {
  if (["failed", "blocked_by_marketplace"].includes(status)) return "danger";
  if (["waiting_review", "needs_manual_check", "safety_blocked", "escalated"].includes(status)) return "warning";
  if (["answered", "auto_reply_sent"].includes(status)) return "success";
  if (["approved", "auto_reply_pending", "sending", "ai_draft_ready", "auto_rule_matched"].includes(status)) return "info";
  return "neutral";
}

function isReviewWorkflowStatus(status: string): boolean {
  return ["waiting_review", "needs_manual_check", "safety_blocked", "approved"].includes(status);
}

function reviewHandoffCopy(status: string, locale: Locale): { eyebrow: string; title: string } {
  const t = inboxCopy[locale];
  if (status === "approved") {
    return {
      eyebrow: t.approvedEyebrow,
      title: t.approvedTitle,
    };
  }

  if (status === "needs_manual_check" || status === "safety_blocked") {
    return {
      eyebrow: t.manualEyebrow,
      title: t.manualTitle,
    };
  }

  return {
    eyebrow: t.reviewEyebrow,
    title: t.reviewTitle,
  };
}

function statusTone(status: string): BadgeTone {
  if (["failed", "blocked_by_marketplace", "safety_blocked"].includes(status)) return "danger";
  if (["waiting_review", "needs_manual_check", "escalated"].includes(status)) return "warning";
  if (["answered", "approved", "auto_reply_sent"].includes(status)) return "success";
  if (["needs_reply", "ai_draft_ready"].includes(status)) return "info";
  return "neutral";
}

function formatDate(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU").format(value);
}

function formatDuration(value: number | null, locale: Locale): string {
  const t = inboxCopy[locale];
  if (value === null) return "—";
  if (value < 60) return `${Math.round(value)} ${t.seconds}`;
  if (value < 3600) return `${Math.round(value / 60)} ${t.minutes}`;
  return `${(value / 3600).toFixed(1)} ${t.hours}`;
}

function personInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
}

function productInitial(value: string | null | undefined): string {
  const source = value?.trim();
  return source ? source.charAt(0).toUpperCase() : "•";
}

function errorMessage(error: unknown, locale: Locale): string {
  const t = inboxCopy[locale];
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
