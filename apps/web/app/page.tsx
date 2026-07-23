import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { HeroProductFlowCanvas } from "../components/public-site/HeroProductFlowCanvas";
import { MarketingGlyph } from "../components/public-site/MarketingGlyph";
import { PublicFaqAccordion } from "../components/public-site/PublicFaqAccordion";
import { PricingPackageCard } from "../components/public-site/PricingPackageCard";
import { PublicShell } from "../components/public-site/PublicShell";
import { PublicTrialCta } from "../components/public-site/PublicTrialCta";
import { ReviewResolutionWorkspace } from "../components/public-site/ReviewResolutionWorkspace";
import { JsonLd } from "../components/seo/JsonLd";
import { createPageMetadata } from "../lib/seo";
import { publicPricingPlans, trialOffer } from "../lib/public-pricing";
import { siteConfig } from "../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Автоматические ИИ-ответы на отзывы, вопросы и чаты маркетплейсов",
  description:
    "MP Reply автоматически готовит и публикует ИИ-ответы на отзывы, вопросы и чаты маркетплейсов по карточке товара, базе знаний и правилам продавца. 7 дней и 400 ответов бесплатно.",
  path: "/",
});

const channels = [
  {
    icon: "reviews" as const,
    title: "Ответы на отзывы",
    description:
      "Система разбирает оценку, текст отзыва, товар и тон бренда, формирует персональный ответ и публикует его автоматически по правилам продавца.",
  },
  {
    icon: "questions" as const,
    title: "Ответы на вопросы о товаре",
    description:
      "Система сверяет вопрос с характеристиками, описанием, инструкциями и базой знаний, чтобы дать точный ответ по размеру, совместимости, комплектации или условиям использования.",
  },
  {
    icon: "chats" as const,
    title: "Чаты с покупателями",
    description:
      "Диалог ведётся с учётом предыдущих сообщений: система сохраняет контекст и публикует ответ автоматически, если выбранный продавцом сценарий это разрешает.",
  },
] as const;

const workflowSteps = [
  {
    icon: "flow" as const,
    title: "Принимает обращение",
    text: "Новый отзыв, вопрос или чат поступает из подключённого маркетплейса в единый рабочий поток.",
  },
  {
    icon: "questions" as const,
    title: "Понимает запрос",
    text: "Система определяет намерение покупателя, тональность, риск и тип ответа для автоматической обработки.",
  },
  {
    icon: "context" as const,
    title: "Проверяет данные",
    text: "Система использует карточку товара, базу знаний, правила продавца и историю переписки.",
  },
  {
    icon: "settings" as const,
    title: "Выбирает действие",
    text: "Готовый ответ публикуется автоматически; ручное согласование включается только для сценариев, которые продавец отметил в настройках.",
  },
] as const;

const controls = [
  {
    icon: "settings" as const,
    title: "Правила автопубликации",
    description:
      "Задайте сценарии автоматической публикации; согласование включается отдельно только там, где оно нужно команде.",
  },
  {
    icon: "context" as const,
    title: "Данные и ограничения бренда",
    description:
      "Укажите тон общения, стоп-темы, допустимые обещания, источники знаний и правила для категорий товаров.",
  },
  {
    icon: "flow" as const,
    title: "Передача сложных случаев",
    description:
      "Для нестандартных сценариев можно заранее выбрать действие: автоматическая публикация, сохранение ответа или согласование в кабинете.",
  },
  {
    icon: "history" as const,
    title: "Журнал решений",
    description:
      "В карточке видно исходное обращение, проверенный контекст, подготовленный ответ и итоговое действие.",
  },
] as const;

const intelligenceRoles = [
  {
    logo: "/brand/llm/openai.svg",
    name: "GPT-5.5",
    provider: "Основная генерация",
    role: "Формирует персональный ответ по отзыву, вопросу или сообщению, учитывая карточку товара, историю диалога, базу знаний и правила бренда.",
    benefit: "Сильная работа с русским текстом и большим контекстом.",
  },
  {
    logo: "/brand/llm/claude.svg",
    name: "Claude Sonnet 5",
    provider: "Проверка требований",
    role: "Проверяет тон, длину, стоп-темы, допустимые обещания и соответствие инструкциям продавца до публикации.",
    benefit: "Дополнительный контроль сложных и рискованных формулировок.",
  },
  {
    logo: "/brand/llm/gemini.svg",
    name: "Gemini 3.5 Flash",
    provider: "Быстрая обработка",
    role: "Обрабатывает короткие отзывы, типовые вопросы и массовые очереди с минимальной задержкой.",
    benefit: "Высокая скорость для повторяемых сценариев и пиковых нагрузок.",
  },
  {
    logo: "/brand/llm/deepseek.svg",
    name: "DeepSeek V4 Pro",
    provider: "Резервная проверка",
    role: "Даёт независимую вторую оценку сложным или неоднозначным обращениям, когда одной проверки недостаточно.",
    benefit: "Резервный маршрут для сложных случаев без остановки основного потока.",
  },
] as const;


