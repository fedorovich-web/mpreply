import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PublicBrandMark } from "../../components/public-site/PublicBrandMark";
import { PublicIcon, type PublicIconName } from "../../components/public-site/PublicIcon";
import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Возможности MPReply — обращения, ИИ-ответы и автоматизация",
  description:
    "Единая очередь обращений с Wildberries, Ozon, Яндекс Маркета и Авито, подготовка ответов с ИИ, контроль качества, автоответы, шаблоны, аналитика и командная работа.",
  path: "/features",
});

const marketplaceLogos = {
  wb: {
    src: "/images/marketplaces/wildberries.webp",
    compactSrc: "/images/marketplaces/wildberries-compact.webp",
    name: "Wildberries",
  },
  oz: {
    src: "/images/marketplaces/ozon.webp",
    compactSrc: "/images/marketplaces/ozon-compact.webp",
    name: "Ozon",
  },
  ym: {
    src: "/images/marketplaces/yandex-market.webp",
    compactSrc: "/images/marketplaces/yandex-market-compact.webp",
    name: "Яндекс Маркет",
  },
  av: {
    src: "/images/marketplaces/avito.webp",
    compactSrc: "/images/marketplaces/avito-compact.webp",
    name: "Авито",
  },
} as const;

type MarketplaceLogoKey = keyof typeof marketplaceLogos;
type Tone = "blue" | "purple" | "green" | "orange";

const tools: readonly { icon: PublicIconName; tone: Tone; title: string; text: string }[] = [
  {
    icon: "inbox",
    tone: "blue",
    title: "Единая очередь обращений",
    text: "Все отзывы, вопросы и сообщения из разных маркетплейсов в одном удобном интерфейсе.",
  },
  {
    icon: "sparkles",
    tone: "purple",
    title: "AI-подготовка ответов",
    text: "Искусственный интеллект помогает составлять вежливые, точные и персонализированные ответы.",
  },
  {
    icon: "shield-check",
    tone: "green",
    title: "Контроль качества",
    text: "Проверка тональности, грамотности и соответствия правилам маркетплейсов.",
  },
  {
    icon: "lightning",
    tone: "orange",
    title: "Автоответы и сценарии",
    text: "Автоматически отвечайте на типовые вопросы и настройте сценарии для разных ситуаций.",
  },
  {
    icon: "document",
    tone: "blue",
    title: "Шаблоны ответов",
    text: "Создавайте и сохраняйте шаблоны для быстрых и единообразных ответов.",
  },
  {
    icon: "chart",
    tone: "blue",
    title: "Аналитика",
    text: "Следите за рейтингом, динамикой отзывов и скоростью ответов. Принимайте решения на основе данных.",
  },
  {
    icon: "users",
    tone: "purple",
    title: "Командная работа",
    text: "Распределяйте обращения между сотрудниками, устанавливайте роли и контролируйте нагрузку.",
  },
  {
    icon: "clock",
    tone: "purple",
    title: "История действий",
    text: "Полная история обращений и действий сотрудников для прозрачности и контроля.",
  },
];

const workflow = [
  {
    icon: null,
    marketplaces: true,
    title: "Обращение на маркетплейсе",
    text: "Покупатель оставляет отзыв, задает вопрос или пишет сообщение.",
  },
  {
    icon: "inbox" as PublicIconName,
    marketplaces: false,
    title: "Все обращения в MPReply",
    text: "Сообщения из всех подключенных площадок попадают в единую очередь.",
  },
  {
    icon: "sparkles" as PublicIconName,
    marketplaces: false,
    title: "AI помогает с ответом",
    text: "MPReply предлагает подходящий вариант ответа или использует ваши шаблоны.",
  },
  {
    icon: "send" as PublicIconName,
    marketplaces: false,
    title: "Довольный клиент",
    text: "Вы отправляете ответ, а клиент получает быструю и профессиональную поддержку.",
  },
] as const;

