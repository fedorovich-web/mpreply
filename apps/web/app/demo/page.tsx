import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Как работает Respio — демонстрация автоматического ответа",
  description:
    "Пошаговая демонстрация Respio: обращение, контекст, AI, SafetyGate, правило автоматизации, очередь, отправка и журнал результата.",
  path: "/demo",
});

const steps = [
  ["01", "Получено обращение", "Отзыв или вопрос приходит через marketplace adapter и получает внутренний идентификатор."],
  ["02", "Собран контекст", "Respio использует данные товара, правила компании и доступные знания."],
  ["03", "Подготовлен AI-ответ", "Модель возвращает структурированный результат; сохраняются версия инструкции, токены и задержка."],
  ["04", "SafetyGate принял решение", "Ответ разрешается, отправляется человеку или блокируется до внешней отправки."],
  ["05", "Применено правило", "Учитываются тип обращения, рейтинг, ключевые слова, товар и установленные ограничения."],
  ["06", "Отправка и журнал", "Ответ получает ключ идемпотентности, идёт в очередь, отправляется worker-процессом и фиксирует итог."],
];

export default function DemoPage() {
  return (
    <PublicShell>
      <section className="public-subhero public-subhero-demo">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Демонстрация workflow</p>
            <h1>Что происходит между новым отзывом и опубликованным ответом</h1>
            <p className="public-lead">
              Без «магии AI» и скрытых переходов. Ниже — реальный продуктовый pipeline Respio: от входящего сообщения до решения, очереди и подтверждённого результата.
            </p>
          </div>

          <aside className="demo-scenario-card" aria-label="Исходное обращение для демонстрации">
            <div className="demo-scenario-topline">
              <span>Wildberries · вопрос</span>
              <span>новый</span>
            </div>
            <strong>«Можно ли использовать товар на улице зимой?»</strong>
            <p>В карточке товара нет подтверждённого температурного диапазона. Система не должна выдумывать характеристику.</p>
          </aside>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="demo-decision-stage">
            <div className="demo-decision-copy">
              <p className="eyebrow">Результат для этого сценария</p>
              <h2>SafetyGate остановил автоотправку из-за недостатка подтверждённого контекста</h2>
              <p>Ответ не публикуется вслепую. Обращение получает статус ручной проверки, а менеджер видит причину решения.</p>
            </div>
            <div className="demo-decision-badge" aria-label="Решение SafetyGate: на проверку">
              <span>SafetyGate</span>
              <strong>На проверку</strong>
              <small>Причина: недостаточно данных о товаре</small>
            </div>
          </div>

          <div className="demo-flow-list">
            {steps.map(([number, title, description]) => (
              <article className="demo-flow-row" key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted">
        <div className="public-container public-two-column public-two-column-balanced">
          <div>
            <p className="eyebrow">Другие возможные исходы</p>
            <h2>Один pipeline — разные действия в зависимости от риска и правил</h2>
          </div>
          <div className="decision-outcomes">
            <div className="decision-outcome decision-outcome-allow">
              <strong>Разрешено</strong>
              <p>Ответ безопасен и может перейти к автоматической отправке.</p>
            </div>
            <div className="decision-outcome decision-outcome-review">
              <strong>На проверку</strong>
              <p>Нужен человек: не хватает контекста или правило требует ручного решения.</p>
            </div>
            <div className="decision-outcome decision-outcome-block">
              <strong>Заблокировано</strong>
              <p>Ответ не должен быть отправлен в текущем виде.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <p className="eyebrow">Продолжить</p>
            <h2>Посмотрите все возможности Respio или перейдите к подключению маркетплейса</h2>
          </div>
          <div className="cta-actions-on-dark">
            <Link className="button button-secondary button-secondary-on-dark" href="/features">Возможности</Link>
            <Link className="button button-primary button-on-dark" href="/auth/register?intent=connect-marketplace">Подключить маркетплейс</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
