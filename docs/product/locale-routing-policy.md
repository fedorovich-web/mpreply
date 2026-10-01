# MPReply locale routing policy

Дата: 2026-09-24

Этот документ дополняет `docs/product/bilingual-copy-policy.md` и фиксирует URL/SEO-архитектуру RU/EN.

## 1. URL structure

Русская версия сохраняет существующие URL без языкового префикса:

- `/`
- `/features`
- `/marketplaces`
- `/pricing`
- `/demo`
- `/help`
- `/contacts`
- `/privacy`
- `/terms`
- `/auth/*`
- `/app/*`

Английская версия живёт в отдельном дереве:

- `/en`
- `/en/features`
- `/en/marketplaces`
- `/en/pricing`
- `/en/demo`
- `/en/help`
- `/en/contacts`
- `/en/privacy`
- `/en/terms`
- `/en/auth/*`
- `/en/app/*`

API не локализуется и остаётся под `/api/*`.

## 2. No automatic locale redirect

Не перенаправлять пользователя автоматически по IP, геолокации или `Accept-Language`.

Причины:

- пользователь сам выбирает язык;
- URL остаются предсказуемыми;
- поисковые роботы не получают разные документы по одному URL;
- существующие русские URL не меняются.

## 3. HTML language

Серверный HTML обязан содержать правильный `lang`:

- RU routes → `<html lang="ru">`
- EN routes → `<html lang="en">`

Locale определяется по URL до серверного рендера.

## 4. SEO separation

Для каждой индексируемой RU/EN пары:

- свой title;
- свой description;
- свой H1;
- свой canonical;
- `hreflang="ru-RU"`;
- `hreflang="en"`;
- `hreflang="x-default"` на русскую версию;
- OpenGraph locale соответствует языку страницы.

RU и EN тексты не должны быть буквальными переводами друг друга.

## 5. Sitemap

В sitemap включаются только публичные индексируемые страницы RU и EN.

Для каждой пары sitemap должен содержать language alternates.

Не включать:

- `/app/*`;
- `/en/app/*`;
- `/auth/*`;
- `/en/auth/*`;
- API.

## 6. Private product UI

RU:

- `/app/*`
- `/auth/*`

EN:

- `/en/app/*`
- `/en/auth/*`

Обе версии используют одинаковые реальные API и одну продуктовую модель данных. Отличается только пользовательский copy и locale-aware formatting. Нельзя создавать отдельные fake данные или отдельный backend для EN.

## 7. Language switcher

Переключатель языка должен вести на эквивалентный route другой локали.

Пример:

- `/marketplaces/wildberries` ↔ `/en/marketplaces/wildberries`
- `/app/inbox` ↔ `/en/app/inbox`

Query string, который влияет на пользовательский flow, сохраняется только если он безопасен и одинаково поддерживается обеими версиями.

## 8. Copy rules

Источник правил: `docs/product/bilingual-copy-policy.md`.

RU использует естественный язык продавца маркетплейса.

EN использует естественный English product/marketing copy для marketplace sellers and teams.

Не смешивать RU и EN в одном интерфейсе, кроме:

- брендов;
- официальных названий маркетплейсов;
- email;
- обязательных внешних идентификаторов, если они реально нужны пользователю.
