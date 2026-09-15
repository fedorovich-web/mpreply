import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

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
  wb: { src: "/images/marketplaces/wildberries.webp", width: 432, height: 188, name: "Wildberries" },
  oz: { src: "/images/marketplaces/ozon.webp", width: 436, height: 198, name: "Ozon" },
  ym: { src: "/images/marketplaces/yandex-market.webp", width: 554, height: 222, name: "Яндекс Маркет" },
  av: { src: "/images/marketplaces/avito.webp", width: 504, height: 212, name: "Авито" },
} as const;

type MarketplaceLogoKey = keyof typeof marketplaceLogos;
type Tone = "blue" | "purple" | "green" | "orange";

const tools: readonly { icon: PublicIconName; tone: Tone; title: string; text: string }[] = [
  { icon: "inbox", tone: "blue", title: "Единая очередь обращений", text: "Все отзывы, вопросы и сообщения из разных маркетплейсов в одном удобном интерфейсе." },
  { icon: "sparkles", tone: "purple", title: "AI-подготовка ответов", text: "Искусственный интеллект помогает составлять вежливые, точные и персонализированные ответы." },
  { icon: "shield-check", tone: "green", title: "Контроль качества", text: "Проверка тональности, грамотности и соответствия правилам маркетплейсов." },
  { icon: "lightning", tone: "orange", title: "Автоответы и сценарии", text: "Автоматически отвечайте на типовые вопросы и настройте сценарии для разных ситуаций." },
  { icon: "document", tone: "blue", title: "Шаблоны ответов", text: "Создавайте и сохраняйте шаблоны для быстрых и единообразных ответов." },
  { icon: "chart", tone: "blue", title: "Аналитика", text: "Следите за рейтингом, динамикой отзывов и скоростью ответов. Принимайте решения на основе данных." },
  { icon: "users", tone: "purple", title: "Командная работа", text: "Распределяйте обращения между сотрудниками, устанавливайте роли и контролируйте нагрузку." },
  { icon: "clock", tone: "purple", title: "История действий", text: "Полная история обращений и действий сотрудников для прозрачности и контроля." },
];

const workflow = [
  { icon: null, marketplaces: true, title: "Обращение на маркетплейсе", text: "Покупатель оставляет отзыв, задает вопрос или пишет сообщение." },
  { icon: "inbox" as PublicIconName, marketplaces: false, title: "Все обращения в MPReply", text: "Сообщения из всех подключенных площадок попадают в единую очередь." },
  { icon: "sparkles" as PublicIconName, marketplaces: false, title: "AI помогает с ответом", text: "MPReply предлагает подходящий вариант ответа или использует ваши шаблоны." },
  { icon: "send" as PublicIconName, marketplaces: false, title: "Довольный клиент", text: "Вы отправляете ответ, а клиент получает быструю и профессиональную поддержку." },
] as const;

const benefits: readonly [PublicIconName, Tone, string, string][] = [
  ["clock", "purple", "До 70% меньше времени на ответы", "Автоматизация и AI ускоряют обработку типовых обращений."],
  ["star", "orange", "Выше рейтинг товаров", "Быстрые и качественные ответы помогают получать больше положительных отзывов."],
  ["users", "purple", "Команда работает эффективнее", "Удобные инструменты для распределения задач и контроля качества."],
  ["chart", "blue", "Больше продаж", "Довольные клиенты чаще возвращаются и рекомендуют ваши товары."],
];

const messages: readonly [MarketplaceLogoKey, string, string][] = [
  ["wb", "Подойдет ли на рост 170 см?", "12 мин назад"],
  ["oz", "Отличное качество! Быстрая доставка.", "28 мин назад"],
  ["ym", "Когда будет поставка?", "1 час назад"],
  ["av", "Можно вернуть товар?", "2 часа назад"],
];

