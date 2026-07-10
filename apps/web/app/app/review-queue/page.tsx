import { ReviewQueueWorkspace } from "../../../components/review-queue/ReviewQueueWorkspace";

export default function ReviewQueuePage() {
  return (
    <section className="app-page app-page-wide">
      <section className="app-header app-header-row">
        <div>
          <p className="eyebrow">Review Queue</p>
          <h1>Ручная проверка без отключения auto-first режима</h1>
          <p>
            Реальная очередь semi-auto ответов: загрузка из API, optimistic revision, редактирование,
            SafetyGate, одобрение или возврат на доработку и отправка через worker pipeline.
          </p>
        </div>
        <div className="app-header-actions">
          <span className="status-badge">Auto by default</span>
          <span className="status-badge">Human approval optional</span>
        </div>
      </section>

      <ReviewQueueWorkspace />
    </section>
  );
}
