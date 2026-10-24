import type { Locale } from "./i18n";

export const helpIcons = {
  popular: "01-popular-questions-star.avif",
  start: "02-getting-started-play.avif",
  integrations: "03-integrations-network.avif",
  messages: "04-messages-chat.avif",
  ai: "05-ai-sparkles.avif",
  team: "06-team-users.avif",
  pricing: "07-pricing-payment-card.avif",
  security: "08-security-shield.avif",
  technical: "09-technical-gear.avif",
  problems: "10-problems-wrench.avif",
  help: "11-help-question.avif",
  trial: "12-free-trial-gift.avif",
  edit: "13-edit-pencil.avif",
  auto: "14-auto-replies-download.avif",
  stores: "15-stores-shop.avif",
  analytics: "16-analytics-chart.avif",
  warning: "17-warning-alert.avif",
  launch: "18-launch-rocket.avif",
} as const;

export type HelpIconName = keyof typeof helpIcons;
export type HelpCategoryId = "popular" | "start" | "integrations" | "messages" | "ai" | "team" | "pricing" | "problems";
type HelpQuestion = { id: string; icon: HelpIconName; question: string; answer: string; link?: { href: string; label: string } };
type HelpCategory = { id: HelpCategoryId; icon: HelpIconName; label: string; title: string; description: string; questions: string[] };