function MarketplaceLogo({ marketplace, className, decorative = false }: { marketplace: MarketplaceLogoKey; className: string; decorative?: boolean }) {
  const logo = marketplaceLogos[marketplace];
  return <Image className={className} src={logo.src} width={logo.width} height={logo.height} alt={decorative ? "" : logo.name} aria-hidden={decorative || undefined} unoptimized />;
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
              <p>MPReply объединяет все инструменты для быстрой, удобной и профессиональной обработки отзывов, вопросов и сообщений на маркетплейсах.</p>
              <div className="mockup-actions">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">Попробовать бесплатно <span aria-hidden="true">→</span></Link>
                <Link className="button button-secondary" href="/demo">Смотреть демо</Link>
              </div>
              <div className="mockup-trust-row" aria-label="Условия старта"><span>14 дней бесплатно</span><span>Без карты</span><span>Быстрое подключение</span></div>
            </div>

            <div className="features-mockup-scene" role="img" aria-label="Единая очередь MPReply с обращениями и подготовленным ответом">
              <div className="features-window">
                <div className="features-window-top"><strong>Все обращения</strong><span>24 обращения</span></div>
                <div className="features-window-body">
                  <div className="features-feed">
                    <div className="features-feed-tabs" aria-hidden="true"><span>Все</span><span>Отзывы</span><span>Вопросы</span><span>Сообщения</span></div>
                    {messages.map(([marketplace, text, time]) => (
                      <div className="features-message" key={`${marketplace}-${text}`}>
                        <span className="features-message-source"><MarketplaceLogo marketplace={marketplace} className="features-market-logo" /></span>
                        <div><strong>Покупатель</strong><p>{text}</p></div><small>{time}</small>
                      </div>
                    ))}
                  </div>
                  <div className="features-draft-pane">
                    <div className="features-draft-card"><strong><PublicIcon name="sparkles" className="public-inline-icon" /> AI предлагает ответ</strong><p>Быстрые и точные ответы с учетом контекста обращения и правил вашей команды.</p><span>Использовать ответ</span></div>
                  </div>
                </div>
              </div>
              <div className="mockup-mascot" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="public-section"><div className="public-container"><div className="mockup-section-head"><p className="mockup-eyebrow">Возможности</p><h2>Все инструменты для эффективной работы</h2><p>MPReply помогает автоматизировать рутину, повысить качество ответов и сделать ваших клиентов счастливее.</p></div><div className="features-tool-grid">{tools.map((tool) => <article className="features-tool-card" key={tool.title}><span className={`mockup-icon-chip ${tool.tone === "blue" ? "" : tool.tone}`} aria-hidden="true"><PublicIcon name={tool.icon} /></span><h3>{tool.title}</h3><p>{tool.text}</p></article>)}</div></div></section>

        <section className="public-section mockup-section-soft"><div className="public-container"><div className="mockup-section-head"><p className="mockup-eyebrow">Как это работает</p><h2>От обращения до довольного клиента</h2><p>MPReply автоматически собирает обращения, помогает с ответами и упрощает вашу работу.</p></div><div className="features-workflow">{workflow.map((step, index) => <article className="features-workflow-card" key={step.title}><span className="mockup-step-number">{index + 1}</span>{step.marketplaces ? <span className="features-workflow-logos" aria-label="Wildberries, Ozon, Яндекс Маркет и Авито">{(Object.keys(marketplaceLogos) as MarketplaceLogoKey[]).map((marketplace) => <span className="features-workflow-logo-chip" key={marketplace}><MarketplaceLogo marketplace={marketplace} className="features-workflow-logo" decorative /></span>)}</span> : <span className="mockup-icon-chip" aria-hidden="true"><PublicIcon name={step.icon} /></span>}<h3>{step.title}</h3><p>{step.text}</p></article>)}</div></div></section>

        <section className="public-section"><div className="public-container"><div className="mockup-section-head"><p className="mockup-eyebrow">Почему команды выбирают MPReply</p><h2>Экономьте время и развивайте ваш бизнес</h2></div><div className="features-benefit-grid">{benefits.map(([icon, tone, title, text]) => <article className="features-benefit-card" key={title}><span className={`mockup-icon-chip features-benefit-icon ${tone === "blue" ? "" : tone}`} aria-hidden="true"><PublicIcon name={icon} /></span><strong>{title}</strong><span>{text}</span></article>)}</div></div></section>

        <section className="public-section public-cta-section">
          <div className="public-container">
            <div className="mockup-cta-strip">
              <span className="mockup-cta-strip-icon" aria-hidden="true"><PublicIcon name="send" /></span>
              <div className="mockup-cta-strip-copy">
                <p className="mockup-eyebrow">Готовы попробовать?</p>
                <h2>Начните использовать все возможности MPReply</h2>
                <p>14 дней бесплатного доступа. Без карты. Никаких рисков.</p>
              </div>
              <div className="mockup-cta-strip-side">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">Попробовать бесплатно <span aria-hidden="true">→</span></Link>
                <div className="mockup-trust-row" aria-label="Условия старта"><span>Быстрое подключение</span><span>Полный доступ</span><span>Без карты</span></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
