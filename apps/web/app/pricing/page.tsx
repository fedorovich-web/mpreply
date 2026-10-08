import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PublicIcon } from "../../components/public-site/PublicIcon";
import { PricingCalculators } from "../../components/public-site/PricingCalculators";
import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Тарифы MPReply — от 1 290 ₽ в месяц",
  description:
    "Тарифы MPReply: Старт, Команда, Бизнес и Корпоративный. 14 дней бесплатно и 350 ИИ-ответов в пробном периоде. Корпоративный тариф — по запросу.",
  path: "/pricing",
  localized: true,
});

const plans = [
  {
    name: "Старт",
    price: "1 290 ₽",
    description: "Для небольших магазинов и индивидуальных продавцов",
    popular: false,
    features: [
      "300 ИИ-ответов в месяц",
      "Подключение до 2 маркетплейсов",
      "До 2 пользователей",
      "ИИ-автоответы",
      "Базовые автоответы",
      "Аналитика обращений",
      "История за 3 месяца",
    ],
  },
  {
    name: "Команда",
    price: "3 490 ₽",
    description: "Для растущих брендов и команд поддержки",
    popular: true,
    features: [
      "800 ИИ-ответов в месяц",
      "Подключение до 5 маркетплейсов",
      "До 10 пользователей",
      "ИИ-автоответы",
      "Расширенные автоответы и сценарии",
      "Продвинутая аналитика",
      "История за 12 месяцев",
      "Роли и права доступа",
    ],
  },
  {
    name: "Бизнес",
    price: "6 990 ₽",
    description: "Для крупных магазинов и федеральных брендов",
    popular: false,
    features: [
      "1 600 ИИ-ответов в месяц",
      "Подключение любых маркетплейсов",
      "Неограниченное число пользователей",
      "ИИ-ответы с учётом контекста",
      "Правила автоматической обработки",
      "Проверка ответов перед отправкой",
      "Аналитика обращений",
      "Роли и права доступа",
    ],
  },
  {
    name: "Корпоративный",
    price: "По запросу",
    description: "Для команд с большим потоком обращений",
    popular: false,
    features: [
      "Объём ИИ-ответов под ваши задачи",
      "Стоимость по согласованию",
      "Wildberries, Ozon, Яндекс Маркет и Авито",
      "Единая очередь обращений",
      "Правила обработки и проверка ответов",
      "Заявка через форму на сайте",
    ],
  },
] as const;

const comparison = [
  ["ИИ-ответы в месяц", "300", "800", "1 600"],
  ["Неиспользованные ИИ-ответы", "Сохраняются", "Сохраняются", "Сохраняются"],
  ["Маркетплейсы", "До 2", "До 5", "Любое количество"],
  ["Пользователи", "До 2", "До 10", "Неограниченно"],
  ["ИИ-автоответы", "✓", "✓", "✓"],
  ["Автоответы и сценарии", "Базовые", "Расширенные", "Персональные"],
  ["Аналитика", "Базовая", "Продвинутая", "Расширенная"],
  ["История обращений", "3 месяца", "12 месяцев", "Без ограничений"],
  ["Приоритетная поддержка", "Стандартная", "Приоритетная", "Выделенный менеджер"],
] as const;

const faq = [
  [
    "Сгорают ли неиспользованные ИИ-ответы?",
    "Оплаченные ответы сохраняются без срока сгорания. Использовать их можно при действующем оплаченном тарифе. Пробные 350 ответов сгорают через 14 дней. Каждый новый ИИ-вариант расходует один ответ.",
  ],
  ["Как происходит оплата?", "Детали оплаты появятся после подключения платёжного провайдера на рабочем домене MPReply."],
  [
    "Можно ли добавить больше пользователей?",
    "Количество пользователей зависит от выбранного тарифа. Для большой команды свяжитесь с нами.",
  ],
  [
    "Могу ли я изменить тариф позже?",
    "Выбор тарифа можно изменить по мере роста команды и объёма обращений.",
  ],
  ["Есть ли скидки при годовой оплате?", "Да. При ежегодной оплате действует скидка 20%."],
  [
    "Что будет после окончания бесплатного периода?",
    "Неиспользованные пробные ответы сгорают через 14 дней. Для продолжения работы выберите подходящий тариф.",
  ],
  [
    "Помогаете ли вы с настройкой?",
    "Да. Для вопросов о подключении напишите в поддержку MPReply.",
  ],
  [
    "Поддерживаете ли вы все маркетплейсы?",
    "Сейчас MPReply работает с Wildberries, Ozon, Яндекс Маркетом и Авито.",
  ],
  [
    "Что входит в тариф «Бизнес»?",
    "Сравните возможности тарифов в таблице выше или свяжитесь с нами для обсуждения задач команды.",
  ],
] as const;

