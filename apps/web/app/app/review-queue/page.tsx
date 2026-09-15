import { ReviewQueueWorkspace } from "../../../components/review-queue/ReviewQueueWorkspace";

export default function ReviewQueuePage() {
  return (
    <section className="app-page app-page-wide">
      <section className="app-header app-header-row">
        <div>
          <p className="eyebrow">Ручная проверка</p>
          <h1>Проверка отдельных ответов без отключения автоматизации</h1>
          <p>
            Здесь можно отредактировать ответ, повторно проверить его, одобрить или вернуть на доработку.
            Версия записи защищает изменения от одновременного редактирования, а отправка выполняется в фоне.
          </p>
        </div>
        <div className="app-header-actions">
          <span className="status-badge">Автоматически по умолчанию</span>
          <span className="status-badge">Подтверждение при необходимости</span>
        </div>
      </section>

      <ReviewQueueWorkspace />
    </section>
  );
}
