import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Демо MPReply — как работает обработка обращений",
  description:
    "Посмотрите, как MPReply получает обращения покупателей, анализирует контекст, готовит AI-черновик и передаёт ответ на проверку или отправку.",
  path: "/demo",
});

const logos = {
  wb: { name: "Wildberries", src: "/images/marketplaces/wildberries.webp", width: 432, height: 188 },
  oz: { name: "Ozon", src: "/images/marketplaces/ozon.webp", width: 436, height: 198 },
  ym: { name: "Яндекс Маркет", src: "/images/marketplaces/yandex-market.webp", width: 554, height: 222 },
} as const;

const journey = [
  ["✉", "Получение обращения", "Сообщение, отзыв или вопрос поступает из маркетплейса в MPReply в реальном времени."],
  ["▤", "Анализ контекста", "ИИ и система анализируют содержание обращения, историю клиента и товар, чтобы учесть все детали."],
  ["✦", "AI-черновик", "MPReply предлагает готовый ответ с учётом правил бренда и специфики маркетплейса."],
  ["➤", "Проверка и отправка", "Вы проверяете, при необходимости редактируете и отправляете ответ в маркетплейс — прямо из MPReply."],
] as const;

const scenarios = [
  {
    logo: logos.wb,
    type: "Отзыв",
    popular: true,
    title: "Покупатель оставил отзыв о товаре",
    text: "MPReply получает отзыв, анализирует тональность и предлагает подходящий ответ.",
  },
  {
    logo: logos.oz,
    type: "Вопрос",
    popular: false,
    title: "Покупатель спрашивает о наличии и доставке",
    text: "Система учитывает товарный контекст и помогает быстро подготовить точный ответ.",
  },
  {
    logo: logos.ym,
    type: "Сообщение",
    popular: false,
    title: "Личное сообщение от покупателя",
    text: "MPReply показывает историю общения и контекст, чтобы команда ответила без переключения между кабинетами.",
  },
] as const;

const processEvents = [
  ["1", "Получено", "Новое обращение поступило из Ozon"],
  ["2", "Анализ", "Определён контекст товара и обращения"],
  ["3", "AI-черновик", "Подготовлен вариант ответа"],
  ["4", "Ожидает", "Ответ готов к проверке сотрудником"],
  ["5", "Отправлено", "Покупатель получил ответ"],
] as const;

const teamTools = [
  ["✉", "Единая очередь обращений", "Все отзывы, вопросы и сообщения из подключённых маркетплейсов в одном окне."],
  ["▤", "Шаблоны ответов", "Создавайте готовые формулировки для типовых ситуаций и используйте их всей командой."],
  ["ϟ", "Автоответы и сценарии", "Автоматизируйте повторяющиеся обращения и оставляйте сложные случаи на проверку."],
  ["▥", "Аналитика", "Следите за скоростью ответов, объёмом обращений и результатами работы команды."],
] as const;

