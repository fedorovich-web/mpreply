import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Автоответы на отзывы, вопросы и сообщения — возможности MPReply",
  description:
    "Единая очередь обращений с Wildberries, Ozon, Яндекс Маркета и Авито, ответы с помощью ИИ, правила автоматизации, проверка сотрудником и контроль отправки.",
  path: "/features",
});

const capabilityGroups = [
  {
    number: "01",
    title: "Соберите обращения в одну очередь",
    text: "Отзывы, вопросы и сообщения с подключённых площадок приходят в единое рабочее пространство. Сотрудник сразу видит источник, тип обращения, товар и текущее состояние.",
    points: ["Wildberries, Ozon, Яндекс Маркет и Авито", "Фильтры по площадке, типу и статусу", "Контекст обращения без лишних переходов"],
  },
  {
    number: "02",
    title: "Получите готовый черновик ответа",
    text: "ИИ помогает подготовить ответ с учётом доступного контекста товара, самого обращения, правил команды и заданного тона коммуникации.",
    points: ["Черновик рядом с обращением", "Контекст товара и диалога", "Редактирование перед отправкой"],
  },
  {
    number: "03",
    title: "Оставьте человеку только нужные случаи",
    text: "Типовые сценарии можно автоматизировать, а неоднозначные, чувствительные или важные обращения отправлять на проверку сотруднику.",
    points: ["Автоотправка по понятным правилам", "Отдельная очередь на проверку", "Контроль исключений и чувствительных тем"],
  },
  {
    number: "04",
    title: "Отправьте ответ и сохраните историю",
    text: "После решения сотрудник видит итоговый статус обработки и может вернуться к истории действий, если нужно проверить конкретный случай.",
    points: ["Понятные статусы обработки", "Контроль ошибок отправки", "История значимых действий"],
  },
];

const consoleRows = [
  ["Отзыв · 5 звёзд", "Черновик готов", "Автоответ", "Готов к отправке"],
  ["Вопрос о гарантии", "Нужна проверка", "Менеджер", "На проверке"],
  ["Сообщение покупателя", "Черновик готов", "Правило команды", "В работе"],
];

const controlScenarios = [
  ["Повторяющиеся обращения", "Можно автоматизировать после настройки правил и тона ответа."],
  ["Неоднозначные вопросы", "Оставляйте на проверку, чтобы сотрудник видел контекст и принимал решение."],
  ["Негатив и чувствительные темы", "Выделяйте в отдельный сценарий и не отправляйте без нужного контроля."],
  ["Несколько площадок", "Используйте один рабочий процесс вместо отдельных привычек для каждого кабинета."],
];

export default function FeaturesPage() {
  return (
    <PublicShell>
      <section className="public-subhero public-subhero-featured">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Возможности</p>
            <h1>От обращения покупателя до ответа — в одном рабочем процессе</h1>
            <p className="public-lead">
              Собирайте отзывы, вопросы и сообщения, получайте контекстный черновик ответа и автоматизируйте только те сценарии, которым доверяет команда.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                Начать подключение
              </Link>
              <Link className="button button-secondary" href="/demo">
                Посмотреть интерфейс
              </Link>
            </div>
          </div>

          <div className="decision-preview" role="group" aria-label="Пример обработки обращения">
            <div className="decision-preview-head">
              <span className="decision-preview-label">Вопрос покупателя</span>
              <span className="decision-preview-time">сейчас</span>
            </div>
            <div className="decision-preview-message">
              <strong>«Подойдёт ли этот размер на рост 174 см?»</strong>
              <p>Контекст товара найден. Черновик подготовлен с учётом данных карточки.</p>
            </div>
            <div className="decision-preview-path" role="group" aria-label="Этапы обработки">
              <span>Контекст найден</span>
              <span>Черновик готов</span>
              <strong>Правило → проверить сотруднику</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <p className="eyebrow">Один рабочий цикл</p>
            <h2>Не набор функций, а понятный путь обработки каждого обращения</h2>
            <p>Площадка, контекст, черновик, решение сотрудника и отправка остаются связаны в одной карточке и одной очереди.</p>
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
            <p className="eyebrow">Рабочее место команды</p>
            <h2>Главное по обращению видно рядом — без прыжков между кабинетами</h2>
            <p className="public-copy-muted">
              Сотрудник видит площадку, покупателя, товар, исходное обращение, состояние обработки и следующий шаг в одном интерфейсе.
            </p>
          </div>

          <div className="product-console" role="group" aria-label="Пример очереди MPReply">
            <div className="product-console-head">
              <div>
                <span className="operations-live-dot" aria-hidden="true" />
                <strong>Все обращения</strong>
              </div>
              <span>единая очередь</span>
            </div>
            <div className="product-console-columns" aria-hidden="true">
              <span>Обращение</span><span>Подготовка</span><span>Действие</span><span>Статус</span>
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
            <p className="eyebrow">Контроль автоматизации</p>
            <h2>Автоматизируйте рутину. Решения с риском оставляйте человеку.</h2>
            <p className="public-copy-muted">Правила определяют не только когда можно отправить ответ автоматически, но и когда система должна остановиться и передать случай сотруднику.</p>
          </div>
          <div className="audience-pricing-list">
            {controlScenarios.map(([title, text]) => (
              <article className="audience-pricing-row" key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
                <span>Контроль остаётся у команды</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <p className="eyebrow">Посмотрите продукт в действии</p>
            <h2>Пройдите путь от входящего обращения до готового ответа</h2>
          </div>
          <Link className="button button-primary button-on-dark" href="/demo">
            Открыть демо
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