const ruQuestions: HelpQuestion[] = [
  { id: "connect", icon: "messages", question: "Как подключить Wildberries, Ozon, Яндекс Маркет и Авито?", answer: "В кабинете MPReply откройте «Интеграции», выберите площадку и следуйте инструкции на её странице. Укажите данные для подключения — поля отличаются у разных маркетплейсов. Пароль от кабинета продавца передавать не нужно.", link: { href: "/marketplaces", label: "Посмотреть интеграции" } },
  { id: "cost", icon: "pricing", question: "Сколько стоит использование MPReply?", answer: "Стоимость зависит от тарифа и количества ИИ-ответов. На странице «Тарифы» можно сравнить пакеты, рассчитать нужный объём и посмотреть стоимость дополнительных ответов.", link: { href: "/pricing", label: "Сравнить тарифы" } },
  { id: "trial", icon: "trial", question: "Можно ли попробовать бесплатно?", answer: "Да. Пробный период длится 14 дней и включает 350 ИИ-ответов. По окончании 14 дней неиспользованные пробные ответы сгорают. Посмотреть интерфейс до регистрации можно в демо-кабинете.", link: { href: "/demo", label: "Открыть демо-кабинет" } },
  { id: "types", icon: "ai", question: "Какие типы обращений обрабатывает ИИ?", answer: "MPReply помогает отвечать на отзывы и вопросы покупателей, а также на поддерживаемые сообщения. Отзывы и вопросы доступны для Wildberries, Ozon и Яндекс Маркета; на Авито можно работать с чатами и доступными кабинету отзывами. Все обращения собираются в разделе «Обращения»." },
  { id: "edit", icon: "edit", question: "Можно ли редактировать ответы перед отправкой?", answer: "Да. Откройте черновик, исправьте текст и сохраните изменения. В режиме проверки ответ отправляется после одобрения сотрудником. Для автоматических ответов действуют правила, которые вы настроили в рабочем пространстве." },
  { id: "auto", icon: "auto", question: "Как работают автоответы?", answer: "В разделе «Автоматизация» задайте площадку, тип обращения, условия и режим обработки. Типовые обращения могут обрабатываться автоматически, а случаи, которым нужна проверка, остаются у сотрудника. Можно ограничить автоматизацию по оценке, ключевым словам и другим условиям." },
  { id: "stores", icon: "stores", question: "Поддерживаются ли несколько магазинов и кабинетов?", answer: "Да. Добавьте кабинеты в «Интеграциях» одного рабочего пространства. Их обращения появятся в общей очереди: используйте фильтры по площадке, типу и статусу, чтобы найти нужные." },
  { id: "roles", icon: "team", question: "Как устроены доступы команды?", answer: "Доступ определяется ролью сотрудника. Владелец и администратор управляют подключениями и правилами; менеджер работает с обращениями и ответами; наблюдатель просматривает данные. Действия, которые не разрешены вашей роли, недоступны." },
  { id: "analytics", icon: "analytics", question: "Где посмотреть статистику и аналитику?", answer: "Откройте «Аналитику» в кабинете. Там можно посмотреть обращения и отправленные ответы за выбранный период, данные по площадкам, товарам и работе команды. Сводка текущей работы также доступна в разделе «Обзор»." },
  { id: "missing", icon: "warning", question: "Что делать, если не приходят новые обращения?", answer: "Проверьте состояние кабинета в «Интеграциях». Если подключение требует внимания, откройте его и прочитайте причину. Проверьте доступы на стороне маркетплейса и фильтры в «Обращениях»: они могут скрывать новые отзывы или вопросы. Если причина не ясна, напишите в поддержку.", link: { href: "/contacts", label: "Обратиться в поддержку" } },
  { id: "first", icon: "launch", question: "С чего начать работу с MPReply?", answer: "Создайте аккаунт, подтвердите email и назовите рабочее пространство. Затем подключите кабинет маркетплейса в «Интеграциях». Когда обращения появятся в очереди, проверьте подготовленные ответы и настройте правила обработки." },
  { id: "install", icon: "technical", question: "Нужно ли устанавливать программу?", answer: "Нет. MPReply работает в браузере на компьютере, планшете и телефоне. Войдите в аккаунт, чтобы открыть своё рабочее пространство." },
  { id: "demo", icon: "start", question: "Что можно посмотреть в демо-кабинете?", answer: "Демо открывает обычный интерфейс MPReply с примером данных. Можно переходить между разделами и знакомиться с очередью обращений, проверкой ответов и подключениями. Добавление своих ключей, изменение данных и отправка ответов в демо отключены.", link: { href: "/demo", label: "Посмотреть кабинет" } },
  { id: "keys", icon: "security", question: "Нужно ли передавать пароль от маркетплейса?", answer: "Нет. Для подключения используются данные доступа к API площадки. MPReply хранит ключи на сервере в зашифрованном виде. Не присылайте ключи, пароли и коды доступа в обращения в поддержку." },
  { id: "ozon", icon: "integrations", question: "Почему не все обращения Ozon доступны после подключения?", answer: "Доступ к отдельным видам обращений зависит от возможностей API и услуг, подключённых в вашем кабинете Ozon. Проверьте права ключа и доступ к нужному разделу на стороне площадки. Состояние подключения и результат проверки отображаются в MPReply." },
  { id: "find", icon: "messages", question: "Как найти нужный отзыв, вопрос или сообщение?", answer: "В «Обращениях» выберите площадку, тип и статус, затем используйте поиск по тексту, товару или артикулу. Если список пуст, сбросьте фильтры и проверьте соседние страницы очереди." },
  { id: "review", icon: "help", question: "Почему ответ попал в раздел «На проверке»?", answer: "Для него выбран режим проверки или сработало условие, которое требует решения сотрудника. Откройте ответ, посмотрите обращение и причину остановки. После проверки текст можно исправить, одобрить или отклонить." },
  { id: "context", icon: "ai", question: "Откуда ИИ берёт информацию для ответа?", answer: "Он использует текст обращения, доступные сведения о товаре и контекст, который вы добавили при подготовке ответа. Если важных данных нет, добавьте их перед генерацией или исправьте черновик перед отправкой. Не стоит подтверждать наличие, сроки или характеристики без проверенной информации." },
  { id: "tone", icon: "edit", question: "Можно ли настроить стиль ответов?", answer: "В разделе «Ответы с ИИ» можно выбрать тон и добавить важные факты для ответа. Настройки автоматизации помогают определить, какие обращения обрабатывать автоматически и в каких случаях оставлять решение сотруднику." },
  { id: "negative", icon: "warning", question: "Как отвечать на негативные отзывы?", answer: "Сначала разберитесь в конкретной жалобе. Проверьте факты, спокойно объясните следующий шаг и не обещайте то, что продавец не может выполнить. Для таких обращений можно настроить проверку сотрудником, даже если типовые отзывы обрабатываются автоматически." },
  { id: "extra", icon: "pricing", question: "Как рассчитать дополнительные ответы?", answer: "На странице «Тарифы» выберите объём в калькуляторе дополнительных ответов. Он покажет стоимость пакета и цену одного ответа. Сравните её с тарифом, который соответствует вашему обычному месячному объёму.", link: { href: "/pricing", label: "Открыть калькуляторы" } },
  { id: "permissions", icon: "team", question: "Почему мне недоступны подключение и настройка правил?", answer: "Эти действия доступны владельцу или администратору рабочего пространства. Если у вас роль менеджера или наблюдателя, обратитесь к владельцу. В демо-кабинете доступ только для просмотра." },
  { id: "failed", icon: "problems", question: "Что делать, если ответ не отправился?", answer: "Откройте обращение и прочитайте статус ответа и сообщение об ошибке. Проверьте подключение площадки и её ограничения. Повторную отправку запускайте после устранения причины, чтобы не повторять одну и ту же ошибку." },
  { id: "support", icon: "help", question: "Что написать в обращении в поддержку?", answer: "Укажите маркетплейс, название кабинета и что произошло. Добавьте текст ошибки и скриншот без секретных данных. Это поможет разобраться в ситуации. Не прикладывайте API-ключи, пароли и коды подтверждения.", link: { href: "/contacts", label: "Написать в поддержку" } },
];

