import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PublicIcon } from "../../components/public-site/PublicIcon";
import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Тарифы MPReply — от 490 ₽ в месяц",
  description:
    "Тарифы MPReply: Старт, Профессиональный и Бизнес. 14 дней бесплатного доступа и скидка 20% при ежегодной оплате.",
  path: "/pricing",
  localized: true,
});

const plans = [
  {
    name: "Старт",
    price: "490 ₽",
    description: "Для небольших магазинов и первого опыта",
    popular: false,
    features: [
      "До 500 сообщений в месяц",
      "1 пользователь",
      "Подключение до 2 маркетплейсов",
      "ИИ-черновики с контекстом",
      "Контроль перед отправкой",
      "Автоматизация по правилам",
      "Аналитика",
    ],
  },
  {
    name: "Профессиональный",
    price: "990 ₽",
    description: "Для активно растущих продавцов",
    popular: true,
    features: [
      "До 2 000 сообщений в месяц",
      "До 3 пользователей",
      "Подключение до 4 маркетплейсов",
      "ИИ-черновики с контекстом",
      "Контроль перед отправкой",
      "Автоматизация по правилам",
      "Аналитика",
    ],
  },
  {
    name: "Бизнес",
    price: "1 990 ₽",
    description: "Для больших команд",
    popular: false,
    features: [
      "До 10 000 сообщений в месяц",
      "Неограниченное число пользователей",
      "Подключение всех 4 маркетплейсов",
      "ИИ-черновики с контекстом",
      "Контроль перед отправкой",
      "Автоматизация по правилам",
      "Аналитика",
    ],
  },
] as const;

const comparison = [
  ["Сообщений в месяц", "до 500", "до 2 000", "до 10 000"],
  ["Пользователи", "1", "до 3", "неограниченно"],
  ["Маркетплейсы", "до 2", "до 4", "все 4"],
  ["ИИ-черновики с контекстом", "✓", "✓", "✓"],
  ["Контроль перед отправкой", "✓", "✓", "✓"],
  ["Автоматизация по правилам", "✓", "✓", "✓"],
  ["Аналитика", "✓", "✓", "✓"],
] as const;

const faq = [
  ["Можно ли попробовать бесплатно?", "Да. Для MPReply предусмотрен бесплатный период 14 дней."],
  [
    "Чем отличаются тарифы?",
    "Основные различия текущей публичной тарифной матрицы — лимиты сообщений, число пользователей и количество подключаемых маркетплейсов. Сравнение приведено выше.",
  ],
  [
    "Какие маркетплейсы представлены в MPReply?",
    "MPReply предусматривает работу с Wildberries, Ozon, Яндекс Маркетом и Авито. Доступность конкретного подключения определяется текущей версией сервиса.",
  ],
  ["Есть ли скидка при оплате за год?", "Да. При ежегодной оплате действует скидка 20%."],
  [
    "Какие лимиты сообщений у тарифов?",
    "Старт — до 500 сообщений в месяц, Профессиональный — до 2 000, Бизнес — до 10 000.",
  ],
  [
    "Сколько пользователей можно добавить?",
    "Старт — 1 пользователь, Профессиональный — до 3 пользователей, Бизнес — без ограничения по числу пользователей в текущей публичной тарифной матрице.",
  ],
  [
    "Что происходит после создания аккаунта?",
    "Следующий шаг — подключить нужную площадку и перейти к работе с обращениями в одном пространстве.",
  ],
  [
    "Можно ли сначала посмотреть продукт?",
    "Да. На странице демо показан демонстрационный путь обращения: от получения и подготовки ИИ-черновика до проверки или автоматической обработки.",
  ],
] as const;

const marketplaces = [
  {
    name: "Wildberries",
    path: "/marketplaces/wildberries",
    compactSrc: "/images/marketplaces/wildberries-compact.webp",
  },
  {
    name: "Ozon",
    path: "/marketplaces/ozon",
    compactSrc: "/images/marketplaces/ozon-compact.webp",
  },
  {
    name: "Яндекс Маркет",
    path: "/marketplaces/yandex-market",
    compactSrc: "/images/marketplaces/yandex-market-compact.webp",
  },
  {
    name: "Авито",
    path: "/marketplaces/avito",
    compactSrc: "/images/marketplaces/avito-compact.webp",
  },
] as const;

function renderComparisonValue(value: string) {
  return value === "✓" ? <span className="pricing-comparison-check">✓</span> : value;
}

const planIcons = ["send", "users", "chart"] as const;

const startBenefits = [
  ["clock", "14 дней бесплатно", "Оцените рабочий процесс MPReply до перехода на платный тариф."],
  ["link", "4 площадки в MPReply", "Wildberries, Ozon, Яндекс Маркет и Авито собраны вокруг одной модели работы с обращениями."],
  ["shield-check", "Контроль перед отправкой", "Оставляйте неоднозначные ответы на проверку, когда автоматическая отправка не подходит."],
] as const;

