import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PublicBrandMark } from "../../components/public-site/PublicBrandMark";
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
  wb: { src: "/images/marketplaces/wildberries.webp", width: 432, height: 188 },
  oz: { src: "/images/marketplaces/ozon.webp", width: 436, height: 198 },
  ym: { src: "/images/marketplaces/yandex-market.webp", width: 554, height: 222 },
  av: { src: "/images/marketplaces/avito.webp", width: 504, height: 212 },
} as const;

const integrations = [
  {
    key: "wb",
    name: "Wildberries",
    path: "/marketplaces/wildberries",
    text: "Работайте с отзывами и вопросами Wildberries в одной очереди MPReply с контекстом товара и контролем перед отправкой.",
    points: ["Подключение аккаунта", "Статусы и синхронизация", "Отзывы и вопросы"],
    logo: marketplaceLogos.wb,
  },
  {
    key: "oz",
    name: "Ozon",
    path: "/marketplaces/ozon",
    text: "Работайте с поддерживаемыми обращениями Ozon в общей очереди MPReply и сохраняйте контекст рядом с ответом.",
    points: ["Подключение аккаунта", "Статусы и синхронизация", "Поддерживаемые обращения"],
    logo: marketplaceLogos.oz,
  },
  {
    key: "ym",
    name: "Яндекс Маркет",
    path: "/marketplaces/yandex-market",
    text: "Работайте с поддерживаемыми обращениями Яндекс Маркета в MPReply и сохраняйте их тип, статус и доступный контекст.",
    points: ["Подключение аккаунта", "Статусы и синхронизация", "Поддерживаемые обращения"],
    logo: marketplaceLogos.ym,
  },
  {
    key: "av",
    name: "Авито",
    path: "/marketplaces/avito",
    text: "Работайте с поддерживаемыми сообщениями покупателей Авито в общей очереди MPReply с контекстом объявления.",
    points: ["Подключение аккаунта", "Статусы диалогов", "Поддерживаемые сообщения"],
    logo: marketplaceLogos.av,
  },
] as const;

const benefits: readonly [PublicIconName, string, string, string][] = [
  [
    "inbox",
    "blue",
    "Единая очередь обращений",
    "Поддерживаемые обращения из подключённых маркетплейсов собраны в одном рабочем пространстве.",
  ],
  [
    "sync",
    "blue",
    "Статусы и синхронизация",
    "MPReply синхронизирует доступные данные и показывает текущее состояние обращений в общей очереди.",
  ],
  [
    "sparkles",
    "purple",
    "ИИ-черновики с контекстом",
    "ИИ помогает подготовить ответ на основе текста обращения, доступного контекста товара и настроек рабочего пространства.",
  ],
  [
    "users",
    "purple",
    "Назначение и контроль",
    "Назначайте обращения, фильтруйте очередь и оставляйте неоднозначные случаи на ручную проверку.",
  ],
];

const connectSteps: readonly [string, PublicIconName, string, string][] = [
  ["1", "link", "Выберите площадку", "Откройте нужную интеграцию и перейдите к подключению аккаунта."],
  ["2", "gear", "Добавьте подключение", "Укажите данные, которые требуются для доступного способа подключения этой площадки."],
  [
    "3",
    "chart",
    "Работайте с очередью",
    "Поддерживаемые обращения появляются в MPReply со статусом и доступным контекстом для дальнейшей обработки.",
  ],
];

function MarketplaceLogo({
  marketplace,
  className,
  decorative = false,
}: {
  marketplace: keyof typeof marketplaceLogos;
  className: string;
  decorative?: boolean;
}) {
  const logo = marketplaceLogos[marketplace];
  const integration = integrations.find((item) => item.key === marketplace);

  return (
    <Image
      className={className}
      src={logo.src}
      width={logo.width}
      height={logo.height}
      alt={decorative ? "" : integration?.name ?? ""}
      aria-hidden={decorative || undefined}
      unoptimized
    />
  );
}

