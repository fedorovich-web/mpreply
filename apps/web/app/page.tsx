import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { HomeWorkspaceTabs } from "../components/public-site/HomeWorkspaceTabs";
import { PublicShell } from "../components/public-site/PublicShell";
import { JsonLd } from "../components/seo/JsonLd";
import { createPageMetadata } from "../lib/seo";
import { marketplaces, siteConfig } from "../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Автоответы на отзывы, вопросы и сообщения покупателей",
  description:
    "MPReply собирает отзывы, вопросы и сообщения покупателей с Wildberries, Ozon, Яндекс Маркета и Авито в одном окне, готовит ответы с помощью ИИ и автоматизирует отправку.",
  path: "/",
});

const aiModels = [
  {
    name: "GPT-5.6",
    provider: "OpenAI",
    mark: "◎",
    description: "Глубокое понимание контекста и подготовка ответов.",
  },
  {
    name: "Claude Sonnet 5",
    provider: "Anthropic",
    mark: "✺",
    description: "Анализ контекста и аккуратные формулировки.",
  },
  {
    name: "Gemini 3.8",
    provider: "Google",
    mark: "✦",
    description: "Точные ответы с учётом товарного контекста.",
  },
  {
    name: "DeepSeek V4.1 Flash",
    provider: "DeepSeek",
    mark: "◒",
    description: "Быстрая обработка русскоязычных обращений.",
  },
] as const;

const processSteps = [
  {
    number: "1",
    icon: "↗",
    title: "Подключите маркетплейсы",
    text: "Добавьте кабинеты Wildberries, Ozon, Яндекс Маркета и Авито.",
  },
  {
    number: "2",
    icon: "▣",
    title: "Получайте обращения",
    text: "Отзывы, вопросы и сообщения собираются в общей очереди.",
  },
  {
    number: "3",
    icon: "✦",
    title: "ИИ готовит ответы",
    text: "Ответ формируется с учётом контекста товара и правил команды.",
  },
  {
    number: "4",
    icon: "➤",
    title: "Отправляйте",
    text: "Автоматически или после проверки сотрудником — по вашим правилам.",
  },
] as const;

const resultFacts = [
  { icon: "◷", value: "4", label: "маркетплейса в одном процессе" },
  { icon: "▤", value: "3", label: "типа обращений в общей очереди" },
  { icon: "ϟ", value: "2", label: "режима отправки ответов" },
  { icon: "◎", value: "1", label: "рабочее окно для команды" },
] as const;

