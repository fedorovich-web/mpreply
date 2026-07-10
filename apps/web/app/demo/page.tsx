import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Демо",
  description:
    "Демо workflow Respio: новое обращение, AI draft, SafetyGate, automation rule, queue и worker-backed отправка ответа.",
  path: "/demo",
});

const steps = [
  ["Новое обращение", "Отзыв или вопрос импортируется через marketplace adapter и получает нормализованный статус."],
  ["AI draft", "OpenRouter provider получает только необходимый контекст и возвращает структурированный ответ."],
  ["SafetyGate", "Проверяются confidence, рискованные обещания, чувствительные темы и полнота контекста."],
  ["Automation rules", "Определяется auto, semi-auto или manual fallback с учётом условий и квот."],
  ["Queue + worker", "Ответ ставится в очередь, получает idempotency key и исполняется worker-ом."],
  ["Audit + usage", "События, попытки, AI usage и результат отправки фиксируются в операционном контуре."],
];

export default function DemoPage() {
  return (
    <PublicShell>
      <section className="public-hero public-hero-compact">
        <div className="public-container public-hero-grid">
          <div className="public-hero-copy">
            <p className="eyebrow">Демо workflow</p>
            <h1>Как Respio проходит путь от отзыва до ответа</h1>
            <p className="public-lead">Без фальшивой «магии AI»: решение разбито на проверяемые этапы с явными статусами и fallback.</p>
          </div>
          <aside className="public-note-card">
            <span className="panel-kicker">Важно</span>
            <strong>Это продуктовый walkthrough, а не подключение к реальному кабинету</strong>
            <p>Production-интеграция требует реальных credentials, проверки scopes, rate limits и end-to-end теста с конкретным кабинетом.</p>
          </aside>
        </div>
      </section>
      <section className="public-section">
        <div className="public-container demo-timeline">
          {steps.map(([title, description], index) => (
            <article className="demo-step" key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><h2>{title}</h2><p>{description}</p></div>
            </article>
          ))}
        </div>
      </section>
      <section className="public-section public-section-muted">
        <div className="public-container public-two-column">
          <div><p className="eyebrow">Результат</p><h2>Безопасный ответ отправляется. Сомнительный — останавливается.</h2></div>
          <div className="public-check-list">
            <p>allow → очередь автоответа</p>
            <p>manual_review → needs_manual_check</p>
            <p>block → safety_blocked</p>
            <p>temporary marketplace error → retry_pending</p>
          </div>
        </div>
      </section>
      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div><p className="eyebrow">Подробнее</p><h2>Изучите SafetyGate, Inbox и automation rules</h2></div>
          <Link className="button button-primary" href="/features">Возможности</Link>
        </div>
      </section>
    </PublicShell>
  );
}