export default function DemoPage() {
  return (
    <PublicShell>
      <div className="mockup-page">
        <section className="demo-mockup-hero">
          <div className="public-container demo-mockup-grid">
            <div className="demo-mockup-copy">
              <p className="mockup-eyebrow">Демо MPReply</p>
              <h1>Посмотрите, как MPReply ведёт обращение от получения до ответа</h1>
              <p>
                Реальный пример, как покупатель пишет в маркетплейсе, ИИ помогает подготовить ответ, а вы проверяете и отправляете его — быстро и удобно.
              </p>
              <div className="mockup-actions">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Попробовать бесплатно <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href="#demo-process">Смотреть демо</Link>
              </div>
              <div className="mockup-trust-row">
                <span>14 дней бесплатно</span>
                <span>Без карты</span>
                <span>Быстрое подключение</span>
              </div>
            </div>

            <div className="demo-hero-story" role="img" aria-label="Путь обращения от покупателя до готового ответа">
              <article className="demo-story-card incoming">
                <Image className="marketplace-detail-logo-small" src={logos.wb.src} width={logos.wb.width} height={logos.wb.height} alt="" aria-hidden="true" unoptimized />
                <strong>Новое сообщение от покупателя</strong>
                <p>Здравствуйте! Когда будет поставка этого товара?</p>
              </article>
              <span className="demo-story-arrow a1" aria-hidden="true">↘</span>
              <article className="demo-story-card ai">
                <strong>✦ AI MPReply</strong>
                <p>Здравствуйте! Поставка ожидается в ближайшее время. Мы сообщим, как только товар появится на складе.</p>
              </article>
              <span className="demo-story-arrow a2" aria-hidden="true">→</span>
              <article className="demo-story-card review">
                <strong>Ответ готов</strong>
                <p>Проверьте и отправьте покупателю.</p>
              </article>
              <div className="mockup-mascot demo-hero-mascot" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Как это работает</p>
              <h2>Путь обращения</h2>
              <p>От сообщения покупателя до отправленного ответа — всего 4 шага.</p>
            </div>
            <div className="demo-journey">
              {journey.map(([icon, title, text], index) => (
                <article className="demo-journey-card" key={title}>
                  <span className="mockup-step-number">{index + 1}</span>
                  <span className={`mockup-icon-chip ${index === 2 ? "purple" : ""}`} aria-hidden="true">{icon}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Сценарии</p>
              <h2>Попробуйте разные сценарии</h2>
              <p>Выберите тип обращения, чтобы увидеть, как MPReply помогает на каждом этапе.</p>
            </div>
            <div className="demo-scenarios">
              {scenarios.map((scenario) => (
                <article className={`demo-scenario-card${scenario.popular ? " is-popular" : ""}`} key={scenario.type}>
                  <div className="demo-scenario-head">
                    <Image className="marketplace-detail-logo-small" src={scenario.logo.src} width={scenario.logo.width} height={scenario.logo.height} alt={scenario.logo.name} unoptimized />
                    <strong>{scenario.type}</strong>
                    {scenario.popular ? <span className="pricing-popular">Популярный</span> : null}
                  </div>
                  <h3>{scenario.title}</h3>
                  <p>{scenario.text}</p>
                  <a href="#demo-process">Посмотреть пример →</a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section" id="demo-process">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Пример работы в MPReply</p>
              <h2>Одно обращение — весь процесс наглядно</h2>
              <p>Посмотрите, как меняется статус обращения на каждом этапе.</p>
            </div>
            <div className="demo-process">
              <div className="demo-process-message">
                <div className="demo-scenario-head">
                  <Image className="marketplace-detail-logo-small" src={logos.oz.src} width={logos.oz.width} height={logos.oz.height} alt="Ozon" unoptimized />
                  <strong>Обращение #45821</strong>
                </div>
                <small>Вопрос · только что</small>
                <div className="demo-process-bubble">Здравствуйте! Когда будет поставка этого товара?</div>
                <div className="detail-product-row">
                  <span className="detail-product-thumb" aria-hidden="true" />
                  <span>Карточка товара<br />Артикул 12345678</span>
                </div>
              </div>

              <div className="demo-process-timeline">
                {processEvents.map(([number, status, label]) => (
                  <div className="demo-process-event" key={number}>
                    <span>{number}</span>
                    <small>{status}</small>
                    <strong>{label}</strong>
                  </div>
                ))}
              </div>

              <div className="demo-process-answer">
                <strong>✦ AI-черновик</strong>
                <p>Здравствуйте! Поставка ожидается в ближайшее время. Мы сообщим, как только товар снова будет в наличии.</p>
                <span className="button button-primary">Проверить и отправить</span>
              </div>
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Больше, чем просто ответы</p>
              <h2>Что увидит ваша команда</h2>
              <p>Удобные инструменты для совместной работы и полного контроля.</p>
            </div>
            <div className="demo-team-tools">
              {teamTools.map(([icon, title, text], index) => (
                <article className="demo-team-tool" key={title}>
                  <span className={`mockup-icon-chip ${index === 1 ? "purple" : index === 2 ? "orange" : ""}`} aria-hidden="true">{icon}</span>
                  <div>
                    <strong>{title}</strong>
                    <span>{text}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section public-cta-section">
          <div className="public-container">
            <div className="demo-cta-bar">
              <div>
                <h2>Попробуйте MPReply на своих обращениях</h2>
                <p>14 дней бесплатного доступа ко всем возможностям. Без карты. Никаких рисков.</p>
              </div>
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">Попробовать бесплатно →</Link>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
