# Marketplace detail metadata research — 2026-09-17

## Scope

Focused metadata pass for:

- `/marketplaces/wildberries`
- `/marketplaces/ozon`
- `/marketplaces/yandex-market`
- `/marketplaces/avito`

The goal was to validate current Russian search/category language before changing titles and descriptions, while keeping product/release truth above keyword opportunity.

## Search patterns reviewed

### Wildberries

Current category pages and competitor snippets consistently use the language of `ответы на отзывы`, `вопросы покупателей`, AI-assisted drafting and seller control rather than a generic marketplace-integration title.

Useful reference:
- SmartReply, `Ответы на отзывы Wildberries с AI`: https://www.smart-reply.ru/wildberries/otzyvy/

Metadata decision: keep `отзывы и вопросы Wildberries` as the primary intent, but distinguish the page through the MPReply workflow: AI replies plus configurable automation/control.

### Ozon

Current results separate product reviews, buyer questions and, where supported, chat/message scenarios. Search language is broader than the old title formula that only swapped `Wildberries` for `Ozon`.

Useful references:
- SmartReply, `Ответы на отзывы Ozon с AI`: https://smart-reply.ru/ozon/otzyvy/
- Intly AI, `ИИ для Ozon: ответы на отзывы и вопросы покупателей в чатах`: https://intly.ru/news/ozon-reviews-and-chats

Metadata decision: describe Ozon as a set of supported buyer-contact types (`отзывы, вопросы и чаты`) rather than cloning the Wildberries title. Keep the support qualifier in the description.

### Яндекс Маркет

Official Market documentation clearly distinguishes product reviews/questions from buyer chats. Seller chat documentation includes order/return chats and direct buyer messages.

Useful references:
- Yandex Market seller API, `Чаты с покупателями`: https://www.yandex.ru/dev/market/partner-api/doc/ru/step-by-step/chats
- Yandex Market seller help, `Чаты с покупателями`: https://www.yandex.ru/support/marketplace/ru/orders/communication

Metadata decision: use `отзывы, вопросы и чаты Яндекс Маркета` as the visible search intent and emphasize one working queue instead of generic `автоответы покупателям` wording.

### Авито

Current Avito automation results are message/chat-led: incoming buyer messages, dialogue context and AI/automation are the dominant language. Review-centric marketplace wording would misrepresent this intent.

Useful references:
- AvChat, `Автоответчик на Авито с ИИ ассистентом`: https://www.avchat.ru/
- AvReply, `автоматизация продаж на Avito`: https://avreply.ru/

Metadata decision: lead with `сообщения покупателей Авито`, keep dialogue/announcement context in the description, and describe manager review rather than pretending Avito has the same workflow as review-centric marketplaces.

## Structured data and indexation check

Retrieval date: 2026-09-17.

Google Search Central still documents `BreadcrumbList` as a supported structured-data feature for showing a page's position in the site hierarchy. The marketplace detail pages therefore use a breadcrumb path through `/marketplaces`, with the same hierarchy exposed to users as visible navigation.

Google Search Central's June 2026 documentation update states that the FAQ rich-result feature was removed from Google Search. The visible FAQ section remains useful page content, but `FAQPage` JSON-LD is intentionally not added to marketplace commercial pages.

Useful references:
- Google Search Central, `Breadcrumb (BreadcrumbList) structured data`: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
- Google Search Central, `Latest Google Search Documentation Updates`, June 2026 FAQ rich-result removal: https://developers.google.com/search/updates

Indexation audit result:
- public routes, including all four marketplace detail routes, are generated into the sitemap from `publicRoutes`;
- `/app/` and `/auth/` are disallowed in `robots.ts`;
- app and auth layouts additionally emit `noindex`/`nofollow` metadata;
- no sitemap/robots changes were necessary in this pass.

## Implementation constraints retained

- No keyword stuffing or spelling-variant lists in titles.
- No exact AI provider/model claims.
- No invented performance, customer, review-count or commercial claims.
- `доступные` / `поддерживаемые` wording is retained where runtime coverage must not be overstated.
- Existing `createPageMetadata` remains the source for self-canonical, OpenGraph and Twitter metadata.
- Root `metadataBase` remains sourced from `siteConfig.origin`.
- `BreadcrumbList` mirrors a real visible navigation path; no hidden SEO-only hierarchy is invented.
- `FAQPage` schema is omitted because the Google FAQ rich-result feature was removed in 2026.
