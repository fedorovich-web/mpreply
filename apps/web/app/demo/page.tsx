import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Демо MPReply — как работает обработка обращений",
  description:
    "Посмотрите, как MPReply получает обращения покупателей, анализирует контекст, готовит AI-черновик и передаёт ответ на проверку или отправку.",
  path: "/demo",
});

const journey = [
  ["✉", "Получение обращения", "Отзыв, вопрос или сообщение покупателя попадает в единую очередь MPReply."],
  ["▤", "Анализ контекста", "Сервис связывает обращение с площадкой, товаром и доступной историей."],
  ["✦", "AI-черновик", "MPReply готовит вариант ответа с учётом контекста и правил команды."],
  ["➤", "Проверка и отправка", "Сотрудник проверяет сложные случаи, а разрешённые сценарии можно отправлять автоматически."],
] as const;

const scenarios = [
  ["wb", "WB", "Вопрос о размере", "Покупатель уточняет характеристику товара перед заказом. MPReply показывает товарный контекст и готовит черновик ответа."],
  ["oz", "OZ", "Вопрос о наличии", "Покупатель спрашивает о поставке. Ответ формируется по доступным данным и правилам вашей команды."],
  ["av", "A", "Сообщение после покупки", "Команда получает сообщение в той же очереди и отвечает без переключения между рабочими кабинетами."],
] as const;

const processEvents = [
  ["1", "12:01", "Получено обращение"],
  ["2", "12:02", "Определён контекст товара"],
  ["3", "12:02", "Создан AI-черновик"],
  ["4", "12:04", "Ответ проверен сотрудником"],
  ["5", "12:05", "Ответ отправлен"],
] as const;

const teamTools = [
  ["✉", "Единая очередь", "Все отзывы, вопросы и сообщения в одном окне."],
  ["✦", "AI-подготовка", "Черновики ответов с учётом контекста обращения."],
  ["✓", "Контроль качества", "Проверка сложных ответов перед отправкой."],
  ["◷", "История действий", "Видимый путь обращения от получения до ответа."],
] as const;

export default function DemoPage() {
  return (
    <PublicShell>
      <div className="mockup-page">
        <section className="demo-mockup-hero">
          <div className="public-container demo-mockup-grid">
            <div className="demo-mockup-copy">
              <p className="mockup-eyebrow">Демо MPReply</p>
              <h1>Посмотрите, как MPReply работает в реальных сценариях</h1>
              <p>
                От нового обращения на маркетплейсе до готового ответа: покажем единый рабочий процесс, AI-подготовку и контроль команды.
              </p>
              <div className="mockup-actions">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Попробовать бесплатно <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href="/features">Все возможности</Link>
              </div>
              <div className="mockup-trust-row">
                <span>Без установки</span>
                <span>4 готовые интеграции</span>
                <span>14 дней бесплатно</span>
              </div>
            </div>

            <div className="demo-hero-story" role="img" aria-label="Путь обращения от покупателя до проверенного ответа">
              <article className="demo-story-card incoming">
                <strong>Новое обращение · Wildberries</strong>
                <p>Здравствуйте! Подойдёт ли размер 42 на рост 170 см?</p>
              </article>
              <span className="demo-story-arrow a1" aria-hidden="true">↘</span>
              <article className="demo-story-card ai">
                <strong>✦ AI подготовил ответ</strong>
                <p>Да, размер 42 обычно подходит на рост 168–172 см. Если хотите, уточните параметры — поможем выбрать точнее.</p>
              </article>
              <span className="demo-story-arrow a2" aria-hidden="true">→</span>
              <article className="demo-story-card review">
                <strong>Проверка сотрудником</strong>
                <p>Ответ готов к отправке покупателю.</p>
              </article>
              <div className="mockup-mascot demo-hero-mascot" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Как проходит обращение</p>
              <h2>От сообщения покупателя до готового ответа</h2>
              <p>Четыре шага показывают основную механику продукта без технических деталей и переключения между кабинетами.</p>
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
              <p className="mockup-eyebrow">Примеры обращений</p>
              <h2>Три типовых сценария работы</h2>
              <p>Независимо от площадки и типа обращения команда получает одинаковый понятный рабочий процесс.</p>
            </div>
            <div className="demo-scenarios">
              {scenarios.map(([tone, mark, title, text]) => (
                <article className="demo-scenario-card" key={title}>
                  <div className="demo-scenario-head">
                    <span className={`mockup-market-mark ${tone}`} aria-hidden="true">{mark}</span>
                    <strong>{title}</strong>
                  </div>
                  <p>{text}</p>
                  <Link href="/auth/register?intent=connect-marketplace">Попробовать этот процесс →</Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Полный процесс</p>
              <h2>Вся история обращения остаётся перед глазами</h2>
              <p>Статусы, подготовленный ответ и действия сотрудника собраны в одном рабочем контексте.</p>
            </div>
            <div className="demo-process">
              <div className="demo-process-message">
                <h3>Обращение покупателя</h3>
                <small>Wildberries · только что</small>
                <div className="demo-process-bubble">Здравствуйте! Когда ожидается следующая поставка этого товара?</div>
                <div className="detail-product-row">
                  <span className="detail-product-thumb" aria-hidden="true" />
                  <span>Карточка товара<br />Артикул 12345678</span>
                </div>
              </div>

              <div className="demo-process-timeline">
                {processEvents.map(([number, time, label]) => (
                  <div className="demo-process-event" key={number}>
                    <span>{number}</span>
                    <small>{time}</small>
                    <strong>{label}</strong>
                  </div>
                ))}
              </div>

              <div className="demo-process-answer">
                <strong>✦ AI-черновик</strong>
                <p>Здравствуйте! Поставка ожидается на следующей неделе. Мы сообщим, как только товар снова будет в наличии.</p>
                <span className="button button-primary">Использовать ответ</span>
              </div>
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Для ежедневной работы</p>
              <h2>Инструменты команды в одном месте</h2>
            </div>
            <div className="demo-team-tools">
              {teamTools.map(([icon, title, text], index) => (
                <article className="demo-team-tool" key={title}>
                  <span className={`mockup-icon-chip ${index === 1 ? "purple" : ""}`} aria-hidden="true">{icon}</span>
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
                <h2>Готовы попробовать MPReply на своих обращениях?</h2>
                <p>Подключите одну из готовых интеграций и пройдите этот же процесс на реальных сообщениях покупателей.</p>
              </div>
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">Попробовать бесплатно →</Link>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