function renderComparisonValue(value: string) {
  return value === "✓" ? <span className="pricing-comparison-check">✓</span> : value;
}

const planIcons = ["send", "users", "chart", "shield-check"] as const;

const startBenefits = [
  ["clock", "14 дней бесплатно", "350 ИИ-ответов для проверки работы на ваших обращениях."],
  ["document", "Без банковской карты", "Для начала работы карта не требуется. Просто зарегистрируйтесь и подключите магазины."],
  ["lightning", "Быстрое подключение", "Настройте работу за несколько минут. Наши подсказки и шаблоны помогут на каждом шаге."],
] as const;

export default function PricingPage() {
  return (
    <PublicShell>
      <div className="mockup-page">
        <section className="pricing-mockup-hero">
          <div className="public-container">
            <div className="pricing-approved-hero-grid">
              <div className="pricing-approved-hero-copy">

                <h1>Выберите формат работы, который подходит вашей команде</h1>
                <p>
                  Начните с небольшого тарифа, а когда ваш бизнес вырастет — легко масштабируйтесь. Все возможности MPReply в одной системе.
                </p>
                <div className="mockup-trust-row" role="group" aria-label="Условия старта">
                  <span>14 дней бесплатно</span>
                  <span>Без карты</span>
                  <span>Быстрое подключение</span>
                </div>
              </div>

              <div className="pricing-approved-hero-scene supplied-hero-scene">
                <Image
                  alt="MPReply и четыре поддерживаемые площадки"
                  className="supplied-hero-image"
                  src="/images/approved/05-pricing-hero.avif"
                  width={1794}
                  height={877}
                  sizes="(max-width: 1100px) 100vw, 50vw"
                  priority
                  unoptimized
                />
              </div>
            </div>
          </div>
        </section>

        <section className="pricing-plans-section" aria-labelledby="pricing-plans-title">
          <div className="public-container">
            <div className="pricing-plans-heading">
              <h2 id="pricing-plans-title">Тарифы и цены</h2>
              <p>Выберите объём ИИ-ответов для вашей команды. Неиспользованные ответы сохраняются.</p>
            </div>
            <div className="pricing-card-grid">
              {plans.map((plan, index) => (
                <article className={`pricing-card${plan.popular ? " is-popular" : ""}`} key={plan.name}>
                  {plan.popular ? <span className="pricing-card-popular">Популярный выбор</span> : null}
                  <span className="pricing-plan-card-icon" aria-hidden="true">
                    <PublicIcon name={planIcons[index]} />
                  </span>
                  <h3>{plan.name}</h3>
                  <p>{plan.description}</p>
                  <div className="pricing-price">
                    <strong>{plan.price}</strong>
                    {index !== 3 ? <span>/ мес</span> : null}
                  </div>
                  <ul className="pricing-feature-list">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <Link className={`button ${index === 3 ? "button-secondary" : "button-primary"}`} href={index === 3 ? "/contacts#contact-form" : "/auth/register?intent=connect-marketplace"}>
                    {index === 3 ? "Обсудить тариф" : "Попробовать бесплатно"} <span aria-hidden="true">→</span>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <PricingCalculators />

        <section className="public-section">
          <div className="public-container">
            <div className="render-section-head">

              <h2>Что входит в каждый тариф</h2>
              <p>Все тарифы включают основные возможности MPReply. Отличаются лимитами и дополнительными функциями.</p>
            </div>
            <div className="pricing-comparison">
              <table>
                <thead>
                  <tr>
                    <th>Возможности</th>
                    <th>Старт</th>
                    <th>Команда</th>
                    <th>Бизнес</th>
                    <th>Корпоративный</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map(([feature, start, pro, business]) => (
                    <tr key={feature}>
                      <td>{feature}</td>
                      <td data-plan="Старт">{renderComparisonValue(start)}</td>
                      <td data-plan="Команда">{renderComparisonValue(pro)}</td>
                      <td data-plan="Бизнес">{renderComparisonValue(business)}</td>
                      <td data-plan="Корпоративный">По согласованию</td>
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

              <h2>Всё, чтобы вы могли спокойно начать</h2>
            </div>
            <div className="pricing-approved-start-grid">
              {startBenefits.map(([icon, title, text]) => (
                <div className="pricing-approved-start-card" key={title}>
                  <span className="mockup-icon-chip" aria-hidden="true"><PublicIcon name={icon} /></span>
                  <div><strong>{title}</strong><p>{text}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section pricing-approved-faq-section">
          <div className="public-container pricing-approved-faq-layout">
            <div className="render-section-head">
              <h2>Ответы на частые вопросы</h2>
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

      </div>
    </PublicShell>
  );
}
