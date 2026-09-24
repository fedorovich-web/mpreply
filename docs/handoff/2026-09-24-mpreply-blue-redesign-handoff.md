# MPReply — handoff по редизайну и дальнейшей работе

Дата: 2026-09-24  
Репозиторий: `fedorovich-web/respio`  
Рабочая ветка: `codex/mpreply-blue-public-redesign`  
Базовый HEAD перед созданием этого handoff: `417ec8d0ab55d001361a480f768e0ce4212e9320`

## 1. Главные правила работы

1. Работать только в ветке `codex/mpreply-blue-public-redesign`.
2. Не делать merge, не трогать `main` без прямого разрешения пользователя.
3. Не менять backend/API, если пользователь отдельно не попросил. Текущий этап — frontend, UX, дизайн, тексты, SEO и локализация.
4. Не придумывать данные, функции, тарифы, лимиты, интеграции или возможности, которых нет в продукте.
5. Не создавать второй AppShell, второй API-клиент, дублирующую дизайн-систему или отдельную палитру.
6. Использовать существующие реальные API через `apiRequest` + Zod-схемы.
7. Не показывать пользователю внутренние технические названия, ошибки сервера, служебные коды и термины реализации.
8. Для meaningful-инвариантов сначала добавлять/обновлять тест-контракт, затем реализацию. Не писать бессмысленные тесты на точные строки CSS.
9. Делать небольшие содержательные коммиты.
10. После каждого блока проверять исходники на текущем HEAD. Нельзя заявлять, что tests/build прошли, если GitHub runner реально не исполнил шаги.
11. Скриншоты и визуальная проверка — только реальные, с текущего HEAD. Нельзя использовать старые снимки или генерацию изображения как доказательство состояния интерфейса.
12. Homepage утверждён и заморожен. Не менять его без отдельной прямой просьбы пользователя.

## 2. Homepage — не трогать

Утверждённая главная является source of truth.

Особенно не менять без отдельной просьбы:
- `apps/web/app/page.tsx`
- `apps/web/styles/homepage-reference-restore.css`
- hero-композицию, размеры, тексты и изображения главной.

`homepage-reference-restore.css` должен оставаться последним CSS-import в layout.

## 3. Дизайн-система

Основные цвета:
- brand blue: `#0B68F6`
- strong/hover: `#0757D7`
- soft blue: `#EAF4FF`
- soft blue text: `#0B61E8`
- navy ink: `#071846`
- white: `#FFFFFF`

Градиенты:
- action: `linear-gradient(110deg,#0D6CF7 0%,#0674FF 58%,#0A5FE8 100%)`
- primary: `linear-gradient(180deg,#1280FF 0%,#0768F5 100%)`

Запрещено возвращать старый фиолетовый визуальный стиль:
- `#5148e8`
- `#635bff`
- `#5964ff`

Визуальный характер:
- чистый B2B SaaS;
- белый и ледяной голубой фон;
- тонкие серо-синие границы;
- мягкие тени;
- компактные рабочие карточки;
- тёмно-синие заголовки;
- синие действия;
- меньше декоративности внутри кабинета, чем на маркетинговых страницах;
- без generic Tailwind dashboard, без чрезмерного glassmorphism и без фиолетового «AI aesthetic».

## 4. Правило текста RU/EN

Проект должен стать двуязычным: русская и английская версии.

Важно: сейчас технически полноценной EN-локали ещё нет. Текущий layout ориентирован на русский язык. Английскую локаль нужно реализовать отдельным следующим этапом, а не имитировать переводом отдельных строк.

Уже добавлен документ:
`docs/product/bilingual-copy-policy.md`

Ключевой принцип:
- RU и EN — не буквальные переводы друг друга;
- каждая локаль получает естественные title, description, H1, подзаголовки, CTA и SEO-текст;
- смысл продукта один, но формулировки и поисковые интенты локализуются под аудиторию языка.

Русская версия должна звучать как продукт для продавца/менеджера маркетплейса:
- «обращения»;
- «отзывы»;
- «вопросы»;
- «сообщения покупателей»;
- «ответы с ИИ»;
- «артикул»;
- «подключение маркетплейса»;
- «передать на проверку»;
- «автоматическая отправка»;
- «данные для подключения».

