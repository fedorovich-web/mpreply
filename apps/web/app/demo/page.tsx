import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Как работает MPReply — демо ИИ-ответов для маркетплейсов",
  description:
    "Посмотрите, как MPReply обрабатывает обращение покупателя: получает контекст, готовит ИИ-ответ, применяет правила и выбирает автоотправку или проверку менеджером.",
  path: "/demo",
});

const steps = [
  ["01", "Приходит обращение", "Отзыв, вопрос или доступное сообщение попадает в общую очередь вместе с источником и статусом."],
  ["02", "Собирается контекст", "Система использует доступные данные обращения и товара, необходимые для ответа."],
  ["03", "ИИ готовит черновик", "Ответ появляется прямо в рабочем интерфейсе рядом с исходным сообщением."],
  ["04", "Срабатывают проверки", "Если данных недостаточно или сценарий требует осторожности, автоматическая отправка останавливается."],
  ["05", "Применяются правила команды", "Для выбранных типов обращений можно разрешить автоответ или оставить обязательную проверку."],
  ["06", "Ответ отправляется и получает статус", "Результат обработки сохраняется, а временные ошибки интеграции не остаются незаметными."],
];

export default function DemoPage() {
  return (
    <PublicShell>
      <section className="public-subhero public-subhero-demo">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Демо MPReply</p>
            <h1>Что происходит между новым обращением и готовым ответом</h1>
            <p className="public-lead">
              Разберём один сценарий без абстрактных обещаний: покупатель задаёт вопрос, ИИ готовит черновик, а система понимает, что данных для автоматической отправки недостаточно.
            </p>
          </div>

          <aside className="demo-scenario-card" aria-label="Исходное обращение для демонстрации">
            <div className="demo-scenario-topline">
              <span>Wildberries · вопрос</span>
              <span>новый</span>
            </div>
            <strong>«Можно ли использовать товар на улице зимой?»</strong>
            <p>В доступном контексте нет подтверждённого температурного диапазона. Придумывать характеристику нельзя.</p>
          </aside>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="demo-decision-stage">
            <div className="demo-decision-copy">
              <p className="eyebrow">Результат этого сценария</p>
              <h2>Автоотправка остановлена — вопрос передан менеджеру с готовым контекстом</h2>
              <p>Система не публикует уверенный на вид ответ без фактов. Менеджер видит исходный вопрос, причину остановки и может уточнить или переписать ответ.</p>
            </div>
            <div className="demo-decision-badge" role="status" aria-label="Решение: требуется проверка">
              <span>Проверка ответа</span>
              <strong>Нужен менеджер</strong>
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
            <p className="eyebrow">Три возможных действия</p>
            <h2>Один процесс, но не один ответ на все случаи</h2>
            <p className="public-copy-muted">Автоматизация полезна только тогда, когда команда понимает, где она работает сама, а где должна остановиться.</p>
          </div>
          <div className="decision-outcomes">
            <div className="decision-outcome decision-outcome-allow">
              <strong>Отправить автоматически</strong>
              <p>Сценарий подходит под правила команды и не требует дополнительной проверки.</p>
            </div>
            <div className="decision-outcome decision-outcome-review">
              <strong>Передать менеджеру</strong>
              <p>Недостаточно контекста или правило требует участия человека.</p>
            </div>
            <div className="decision-outcome decision-outcome-block">
              <strong>Не отправлять</strong>
              <p>Текущий вариант ответа нельзя публиковать без изменения.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <p className="eyebrow">Попробуйте на своих обращениях</p>
            <h2>Подключите маркетплейс и соберите отзывы, вопросы и сообщения в одной очереди</h2>
          </div>
          <div className="cta-actions-on-dark">
            <Link className="button button-secondary button-secondary-on-dark" href="/features">Все возможности</Link>
            <Link className="button button-primary button-on-dark" href="/auth/register?intent=connect-marketplace">Создать аккаунт</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