const faq = [
  {
    question: "Что входит в бесплатный тест?",
    answer:
      `Бесплатный тест длится ${trialOffer.durationDays} дней и включает ${trialOffer.answerLimit} ответов для двух маркетплейсов. Можно проверить автоматические ответы на отзывы, вопросы и чаты и настроить, где публиковать сразу, а где включать согласование.`,
  },
  {
    question: "Можно ли публиковать ответы автоматически?",
    answer:
      "Да. Для каждого сценария задаются правила автопубликации: тип обращения, категория товара, допустимые темы, тон и ограничения бренда. Согласование продавец включает отдельно в личном кабинете.",
  },
  {
    question: "Какие данные используются при подготовке ответа?",
    answer:
      "Сервис может учитывать карточку товара, характеристики, описание, инструкции, FAQ, базу знаний продавца, историю обращения и заданные правила бренда. Если данных не хватает, поведение задаётся настройками продавца: подготовить аккуратный ответ, сохранить его или отправить на согласование.",
  },
  {
    question: "Подходит ли сервис для негативных отзывов и претензий?",
    answer:
      "Да. Сервис определяет проблему и уровень риска, готовит спокойный ответ и выполняет выбранный сценарий: опубликовать автоматически, запросить данные, объяснить совместимость или отправить на согласование по настройке продавца.",
  },
  {
    question: "Чем сервис отличается от шаблонов и ручной работы с ChatGPT?",
    answer:
      "Шаблон не понимает ситуацию, а ручная работа требует копировать обращение и данные товара. Сервис получает обращение из рабочего потока, подтягивает доступный контекст, применяет правила продавца, сохраняет решение в журнале и контролирует публикацию.",
  },
  {
    question: "Что происходит после окончания бесплатного теста?",
    answer:
      "Автопубликация останавливается, а настройки и история остаются в аккаунте. Можно купить подходящий пакет ответов и продолжить работу без повторного подключения и настройки сценариев.",
  },
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
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "RUB",
        description: `${trialOffer.durationDays} дней и ${trialOffer.answerLimit} ответов бесплатно`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  ];

  return (
    <PublicShell>
      <JsonLd data={jsonLd} />

      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="public-container home-hero-layout">
          <div className="home-hero-copy">
            <p className="public-eyebrow">ИИ для маркетплейсов</p>
            <h1 id="home-hero-title">
              <span className="home-hero-title-line" data-hero-line>Автоответы для</span>
              <span className="home-hero-title-line" data-hero-line>отзывов, вопросов</span>
              <span className="home-hero-title-line" data-hero-line>и чатов</span>
            </h1>
            <p className="home-hero-lead">
              MP Reply анализирует обращение покупателя, сверяет его с карточкой товара, базой знаний и правилами продавца, готовит точный ответ и публикует его автоматически в разрешённых сценариях.
            </p>
            <div className="home-hero-actions">
              <PublicTrialCta className="button button-primary" source="hero">
                Начать бесплатный тест
              </PublicTrialCta>
              <Link className="button button-secondary" href="#how-it-works">
                Посмотреть процесс
              </Link>
            </div>
            <p className="home-hero-trial-note">
              {trialOffer.answerLimit} ответов · до 2 маркетплейсов · бесплатно
            </p>
          </div>

          <HeroProductFlowCanvas />
        </div>
      </section>

      <section className="home-section home-outcomes" id="product" aria-labelledby="home-outcomes-title">
        <div className="public-container">
          <div className="home-section-heading home-section-heading-centered">
            <p className="public-eyebrow">Три канала общения</p>
            <h2 id="home-outcomes-title">Отзывы, вопросы и чаты — в одном автоматическом потоке</h2>
            <p>
              Система автоматически обрабатывает отзывы, вопросы о товаре и сообщения в чатах, применяя отдельные правила ответа и публикации для каждого канала.
            </p>
          </div>
          <div className="home-outcome-grid">
            {channels.map((item) => (
              <article className="home-outcome-card" key={item.title}>
                <MarketingGlyph variant={item.icon} />
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-example home-review-resolution" aria-labelledby="home-example-title">
        <div className="public-container">
          <div className="home-review-resolution-heading">
            <h2 id="home-example-title">Точный ответ и действие по правилам продавца</h2>
            <p>
              В рабочем окне видно обращение, проверенный контекст, готовый ответ и итоговое действие: автопубликация, сохранение или согласование по настройке продавца.
            </p>
          </div>

          <ReviewResolutionWorkspace />
        </div>
      </section>

      <section className="home-section home-marketplaces" id="how-it-works" aria-labelledby="home-marketplaces-title">
        <div className="public-container">
          <div className="home-section-heading home-section-heading-centered">
            <p className="public-eyebrow">Как это работает</p>
            <h2 id="home-marketplaces-title">От обращения покупателя до автопубликации — четыре шага</h2>
            <p>
              Сервис принимает обращение, проверяет контекст товара, готовит ответ и публикует его автоматически там, где это разрешено правилами продавца.
            </p>
          </div>

          <div className="home-workflow-v73" role="list" aria-label="Этапы обработки обращения">
            {workflowSteps.map((step) => (
              <div className="home-workflow-step-v73" role="listitem" key={step.title}>
                <MarketingGlyph variant={step.icon} />
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="home-platform-strip-v73" role="region" aria-label="Поддерживаемые маркетплейсы">
            <strong>Один процесс для нескольких площадок</strong>
            <div role="list">
              <span className="home-marketplace-source home-marketplace-source-wb" role="listitem">WB</span>
              <span className="home-marketplace-source home-marketplace-source-ozon" role="listitem">OZ</span>
              <span className="home-marketplace-source home-marketplace-source-ym" role="listitem">ЯМ</span>
              <span className="home-marketplace-source home-marketplace-source-avito" role="listitem">AV</span>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-capabilities" aria-labelledby="home-capabilities-title">
        <div className="public-container">
          <div className="home-section-heading home-section-heading-centered">
            <p className="public-eyebrow">Автоматизация с контролем</p>
            <h2 id="home-capabilities-title">Автопубликация работает по правилам продавца</h2>
            <p>
              Настройки определяют тон бренда, стоп‑темы, категории риска и сценарии, где ответ публикуется сразу или уходит на согласование.
            </p>
          </div>
          <div className="home-capability-grid">
            {controls.map((item) => (
              <article className="home-capability-card" key={item.title}>
                <MarketingGlyph variant={item.icon} />
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-llm" id="models" aria-labelledby="home-llm-title">
        <div className="public-container">
          <div className="home-section-heading home-section-heading-centered">
            <p className="public-eyebrow">Маршрутизация ИИ</p>
            <h2 id="home-llm-title">ИИ-маршрутизация для точных автоответов</h2>
            <p>
              Система распределяет задачи между генерацией, проверкой инструкций, быстрой обработкой и резервным контролем вместо слепой отправки одного промпта.
            </p>
          </div>

          <div className="home-llm-asymmetric-grid-v76" role="list" aria-label="Роли ИИ-моделей">
            {intelligenceRoles.map((model, index) => (
              <div
                className={`home-llm-card home-llm-card-v75 home-llm-card-v76 home-llm-card-v76-${index + 1}`}
                role="listitem"
                key={model.name}
              >
                <span className="home-llm-logo" aria-hidden="true">
                  <Image src={model.logo} alt="" width={48} height={48} />
                </span>
                <div className="home-llm-card-heading">
                  <h3>{model.name}</h3>
                  <span>{model.provider}</span>
                </div>
                <p>{model.role}</p>
                <p className="home-llm-benefit-v75">{model.benefit}</p>
              </div>
            ))}
          </div>
          <p className="home-llm-footnote-v78">
            Состав моделей может обновляться. Правила публикации, журнал решений и контроль качества сохраняются независимо от выбранного провайдера.
          </p>
        </div>
      </section>

      <section className="home-section home-pricing-v73" id="pricing" aria-labelledby="home-pricing-title">
        <div className="public-container">
          <div className="home-section-heading home-section-heading-centered">
            <p className="public-eyebrow">Тарифы</p>
            <h2 id="home-pricing-title">Пакеты автоответов без подписки и срока сгорания</h2>
            <p>
              Баланс списывается только за опубликованный или отправленный ответ. Черновики, проверка данных, правки и повторная генерация не расходуют пакет.
            </p>
          </div>

          <article className="home-trial-banner-v73">
            <div>
              <p className="public-eyebrow">{trialOffer.title}</p>
              <h3>{trialOffer.answerLimit} ответов для полноценной проверки</h3>
              <p>{trialOffer.description}</p>
            </div>
            <PublicTrialCta className="button button-primary home-trial-cta-v74" source="home-pricing-trial">
              Начать тест на 7 дней
            </PublicTrialCta>
          </article>

          <div className="pricing-pack-grid">
            {publicPricingPlans.map((plan) => (
              <PricingPackageCard key={plan.key} plan={plan} />
            ))}
          </div>

        </div>
      </section>

      <section className="home-section home-faq" aria-labelledby="home-faq-title">
        <div className="public-container home-faq-layout">
          <div className="home-section-heading home-section-heading-left">
            <p className="public-eyebrow">Вопросы и ответы</p>
            <h2 id="home-faq-title">Что важно знать об автоматических ответах</h2>
            <p>
              Как работает автопубликация, какие данные используются, что происходит с негативом и как расходуется пакет ответов.
            </p>
          </div>
          <PublicFaqAccordion items={faq} />
        </div>
      </section>

      <section className="home-section home-final-cta" aria-labelledby="home-final-cta-title">
        <div className="public-container">
          <div className="home-final-cta-card">
            <div>
              <p className="public-eyebrow">Проверка на ваших данных</p>
              <h2 id="home-final-cta-title">Запустите автоответы на реальных обращениях</h2>
              <p>
                Подключите до двух маркетплейсов, обработайте {trialOffer.answerLimit} обращений бесплатно и проверьте автоматическую публикацию ответов на отзывах, вопросах и чатах.
              </p>
            </div>
            <div className="home-final-cta-actions">
              <PublicTrialCta className="button home-final-cta-primary" source="footer-cta">
                Начать тест на 7 дней
              </PublicTrialCta>
              <Link className="button home-final-cta-secondary" href="/contacts">Обсудить подключение</Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