export default function HomePage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteConfig.name,
      url: siteConfig.origin,
      description: siteConfig.description,
      inLanguage: "ru-RU",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: siteConfig.name,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: siteConfig.description,
      url: siteConfig.origin,
    },
  ];

  return (
    <PublicShell>
      <JsonLd data={jsonLd} />

      <section className="homepage-hero homepage-approved-hero">
        <div className="public-container homepage-hero-grid">
          <div className="homepage-hero-copy">
            <p className="homepage-kicker homepage-pill-kicker">ИИ для продавцов на маркетплейсах</p>
            <h1>
              Автоответы на отзывы, вопросы и сообщения <span>покупателей</span>
            </h1>
            <p className="homepage-hero-lead">
              Собирайте все обращения с Wildberries, Ozon, Яндекс Маркета и Авито в одном окне. ИИ готовит ответы с учётом товара и стиля вашего бренда — автоматически или после проверки.
            </p>
            <div className="homepage-hero-actions">
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                Создать аккаунт
              </Link>
              <Link className="button button-secondary homepage-demo-button" href="/demo">
                <span aria-hidden="true">▶</span>
                Посмотреть демо
              </Link>
            </div>
            <div className="homepage-hero-benefits" role="group" aria-label="Основные преимущества">
              <span>✓ Быстрое подключение</span>
              <span>✓ Автоматически или после проверки</span>
              <span>✓ Единое рабочее пространство</span>
            </div>
          </div>

          <div className="homepage-hero-art">
            <Image
              alt="Интерфейс MPReply с отзывами, вопросами, сообщениями покупателей и ответом с помощью ИИ"
              height={450}
              priority
              sizes="(max-width: 1100px) 100vw, 48vw"
              src="/images/mpreply-hero-ui.webp"
              width={600}
            />
          </div>
        </div>
      </section>

      <section className="homepage-marketplaces homepage-approved-marketplaces" aria-labelledby="homepage-marketplaces-title">
        <div className="public-container homepage-marketplaces-inner">
          <div className="homepage-marketplaces-copy">
            <span>Поддерживаем ведущие площадки</span>
            <h2 id="homepage-marketplaces-title">Маркетплейсы</h2>
          </div>
          <div className="homepage-marketplace-list">
            {marketplaces.map((marketplace) => (
              <Link key={marketplace.key} className="homepage-marketplace-link" href={marketplace.path}>
                <span className={`homepage-marketplace-logo homepage-marketplace-logo-${marketplace.key}`} aria-hidden="true">
                  {marketplace.shortName.slice(0, 2)}
                </span>
                <span>
                  <strong>{marketplace.name}</strong>
                  <small>Интеграция готова</small>
                </span>
              </Link>
            ))}
          </div>
          <div className="homepage-marketplace-facts" role="group" aria-label="Факты о продукте">
            <span><strong>4</strong><small>маркетплейса</small></span>
            <span><strong>1</strong><small>единое окно</small></span>
            <span><strong>3</strong><small>типа обращений</small></span>
          </div>
        </div>
      </section>

      <section className="public-section homepage-workspace-section" id="product">
        <div className="public-container homepage-feature-layout">
          <div className="homepage-section-heading homepage-section-heading-left">
            <p className="homepage-kicker">Все обращения в одном окне</p>
            <h2>Отзывы, вопросы и сообщения — в едином пространстве</h2>
            <p>
              Переключайтесь между типами обращений, просматривайте контекст, используйте ИИ и отправляйте ответы без лишних переходов между кабинетами.
            </p>
            <Link className="button button-primary homepage-inline-cta" href="/demo">
              Посмотреть интерфейс →
            </Link>
          </div>
          <HomeWorkspaceTabs />
        </div>
      </section>

      <section className="public-section homepage-models-section">
        <div className="public-container homepage-models-layout">
          <div className="homepage-section-heading homepage-section-heading-left">
            <p className="homepage-kicker">Сила современных ИИ-моделей</p>
            <h2>Используем лучшие нейросети для точных и естественных ответов</h2>
            <p>
              Подбирайте модель под задачу и сочетайте её возможности с контекстом товара, стилем бренда и правилами обработки обращений.
            </p>
          </div>
          <div className="homepage-model-grid" role="group" aria-label="Поддерживаемые ИИ-модели">
            {aiModels.map((model) => (
              <article className="homepage-model-card" key={model.name}>
                <span className="homepage-model-mark" aria-hidden="true">{model.mark}</span>
                <strong>{model.name}</strong>
                <small>{model.provider}</small>
                <p>{model.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section homepage-process homepage-approved-process" id="how-it-works">
        <div className="public-container">
          <div className="homepage-section-heading homepage-section-heading-left homepage-process-heading">
            <p className="homepage-kicker">Простой и понятный процесс</p>
            <h2>Как это работает</h2>
            <p>Подключите маркетплейсы и начните работать с обращениями в одном процессе.</p>
          </div>

          <ol className="homepage-horizontal-process">
            {processSteps.map((step, index) => (
              <li className="homepage-horizontal-step" key={step.number}>
                <div className="homepage-horizontal-step-topline">
                  <span className="homepage-process-number-circle">{step.number}</span>
                  <span className="homepage-process-icon" aria-hidden="true">{step.icon}</span>
                  {index < processSteps.length - 1 ? <span className="homepage-process-connector" aria-hidden="true" /> : null}
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="public-section homepage-results-section">
        <div className="public-container homepage-results-layout">
          <div className="homepage-section-heading homepage-section-heading-left homepage-results-copy">
            <p className="homepage-kicker">Реальные возможности продукта</p>
            <h2>Меньше рутины. Больше времени на развитие бизнеса.</h2>
            <p>
              Автоматизируйте повторяющиеся обращения и оставляйте команде те случаи, где действительно нужен человек.
            </p>
          </div>
          <div className="homepage-result-grid">
            {resultFacts.map((fact) => (
              <article className="homepage-result-card" key={fact.label}>
                <span aria-hidden="true">{fact.icon}</span>
                <strong>{fact.value}</strong>
                <p>{fact.label}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section homepage-final-cta homepage-approved-final-cta">
        <div className="public-container homepage-final-cta-card">
          <div className="homepage-wave homepage-wave-cta" aria-hidden="true" />
          <div className="homepage-final-cta-copy">
            <p className="homepage-kicker">Начните сегодня</p>
            <h2>Автоматизируйте коммуникацию с покупателями</h2>
            <p>Подключите маркетплейсы и соберите отзывы, вопросы и сообщения в одном рабочем пространстве.</p>
            <div className="homepage-final-cta-actions">
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">Создать аккаунт →</Link>
              <Link className="button button-secondary homepage-demo-button" href="/demo"><span aria-hidden="true">▶</span> Посмотреть демо</Link>
            </div>
          </div>
          <div className="homepage-cta-art" aria-hidden="true">
            <Image
              alt=""
              height={450}
              sizes="(max-width: 760px) 100vw, 36vw"
              src="/images/mpreply-cta-ui.webp"
              width={600}
            />
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
