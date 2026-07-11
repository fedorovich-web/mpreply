import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Возможности Respio — автоматические ответы с контролем риска",
  description:
    "Respio объединяет входящие отзывы и вопросы, AI-подготовку ответа, SafetyGate, правила автоматизации, очередь отправки, повторы и журнал действий.",
  path: "/features",
});

const capabilityGroups = [
  {
    number: "01",
    title: "Собрать обращения в один рабочий поток",
    text: "Отзывы и вопросы приводятся к единому формату, получают понятный статус и остаются доступны для поиска, фильтрации и дальнейшей обработки.",
    points: ["Единые состояния сообщений", "Контекст маркетплейса и товара", "Поиск и фильтры без переключения между кабинетами"],
  },
  {
    number: "02",
    title: "Подготовить ответ с учётом контекста",
    text: "AI получает только необходимый контекст: данные товара, правила компании и доступные знания. Модель, версия инструкции, расход токенов и задержка фиксируются в системе.",
    points: ["Товарный контекст", "Правила компании", "Учёт модели, токенов и стоимости"],
  },
  {
    number: "03",
    title: "Остановить риск до внешней отправки",
    text: "SafetyGate проверяет недостаток контекста, низкую уверенность и рискованные темы. Результат всегда один из трёх: разрешить, отправить человеку или заблокировать.",
    points: ["Разрешить", "Передать на проверку", "Заблокировать"],
  },
  {
    number: "04",
    title: "Отправить надёжно и сохранить историю",
    text: "После правил и квот ответ получает ключ идемпотентности, попадает в очередь, отправляется worker-процессом и фиксирует итог, попытки и ошибки.",
    points: ["Защита от дублей", "Повтор при временных ошибках", "Журнал значимых действий"],
  },
];

const consoleRows = [
  ["Отзыв · 5 звёзд", "Можно отправить", "Правило: автоответ", "Отправлено"],
  ["Вопрос о гарантии", "Нужна проверка", "Риск: обещание", "На проверке"],
  ["Негатив · 1 звезда", "Контекст достаточен", "Правило: менеджер", "В очереди"],
];

export default function FeaturesPage() {
  return (
    <PublicShell>
      <section className="public-subhero public-subhero-featured">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Возможности Respio</p>
            <h1>Автоматизация, которая не заканчивается на генерации текста</h1>
            <p className="public-lead">
              Respio проводит обращение через контекст, AI, SafetyGate, правила и надёжную очередь отправки. Менеджер подключается только там, где действительно нужен человек.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                Подключить маркетплейс
              </Link>
              <Link className="button button-secondary" href="/demo">
                Посмотреть workflow
              </Link>
            </div>
          </div>

          <div className="decision-preview" aria-label="Пример решения SafetyGate">
            <div className="decision-preview-head">
              <span className="decision-preview-label">Новое обращение</span>
              <span className="decision-preview-time">сейчас</span>
            </div>
            <div className="decision-preview-message">
              <strong>«Можно ли вернуть товар после использования?»</strong>
              <p>Вопрос содержит потенциально рискованное обещание о возврате.</p>
            </div>
            <div className="decision-preview-path" aria-label="Этапы обработки">
              <span>Контекст найден</span>
              <span>AI-ответ готов</span>
              <strong>SafetyGate → на проверку</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <p className="eyebrow">Один операционный контур</p>
            <h2>Четыре слоя между входящим обращением и опубликованным ответом</h2>
            <p>Каждый слой отвечает за свою задачу. Marketplace-specific логика не смешивается с AI, правилами и отправкой.</p>
          </div>

          <div className="capability-stack">
            {capabilityGroups.map((group) => (
              <article className="capability-row" key={group.number}>
                <span className="capability-index">{group.number}</span>
                <div className="capability-copy">
                  <h3>{group.title}</h3>
                  <p>{group.text}</p>
                </div>
                <ul className="capability-points">
                  {group.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted">
        <div className="public-container public-two-column public-two-column-feature">
          <div>
            <p className="eyebrow">Рабочее место менеджера</p>
            <h2>Видно не только сообщение, но и почему система выбрала именно это действие</h2>
            <p className="public-copy-muted">
              Для каждого обращения важны контекст, решение SafetyGate, сработавшее правило, статус отправки и история попыток. Это превращает автоматизацию из «чёрного ящика» в управляемый процесс.
            </p>
          </div>

          <div className="product-console" aria-label="Пример операционного списка Respio">
            <div className="product-console-head">
              <div>
                <span className="operations-live-dot" aria-hidden="true" />
                <strong>Входящие</strong>
              </div>
              <span>3 требуют внимания</span>
            </div>
            <div className="product-console-columns" aria-hidden="true">
              <span>Обращение</span><span>Решение</span><span>Действие</span><span>Статус</span>
            </div>
            <div className="product-console-rows">
              {consoleRows.map(([message, decision, action, status]) => (
                <div className="product-console-row" key={message}>
                  <strong>{message}</strong>
                  <span>{decision}</span>
                  <span>{action}</span>
                  <span>{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container public-two-column public-two-column-balanced">
          <div>
            <p className="eyebrow">Auto-first, а не ручное подтверждение по умолчанию</p>
            <h2>Безопасная рутина проходит автоматически. Исключения остаются человеку.</h2>
          </div>
          <div className="public-check-list public-check-list-large">
            <p>Ответ можно отправить автоматически только после SafetyGate, правил и проверки квот.</p>
            <p>Временные сетевые ошибки не теряют сообщение: задача может перейти в повторную попытку.</p>
            <p>Повторная постановка одной и той же операции подавляется ключом идемпотентности.</p>
            <p>Значимые действия пользователя, AI и интеграционных процессов сохраняются в журнале.</p>
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <p className="eyebrow">Следующий шаг</p>
            <h2>Посмотрите полный путь ответа — от входящего отзыва до решения и отправки</h2>
          </div>
          <Link className="button button-primary button-on-dark" href="/demo">
            Открыть демо
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
