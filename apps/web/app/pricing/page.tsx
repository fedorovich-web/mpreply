import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PublicIcon } from "../../components/public-site/PublicIcon";
import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Тарифы MPReply — от 490 ₽ в месяц",
  description:
    "Тарифы MPReply для работы с отзывами, вопросами и сообщениями покупателей: Старт, Профессиональный и Бизнес.",
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
      "Базовые AI-ответы",
      "Шаблоны ответов",
      "Стандартная поддержка",
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
      "Расширенные AI-ответы",
      "Автоответы и правила",
      "Аналитика и отчёты",
      "Приоритетная поддержка",
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
      "Продвинутая аналитика",
      "Гибкие правила и автоответы",
      "API-доступ (по запросу)",
      "Персональный менеджер",
    ],
  },
] as const;

const comparison = [
  ["Сообщений в месяц", "до 500", "до 2 000", "до 10 000"],
  ["Пользователи", "1", "до 3", "неограниченно"],
  ["Маркетплейсы", "до 2", "до 4", "все 4"],
  ["AI-ответы", "Базовые", "Расширенные", "Продвинутые"],
  ["Автоответы", "—", "✓", "✓"],
  ["Аналитика и отчёты", "—", "✓", "✓"],
  ["Шаблоны ответов", "✓", "✓", "✓"],
  ["API-доступ", "—", "—", "✓"],
  ["Персональный менеджер", "—", "—", "✓"],
  ["Поддержка", "Стандартная", "Приоритетная", "Персональная"],
] as const;

const faq = [
  ["Можно ли попробовать бесплатно?", "Да. Доступен бесплатный период, чтобы проверить MPReply на своих обращениях."],
  ["Можно ли поменять тариф позже?", "Да. Вы сможете перейти на другой тариф по мере роста магазина и команды."],
  ["Какие маркетплейсы поддерживаются?", "MPReply поддерживает готовые интеграции с Wildberries, Ozon, Яндекс Маркетом и Авито."],
  ["Есть ли скидка при оплате за год?", "Да. При ежегодной оплате действует скидка 20%."],
  ["Как считается лимит сообщений?", "В лимит входят обработанные обращения покупателей за расчётный период."],
  ["Можно ли добавить больше пользователей?", "Да. На тарифе Бизнес число пользователей не ограничено."],
  ["Предоставляете ли вы закрывающие документы?", "Да. Для юридических лиц доступны необходимые закрывающие документы."],
  ["Есть ли возврат средств?", "Условия возврата зависят от периода оплаты и фактического использования сервиса."],
] as const;

const marketplaces = [
  { name: "Wildberries", src: "/images/marketplaces/wildberries.webp", width: 432, height: 188 },
  { name: "Ozon", src: "/images/marketplaces/ozon.webp", width: 436, height: 198 },
  { name: "Яндекс Маркет", src: "/images/marketplaces/yandex-market.webp", width: 554, height: 222 },
  { name: "Авито", src: "/images/marketplaces/avito.webp", width: 504, height: 212 },
] as const;

export default function PricingPage() {
  return (
    <PublicShell>
      <div className="mockup-page">
        <section className="pricing-mockup-hero">
          <div className="public-container">
            <p className="mockup-eyebrow">Тарифы</p>
            <h1>Простые и выгодные тарифы</h1>
            <p>Выберите подходящий план и начните экономить время на работе с отзывами и сообщениями уже сегодня.</p>

            <div className="pricing-toggle" aria-label="Период оплаты">
              <span>Ежемесячно</span>
              <span>Ежегодно · -20%</span>
            </div>

            <div className="pricing-card-grid">
              {plans.map((plan) => (
                <article className={`pricing-card${plan.popular ? " is-popular" : ""}`} key={plan.name}>
                  {plan.popular ? <span className="pricing-popular">Популярный</span> : null}
                  <h2>{plan.name}</h2>
                  <p>{plan.description}</p>
                  <div className="pricing-price"><strong>{plan.price}</strong><span>/ мес</span></div>
                  <Link className={`button ${plan.popular ? "button-primary" : "button-secondary"}`} href="/auth/register?intent=connect-marketplace">Начать бесплатно</Link>
                  <ul className="pricing-feature-list">{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
                </article>
              ))}
            </div>

            <div className="pricing-custom-strip">
              <div><strong>Нужен индивидуальный тариф?</strong><span>Если у вас особые требования или очень большие объёмы — свяжитесь с нами, и мы подготовим персональное предложение.</span></div>
              <Link className="button button-secondary" href="/contacts">Связаться</Link>
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="render-section-head"><p className="mockup-eyebrow">Интеграции</p><h2>Поддерживаем ключевые маркетплейсы</h2><p>Wildberries, Ozon, Яндекс Маркет и Авито уже готовы к подключению в одном рабочем окне.</p></div>
            <div className="pricing-market-row">{marketplaces.map((marketplace) => <div className="pricing-market-chip" key={marketplace.name}><Image className="marketplace-detail-logo-small" src={marketplace.src} width={marketplace.width} height={marketplace.height} alt={marketplace.name} unoptimized /><strong>{marketplace.name}</strong></div>)}</div>
            <p className="pricing-market-note">Сейчас доступны четыре готовые интеграции: Wildberries, Ozon, Яндекс Маркет и Авито.</p>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="render-section-head"><p className="mockup-eyebrow">Сравнение</p><h2>Сравните тарифы и выберите свой</h2></div>
            <div className="pricing-comparison"><table><thead><tr><th>Возможности</th><th>Старт</th><th>Профессиональный</th><th>Бизнес</th></tr></thead><tbody>{comparison.map(([feature, start, pro, business]) => <tr key={feature}><td>{feature}</td><td>{start}</td><td>{pro}</td><td>{business}</td></tr>)}</tbody></table></div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="render-section-head pricing-faq-head"><p className="mockup-eyebrow">Вопросы</p><h2>Частые вопросы</h2></div>
            <div className="pricing-faq">{faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
          </div>
        </section>

        <section className="public-section public-cta-section">
          <div className="public-container">
            <div className="pricing-final-cta">
              <div>
                <p className="mockup-eyebrow">Начните сегодня</p>
                <h2>Попробуйте MPReply бесплатно</h2>
                <p>Подключите маркетплейсы, настройте ответы и оцените, как это экономит ваше время.</p>
                <div className="mockup-actions">
                  <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">Попробовать бесплатно</Link>
                  <Link className="button button-secondary" href="/demo">Посмотреть демо</Link>
                </div>
                <div className="mockup-trust-row" aria-label="Условия старта"><span>14 дней бесплатно</span><span>Без карты</span><span>Быстрый старт</span></div>
              </div>
              <div className="pricing-final-visual" aria-hidden="true">
                <div className="pricing-final-logo-cloud">
                  {marketplaces.slice(0, 3).map((marketplace) => (
                    <span className="pricing-final-logo-chip" key={marketplace.name}>
                      <Image src={marketplace.src} width={marketplace.width} height={marketplace.height} alt="" unoptimized />
                    </span>
                  ))}
                </div>
                <div className="pricing-final-bubble">
                  <strong>Отличный товар!</strong>
                  <span>★★★★★</span>
                  <p>Здравствуйте! Спасибо за отзыв! Будем рады видеть вас снова!</p>
                </div>
                <span className="pricing-final-sparkle"><PublicIcon name="sparkles" /></span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
