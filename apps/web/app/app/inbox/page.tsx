import { InboxWorkspace } from "../../../components/inbox/InboxWorkspace";

export default function InboxPage() {
  return (
    <section className="app-page app-page-wide">
      <section className="app-header app-header-row">
        <div>
          <p className="eyebrow">Inbox</p>
          <h1>Единая очередь отзывов и вопросов</h1>
          <p>
            Live-очередь загружается из backend API с фильтрами по типу, статусу, рейтингу и поиску.
            Карточка обращения поддерживает реальные status updates без демонстрационных данных.
          </p>
        </div>
        <div className="app-header-actions">
          <span className="status-badge">Auto-first</span>
          <span className="status-badge">WB MVP</span>
        </div>
      </section>

      <InboxWorkspace />
    </section>
  );
}
