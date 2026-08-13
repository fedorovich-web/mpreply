"use client";

import {
  ReviewQuestionIntegrationWorkspace,
  type ReviewQuestionIntegrationConfig,
} from "./ReviewQuestionIntegrationWorkspace";

const yandexMarketConfig: ReviewQuestionIntegrationConfig = {
  marketplace: "yandex_market",
  marketplaceName: "Яндекс Маркет",
  marketplaceGenitive: "Яндекс Маркета",
  workspaceClassName: "yandex-market-workspace",
  idPrefix: "ym",
  sellerIdLabel: "Business ID",
  sellerIdInputMode: "numeric",
  sellerIdPattern: "[1-9][0-9]*",
  sellerIdMaxLength: 20,
  isSellerIdValid: (value) => /^[1-9][0-9]*$/.test(value.trim()),
  sellerIdUpdateMode: "inline",
  credentialsLabel: "API-ключ Яндекс Маркета",
  accountPlaceholder: "Например, основной кабинет Маркета",
  createNotice: "Подключение создано. Перед синхронизацией проверьте API-ключ.",
  scopeLabels: {
    ALL_METHODS: "Все методы",
    ALL_METHODS_READ_ONLY: "Все методы · только чтение",
    COMMUNICATION: "Общение с покупателями",
  },
  errorLabels: {
    invalid_credentials: "API-ключ отклонён. Проверьте ключ и его разрешения.",
    insufficient_scope: "API-ключу не хватает разрешения «Общение с покупателями».",
    rate_limited: "Яндекс Маркет временно ограничил частоту запросов. Повторите синхронизацию позже.",
    sync_cursor_cycle: "Маркет вернул повторяющийся курсор. Синхронизация безопасно остановлена.",
    sync_page_limit_exceeded: "Синхронизация достигла защитного лимита страниц и была остановлена.",
    sync_unhandled_error: "Во время синхронизации произошла внутренняя ошибка. Повторите операцию или передайте requestId поддержке.",
  },
};

export function YandexMarketIntegrationWorkspace() {
  return <ReviewQuestionIntegrationWorkspace config={yandexMarketConfig} />;
}
