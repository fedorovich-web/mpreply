import { ReviewQueueWorkspace } from "../../../components/review-queue/ReviewQueueWorkspace";

export default function ReviewQueuePage() {
  return (
    <section className="app-page app-page-wide review-queue-page">
      <header className="app-header app-header-row review-queue-page-header">
        <div>
          <p className="eyebrow">Ручная проверка</p>
          <h1>Проверьте ответы, которым нужно решение</h1>
          <p>
            Причина внимания остаётся рядом с ответом: сравните текст с обращением и товаром, при необходимости внесите правки, затем одобрите или верните ответ на доработку.
          </p>
        </div>
        <div className="app-header-actions" aria-label="Возможности очереди проверки">
          <span className="status-badge">Контекст рядом</span>
          <span className="status-badge">Решение без переключений</span>
        </div>
      </header>

      <ReviewQueueWorkspace />
    </section>
  );
}
