import { InboxWorkspace } from "../../../components/inbox/InboxWorkspace";

export default function InboxPage() {
  return (
    <section className="app-page app-page-wide">
      <section className="app-header app-header-row">
        <div>
          <p className="eyebrow">Обращения</p>
          <h1>Отзывы, вопросы и чаты</h1>
          <p>Единая очередь с фильтрами по типу, статусу, оценке и тексту обращения.</p>
        </div>
        <div className="app-header-actions">
          <span className="status-badge">Автоматические ответы</span>
          <span className="status-badge">Ручная проверка</span>
        </div>
      </section>

      <InboxWorkspace />
    </section>
  );
}