const benefits: readonly [PublicIconName, Tone, string, string][] = [
  [
    "clock",
    "purple",
    "Меньше времени на ответы",
    "Автоматизация и AI ускоряют обработку типовых обращений.",
  ],
  [
    "star",
    "blue",
    "Выше рейтинг товаров",
    "Быстрые и качественные ответы помогают получать больше положительных отзывов.",
  ],
  [
    "users",
    "purple",
    "Команда работает эффективнее",
    "Удобные инструменты для распределения задач и контроля качества.",
  ],
  [
    "chart",
    "blue",
    "Больше продаж",
    "Довольные клиенты чаще возвращаются и рекомендуют ваши товары.",
  ],
];

const messages: readonly [MarketplaceLogoKey, string, string, string][] = [
  ["wb", "Вопрос", "Подойдет ли на рост 170 см?", "12 мин назад"],
  ["oz", "Отзыв", "Отличное качество! Быстрая доставка.", "28 мин назад"],
  ["ym", "Сообщение", "Когда будет поставка?", "1 час назад"],
  ["av", "Вопрос", "Можно вернуть товар?", "2 часа назад"],
];

function CompactMarketplaceLogo({
  marketplace,
  className,
  decorative = false,
}: {
  marketplace: MarketplaceLogoKey;
  className: string;
  decorative?: boolean;
}) {
  const logo = marketplaceLogos[marketplace];

  return (
    <Image
      className={className}
      src={logo.compactSrc}
      width={64}
      height={64}
      alt={decorative ? "" : logo.name}
      aria-hidden={decorative || undefined}
      unoptimized
    />
  );
}

