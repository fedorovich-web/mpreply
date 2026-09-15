import type { Metadata } from "next";
import Link from "next/link";

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
    description: "Для продавцов, которые начинают автоматизировать ответы.",
    popular: false,
    features: [
      "Единая очередь обращений",
      "AI-подготовка ответов",
      "Шаблоны ответов",
      "История действий",
      "Готовые интеграции маркетплейсов",
    ],
  },
  {
    name: "Профессиональный",
    price: "990 ₽",
    description: "Для активной работы с обращениями и автоматизацией.",
    popular: true,
    features: [
      "Всё из тарифа Старт",
      "Автоответы и сценарии",
      "Контроль качества",
      "Командная работа",
      "Расширенная аналитика",
    ],
  },
  {
    name: "Бизнес",
    price: "1 990 ₽",
    description: "Для команд с несколькими площадками и большим потоком обращений.",
    popular: false,
    features: [
      "Всё из тарифа Профессиональный",
      "Расширенные правила команды",
      "Приоритетная обработка обращений",
      "Дополнительные рабочие сценарии",
      "Поддержка командного процесса",
    ],
  },
] as const;

const comparison = [
  ["Единая очередь", "✓", "✓", "✓"],
  ["AI-подготовка ответов", "✓", "✓", "✓"],
  ["Шаблоны", "✓", "✓", "✓"],
  ["Автоответы и сценарии", "—", "✓", "✓"],
  ["Контроль качества", "—", "✓", "✓"],
  ["Командная работа", "—", "✓", "✓"],
  ["Расширенная аналитика", "—", "✓", "✓"],
  ["Расширенные правила", "—", "—", "✓"],
] as const;

const faq = [
  ["Можно ли попробовать MPReply бесплатно?", "Да. На старте доступен бесплатный период, чтобы подключить площадку и проверить рабочий процесс на своих обращениях."],
  ["Какие маркетплейсы поддерживаются?", "Готовы интеграции Wildberries, Ozon, Яндекс Маркета и Авито."],
  ["Можно ли сменить тариф?", "Да. Тариф можно изменить по мере роста нагрузки и команды."],
  ["Нужна ли банковская карта для старта?", "Для начала бесплатного периода карта не требуется."],
  ["Есть ли тариф для большой команды?", "Если стандартных планов недостаточно, можно обсудить индивидуальный вариант под ваш процесс."],
  ["Что происходит с историей при смене тарифа?", "Рабочая история и обращения остаются частью вашего пространства MPReply."],
] as const;

const marketplaces = [
  ["wb", "WB", "Wildberries"],
  ["oz", "OZ", "Ozon"],
  ["ym", "М", "Яндекс Маркет"],
  ["av", "A", "Авито"],
] as const;

export default function PricingPage() {
  return (
    <PublicShell>
      <div className="mockup-page">
        <section className="pricing-mockup-hero">
          <div className="public-container">
            <p className="mockup-eyebrow">Тарифы MPReply</p>
            <h1>Простые тарифы без скрытых платежей</h1>
            <p>Выберите план под текущий объём работы. Все тарифы построены вокруг одного рабочего процесса MPReply.</p>

            <div className="pricing-toggle" aria-label="Период оплаты">
              <span>Ежемесячно</span>
              <span>За год</span>
            </div>

            <div className="pricing-card-grid">
              {plans.map((plan) => (
                <article className={`pricing-card${plan.popular ? " is-popular" : ""}`} key={plan.name}>
                  {plan.popular ? <span className="pricing-popular">Популярный</span> : null}
                  <h2>{plan.name}</h2>
                  <p>{plan.description}</p>
                  <div className="pricing-price">
                    <strong>{plan.price}</strong>
                    <span>/ месяц</span>
                  </div>
                  <Link className={`button ${plan.popular ? "button-primary" : "button-secondary"}`} href="/auth/register?intent=connect-marketplace">
                    Попробовать бесплатно
                  </Link>
                  <ul className="pricing-feature-list">
                    {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
                  </ul>
                </article>
              ))}
            </div>

            <div className="pricing-custom-strip">
              <div>
                <strong>Нужен индивидуальный тариф?</strong>
                <span>Обсудим объём обращений, команду и рабочие сценарии.</span>
              </div>
              <Link className="button button-secondary" href="/contacts">Связаться с нами</Link>
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Интеграции</p>
              <h2>Все ключевые маркетплейсы уже поддерживаются</h2>
              <p>Не нужно покупать отдельный сервис под каждую площадку — работа строится в одном интерфейсе.</p>
            </div>
            <div className="pricing-market-row">
              {marketplaces.map(([tone, mark, name]) => (
                <div className="pricing-market-chip" key={name}>
                  <span className={`mockup-market-mark ${tone}`} aria-hidden="true">{mark}</span>
                  <strong>{name}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Сравнение тарифов</p>
              <h2>Сравните возможности планов</h2>
              <p>Основной рабочий процесс доступен с первого тарифа, а дополнительные уровни добавляют автоматизацию и командные возможности.</p>
            </div>
            <div className="pricing-comparison">
              <table>
                <thead>
                  <tr>
                    <th>Возможность</th>
                    <th>Старт</th>
                    <th>Профессиональный</th>
                    <th>Бизнес</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map(([feature, start, pro, business]) => (
                    <tr key={feature}>
                      <td>{feature}</td>
                      <td>{start}</td>
                      <td>{pro}</td>
                      <td>{business}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Вопросы о тарифах</p>
              <h2>Частые вопросы</h2>
            </div>
            <div className="pricing-faq">
              {faq.map(([question, answer]) => (
                <details key={question}>
                  <summary>{question}</summary>
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
                <p className="mockup-eyebrow">Попробуйте на своих обращениях</p>
                <h2>Начните отвечать покупателям быстрее уже сегодня</h2>
                <p>Подключите маркетплейс, соберите обращения в одной очереди и проверьте MPReply на реальном рабочем процессе.</p>
                <div className="mockup-actions">
                  <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">Попробовать бесплатно</Link>
                  <Link className="button button-secondary" href="/demo">Смотреть демо</Link>
                </div>
              </div>
              <div className="pricing-final-visual" aria-hidden="true">
                <div className="pricing-final-bubble">✦ AI подготовил ответ<br /><br />Осталось проверить и отправить покупателю.</div>
                <div className="mockup-mascot" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