const enText: Record<string, Pick<HelpQuestion, "question" | "answer"> & { linkLabel?: string }> = {
  connect: { question: "How do I connect Wildberries, Ozon, Yandex Market, and Avito?", answer: "Open Integrations in MPReply, choose a marketplace, and add its connection details. Each marketplace uses different fields; the relevant page explains what to enter. You do not need to share your seller account password.", linkLabel: "View integrations" },
  cost: { question: "How much does MPReply cost?", answer: "The cost depends on your plan and the number of AI replies. The Pricing page lets you compare plans, estimate your volume, and check additional reply packages.", linkLabel: "Compare plans" },
  trial: { question: "Can I try it for free?", answer: "Yes. The trial lasts 14 days and includes 350 AI replies. Unused trial replies expire after 14 days. You can also explore the demo workspace before signing up.", linkLabel: "Open demo workspace" },
  types: { question: "Which customer messages can AI handle?", answer: "MPReply helps with reviews, buyer questions, and supported messages. Reviews and questions are available for Wildberries, Ozon, and Yandex Market. Avito supports chats and reviews available to your seller account. They appear in Messages." },
  edit: { question: "Can I edit replies before sending?", answer: "Yes. Open a draft, edit its text, and save. In review mode, a teammate approves the reply before sending. Automatic replies follow your workspace rules." },
  auto: { question: "How do automatic replies work?", answer: "In Automation, choose the marketplace, message type, conditions, and processing mode. Routine messages can be handled automatically; messages that need review stay with a teammate. Rules can use ratings, keywords, and other conditions." },
  stores: { question: "Can I connect several stores and seller accounts?", answer: "Yes. Add seller accounts in one workspace's Integrations. Their messages share one inbox, where filters by marketplace, type, and status help you find what you need." },
  roles: { question: "How do team permissions work?", answer: "Access depends on a teammate's role. Owners and admins manage connections and rules. Managers work with messages and replies. Viewers can read data. Actions outside your role are unavailable." },
  analytics: { question: "Where can I see statistics and analytics?", answer: "Open Analytics to see messages and sent replies for a selected period, grouped by marketplace, product, or team activity. Overview also shows your current work summary." },
  missing: { question: "What if new messages are not arriving?", answer: "Check the seller account in Integrations. If it needs attention, open it and read the reason. Check marketplace permissions and inbox filters, which may hide new messages. Contact support if the cause is unclear.", linkLabel: "Contact support" },
  first: { question: "How do I get started?", answer: "Create an account, verify your email, and name your workspace. Connect a seller account in Integrations. Once messages appear, review prepared replies and set up processing rules." },
  install: { question: "Do I need to install software?", answer: "No. MPReply runs in a browser on your computer, tablet, or phone. Log in to open your workspace." },
  demo: { question: "What can I explore in the demo?", answer: "The demo opens the regular MPReply interface with sample data. Explore its sections, inbox, reply review, and integrations. Adding keys, changing data, and sending replies are disabled.", linkLabel: "Explore the workspace" },
  keys: { question: "Do I need to share my marketplace password?", answer: "No. Connections use the marketplace's API access details. MPReply stores keys encrypted on the server. Do not send keys, passwords, or verification codes to support." },
  ozon: { question: "Why are some Ozon messages unavailable?", answer: "Access to individual message types depends on API capabilities and services enabled in your Ozon account. Check the key's permissions and access to the relevant section on Ozon. MPReply displays the connection status and validation result." },
  find: { question: "How do I find a review, question, or message?", answer: "In Messages, choose the marketplace, type, and status, then search by text, product, or SKU. If no results appear, clear filters and check other inbox pages." },
  review: { question: "Why does a reply need review?", answer: "Review mode was selected or a rule requires a teammate's decision. Open the reply, read the message and the reason it stopped. You can edit, approve, or reject it." },
  context: { question: "Where does AI get information for a reply?", answer: "It uses the buyer's message, available product information, and context you add when preparing a reply. Add missing facts before generation or edit the draft before sending. Verify stock, timing, and specifications before confirming them." },
  tone: { question: "Can I change the style of replies?", answer: "In AI replies, choose a tone and add relevant facts. Automation settings determine which messages are processed automatically and which need a teammate's decision." },
  negative: { question: "How should I respond to negative reviews?", answer: "First understand the specific complaint. Check the facts, calmly explain the next step, and avoid promises you cannot fulfil. You can require review for these messages while handling routine reviews automatically." },
  extra: { question: "How do I estimate additional replies?", answer: "Choose a volume in the additional reply calculator on Pricing. It shows the package cost and cost per reply. Compare it with the plan for your usual monthly volume.", linkLabel: "Open calculators" },
  permissions: { question: "Why can I not manage connections or rules?", answer: "These actions require an owner or admin role. Managers and viewers should contact the workspace owner. Demo workspaces are view-only." },
  failed: { question: "What if a reply was not sent?", answer: "Open the message and read the reply status and error. Check the marketplace connection and limits. Retry after resolving the cause so you do not repeat the same error." },
  support: { question: "What should I include in a support request?", answer: "Include the marketplace, seller account name, what happened, and the error text. Add a screenshot with sensitive details removed. Do not include API keys, passwords, or verification codes.", linkLabel: "Contact support" },
};

