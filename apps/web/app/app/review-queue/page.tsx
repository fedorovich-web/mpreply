import { ReviewQueueWorkspace } from "../../../components/review-queue/ReviewQueueWorkspace";

export default function ReviewQueuePage() {
  return (
    <section className="app-page app-page-wide">
      <section className="app-header app-header-row">
        <div>
          <p className="eyebrow">На проверке</p>
          <h1>Ответы, которые требуют внимания</h1>
          <p>
            Проверьте текст, при необходимости отредактируйте его, одобрите отправку или верните ответ на доработку. Причина проверки и история изменений остаются рядом с обращением.
          </p>
        </div>
        <div className="app-header-actions">
          <span className="status-badge">Решение менеджера</span>
          <span className="status-badge">История изменений</span>
        </div>
      </section>

      <ReviewQueueWorkspace />
    </section>
  );
}
