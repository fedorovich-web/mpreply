import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../components/public-site/PublicShell";
import { JsonLd } from "../components/seo/JsonLd";
import { createPageMetadata } from "../lib/seo";
import { marketplaces, siteConfig } from "../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "AI-ответы на отзывы и вопросы маркетплейсов",
  description:
    "Respio автоматизирует ответы на отзывы и вопросы: AI готовит ответ, SafetyGate проверяет риски, а правила определяют автоотправку или ручную проверку.",
  path: "/",
});

const faq = [
  {
    question: "Respio отправляет ответы полностью автоматически?",
    answer:
      "Да, auto-first — базовый режим. При этом SafetyGate, правила, квоты и исключения могут остановить автоотправку и перевести обращение на ручную проверку.",
  },
  {
    question: "Какая интеграция реализована в MVP?",
    answer:
      "Текущая техническая основа содержит WildberriesAdapter. Ozon, Яндекс Маркет и Авито не заявляются как production-ready до отдельной проверки официальных API-контрактов.",
  },
  {
    question: "Где хранится API-ключ маркетплейса?",
    answer:
      "Ключ обрабатывается только на backend, хранится в зашифрованном виде и не должен попадать во frontend, ответы API или обычные логи.",
  },
  {
    question: "Что происходит с рискованным AI-ответом?",
    answer:
      "SafetyGate может разрешить ответ, отправить его на ручную проверку или заблокировать. Решение фиксируется в статусах и audit trail.",
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
      <section className="public-hero">
        <div className="public-container public-hero-grid">
          <div className="public-hero-copy">
            <p className="eyebrow">Auto-first SaaS для продавцов маркетплейсов</p>
            <h1>AI-ответы на отзывы и вопросы — автоматически, но без слепой автоотправки</h1>
            <p className="public-lead">
              Respio получает обращения через API, готовит ответ с помощью AI, проверяет риски через SafetyGate и отправляет безопасные ответы по заданным правилам. Спорные случаи переходят на ручную проверку.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/demo">
                Посмотреть workflow
              </Link>
              <Link className="button button-secondary" href="/features">
                Изучить возможности
              </Link>
            </div>
            <div className="public-trust-row" aria-label="Ключевые принципы Respio">
              <span>API keys — backend only</span>
              <span>SafetyGate перед отправкой</span>
              <span>Audit trail и idempotency</span>
            </div>
          </div>
          <div className="dashboard-preview public-dashboard-preview" aria-label="Превью рабочего процесса Respio">
            <div className="preview-toolbar" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="preview-grid">
              <div className="preview-card strong">Автоответы активны</div>
              <div className="preview-card">На ручной проверке: 3</div>
              <div className="preview-card wide">WB · Отзыв · SafetyGate: allow</div>
              <div className="preview-card wide warning">Вопрос: не хватает данных о товаре → manual review</div>
              <div className="preview-card wide">Worker · queued → sending → sent</div>
            </div>
          </div>
        </div>
      </section>

      <section className="marketplace-strip" aria-labelledby="marketplace-strip-title">
        <div className="public-container">
          <p id="marketplace-strip-title" className="marketplace-strip-label">
            Интеграционная архитектура
          </p>
          <div className="marketplace-pill-row">
            {marketplaces.map((marketplace) => (
              <Link key={marketplace.key} href={marketplace.path} className="marketplace-pill">
                <strong>{marketplace.shortName}</strong>
                <span>{marketplace.statusLabel}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <p className="eyebrow">Не просто генератор текста</p>
            <h2>Respio принимает решение, можно ли отправлять ответ автоматически</h2>
            <p>
              AI — только один слой. Перед внешней отправкой работают контекст, правила автоматизации, SafetyGate, квоты, idempotency и worker execution.
            </p>
          </div>
          <div className="feature-grid feature-grid-3">
            <article className="feature-card feature-card-emphasis">
              <span className="feature-number">01</span>
              <h3>Понимает контекст обращения</h3>
              <p>Тип обращения, рейтинг, текст покупателя, товар, брендовые правила и база знаний входят в prompt context.</p>
            </article>
            <article className="feature-card">
              <span className="feature-number">02</span>
              <h3>Останавливает рискованные ответы</h3>
              <p>Недостаток контекста, сомнительные обещания и чувствительные темы переводят обращение на ручную проверку.</p>
            </article>
            <article className="feature-card">
              <span className="feature-number">03</span>
              <h3>Отправляет через worker queue</h3>
              <p>Временные ошибки обрабатываются retry-механизмом, а idempotency защищает от повторной постановки одного ответа.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted">
        <div className="public-container public-two-column">
          <div>
            <p className="eyebrow">Auto-first</p>
            <h2>Автоматизация по умолчанию. Ручная проверка — как управляемый fallback.</h2>
            <p className="public-copy-muted">
              Организация задаёт базовый режим, кабинет маркетплейса может его переопределить, а точечные правила уточняют поведение для рейтингов, товаров, категорий и чувствительных тем.
            </p>
          </div>
          <div className="decision-stack" aria-label="Pipeline автоответа">
            <div><span>1</span><strong>Новое обращение</strong><small>Импорт и deduplication</small></div>
            <div><span>2</span><strong>AI draft</strong><small>Prompt strategy + товарный контекст</small></div>
            <div><span>3</span><strong>SafetyGate</strong><small>allow / manual review / block</small></div>
            <div><span>4</span><strong>Automation rules</strong><small>режим, квоты, исключения</small></div>
            <div><span>5</span><strong>Worker execution</strong><small>queue, retry, idempotency</small></div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="section-heading">
            <p className="eyebrow">Возможности</p>
            <h2>Операционный контур для ответов на маркетплейсах</h2>
          </div>
          <div className="feature-grid feature-grid-4">
            <article className="feature-card"><h3>Единый Inbox</h3><p>Отзывы и вопросы в нормализованном формате с фильтрами и статусами.</p></article>
            <article className="feature-card"><h3>AI Assistant</h3><p>Черновики с фиксируемой моделью, usage, latency, cost и версией prompt.</p></article>
            <article className="feature-card"><h3>Automation Rules</h3><p>Условия по рейтингу, типу обращения, ключевым словам и контексту товара.</p></article>
            <article className="feature-card"><h3>Audit Log</h3><p>История значимых действий пользователя, AI и интеграционных процессов.</p></article>
          </div>
          <div className="section-action">
            <Link className="button button-secondary" href="/features">Все возможности</Link>
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted">
        <div className="public-container">
          <div className="section-heading">
            <p className="eyebrow">FAQ</p>
            <h2>Ключевые вопросы об автоматизации</h2>
          </div>
          <div className="faq-list">
            {faq.map((item) => (
              <article className="faq-item" key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <p className="eyebrow">Посмотрите логику Respio</p>
            <h2>От нового отзыва до безопасного ответа — один прозрачный workflow</h2>
          </div>
          <Link className="button button-primary" href="/demo">Открыть демо</Link>
        </div>
      </section>
    </PublicShell>
  );
}
