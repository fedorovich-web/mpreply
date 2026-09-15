import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Интеграции MPReply — Wildberries, Ozon, Яндекс Маркет и Авито",
  description:
    "Подключите Wildberries, Ozon, Яндекс Маркет и Авито к MPReply и работайте с отзывами, вопросами и сообщениями покупателей в одной системе.",
  path: "/marketplaces",
});

const integrations = [
  {
    key: "wb",
    name: "Wildberries",
    path: "/marketplaces/wildberries",
    text: "Отзывы, вопросы и сообщения покупателей — в единой очереди MPReply.",
    points: ["Отзывы и вопросы", "Сообщения покупателей", "Ответы и статусы"],
  },
  {
    key: "oz",
    name: "Ozon",
    path: "/marketplaces/ozon",
    text: "Работайте с обращениями Ozon по тем же правилам, что и с другими площадками.",
    points: ["Единый поток обращений", "Контекст товара", "Проверка перед отправкой"],
  },
  {
    key: "ym",
    name: "Яндекс Маркет",
    path: "/marketplaces/yandex-market",
    text: "Получайте обращения Яндекс Маркета и обрабатывайте их без отдельного рабочего процесса.",
    points: ["Отзывы и вопросы", "Общий статус обработки", "История действий"],
  },
  {
    key: "av",
    name: "Авито",
    path: "/marketplaces/avito",
    text: "Сообщения покупателей Авито становятся частью общей очереди и командной работы.",
    points: ["Сообщения покупателей", "AI-подготовка ответа", "Единые правила команды"],
  },
] as const;

const benefits = [
  ["✉", "Единая очередь", "Отзывы, вопросы и сообщения с разных площадок находятся в одном рабочем окне."],
  ["↻", "Синхронизация и статусы", "Команда видит источник обращения, текущий статус и результат обработки."],
  ["✦", "AI-подготовка ответов", "MPReply готовит черновик с учётом контекста товара и правил коммуникации."],
  ["●", "Командная работа", "Одинаковый процесс для сотрудников независимо от того, откуда пришло обращение."],
] as const;

const connectSteps = [
  ["1", "Выберите маркетплейс", "Откройте интеграции и выберите площадку, которую хотите подключить к рабочему пространству."],
  ["2", "Подтвердите подключение", "Добавьте данные подключения в защищённой форме и дождитесь успешной синхронизации."],
  ["3", "Работайте в одной системе", "Новые обращения появляются в MPReply и проходят единый процесс подготовки и отправки ответа."],
] as const;

export default function MarketplacesPage() {
  return (
    <PublicShell>
      <div className="mockup-page">
        <section className="marketplaces-mockup-hero mockup-hero">
          <div className="public-container mockup-hero-grid">
            <div className="mockup-hero-copy">
              <p className="mockup-eyebrow">Интеграции MPReply</p>
              <h1>
                Подключите все ключевые маркетплейсы <span className="mockup-highlight">в одной системе</span>
              </h1>
              <p>
                Соберите отзывы, вопросы и сообщения покупателей с Wildberries, Ozon, Яндекс Маркета и Авито в едином рабочем пространстве MPReply.
              </p>
              <div className="mockup-actions">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Попробовать бесплатно <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href="/demo">Смотреть видео</Link>
              </div>
              <div className="mockup-trust-row" aria-label="Условия подключения">
                <span>Быстрое подключение</span>
                <span>14 дней бесплатно</span>
                <span>Без карты</span>
              </div>
            </div>

            <div className="marketplace-hub-scene" role="img" aria-label="MPReply соединяет четыре готовые интеграции в одной системе">
              <span className="marketplace-hub-line l1" aria-hidden="true" />
              <span className="marketplace-hub-line l2" aria-hidden="true" />
              <div className="marketplace-hub-core">MPReply</div>
              <div className="marketplace-hub-card wb">
                <span className="mockup-market-mark wb" aria-hidden="true">WB</span>
                <strong>Wildberries</strong>
                <span>Отзывы · вопросы · сообщения</span>
              </div>
              <div className="marketplace-hub-card oz">
                <span className="mockup-market-mark oz" aria-hidden="true">OZ</span>
                <strong>Ozon</strong>
                <span>Отзывы · вопросы · сообщения</span>
              </div>
              <div className="marketplace-hub-card ym">
                <span className="mockup-market-mark ym" aria-hidden="true">М</span>
                <strong>Яндекс Маркет</strong>
                <span>Обращения покупателей</span>
              </div>
              <div className="marketplace-hub-card av">
                <span className="mockup-market-mark av" aria-hidden="true">A</span>
                <strong>Авито</strong>
                <span>Сообщения · отзывы</span>
              </div>
              <div className="mockup-mascot" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="mockup-section-head">
              <p className="mockup-eyebrow">Поддерживаем ведущие маркетплейсы</p>
              <h2>Популярные маркетплейсы уже в MPReply</h2>
              <p>Подключайте площадки по мере необходимости — все готовые интеграции работают через одну очередь и один набор правил.</p>
            </div>

            <div className="marketplace-logo-grid">
              {integrations.map((integration) => (
                <article className="marketplace-logo-card" key={integration.key}>
                  <div className={`marketplace-brand-wordmark ${integration.key}`}>{integration.name}</div>
                  <p>{integration.text}</p>
                  <ul>
                    {integration.points.map((point) => <li key={point}>{point}</li>)}
                  </ul>
                  <Link className="button button-secondary" href={integration.path}>Подробнее</Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="mockup-section-head">
              <p className="mockup-eyebrow">Преимущества интеграции</p>
              <h2>Что даёт единая интеграция</h2>
              <p>Неважно, с какой площадки пришёл покупатель: команда видит одинаковый интерфейс и выполняет одинаковый понятный процесс.</p>
            </div>
            <div className="marketplace-benefits-grid">
              {benefits.map(([icon, title, text], index) => (
                <article className="marketplace-benefit-card" key={title}>
                  <span className={`mockup-icon-chip ${index === 2 ? "purple" : ""}`} aria-hidden="true">{icon}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="mockup-section-head">
              <p className="mockup-eyebrow">Как подключить маркетплейсы</p>
              <h2>3 простых шага до полной интеграции</h2>
              <p>Подключение встроено в onboarding MPReply и не требует отдельного рабочего процесса для каждой площадки.</p>
            </div>
            <div className="marketplace-connect-steps">
              {connectSteps.map(([number, title, text], index) => (
                <article className="marketplace-connect-card" key={number}>
                  <span className="mockup-step-number">{number}</span>
                  <span className={`mockup-icon-chip ${index === 1 ? "purple" : ""}`} aria-hidden="true">
                    {index === 0 ? "＋" : index === 1 ? "↗" : "✓"}
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section public-cta-section">
          <div className="public-container">
            <div className="mockup-cta">
              <p className="mockup-eyebrow">Все площадки в одном окне</p>
              <h2>Подключите маркетплейсы и начните отвечать быстрее</h2>
              <p>Объедините работу с обращениями покупателей в MPReply и сохраняйте один стандарт качества на всех площадках.</p>
              <div className="mockup-actions">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Попробовать бесплатно <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href="/demo">Смотреть демо</Link>
              </div>
              <div className="mockup-trust-row" aria-label="Условия старта">
                <span>14 дней бесплатно</span>
                <span>Без карты</span>
                <span>4 готовые интеграции</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
