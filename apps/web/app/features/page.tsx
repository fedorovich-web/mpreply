import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { appOrigin } from "../../lib/site-config";

import { PublicIcon, type PublicIconName } from "../../components/public-site/PublicIcon";
import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Возможности MPReply — обращения, ИИ-ответы и автоматизация",
  description:
    "Единая очередь обращений с Wildberries, Ozon, Яндекс Маркета и Авито, контекстные ИИ-черновики, автоматизация по правилам, ручная проверка, аналитика, назначение и фильтры.",
  path: "/features",
  localized: true,
});

const marketplaceLogos = {
  wb: {
    src: "/images/icons/final/01-wildberries.avif",
    compactSrc: "/images/icons/final/01-wildberries.avif",
    name: "Wildberries",
  },
  oz: {
    src: "/images/icons/final/02-ozon.avif",
    compactSrc: "/images/icons/final/02-ozon.avif",
    name: "Ozon",
  },
  ym: {
    src: "/images/icons/final/03-yandex-market.avif",
    compactSrc: "/images/icons/final/03-yandex-market.avif",
    name: "Яндекс Маркет",
  },
  av: {
    src: "/images/icons/final/04-avito.avif",
    compactSrc: "/images/brands/avito-sign-logo.svg",
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
    title: "ИИ-автоответы",
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
    text: "Покупатель оставляет отзыв, задаёт вопрос или пишет сообщение.",
  },
  {
    icon: "inbox" as PublicIconName,
    marketplaces: false,
    title: "Все обращения в MPReply",
    text: "Сообщения из всех подключённых площадок попадают в единую очередь.",
  },
  {
    icon: "sparkles" as PublicIconName,
    marketplaces: false,
    title: "ИИ помогает с ответом",
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
    "Правила для типовых случаев",
    "Повторяющиеся обращения можно обрабатывать автоматически по настроенным правилам.",
  ],
  [
    "star",
    "blue",
    "Контекст перед ответом",
    "Текст обращения и доступные сведения о товаре видны рядом с черновиком.",
  ],
  [
    "users",
    "purple",
    "Статус виден команде",
    "Очередь и ответы на проверке помогают распределять задачи между сотрудниками.",
  ],
  [
    "chart",
    "blue",
    "Проверка сложных случаев",
    "Неоднозначные обращения можно оставить сотруднику перед отправкой ответа.",
  ],
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

              <h1>Все возможности MPReply для работы с обращениями покупателей</h1>
              <p>
                MPReply объединяет все инструменты для быстрой, удобной и профессиональной обработки отзывов, вопросов и сообщений на маркетплейсах.
              </p>
              <div className="mockup-actions">
                <Link className="button button-primary" href={appOrigin + "/auth/register?intent=connect-marketplace"}>
                  Попробовать бесплатно <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href="/demo">
                  <PublicIcon name="play" className="public-inline-icon" /> Смотреть демо
                </Link>
              </div>
              <div className="mockup-trust-row" role="group" aria-label="Условия старта">
                <span>14 дней бесплатно</span>
                <span>Без карты</span>
                <span>Быстрое подключение</span>
              </div>
            </div>

            <div className="features-mockup-scene supplied-hero-scene">
              <Image
                alt="Единая очередь MPReply с обращениями из четырёх маркетплейсов"
                className="supplied-hero-image"
                src="/images/approved/02-features-hero.avif"
                width={1671}
                height={941}
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

              <h2>От обращения до довольного клиента</h2>
              <p>MPReply автоматически собирает обращения, помогает с ответами и упрощает вашу работу.</p>
            </div>
            <div className="features-workflow">
              {workflow.map((step, index) => (
                <article className="features-workflow-card" key={step.title}>
                  {step.marketplaces ? (
                    <span className="features-workflow-logos" role="group" aria-label="Wildberries, Ozon, Яндекс Маркет и Авито">
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

              <h2>Экономьте время и развивайте ваш бизнес</h2>
            </div>
            <div className="features-benefit-grid">
              {benefits.map(([icon, tone, title, text]) => (
                <div className="features-benefit-card" key={title}>
                  <span
                    className={`mockup-icon-chip features-benefit-icon ${tone === "blue" ? "" : tone}`}
                    aria-hidden="true"
                  >
                    <PublicIcon name={icon} />
                  </span>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </div>
              ))}
            </div>

          </div>
        </section>
      </div>
    </PublicShell>
  );
}
