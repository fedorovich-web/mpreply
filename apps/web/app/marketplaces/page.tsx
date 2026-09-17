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
    "Подключите Wildberries, Ozon, Яндекс Маркет и Авито к MPReply и работайте с отзывами, вопросами и сообщениями покупателей в одной системе.",
  path: "/marketplaces",
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
    text: "Подключите Wildberries к MPReply и работайте с доступными отзывами, вопросами и сообщениями в одном окне.",
    points: ["Быстрое подключение", "Статусы и синхронизация", "Доступные типы обращений"],
    logo: marketplaceLogos.wb,
  },
  {
    key: "oz",
    name: "Ozon",
    path: "/marketplaces/ozon",
    text: "Подключите Ozon к MPReply и работайте с доступными отзывами, вопросами и сообщениями в одном окне.",
    points: ["Быстрое подключение", "Статусы и синхронизация", "Доступные типы обращений"],
    logo: marketplaceLogos.oz,
  },
  {
    key: "ym",
    name: "Яндекс Маркет",
    path: "/marketplaces/yandex-market",
    text: "Работайте с доступными обращениями Яндекс Маркета в MPReply и сохраняйте контекст в общей очереди.",
    points: ["Быстрое подключение", "Статусы и синхронизация", "Доступные типы обращений"],
    logo: marketplaceLogos.ym,
  },
  {
    key: "av",
    name: "Авито",
    path: "/marketplaces/avito",
    text: "Работайте с доступными сообщениями и отзывами Авито в общей очереди MPReply вместе с командой.",
    points: ["Быстрое подключение", "Статусы и синхронизация", "Доступные типы обращений"],
    logo: marketplaceLogos.av,
  },
] as const;

const benefits: readonly [PublicIconName, string, string, string][] = [
  [
    "inbox",
    "blue",
    "Единая очередь обращений",
    "Отзывы, вопросы и сообщения из подключённых маркетплейсов собраны в одном удобном интерфейсе.",
  ],
  [
    "sync",
    "blue",
    "Статусы и синхронизация",
    "MPReply синхронизирует доступные данные и показывает статусы обращений в одном рабочем пространстве.",
  ],
  [
    "sparkles",
    "purple",
    "AI-подготовка ответов",
    "Искусственный интеллект помогает составлять вежливые, точные и персонализированные ответы.",
  ],
  [
    "users",
    "purple",
    "Командная работа",
    "Распределяйте обращения между сотрудниками, настраивайте роли и контролируйте нагрузку.",
  ],
];

const connectSteps: readonly [string, PublicIconName, string, string][] = [
  ["1", "link", "Выберите маркетплейсы", "Отметьте нужные площадки и нажмите «Подключить»."],
  ["2", "gear", "Авторизуйтесь", "Пройдите авторизацию через доступный способ подключения площадки."],
  [
    "3",
    "chart",
    "Начните работать",
    "Обращения появятся в MPReply. Работайте с ними в единой очереди и сохраняйте контекст.",
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
                Подключите все ключевые маркетплейсы <span className="mockup-highlight">в одной системе</span>
              </h1>
              <p>
                Собирайте отзывы, вопросы и сообщения покупателей со всех маркетплейсов в одном удобном
                рабочем пространстве. Готовьте ответы с контекстом, проверяйте сложные случаи и работайте командой.
              </p>
              <div className="mockup-actions">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Попробовать бесплатно <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href="/demo">
                  <PublicIcon name="play" className="public-inline-icon" /> Смотреть видео
                </Link>
              </div>
              <div className="mockup-trust-row" aria-label="Условия подключения">
                <span>Быстрое подключение</span>
                <span>14 дней бесплатно</span>
                <span>Без карты</span>
              </div>
            </div>

            <div
              className="marketplace-hub-scene"
              role="img"
              aria-label="MPReply соединяет четыре готовые интеграции в одной системе"
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
                  <span>Отзывы и вопросы</span>
                </span>
              </div>
              <div className="marketplace-hub-card ym">
                <span className="marketplace-hub-logo-card">
                  <MarketplaceLogo marketplace="ym" className="mockup-market-logo" decorative />
                </span>
                <span className="marketplace-hub-card-label">
                  <PublicIcon name="inbox" />
                  <span>Сообщения покупателей</span>
                </span>
              </div>
              <div className="marketplace-hub-card av">
                <span className="marketplace-hub-logo-card">
                  <MarketplaceLogo marketplace="av" className="mockup-market-logo" decorative />
                </span>
                <span className="marketplace-hub-card-label">
                  <PublicIcon name="message" />
                  <span>Сообщения и отзывы</span>
                </span>
              </div>

              <div className="marketplace-hero-note marketplace-hero-note-primary" aria-hidden="true">
                Все обращения
                <br />
                в одном окне
                <span>↙</span>
              </div>
              <div className="marketplace-hero-note marketplace-hero-note-sales" aria-hidden="true">
                Больше продаж
                <br />
                с MPReply! ♥
              </div>
              <div className="mockup-mascot" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="mockup-section-head">
              <p className="mockup-eyebrow">Поддерживаем ведущие маркетплейсы</p>
              <h2>Популярные маркетплейсы уже в MPReply</h2>
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
              <p className="mockup-eyebrow">Как подключить маркетплейсы</p>
              <h2>3 простых шага до подключения</h2>
              <p>Подключите все нужные маркетплейсы и начните работать с обращениями уже сегодня.</p>
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
                <h2>Начните подключать маркетплейсы уже сегодня</h2>
                <p>14 дней бесплатного доступа ко всем возможностям. Без карты. Никаких рисков.</p>
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
                Больше возможностей
                <br />
                для вашего бизнеса
              </span>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}