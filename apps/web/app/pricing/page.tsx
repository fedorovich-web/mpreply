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

export default function PricingPage() {
  return (
    <PublicShell>
      <div className="mockup-page">
        <section className="pricing-mockup-hero">
          <div className="public-container">
            <p className="mockup-eyebrow">Тарифы</p>
            <h1>Простые тарифы для разных объёмов работы</h1>
            <p>
              Выберите план по объёму обращений, числу пользователей и количеству подключаемых площадок.
            </p>

            <div className="pricing-toggle-wrap">
              <div className="pricing-toggle" aria-label="Период оплаты">
                <span>Ежемесячно</span>
                <span>Ежегодно · -20%</span>
              </div>
              <div className="pricing-hero-note" aria-hidden="true">
                Меньше переключений
                <br />
                между кабинетами
                <span>↙</span>
              </div>
            </div>

            <div className="pricing-card-grid">
              {plans.map((plan) => (
                <article className={`pricing-card${plan.popular ? " is-popular" : ""}`} key={plan.name}>
                  <h2>{plan.name}</h2>
                  <p>{plan.description}</p>
                  <div className="pricing-price">
                    <strong>{plan.price}</strong>
                    <span>/ мес</span>
                  </div>
                  <Link
                    className={`button ${plan.popular ? "button-primary" : "button-secondary"}`}
                    href="/auth/register?intent=connect-marketplace"
                  >
                    Попробовать бесплатно
                  </Link>
                  <ul className="pricing-feature-list">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className="pricing-custom-strip">
              <span className="pricing-custom-icon" aria-hidden="true">
                <PublicIcon name="shield-check" />
              </span>
              <div>
                <strong>Нужно обсудить подключение?</strong>
                <span>
                  Если у вас несколько кабинетов, большая команда или нестандартный рабочий процесс — опишите задачу, чтобы обсудить подключение MPReply.
                </span>
              </div>
              <Link className="button button-secondary" href="/contacts">
                Обсудить подключение
              </Link>
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Интеграции</p>
              <h2>4 площадки в MPReply</h2>
              <p>Wildberries, Ozon, Яндекс Маркет и Авито представлены в едином продукте и общей модели работы с обращениями.</p>
            </div>
            <div className="pricing-market-row">
              {marketplaces.map((marketplace) => (
                <Link
                  className="pricing-market-chip"
                  href={marketplace.path}
                  key={marketplace.name}
                  aria-label={`Интеграция ${marketplace.name}`}
                >
                  <Image
                    className="pricing-market-compact"
                    src={marketplace.compactSrc}
                    width={64}
                    height={64}
                    alt=""
                    aria-hidden="true"
                    unoptimized
                  />
                  <strong className="pricing-market-name">{marketplace.name}</strong>
                </Link>
              ))}
            </div>
            <p className="pricing-market-note">
              Доступность конкретного подключения зависит от текущей версии сервиса; подробности — на странице интеграций.
            </p>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Сравнение</p>
              <h2>Сравните тарифы и выберите свой</h2>
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

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="pricing-faq-heading">
              <div className="render-section-head pricing-faq-head">
                <p className="mockup-eyebrow">Вопросы</p>
                <h2>Частые вопросы</h2>
              </div>
              <Link className="pricing-all-questions" href="/help">
                Все вопросы <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="pricing-faq">
              {faq.map(([question, answer]) => (
                <details key={question}>
                  <summary className="pricing-faq-summary">
                    <span>{question}</span>
                    <span className="pricing-faq-chevron" aria-hidden="true">⌄</span>
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section public-cta-section">
          <div className="public-container">
            <div className="pricing-final-cta">
              <div>
                <p className="mockup-eyebrow">Начните сегодня</p>
                <h2>Попробуйте MPReply бесплатно</h2>
                <p>Подключите доступные площадки, настройте рабочий процесс и оцените обработку обращений в одном пространстве.</p>
                <div className="mockup-actions">
                  <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                    Попробовать бесплатно
                  </Link>
                  <Link className="button button-secondary" href="/demo">
                    Посмотреть демо
                  </Link>
                </div>
                <div className="mockup-trust-row" aria-label="Условия старта">
                  <span>14 дней бесплатно</span>
                  <span>4 площадки в MPReply</span>
                  <span>Автоматически или после проверки</span>
                </div>
              </div>
              <div className="pricing-final-visual" aria-hidden="true">
                <div className="pricing-final-logo-cloud">
                  {marketplaces.slice(0, 3).map((marketplace) => (
                    <span className="pricing-final-logo-chip" key={marketplace.name}>
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
                <div className="pricing-final-review">
                  <strong>Отличный товар!</strong>
                  <span>★★★★★</span>
                </div>
                <div className="pricing-final-answer">
                  <p>Здравствуйте! Спасибо за отзыв! Будем рады видеть вас снова!</p>
                </div>
                <span className="pricing-final-sparkle">
                  <PublicIcon name="sparkles" />
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
