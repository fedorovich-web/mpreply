export const trialOffer = {
  durationDays: 7,
  answerLimit: 400,
  marketplaceLimit: 2,
  title: "7 дней бесплатного теста",
  shortLabel: "7 дней бесплатно",
  description:
    "Подключите до двух маркетплейсов и бесплатно проверьте Respio на реальных отзывах, вопросах и чатах. В тест включено 400 ответов и все ключевые сценарии Respio.",
  features: [
    "400 ответов за 7 дней",
    "До 2 маркетплейсов",
    "Отзывы, вопросы и чаты",
    "Проверка контекста товара",
    "Автопубликация по правилам продавца",
    "Согласование только по выбранным правилам",
  ],
} as const;

export type PublicPricingPlan = {
  key: "start" | "optimal" | "business" | "scale";
  name: string;
  icon: "questions" | "flow" | "history" | "recommendations";
  price: string;
  priceValue: number;
  currency: "₽";
  answers: string;
  answersValue: number;
  pricePerAnswer: string;
  audience: string;
  description: string;
  features: readonly string[];
  highlighted?: boolean;
};

export const publicPricingPlans: readonly PublicPricingPlan[] = [
  {
    key: "start",
    name: "Старт",
    icon: "questions",
    price: "1 160",
    priceValue: 1160,
    currency: "₽",
    answers: "500 ответов",
    answersValue: 500,
    pricePerAnswer: "2,32 ₽ за ответ",
    audience: "Для первого магазина и небольшого потока обращений",
    description:
      "Небольшой пакет для запуска автоматизации без абонентской платы и ограничения по сроку использования.",
    features: [
      "Ответы не сгорают",
      "Один баланс для всех подключённых площадок",
      "Отзывы, вопросы и чаты",
      "Контекст товара и правила бренда",
      "Предпросмотр и перегенерация без списания",
    ],
  },
  {
    key: "optimal",
    name: "Оптимальный",
    icon: "flow",
    price: "6 290",
    priceValue: 6290,
    currency: "₽",
    answers: "5 000 ответов",
    answersValue: 5000,
    pricePerAnswer: "1,26 ₽ за ответ",
    audience: "Для растущего продавца и нескольких магазинов",
    description:
      "Сбалансированный объём для регулярной работы команды с отзывами, вопросами и чатами покупателей.",
    features: [
      "Ответы не сгорают",
      "Единый баланс для нескольких магазинов",
      "Правила автопубликации и согласования",
      "Журнал решений и история обращений",
      "Все поддерживаемые маркетплейсы",
    ],
    highlighted: true,
  },
  {
    key: "business",
    name: "Бизнес",
    icon: "history",
    price: "8 990",
    priceValue: 8990,
    currency: "₽",
    answers: "10 000 ответов",
    answersValue: 10000,
    pricePerAnswer: "0,90 ₽ за ответ",
    audience: "Для брендов с устойчивым потоком обращений",
    description:
      "Запас ответов для нескольких площадок, сезонных пиков и командной работы с обращениями.",
    features: [
      "Ответы не сгорают",
      "Общий баланс без календарного лимита",
      "Несколько магазинов и пользователей",
      "Расширенная аналитика качества",
      "Приоритетная помощь при настройке",
    ],
  },
  {
    key: "scale",
    name: "Масштаб",
    icon: "recommendations",
    price: "12 590",
    priceValue: 12590,
    currency: "₽",
    answers: "15 000 ответов",
    answersValue: 15000,
    pricePerAnswer: "0,84 ₽ за ответ",
    audience: "Для агентств, крупных брендов и больших каталогов",
    description:
      "Крупный бессрочный пакет для большого числа магазинов и интенсивной автоматизации коммуникаций.",
    features: [
      "Ответы не сгорают",
      "Все поддерживаемые площадки",
      "Расширенная аналитика и экспорт",
      "Командные роли и контроль действий",
      "Приоритетная поддержка и onboarding",
    ],
  },
] as const;

export const pricingFacts = [
  "Купленные ответы не сгорают",
  "Один баланс работает на всех подключённых площадках",
  "Предпросмотр, редактирование и перегенерация не списывают баланс",
  "Списывается только опубликованный или отправленный ответ",
] as const;