export default function FeaturesPage() {
  return (
    <PublicShell>
      <div className="mockup-page">
        <section className="features-mockup-hero mockup-hero">
          <div className="public-container mockup-hero-grid">
            <div className="mockup-hero-copy">
              <p className="mockup-eyebrow">Больше возможностей — больше довольных клиентов</p>
              <h1>Все возможности MPReply для работы с обращениями покупателей</h1>
              <p>
                MPReply объединяет все инструменты для быстрой, удобной и профессиональной обработки отзывов,
                вопросов и сообщений на маркетплейсах.
              </p>
              <div className="mockup-actions">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Попробовать бесплатно <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href="/demo">
                  <PublicIcon name="play" className="public-inline-icon" /> Смотреть демо
                </Link>
              </div>
              <div className="mockup-trust-row" aria-label="Условия старта">
                <span>14 дней бесплатно</span>
                <span>Без карты</span>
                <span>Быстрое подключение</span>
              </div>
            </div>

            <div
              className="features-mockup-scene"
              role="img"
              aria-label="Единая очередь MPReply с обращениями из четырёх маркетплейсов"
            >
              <div className="features-window">
                <aside className="features-app-sidebar" aria-hidden="true">
                  <div className="features-app-brand">
                    <PublicBrandMark />
                    <strong>MPReply</strong>
                  </div>
                  <nav className="features-app-nav">
                    <strong className="features-app-nav-item is-active">
                      <PublicIcon name="inbox" />
                      Все обращения
                      <b>24</b>
                    </strong>
                    <span className="features-app-nav-item"><PublicIcon name="message" />Отзывы</span>
                    <span className="features-app-nav-item"><PublicIcon name="message" />Вопросы</span>
                    <span className="features-app-nav-item"><PublicIcon name="message" />Сообщения</span>
                    <i />
                    <span className="features-app-nav-item"><PublicIcon name="chart" />Аналитика</span>
                    <span className="features-app-nav-item"><PublicIcon name="archive" />Шаблоны</span>
                    <span className="features-app-nav-item"><PublicIcon name="users" />Команда</span>
                  </nav>
                </aside>

                <div className="features-app-main">
                  <div className="features-feed-tabs" aria-hidden="true">
                    <span>Все <b>24</b></span>
                    <span>Отзывы <b>12</b></span>
                    <span>Вопросы <b>8</b></span>
                    <span>Сообщения <b>4</b></span>
                  </div>

                  <div className="features-feed">
                    {messages.map(([marketplace, kind, text, time]) => (
                      <div className="features-message" key={`${marketplace}-${text}`}>
                        <span className="features-message-source">
                          <CompactMarketplaceLogo marketplace={marketplace} className="features-market-logo" />
                        </span>
                        <div>
                          <strong>{kind}</strong>
                          <p>{text}</p>
                        </div>
                        <small>{time}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="features-hero-note features-hero-note-primary" aria-hidden="true">
                Все обращения
                <br />
                в одном окне
                <span>↙</span>
              </div>
              <div className="features-hero-note features-hero-note-ai" aria-hidden="true">
                Быстрые и точные ответы
                <br />
                с помощью AI
                <span>↙</span>
              </div>
              <div className="mockup-mascot" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="mockup-section-head">
              <p className="mockup-eyebrow">Возможности</p>
              <h2>Все инструменты для эффективной работы</h2>
              <p>MPReply помогает автоматизировать рутину, повысить качество ответов и сделать ваших клиентов счастливее.</p>
            </div>
            <div className="features-tool-grid">
              {tools.map((tool) => (
                <article className="features-tool-card" key={tool.title}>
                  <span className={`mockup-icon-chip ${tool.tone === "blue" ? "" : tool.tone}`} aria-hidden="true">
                    <PublicIcon name={tool.icon} />
                  </span>
                  <h3>{tool.title}</h3>
                  <p>{tool.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="mockup-section-head">
              <p className="mockup-eyebrow">Как это работает</p>
              <h2>От обращения до довольного клиента</h2>
              <p>MPReply автоматически собирает обращения, помогает с ответами и упрощает вашу работу.</p>
            </div>
            <div className="features-workflow">
              {workflow.map((step, index) => (
                <article className="features-workflow-card" key={step.title}>
                  <span className="mockup-step-number">{index + 1}</span>
                  {step.marketplaces ? (
                    <span className="features-workflow-logos" aria-label="Wildberries, Ozon, Яндекс Маркет и Авито">
                      {(Object.keys(marketplaceLogos) as MarketplaceLogoKey[]).map((marketplace) => (
                        <span className="features-workflow-logo-chip" key={marketplace}>
                          <CompactMarketplaceLogo
                            marketplace={marketplace}
                            className="features-workflow-logo"
                            decorative
                          />
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className={`mockup-icon-chip ${index === 2 ? "purple" : ""}`} aria-hidden="true">
                      <PublicIcon name={step.icon} />
                    </span>
                  )}
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="mockup-section-head">
              <p className="mockup-eyebrow">Почему команды выбирают MPReply</p>
              <h2>Экономьте время и развивайте ваш бизнес</h2>
            </div>
            <div className="features-benefit-grid">
              {benefits.map(([icon, tone, title, text]) => (
                <article className="features-benefit-card" key={title}>
                  <span
                    className={`mockup-icon-chip features-benefit-icon ${tone === "blue" ? "" : tone}`}
                    aria-hidden="true"
                  >
                    <PublicIcon name={icon} />
                  </span>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section public-cta-section">
          <div className="public-container">
            <div className="mockup-cta-strip features-cta-strip">
              <div className="mockup-cta-strip-copy">
                <p className="mockup-eyebrow">Готовы попробовать?</p>
                <h2>Начните использовать все возможности MPReply</h2>
                <p>14 дней бесплатного доступа. Без карты. Никаких рисков.</p>
              </div>
              <div className="mockup-cta-strip-side">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Попробовать бесплатно <span aria-hidden="true">→</span>
                </Link>
                <div className="mockup-trust-row" aria-label="Условия старта">
                  <span>Быстрое подключение</span>
                  <span>Полный доступ</span>
                  <span>Без карты</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