В пользовательском UI, SEO и маркетинговом тексте не показывать внутренние слова вроде:
- backend / frontend;
- worker;
- SafetyGate;
- runtime;
- prompt version;
- tokens;
- latency;
- scopes;
- credentials;
- rate limits;
- API-коды и request id;
- внутренние названия очередей и сервисов.

Технические термины могут оставаться в коде, API, схемах, тестовых данных и внутренних документах.

## 5. Изображения и иконки

Проверено на рабочей ветке: production-assets уже закоммичены в Git.

В `apps/web/public/images` сейчас 29 production image assets, в том числе:
- marketplace assets: Wildberries, Ozon, Яндекс Маркет, Авито — обычные и compact варианты;
- demo-icons: 5;
- features-icons: 5;
- wildberries-icons: 5;
- `product-shoe.webp`;
- `mpreply-hero.webp`;
- `mpreply-hero-ui.webp`;
- `mpreply-cta-ui.webp`;
- `mpreply-mascot.webp`;
- `mpreply-404-illustration.webp`.

Дополнительно в репозитории лежат 10 Playwright visual snapshots для public pages.

То есть все подготовленные и используемые на текущем дизайне изображения/иконки находятся в Git. Не создавать их заново без необходимости.

## 6. Что уже сделано

### Общая дизайн-система

Shared tokens переведены со старой фиолетовой схемы на утверждённую синюю систему MPReply.

Добавлены/обновлены contract tests, запрещающие возврат старых фиолетовых цветов.

### Admin

Админка приведена к product-like command center без выдуманных данных.

Разрешён только существующий endpoint:
`GET /api/admin/overview`

Разрешённые поля:
- `organizations_total`
- `organizations_active`
- `users_total`
- `subscriptions_active`
- `usage_events_30d`
- `ai_cost_estimate_30d`
- `integration_failures_24h`
- `replies_failed_24h`
- `generated_at`

Не добавлять fake users/orgs/charts/API.

Сделаны:
- compact hero;
- health state только по двум 24h failure-полям;
- KPI strip;
- incidents first;
- нормальные loading/error/denied states;
- retry;
- product copy вместо developer copy.

### Dashboard

Исправлена прогрессивная загрузка:
- основной dashboard не ждёт все secondary запросы;
- review queue / integrations / automation догружаются независимо;
- pending не подменяется нулём;
- ошибки secondary sources показываются как «Недоступно», а не как успешный ноль;
- analytics critical error имеет retry;
- тексты приведены к фактической семантике данных.

### Inbox / Обращения

Сделано:
- очередь не исчезает при failed background refresh;
- initial loading/error отделены от refresh error;
- retry;
- корректная pagination при stale data;
- полный mapping workflow-статусов на понятные следующие шаги;
- review handoff для waiting/manual/safety/approved;
- конфликтующие действия скрыты для уже отправляемых/закрытых состояний;
- mobile list → detail flow;
- technical copy убрана;
- `SKU` в пользовательском тексте заменён на «артикул».

### Review queue / На проверке

Сделано:
- stale queue остаётся видимой после неудачного обновления;
- понятные loading/error states;
- mobile list → editor;
- backend errors переводятся в продуктовые сообщения;
- `SafetyGate...` больше не показывается пользователю;
- stale revision и workflow conflicts имеют человекопонятные сообщения;
- состояния причины проверки визуально различаются.

### Ответы с ИИ

Навигация и страница переименованы из «ИИ-ассистент» в «Ответы с ИИ».

Сделано:
- понятный hero/description;
- убраны request id и служебные ошибки;
- «Правила бренда» переписано на «Как должен звучать ответ»;
- confidence score не показывается как техническая метрика;
- stale appeals остаются видимыми при refresh failure;
- human error messages;
- mobile selection scroll;
- исправлен важный partial-failure:
  если ответ создан, но не передан на проверку, повторная попытка отправляет тот же ответ, а не создаёт второй.

### Автоматизация

Переписана на язык продавца.

