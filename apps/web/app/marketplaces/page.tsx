import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

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

const benefits = [
  ["✉", "Единая очередь обращений", "Все отзывы, вопросы и сообщения из Wildberries, Ozon, Яндекс Маркета и Авито в одном удобном интерфейсе."],
  ["↻", "Статусы и синхронизация", "Автоматически обновляем статусы, синхронизируем данные и не даём потерять ни одно обращение."],
  ["✦", "AI-подготовка ответов", "Искусственный интеллект помогает составлять вежливые, точные и персонализированные ответы."],
  ["●", "Командная работа", "Распределяйте обращения между сотрудниками, настраивайте роли и контролируйте нагрузку."],
] as const;

const connectSteps = [
  ["1", "Выберите маркетплейсы", "Отметьте нужные площадки и нажмите «Подключить»."],
  ["2", "Авторизуйтесь", "Пройдите безопасную авторизацию на площадках за пару минут."],
  ["3", "Начните работать", "Все обращения появятся в MPReply. Отвечайте быстрее, повышайте рейтинг и увеличивайте продажи."],
] as const;

function MarketplaceLogo({ marketplace, className, decorative = false }: {
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
                Собирайте отзывы, вопросы и сообщения покупателей со всех маркетплейсов в одном удобном рабочем пространстве. Быстро отвечайте, повышайте рейтинг и развивайте продажи.
              </p>
              <div className="mockup-actions">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Попробовать бесплатно <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href="/demo">Смотреть видео</Link>
              </div>
              <div className="mockup-trust-row" aria-label="Условия подключения">
                <span>Быстрое подключение</span>
                <span>14 дней бесплатно</span>
                <span>Без карты</span>
              </div>
            </div>

            <div className="marketplace-hub-scene" role="img" aria-label="MPReply соединяет четыре готовые интеграции в одной системе">
              <span className="marketplace-hub-line l1" aria-hidden="true" />
              <span className="marketplace-hub-line l2" aria-hidden="true" />
              <div className="marketplace-hub-core">MPReply</div>
              <div className="marketplace-hub-card wb">
                <MarketplaceLogo marketplace="wb" className="mockup-market-logo" decorative />
                <span>Отзывы и вопросы</span>
              </div>
              <div className="marketplace-hub-card oz">
                <MarketplaceLogo marketplace="oz" className="mockup-market-logo" decorative />
                <span>Отзывы и вопросы</span>
              </div>
              <div className="marketplace-hub-card ym">
                <MarketplaceLogo marketplace="ym" className="mockup-market-logo" decorative />
                <span>Сообщения покупателей</span>
              </div>
              <div className="marketplace-hub-card av">
                <MarketplaceLogo marketplace="av" className="mockup-market-logo" decorative />
                <span>Сообщения и отзывы</span>
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
                  <Link className="button button-secondary" href={integration.path}>Подробнее <span aria-hidden="true">→</span></Link>
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
              {benefits.map(([icon, title, text], index) => (
                <article className="marketplace-benefit-card" key={title}>
                  <span className={`mockup-icon-chip ${index === 2 || index === 3 ? "purple" : ""}`} aria-hidden="true">{icon}</span>
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
              <h2>3 простых шага до полной интеграции</h2>
              <p>Подключите все нужные маркетплейсы и начните работать с обращениями уже сегодня.</p>
            </div>
            <div className="marketplace-connect-steps">
              {connectSteps.map(([number, title, text], index) => (
                <article className="marketplace-connect-card" key={number}>
                  <span className="mockup-step-number">{number}</span>
                  <span className={`mockup-icon-chip ${index === 1 ? "purple" : ""}`} aria-hidden="true">
                    {index === 0 ? "↗" : index === 1 ? "⚙" : "▥"}
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
            <div className="mockup-cta">
              <h2>Начните подключать маркетплейсы уже сегодня</h2>
              <p>14 дней бесплатного доступа ко всем возможностям. Без карты. Никаких рисков.</p>
              <div className="mockup-actions">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Попробовать бесплатно <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
