import { InboxWorkspace } from "../../../components/inbox/InboxWorkspace";

export default function InboxPage() {
  return (
    <section className="app-page app-page-wide">
      <section className="app-header app-header-row">
        <div>
          <p className="eyebrow">Обращения</p>
          <h1>Отзывы, вопросы и сообщения в одной очереди</h1>
          <p>
            Фильтруйте обращения по площадке, типу, оценке и статусу, открывайте контекст товара и переходите к ответу без переключения между кабинетами маркетплейсов.
          </p>
        </div>
        <div className="app-header-actions">
          <span className="status-badge">Единая очередь</span>
          <span className="status-badge">4 маркетплейса</span>
        </div>
      </section>

      <InboxWorkspace />
    </section>
  );
}