Примеры:
- «Порог уверенности» → «Насколько уверенным должен быть ответ»;
- 0.8 в UI → 80%;
- «Включающие ключевые слова» → «Если встречаются слова»;
- «Исключающие» → «Не применять при словах»;
- «Чувствительные темы» → «Темы, которые всегда нужно проверять»;
- «Защитные проверки» → «Когда не отправлять автоматически»;
- «низкая уверенность» → «Если ИИ не уверен в ответе».

Сделано:
- percent UI с преобразованием обратно в API-значение 0..1;
- priority explanation;
- stale data при refresh;
- понятные ошибки;
- mobile list/detail flow;
- copy страницы упрощён.

### Интеграции

Последний законченный блок перед handoff.

Общая страница и 4 marketplace pages переведены на понятную лексику.

Сделано:
- «API-ключ Wildberries» → «Ключ доступа Wildberries»;
- «Seller ID» → «Идентификатор продавца»;
- «Синхронизировать сейчас» → «Обновить данные»;
- «Последняя синхронизация» → «Последнее успешное обновление»;
- накопительный счётчик ошибок убран из UI; вместо него показывается дата последней ошибки;
- «Активно» → «Подключено»;
- pages H1 переписаны на «Подключение кабинетов ...»;
- «Интеграция готова» → «Подключение доступно»;
- stale connections остаются видимыми при failed refresh;
- серверные detail strings не показываются пользователю;
- mobile account → detail flow;
- invalid/revoked credentials теперь учитываются в общей health-сводке как требующие внимания;
- malformed date не показывается сырым значением.

## 7. Текущая проблема CI

GitHub Actions сейчас инфраструктурно не запускает job steps.

Повторяющийся симптом:
- frontend: `steps: []`, `runner_id: 0`
- backend: `steps: []`, `runner_id: 0`
- containers: skipped

Поэтому нельзя писать «tests passed», «build green» или «CI green».

Можно говорить только:
- source verified;
- contract/runtime tests добавлены;
- runner их фактически не исполнил.

## 8. Что дальше — порядок работы

Следующий блок: `/app/analytics`.

Задача:
- убрать внутренние/технические метрики из пользовательского представления;
- оставить бизнес-показатели продавца;
- проверить loading/error/stale data;
- проверить truthful semantics;
- mobile;
- понятные названия графиков/таблиц;
- не придумывать метрики, которых нет в API.

После Analytics:
1. `/app/billing` — тариф, использование, оплата и лимиты понятным коммерческим языком.
2. Повторный cross-app copy audit всех authenticated routes.
3. Auth login/register и public secondary pages — финальный copy/design audit.
4. Реализация полноценной EN locale architecture.
5. EN SEO/marketing copy — не буквальный перевод RU.
6. Проверка metadata, canonical/hreflang, localized URLs и sitemap после выбора структуры локалей.
7. Финальный responsive pass.
8. Реальный Playwright visual QA только когда доступен исполняющий runner/browser.
9. После завершения дизайна — отдельный engineering cleanup, не смешивать его с визуальным этапом.

## 9. Правила для следующего чата

В новом чате сначала:
1. Подключиться к GitHub и прочитать эту ветку.
2. Прочитать этот handoff.
3. Проверить фактический HEAD.
4. Не повторять уже сделанные блоки.
5. Начать с `/app/analytics`.
6. Перед изменениями прочитать текущие analytics component/page/CSS/tests и реальные API schemas.
7. Сначала зафиксировать meaningful contract, затем внести frontend changes.
8. Сохранять русский пользовательский язык понятным и коммерческим.
9. EN-версию делать отдельной полноценной локалью позже, не вставлять английские строки в RU интерфейс.
10. Homepage не менять.

## 10. Важные существующие документы

Перед крупными изменениями полезно перечитать:
- `docs/product/bilingual-copy-policy.md`
- `docs/product/product-baseline.md`
- `docs/product/public-site-master-brief.md`
- `docs/design/asset-policy.md`
- `docs/design/ui-ux-quality-standard.md`
- `docs/superpowers/specs/2026-09-12-mpreply-full-product-redesign-copy-seo-design.md`
- `docs/superpowers/specs/2026-09-12-mpreply-dashboard-ux-addendum.md`
- `docs/superpowers/specs/2026-09-12-mpreply-blue-public-redesign-design.md`