const definitions: Array<{ id: HelpCategoryId; icon: HelpIconName; ru: [string, string, string]; en: [string, string, string]; questions: string[] }> = [
  { id: "popular", icon: "popular", ru: ["Популярные вопросы", "Часто задаваемые вопросы", "Здесь собраны самые популярные вопросы по MPReply. Выберите тему или откройте нужный вопрос ниже."], en: ["Popular questions", "Frequently asked questions", "Find answers to common MPReply questions. Choose a topic or open a question below."], questions: ["connect", "cost", "trial", "types", "edit", "auto", "stores", "roles", "analytics", "missing"] },
  { id: "start", icon: "start", ru: ["Начало работы", "Как начать работу с MPReply", "Регистрация, пробный период и знакомство с кабинетом."], en: ["Getting started", "Getting started with MPReply", "Registration, the trial, and exploring your workspace."], questions: ["first", "trial", "demo", "install"] },
  { id: "integrations", icon: "integrations", ru: ["Интеграции", "Подключение маркетплейсов", "Кабинеты, данные для подключения и доступ к обращениям."], en: ["Integrations", "Connecting marketplaces", "Seller accounts, connection details, and access to customer messages."], questions: ["connect", "stores", "keys", "ozon"] },
  { id: "messages", icon: "messages", ru: ["Работа с обращениями", "Отзывы, вопросы и сообщения", "Поиск в общей очереди, проверка ответов и статистика."], en: ["Customer messages", "Reviews, questions, and messages", "Search the shared inbox, review replies, and check statistics."], questions: ["types", "find", "review", "edit", "analytics"] },
  { id: "ai", icon: "ai", ru: ["ИИ-ответы", "Подготовка ответов с ИИ", "Контекст товара, стиль общения и автоматическая обработка."], en: ["AI replies", "Preparing replies with AI", "Product context, reply style, and automatic processing."], questions: ["context", "tone", "auto", "negative", "edit"] },
  { id: "team", icon: "team", ru: ["Команда и доступы", "Права сотрудников", "Какие действия доступны владельцу, администратору, менеджеру и наблюдателю."], en: ["Team and access", "Team permissions", "What owners, admins, managers, and viewers can do."], questions: ["roles", "permissions", "analytics"] },
  { id: "pricing", icon: "pricing", ru: ["Тарифы и ответы", "Тарифы, пробный период и пакеты", "Как сравнить объёмы и рассчитать стоимость ИИ-ответов."], en: ["Plans and replies", "Plans, the trial, and packages", "Compare volumes and estimate the cost of AI replies."], questions: ["cost", "trial", "extra"] },
  { id: "problems", icon: "problems", ru: ["Проблемы и решения", "Если что-то не работает", "Что проверить при остановке загрузки или отправки ответа."], en: ["Troubleshooting", "When something is not working", "What to check when messages stop arriving or a reply fails to send."], questions: ["missing", "failed", "review", "support"] },
];

export function getHelpContent(locale: Locale) {
  const questions = locale === "ru" ? ruQuestions : ruQuestions.map((item) => ({
    ...item,
    question: enText[item.id].question,
    answer: enText[item.id].answer,
    link: item.link ? { href: item.link.href, label: enText[item.id].linkLabel ?? item.link.label } : undefined,
  }));
  const categories: HelpCategory[] = definitions.map((item) => {
    const [label, title, description] = item[locale];
    return { id: item.id, icon: item.icon, label, title, description, questions: item.questions };
  });
  return { questions, categories };
}