export default function PricingPage() {
  return (
    <PublicShell>
      <div className="mockup-page">
        <section className="pricing-mockup-hero">
          <div className="public-container">
            <div className="pricing-approved-hero-grid">
              <div className="pricing-approved-hero-copy">
                <p className="mockup-eyebrow">Тарифы MPReply</p>
                <h1>Простые тарифы для разных объёмов работы</h1>
                <p>
                  Выберите план по объёму обращений, числу пользователей и количеству подключаемых площадок.
                </p>
                <div className="mockup-trust-row" aria-label="Условия старта">
                  <span>14 дней бесплатно</span>
                  <span>Ежегодно · -20%</span>
                  <span>Контроль перед отправкой</span>
                </div>
              </div>

              <div className="pricing-approved-hero-scene" aria-hidden="true">
                <div className="pricing-approved-hero-blob" />
                <Image
                  className="pricing-approved-hero-mascot"
                  src="/images/mpreply-mascot.webp"
                  width={320}
                  height={320}
                  alt=""
                  priority
                />
                <div className="pricing-approved-market-card">
                  <strong>Один инструмент для всех площадок</strong>
                  <div>
                    {marketplaces.map((marketplace) => (
                      <span className="pricing-approved-market-logo" key={marketplace.name}>
                        <Image
                          className="pricing-market-compact"
                          src={marketplace.compactSrc}
                          width={64}
                          height={64}
                          alt=""
                          unoptimized
                        />
                      </span>
                    ))}
                  </div>
                </div>
                <span className="pricing-approved-note pricing-approved-note-top">Одна система для команды</span>
                <span className="pricing-approved-note pricing-approved-note-side">Меньше переключений</span>
              </div>
            </div>

            <div className="pricing-card-grid">
              {plans.map((plan, index) => (
                <article className={`pricing-card${plan.popular ? " is-popular" : ""}`} key={plan.name}>
                  {plan.popular ? <span className="pricing-card-popular">Популярный выбор</span> : null}
                  <span className="pricing-plan-card-icon" aria-hidden="true">
                    <PublicIcon name={planIcons[index]} />
                  </span>
                  <h2>{plan.name}</h2>
                  <p>{plan.description}</p>
                  <div className="pricing-price">
                    <strong>{plan.price}</strong>
                    <span>/ мес</span>
                  </div>
                  <ul className="pricing-feature-list">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <Link
                    className={`button ${plan.popular ? "button-primary" : "button-secondary"}`}
                    href="/auth/register?intent=connect-marketplace"
                  >
                    Попробовать бесплатно <span aria-hidden="true">→</span>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Сравнение тарифов</p>
              <h2>Сравните тарифы и выберите свой</h2>
              <p>Все планы используют один рабочий процесс MPReply и отличаются доступными лимитами.</p>
            </div>
            <div className="pricing-comparison">
              <table>
                <thead>
                  <tr>
                    <th>Возможности</th>
                    <th>Старт</th>
                    <th>Профессиональный</th>
                    <th>Бизнес</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map(([feature, start, pro, business]) => (
                    <tr key={feature}>
                      <td>{feature}</td>
                      <td>{renderComparisonValue(start)}</td>
                      <td>{renderComparisonValue(pro)}</td>
                      <td>{renderComparisonValue(business)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft pricing-approved-start-section">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Начните спокойно</p>
              <h2>Всё необходимое для начала работы</h2>
            </div>
            <div className="pricing-approved-start-grid">
              {startBenefits.map(([icon, title, text]) => (
                <article className="pricing-approved-start-card" key={title}>
                  <span className="mockup-icon-chip" aria-hidden="true"><PublicIcon name={icon} /></span>
                  <div><strong>{title}</strong><p>{text}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section pricing-approved-faq-section">
          <div className="public-container pricing-approved-faq-layout">
            <div className="pricing-approved-faq-copy">
              <p className="mockup-eyebrow">Часто задаваемые вопросы</p>
              <h2>Ответы на частые вопросы</h2>
              <Link className="pricing-all-questions" href="/help">
                Все вопросы <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="pricing-faq">
              {faq.map(([question, answer]) => (
                <details key={question}>
                  <summary className="pricing-faq-summary">
                    <span>{question}</span>
                    <span className="pricing-faq-chevron" aria-hidden="true">+</span>
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section public-cta-section">
          <div className="public-container">
            <div className="pricing-final-cta pricing-approved-final-cta">
              <span className="pricing-approved-final-icon" aria-hidden="true"><PublicIcon name="send" /></span>
              <div className="pricing-approved-final-copy">
                <h2>Начните использовать MPReply уже сегодня</h2>
                <p>14 дней бесплатно. Ответы автоматически или после проверки — в одном рабочем процессе.</p>
              </div>
              <div className="pricing-approved-final-actions">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Попробовать бесплатно <span aria-hidden="true">→</span>
                </Link>
                <Link className="text-link" href="/demo">Посмотреть демо →</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
