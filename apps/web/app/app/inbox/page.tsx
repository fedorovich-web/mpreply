import { InboxWorkspace } from "../../../components/inbox/InboxWorkspace";

export default function InboxPage() {
  return (
    <section className="app-page app-page-wide inbox-page">
      <header className="app-header app-header-row inbox-page-header">
        <div>
          <p className="eyebrow">Входящие</p>
          <h1>Разберите обращения без переключения между кабинетами</h1>
          <p>
            Отфильтруйте очередь по площадке, типу, статусу, оценке или ответственному, откройте контекст рядом с сообщением и сразу выберите следующий шаг.
          </p>
        </div>
        <div className="app-header-actions" aria-label="Возможности очереди">
          <span className="status-badge">4 маркетплейса</span>
          <span className="status-badge">Фильтры сохраняются</span>
        </div>
      </header>

      <InboxWorkspace />
    </section>
  );
}