export default function MarketplacesPage() {
  return (
    <PublicShell>
      <div className="mockup-page">
        <section className="marketplaces-mockup-hero mockup-hero">
          <div className="public-container mockup-hero-grid">
            <div className="mockup-hero-copy">
              <p className="mockup-eyebrow">Интеграции MPReply</p>
              <h1>
                Подключайте маркетплейсы <span className="mockup-highlight">в одной системе</span>
              </h1>
              <p>
                Работайте с поддерживаемыми обращениями Wildberries, Ozon, Яндекс Маркета и Авито в одном
                пространстве. Готовьте ИИ-черновики с контекстом и оставляйте сложные случаи на проверку.
              </p>
              <div className="mockup-actions">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Попробовать бесплатно <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href="/demo">
                  <PublicIcon name="play" className="public-inline-icon" /> Смотреть демо
                </Link>
              </div>
              <div className="mockup-trust-row" aria-label="Условия подключения">
                <span>4 площадки</span>
                <span>14 дней бесплатно</span>
                <span>Контроль перед отправкой</span>
              </div>
            </div>

            <div
              className="marketplace-hub-scene"
              role="img"
              aria-label="MPReply объединяет четыре площадки в одном рабочем процессе"
            >
              <span className="marketplace-hub-line l1" aria-hidden="true" />
              <span className="marketplace-hub-line l2" aria-hidden="true" />
              <span className="marketplace-hub-line l3" aria-hidden="true" />
              <span className="marketplace-hub-line l4" aria-hidden="true" />

              <div className="marketplace-hub-core">
                <div className="marketplace-hub-brand">
                  <PublicBrandMark />
                  <strong>MPReply</strong>
                </div>
              </div>

              <div className="marketplace-hub-card wb">
                <span className="marketplace-hub-logo-card">
                  <MarketplaceLogo marketplace="wb" className="mockup-market-logo" decorative />
                </span>
                <span className="marketplace-hub-card-label">
                  <PublicIcon name="message" />
                  <span>Отзывы и вопросы</span>
                </span>
              </div>
              <div className="marketplace-hub-card oz">
                <span className="marketplace-hub-logo-card">
                  <MarketplaceLogo marketplace="oz" className="mockup-market-logo" decorative />
                </span>
                <span className="marketplace-hub-card-label">
                  <PublicIcon name="message" />
                  <span>Поддерживаемые обращения</span>
                </span>
              </div>
              <div className="marketplace-hub-card ym">
                <span className="marketplace-hub-logo-card">
                  <MarketplaceLogo marketplace="ym" className="mockup-market-logo" decorative />
                </span>
                <span className="marketplace-hub-card-label">
                  <PublicIcon name="inbox" />
                  <span>Поддерживаемые обращения</span>
                </span>
              </div>
              <div className="marketplace-hub-card av">
                <span className="marketplace-hub-logo-card">
                  <MarketplaceLogo marketplace="av" className="mockup-market-logo" decorative />
                </span>
                <span className="marketplace-hub-card-label">
                  <PublicIcon name="message" />
                  <span>Сообщения покупателей</span>
                </span>
              </div>

              <div className="marketplace-hero-note marketplace-hero-note-primary" aria-hidden="true">
                Все обращения
                <br />
                в одном окне
                <span>↙</span>
              </div>
              <div className="marketplace-hero-note marketplace-hero-note-sales" aria-hidden="true">
                Одна очередь
                <br />
                для команды
              </div>
              <div className="mockup-mascot" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="mockup-section-head">
              <p className="mockup-eyebrow">Маркетплейсы MPReply</p>
              <h2>Wildberries, Ozon, Яндекс Маркет и Авито</h2>
            </div>

            <div className="marketplace-logo-grid">
              {integrations.map((integration) => (
                <article className="marketplace-logo-card" key={integration.key}>
                  <Image
                    className="marketplace-brand-logo"
                    src={integration.logo.src}
                    width={integration.logo.width}
                    height={integration.logo.height}
                    alt={integration.name}
                    unoptimized
                  />
                  <p>{integration.text}</p>
                  <Link className="button button-secondary" href={integration.path}>
                    Интеграция {integration.name} <span aria-hidden="true">→</span>
                  </Link>
                  <ul>
                    {integration.points.map((point) => <li key={point}>{point}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="mockup-section-head">
              <p className="mockup-eyebrow">Преимущества интеграции</p>
              <h2>Что даёт единый рабочий процесс</h2>
              <p>Подключите нужные маркетплейсы к MPReply и работайте с поддерживаемыми обращениями в одной очереди.</p>
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
              <p className="mockup-eyebrow">Как подключить маркетплейс</p>
              <h2>3 шага до рабочей очереди</h2>
              <p>Выберите нужную площадку, добавьте подключение и работайте с доступными через него обращениями.</p>
            </div>
            <div className="marketplace-connect-steps">
              {connectSteps.map(([number, icon, title, text], index) => (
                <article className="marketplace-connect-card" key={number}>
                  <span className="mockup-step-number">{number}</span>
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

        <section className="public-section public-cta-section">
          <div className="public-container">
            <div className="mockup-cta-strip marketplace-cta-strip">
              <span className="mockup-cta-strip-icon" aria-hidden="true">
                <PublicIcon name="send" />
              </span>
              <div className="mockup-cta-strip-copy">
                <h2>Начните с подключения нужной площадки</h2>
                <p>14 дней бесплатно. Ответы автоматически или после проверки.</p>
              </div>
              <div className="mockup-cta-strip-side">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Попробовать бесплатно <span aria-hidden="true">→</span>
                </Link>
                <Link className="text-link" href="/pricing">
                  Сравнить тарифы →
                </Link>
              </div>
              <span className="marketplace-cta-note" aria-hidden="true">
                4 площадки
                <br />
                один процесс
              </span>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
