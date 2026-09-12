import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Автоответы на отзывы, вопросы и сообщения — возможности MPReply",
  description:
    "Единая очередь обращений, ИИ-ответы, автоматизация, ручная проверка, интеграции с маркетплейсами и история обработки — возможности MPReply для продавцов и команд.",
  path: "/features",
});

const capabilityGroups = [
  {
    number: "01",
    title: "Собрать обращения в одну очередь",
    text: "Отзывы, вопросы и доступные сообщения приходят из подключённых маркетплейсов в единый рабочий интерфейс. Менеджер сразу видит источник, тип обращения и его текущее состояние.",
    points: ["Wildberries, Ozon, Яндекс Маркет и Авито", "Фильтры по площадке и типу обращения", "Контекст рядом с сообщением"],
  },
  {
    number: "02",
    title: "Подготовить ответ с помощью ИИ",
    text: "Система формирует черновик на основе доступного контекста обращения и товара. Ответ остаётся частью рабочего процесса, а не отдельным текстом из внешнего чат-бота.",
    points: ["Черновик внутри карточки обращения", "Контекст товара и сообщения", "Редактирование перед отправкой"],
  },
  {
    number: "03",
    title: "Решить, где нужна проверка человека",
    text: "Правила автоматизации отделяют предсказуемую рутину от случаев, которые лучше передать менеджеру. Команда сама определяет, какие сценарии можно отправлять автоматически.",
    points: ["Автоотправка для выбранных сценариев", "Ручная проверка исключений", "Отдельные правила для рискованных тем"],
  },
  {
    number: "04",
    title: "Отправить и сохранить результат",
    text: "После отправки MPReply хранит состояние обработки и технический результат. Если интеграция временно недоступна, операция не должна превращаться в потерянный ответ или случайный дубль.",
    points: ["Статусы отправки", "Повтор временных ошибок", "История значимых действий"],
  },
];

const consoleRows = [
  ["Отзыв · 5 звёзд", "Черновик готов", "Автоответ", "К отправке"],
  ["Вопрос о гарантии", "Нужна проверка", "Менеджер", "На проверке"],
  ["Сообщение покупателя", "Черновик готов", "Правило команды", "В очереди"],
];

export default function FeaturesPage() {
  return (
    <PublicShell>
      <section className="public-subhero public-subhero-featured">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Возможности MPReply</p>
            <h1>От входящего обращения до готового ответа — в одном рабочем процессе</h1>
            <p className="public-lead">
              Собирайте отзывы, вопросы и сообщения покупателей, готовьте ответы с помощью ИИ и автоматизируйте только те сценарии, которым доверяете.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                Создать аккаунт
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
              <p>Контекст товара найден. ИИ подготовил ответ по таблице размеров.</p>
            </div>
            <div className="decision-preview-path" role="group" aria-label="Этапы обработки">
              <span>Контекст найден</span>
              <span>Черновик готов</span>
              <strong>Правило → проверить менеджеру</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <p className="eyebrow">Основной сценарий</p>
            <h2>Четыре этапа вместо ручной работы в нескольких кабинетах</h2>
            <p>Интеграции, ИИ и правила работают как части одной системы, а не как набор несвязанных функций.</p>
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
            <h2>Менеджер видит обращение, готовый черновик и следующий шаг рядом</h2>
            <p className="public-copy-muted">
              Не нужно искать исходный отзыв в одном кабинете, товар в другом окне и текст ответа в отдельном AI-сервисе. Основной контекст собран в карточке обращения.
            </p>
          </div>

          <div className="product-console" role="group" aria-label="Пример очереди MPReply">
            <div className="product-console-head">
              <div>
                <span className="operations-live-dot" aria-hidden="true" />
                <strong>Входящие</strong>
              </div>
              <span>единая очередь</span>
            </div>
            <div className="product-console-columns" aria-hidden="true">
              <span>Обращение</span><span>ИИ</span><span>Действие</span><span>Статус</span>
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
            <p className="eyebrow">Автоматизация без потери контроля</p>
            <h2>Рутину можно отправлять автоматически. Исключения — оставлять человеку.</h2>
          </div>
          <div className="public-check-list public-check-list-large">
            <p>Настройте автоответы только для тех типов обращений, где процесс уже понятен команде.</p>
            <p>Оставляйте ручную проверку для неоднозначных вопросов, чувствительных тем и отдельных товаров.</p>
            <p>Следите за состоянием отправки и повторными попытками при временных ошибках площадки.</p>
            <p>Используйте историю обработки, чтобы разбирать конкретные случаи без догадок.</p>
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <p className="eyebrow">Посмотрите продукт в действии</p>
            <h2>Откройте демо и пройдите путь от входящего обращения до готового ответа</h2>
          </div>
          <Link className="button button-primary button-on-dark" href="/demo">
            Посмотреть демо
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
