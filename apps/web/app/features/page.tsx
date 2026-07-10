import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Возможности",
  description:
    "Inbox, AI Assistant, SafetyGate, automation rules, worker-backed отправка, аналитика usage и audit trail — архитектура Respio для ответов на маркетплейсах.",
  path: "/features",
});

const features = [
  ["Unified Inbox", "Единая очередь отзывов и вопросов с нормализованными статусами, поиском и фильтрами."],
  ["AI Assistant", "Генерация ответа с товарным контекстом, бренд-политиками, prompt version и usage accounting."],
  ["SafetyGate", "Детерминированная проверка confidence, опасных обещаний, чувствительных тем и недостатка контекста."],
  ["Automation Rules", "Правила по marketplace account, типу обращения, рейтингу, ключевым словам, товарам и категориям."],
  ["Auto-reply workflow", "Очередь задач через Dramatiq/Redis, execution lease, retry и idempotency."],
  ["Marketplace adapters", "Изолированный adapter contract для проверки credentials, синхронизации и отправки ответов."],
  ["Usage & cost", "Учёт модели, токенов, latency, estimated cost и версии prompt для каждого AI draft."],
  ["Audit trail", "История значимых действий пользователя, AI и интеграционных событий без записи секретов в обычные логи."],
];

export default function FeaturesPage() {
  return (
    <PublicShell>
      <section className="public-hero public-hero-compact">
        <div className="public-container public-hero-copy public-hero-copy-centered">
          <p className="eyebrow">Возможности Respio</p>
          <h1>От входящего обращения до контролируемого автоответа</h1>
          <p className="public-lead">
            Respio проектируется как операционная система ответов на маркетплейсах: AI ускоряет подготовку, SafetyGate снижает риск, а правила и worker execution делают автоматизацию управляемой.
          </p>
        </div>
      </section>
      <section className="public-section">
        <div className="public-container feature-grid feature-grid-4">
          {features.map(([title, description], index) => (
            <article className="feature-card" key={title}>
              <span className="feature-number">{String(index + 1).padStart(2, "0")}</span>
              <h2 className="feature-title">{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="public-section public-section-muted">
        <div className="public-container public-two-column">
          <div>
            <p className="eyebrow">Контроль</p>
            <h2>Автоответ не должен означать «отправить любой текст без проверки»</h2>
          </div>
          <div className="public-check-list">
            <p>Auto-first по умолчанию, semi-auto как настройка или fallback.</p>
            <p>SafetyGate перед внешней отправкой.</p>
            <p>Runtime quotas повторно проверяются worker-ом непосредственно перед отправкой.</p>
            <p>Дубликаты и повторные queue attempts подавляются через idempotency.</p>
          </div>
        </div>
      </section>
      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div><p className="eyebrow">Практический сценарий</p><h2>Посмотрите pipeline на демо-странице</h2></div>
          <Link className="button button-primary" href="/demo">Открыть демо</Link>
        </div>
      </section>
    </PublicShell>
  );
}
