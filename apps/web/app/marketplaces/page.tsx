import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { appOrigin } from "../../lib/site-config";

import { PublicIcon, type PublicIconName } from "../../components/public-site/PublicIcon";
import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Интеграции MPReply — Wildberries, Ozon, Яндекс Маркет и Авито",
  description:
    "Работайте с поддерживаемыми обращениями Wildberries, Ozon, Яндекс Маркета и Авито в единой очереди MPReply с ИИ-черновиками и контролем перед отправкой.",
  path: "/marketplaces",
  localized: true,
});

const marketplaceLogos = {
  wb: "/images/icons/final/01-wildberries.avif",
  oz: "/images/icons/final/02-ozon.avif",
  ym: "/images/icons/final/03-yandex-market.avif",
  av: "/images/icons/final/04-avito.avif",
} as const;

const integrations = [
  {
    key: "wb",
    name: "Wildberries",
    path: "/marketplaces/wildberries",
    text: "Полная интеграция с Wildberries. Собирайте отзывы, вопросы и сообщения в реальном времени.",
    points: ["Быстрое подключение", "Стабильная работа", "Все типы обращений"],
    logo: marketplaceLogos.wb,
  },
  {
    key: "oz",
    name: "Ozon",
    path: "/marketplaces/ozon",
    text: "Подключите Ozon за пару минут. Получайте все отзывы, вопросы и сообщения в одном окне.",
    points: ["Быстрое подключение", "Стабильная работа", "Все типы обращений"],
    logo: marketplaceLogos.oz,
  },
  {
    key: "ym",
    name: "Яндекс Маркет",
    path: "/marketplaces/yandex-market",
    text: "Работайте с Яндекс Маркетом вместе с MPReply. Не упускайте ни одного обращения от покупателей.",
    points: ["Быстрое подключение", "Стабильная работа", "Все типы обращений"],
    logo: marketplaceLogos.ym,
  },
  {
    key: "av",
    name: "Авито",
    path: "/marketplaces/avito",
    text: "Интеграция с Авито поможет быстро обрабатывать сообщения и отзывы, повышать лояльность клиентов.",
    points: ["Быстрое подключение", "Стабильная работа", "Все типы обращений"],
    logo: marketplaceLogos.av,
  },
] as const;

const benefits: readonly [PublicIconName, string, string, string][] = [
  [
    "inbox",
    "blue",
    "Единая очередь обращений",
    "Все отзывы, вопросы и сообщения из Wildberries, Ozon, Яндекс Маркета и Авито в одном удобном интерфейсе.",
  ],
  [
    "sync",
    "blue",
    "Статусы и синхронизация",
    "Автоматически обновляем статусы, синхронизируем данные и не даём потерять ни одно обращение.",
  ],
  [
    "sparkles",
    "purple",
    "ИИ-автоответы",
    "Искусственный интеллект помогает составлять вежливые, точные и персонализированные ответы.",
  ],
  [
    "users",
    "purple",
    "Командная работа",
    "Распределяйте обращения между сотрудниками, настраивайте роли и контролируйте нагрузку.",
  ],
];

const connectSteps: readonly [PublicIconName, string, string][] = [
  ["link", "Выберите маркетплейсы", "Отметьте нужные площадки и нажмите «Подключить»."],
  ["gear", "Авторизуйтесь", "Пройдите безопасную авторизацию на площадках за пару минут."],
  [
    "chart",
    "Начните работать",
    "Все обращения появятся в MPReply. Отвечайте быстрее, повышайте рейтинг и увеличивайте продажи.",
  ],
];

export default function MarketplacesPage() {
  return (
    <PublicShell>
      <div className="mockup-page">
        <section className="marketplaces-mockup-hero mockup-hero">
          <div className="public-container mockup-hero-grid">
            <div className="mockup-hero-copy">

              <h1>
                Подключите все ключевые маркетплейсы <span className="mockup-highlight">в одной системе</span>
              </h1>
              <p>
                Собирайте отзывы, вопросы и сообщения покупателей со всех маркетплейсов в одном удобном рабочем пространстве. Быстро отвечайте, повышайте рейтинги и развивайте продажи.
              </p>
              <div className="mockup-actions">
                <Link className="button button-primary" href={appOrigin + "/auth/register?intent=connect-marketplace"}>
                  Попробовать бесплатно <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href="/demo">
                  <PublicIcon name="play" className="public-inline-icon" /> Смотреть видео
                </Link>
              </div>
              <div className="mockup-trust-row" role="group" aria-label="Условия подключения">
                <span>Быстрое подключение</span>
                <span>14 дней бесплатно</span>
                <span>Без карты</span>
              </div>
            </div>

            <div className="marketplace-hub-scene supplied-hero-scene">
              <Image
                alt="MPReply объединяет Wildberries, Ozon, Яндекс Маркет и Авито"
                className="supplied-hero-image"
                src="/images/approved/03-marketplaces-hero.avif"
                width={1652}
                height={952}
                sizes="(max-width: 1100px) 100vw, 50vw"
                priority
                unoptimized
              />
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="mockup-section-head">

              <h2>Популярные маркетплейсы уже в MPReply</h2>
            </div>

            <div className="marketplace-logo-grid">
              {integrations.map((integration) => (
                <Link className="marketplace-logo-card" href={integration.path} key={integration.key} aria-label={`Подробнее об интеграции с ${integration.name}`}>
                  <div className={`marketplace-brand-lockup is-${integration.key}`}>
                    <Image
                      className="marketplace-brand-lockup-image"
                      src={integration.logo}
                      width={256}
                      height={256}
                      alt=""
                      unoptimized
                    />
                  </div>
                  <p>{integration.text}</p>
                  <ul>
                    {integration.points.map((point) => <li key={point}>{point}</li>)}
                  </ul>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="mockup-section-head">

              <h2>Что даёт единая интеграция</h2>
              <p>Подключите все маркетплейсы к MPReply и работайте с обращениями проще, быстрее и эффективнее.</p>
            </div>
            <div className="marketplace-benefits-grid">
              {benefits.map(([icon, tone, title, text]) => (
                <article className="marketplace-benefit-card" key={title}>
                  <span className={`mockup-icon-chip ${tone === "blue" ? "" : tone}`} aria-hidden="true">
                    <PublicIcon name={icon} />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="mockup-section-head">

              <h2>3 простых шага до полной интеграции</h2>
              <p>Подключите все нужные маркетплейсы и начните работать с обращениями уже сегодня.</p>
            </div>
            <div className="marketplace-connect-steps">
              {connectSteps.map(([icon, title, text], index) => (
                <article className="marketplace-connect-card" key={title}>
                  <span className={`mockup-icon-chip ${index === 1 ? "purple" : ""}`} aria-hidden="true">
                    <PublicIcon name={icon} />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

      </div>
    </PublicShell>
  );
}
