import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";

import { PublicIcon, type PublicIconName } from "../components/public-site/PublicIcon";
import { PublicShell } from "../components/public-site/PublicShell";
import {
  localeFromRequestHeader,
  localeRequestHeader,
  localizedPath,
} from "../lib/i18n";

const copy = {
  ru: {
    suggestions: [
      ["chart", "Возможности", "Посмотрите, как MPReply помогает работать с обращениями покупателей.", "/features"],
      ["document", "Тарифы", "Сравните планы и выберите подходящий формат работы.", "/pricing"],
      ["link", "Интеграции", "Проверьте доступные подключения маркетплейсов.", "/marketplaces"],
      ["shield-check", "Поддержка", "Найдите ответы на частые вопросы и инструкции.", "/help"],
    ] as readonly [PublicIconName, string, string, string][],
    title: "Страница не найдена",
    description: "Возможно, она была перемещена, удалена или вы просто неверно набрали адрес.",
    muted: "Но это не страшно — давайте найдём то, что вам нужно.",
    home: "На главную",
    contact: "Связаться с нами",
    suggestionsTitle: "Возможно, вы искали?",
    finalTitle: "Не нашли, что искали?",
    finalText: "Мы всегда на связи и рады помочь вам найти нужную информацию.",
    write: "Написать нам",
  },
  en: {
    suggestions: [
      ["chart", "Features", "See how MPReply helps teams handle marketplace customer messages.", "/features"],
      ["document", "Pricing", "Compare plans and choose a setup that fits your workflow.", "/pricing"],
      ["link", "Integrations", "Review the marketplace connections available in MPReply.", "/marketplaces"],
      ["shield-check", "Help", "Find answers to common questions and practical setup guidance.", "/help"],
    ] as readonly [PublicIconName, string, string, string][],
    title: "Page not found",
    description: "The page may have moved, been removed, or the address may be incorrect.",
    muted: "Choose a section below or return to the home page.",
    home: "Back to home",
    contact: "Contact us",
    suggestionsTitle: "You may be looking for",
    finalTitle: "Still looking for something?",
    finalText: "Contact support and we’ll help you find the right information.",
    write: "Contact support",
  },
} as const;

export default async function NotFound() {
  const requestHeaders = await headers();
  const locale = localeFromRequestHeader(requestHeaders.get(localeRequestHeader));
  const t = copy[locale];
  const path = (value: string) => localizedPath(locale, value);

  return (
    <PublicShell locale={locale}>
      <div className="not-found-render-page">
        <section className="not-found-render-hero">
          <div className="public-container not-found-render-hero-grid">
            <div className="not-found-render-scene" aria-hidden="true">
              <Image
                className="not-found-render-asset not-found-render-robot"
                src="/images/approved/03-404-robot.avif"
                width={1000}
                height={941}
                alt=""
                priority
                unoptimized
              />
              <Image
                className="not-found-render-asset not-found-render-number"
                src="/images/approved/03-404-number.avif"
                width={872}
                height={941}
                alt=""
                priority
                unoptimized
              />
            </div>

            <div className="not-found-render-copy">
              <h1>{t.title}</h1>
              <p>{t.description}</p>
              <p className="not-found-render-muted">{t.muted}</p>
              <div className="not-found-render-actions">
                <Link className="button button-primary" href={path("/")}>{t.home} <span aria-hidden="true">→</span></Link>
                <Link className="button button-secondary" href={path("/contacts")}>{t.contact}</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="not-found-render-suggestions">
          <div className="public-container">
            <h2>{t.suggestionsTitle}</h2>
            <div className="not-found-route-grid">
              {t.suggestions.map(([icon, title, text, href]) => (
                <Link className="not-found-route-card" href={path(href)} key={href}>
                  <span className="not-found-route-icon" aria-hidden="true"><PublicIcon name={icon} /></span>
                  <strong>{title}</strong>
                  <p>{text}</p>
                  <span className="not-found-route-arrow" aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="not-found-render-final">
          <div className="public-container not-found-render-final-card">
            <span className="not-found-render-final-icon" aria-hidden="true"><PublicIcon name="message" /></span>
            <div><h2>{t.finalTitle}</h2><p>{t.finalText}</p></div>
            <Link className="button button-primary" href={path("/contacts")}>{t.write} <span aria-hidden="true">→</span></Link>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
