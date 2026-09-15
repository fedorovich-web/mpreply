import type { Metadata } from "next";
import Link from "next/link";

import { HeroFlowCanvas } from "../components/public-site/HeroFlowCanvas";
import { PublicShell } from "../components/public-site/PublicShell";
import { JsonLd } from "../components/seo/JsonLd";
import { createPageMetadata } from "../lib/seo";
import { marketplaces, siteConfig } from "../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Автоматические ответы на отзывы и вопросы маркетплейсов",
  description:
    "Respio автоматизирует ответы на отзывы и вопросы: ИИ готовит ответ, SafetyGate проверяет риски, а правила определяют автоотправку или ручную проверку.",
  path: "/",
});

const faq = [
  {
    question: "Respio отправляет ответы полностью автоматически?",
    answer:
      "Да. Автоматический режим является основным: безопасные ответы отправляются без обязательного подтверждения менеджером. SafetyGate и правила останавливают только те случаи, которые требуют проверки или не должны быть отправлены.",
  },
  {
    question: "Какая интеграция реализована в MVP?",
    answer:
      "Сейчас реальный MVP-путь реализован для Wildberries. Ozon, Яндекс Маркет и Авито остаются в планах и не считаются готовыми, пока не проверены официальные API, ограничения и полный цикл отправки ответов.",
  },
  {
    question: "Где хранится API-ключ маркетплейса?",
    answer:
      "Ключ обрабатывается только на сервере, хранится в зашифрованном виде и не должен попадать в браузер, обычные ответы API или журналы в открытом виде.",
  },
  {
    question: "Что происходит с рискованным ответом ИИ?",
    answer:
      "SafetyGate может разрешить автоматическую отправку, передать ответ менеджеру или заблокировать его. Причина решения и дальнейшие действия сохраняются в истории.",
  },
];

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

      <section className="public-hero public-hero-flow">
        <div className="public-container public-hero-flow-copy">
          <p className="hero-kicker">Автоматизация ответов на отзывы и вопросы маркетплейсов</p>
          <h1>Ответы работают сами. Рискованные случаи остаются под контролем.</h1>
          <p className="public-lead">
            Respio получает обращения, учитывает товар и правила компании, готовит ответ с помощью ИИ, проверяет его через SafetyGate и автоматически отправляет безопасные ответы. Сложные случаи оставляет менеджеру.
          </p>
          <div className="hero-actions public-hero-actions">
            <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
              Подключить маркетплейс
            </Link>
            <Link className="button button-secondary" href="/demo">
              Посмотреть, как работает Respio
            </Link>
          </div>
        </div>

        <HeroFlowCanvas />

        <div className="public-container hero-proof-row" role="group" aria-label="Ключевые принципы Respio">
          <span>Автоматический режим по умолчанию</span>
          <span>SafetyGate до отправки</span>
          <span>Ручная проверка только для исключений</span>
          <span>Повторные попытки без дублей</span>
        </div>
      </section>

      <section className="marketplace-strip" aria-labelledby="marketplace-strip-title">
        <div className="public-container">
          <div className="marketplace-strip-heading">
            <h2 id="marketplace-strip-title">Маркетплейсы</h2>
            <Link className="text-link" href="/marketplaces">
              Все интеграции
            </Link>
          </div>
          <div className="marketplace-pill-row">
            {marketplaces.map((marketplace) => (
              <Link key={marketplace.key} href={marketplace.path} className="marketplace-pill">
                <strong>{marketplace.name}</strong>
                <span>{marketplace.statusLabel}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section" id="product">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <h2>Respio проводит ответ через весь путь — от входящего обращения до подтверждённой отправки</h2>
            <p>
              ИИ — только один слой. До отправки Respio учитывает товарный контекст и правила компании, проверяет риски, контролирует лимиты и защищает от повторной публикации одного и того же ответа.
            </p>
          </div>

          <div className="signal-flow" role="group" aria-label="Путь автоматического ответа в Respio">
            <div className="signal-flow-track" aria-hidden="true" />
            <article className="signal-flow-step">
              <span>01</span>
              <div>
                <h3>Новое обращение</h3>
                <p>Отзыв или вопрос поступает через официальную интеграцию и нормализуется.</p>
              </div>
            </article>
            <article className="signal-flow-step">
              <span>02</span>
              <div>
                <h3>Контекст и ИИ</h3>
                <p>Respio учитывает товар, правила компании и доступные знания перед генерацией ответа.</p>
              </div>
            </article>
            <article className="signal-flow-step signal-flow-step-safety" id="safetygate">
              <span>03</span>
              <div>
                <h3>SafetyGate</h3>
                <p>Решает: можно отправить ответ автоматически, нужно передать его человеку или заблокировать.</p>
              </div>
              <div className="safety-decision-row" role="group" aria-label="Решения SafetyGate">
                <span className="safety-decision safety-decision-allow">Разрешено</span>
                <span className="safety-decision safety-decision-review">На проверку</span>
                <span className="safety-decision safety-decision-block">Заблокировано</span>
              </div>
            </article>
            <article className="signal-flow-step">
              <span>04</span>
              <div>
                <h3>Правило и отправка</h3>
                <p>Automation Rules определяют дальнейшее действие, worker отправляет ответ и фиксирует статус.</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted">
        <div className="public-container public-two-column public-two-column-feature">
          <div>
            <h2>Менеджер не обязан подтверждать каждый ответ вручную</h2>
            <p className="public-copy-muted">
              Безопасная рутина обрабатывается автоматически. Человек подключается только там, где не хватает контекста, есть рискованная формулировка или правило требует ручной проверки.
            </p>
            <Link className="text-link section-inline-link" href="/features">
              Посмотреть все возможности
            </Link>
          </div>

          <div className="operations-panel" role="group" aria-label="Пример состояний обработки">
            <div className="operations-panel-header">
              <div>
                <span className="operations-live-dot" aria-hidden="true" />
                <strong>Автоматизация активна</strong>
              </div>
              <span>Сейчас</span>
            </div>
            <div className="operations-list">
              <div className="operations-item">
                <span className="operations-channel">WB</span>
                <div>
                  <strong>Отзыв обработан автоматически</strong>
                  <small>SafetyGate: allow · ответ отправлен</small>
                </div>
                <span className="operations-status operations-status-success">Готово</span>
              </div>
              <div className="operations-item">
                <span className="operations-channel">WB</span>
                <div>
                  <strong>Не хватает данных о товаре</strong>
                  <small>SafetyGate: manual review</small>
                </div>
                <span className="operations-status operations-status-review">Проверить</span>
              </div>
              <div className="operations-item">
                <span className="operations-channel">WB</span>
                <div>
                  <strong>Временная ошибка API</strong>
                  <small>Следующая попытка запланирована автоматически</small>
                </div>
                <span className="operations-status operations-status-processing">Повтор</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <h2>Не только ответить, но и понимать, что произошло на каждом этапе</h2>
          </div>
          <div className="feature-grid feature-grid-4 feature-grid-editorial">
            <article className="feature-card">
              <h3>Единый Inbox</h3>
              <p>Отзывы и вопросы в нормализованном формате с фильтрами и понятными статусами.</p>
            </article>
            <article className="feature-card">
              <h3>Правила автоматизации</h3>
              <p>Условия по рейтингу, типу обращения, ключевым словам, товарам и чувствительным темам.</p>
            </article>
            <article className="feature-card">
              <h3>Очередь проверки</h3>
              <p>Только исключения, которые действительно требуют решения менеджера.</p>
            </article>
            <article className="feature-card">
              <h3>История действий</h3>
              <p>Понятная хронология значимых действий пользователя, ИИ и интеграционных процессов.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted">
        <div className="public-container">
          <div className="section-heading">
            <h2>Ключевые вопросы об автоматизации</h2>
          </div>
          <div className="faq-list">
            {faq.map((item) => (
              <details className="faq-item" key={item.question}>
                <summary>
                  <span>{item.question}</span>
                  <span className="faq-item-icon" aria-hidden="true" />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <h2>Подключите маркетплейс и настройте, какие ответы Respio может отправлять самостоятельно</h2>
          </div>
          <Link className="button button-secondary-on-dark" href="/contacts">
            Обсудить подключение
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
