import { InboxWorkspace } from "../../../components/inbox/InboxWorkspace";

export default function InboxPage() {
  return (
    <section className="app-page app-page-wide">
      <section className="app-header app-header-row">
        <div>
          <p className="eyebrow">Обращения</p>
          <h1>Единая очередь отзывов и вопросов</h1>
          <p>
            Очередь загружается с сервера и поддерживает фильтры по типу, статусу, рейтингу и тексту.
            Изменения статуса сохраняются сразу в выбранной организации.
          </p>
        </div>
        <div className="app-header-actions">
          <span className="status-badge">Автоматизация по умолчанию</span>
          <span className="status-badge">Wildberries в MVP</span>
        </div>
      </section>

      <InboxWorkspace />
    </section>
  );
}
