"use client";

import {
  ReviewQuestionIntegrationWorkspace,
  type ReviewQuestionIntegrationConfig,
} from "./ReviewQuestionIntegrationWorkspace";

const ozonConfig: ReviewQuestionIntegrationConfig = {
  marketplace: "ozon",
  marketplaceName: "Ozon",
  marketplaceGenitive: "Ozon",
  workspaceClassName: "ozon-workspace",
  idPrefix: "ozon",
  sellerIdLabel: "Client ID",
  sellerIdInputMode: "text",
  sellerIdMaxLength: 255,
  sellerIdPlaceholder: "Client ID кабинета Ozon",
  isSellerIdValid: (value) => value.trim().length > 0,
  sellerIdUpdateMode: "replace",
  hiddenSellerIdNotice: "Client ID хранится защищённо и не отображается. При необходимости замените его отдельной операцией.",
  showCredentialExpiry: true,
  emptyValidatedScopesMessage: "Проверка завершена, но у API-ключа нет прав на отзывы или вопросы Ozon.",
  showEventErrorCode: false,
  credentialsLabel: "API-ключ Ozon",
  accountPlaceholder: "Например, основной кабинет Ozon",
  createNotice: "Подключение создано. Перед синхронизацией проверьте Client ID и API-ключ.",
  scopeLabels: {
    fetch_reviews: "Отзывы и ответы на отзывы",
    send_review_reply: "Отзывы и ответы на отзывы",
    fetch_questions: "Вопросы и ответы на вопросы",
    send_question_reply: "Вопросы и ответы на вопросы",
  },
  errorLabels: {
    invalid_credentials: "Client ID или API-ключ отклонён. Проверьте данные подключения.",
    insufficient_scope: "API-ключу не хватает прав для отзывов или вопросов Ozon.",
    rate_limited: "Ozon временно ограничил частоту запросов. Повторите синхронизацию позже.",
    marketplace_unavailable: "Ozon временно недоступен. Повторите операцию позже.",
    marketplace_error: "Ozon отклонил запрос. Проверьте состояние подключения и повторите операцию.",
    sync_cursor_cycle: "Ozon вернул повторяющийся курсор. Синхронизация безопасно остановлена.",
    sync_page_limit_exceeded: "Синхронизация достигла защитного лимита страниц и была остановлена.",
    sync_unhandled_error: "Во время синхронизации произошла внутренняя ошибка. Повторите операцию или передайте requestId поддержке.",
  },
};

export function OzonIntegrationWorkspace() {
  return <ReviewQuestionIntegrationWorkspace config={ozonConfig} />;
}
